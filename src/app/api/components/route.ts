import { NextResponse } from "next/server";
import {
  componentsTable,
  escapeForFormula,
  isValidRecordId,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { COMPONENT_CATEGORIES } from "@/lib/constants";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

const VALID_CATEGORIES = Object.keys(COMPONENT_CATEGORIES);

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`components:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, components } = body;

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    // Validate components array
    if (!Array.isArray(components) || components.length === 0) {
      return NextResponse.json(
        { error: "Components array is required" },
        { status: 400 }
      );
    }

    if (components.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 components per request" },
        { status: 400 }
      );
    }

    // Validate each component
    for (const comp of components) {
      if (typeof comp.name !== "string" || comp.name.trim().length === 0) {
        return NextResponse.json(
          { error: "Each component must have a name" },
          { status: 400 }
        );
      }
      if (comp.name.length > 200) {
        return NextResponse.json(
          { error: "Component name must be 200 characters or less" },
          { status: 400 }
        );
      }
      if (!VALID_CATEGORIES.includes(comp.category)) {
        return NextResponse.json(
          {
            error: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`,
          },
          { status: 400 }
        );
      }
    }

    // Batch create in Airtable (max 10 per call)
    const allRecords: Array<{ id: string }> = [];
    for (let i = 0; i < components.length; i += 10) {
      const batch = components.slice(i, i + 10);
      const records = await componentsTable.create(
        batch.map(
          (comp: {
            name: string;
            category: string;
            aiConfidence?: number;
            confirmed?: boolean;
            bestView?: string;
            labelX?: number;
            labelY?: number;
            notes?: string;
          }) => ({
            fields: {
              Name: comp.name.trim().substring(0, 200),
              Category: comp.category,
              "AI Confidence": Number.isFinite(comp.aiConfidence)
                ? Math.min(1, Math.max(0, comp.aiConfidence as number))
                : 0,
              Confirmed: comp.confirmed === true,
              "Best View": comp.bestView || "three_quarter",
              "Label X": Number.isFinite(comp.labelX)
                ? Math.min(100, Math.max(0, comp.labelX as number))
                : 50,
              "Label Y": Number.isFinite(comp.labelY)
                ? Math.min(100, Math.max(0, comp.labelY as number))
                : 50,
              Notes: ((comp.notes as string) || "").substring(0, 2000),
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
      "Create components failed:",
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
  const limit = rateLimit(`components:${ip}`, 30, 60000);
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

    const records = await componentsTable
      .select({
        filterByFormula: `FIND("${escapeForFormula(projectId)}", ARRAYJOIN({Project})) > 0`,
      })
      .all();

    const components = records.map((record) => ({
      id: record.getId(),
      projectId,
      name: record.get("Name") || "",
      category: record.get("Category") || "other",
      aiConfidence: record.get("AI Confidence") || 0,
      confirmed: record.get("Confirmed") === true,
      bestView: record.get("Best View") || "three_quarter",
      labelX: record.get("Label X") || 50,
      labelY: record.get("Label Y") || 50,
      notes: record.get("Notes") || "",
    }));

    return NextResponse.json({ components });
  } catch (error) {
    console.error(
      "List components failed:",
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
  const limit = rateLimit(`components:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { id, name, category, confirmed, notes } = body;

    if (typeof id !== "string" || !isValidRecordId(id)) {
      return NextResponse.json(
        { error: "Invalid component ID format" },
        { status: 400 }
      );
    }

    const updates: Record<string, string | number | boolean> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name must be a non-empty string" },
          { status: 400 }
        );
      }
      if (name.length > 200) {
        return NextResponse.json(
          { error: "Name must be 200 characters or less" },
          { status: 400 }
        );
      }
      updates.Name = name.trim();
    }

    if (category !== undefined) {
      if (!VALID_CATEGORIES.includes(category)) {
        return NextResponse.json(
          {
            error: `Category must be one of: ${VALID_CATEGORIES.join(", ")}`,
          },
          { status: 400 }
        );
      }
      updates.Category = category;
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

    if (notes !== undefined) {
      if (typeof notes !== "string") {
        return NextResponse.json(
          { error: "Notes must be a string" },
          { status: 400 }
        );
      }
      updates.Notes = notes.substring(0, 2000);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const record = await componentsTable.update(id, updates);

    return NextResponse.json({
      id: record.getId(),
      name: record.get("Name") || "",
      category: record.get("Category") || "other",
      confirmed: record.get("Confirmed") === true,
      notes: record.get("Notes") || "",
    });
  } catch (error) {
    console.error(
      "Update component failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`components:${ip}`, 30, 60000);
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
        { error: "Invalid component ID format" },
        { status: 400 }
      );
    }

    await componentsTable.destroy(id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(
      "Delete component failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
