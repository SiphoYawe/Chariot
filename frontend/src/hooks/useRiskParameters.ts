"use client";

import { useMemo, useCallback } from "react";
import { useReadContract } from "wagmi";
import {
  RiskParameterEngineABI,
  CHARIOT_ADDRESSES,
  POLLING_INTERVAL_MS,
  RISK_PARAMS,
} from "@chariot/shared";

interface RiskParametersData {
  /** Dynamic effective LTV (0-1, e.g., 0.70 = 70%) */
  effectiveLTV: number;
  /** Dynamic liquidation threshold (0-1) */
  liquidationThreshold: number;
  /** Current annualized volatility (0-1, e.g., 0.35 = 35%) */
  currentVolatility: number;
  /** Base LTV before adjustment (0-1) */
  baseLTV: number;
  /** Whether RiskParameterEngine is available */
  isEngineAvailable: boolean;
}

const WAD = BigInt(10) ** BigInt(18);

/**
 * Hook for fetching dynamic risk parameters from RiskParameterEngine.
 * Reads riskParameterEngine.getRiskParameters(BRIDGED_ETH) which returns
 * (effectiveLTV, liquidationThreshold, currentVolatility) all in WAD.
 */
export function useRiskParameters(_collateralToken?: `0x${string}`) {
  const token = _collateralToken ?? CHARIOT_ADDRESSES.BRIDGED_ETH;

  const {
    data: rawRiskParams,
    isLoading: loadingParams,
    isError: errorParams,
    refetch: refetchParams,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.RISK_PARAMETER_ENGINE,
    abi: RiskParameterEngineABI,
    functionName: "getRiskParameters",
    args: [token],
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const {
    data: rawBaseLTV,
    isLoading: loadingBase,
    isError: errorBase,
    refetch: refetchBase,
  } = useReadContract({
    address: CHARIOT_ADDRESSES.RISK_PARAMETER_ENGINE,
    abi: RiskParameterEngineABI,
    functionName: "getBaseLTV",
    args: [token],
    query: { refetchInterval: POLLING_INTERVAL_MS },
  });

  const isLoading = loadingParams || loadingBase;
  const isError = errorParams || errorBase;

  const data = useMemo((): RiskParametersData | null => {
    if (rawRiskParams === undefined) return null;

    // getRiskParameters returns [effectiveLTV, liquidationThreshold, currentVolatility]
    const params = rawRiskParams as readonly [bigint, bigint, bigint];
    const effectiveLTV = Number(params[0]) / Number(WAD);
    const liquidationThreshold = Number(params[1]) / Number(WAD);
    const currentVolatility = Number(params[2]) / Number(WAD);

    // baseLTV from separate call, or fallback to constant
    const baseLTV =
      rawBaseLTV !== undefined
        ? Number(rawBaseLTV) / Number(WAD)
        : RISK_PARAMS.BRIDGED_ETH.BASE_LTV;

    return {
      effectiveLTV,
      liquidationThreshold,
      currentVolatility,
      baseLTV,
      isEngineAvailable: true,
    };
  }, [rawRiskParams, rawBaseLTV]);

  const refetch = useCallback(() => {
    refetchParams();
    refetchBase();
  }, [refetchParams, refetchBase]);

  return { data, isLoading, isError, refetch };
}
