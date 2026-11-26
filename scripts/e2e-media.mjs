// Creates the media files the end-to-end tests upload (tests/e2e/video-lms.spec.ts):
//   small.mp4   — short video (copied from tests/fixtures/sample.mp4)
//   big.mp4     — ~14 MB video: object-storage uploads send it in exactly two 10 MiB parts (needs ffmpeg)
//   founder.png — a portrait image
//   book.pdf    — a valid 2-page PDF (the reader test expects "/ 2")
//
// Usage: node scripts/e2e-media.mjs [folder]   (default: $E2E_MEDIA_DIR or /tmp/e2emedia)
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

const dir = path.resolve(process.argv[2] ?? process.env.E2E_MEDIA_DIR ?? "/tmp/e2emedia");
mkdirSync(dir, { recursive: true });
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

copyFileSync(path.join(root, "tests", "fixtures", "sample.mp4"), path.join(dir, "small.mp4"));

/** Minimal two-page PDF (text only), with a correct cross-reference table. */
function twoPagePdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>",
    null, // page 1 content
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    null, // page 2 content
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = (text) => {
    const body = `BT /F1 28 Tf 72 760 Td (${text}) Tj ET`;
    return `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  };
  objects[3] = stream("AU Forex Academy - test 1");
  objects[5] = stream("AU Forex Academy - test 2");
  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}
writeFileSync(path.join(dir, "book.pdf"), twoPagePdf());

/** Solid-colour PNG (no external tools needed). */
function png(width, height, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
writeFileSync(path.join(dir, "founder.png"), png(600, 800, [201, 164, 92]));

const big = path.join(dir, "big.mp4");
const MiB = 1024 * 1024;
// The upload test expects two parts: more than one 10 MiB part, at most two.
if (!existsSync(big) || statSync(big).size <= 10 * MiB || statSync(big).size > 20 * MiB) {
  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-loglevel", "error", "-y",
      "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=30",
      "-f", "lavfi", "-i", "sine=frequency=440",
      "-t", "14",
      "-c:v", "libx264", "-x264-params", "nal-hrd=cbr", "-b:v", "8M", "-minrate", "8M", "-maxrate", "8M", "-bufsize", "2M",
      "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart",
      big,
    ],
    { stdio: "inherit" },
  );
  if (ffmpeg.status !== 0) {
    console.error("big.mp4 yaratilmadi: ffmpeg kerak (yoki 11–20 MB lik istalgan MP4 ni shu nom bilan qo‘ying).");
    process.exit(1);
  }
}

console.log(`E2E media tayyor: ${dir}`);
