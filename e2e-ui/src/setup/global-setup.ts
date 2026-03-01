/**
 * Global setup for e2e-ui tests.
 * Verifies the Next.js dev server is running on localhost:3000.
 */

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

async function waitForServer(url: string, maxRetries = 15, intervalMs = 2000): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 308 || response.status === 307) {
        console.log(`[e2e-ui] Frontend server ready at ${url}`);
        return true;
      }
    } catch {
      // Server not ready yet
    }
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  console.warn(
    `[e2e-ui] WARNING: Frontend server not reachable at ${url} after ${maxRetries * intervalMs / 1000}s. ` +
    `Start it with: pnpm --filter frontend dev`
  );
  return false;
}

export async function setup(): Promise<void> {
  console.log("[e2e-ui] Global setup starting...");
  await waitForServer(FRONTEND_URL);
  console.log("[e2e-ui] Global setup complete");
}

export async function teardown(): Promise<void> {
  console.log("[e2e-ui] Global teardown complete");
}
