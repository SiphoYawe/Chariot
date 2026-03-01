import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

describe("Tablet Viewport (768x1024 -- iPad)", () => {
  beforeAll(async () => {
    // Set viewport to iPad dimensions
    await setViewport(768, 1024);
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");
    await waitForSkeletonsToDisappear();
  });

  afterAll(async () => {
    // Reset viewport to default desktop size
    await setViewport(1280, 800);
  });

  it("sets the viewport to 768x1024 and page renders correctly", async () => {
    const dimensions = await evaluate(`
      (() => {
        return JSON.stringify({
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        });
      })()
    `);
    const parsed = JSON.parse(dimensions);
    expect(parsed.innerWidth).toBeLessThanOrEqual(768);
    expect(parsed.innerHeight).toBeLessThanOrEqual(1024);

    // Page content should be visible at tablet size
    const hasDashboard = await waitForContent("Dashboard", 5_000);
    expect(hasDashboard).toBe(true);
    await captureScreenshot("tablet-viewport-set");
  });

  it("dashboard page renders properly at tablet width", async () => {
    // No horizontal overflow at tablet width
    const hasHorizontalScroll = await evaluate(`
      (() => {
        const body = document.body;
        const html = document.documentElement;
        return String(body.scrollWidth > html.clientWidth);
      })()
    `);
    expect(hasHorizontalScroll).toBe("false");

    // Key content sections should be visible
    const hasTVL = await waitForContent("TVL", 10_000);
    const hasTotalValueLocked = await waitForContent("Total Value Locked", 5_000);
    expect(hasTVL || hasTotalValueLocked).toBe(true);

    await captureScreenshot("tablet-dashboard-layout");
  });

  it("charts adapt to the smaller tablet width", async () => {
    // Wait for charts to render at tablet dimensions
    await waitForChartRender(15_000);
    await assertRechartsPresent();

    // Charts should be rendered with appropriate width for the viewport
    const chartFit = await evaluate(`
      (() => {
        const wrappers = document.querySelectorAll('.recharts-wrapper');
        if (wrappers.length === 0) return 'no_charts';
        const viewportWidth = window.innerWidth;
        const allFit = Array.from(wrappers).every(w => {
          const rect = w.getBoundingClientRect();
          // Chart should not exceed viewport width
          return rect.right <= viewportWidth + 10;
        });
        return String(allFit);
      })()
    `);
    expect(chartFit).toBe("true");

    // Charts should still have SVG elements rendering
    await assertElementExists(".recharts-wrapper svg");
    await captureScreenshot("tablet-charts-adapted");
  });

  it("navigation remains accessible at tablet width", async () => {
    // Sidebar or navigation should still be reachable
    const navAccessible = await evaluate(`
      (() => {
        const aside = document.querySelector('aside');
        const nav = document.querySelector('nav');
        const navLinks = document.querySelectorAll('a[href="/dashboard"], a[href="/lend"], a[href="/borrow"]');

        if (aside) {
          const style = window.getComputedStyle(aside);
          // Sidebar might be collapsed but still present
          if (style.display !== 'none') return 'sidebar_visible';
        }
        if (nav) return 'nav_visible';
        if (navLinks.length > 0) return 'links_present';

        // Check for a hamburger/menu toggle button
        const menuButtons = Array.from(document.querySelectorAll('button'));
        const hasMenuToggle = menuButtons.some(b => {
          const label = b.getAttribute('aria-label') || b.textContent || '';
          return label.toLowerCase().includes('menu')
            || label.toLowerCase().includes('nav')
            || label.toLowerCase().includes('sidebar');
        });
        if (hasMenuToggle) return 'menu_toggle';

        return 'not_found';
      })()
    `);
    expect(navAccessible).not.toBe("not_found");
    await captureDemo("tablet-viewport");
  });
});
