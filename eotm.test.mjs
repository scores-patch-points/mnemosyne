// Self-contained checks for the EOTM format and the surprise model (no UDHR data needed).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import * as E from "./eotm.mjs";
import { klDirichlet, klBeta, makeModel, makeCarryModel } from "./surprise.mjs";

const LOG = new URL("./mind.eot", import.meta.url), buf = readFileSync(LOG), scan = E.scan(buf), dec = scan.records.map(E.decode);

test("the committed log verifies and holds only differences plus the ground under them, per domain", () => {
  assert.ok(scan.ok, scan.error);
  assert.ok(buf.length < 16384, `${buf.length} bytes`);
  const domains = [...new Set(dec.map((d) => d.domain))];
  assert.equal(domains.length, 14, "udhr-core (structure), propositions, beings, beings-independent, ring1-english, ring1-associates, standpoints, and the seven co-core charters (charters/<name>/articles)");
  for (const dom of domains) {
    const mine = dec.filter((d) => d.domain === dom);
    const diffs = mine.filter((d) => d.kind === "DMD" || d.kind === "DMDN" || d.kind === "REVISE"), ground = mine.filter((d) => d.kind === "GROUND").at(-1);
    assert.ok(diffs.length >= 1);
    for (const d of diffs) assert.notEqual(d.before, d.after, "a record that changed nothing is not a record");
    for (let i = 1; i < diffs.length; i++) assert.equal(diffs[i].before, diffs[i - 1].after, "each difference starts where the last one ended");
    assert.equal(diffs.at(-1).after, ground.root, "the last difference lands on the ground");
  }
  assert.ok(dec.some((d) => d.kind === "WINDOW") && dec.some((d) => d.kind === "MARGINS"));
});

test("the folder-label withdrawal: ring1-associates ends empty, ring1-english loses ac:4/13/21, each by a REVISE citing the audit", () => {
  const rev = dec.filter((d) => d.kind === "REVISE" && d.source === "da44cc99f67cc8316db9");
  assert.equal(rev.length, 2, "one REVISE per withdrawn domain");
  assert.ok(rev.every((d) => d.changes.length >= 1 && d.changes.every((c) => c.from === 1 && c.to === 0)), "a withdrawal only turns items off");
  assert.equal(rev.find((d) => d.changes.length === 64).after, "e3b0c44298fc1c149afbf4c8996fb924", "the associates end as the empty set");
  assert.equal(rev.filter((d) => d.changes.length === 3).length, 1, "ring1-english: ac:4, ac:13, ac:21");
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

// ---- the immutable core (core.json) ----
const CORE = JSON.parse(readFileSync(new URL("./core.json", import.meta.url), "utf8"));
test("the core is the UDHR domain, pinned: its first records and bytes are exactly what core.json says", () => {
  const coreDom = E.domainOf(CORE.domain), idx = dec.map((d, i) => (d.domain === coreDom ? i : -1)).filter((i) => i >= 0);
  assert.equal(idx.length, CORE.records); assert.deepEqual(idx, Array.from({ length: CORE.records }, (_, i) => i), "the core records are the first ones, contiguous");
  assert.equal(scan.records[CORE.records].offset, CORE.bytes);
  assert.equal(createHash("sha256").update(buf.subarray(0, CORE.bytes)).digest("hex"), CORE.prefixSha256, "the core's bytes changed");
  const g = dec.filter((d) => d.domain === coreDom && d.kind === "GROUND").at(-1);
  assert.equal(g.root, CORE.charterRoot); assert.equal(g.setRoot, CORE.editionSetRoot);
});

test("the core is immutable: appending to its domain is refused; any other domain still appends", () => {
  const dir = mkdtempSync(join(tmpdir(), "core-")), p = join(dir, "mind.eot");
  copyFileSync(LOG, p); copyFileSync(new URL("./core.json", import.meta.url), join(dir, "core.json"));
  const rec = (name) => E.enc.dmdn({ domain: E.domainOf(name), step: 0, source: "ab".repeat(10), before: "00".repeat(16), after: "11".repeat(16), surpriseBits: 1, absorbedBits: 0, changes: [] });
  assert.throws(() => E.append(p, E.KIND.DMDN, rec(CORE.domain)), /immutable core/);
  assert.equal(readFileSync(p).length, buf.length, "the refused append wrote nothing");
  E.append(p, E.KIND.DMDN, rec("test/an-encounter")); assert.ok(readFileSync(p).length > buf.length);
});
