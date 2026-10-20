import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import * as E from "./eotm.mjs";
const LOG = new URL("./mind.eot", import.meta.url).pathname, CORE = new URL("./core.json", import.meta.url).pathname, SCRIPT = new URL("./ci-check.mjs", import.meta.url).pathname;
const dir = (log, core = CORE) => { const d = mkdtempSync(join(tmpdir(), "ci-")); writeFileSync(join(d, "mind.eot"), log); if (core) copyFileSync(core, join(d, "core.json")); return d; };
const run = (b, p) => spawnSync("node", [SCRIPT, b, p], { encoding: "utf8" });
const rec = (name, n = 1) => E.enc.dmdn({ domain: E.domainOf(name), step: n, source: "ab".repeat(10), before: "00".repeat(16), after: n.toString(16).padStart(2, "0").repeat(16), surpriseBits: 1, absorbedBits: 0, changes: [] });
const extended = () => { const d = dir(readFileSync(LOG), null); E.append(join(d, "mind.eot"), E.KIND.DMDN, rec("test/encounter")); return readFileSync(join(d, "mind.eot")); };

test("an honest PR passes: the base is a prefix, a new encounter is appended, core.json is untouched", () => {
  const r = run(dir(readFileSync(LOG)), dir(extended())); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /ok/);
});
test("a PR that rewrites history fails: the base is not a prefix", () => {
  const b = Buffer.from(extended()); b[100] ^= 1;                                        // any change inside the base region, then the chain is also broken
  const r = run(dir(readFileSync(LOG)), dir(b)); assert.equal(r.status, 1); assert.match(r.stderr, /does not verify|NOT a byte prefix/);
});
test("a PR built on a stale base fails: a log that forks before the base's tip is not an extension", () => {
  const stale = dir(readFileSync(LOG), null); E.append(join(stale, "mind.eot"), E.KIND.DMDN, rec("test/other-encounter", 2));     // main moved on
  const forkDir = dir(readFileSync(LOG), null); E.append(join(forkDir, "mind.eot"), E.KIND.DMDN, rec("test/a-different-encounter", 3));       // PR appended elsewhere
  copyFileSync(CORE, join(stale, "core.json")); copyFileSync(CORE, join(forkDir, "core.json"));
  const r = run(stale, forkDir); assert.equal(r.status, 1); assert.match(r.stderr, /NOT a byte prefix/);
});
test("a PR that edits core.json fails", () => {
  const edited = JSON.parse(readFileSync(CORE, "utf8")); edited.charterRoot = "0".repeat(32); const d = dir(extended(), null); writeFileSync(join(d, "core.json"), JSON.stringify(edited));
  const r = run(dir(readFileSync(LOG)), d); assert.equal(r.status, 1); assert.match(r.stderr, /core.json was edited|core is not intact/);
});
test("a PR that appends to the core's domain fails even though the chain verifies", () => {
  const d = dir(readFileSync(LOG), null); E.append(join(d, "mind.eot"), E.KIND.DMDN, rec("udhr-core", 9));       // no core.json beside the log while appending: the guard is off, as a forger would arrange
  copyFileSync(CORE, join(d, "core.json")); assert.equal(E.scan(readFileSync(join(d, "mind.eot"))).ok, true);
  const r = run(dir(readFileSync(LOG)), d); assert.equal(r.status, 1); assert.match(r.stderr, /core is not intact/);
});
test("a PR with a broken log fails", () => {
  const b = Buffer.from(extended()); b[b.length - 2] ^= 1; const r = run(dir(readFileSync(LOG)), dir(b)); assert.equal(r.status, 1); assert.match(r.stderr, /does not verify/);
});
