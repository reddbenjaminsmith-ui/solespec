import { MEASUREMENT_NAMES } from "@/lib/constants";
import type { AIComponentDetection, AIMeasurementEstimation } from "@/lib/types";

const ANALYSIS_SYSTEM_PROMPT = `You are an expert footwear engineer analyzing technical views of a 3D shoe model.
You will receive 7 images taken from standardized angles: front, back, left (medial), right (lateral), top, bottom, and 3/4 view.

Analyze these views and return a JSON object with exactly this structure:

{
  "components": [
    {
      "name": "Component Name",
      "category": "upper" | "sole" | "lining" | "hardware" | "other",
      "confidence": 0.0 to 1.0,
      "bestView": "front" | "back" | "left" | "right" | "top" | "bottom" | "three_quarter",
      "labelX": 0 to 100,
      "labelY": 0 to 100,
      "description": "Brief description of the component"
    }
  ],
  "shoeType": "e.g. Running Shoe, Chelsea Boot, Oxford, Sneaker",
  "constructionGuess": "e.g. cementing, vulcanization, strobel",
  "materialObservations": ["Array of observed material characteristics"]
}

Guidelines:
- Identify ALL visible components. Common ones include: Vamp, Quarter, Tongue, Collar, Eyelet Stay, Mudguard, Toe Cap, Heel Counter, Backstay, Outsole, Midsole, Insole, Laces, Eyelets, Pull Tab, Logo/Branding.
- labelX and labelY are percentage positions (0-100) on the bestView image where the label arrow should point.
- confidence should reflect how certain you are the component exists (1.0 = definitely visible, 0.5 = partially visible or uncertain).
- bestView should be whichever view shows the component most clearly.
- For category, use: "upper" for anything on the upper shoe body, "sole" for outsole/midsole/insole/heel, "lining" for interior components, "hardware" for metal/plastic fasteners, "other" for everything else.

Return ONLY valid JSON. No markdown code fences, no explanation text.`;

const MEASUREMENTS_SYSTEM_PROMPT = `You are an expert footwear engineer estimating measurements from technical views of a 3D shoe model.
Based on the shoe's proportions visible in these views, estimate the following measurements in millimeters for a US Men's size 9 (EU 42.5).

Return a JSON object with exactly this structure:

{
  "measurements": [
    {
      "name": "Measurement Name",
      "valueMm": estimated value in millimeters,
      "confidence": "low" | "medium" | "high",
      "reasoning": "Brief explanation of how you estimated this"
    }
  ],
  "scaleNote": "Any notes about scale assumptions",
  "referenceSize": "US Men's 9"
}

Measurements to estimate:
${MEASUREMENT_NAMES.map((m) => `- ${m}`).join("\n")}

Guidelines:
- Use typical proportions for a US Men's 9. Overall length is typically 270-280mm.
- If a measurement doesn't apply to this shoe type (e.g., Shaft Height for a low-top), set valueMm to 0 and confidence to "low".
- Be realistic. Don't guess wildly - use proportional reasoning based on what you see.

Return ONLY valid JSON. No markdown code fences, no explanation text.`;

export function buildComponentAnalysisMessages(
  viewUrls: { viewName: string; imageUrl: string }[]
): Array<{ role: "system" | "user"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> {
  const imageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  imageContent.push({
    type: "text",
    text: "Here are 7 technical views of a 3D shoe model. Identify all visible components with their positions.",
  });

  for (const view of viewUrls) {
    imageContent.push({
      type: "text",
      text: `--- ${view.viewName.toUpperCase()} VIEW ---`,
    });
    imageContent.push({
      type: "image_url",
      image_url: { url: view.imageUrl },
    });
  }

  return [
    { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
    { role: "user", content: imageContent },
  ];
}

export function buildMeasurementMessages(
  viewUrls: { viewName: string; imageUrl: string }[]
): Array<{ role: "system" | "user"; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> {
  // Use side and front views for measurement estimation
  const relevantViews = viewUrls.filter((v) =>
    ["front", "left", "right", "back", "three_quarter"].includes(v.viewName)
  );

  const imageContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  imageContent.push({
    type: "text",
    text: "Estimate standard footwear measurements from these technical views.",
  });

  for (const view of relevantViews) {
    imageContent.push({
      type: "text",
      text: `--- ${view.viewName.toUpperCase()} VIEW ---`,
    });
    imageContent.push({
      type: "image_url",
      image_url: { url: view.imageUrl },
    });
  }

  return [
    { role: "system", content: MEASUREMENTS_SYSTEM_PROMPT },
    { role: "user", content: imageContent },
  ];
}

export function parseComponentResponse(raw: string): AIComponentDetection {
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.components)) {
    throw new Error("Invalid response: missing components array");
  }

  return {
    components: parsed.components,
    shoeType: parsed.shoeType || "Unknown",
    constructionGuess: parsed.constructionGuess || "Unknown",
    materialObservations: parsed.materialObservations || [],
  };
}

export function parseMeasurementResponse(raw: string): AIMeasurementEstimation {
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.measurements)) {
    throw new Error("Invalid response: missing measurements array");
  }

  return {
    measurements: parsed.measurements,
    scaleNote: parsed.scaleNote || "",
    referenceSize: parsed.referenceSize || "US Men's 9",
  };
}

export const RENDER_PROMPT = `Transform this 3D model screenshot into a photorealistic product photograph.
Requirements:
- Maintain the EXACT shoe shape, proportions, silhouette, and all design details
- Studio lighting: soft, even, professional product photography
- Clean white/light gray gradient background
- Show material textures realistically (leather grain, mesh weave, rubber texture, stitching)
- No text, logos, watermarks, or added branding
- High detail, sharp focus, professional e-commerce quality
- Keep the exact same camera angle and perspective`;
