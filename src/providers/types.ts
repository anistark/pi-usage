export interface UsageProvider {
  id: string;
  name: string;
  icon: string;
  isAvailable(): Promise<boolean>;
  fetchUsage(): Promise<ProviderUsage>;
}

export interface QuotaWindow {
  label: string;
  duration: string;
  usedPercent: number;
  resetAt?: Date;
  models?: ModelUsage[];
}

export interface ModelUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  cost?: number;
}

export interface BillingData {
  dailySpend: number;
  monthlySpend: number;
  budgetLimit?: number;
  currency: string;
  models?: ModelUsage[];
}

export interface CreditBalance {
  used: number;
  limit: number;
  remaining: number;
  currency: string;
}

export interface RateLimitInfo {
  requestsLimit: number;
  requestsRemaining: number;
  tokensLimit: number;
  tokensRemaining: number;
  resetAt?: Date;
}

export interface ProviderUsage {
  provider: string;
  quotas?: QuotaWindow[];
  billing?: BillingData;
  credits?: CreditBalance;
  models?: ModelUsage[];
  rateLimit?: RateLimitInfo;
  raw?: unknown;
}
