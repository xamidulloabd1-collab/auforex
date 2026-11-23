import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanTitle, mp4DurationSeconds, planFolder } from "../../scripts/import-videos";

let tmp = "";
beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "auf-import-"));
});
afterAll(async () => {
  await rm(tmp, { recursive: true, force: true });
});

function box(type: string, ...children: Buffer[]) {
  const body = Buffer.concat(children);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length, 0);
  head.write(type, 4, "latin1");
  return Buffer.concat([head, body]);
}
function mvhd(version: 0 | 1, timescale: number, duration: number) {
  const b = Buffer.alloc(version === 1 ? 32 : 24);
  b[0] = version;
  if (version === 1) {
    b.writeUInt32BE(timescale, 20);
    b.writeBigUInt64BE(BigInt(duration), 24);
  } else {
    b.writeUInt32BE(timescale, 12);
    b.writeUInt32BE(duration, 16);
  }
  return box("mvhd", b);
}

describe("lesson titles from file names", () => {
  it("drops the leading number and separators", () => {
    expect(cleanTitle("01 - Trading nima")).toBe("Trading nima");
    expect(cleanTitle("1. Kirish")).toBe("Kirish");
    expect(cleanTitle("3_Risk_management")).toBe("Risk management");
    expect(cleanTitle("12) Fibonachchi")).toBe("Fibonachchi");
    expect(cleanTitle("07 Price action")).toBe("Price action");
    expect(cleanTitle("Trading 2026 rejasi")).toBe("Trading 2026 rejasi");
    expect(cleanTitle("15")).toBe("15");
  });
});

describe("folder plan", () => {
  it("treats sub-folders as courses and sorts lessons by number (2 before 10)", async () => {
    const root = path.join(tmp, "darslar");
    await mkdir(path.join(root, "02 Texnik tahlil"), { recursive: true });
    await mkdir(path.join(root, "01 Trading asoslari"), { recursive: true });
    for (const f of ["10 - Yakuniy.mp4", "2 - Ikkinchi.mp4", "1 - Birinchi.mov", "izoh.txt", ".yashirin.mp4"]) {
      await writeFile(path.join(root, "01 Trading asoslari", f), "x");
    }
    await writeFile(path.join(root, "02 Texnik tahlil", "1. Trend.mkv"), "x");
    await mkdir(path.join(root, "bo‘sh papka"));

    const plan = await planFolder(root);
    expect(plan.map((c) => c.title)).toEqual(["Trading asoslari", "Texnik tahlil"]);
    expect(plan[0]!.lessons.map((l) => l.title)).toEqual(["Birinchi", "Ikkinchi", "Yakuniy"]);
    expect(plan[1]!.lessons.map((l) => l.title)).toEqual(["Trend"]);
  });

  it("uses the folder (or --course) as the course when videos are directly inside", async () => {
    const root = path.join(tmp, "03 Strategiyalar");
    await mkdir(root);
    await writeFile(path.join(root, "01 Scalping.mp4"), "x");
    expect((await planFolder(root)).map((c) => c.title)).toEqual(["Strategiyalar"]);
    expect((await planFolder(root, "Maxsus kurs")).map((c) => c.title)).toEqual(["Maxsus kurs"]);
  });
});

describe("MP4 duration", () => {
  it("reads mvhd v0 and v1, also when moov comes after the media data", async () => {
    const v0 = path.join(tmp, "v0.mp4");
    await writeFile(v0, Buffer.concat([box("ftyp", Buffer.from("isom")), box("moov", mvhd(0, 1000, 754_000))]));
    expect(await mp4DurationSeconds(v0)).toBe(754);

    const v1 = path.join(tmp, "v1.mp4");
    await writeFile(v1, Buffer.concat([box("ftyp", Buffer.from("isom")), box("mdat", Buffer.alloc(4096)), box("moov", box("free"), mvhd(1, 90_000, 90_000 * 3600))]));
    expect(await mp4DurationSeconds(v1)).toBe(3600);
  });

  it("returns null for files it cannot read", async () => {
    const junk = path.join(tmp, "junk.mp4");
    await writeFile(junk, "not a video at all");
    expect(await mp4DurationSeconds(junk)).toBeNull();
    const noMoov = path.join(tmp, "nomoov.mp4");
    await writeFile(noMoov, box("ftyp", Buffer.from("isom")));
    expect(await mp4DurationSeconds(noMoov)).toBeNull();
  });
});
