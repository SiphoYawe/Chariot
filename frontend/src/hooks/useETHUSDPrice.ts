"use client";

import { useMemo, useRef } from "react";
import { useMarketEthPrice } from "./useMarketEthPrice";

interface ETHUSDPriceData {
  price: number;
  lastUpdated: number;
  isStale: boolean;
}

export function useETHUSDPrice() {
  const { price, isLoading, isError, refetch } = useMarketEthPrice();
  const lastFetchRef = useRef<number>(Math.floor(Date.now() / 1000));

  const data = useMemo((): ETHUSDPriceData | null => {
    if (price === null) return null;
    lastFetchRef.current = Math.floor(Date.now() / 1000);
    return { price, lastUpdated: lastFetchRef.current, isStale: false };
  }, [price]);

  return { data, isLoading, isError, refetch };
}
