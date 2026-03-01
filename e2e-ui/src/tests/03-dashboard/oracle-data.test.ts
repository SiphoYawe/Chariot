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

describe("Dashboard -- Oracle Data Display", () => {
  beforeAll(async () => {
    await navigateTo("/dashboard");
    await waitForContent("Dashboard");
    await waitForSkeletonsToDisappear();
  });

  it("renders the Oracle section on the dashboard", async () => {
    const hasOracle = await waitForContent("Oracle", 10_000);
    expect(hasOracle).toBe(true);
  });

  it("displays ETH/USD price with a dollar value", async () => {
    // The oracle should show the ETH/USD price feed
    const hasETH = await waitForContent("ETH", 10_000);
    expect(hasETH).toBe(true);

    // Verify a dollar-denominated price is rendered
    const { evaluate } = await import("../../setup/browser.js");
    const hasDollarPrice = await evaluate(
      "String(document.body.innerText.includes('$'))"
    );
    expect(hasDollarPrice).toBe("true");
  });

  it("shows the oracle source as SimpleOracle", async () => {
    const hasSimpleOracle = await waitForContent("SimpleOracle", 10_000);
    expect(hasSimpleOracle).toBe(true);
  });

  it("displays a price staleness or freshness indicator", async () => {
    // The oracle data display should show how fresh the price data is
    // Common labels: "Last Updated", "Fresh", "Stale", "ago", or a timestamp
    const { evaluate } = await import("../../setup/browser.js");
    const hasFreshnessIndicator = await evaluate(`
      (() => {
        const text = document.body.innerText;
        return String(
          text.includes('Last Updated') ||
          text.includes('Fresh') ||
          text.includes('Stale') ||
          text.includes('ago') ||
          text.includes('Updated') ||
          text.includes('Timestamp') ||
          text.includes('Last Price')
        );
      })()
    `);
    expect(hasFreshnessIndicator).toBe("true");
  });
});
