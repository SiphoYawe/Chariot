/**
 * Wallet mock injection for e2e-ui tests.
 * Injects a mock window.ethereum provider via Playwright evaluate.
 */
import { evaluate } from "./browser.js";

// Arc Testnet chain ID: 5042002 (0x4CF832)
const ARC_TESTNET_CHAIN_ID = "0x4CF832";

// Default deployer address from e2e tests
const MOCK_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// Blockdaemon RPC for proxying read calls
const RPC_URL = "https://rpc.blockdaemon.testnet.arc.network";

/**
 * Inject a mock window.ethereum provider before wagmi detects it.
 */
export async function injectWalletMock(address?: string): Promise<void> {
  const walletAddress = address ?? MOCK_ADDRESS;

  await evaluate(`
    (() => {
      if (window.__chariotMockInjected) return 'already_injected';
      window.__chariotMockInjected = true;

      const RPC_URL = "${RPC_URL}";
      const CHAIN_ID = "${ARC_TESTNET_CHAIN_ID}";
      const ADDRESS = "${walletAddress}";

      const listeners = {};

      async function proxyRpc(method, params) {
        const res = await fetch(RPC_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
        });
        const json = await res.json();
        return json.result;
      }

      window.ethereum = {
        isMetaMask: true,
        isConnected: () => true,
        selectedAddress: ADDRESS,
        chainId: CHAIN_ID,
        networkVersion: String(parseInt(CHAIN_ID, 16)),

        on(event, cb) {
          if (!listeners[event]) listeners[event] = [];
          listeners[event].push(cb);
        },
        removeListener(event, cb) {
          if (listeners[event]) {
            listeners[event] = listeners[event].filter(l => l !== cb);
          }
        },
        removeAllListeners(event) {
          if (event) delete listeners[event];
          else Object.keys(listeners).forEach(k => delete listeners[k]);
        },

        async request({ method, params }) {
          switch (method) {
            case "eth_chainId":
              return CHAIN_ID;
            case "net_version":
              return String(parseInt(CHAIN_ID, 16));
            case "eth_accounts":
            case "eth_requestAccounts":
              return [ADDRESS];
            case "eth_sendTransaction":
              throw new Error("Mock wallet: transactions rejected in test mode");
            case "wallet_switchEthereumChain":
              return null;
            case "wallet_addEthereumChain":
              return null;
            case "personal_sign":
            case "eth_signTypedData_v4":
              return "0x" + "ab".repeat(65);
            default:
              return proxyRpc(method, params);
          }
        },
      };

      window.dispatchEvent(new Event("ethereum#initialized"));
      return 'injected';
    })()
  `);
}

/**
 * Remove the mock wallet provider.
 */
export async function removeWalletMock(): Promise<void> {
  await evaluate(`
    (() => {
      delete window.ethereum;
      delete window.__chariotMockInjected;
      return 'removed';
    })()
  `);
}

/**
 * Check if the wallet mock is currently injected.
 */
export async function isWalletMockInjected(): Promise<boolean> {
  const result = await evaluate("!!window.__chariotMockInjected");
  return result === "true";
}
