import { generateStructuredJSON, getActiveProvider } from "./index";

export interface ClassificationResult {
  isResume: boolean;
  confidence: number;
  reason: string;
}

/**
 * Fast, cost-effective classifier to determine if an email is a job application / CV submission.
 * Saves tokens and DB overhead by discarding non-job emails early.
 */
export async function classifyEmailForResume(params: {
  subject: string;
  sender: string;
  snippet?: string;
  bodyPreview?: string;
  attachmentName?: string;
  hasAttachment: boolean;
}): Promise<ClassificationResult> {
  const { subject, sender, snippet, bodyPreview, attachmentName, hasAttachment } = params;

  // 1. Fast heuristic pre-check to eliminate obvious spam / system transactional emails without calling LLM
  const lowerSubject = (subject || "").toLowerCase();
  const lowerSender = (sender || "").toLowerCase();
  const lowerAttachment = (attachmentName || "").toLowerCase();

  const isObviousSystemEmail =
    lowerSender.includes("no-reply") ||
    lowerSender.includes("noreply") ||
    lowerSender.includes("notifications@") ||
    lowerSender.includes("newsletter@") ||
    lowerSender.includes("billing@") ||
    lowerSender.includes("security@google.com");

  const isObviousNonJobSubject =
    lowerSubject.includes("código de seguridad") ||
    lowerSubject.includes("security code") ||
    lowerSubject.includes("factura") ||
    lowerSubject.includes("invoice") ||
    lowerSubject.includes("password reset") ||
    lowerSubject.includes("verificación");

  if (isObviousSystemEmail && isObviousNonJobSubject) {
    return {
      isResume: false,
      confidence: 0.99,
      reason: "Automated transactional or security email",
    };
  }

  // 2. Clear positive heuristic: attachment is named "cv_john_doe.pdf" or "curriculum.pdf"
  const cvFilePatterns = /(cv|curriculum|resume|hoja.*de.*vida|postulacion)/i;
  const isCvAttachment = Boolean(attachmentName && cvFilePatterns.test(attachmentName));

  const cvSubjectPatterns = /(postulaci[oó]n|cv|resume|curr[ií]culum|candidatura|b[uú]squeda|aspirante|oferta de empleo)/i;
  const isCvSubject = cvSubjectPatterns.test(lowerSubject);

  // If no AI keys configured, fallback smoothly to rule-based classification
  if (getActiveProvider() === "mock") {
    if (isCvAttachment || (hasAttachment && isCvSubject)) {
      return {
        isResume: true,
        confidence: 0.9,
        reason: "Matched resume attachment and application keywords (heuristic)",
      };
    }
    return {
      isResume: false,
      confidence: 0.8,
      reason: "No resume attachment or application indicators found (heuristic)",
    };
  }

  // 3. Fast economical LLM evaluation (e.g. gpt-4o-mini / gemini-1.5-flash)
  const systemPrompt = `You are a high-speed recruiting triage filter for an Applicant Tracking System.
Determine whether the incoming email is a job application, candidate submission, or contains a resume/curriculum vitae.
Output strictly JSON format:
{
  "isResume": boolean,
  "confidence": number, // between 0.0 and 1.0
  "reason": string // short explanation in Spanish or English
}`;

  const userPrompt = `Email Data:
- Sender: ${sender}
- Subject: ${subject}
- Has Attachment: ${hasAttachment}
- Attachment Name: ${attachmentName || "None"}
- Snippet: ${snippet || "None"}
- Body Text Preview: ${(bodyPreview || "").slice(0, 500)}`;

  try {
    const result = await generateStructuredJSON<ClassificationResult>(
      systemPrompt,
      userPrompt,
      process.env.GROQ_MODEL_FAST || process.env.OPENAI_MODEL_FAST || process.env.GEMINI_MODEL_FAST
    );

    return {
      isResume: Boolean(result.isResume),
      confidence: Number(result.confidence) || 0.85,
      reason: result.reason || (result.isResume ? "Identified as job application" : "Not a job application"),
    };
  } catch (error: any) {
    console.warn("[Classifier] LLM triage failed, relying on heuristic:", error.message);
    const fallbackMatch = isCvAttachment || (hasAttachment && isCvSubject);
    return {
      isResume: fallbackMatch,
      confidence: 0.75,
      reason: fallbackMatch ? "Rule matched resume attachment/subject" : "Fallback: missing resume indicators",
    };
  }
}
