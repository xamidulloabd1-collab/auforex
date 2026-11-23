import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeEmbedUrl } from "@/lib/embed";
import { blockingLesson, lockedLessonIds } from "@/lib/lessons/sequence";
import { bunnyToken, normalizeBunnyUrl, parseBunnyUrl, signBunnyEmbed } from "@/lib/video/bunny";

const VID = "eb1c4f77-0cda-46be-b47d-1118ad7c2ffe";
const EMBED = `https://iframe.mediadelivery.net/embed/759/${VID}`;

describe("Bunny Stream links", () => {
  it("accepts embed and play links and stores them without a token", () => {
    expect(normalizeBunnyUrl(EMBED)).toBe(EMBED);
    expect(normalizeBunnyUrl(`https://iframe.mediadelivery.net/play/759/${VID}`)).toBe(EMBED);
    expect(normalizeBunnyUrl(`${EMBED}?autoplay=false&token=abc&expires=1`)).toBe(`${EMBED}?autoplay=false`);
    expect(normalizeBunnyUrl(`https://player.mediadelivery.net/embed/759/${VID.toUpperCase()}`)).toBe(
      `https://player.mediadelivery.net/embed/759/${VID}`,
    );
    expect(normalizeEmbedUrl(`  ${EMBED}?preload=true  `)).toBe(`${EMBED}?preload=true`);
  });

  it("rejects anything that is not a Bunny video link", () => {
    for (const bad of [
      "http://iframe.mediadelivery.net/embed/759/" + VID,
      "https://iframe.mediadelivery.net/embed/759",
      "https://iframe.mediadelivery.net/embed/abc/" + VID,
      "https://iframe.mediadelivery.net/embed/759/not-a-guid",
      "https://iframe.mediadelivery.net/embed/759/" + VID + "/extra",
      "https://evil.example/embed/759/" + VID,
    ]) {
      expect(parseBunnyUrl(bad), bad).toBeNull();
    }
    expect(normalizeEmbedUrl("https://iframe.mediadelivery.net/whatever")).toBeNull();
  });

  it("signs with SHA256_HEX(key + video id + expires) as Bunny documents", () => {
    const key = "4742a81b-bf15-42fe-8b1c-8fcb9024c550";
    const now = Date.UTC(2026, 10, 21, 12, 0, 0);
    const expires = Math.floor(now / 1000) + 3600;
    const expected = createHash("sha256").update(key + VID + expires).digest("hex");
    expect(bunnyToken(key, VID, expires)).toBe(expected);

    const signed = new URL(signBunnyEmbed(`${EMBED}?autoplay=false`, key, { ttlSeconds: 3600, now }));
    expect(signed.origin + signed.pathname).toBe(EMBED);
    expect(signed.searchParams.get("autoplay")).toBe("false");
    expect(signed.searchParams.get("expires")).toBe(String(expires));
    expect(signed.searchParams.get("token")).toBe(expected);
    expect(expected).toMatch(/^[0-9a-f]{64}$/);
  });

  it("leaves links alone when no key is set or the link is not Bunny", () => {
    expect(signBunnyEmbed(EMBED, undefined)).toBe(EMBED);
    const yt = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ";
    expect(signBunnyEmbed(yt, "4742a81b-bf15-42fe-8b1c-8fcb9024c550")).toBe(yt);
  });
});

describe("sequential lessons", () => {
  const l = (id: string, completed = false) => ({ id, completed });

  it("opens only the first unfinished lesson and everything before it", () => {
    expect([...lockedLessonIds([l("a"), l("b"), l("c")])]).toEqual(["b", "c"]);
    expect([...lockedLessonIds([l("a", true), l("b"), l("c")])]).toEqual(["c"]);
    expect([...lockedLessonIds([l("a", true), l("b", true), l("c", true)])]).toEqual([]);
    expect([...lockedLessonIds([])]).toEqual([]);
  });

  it("keeps completed lessons open even when an earlier one is unfinished", () => {
    // e.g. the admin inserted a new lesson 2 after the student finished lesson 3
    expect([...lockedLessonIds([l("1", true), l("new"), l("3", true), l("4")])]).toEqual(["4"]);
  });

  it("does nothing when the setting is off", () => {
    expect([...lockedLessonIds([l("a"), l("b")], false)]).toEqual([]);
    expect(blockingLesson([l("a"), l("b")], "b", false)).toBeNull();
  });

  it("names the lesson to finish first", () => {
    const list = [l("a", true), l("b"), l("c")];
    expect(blockingLesson(list, "c")?.id).toBe("b");
    expect(blockingLesson(list, "b")).toBeNull();
    expect(blockingLesson(list, "a")).toBeNull();
    expect(blockingLesson(list, "unknown")).toBeNull();
  });
});
