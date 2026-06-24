const DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const DOCX_RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

export function createExportArtifact({ id, label, format = "json", payload = null, createdAt = new Date().toISOString() }) {
  const normalizedFormat = String(format || "json").toLowerCase();
  if (normalizedFormat === "pdf") {
    const paragraphs = exportParagraphs(label, payload, createdAt);
    return {
      format: "pdf",
      fileName: `${slug(label)}-${id}.pdf`,
      mimeType: "application/pdf",
      buffer: createPdf(paragraphs),
      summary: summarizePayload(payload)
    };
  }

  if (normalizedFormat === "docx") {
    const paragraphs = exportParagraphs(label, payload, createdAt);
    return {
      format: "docx",
      fileName: `${slug(label)}-${id}.docx`,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: createDocx(paragraphs),
      summary: summarizePayload(payload)
    };
  }

  const json = JSON.stringify(
    {
      label,
      createdAt,
      payload
    },
    null,
    2
  );
  return {
    format: "json",
    fileName: `${slug(label)}-${id}.json`,
    mimeType: "application/json; charset=utf-8",
    buffer: Buffer.from(`${json}\n`, "utf8"),
    summary: summarizePayload(payload)
  };
}

function exportParagraphs(label, payload, createdAt) {
  const paragraphs = [
    { text: label, style: "title" },
    { text: `Generated ${new Date(createdAt).toLocaleString("en-US")}`, style: "meta" },
    { text: "Generated export from the local IEP Implementation Workspace. Review before official use.", style: "meta" },
    ...payloadParagraphs(payload)
  ];
  return paragraphs.filter((paragraph) => paragraph.text !== "");
}

function payloadParagraphs(value, prefix = "") {
  if (value == null) return [{ text: `${prefix || "Value"}: Not provided` }];
  if (typeof value !== "object") return [{ text: `${prefix ? `${prefix}: ` : ""}${String(value)}` }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => payloadParagraphs(item, `${prefix || "Item"} ${index + 1}`));
  }

  if (Array.isArray(value.sections)) {
    return value.sections.flatMap((section) => [
      { text: section.heading || "Section", style: "heading" },
      ...(section.text ? [{ text: section.text }] : []),
      ...(section.content ? [{ text: section.content }] : []),
      ...(section.bullets || []).map((bullet) => ({ text: bullet, style: "bullet" }))
    ]);
  }

  if (Array.isArray(value.agenda) || Array.isArray(value.familyQuestions)) {
    return [
      { text: `${value.type || prefix || "Meeting"} ${value.date || ""}`, style: "heading" },
      ...(value.agenda || []).map((item) => ({ text: item, style: "bullet" })),
      ...(value.familyQuestions || []).flatMap((question) => [
        { text: question.text, style: "bullet" },
        ...(question.response ? [{ text: `Response: ${question.response}` }] : [])
      ]),
      ...(value.studentVoice ? [{ text: `Student voice: ${value.studentVoice}` }] : [])
    ];
  }

  const title = value.title || value.label || value.domain || value.serviceType || value.issue || prefix;
  const paragraphs = title ? [{ text: title, style: "heading" }] : [];
  for (const [key, item] of Object.entries(value)) {
    if (["id", "payload", "sourceText", "sourceSegments", "originalFile"].includes(key)) continue;
    if (item == null || item === "") continue;
    if (typeof item === "object") {
      paragraphs.push(...payloadParagraphs(item, humanize(key)));
    } else {
      paragraphs.push({ text: `${humanize(key)}: ${String(item)}` });
    }
  }
  return paragraphs;
}

function createDocx(paragraphs) {
  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs.map(paragraphXml).join("\n")}
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720"/></w:sectPr>
  </w:body>
</w:document>`;

  return createStoredZip({
    "[Content_Types].xml": DOCX_CONTENT_TYPES,
    "_rels/.rels": DOCX_RELS,
    "word/document.xml": documentXml
  });
}

function createPdf(paragraphs) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 54;
  const bottomMargin = 66;
  const usableWidth = pageWidth - margin * 2;
  const pages = [[]];
  let y = pageHeight - margin;

  const addLine = (line) => {
    if (y - line.leading < bottomMargin) {
      pages.push([]);
      y = pageHeight - margin;
    }
    pages[pages.length - 1].push({ ...line, y });
    y -= line.leading;
  };

  for (const paragraph of paragraphs) {
    const style = pdfStyle(paragraph.style);
    const text = paragraph.style === "bullet" ? `- ${paragraph.text}` : paragraph.text;
    const indent = paragraph.style === "bullet" ? 14 : 0;
    const wrapped = wrapPdfText(text, usableWidth - indent, style.fontSize);
    if (paragraph.style === "heading" || paragraph.style === "title") y -= 4;
    wrapped.forEach((lineText) =>
      addLine({
        text: lineText,
        x: margin + indent,
        font: style.font,
        fontSize: style.fontSize,
        leading: style.leading
      })
    );
    if (paragraph.style === "title" || paragraph.style === "heading") y -= 6;
  }

  return writePdf({ pages, pageWidth, pageHeight, margin });
}

function pdfStyle(style) {
  if (style === "title") return { font: "F2", fontSize: 20, leading: 27 };
  if (style === "heading") return { font: "F2", fontSize: 14, leading: 20 };
  if (style === "meta") return { font: "F1", fontSize: 9, leading: 13 };
  return { font: "F1", fontSize: 11, leading: 15 };
}

function wrapPdfText(value, width, fontSize) {
  const normalized = normalizePdfText(value);
  const maxChars = Math.max(18, Math.floor(width / (fontSize * 0.52)));
  const words = normalized.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words.length ? words : [""]) {
    if (word.length > maxChars) {
      if (current) {
        lines.push(current);
        current = "";
      }
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars));
      }
      continue;
    }
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function writePdf({ pages, pageWidth, pageHeight, margin }) {
  const pageCount = pages.length;
  const pageObjectStart = 5;
  const contentObjectStart = pageObjectStart + pageCount;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pages
      .map((_, index) => `${pageObjectStart + index} 0 R`)
      .join(" ")}] /Count ${pageCount} >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  ];

  pages.forEach((_, index) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectStart + index} 0 R >>`
    );
  });

  pages.forEach((lines, index) => {
    const content = pdfPageContent(lines, {
      pageNumber: index + 1,
      pageCount,
      pageWidth,
      margin
    });
    objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
  });

  let output = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(output, "utf8"));
    output += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(output, "utf8");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(output, "utf8");
}

function pdfPageContent(lines, { pageNumber, pageCount, pageWidth, margin }) {
  const commands = lines.map(
    (line) => `BT /${line.font} ${line.fontSize} Tf ${line.x} ${line.y} Td (${escapePdfString(line.text)}) Tj ET`
  );
  commands.push(
    `BT /F1 8 Tf ${margin} 36 Td (${escapePdfString("IEP Implementation Workspace export - review before official use")}) Tj ET`
  );
  commands.push(
    `BT /F1 8 Tf ${pageWidth - margin - 70} 36 Td (${escapePdfString(`Page ${pageNumber} of ${pageCount}`)}) Tj ET`
  );
  return `${commands.join("\n")}\n`;
}

function paragraphXml(paragraph) {
  const escaped = escapeXml(paragraph.text);
  if (paragraph.style === "title") {
    return `<w:p><w:r><w:rPr><w:b/><w:sz w:val="34"/></w:rPr><w:t>${escaped}</w:t></w:r></w:p>`;
  }
  if (paragraph.style === "heading") {
    return `<w:p><w:r><w:rPr><w:b/><w:sz w:val="26"/></w:rPr><w:t>${escaped}</w:t></w:r></w:p>`;
  }
  if (paragraph.style === "bullet") {
    return `<w:p><w:r><w:t>${escapeXml(`• ${paragraph.text}`)}</w:t></w:r></w:p>`;
  }
  if (paragraph.style === "meta") {
    return `<w:p><w:r><w:rPr><w:i/><w:color w:val="64748B"/></w:rPr><w:t>${escaped}</w:t></w:r></w:p>`;
  }
  return `<w:p><w:r><w:t>${escaped}</w:t></w:r></w:p>`;
}

function createStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const entryList = Object.entries(entries);

  for (const [name, content] of entryList) {
    const nameBuffer = Buffer.from(name);
    const dataBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(dataBuffer.length, 18);
    localHeader.writeUInt32LE(dataBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, nameBuffer, dataBuffer);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(0, 12);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(dataBuffer.length, 20);
    centralHeader.writeUInt32LE(dataBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + dataBuffer.length;
  }

  const localFiles = Buffer.concat(localParts);
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entryList.length, 8);
  end.writeUInt16LE(entryList.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localFiles.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localFiles, centralDirectory, end]);
}

function summarizePayload(payload) {
  if (Array.isArray(payload)) return { kind: "array", count: payload.length };
  if (payload && typeof payload === "object") return { kind: "object", keys: Object.keys(payload).slice(0, 12) };
  return { kind: typeof payload };
}

function humanize(value) {
  return String(value)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function slug(value) {
  return String(value || "export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapePdfString(value) {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function normalizePdfText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
