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

describe("Dashboard -- Protocol KPIs", () => {
  beforeAll(async () => {
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");
    await waitForSkeletonsToDisappear();
  });

  it("renders the TVL KPI card with a value", async () => {
    const hasTVL = await waitForContent("TVL", 10_000);
    if (!hasTVL) {
      await assertTextVisible("Total Value Locked");
    } else {
      await assertTextVisible("TVL");
    }
    // TVL should display a dollar-denominated value
    const { evaluate } = await import("../../setup/browser.js");
    const hasDollarValue = await evaluate(
      "String(document.body.innerText.includes('$'))"
    );
    expect(hasDollarValue).toBe("true");
  });

  it("displays the Total Borrowed metric", async () => {
    const hasTotalBorrowed = await waitForContent("TOTAL BORROWED", 10_000);
    if (!hasTotalBorrowed) {
      // Fallback -- some implementations use mixed case
      await assertTextVisible("Total Borrowed");
    } else {
      await assertTextVisible("TOTAL BORROWED");
    }
  });

  it("displays the Active Positions metric", async () => {
    const hasActivePositions = await waitForContent("ACTIVE POSITIONS", 10_000);
    if (!hasActivePositions) {
      // Fallback -- some implementations use mixed case
      await assertTextVisible("Active Positions");
    } else {
      await assertTextVisible("ACTIVE POSITIONS");
    }
  });

  it("displays the Revenue metric", async () => {
    const hasRevenue = await waitForContent("Revenue", 10_000);
    expect(hasRevenue).toBe(true);
  });

  it("renders SparkChart trend indicators as SVGs in KPI cards", async () => {
    // SparkCharts are small inline SVG charts within each KPI card
    // They provide trend visualization -- rendered as SVG elements
    await assertSvgPresent();
    // Expect at least 4 SVGs for the 4 KPI spark charts (plus any other SVGs)
    await assertSvgCount(4);
  });
});
