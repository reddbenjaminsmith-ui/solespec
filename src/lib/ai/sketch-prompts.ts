import type { SketchAnalysisResult } from "@/lib/types";

export const SKETCH_ANALYSIS_SYSTEM_PROMPT = `You are an expert footwear designer and technical product developer analyzing a 2D lateral (side view) sketch of a shoe.

Analyze the sketch and return a JSON object with exactly this structure:

{
  "components": [
    {
      "name": "Component Name (e.g. Vamp, Quarter, Mudguard, Overlay)",
      "category": "upper" | "sole" | "lining" | "hardware" | "other",
      "region": "Where on the shoe this component sits (e.g. forefoot lateral, midfoot, heel)",
      "description": "Brief description of the component as shown in the sketch"
    }
  ],
  "panelLines": [
    "Description of each visible panel line or seam (e.g. 'Curved line from throat to midfoot separating vamp from quarter')"
  ],
  "designElements": [
    "Description of each design detail (e.g. 'Perforated overlay on lateral midfoot', 'Pull tab at heel')"
  ],
  "shoeType": "e.g. Running Shoe, Basketball Shoe, Casual Sneaker, Chelsea Boot",
  "constructionNotes": "Observed or inferred construction method based on the sketch",
  "styleDescription": "2-3 sentence description of the overall design aesthetic and intent"
}

Guidelines:
- This is a 2D sketch, not a 3D model. Interpret design intent from line work, shading, and annotations.
- Identify ALL visible components, even partially visible ones. Common footwear components: Vamp, Quarter, Tongue, Collar, Eyelet Stay, Mudguard, Toe Cap, Toe Box, Heel Counter, Backstay, Outsole, Midsole, Foxing, Overlay Panels, Pull Tab, Lace System, Logo Placement.
- Note panel lines (seams between components) - these are critical for tech pack creation.
- Note design elements like perforations, textures, stitching patterns, branding placements.
- The sketch shows a lateral (outer side) view. Note what would likely be on the medial (inner) side based on the design.
- Be specific about regions: forefoot, midfoot, heel, toe, throat line, collar.

Return ONLY valid JSON. No markdown code fences, no explanation text.`;

export const MULTI_VIEW_GENERATION_PROMPT = `Generate a {viewName} view of this shoe design.

I'm providing:
1. The original lateral (side) sketch showing the shoe design
2. A lateral view of the predecessor 3D model showing the correct proportions and form

Requirements:
- Maintain the EXACT design elements from the sketch: panel lines, overlays, component boundaries, design details
- Match the PROPORTIONS and FORM of the predecessor model (sole height, toe shape, heel height, overall silhouette)
- This is a {viewName} view - show the shoe from {viewAngle}
- Keep the same sketch style (line weight, shading technique, level of detail)
- Technical illustration style - clean lines, no background clutter
- White or very light background
- Show all visible component boundaries clearly
- The shoe should look like the same design from a different angle

This is for a footwear tech pack - accuracy of component boundaries and proportions matters more than artistic flair.`;

export function buildSketchAnalysisMessages(
  sketchUrl: string
): Array<{
  role: "system" | "user";
  content:
    | string
    | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}> {
  return [
    { role: "system", content: SKETCH_ANALYSIS_SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Analyze this lateral (side view) shoe sketch. Identify all components, panel lines, and design elements.",
        },
        {
          type: "image_url",
          image_url: { url: sketchUrl },
        },
      ],
    },
  ];
}

export function parseSketchAnalysisResponse(raw: string): SketchAnalysisResult {
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.components)) {
    throw new Error("Invalid response: missing components array");
  }

  return {
    components: parsed.components,
    panelLines: parsed.panelLines || [],
    designElements: parsed.designElements || [],
    shoeType: parsed.shoeType || "Unknown",
    constructionNotes: parsed.constructionNotes || "",
    styleDescription: parsed.styleDescription || "",
  };
}

export const VIEW_CONFIGS = [
  { viewName: "medial", viewAngle: "the inner side (opposite of the lateral view - mirror image with medial-specific details)" },
  { viewName: "front", viewAngle: "directly from the front, showing the toe box and both sides symmetrically" },
  { viewName: "back", viewAngle: "directly from behind, showing the heel counter, pull tab, and both sides" },
  { viewName: "three_quarter", viewAngle: "a 3/4 angle from the front-lateral side, showing depth and dimension" },
] as const;
