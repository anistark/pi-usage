import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";

import { isAuthenticated, getValidOAuthToken, detectPlanType } from "./auth/index.js";
import { getAvailableProviders, getAllProviders } from "./providers/index.js";
import type { UsageProvider, ProviderUsage } from "./providers/types.js";
import { RateLimitError } from "./providers/claude.js";
import { loadConfig } from "./config.js";
import { HeaderBar } from "./components/HeaderBar.js";
import { ProviderTabs } from "./components/ProviderTabs.js";
import { QuotaPanel } from "./components/QuotaPanel.js";

interface AppProps {
  version?: string;
}

export function App({ version = "" }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [termRows, setTermRows] = useState(stdout.rows ?? 24);

  const configRef = useRef(loadConfig());
  const baseRefreshInterval = configRef.current.refresh_interval;
  const [refreshInterval, setRefreshInterval] = useState(baseRefreshInterval);

  const [providers, setProviders] = useState<UsageProvider[]>([]);
  const [activeProviderId, setActiveProviderId] = useState(configRef.current.default_provider);
  const [usageData, setUsageData] = useState<Map<string, ProviderUsage>>(new Map());
  const [planType, setPlanType] = useState(detectPlanType());
  const [lastRefreshAgo, setLastRefreshAgo] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const lastRefreshTime = useRef(0);

  useEffect(() => {
    const onResize = () => setTermRows(stdout.rows ?? 24);
    stdout.on("resize", onResize);
    return () => { stdout.off("resize", onResize); };
  }, [stdout]);

  // Discover available providers on mount
  useEffect(() => {
    getAvailableProviders().then((avail) => {
      setProviders(avail.length > 0 ? avail : getAllProviders());
      if (avail.length > 0 && !avail.find((p) => p.id === activeProviderId)) {
        setActiveProviderId(avail[0]!.id);
      }
    });
  }, []);

  const activeProvider = providers.find((p) => p.id === activeProviderId);

  const doRefresh = useCallback(async () => {
    if (!activeProvider) return;
    setIsLoading(true);
    setErrorMessage("");

    try {
      const usage = await activeProvider.fetchUsage();
      setUsageData((prev) => new Map(prev).set(activeProviderId, usage));
      lastRefreshTime.current = Date.now();
      setLastRefreshAgo(0);
      setRefreshInterval(baseRefreshInterval);

      if (activeProviderId === "claude") {
        setPlanType(detectPlanType());
      }
    } catch (e) {
      if (e instanceof RateLimitError) {
        const backoffSec = Math.ceil(e.retryAfterMs / 1000);
        setRefreshInterval(backoffSec);
        setErrorMessage(`Rate limited — backing off ${backoffSec}s`);
      } else {
        setErrorMessage(e instanceof Error ? e.message : `${e}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeProvider, activeProviderId, baseRefreshInterval]);

  useEffect(() => { doRefresh(); }, [doRefresh]);

  useEffect(() => {
    const id = setInterval(doRefresh, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [doRefresh, refreshInterval]);

  useEffect(() => {
    const id = setInterval(() => {
      if (lastRefreshTime.current > 0) {
        setLastRefreshAgo(Math.floor((Date.now() - lastRefreshTime.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useInput((input, key) => {
    if (input === "q") exit();
    else if (input === "r") doRefresh();
    else if (input === "?") setShowHelp((prev) => !prev);
    else if (key.tab && providers.length > 1) {
      const idx = providers.findIndex((p) => p.id === activeProviderId);
      const next = key.shift
        ? (idx - 1 + providers.length) % providers.length
        : (idx + 1) % providers.length;
      setActiveProviderId(providers[next]!.id);
    }
  });

  const tabs = providers.map((p) => ({ id: p.id, name: p.name, icon: p.icon }));
  const currentUsage = usageData.get(activeProviderId) ?? null;

  const footer = (
    <Box width="100%" paddingX={2} justifyContent="space-between"
      borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
      <Text dimColor>q: Quit | r: Refresh | ?: Help{providers.length > 1 ? " | Tab: Switch" : ""}</Text>
      {version && <Text dimColor>v{version}</Text>}
    </Box>
  );

  if (!isAuthenticated() && activeProviderId === "claude") {
    return (
      <Box marginTop={1}>
        <Box flexDirection="column" borderStyle="round" width="100%" height={termRows - 1}>
          <HeaderBar providerName="Claude" providerIcon="✨" lastRefreshAgo={0} isLoading={false} errorMessage="" />
          <Box flexGrow={1} paddingX={4} paddingY={2} justifyContent="center" alignItems="center">
            <Text>
              <Text bold color="yellow">Not authenticated</Text>
              {"\n\n"}Run <Text bold>pi-usage setup</Text> to authenticate.
            </Text>
          </Box>
          {footer}
        </Box>
      </Box>
    );
  }

  if (showHelp) {
    return (
      <Box marginTop={1}>
        <Box flexDirection="column" borderStyle="round" width="100%" height={termRows - 1}>
          <HeaderBar
            providerName={activeProvider?.name ?? ""}
            providerIcon={activeProvider?.icon ?? ""}
            planType={activeProviderId === "claude" ? planType : undefined}
            lastRefreshAgo={lastRefreshAgo} isLoading={isLoading} errorMessage={errorMessage}
          />
          <Box flexGrow={1} paddingX={4} paddingY={2} flexDirection="column" justifyContent="center">
            <Text bold>Keybindings</Text>
            <Text>  q — Quit</Text>
            <Text>  r — Force refresh</Text>
            <Text>  ? — Toggle help</Text>
            {providers.length > 1 && <Text>  Tab — Switch provider</Text>}
          </Box>
          {footer}
        </Box>
      </Box>
    );
  }

  return (
    <Box marginTop={1}>
      <Box flexDirection="column" borderStyle="round" width="100%" height={termRows - 1}>
        <HeaderBar
          providerName={activeProvider?.name ?? ""}
          providerIcon={activeProvider?.icon ?? ""}
          planType={activeProviderId === "claude" ? planType : undefined}
          lastRefreshAgo={lastRefreshAgo} isLoading={isLoading} errorMessage={errorMessage}
        />
        <ProviderTabs tabs={tabs} activeId={activeProviderId} />
        <QuotaPanel usage={currentUsage} />
        {footer}
      </Box>
    </Box>
  );
}
