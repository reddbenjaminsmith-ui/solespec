import { NextResponse } from "next/server";
import { projectsTable, isValidRecordId } from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { getOpenAI, OPENAI_MODEL } from "@/lib/ai/openai";
import {
  buildSketchAnalysisMessages,
  parseSketchAnalysisResponse,
} from "@/lib/ai/sketch-prompts";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

export const maxDuration = 60;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`sketch-analyze:${ip}`, 5, 60000);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { projectId, predecessorLateralUrl } = body;

    // Validate predecessorLateralUrl if provided
    let validPredecessorUrl: string | undefined;
    if (typeof predecessorLateralUrl === "string" && predecessorLateralUrl.length > 0) {
      try {
        const url = new URL(predecessorLateralUrl);
        if (url.protocol === "https:" || url.protocol === "http:") {
          validPredecessorUrl = predecessorLateralUrl;
        }
      } catch { /* skip invalid URL */ }
    }

    // Validate projectId
    if (typeof projectId !== "string" || !isValidRecordId(projectId)) {
      return NextResponse.json(
        { error: "Invalid project ID format" },
        { status: 400 }
      );
    }

    // Verify project exists and is a sketch project
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
          sendEvent("status", {
            step: "analyzing_sketch",
            message: "Analyzing sketch design...",
          });

          const messages = buildSketchAnalysisMessages(sketchUrl, validPredecessorUrl);
          const completion = await getOpenAI().chat.completions.create({
            model: OPENAI_MODEL,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: messages as any,
            response_format: { type: "json_object" },
            max_completion_tokens: 4096,
          });

          const raw = completion.choices[0]?.message?.content || "{}";
          const analysis = parseSketchAnalysisResponse(raw);

          // Save analysis JSON to project
          await projectsTable.update(projectId, {
            "Sketch Analysis": JSON.stringify(analysis),
          });

          sendEvent("analysis", {
            ...analysis,
            componentCount: analysis.components.length,
          });

          sendEvent("complete", {
            componentCount: analysis.components.length,
            shoeType: analysis.shoeType,
            panelLineCount: analysis.panelLines.length,
            designElementCount: analysis.designElements.length,
          });
        } catch (analysisError) {
          console.error(
            "Sketch analysis failed:",
            analysisError instanceof Error
              ? analysisError.message
              : "Unknown error"
          );

          sendEvent("error", {
            message: "Sketch analysis failed. Please try again.",
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
      "Sketch analyze route failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
