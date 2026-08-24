import { z } from "zod";
import type { Content } from "@/domain/models";

const taxonomy = {
  grammar: ["tense", "subject_verb_agreement", "article", "preposition", "word_order", "auxiliary_verb", "passive_voice", "singular_plural", "sentence_structure"],
  vocabulary: ["wrong_word", "word_form", "collocation", "repetition", "informal_usage", "technical_vocabulary"],
  coherence: ["missing_connector", "unclear_sequence", "unclear_reference", "incomplete_explanation", "off_topic"],
  technical_accuracy: ["incorrect_security_concept", "incorrect_ai_concept", "incorrect_sequence", "unsupported_claim", "missing_critical_detail"],
} as const;

export type WritingErrorCategory = keyof typeof taxonomy;
export type WritingErrorSubcategory = (typeof taxonomy)[WritingErrorCategory][number];
export type ErrorSeverity = "minor" | "moderate" | "major" | "critical";
export type ErrorPatternStatus = "needs_practice" | "improving" | "mastered" | "returned";

const categorySchema = z.enum(["grammar", "vocabulary", "coherence", "technical_accuracy"]);
const subcategorySchema = z.enum([...taxonomy.grammar, ...taxonomy.vocabulary, ...taxonomy.coherence, ...taxonomy.technical_accuracy]);
const severitySchema = z.enum(["minor", "moderate", "major", "critical"]);
const boundedText = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);

const taxonomyIssueSchema = z.object({
  category: categorySchema,
  subcategory: subcategorySchema,
  originalText: boundedText(1, 600),
  correctedText: boundedText(1, 600),
  explanation: boundedText(8, 500),
  severity: severitySchema,
  confidence: z.number().min(0).max(1),
  sourceEvidence: boundedText(1, 600).optional(),
}).strict().superRefine((issue, context) => {
  if (!taxonomy[issue.category].includes(issue.subcategory as never)) {
    context.addIssue({ code: "custom", path: ["subcategory"], message: "The subcategory is not valid for this category." });
  }
  if (issue.category === "technical_accuracy" && !issue.sourceEvidence) {
    context.addIssue({ code: "custom", path: ["sourceEvidence"], message: "Technical-accuracy feedback requires source evidence." });
  }
});

const vocabularySuggestionSchema = z.object({
  originalText: boundedText(1, 250),
  suggestion: boundedText(1, 250),
  explanation: boundedText(8, 400),
}).strict();

const technicalAccuracySchema = z.object({
  note: boundedText(8, 500),
  sourceEvidence: boundedText(1, 600),
}).strict();

const providerInitialFeedbackSchema = z.object({
  stage: z.literal("initial"),
  overallFeedback: boundedText(12, 700),
  priorityErrors: z.array(taxonomyIssueSchema).max(5),
  vocabularySuggestions: z.array(vocabularySuggestionSchema).max(3),
  technicalAccuracy: technicalAccuracySchema.nullable(),
  revisionFocus: z.array(boundedText(4, 240)).max(3),
}).strict();

const remainingErrorSchema = z.object({
  initialErrorId: boundedText(1, 120),
  explanation: boundedText(8, 500),
  recommendedAction: boundedText(4, 300),
}).strict();

const providerRevisionFeedbackSchema = z.object({
  stage: z.literal("revision"),
  improvements: z.array(boundedText(8, 400)).max(5),
  resolvedErrorIds: z.array(boundedText(1, 120)).max(5),
  remainingErrors: z.array(remainingErrorSchema).max(5),
  newErrors: z.array(taxonomyIssueSchema).max(5),
  improvedExample: boundedText(30, 1_600).nullable(),
  technicalAccuracy: technicalAccuracySchema.nullable().optional(),
}).strict();

export const writingInitialFeedbackSchema = providerInitialFeedbackSchema;
export const writingRevisionFeedbackSchema = providerRevisionFeedbackSchema;
export const writingAnalysisSourceMaximumCharacters = 12_000;
export const writingDraftMaximumCharacters = 12_000;
export const minimumUsableWritingWords = 12;
export const learnerFacingConfidenceMinimum = 0.65;
export const errorMemoryConfidenceMinimum = 0.85;

export type ProviderWritingIssue = z.infer<typeof taxonomyIssueSchema>;
export type VocabularySuggestion = z.infer<typeof vocabularySuggestionSchema>;

export interface WritingFeedbackIssue extends ProviderWritingIssue {
  readonly id: string;
  readonly patternKey: string;
  readonly memoryEligible: boolean;
}

export interface InitialWritingFeedback {
  readonly stage: "initial";
  readonly overallFeedback: string;
  readonly priorityErrors: readonly WritingFeedbackIssue[];
  readonly vocabularySuggestions: readonly VocabularySuggestion[];
  readonly technicalAccuracy: z.infer<typeof technicalAccuracySchema> | null;
  readonly revisionFocus: readonly string[];
}

export interface RevisionWritingFeedback {
  readonly stage: "revision";
  readonly improvements: readonly string[];
  readonly resolvedErrorIds: readonly string[];
  readonly remainingErrors: readonly z.infer<typeof remainingErrorSchema>[];
  readonly newErrors: readonly WritingFeedbackIssue[];
  readonly improvedExample: string | null;
  readonly technicalAccuracy: z.infer<typeof technicalAccuracySchema> | null;
}

export interface ErrorOccurrence {
  readonly id: string;
  readonly writingSessionId: string;
  readonly attemptNumber: 1 | 2;
  readonly category: WritingErrorCategory;
  readonly subcategory: WritingErrorSubcategory;
  readonly patternKey: string;
  readonly originalText: string;
  readonly correctedText: string;
  readonly explanation: string;
  readonly severity: ErrorSeverity;
  readonly confidence: number;
  readonly sourceEvidence?: string;
  readonly createdAt: string;
  readonly dismissed: boolean;
  readonly userConfirmed?: boolean;
  readonly correctedAt: string | null;
}

export interface PersonalErrorPattern {
  readonly patternKey: string;
  readonly category: WritingErrorCategory;
  readonly subcategory: WritingErrorSubcategory;
  readonly occurrenceCount: number;
  readonly successfulCorrections: number;
  readonly firstSeenAt: string;
  readonly lastSeenAt: string;
  readonly lastSeverity: ErrorSeverity;
  readonly status: ErrorPatternStatus;
  /** M4 review evidence; it deliberately carries no scheduling data. */
  readonly reviewStatus?: "mastered" | "needs_practice";
  readonly reviewStatusUpdatedAt?: string;
  readonly priority: number;
}

export interface CompactErrorPatternSummary {
  readonly patternKey: string;
  readonly status: ErrorPatternStatus;
  readonly occurrenceCount: number;
  readonly recentSeverity: ErrorSeverity;
}

export interface WritingAnalysisInput {
  readonly stage: "initial" | "revision";
  readonly writingSessionId: string;
  readonly content: Content;
  readonly task: string;
  readonly draft: string;
  readonly originalDraft?: string;
  readonly initialFeedback?: InitialWritingFeedback;
  readonly errorMemory: readonly CompactErrorPatternSummary[];
}

export interface GeneratedWritingFeedback {
  readonly feedback: InitialWritingFeedback | RevisionWritingFeedback;
  readonly model: string;
  readonly sourceTruncated: boolean;
}

const canonicalIssueSchema = taxonomyIssueSchema.extend({
  id: boundedText(1, 120),
  patternKey: boundedText(3, 160),
  memoryEligible: z.boolean(),
}).strict().superRefine((issue, context) => {
  if (issue.patternKey !== `${issue.category}.${issue.subcategory}`) {
    context.addIssue({ code: "custom", path: ["patternKey"], message: "The pattern key must be canonical." });
  }
});

export const storedInitialWritingFeedbackSchema = z.object({
  stage: z.literal("initial"),
  overallFeedback: boundedText(12, 700),
  priorityErrors: z.array(canonicalIssueSchema).max(5),
  vocabularySuggestions: z.array(vocabularySuggestionSchema).max(3),
  technicalAccuracy: technicalAccuracySchema.nullable(),
  revisionFocus: z.array(boundedText(4, 240)).max(3),
}).strict();

export const storedRevisionWritingFeedbackSchema = z.object({
  stage: z.literal("revision"),
  improvements: z.array(boundedText(8, 400)).max(5),
  resolvedErrorIds: z.array(boundedText(1, 120)).max(5),
  remainingErrors: z.array(remainingErrorSchema).max(5),
  newErrors: z.array(canonicalIssueSchema).max(5),
  improvedExample: boundedText(30, 1_600).nullable(),
  technicalAccuracy: technicalAccuracySchema.nullable(),
}).strict();

export interface WritingSession {
  readonly id: string;
  readonly lessonId: string;
  readonly contentId: string;
  readonly contentFingerprint: string;
  readonly task: string;
  readonly minWords: number;
  readonly maxWords: number;
  readonly firstDraft: string;
  readonly initialFeedback: InitialWritingFeedback | null;
  readonly revisedDraft: string | null;
  readonly revisionFeedback: RevisionWritingFeedback | null;
  readonly dismissedErrorIds?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const writingSessionSchema: z.ZodType<WritingSession> = z.object({
  id: boundedText(1, 120), lessonId: boundedText(1, 180), contentId: boundedText(1, 180), contentFingerprint: boundedText(1, 180),
  task: boundedText(20, 800), minWords: z.number().int().min(1).max(1_000), maxWords: z.number().int().min(1).max(1_000),
  firstDraft: boundedText(1, writingDraftMaximumCharacters), initialFeedback: storedInitialWritingFeedbackSchema.nullable(),
  revisedDraft: boundedText(1, writingDraftMaximumCharacters).nullable(), revisionFeedback: storedRevisionWritingFeedbackSchema.nullable(),
  dismissedErrorIds: z.array(boundedText(1, 120)).max(10).optional(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict().superRefine((session, context) => {
  if (session.minWords > session.maxWords) context.addIssue({ code: "custom", path: ["minWords"], message: "Minimum word count must not exceed maximum." });
  if ((session.revisedDraft === null) !== (session.revisionFeedback === null)) context.addIssue({ code: "custom", path: ["revisionFeedback"], message: "Revision draft and feedback must be stored together." });
});

export const errorOccurrenceSchema: z.ZodType<ErrorOccurrence> = z.object({
  id: boundedText(1, 120), writingSessionId: boundedText(1, 120), attemptNumber: z.union([z.literal(1), z.literal(2)]),
  category: categorySchema, subcategory: subcategorySchema, patternKey: boundedText(3, 160), originalText: boundedText(1, 600), correctedText: boundedText(1, 600), explanation: boundedText(8, 500), severity: severitySchema, confidence: z.number().min(0).max(1), sourceEvidence: boundedText(1, 600).optional(),
  createdAt: z.string().datetime(), dismissed: z.boolean(), userConfirmed: z.boolean().optional(), correctedAt: z.string().datetime().nullable(),
}).strict().superRefine((occurrence, context) => {
  if (!validSubcategory(occurrence.category, occurrence.subcategory)) context.addIssue({ code: "custom", path: ["subcategory"], message: "The subcategory is not valid for this category." });
  if (occurrence.patternKey !== `${occurrence.category}.${occurrence.subcategory}`) context.addIssue({ code: "custom", path: ["patternKey"], message: "The pattern key must be canonical." });
});

export const personalErrorPatternSchema: z.ZodType<PersonalErrorPattern> = z.object({
  patternKey: boundedText(3, 160), category: categorySchema, subcategory: subcategorySchema, occurrenceCount: z.number().int().min(1), successfulCorrections: z.number().int().min(0),
  firstSeenAt: z.string().datetime(), lastSeenAt: z.string().datetime(), lastSeverity: severitySchema, status: z.enum(["needs_practice", "improving", "mastered", "returned"]), reviewStatus: z.enum(["mastered", "needs_practice"]).optional(), reviewStatusUpdatedAt: z.string().datetime().optional(), priority: z.number().finite().min(0),
}).strict();

function normalized(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

/** Preserves word-level grounding while tolerating publisher quote and dash normalization. */
function normalizedGroundingText(value: string): string {
  return normalized(value).normalize("NFKD").toLocaleLowerCase("en-US").replace(/[’‘`]/gu, "'").replace(/[–—]/gu, "-").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/gu, " ").trim();
}

function zodFailure(message: string, path: PropertyKey[] = []) {
  return { success: false as const, error: new z.ZodError([{ code: "custom", path, message }]) };
}

function validSubcategory(category: WritingErrorCategory, subcategory: WritingErrorSubcategory): boolean {
  return taxonomy[category].includes(subcategory as never);
}

export function canonicalPatternKey(category: WritingErrorCategory, subcategory: WritingErrorSubcategory): string {
  if (!validSubcategory(category, subcategory)) throw new Error("The subcategory is not valid for this category.");
  return `${category}.${subcategory}`;
}

export function filterLearnerFacingErrors<T extends { readonly confidence: number }>(errors: readonly T[]): Array<T & { readonly memoryEligible: boolean }> {
  return errors.filter((issue) => issue.confidence >= learnerFacingConfidenceMinimum).map((issue) => ({ ...issue, memoryEligible: issue.confidence >= errorMemoryConfidenceMinimum }));
}

function issueIsGrounded(issue: ProviderWritingIssue, draft: string, source: string): boolean {
  if (!normalized(draft).includes(normalized(issue.originalText))) return false;
  return !issue.sourceEvidence || normalizedGroundingText(source).includes(normalizedGroundingText(issue.sourceEvidence));
}

function technicalNoteIsGrounded(note: z.infer<typeof technicalAccuracySchema> | null, source: string): boolean {
  return !note || normalizedGroundingText(source).includes(normalizedGroundingText(note.sourceEvidence));
}

export function validateInitialWritingFeedback(value: unknown, input: { readonly draft: string; readonly source: string; readonly issueId: () => string }) {
  const parsed = providerInitialFeedbackSchema.safeParse(value);
  if (!parsed.success) return parsed;
  if (!technicalNoteIsGrounded(parsed.data.technicalAccuracy, input.source)) return { ...zodFailure("Technical-accuracy evidence must come from the supplied source.", ["technicalAccuracy", "sourceEvidence"]), validationStage: "grounding" as const };
  const ungrounded = parsed.data.priorityErrors.findIndex((issue) => !issueIsGrounded(issue, input.draft, input.source));
  if (ungrounded >= 0) {
    const issue = parsed.data.priorityErrors[ungrounded];
    const path = issue.sourceEvidence ? ["priorityErrors", ungrounded, "sourceEvidence"] : ["priorityErrors", ungrounded, "originalText"];
    return { ...zodFailure("Writing feedback must reference the learner draft and supplied source only.", path), validationStage: issue.sourceEvidence ? "grounding" as const : "semantic" as const };
  }
  const priorityErrors = filterLearnerFacingErrors(parsed.data.priorityErrors).map((issue) => ({ ...issue, id: input.issueId(), patternKey: canonicalPatternKey(issue.category, issue.subcategory) }));
  return { success: true as const, data: { ...parsed.data, priorityErrors } satisfies InitialWritingFeedback };
}

export function validateRevisionWritingFeedback(value: unknown, input: { readonly draft: string; readonly source: string; readonly initialFeedback: InitialWritingFeedback; readonly issueId: () => string }) {
  const parsed = providerRevisionFeedbackSchema.safeParse(value);
  if (!parsed.success) return parsed;
  const initialIds = new Set(input.initialFeedback.priorityErrors.map((issue) => issue.id));
  const referencesInitial = [...parsed.data.resolvedErrorIds, ...parsed.data.remainingErrors.map((issue) => issue.initialErrorId)];
  if (referencesInitial.some((id) => !initialIds.has(id))) return { ...zodFailure("Revision feedback must reference validated initial feedback IDs."), validationStage: "semantic" as const };
  if (new Set(referencesInitial).size !== referencesInitial.length) return { ...zodFailure("Each initial error must be either resolved or remaining, not both."), validationStage: "semantic" as const };
  if (!technicalNoteIsGrounded(parsed.data.technicalAccuracy ?? null, input.source)) return { ...zodFailure("Technical-accuracy evidence must come from the supplied source.", ["technicalAccuracy", "sourceEvidence"]), validationStage: "grounding" as const };
  const ungrounded = parsed.data.newErrors.findIndex((issue) => !issueIsGrounded(issue, input.draft, input.source));
  if (ungrounded >= 0) {
    const issue = parsed.data.newErrors[ungrounded];
    return { ...zodFailure("Writing feedback must reference the learner draft and supplied source only.", ["newErrors", ungrounded, issue.sourceEvidence ? "sourceEvidence" : "originalText"]), validationStage: issue.sourceEvidence ? "grounding" as const : "semantic" as const };
  }
  const newErrors = filterLearnerFacingErrors(parsed.data.newErrors).map((issue) => ({ ...issue, id: input.issueId(), patternKey: canonicalPatternKey(issue.category, issue.subcategory) }));
  return { success: true as const, data: { ...parsed.data, newErrors, technicalAccuracy: parsed.data.technicalAccuracy ?? null } satisfies RevisionWritingFeedback };
}

function severityWeight(severity: ErrorSeverity): number {
  return { minor: 1, moderate: 2, major: 3, critical: 4 }[severity];
}

function statusFor(occurrences: readonly ErrorOccurrence[], previous: PersonalErrorPattern | undefined): ErrorPatternStatus {
  if (previous?.reviewStatus === "mastered" && occurrences.some((occurrence) => occurrence.createdAt > (previous.reviewStatusUpdatedAt ?? ""))) return "returned";
  if (previous?.reviewStatus === "mastered") return "mastered";
  if (previous?.reviewStatus === "needs_practice") return "needs_practice";
  if (previous?.status === "mastered" && occurrences.some((occurrence) => !occurrence.correctedAt)) return "returned";
  if (previous?.status === "mastered") return "mastered";
  const successfulSessions = new Set(occurrences.filter((occurrence) => occurrence.correctedAt).map((occurrence) => occurrence.writingSessionId));
  if (successfulSessions.size >= 2 && successfulSessions.size >= 3) return "mastered";
  if (successfulSessions.size > 0) return "improving";
  return "needs_practice";
}

function priorityFor(occurrences: readonly ErrorOccurrence[], status: ErrorPatternStatus, now: string): number {
  const newest = occurrences.reduce((latest, occurrence) => latest > occurrence.createdAt ? latest : occurrence.createdAt, occurrences[0].createdAt);
  const daysSinceSeen = Math.max(0, (Date.parse(now) - Date.parse(newest)) / 86_400_000);
  const recency = daysSinceSeen <= 7 ? 5 : daysSinceSeen <= 30 ? 2 : 0;
  const unresolved = occurrences.filter((occurrence) => !occurrence.correctedAt).length;
  const severity = Math.max(...occurrences.map((occurrence) => severityWeight(occurrence.severity)));
  return occurrences.length * 10 + unresolved * 6 + severity * 4 + recency + (status === "returned" ? 10 : 0);
}

export function rebuildErrorPatterns(occurrences: readonly ErrorOccurrence[], previousPatterns: readonly PersonalErrorPattern[], now: string): PersonalErrorPattern[] {
  const previousByKey = new Map(previousPatterns.map((pattern) => [pattern.patternKey, pattern]));
  const eligible = occurrences.filter((occurrence) => !occurrence.dismissed && occurrence.confidence >= errorMemoryConfidenceMinimum);
  const groups = new Map<string, ErrorOccurrence[]>();
  for (const occurrence of eligible) groups.set(occurrence.patternKey, [...(groups.get(occurrence.patternKey) ?? []), occurrence]);
  return [...groups.entries()].map(([patternKey, grouped]) => {
    const ordered = [...grouped].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const last = ordered.at(-1)!;
    const status = statusFor(ordered, previousByKey.get(patternKey));
    return {
      patternKey, category: last.category, subcategory: last.subcategory, occurrenceCount: ordered.length,
      successfulCorrections: new Set(ordered.filter((occurrence) => occurrence.correctedAt).map((occurrence) => occurrence.writingSessionId)).size,
      firstSeenAt: ordered[0].createdAt, lastSeenAt: last.createdAt, lastSeverity: last.severity, status,
      reviewStatus: previousByKey.get(patternKey)?.reviewStatus,
      reviewStatusUpdatedAt: previousByKey.get(patternKey)?.reviewStatusUpdatedAt,
      priority: priorityFor(ordered, status, now),
    };
  }).sort((left, right) => right.priority - left.priority || right.lastSeenAt.localeCompare(left.lastSeenAt) || left.patternKey.localeCompare(right.patternKey));
}

export function compactErrorMemory(patterns: readonly PersonalErrorPattern[], maximum = 8): CompactErrorPatternSummary[] {
  return patterns.slice(0, maximum).map(({ patternKey, status, occurrenceCount, lastSeverity }) => ({ patternKey, status, occurrenceCount, recentSeverity: lastSeverity }));
}

export function wordCountForWriting(draft: string): number {
  return normalized(draft).split(/\s+/u).filter(Boolean).length;
}

export function writingDraftProblem(draft: string): string | null {
  if (!normalized(draft)) return "Write a response before requesting feedback.";
  if (wordCountForWriting(draft) < minimumUsableWritingWords) return "Write a longer response before requesting feedback so the feedback can be useful.";
  if (draft.length > writingDraftMaximumCharacters) return "This draft is too long to analyze safely.";
  return null;
}
