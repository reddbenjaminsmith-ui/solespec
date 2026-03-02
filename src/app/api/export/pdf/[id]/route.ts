import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  projectsTable,
  renderedViewsTable,
  componentsTable,
  measurementsTable,
  specificationsTable,
  bomItemsTable,
  crossSectionsTable,
  annotationsTable,
  stitchCalloutsTable,
  escapeForFormula,
  isValidRecordId,
} from "@/lib/airtable";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import TechPackDocument from "@/lib/pdf/TechPackDocument";
import type { Project, RenderedView, ShoeComponent, Measurement, Specifications, BOMItem, CrossSection, Annotation, StitchCallout } from "@/lib/types";
import React from "react";

export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Rate limit
    const ip = getClientIp(request);
    const limit = rateLimit(`pdf-export:${ip}`, 5, 60000);
    if (!limit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    // Validate record ID
    if (!isValidRecordId(projectId)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    // Fetch project
    let projectRecord;
    try {
      projectRecord = await projectsTable.find(projectId);
    } catch {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project: Project = {
      id: projectRecord.id,
      name: (projectRecord.fields["Name"] as string) || "Untitled",
      email: (projectRecord.fields["Email"] as string) || "",
      status: (projectRecord.fields["Status"] as Project["status"]) || "draft",
      modelUrl: (projectRecord.fields["Model URL"] as string) || "",
      thumbnailUrl: (projectRecord.fields["Thumbnail URL"] as string) || "",
      wizardStep: (projectRecord.fields["Wizard Step"] as number) || 0,
      createdAt: projectRecord.fields["Created"] as string || new Date().toISOString(),
      sourceType: (projectRecord.fields["Source Type"] as Project["sourceType"]) || "3D Model",
    };

    // Fetch all related data in parallel
    const escapedId = escapeForFormula(projectId);
    const formula = `FIND("${escapedId}", ARRAYJOIN({Project})) > 0`;

    const [viewRecords, compRecords, measRecords, specRecords, bomRecords, csRecords, annRecords, stitchRecords] = await Promise.all([
      renderedViewsTable.select({ filterByFormula: formula, maxRecords: 100 }).all(),
      componentsTable.select({ filterByFormula: formula, maxRecords: 100 }).all(),
      measurementsTable.select({ filterByFormula: formula, maxRecords: 100 }).all(),
      specificationsTable.select({ filterByFormula: formula, maxRecords: 100 }).all(),
      bomItemsTable.select({ filterByFormula: formula, sort: [{ field: "Sort Order", direction: "asc" }], maxRecords: 100 }).all(),
      crossSectionsTable.select({ filterByFormula: formula, sort: [{ field: "Sort Order", direction: "asc" }], maxRecords: 100 }).all(),
      annotationsTable.select({ filterByFormula: formula, sort: [{ field: "Sort Order", direction: "asc" }], maxRecords: 100 }).all(),
      stitchCalloutsTable.select({ filterByFormula: formula, sort: [{ field: "Sort Order", direction: "asc" }], maxRecords: 100 }).all(),
    ]);

    const views = viewRecords.map((r) => ({
      id: r.id,
      projectId,
      viewName: ((r.fields["View Name"] as string) || "three_quarter") as RenderedView["viewName"],
      imageUrl: (r.fields["Image URL"] as string) || "",
    }));

    const components: ShoeComponent[] = compRecords.map((r) => ({
      id: r.id,
      projectId,
      name: (r.fields["Name"] as string) || "",
      category: (r.fields["Category"] as ShoeComponent["category"]) || "other",
      aiConfidence: (r.fields["AI Confidence"] as number) || 0,
      confirmed: (r.fields["Confirmed"] as boolean) || false,
      bestView: (r.fields["Best View"] as ShoeComponent["bestView"]) || "three_quarter",
      labelX: (r.fields["Label X"] as number) || 50,
      labelY: (r.fields["Label Y"] as number) || 50,
      notes: (r.fields["Notes"] as string) || "",
    }));

    const measurements: Measurement[] = measRecords.map((r) => ({
      id: r.id,
      projectId,
      name: (r.fields["Name"] as string) || "",
      valueMm: (r.fields["Value MM"] as number) || 0,
      aiEstimated: (r.fields["AI Estimated"] as boolean) || false,
      confirmed: (r.fields["Confirmed"] as boolean) || false,
      sizeReference: (r.fields["Size Reference"] as string) || "",
    }));

    const specifications: Specifications | null = specRecords.length > 0
      ? {
          id: specRecords[0].id,
          projectId,
          upperMaterial: (specRecords[0].fields["Upper Material"] as string) || "",
          upperSecondary: (specRecords[0].fields["Upper Secondary"] as string) || "",
          liningMaterial: (specRecords[0].fields["Lining Material"] as string) || "",
          outsoleMaterial: (specRecords[0].fields["Outsole Material"] as string) || "",
          midsoleMaterial: (specRecords[0].fields["Midsole Material"] as string) || "",
          hardware: (specRecords[0].fields["Hardware"] as string) || "",
          constructionMethod: (specRecords[0].fields["Construction Method"] as string) || "",
          additionalNotes: (specRecords[0].fields["Additional Notes"] as string) || "",
          upperColor: (specRecords[0].fields["Upper Color"] as string) || "",
          upperSecondaryColor: (specRecords[0].fields["Upper Secondary Color"] as string) || "",
          liningColor: (specRecords[0].fields["Lining Color"] as string) || "",
          outsoleColor: (specRecords[0].fields["Outsole Color"] as string) || "",
          midsoleColor: (specRecords[0].fields["Midsole Color"] as string) || "",
          hardwareColor: (specRecords[0].fields["Hardware Color"] as string) || "",
        }
      : null;

    const bomItems: BOMItem[] = bomRecords.map((r, i) => ({
      id: r.id,
      projectId,
      component: (r.fields["Component"] as string) || "",
      materialName: (r.fields["Material Name"] as string) || "",
      supplier: (r.fields["Supplier"] as string) || "",
      color: (r.fields["Color"] as string) || "",
      quantityPerPair: (r.fields["Quantity Per Pair"] as string) || "1",
      notes: (r.fields["Notes"] as string) || "",
      sortOrder: (r.fields["Sort Order"] as number) || i,
    }));

    const crossSections: CrossSection[] = csRecords.map((r, i) => ({
      id: r.id,
      projectId,
      label: (r.fields["Label"] as string) || "",
      viewType: ((r.fields["View Type"] as string) || "top") as CrossSection["viewType"],
      linePosition: (r.fields["Line Position"] as number) || 50,
      description: (r.fields["Description"] as string) || "",
      sortOrder: (r.fields["Sort Order"] as number) || i,
    }));

    const pdfAnnotations: Annotation[] = annRecords.map((r, i) => ({
      id: r.id,
      projectId,
      viewName: (r.fields["View Name"] as string) || "",
      arrowStartX: (r.fields["Arrow Start X"] as number) || 0,
      arrowStartY: (r.fields["Arrow Start Y"] as number) || 0,
      arrowEndX: (r.fields["Arrow End X"] as number) || 0,
      arrowEndY: (r.fields["Arrow End Y"] as number) || 0,
      text: (r.fields["Text"] as string) || "",
      sortOrder: (r.fields["Sort Order"] as number) || i,
    }));

    const pdfStitchCallouts: StitchCallout[] = stitchRecords.map((r, i) => ({
      id: r.id,
      projectId,
      viewName: (r.fields["View Name"] as string) || "",
      positionX: (r.fields["Position X"] as number) || 0,
      positionY: (r.fields["Position Y"] as number) || 0,
      spi: (r.fields["SPI"] as number) || 0,
      threadType: ((r.fields["Thread Type"] as string) || "polyester") as StitchCallout["threadType"],
      stitchPattern: ((r.fields["Stitch Pattern"] as string) || "lockstitch") as StitchCallout["stitchPattern"],
      threadColor: (r.fields["Thread Color"] as string) || "",
      notes: (r.fields["Notes"] as string) || "",
      sortOrder: (r.fields["Sort Order"] as number) || i,
    }));

    // Render PDF
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc: any = React.createElement(TechPackDocument as any, {
      project,
      views,
      components,
      measurements,
      specifications,
      bomItems,
      crossSections,
      annotations: pdfAnnotations,
      stitchCallouts: pdfStitchCallouts,
    });
    const buffer = await renderToBuffer(doc);

    // Clean filename
    const safeName = project.name
      .replace(/[^a-zA-Z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 50);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="TechPack-${safeName}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("PDF export failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
