import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";

interface UsageBarProps {
  usagePct: number;
  label?: string;
  width?: number;
}

function getColor(pct: number): (s: string) => string {
  if (pct < 50) return chalk.green;
  if (pct < 80) return chalk.yellow;
  return chalk.red;
}

export function UsageBar({ usagePct, label, width = 30 }: UsageBarProps): React.ReactElement {
  const pct = Math.max(0, Math.min(100, usagePct));
  const filled = Math.round((pct / 100) * width);
  const empty = width - filled;
  const color = getColor(pct);

  const bar = color("█".repeat(filled)) + chalk.gray("░".repeat(empty));

  return (
    <Box>
      {label && <Text>{label} </Text>}
      <Text>{bar}</Text>
      <Text> {color(`${Math.round(pct)}%`)}</Text>
    </Box>
  );
}
