import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Client LLM unifié : OpenAI (principal) + Gemini (fallback)
 * Usage restreint aux analyses qualitatives uniquement.
 */
export async function askLLM(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  // Tentative OpenAI
  try {
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          ...(systemPrompt
            ? [{ role: "system" as const, content: systemPrompt }]
            : []),
          { role: "user" as const, content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      },
      { timeout: 15000 }
    );
    return response.choices[0].message.content || "{}";
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn("[LLM] OpenAI failed:", errMsg, "— falling back to Gemini");
  }

  // Fallback Gemini
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    });
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;
    const result = await model.generateContent(fullPrompt);
    return result.response.text();
  } catch (error) {
    console.error("[LLM] Gemini also failed:", error);
    throw new Error("Les deux LLM (OpenAI + Gemini) ont échoué.");
  }
}

/**
 * Appelle le LLM et parse la réponse JSON
 */
export async function askLLMJson<T>(
  prompt: string,
  systemPrompt?: string
): Promise<T> {
  const raw = await askLLM(prompt, systemPrompt);
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Tenter d'extraire le JSON d'un bloc markdown
    const match = raw.match(/```json?\s*([\s\S]*?)```/);
    if (match) {
      return JSON.parse(match[1]) as T;
    }
    throw new Error(`Réponse LLM non-JSON: ${raw.slice(0, 200)}`);
  }
}
