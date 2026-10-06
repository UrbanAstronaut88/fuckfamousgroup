import fs from "node:fs";
import path from "node:path";

// The Cloudflare preview plugin copies .dev.vars into its output. Local
// credentials must never be part of a deployment archive.
const root = path.resolve("dist");
function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.resolve(directory, entry.name);
    if (!target.startsWith(root + path.sep)) throw Error("Unexpected build path");
    if (entry.isSymbolicLink()) throw Error("Unexpected symlink in build output");
    if (entry.isDirectory()) visit(target);
    else if (/^(?:\.dev\.vars|\.env)(?:\.|$)/.test(entry.name)) fs.unlinkSync(target);
  }
}
visit(root);
console.log("Deployment output contains no local environment files.");
