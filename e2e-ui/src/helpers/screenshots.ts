/**
 * Screenshot helpers for e2e-ui tests.
 */
import { screenshot } from "../setup/browser.js";
import { resolve, dirname } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = resolve(__dirname, "../screenshots");

// Ensure screenshots directory exists
mkdirSync(SCREENSHOTS_DIR, { recursive: true });

/**
 * Capture a screenshot with a descriptive name.
 */
export async function captureScreenshot(name: string): Promise<string> {
  const sanitized = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  const filename = `${sanitized}_${Date.now()}.png`;
  const fullPath = resolve(SCREENSHOTS_DIR, filename);
  await screenshot(fullPath);
  return fullPath;
}

/**
 * Capture a screenshot on test failure.
 */
export async function captureOnFailure(testName: string): Promise<string | null> {
  try {
    return await captureScreenshot(`FAIL_${testName}`);
  } catch {
    console.warn(`[e2e-ui] Failed to capture failure screenshot for: ${testName}`);
    return null;
  }
}

/**
 * Capture a demo screenshot.
 */
export async function captureDemo(scenarioName: string): Promise<string> {
  return captureScreenshot(`demo_${scenarioName}`);
}
