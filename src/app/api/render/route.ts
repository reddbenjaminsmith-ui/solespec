import { NextResponse } from "next/server";
import {
  renderedViewsTable,
  isValidRecordId,
  fetchProjectRecords,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { getGemini, GEMINI_IMAGE_MODEL, GEMINI_IMAGE_FALLBACK } from "@/lib/ai/gemini";
import { RENDER_PROMPT } from "@/lib/ai/prompts";
import { put } from "@vercel/blob";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

export const maxDuration = 60;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`render:${ip}`, 5, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId } = body;

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    // Fetch existing views for this project, filter raw (non-photorealistic) in app code
    const allViewRecords = await fetchProjectRecords(renderedViewsTable, projectId);
    const viewRecords = allViewRecords.filter(
      (r) => r.get("Is Photorealistic") !== true
    );

    if (viewRecords.length === 0) {
      return NextResponse.json(
        { error: "No views found for this project. Capture views first." },
        { status: 400 }
      );
    }

    const views = viewRecords.map((r) => ({
      viewName: (r.get("View Name") as string) || "",
      imageUrl: (r.get("Image URL") as string) || "",
    }));

    // Stream progress back to client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        const renderedViews: Array<{ viewName: string; imageUrl: string; id: string }> = [];
        let errorSent = false;
        let activeModel = GEMINI_IMAGE_MODEL;

        // Helper: call Gemini with a given model and image
        async function callGemini(model: string, base64Image: string) {
          return getGemini().models.generateContent({
            model,
            contents: [
              {
                role: "user",
                parts: [
                  { text: RENDER_PROMPT },
                  { inlineData: { mimeType: "image/png", data: base64Image } },
                ],
              },
            ],
            config: {
              responseModalities: ["IMAGE", "TEXT"],
              imageConfig: { aspectRatio: "1:1" },
            },
          });
        }

        // Render a single view end-to-end
        async function renderView(view: { viewName: string; imageUrl: string }) {
          // Download the original image
          const imageResponse = await fetch(view.imageUrl);
          if (!imageResponse.ok) {
            return { viewName: view.viewName, error: "Failed to download original image" };
          }
          const imageBuffer = await imageResponse.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString("base64");

          // Try active model, fallback on overload (503)
          let response;
          try {
            response = await callGemini(activeModel, base64Image);
          } catch (primaryErr) {
            const msg = primaryErr instanceof Error ? primaryErr.message : "";
            const isOverload = msg.includes("503") || msg.includes("high demand") || msg.includes("overloaded");
            if (isOverload && activeModel !== GEMINI_IMAGE_FALLBACK) {
              activeModel = GEMINI_IMAGE_FALLBACK;
              response = await callGemini(activeModel, base64Image);
            } else {
              throw primaryErr;
            }
          }

          // Extract the generated image
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
            return { viewName: view.viewName, error: "No image generated for this view" };
          }

          // Upload rendered image to Vercel Blob
          const renderedBuffer = Buffer.from(renderedImageData, "base64");
          const blob = await put(
            `renders/${projectId}/${view.viewName}.png`,
            renderedBuffer,
            { access: "public", contentType: "image/png", addRandomSuffix: true }
          );

          // Save to Airtable
          const record = await renderedViewsTable.create({
            "View Name": view.viewName,
            "Image URL": blob.url,
            Project: [projectId],
            "Is Photorealistic": true,
          });

          return { viewName: view.viewName, imageUrl: blob.url, id: record.getId() };
        }

        // Process views in parallel batches of 3
        const BATCH_SIZE = 3;
        for (let batchStart = 0; batchStart < views.length; batchStart += BATCH_SIZE) {
          if (errorSent) break;

          const batch = views.slice(batchStart, batchStart + BATCH_SIZE);
          sendEvent("progress", {
            current: batchStart + 1,
            total: views.length,
            viewName: batch.map((v) => v.viewName).join(", "),
            message: `Rendering ${batch.length} views...`,
          });

          const results = await Promise.allSettled(batch.map((v) => renderView(v)));

          for (let j = 0; j < results.length; j++) {
            const result = results[j];
            const view = batch[j];

            if (result.status === "fulfilled") {
              const val = result.value;
              if ("error" in val) {
                sendEvent("viewError", { viewName: val.viewName, message: val.error });
              } else {
                renderedViews.push(val);
                sendEvent("viewComplete", { viewName: val.viewName, imageUrl: val.imageUrl });
              }
            } else {
              // Rejected - check for fatal errors
              const errMsg = result.reason instanceof Error ? result.reason.message : "Unknown error";
              console.error(`Render ${view.viewName} failed:`, errMsg);

              const isQuotaError = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
              const isOverload = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("overloaded");
              const isAuthError = errMsg.includes("403") || errMsg.includes("401") || errMsg.includes("PERMISSION_DENIED") || errMsg.includes("API_KEY");
              const isModelError = errMsg.includes("404") || errMsg.includes("not found") || errMsg.includes("NOT_FOUND");

              if (isQuotaError) {
                errorSent = true;
                sendEvent("error", { message: "Gemini API quota exceeded. Enable billing at ai.google.dev to use image generation." });
              } else if (isOverload) {
                errorSent = true;
                sendEvent("error", { message: "Gemini image generation is experiencing high demand. Please try again in a few minutes." });
              } else if (isAuthError) {
                errorSent = true;
                sendEvent("error", { message: "Gemini API key is invalid or lacks permission for image generation. Check your API key at ai.google.dev." });
              } else if (isModelError) {
                errorSent = true;
                sendEvent("error", { message: `Gemini model "${activeModel}" not found. It may not be available for your account.` });
              } else {
                const safeMsg = errMsg.length > 120 ? errMsg.slice(0, 120) + "..." : errMsg;
                sendEvent("viewError", { viewName: view.viewName, message: `Render failed: ${safeMsg}` });
              }
            }
          }

          // Send batch progress update
          sendEvent("progress", {
            current: Math.min(batchStart + BATCH_SIZE, views.length),
            total: views.length,
            viewName: "",
            message: `${renderedViews.length} of ${views.length} views rendered`,
          });
        }

        if (!errorSent) {
          sendEvent("complete", {
            renderedCount: renderedViews.length,
            totalViews: views.length,
            views: renderedViews,
          });
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error(
      "Render route failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
