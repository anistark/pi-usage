import type { UsageProvider } from "./types.js";
import { claudeProvider } from "./claude.js";

const providers: Map<string, UsageProvider> = new Map();

// Auto-register built-in providers
registerProvider(claudeProvider);

export function registerProvider(provider: UsageProvider): void {
  providers.set(provider.id, provider);
}

export function getProvider(id: string): UsageProvider | undefined {
  return providers.get(id);
}

export function getAllProviders(): UsageProvider[] {
  return Array.from(providers.values());
}

export async function getAvailableProviders(): Promise<UsageProvider[]> {
  const results = await Promise.allSettled(
    getAllProviders().map(async (p) => ({
      provider: p,
      available: await p.isAvailable(),
    })),
  );
  return results
    .filter(
      (
        r,
      ): r is PromiseFulfilledResult<{
        provider: UsageProvider;
        available: boolean;
      }> => r.status === "fulfilled" && r.value.available,
    )
    .map((r) => r.value.provider);
}
