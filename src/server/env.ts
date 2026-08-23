import "server-only";

export interface ServerEnvironment {
  supabaseUrl: string;
  supabaseAnonKey: string;
  openAiApiKey: string;
}

type EnvironmentSource = Record<string, string | undefined>;

function required(source: EnvironmentSource, name: string): string {
  const value = source[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function readServerEnvironment(source: EnvironmentSource): ServerEnvironment {
  return {
    supabaseUrl: required(source, "SUPABASE_URL"),
    supabaseAnonKey: required(source, "SUPABASE_ANON_KEY"),
    openAiApiKey: required(source, "OPENAI_API_KEY"),
  };
}
