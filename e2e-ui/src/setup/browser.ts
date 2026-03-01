/**
 * Core browser automation wrapper using Playwright.
 * Maintains a singleton browser/page instance shared across all tests.
 */
import { chromium, type Browser, type Page, type BrowserContext } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

/**
 * Get or create the singleton page instance.
 */
export async function getPage(): Promise<Page> {
  if (page && !page.isClosed()) return page;

  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
  }
  page = await context.newPage();
  return page;
}

/**
 * Close the browser and clean up.
 */
export async function closeBrowser(): Promise<void> {
  if (page && !page.isClosed()) await page.close().catch(() => {});
  if (context) await context.close().catch(() => {});
  if (browser) await browser.close().catch(() => {});
  page = null;
  context = null;
  browser = null;
}

/**
 * Open a URL in the browser.
 */
export async function open(url: string): Promise<void> {
  const p = await getPage();
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
}

/**
 * Take a snapshot of the page content (returns inner text).
 */
export async function snapshot(): Promise<string> {
  const p = await getPage();
  return p.innerText("body").catch(() => "");
}

/**
 * Click an element by CSS selector.
 */
export async function click(selector: string): Promise<void> {
  const p = await getPage();
  await p.click(selector, { timeout: 10_000 });
}

/**
 * Type text into an element by selector.
 */
export async function type(selector: string, text: string): Promise<void> {
  const p = await getPage();
  await p.fill(selector, text, { timeout: 10_000 });
}

/**
 * Fill (clear + type) text into an element.
 */
export async function fill(selector: string, text: string): Promise<void> {
  const p = await getPage();
  await p.fill(selector, text, { timeout: 10_000 });
}

/**
 * Evaluate JavaScript in the browser context and return the result as string.
 */
export async function evaluate(script: string): Promise<string> {
  const p = await getPage();
  try {
    const result = await p.evaluate(script);
    return String(result ?? "");
  } catch {
    return "";
  }
}

/**
 * Take a screenshot and save to a path.
 */
export async function screenshot(path: string): Promise<void> {
  const p = await getPage();
  await p.screenshot({ path, fullPage: true });
}

/**
 * Scroll the page in a direction.
 */
export async function scroll(direction: "up" | "down"): Promise<void> {
  const p = await getPage();
  const delta = direction === "down" ? 500 : -500;
  await p.mouse.wheel(0, delta);
}

/**
 * Wait for a specified number of milliseconds.
 */
export async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Get the current page URL.
 */
export async function getUrl(): Promise<string> {
  const p = await getPage();
  return p.url();
}

/**
 * Get the current page title.
 */
export async function getTitle(): Promise<string> {
  const p = await getPage();
  return p.title();
}

/**
 * Get text content of an element by selector.
 */
export async function getText(selector: string): Promise<string> {
  const p = await getPage();
  try {
    return await p.innerText(selector, { timeout: 5_000 });
  } catch {
    return "";
  }
}

/**
 * Set the viewport size.
 */
export async function setViewport(width: number, height: number): Promise<void> {
  const p = await getPage();
  await p.setViewportSize({ width, height });
}

/**
 * Wait for a selector to appear on the page.
 */
export async function waitForSelector(selector: string, timeout = 15_000): Promise<boolean> {
  const p = await getPage();
  try {
    await p.waitForSelector(selector, { timeout });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the Playwright page instance directly for advanced usage.
 */
export async function getRawPage(): Promise<Page> {
  return getPage();
}
