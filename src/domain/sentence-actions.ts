export type SentenceAction = "simplify" | "explain" | "translate";
export type ExplicitActionInput = { action: SentenceAction; selectedText: string; surroundingContext: string };

export function isSentenceAction(value: unknown): value is SentenceAction {
  return value === "simplify" || value === "explain" || value === "translate";
}

export function buildExplicitActionInput(input: ExplicitActionInput): ExplicitActionInput {
  const selectedText = input.selectedText.trim();
  if (!selectedText) throw new Error("Select text before requesting support");
  return { action: input.action, selectedText: selectedText.slice(0, 2_000), surroundingContext: input.surroundingContext.trim().slice(0, 600) };
}
