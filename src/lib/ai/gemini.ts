import { GoogleGenAI } from "@google/genai";

let _gemini: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!_gemini) {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not set");
    }
    _gemini = new GoogleGenAI({
      apiKey: process.env.GOOGLE_GEMINI_API_KEY,
    });
  }
  return _gemini;
}

// Nano Banana Pro - best image generation model (Gemini 3 Pro Image)
// Higher quality, more photorealistic, better prompt adherence than GPT Image 1.5
// Supports up to 4K output, image-to-image editing, and multi-image input
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3-pro-image-preview";
