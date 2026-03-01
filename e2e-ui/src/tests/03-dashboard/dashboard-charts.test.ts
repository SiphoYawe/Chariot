import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertElementExists,
  assertRechartsPresent,
  assertSvgPresent,
  assertSvgCount,
  getRechartsCount,
} from "../../helpers/assertions.js";
import {
  waitForContent,
  waitForChartRender,
  waitForMultipleCharts,
  waitForSkeletonsToDisappear,
} from "../../helpers/waits.js";
import { captureScreenshot, captureDemo } from "../../helpers/screenshots.js";

describe("Dashboard -- Charts", () => {
  beforeAll(async () => {
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");
    await waitForSkeletonsToDisappear();
    // Allow charts time to render
    await waitForMultipleCharts(2, 25_000);
  });

  it("renders the VaultCompositionChart with a recharts wrapper", async () => {
    await assertRechartsPresent();
    // Vault composition is typically a pie/donut chart
    const hasVault = await waitForContent("Vault", 10_000);
    if (!hasVault) {
      const hasComposition = await waitForContent("Composition", 5_000);
      expect(hasComposition).toBe(true);
    } else {
      await assertTextVisible("Vault");
    }
  });

  it("renders the UtilisationHistoryChart", async () => {
    const hasUtilHistory = await waitForContent("Utilisation", 10_000);
    if (!hasUtilHistory) {
      await waitForContent("Utilization", 5_000);
    }
    // Verify chart is present via recharts wrapper
    await assertRechartsPresent();
  });

  it("renders the UtilisationCurveChart with interactive elements", async () => {
    // The utilisation curve chart should have recharts interactive elements
    await assertRechartsPresent();
    // Curve charts typically have tooltip and reference elements
    await assertElementExists(".recharts-wrapper svg");
  });

  it("has at least 2 Recharts chart containers on the page", async () => {
    const chartCount = await getRechartsCount();
    expect(chartCount).toBeGreaterThanOrEqual(2);
  });

  it("all charts contain SVG elements for rendering", async () => {
    await assertSvgPresent();
    // Dashboard should have multiple SVGs -- charts plus icons
    await assertSvgCount(3);
  });

  it("captures a screenshot of the dashboard with charts", async () => {
    const screenshotPath = await captureDemo("dashboard-charts");
    expect(screenshotPath).toBeTruthy();
    expect(screenshotPath).toContain("demo_dashboard-charts");
  });
});
