/**
 * Plain-language definitions for DeFi terms used throughout the Chariot UI.
 * Each entry maps a term key to a human-readable explanation.
 */

export const EDUCATION_CONTENT: Record<string, { title: string; description: string }> = {
  ltv: {
    title: "Loan-to-Value (LTV)",
    description:
      "The percentage of your collateral's value you can borrow. For example, at 75% LTV with $10,000 in collateral, you can borrow up to $7,500 USDC.",
  },
  healthFactor: {
    title: "Health Factor",
    description:
      "A safety score for your loan. Above 1.0 means your position is safe. Below 1.0 means you may be liquidated. The higher the number, the safer your position.",
  },
  utilisation: {
    title: "Utilisation Rate",
    description:
      "How much of the lending pool is currently borrowed. Higher utilisation means more capital is working but also increases borrow rates.",
  },
  apy: {
    title: "Annual Percentage Yield (APY)",
    description:
      "Your expected return over a year, including compounding. Chariot's APY comes from two sources: T-Bill yield on idle capital and borrower interest payments.",
  },
  volatilityPremium: {
    title: "Volatility Premium",
    description:
      "An extra interest charge when the market is volatile. This protects lenders during turbulent periods by making borrowing more expensive when risk is higher.",
  },
  concentrationPremium: {
    title: "Concentration Premium",
    description:
      "An extra charge when one borrower holds a large share of the pool. This discourages concentration risk and protects the protocol from single-borrower exposure.",
  },
  sharePrice: {
    title: "Share Price (chUSDC)",
    description:
      "The value of one chUSDC token in USDC. As the vault earns yield, the share price increases -- your chUSDC tokens become worth more USDC over time.",
  },
  circuitBreaker: {
    title: "Circuit Breaker",
    description:
      "An automatic safety mechanism that restricts operations when the protocol detects unusual market stress. It helps protect all users' funds during extreme conditions.",
  },
  borrowRate: {
    title: "Borrow Rate",
    description:
      "The annual interest rate you pay on borrowed USDC. It's made up of the base utilisation rate plus any active risk premiums from volatility or concentration.",
  },
  supplyRate: {
    title: "Supply Rate",
    description:
      "The annual yield earned by lenders. Combines interest from borrowers and yield from idle capital invested in T-Bill-backed USYC tokens.",
  },
  tbillYield: {
    title: "T-Bill Yield",
    description:
      "Yield earned from idle USDC that isn't currently lent to borrowers. This capital is invested in Hashnote USYC tokens backed by US Treasury Bills.",
  },
  liquidation: {
    title: "Liquidation",
    description:
      "When your health factor drops below 1.0, your collateral can be partially sold to repay your debt. Keeping a healthy safety margin prevents this.",
  },
  liquidationThreshold: {
    title: "Liquidation Threshold",
    description:
      "The collateral ratio at which your position becomes eligible for liquidation. It's set above the LTV to give you a safety buffer.",
  },
} as const;

export type EducationTerm = keyof typeof EDUCATION_CONTENT;
