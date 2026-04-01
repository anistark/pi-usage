import { execFileSync, spawn } from "node:child_process";
import {
  chmodSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { webcrypto } from "node:crypto";

const CONFIG_DIR = join(homedir(), ".config", "pi-usage");
const TOKEN_FILE = join(CONFIG_DIR, "token.json");
const CLAUDE_CREDENTIALS_FILE = join(homedir(), ".claude", ".credentials.json");

const OAUTH_CONFIG = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorizeUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://console.anthropic.com/v1/oauth/token",
  redirectUri: "https://console.anthropic.com/oauth/code/callback",
  scopes: "org:create_api_key user:profile user:inference",
  usageUrl: "https://api.anthropic.com/api/oauth/usage",
  betaHeader: "oauth-2025-04-20",
};

interface OAuthCredentials {
  accessToken?: string;
  refreshToken?: string;
  subscriptionType?: string;
  expiresAt?: number;
}

function readKeychainCredentials(): Record<string, unknown> | null {
  if (platform() !== "darwin") return null;
  try {
    const raw = execFileSync(
      "/usr/bin/security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { timeout: 5000, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
    );
    if (!raw.trim()) return null;
    return JSON.parse(raw.trim()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readFileCredentials(): Record<string, unknown> | null {
  if (!existsSync(CLAUDE_CREDENTIALS_FILE)) return null;
  try {
    const raw = readFileSync(CLAUDE_CREDENTIALS_FILE, "utf-8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getClaudeCodeCredentials(): OAuthCredentials | null {
  for (const reader of [readKeychainCredentials, readFileCredentials]) {
    const data = reader();
    if (data) {
      const oauth = data["claudeAiOauth"] as OAuthCredentials | undefined;
      if (oauth?.accessToken) return oauth;
    }
  }
  return null;
}

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

export function storeToken(tokenData: Record<string, unknown>): void {
  ensureConfigDir();
  writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
  chmodSync(TOKEN_FILE, 0o600);
}

export function loadToken(): Record<string, unknown> | null {
  if (!existsSync(TOKEN_FILE)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getOAuthToken(): string | null {
  const creds = getClaudeCodeCredentials();
  if (creds?.accessToken) {
    if (!creds.expiresAt || creds.expiresAt > Date.now()) return creds.accessToken;
  }

  const tokenData = loadToken();
  if (!tokenData) return null;

  const expiresAt = tokenData["expires_at"] as number | undefined;
  if (expiresAt && expiresAt < Date.now()) return null;

  return (tokenData["oauth_token"] as string) ?? null;
}

async function refreshToken(refreshTokenStr: string): Promise<string | null> {

  let resp: Response;
  try {
    resp = await fetch(OAUTH_CONFIG.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        client_id: OAUTH_CONFIG.clientId,
        refresh_token: refreshTokenStr,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return null;
  }

  if (!resp.ok) return null;

  const data = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const expiresAt = Date.now() + data.expires_in * 1000 - 5 * 60 * 1000;
  storeToken({
    oauth_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: expiresAt,
  });

  return data.access_token;
}

/** Get a valid OAuth token, refreshing if expired. */
export async function getValidOAuthToken(): Promise<string | null> {
  const token = getOAuthToken();
  if (token) return token;

  // Try refreshing from Claude Code keychain/file credentials
  const creds = getClaudeCodeCredentials();
  if (creds?.refreshToken) {
    const refreshed = await refreshToken(creds.refreshToken);
    if (refreshed) return refreshed;
  }

  // Try refreshing from our own stored token
  const tokenData = loadToken();
  const storedRefresh = tokenData?.["refresh_token"] as string | undefined;
  if (storedRefresh) return await refreshToken(storedRefresh);

  return null;
}

export function getSubscriptionType(): string | null {
  const creds = getClaudeCodeCredentials();
  return creds?.subscriptionType ?? null;
}

export function isAuthenticated(): boolean {
  if (getOAuthToken() !== null) return true;
  const creds = getClaudeCodeCredentials();
  if (creds?.refreshToken) return true;
  const tokenData = loadToken();
  if (tokenData?.["refresh_token"]) return true;
  return false;
}

export function clearToken(): void {
  if (existsSync(TOKEN_FILE)) unlinkSync(TOKEN_FILE);
}

const PLAN_NAMES: Record<string, string> = {
  default_claude_pro: "pro",
  default_claude_max_5x: "max",
  default_claude_max_20x: "max",
};

export function detectPlanType(): string {
  const subType = getSubscriptionType();
  if (subType) {
    const plan = PLAN_NAMES[subType];
    if (plan) return plan;
    const lower = subType.toLowerCase();
    if (lower.includes("max")) return "max";
    if (lower.includes("pro")) return "pro";
  }
  return "pro";
}

export { OAUTH_CONFIG };

// ---------------------------------------------------------------------------
// PKCE OAuth flow
// ---------------------------------------------------------------------------

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const crypto = webcrypto as unknown as Crypto;
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = base64urlEncode(verifierBytes);

  const data = new TextEncoder().encode(verifier);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const challenge = base64urlEncode(new Uint8Array(hashBuffer));

  return { verifier, challenge };
}

function openBrowser(url: string): boolean {
  try {
    const sys = platform().toLowerCase();
    if (sys === "darwin") {
      spawn("open", [url], { stdio: "ignore", detached: true }).unref();
      return true;
    } else if (sys === "linux") {
      spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
      return true;
    } else if (sys === "win32") {
      spawn("cmd", ["/c", "start", url], { stdio: "ignore", detached: true }).unref();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function oauthLogin(): Promise<{ accessToken: string; refreshToken: string; expiresAt: number }> {
  const { verifier, challenge } = await generatePKCE();

  const authParams = new URLSearchParams({
    code: "true",
    client_id: OAUTH_CONFIG.clientId,
    response_type: "code",
    redirect_uri: OAUTH_CONFIG.redirectUri,
    scope: OAUTH_CONFIG.scopes,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: verifier,
  });

  const authUrl = `${OAUTH_CONFIG.authorizeUrl}?${authParams.toString()}`;

  console.log("Opening Anthropic OAuth page in your browser...\n");
  openBrowser(authUrl);
  console.log(`If the browser didn't open, visit this URL:\n  ${authUrl}\n`);
  console.log("After authorizing, copy the full authorization code (format: code#state).\n");

  const rl = createInterface({ input: stdin, output: stdout });
  const authCode = await rl.question("Paste the authorization code here: ");
  rl.close();

  if (!authCode.trim()) throw new Error("No authorization code provided.");

  const splits = authCode.trim().split("#");
  const code = splits[0];
  const state = splits[1];

  const tokenResponse = await fetch(OAUTH_CONFIG.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: OAUTH_CONFIG.clientId,
      code,
      state,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      code_verifier: verifier,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const expiresAt = Date.now() + tokenData.expires_in * 1000 - 5 * 60 * 1000;
  return { accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, expiresAt };
}

/** Interactive OAuth setup flow. */
export async function interactiveSetup(forceReauth = false): Promise<void> {
  console.log("=".repeat(50));
  console.log("  pi-usage Setup — Claude OAuth Authentication");
  console.log("=".repeat(50) + "\n");

  const creds = getClaudeCodeCredentials();
  if (creds && !forceReauth) {
    console.log("Found existing Claude Code credentials.");
    const token = creds.accessToken ?? "";
    if (token.length > 16) {
      console.log(`  Token: ${token.slice(0, 12)}...${token.slice(-4)}`);
    }
    const plan = detectPlanType();
    console.log(`  Plan:  ${plan.toUpperCase()}`);
    console.log("\nSetup complete! Run 'pi-usage' to launch the dashboard.");
    return;
  }

  if (forceReauth) {
    console.log("Re-authenticating (overwriting existing credentials)...\n");
    clearToken();
  } else {
    console.log("No Claude Code credentials found.\n");
  }

  try {
    const tokens = await oauthLogin();
    storeToken({
      oauth_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expires_at: tokens.expiresAt,
    });
    console.log("\nToken saved.");
    console.log(`  Plan: ${detectPlanType().toUpperCase()}`);
    console.log("\nSetup complete! Run 'pi-usage' to launch the dashboard.");
  } catch (err) {
    console.error(`\nOAuth login failed: ${err instanceof Error ? err.message : err}`);
    console.log("Run 'pi-usage setup' to try again.");
  }
}
