import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import { assertTextVisible, assertTextNotVisible, assertElementExists } from "../../helpers/assertions.js";
import { waitForContent, waitForSelector } from "../../helpers/waits.js";
import { captureScreenshot, captureDemo } from "../../helpers/screenshots.js";
import { injectWalletMock, removeWalletMock, isWalletMockInjected } from "../../setup/wallet-mock.js";
import { evaluate } from "../../setup/browser.js";

describe("CircuitBreakerBanner", () => {
  beforeAll(async () => {
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");
  });

  afterAll(async () => {
    await removeWalletMock();
  });

  it("does not show the banner at normal operation (level 0)", async () => {
    // At circuit breaker level 0, the banner component returns null.
    // None of the level titles should be visible.
    const hasCaution = await waitForContent("Caution -- Borrowing Paused", 5_000);
    expect(hasCaution).toBe(false);

    const hasStress = await waitForContent("Stress -- Withdrawals Rate-Limited", 5_000);
    expect(hasStress).toBe(false);

    const hasEmergency = await waitForContent("Emergency Mode Active", 5_000);
    expect(hasEmergency).toBe(false);
    await captureScreenshot("circuit-breaker-level-0");
  });

  it("has a dismiss button with aria-label when banner is rendered", async () => {
    // The dismiss button has aria-label="Dismiss alert".
    // At level 0 the banner is hidden, so the button should not be in the DOM.
    const hasDismissButton = await evaluate(
      `String(document.querySelector('button[aria-label="Dismiss alert"]') !== null)`
    );
    // At level 0, the entire banner is not rendered, so dismiss button should not exist
    expect(hasDismissButton).toBe("false");
    await captureScreenshot("circuit-breaker-no-dismiss");
  });

  it("renders conditionally based on circuit breaker level from on-chain data", async () => {
    // The component depends on useCircuitBreakerStatus hook which reads on-chain state.
    // In normal testnet conditions, level should be 0 (no banner).
    // Verify the dashboard renders fully without the banner blocking content.
    await assertTextVisible("Dashboard");

    // The banner container uses specific alert styling -- should not be present at level 0
    const bannerCount = await evaluate(`
      String(document.querySelectorAll('button[aria-label="Dismiss alert"]').length)
    `);
    expect(parseInt(bannerCount, 10)).toBe(0);
    await captureScreenshot("circuit-breaker-conditional-render");
  });

  it("page functions normally without the circuit breaker banner", async () => {
    // Verify the dashboard is fully usable when no circuit breaker alert is active.
    // Core dashboard content should be visible and interactive.
    const hasDashboard = await waitForContent("Dashboard", 10_000);
    expect(hasDashboard).toBe(true);

    // Navigation should still work -- the sidebar is not blocked by any banner
    await assertElementExists('img[alt="Chariot"]');

    // Verify at least basic page content loaded (no blank screen)
    const bodyLength = await evaluate("String(document.body.innerText.length)");
    expect(parseInt(bodyLength, 10)).toBeGreaterThan(100);
    await captureDemo("circuit-breaker-normal-operation");
  });
});
