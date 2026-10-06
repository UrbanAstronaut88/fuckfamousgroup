import fs from "node:fs";
import { spawnSync } from "node:child_process";

// Run through npm so the existing prebuild and secret-cleaning postbuild run too.
try {
  const config = JSON.parse(fs.readFileSync("wrangler.production.json", "utf8").replace(/^\uFEFF/, ""));
  if (!/^[a-f0-9]{32}$/i.test(config.account_id ?? "")) throw Error("Set your Cloudflare account_id.");
  const db = config.d1_databases?.find((binding) => binding.binding === "DB");
  if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(db?.database_id ?? "") || db.database_id === "00000000-0000-4000-8000-000000000000") {
    throw Error("Set the real production D1 database_id.");
  }
  if (!config.r2_buckets?.some((binding) => binding.binding === "MEDIA" && binding.bucket_name)) throw Error("Configure the MEDIA R2 binding.");
  if (!process.env.npm_execpath) throw Error("Run npm run build:cloudflare.");
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "run", "build"], {
    stdio: "inherit",
    env: { ...process.env, FFG_DEPLOY_TARGET: "cloudflare" },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(`Cloudflare build stopped: ${error.message}`);
  console.error("Copy wrangler.production.example.json to wrangler.production.json and configure your resources first. Never add secrets to either file.");
  process.exitCode = 1;
}
