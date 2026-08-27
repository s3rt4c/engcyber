import { z } from "zod";
import { writingTaxonomy } from "@/domain/writing";

export const ieltsReadingSourceMaximumCharacters = 12_000;
export const ieltsReadingMinimumWords = 400;
export const ieltsReadingQuestionCount = 6;
export const ieltsRelevantSourceContextMaximumCharacters = 300;
export const ieltsReadingSchemaVersion = "m11-ielts-reading-v1";
export const ieltsWritingSchemaVersion = "m11-ielts-writing-v1";
export const ieltsDraftMaximumCharacters = 12_000;
export const ieltsTask2MinimumWords = 250;
export const ieltsReadingPromptVersion = "m11-ielts-reading-prompt-v1";
export const ieltsWritingPromptVersion = "m11-ielts-writing-prompt-v1";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const sourceContext = text(1, ieltsRelevantSourceContextMaximumCharacters);
const optionSchema = z.object({ id: text(1, 40), text: text(1, 320) }).strict();
const multipleChoiceSchema = z.object({ id: text(1, 80), type: z.literal("multiple_choice"), question: text(8, 600), options: z.array(optionSchema).length(4), correctOptionId: text(1, 40), relevantSourceContext: sourceContext, explanation: text(8, 500) }).strict().superRefine((value, ctx) => {
  if (new Set(value.options.map((option) => option.id)).size !== 4) ctx.addIssue({ code: "custom", path: ["options"], message: "Multiple-choice option IDs must be unique." });
  if (!value.options.some((option) => option.id === value.correctOptionId)) ctx.addIssue({ code: "custom", path: ["correctOptionId"], message: "The correct option must exist." });
});
const tfngSchema = z.object({ id: text(1, 80), type: z.literal("true_false_not_given"), question: text(8, 600), answer: z.enum(["true", "false", "not_given"]), relevantSourceContext: sourceContext, explanation: text(8, 500) }).strict();
export const ieltsReadingQuestionSchema = z.discriminatedUnion("type", [multipleChoiceSchema, tfngSchema]);
export type IeltsReadingQuestion = z.infer<typeof ieltsReadingQuestionSchema>;
export const ieltsReadingDraftSchema = z.object({ questions: z.array(ieltsReadingQuestionSchema).length(ieltsReadingQuestionCount) }).strict().superRefine((value, ctx) => {
  if (value.questions.filter((question) => question.type === "multiple_choice").length !== 3 || value.questions.filter((question) => question.type === "true_false_not_given").length !== 3) ctx.addIssue({ code: "custom", path: ["questions"], message: "A reading practice requires three multiple-choice and three True / False / Not Given questions." });
  if (new Set(value.questions.map((question) => question.id)).size !== value.questions.length) ctx.addIssue({ code: "custom", path: ["questions"], message: "Question IDs must be unique." });
});
export type IeltsReadingDraft = z.infer<typeof ieltsReadingDraftSchema>;

function normalize(value: string) { return value.replace(/\s+/gu, " ").trim(); }
export function wordCountForIelts(value: string) { return normalize(value).split(/\s+/u).filter(Boolean).length; }
export function ieltsReadingSourceProblem(source: string): string | null {
  if (source.length > ieltsReadingSourceMaximumCharacters) return "This source exceeds the accepted 12,000-character practice bound.";
  if (wordCountForIelts(source) < ieltsReadingMinimumWords) return "Choose a longer source with at least 400 words for IELTS-style Reading practice.";
  return null;
}
export function validateIeltsReadingDraft(value: unknown, source: string) {
  const parsed = ieltsReadingDraftSchema.safeParse(value);
  if (!parsed.success) return parsed;
  const missing = parsed.data.questions.findIndex((question) => !normalize(source).includes(normalize(question.relevantSourceContext)));
  return missing < 0 ? parsed : { success: false as const, error: new z.ZodError([{ code: "custom", path: ["questions", missing, "relevantSourceContext"], message: "Relevant source context must be an exact substring of the supplied source." }]) };
}
export function gradeIeltsReadingPractice(questions: readonly IeltsReadingQuestion[], answers: Readonly<Record<string, string>>) {
  const correct = questions.filter((question) => answers[question.id] === (question.type === "multiple_choice" ? question.correctOptionId : question.answer)).length;
  return { correct, total: questions.length };
}

export const ieltsReadingPracticeSchema = z.object({
  id: text(1, 120), generationFingerprint: text(1, 200), sourceId: text(1, 240), sourceFingerprint: text(1, 200), sourceTitle: text(1, 500), sourceUrl: z.string().url().nullable(), questions: z.array(ieltsReadingQuestionSchema).length(6), answers: z.record(z.string(), z.string()), completedAt: z.string().datetime().nullable(), elapsedSeconds: z.number().int().min(0).max(86_400).nullable(), createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
}).strict();
export type IeltsReadingPractice = z.infer<typeof ieltsReadingPracticeSchema>;

export interface IeltsReadingGenerationInput {
  readonly sourceId: string;
  readonly sourceFingerprint: string;
  readonly sourceTitle: string;
  readonly sourceUrl: string | null;
  readonly sourceText: string;
}

export interface GeneratedIeltsReadingPractice {
  readonly questions: readonly IeltsReadingQuestion[];
  readonly model: string;
}

export interface IeltsWritingAnalysisInput {
  readonly stage: "initial" | "revision";
  readonly sessionId: string;
  readonly prompt: IeltsTask2Prompt;
  readonly draft: string;
  readonly initialFeedback?: IeltsInitialWritingFeedback;
  readonly errorMemory: readonly { readonly patternKey: string; readonly status: string; readonly occurrenceCount: number; readonly recentSeverity: string }[];
}

export interface GeneratedIeltsWritingFeedback {
  readonly feedback: IeltsInitialWritingFeedback | IeltsRevisionWritingFeedback;
  readonly model: string;
}

export function ieltsReadingGenerationFingerprint(input: { readonly sourceFingerprint: string; readonly provider: string; readonly model: string; readonly learnerProfileVersion?: string }) {
  return ["ielts-reading", ieltsReadingSchemaVersion, ieltsReadingPromptVersion, input.sourceFingerprint, input.provider, input.model, input.learnerProfileVersion ?? "default"].join(":");
}

export const ieltsTask2Types = ["opinion", "discuss_both_views", "advantages_disadvantages", "problem_solution"] as const;
export type IeltsTask2Type = typeof ieltsTask2Types[number];
export interface IeltsTask2Prompt { readonly id: string; readonly type: IeltsTask2Type; readonly category: "technology" | "education" | "work" | "environment" | "society"; readonly task: string; }
export const ieltsTask2PromptBank: readonly IeltsTask2Prompt[] = [
  { id: "technology-opinion", type: "opinion", category: "technology", task: "Some people believe schools should teach digital-security habits as a core subject. To what extent do you agree or disagree?" },
  { id: "education-opinion", type: "opinion", category: "education", task: "Some people think university education should be free for everyone. To what extent do you agree or disagree?" },
  { id: "work-opinion", type: "opinion", category: "work", task: "Some people believe remote work improves employees' lives. To what extent do you agree or disagree?" },
  { id: "society-discuss", type: "discuss_both_views", category: "society", task: "Some people think governments should spend more on public transport, while others prefer investment in roads. Discuss both views and give your opinion." },
  { id: "education-discuss", type: "discuss_both_views", category: "education", task: "Some people think children should learn mainly through technology, while others prefer traditional classroom methods. Discuss both views and give your opinion." },
  { id: "work-discuss", type: "discuss_both_views", category: "work", task: "Some people think employers should focus on practical skills rather than qualifications. Discuss both views and give your opinion." },
  { id: "technology-advantages", type: "advantages_disadvantages", category: "technology", task: "What are the advantages and disadvantages of people relying on online services for daily tasks?" },
  { id: "environment-advantages", type: "advantages_disadvantages", category: "environment", task: "What are the advantages and disadvantages of replacing private-car journeys with public transport?" },
  { id: "society-advantages", type: "advantages_disadvantages", category: "society", task: "What are the advantages and disadvantages of people living in large cities?" },
  { id: "environment-problem", type: "problem_solution", category: "environment", task: "Many towns produce increasing amounts of household waste. What problems does this cause, and what solutions can be offered?" },
  { id: "technology-problem", type: "problem_solution", category: "technology", task: "Many people struggle to identify unreliable information online. What problems can this create, and what solutions can be offered?" },
  { id: "society-problem", type: "problem_solution", category: "society", task: "Many young adults find it difficult to afford housing. What problems does this cause, and what solutions can be offered?" },
];

const ieltsCategorySchema = z.enum(["grammar", "vocabulary", "coherence"]);
const ieltsSubcategorySchema = z.enum([...writingTaxonomy.grammar, ...writingTaxonomy.vocabulary, ...writingTaxonomy.coherence]);
const severitySchema = z.enum(["minor", "moderate", "major", "critical"]);
const criterionSchema = z.object({ strengths: z.array(text(4, 280)).max(3), developmentPoints: z.array(text(4, 280)).max(3), nextAction: text(4, 320) }).strict();
const providerIeltsIssueSchema = z.object({ category: ieltsCategorySchema, subcategory: ieltsSubcategorySchema, originalText: text(1, 600), correctedText: text(1, 600), explanation: text(8, 500), severity: severitySchema, confidence: z.number().min(0).max(1) }).strict().superRefine((issue, ctx) => {
  if (!writingTaxonomy[issue.category].includes(issue.subcategory as never)) ctx.addIssue({ code: "custom", path: ["subcategory"], message: "The subcategory is not valid for this category." });
});
const ieltsIssueSchema = providerIeltsIssueSchema.extend({ id: text(1, 120), patternKey: text(3, 160), memoryEligible: z.boolean() }).strict().superRefine((issue, ctx) => {
  if (issue.patternKey !== `${issue.category}.${issue.subcategory}`) ctx.addIssue({ code: "custom", path: ["patternKey"], message: "The pattern key must be canonical." });
});
export type IeltsWritingIssue = z.infer<typeof ieltsIssueSchema>;
export interface IeltsCriterionFeedback { readonly strengths: readonly string[]; readonly developmentPoints: readonly string[]; readonly nextAction: string; }
export const ieltsInitialWritingFeedbackSchema = z.object({ stage: z.literal("initial"), criteria: z.object({ taskResponse: criterionSchema, coherenceAndCohesion: criterionSchema, lexicalResource: criterionSchema, grammaticalRangeAndAccuracy: criterionSchema }).strict(), languageIssues: z.array(ieltsIssueSchema).max(5), revisionPriorities: z.array(text(4, 280)).max(3), wordCount: z.number().int().min(0).max(20_000) }).strict();
export type IeltsInitialWritingFeedback = z.infer<typeof ieltsInitialWritingFeedbackSchema>;
export const providerInitialIeltsWritingFeedbackSchema = z.object({ stage: z.literal("initial"), criteria: z.object({ taskResponse: criterionSchema, coherenceAndCohesion: criterionSchema, lexicalResource: criterionSchema, grammaticalRangeAndAccuracy: criterionSchema }).strict(), languageIssues: z.array(providerIeltsIssueSchema).max(5), revisionPriorities: z.array(text(4, 280)).max(3), wordCount: z.number().int().min(0).max(20_000) }).strict();
export const ieltsRevisionWritingFeedbackSchema = z.object({ stage: z.literal("revision"), criteriaComparison: z.object({ taskResponse: text(4, 320), coherenceAndCohesion: text(4, 320), lexicalResource: text(4, 320), grammaticalRangeAndAccuracy: text(4, 320) }).strict(), resolvedIssueIds: z.array(text(1, 120)).max(5), remainingIssueIds: z.array(text(1, 120)).max(5), newLanguageIssues: z.array(ieltsIssueSchema).max(5), improvedExample: text(30, 800).nullable(), wordCount: z.number().int().min(0).max(20_000) }).strict();
export type IeltsRevisionWritingFeedback = z.infer<typeof ieltsRevisionWritingFeedbackSchema>;
export const providerRevisionIeltsWritingFeedbackSchema = z.object({ stage: z.literal("revision"), criteriaComparison: z.object({ taskResponse: text(4, 320), coherenceAndCohesion: text(4, 320), lexicalResource: text(4, 320), grammaticalRangeAndAccuracy: text(4, 320) }).strict(), resolvedIssueIds: z.array(text(1, 120)).max(5), remainingIssueIds: z.array(text(1, 120)).max(5), newLanguageIssues: z.array(providerIeltsIssueSchema).max(5), improvedExample: text(30, 800).nullable(), wordCount: z.number().int().min(0).max(20_000) }).strict();

function canonicalIeltsIssue(issue: z.infer<typeof providerIeltsIssueSchema>, id: () => string): IeltsWritingIssue {
  return { ...issue, id: id(), patternKey: `${issue.category}.${issue.subcategory}`, memoryEligible: issue.confidence >= 0.85 };
}
function issueReferencesDraft(issue: { readonly originalText: string }, draft: string) { return normalize(draft).includes(normalize(issue.originalText)); }
export function validateIeltsInitialWritingFeedback(value: unknown, input: { readonly draft: string; readonly issueId: () => string; readonly wordCount: number }) {
  const parsed = providerInitialIeltsWritingFeedbackSchema.safeParse(value);
  if (!parsed.success) return parsed;
  const invalid = parsed.data.languageIssues.findIndex((issue) => !issueReferencesDraft(issue, input.draft));
  if (invalid >= 0) return { success: false as const, error: new z.ZodError([{ code: "custom", path: ["languageIssues", invalid, "originalText"], message: "Language issues must reference the supplied draft." }]) };
  return { success: true as const, data: { ...parsed.data, languageIssues: parsed.data.languageIssues.filter((issue) => issue.confidence >= 0.65).map((issue) => canonicalIeltsIssue(issue, input.issueId)), wordCount: input.wordCount } satisfies IeltsInitialWritingFeedback };
}
export function validateIeltsRevisionWritingFeedback(value: unknown, input: { readonly draft: string; readonly initialFeedback: IeltsInitialWritingFeedback; readonly issueId: () => string; readonly wordCount: number }) {
  const parsed = providerRevisionIeltsWritingFeedbackSchema.safeParse(value);
  if (!parsed.success) return parsed;
  const initialIds = new Set(input.initialFeedback.languageIssues.map((issue) => issue.id));
  const mentioned = [...parsed.data.resolvedIssueIds, ...parsed.data.remainingIssueIds];
  if (mentioned.some((id) => !initialIds.has(id)) || new Set(mentioned).size !== mentioned.length) return { success: false as const, error: new z.ZodError([{ code: "custom", path: ["resolvedIssueIds"], message: "Revision feedback must compare only stable initial issue IDs." }]) };
  const invalid = parsed.data.newLanguageIssues.findIndex((issue) => !issueReferencesDraft(issue, input.draft));
  if (invalid >= 0) return { success: false as const, error: new z.ZodError([{ code: "custom", path: ["newLanguageIssues", invalid, "originalText"], message: "Language issues must reference the supplied revision draft." }]) };
  return { success: true as const, data: { ...parsed.data, newLanguageIssues: parsed.data.newLanguageIssues.filter((issue) => issue.confidence >= 0.65).map((issue) => canonicalIeltsIssue(issue, input.issueId)), wordCount: input.wordCount } satisfies IeltsRevisionWritingFeedback };
}
export interface IeltsWritingSession { readonly id: string; readonly promptId: string; readonly promptType: IeltsTask2Type; readonly draft: string; readonly revisedDraft: string | null; readonly initialFeedback: IeltsInitialWritingFeedback | null; readonly revisionFeedback: IeltsRevisionWritingFeedback | null; readonly dismissedIssueIds?: readonly string[]; readonly initialAnalyzedAt: string | null; readonly revisionReviewedAt: string | null; readonly elapsedSeconds: number | null; readonly createdAt: string; readonly updatedAt: string; }
export const ieltsWritingSessionSchema: z.ZodType<IeltsWritingSession> = z.object({ id: text(1, 120), promptId: text(1, 100), promptType: z.enum(ieltsTask2Types), draft: z.string().max(ieltsDraftMaximumCharacters), revisedDraft: z.string().max(ieltsDraftMaximumCharacters).nullable(), initialFeedback: ieltsInitialWritingFeedbackSchema.nullable(), revisionFeedback: ieltsRevisionWritingFeedbackSchema.nullable(), dismissedIssueIds: z.array(text(1, 120)).max(10).optional(), initialAnalyzedAt: z.string().datetime().nullable(), revisionReviewedAt: z.string().datetime().nullable(), elapsedSeconds: z.number().int().min(0).max(86_400).nullable(), createdAt: z.string().datetime(), updatedAt: z.string().datetime() }).strict().superRefine((value, ctx) => { if (value.revisionFeedback !== null && value.revisedDraft === null) ctx.addIssue({ code: "custom", path: ["revisedDraft"], message: "Revision feedback requires a saved revision draft." }); });
