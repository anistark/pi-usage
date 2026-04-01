import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const BETA_HEADER = "oauth-2025-04-20";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("usage", {
    description: "Show AI usage/quota across providers",
    handler: async (args, ctx) => {
      const provider = (args?.trim() || "claude").toLowerCase();

      if (provider !== "claude") {
        ctx.ui.notify(`Provider "${provider}" not yet supported. Only "claude" is available in v0.1.`, "warn");
        return;
      }

      try {
        const usage = await fetchClaudeUsage(ctx);
        ctx.ui.notify(formatUsage(usage), "info");
      } catch (e) {
        ctx.ui.notify(`Error: ${e instanceof Error ? e.message : e}`, "error");
      }
    },
  });

  pi.registerTool({
    name: "pi_usage",
    label: "AI Usage",
    description: "Check AI usage quotas and billing across providers (Claude, OpenAI, OpenRouter)",
    parameters: Type.Object({
      provider: Type.Optional(
        Type.String({ description: "Specific provider to check (claude, openai, openrouter). Omit for all." })
      ),
    }),
    async execute(_toolCallId, params: { provider?: string }, _signal, _onUpdate, ctx) {
      try {
        const usage = await fetchClaudeUsage(ctx);
        return { content: [{ type: "text" as const, text: JSON.stringify(usage, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : e}` }] };
      }
    },
  });
}

async function fetchClaudeUsage(ctx: { modelRegistry: { getApiKeyForProvider(p: string): Promise<string | undefined> } }) {
  const apiKey = await ctx.modelRegistry.getApiKeyForProvider("anthropic");
  if (!apiKey) throw new Error("No Anthropic API key found. Make sure you're logged in (`/login`).");

  const resp = await fetch(USAGE_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "anthropic-beta": BETA_HEADER,
    },
    signal: AbortSignal.timeout(15000),
  });

  if (resp.status === 401) throw new Error("Token invalid or expired. Try `/login` to re-authenticate.");
  if (resp.status === 403) throw new Error("Access denied. Token may lack required permissions.");
  if (resp.status === 429) throw new Error("Rate limited. Try again in a minute.");
  if (!resp.ok) throw new Error(`API returned status ${resp.status}`);

  return await resp.json();
}

function formatUsage(data: any): string {
  const lines: string[] = ["✨ Claude"];

  for (const [key, label] of [["five_hour", "5-Hour Quota"], ["fiveHour", "5-Hour Quota"], ["seven_day", "Weekly Quota"], ["sevenDay", "Weekly Quota"]] as const) {
    const window = data[key];
    if (!window) continue;
    const pct = Math.round(window.utilization ?? window.usage_pct ?? 0);
    const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
    let line = `  ${label}: ${bar} ${pct}%`;

    const resetStr = window.resets_at ?? window.reset_at ?? window.resetAt;
    if (resetStr) {
      const diffMin = Math.max(0, Math.round((new Date(resetStr).getTime() - Date.now()) / 60000));
      if (diffMin < 60) line += ` (resets in ${diffMin}m)`;
      else line += ` (resets in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m)`;
    }
    lines.push(line);
  }

  return lines.join("\n");
}
