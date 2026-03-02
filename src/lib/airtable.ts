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
