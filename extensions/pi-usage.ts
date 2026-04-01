import type { ExtensionContext } from "@anthropic/pi-sdk";

export function activate(ctx: ExtensionContext) {
  const { commands, tools } = ctx;

  commands.register("pi-usage", {
    description: "Show AI usage/quota across providers",
    args: [
      { name: "provider", description: "Provider to show (claude, openai, openrouter)", required: false },
      { name: "--tui", description: "Launch TUI dashboard", required: false },
    ],
    async execute(args) {
      const provider = args.provider as string | undefined;

      if (args["--tui"]) {
        // TODO: launch TUI via ctx.ui.custom() when available
        return "TUI mode not yet available in extension context. Use standalone `pi-usage` CLI.";
      }

      try {
        const { getAvailableProviders, getProvider } = await import("../dist/providers/index.js");

        if (provider) {
          const p = getProvider(provider);
          if (!p) return `Unknown provider: ${provider}`;
          if (!(await p.isAvailable())) return `${p.name} is not configured. Check your credentials.`;
          const usage = await p.fetchUsage();
          return formatUsage(p.name, p.icon, usage);
        }

        const available = await getAvailableProviders();
        if (available.length === 0) return "No providers configured. Run `pi-usage setup` for Claude.";

        const results: string[] = [];
        for (const p of available) {
          try {
            const usage = await p.fetchUsage();
            results.push(formatUsage(p.name, p.icon, usage));
          } catch (e) {
            results.push(`${p.icon} ${p.name}: Error — ${e instanceof Error ? e.message : e}`);
          }
        }
        return results.join("\n\n");
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : e}`;
      }
    },
  });

  tools.register("pi_usage", {
    description: "Check AI usage quotas and billing across providers (Claude, OpenAI, OpenRouter)",
    parameters: {
      type: "object" as const,
      properties: {
        provider: {
          type: "string" as const,
          description: "Specific provider to check (claude, openai, openrouter). Omit for all.",
        },
      },
    },
    async execute(params: { provider?: string }) {
      try {
        const { getAvailableProviders, getProvider } = await import("../dist/providers/index.js");

        if (params.provider) {
          const p = getProvider(params.provider);
          if (!p) return { error: `Unknown provider: ${params.provider}` };
          if (!(await p.isAvailable())) return { error: `${p.name} not configured` };
          return await p.fetchUsage();
        }

        const available = await getAvailableProviders();
        const results = await Promise.allSettled(available.map((p) => p.fetchUsage()));

        return results.map((r, i) =>
          r.status === "fulfilled"
            ? r.value
            : { provider: available[i]!.id, error: r.reason?.message ?? "unknown error" }
        );
      } catch (e) {
        return { error: e instanceof Error ? e.message : `${e}` };
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
