import { http, createConfig } from "wagmi";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  rainbowWallet,
  rabbyWallet,
  trustWallet,
  braveWallet,
  injectedWallet,
  phantomWallet,
  okxWallet,
  ledgerWallet,
  zerionWallet,
  safeWallet,
  uniswapWallet,
  bitgetWallet,
  bybitWallet,
  krakenWallet,
  binanceWallet,
  frameWallet,
  argentWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { arcTestnet, ethereumSepolia } from "./chains";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [
        metaMaskWallet,
        coinbaseWallet,
        walletConnectWallet,
        rabbyWallet,
        phantomWallet,
        okxWallet,
      ],
    },
    {
      groupName: "Hardware & Smart Wallets",
      wallets: [
        ledgerWallet,
        safeWallet,
        frameWallet,
      ],
    },
    {
      groupName: "Exchange Wallets",
      wallets: [
        binanceWallet,
        bybitWallet,
        krakenWallet,
        bitgetWallet,
        uniswapWallet,
      ],
    },
    {
      groupName: "More",
      wallets: [
        rainbowWallet,
        trustWallet,
        zerionWallet,
        argentWallet,
        braveWallet,
        injectedWallet,
      ],
    },
  ],
  {
    appName: "Chariot",
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [arcTestnet, ethereumSepolia],
  transports: {
    [arcTestnet.id]: http(arcTestnet.rpcUrls.default.http[0]),
    [ethereumSepolia.id]: http(ethereumSepolia.rpcUrls.default.http[0]),
  },
  ssr: true,
});
