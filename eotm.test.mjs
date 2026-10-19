// Self-contained checks for the EOTM format and the surprise model (no UDHR data needed).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as E from "./eotm.mjs";
import { klDirichlet, makeModel } from "./surprise.mjs";

const LOG = new URL("./mind.eot", import.meta.url), buf = readFileSync(LOG), scan = E.scan(buf), dec = scan.records.map(E.decode);

test("the committed log verifies and holds only differences plus the ground under them", () => {
  assert.ok(scan.ok, scan.error);
  assert.ok(buf.length < 2048);
  assert.deepEqual(dec.map((d) => d.kind), ["DMD", "DMD", "DMD", "DMD", "WINDOW", "MARGINS", "GROUND"]);
  for (const d of dec.filter((x) => x.kind === "DMD")) assert.notEqual(d.before, d.after);
  const last = dec.filter((x) => x.kind === "DMD").at(-1);
  assert.equal(last.after, dec.at(-1).root, "the last difference lands on the ground");
  for (let i = 1; i < 4; i++) assert.equal(dec[i].before, dec[i - 1].after, "each difference starts where the last one ended");
});

test("tamper-evident, append-only, unknown kinds skipped by length", () => {
  const bad = Buffer.from(buf); bad[20] ^= 1;
  assert.equal(E.scan(bad).ok, false);
  assert.equal(E.scan(buf.subarray(0, buf.length - 3)).ok, false);
  const p = `${tmpdir()}/_eotm_app.eotm`; copyFileSync(LOG, p);
  E.append(p, 0x7f, Buffer.from("future"));
  const after = readFileSync(p);
  assert.ok(after.subarray(0, buf.length).equals(buf));
  assert.equal(E.decode(E.scan(after).records.at(-1)).kind, "UNKNOWN(127)");
  writeFileSync(p, bad);
  assert.throws(() => E.append(p, 1, Buffer.alloc(1)), /broken log/);
});

test("Bayesian surprise: zero for no update, habituates on repetition, larger for the unexpected", () => {
  assert.equal(klDirichlet([2, 3, 4], [2, 3, 4]), 0);
  const m = makeModel([1]); const seq = [0, 1, 2, 3, 4].map(() => m.observe(new Map([[1, 1]])));
  for (let i = 1; i < seq.length; i++) assert.ok(seq[i] < seq[i - 1]);
  assert.ok(m.observe(new Map([[1, 3]])) > seq.at(-1));
});
