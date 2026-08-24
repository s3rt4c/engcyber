import "server-only";

export type AiProviderId = "gemini" | "openai";
export type AiCapability = "sentence_action" | "lesson_generation" | "writing_analysis";

export interface ResolvedAiProvider {
  readonly id: AiProviderId;
  readonly apiKey: string;
  readonly actionModel: string;
  readonly lessonModel: string;
}

type ProviderVariables = {
  readonly apiKey: string;
  readonly actionModel: string;
  readonly lessonModel: string;
};

function configured(value: string | undefined): string {
  return value?.trim() ?? "";
}

function providerVariables(provider: AiProviderId, env: Record<string, string | undefined>): ProviderVariables {
  if (provider === "gemini") {
    return {
      apiKey: configured(env.GEMINI_API_KEY),
      actionModel: configured(env.GEMINI_ACTION_MODEL),
      lessonModel: configured(env.GEMINI_LESSON_MODEL),
    };
  }
  return {
    apiKey: configured(env.OPENAI_API_KEY),
    actionModel: configured(env.OPENAI_MODEL),
    lessonModel: configured(env.OPENAI_LESSON_MODEL),
  };
}

function providerName(provider: AiProviderId): string {
  return provider === "gemini" ? "Gemini" : "OpenAI";
}

export function resolveAiProvider(env: Record<string, string | undefined> = process.env, capability?: AiCapability): ResolvedAiProvider {
  const configuredProvider = configured(env.AI_PROVIDER).toLowerCase();
  if (configuredProvider !== "gemini" && configuredProvider !== "openai") {
    throw new Error("Unsupported AI_PROVIDER. Use gemini or openai.");
  }
  const id = configuredProvider;
  const variables = providerVariables(id, env);
  const name = providerName(id);
  if (!variables.apiKey) throw new Error(`${name} configuration requires ${id === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY"}.`);
  if (capability === "sentence_action" && !variables.actionModel) {
    throw new Error(`${name} sentence actions require ${id === "gemini" ? "GEMINI_ACTION_MODEL" : "OPENAI_MODEL"}.`);
  }
  if ((capability === "lesson_generation" || capability === "writing_analysis") && !variables.lessonModel) {
    throw new Error(`${name} lesson generation requires ${id === "gemini" ? "GEMINI_LESSON_MODEL" : "OPENAI_LESSON_MODEL"}.`);
  }
  return { id, apiKey: variables.apiKey, actionModel: variables.actionModel, lessonModel: variables.lessonModel };
}
