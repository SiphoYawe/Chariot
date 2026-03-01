import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertElementExists,
  assertSvgPresent,
  assertSvgCount,
  assertRechartsPresent,
  getRechartsCount,
} from "../../helpers/assertions.js";
import {
  waitForContent,
  waitForChartRender,
  waitForMultipleCharts,
  waitForSkeletonsToDisappear,
} from "../../helpers/waits.js";
import { captureScreenshot, captureDemo } from "../../helpers/screenshots.js";
import { evaluate } from "../../setup/browser.js";

describe("All Charts Render -- chart components across the app", () => {
  describe("Dashboard charts", () => {
    beforeAll(async () => {
      await navigateTo("/dashboard");
      await waitForContent("Dashboard");
      await waitForSkeletonsToDisappear();
      await waitForMultipleCharts(3, 25_000);
    });

    it("renders the VaultCompositionChart with an SVG element", async () => {
      // VaultCompositionChart is typically a pie/donut chart rendered via Recharts
      await assertRechartsPresent();
      const hasVault = await waitForContent("Vault", 10_000);
      if (!hasVault) {
        const hasComposition = await waitForContent("Composition", 5_000);
        expect(hasComposition).toBe(true);
      }
      // Verify SVG is present for chart rendering
      await assertElementExists(".recharts-wrapper svg");
    });

    it("renders the UtilisationHistoryChart with an SVG element", async () => {
      const hasUtilisation = await waitForContent("Utilisation", 10_000);
      if (!hasUtilisation) {
        await waitForContent("Utilization", 5_000);
      }
      // The history chart uses Recharts with an SVG area/line chart
      await assertSvgPresent();
      await assertRechartsPresent();
    });

    it("renders the UtilisationCurveChart with an SVG element", async () => {
      // The utilisation curve is a line chart showing the interest rate model
      await assertElementExists(".recharts-wrapper svg");
      // Curve charts render reference lines for the kink point
      const svgCount = await evaluate(
        "String(document.querySelectorAll('.recharts-wrapper svg').length)"
      );
      expect(parseInt(svgCount, 10)).toBeGreaterThanOrEqual(1);
    });

    it("renders SparkCharts in KPI cards with SVG elements", async () => {
      // KPI cards contain small sparkline charts -- each is an SVG
      await assertSvgPresent();
      // Dashboard should have multiple SVGs from sparklines plus main charts
      await assertSvgCount(4);
    });
  });

  describe("Lend page stats (disconnected -- no charts)", () => {
    beforeAll(async () => {
      await navigateTo("/lend");
      await waitForContent("Lend");
      await waitForSkeletonsToDisappear();
    });

    it("shows Supply APY stat on the lend page", async () => {
      const hasAPY = await waitForContent("Supply APY", 10_000);
      expect(hasAPY).toBe(true);
      await assertTextVisible("Supply APY");
    });

    it("shows Utilisation stat on the lend page", async () => {
      const hasUtilisation = await waitForContent("Utilisation", 10_000);
      expect(hasUtilisation).toBe(true);
      await assertTextVisible("Utilisation");
    });

    it("has zero recharts wrappers on disconnected lend page", async () => {
      const count = await getRechartsCount();
      expect(count).toBe(0);
    });
  });

  describe("Total chart count", () => {
    it("renders the expected number of charts on the dashboard", async () => {
      // Navigate to dashboard which has all the charts
      await navigateTo("/dashboard");
      await waitForContent("Dashboard");
      await waitForSkeletonsToDisappear();
      await waitForMultipleCharts(2, 25_000);

      const dashboardChartCount = await getRechartsCount();

      // Dashboard has 2 recharts (composition donut + utilisation history bar)
      expect(dashboardChartCount).toBeGreaterThanOrEqual(2);

      await captureDemo("all-charts-render");
    });
  });
});
