// Builds a signed installer and publishes it as the desktop app's update.
// Usage: node scripts/release.mjs "What changed"
// Bump "version" in apps/desktop/src-tauri/tauri.conf.json first.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const conf = JSON.parse(readFileSync(join(root, "apps/desktop/src-tauri/tauri.conf.json"), "utf8"));
const version = conf.version;
const notes = process.argv[2] ?? `Vizier ${version}`;
const keyPath = process.env.VIZIER_SIGNING_KEY ?? join(homedir(), ".tauri", "vizier.key");
const baseUrl = conf.plugins.updater.endpoints[0].replace(/latest\.json$/, "");

if (!existsSync(keyPath)) throw new Error(`Signing key not found at ${keyPath}`);

const run = (command, cwd = root, env = {}) => execSync(command, { cwd, stdio: "inherit", env: { ...process.env, ...env } });

run("pnpm build", root, {
  TAURI_SIGNING_PRIVATE_KEY: readFileSync(keyPath, "utf8"),
  TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.VIZIER_SIGNING_KEY_PASSWORD ?? "",
});

const installer = `Vizier_${version}_x64-setup.exe`;
const bundle = join(root, "apps/desktop/src-tauri/target/release/bundle/nsis");
const signature = readFileSync(join(bundle, `${installer}.sig`), "utf8").trim();

const api = join(root, "services/api");
const put = (key, file) => run(`npx wrangler kv key put --binding UPDATES --remote "${key}" --path "${file}"`, api);

put(installer, join(bundle, installer));
const latest = join(tmpdir(), `vizier-latest-${version}.json`);
writeFileSync(
  latest,
  JSON.stringify({
    version,
    notes,
    pub_date: new Date().toISOString(),
    platforms: { "windows-x86_64": { signature, url: `${baseUrl}${installer}` } },
  }),
);
// Last, so no client sees the new version before its installer is uploaded.
put("latest.json", latest);
console.log(`Published Vizier ${version}`);
