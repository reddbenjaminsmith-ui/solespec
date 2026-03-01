import { NextResponse } from "next/server";
import { projectsTable, renderedViewsTable, isValidRecordId } from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { getOpenAI } from "@/lib/ai/openai";
import { put } from "@vercel/blob";
import { VIEW_CONFIGS, MULTI_VIEW_GENERATION_PROMPT } from "@/lib/ai/sketch-prompts";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

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
    const { projectId } = body;

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
    const predecessorModelUrl = project.get("Predecessor Model URL") as string;

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

          // Generate additional views
          for (let i = 0; i < VIEW_CONFIGS.length; i++) {
            const config = VIEW_CONFIGS[i];

            sendEvent("status", {
              step: `generating_${config.viewName}`,
              message: `Generating ${config.viewName} view (${i + 1}/${VIEW_CONFIGS.length})...`,
            });

            const prompt = MULTI_VIEW_GENERATION_PROMPT
              .replace("{viewName}", config.viewName)
              .replace("{viewName}", config.viewName)
              .replace("{viewAngle}", config.viewAngle);

            try {
              // Use gpt-image-1.5 to generate the view
              const response = await openai.images.generate({
                model: "gpt-image-1.5",
                prompt: `${prompt}\n\nThe shoe is visible in the reference sketch image I described. Generate ONLY the shoe from the ${config.viewName} angle. Technical footwear illustration style, white background, clean lines showing all component boundaries.${predecessorModelUrl ? " Use the predecessor model proportions." : ""}`,
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
