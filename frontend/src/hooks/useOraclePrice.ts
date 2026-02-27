"use client";

import { useState, useEffect, useCallback } from "react";

interface OraclePriceData {
  ethPrice: number;
  lastUpdated: number; // Unix timestamp in seconds
}

function getMockOracleData(): OraclePriceData {
  return {
    ethPrice: 3456.78,
    lastUpdated: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 15),
  };
}

export function useOraclePrice() {
  const [data, setData] = useState<OraclePriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockOracleData());
          setIsLoading(false);
        } catch {
          setIsError(true);
          setIsLoading(false);
        }
      }, 300);
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
        setData(getMockOracleData());
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 300);
  }, []);

  return { data, isLoading, isError, refetch };
}
