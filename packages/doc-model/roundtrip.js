#!/usr/bin/env node
// Round-trip harness for ADR 0001: runs every .tex file under each project
// folder in <corpus> through option A and option C and prints a Markdown table.
//
//   node packages/doc-model/roundtrip.js ~/libreleaf-corpus
//
// Option A keeps the LaTeX text as the master copy, so loading and saving is
// the identity and always exact; what it shows visually is the same set of
// recognised constructs as option C. Option C converts to a structured
// document and back, so it is the one that can lose bytes.
import fs from 'node:fs';
import path from 'node:path';
import { parse, serialize, coverage, editorNormalize } from './latex.js';

const optionA = { load: text => ({ text }), save: model => model.text };

function texFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...texFiles(p));
    else if (/\.tex$/i.test(e.name)) out.push(p);
  }
  return out;
}

const squash = s => s.replace(/\s+/g, ' ').trim();

const root = process.argv[2];
if (!root) { console.error('usage: roundtrip.js <corpus-folder>'); process.exit(2); }

const rows = [];
const total = { files: 0, a: 0, exact: 0, editor: 0, raw: 0, chars: 0, braw: 0, bchars: 0, ms: 0 };
for (const name of fs.readdirSync(root).sort()) {
  const dir = path.join(root, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const r = { name, files: 0, a: 0, exact: 0, editor: 0, raw: 0, chars: 0, braw: 0, bchars: 0, ms: 0, fails: [] };
  for (const file of texFiles(dir)) {
    const src = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    r.files++;
    if (optionA.save(optionA.load(src)) === src) r.a++;
    const t0 = performance.now();
    const doc = parse(src);
    const back = serialize(doc);
    r.ms += performance.now() - t0;
    if (back === src) r.exact++; else r.fails.push(path.relative(dir, file));
    if (squash(serialize(editorNormalize(doc))) === squash(src)) r.editor++;
    const c = coverage(doc);
    r.raw += c.rawChars; r.chars += c.total;
    const b = coverage(doc, { bodyOnly: true });
    r.braw += b.rawChars; r.bchars += b.total;
  }
  if (!r.files) continue;
  rows.push(r);
  for (const k of Object.keys(total)) total[k] += r[k];
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '—');
console.log('| Paper | .tex files | A exact | C exact | C editor round trip | C editable (file) | C editable (body) | C parse+save |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) {
  console.log(`| ${r.name} | ${r.files} | ${r.a}/${r.files} | ${r.exact}/${r.files} | ${r.editor}/${r.files} | ${pct(r.chars - r.raw, r.chars)} | ${pct(r.bchars - r.braw, r.bchars)} | ${r.ms.toFixed(0)} ms |`);
}
console.log(`| **All** | ${total.files} | ${total.a}/${total.files} | ${total.exact}/${total.files} | ${total.editor}/${total.files} | ${pct(total.chars - total.raw, total.chars)} | ${pct(total.bchars - total.braw, total.bchars)} | ${total.ms.toFixed(0)} ms |`);
const fails = rows.flatMap(r => r.fails.map(f => r.name + '/' + f));
if (fails.length) console.error('\nNot byte-exact:\n  ' + fails.join('\n  '));
