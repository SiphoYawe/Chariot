import { describe, it, expect, beforeAll } from "vitest";
import { navigateTo, getCurrentPath } from "../../helpers/navigation.js";
import {
  assertTextVisible,
  assertLinkExists,
  assertElementExists,
} from "../../helpers/assertions.js";
import { waitForContent } from "../../helpers/waits.js";
import { captureScreenshot } from "../../helpers/screenshots.js";

describe("Page Load -- All Routes", () => {
  describe("/dashboard", () => {
    beforeAll(async () => {
      await navigateTo("/dashboard");
    });

    it("loads with the page title", async () => {
      const found = await waitForContent("Dashboard", 20_000);
      expect(found).toBe(true);

      const path = await getCurrentPath();
      expect(path).toBe("/dashboard");
      await captureScreenshot("page-load-dashboard");
    });

    it("has the sidebar visible", async () => {
      await assertElementExists("aside");
      await assertLinkExists("/dashboard");
      await assertLinkExists("/lend");
    });
  });

  describe("/lend", () => {
    beforeAll(async () => {
      await navigateTo("/lend");
    });

    it("loads with page content", async () => {
      const found = await waitForContent("Lend", 20_000);
      expect(found).toBe(true);

      const path = await getCurrentPath();
      expect(path).toBe("/lend");
      await captureScreenshot("page-load-lend");
    });

    it("has the sidebar visible", async () => {
      await assertElementExists("aside");
      await assertLinkExists("/lend");
    });
  });

  describe("/borrow", () => {
    beforeAll(async () => {
      await navigateTo("/borrow");
    });

    it("loads with page content", async () => {
      const found = await waitForContent("Borrow", 20_000);
      expect(found).toBe(true);

      const path = await getCurrentPath();
      expect(path).toBe("/borrow");
      await captureScreenshot("page-load-borrow");
    });

    it("has the sidebar visible", async () => {
      await assertElementExists("aside");
      await assertLinkExists("/borrow");
    });
  });

  describe("/history", () => {
    beforeAll(async () => {
      await navigateTo("/history");
    });

    it("loads with page content", async () => {
      const found = await waitForContent("History", 20_000);
      expect(found).toBe(true);

      const path = await getCurrentPath();
      expect(path).toBe("/history");
      await captureScreenshot("page-load-history");
    });

    it("has the sidebar visible", async () => {
      await assertElementExists("aside");
      await assertLinkExists("/history");
    });
  });
});
