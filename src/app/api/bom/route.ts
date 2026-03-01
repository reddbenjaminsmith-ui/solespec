import { NextResponse } from "next/server";
import {
  bomItemsTable,
  escapeForFormula,
  isValidRecordId,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

const MAX_TEXT = 2000;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`bom:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, items } = body;

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    // Validate items array
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }

    if (items.length > 100) {
      return NextResponse.json(
        { error: "Maximum 100 BOM items per request" },
        { status: 400 }
      );
    }

    // Validate each item
    for (const item of items) {
      if (
        typeof item.component !== "string" ||
        item.component.trim().length === 0
      ) {
        return NextResponse.json(
          { error: "Each BOM item must have a component name" },
          { status: 400 }
        );
      }
      if (item.component.length > 200) {
        return NextResponse.json(
          { error: "Component name must be 200 characters or less" },
          { status: 400 }
        );
      }
    }

    // Batch create in Airtable (max 10 per call)
    const allRecords: Array<{ id: string }> = [];
    for (let i = 0; i < items.length; i += 10) {
      const batch = items.slice(i, i + 10);
      const records = await bomItemsTable.create(
        batch.map(
          (
            item: {
              component: string;
              materialName?: string;
              supplier?: string;
              color?: string;
              quantityPerPair?: string;
              notes?: string;
              sortOrder?: number;
            },
            index: number
          ) => ({
            fields: {
              Component: item.component.trim().substring(0, 200),
              "Material Name": (
                (item.materialName as string) || ""
              ).substring(0, 500),
              Supplier: ((item.supplier as string) || "").substring(0, 200),
              Color: ((item.color as string) || "").substring(0, 200),
              "Quantity Per Pair": (
                (item.quantityPerPair as string) || ""
              ).substring(0, 100),
              Notes: ((item.notes as string) || "").substring(0, MAX_TEXT),
              "Sort Order": Number.isFinite(item.sortOrder)
                ? item.sortOrder
                : i + index,
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
      "Create BOM items failed:",
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
  const limit = rateLimit(`bom:${ip}`, 30, 60000);
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

    const records = await bomItemsTable
      .select({
        filterByFormula: `FIND("${escapeForFormula(projectId)}", ARRAYJOIN({Project})) > 0`,
        sort: [{ field: "Sort Order", direction: "asc" }],
      })
      .all();

    const items = records.map((record) => ({
      id: record.getId(),
      projectId,
      component: record.get("Component") || "",
      materialName: record.get("Material Name") || "",
      supplier: record.get("Supplier") || "",
      color: record.get("Color") || "",
      quantityPerPair: record.get("Quantity Per Pair") || "",
      notes: record.get("Notes") || "",
      sortOrder: record.get("Sort Order") || 0,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error(
      "List BOM items failed:",
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
  const limit = rateLimit(`bom:${ip}`, 30, 60000);
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
        { error: "Invalid BOM item ID format" },
        { status: 400 }
      );
    }

    const updates: Record<string, string | number | boolean> = {};

    const textFieldMap: Record<string, { key: string; max: number }> = {
      component: { key: "Component", max: 200 },
      materialName: { key: "Material Name", max: 500 },
      supplier: { key: "Supplier", max: 200 },
      color: { key: "Color", max: 200 },
      quantityPerPair: { key: "Quantity Per Pair", max: 100 },
      notes: { key: "Notes", max: MAX_TEXT },
    };

    for (const [bodyKey, fieldConfig] of Object.entries(textFieldMap)) {
      if (body[bodyKey] !== undefined) {
        if (typeof body[bodyKey] !== "string") {
          return NextResponse.json(
            { error: `${fieldConfig.key} must be a string` },
            { status: 400 }
          );
        }
        updates[fieldConfig.key] = body[bodyKey].substring(0, fieldConfig.max);
      }
    }

    if (body.sortOrder !== undefined) {
      if (!Number.isFinite(body.sortOrder) || body.sortOrder < 0) {
        return NextResponse.json(
          { error: "Sort order must be a non-negative number" },
          { status: 400 }
        );
      }
      updates["Sort Order"] = body.sortOrder;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const record = await bomItemsTable.update(id, updates);

    return NextResponse.json({
      id: record.getId(),
      component: record.get("Component") || "",
      materialName: record.get("Material Name") || "",
      supplier: record.get("Supplier") || "",
      color: record.get("Color") || "",
      quantityPerPair: record.get("Quantity Per Pair") || "",
      notes: record.get("Notes") || "",
      sortOrder: record.get("Sort Order") || 0,
    });
  } catch (error) {
    console.error(
      "Update BOM item failed:",
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
  const limit = rateLimit(`bom:${ip}`, 30, 60000);
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
        { error: "Invalid BOM item ID format" },
        { status: 400 }
      );
    }

    await bomItemsTable.destroy(id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(
      "Delete BOM item failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
