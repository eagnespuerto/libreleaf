/*!
 * LibreLeaf unzip — reads files out of a .zip with no dependencies.
 * Uses the built-in DecompressionStream (all current browsers, Node 18+).
 * Copyright (C) 2026 Ella Agnes Puerto. AGPL-3.0-or-later.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LibreUnzip = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function u16(v, o) { return v.getUint16(o, true); }
  function u32(v, o) { return v.getUint32(o, true); }

  function findEnd(v) {
    var min = Math.max(0, v.byteLength - 65557);
    for (var i = v.byteLength - 22; i >= min; i--) if (u32(v, i) === 0x06054b50) return i;
    throw new Error('This is not a .zip file, or it is damaged.');
  }

  function inflate(bytes) {
    var ds;
    try { ds = new DecompressionStream('deflate-raw'); } catch (e) {
      // Node 18 lacks 'deflate-raw' in DecompressionStream; use zlib there.
      if (typeof require === 'function') {
        try { return Promise.resolve(new Uint8Array(require('zlib').inflateRawSync(bytes))); } catch (err) { return Promise.reject(err); }
      }
      return Promise.reject(new Error('This browser cannot unpack .zip files. Please open the folder instead.'));
    }
    var stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Response(stream).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }

  /**
   * List and extract the files in a .zip.
   * @param {ArrayBuffer|Uint8Array} data the .zip file
   * @param {(name: string) => boolean} [want] which entries to extract (default: all)
   * @returns {Promise<Array<{name: string, data: Uint8Array}>>}
   */
  function readZip(data, want) {
    var buf = data instanceof Uint8Array ? data : new Uint8Array(data);
    var v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    var end = findEnd(v);
    var n = u16(v, end + 10), p = u32(v, end + 16);
    if (p === 0xffffffff || n === 0xffff) return Promise.reject(new Error('Zip64 archives are not supported yet.'));
    var utf8 = new TextDecoder('utf-8'), latin = new TextDecoder('latin1');
    var jobs = [];
    for (var k = 0; k < n; k++) {
      if (u32(v, p) !== 0x02014b50) return Promise.reject(new Error('The .zip file is damaged.'));
      var flags = u16(v, p + 8), method = u16(v, p + 10), size = u32(v, p + 20);
      var nameLen = u16(v, p + 28), extraLen = u16(v, p + 30), commentLen = u16(v, p + 32), local = u32(v, p + 42);
      var name = ((flags & 0x800) ? utf8 : latin).decode(buf.subarray(p + 46, p + 46 + nameLen));
      p += 46 + nameLen + extraLen + commentLen;
      if (/\/$/.test(name) || /(^|\/)__MACOSX\//.test(name) || (want && !want(name))) continue;
      if (flags & 1) return Promise.reject(new Error('Password-protected .zip files are not supported.'));
      var start = local + 30 + u16(v, local + 26) + u16(v, local + 28);
      var bytes = buf.subarray(start, start + size);
      jobs.push((function (name, method, bytes) {
        if (method === 0) return Promise.resolve({ name: name, data: bytes });
        if (method === 8) return inflate(bytes).then(function (d) { return { name: name, data: d }; });
        return Promise.reject(new Error(name + ' uses an unsupported compression method.'));
      })(name, method, bytes));
    }
    return Promise.all(jobs);
  }

  return { readZip: readZip };
});
