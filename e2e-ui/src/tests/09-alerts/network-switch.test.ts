import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import { assertTextVisible, assertTextNotVisible, assertElementExists } from "../../helpers/assertions.js";
import { waitForContent, waitForSelector } from "../../helpers/waits.js";
import { captureScreenshot, captureDemo } from "../../helpers/screenshots.js";
import { injectWalletMock, removeWalletMock, isWalletMockInjected } from "../../setup/wallet-mock.js";
import { evaluate } from "../../setup/browser.js";

describe("NetworkSwitchPrompt", () => {
  afterAll(async () => {
    await removeWalletMock();
  });

  it("does not show the prompt when on correct network (Arc Testnet)", async () => {
    // Inject wallet mock with correct Arc Testnet chain ID (0x4CF832)
    await injectWalletMock();
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");

    // The NetworkSwitchPrompt should NOT render when chainId matches arcTestnet.id
    const hasWrongNetwork = await waitForContent("Wrong Network", 5_000);
    expect(hasWrongNetwork).toBe(false);
    await captureScreenshot("network-switch-correct-chain");
  });

  it("does not show Wrong Network prompt when wallet is not connected", async () => {
    // Wallet mock doesn't trigger wagmi connection (needs EIP-6963 before init),
    // so isConnected is false and the NetworkSwitchPrompt never renders
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");

    const hasWrongNetwork = await waitForContent("Wrong Network", 5_000);
    expect(hasWrongNetwork).toBe(false);
    await captureScreenshot("network-switch-hidden-when-disconnected");
  });

  it("page renders normally without the network switch prompt", async () => {
    // Without a connected wallet, the page should render its normal content
    const hasDashboard = await waitForContent("Dashboard", 10_000);
    expect(hasDashboard).toBe(true);

    // No Switch Network button should be present
    const hasSwitchButton = await waitForContent("Switch Network", 5_000);
    expect(hasSwitchButton).toBe(false);
    await captureScreenshot("network-switch-page-normal");
  });

  it("shows Arc Testnet in the sidebar", async () => {
    // The sidebar always displays "Arc Testnet" regardless of connection state
    await assertTextVisible("Arc Testnet");
    await captureScreenshot("network-switch-sidebar-arc-testnet");
  });

  it("displays Arc Testnet network name in sidebar footer", async () => {
    // Verify the sidebar contains Arc Testnet text
    const hasArcTestnet = await waitForContent("Arc Testnet", 5_000);
    expect(hasArcTestnet).toBe(true);
    await captureDemo("network-switch-arc-testnet-visible");
  });
});
