import { generateStructuredJSON, getActiveProvider } from "./index";

export interface RankedCandidateResult {
  candidateId: string;
  matchScore: number; // 0 - 100
  justification: string; // 1-2 concise sentences
  keyStrengths: string[];
  missingRequirements: string[];
}

export interface CandidateForReranking {
  id: string;
  fullName: string;
  seniority?: string | null;
  experienceYears: number;
  skills: string[];
  languages: any;
  location?: string | null;
  summary?: string | null;
  workHistory?: any[];
  receivedAt: Date | string;
}

const RERANK_SYSTEM_PROMPT = `You are a Senior Technical Recruiter and ATS Match Evaluation Engine.
Your task is to evaluate a batch of candidates against a specific job requirement provided by HR.

For each candidate, provide:
1. matchScore: An integer between 0 and 100 representing how well the candidate matches the requirements.
   - 90-100: Exceptional match, exceeds all must-have criteria.
   - 75-89: Strong match, meets all core requirements with relevant experience.
   - 60-74: Moderate match, meets some requirements but has minor gaps.
   - Below 60: Weak match, missing critical skills or significant experience gaps.
2. justification: 1 to 2 concise sentences in Spanish explaining specifically WHY this candidate fits the role and highlighting their most relevant experience or skills.
3. keyStrengths: Array of up to 3 matched skills or attributes.
4. missingRequirements: Array of up to 2 gaps or missing criteria.

Output JSON:
{
  "evaluations": [
    {
      "candidateId": "string",
      "matchScore": number,
      "justification": "string",
      "keyStrengths": ["string"],
      "missingRequirements": ["string"]
    }
  ]
}`;

/**
 * Re-ranks candidate profiles against HR search requirements using LLM reasoning
 */
export async function rerankCandidatesWithLLM(
  requirementsQuery: string,
  candidates: CandidateForReranking[]
): Promise<RankedCandidateResult[]> {
  if (candidates.length === 0) return [];

  // If no AI keys configured, use intelligent algorithmic heuristic ranking
  if (getActiveProvider() === "mock") {
    return heuristicRerank(requirementsQuery, candidates);
  }

  try {
    // Process in batches of 10 candidates to fit within prompt tokens and ensure detailed reasoning
    const batchSize = 10;
    const allResults: RankedCandidateResult[] = [];

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize);

      const candidateSummaries = batch.map((c) => ({
        id: c.id,
        name: c.fullName,
        seniority: c.seniority,
        experienceYears: c.experienceYears,
        skills: c.skills,
        languages: c.languages,
        summary: c.summary,
      }));

      const userPrompt = `JOB REQUIREMENTS / REQUERIMIENTOS RRHH:
"${requirementsQuery}"

CANDIDATES TO EVALUATE:
${JSON.stringify(candidateSummaries, null, 2)}

Evaluate each candidate against the requirements and return the array of evaluations.`;

      const response = await generateStructuredJSON<{ evaluations: RankedCandidateResult[] }>(
        RERANK_SYSTEM_PROMPT,
        userPrompt,
        process.env.GROQ_MODEL || process.env.OPENAI_MODEL_RERANK || process.env.GEMINI_MODEL_RERANK
      );

      if (response && Array.isArray(response.evaluations)) {
        allResults.push(...response.evaluations);
      } else {
        // Fallback for this batch
        allResults.push(...heuristicRerank(requirementsQuery, batch));
      }
    }

    return allResults;
  } catch (error: any) {
    console.warn("[Reranker] LLM reranking encountered an issue, using heuristic scoring:", error.message);
    return heuristicRerank(requirementsQuery, candidates);
  }
}

/**
 * High-quality heuristic reranker when LLM is unavailable or as instant baseline
 */
export function heuristicRerank(
  query: string,
  candidates: CandidateForReranking[]
): RankedCandidateResult[] {
  const queryLower = query.toLowerCase();
  const queryTerms = queryLower
    .split(/[\s,.;:/+]+/)
    .filter((w) => w.length > 2 && !["con", "para", "los", "las", "del", "que", "una", "por"].includes(w));

  return candidates.map((candidate) => {
    let score = 50; // base score
    const matchedStrengths: string[] = [];
    const gaps: string[] = [];

    // 1. Skill term matching
    const candidateSkillsLower = candidate.skills.map((s) => s.toLowerCase());
    let matchedSkillCount = 0;

    for (const term of queryTerms) {
      const matched = candidateSkillsLower.find((s) => s.includes(term) || term.includes(s));
      if (matched) {
        matchedSkillCount++;
        if (matchedStrengths.length < 3) {
          matchedStrengths.push(matched.toUpperCase());
        }
      }
    }

    score += Math.min(35, matchedSkillCount * 12);

    // 2. Experience check
    if (queryLower.includes("senior") || queryLower.includes("sr")) {
      if (candidate.seniority === "Senior" || candidate.experienceYears >= 5) {
        score += 10;
        matchedStrengths.push(`Seniority ${candidate.seniority || "Senior"}`);
      } else {
        score -= 10;
        gaps.push("Menos de 5 años de experiencia");
      }
    }

    // 3. Language check
    if (queryLower.includes("ingl") || queryLower.includes("english")) {
      const langStr = JSON.stringify(candidate.languages || "").toLowerCase();
      if (langStr.includes("ingl") || langStr.includes("english")) {
        score += 10;
        matchedStrengths.push("Inglés comprobable");
      } else {
        score -= 8;
        gaps.push("Inglés no especificado en CV");
      }
    }

    const finalScore = Math.max(15, Math.min(99, score));
    const yearStr = candidate.receivedAt
      ? new Date(candidate.receivedAt).getFullYear()
      : "reciente";

    const justification = matchedStrengths.length > 0
      ? `Coincide con ${matchedStrengths.slice(0, 2).join(" y ")}, aportando ${candidate.experienceYears} años de experiencia (CV registrado en ${yearStr}).`
      : `Perfil técnico en desarrollo con ${candidate.experienceYears} años de trayectoria en el stack evaluado.`;

    return {
      candidateId: candidate.id,
      matchScore: finalScore,
      justification,
      keyStrengths: matchedStrengths.slice(0, 3),
      missingRequirements: gaps.slice(0, 2),
    };
  });
}
