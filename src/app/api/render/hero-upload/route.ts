import { NextResponse } from "next/server";
import {
  renderedViewsTable,
  projectsTable,
  isValidRecordId,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { isValidUrl } from "@/lib/validation";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`hero-upload:${ip}`, 10, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, heroImageUrl } = body;

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    // Validate heroImageUrl
    if (typeof heroImageUrl !== "string" || !isValidUrl(heroImageUrl)) {
      return NextResponse.json(
        { error: "Valid hero image URL is required" },
        { status: 400 }
      );
    }
    if (heroImageUrl.length > 2000) {
      return NextResponse.json(
        { error: "Hero image URL must be 2000 characters or less" },
        { status: 400 }
      );
    }

    // Update Project with hero image URL
    await projectsTable.update(projectId, {
      "Hero Image URL": heroImageUrl,
    });

    // Save as a Rendered View record
    const record = await renderedViewsTable.create({
      "View Name": "three_quarter",
      "Image URL": heroImageUrl,
      Project: [projectId],
      "Is Photorealistic": true,
      "Is Hero Reference": true,
    });

    return NextResponse.json({
      success: true,
      heroImageUrl,
      viewId: record.getId(),
    });
  } catch (error) {
    console.error(
      "Hero upload failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
