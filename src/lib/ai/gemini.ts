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

// Nano Banana 2 (Gemini 3.1 Flash Image) - fast, good quality, reliable capacity
// Nano Banana Pro (gemini-3-pro-image-preview) is higher quality but frequently overloaded
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";

// Fallback: Nano Banana Pro - higher quality but often hits 503 overload
export const GEMINI_IMAGE_FALLBACK = "gemini-3-pro-image-preview";
