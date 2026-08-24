import "server-only";

export type WritingFailureStage = "provider" | "json" | "zod" | "semantic" | "grounding";

export interface SafeWritingDiagnostic {
  readonly stage: WritingFailureStage;
  readonly path?: string;
  readonly code?: string;
  readonly normalizedSourceMatch?: false;
}

export class WritingAnalysisFailure extends Error {
  constructor(readonly diagnostic: SafeWritingDiagnostic) {
    super("Writing feedback could not be validated and was not saved.");
  }
}

export function safeZodDiagnostic(stage: "zod" | "semantic", error: { issues: readonly { path: readonly PropertyKey[]; code: string }[] }): SafeWritingDiagnostic {
  const issue = error.issues[0];
  return { stage, path: issue?.path.map(String).join("."), code: issue?.code };
}
