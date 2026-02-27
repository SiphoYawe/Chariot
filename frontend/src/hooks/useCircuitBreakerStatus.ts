"use client";

import { useState, useEffect, useCallback } from "react";
import type { CircuitBreakerLevel } from "@chariot/shared";

export function useCircuitBreakerStatus() {
  const [level, setLevel] = useState<CircuitBreakerLevel>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () => {
      setTimeout(() => {
        if (!active) return;
        setLevel(0); // Normal in mock
        setIsLoading(false);
      }, 200);
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
      setLevel(0);
      setIsLoading(false);
    }, 200);
  }, []);

  return { level, isLoading, isError, refetch };
}
