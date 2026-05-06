"use client";

import { useMemo, useRef } from "react";
import { useMarketEthPrice } from "./useMarketEthPrice";

interface OraclePriceData {
  ethPrice: number;
  lastUpdated: number;
}

export function useOraclePrice() {
  const { price, isLoading, isError, refetch } = useMarketEthPrice();
  const lastFetchRef = useRef<number>(Math.floor(Date.now() / 1000));

  const data = useMemo((): OraclePriceData | null => {
    if (price === null) return null;
    lastFetchRef.current = Math.floor(Date.now() / 1000);
    return { ethPrice: price, lastUpdated: lastFetchRef.current };
  }, [price]);

  return { data, isLoading, isError, refetch };
}
