import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return _openai;
}

// GPT-5.2 - best vision/reasoning model (released Dec 2025)
// Used for sketch analysis, component detection, measurement estimation
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.2";
