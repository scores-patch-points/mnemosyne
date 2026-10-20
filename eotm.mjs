// udhr-core/eotm.mjs — EOTM: the single binary log of the system's mind. It records ONLY differences that make a
// difference (DMD, Bateson): a record is appended iff the conclusion changed, and carries the Bayesian surprise of the
// change. Append-only and chained: every record ends with 8 bytes of sha256(prevChain || kind || payload), so no record
// can be edited or removed without breaking every record after it. No JSON, no field names: a record is its bytes.
//
//   file    := "EOTM" version(1)  record*
//   record  := kind(1)  length(varint)  payload(length)  chain(8)
//   varint  := LEB128 unsigned
//   every payload starts with domain(8) = sha256(name)[0:8]: one log, many readings; a reader that does not know a domain skips it
//   kinds   := 0x01 GROUND   0x02 DMD   0x03 WINDOW   0x04 MARGINS   0x05 DMDN (a DMD whose units are named by 8-byte ids)   0x06 REVISE (a DMDN caused by late evidence about an edition already read)     (this file's own; readers skip unknown kinds by length)
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

export const MAGIC = Buffer.from("EOTM"), VERSION = 1;
export const KIND = Object.freeze({ GROUND: 1, DMD: 2, WINDOW: 3, MARGINS: 4, DMDN: 5, REVISE: 6 });
export const KIND_NAME = Object.fromEntries(Object.entries(KIND).map(([k, v]) => [v, k]));
const GENESIS = createHash("sha256").update("EOTM1").digest().subarray(0, 8);

// ---- varint / field helpers ----------------------------------------------------------------------------------------
export class Writer {
  constructor() { this.parts = []; }
  u8(n) { this.parts.push(Buffer.from([n & 255])); return this; }
  varint(n) { const b = []; let v = BigInt(n); do { let x = Number(v & 127n); v >>= 7n; if (v > 0n) x |= 128; b.push(x); } while (v > 0n); this.parts.push(Buffer.from(b)); return this; }
  f32(x) { const b = Buffer.alloc(4); b.writeFloatLE(x); this.parts.push(b); return this; }
  hex(h, bytes) { const b = Buffer.from(h, "hex"); if (b.length !== bytes) throw new TypeError(`expected ${bytes} bytes, got ${b.length}`); this.parts.push(b); return this; }
  done() { return Buffer.concat(this.parts); }
}
export class Reader {
  constructor(buf) { this.b = buf; this.i = 0; }
  u8() { return this.b[this.i++]; }
  varint() { let n = 0n, shift = 0n; for (;;) { const x = this.b[this.i++]; n |= BigInt(x & 127) << shift; if (!(x & 128)) break; shift += 7n; } return Number(n); }
  f32() { const x = this.b.readFloatLE(this.i); this.i += 4; return x; }
  hex(bytes) { const h = this.b.subarray(this.i, this.i + bytes).toString("hex"); this.i += bytes; return h; }
  get done() { return this.i >= this.b.length; }
}

// ---- the chain ----------------------------------------------------------------------------------------------------
const chainOf = (prev, kind, payload) => createHash("sha256").update(prev).update(Buffer.from([kind])).update(payload).digest().subarray(0, 8);
export function frame(prev, kind, payload) {
  const len = new Writer().varint(payload.length).done();
  const chain = chainOf(prev, kind, payload);
  return { bytes: Buffer.concat([Buffer.from([kind]), len, payload, chain]), chain };
}
export const create = (path) => writeFileSync(path, Buffer.concat([MAGIC, Buffer.from([VERSION])]));

/** Walk a log, verifying the chain. Returns { records:[{kind, payload, offset}], tip, ok, error? }. */
export function scan(buf) {
  if (buf.length < 5 || !buf.subarray(0, 4).equals(MAGIC)) return { ok: false, error: "not an EOTM log", records: [] };
  if (buf[4] !== VERSION) return { ok: false, error: `unknown version ${buf[4]}`, records: [] };
  const records = []; let i = 5, prev = GENESIS;
  while (i < buf.length) {
    const offset = i, kind = buf[i++]; let len = 0, shift = 0;
    for (;;) { const x = buf[i++]; len |= (x & 127) << shift; if (!(x & 128)) break; shift += 7; }
    const payload = buf.subarray(i, i + len); i += len;
    const chain = buf.subarray(i, i + 8); i += 8;
    if (payload.length !== len || chain.length !== 8) return { ok: false, error: `truncated record at byte ${offset}`, records, tip: prev };
    if (!chain.equals(chainOf(prev, kind, payload))) return { ok: false, error: `chain broken at record ${records.length} (byte ${offset})`, records, tip: prev };
    records.push({ kind, payload, offset }); prev = chain;
  }
  return { ok: true, records, tip: prev };
}

/** The core pinned beside a log, if any (core.json): the immutable domain, its record count and byte length. */
export const coreOf = (path) => { const p = join(dirname(path), "core.json"); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; };

/** Append one record to a log file. The only write there is: the file never shrinks or changes before its tip.
 *  If a core.json sits beside the log, no record may be appended to the core's domain: the core is immutable. */
export function append(path, kind, payload) {
  const core = coreOf(path);
  if (core && Buffer.from(payload).subarray(0, 8).toString("hex") === domainOf(core.domain)) throw new Error(`refusing to append: the domain "${core.domain}" is the immutable core of this mind (core.json)`);
  const s = scan(readFileSync(path));
  if (!s.ok) throw new Error(`refusing to append to a broken log: ${s.error}`);
  const { bytes } = frame(s.tip, kind, payload);
  appendFileSync(path, bytes);
  return bytes.length;
}
export const exists = existsSync;

// ---- the four record kinds ----------------------------------------------------------------------------------------
export const enc = {
  ground: ({ domain, root, setRoot, editions, units }) => new Writer().hex(domain, 8).hex(root, 16).hex(setRoot, 16).varint(editions).varint(units).done(),
  dmd: ({ domain, step, source, before, after, surpriseBits, absorbedBits, changes }) => {
    const w = new Writer().hex(domain, 8).varint(step).hex(source, 10).hex(before, 16).hex(after, 16).f32(surpriseBits).f32(absorbedBits).varint(changes.length);
    for (const c of changes) w.u8(c.unit).varint(c.from + 1).varint(c.to + 1);            // 0 = no structure / not yet; v+1 otherwise
    return w.done();
  },
  dmdn: ({ domain, step, source, before, after, surpriseBits, absorbedBits, changes }) => {
    const w = new Writer().hex(domain, 8).varint(step).hex(source, 10).hex(before, 16).hex(after, 16).f32(surpriseBits).f32(absorbedBits).varint(changes.length);
    for (const c of changes) w.hex(c.id, 8).varint(c.from + 1).varint(c.to + 1);              // id = sha256(name)[0:8]; 0 = not in the conclusion
    return w.done();
  },
  // REVISE (0x06): the same layout as DMDN, but its `step` is the index of an edition ALREADY read, and the cause is late evidence (an outside answer
  // that re-read it) rather than the first reading. Appended only when the revision changed the conclusion; a revision that changes nothing is not a record.
  revise: (a) => enc.dmdn(a),
  window: ({ domain, rootP50, rootP95, rootMax, artP50, artP95, artMax, orders, pivotal }) => new Writer().hex(domain, 8).varint(rootP50).varint(rootP95).varint(rootMax).varint(artP50).varint(artP95).varint(artMax).varint(orders).varint(pivotal).done(),
  margins: (rows, domain) => { const w = new Writer().hex(domain, 8).varint(rows.length); for (const r of rows) w.u8(r.unit).varint(r.mode + 1).varint(r.support).varint(r.of).varint(r.margin); return w.done(); },
};
export function decode({ kind, payload }) {
  const r = new Reader(payload);
  switch (kind) {
    case KIND.GROUND: return { kind: "GROUND", domain: r.hex(8), root: r.hex(16), setRoot: r.hex(16), editions: r.varint(), units: r.varint() };
    case KIND.DMD: { const o = { kind: "DMD", domain: r.hex(8), step: r.varint(), source: r.hex(10), before: r.hex(16), after: r.hex(16), surpriseBits: r.f32(), absorbedBits: r.f32() }; const n = r.varint(); o.changes = Array.from({ length: n }, () => ({ unit: r.u8(), from: r.varint() - 1, to: r.varint() - 1 })); return o; }
    case KIND.DMDN: { const o = { kind: "DMDN", domain: r.hex(8), step: r.varint(), source: r.hex(10), before: r.hex(16), after: r.hex(16), surpriseBits: r.f32(), absorbedBits: r.f32() }; const n = r.varint(); o.changes = Array.from({ length: n }, () => ({ id: r.hex(8), from: r.varint() - 1, to: r.varint() - 1 })); return o; }
    case KIND.REVISE: { const o = { kind: "REVISE", domain: r.hex(8), step: r.varint(), source: r.hex(10), before: r.hex(16), after: r.hex(16), surpriseBits: r.f32(), absorbedBits: r.f32() }; const n = r.varint(); o.changes = Array.from({ length: n }, () => ({ id: r.hex(8), from: r.varint() - 1, to: r.varint() - 1 })); return o; }
    case KIND.WINDOW: return { kind: "WINDOW", domain: r.hex(8), rootP50: r.varint(), rootP95: r.varint(), rootMax: r.varint(), artP50: r.varint(), artP95: r.varint(), artMax: r.varint(), orders: r.varint(), pivotal: r.varint() };
    case KIND.MARGINS: { const domain = r.hex(8), n = r.varint(); return { kind: "MARGINS", domain, rows: Array.from({ length: n }, () => ({ unit: r.u8(), mode: r.varint() - 1, support: r.varint(), of: r.varint(), margin: r.varint() })) }; }
    default: return { kind: `UNKNOWN(${kind})`, bytes: payload.length };       // skipped by length, never an error
  }
}
export const unitName = (u) => (u === 0 ? "preamble" : u === 31 ? "declaration" : `article:${u}`);
export const domainOf = (name) => createHash("sha256").update(name).digest("hex").slice(0, 16);
