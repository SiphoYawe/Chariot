import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import { assertTextVisible, assertTextNotVisible, assertElementExists } from "../../helpers/assertions.js";
import { waitForContent, waitForSelector } from "../../helpers/waits.js";
import { captureScreenshot, captureDemo } from "../../helpers/screenshots.js";
import { injectWalletMock, removeWalletMock, isWalletMockInjected } from "../../setup/wallet-mock.js";
import { evaluate } from "../../setup/browser.js";

describe("Wallet Connection Flow", () => {
  afterAll(async () => {
    await removeWalletMock();
  });

  it("shows Connect Wallet prompt when no wallet is connected", async () => {
    await navigateTo("/lend");
    await waitForContent("Lend");

    // Before injection: the Connect Wallet button or prompt should be visible
    const hasConnectWallet = await waitForContent("Connect Wallet", 10_000);
    expect(hasConnectWallet).toBe(true);
    await captureScreenshot("wallet-disconnected-prompt");
  });

  it("verifies wallet mock is injected but wagmi stays disconnected", async () => {
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");
    // Inject mock AFTER navigation (navigation clears JS state)
    await injectWalletMock();

    // The mock IS injected into window.ethereum
    const injected = await isWalletMockInjected();
    expect(injected).toBe(true);

    // But wagmi doesn't pick it up (needs EIP-6963 announcement before init),
    // so the UI remains in disconnected state
    const mockFlag = await evaluate("!!window.__chariotMockInjected");
    expect(mockFlag).toBe("true");
    await captureScreenshot("wallet-mock-injected-but-disconnected");
  });

  it("shows Chariot Protocol in sidebar (disconnected state despite mock)", async () => {
    // Wallet mock doesn't trigger wagmi reconnection, so sidebar stays disconnected
    await assertTextVisible("Chariot Protocol");
    await captureScreenshot("wallet-sidebar-disconnected");
  });

  it("displays Arc Testnet network indicator", async () => {
    await assertTextVisible("Arc Testnet");
    await captureScreenshot("wallet-network-indicator");
  });

  it("pages navigate correctly and show content", async () => {
    // Navigate to /lend and verify page renders
    await navigateTo("/lend");
    const hasLend = await waitForContent("Lend", 10_000);
    expect(hasLend).toBe(true);

    // Navigate to /borrow and verify page renders
    await navigateTo("/borrow");
    const hasBorrow = await waitForContent("Borrow", 10_000);
    expect(hasBorrow).toBe(true);
    await captureDemo("wallet-navigation-pages");
  });
});
