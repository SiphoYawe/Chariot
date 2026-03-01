/**
 * Wait helpers for e2e-ui tests.
 * Uses Playwright's built-in waiting where possible.
 */
import { evaluate, wait as browserWait, getPage } from "../setup/browser.js";

/**
 * Wait for specific text content to appear on the page.
 */
export async function waitForContent(
  text: string,
  maxWaitMs = 15_000
): Promise<boolean> {
  const p = await getPage();
  try {
    await p.getByText(text, { exact: false }).first().waitFor({ timeout: maxWaitMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for an element matching a CSS selector to appear.
 */
export async function waitForSelector(
  selector: string,
  maxWaitMs = 15_000
): Promise<boolean> {
  const p = await getPage();
  try {
    await p.waitForSelector(selector, { timeout: maxWaitMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for a Recharts chart to render.
 */
export async function waitForChartRender(maxWaitMs = 15_000): Promise<boolean> {
  return waitForSelector(".recharts-wrapper svg", maxWaitMs);
}

/**
 * Wait for multiple Recharts charts to render.
 */
export async function waitForMultipleCharts(
  minCount: number,
  maxWaitMs = 20_000,
  pollMs = 500
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const count = await evaluate("document.querySelectorAll('.recharts-wrapper').length");
    if (Number(count) >= minCount) return true;
    await browserWait(pollMs);
  }
  return false;
}

/**
 * Wait for skeleton loaders to disappear.
 */
export async function waitForSkeletonsToDisappear(maxWaitMs = 20_000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const count = await evaluate(
      "document.querySelectorAll('[data-slot=\"skeleton\"], .animate-pulse').length"
    );
    if (Number(count) === 0) return true;
    await browserWait(500);
  }
  return false;
}

/**
 * Wait for a selector to disappear.
 */
export async function waitForSelectorToDisappear(
  selector: string,
  maxWaitMs = 15_000
): Promise<boolean> {
  const p = await getPage();
  try {
    await p.waitForSelector(selector, { state: "hidden", timeout: maxWaitMs });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for N elements matching a selector.
 */
export async function waitForElementCount(
  selector: string,
  minCount: number,
  maxWaitMs = 15_000,
  pollMs = 500
): Promise<boolean> {
  const p = await getPage();
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const count = await p.locator(selector).count();
    if (count >= minCount) return true;
    await browserWait(pollMs);
  }
  return false;
}

/**
 * Wait for the page URL to match a pattern.
 */
export async function waitForNavigation(
  expectedPath: string,
  maxWaitMs = 10_000,
  pollMs = 300
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const path = await evaluate("window.location.pathname");
    if (path === expectedPath || path.startsWith(expectedPath + "/")) return true;
    await browserWait(pollMs);
  }
  return false;
}
