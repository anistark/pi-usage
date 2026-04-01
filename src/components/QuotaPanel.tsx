import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";

import type { ProviderUsage } from "../providers/types.js";
import { DonutChart } from "./DonutChart.js";
import { UsageBar } from "./UsageBar.js";

interface QuotaPanelProps {
  usage: ProviderUsage | null;
}

function usageColor(pct: number): (s: string) => string {
  if (pct < 50) return chalk.green;
  if (pct < 80) return chalk.yellow;
  return chalk.red;
}

export function QuotaPanel({ usage }: QuotaPanelProps): React.ReactElement {
  if (!usage || !usage.quotas || usage.quotas.length === 0) {
    return (
      <Box paddingX={2} paddingY={1}>
        <Text dimColor>Waiting for data...</Text>
      </Box>
    );
  }

  const fiveHour = usage.quotas.find((q) => q.duration === "5h");
  const sevenDay = usage.quotas.find((q) => q.duration === "7d");

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexGrow={1} flexDirection="row" justifyContent="center" alignItems="center" paddingX={2} gap={4}>
        {fiveHour && (
          <DonutChart
            usagePct={fiveHour.usedPercent}
            label={fiveHour.label}
            resetTime={fiveHour.resetAt}
          />
        )}
        {sevenDay && (
          <DonutChart
            usagePct={sevenDay.usedPercent}
            label={sevenDay.label}
            resetTime={sevenDay.resetAt}
          />
        )}
      </Box>

      {usage.models && usage.models.length > 0 && (
        <Box flexDirection="column" paddingX={4} paddingBottom={1}>
          <Text bold>Model Usage</Text>
          {usage.models.map((m, i) => {
            const prefix = i === usage.models!.length - 1 ? "└" : "├";
            const pct = m.cost !== undefined ? m.cost : 0;
            return (
              <Text key={m.model}>
                {`  ${prefix} ${m.model}`}
                {pct > 0 ? ` ${usageColor(pct)(`${Math.round(pct)}%`)}` : ""}
              </Text>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
