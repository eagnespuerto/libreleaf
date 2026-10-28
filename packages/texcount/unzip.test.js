'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { readZip } = require('./unzip.js');

// Build a small .zip in memory: one stored entry, one deflated, one folder.
function makeZip(entries) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const raw = Buffer.from(e.text || '', 'utf8');
    const data = e.deflate ? zlib.deflateRawSync(raw) : raw;
    const method = e.deflate ? 8 : 0;
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x800, 6); lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x800, 8); ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    locals.push(lh, name, data);
    centrals.push(ch, name);
    offset += lh.length + name.length + data.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, cd, end]));
}

test('reads stored and deflated entries and skips folders', async () => {
  const zip = makeZip([
    { name: 'paper/' },
    { name: 'paper/main.tex', text: '\\input{intro} Erdős', deflate: true },
    { name: 'paper/intro.tex', text: 'Hello there.' },
    { name: 'paper/fig.png', text: 'not text' },
  ]);
  const files = await readZip(zip, (n) => n.endsWith('.tex'));
  const dec = new TextDecoder();
  assert.deepEqual(files.map((f) => [f.name, dec.decode(f.data)]), [
    ['paper/main.tex', '\\input{intro} Erdős'],
    ['paper/intro.tex', 'Hello there.'],
  ]);
});

test('rejects files that are not zips', () => {
  assert.throws(() => readZip(new Uint8Array(100)), /not a \.zip/);
});
