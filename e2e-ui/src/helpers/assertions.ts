/**
 * Assertion helpers for e2e-ui tests.
 */
import { expect } from "vitest";
import { evaluate, getPage } from "../setup/browser.js";

/**
 * Assert that text is visible somewhere on the page.
 */
export async function assertTextVisible(text: string): Promise<void> {
  const bodyText = await evaluate("document.body.innerText");
  expect(bodyText).toContain(text);
}

/**
 * Assert that text is NOT visible on the page.
 */
export async function assertTextNotVisible(text: string): Promise<void> {
  const bodyText = await evaluate("document.body.innerText");
  expect(bodyText).not.toContain(text);
}

/**
 * Assert that an SVG element exists on the page.
 */
export async function assertSvgPresent(): Promise<void> {
  const count = await evaluate("document.querySelectorAll('svg').length");
  expect(Number(count)).toBeGreaterThan(0);
}

/**
 * Assert that at least N SVG elements exist.
 */
export async function assertSvgCount(minCount: number): Promise<void> {
  const count = await evaluate("document.querySelectorAll('svg').length");
  expect(Number(count)).toBeGreaterThanOrEqual(minCount);
}

/**
 * Assert that the page title contains expected text.
 */
export async function assertTitleContains(text: string): Promise<void> {
  const title = await evaluate("document.title");
  expect(title).toContain(text);
}

/**
 * Assert that an element matching a CSS selector exists.
 */
export async function assertElementExists(selector: string): Promise<void> {
  const p = await getPage();
  const count = await p.locator(selector).count();
  expect(count).toBeGreaterThan(0);
}

/**
 * Assert that an element matching a CSS selector does NOT exist.
 */
export async function assertElementNotExists(selector: string): Promise<void> {
  const p = await getPage();
  const count = await p.locator(selector).count();
  expect(count).toBe(0);
}

/**
 * Assert that an element has specific text content.
 */
export async function assertElementText(selector: string, expectedText: string): Promise<void> {
  const p = await getPage();
  const text = await p.locator(selector).first().innerText();
  expect(text).toContain(expectedText);
}

/**
 * Assert that a Recharts chart container exists.
 */
export async function assertRechartsPresent(): Promise<void> {
  const count = await evaluate("document.querySelectorAll('.recharts-wrapper').length");
  expect(Number(count)).toBeGreaterThan(0);
}

/**
 * Count Recharts chart containers on the page.
 */
export async function getRechartsCount(): Promise<number> {
  const count = await evaluate("document.querySelectorAll('.recharts-wrapper').length");
  return Number(count);
}

/**
 * Assert that a link with specific href exists.
 */
export async function assertLinkExists(href: string): Promise<void> {
  const p = await getPage();
  const count = await p.locator(`a[href="${href}"]`).count();
  expect(count).toBeGreaterThan(0);
}

/**
 * Assert button with text exists and is enabled/disabled.
 */
export async function assertButtonState(
  text: string,
  expectedDisabled: boolean
): Promise<void> {
  const result = await evaluate(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent.includes('${text.replace(/'/g, "\\'")}'));
      if (!btn) return 'not_found';
      return btn.disabled ? 'disabled' : 'enabled';
    })()
  `);
  expect(result).not.toBe("not_found");
  if (expectedDisabled) {
    expect(result).toBe("disabled");
  } else {
    expect(result).toBe("enabled");
  }
}

/**
 * Get the count of elements matching a selector.
 */
export async function getElementCount(selector: string): Promise<number> {
  const p = await getPage();
  return p.locator(selector).count();
}
