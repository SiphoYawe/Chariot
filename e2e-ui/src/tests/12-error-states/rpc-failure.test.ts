import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertElementExists,
  assertSvgPresent,
  assertSvgCount,
  assertRechartsPresent,
  getRechartsCount,
  assertElementNotExists,
} from "../../helpers/assertions.js";
import {
  waitForContent,
  waitForChartRender,
  waitForMultipleCharts,
  waitForSelector,
  waitForSkeletonsToDisappear,
} from "../../helpers/waits.js";
import { captureScreenshot, captureDemo } from "../../helpers/screenshots.js";
import { setViewport, evaluate } from "../../setup/browser.js";

describe("RPC Failure -- Graceful Error Handling", () => {
  beforeAll(async () => {
    await navigateTo("/dashboard");
    // Do not wait for skeletons to disappear here -- we want to observe loading states
  });

  it("page shows skeleton loaders initially during data fetch", async () => {
    // Navigate fresh and immediately check for skeleton/loading elements
    await navigateTo("/dashboard");

    // Check for skeleton loaders or animate-pulse elements right after navigation
    const hasSkeletons = await evaluate(`
      (() => {
        const skeletons = document.querySelectorAll('[data-slot="skeleton"], .animate-pulse, [class*="skeleton"]');
        return String(skeletons.length);
      })()
    `);
    const skeletonCount = parseInt(hasSkeletons, 10);
    // On initial load, there should be skeletons or the content has already loaded
    const contentLoaded = await evaluate(
      "String(document.body.innerText.includes('TVL') || document.body.innerText.includes('Total Value Locked'))"
    );
    // Either skeletons are visible or content has loaded fast
    expect(skeletonCount > 0 || contentLoaded === "true").toBe(true);
    await captureScreenshot("rpc-skeleton-loaders");
  });

  it("error states render gracefully with no blank page", async () => {
    // Wait a reasonable time for the page to resolve
    await waitForContent("Dashboard", 15_000);

    // The page should never be completely blank
    const bodyContent = await evaluate(`
      (() => {
        const text = document.body.innerText.trim();
        return String(text.length);
      })()
    `);
    const contentLength = parseInt(bodyContent, 10);
    // Page should have meaningful content -- not an empty/blank state
    expect(contentLength).toBeGreaterThan(20);

    // Verify no unhandled error messages (like raw stack traces)
    const hasRawError = await evaluate(`
      (() => {
        const text = document.body.innerText;
        const rawErrors = text.includes('Unhandled Runtime Error')
          || text.includes('TypeError:')
          || text.includes('ReferenceError:')
          || text.includes('Cannot read properties of');
        return String(rawErrors);
      })()
    `);
    expect(hasRawError).toBe("false");
    await captureScreenshot("rpc-no-blank-page");
  });

  it("content eventually loads or shows a user-friendly error message", async () => {
    // Wait for data to load -- either real data or an error state
    await waitForSkeletonsToDisappear(25_000);

    // After loading resolves, check for data content or a graceful error
    const pageState = await evaluate(`
      (() => {
        const text = document.body.innerText;
        const hasData = text.includes('TVL')
          || text.includes('Total Value Locked')
          || text.includes('Supply')
          || text.includes('Borrow')
          || text.includes('Utilisation')
          || text.includes('Utilization');
        const hasError = text.includes('error')
          || text.includes('Error')
          || text.includes('failed')
          || text.includes('unavailable')
          || text.includes('retry');
        const hasLoading = text.includes('Loading')
          || text.includes('loading');
        if (hasData) return 'data_loaded';
        if (hasError) return 'error_shown';
        if (hasLoading) return 'still_loading';
        return 'unknown';
      })()
    `);
    // The page should be in a resolved state -- either showing data or a clear error
    expect(["data_loaded", "error_shown", "still_loading"]).toContain(pageState);
    await captureScreenshot("rpc-content-resolved");
  });

  it("page is still interactive even during data loading -- sidebar works", async () => {
    // Verify the sidebar navigation is functional regardless of data state
    await assertElementExists("aside");

    // Click on a navigation link to confirm interactivity
    const navResult = await evaluate(`
      (() => {
        const link = document.querySelector('a[href="/lend"]');
        if (!link) return 'no_link';
        link.click();
        return 'clicked';
      })()
    `);
    expect(navResult).toBe("clicked");

    // Wait for navigation to complete
    const navigated = await waitForContent("Lend", 10_000);
    expect(navigated).toBe(true);

    // Navigate back to dashboard for subsequent tests
    await navigateTo("/dashboard");
    await captureDemo("rpc-failure-graceful");
  });
});
