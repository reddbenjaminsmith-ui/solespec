import Airtable from "airtable";

if (!process.env.AIRTABLE_API_KEY) {
  throw new Error("AIRTABLE_API_KEY is not set");
}
if (!process.env.AIRTABLE_BASE_ID) {
  throw new Error("AIRTABLE_BASE_ID is not set");
}

const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

export const projectsTable = base("Projects");
export const renderedViewsTable = base("Rendered Views");
export const componentsTable = base("Components");
export const measurementsTable = base("Measurements");
export const specificationsTable = base("Specifications");
export const bomItemsTable = base("BOM Items");
export const crossSectionsTable = base("Cross Sections");
export const annotationsTable = base("Annotations");
export const stitchCalloutsTable = base("Stitch Callouts");

// Escape a string for use in Airtable formulas (prevent injection)
export function escapeForFormula(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// Validate Airtable record ID format
export function isValidRecordId(id: string): boolean {
  return typeof id === "string" && /^rec[a-zA-Z0-9]{14}$/.test(id);
}

// Fetch records from any table that are linked to a specific project.
// ARRAYJOIN({Project}) returns the project NAME, not record ID, so we
// search by name then verify the linked record ID in application code.
export async function fetchProjectRecords(
  table: ReturnType<typeof base>,
  projectId: string,
  options?: { projectName?: string; maxRecords?: number }
): Promise<Airtable.Records<Airtable.FieldSet>> {
  let projectName = options?.projectName;
  if (!projectName) {
    const project = await projectsTable.find(projectId);
    projectName = project.get("Name") as string;
  }
  if (!projectName) return [];

  const records = await table
    .select({
      filterByFormula: `FIND("${escapeForFormula(projectName)}", ARRAYJOIN({Project})) > 0`,
      maxRecords: options?.maxRecords || 100,
    })
    .all();

  // Verify linked record IDs match (guards against name collisions)
  return records.filter((r) => {
    const linked = r.get("Project") as string[] | undefined;
    return linked && linked.includes(projectId);
  });
}
