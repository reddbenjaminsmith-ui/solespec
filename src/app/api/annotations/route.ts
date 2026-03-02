import { NextResponse } from "next/server";
import {
  annotationsTable,
  escapeForFormula,
  isValidRecordId,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { TECHNICAL_VIEWS } from "@/lib/constants";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

const MAX_TEXT = 2000;
const VALID_VIEWS = TECHNICAL_VIEWS as readonly string[];

function isValidCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`annotations:${ip}`, 30, 60000);
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

    if (items.length > 50) {
      return NextResponse.json(
        { error: "Maximum 50 annotations per request" },
        { status: 400 }
      );
    }

    for (const item of items) {
      if (!VALID_VIEWS.includes(item.viewName)) {
        return NextResponse.json(
          { error: "Invalid view name" },
          { status: 400 }
        );
      }
      if (
        !isValidCoord(item.arrowStartX) ||
        !isValidCoord(item.arrowStartY) ||
        !isValidCoord(item.arrowEndX) ||
        !isValidCoord(item.arrowEndY)
      ) {
        return NextResponse.json(
          { error: "Arrow coordinates must be numbers between 0 and 100" },
          { status: 400 }
        );
      }
      if (typeof item.text !== "string" || item.text.trim().length === 0) {
        return NextResponse.json(
          { error: "Each annotation must have text" },
          { status: 400 }
        );
      }
      if (item.text.length > MAX_TEXT) {
        return NextResponse.json(
          { error: `Text must be ${MAX_TEXT} characters or less` },
          { status: 400 }
        );
      }
    }

    const allRecords: Array<{ id: string }> = [];
    for (let i = 0; i < items.length; i += 10) {
      const batch = items.slice(i, i + 10);
      const records = await annotationsTable.create(
        batch.map(
          (
            item: {
              viewName: string;
              arrowStartX: number;
              arrowStartY: number;
              arrowEndX: number;
              arrowEndY: number;
              text: string;
              sortOrder?: number;
            },
            index: number
          ) => ({
            fields: {
              Label: `Annotation ${i + index + 1}`,
              "View Name": item.viewName,
              "Arrow Start X": item.arrowStartX,
              "Arrow Start Y": item.arrowStartY,
              "Arrow End X": item.arrowEndX,
              "Arrow End Y": item.arrowEndY,
              Text: item.text.trim().substring(0, MAX_TEXT),
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
      "Create annotations failed:",
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
  const limit = rateLimit(`annotations:${ip}`, 30, 60000);
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

    const records = await annotationsTable
      .select({
        filterByFormula: `FIND("${escapeForFormula(projectId)}", ARRAYJOIN({Project})) > 0`,
        sort: [{ field: "Sort Order", direction: "asc" }],
        maxRecords: 100,
      })
      .all();

    const items = records.map((record) => ({
      id: record.getId(),
      projectId,
      viewName: record.get("View Name") || "",
      arrowStartX: record.get("Arrow Start X") || 0,
      arrowStartY: record.get("Arrow Start Y") || 0,
      arrowEndX: record.get("Arrow End X") || 0,
      arrowEndY: record.get("Arrow End Y") || 0,
      text: record.get("Text") || "",
      sortOrder: record.get("Sort Order") || 0,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error(
      "List annotations failed:",
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
  const limit = rateLimit(`annotations:${ip}`, 30, 60000);
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
        { error: "Invalid annotation ID format" },
        { status: 400 }
      );
    }

    const updates: Record<string, string | number | boolean> = {};

    if (body.viewName !== undefined) {
      if (!VALID_VIEWS.includes(body.viewName)) {
        return NextResponse.json(
          { error: "Invalid view name" },
          { status: 400 }
        );
      }
      updates["View Name"] = body.viewName;
    }

    const coordFields: Record<string, string> = {
      arrowStartX: "Arrow Start X",
      arrowStartY: "Arrow Start Y",
      arrowEndX: "Arrow End X",
      arrowEndY: "Arrow End Y",
    };

    for (const [bodyKey, fieldName] of Object.entries(coordFields)) {
      if (body[bodyKey] !== undefined) {
        if (!isValidCoord(body[bodyKey])) {
          return NextResponse.json(
            { error: `${fieldName} must be a number between 0 and 100` },
            { status: 400 }
          );
        }
        updates[fieldName] = body[bodyKey];
      }
    }

    if (body.text !== undefined) {
      if (typeof body.text !== "string") {
        return NextResponse.json(
          { error: "Text must be a string" },
          { status: 400 }
        );
      }
      updates["Text"] = body.text.substring(0, MAX_TEXT);
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

    const record = await annotationsTable.update(id, updates);

    return NextResponse.json({
      id: record.getId(),
      viewName: record.get("View Name") || "",
      arrowStartX: record.get("Arrow Start X") || 0,
      arrowStartY: record.get("Arrow Start Y") || 0,
      arrowEndX: record.get("Arrow End X") || 0,
      arrowEndY: record.get("Arrow End Y") || 0,
      text: record.get("Text") || "",
      sortOrder: record.get("Sort Order") || 0,
    });
  } catch (error) {
    console.error(
      "Update annotation failed:",
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
  const limit = rateLimit(`annotations:${ip}`, 30, 60000);
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
        { error: "Invalid annotation ID format" },
        { status: 400 }
      );
    }

    await annotationsTable.destroy(id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(
      "Delete annotation failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
