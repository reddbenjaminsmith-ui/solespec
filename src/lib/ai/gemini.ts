import { GoogleGenAI } from "@google/genai";

let _gemini: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!_gemini) {
    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error("GOOGLE_AI_API_KEY is not set");
    }
    _gemini = new GoogleGenAI({
      apiKey: process.env.GOOGLE_AI_API_KEY,
    });
  }
  return _gemini;
}

export const GEMINI_IMAGE_MODEL = "gemini-2.0-flash-exp";
