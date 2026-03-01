/**
 * Global teardown for e2e-ui tests.
 */
import { closeBrowser } from "./browser.js";

export async function teardown(): Promise<void> {
  await closeBrowser();
  console.log("[e2e-ui] Global teardown complete");
}
