export const contentCategories = [
  { id: "cybersecurity_news", name: "Cybersecurity News", learningPurpose: "Current security reporting and technical vocabulary in context." },
  { id: "artificial_intelligence", name: "Artificial Intelligence", learningPurpose: "AI research, security, regulation, and opinion-ready discussions." },
  { id: "active_directory_internal_pentesting", name: "Active Directory / Internal Pentesting", learningPurpose: "Technical explanations and active security collocations." },
  { id: "htb_tryhackme", name: "HTB & TryHackMe", learningPurpose: "Allowed walkthroughs and practical security narratives." },
  { id: "dfir_incident_reports", name: "DFIR / Incident Reports", learningPurpose: "Incident language, evidence reasoning, and concise summaries." },
  { id: "podcasts_transcripts", name: "Podcasts / Transcripts", learningPurpose: "Future listening, replay, shadowing, and transcript practice." },
  { id: "general_ielts", name: "General IELTS", learningPurpose: "Broader reading and discussion material for IELTS progression." },
  { id: "my_content", name: "My Content", learningPurpose: "URLs, text, and study material supplied directly by the learner." },
] as const;

export type ContentCategory = (typeof contentCategories)[number];
export type ContentCategoryId = ContentCategory["id"];
export type ContentProcessingRequest =
  | { kind: "discovered"; contentId: string }
  | { kind: "lesson_requested"; contentId: string; requestedBy: string };
export type ContentProcessingMode = "metadata_only" | "lesson_generation";

export function resolveProcessingMode(request: ContentProcessingRequest): ContentProcessingMode {
  return request.kind === "lesson_requested" ? "lesson_generation" : "metadata_only";
}

export type LearningSupportLevel = "original" | "simplified_english" | "turkish_support";
export type ConfigurableContentMix = Readonly<Record<ContentCategoryId, number>>;
