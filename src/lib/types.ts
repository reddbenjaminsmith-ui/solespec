import type { TechnicalView, ComponentCategory } from "./constants";

// Project
export interface Project {
  id: string;
  name: string;
  email: string;
  status: "draft" | "analyzing" | "in_progress" | "complete";
  modelUrl: string;
  thumbnailUrl: string;
  wizardStep: number;
  createdAt: string;
  sourceType: "3D Model" | "Sketch";
  sketchUrl?: string;
  predecessorModelUrl?: string;
  sketchAnalysis?: string;
}

// Sketch analysis result from GPT-5.2 Vision
export interface SketchAnalysisResult {
  components: {
    name: string;
    category: string;
    region: string;
    description: string;
  }[];
  panelLines: string[];
  designElements: string[];
  shoeType: string;
  constructionNotes: string;
  styleDescription: string;
}

// Rendered view from 3D model
export interface RenderedView {
  id: string;
  projectId: string;
  viewName: TechnicalView;
  imageUrl: string;
  isPhotorealistic?: boolean;
  isStudioRender?: boolean;
}

// AI-detected shoe component
export interface ShoeComponent {
  id: string;
  projectId: string;
  name: string;
  category: ComponentCategory;
  aiConfidence: number;
  confirmed: boolean;
  bestView: TechnicalView;
  labelX: number;
  labelY: number;
  notes: string;
}

// Measurement (AI-estimated or manually entered)
export interface Measurement {
  id: string;
  projectId: string;
  name: string;
  valueMm: number;
  aiEstimated: boolean;
  confirmed: boolean;
  sizeReference: string;
}

// Specifications from wizard
export interface Specifications {
  id: string;
  projectId: string;
  upperMaterial: string;
  upperSecondary: string;
  liningMaterial: string;
  outsoleMaterial: string;
  midsoleMaterial: string;
  hardware: string;
  constructionMethod: string;
  additionalNotes: string;
  upperColor: string;
  upperSecondaryColor: string;
  liningColor: string;
  outsoleColor: string;
  midsoleColor: string;
  hardwareColor: string;
}

// Bill of Materials line item
export interface BOMItem {
  id: string;
  projectId: string;
  component: string;
  materialName: string;
  supplier: string;
  color: string;
  quantityPerPair: string;
  notes: string;
  sortOrder: number;
}

// Cross-section cut line on a view
export interface CrossSection {
  id: string;
  projectId: string;
  label: string; // "A:A", "B:B", etc.
  viewType: "top" | "right";
  linePosition: number; // 0-100, X position of vertical line
  description: string;
  sortOrder: number;
}

// Arrow annotation on a technical view
export interface Annotation {
  id: string;
  projectId: string;
  viewName: string;
  arrowStartX: number; // 0-100
  arrowStartY: number; // 0-100
  arrowEndX: number; // 0-100
  arrowEndY: number; // 0-100
  text: string;
  sortOrder: number;
}

// Stitch detail callout on a technical view
export interface StitchCallout {
  id: string;
  projectId: string;
  viewName: string;
  positionX: number; // 0-100
  positionY: number; // 0-100
  spi: number; // stitches per inch
  threadType: "polyester" | "nylon" | "cotton" | "kevlar";
  stitchPattern:
    | "lockstitch"
    | "chainstitch"
    | "zigzag"
    | "bartack"
    | "flatlock"
    | "overlock";
  threadColor: string; // Pantone code
  notes: string;
  sortOrder: number;
}

// AI analysis response types
export interface AIComponentDetection {
  components: {
    name: string;
    category: ComponentCategory;
    confidence: number;
    bestView: TechnicalView;
    labelX: number;
    labelY: number;
    description: string;
  }[];
  shoeType: string;
  constructionGuess: string;
  materialObservations: string[];
}

export interface AIMeasurementEstimation {
  measurements: {
    name: string;
    valueMm: number;
    confidence: "low" | "medium" | "high";
    reasoning: string;
  }[];
  scaleNote: string;
  referenceSize: string;
}
