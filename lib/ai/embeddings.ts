import { openAiClient, getActiveProvider } from "./index";
import type { CandidateParsedProfile } from "./parser";

export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Creates a dense semantic text representation of a candidate for embedding indexing
 */
export function buildCandidateEmbeddingText(candidate: {
  fullName: string;
  seniority?: string | null;
  experienceYears?: number | null;
  skills: string[];
  languages?: any;
  location?: string | null;
  summary?: string | null;
  workHistory?: any[];
}): string {
  const languagesStr = Array.isArray(candidate.languages)
    ? candidate.languages.map((l: any) => `${l.language || l} (${l.level || "N/A"})`).join(", ")
    : "No especificado";

  const workHistoryStr = Array.isArray(candidate.workHistory)
    ? candidate.workHistory
        .map((w: any) => `${w.role || ""} en ${w.company || ""}: ${(w.highlights || []).join("; ")}`)
        .slice(0, 5)
        .join(" | ")
    : "";

  return `
Nombre: ${candidate.fullName}
Seniority: ${candidate.seniority || "No especificado"}
Años de Experiencia: ${candidate.experienceYears ?? 0}
Ubicación: ${candidate.location || "Remoto"}
Habilidades Técnicas y Soft Skills: ${candidate.skills.join(", ")}
Idiomas: ${languagesStr}
Resumen Profesional: ${candidate.summary || ""}
Experiencia Laboral: ${workHistoryStr}
`.trim();
}

/**
 * Generates a 1536-dimensional vector embedding for semantic search
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const provider = getActiveProvider();

  if (provider === "openai" && openAiClient) {
    try {
      const model = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
      const response = await openAiClient.embeddings.create({
        model,
        input: text.slice(0, 8000), // OpenAI token limit safety
      });

      const embedding = response.data[0]?.embedding;
      if (embedding && embedding.length === EMBEDDING_DIMENSIONS) {
        return embedding;
      }
    } catch (err: any) {
      console.error("[Embeddings] OpenAI embedding generation failed:", err.message);
    }
  }

  // Deterministic fallback pseudo-vector for local dev / testing without API credits
  return generateDeterministicMockVector(text, EMBEDDING_DIMENSIONS);
}

/**
 * Formats a JavaScript number array into a pgvector string representation: '[0.1,0.2,...]'
 */
export function formatVectorForPg(vector: number[]): string {
  return `[${vector.join(",")}]`;
}

/**
 * Generates a deterministic normalized mock vector based on text hashing for testing
 */
function generateDeterministicMockVector(input: string, dimensions: number): number[] {
  const vector = new Array(dimensions).fill(0);
  let hash = 0;

  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }

  for (let i = 0; i < dimensions; i++) {
    const pseudoRandom = Math.sin(hash + i * 17) * 10000;
    vector[i] = pseudoRandom - Math.floor(pseudoRandom);
  }

  // Normalize vector to unit length
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map((v) => (norm > 0 ? Number((v / norm).toFixed(6)) : 0));
}
