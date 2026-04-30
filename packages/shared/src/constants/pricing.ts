// Pricing reference date: 2026-05-01. Verify current prices at ai.google.dev before using estimates for budgets.
export interface ModelPricing {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
}

export const geminiPricingUsd: Record<string, ModelPricing> = {
  "gemini-2.0-flash-001": { inputUsdPerMillionTokens: 0.10, outputUsdPerMillionTokens: 0.40 },
  "gemini-2.5-pro-preview": { inputUsdPerMillionTokens: 1.25, outputUsdPerMillionTokens: 10.00 },
  "gemini-2.5-pro": { inputUsdPerMillionTokens: 1.25, outputUsdPerMillionTokens: 10.00 },
  "gemini-2.0-flash": { inputUsdPerMillionTokens: 0.10, outputUsdPerMillionTokens: 0.40 }
};

export function estimateGeminiCostUsd(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing = geminiPricingUsd[model];
  if (!pricing) return null;
  return (inputTokens / 1_000_000) * pricing.inputUsdPerMillionTokens + (outputTokens / 1_000_000) * pricing.outputUsdPerMillionTokens;
}
