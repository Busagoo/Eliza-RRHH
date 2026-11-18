import { generateStructuredJSON, getActiveProvider } from "./index";
import { getEnv } from "../env";

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

CRITICAL ATS CALIBRATION RULES:
1. DOMAIN MISMATCH PENALTY:
   If a candidate's work history and skills are in a completely different domain (e.g., candidate has experience in logistics, warehouse, machine operation like "guillotina", manual labor, or general administration, while the search asks for Software, Programming, SAP, or Financial Analysis), the matchScore MUST BE BETWEEN 0 AND 15, regardless of their total years of career. Experience in an unrelated field does NOT translate to specialized roles.
2. ZERO HARD SKILLS PENALTY:
   If the candidate does not have ANY of the core technical tools, languages, or skills demanded by the role, their matchScore MUST NEVER EXCEED 15%.
3. REALISTIC SCORE DISTRIBUTION:
   - 85-100: Exceptional match. Exceeds core requirements, solid demonstrable experience in the exact tech/domain.
   - 70-84: Strong match. Meets core tech/domain requirements with relevant background.
   - 40-69: Moderate match. Same industry/field but missing secondary tools or lacking seniority.
   - 16-39: Weak match. Barely tangential, junior with only partial transferrable skills.
   - 0-15: Completely unrelated candidate or 0 matching skills.

For each candidate, provide:
1. matchScore: An integer between 0 and 100 based strictly on the calibration rules above.
2. justification: 1 to 2 concise sentences in Spanish explaining specifically WHY this candidate fits or does NOT fit the role.
3. keyStrengths: Array of up to 3 matched skills or attributes (empty if none match).
4. missingRequirements: Array of up to 2 critical gaps or missing criteria.

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
        getEnv("GROQ_MODEL") || getEnv("OPENAI_MODEL_RERANK") || getEnv("GEMINI_MODEL_RERANK")
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
    .filter((w) => w.length > 2 && !["con", "para", "los", "las", "del", "que", "una", "por", "sobre"].includes(w));

  const techDomains = ["software", "desarrollo", "programad", "developer", "frontend", "backend", "fullstack", "react", "c#", ".net", "python", "java", "sql", "sap", "base de datos", "finanzas", "contab"];
  const isSpecializedQuery = techDomains.some((d) => queryLower.includes(d));

  return candidates.map((candidate) => {
    const candidateSkillsLower = candidate.skills.map((s) => s.toLowerCase());
    const candidateText = `${candidate.summary || ""} ${candidateSkillsLower.join(" ")}`.toLowerCase();

    const matchedStrengths: string[] = [];
    const gaps: string[] = [];
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

    let finalScore = 5;

    // Hard check: If 0 skills matched
    if (matchedSkillCount === 0) {
      gaps.push("Sin habilidades técnicas coincidentes con la búsqueda");
      
      // Domain mismatch check (e.g. logistics/guillotina applying for software/sap/finance)
      const hasUnrelatedDomain = /logistica|deposito|guillotina|operario|limpieza|chofer|maquinaria/i.test(candidateText);
      if (isSpecializedQuery || hasUnrelatedDomain) {
        finalScore = 5;
      } else {
        finalScore = Math.min(12, 5 + (candidate.experienceYears > 0 ? 3 : 0));
      }
    } else {
      // Base score for matching at least 1 core requirement
      finalScore = 25 + Math.min(55, matchedSkillCount * 18);

      // Seniority bonus/penalty
      if (queryLower.includes("senior") || queryLower.includes("sr")) {
        if (candidate.seniority === "Senior" || candidate.experienceYears >= 5) {
          finalScore += 10;
          matchedStrengths.push(`Seniority ${candidate.seniority || "Senior"}`);
        } else {
          finalScore -= 8;
          gaps.push("Menos de 5 años de experiencia");
        }
      }

      // Language check
      if (queryLower.includes("ingl") || queryLower.includes("english")) {
        const langStr = JSON.stringify(candidate.languages || "").toLowerCase();
        if (langStr.includes("ingl") || langStr.includes("english")) {
          finalScore += 10;
          matchedStrengths.push("Inglés comprobable");
        } else {
          finalScore -= 6;
          gaps.push("Inglés no especificado en CV");
        }
      }

      finalScore = Math.max(15, Math.min(99, finalScore));
    }

    const yearStr = candidate.receivedAt
      ? new Date(candidate.receivedAt).getFullYear()
      : "reciente";

    const justification = matchedSkillCount > 0
      ? `Coincide con ${matchedStrengths.slice(0, 2).join(" y ")}, aportando ${candidate.experienceYears} años de experiencia (CV registrado en ${yearStr}).`
      : `No posee experiencia ni habilidades demostrables en las tecnologías o requerimientos específicos del puesto.`;

    return {
      candidateId: candidate.id,
      matchScore: finalScore,
      justification,
      keyStrengths: matchedStrengths.slice(0, 3),
      missingRequirements: gaps.slice(0, 2),
    };
  });
}
