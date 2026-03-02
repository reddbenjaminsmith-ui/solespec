import { NextResponse } from "next/server";
import { projectsTable, renderedViewsTable, isValidRecordId } from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { getOpenAI, OPENAI_MODEL, OPENAI_IMAGE_MODEL } from "@/lib/ai/openai";
import { put } from "@vercel/blob";
import { VIEW_CONFIGS, buildPredecessorViewPromptMessages } from "@/lib/ai/sketch-prompts";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

export const maxDuration = 60;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`sketch-views:${ip}`, 5, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, predecessorViews } = body;

    // Validate predecessorViews if provided
    const validPredecessorViews: Array<{ viewName: string; imageUrl: string }> = [];
    if (Array.isArray(predecessorViews)) {
      for (const pv of predecessorViews) {
        if (typeof pv.viewName === "string" && typeof pv.imageUrl === "string") {
          try {
            const url = new URL(pv.imageUrl);
            if (url.protocol === "https:" || url.protocol === "http:") {
              validPredecessorViews.push({ viewName: pv.viewName, imageUrl: pv.imageUrl });
            }
          } catch { /* skip invalid URLs */ }
        }
      }
    }

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    // Verify project exists
    let project;
    try {
      project = await projectsTable.find(projectId);
    } catch {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const sketchUrl = project.get("Sketch URL") as string;

    if (!sketchUrl) {
      return NextResponse.json(
        { error: "No sketch image found for this project" },
        { status: 400 }
      );
    }

    // Stream progress back to client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
            )
          );
        };

        try {
          const openai = getOpenAI();
          const generatedViews: Array<{
            viewName: string;
            imageUrl: string;
          }> = [];

          // First, save the original sketch as the "right" (lateral) view
          sendEvent("status", {
            step: "saving_lateral",
            message: "Saving lateral sketch as reference view...",
          });

          const lateralRecord = await renderedViewsTable.create({
            "View Name": "right",
            "Image URL": sketchUrl,
            Project: [projectId],
          });

          generatedViews.push({
            viewName: "right",
            imageUrl: sketchUrl,
          });

          sendEvent("view_saved", {
            viewName: "right",
            imageUrl: sketchUrl,
            recordId: lateralRecord.getId(),
          });

          // Generate additional views using two-step pipeline:
          // Step 1: GPT-5.2 Vision analyzes sketch + predecessor render to create detailed prompt
          // Step 2: gpt-image-1.5 generates from that informed prompt
          for (let i = 0; i < VIEW_CONFIGS.length; i++) {
            const config = VIEW_CONFIGS[i];

            // Map view names for predecessor lookup
            const predecessorViewName =
              config.viewName === "medial" ? "left" : config.viewName === "three_quarter" ? "three_quarter" : config.viewName;
            const predecessorView = validPredecessorViews.find(
              (pv) => pv.viewName === predecessorViewName || pv.viewName === config.viewName
            );

            try {
              let imagePrompt: string;

              if (predecessorView) {
                // Two-step pipeline: GPT-5.2 creates informed prompt from both images
                sendEvent("status", {
                  step: `analyzing_${config.viewName}`,
                  message: `Analyzing predecessor + sketch for ${config.viewName} view (${i + 1}/${VIEW_CONFIGS.length})...`,
                });

                const promptMessages = buildPredecessorViewPromptMessages(
                  sketchUrl,
                  predecessorView.imageUrl,
                  config.viewName,
                  config.viewAngle
                );

                const promptCompletion = await openai.chat.completions.create({
                  model: OPENAI_MODEL,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  messages: promptMessages as any,
                  max_tokens: 1024,
                });

                imagePrompt = promptCompletion.choices[0]?.message?.content || "";

                if (!imagePrompt || imagePrompt.length < 50) {
                  // Fallback to basic prompt if GPT-5.2 returned too little
                  imagePrompt = `Technical footwear illustration of a shoe from the ${config.viewName} angle (${config.viewAngle}). Clean lines, white background, show all component boundaries clearly. Maintain proper shoe proportions.`;
                }
              } else {
                // No predecessor render available - use basic prompt
                imagePrompt = `Technical footwear illustration of a shoe from the ${config.viewName} angle (${config.viewAngle}). Clean lines, white background, show all component boundaries clearly. The shoe design features the panel lines and components from the original lateral sketch. Maintain proper shoe proportions.`;
              }

              sendEvent("status", {
                step: `generating_${config.viewName}`,
                message: `Generating ${config.viewName} view (${i + 1}/${VIEW_CONFIGS.length})...`,
              });

              // Step 2: generate image from the detailed prompt
              const response = await openai.images.generate({
                model: OPENAI_IMAGE_MODEL,
                prompt: imagePrompt,
                n: 1,
                size: "1024x1024",
                quality: "high",
              });

              const imageData = response.data?.[0];
              if (!imageData || (!imageData.url && !imageData.b64_json)) {
                throw new Error(`No image generated for ${config.viewName} view`);
              }

              // If we got base64, upload to Vercel Blob
              let imageUrl: string;
              if (imageData.b64_json) {
                const buffer = Buffer.from(imageData.b64_json, "base64");
                const blob = await put(
                  `sketch-views/${projectId}/${config.viewName}.png`,
                  buffer,
                  { access: "public", contentType: "image/png" }
                );
                imageUrl = blob.url;
              } else {
                // Download and re-upload to Vercel Blob for persistence
                const imgResponse = await fetch(imageData.url!);
                const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
                const blob = await put(
                  `sketch-views/${projectId}/${config.viewName}.png`,
                  imgBuffer,
                  { access: "public", contentType: "image/png" }
                );
                imageUrl = blob.url;
              }

              // Save to Airtable
              // Map view names to match existing convention
              const airtableViewName =
                config.viewName === "medial"
                  ? "left"
                  : config.viewName;

              const viewRecord = await renderedViewsTable.create({
                "View Name": airtableViewName,
                "Image URL": imageUrl,
                Project: [projectId],
              });

              generatedViews.push({
                viewName: airtableViewName,
                imageUrl,
              });

              sendEvent("view_saved", {
                viewName: airtableViewName,
                imageUrl,
                recordId: viewRecord.getId(),
              });
            } catch (viewError) {
              console.error(
                `Failed to generate ${config.viewName} view:`,
                viewError instanceof Error
                  ? viewError.message
                  : "Unknown error"
              );

              sendEvent("view_error", {
                viewName: config.viewName,
                message: `Failed to generate ${config.viewName} view`,
              });
            }
          }

          // Set 3/4 view as thumbnail if generated
          const threeQuarter = generatedViews.find(
            (v) => v.viewName === "three_quarter"
          );
          if (threeQuarter) {
            await projectsTable.update(projectId, {
              "Thumbnail URL": threeQuarter.imageUrl,
            });
          }

          sendEvent("complete", {
            viewCount: generatedViews.length,
            views: generatedViews,
          });
        } catch (genError) {
          console.error(
            "View generation failed:",
            genError instanceof Error ? genError.message : "Unknown error"
          );

          sendEvent("error", {
            message: "View generation failed. Please try again.",
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
      "Generate views route failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
