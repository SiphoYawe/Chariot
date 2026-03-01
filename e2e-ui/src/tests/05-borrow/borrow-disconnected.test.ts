import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertTextNotVisible,
  assertElementExists,
} from "../../helpers/assertions.js";
import { waitForContent } from "../../helpers/waits.js";
import { captureScreenshot, captureDemo } from "../../helpers/screenshots.js";

describe("Borrow Page -- Disconnected Wallet", () => {
  beforeAll(async () => {
    await navigateTo("/borrow");
    await waitForContent("Borrow", 20_000);
  });

  it("loads with the Borrow page header", async () => {
    await assertTextVisible("Borrow");
    await captureScreenshot("borrow-disconnected-header");
  });

  it("displays connect wallet empty state prompt", async () => {
    // When disconnected, the page shows "Connect Wallet" and an explanatory message
    const hasConnect = await waitForContent("Connect Wallet", 10_000);
    expect(hasConnect).toBe(true);
    // Verify borrow page header is also present
    await assertTextVisible("Borrow");
  });

  it("does not show borrow panel when wallet is disconnected", async () => {
    // BorrowPanel header text should not be visible in disconnected state
    await assertTextNotVisible("Borrow USDC");
    await assertTextNotVisible("Borrow Amount");
  });

  it("captures a demo screenshot of the disconnected borrow page", async () => {
    await captureDemo("borrow-page-disconnected");
  });
});
