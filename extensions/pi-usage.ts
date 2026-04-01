import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("pi-usage", {
    description: "Show AI usage/quota across providers",
    handler: async (args, ctx) => {
      const provider = args?.trim() || undefined;

      try {
        const { getAvailableProviders, getProvider } = await import("../dist/providers/index.js");

        if (provider) {
          const p = getProvider(provider);
          if (!p) {
            ctx.ui.notify(`Unknown provider: ${provider}`, "warn");
            return;
          }
          if (!(await p.isAvailable())) {
            ctx.ui.notify(`${p.name} is not configured. Check your credentials.`, "warn");
            return;
          }
          const usage = await p.fetchUsage();
          ctx.ui.notify(formatUsage(p.name, p.icon, usage), "info");
          return;
        }

        const available = await getAvailableProviders();
        if (available.length === 0) {
          ctx.ui.notify("No providers configured. Run `pi-usage setup` for Claude.", "warn");
          return;
        }

        const results: string[] = [];
        for (const p of available) {
          try {
            const usage = await p.fetchUsage();
            results.push(formatUsage(p.name, p.icon, usage));
          } catch (e) {
            results.push(`${p.icon} ${p.name}: Error — ${e instanceof Error ? e.message : e}`);
          }
        }
        ctx.ui.notify(results.join("\n\n"), "info");
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
    async execute(_toolCallId, params: { provider?: string }, _signal, _onUpdate, _ctx) {
      try {
        const { getAvailableProviders, getProvider } = await import("../dist/providers/index.js");

        if (params.provider) {
          const p = getProvider(params.provider);
          if (!p) return { content: [{ type: "text" as const, text: `Unknown provider: ${params.provider}` }] };
          if (!(await p.isAvailable())) return { content: [{ type: "text" as const, text: `${p.name} not configured` }] };
          const usage = await p.fetchUsage();
          return { content: [{ type: "text" as const, text: JSON.stringify(usage, null, 2) }] };
        }

        const available = await getAvailableProviders();
        const results = await Promise.allSettled(available.map((p) => p.fetchUsage()));
        const data = results.map((r, i) =>
          r.status === "fulfilled"
            ? r.value
            : { provider: available[i]!.id, error: r.reason?.message ?? "unknown error" }
        );

        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
      } catch (e) {
        return { content: [{ type: "text" as const, text: `Error: ${e instanceof Error ? e.message : e}` }] };
      }
    },
  });
}

function formatUsage(name: string, icon: string, usage: any): string {
  const lines: string[] = [`${icon} ${name}`];

  if (usage.quotas) {
    for (const q of usage.quotas) {
      const pct = Math.round(q.usedPercent);
      const bar = "█".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
      let line = `  ${q.label}: ${bar} ${pct}%`;
      if (q.resetAt) {
        const diffMin = Math.max(0, Math.round((new Date(q.resetAt).getTime() - Date.now()) / 60000));
        if (diffMin < 60) line += ` (resets in ${diffMin}m)`;
        else line += ` (resets in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m)`;
      }
      lines.push(line);
    }
  }

  if (usage.credits) {
    const c = usage.credits;
    lines.push(`  Balance: ${c.currency}${c.remaining.toFixed(2)} / ${c.currency}${c.limit.toFixed(2)}`);
  }

  if (usage.billing) {
    const b = usage.billing;
    lines.push(`  Today: ${b.currency}${b.dailySpend.toFixed(2)} | Month: ${b.currency}${b.monthlySpend.toFixed(2)}`);
  }

  return lines.join("\n");
}
