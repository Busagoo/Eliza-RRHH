import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const configuredProvider = process.env.AI_PROVIDER;

// 1. Groq Client (using OpenAI-compatible SDK endpoint)
let groqClient: OpenAI | null = null;
if (process.env.GROQ_API_KEY) {
  groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

// 2. OpenAI Client
let openAiClient: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openAiClient = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

// 3. Google Gemini Client
let geminiClient: GoogleGenerativeAI | null = null;
if (process.env.GEMINI_API_KEY) {
  geminiClient = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

export function getActiveProvider(): "groq" | "openai" | "gemini" | "mock" {
  if (configuredProvider === "groq" && groqClient) return "groq";
  if (configuredProvider === "openai" && openAiClient) return "openai";
  if (configuredProvider === "gemini" && geminiClient) return "gemini";

  // Automatic preference: Groq (ultra fast & free) -> OpenAI -> Gemini -> Mock
  if (groqClient) return "groq";
  if (openAiClient) return "openai";
  if (geminiClient) return "gemini";
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

  // GROQ (Llama 3.3 70B / Llama 3.1 8B with JSON mode)
  if (provider === "groq" && groqClient) {
    const model = modelOverride || process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
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

  if (provider === "groq" && groqClient) {
    const model = modelOverride || process.env.GROQ_MODEL_FAST || "llama-3.1-8b-instant";
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

export { groqClient, openAiClient, geminiClient };
