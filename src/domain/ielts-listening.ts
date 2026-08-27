import { z } from "zod";

export const ieltsListeningDefinitionVersion = "m12-ielts-listening-v1";
export const ieltsListeningQuestionCount = 6;
export const ieltsListeningMaximumPlaybackCount = 1_000;

const text = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const isoDate = z.string().datetime();

export const ieltsListeningPartStyles = ["part1_conversation", "part2_monologue", "part3_discussion", "part4_lecture"] as const;
export type IeltsListeningPartStyle = typeof ieltsListeningPartStyles[number];

const speakerSchema = z.object({ id: text(1, 80), label: text(1, 80) }).strict();
const scriptTurnSchema = z.object({ speakerId: text(1, 80), text: text(8, 1_200) }).strict();
const optionSchema = z.object({ id: text(1, 80), text: text(1, 320) }).strict();
const commonQuestion = { id: text(1, 100), prompt: text(8, 600), explanation: text(8, 600), relevantTranscript: text(8, 420) };
const multipleChoiceSchema = z.object({ ...commonQuestion, type: z.literal("multiple_choice"), options: z.array(optionSchema).length(4), correctOptionId: text(1, 80) }).strict().superRefine((question, context) => {
  if (new Set(question.options.map((option) => option.id)).size !== 4) context.addIssue({ code: "custom", path: ["options"], message: "Multiple-choice option IDs must be unique." });
  if (!question.options.some((option) => option.id === question.correctOptionId)) context.addIssue({ code: "custom", path: ["correctOptionId"], message: "The correct option must be an option ID." });
});
const completionSchema = z.object({ ...commonQuestion, type: z.literal("completion"), acceptedAnswers: z.array(text(1, 160)).min(1).max(4) }).strict().superRefine((question, context) => {
  if (new Set(question.acceptedAnswers.map(normalizeIeltsListeningCompletionAnswer)).size !== question.acceptedAnswers.length) context.addIssue({ code: "custom", path: ["acceptedAnswers"], message: "Completion answer variants must remain distinct after normalization." });
});
export const ieltsListeningQuestionSchema = z.discriminatedUnion("type", [multipleChoiceSchema, completionSchema]);
export type IeltsListeningQuestion = z.infer<typeof ieltsListeningQuestionSchema>;

export const ieltsListeningPracticeDefinitionSchema = z.object({
  id: text(1, 120), version: z.literal(ieltsListeningDefinitionVersion), partStyle: z.enum(ieltsListeningPartStyles), title: text(4, 180), setting: text(8, 280), speakers: z.array(speakerSchema).min(1).max(4), scriptTurns: z.array(scriptTurnSchema).min(1).max(20), questions: z.array(ieltsListeningQuestionSchema).length(ieltsListeningQuestionCount),
}).strict().superRefine((definition, context) => {
  if (new Set(definition.speakers.map((speaker) => speaker.id)).size !== definition.speakers.length) context.addIssue({ code: "custom", path: ["speakers"], message: "Speaker IDs must be unique." });
  const speakerIds = new Set(definition.speakers.map((speaker) => speaker.id));
  definition.scriptTurns.forEach((turn, index) => { if (!speakerIds.has(turn.speakerId)) context.addIssue({ code: "custom", path: ["scriptTurns", index, "speakerId"], message: "Every script turn must reference an authored speaker." }); });
  if (new Set(definition.questions.map((question) => question.id)).size !== definition.questions.length) context.addIssue({ code: "custom", path: ["questions"], message: "Question IDs must be unique." });
  if (definition.questions.filter((question) => question.type === "multiple_choice").length !== 3 || definition.questions.filter((question) => question.type === "completion").length !== 3) context.addIssue({ code: "custom", path: ["questions"], message: "A Listening practice requires three multiple-choice and three completion questions." });
  const transcript = normalizeTranscript(ieltsListeningTranscript(definition));
  definition.questions.forEach((question, index) => { if (!transcript.includes(normalizeTranscript(question.relevantTranscript))) context.addIssue({ code: "custom", path: ["questions", index, "relevantTranscript"], message: "Relevant transcript must be an exact authored script segment." }); });
});
export type IeltsListeningPracticeDefinition = z.infer<typeof ieltsListeningPracticeDefinitionSchema>;

export const ieltsListeningSessionSchema = z.object({
  id: text(1, 120), practiceDefinitionId: text(1, 120), answers: z.record(z.string().trim().min(1).max(100), z.string().max(320)), playbackStartedAt: isoDate.nullable(), playbackCount: z.number().int().min(0).max(ieltsListeningMaximumPlaybackCount), correctCount: z.number().int().min(0).max(ieltsListeningQuestionCount).nullable(), totalCount: z.literal(ieltsListeningQuestionCount).nullable(), createdAt: isoDate, updatedAt: isoDate, completedAt: isoDate.nullable(),
}).strict().superRefine((session, context) => {
  const completed = session.completedAt !== null;
  if (completed && (session.correctCount === null || session.totalCount !== ieltsListeningQuestionCount)) context.addIssue({ code: "custom", path: ["completedAt"], message: "Completed sessions require frozen totals." });
  if (!completed && (session.correctCount !== null || session.totalCount !== null)) context.addIssue({ code: "custom", path: ["correctCount"], message: "Unfinished sessions cannot contain a result." });
});
export type IeltsListeningSession = z.infer<typeof ieltsListeningSessionSchema>;

export function normalizeIeltsListeningCompletionAnswer(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().replace(/[.!?]+$/u, "").trim().toLocaleLowerCase();
}

function normalizeTranscript(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

export function ieltsListeningTranscript(definition: Pick<IeltsListeningPracticeDefinition, "scriptTurns">): string {
  return definition.scriptTurns.map((turn) => turn.text).join(" ");
}

export function validateIeltsListeningPracticeDefinition(value: unknown) {
  return ieltsListeningPracticeDefinitionSchema.safeParse(value);
}

export function gradeIeltsListeningAnswers(definition: IeltsListeningPracticeDefinition, answers: Readonly<Record<string, string>>) {
  const correct = definition.questions.filter((question) => question.type === "multiple_choice"
    ? answers[question.id] === question.correctOptionId
    : question.acceptedAnswers.some((answer) => normalizeIeltsListeningCompletionAnswer(answers[question.id] ?? "") === normalizeIeltsListeningCompletionAnswer(answer))).length;
  return { correct, total: definition.questions.length };
}

export function hasAllIeltsListeningAnswers(definition: IeltsListeningPracticeDefinition, answers: Readonly<Record<string, string>>) {
  return definition.questions.every((question) => Boolean(answers[question.id]?.trim()));
}
