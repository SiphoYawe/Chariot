import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertElementExists,
} from "../../helpers/assertions.js";
import { waitForContent, waitForSelector, waitForSkeletonsToDisappear } from "../../helpers/waits.js";
import { captureScreenshot } from "../../helpers/screenshots.js";
import { injectWalletMock, removeWalletMock } from "../../setup/wallet-mock.js";
import { evaluate } from "../../setup/browser.js";

describe("History -- TransactionFilterBar", () => {
  beforeAll(async () => {
    await injectWalletMock();
    await navigateTo("/history");
    await waitForContent("Transaction History", 15_000);
    await waitForSkeletonsToDisappear();
  });

  afterAll(async () => {
    await removeWalletMock();
  });

  it("has the All filter active by default", async () => {
    // The active filter gets bg-[#03B5AA] and text-white classes
    const allIsActive = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const allBtn = buttons.find(b => b.textContent.trim() === 'All');
        if (!allBtn) return 'not_found';
        const classes = allBtn.className;
        return String(classes.includes('bg-[#03B5AA]'));
      })()
    `);
    expect(allIsActive).toBe("true");
    await captureScreenshot("history-filter-all-active");
  });

  it("renders filter buttons for all transaction types", async () => {
    const filterLabels = ["All", "Deposits", "Withdrawals", "Borrows", "Repays", "Liquidations"];
    for (const label of filterLabels) {
      const exists = await evaluate(`
        (() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          return String(buttons.some(b => b.textContent.trim() === '${label}'));
        })()
      `);
      expect(exists).toBe("true");
    }
    await captureScreenshot("history-filter-buttons");
  });

  it("clicking a filter updates the active state", async () => {
    // Click the "Deposits" filter button
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const depositsBtn = buttons.find(b => b.textContent.trim() === 'Deposits');
        if (depositsBtn) depositsBtn.click();
      })()
    `);

    // Wait a moment for React to re-render
    await waitForContent("Deposits", 5_000);

    // Verify "Deposits" is now active (has the active bg class)
    const depositsIsActive = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const depositsBtn = buttons.find(b => b.textContent.trim() === 'Deposits');
        if (!depositsBtn) return 'not_found';
        return String(depositsBtn.className.includes('bg-[#03B5AA]'));
      })()
    `);
    expect(depositsIsActive).toBe("true");

    // Verify "All" is no longer active
    const allIsInactive = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const allBtn = buttons.find(b => b.textContent.trim() === 'All');
        if (!allBtn) return 'not_found';
        return String(!allBtn.className.includes('bg-[#03B5AA]'));
      })()
    `);
    expect(allIsInactive).toBe("true");
    await captureScreenshot("history-filter-deposits-active");
  });

  it("filter bar is rendered as a flex container for responsive layout", async () => {
    // The TransactionFilterBar uses flex-wrap gap-2 for responsive behavior
    const isFlexWrap = await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const filterBtn = buttons.find(b => b.textContent.trim() === 'All');
        if (!filterBtn || !filterBtn.parentElement) return 'not_found';
        const parent = filterBtn.parentElement;
        const styles = window.getComputedStyle(parent);
        return String(styles.display === 'flex');
      })()
    `);
    expect(isFlexWrap).toBe("true");
    await captureScreenshot("history-filter-responsive");
  });

  it("empty state updates with filter context when a filter is selected", async () => {
    // Click the "Liquidations" filter -- unlikely to have transactions
    await evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent.trim() === 'Liquidations');
        if (btn) btn.click();
      })()
    `);

    await waitForContent("Liquidations", 5_000);

    // Check for filter-specific empty state -- either "No liquidation transactions found"
    // or the general "No transactions yet" empty state
    const hasFilterEmpty = await waitForContent("No liquidation transactions found", 5_000);
    const hasGeneralEmpty = await waitForContent("No transactions yet", 5_000);
    const hasClearFilter = await waitForContent("Clear filter", 5_000);
    expect(hasFilterEmpty || hasGeneralEmpty || hasClearFilter).toBe(true);
    await captureScreenshot("history-filter-empty-context");
  });
});
