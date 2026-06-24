const SECTION_PATTERNS = [
  {
    id: "present-levels",
    key: "currentPerformance.detected",
    title: "Detected present levels",
    sourceSection: "Present Levels",
    terms: ["present levels", "current performance", "academic achievement", "functional performance"],
    confidence: 88
  },
  {
    id: "goal",
    key: "goalsAndObjectives.detected",
    title: "Detected annual goal",
    sourceSection: "Goals and Objectives",
    terms: ["goal", "annual goal", "objective", "criteria", "mastery"],
    confidence: 84
  },
  {
    id: "service",
    key: "services.detected",
    title: "Detected services and supports",
    sourceSection: "Services and Supplementary Aids",
    terms: ["service", "speech", "minutes", "frequency", "duration", "small group"],
    confidence: 82
  },
  {
    id: "accommodation",
    key: "accommodations.detected",
    title: "Detected accommodations",
    sourceSection: "Accommodations",
    terms: ["accommodation", "extended time", "written directions", "graphic organizer", "assessment"],
    confidence: 80
  },
  {
    id: "meeting",
    key: "meetingInformation.detected",
    title: "Detected meeting information",
    sourceSection: "Meeting Information",
    terms: ["meeting", "team", "parent", "guardian", "lea representative"],
    confidence: 76
  }
];

export function extractSections(sourceText, documentName, { sourceSegments = [] } = {}) {
  const normalized = String(sourceText || "").replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  const sections = SECTION_PATTERNS.map((pattern, index) => {
    const matched = pattern.terms.filter((term) => lower.includes(term));
    const firstMatch = matched[0];
    const content = matched.length
      ? extractSentenceWindow(normalized, firstMatch)
      : fallbackContent(pattern);
    const confidence = Math.max(55, Math.min(99, pattern.confidence + matched.length * 3 - (matched.length ? 0 : 18)));
    return {
      id: `extract-${Date.now()}-${index}-${pattern.id}`,
      key: pattern.key,
      title: pattern.title,
      sourceSection: pattern.sourceSection,
      sourceReference: sourceReferenceFor(documentName, firstMatch, sourceSegments),
      confidence,
      status: confidence >= 85 ? "Ready for review" : "Needs review",
      content,
      warning: warningFor(pattern.id, content)
    };
  });

  return sections.filter((section) => section.confidence >= 62 || lower.length < 200);
}

function extractSentenceWindow(text, term) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const index = sentences.findIndex((sentence) => sentence.toLowerCase().includes(term));
  if (index === -1) return text.slice(0, 280);
  return sentences.slice(Math.max(0, index - 1), index + 2).join(" ").slice(0, 480);
}

function fallbackContent(pattern) {
  return `No clear ${pattern.sourceSection.toLowerCase()} language was confidently detected. Human review should confirm whether this section is missing or present elsewhere in the source.`;
}

function sourceReferenceFor(documentName, term, sourceSegments) {
  const name = documentName || "source";
  if (!term) return `${name} · document-level review`;
  const lowerTerm = term.toLowerCase();
  const segment = sourceSegments.find((item) => String(item.text || "").toLowerCase().includes(lowerTerm));
  return segment ? `${name} · ${segment.label}` : `${name} · text match`;
}

function warningFor(kind, content) {
  if (kind === "accommodation" && /extended time/i.test(content) && !/\b(1\.5x|2x|percent|minutes|time and a half)\b/i.test(content)) {
    return "Extended-time language may lack amount or operational trigger. Do not infer a multiplier.";
  }
  if (kind === "service" && !/\b\d+\s*(min|minute|minutes|x\/week|times per week)\b/i.test(content)) {
    return "Service language may lack frequency, duration, or location.";
  }
  if (kind === "goal" && !/\b\d+[%]|\b\d+\s+consecutive|\baccuracy\b/i.test(content)) {
    return "Goal language may lack measurable criteria.";
  }
  return undefined;
}
