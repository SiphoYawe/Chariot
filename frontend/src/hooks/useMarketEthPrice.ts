"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd";
const POLL_MS = 10_000;

/**
 * Fetches live ETH/USD price from CoinGecko's public API.
 * No API key required. Falls back gracefully on error.
 */
export function useMarketEthPrice() {
  const [price, setPrice] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch(COINGECKO_URL);
      if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
      const json = (await res.json()) as { ethereum: { usd: number } };
      setPrice(json.ethereum.usd);
      setIsError(false);
    } catch {
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrice();
    intervalRef.current = setInterval(fetchPrice, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchPrice]);

  return { price, isLoading, isError, refetch: fetchPrice };
}
