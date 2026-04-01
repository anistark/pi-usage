import type { UsageProvider, ProviderUsage, QuotaWindow, ModelUsage } from "./types.js";
import { getValidOAuthToken, isAuthenticated, OAUTH_CONFIG } from "../auth/index.js";

export class QuotaFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaFetchError";
  }
}

export class AuthenticationError extends QuotaFetchError {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class RateLimitError extends QuotaFetchError {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Rate limited. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

async function fetchQuotaRaw(token: string): Promise<Record<string, unknown>> {
  let resp: Response;
  try {
    resp = await fetch(OAUTH_CONFIG.usageUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": OAUTH_CONFIG.betaHeader,
      },
      signal: AbortSignal.timeout(15000),
    });
  } catch (e) {
    throw new QuotaFetchError(`Network error: ${e}`);
  }

  if (resp.status === 401) throw new AuthenticationError("OAuth token invalid or expired. Run 'pi-usage setup'.");
  if (resp.status === 403) throw new AuthenticationError("Access denied. Token may lack required permissions.");
  if (resp.status === 429) {
    const retryAfter = resp.headers.get("retry-after");
    throw new RateLimitError(retryAfter ? Number(retryAfter) * 1000 : 60_000);
  }
  if (resp.status !== 200) {
    const text = await resp.text();
    throw new QuotaFetchError(`API returned status ${resp.status}: ${text}`);
  }

  return (await resp.json()) as Record<string, unknown>;
}

function parseWindow(data: Record<string, unknown> | undefined, label: string, duration: string): QuotaWindow | null {
  if (!data) return null;

  const usedPercent = (data["utilization"] as number) ?? (data["usage_pct"] as number) ?? 0;
  const resetStr = (data["resets_at"] as string) ?? (data["reset_at"] as string) ?? (data["resetAt"] as string);

  const models: ModelUsage[] = [];
  const modelData = (data["models"] ?? []) as Array<Record<string, unknown>>;
  for (const m of modelData) {
    models.push({
      model: (m["model"] as string) ?? (m["name"] as string) ?? "unknown",
      inputTokens: (m["input_tokens"] as number) ?? 0,
      outputTokens: (m["output_tokens"] as number) ?? 0,
      cachedTokens: (m["cached_tokens"] as number) ?? 0,
    });
  }

  return {
    label,
    duration,
    usedPercent,
    resetAt: resetStr ? new Date(resetStr) : undefined,
    models: models.length > 0 ? models : undefined,
  };
}

function parseResponse(data: Record<string, unknown>): ProviderUsage {
  const quotas: QuotaWindow[] = [];

  const fiveHour = (data["five_hour"] ?? data["fiveHour"]) as Record<string, unknown> | undefined;
  const fiveHourWindow = parseWindow(fiveHour, "5-Hour Quota", "5h");
  if (fiveHourWindow) quotas.push(fiveHourWindow);

  const sevenDay = (data["seven_day"] ?? data["sevenDay"]) as Record<string, unknown> | undefined;
  const sevenDayWindow = parseWindow(sevenDay, "Weekly Quota", "7d");
  if (sevenDayWindow) quotas.push(sevenDayWindow);

  const modelQuotas = (data["models"] ?? data["model_quotas"] ?? []) as Array<Record<string, unknown>>;
  const models: ModelUsage[] = modelQuotas.map((m) => ({
    model: (m["model"] as string) ?? (m["name"] as string) ?? "unknown",
    inputTokens: (m["input_tokens"] as number) ?? 0,
    outputTokens: (m["output_tokens"] as number) ?? 0,
    cachedTokens: (m["cached_tokens"] as number) ?? 0,
    cost: m["cost"] as number | undefined,
  }));

  return {
    provider: "claude",
    quotas: quotas.length > 0 ? quotas : undefined,
    models: models.length > 0 ? models : undefined,
    raw: data,
  };
}

export const claudeProvider: UsageProvider = {
  id: "claude",
  name: "Claude",
  icon: "✨",

  async isAvailable(): Promise<boolean> {
    return isAuthenticated();
  },

  async fetchUsage(): Promise<ProviderUsage> {
    const token = await getValidOAuthToken();
    if (!token) throw new AuthenticationError("No valid OAuth token. Run 'pi-usage setup'.");

    const raw = await fetchQuotaRaw(token);
    return parseResponse(raw);
  },
};

/** Validate that the current token works against the API. */
export async function validateToken(): Promise<{ ok: true } | { ok: false; reason: string }> {
  const token = await getValidOAuthToken();
  if (!token) return { ok: false, reason: "No OAuth token found. Run 'pi-usage setup' first." };

  try {
    const resp = await fetch(OAUTH_CONFIG.usageUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": OAUTH_CONFIG.betaHeader,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (resp.status === 401) return { ok: false, reason: "OAuth token invalid or expired. Run 'pi-usage setup --re'." };
    if (resp.status === 403) return { ok: false, reason: "Access denied. Run 'pi-usage setup --re'." };
    if (resp.status !== 200) return { ok: false, reason: `API returned status ${resp.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: `Network error: ${e}` };
  }
}
