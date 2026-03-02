import { NextResponse } from "next/server";
import {
  renderedViewsTable,
  projectsTable,
  isValidRecordId,
  fetchProjectRecords,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { getGemini, GEMINI_IMAGE_MODEL, GEMINI_IMAGE_FALLBACK } from "@/lib/ai/gemini";
import { buildHeroPrompt } from "@/lib/ai/prompts";
import { MATERIALS } from "@/lib/constants";
import { put } from "@vercel/blob";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

export const maxDuration = 60;

// Flatten material arrays into sets for validation
const VALID_UPPER = new Set(MATERIALS.upper);
const VALID_OUTSOLE = new Set(MATERIALS.outsole);
const VALID_MIDSOLE = new Set(MATERIALS.midsole);
const VALID_LINING = new Set(MATERIALS.lining);
const VALID_HARDWARE = new Set(MATERIALS.hardware);

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`render-hero:${ip}`, 5, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, materials, colorDescription } = body;

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    // Validate materials object
    if (!materials || typeof materials !== "object") {
      return NextResponse.json(
        { error: "Materials object is required" },
        { status: 400 }
      );
    }

    const { upper, outsole, midsole, lining, hardware } = materials;

    if (typeof upper !== "string" || !VALID_UPPER.has(upper as typeof MATERIALS.upper[number])) {
      return NextResponse.json(
        { error: `Upper material must be one of: ${MATERIALS.upper.join(", ")}` },
        { status: 400 }
      );
    }
    if (typeof outsole !== "string" || !VALID_OUTSOLE.has(outsole as typeof MATERIALS.outsole[number])) {
      return NextResponse.json(
        { error: `Outsole material must be one of: ${MATERIALS.outsole.join(", ")}` },
        { status: 400 }
      );
    }
    if (typeof midsole !== "string" || !VALID_MIDSOLE.has(midsole as typeof MATERIALS.midsole[number])) {
      return NextResponse.json(
        { error: `Midsole material must be one of: ${MATERIALS.midsole.join(", ")}` },
        { status: 400 }
      );
    }
    if (typeof lining !== "string" || !VALID_LINING.has(lining as typeof MATERIALS.lining[number])) {
      return NextResponse.json(
        { error: `Lining material must be one of: ${MATERIALS.lining.join(", ")}` },
        { status: 400 }
      );
    }
    if (typeof hardware !== "string" || !VALID_HARDWARE.has(hardware as typeof MATERIALS.hardware[number])) {
      return NextResponse.json(
        { error: `Hardware material must be one of: ${MATERIALS.hardware.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate colorDescription
    if (typeof colorDescription !== "string" || colorDescription.trim().length === 0) {
      return NextResponse.json(
        { error: "Color description is required" },
        { status: 400 }
      );
    }
    if (colorDescription.length > 500) {
      return NextResponse.json(
        { error: "Color description must be 500 characters or less" },
        { status: 400 }
      );
    }

    // Fetch the three_quarter raw capture
    const allViewRecords = await fetchProjectRecords(renderedViewsTable, projectId);
    const threeQuarterCapture = allViewRecords.find(
      (r) =>
        r.get("View Name") === "three_quarter" &&
        r.get("Is Photorealistic") !== true &&
        r.get("Is Studio Render") !== true
    );

    if (!threeQuarterCapture) {
      return NextResponse.json(
        { error: "No 3/4 view capture found. Capture views first." },
        { status: 400 }
      );
    }

    const captureUrl = threeQuarterCapture.get("Image URL") as string;
    if (!captureUrl) {
      return NextResponse.json(
        { error: "3/4 view capture has no image URL" },
        { status: 400 }
      );
    }

    // Download the capture image
    const imageResponse = await fetch(captureUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download 3/4 view capture" },
        { status: 500 }
      );
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    // Build structured JSON hero prompt
    const heroPrompt = buildHeroPrompt(
      { upper, outsole, midsole, lining, hardware },
      colorDescription.trim()
    );

    // Call Gemini with the hero prompt + capture image
    let activeModel = GEMINI_IMAGE_MODEL;
    let response;
    try {
      response = await getGemini().models.generateContent({
        model: activeModel,
        contents: [
          {
            role: "user",
            parts: [
              { text: heroPrompt },
              { inlineData: { mimeType: "image/png", data: base64Image } },
            ],
          },
        ],
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: "1:1" },
        },
      });
    } catch (primaryErr) {
      const msg = primaryErr instanceof Error ? primaryErr.message : "";
      const isOverload = msg.includes("503") || msg.includes("high demand") || msg.includes("overloaded");
      if (isOverload && activeModel !== GEMINI_IMAGE_FALLBACK) {
        activeModel = GEMINI_IMAGE_FALLBACK;
        response = await getGemini().models.generateContent({
          model: activeModel,
          contents: [
            {
              role: "user",
              parts: [
                { text: heroPrompt },
                { inlineData: { mimeType: "image/png", data: base64Image } },
              ],
            },
          ],
          config: {
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: { aspectRatio: "1:1" },
          },
        });
      } else {
        throw primaryErr;
      }
    }

    // Extract generated image
    let renderedImageData: string | null = null;
    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          renderedImageData = part.inlineData.data;
          break;
        }
      }
    }

    if (!renderedImageData) {
      return NextResponse.json(
        { error: "AI failed to generate hero image. Try again." },
        { status: 500 }
      );
    }

    // Upload to Vercel Blob
    const renderedBuffer = Buffer.from(renderedImageData, "base64");
    const blob = await put(
      `renders/${projectId}/hero.png`,
      renderedBuffer,
      { access: "public", contentType: "image/png", addRandomSuffix: true }
    );

    // Save to Rendered Views
    const record = await renderedViewsTable.create({
      "View Name": "three_quarter",
      "Image URL": blob.url,
      Project: [projectId],
      "Is Photorealistic": true,
      "Is Hero Reference": true,
    });

    // Update Project with hero image URL
    await projectsTable.update(projectId, {
      "Hero Image URL": blob.url,
    });

    return NextResponse.json({
      heroImageUrl: blob.url,
      viewId: record.getId(),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Hero render failed:", errMsg);

    // Provide specific error messages for known failure modes
    if (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota")) {
      return NextResponse.json(
        { error: "Gemini API quota exceeded. Enable billing at ai.google.dev to use image generation." },
        { status: 429 }
      );
    }
    if (errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("overloaded")) {
      return NextResponse.json(
        { error: "Gemini image generation is experiencing high demand. Please try again in a few minutes." },
        { status: 503 }
      );
    }
    if (errMsg.includes("403") || errMsg.includes("401") || errMsg.includes("PERMISSION_DENIED")) {
      return NextResponse.json(
        { error: "Gemini API key is invalid or lacks permission for image generation." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
