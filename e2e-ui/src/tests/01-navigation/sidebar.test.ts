import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo, getCurrentPath } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertLinkExists,
  assertElementExists,
} from "../../helpers/assertions.js";
import { waitForContent } from "../../helpers/waits.js";
import { captureScreenshot } from "../../helpers/screenshots.js";
import { evaluate } from "../../setup/browser.js";
import { waitForNavigation } from "../../helpers/waits.js";

describe("AppSidebar", () => {
  beforeAll(async () => {
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");
  });

  it("renders with the Chariot logo", async () => {
    // The sidebar contains an <img> with alt="Chariot"
    await assertElementExists('img[alt="Chariot"]');
    await captureScreenshot("sidebar-logo");
  });

  it("displays all 4 navigation links", async () => {
    await assertLinkExists("/dashboard");
    await assertLinkExists("/lend");
    await assertLinkExists("/borrow");
    await assertLinkExists("/history");

    // Verify the labels are visible in the page
    await assertTextVisible("Dashboard");
    await assertTextVisible("Lend");
    await assertTextVisible("Borrow");
    await assertTextVisible("History");
  });

  it("navigates to /lend when the Lend link is clicked", async () => {
    await evaluate(
      `(() => { const link = document.querySelector('a[href="/lend"]'); if (link) link.click(); })()`
    );
    const navigated = await waitForNavigation("/lend");
    expect(navigated).toBe(true);

    const path = await getCurrentPath();
    expect(path).toBe("/lend");
    await captureScreenshot("sidebar-nav-lend");
  });

  it("navigates to /borrow when the Borrow link is clicked", async () => {
    await evaluate(
      `(() => { const link = document.querySelector('a[href="/borrow"]'); if (link) link.click(); })()`
    );
    const navigated = await waitForNavigation("/borrow");
    expect(navigated).toBe(true);

    const path = await getCurrentPath();
    expect(path).toBe("/borrow");
    await captureScreenshot("sidebar-nav-borrow");
  });

  it("navigates to /history when the History link is clicked", async () => {
    await evaluate(
      `(() => { const link = document.querySelector('a[href="/history"]'); if (link) link.click(); })()`
    );
    const navigated = await waitForNavigation("/history");
    expect(navigated).toBe(true);

    const path = await getCurrentPath();
    expect(path).toBe("/history");
    await captureScreenshot("sidebar-nav-history");
  });

  it("navigates to /dashboard when the Dashboard link is clicked", async () => {
    await evaluate(
      `(() => { const link = document.querySelector('a[href="/dashboard"]'); if (link) link.click(); })()`
    );
    const navigated = await waitForNavigation("/dashboard");
    expect(navigated).toBe(true);

    const path = await getCurrentPath();
    expect(path).toBe("/dashboard");
    await captureScreenshot("sidebar-nav-dashboard");
  });

  it("highlights the active navigation link", async () => {
    // Navigate to /dashboard and verify the active link has the active style
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");

    // The active link gets bg-[#037971] and border-l-[3px] classes
    const hasActiveStyle = await evaluate(`
      (() => {
        const link = document.querySelector('a[href="/dashboard"]');
        if (!link) return 'not_found';
        const classes = link.className;
        return String(classes.includes('bg-[#037971]') || classes.includes('border-l-'));
      })()
    `);
    expect(hasActiveStyle).toBe("true");

    // Verify a non-active link does NOT have the active style
    const lendIsInactive = await evaluate(`
      (() => {
        const link = document.querySelector('a[href="/lend"]');
        if (!link) return 'not_found';
        const classes = link.className;
        return String(!classes.includes('bg-[#037971]'));
      })()
    `);
    expect(lendIsInactive).toBe("true");

    await captureScreenshot("sidebar-active-state");
  });

  it("shows 'Chariot Protocol' in the wallet status area when disconnected", async () => {
    // When no wallet is connected, the footer shows "Chariot Protocol" and "Arc Testnet"
    await assertTextVisible("Chariot Protocol");
    await assertTextVisible("Arc Testnet");
    await captureScreenshot("sidebar-wallet-disconnected");
  });
});
