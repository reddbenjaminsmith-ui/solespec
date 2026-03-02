/* eslint-disable jsx-a11y/alt-text */
import { Document, Page, Text, View, Image } from "@react-pdf/renderer";
import { pdfStyles as s } from "./styles";
import type {
  Project,
  ShoeComponent,
  Measurement,
  Specifications,
  BOMItem,
  RenderedView,
  CrossSection,
  Annotation,
  StitchCallout,
} from "@/lib/types";

const VIEW_LABELS: Record<string, string> = {
  front: "Front",
  back: "Back",
  left: "Medial",
  right: "Lateral",
  top: "Top",
  bottom: "Bottom",
  three_quarter: "3/4 View",
};

interface TechPackDocumentProps {
  project: Project;
  views: RenderedView[];
  components: ShoeComponent[];
  measurements: Measurement[];
  specifications: Specifications | null;
  bomItems: BOMItem[];
  crossSections: CrossSection[];
  annotations: Annotation[];
  stitchCallouts: StitchCallout[];
}

function PageHeader({ pageNum, totalPages }: { pageNum: number; totalPages: number }) {
  return (
    <View style={s.pageHeader}>
      <Text style={s.brandText}>
        <Text style={s.brandAccent}>Sole</Text>Spec
      </Text>
      <Text style={s.pageNumber}>
        Page {pageNum} of {totalPages}
      </Text>
    </View>
  );
}

export default function TechPackDocument({
  project,
  views,
  components,
  measurements,
  specifications,
  bomItems,
  crossSections,
  annotations,
  stitchCallouts,
}: TechPackDocumentProps) {
  const totalPages = 8;
  const thumbnail = views.find((v) => v.viewName === "three_quarter");
  const confirmedComponents = components.filter((c) => c.confirmed);

  // Group components by category
  const grouped: Record<string, ShoeComponent[]> = {};
  for (const comp of confirmedComponents) {
    if (!grouped[comp.category]) grouped[comp.category] = [];
    grouped[comp.category].push(comp);
  }

  // Cross-section views
  const topView = views.find((v) => v.viewName === "top");
  const lateralView = views.find((v) => v.viewName === "right");
  const topSections = crossSections.filter((cs) => cs.viewType === "top");
  const rightSections = crossSections.filter((cs) => cs.viewType === "right");

  return (
    <Document>
      {/* Page 1: Cover */}
      <Page size="A4" style={s.page}>
        <View style={s.coverContainer}>
          {thumbnail && (
            <Image src={thumbnail.imageUrl} style={s.coverImage} />
          )}
          <Text style={s.coverTitle}>{project.name}</Text>
          <Text style={s.coverSubtitle}>Technical Specification Pack</Text>
          <Text style={s.coverDate}>
            Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </Text>
          <Text style={[s.coverDate, { marginTop: 4 }]}>
            Reference Size: {measurements[0]?.sizeReference || "US Men's 9"}
          </Text>
        </View>
      </Page>

      {/* Page 2: Technical Views + Annotation Notes */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={2} totalPages={totalPages} />
        <Text style={s.sectionHeader}>Technical Views</Text>
        <View style={s.viewsGrid}>
          {views.map((view) => (
            <View key={view.id} style={s.viewCard}>
              <Image src={view.imageUrl} style={s.viewImage} />
              <Text style={s.viewLabel}>
                {VIEW_LABELS[view.viewName] || view.viewName}
              </Text>
            </View>
          ))}
        </View>

        {/* Annotation notes */}
        {annotations.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={s.sectionSubheader}>Callout Notes</Text>
            {annotations.map((ann, i) => (
              <View key={ann.id || i} style={s.annotationItem}>
                <Text style={s.annotationBullet}>
                  [{VIEW_LABELS[ann.viewName] || ann.viewName}]
                </Text>
                <Text style={s.annotationText}>{ann.text}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>

      {/* Page 3: Cross-Section Reference */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={3} totalPages={totalPages} />
        <Text style={s.sectionHeader}>Cross-Section Reference</Text>

        {crossSections.length === 0 ? (
          <Text style={s.bodyText}>No cross-section cut lines defined.</Text>
        ) : (
          <View>
            {/* Reference images */}
            <View style={s.crossSectionRow}>
              <View style={s.crossSectionCol}>
                {topView ? (
                  <Image src={topView.imageUrl} style={s.crossSectionImage} />
                ) : (
                  <View style={[s.crossSectionImage, { justifyContent: "center", alignItems: "center" }]}>
                    <Text style={s.label}>No top view</Text>
                  </View>
                )}
                <Text style={s.crossSectionLabel}>
                  Top View - {topSections.length} cut line{topSections.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <View style={s.crossSectionCol}>
                {lateralView ? (
                  <Image src={lateralView.imageUrl} style={s.crossSectionImage} />
                ) : (
                  <View style={[s.crossSectionImage, { justifyContent: "center", alignItems: "center" }]}>
                    <Text style={s.label}>No lateral view</Text>
                  </View>
                )}
                <Text style={s.crossSectionLabel}>
                  Lateral View - {rightSections.length} cut line{rightSections.length !== 1 ? "s" : ""}
                </Text>
              </View>
            </View>

            {/* Cross-section details table */}
            <View style={s.tableContainer}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: "15%" }]}>Label</Text>
                <Text style={[s.tableHeaderCell, { width: "20%" }]}>View</Text>
                <Text style={[s.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Position</Text>
                <Text style={[s.tableHeaderCell, { width: "50%" }]}>Description</Text>
              </View>
              {crossSections.map((cs, i) => (
                <View key={cs.id || i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCellBold, { width: "15%" }]}>{cs.label}</Text>
                  <Text style={[s.tableCell, { width: "20%" }]}>
                    {cs.viewType === "top" ? "Top" : "Lateral"}
                  </Text>
                  <Text style={[s.tableCell, { width: "15%", textAlign: "right" }]}>
                    {cs.linePosition.toFixed(1)}%
                  </Text>
                  <Text style={[s.tableCell, { width: "50%" }]}>
                    {cs.description || "-"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>

      {/* Page 4: Components + Stitch Specifications */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={4} totalPages={totalPages} />
        <Text style={s.sectionHeader}>Components</Text>
        <Text style={s.bodyText}>
          {confirmedComponents.length} confirmed components across {Object.keys(grouped).length} categories
        </Text>

        {Object.entries(grouped).map(([category, comps]) => (
          <View key={category}>
            <Text style={s.sectionSubheader}>
              {category.charAt(0).toUpperCase() + category.slice(1)} ({comps.length})
            </Text>
            <View style={s.tableContainer}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: "40%" }]}>Name</Text>
                <Text style={[s.tableHeaderCell, { width: "30%" }]}>Best View</Text>
                <Text style={[s.tableHeaderCell, { width: "30%" }]}>Confidence</Text>
              </View>
              {comps.map((comp, i) => (
                <View key={comp.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCellBold, { width: "40%" }]}>{comp.name}</Text>
                  <Text style={[s.tableCell, { width: "30%" }]}>
                    {VIEW_LABELS[comp.bestView] || comp.bestView}
                  </Text>
                  <Text style={[s.tableCell, { width: "30%" }]}>
                    {Math.round(comp.aiConfidence * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}

        {/* Stitch Specifications */}
        {stitchCallouts.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={s.sectionSubheader}>Stitch Specifications</Text>
            <View style={s.tableContainer}>
              <View style={s.tableHeader}>
                <Text style={[s.tableHeaderCell, { width: "18%" }]}>View</Text>
                <Text style={[s.tableHeaderCell, { width: "12%", textAlign: "center" }]}>SPI</Text>
                <Text style={[s.tableHeaderCell, { width: "18%" }]}>Thread</Text>
                <Text style={[s.tableHeaderCell, { width: "18%" }]}>Pattern</Text>
                <Text style={[s.tableHeaderCell, { width: "16%" }]}>Color</Text>
                <Text style={[s.tableHeaderCell, { width: "18%" }]}>Notes</Text>
              </View>
              {stitchCallouts.map((sc, i) => (
                <View key={sc.id || i} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
                  <Text style={[s.tableCell, { width: "18%" }]}>
                    {VIEW_LABELS[sc.viewName] || sc.viewName}
                  </Text>
                  <Text style={[s.tableCellBold, { width: "12%", textAlign: "center" }]}>
                    {sc.spi}
                  </Text>
                  <Text style={[s.tableCell, { width: "18%" }]}>
                    {sc.threadType}
                  </Text>
                  <Text style={[s.tableCell, { width: "18%" }]}>
                    {sc.stitchPattern}
                  </Text>
                  <Text style={[s.tableCell, { width: "16%" }]}>
                    {sc.threadColor || "-"}
                  </Text>
                  <Text style={[s.tableCell, { width: "18%" }]}>
                    {sc.notes || "-"}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </Page>

      {/* Page 5: Measurements */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={5} totalPages={totalPages} />
        <Text style={s.sectionHeader}>Measurements</Text>
        <Text style={s.bodyText}>
          Reference size: {measurements[0]?.sizeReference || "US Men's 9"}. All values in millimeters.
        </Text>
        <View style={s.tableContainer}>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { width: "50%" }]}>Measurement</Text>
            <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right" }]}>Value (mm)</Text>
            <Text style={[s.tableHeaderCell, { width: "25%", textAlign: "right" }]}>Source</Text>
          </View>
          {measurements.map((m, i) => (
            <View key={m.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCellBold, { width: "50%" }]}>{m.name}</Text>
              <Text style={[s.tableCell, { width: "25%", textAlign: "right" }]}>
                {m.valueMm.toFixed(1)}
              </Text>
              <Text style={[s.tableCell, { width: "25%", textAlign: "right" }]}>
                {m.aiEstimated ? "AI Estimated" : "Manual"}
              </Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Page 6: Materials + Construction + Color Specs */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={6} totalPages={totalPages} />
        <Text style={s.sectionHeader}>Material Specifications</Text>

        {specifications ? (
          <View>
            {specifications.upperMaterial && (
              <View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Upper (Primary):</Text>
                  <Text style={s.infoValue}>{specifications.upperMaterial}</Text>
                </View>
                {specifications.upperColor && (
                  <Text style={s.colorSpec}>Color: {specifications.upperColor}</Text>
                )}
              </View>
            )}
            {specifications.upperSecondary && (
              <View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Upper (Secondary):</Text>
                  <Text style={s.infoValue}>{specifications.upperSecondary}</Text>
                </View>
                {specifications.upperSecondaryColor && (
                  <Text style={s.colorSpec}>Color: {specifications.upperSecondaryColor}</Text>
                )}
              </View>
            )}
            {specifications.liningMaterial && (
              <View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Lining:</Text>
                  <Text style={s.infoValue}>{specifications.liningMaterial}</Text>
                </View>
                {specifications.liningColor && (
                  <Text style={s.colorSpec}>Color: {specifications.liningColor}</Text>
                )}
              </View>
            )}
            {specifications.outsoleMaterial && (
              <View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Outsole:</Text>
                  <Text style={s.infoValue}>{specifications.outsoleMaterial}</Text>
                </View>
                {specifications.outsoleColor && (
                  <Text style={s.colorSpec}>Color: {specifications.outsoleColor}</Text>
                )}
              </View>
            )}
            {specifications.midsoleMaterial && (
              <View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Midsole:</Text>
                  <Text style={s.infoValue}>{specifications.midsoleMaterial}</Text>
                </View>
                {specifications.midsoleColor && (
                  <Text style={s.colorSpec}>Color: {specifications.midsoleColor}</Text>
                )}
              </View>
            )}
            {specifications.hardware && (
              <View>
                <View style={s.infoRow}>
                  <Text style={s.infoLabel}>Hardware:</Text>
                  <Text style={s.infoValue}>{specifications.hardware}</Text>
                </View>
                {specifications.hardwareColor && (
                  <Text style={s.colorSpec}>Color: {specifications.hardwareColor}</Text>
                )}
              </View>
            )}

            <Text style={[s.sectionHeader, { marginTop: 24 }]}>Construction</Text>
            {specifications.constructionMethod && (
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>Method:</Text>
                <Text style={s.infoValue}>
                  {specifications.constructionMethod.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </Text>
              </View>
            )}
            {specifications.additionalNotes && (
              <View style={{ marginTop: 8 }}>
                <Text style={s.label}>Notes:</Text>
                <Text style={s.bodyText}>{specifications.additionalNotes}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={s.bodyText}>No specifications recorded.</Text>
        )}
      </Page>

      {/* Page 7: BOM */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={7} totalPages={totalPages} />
        <Text style={s.sectionHeader}>Bill of Materials</Text>
        <Text style={s.bodyText}>{bomItems.length} items</Text>

        <View style={s.tableContainer}>
          <View style={s.tableHeader}>
            <Text style={[s.tableHeaderCell, { width: "5%" }]}>#</Text>
            <Text style={[s.tableHeaderCell, { width: "20%" }]}>Component</Text>
            <Text style={[s.tableHeaderCell, { width: "20%" }]}>Material</Text>
            <Text style={[s.tableHeaderCell, { width: "15%" }]}>Supplier</Text>
            <Text style={[s.tableHeaderCell, { width: "15%" }]}>Color</Text>
            <Text style={[s.tableHeaderCell, { width: "10%", textAlign: "center" }]}>Qty</Text>
            <Text style={[s.tableHeaderCell, { width: "15%" }]}>Notes</Text>
          </View>
          {bomItems.map((item, i) => (
            <View key={item.id} style={i % 2 === 0 ? s.tableRow : s.tableRowAlt}>
              <Text style={[s.tableCell, { width: "5%" }]}>{i + 1}</Text>
              <Text style={[s.tableCellBold, { width: "20%" }]}>{item.component}</Text>
              <Text style={[s.tableCell, { width: "20%" }]}>{item.materialName}</Text>
              <Text style={[s.tableCell, { width: "15%" }]}>{item.supplier || "-"}</Text>
              <Text style={[s.tableCell, { width: "15%" }]}>{item.color || "-"}</Text>
              <Text style={[s.tableCell, { width: "10%", textAlign: "center" }]}>{item.quantityPerPair}</Text>
              <Text style={[s.tableCell, { width: "15%" }]}>{item.notes || "-"}</Text>
            </View>
          ))}
        </View>
      </Page>

      {/* Page 8: Footer */}
      <Page size="A4" style={s.page}>
        <PageHeader pageNum={8} totalPages={totalPages} />
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Text style={[s.brandText, { fontSize: 20, marginBottom: 8 }]}>
            <Text style={s.brandAccent}>Sole</Text>Spec
          </Text>
          <Text style={s.bodyText}>AI-Assisted Tech Pack Generator</Text>
          <Text style={[s.coverDate, { marginTop: 16 }]}>
            This tech pack was generated with AI assistance. All measurements and component
          </Text>
          <Text style={s.coverDate}>
            identifications should be verified by the design team before production.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
