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

CRITICAL NAME AND DATA GUIDELINES:
1. fullName: Extract the candidate's actual personal first and last name (e.g. "Rocío Burgos", "Juan Pérez").
   - NEVER use section headers, department titles, or document headings (e.g., "SISTEMAS", "CURRICULUM VITAE", "INGENIERIA", "DATOS PERSONALES", "RESUME") as the fullName. If the resume starts with a title, look for the person's name or cross-reference with the email sender name.
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

  // Phone regex
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
  const phones = resumeText.match(phoneRegex);
  const phone = phones && phones[0] ? phones[0].trim() : "";

  // Name extraction with blacklist against section headers like "SISTEMAS"
  const TITLE_BLACKLIST = /^(sistemas|curriculum\s*vitae|curriculum|cv|resume|hoja\s*de\s*vida|ingenieria|licenciatura|perfil\s*profesional|datos\s*personales|desarrollador|programador|tecnico|analista|experiencia|educacion)$/i;

  const firstLines = resumeText
    .split("\n")
    .map((l) => l.trim().replace(/^[^a-zA-ZáéíóúñÁÉÍÓÚÑ]+/, ""))
    .filter((l) => l.length >= 2 && l.length <= 60);

  let potentialName = "";
  for (const line of firstLines.slice(0, 8)) {
    if (!TITLE_BLACKLIST.test(line) && !line.includes("@") && !/\d{4}/.test(line)) {
      potentialName = line;
      break;
    }
  }

  // Cross-reference with email sender if still empty or suspicious
  if (!potentialName || TITLE_BLACKLIST.test(potentialName)) {
    if (emailMetadata?.sender) {
      const cleanSender = emailMetadata.sender
        .replace(/<.*?>/, "")
        .replace(/["']/g, "")
        .trim();
      if (cleanSender && !cleanSender.includes("@")) {
        potentialName = cleanSender;
      }
    }
  }

  if (!potentialName) {
    potentialName = "Candidato";
  }

  // Basic tech skills detector
  const commonTech = [
    "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "SQL",
    "PostgreSQL", "Git", "Docker", "AWS", "Next.js", "Tailwind", "HTML", "CSS",
    "C#", ".NET", "PHP", "Angular", "Vue", "SAP"
  ];
  const detectedSkills = commonTech.filter((tech) =>
    new RegExp(`\\b${tech.replace(".", "\\.")}\\b`, "i").test(resumeText)
  );

  return {
    fullName: potentialName,
    contactEmail,
    phone,
    location: "Argentina / Remoto",
    yearsOfExperience: detectedSkills.length > 2 ? 3 : 1,
    seniority: detectedSkills.length > 3 ? "Semi-Senior" : "Junior",
    languages: [{ language: "Español", level: "Nativo" }],
    skills: detectedSkills.length ? detectedSkills : ["Desarrollo General"],
    workHistory: [],
    education: [],
    summary: resumeText.slice(0, 300) + "...",
  };
}
