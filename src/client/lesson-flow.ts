export async function openCachedOrGeneratedLesson<T extends { generationFingerprint: string }>(input: {
  generationFingerprint: string;
  store: { get(fingerprint: string): Promise<T | null>; save(lesson: T): Promise<boolean> };
  generate(): Promise<T>;
}): Promise<{ lesson: T; cacheHit: boolean }> {
  const cached = await input.store.get(input.generationFingerprint);
  if (cached) return { lesson: cached, cacheHit: true };
  const lesson = await input.generate();
  await input.store.save(lesson);
  return { lesson, cacheHit: false };
}
