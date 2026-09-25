// Just enough PNG decoding (8-bit RGB or RGBA, non-interlaced, as Playwright
// writes screenshots) to look at pixels in a test. Returns {width, height,
// at(x, y) -> [r, g, b]}.
const zlib = require("zlib");

function decode(buf) {
  let pos = 8, width = 0, height = 0, bpp = 0, idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("ascii", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bpp = { 2: 3, 6: 4 }[data[9]];
      if (data[8] !== 8 || !bpp || data[12] !== 0) throw new Error("expected 8-bit RGB/RGBA, non-interlaced PNG");
    } else if (type === "IDAT") idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * bpp, px = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? px[dst + i - bpp] : 0;               // left
      const b = y > 0 ? px[dst - stride + i] : 0;               // up
      const c = y > 0 && i >= bpp ? px[dst - stride + i - bpp] : 0; // up-left
      let v = raw[src + i];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[dst + i] = v & 255;
    }
  }
  return { width, height, at: (x, y) => { const o = y * stride + x * bpp; return [px[o], px[o + 1], px[o + 2]]; } };
}

module.exports = { decode };
