import { generateStructuredJSON } from "./index";

export interface ParsedWorkHistory {
  company: string;
  role: string;
  duration?: string;
  years?: number;
  highlights?: string[];
}

export interface ParsedEducation {
  institution: string;
  degree: string;
  year?: string;
}

export interface ParsedLanguage {
  language: string;
  level: string; // e.g. "Básico", "Intermedio", "Avanzado / C1", "Nativo"
}

export interface CandidateParsedProfile {
  fullName: string;
  contactEmail: string;
  phone: string;
  location: string;
  yearsOfExperience: number;
  seniority: "Junior" | "Semi-Senior" | "Senior" | "Lead" | "Manager" | "Executive";
  languages: ParsedLanguage[];
  skills: string[]; // Normalized lowercase/title case tags
  workHistory: ParsedWorkHistory[];
  education: ParsedEducation[];
  summary: string;
}

const PARSE_RESUME_SYSTEM_PROMPT = `You are an expert HR Data Extraction Specialist and ATS parser.
Your task is to analyze the extracted resume text (and optional email context) and output a standardized, structured profile JSON conforming strictly to the requested schema.

Guidelines:
1. fullName: Extract candidate's full legal or preferred name.
2. contactEmail: Extract their primary email (from resume or sender if omitted).
3. phone: Primary contact phone number with country code if available.
4. location: City, State/Province, Country.
5. yearsOfExperience: Total estimated professional work years as an integer (e.g. 5).
6. seniority: Select strictly one from: "Junior", "Semi-Senior", "Senior", "Lead", "Manager", "Executive".
7. languages: Array of { "language": string, "level": string } (e.g., "Inglés", "Avanzado / C1").
8. skills: Flat array of normalized technical tools, frameworks, and core skills (e.g. ["React", "TypeScript", "Node.js", "PostgreSQL", "AWS", "Git"]).
9. workHistory: Array of companies, roles, durations, and key responsibilities/accomplishments.
10. education: Array of university/degrees/certifications.
11. summary: A professional 2-3 sentence overview summarizing their career profile, strengths, and primary tech stack.

Respond ONLY with valid JSON matching the schema.`;

/**
 * Extracts structured candidate profile from resume text using LLM structured output
 */
export async function parseResumeText(
  resumeText: string,
  emailMetadata?: { sender: string; subject: string; senderEmail?: string }
): Promise<CandidateParsedProfile> {
  const truncatedResume = resumeText.slice(0, 14000); // safety slice for token limits

  const userPrompt = `CANDIDATE RESUME CONTENT:
---
${truncatedResume}
---

EMAIL CONTEXT:
- From: ${emailMetadata?.sender || "Unknown"}
- Subject: ${emailMetadata?.subject || "Job Application"}
- Sender Email: ${emailMetadata?.senderEmail || "N/A"}

Please extract the structured profile according to the ATS JSON specification.`;

  try {
    const parsed = await generateStructuredJSON<CandidateParsedProfile>(
      PARSE_RESUME_SYSTEM_PROMPT,
      userPrompt
    );

    // Normalize and sanitize values
    return {
      fullName: parsed.fullName?.trim() || "Candidato Sin Nombre",
      contactEmail: parsed.contactEmail || emailMetadata?.senderEmail || "",
      phone: parsed.phone || "",
      location: parsed.location || "No especificada",
      yearsOfExperience: Math.max(0, Number(parsed.yearsOfExperience) || 0),
      seniority: sanitizeSeniority(parsed.seniority),
      languages: Array.isArray(parsed.languages) ? parsed.languages : [],
      skills: Array.isArray(parsed.skills)
        ? Array.from(new Set(parsed.skills.map((s) => s.trim()).filter(Boolean)))
        : [],
      workHistory: Array.isArray(parsed.workHistory) ? parsed.workHistory : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      summary: parsed.summary?.trim() || "Perfil profesional sin resumen disponible.",
    };
  } catch (error: any) {
    console.error("[ResumeParser] Error parsing structured resume:", error);
    // Fallback heuristic extraction so pipeline never crashes completely
    return fallbackHeuristicParser(resumeText, emailMetadata);
  }
}

function sanitizeSeniority(
  val?: string
): "Junior" | "Semi-Senior" | "Senior" | "Lead" | "Manager" | "Executive" {
  const s = (val || "").toLowerCase();
  if (s.includes("lead") || s.includes("principal")) return "Lead";
  if (s.includes("manager") || s.includes("director")) return "Manager";
  if (s.includes("executive")) return "Executive";
  if (s.includes("senior") || s.includes("sr")) return "Senior";
  if (s.includes("semi") || s.includes("ssr") || s.includes("mid")) return "Semi-Senior";
  return "Junior";
}

function fallbackHeuristicParser(
  resumeText: string,
  emailMetadata?: { sender: string; subject: string; senderEmail?: string }
): CandidateParsedProfile {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const emails = resumeText.match(emailRegex) || [];
  const contactEmail = emails[0] || emailMetadata?.senderEmail || "candidate@email.com";

  const firstLines = resumeText.split("\n").map((l) => l.trim()).filter(Boolean);
  const potentialName = firstLines[0]?.slice(0, 50) || emailMetadata?.sender || "Candidato";

  // Basic tech skills detector
  const commonTech = [
    "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "SQL",
    "PostgreSQL", "Git", "Docker", "AWS", "Next.js", "Tailwind", "HTML", "CSS"
  ];
  const detectedSkills = commonTech.filter((tech) =>
    new RegExp(`\\b${tech}\\b`, "i").test(resumeText)
  );

  return {
    fullName: potentialName,
    contactEmail,
    phone: "",
    location: "Argentina / Remoto",
    yearsOfExperience: 3,
    seniority: "Semi-Senior",
    languages: [{ language: "Español", level: "Nativo" }],
    skills: detectedSkills.length ? detectedSkills : ["Desarrollo de Software"],
    workHistory: [],
    education: [],
    summary: resumeText.slice(0, 300) + "...",
  };
}
