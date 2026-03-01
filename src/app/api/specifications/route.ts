import { NextResponse } from "next/server";
import {
  specificationsTable,
  escapeForFormula,
  isValidRecordId,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { CONSTRUCTION_METHODS } from "@/lib/constants";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

const VALID_CONSTRUCTION_METHODS = CONSTRUCTION_METHODS.map((m) => m.value);
const MAX_TEXT = 2000;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`specifications:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, specifications } = body;

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    if (!specifications || typeof specifications !== "object") {
      return NextResponse.json(
        { error: "Specifications object is required" },
        { status: 400 }
      );
    }

    // Validate construction method if provided
    if (
      specifications.constructionMethod &&
      !VALID_CONSTRUCTION_METHODS.includes(specifications.constructionMethod)
    ) {
      return NextResponse.json(
        {
          error: `Construction method must be one of: ${VALID_CONSTRUCTION_METHODS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Build fields with length validation
    const fields: Record<string, string | string[] | number | boolean> = {
      Project: [projectId],
    };

    const textFields: Record<string, string> = {
      "Upper Material": specifications.upperMaterial,
      "Upper Secondary": specifications.upperSecondary,
      "Lining Material": specifications.liningMaterial,
      "Outsole Material": specifications.outsoleMaterial,
      "Midsole Material": specifications.midsoleMaterial,
      Hardware: specifications.hardware,
      "Construction Method": specifications.constructionMethod,
      "Additional Notes": specifications.additionalNotes,
    };

    for (const [key, value] of Object.entries(textFields)) {
      if (value !== undefined && value !== null) {
        if (typeof value !== "string") {
          return NextResponse.json(
            { error: `${key} must be a string` },
            { status: 400 }
          );
        }
        fields[key] = value.substring(0, MAX_TEXT);
      }
    }

    const record = await specificationsTable.create(fields);

    return NextResponse.json({
      id: record.getId(),
      projectId,
      upperMaterial: record.get("Upper Material") || "",
      upperSecondary: record.get("Upper Secondary") || "",
      liningMaterial: record.get("Lining Material") || "",
      outsoleMaterial: record.get("Outsole Material") || "",
      midsoleMaterial: record.get("Midsole Material") || "",
      hardware: record.get("Hardware") || "",
      constructionMethod: record.get("Construction Method") || "",
      additionalNotes: record.get("Additional Notes") || "",
    });
  } catch (error) {
    console.error(
      "Create specifications failed:",
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
  const limit = rateLimit(`specifications:${ip}`, 30, 60000);
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

    const records = await specificationsTable
      .select({
        filterByFormula: `FIND("${escapeForFormula(projectId)}", ARRAYJOIN({Project})) > 0`,
      })
      .all();

    if (records.length === 0) {
      return NextResponse.json({ specifications: null });
    }

    const record = records[0];
    return NextResponse.json({
      specifications: {
        id: record.getId(),
        projectId,
        upperMaterial: record.get("Upper Material") || "",
        upperSecondary: record.get("Upper Secondary") || "",
        liningMaterial: record.get("Lining Material") || "",
        outsoleMaterial: record.get("Outsole Material") || "",
        midsoleMaterial: record.get("Midsole Material") || "",
        hardware: record.get("Hardware") || "",
        constructionMethod: record.get("Construction Method") || "",
        additionalNotes: record.get("Additional Notes") || "",
      },
    });
  } catch (error) {
    console.error(
      "Get specifications failed:",
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
  const limit = rateLimit(`specifications:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (typeof id !== "string" || !isValidRecordId(id)) {
      return NextResponse.json(
        { error: "Invalid specifications ID format" },
        { status: 400 }
      );
    }

    // Validate construction method if provided
    if (
      body.constructionMethod &&
      !VALID_CONSTRUCTION_METHODS.includes(body.constructionMethod)
    ) {
      return NextResponse.json(
        {
          error: `Construction method must be one of: ${VALID_CONSTRUCTION_METHODS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    const updates: Record<string, string | number | boolean> = {};
    const textFields: Record<string, string> = {
      "Upper Material": body.upperMaterial,
      "Upper Secondary": body.upperSecondary,
      "Lining Material": body.liningMaterial,
      "Outsole Material": body.outsoleMaterial,
      "Midsole Material": body.midsoleMaterial,
      Hardware: body.hardware,
      "Construction Method": body.constructionMethod,
      "Additional Notes": body.additionalNotes,
    };

    for (const [key, value] of Object.entries(textFields)) {
      if (value !== undefined) {
        if (typeof value !== "string") {
          return NextResponse.json(
            { error: `${key} must be a string` },
            { status: 400 }
          );
        }
        updates[key] = value.substring(0, MAX_TEXT);
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const record = await specificationsTable.update(id, updates);

    return NextResponse.json({
      id: record.getId(),
      upperMaterial: record.get("Upper Material") || "",
      upperSecondary: record.get("Upper Secondary") || "",
      liningMaterial: record.get("Lining Material") || "",
      outsoleMaterial: record.get("Outsole Material") || "",
      midsoleMaterial: record.get("Midsole Material") || "",
      hardware: record.get("Hardware") || "",
      constructionMethod: record.get("Construction Method") || "",
      additionalNotes: record.get("Additional Notes") || "",
    });
  } catch (error) {
    console.error(
      "Update specifications failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
