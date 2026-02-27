"use client";

import { useState, useEffect, useCallback } from "react";
import { POLLING_INTERVAL_MS } from "@chariot/shared";

interface ETHUSDPriceData {
  /** ETH price in USD */
  price: number;
  /** Last update timestamp (seconds) */
  lastUpdated: number;
  /** Whether the price is stale (> 1 hour) */
  isStale: boolean;
}

function getMockETHUSDPrice(): ETHUSDPriceData {
  // Mock price with slight variance
  const base = 2450;
  const jitter = (Math.random() - 0.5) * 20;
  return {
    price: base + jitter,
    lastUpdated: Math.floor(Date.now() / 1000),
    isStale: false,
  };
}

/**
 * Hook for fetching the current ETH/USD price from Stork oracle.
 * Uses mock data until contracts are deployed.
 *
 * When ABIs are populated, replace with:
 * - useReadContract for StorkOracle.getTemporalNumericValueV1(ETHUSD_FEED_ID)
 */
export function useETHUSDPrice() {
  const [data, setData] = useState<ETHUSDPriceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        try {
          setData(getMockETHUSDPrice());
          setIsLoading(false);
        } catch {
          setIsError(true);
          setIsLoading(false);
        }
      }, 200);
    };
    load();
    const interval = setInterval(load, POLLING_INTERVAL_MS);
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
        setData(getMockETHUSDPrice());
        setIsLoading(false);
      } catch {
        setIsError(true);
        setIsLoading(false);
      }
    }, 200);
  }, []);

  return { data, isLoading, isError, refetch };
}
