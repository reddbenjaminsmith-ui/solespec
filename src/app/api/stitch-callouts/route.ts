import { NextResponse } from "next/server";
import {
  stitchCalloutsTable,
  isValidRecordId,
  fetchProjectRecords,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import {
  TECHNICAL_VIEWS,
  STITCH_PATTERNS,
  THREAD_TYPES,
} from "@/lib/constants";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

const MAX_TEXT = 2000;
const VALID_VIEWS = TECHNICAL_VIEWS as readonly string[];
const VALID_PATTERNS = STITCH_PATTERNS as readonly string[];
const VALID_THREAD_TYPES = THREAD_TYPES as readonly string[];

function isValidCoord(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`stitch-callouts:${ip}`, 30, 60000);
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
        { error: "Maximum 50 stitch callouts per request" },
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
      if (!isValidCoord(item.positionX) || !isValidCoord(item.positionY)) {
        return NextResponse.json(
          { error: "Position coordinates must be numbers between 0 and 100" },
          { status: 400 }
        );
      }
      if (
        !Number.isFinite(item.spi) ||
        item.spi < 4 ||
        item.spi > 30
      ) {
        return NextResponse.json(
          { error: "SPI must be a number between 4 and 30" },
          { status: 400 }
        );
      }
      if (!VALID_THREAD_TYPES.includes(item.threadType)) {
        return NextResponse.json(
          { error: `Thread type must be one of: ${VALID_THREAD_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      if (!VALID_PATTERNS.includes(item.stitchPattern)) {
        return NextResponse.json(
          { error: `Stitch pattern must be one of: ${VALID_PATTERNS.join(", ")}` },
          { status: 400 }
        );
      }
      if (item.threadColor !== undefined && typeof item.threadColor !== "string") {
        return NextResponse.json(
          { error: "Thread color must be a string" },
          { status: 400 }
        );
      }
    }

    const allRecords: Array<{ id: string }> = [];
    for (let i = 0; i < items.length; i += 10) {
      const batch = items.slice(i, i + 10);
      const records = await stitchCalloutsTable.create(
        batch.map(
          (
            item: {
              viewName: string;
              positionX: number;
              positionY: number;
              spi: number;
              threadType: string;
              stitchPattern: string;
              threadColor?: string;
              notes?: string;
              sortOrder?: number;
            },
            index: number
          ) => ({
            fields: {
              Label: `Stitch ${i + index + 1}`,
              "View Name": item.viewName,
              "Position X": item.positionX,
              "Position Y": item.positionY,
              SPI: item.spi,
              "Thread Type": item.threadType,
              "Stitch Pattern": item.stitchPattern,
              "Thread Color": ((item.threadColor as string) || "").substring(
                0,
                100
              ),
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
      "Create stitch callouts failed:",
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
  const limit = rateLimit(`stitch-callouts:${ip}`, 30, 60000);
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

    const records = await fetchProjectRecords(stitchCalloutsTable, projectId);

    const items = records.map((record) => ({
      id: record.getId(),
      projectId,
      viewName: record.get("View Name") || "",
      positionX: record.get("Position X") || 0,
      positionY: record.get("Position Y") || 0,
      spi: record.get("SPI") || 0,
      threadType: record.get("Thread Type") || "",
      stitchPattern: record.get("Stitch Pattern") || "",
      threadColor: record.get("Thread Color") || "",
      notes: record.get("Notes") || "",
      sortOrder: record.get("Sort Order") || 0,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error(
      "List stitch callouts failed:",
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
  const limit = rateLimit(`stitch-callouts:${ip}`, 30, 60000);
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
        { error: "Invalid stitch callout ID format" },
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

    if (body.positionX !== undefined) {
      if (!isValidCoord(body.positionX)) {
        return NextResponse.json(
          { error: "Position X must be a number between 0 and 100" },
          { status: 400 }
        );
      }
      updates["Position X"] = body.positionX;
    }

    if (body.positionY !== undefined) {
      if (!isValidCoord(body.positionY)) {
        return NextResponse.json(
          { error: "Position Y must be a number between 0 and 100" },
          { status: 400 }
        );
      }
      updates["Position Y"] = body.positionY;
    }

    if (body.spi !== undefined) {
      if (!Number.isFinite(body.spi) || body.spi < 4 || body.spi > 30) {
        return NextResponse.json(
          { error: "SPI must be a number between 4 and 30" },
          { status: 400 }
        );
      }
      updates["SPI"] = body.spi;
    }

    if (body.threadType !== undefined) {
      if (!VALID_THREAD_TYPES.includes(body.threadType)) {
        return NextResponse.json(
          { error: `Thread type must be one of: ${VALID_THREAD_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
      updates["Thread Type"] = body.threadType;
    }

    if (body.stitchPattern !== undefined) {
      if (!VALID_PATTERNS.includes(body.stitchPattern)) {
        return NextResponse.json(
          { error: `Stitch pattern must be one of: ${VALID_PATTERNS.join(", ")}` },
          { status: 400 }
        );
      }
      updates["Stitch Pattern"] = body.stitchPattern;
    }

    if (body.threadColor !== undefined) {
      if (typeof body.threadColor !== "string") {
        return NextResponse.json(
          { error: "Thread color must be a string" },
          { status: 400 }
        );
      }
      updates["Thread Color"] = body.threadColor.substring(0, 100);
    }

    if (body.notes !== undefined) {
      if (typeof body.notes !== "string") {
        return NextResponse.json(
          { error: "Notes must be a string" },
          { status: 400 }
        );
      }
      updates["Notes"] = body.notes.substring(0, MAX_TEXT);
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

    const record = await stitchCalloutsTable.update(id, updates);

    return NextResponse.json({
      id: record.getId(),
      viewName: record.get("View Name") || "",
      positionX: record.get("Position X") || 0,
      positionY: record.get("Position Y") || 0,
      spi: record.get("SPI") || 0,
      threadType: record.get("Thread Type") || "",
      stitchPattern: record.get("Stitch Pattern") || "",
      threadColor: record.get("Thread Color") || "",
      notes: record.get("Notes") || "",
      sortOrder: record.get("Sort Order") || 0,
    });
  } catch (error) {
    console.error(
      "Update stitch callout failed:",
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
  const limit = rateLimit(`stitch-callouts:${ip}`, 30, 60000);
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
        { error: "Invalid stitch callout ID format" },
        { status: 400 }
      );
    }

    await stitchCalloutsTable.destroy(id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(
      "Delete stitch callout failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
