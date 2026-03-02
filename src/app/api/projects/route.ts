import { NextResponse } from "next/server";
import { projectsTable, escapeForFormula } from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { isValidUrl } from "@/lib/validation";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`projects:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { name, email, modelUrl, sourceType, sketchUrl, predecessorModelUrl } = body;

    // Validate name
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }
    if (name.trim().length > 200) {
      return NextResponse.json(
        { error: "Project name must be 200 characters or less" },
        { status: 400 }
      );
    }

    // Validate email
    if (
      typeof email !== "string" ||
      !email.includes("@") ||
      !email.includes(".")
    ) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      );
    }
    if (email.length > 254) {
      return NextResponse.json(
        { error: "Email must be 254 characters or less" },
        { status: 400 }
      );
    }

    // Validate sourceType
    const validSourceTypes = ["3D Model", "Sketch"];
    const resolvedSourceType = validSourceTypes.includes(sourceType) ? sourceType : "3D Model";

    // For sketch projects, validate sketch and predecessor URLs instead of modelUrl
    if (resolvedSourceType === "Sketch") {
      if (typeof sketchUrl !== "string" || !isValidUrl(sketchUrl)) {
        return NextResponse.json(
          { error: "Valid sketch image URL is required" },
          { status: 400 }
        );
      }
      if (typeof predecessorModelUrl !== "string" || !isValidUrl(predecessorModelUrl)) {
        return NextResponse.json(
          { error: "Valid predecessor model URL is required" },
          { status: 400 }
        );
      }
    } else {
      // For 3D Model projects, validate modelUrl
      if (typeof modelUrl !== "string" || !isValidUrl(modelUrl)) {
        return NextResponse.json(
          { error: "Valid model URL is required" },
          { status: 400 }
        );
      }
    }

    // Build Airtable record fields
    const coreFields: Record<string, string | number> = {
      Name: name.trim(),
      Email: email.trim().toLowerCase(),
      Status: "draft",
      "Wizard Step": 0,
    };

    if (resolvedSourceType === "Sketch") {
      coreFields["Source Type"] = resolvedSourceType;
      coreFields["Sketch URL"] = sketchUrl;
      coreFields["Predecessor Model URL"] = predecessorModelUrl;
      coreFields["Model URL"] = predecessorModelUrl;
    } else {
      coreFields["Model URL"] = modelUrl;
    }

    // Try creating with Source Type field first; if it doesn't exist in Airtable,
    // fall back to core fields only (Source Type was added with the sketch workflow)
    let record;
    if (resolvedSourceType !== "Sketch") {
      try {
        record = await projectsTable.create({ ...coreFields, "Source Type": "3D Model" });
      } catch {
        // Source Type field may not exist yet - retry without it
        record = await projectsTable.create(coreFields);
      }
    } else {
      record = await projectsTable.create(coreFields);
    }

    return NextResponse.json({
      id: record.getId(),
      name: record.get("Name"),
      email: record.get("Email"),
      status: record.get("Status"),
      modelUrl: record.get("Model URL") || "",
      thumbnailUrl: record.get("Thumbnail URL") || "",
      wizardStep: record.get("Wizard Step") || 0,
      createdAt: record.get("Created") || new Date().toISOString(),
      sourceType: record.get("Source Type") || "3D Model",
      sketchUrl: record.get("Sketch URL") || "",
      predecessorModelUrl: record.get("Predecessor Model URL") || "",
      sketchAnalysis: record.get("Sketch Analysis") || "",
    });
  } catch (error) {
    console.error(
      "Create project failed:",
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
  const limit = rateLimit(`projects:${ip}`, 30, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email");

    if (
      typeof email !== "string" ||
      !email.includes("@") ||
      !email.includes(".")
    ) {
      return NextResponse.json(
        { error: "Valid email query parameter is required" },
        { status: 400 }
      );
    }
    if (email.length > 254) {
      return NextResponse.json(
        { error: "Email must be 254 characters or less" },
        { status: 400 }
      );
    }

    const records = await projectsTable
      .select({
        filterByFormula: `{Email} = "${escapeForFormula(email.trim().toLowerCase())}"`,
        sort: [{ field: "Name", direction: "desc" }],
        maxRecords: 100,
      })
      .all();

    const projects = records.map((record) => ({
      id: record.getId(),
      name: record.get("Name") || "",
      email: record.get("Email") || "",
      status: record.get("Status") || "draft",
      modelUrl: record.get("Model URL") || "",
      thumbnailUrl: record.get("Thumbnail URL") || "",
      wizardStep: record.get("Wizard Step") || 0,
      createdAt: record.get("Created") || new Date().toISOString(),
      sourceType: record.get("Source Type") || "3D Model",
      sketchUrl: record.get("Sketch URL") || "",
      predecessorModelUrl: record.get("Predecessor Model URL") || "",
      sketchAnalysis: record.get("Sketch Analysis") || "",
    }));

    return NextResponse.json({ projects });
  } catch (error) {
    console.error(
      "List projects failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
