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

describe("Dashboard -- Page Load", () => {
  beforeAll(async () => {
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");
    await waitForSkeletonsToDisappear();
  });

  it("loads the dashboard page at /dashboard", async () => {
    const { getCurrentPath } = await import("../../helpers/navigation.js");
    const path = await getCurrentPath();
    expect(path).toBe("/dashboard");
  });

  it("displays the Dashboard header/title", async () => {
    await assertTextVisible("Dashboard");
  });

  it("renders the Protocol KPI grid with TVL metric", async () => {
    const hasTVL = await waitForContent("TVL", 10_000);
    if (!hasTVL) {
      // Fallback -- some implementations use the full label
      await assertTextVisible("Total Value Locked");
    } else {
      await assertTextVisible("TVL");
    }
  });

  it("renders the ProtocolMetricsGrid with supply and borrow stats", async () => {
    // The metrics grid shows supply/borrow data -- check for common labels
    const hasSupply = await waitForContent("Supply", 10_000);
    const hasBorrow = await waitForContent("Borrow", 10_000);
    expect(hasSupply || hasBorrow).toBe(true);
  });

  it("renders the UtilisationBar component", async () => {
    const hasUtilisation = await waitForContent("Utilisation", 10_000);
    if (!hasUtilisation) {
      // Fallback -- check for alternative spelling
      await assertTextVisible("Utilization");
    } else {
      await assertTextVisible("Utilisation");
    }
  });

  it("renders the Positions & Monitoring section", async () => {
    const hasPositions = await waitForContent("Positions & Monitoring", 10_000);
    expect(hasPositions).toBe(true);
  });

  it("renders the Your Position section", async () => {
    const hasPosition = await waitForContent("Your Position", 10_000);
    if (!hasPosition) {
      // Fallback -- check for collateral position label
      await assertTextVisible("Your Collateral Position");
    } else {
      await assertTextVisible("Your Position");
    }
  });

  it("renders the ProtocolHealthGrid with risk parameters", async () => {
    const hasHealth = await waitForContent("Health", 10_000);
    if (!hasHealth) {
      // Fallback -- check for risk-related labels
      const hasRisk = await waitForContent("Risk", 5_000);
      expect(hasRisk).toBe(true);
    } else {
      await assertTextVisible("Health");
    }
  });
});
