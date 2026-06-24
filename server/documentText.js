import { inflateRawSync, inflateSync } from "node:zlib";

const TEXT_DECODER = new TextDecoder("utf-8", { fatal: false });
const MAX_SEGMENT_LENGTH = 1200;

export function extractDocumentText({ name = "Uploaded_IEP_Source.txt", mimeType = "", sourceText = "", fileBase64 = "" } = {}) {
  if (!fileBase64) {
    const text = String(sourceText || "");
    return {
      documentType: documentTypeFromName(name, mimeType) || "Text",
      sourceText: text,
      extractionMethod: "pasted-text",
      sourceSegments: segmentPlainText(text),
      parseWarnings: []
    };
  }

  const fileBuffer = Buffer.from(fileBase64, "base64");
  const detectedType = documentTypeFromName(name, mimeType, fileBuffer);

  if (detectedType === "DOCX") {
    const result = extractDocxText(fileBuffer);
    return {
      ...result,
      documentType: "DOCX",
      fileBuffer
    };
  }

  if (detectedType === "PDF") {
    const result = extractPdfText(fileBuffer);
    return {
      ...result,
      documentType: "PDF",
      fileBuffer
    };
  }

  const text = TEXT_DECODER.decode(fileBuffer);
  return {
    documentType: "Text",
    sourceText: text,
    extractionMethod: "plain-text-file",
    sourceSegments: segmentPlainText(text),
    parseWarnings: [],
    fileBuffer
  };
}

function extractDocxText(buffer) {
  const entries = readZipEntries(buffer);
  const documentXml = entries.get("word/document.xml");
  if (!documentXml) {
    return {
      sourceText: "",
      extractionMethod: "docx-word-xml",
      sourceSegments: [],
      parseWarnings: ["DOCX file did not contain word/document.xml."]
    };
  }

  const xml = TEXT_DECODER.decode(documentXml);
  const paragraphXml = xml.match(/<w:p[\s\S]*?<\/w:p>/g) || [];
  const paragraphs = paragraphXml
    .map(extractParagraphText)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const sourceText = paragraphs.join("\n\n");

  return {
    sourceText,
    extractionMethod: "docx-word-xml",
    sourceSegments: paragraphs.map((text, index) => ({
      label: `paragraph ${index + 1}`,
      text: limitSegment(text)
    })),
    parseWarnings: paragraphs.length ? [] : ["No readable paragraph text was found in the DOCX document body."]
  };
}

function extractPdfText(buffer) {
  const pageSegments = extractPdfPageSegments(buffer);
  const warnings = ["PDF text extraction uses embedded text streams only; scanned PDFs still require OCR."];
  const sourceSegments = pageSegments.length ? pageSegments : extractPdfDocumentSegment(buffer);
  const sourceText = sourceSegments.map((segment) => segment.text).join("\n\n").replace(/\s+/g, " ").trim();
  if (!sourceText) warnings.push("No embedded text was detected in this PDF.");

  return {
    sourceText,
    extractionMethod: "pdf-embedded-text",
    sourceSegments: sourceText ? sourceSegments : [],
    parseWarnings: warnings
  };
}

function extractPdfPageSegments(buffer) {
  const objects = parsePdfObjects(buffer);
  const pages = [...objects.entries()]
    .filter(([, object]) => /\/Type\s*\/Page(?!s)\b/.test(object.body))
    .map(([objectNumber, object]) => ({ objectNumber, contentRefs: extractPageContentRefs(object.body) }))
    .filter((page) => page.contentRefs.length);

  return pages
    .map((page, index) => {
      const text = page.contentRefs
        .flatMap((ref) => extractPdfObjectStreams(objects.get(ref)))
        .flatMap(extractPdfTextPieces)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (!text) return null;
      return {
        label: `page ${index + 1}`,
        text: limitSegment(text),
        pageNumber: index + 1,
        anchorType: "pdf-page",
        locator: {
          page: index + 1,
          precision: "page"
        }
      };
    })
    .filter(Boolean);
}

function parsePdfObjects(buffer) {
  const raw = buffer.toString("latin1");
  const objects = new Map();
  const objectPattern = /(\d+)\s+\d+\s+obj\b/g;
  let match;
  while ((match = objectPattern.exec(raw))) {
    const objectNumber = Number(match[1]);
    const bodyStart = objectPattern.lastIndex;
    const bodyEnd = raw.indexOf("endobj", bodyStart);
    if (bodyEnd === -1) break;
    objects.set(objectNumber, { body: raw.slice(bodyStart, bodyEnd) });
    objectPattern.lastIndex = bodyEnd + "endobj".length;
  }
  return objects;
}

function extractPageContentRefs(pageBody) {
  const contents = pageBody.match(/\/Contents\s+\[([\s\S]*?)\]/);
  if (contents) {
    return [...contents[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((match) => Number(match[1]));
  }
  const single = pageBody.match(/\/Contents\s+(\d+)\s+\d+\s+R/);
  return single ? [Number(single[1])] : [];
}

function extractPdfObjectStreams(object) {
  if (!object?.body) return [];
  const streams = [];
  for (const match of object.body.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    streams.push(decodePdfStream(match[1], object.body));
  }
  return streams;
}

function decodePdfStream(stream, objectBody) {
  const buffer = Buffer.from(stream, "latin1");
  if (/\/FlateDecode\b/.test(objectBody)) {
    try {
      return inflateSync(buffer).toString("latin1");
    } catch {
      try {
        return inflateRawSync(buffer).toString("latin1");
      } catch {
        return "";
      }
    }
  }
  return stream;
}

function extractPdfDocumentSegment(buffer) {
  const text = extractPdfTextPieces(buffer.toString("latin1")).join(" ").replace(/\s+/g, " ").trim();
  return text
    ? [
        {
          label: "embedded text",
          text: limitSegment(text),
          anchorType: "pdf-document",
          locator: {
            precision: "document"
          }
        }
      ]
    : [];
}

function extractPdfTextPieces(value) {
  const pieces = [];

  for (const match of value.matchAll(/\((?:\\.|[^\\)])*\)\s*Tj/g)) {
    pieces.push(decodePdfLiteral(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  }

  for (const match of value.matchAll(/\[((?:\s*\((?:\\.|[^\\)])*\)\s*-?\d*)+)\]\s*TJ/g)) {
    for (const part of match[1].matchAll(/\((?:\\.|[^\\)])*\)/g)) {
      pieces.push(decodePdfLiteral(part[0].slice(1, -1)));
    }
  }

  for (const match of value.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    pieces.push(decodePdfHexString(match[1]));
  }

  return pieces.map((piece) => piece.replace(/\s+/g, " ").trim()).filter(Boolean);
}

function readZipEntries(buffer) {
  const entries = new Map();
  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset === -1) return entries;

  const centralDirectorySize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end && buffer.readUInt32LE(offset) === 0x02014b50) {
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer.toString("utf8", offset + 46, offset + 46 + fileNameLength);
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    if (compressionMethod === 0) {
      entries.set(fileName, compressed.subarray(0, uncompressedSize));
    } else if (compressionMethod === 8) {
      entries.set(fileName, inflateRawSync(compressed));
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function findEndOfCentralDirectory(buffer) {
  for (let index = buffer.length - 22; index >= 0; index -= 1) {
    if (buffer.readUInt32LE(index) === 0x06054b50) return index;
  }
  return -1;
}

function extractParagraphText(paragraphXml) {
  const textRuns = [];
  for (const match of paragraphXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) {
    textRuns.push(decodeXml(match[1]));
  }
  for (const match of paragraphXml.matchAll(/<w:tab\s*\/>/g)) {
    if (match) textRuns.push(" ");
  }
  return textRuns.join("");
}

function segmentPlainText(text) {
  const paragraphs = String(text || "")
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z])/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!paragraphs.length && text) return [{ label: "text body", text: limitSegment(text) }];
  return paragraphs.map((paragraph, index) => ({
    label: `text segment ${index + 1}`,
    text: limitSegment(paragraph)
  }));
}

function documentTypeFromName(name, mimeType, buffer) {
  const lower = `${name || ""} ${mimeType || ""}`.toLowerCase();
  if (lower.includes(".docx") || lower.includes("wordprocessingml")) return "DOCX";
  if (lower.includes(".pdf") || lower.includes("application/pdf") || buffer?.subarray(0, 4).toString() === "%PDF") return "PDF";
  if (lower.includes(".txt") || lower.includes("text/plain")) return "Text";
  return null;
}

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function decodePdfLiteral(value) {
  return String(value)
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function decodePdfHexString(value) {
  const hex = String(value || "").replace(/\s+/g, "");
  if (!hex) return "";
  const evenHex = hex.length % 2 === 0 ? hex : `${hex}0`;
  try {
    return Buffer.from(evenHex, "hex").toString("utf8").replace(/\0/g, "");
  } catch {
    return "";
  }
}

function limitSegment(text) {
  return String(text || "").slice(0, MAX_SEGMENT_LENGTH);
}
