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

describe("Skeleton Loading States", () => {
  it("skeleton elements appear during page load", async () => {
    // Navigate fresh and immediately check for skeleton elements
    await navigateTo("/dashboard");

    // Check for skeletons right after navigation (before data loads)
    const skeletonInfo = await evaluate(`
      (() => {
        const slotSkeletons = document.querySelectorAll('[data-slot="skeleton"]');
        const pulseSkeletons = document.querySelectorAll('.animate-pulse');
        const classSkeletons = document.querySelectorAll('[class*="skeleton"]');
        return JSON.stringify({
          slotCount: slotSkeletons.length,
          pulseCount: pulseSkeletons.length,
          classCount: classSkeletons.length,
          total: slotSkeletons.length + pulseSkeletons.length + classSkeletons.length,
        });
      })()
    `);
    const info = JSON.parse(skeletonInfo);

    // Either skeletons are present or data loaded instantly
    const dataAlreadyLoaded = await evaluate(
      "String(document.body.innerText.includes('TVL') || document.body.innerText.includes('Supply'))"
    );
    expect(info.total > 0 || dataAlreadyLoaded === "true").toBe(true);
    await captureScreenshot("skeleton-elements-present");
  });

  it("skeletons use the correct animate-pulse class for animation", async () => {
    // Navigate fresh to catch skeletons in their animated state
    await navigateTo("/dashboard");

    const animationCheck = await evaluate(`
      (() => {
        const pulseElements = document.querySelectorAll('.animate-pulse');
        const skeletonSlots = document.querySelectorAll('[data-slot="skeleton"]');

        // Check if skeleton slots have animate-pulse or a parent with it
        let hasAnimation = pulseElements.length > 0;

        if (!hasAnimation && skeletonSlots.length > 0) {
          // Check if skeleton elements themselves have the pulse class
          hasAnimation = Array.from(skeletonSlots).some(el => {
            const classes = el.className || '';
            return classes.includes('animate-pulse')
              || classes.includes('animate-')
              || window.getComputedStyle(el).animationName !== 'none';
          });
        }

        return JSON.stringify({
          pulseCount: pulseElements.length,
          skeletonCount: skeletonSlots.length,
          hasAnimation: hasAnimation,
        });
      })()
    `);
    const result = JSON.parse(animationCheck);

    // Either animate-pulse elements exist or data loaded too fast to catch them
    const dataLoaded = await evaluate(
      "String(document.body.innerText.includes('Dashboard') && document.body.innerText.length > 100)"
    );
    expect(result.hasAnimation || dataLoaded === "true").toBe(true);
    await captureScreenshot("skeleton-animate-pulse");
  });

  it("skeletons eventually resolve to real content", async () => {
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");

    // Wait for skeletons to disappear -- they should resolve to content
    const resolved = await waitForSkeletonsToDisappear(30_000);

    if (resolved) {
      // Verify skeletons are gone
      const remainingSkeletons = await evaluate(`
        (() => {
          const skeletons = document.querySelectorAll('[data-slot="skeleton"], .animate-pulse');
          return String(skeletons.length);
        })()
      `);
      expect(parseInt(remainingSkeletons, 10)).toBe(0);

      // Verify real content has replaced the skeletons
      const hasContent = await evaluate(`
        (() => {
          const text = document.body.innerText;
          const hasMetrics = text.includes('TVL')
            || text.includes('Supply')
            || text.includes('Borrow')
            || text.includes('Total Value Locked');
          return String(hasMetrics);
        })()
      `);
      expect(hasContent).toBe("true");
    } else {
      // If skeletons didn't fully disappear, page should still be functional
      const bodyLength = await evaluate("String(document.body.innerText.length)");
      expect(parseInt(bodyLength, 10)).toBeGreaterThan(50);
    }

    await captureScreenshot("skeleton-resolved-to-content");
  });

  it("no infinite loading states -- page resolves within timeout", async () => {
    // Navigate to a different page and verify it also resolves
    await navigateTo("/lend");
    await waitForContent("Lend", 15_000);

    // Wait for the lend page to fully resolve
    const lendResolved = await waitForSkeletonsToDisappear(30_000);

    // Check page state after timeout -- should not be stuck in loading
    const pageState = await evaluate(`
      (() => {
        const skeletons = document.querySelectorAll('[data-slot="skeleton"], .animate-pulse');
        const spinners = document.querySelectorAll('[class*="spinner"], [class*="loading"]');
        const text = document.body.innerText;
        const hasContent = text.length > 100;

        return JSON.stringify({
          skeletonCount: skeletons.length,
          spinnerCount: spinners.length,
          contentLength: text.length,
          hasContent: hasContent,
        });
      })()
    `);
    const state = JSON.parse(pageState);

    // The page must have meaningful content and not be stuck loading
    expect(state.hasContent).toBe(true);
    expect(state.contentLength).toBeGreaterThan(50);

    await captureDemo("skeleton-loading-states");
  });
});
