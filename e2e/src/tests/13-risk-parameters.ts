import {
  publicClient,
  CHARIOT_ADDRESSES,
  RiskParameterEngineABI,
  CollateralManagerABI,
  InterestRateModelABI,
} from "../setup.js";
import { formatPercent } from "../helpers/format.js";

const WAD = 10n ** 18n;

export const name = "Risk Parameters";

export async function run(): Promise<void> {
  const bETH = CHARIOT_ADDRESSES.BRIDGED_ETH;

  const effectiveLTV = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.RISK_PARAMETER_ENGINE,
    abi: RiskParameterEngineABI,
    functionName: "getEffectiveLTV",
    args: [bETH],
  })) as bigint;
  console.log(`    Effective LTV: ${formatPercent(effectiveLTV)}`);
  if (effectiveLTV === 0n || effectiveLTV > 76n * 10n ** 16n) {
    throw new Error(`Effective LTV out of range: ${effectiveLTV}`);
  }

  const liqThreshold = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.RISK_PARAMETER_ENGINE,
    abi: RiskParameterEngineABI,
    functionName: "getLiquidationThreshold",
    args: [bETH],
  })) as bigint;
  console.log(`    Liquidation threshold: ${formatPercent(liqThreshold)}`);
  if (liqThreshold === 0n) {
    throw new Error("Liquidation threshold is zero");
  }

  const baseLTV = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.RISK_PARAMETER_ENGINE,
    abi: RiskParameterEngineABI,
    functionName: "getBaseLTV",
    args: [bETH],
  })) as bigint;
  console.log(`    Base LTV: ${formatPercent(baseLTV)}`);
  const expected75 = 75n * 10n ** 16n;
  if (baseLTV !== expected75) {
    throw new Error(`Base LTV mismatch: expected ${expected75}, got ${baseLTV}`);
  }

  const cmLTV = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getEffectiveLTV",
  })) as bigint;
  console.log(`    CM Effective LTV: ${formatPercent(cmLTV)}`);

  const cmLiqThreshold = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.COLLATERAL_MANAGER,
    abi: CollateralManagerABI,
    functionName: "getLiquidationThreshold",
  })) as bigint;
  console.log(`    CM Liquidation threshold: ${formatPercent(cmLiqThreshold)}`);

  const rate0 = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.INTEREST_RATE_MODEL,
    abi: InterestRateModelABI,
    functionName: "getBorrowRate",
    args: [0n],
  })) as bigint;
  console.log(`    Borrow rate at 0% util: ${formatPercent(rate0)}`);

  const kink = 80n * 10n ** 16n;
  const rateKink = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.INTEREST_RATE_MODEL,
    abi: InterestRateModelABI,
    functionName: "getBorrowRate",
    args: [kink],
  })) as bigint;
  console.log(`    Borrow rate at 80% util (kink): ${formatPercent(rateKink)}`);
  if (rateKink === 0n) {
    throw new Error("Borrow rate at kink is zero");
  }

  const rate100 = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.INTEREST_RATE_MODEL,
    abi: InterestRateModelABI,
    functionName: "getBorrowRate",
    args: [WAD],
  })) as bigint;
  console.log(`    Borrow rate at 100% util: ${formatPercent(rate100)}`);
  if (rate100 <= rateKink) {
    throw new Error("Rate at 100% should be greater than rate at kink");
  }

  const reserveFactor = (await publicClient.readContract({
    address: CHARIOT_ADDRESSES.INTEREST_RATE_MODEL,
    abi: InterestRateModelABI,
    functionName: "getReserveFactor",
  })) as bigint;
  console.log(`    Reserve factor: ${formatPercent(reserveFactor)}`);
  const expected10 = 10n * 10n ** 16n;
  if (reserveFactor !== expected10) {
    throw new Error(`Reserve factor mismatch: expected ${expected10}, got ${reserveFactor}`);
  }
}
