import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";

interface HeaderBarProps {
  providerName: string;
  providerIcon: string;
  planType?: string;
  lastRefreshAgo: number;
  isLoading: boolean;
  errorMessage: string;
}

export function HeaderBar({
  providerName,
  providerIcon,
  planType,
  lastRefreshAgo,
  isLoading,
  errorMessage,
}: HeaderBarProps): React.ReactElement {
  const planBadge = planType ? chalk.bold.cyan(` [${planType.toUpperCase()}]`) : "";

  let status: string;
  if (errorMessage) {
    status = chalk.bold.red(`! ${errorMessage}`);
  } else if (isLoading) {
    status = chalk.dim("⟳ loading...");
  } else if (lastRefreshAgo === 0) {
    status = chalk.green("⟳ just now");
  } else {
    status = chalk.dim(`⟳ ${lastRefreshAgo}s ago`);
  }

  return (
    <Box
      width="100%"
      paddingX={2}
      justifyContent="space-between"
      alignItems="center"
      borderStyle="single"
      borderBottom
      borderTop={false}
      borderLeft={false}
      borderRight={false}
    >
      <Text>
        {chalk.bold(`${providerIcon} ${providerName}`)}
        {planBadge}
      </Text>
      <Text>{status}</Text>
    </Box>
  );
}
