"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useDisconnect } from "wagmi";

interface SessionResponse {
  address: string | null;
  chainId?: number;
  authenticated: boolean;
}

export interface UseSessionReturn {
  address: string | null;
  status: "loading" | "authenticated" | "unauthenticated";
  signOut: () => Promise<void>;
}

export function useSession(): UseSessionReturn {
  const router = useRouter();
  const { disconnect } = useDisconnect();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SessionResponse>({
    queryKey: ["chariot-session"],
    queryFn: () => fetch("/api/auth/session").then((r) => r.json()),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.removeQueries({ queryKey: ["chariot-session"] });
    disconnect();
    router.push("/sign-in");
  }, [disconnect, router, queryClient]);

  const status = isLoading
    ? "loading"
    : data?.authenticated
      ? "authenticated"
      : "unauthenticated";

  return {
    address: data?.address ?? null,
    status,
    signOut,
  };
}
