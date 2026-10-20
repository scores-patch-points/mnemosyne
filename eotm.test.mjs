// Self-contained checks for the EOTM format and the surprise model (no UDHR data needed).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as E from "./eotm.mjs";
import { klDirichlet, klBeta, makeModel, makeCarryModel } from "./surprise.mjs";

const LOG = new URL("./mind.eot", import.meta.url), buf = readFileSync(LOG), scan = E.scan(buf), dec = scan.records.map(E.decode);

test("the committed log verifies and holds only differences plus the ground under them, per domain", () => {
  assert.ok(scan.ok, scan.error);
  assert.ok(buf.length < 16384, `${buf.length} bytes`);
  const domains = [...new Set(dec.map((d) => d.domain))];
  assert.equal(domains.length, 7, "udhr-core (structure), propositions, beings, beings-independent, ring1-english, priors-grown, ring1-associates");
  for (const dom of domains) {
    const mine = dec.filter((d) => d.domain === dom);
    const diffs = mine.filter((d) => d.kind === "DMD" || d.kind === "DMDN"), ground = mine.filter((d) => d.kind === "GROUND").at(-1);
    assert.ok(diffs.length >= 1);
    for (const d of diffs) assert.notEqual(d.before, d.after, "a record that changed nothing is not a record");
    for (let i = 1; i < diffs.length; i++) assert.equal(diffs[i].before, diffs[i - 1].after, "each difference starts where the last one ended");
    assert.equal(diffs.at(-1).after, ground.root, "the last difference lands on the ground");
  }
  assert.ok(dec.some((d) => d.kind === "WINDOW") && dec.some((d) => d.kind === "MARGINS"));
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
  assert.equal(klBeta(3, 2, 3, 2), 0);
  const c = makeCarryModel(["a"]); const seen = [0, 1, 2].map(() => c.observe(new Set(["a"])));
  assert.ok(seen[2] < seen[1] && seen[1] < seen[0], "a proposition carried again and again stops being news");
  assert.ok(c.observe(new Set()) > seen[2], "an edition that drops it is news");
});

test("REVISE: late evidence about an edition already read is a record of its own kind, same layout as DMDN", () => {
  const p = `${tmpdir()}/_eotm_revise.eotm`; copyFileSync(LOG, p);
  const a = { domain: E.domainOf("test/revise"), step: 7, source: "ab".repeat(10), before: "0a".repeat(16), after: "0b".repeat(16), surpriseBits: 1.5, absorbedBits: 0, changes: [{ id: "cd".repeat(8), from: 1, to: 0 }] };
  E.append(p, E.KIND.REVISE, E.enc.revise(a));
  const after = readFileSync(p), s = E.scan(after);
  assert.ok(s.ok, s.error); assert.ok(after.subarray(0, buf.length).equals(buf));
  const d = E.decode(s.records.at(-1));
  assert.equal(d.kind, "REVISE"); assert.equal(d.step, 7); assert.deepEqual(d.changes, [{ id: "cd".repeat(8), from: 1, to: 0 }]);
  assert.equal(E.KIND.REVISE, 6);
});
