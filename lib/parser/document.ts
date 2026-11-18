import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import zlib from "zlib";
import Tesseract from "tesseract.js";

function decodePdfOctal(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
    .replace(/\\([nrtbf()\\])/g, (_, char) => {
      switch (char) {
        case "n": return "\n";
        case "r": return "\r";
        case "t": return "\t";
        case "b": return "\b";
        case "f": return "\f";
        default: return char;
      }
    });
}

/**
 * Extracts plain text from modern PDFs, Tagged PDFs (Canva, Figma, iLovePDF),
 * and decompresses FlateDecode text streams when pdf-parse fails or returns empty lines.
 */
export function extractTextFromPdfBuffer(buffer: Buffer): string {
  const str = buffer.toString("binary");
  const extractedPieces: string[] = [];

  // 1. Check raw buffer for /ActualText (Tagged PDFs)
  const rawActual = str.match(/\/ActualText\s*\(([^)]+)\)/g) || [];
  for (const m of rawActual) {
    const rawVal = m.replace(/\/ActualText\s*\(/, "").slice(0, -1);
    const decoded = decodePdfOctal(rawVal).trim();
    if (decoded) extractedPieces.push(decoded);
  }

  // 2. Decompress internal streams (FlateDecode)
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match: RegExpExecArray | null;

  while ((match = streamRegex.exec(str)) !== null) {
    try {
      const streamBuf = Buffer.from(match[1], "binary");
      let decompressed: Buffer | null = null;
      try {
        decompressed = zlib.inflateSync(streamBuf);
      } catch {
        try {
          decompressed = zlib.inflateRawSync(streamBuf);
        } catch {}
      }

      if (decompressed) {
        const decStr = decompressed.toString("latin1");

        // A. /ActualText in decompressed stream
        const streamActual = decStr.match(/\/ActualText\s*\(([^)]+)\)/g) || [];
        for (const m of streamActual) {
          const rawVal = m.replace(/\/ActualText\s*\(/, "").slice(0, -1);
          const decoded = decodePdfOctal(rawVal).trim();
          if (decoded) extractedPieces.push(decoded);
        }

        // B. Tj text operators
        const tjMatches = decStr.match(/\(([^)]+)\)\s*Tj/g) || [];
        for (const m of tjMatches) {
          const inner = m.replace(/\s*Tj$/, "").slice(1, -1);
          const decoded = decodePdfOctal(inner).trim();
          if (decoded && decoded.length > 1) extractedPieces.push(decoded);
        }

        // C. TJ text array operators
        const bigTj = decStr.match(/\[([\s\S]*?)\]\s*TJ/g) || [];
        for (const m of bigTj) {
          const parts = m.match(/\(([^)]*)\)/g);
          if (parts) {
            const line = parts
              .map((p) => decodePdfOctal(p.slice(1, -1)))
              .join("")
              .trim();
            if (line && line.length > 1) extractedPieces.push(line);
          }
        }
      }
    } catch {}
  }

  // Filter out PDF structural noise
  const clean = extractedPieces.filter(
    (t) =>
      t.length > 1 &&
      !t.startsWith("<<") &&
      !t.endsWith(">>") &&
      !/^\/[A-Z]/i.test(t)
  );

  return clean.join("\n");
}

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
      // First attempt standard pdfParse
      try {
        const data = await pdfParse(buffer);
        // Ensure data.text actually contains letters/numbers, not just empty newlines!
        const trimmed = data.text ? data.text.replace(/[\s\r\n]+/g, " ").trim() : "";
        if (trimmed.length > 25) {
          return cleanExtractedText(data.text);
        }
      } catch (pdfErr: any) {
        console.warn(`[DocumentParser] pdf-parse warning on ${filename}:`, pdfErr.message);
      }

      // Secondary attempt: Advanced stream and /ActualText extraction for Figma/Canva/iLovePDF
      const streamText = extractTextFromPdfBuffer(buffer);
      const cleanStream = streamText.replace(/[\s\r\n]+/g, " ").trim();
      if (cleanStream.length > 25) {
        return cleanExtractedText(streamText);
      }

      // Third attempt: Standard string literal search in binary
      const rawString = buffer.toString("binary");
      const textMatches =
        rawString.match(/\(([^)]+)\)\s*Tj/g) || rawString.match(/\[([^\]]+)\]\s*TJ/g);
      if (textMatches && textMatches.length > 5) {
        const extracted = textMatches.join(" ").replace(/[()[\]\\]/g, "");
        if (extracted.trim().length > 30) {
          return cleanExtractedText(extracted);
        }
      }

      // CRITICAL: NEVER return raw binary PDF headers (%PDF-1.7 etc.)
      console.warn(`[DocumentParser] Could not extract meaningful plain text from ${filename}. Returning empty.`);
      return "";
    }

    // 2. Word Documents (.docx)
    if (
      lowerName.endsWith(".docx") ||
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return cleanExtractedText(result.value);
    }

    // 3. Image OCR (.png, .jpg, .jpeg, .webp) - Critical for scanned or designed CVs
    const isImage =
      lowerName.endsWith(".png") ||
      lowerName.endsWith(".jpg") ||
      lowerName.endsWith(".jpeg") ||
      lowerName.endsWith(".webp") ||
      mimeType?.startsWith("image/");

    if (isImage) {
      try {
        console.log(`[DocumentParser] Running OCR on image resume: ${filename}...`);
        const ocrResult = await Tesseract.recognize(buffer, "spa+eng");
        const ocrText = ocrResult?.data?.text || "";
        if (ocrText.length > 20) {
          console.log(`[DocumentParser] Successfully extracted ${ocrText.length} characters via OCR from ${filename}`);
          return cleanExtractedText(ocrText);
        }
      } catch (ocrErr: any) {
        console.warn(`[DocumentParser] OCR recognition failed on ${filename}:`, ocrErr.message);
      }
      return "";
    }

    // 4. Plain text / markdown
    if (
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md") ||
      mimeType?.startsWith("text/")
    ) {
      return cleanExtractedText(buffer.toString("utf-8"));
    }

    // If unrecognized binary format, check if it's a PDF by magic bytes
    if (buffer.slice(0, 5).toString("ascii").startsWith("%PDF")) {
      const fallbackPdf = extractTextFromPdfBuffer(buffer);
      if (fallbackPdf.length > 25) return cleanExtractedText(fallbackPdf);
      return "";
    }

    // Check if it's a PNG / JPG by magic bytes
    if (
      buffer.slice(0, 4).toString("ascii").includes("PNG") ||
      (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    ) {
      try {
        const ocrResult = await Tesseract.recognize(buffer, "spa+eng");
        const ocrText = ocrResult?.data?.text || "";
        if (ocrText.length > 20) return cleanExtractedText(ocrText);
      } catch {}
      return "";
    }

    return cleanExtractedText(buffer.toString("utf-8"));
  } catch (err: any) {
    console.error(`[DocumentParser] Failed to extract text from ${filename}:`, err);
    return "";
  }
}

/**
 * Normalizes and cleans up raw extracted text, rejecting raw binary PDF headers and image magic bytes
 */
function cleanExtractedText(raw: string): string {
  if (!raw) return "";

  // Reject raw binary PDF or Image data
  if (
    raw.startsWith("%PDF-") ||
    /^\s*%PDF/i.test(raw) ||
    raw.startsWith("\x89PNG") ||
    raw.startsWith("PNG") ||
    raw.startsWith("PNG") ||
    raw.startsWith("\xff\xd8\xff") ||
    raw.includes("JFIF") ||
    raw.includes("Exif")
  ) {
    return "";
  }

  return raw
    .replace(/\0/g, "") // remove null bytes
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ") // collapse multiple spaces/tabs
    .replace(/\n{3,}/g, "\n\n") // collapse multiple line breaks
    .trim();
}
