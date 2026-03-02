import { NextResponse } from "next/server";
import {
  measurementsTable,
  escapeForFormula,
  isValidRecordId,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`measurements:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, measurements } = body;

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    // Validate measurements array
    if (!Array.isArray(measurements) || measurements.length === 0) {
      return NextResponse.json(
        { error: "Measurements array is required" },
        { status: 400 }
      );
    }

    if (measurements.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 measurements per request" },
        { status: 400 }
      );
    }

    // Validate each measurement
    for (const m of measurements) {
      if (typeof m.name !== "string" || m.name.trim().length === 0) {
        return NextResponse.json(
          { error: "Each measurement must have a name" },
          { status: 400 }
        );
      }
      if (m.name.length > 200) {
        return NextResponse.json(
          { error: "Measurement name must be 200 characters or less" },
          { status: 400 }
        );
      }
      if (m.valueMm !== undefined && !Number.isFinite(m.valueMm)) {
        return NextResponse.json(
          { error: "Value must be a finite number" },
          { status: 400 }
        );
      }
    }

    // Batch create in Airtable (max 10 per call)
    const allRecords: Array<{ id: string }> = [];
    for (let i = 0; i < measurements.length; i += 10) {
      const batch = measurements.slice(i, i + 10);
      const records = await measurementsTable.create(
        batch.map(
          (m: {
            name: string;
            valueMm?: number;
            aiEstimated?: boolean;
            confirmed?: boolean;
            sizeReference?: string;
          }) => ({
            fields: {
              Name: m.name.trim().substring(0, 200),
              "Value MM": Number.isFinite(m.valueMm)
                ? Math.max(0, m.valueMm as number)
                : 0,
              "AI Estimated": m.aiEstimated === true,
              Confirmed: m.confirmed === true,
              "Size Reference": ((m.sizeReference as string) || "").substring(
                0,
                200
              ),
              Project: [projectId],
            },
          })
        )
      );
      allRecords.push(...records.map((r) => ({ id: r.getId() })));
    }

    return NextResponse.json({
      created: allRecords.length,
      ids: allRecords.map((r) => r.id),
    });
  } catch (error) {
    console.error(
      "Create measurements failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`measurements:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Valid projectId query parameter is required" },
        { status: 400 }
      );
    }

    const records = await measurementsTable
      .select({
        filterByFormula: `FIND("${escapeForFormula(projectId)}", ARRAYJOIN({Project})) > 0`,
        maxRecords: 100,
      })
      .all();

    const measurements = records.map((record) => ({
      id: record.getId(),
      projectId,
      name: record.get("Name") || "",
      valueMm: record.get("Value MM") || 0,
      aiEstimated: record.get("AI Estimated") === true,
      confirmed: record.get("Confirmed") === true,
      sizeReference: record.get("Size Reference") || "",
    }));

    return NextResponse.json({ measurements });
  } catch (error) {
    console.error(
      "List measurements failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`measurements:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { id, valueMm, confirmed, sizeReference } = body;

    if (typeof id !== "string" || !isValidRecordId(id)) {
      return NextResponse.json(
        { error: "Invalid measurement ID format" },
        { status: 400 }
      );
    }

    const updates: Record<string, string | number | boolean> = {};

    if (valueMm !== undefined) {
      if (!Number.isFinite(valueMm) || valueMm < 0) {
        return NextResponse.json(
          { error: "Value must be a non-negative finite number" },
          { status: 400 }
        );
      }
      if (valueMm > 10000) {
        return NextResponse.json(
          { error: "Value exceeds maximum allowed (10000mm)" },
          { status: 400 }
        );
      }
      updates["Value MM"] = valueMm;
    }

    if (confirmed !== undefined) {
      if (typeof confirmed !== "boolean") {
        return NextResponse.json(
          { error: "Confirmed must be a boolean" },
          { status: 400 }
        );
      }
      updates.Confirmed = confirmed;
    }

    if (sizeReference !== undefined) {
      if (typeof sizeReference !== "string") {
        return NextResponse.json(
          { error: "Size reference must be a string" },
          { status: 400 }
        );
      }
      if (sizeReference.length > 200) {
        return NextResponse.json(
          { error: "Size reference must be 200 characters or less" },
          { status: 400 }
        );
      }
      updates["Size Reference"] = sizeReference;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const record = await measurementsTable.update(id, updates);

    return NextResponse.json({
      id: record.getId(),
      name: record.get("Name") || "",
      valueMm: record.get("Value MM") || 0,
      aiEstimated: record.get("AI Estimated") === true,
      confirmed: record.get("Confirmed") === true,
      sizeReference: record.get("Size Reference") || "",
    });
  } catch (error) {
    console.error(
      "Update measurement failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
