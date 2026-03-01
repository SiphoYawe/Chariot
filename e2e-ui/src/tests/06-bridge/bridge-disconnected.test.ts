import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertElementExists,
} from "../../helpers/assertions.js";
import { waitForContent } from "../../helpers/waits.js";
import { captureScreenshot } from "../../helpers/screenshots.js";
import { evaluate } from "../../setup/browser.js";

describe("Bridge (Borrow Page) -- Disconnected Wallet", () => {
  beforeAll(async () => {
    await navigateTo("/borrow");
    await waitForContent("Borrow", 15_000);
  });

  it("displays the Borrow page header (bridge is embedded here)", async () => {
    await assertTextVisible("Borrow");
  });

  it("shows the connect wallet prompt mentioning ETH collateral", async () => {
    const hasConnect = await waitForContent("Connect Wallet", 10_000);
    expect(hasConnect).toBe(true);
    await assertTextVisible("Borrow");
  });

  it("has a Connect Wallet button for disconnected users", async () => {
    // The EmptyState component renders a Connect Wallet action button
    const hasButton = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.some(b => b.textContent.includes('Connect Wallet')) ? 'true' : 'false';
      })()
    `);
    expect(hasButton).toBe("true");
    await captureScreenshot("bridge-disconnected-connect-button");
  });

  it("does not show the CollateralDepositFlow stepper when disconnected", async () => {
    // The deposit flow stepper should not be visible without a connected wallet
    const hasDepositFlow = await waitForContent("Lock ETH on Ethereum Sepolia", 3_000);
    expect(hasDepositFlow).toBe(false);
  });
});
