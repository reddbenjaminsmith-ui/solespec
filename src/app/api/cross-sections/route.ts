import { NextResponse } from "next/server";
import {
  crossSectionsTable,
  isValidRecordId,
  fetchProjectRecords,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

const VALID_VIEW_TYPES = ["top", "right"];

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`cross-sections:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, items } = body;

    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items array is required" },
        { status: 400 }
      );
    }

    if (items.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 cross-section lines per request" },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (typeof item.label !== "string" || item.label.trim().length === 0) {
        return NextResponse.json(
          { error: "Each cross-section must have a label" },
          { status: 400 }
        );
      }
      if (item.label.length > 10) {
        return NextResponse.json(
          { error: "Label must be 10 characters or less" },
          { status: 400 }
        );
      }
      if (!VALID_VIEW_TYPES.includes(item.viewType)) {
        return NextResponse.json(
          { error: "View type must be 'top' or 'right'" },
          { status: 400 }
        );
      }
      if (
        !Number.isFinite(item.linePosition) ||
        item.linePosition < 0 ||
        item.linePosition > 100
      ) {
        return NextResponse.json(
          { error: "Line position must be a number between 0 and 100" },
          { status: 400 }
        );
      }
    }

    const allRecords: Array<{ id: string }> = [];
    for (let i = 0; i < items.length; i += 10) {
      const batch = items.slice(i, i + 10);
      const records = await crossSectionsTable.create(
        batch.map(
          (
            item: {
              label: string;
              viewType: string;
              linePosition: number;
              description?: string;
              sortOrder?: number;
            },
            index: number
          ) => ({
            fields: {
              Label: item.label.trim().substring(0, 10),
              "View Type": item.viewType,
              "Line Position": item.linePosition,
              Description: (
                (item.description as string) || ""
              ).substring(0, 500),
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
      "Create cross-sections failed:",
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
  const limit = rateLimit(`cross-sections:${ip}`, 30, 60000);
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

    const records = await fetchProjectRecords(crossSectionsTable, projectId);

    const items = records.map((record) => ({
      id: record.getId(),
      projectId,
      label: record.get("Label") || "",
      viewType: record.get("View Type") || "top",
      linePosition: record.get("Line Position") || 0,
      description: record.get("Description") || "",
      sortOrder: record.get("Sort Order") || 0,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error(
      "List cross-sections failed:",
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
  const limit = rateLimit(`cross-sections:${ip}`, 30, 60000);
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
        { error: "Invalid cross-section ID format" },
        { status: 400 }
      );
    }

    const updates: Record<string, string | number | boolean> = {};

    if (body.label !== undefined) {
      if (typeof body.label !== "string") {
        return NextResponse.json(
          { error: "Label must be a string" },
          { status: 400 }
        );
      }
      updates["Label"] = body.label.substring(0, 10);
    }

    if (body.viewType !== undefined) {
      if (!VALID_VIEW_TYPES.includes(body.viewType)) {
        return NextResponse.json(
          { error: "View type must be 'top' or 'right'" },
          { status: 400 }
        );
      }
      updates["View Type"] = body.viewType;
    }

    if (body.linePosition !== undefined) {
      if (
        !Number.isFinite(body.linePosition) ||
        body.linePosition < 0 ||
        body.linePosition > 100
      ) {
        return NextResponse.json(
          { error: "Line position must be a number between 0 and 100" },
          { status: 400 }
        );
      }
      updates["Line Position"] = body.linePosition;
    }

    if (body.description !== undefined) {
      if (typeof body.description !== "string") {
        return NextResponse.json(
          { error: "Description must be a string" },
          { status: 400 }
        );
      }
      updates["Description"] = body.description.substring(0, 500);
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

    const record = await crossSectionsTable.update(id, updates);

    return NextResponse.json({
      id: record.getId(),
      label: record.get("Label") || "",
      viewType: record.get("View Type") || "top",
      linePosition: record.get("Line Position") || 0,
      description: record.get("Description") || "",
      sortOrder: record.get("Sort Order") || 0,
    });
  } catch (error) {
    console.error(
      "Update cross-section failed:",
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
  const limit = rateLimit(`cross-sections:${ip}`, 30, 60000);
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
        { error: "Invalid cross-section ID format" },
        { status: 400 }
      );
    }

    await crossSectionsTable.destroy(id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(
      "Delete cross-section failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
