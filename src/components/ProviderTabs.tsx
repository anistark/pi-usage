import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";

interface ProviderTab {
  id: string;
  name: string;
  icon: string;
}

interface ProviderTabsProps {
  tabs: ProviderTab[];
  activeId: string;
}

export function ProviderTabs({ tabs, activeId }: ProviderTabsProps): React.ReactElement {
  if (tabs.length <= 1) return <></>;

  return (
    <Box paddingX={2} gap={1}>
      {tabs.map((tab, i) => {
        const isActive = tab.id === activeId;
        const label = `${tab.icon} ${tab.name}`;
        return (
          <Text key={tab.id}>
            {isActive ? chalk.bold.inverse(` ${label} `) : chalk.dim(` ${label} `)}
            {i < tabs.length - 1 ? chalk.dim(" │") : ""}
          </Text>
        );
      })}
    </Box>
  );
}
