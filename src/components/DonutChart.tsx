import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";

interface DonutChartProps {
  usagePct: number;
  label: string;
  resetTime?: Date;
}

function getColor(pct: number): (s: string) => string {
  if (pct < 50) return chalk.green;
  if (pct < 80) return chalk.yellow;
  return chalk.red;
}

function getBoldColor(pct: number): (s: string) => string {
  if (pct < 50) return chalk.bold.green;
  if (pct < 80) return chalk.bold.yellow;
  return chalk.bold.red;
}

function formatResetTime(reset: Date): string {
  const diffMs = reset.getTime() - Date.now();
  if (diffMs <= 0) return "now";

  const totalMinutes = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(diffMs / 3600000);
  const totalDays = Math.floor(diffMs / 86400000);

  if (totalMinutes < 1) return "in < 1 min";
  if (totalMinutes < 60) return `in ${totalMinutes} min`;
  if (totalHours < 24) {
    const remainingMin = totalMinutes % 60;
    if (remainingMin === 0) return `in ${totalHours}h`;
    return `in ${totalHours}h ${remainingMin}m`;
  }
  const remainingHrs = totalHours % 24;
  if (remainingHrs === 0) return `in ${totalDays}d`;
  return `in ${totalDays}d ${remainingHrs}h`;
}

export function DonutChart({ usagePct, label, resetTime }: DonutChartProps): React.ReactElement {
  const pct = Math.max(0, Math.min(100, usagePct));
  const color = getColor(pct);
  const boldColor = getBoldColor(pct);

  const outerR = 6.5;
  const innerR = 5.0;
  const rows = Math.floor(outerR * 2) + 1;
  const cols = Math.floor(outerR * 4) + 1;
  const usedAngle = 2 * Math.PI * (pct / 100);
  const centerY = outerR;
  const centerX = outerR * 2;

  type Cell = { char: string; style: ((s: string) => string) | null };
  const grid: Cell[][] = [];

  for (let row = 0; row < rows; row++) {
    const line: Cell[] = [];
    for (let col = 0; col < cols; col++) {
      const dy = row - centerY;
      const dx = (col - centerX) / 2.0;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (innerR <= dist && dist <= outerR) {
        let angle = Math.atan2(dx, -dy);
        if (angle < 0) angle += 2 * Math.PI;
        line.push(angle <= usedAngle
          ? { char: "█", style: color }
          : { char: "░", style: chalk.gray });
      } else {
        line.push({ char: " ", style: null });
      }
    }
    grid.push(line);
  }

  // Center percentage text
  const pctStr = `${Math.round(pct)}%`;
  const centerRow = Math.floor(rows / 2);
  const startCol = Math.floor(centerX - pctStr.length / 2);
  for (let i = 0; i < pctStr.length; i++) {
    const colIdx = startCol + i;
    if (colIdx >= 0 && colIdx < cols) {
      grid[centerRow]![colIdx] = { char: pctStr[i]!, style: boldColor };
    }
  }

  // Label below percentage
  const labelRow = centerRow + 1;
  const labelStart = Math.floor(centerX - label.length / 2);
  if (labelRow < rows) {
    for (let i = 0; i < label.length; i++) {
      const colIdx = labelStart + i;
      if (colIdx >= 0 && colIdx < cols) {
        grid[labelRow]![colIdx] = { char: label[i]!, style: chalk.dim };
      }
    }
  }

  const lines: string[] = [];
  for (const row of grid) {
    let line = "";
    for (const cell of row) {
      line += cell.style ? cell.style(cell.char) : cell.char;
    }
    lines.push(line);
  }

  return (
    <Box flexDirection="column" alignItems="center" paddingY={0}>
      {lines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
      {resetTime && <Text dimColor>Resets {formatResetTime(resetTime)}</Text>}
    </Box>
  );
}
