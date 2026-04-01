/** API key resolution for non-OAuth providers (OpenAI, OpenRouter, etc). */

export function getApiKey(provider: string): string | null {
  const envMap: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
  };

  const envVar = envMap[provider];
  if (envVar) {
    const val = process.env[envVar];
    if (val) return val;
  }

  return null;
}
