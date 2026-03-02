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

// --- Hero Reference Rendering System ---

export interface HeroMaterials {
  upper: string;
  outsole: string;
  midsole: string;
  lining: string;
  hardware: string;
}

export function buildHeroPrompt(materials: HeroMaterials, colorDescription: string): string {
  return JSON.stringify({
    task: "Transform this 3D model screenshot into a photorealistic hero product photograph for a footwear tech pack",
    output: {
      type: "product_photograph",
      layout: "centered_subject_full_shoe",
      aspect_ratio: "1:1",
      resolution: "high",
      camera_style: "3/4 three-quarter view, 90mm macro lens, f/2.8, ISO 200"
    },
    image_quality_simulation: {
      sharpness: "razor-sharp across entire shoe surface, no soft focus",
      noise: "zero noise, clean sensor simulation",
      dynamic_range: "full 14-stop range, shadow detail preserved, no blown highlights",
      white_balance: "neutral 5500K daylight"
    },
    subject: {
      object_type: "athletic footwear",
      object_details: {
        upper_material: `${materials.upper} - render with physically accurate surface texture: visible grain, weave, or knit pattern at macro level, subtle surface imperfections for realism`,
        outsole_material: `${materials.outsole} - visible tread pattern, accurate rubber/material sheen on edges`,
        midsole_material: `${materials.midsole} - accurate density and compression appearance, visible foam cell structure where applicable`,
        lining_material: `${materials.lining} - visible at collar and tongue opening with accurate textile weave`,
        hardware: `${materials.hardware} - metallic reflections with physically accurate BRDF, subtle fingerprint smudges for realism`,
        color_scheme: colorDescription
      },
      wear_and_tear: "brand new, factory fresh, zero wear"
    },
    environment: {
      location: "professional product photography studio",
      background: "seamless gradient from white (#FFFFFF) to light gray (#E8E8E8), no visible horizon line",
      surface: "invisible surface, shoe appears floating with soft ground shadow",
      lighting: {
        type: "three-point studio setup with large softboxes",
        quality: "soft diffused key light from upper-left at 45 degrees, fill light from right at 20% intensity, rim light from behind-right for edge separation",
        behavior: "light wraps around shoe contours revealing every panel line and stitch, specular highlights on hardware and glossy surfaces follow Fresnel equations, shadow density 15-20% max, subtle film grain, gentle bloom on highlights"
      }
    },
    structural_preservation: {
      priority: "CRITICAL",
      rules: [
        "Maintain EXACT silhouette outline - every curve and angle must match input image",
        "Preserve all panel lines, seam locations, overlay positions exactly as shown",
        "Keep identical proportions: toe box height, heel counter angle, midsole thickness ratio",
        "Maintain exact eyelet/lace placement and spacing",
        "Do not add, remove, or reposition any design elements",
        "Camera angle and perspective must match input exactly"
      ]
    },
    negative_prompt: {
      forbidden_elements: [
        "text", "logos", "watermarks", "branding", "labels", "tags",
        "human body parts", "feet", "legs", "hands",
        "additional shoes", "shoe boxes", "packaging",
        "blurry areas", "bokeh", "depth of field blur",
        "lens flare", "chromatic aberration", "vignetting",
        "artistic filters", "HDR tone mapping artifacts",
        "oversaturation", "cartoon style", "illustration style",
        "3D render look", "CGI artifacts", "wireframe",
        "floating objects", "background elements",
        "color banding", "JPEG artifacts", "noise grain",
        "plastic skin", "airbrushed texture", "stylized realism",
        "beautification filters", "anatomy normalization",
        "dataset-average proportions", "skin smoothing"
      ]
    }
  }, null, 2);
}

const VIEW_LABELS: Record<string, string> = {
  front: "straight-on front",
  back: "straight-on rear",
  left: "medial side profile",
  right: "lateral side profile",
  top: "birds-eye top-down",
  bottom: "sole/bottom-up",
};

export function buildReferenceRenderPrompt(viewName: string): string {
  const viewLabel = VIEW_LABELS[viewName] || viewName;

  return [
    "You are given TWO images:",
    "",
    "IMAGE 1 (STYLE REFERENCE): A photorealistic hero product photograph of a shoe. This is the APPROVED style - match it EXACTLY.",
    "",
    `IMAGE 2 (3D CAPTURE): A ${viewLabel} view screenshot of the same shoe from a 3D model. This defines the EXACT camera angle and pose.`,
    "",
    "YOUR TASK: Generate a photorealistic product photograph from the camera angle shown in Image 2, with the EXACT visual style from Image 1.",
    "",
    "MATCH FROM THE HERO (Image 1):",
    "- Identical material textures and surface quality (leather grain, mesh weave, rubber finish)",
    "- Identical color tones, saturation levels, and color temperature",
    "- Identical lighting setup, shadow density, highlight behavior, and specular response",
    "- Identical background gradient (white to light gray, seamless)",
    "- Identical level of detail, sharpness, and photographic quality",
    "- Identical subtle film grain and highlight bloom characteristics",
    "",
    "MATCH FROM THE 3D CAPTURE (Image 2):",
    "- EXACT camera angle and perspective - do not rotate or tilt",
    "- EXACT shoe orientation and pose from this viewing angle",
    "- EXACT silhouette and proportions visible from this angle",
    "- All design elements visible from this angle must appear in correct positions",
    "",
    "CRITICAL RULES:",
    "- No text, logos, watermarks, or branding",
    "- No blur, bokeh, depth of field, or artistic effects",
    "- No CGI look, cartoon style, or illustration style",
    "- Do not change, add, or remove any shoe components or design elements",
    "- The result must look like it came from the SAME photo shoot as the hero image, just from a different angle",
    "- Clean commercial sharpness, 90mm macro lens quality, f/2.8, ISO 200",
  ].join("\n");
}
