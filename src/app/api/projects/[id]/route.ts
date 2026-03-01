import { NextResponse } from "next/server";
import { projectsTable, isValidRecordId } from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

const VALID_STATUSES = ["draft", "analyzing", "in_progress", "complete"];

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request);
  const limit = rateLimit(`projects:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const { id } = params;

  if (!isValidRecordId(id)) {
    return NextResponse.json(
      { error: "Invalid project ID format" },
      { status: 400 }
    );
  }

  try {
    const record = await projectsTable.find(id);

    return NextResponse.json({
      id: record.getId(),
      name: record.get("Name") || "",
      email: record.get("Email") || "",
      status: record.get("Status") || "draft",
      modelUrl: record.get("Model URL") || "",
      thumbnailUrl: record.get("Thumbnail URL") || "",
      wizardStep: record.get("Wizard Step") || 0,
      createdAt: record.get("Created") || "",
      sourceType: record.get("Source Type") || "3D Model",
      sketchUrl: record.get("Sketch URL") || "",
      predecessorModelUrl: record.get("Predecessor Model URL") || "",
      sketchAnalysis: record.get("Sketch Analysis") || "",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    if (message.includes("NOT_FOUND") || message.includes("Could not find")) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    console.error("Get project failed:", message);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const ip = getClientIp(request);
  const limit = rateLimit(`projects:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const { id } = params;

  if (!isValidRecordId(id)) {
    return NextResponse.json(
      { error: "Invalid project ID format" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const updates: Record<string, string | number> = {};

    // Validate each optional field if present
    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: "Project name must be a non-empty string" },
          { status: 400 }
        );
      }
      if (body.name.trim().length > 200) {
        return NextResponse.json(
          { error: "Project name must be 200 characters or less" },
          { status: 400 }
        );
      }
      updates["Name"] = body.name.trim();
    }

    if (body.status !== undefined) {
      if (!VALID_STATUSES.includes(body.status)) {
        return NextResponse.json(
          { error: `Status must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      updates["Status"] = body.status;
    }

    if (body.thumbnailUrl !== undefined) {
      if (typeof body.thumbnailUrl !== "string") {
        return NextResponse.json(
          { error: "Thumbnail URL must be a string" },
          { status: 400 }
        );
      }
      // Allow empty string to clear thumbnail
      if (body.thumbnailUrl.length > 0) {
        try {
          new URL(body.thumbnailUrl);
        } catch {
          return NextResponse.json(
            { error: "Invalid thumbnail URL" },
            { status: 400 }
          );
        }
      }
      updates["Thumbnail URL"] = body.thumbnailUrl;
    }

    if (body.wizardStep !== undefined) {
      if (!Number.isFinite(body.wizardStep) || body.wizardStep < 0 || body.wizardStep > 10) {
        return NextResponse.json(
          { error: "Wizard step must be a number between 0 and 10" },
          { status: 400 }
        );
      }
      updates["Wizard Step"] = body.wizardStep;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Support updating sketch-specific fields
    if (body.sketchAnalysis !== undefined) {
      if (typeof body.sketchAnalysis !== "string" || body.sketchAnalysis.length > 50000) {
        return NextResponse.json(
          { error: "Sketch analysis must be a string under 50000 characters" },
          { status: 400 }
        );
      }
      updates["Sketch Analysis"] = body.sketchAnalysis;
    }

    const record = await projectsTable.update(id, updates);

    return NextResponse.json({
      id: record.getId(),
      name: record.get("Name") || "",
      email: record.get("Email") || "",
      status: record.get("Status") || "draft",
      modelUrl: record.get("Model URL") || "",
      thumbnailUrl: record.get("Thumbnail URL") || "",
      wizardStep: record.get("Wizard Step") || 0,
      createdAt: record.get("Created") || "",
      sourceType: record.get("Source Type") || "3D Model",
      sketchUrl: record.get("Sketch URL") || "",
      predecessorModelUrl: record.get("Predecessor Model URL") || "",
      sketchAnalysis: record.get("Sketch Analysis") || "",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    if (message.includes("NOT_FOUND") || message.includes("Could not find")) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }
    console.error("Update project failed:", message);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
