import { describe, expect, it } from "vitest";
// @ts-expect-error — plain ESM script without type declarations
import { cleanTitle, decideAction, markDuplicates, numberIn, orderEntries } from "../../scripts/content-import.mjs";

describe("content import: names and order", () => {
  it("reads lesson numbers written in different ways", () => {
    expect(numberIn("01 - Forex nima.mp4")).toBe(1);
    expect(numberIn("3-dars Lot va spred.mp4")).toBe(3);
    expect(numberIn("Dars 12 Trend.mp4")).toBe(12);
    expect(numberIn("Dars_02_Trend.mp4")).toBe(2);
    expect(numberIn("Lesson 7.mp4")).toBe(7);
    expect(numberIn("Trend chiziqlari.mp4")).toBeNull();
  });

  it("cleans titles without losing the words", () => {
    expect(cleanTitle("01 - Forex nima")).toBe("Forex nima");
    expect(cleanTitle("1-dars. Trading nima")).toBe("Trading nima");
    expect(cleanTitle("Dars_02_Trend")).toBe("Trend");
    expect(cleanTitle("05.Fibonacci")).toBe("Fibonacci");
    expect(cleanTitle("Support va resistance")).toBe("Support va resistance");
    expect(cleanTitle("3-dars")).toBe("");
  });

  it("orders by the written number (10 after 9), and numbers 1..N when they are missing or repeat", () => {
    expect(orderEntries(["10 - c.mp4", "2 - b.mp4", "1 - a.mp4"])).toEqual([
      { name: "1 - a.mp4", number: 1 },
      { name: "2 - b.mp4", number: 2 },
      { name: "10 - c.mp4", number: 10 },
    ]);
    expect(orderEntries(["Trend.mp4", "Asoslar.mp4"]).map((e: { number: number }) => e.number)).toEqual([1, 2]);
    expect(orderEntries(["1 a.mp4", "1 b.mp4"]).map((e: { number: number }) => e.number)).toEqual([1, 2]);
  });
});

describe("content import: what each file needs", () => {
  const base = { ext: ".mp4", format: "mov,mp4,m4a,3gp,3g2,mj2", video: "h264", audio: "aac", pixFmt: "yuv420p", faststart: true };

  it("uploads browser-ready MP4 as is; moves the index of other MP4/MOV files without re-encoding", () => {
    expect(decideAction(base).action).toBe("upload");
    expect(decideAction({ ...base, faststart: false }).action).toBe("remux");
    expect(decideAction({ ...base, ext: ".mov" }).action).toBe("remux");
    expect(decideAction({ ...base, ext: ".mkv", format: "matroska,webm" }).action).toBe("remux");
  });

  it("asks for re-encoding when browsers cannot play the codec, and skips unreadable files", () => {
    expect(decideAction({ ...base, video: "hevc" })).toMatchObject({ action: "transcode" });
    expect(decideAction({ ...base, pixFmt: "yuv422p10le" })).toMatchObject({ action: "transcode" });
    expect(decideAction({ ...base, audio: "pcm_s16le" })).toMatchObject({ action: "transcode" });
    expect(decideAction({ error: "Invalid data" })).toMatchObject({ action: "skip" });
    expect(decideAction({ ...base, video: null })).toMatchObject({ action: "skip" });
    expect(decideAction({ ext: ".webm", format: "matroska,webm", video: "vp9", audio: "opus" })).toMatchObject({ action: "upload" });
  });

  it("never creates the same video twice: a later file with identical content is skipped", () => {
    const lessons = markDuplicates([
      { category: "Asoslar", title: "Forex nima", sha256: "a", action: "upload" },
      { category: "Asoslar", title: "Nusxa", sha256: "a", action: "upload" },
      { category: "Asoslar", title: "Boshqa", sha256: "b", action: "upload" },
    ]);
    expect(lessons.map((l: { action: string }) => l.action)).toEqual(["upload", "skip", "upload"]);
    expect(lessons[1].reason).toContain("Forex nima");
  });
});
