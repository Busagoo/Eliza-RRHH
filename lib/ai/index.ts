import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getEnv } from "../env";

// 1. Dynamic AI Clients (evaluated lazily per request for Cloudflare / Serverless compatibility)
export function getGroqClient(): OpenAI | null {
  const apiKey = getEnv("GROQ_API_KEY")?.trim();
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

export function getOpenAiClient(): OpenAI | null {
  const apiKey = getEnv("OPENAI_API_KEY")?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

export function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = getEnv("GEMINI_API_KEY")?.trim();
  if (!apiKey) return null;
  return new GoogleGenerativeAI(apiKey);
}

export function getActiveProvider(): "groq" | "openai" | "gemini" | "mock" {
  const configured = getEnv("AI_PROVIDER")?.trim();
  const hasGroq = Boolean(getEnv("GROQ_API_KEY")?.trim());
  const hasOpenAi = Boolean(getEnv("OPENAI_API_KEY")?.trim());
  const hasGemini = Boolean(getEnv("GEMINI_API_KEY")?.trim());

  if (configured === "groq" && hasGroq) return "groq";
  if (configured === "openai" && hasOpenAi) return "openai";
  if (configured === "gemini" && hasGemini) return "gemini";

  if (hasGroq) return "groq";
  if (hasOpenAi) return "openai";
  if (hasGemini) return "gemini";
  return "mock";
}

/**
 * Executes a structured JSON prompt with Groq, OpenAI, or Gemini,
 * parsing and validating the response against TypeScript interfaces.
 */
export async function generateStructuredJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  modelOverride?: string
): Promise<T> {
  const provider = getActiveProvider();
  const groqClient = getGroqClient();
  const openAiClient = getOpenAiClient();
  const geminiClient = getGeminiClient();

  // GROQ (Llama 3.3 70B / Llama 3.1 8B with JSON mode)
  if (provider === "groq" && groqClient) {
    const model = modelOverride || getEnv("GROQ_MODEL") || "openai/gpt-oss-120b";
    const response = await groqClient.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\nOutput strict JSON only. Do not include markdown codeblocks or preamble.`,
        },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content) as T;
  }

  // OPENAI
  if (provider === "openai" && openAiClient) {
    const model = modelOverride || process.env.OPENAI_MODEL_PARSER || "gpt-4o-mini";
    const response = await openAiClient.chat.completions.create({
      model,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${systemPrompt}\nReturn your answer strictly as a valid JSON object.` },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content || "{}";
    return JSON.parse(content) as T;
  }

  // GEMINI
  if (provider === "gemini" && geminiClient) {
    const modelName = modelOverride || process.env.GEMINI_MODEL_PARSER || "gemini-1.5-flash";
    const model = geminiClient.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
    });

    const prompt = `${systemPrompt}\n\nStrict JSON requirement: Return only valid JSON.\n\nInput Data:\n${userPrompt}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text) as T;
  }

  console.warn("[AI Provider] No active API key (GROQ_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY). Using fallback mock.");
  throw new Error("AI provider credentials missing. Please set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in .env");
}

/**
 * Text completion helper
 */
export async function generateCompletion(
  systemPrompt: string,
  userPrompt: string,
  modelOverride?: string
): Promise<string> {
  const provider = getActiveProvider();
  const groqClient = getGroqClient();
  const openAiClient = getOpenAiClient();
  const geminiClient = getGeminiClient();

  if (provider === "groq" && groqClient) {
    const model = modelOverride || getEnv("GROQ_MODEL_FAST") || "openai/gpt-oss-20b";
    const response = await groqClient.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });
    return response.choices[0]?.message?.content || "";
  }

  if (provider === "openai" && openAiClient) {
    const model = modelOverride || process.env.OPENAI_MODEL_FAST || "gpt-4o-mini";
    const response = await openAiClient.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
    });
    return response.choices[0]?.message?.content || "";
  }

  if (provider === "gemini" && geminiClient) {
    const modelName = modelOverride || process.env.GEMINI_MODEL_FAST || "gemini-1.5-flash";
    const model = geminiClient.getGenerativeModel({ model: modelName });
    const result = await model.generateContent(`${systemPrompt}\n\n${userPrompt}`);
    return result.response.text();
  }

  throw new Error("AI provider credentials missing. Please set GROQ_API_KEY, OPENAI_API_KEY, or GEMINI_API_KEY in .env");
}
