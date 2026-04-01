import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { parse, stringify } from "smol-toml";

export interface Config {
  refresh_interval: number;
  default_provider: string;
  enabled_providers: string[];
}

const CONFIG_DIR = join(homedir(), ".config", "pi-usage");
const CONFIG_PATH = join(CONFIG_DIR, "config.toml");

const DEFAULT_CONFIG: Config = {
  refresh_interval: 30,
  default_provider: "claude",
  enabled_providers: ["claude"],
};

export function loadConfig(): Config {
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = parse(content);
    return { ...DEFAULT_CONFIG, ...parsed } as Config;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Config): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, stringify(config as unknown as Record<string, unknown>));
}

export { CONFIG_DIR, CONFIG_PATH };
