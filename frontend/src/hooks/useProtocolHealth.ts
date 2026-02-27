"use client";

import { useState, useEffect, useCallback } from "react";

interface ProtocolHealthData {
  tvl: number;
  totalCollateral: number;
  totalDebt: number;
  protocolReserves: number;
}

function getMockHealthData(): ProtocolHealthData {
  return {
    tvl: 1_250_000,
    totalCollateral: 750_000,
    totalDebt: 450_000,
    protocolReserves: 45_000,
  };
}

export function useProtocolHealth() {
  const [data, setData] = useState<ProtocolHealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockHealthData());
          setIsLoading(false);
        } catch {
          setIsError(true);
          setIsLoading(false);
        }
      }, 400);
    };
    load();
    const interval = setInterval(load, 12_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const refetch = useCallback(() => {
    setIsLoading(true);
    setIsError(false);
    setTimeout(() => {
      try {
        setData(getMockHealthData());
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 400);
  }, []);

  return { data, isLoading, isError, refetch };
}
