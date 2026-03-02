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

        for (let i = 0; i < views.length; i++) {
          const view = views[i];
          sendEvent("progress", {
            current: i + 1,
            total: views.length,
            viewName: view.viewName,
            message: `Rendering ${view.viewName} view...`,
          });

          try {
            // Download the original image
            const imageResponse = await fetch(view.imageUrl);
            if (!imageResponse.ok) {
              sendEvent("viewError", {
                viewName: view.viewName,
                message: "Failed to download original image",
              });
              continue;
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
                console.error(`${activeModel} overloaded, falling back to ${GEMINI_IMAGE_FALLBACK}`);
                activeModel = GEMINI_IMAGE_FALLBACK;
                sendEvent("progress", {
                  current: i + 1,
                  total: views.length,
                  viewName: view.viewName,
                  message: `Primary model busy, retrying with fallback...`,
                });
                response = await callGemini(activeModel, base64Image);
              } else {
                throw primaryErr;
              }
            }

            // Extract the generated image from response
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
              sendEvent("viewError", {
                viewName: view.viewName,
                message: "No image generated for this view",
              });
              continue;
            }

            // Upload rendered image to Vercel Blob
            const renderedBuffer = Buffer.from(renderedImageData, "base64");
            const blob = await put(
              `renders/${projectId}/${view.viewName}.png`,
              renderedBuffer,
              {
                access: "public",
                contentType: "image/png",
                addRandomSuffix: true,
              }
            );

            // Save to Airtable as a photorealistic view
            const record = await renderedViewsTable.create({
              "View Name": view.viewName,
              "Image URL": blob.url,
              Project: [projectId],
              "Is Photorealistic": true,
            });

            renderedViews.push({
              viewName: view.viewName,
              imageUrl: blob.url,
              id: record.getId(),
            });

            sendEvent("viewComplete", {
              viewName: view.viewName,
              imageUrl: blob.url,
            });
          } catch (viewError) {
            const errMsg = viewError instanceof Error ? viewError.message : "Unknown error";
            console.error(`Render ${view.viewName} failed:`, errMsg);

            // Detect quota/billing errors - stop early
            const isQuotaError = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("quota");
            if (isQuotaError) {
              errorSent = true;
              sendEvent("error", {
                message: "Gemini API quota exceeded. Enable billing at ai.google.dev to use image generation.",
              });
              break;
            }

            // Detect overload on fallback too - stop early
            const isOverload = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("overloaded");
            if (isOverload) {
              errorSent = true;
              sendEvent("error", {
                message: "Gemini image generation is experiencing high demand. Please try again in a few minutes.",
              });
              break;
            }

            // Detect auth/permission errors - stop early
            const isAuthError = errMsg.includes("403") || errMsg.includes("401") || errMsg.includes("PERMISSION_DENIED") || errMsg.includes("API_KEY");
            if (isAuthError) {
              errorSent = true;
              sendEvent("error", {
                message: "Gemini API key is invalid or lacks permission for image generation. Check your API key at ai.google.dev.",
              });
              break;
            }

            // Detect model not found
            const isModelError = errMsg.includes("404") || errMsg.includes("not found") || errMsg.includes("NOT_FOUND");
            if (isModelError) {
              errorSent = true;
              sendEvent("error", {
                message: `Gemini model "${activeModel}" not found. It may not be available for your account.`,
              });
              break;
            }

            // For other errors, include a safe summary
            const safeMsg = errMsg.length > 120 ? errMsg.slice(0, 120) + "..." : errMsg;
            sendEvent("viewError", {
              viewName: view.viewName,
              message: `Render failed: ${safeMsg}`,
            });
          }
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
