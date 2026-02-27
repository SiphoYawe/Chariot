import { http } from "wagmi";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arcTestnet, ethereumSepolia } from "./chains";

export const config = getDefaultConfig({
  appName: "Chariot",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: [arcTestnet, ethereumSepolia],
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
    [ethereumSepolia.id]: http(ethereumSepolia.rpcUrls.default.http[0]),
  },
  ssr: true,
});
