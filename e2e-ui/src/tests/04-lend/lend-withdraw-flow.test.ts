import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
} from "../../helpers/assertions.js";
import {
  waitForContent,
  waitForSkeletonsToDisappear,
} from "../../helpers/waits.js";
import { captureScreenshot } from "../../helpers/screenshots.js";
import { evaluate } from "../../setup/browser.js";

describe("Lend -- Withdraw Flow (Disconnected)", () => {
  beforeAll(async () => {
    await navigateTo("/lend");
    await waitForContent("Lend");
    await waitForSkeletonsToDisappear();
  });

  it("shows connect wallet message mentioning USDC", async () => {
    const hasPrompt = await waitForContent("Connect your wallet to deposit USDC", 10_000);
    expect(hasPrompt).toBe(true);
  });

  it("displays vault stats section", async () => {
    const hasAPY = await waitForContent("Supply APY", 10_000);
    expect(hasAPY).toBe(true);
    await assertTextVisible("Supply APY");

    const hasTVL = await waitForContent("Total Vault TVL", 10_000);
    expect(hasTVL).toBe(true);
    await assertTextVisible("Total Vault TVL");
  });

  it("shows utilisation information in vault stats", async () => {
    const hasUtilisation = await waitForContent("Utilisation", 10_000);
    expect(hasUtilisation).toBe(true);
    await assertTextVisible("Utilisation");
  });

  it("has no input fields or tabs without wallet connection", async () => {
    // No input fields should exist in disconnected state
    const inputCount = await evaluate(
      "String(document.querySelectorAll('input[type=\"text\"], input[type=\"number\"], input[inputmode=\"decimal\"]').length)"
    );
    expect(inputCount).toBe("0");

    // No Deposit/Withdraw tab triggers should be present
    const tabCount = await evaluate(
      "String(document.querySelectorAll('[data-slot=\"tabs-trigger\"], [role=\"tab\"]').length)"
    );
    expect(Number(tabCount)).toBe(0);
  });

  it("shows Connect Wallet button", async () => {
    const hasConnectWallet = await waitForContent("Connect Wallet", 10_000);
    expect(hasConnectWallet).toBe(true);

    const buttonExists = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('Connect Wallet'));
        return btn ? 'found' : 'not_found';
      })()
    `);
    expect(buttonExists).toBe("found");
    await captureScreenshot("lend-withdraw-disconnected");
  });
});
