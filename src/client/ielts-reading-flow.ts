import type { IeltsReadingPractice } from "@/domain/ielts";
import type { IeltsPracticeStore } from "@/domain/boundaries";

export async function openCachedOrGeneratedIeltsReading(input: { readonly generationFingerprint: string; readonly store: Pick<IeltsPracticeStore, "getReadingByFingerprint" | "saveReading">; readonly generate: () => Promise<IeltsReadingPractice> }) {
  const cached = await input.store.getReadingByFingerprint(input.generationFingerprint);
  if (cached) return { practice: cached, cacheHit: true as const };
  const generated = await input.generate();
  if (!await input.store.saveReading(generated)) throw new Error("Browser storage is unavailable; the validated practice was not saved.");
  return { practice: generated, cacheHit: false as const };
}
