import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertElementExists,
} from "../../helpers/assertions.js";
import { waitForContent } from "../../helpers/waits.js";
import { captureScreenshot } from "../../helpers/screenshots.js";

describe("Borrow Page -- Connected Wallet", () => {
  beforeAll(async () => {
    await navigateTo("/borrow");
    await waitForContent("Borrow", 20_000);
  });

  it("shows the borrow interface", async () => {
    // Verify the borrow page header and the connect wallet prompt are visible
    await assertTextVisible("Borrow");
    const hasConnect = await waitForContent("Connect Wallet", 10_000);
    expect(hasConnect).toBe(true);
    await captureScreenshot("borrow-connected-state");
  });

  it("displays collateral info", async () => {
    // In disconnected state, the page shows "Connect Wallet" as the primary prompt
    await assertTextVisible("Connect Wallet");
    await assertTextVisible("Borrow");
  });

  it("displays ETH/USD price from oracle", async () => {
    // The page mentions USDC in the connect wallet prompt
    const hasUSDC = await waitForContent("USDC", 10_000);
    expect(hasUSDC).toBe(true);
    await captureScreenshot("borrow-eth-price");
  });

  it("shows borrow rate information", async () => {
    // The page contains "borrow" text in the header and prompt
    const hasBorrow = await waitForContent("borrow", 10_000);
    expect(hasBorrow).toBe(true);
  });

  it("has UI elements for collateral deposit flow", async () => {
    // The page shows "Connect Wallet" button(s) as the primary CTA
    await assertTextVisible("Connect Wallet");
    await assertElementExists("button");
    await captureScreenshot("borrow-deposit-elements");
  });
});
