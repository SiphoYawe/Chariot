import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import { assertTextVisible, assertTextNotVisible, assertElementExists } from "../../helpers/assertions.js";
import { waitForContent, waitForSelector } from "../../helpers/waits.js";
import { captureScreenshot, captureDemo } from "../../helpers/screenshots.js";
import { injectWalletMock, removeWalletMock, isWalletMockInjected } from "../../setup/wallet-mock.js";
import { evaluate } from "../../setup/browser.js";

describe("Wallet States", () => {
  afterAll(async () => {
    await removeWalletMock();
  });

  it("shows 'Chariot Protocol' in sidebar when disconnected", async () => {
    // Ensure wallet mock is not present
    await removeWalletMock();
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");

    // When no wallet is connected, the sidebar footer shows "Chariot Protocol"
    await assertTextVisible("Chariot Protocol");
    await captureScreenshot("wallet-state-disconnected");
  });

  it("verifies mock injection succeeds and page remains functional", async () => {
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");
    // Inject mock AFTER navigation (navigation clears JS state)
    await injectWalletMock();

    // Mock injection succeeds
    const injected = await isWalletMockInjected();
    expect(injected).toBe(true);

    // But wagmi doesn't detect the wallet (needs EIP-6963 before init),
    // so UI stays disconnected -- "Chariot Protocol" remains visible
    await assertTextVisible("Chariot Protocol");
    await assertTextVisible("Arc Testnet");
    await captureScreenshot("wallet-state-mock-injected");
  });

  it("returns to disconnected UI after removing wallet mock", async () => {
    await removeWalletMock();
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");

    // After removing mock, the sidebar should revert to disconnected state
    await assertTextVisible("Chariot Protocol");

    const mockPresent = await isWalletMockInjected();
    expect(mockPresent).toBe(false);
    await captureScreenshot("wallet-state-after-removal");
  });

  it("always renders the wallet status section in the sidebar", async () => {
    // Whether connected or disconnected, the sidebar footer area should be present.
    // In disconnected state it shows "Chariot Protocol" and "Arc Testnet".
    await assertTextVisible("Arc Testnet");

    // Verify the sidebar itself renders by checking the logo
    await assertElementExists('img[alt="Chariot"]');
    await captureScreenshot("wallet-status-section-visible");
  });
});
