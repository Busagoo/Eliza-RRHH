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

const PARSE_RESUME_SYSTEM_PROMPT = `You are an expert HR Data Extraction Specialist and Multi-Domain ATS parser.
Your task is to analyze the extracted resume text (and optional email context) and output a standardized, structured profile JSON conforming strictly to the requested schema.

CRITICAL NAME AND DATA GUIDELINES:
1. fullName: Extract the candidate's actual personal first and last name (e.g. "Paula Romina Rojas", "Martín Nicolás Calvo", "Verónica Kepa", "Carolina Masramón", "Rocío Burgos").
   - ABSOLUTELY NEVER use section headers, department titles, contact labels, or document headings (e.g., "SKILLS", "EXPERIENCIA LABORAL", "ADMINISTRACIÓN", "SISTEMAS", "RESUMEN PROFESIONAL", "CURRICULUM VITAE", "11 3620 0790", "DATOS PERSONALES") as the fullName.
   - If the resume begins with headers or job titles, find the person's name lower in the document or cross-reference with the email sender name.
2. contactEmail: Extract their primary personal email (from resume or sender if omitted).
3. phone: Primary contact phone number with country code if available.
4. location: City, State/Province, Country.
5. yearsOfExperience: Total estimated professional work years as an integer (e.g. 5).
6. seniority: Select strictly one from: "Junior", "Semi-Senior", "Senior", "Lead", "Manager", "Executive".
7. languages: Array of { "language": string, "level": string } (e.g., "Inglés", "Avanzado / C1").
8. skills: Extract real skills specific to their actual career domain:
   - Administration & Finance: Facturación, Conciliaciones bancarias, Tesorería, Cuentas a pagar/cobrar, Cash flow, ERP, SAP, Excel avanzado, Liquidación de sueldos, Impuestos.
   - Fashion & Textile Design: Diseño de indumentaria, Moldería, Fichas técnicas, Desarrollo de producto, Illustrator, Photoshop, Corel Draw, Colecciones.
   - Commercial & Sales: Gestión comercial, Atención al cliente, Negociación, Postventa, CRM, Prospección.
   - Operations & Logistics: Control de stock, Inventario, Logística, Despacho, Compras, Proveedores.
   - Technology: React, Node.js, Python, SQL, C#, .NET, Git, Docker, etc.
   - NEVER classify an administrative, financial, fashion, commercial, or legal candidate under software development!
9. workHistory: Array of companies, roles, durations, and key responsibilities/accomplishments.
10. education: Array of university/degrees/certifications.
11. summary: A professional 2-3 sentence overview accurately reflecting their career domain and strengths.

Respond ONLY with valid JSON matching the schema.`;

/**
 * Normalizes and sanitizes candidate name against section headers and phone numbers
 */
export const HEADER_BLACKLIST = /^(skills|habilidades|competencias|experiencia|experiencia\s*laboral|experiencialaboral|e\s*x\s*p\s*e\s*r\s*i\s*e\s*n\s*c\s*i\s*a\s*l\s*a\s*b\s*o\s*r\s*a\s*l|resumen|resumen\s*profesional|perfil|perfil\s*profesional|datos\s*personales|contacto|contacto\s*laboral|educaci[oó]n|estudios|formaci[oó]n|idiomas|sistemas|curriculum|curriculum\s*vitae|cv|resume|hoja\s*de\s*vida|administraci[oó]n|finanzas|control\s*de\s*gesti[oó]n|abogada|abogado|supervisora?|desarrollador|programador|analista|licenciad[ao]|ingenier[ao]|1|pdf|\+?\d+[\s\d()-]*)$/i;

export function isBlacklistedName(name: string): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 40) return true;
  if (/^[0-9+\s().-]+$/.test(trimmed)) return true; // phone number or digits
  if (trimmed.includes("@") || trimmed.includes("http") || trimmed.includes(".com")) return true;
  if (HEADER_BLACKLIST.test(trimmed)) return true;
  const lower = trimmed.toLowerCase();
  if (lower.includes("control de gestion") || lower.includes("experiencia laboral") || lower.includes("curriculum vitae")) return true;
  return false;
}

export function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Intelligent multi-source Name Resolver:
 * Cross-references resume text, email sender name, and attachment filename.
 */
export function resolveCandidateName(
  text: string,
  meta?: { sender?: string; senderName?: string; filename?: string }
): string {
  const senderClean = (meta?.senderName || meta?.sender || "")
    .replace(/<.*?>/, "")
    .replace(/["']/g, "")
    .trim();

  // 1. Check first 15 lines of resume text for full person name
  const lines = text
    .split("\n")
    .map((l) => l.trim().replace(/^[^a-zA-ZáéíóúñÁÉÍÓÚÑ]+/, ""))
    .filter((l) => l.length >= 3 && l.length <= 40);

  const namePattern = /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){1,3}$/;
  const uppercaseNamePattern = /^[A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,}){1,3}$/;

  for (const line of lines.slice(0, 15)) {
    if (isBlacklistedName(line)) continue;
    if (/\d/.test(line)) continue;

    if (namePattern.test(line) || uppercaseNamePattern.test(line)) {
      if (senderClean && senderClean.length >= 4) {
        const senderParts = senderClean.toLowerCase().split(/\s+/).filter((p) => p.length >= 3);
        const lineLower = line.toLowerCase();
        if (senderParts.some((part) => lineLower.includes(part))) {
          return toTitleCase(line);
        }
      } else {
        return toTitleCase(line);
      }
    }
  }

  // 2. Validate sender clean name if available
  if (senderClean && !senderClean.includes("@") && !isBlacklistedName(senderClean)) {
    const parts = senderClean.split(/\s+/);
    if (parts.length >= 2 && parts.length <= 4) {
      return toTitleCase(senderClean);
    }
  }

  // 3. Check attachment filename (e.g., "CV Veronica Kepa.pdf")
  if (meta?.filename) {
    const cleanFn = meta.filename
      .replace(/\.pdf$/i, "")
      .replace(/\.docx?$/i, "")
      .replace(/\b(cv|curriculum|vitae|resume|202\d|v\d+)\b/gi, "")
      .replace(/[-_]/g, " ")
      .trim();
    if (cleanFn.length >= 4 && cleanFn.split(/\s+/).length >= 2 && !isBlacklistedName(cleanFn)) {
      return toTitleCase(cleanFn);
    }
  }

  return senderClean || "Candidato";
}

/**
 * Multi-Domain Comprehensive Skills Dictionary
 */
export const MULTI_DOMAIN_SKILLS = [
  // 1. Administración, Finanzas y Contabilidad
  { name: "Gestión Administrativa", pattern: /gesti[oó]n\s+administrativa|administraci[oó]n/i },
  { name: "Facturación", pattern: /\bfacturaci[oó]n\b|emisi[oó]n\s+de\s+facturas/i },
  { name: "Conciliaciones Bancarias", pattern: /conciliaci[oó]n\s+bancaria|conciliaciones\s+bancarias/i },
  { name: "Tesorería", pattern: /\btesorer[ií]a\b/i },
  { name: "Flujo de Caja (Cash Flow)", pattern: /cash\s*flow|flujo\s+de\s+caja/i },
  { name: "Cuentas a Pagar / Cobrar", pattern: /cuentas\s+a\s+(pagar|cobrar)|proveedores/i },
  { name: "Control de Gestión", pattern: /control\s+de\s+gesti[oó]n|kpis/i },
  { name: "Presupuestos y Costos", pattern: /presupuest|control\s+presupuestario/i },
  { name: "Liquidación de Sueldos", pattern: /liquidaci[oó]n\s+de\s+sueldos|n[oó]mina/i },
  { name: "SAP", pattern: /\bSAP\b/i },
  { name: "Sistemas ERP", pattern: /\bERP\b|tango\s+gesti[oó]n|bejerman/i },
  { name: "Excel Avanzado", pattern: /excel\s+avanzado|microsoft\s+excel|\bexcel\b/i },

  // 2. Diseño, Moda e Indumentaria
  { name: "Diseño de Indumentaria", pattern: /diseño\s+de\s+indumentaria|diseñadora\s+de\s+indumentaria|moda\b/i },
  { name: "Moldería y Calce", pattern: /molder[ií]a|calce/i },
  { name: "Fichas Técnicas", pattern: /fichas?\s+t[eé]cnicas?/i },
  { name: "Armado de Colecciones", pattern: /colecci[oó]n|armado\s+de\s+colecci[oó]n/i },
  { name: "Estampas y Colorimetría", pattern: /estampas|colorimetr[ií]a|patrones/i },
  { name: "Adobe Illustrator", pattern: /illustrator|adobe\s+illustrator/i },
  { name: "Adobe Photoshop", pattern: /photoshop|adobe\s+photoshop/i },
  { name: "Corel Draw", pattern: /corel\s*draw/i },
  { name: "Procreate", pattern: /\bprocreate\b/i },
  { name: "Canva", pattern: /\bcanva\b/i },
  { name: "Diseño Gráfico", pattern: /diseño\s+gr[aá]fico/i },

  // 3. Comercial, Ventas y Atención al Cliente
  { name: "Gestión Comercial", pattern: /gesti[oó]n\s+comercial|asesor\s+comercial|ventas\b/i },
  { name: "Atención al Cliente", pattern: /atenci[oó]n\s+al\s+cliente|servicio\s+al\s+cliente/i },
  { name: "Negociación", pattern: /negociaci[oó]n/i },
  { name: "Postventa", pattern: /postventa|posventa/i },
  { name: "CRM", pattern: /\bcrm\b|salesforce|hubspot|siebel/i },
  { name: "Cobranzas", pattern: /cobranzas?|gesti[oó]n\s+de\s+mora/i },

  // 4. Operaciones, Logística y Compras
  { name: "Control de Stock", pattern: /control\s+de\s+stock|inventario/i },
  { name: "Logística y Distribución", pattern: /log[ií]stica|distribuci[oó]n|despacho/i },
  { name: "Gestión de Proveedores", pattern: /gesti[oó]n\s+de\s+proveedores|compras/i },
  { name: "Cadena de Suministro", pattern: /supply\s+chain|cadena\s+de\s+suministro/i },

  // 5. Recursos Humanos
  { name: "Selección de Personal", pattern: /selecci[oó]n\s+de\s+personal|reclutamiento|recruiting/i },
  { name: "Relaciones Laborales", pattern: /relaciones\s+laborales|clima\s+laboral/i },

  // 6. Legal
  { name: "Derecho Laboral", pattern: /derecho\s+laboral|legislaci[oó]n\s+laboral/i },
  { name: "Gestión de Contratos", pattern: /contratos?|convenios?/i },

  // 7. Marketing y Redes
  { name: "Marketing Digital", pattern: /marketing\s+digital|growth/i },
  { name: "Community Management", pattern: /community\s+manager|redes\s+sociales/i },

  // 8. Tecnología y Software
  { name: "React", pattern: /\breact(\.js)?\b/i },
  { name: "Node.js", pattern: /\bnode(\.js)?\b/i },
  { name: "JavaScript", pattern: /\bjavascript\b|\bjs\b/i },
  { name: "TypeScript", pattern: /\btypescript\b|\bts\b/i },
  { name: "Python", pattern: /\bpython\b/i },
  { name: "Java", pattern: /\bjava\b/i },
  { name: "SQL", pattern: /\bsql\b|postgresql|mysql/i },
  { name: "C#", pattern: /\bc#\b|\.net\b/i },
  { name: "PHP", pattern: /\bphp\b/i },
  { name: "Git", pattern: /\bgit\b/i },
  { name: "Docker", pattern: /\bdocker\b/i },
  { name: "AWS", pattern: /\baws\b|amazon\s+web\s+services/i },
  { name: "Power BI", pattern: /power\s*bi/i },
];

export function extractMultiDomainSkills(text: string): string[] {
  const matched: string[] = [];
  for (const skill of MULTI_DOMAIN_SKILLS) {
    if (skill.pattern.test(text)) {
      matched.push(skill.name);
    }
  }

  if (matched.length > 0) {
    return matched.slice(0, 8);
  }

  // Fallback domain-aware detection without tech bias
  const lower = text.toLowerCase();
  if (lower.includes("diseño") || lower.includes("moda") || lower.includes("indumentaria")) {
    return ["Diseño de Indumentaria", "Creatividad y Estética"];
  }
  if (lower.includes("administra") || lower.includes("contab") || lower.includes("finanz")) {
    return ["Gestión Administrativa", "Organización Financiera"];
  }
  if (lower.includes("comercial") || lower.includes("ventas") || lower.includes("cliente")) {
    return ["Gestión Comercial", "Atención al Cliente"];
  }
  if (lower.includes("logistica") || lower.includes("deposito") || lower.includes("stock")) {
    return ["Logística y Distribución", "Control de Stock"];
  }
  if (lower.includes("abogad") || lower.includes("derecho") || lower.includes("legal")) {
    return ["Asesoría Legal", "Gestión de Contratos"];
  }

  return ["Perfil Profesional", "Organización"];
}

/**
 * Extracts structured candidate profile from resume text using LLM structured output
 */
export async function parseResumeText(
  resumeText: string,
  emailMetadata?: { sender: string; subject: string; senderEmail?: string; senderName?: string; filename?: string }
): Promise<CandidateParsedProfile> {
  const truncatedResume = resumeText.slice(0, 14000); // safety slice for token limits

  const userPrompt = `CANDIDATE RESUME CONTENT:
---
${truncatedResume}
---

EMAIL CONTEXT:
- Sender Name: ${emailMetadata?.senderName || emailMetadata?.sender || "Unknown"}
- Subject: ${emailMetadata?.subject || "Job Application"}
- Sender Email: ${emailMetadata?.senderEmail || "N/A"}
- Attachment Filename: ${emailMetadata?.filename || "N/A"}

Please extract the structured profile according to the ATS JSON specification.`;

  try {
    const parsed = await generateStructuredJSON<CandidateParsedProfile>(
      PARSE_RESUME_SYSTEM_PROMPT,
      userPrompt
    );

    // Sanitize fullName: if LLM returned a blacklisted header or phone number, resolve via algorithm
    let validFullName = (parsed.fullName || "").trim();
    if (isBlacklistedName(validFullName)) {
      validFullName = resolveCandidateName(resumeText, emailMetadata);
    }

    // Sanitize skills: if LLM returned 0 skills or generic software dev for non-tech candidate
    let validSkills = Array.isArray(parsed.skills)
      ? Array.from(new Set(parsed.skills.map((s) => s.trim()).filter(Boolean)))
      : [];

    const isNonTech = /administra|finanz|contab|diseño|moda|indumentaria|ventas|comercial|legal|logistica/i.test(resumeText);
    const hasOnlySoftwareTag = validSkills.length === 1 && (validSkills[0].toLowerCase().includes("desarrollo") || validSkills[0].toLowerCase().includes("software"));

    if (validSkills.length === 0 || (isNonTech && hasOnlySoftwareTag)) {
      validSkills = extractMultiDomainSkills(resumeText);
    }

    return {
      fullName: validFullName || resolveCandidateName(resumeText, emailMetadata),
      contactEmail: parsed.contactEmail || emailMetadata?.senderEmail || "",
      phone: parsed.phone || "",
      location: parsed.location || "Argentina / Remoto",
      yearsOfExperience: Math.max(0, Number(parsed.yearsOfExperience) || 0),
      seniority: sanitizeSeniority(parsed.seniority),
      languages: Array.isArray(parsed.languages) && parsed.languages.length ? parsed.languages : [{ language: "Español", level: "Nativo" }],
      skills: validSkills,
      workHistory: Array.isArray(parsed.workHistory) ? parsed.workHistory : [],
      education: Array.isArray(parsed.education) ? parsed.education : [],
      summary: parsed.summary?.trim() || resumeText.slice(0, 300) + "...",
    };
  } catch (error: any) {
    console.error("[ResumeParser] Error parsing structured resume:", error);
    // Fallback heuristic extraction so pipeline never crashes
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

export function fallbackHeuristicParser(
  resumeText: string,
  emailMetadata?: { sender: string; subject: string; senderEmail?: string; senderName?: string; filename?: string }
): CandidateParsedProfile {
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  const emails = resumeText.match(emailRegex) || [];
  const contactEmail = emails[0] || emailMetadata?.senderEmail || "candidate@email.com";

  // Phone regex
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
  const phones = resumeText.match(phoneRegex);
  const phone = phones && phones[0] ? phones[0].trim() : "";

  // Intelligent Name Resolution
  const fullName = resolveCandidateName(resumeText, emailMetadata);

  // Multi-Domain Skills Extraction
  const detectedSkills = extractMultiDomainSkills(resumeText);

  return {
    fullName,
    contactEmail,
    phone,
    location: "Argentina / Remoto",
    yearsOfExperience: detectedSkills.length > 3 ? 3 : 1,
    seniority: detectedSkills.length > 4 ? "Semi-Senior" : "Junior",
    languages: [{ language: "Español", level: "Nativo" }],
    skills: detectedSkills,
    workHistory: [],
    education: [],
    summary: resumeText.slice(0, 300) + "...",
  };
}
