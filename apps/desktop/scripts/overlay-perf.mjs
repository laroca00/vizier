// Counts overlay renders in the fixture preview: at most one per second.
//   pnpm --filter @vizier/desktop perf:overlay
// Starts `vite` itself unless VIZIER_DEV_URL points at a running dev server.
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SECONDS = 6;
const MAX_PER_SECOND = 1.2;

let server = null;
let base = process.env.VIZIER_DEV_URL;
if (!base) {
  base = "http://localhost:1422";
  server = spawn("pnpm", ["exec", "vite", "--port", "1422", "--strictPort"], { cwd: root, stdio: "ignore" });
}
let failed = false;
try {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route("**/ddragon.leagueoflegends.com/**", (route) => route.abort());
  await page.route("**/workers.dev/**", (route) => route.abort());
  for (const mode of ["rift", "aram", "arena", "mayhem"]) {
    await page.goto(`${base}/?fixture=${mode}`);
    await page.waitForTimeout(1500);
    const before = await page.evaluate(() => window.__overlayRenders ?? 0);
    await page.waitForTimeout(SECONDS * 1000);
    const after = await page.evaluate(() => window.__overlayRenders ?? 0);
    const rate = (after - before) / SECONDS;
    console.log(`${rate <= MAX_PER_SECOND ? "ok    " : "TOO MANY"} ${mode}: ${rate.toFixed(2)} renders/s`);
    if (rate > MAX_PER_SECOND) failed = true;
  }
  await browser.close();
} finally {
  server?.kill();
}
process.exit(failed ? 1 : 0);
