/**
 * Format a 6-decimal USDC amount for display.
 * e.g. 100_000_000n -> "100.000000 USDC"
 */
export function formatUSDC(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const frac = amount % 1_000_000n;
  const fracStr = frac.toString().padStart(6, "0");
  return `${whole}.${fracStr} USDC`;
}

/**
 * Format an 18-decimal ETH/bETH amount for display.
 * e.g. 1_000_000_000_000_000_000n -> "1.000000000000000000 ETH"
 */
export function formatETH(amount: bigint): string {
  const whole = amount / 10n ** 18n;
  const frac = amount % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, "0");
  return `${whole}.${fracStr} ETH`;
}

/**
 * Format an 18-decimal WAD value for display.
 * e.g. 2_460_000_000_000_000_000n -> "2.46"
 */
export function formatWAD(amount: bigint): string {
  const whole = amount / 10n ** 18n;
  const frac = amount % 10n ** 18n;
  // Show up to 6 significant decimal places
  const fracStr = frac.toString().padStart(18, "0").slice(0, 6);
  // Trim trailing zeros
  const trimmed = fracStr.replace(/0+$/, "") || "0";
  return `${whole}.${trimmed}`;
}

/**
 * Format a percentage stored as WAD (e.g. 75e16 = 75%).
 */
export function formatPercent(wadAmount: bigint): string {
  const pct = Number(wadAmount) / 1e16;
  return `${pct.toFixed(2)}%`;
}
