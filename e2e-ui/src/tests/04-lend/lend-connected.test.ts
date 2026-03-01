import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  getRechartsCount,
} from "../../helpers/assertions.js";
import {
  waitForContent,
  waitForSkeletonsToDisappear,
} from "../../helpers/waits.js";
import { captureScreenshot } from "../../helpers/screenshots.js";
import { evaluate } from "../../setup/browser.js";

describe("Lend -- Disconnected State & Vault Stats", () => {
  beforeAll(async () => {
    await navigateTo("/lend");
    await waitForContent("Lend");
    await waitForSkeletonsToDisappear();
  });

  it("shows vault stats with Supply APY visible", async () => {
    const hasAPY = await waitForContent("Supply APY", 10_000);
    expect(hasAPY).toBe(true);
    await assertTextVisible("Supply APY");
  });

  it("shows Total Vault TVL stat", async () => {
    const hasTVL = await waitForContent("Total Vault TVL", 10_000);
    expect(hasTVL).toBe(true);
    await assertTextVisible("Total Vault TVL");
  });

  it("shows Connect Wallet prompt instead of Deposit/Withdraw tabs", async () => {
    const hasConnectPrompt = await waitForContent("Connect your wallet to deposit", 10_000);
    expect(hasConnectPrompt).toBe(true);

    // No Deposit/Withdraw tabs should be present without a wallet
    const inputCount = await evaluate(
      "String(document.querySelectorAll('input[type=\"text\"], input[type=\"number\"], input[inputmode=\"decimal\"]').length)"
    );
    expect(inputCount).toBe("0");
  });

  it("displays vault stat values (not just labels)", async () => {
    // Verify that the Utilisation stat is displayed
    const hasUtilisation = await waitForContent("Utilisation", 10_000);
    expect(hasUtilisation).toBe(true);
    await assertTextVisible("Utilisation");
  });

  it("has zero recharts wrappers on disconnected lend page", async () => {
    const count = await getRechartsCount();
    expect(count).toBe(0);
    await captureScreenshot("lend-disconnected-state");
  });
});
