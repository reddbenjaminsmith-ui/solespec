import { NextResponse } from "next/server";
import { projectsTable, escapeForFormula } from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const hostname = url.hostname;
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") ||
      hostname.startsWith("172.23.") ||
      hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") ||
      hostname.startsWith("172.26.") ||
      hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") ||
      hostname.startsWith("172.29.") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

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
    const { name, email, modelUrl } = body;

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

    // Validate modelUrl
    if (typeof modelUrl !== "string" || !isValidUrl(modelUrl)) {
      return NextResponse.json(
        { error: "Valid model URL is required" },
        { status: 400 }
      );
    }

    const record = await projectsTable.create({
      Name: name.trim(),
      Email: email.trim().toLowerCase(),
      Status: "draft",
      "Model URL": modelUrl,
      "Wizard Step": 0,
    });

    return NextResponse.json({
      id: record.getId(),
      name: record.get("Name"),
      email: record.get("Email"),
      status: record.get("Status"),
      modelUrl: record.get("Model URL"),
      thumbnailUrl: record.get("Thumbnail URL") || "",
      wizardStep: record.get("Wizard Step") || 0,
      createdAt: record.get("Created") || new Date().toISOString(),
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
      createdAt: record.get("Created") || "",
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
