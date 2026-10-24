import type { IeltsContinuationItem } from "@/domain/ielts-continuity";

export interface DailyTrainingItem {
  readonly id: string;
  readonly kind: "review" | "vocabulary" | "writing" | "ielts" | "listening";
  readonly title: string;
  readonly reason: string;
  readonly href: string;
}

export interface DailyTrainingInput {
  readonly review: { readonly dueNow: number; readonly overdue: number };
  readonly vocabulary: { readonly dueNow: number; readonly overdue: number };
  readonly writing: readonly { readonly id: string; readonly title: "Revise writing" | "Review revision feedback" | "Writing feedback available"; readonly href: string; readonly createdAt: string }[];
  /** Already ordered and qualified by selectIeltsContinuations. */
  readonly ielts: readonly IeltsContinuationItem[];
  /** Exactly the target selected by findResumableListeningLesson. */
  readonly listening: { readonly href: string } | null;
}

/** Ranks accepted local actions only. It never creates work or records completion. */
export function selectDailyTraining(input: DailyTrainingInput, options: { readonly now: string }): DailyTrainingItem[] {
  const now = Date.parse(options.now);
  if (!Number.isFinite(now)) return [];
  const current = (value: string) => Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
  const scheduled: { readonly priority: number; readonly item: DailyTrainingItem }[] = [];
  const queue: DailyTrainingItem[] = [];
  const seen = new Set<string>();
  const item = (kind: DailyTrainingItem["kind"], title: string, reason: string, href: string): DailyTrainingItem => ({ id: `training:${href}`, kind, title, reason, href });
  const add = (candidate: DailyTrainingItem) => {
    if (queue.length < 3 && !seen.has(candidate.href)) { seen.add(candidate.href); queue.push(candidate); }
  };
  if (input.review.dueNow > 0) {
    const overdue = input.review.overdue > 0;
    const count = overdue ? input.review.overdue : input.review.dueNow;
    scheduled.push({ priority: overdue ? 1 : 3, item: item("review", "Review error patterns", `${count} error-pattern review${count === 1 ? " is" : "s are"} ${overdue ? "overdue" : "due now"}.`, "/review") });
  }
  if (input.vocabulary.dueNow > 0) {
    const overdue = input.vocabulary.overdue > 0;
    const count = overdue ? input.vocabulary.overdue : input.vocabulary.dueNow;
    scheduled.push({ priority: overdue ? 2 : 4, item: item("vocabulary", "Review vocabulary", `${count} vocabulary item${count === 1 ? " is" : "s are"} ${overdue ? "overdue" : "due now"}.`, "/vocabulary") });
  }
  scheduled.sort((a, b) => a.priority - b.priority).forEach(({ item }) => add(item));
  // Match Library's accepted newest-lesson-first order, including its stable ID tie.
  for (const writing of [...input.writing].filter((entry) => current(entry.createdAt)).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))) {
    add(item("writing", writing.title, writing.title === "Review revision feedback" ? "Revisit your saved revision feedback." : "Initial feedback is ready for your revision.", writing.href));
  }
  for (const continuation of input.ielts) {
    if (!current(continuation.updatedAt)) continue;
    const skill = continuation.domain === "ielts_reading" ? "Reading" : continuation.domain === "ielts_listening" ? "Listening" : "Writing";
    const reason = continuation.state === "draft" ? "You have a saved Task 2 draft." : continuation.state === "revision" ? "Initial Task 2 feedback is ready for revision." : `Your IELTS ${skill} practice is unfinished.`;
    add(item("ielts", `Resume IELTS ${skill}`, reason, continuation.href));
  }
  if (input.listening) add(item("listening", "Resume lesson listening", "Continue your saved listening session.", input.listening.href));
  return queue;
}
