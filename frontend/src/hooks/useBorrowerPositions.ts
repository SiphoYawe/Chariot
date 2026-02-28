"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface BorrowerPosition {
  address: string;
  collateralType: string;
  collateralAmount: number;
  collateralValueUSD: number;
  debtAmount: number;
  healthFactor: number;
}

// Mock borrower positions data for demo
// In production, this would index CollateralDeposited/Borrowed events and query each position
function getMockPositions(): BorrowerPosition[] {
  return [
    {
      address: "0x1234567890abcdef1234567890abcdef12345678",
      collateralType: "BridgedETH",
      collateralAmount: 10.5,
      collateralValueUSD: 33_075,
      debtAmount: 22_000,
      healthFactor: 1.23,
    },
    {
      address: "0xabcdef1234567890abcdef1234567890abcdef12",
      collateralType: "BridgedETH",
      collateralAmount: 5.2,
      collateralValueUSD: 16_380,
      debtAmount: 12_500,
      healthFactor: 1.07,
    },
    {
      address: "0x9876543210fedcba9876543210fedcba98765432",
      collateralType: "BridgedETH",
      collateralAmount: 25.0,
      collateralValueUSD: 78_750,
      debtAmount: 42_000,
      healthFactor: 1.54,
    },
    {
      address: "0xdeadbeef12345678deadbeef12345678deadbeef",
      collateralType: "BridgedETH",
      collateralAmount: 2.1,
      collateralValueUSD: 6_615,
      debtAmount: 5_500,
      healthFactor: 0.98,
    },
    {
      address: "0xcafebabe12345678cafebabe12345678cafebabe",
      collateralType: "BridgedETH",
      collateralAmount: 15.8,
      collateralValueUSD: 49_770,
      debtAmount: 30_000,
      healthFactor: 1.36,
    },
    {
      address: "0x1111222233334444555566667777888899990000",
      collateralType: "BridgedETH",
      collateralAmount: 8.3,
      collateralValueUSD: 26_145,
      debtAmount: 20_000,
      healthFactor: 1.07,
    },
    {
      address: "0xaaaa1111bbbb2222cccc3333dddd4444eeee5555",
      collateralType: "BridgedETH",
      collateralAmount: 3.7,
      collateralValueUSD: 11_655,
      debtAmount: 9_200,
      healthFactor: 1.04,
    },
    {
      address: "0x5555666677778888999900001111222233334444",
      collateralType: "BridgedETH",
      collateralAmount: 45.0,
      collateralValueUSD: 141_750,
      debtAmount: 75_000,
      healthFactor: 1.55,
    },
  ].sort((a, b) => a.healthFactor - b.healthFactor);
}

export function useBorrowerPositions() {
  const [positions, setPositions] = useState<BorrowerPosition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setPositions(getMockPositions());
          setIsLoading(false);
        } catch {
          setIsError(true);
          setIsLoading(false);
        }
      }, 500);
    };
    load();
    const interval = setInterval(load, 12_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up refetch timer on unmount
  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      try {
        setPositions(getMockPositions());
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 500);
  }, []);

  return { positions, isLoading, isError, refetch };
}
