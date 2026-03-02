import { NextResponse } from "next/server";
import {
  renderedViewsTable,
  isValidRecordId,
  fetchProjectRecords,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { TECHNICAL_VIEWS } from "@/lib/constants";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`views:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, viewName, imageUrl } = body;

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    // Validate viewName against whitelist
    if (
      typeof viewName !== "string" ||
      !(TECHNICAL_VIEWS as readonly string[]).includes(viewName)
    ) {
      return NextResponse.json(
        { error: `View name must be one of: ${TECHNICAL_VIEWS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate imageUrl
    if (typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }
    try {
      const url = new URL(imageUrl);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return NextResponse.json(
          { error: "Image URL must use https or http" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid image URL" },
        { status: 400 }
      );
    }

    const record = await renderedViewsTable.create({
      "View Name": viewName,
      "Image URL": imageUrl,
      Project: [projectId], // Linked field - must be array
    });

    return NextResponse.json({
      id: record.getId(),
      projectId,
      viewName: record.get("View Name") || viewName,
      imageUrl: record.get("Image URL") || imageUrl,
    });
  } catch (error) {
    console.error(
      "Create view failed:",
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
  const limit = rateLimit(`views:${ip}`, 30, 60000);
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

    const records = await fetchProjectRecords(renderedViewsTable, projectId);

    const views = records.map((record) => ({
      id: record.getId(),
      projectId,
      viewName: record.get("View Name") || "",
      imageUrl: record.get("Image URL") || "",
    }));

    return NextResponse.json({ views });
  } catch (error) {
    console.error(
      "List views failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
