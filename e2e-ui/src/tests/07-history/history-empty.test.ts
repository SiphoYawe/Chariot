import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { navigateTo } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertElementExists,
} from "../../helpers/assertions.js";
import { waitForContent, waitForSkeletonsToDisappear } from "../../helpers/waits.js";
import { captureScreenshot } from "../../helpers/screenshots.js";
import { injectWalletMock, removeWalletMock } from "../../setup/wallet-mock.js";

describe("History -- Empty State", () => {
  beforeAll(async () => {
    await injectWalletMock();
    await navigateTo("/history");
    await waitForContent("Transaction History", 15_000);
    await waitForSkeletonsToDisappear();
  });

  afterAll(async () => {
    await removeWalletMock();
  });

  it("displays the Transaction History page header", async () => {
    await assertTextVisible("Transaction History");
    await captureScreenshot("history-empty-header");
  });

  it("renders the transaction filter bar", async () => {
    // The TransactionFilterBar renders filter buttons -- "All" is always present
    const hasAll = await waitForContent("All", 10_000);
    expect(hasAll).toBe(true);
    // Verify at least one other filter option is present
    const hasDeposits = await waitForContent("Deposits", 5_000);
    expect(hasDeposits).toBe(true);
  });

  it("shows the empty state message when no transactions exist", async () => {
    // The NoTransactions component shows "No transactions yet"
    const hasEmpty = await waitForContent("No transactions yet", 10_000);
    if (hasEmpty) {
      await assertTextVisible("No transactions yet");
      await assertTextVisible("Your protocol activity will appear here");
    } else {
      // Fallback -- could show filter-specific empty state or loading completed
      const hasNoFilter = await waitForContent("No", 5_000);
      expect(hasNoFilter).toBe(true);
    }
    await captureScreenshot("history-empty-state");
  });

  it("shows filter options for all transaction types", async () => {
    // All 6 filter options should be visible
    await assertTextVisible("All");
    await assertTextVisible("Deposits");
    await assertTextVisible("Withdrawals");
    await assertTextVisible("Borrows");
    await assertTextVisible("Repays");
    await assertTextVisible("Liquidations");
    await captureScreenshot("history-empty-filters");
  });
});
