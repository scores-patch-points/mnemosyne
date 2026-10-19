#!/usr/bin/env node
// eotm-cli.mjs — read and verify an EOTM log.   node eotm-cli.mjs <file> [verify|dump]
import { readFileSync } from "node:fs";
import * as E from "./eotm.mjs";
const [file, mode = "dump"] = process.argv.slice(2);
if (!file) { console.error("usage: node eotm-cli.mjs <file.eotm> [verify|dump]"); process.exit(2); }
const buf = readFileSync(file), s = E.scan(buf);
if (!s.ok) { console.error(`BROKEN: ${s.error}`); process.exit(1); }
if (mode === "verify") { console.log(`ok: ${s.records.length} records, ${buf.length} bytes, tip ${s.tip.toString("hex")}`); process.exit(0); }
for (const r of s.records) {
  const d = E.decode(r);
  if (d.kind === "DMD") console.log(`DMD     step ${String(d.step).padStart(3)}  src ${d.source}  ${d.before.slice(0, 8)} -> ${d.after.slice(0, 8)}  surprise ${d.surpriseBits.toFixed(2)} bits (+${d.absorbedBits.toFixed(2)} absorbed before)  ${d.changes.map((c) => `${E.unitName(c.unit)}:${c.from < 0 ? "-" : c.from}->${c.to < 0 ? "-" : c.to}`).join(" ")}`);
  else if (d.kind === "DMDN") console.log(`DMDN    step ${String(d.step).padStart(3)}  src ${d.source}  ${d.before.slice(0, 8)} -> ${d.after.slice(0, 8)}  surprise ${d.surpriseBits.toFixed(2)} bits (+${d.absorbedBits.toFixed(2)} absorbed before)  ${d.changes.length} items changed: ${d.changes.filter((c) => c.to > c.from).length} in, ${d.changes.filter((c) => c.to < c.from).length} out  [domain ${d.domain}]`);
  else if (d.kind === "GROUND") console.log(`GROUND  root ${d.root}  set ${d.setRoot}  ${d.editions} editions, ${d.units} units`);
  else if (d.kind === "WINDOW") console.log(`WINDOW  stable window root p50/p95/max ${d.rootP50}/${d.rootP95}/${d.rootMax}, article ${d.artP50}/${d.artP95}/${d.artMax}, ${d.orders} orders, ${d.pivotal} pivotal editions`);
  else if (d.kind === "MARGINS") console.log(`MARGINS softest: ${d.rows.filter((x) => x.margin > 0).sort((a, b) => a.margin - b.margin).slice(0, 4).map((x) => `${E.unitName(x.unit)} ${x.margin}`).join(", ")}  (${d.rows.length} units)`);
  else console.log(`${d.kind} (${d.bytes} bytes, skipped)`);
}
console.log(`-- ${s.records.length} records, ${buf.length} bytes, chain tip ${s.tip.toString("hex")}`);
