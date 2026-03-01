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

describe("Lend -- Deposit Flow (Disconnected)", () => {
  beforeAll(async () => {
    await navigateTo("/lend");
    await waitForContent("Lend");
    await waitForSkeletonsToDisappear();
  });

  it("shows connect wallet prompt instead of deposit input", async () => {
    const hasConnectPrompt = await waitForContent("Connect your wallet to deposit", 10_000);
    expect(hasConnectPrompt).toBe(true);

    // No input fields should be present without wallet connection
    const inputCount = await evaluate(
      "String(document.querySelectorAll('input[type=\"text\"], input[type=\"number\"], input[inputmode=\"decimal\"]').length)"
    );
    expect(inputCount).toBe("0");
  });

  it("shows vault stats with Supply APY as preview data", async () => {
    const hasAPY = await waitForContent("Supply APY", 10_000);
    expect(hasAPY).toBe(true);
    await assertTextVisible("Supply APY");
  });

  it("displays Total Vault TVL in vault stats", async () => {
    const hasTVL = await waitForContent("Total Vault TVL", 10_000);
    expect(hasTVL).toBe(true);
    await assertTextVisible("Total Vault TVL");
  });

  it("shows Connect Wallet button instead of Deposit button", async () => {
    const hasConnectWallet = await waitForContent("Connect Wallet", 10_000);
    expect(hasConnectWallet).toBe(true);

    // Verify the Connect Wallet button element exists
    const buttonExists = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.includes('Connect Wallet'));
        return btn ? 'found' : 'not_found';
      })()
    `);
    expect(buttonExists).toBe("found");
    await captureScreenshot("lend-deposit-disconnected");
  });
});
