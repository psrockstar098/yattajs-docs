// scripts/check-api.mjs
//
// Fails when lib/api-surface.json no longer matches the framework source.
//
// The reference is generated, which is the only reason it can be trusted — but a
// generated file that silently falls behind is worse than a hand-written one,
// because it still looks authoritative. Nothing fails when a signature changes in
// Yatta and nobody re-runs the extract; the docs keep publishing last month's
// types. This makes that loud.
//
// Run it in CI, or after changing anything public in the framework.

import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(process.argv[2] ?? "/home/psrockstar/Documents/code/Yatta");
const COMMITTED = resolve("lib/api-surface.json");

if (!existsSync(COMMITTED)) {
  console.error(`check-api: ${COMMITTED} does not exist. Run: bun run extract:api`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "yatta-api-"));
const fresh = join(dir, "api-surface.json");

try {
  // Silence the extractor's own output; only the comparison matters here.
  execFileSync("node", ["scripts/extract-api.mjs", ROOT, fresh], {
    stdio: ["ignore", "ignore", "inherit"],
  });

  const before = readFileSync(COMMITTED, "utf8");
  const after = readFileSync(fresh, "utf8");

  if (before === after) {
    console.log("check-api: api-surface.json is up to date.");
    process.exit(0);
  }

  // Name the modules that moved, so the failure says what to look at rather than
  // just that a file differs.
  const a = JSON.parse(before);
  const b = JSON.parse(after);
  const ids = new Set([...Object.keys(a), ...Object.keys(b)]);

  const added = [...ids].filter((id) => !(id in a));
  const removed = [...ids].filter((id) => !(id in b));

  const changed = [...ids].filter(
    (id) => id in a && id in b && a[id].entries.length !== b[id].entries.length,
  );

  console.error("check-api: lib/api-surface.json is stale. Run: bun run extract:api\n");

  if (added.length) console.error(`  new module:   ${added.join(", ")}`);
  if (removed.length) console.error(`  gone module:  ${removed.join(", ")}`);
  if (changed.length) {
    for (const id of changed) {
      console.error(
        `  ${id}: ${a[id].entries.length} → ${b[id].entries.length} top-level symbols`,
      );
    }
  }
  if (!added.length && !removed.length && !changed.length) {
    // Same shape, different content: a doc comment, signature or summary changed.
    console.error("  signatures or doc comments changed (module counts are equal).");
  }

  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}