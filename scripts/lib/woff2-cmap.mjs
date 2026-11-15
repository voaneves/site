// Minimal WOFF2 reader that returns the set of code points covered by a font's cmap.
// cmap is never transformed in WOFF2, so brotli-decompressing the table stream is enough.
import zlib from 'node:zlib';

const KNOWN_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep',
  'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE',
  'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt',
  'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar',
  'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

function readBase128(buf, pos) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = buf[pos.i++];
    value = value * 128 + (byte & 0x7f);
    if (!(byte & 0x80)) return value;
  }
  throw new Error('Invalid UIntBase128');
}

export function readWoff2Cmap(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('Not a WOFF2 file');
  const numTables = buf.readUInt16BE(12);
  const compressedSize = buf.readUInt32BE(20);
  const pos = { i: 48 };
  const tables = [];
  for (let n = 0; n < numTables; n++) {
    const flags = buf[pos.i++];
    const tagIndex = flags & 0x3f;
    let tag;
    if (tagIndex === 0x3f) {
      tag = buf.toString('latin1', pos.i, pos.i + 4);
      pos.i += 4;
    } else {
      tag = KNOWN_TAGS[tagIndex];
    }
    const transformVersion = flags >> 6;
    const origLength = readBase128(buf, pos);
    const isGlyfLoca = tag === 'glyf' || tag === 'loca';
    const transformed = isGlyfLoca ? transformVersion === 0 : transformVersion !== 0;
    const length = transformed ? readBase128(buf, pos) : origLength;
    tables.push({ tag, length });
  }
  const data = zlib.brotliDecompressSync(buf.subarray(pos.i, pos.i + compressedSize));
  let offset = 0;
  let cmap = null;
  for (const t of tables) {
    if (t.tag === 'cmap') cmap = data.subarray(offset, offset + t.length);
    offset += t.length;
  }
  if (!cmap) throw new Error('cmap table not found');

  const covered = new Set();
  const numSub = cmap.readUInt16BE(2);
  for (let s = 0; s < numSub; s++) {
    const subOffset = cmap.readUInt32BE(4 + s * 8 + 4);
    const format = cmap.readUInt16BE(subOffset);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(subOffset + 6);
      const seg = segX2 / 2;
      const endBase = subOffset + 14;
      const startBase = endBase + segX2 + 2;
      const deltaBase = startBase + segX2;
      const rangeBase = deltaBase + segX2;
      for (let i = 0; i < seg; i++) {
        const end = cmap.readUInt16BE(endBase + i * 2);
        const start = cmap.readUInt16BE(startBase + i * 2);
        const delta = cmap.readInt16BE(deltaBase + i * 2);
        const rangeOffset = cmap.readUInt16BE(rangeBase + i * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph;
          if (rangeOffset === 0) {
            glyph = (c + delta) & 0xffff;
          } else {
            const gi = rangeBase + i * 2 + rangeOffset + (c - start) * 2;
            glyph = cmap.readUInt16BE(gi);
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) covered.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(subOffset + 12);
      for (let g = 0; g < groups; g++) {
        const base = subOffset + 16 + g * 12;
        const start = cmap.readUInt32BE(base);
        const end = cmap.readUInt32BE(base + 4);
        const startGlyph = cmap.readUInt32BE(base + 8);
        for (let c = start; c <= end; c++) if (startGlyph + (c - start) !== 0) covered.add(c);
      }
    }
  }
  return covered;
}
