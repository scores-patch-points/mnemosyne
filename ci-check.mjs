// ci-check.mjs — what a pull request must not do to the mind. Usage: node ci-check.mjs <base-dir> <pr-dir>   (each holds mind.eot and, if it has one, core.json)
//   1. the PR's log verifies (hash chain);
//   2. the base log is a BYTE PREFIX of the PR's log (append-only; also what "one writer at a time" means in practice: a PR built on a stale base fails here, rebase and re-append);
//   3. core.json is never edited: if the base has one, the PR's is byte-identical; if the PR introduces it, it must match the PR's own log;
//   4. the immutable core of the PR's log is exactly what core.json pins (no record in its domain, its bytes unchanged).
// Exit 0 with "ok", or exit 1 listing every failure.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as E from "./eotm.mjs";
const [base, pr] = process.argv.slice(2); if (!pr) { console.error("usage: node ci-check.mjs <base-dir> <pr-dir>"); process.exit(2); }
const fail = [], rd = (d, f) => (existsSync(join(d, f)) ? readFileSync(join(d, f)) : null), baseLog = rd(base, "mind.eot"), prLog = rd(pr, "mind.eot");
if (!prLog) fail.push("the PR has no mind.eot");
else {
  const sc = E.scan(prLog); if (!sc.ok) fail.push(`the PR's log does not verify: ${sc.error}`);
  if (baseLog && !(prLog.length >= baseLog.length && prLog.subarray(0, baseLog.length).equals(baseLog))) fail.push("the base log is NOT a byte prefix of the PR's log: history was rewritten or the PR is built on a stale base");
  const baseCore = rd(base, "core.json"), prCore = rd(pr, "core.json");
  if (baseCore && (!prCore || !prCore.equals(baseCore))) fail.push("core.json was edited or removed: the core is immutable");
  if (prCore) { const bad = E.checkCore(prLog, JSON.parse(prCore.toString("utf8"))); if (bad) fail.push(`the immutable core is not intact: ${bad}`); }
  else if (baseCore === null && baseLog && E.scan(baseLog).records.length) { /* a log with no pin at all: allowed until the pin is introduced */ }
}
if (fail.length) { console.error("FAIL\n- " + fail.join("\n- ")); process.exit(1); }
console.log("ok");
