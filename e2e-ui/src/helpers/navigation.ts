/**
 * Navigation helpers for e2e-ui tests.
 */
import { open, evaluate, wait as browserWait, getPage } from "../setup/browser.js";

const BASE_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

/**
 * Navigate to a route and wait for the page to be ready.
 */
export async function navigateTo(path: string): Promise<void> {
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  await open(url);
  await waitForPageReady();
}

/**
 * Wait for the page to finish loading.
 */
export async function waitForPageReady(maxWaitMs = 10_000): Promise<void> {
  const p = await getPage();
  try {
    await p.waitForLoadState("domcontentloaded", { timeout: maxWaitMs });
  } catch {
    // Don't throw -- page might be usable
  }
  // Small wait for React hydration
  await browserWait(300);
}

/**
 * Get the current page snapshot (body text).
 */
export async function getPageSnapshot(): Promise<string> {
  return evaluate("document.body.innerText");
}

/**
 * Get the current URL path (without base).
 */
export async function getCurrentPath(): Promise<string> {
  return evaluate("window.location.pathname");
}

/**
 * Check if the page has navigated to the expected path.
 */
export async function isOnPage(expectedPath: string): Promise<boolean> {
  const currentPath = await getCurrentPath();
  return currentPath === expectedPath || currentPath.startsWith(expectedPath + "/");
}

/**
 * Refresh the current page and wait for it to be ready.
 */
export async function refreshPage(): Promise<void> {
  const p = await getPage();
  await p.reload({ waitUntil: "domcontentloaded" });
  await browserWait(300);
}
