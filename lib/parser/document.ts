import pdfParse from "pdf-parse";
import mammoth from "mammoth";

/**
 * Extracts plain text from a buffer representing a PDF, DOCX, or text document.
 */
export async function extractTextFromDocument(
  buffer: Buffer,
  filename: string,
  mimeType?: string
): Promise<string> {
  const lowerName = filename.toLowerCase();

  try {
    // 1. PDF Documents
    if (lowerName.endsWith(".pdf") || mimeType === "application/pdf") {
      try {
        const data = await pdfParse(buffer);
        if (data.text && data.text.trim().length > 10) {
          return cleanExtractedText(data.text);
        }
      } catch (pdfErr: any) {
        console.warn(`[DocumentParser] pdf-parse error on ${filename}, attempting text stream fallback:`, pdfErr.message);
      }

      // Stream fallback: extract text streams from PDF buffer directly
      const rawString = buffer.toString("binary");
      const textMatches = rawString.match(/\(([^)]+)\)\s*Tj/g) || rawString.match(/\[([^\]]+)\]\s*TJ/g);
      if (textMatches && textMatches.length > 5) {
        const extracted = textMatches.join(" ").replace(/[()[\]\\]/g, "");
        if (extracted.trim().length > 30) {
          return cleanExtractedText(extracted);
        }
      }
    }

    // 2. Word Documents (.docx)
    if (
      lowerName.endsWith(".docx") ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return cleanExtractedText(result.value);
    }

    // 3. Fallback: plain text / markdown
    if (
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md") ||
      mimeType?.startsWith("text/")
    ) {
      return cleanExtractedText(buffer.toString("utf-8"));
    }

    // If unsupported binary format, attempt pdfParse or UTF-8 decoding
    try {
      const data = await pdfParse(buffer);
      if (data.text && data.text.trim().length > 20) {
        return cleanExtractedText(data.text);
      }
    } catch {
      // not a pdf
    }

    return cleanExtractedText(buffer.toString("utf-8"));
  } catch (err: any) {
    console.error(`[DocumentParser] Failed to extract text from ${filename}:`, err);
    throw new Error(`Failed to extract text from document (${filename}): ${err.message}`);
  }
}

/**
 * Normalizes and cleans up raw extracted text
 */
function cleanExtractedText(raw: string): string {
  if (!raw) return "";

  return raw
    .replace(/\0/g, "") // remove null bytes
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ") // collapse multiple spaces/tabs
    .replace(/\n{3,}/g, "\n\n") // collapse multiple line breaks
    .trim();
}
