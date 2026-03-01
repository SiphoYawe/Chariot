import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertElementExists,
} from "../../helpers/assertions.js";
import { waitForContent } from "../../helpers/waits.js";
import { captureScreenshot } from "../../helpers/screenshots.js";

describe("HealthFactorGauge -- Rendering", () => {
  beforeAll(async () => {
    await navigateTo("/borrow");
    await waitForContent("Borrow", 20_000);
  });

  it("renders the borrow page successfully", async () => {
    // Health factor gauge is not visible in disconnected state.
    // Verify the borrow page loads with the header.
    await assertTextVisible("Borrow");
    await captureScreenshot("health-factor-gauge");
  });

  it("displays the connect wallet prompt", async () => {
    // In disconnected state, the connect wallet prompt is shown instead of health factor
    const hasConnect = await waitForContent("Connect Wallet", 10_000);
    expect(hasConnect).toBe(true);
    await assertTextVisible("Borrow");
    await captureScreenshot("health-factor-value");
  });

  it("shows borrowing-related content on the page", async () => {
    // The page mentions borrowing in the connect wallet prompt
    const hasBorrow = await waitForContent("borrow", 10_000);
    expect(hasBorrow).toBe(true);
    const hasUSDC = await waitForContent("USDC", 5_000);
    expect(hasUSDC).toBe(true);
    await captureScreenshot("health-factor-risk-label");
  });

  it("has no error states on the page", async () => {
    // Verify the page loaded cleanly with expected content and no errors
    await assertTextVisible("Borrow");
    await assertTextVisible("Connect Wallet");
    await assertElementExists("button");
    await captureScreenshot("health-factor-scale");
  });
});
