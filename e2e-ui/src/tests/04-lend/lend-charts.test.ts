import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  getRechartsCount,
} from "../../helpers/assertions.js";
import {
  waitForContent,
  waitForSkeletonsToDisappear,
} from "../../helpers/waits.js";
import { captureScreenshot, captureDemo } from "../../helpers/screenshots.js";

describe("Lend -- Charts (Disconnected State)", () => {
  beforeAll(async () => {
    await navigateTo("/lend");
    await waitForContent("Lend");
    await waitForSkeletonsToDisappear();
  });

  it("shows Supply APY stat instead of rendered charts", async () => {
    // Charts do not render without a connected wallet.
    // Verify that vault stat labels are visible as chart-adjacent content.
    const hasAPY = await waitForContent("Supply APY", 10_000);
    expect(hasAPY).toBe(true);
    await assertTextVisible("Supply APY");
  });

  it("shows Utilisation stat on disconnected lend page", async () => {
    const hasUtilisation = await waitForContent("Utilisation", 10_000);
    expect(hasUtilisation).toBe(true);
    await assertTextVisible("Utilisation");
  });

  it("renders zero Recharts wrappers on disconnected lend page", async () => {
    // Without a connected wallet the lend page does not render any recharts
    const count = await getRechartsCount();
    expect(count).toBe(0);
  });

  it("captures a demo screenshot of the disconnected lend page", async () => {
    const screenshotPath = await captureDemo("lend-charts-disconnected");
    expect(screenshotPath).toBeTruthy();
    expect(screenshotPath).toContain("demo_lend-charts-disconnected");
  });
});
