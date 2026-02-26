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
}

// Rendered view from 3D model
export interface RenderedView {
  id: string;
  projectId: string;
  viewName: TechnicalView;
  imageUrl: string;
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
