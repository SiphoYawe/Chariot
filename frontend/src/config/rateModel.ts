import { RATE_MODEL } from "@chariot/shared";

export interface RateTableRow {
  utilisation: number;
  borrowRate: number;
  supplyAPY: number;
}

function calculateBorrowRate(u: number): number {
  const fraction = u / 100;
  if (fraction <= RATE_MODEL.U_OPTIMAL) {
    return (
      (RATE_MODEL.R_BASE +
        RATE_MODEL.R_SLOPE1 * (fraction / RATE_MODEL.U_OPTIMAL)) *
      100
    );
  }
  return (
    (RATE_MODEL.R_BASE +
      RATE_MODEL.R_SLOPE1 +
      RATE_MODEL.R_SLOPE2 *
        ((fraction - RATE_MODEL.U_OPTIMAL) /
          (1 - RATE_MODEL.U_OPTIMAL))) *
    100
  );
}

function calculateSupplyAPY(u: number, borrowRate: number): number {
  const fraction = u / 100;
  const borrowFraction = borrowRate / 100;
  const borrowComponent =
    borrowFraction * fraction * (1 - RATE_MODEL.RESERVE_FACTOR);
  const tbillComponent =
    RATE_MODEL.USYC_YIELD * (1 - fraction) * (1 - RATE_MODEL.STRATEGY_FEE);
  return (borrowComponent + tbillComponent) * 100;
}

const UTILISATION_LEVELS = [0, 20, 40, 60, 80, 90, 95, 100];

export const RATE_TABLE_DATA: RateTableRow[] = UTILISATION_LEVELS.map((u) => {
  const borrowRate = calculateBorrowRate(u);
  const supplyAPY = calculateSupplyAPY(u, borrowRate);
  return { utilisation: u, borrowRate, supplyAPY };
});
