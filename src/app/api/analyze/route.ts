import { NextResponse } from "next/server";
import {
  renderedViewsTable,
  componentsTable,
  measurementsTable,
  projectsTable,
  isValidRecordId,
  fetchProjectRecords,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { getOpenAI, OPENAI_MODEL } from "@/lib/ai/openai";
import {
  buildComponentAnalysisMessages,
  buildMeasurementMessages,
  parseComponentResponse,
  parseMeasurementResponse,
} from "@/lib/ai/prompts";
import { isValidUrl } from "@/lib/validation";

// Intentionally public - no auth check yet. Will be gated behind authentication in a future phase.

export const maxDuration = 60;

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const limit = rateLimit(`analyze:${ip}`, 5, 60000);
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

    // Fetch views - prefer photorealistic, fall back to raw
    const projectName = project.get("Name") as string;
    const allViewRecords = await fetchProjectRecords(
      renderedViewsTable,
      projectId,
      { projectName }
    );

    // Separate photorealistic vs raw views
    const photoViews = allViewRecords.filter(
      (r) => r.get("Is Photorealistic") === true
    );
    const rawViews = allViewRecords.filter(
      (r) => r.get("Is Photorealistic") !== true
    );

    // Use photorealistic if available, otherwise raw
    const viewsToAnalyze = photoViews.length > 0 ? photoViews : rawViews;

    if (viewsToAnalyze.length === 0) {
      return NextResponse.json(
        { error: "No views found for this project. Capture views first." },
        { status: 400 }
      );
    }

    const viewUrls = viewsToAnalyze
      .map((r) => ({
        viewName: (r.get("View Name") as string) || "",
        imageUrl: (r.get("Image URL") as string) || "",
      }))
      .filter((v) => v.imageUrl && isValidUrl(v.imageUrl));

    // Update project status to analyzing
    await projectsTable.update(projectId, { Status: "analyzing" });

    // Stream progress back to client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // --- Phase 1: Component Detection ---
          sendEvent("status", {
            step: "analyzing_components",
            message: "Analyzing shoe components...",
          });

          const componentMessages = buildComponentAnalysisMessages(viewUrls);
          const componentCompletion = await getOpenAI().chat.completions.create({
            model: OPENAI_MODEL,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: componentMessages as any,
            response_format: { type: "json_object" },
            max_completion_tokens: 4096,
          });

          const componentRaw =
            componentCompletion.choices[0]?.message?.content || "{}";
          const componentData = parseComponentResponse(componentRaw);

          sendEvent("components", {
            components: componentData.components,
            shoeType: componentData.shoeType,
            constructionGuess: componentData.constructionGuess,
            materialObservations: componentData.materialObservations,
            count: componentData.components.length,
          });

          // Save components to Airtable (batch of 10)
          const componentBatches: Array<
            Array<(typeof componentData.components)[number]>
          > = [];
          for (
            let i = 0;
            i < componentData.components.length;
            i += 10
          ) {
            componentBatches.push(
              componentData.components.slice(i, i + 10)
            );
          }

          const savedComponentIds: string[] = [];
          for (const batch of componentBatches) {
            const records = await componentsTable.create(
              batch.map((comp) => ({
                fields: {
                  Name: comp.name.substring(0, 200),
                  Category: comp.category,
                  "AI Confidence": Math.min(1, Math.max(0, comp.confidence)),
                  Confirmed: false,
                  "Best View": comp.bestView,
                  "Label X": Math.min(100, Math.max(0, comp.labelX)),
                  "Label Y": Math.min(100, Math.max(0, comp.labelY)),
                  Notes: (comp.description || "").substring(0, 2000),
                  Project: [projectId],
                },
              }))
            );
            savedComponentIds.push(...records.map((r) => r.getId()));
          }

          sendEvent("status", {
            step: "components_saved",
            message: `Saved ${savedComponentIds.length} components`,
          });

          // --- Phase 2: Measurement Estimation ---
          sendEvent("status", {
            step: "estimating_measurements",
            message: "Estimating measurements...",
          });

          const measurementMessages = buildMeasurementMessages(viewUrls);
          const measurementCompletion = await getOpenAI().chat.completions.create({
            model: OPENAI_MODEL,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: measurementMessages as any,
            response_format: { type: "json_object" },
            max_completion_tokens: 2048,
          });

          const measurementRaw =
            measurementCompletion.choices[0]?.message?.content || "{}";
          const measurementData = parseMeasurementResponse(measurementRaw);

          sendEvent("measurements", {
            measurements: measurementData.measurements,
            scaleNote: measurementData.scaleNote,
            referenceSize: measurementData.referenceSize,
            count: measurementData.measurements.length,
          });

          // Save measurements to Airtable
          const measurementRecords = await measurementsTable.create(
            measurementData.measurements.map((m) => ({
              fields: {
                Name: m.name.substring(0, 200),
                "Value MM": Number.isFinite(m.valueMm)
                  ? Math.max(0, m.valueMm)
                  : 0,
                "AI Estimated": true,
                Confirmed: false,
                "Size Reference":
                  measurementData.referenceSize.substring(0, 200),
                Project: [projectId],
              },
            }))
          );

          sendEvent("status", {
            step: "measurements_saved",
            message: `Saved ${measurementRecords.length} measurements`,
          });

          // Update project status and wizard step
          await projectsTable.update(projectId, {
            Status: "in_progress",
            "Wizard Step": 1,
          });

          sendEvent("complete", {
            componentCount: savedComponentIds.length,
            measurementCount: measurementRecords.length,
            shoeType: componentData.shoeType,
            constructionGuess: componentData.constructionGuess,
          });
        } catch (analysisError) {
          console.error(
            "AI analysis failed:",
            analysisError instanceof Error
              ? analysisError.message
              : "Unknown error"
          );

          // Reset project status on failure
          try {
            await projectsTable.update(projectId, {
              Status: (project.get("Status") as string) || "draft",
            });
          } catch {
            // Best effort status reset
          }

          sendEvent("error", {
            message: "AI analysis failed. Please try again.",
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
      "Analyze route failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
