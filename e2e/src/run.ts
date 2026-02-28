// setup.ts handles dotenv loading -- imported transitively through all test modules

// -- Import all tests --
import * as t01 from "./tests/01-vault-deposit.js";
import * as t02 from "./tests/02-vault-withdraw.js";
import * as t03 from "./tests/03-collateral-deposit.js";
import * as t04 from "./tests/04-borrow.js";
import * as t05 from "./tests/05-partial-repay.js";
import * as t06 from "./tests/06-full-repay.js";
import * as t07 from "./tests/07-withdraw-collateral.js";
import * as t08 from "./tests/08-liquidation.js";
import * as t09 from "./tests/09-interest-accrual.js";
import * as t10 from "./tests/10-oracle-price.js";
import * as t11 from "./tests/11-circuit-breaker.js";
import * as t12 from "./tests/12-health-factor.js";
import * as t13 from "./tests/13-risk-parameters.js";

interface TestModule {
  name: string;
  run: () => Promise<void>;
}

const tests: TestModule[] = [
  t01, t02, t03, t04, t05, t06, t07,
  t08, t09, t10, t11, t12, t13,
];

// -- Colors --
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

async function main() {
  const total = tests.length;
  let passed = 0;
  let failed = 0;
  const results: { name: string; status: "PASS" | "FAIL"; time: number; error?: string }[] = [];

  console.log("");
  console.log(`${BOLD}${CYAN}=== Chariot Protocol E2E Tests ===${RESET}`);
  console.log(`${DIM}Running ${total} tests sequentially against Arc Testnet${RESET}`);
  console.log("");

  for (let i = 0; i < total; i++) {
    const test = tests[i];
    const num = String(i + 1).padStart(2, "0");
    const label = `[${num}/${total}] ${test.name}`;
    const dots = ".".repeat(Math.max(1, 45 - label.length));

    process.stdout.write(`  ${label} ${DIM}${dots}${RESET} `);

    const start = performance.now();
    try {
      await test.run();
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      console.log(`${GREEN}PASS${RESET} ${DIM}(${elapsed}s)${RESET}`);
      passed++;
      results.push({ name: test.name, status: "PASS", time: Number(elapsed) });
    } catch (err: any) {
      const elapsed = ((performance.now() - start) / 1000).toFixed(1);
      console.log(`${RED}FAIL${RESET} ${DIM}(${elapsed}s)${RESET}`);
      console.log(`    ${RED}Error: ${err.message || err}${RESET}`);
      failed++;
      results.push({
        name: test.name,
        status: "FAIL",
        time: Number(elapsed),
        error: err.message || String(err),
      });
    }
  }

  // -- Summary --
  console.log("");
  console.log(`${BOLD}${CYAN}=== Results ===${RESET}`);
  if (failed === 0) {
    console.log(`  ${GREEN}${BOLD}${passed}/${total} PASSED${RESET}`);
  } else {
    console.log(`  ${GREEN}${passed} passed${RESET}, ${RED}${failed} failed${RESET} out of ${total}`);
    console.log("");
    console.log(`  ${RED}${BOLD}Failed tests:${RESET}`);
    for (const r of results) {
      if (r.status === "FAIL") {
        console.log(`    ${RED}- ${r.name}: ${r.error}${RESET}`);
      }
    }
  }
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}Fatal error: ${err.message || err}${RESET}`);
  process.exit(1);
});
