// Screenshots of the overlay fixtures in play and edit states, kept in
// e2e/overlay as reference images.
//   pnpm --filter @vizier/desktop shots:overlay           write the images
//   pnpm --filter @vizier/desktop shots:overlay -- --check  fail when one changed
// Starts `vite` itself unless VIZIER_DEV_URL points at a running dev server.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "e2e", "overlay");
const check = process.argv.includes("--check");
const MODES = ["rift", "aram", "arena", "mayhem"];
const STATES = { play: "", edit: "&edit" };
const SIZE = { width: 1280, height: 720 };

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${url} did not start`);
}

let server = null;
let base = process.env.VIZIER_DEV_URL;
if (!base) {
  base = "http://localhost:1421";
  server = spawn("pnpm", ["exec", "vite", "--port", "1421", "--strictPort"], { cwd: root, stdio: "ignore" });
}

let failed = 0;
try {
  await waitFor(base);
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: SIZE, deviceScaleFactor: 1 });
  // The shots must not depend on Data Dragon being reachable.
  await page.route("**/ddragon.leagueoflegends.com/**", (route) => route.abort());
  await page.route("**/workers.dev/**", (route) => route.abort());
  for (const mode of MODES) {
    for (const [state, extra] of Object.entries(STATES)) {
      await page.goto(`${base}/?fixture=${mode}${extra}`);
      await page.waitForTimeout(800);
      const png = await page.screenshot({ animations: "disabled" });
      const file = join(out, `${mode}-${state}.png`);
      if (check) {
        const same = existsSync(file) && createHash("sha256").update(readFileSync(file)).digest("hex") === createHash("sha256").update(png).digest("hex");
        console.log(`${same ? "ok     " : "CHANGED"} ${mode}-${state}`);
        if (!same) failed++;
      } else {
        writeFileSync(file, png);
        console.log(`wrote ${mode}-${state}.png`);
      }
    }
  }
  await browser.close();
} finally {
  server?.kill();
}
process.exit(failed > 0 ? 1 : 0);
