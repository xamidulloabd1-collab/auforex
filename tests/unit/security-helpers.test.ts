import { describe, expect, it } from "vitest";
import { detectFileType } from "@/lib/storage/file-types";
import { isPublicKey, isValidStorageKey, newStorageKey, publicMediaUrl } from "@/lib/storage/keys";
import { normalizeEmbedUrl } from "@/lib/embed";
import { safeRedirectPath } from "@/lib/utils";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? Array.from(p).map((c) => c.charCodeAt(0)) : p)));

describe("magic-byte detection", () => {
  it("detects real formats", () => {
    expect(detectFileType(bytes("%PDF-1.7\n", [0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("application/pdf");
    expect(detectFileType(bytes([0x89], "PNG\r\n", [0x1a, 0x0a], [0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("image/png");
    expect(detectFileType(bytes([0xff, 0xd8, 0xff, 0xe0], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("image/jpeg");
    expect(detectFileType(bytes([0, 0, 0, 0x20], "ftypisom", [0, 0, 0, 0]))?.mime).toBe("video/mp4");
    expect(detectFileType(bytes("RIFF", [0, 0, 0, 0], "WEBPVP8 "))?.mime).toBe("image/webp");
  });

  it("rejects disguised content", () => {
    expect(detectFileType(bytes("<html><script>alert(1)</script>"))).toBeNull();
    expect(detectFileType(bytes("MZ", [0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]))).toBeNull();
  });
});

describe("storage keys", () => {
  it("only accepts server-generated keys", () => {
    const key = newStorageKey("books", "pdf");
    expect(isValidStorageKey(key)).toBe(true);
    expect(isValidStorageKey("books/../../etc/passwd")).toBe(false);
    expect(isValidStorageKey("books/abc.pdf")).toBe(false);
    expect(isValidStorageKey("/books/" + "a".repeat(32) + ".pdf")).toBe(false);
  });

  it("never exposes private areas publicly", () => {
    expect(isPublicKey(newStorageKey("covers", "webp"))).toBe(true);
    expect(isPublicKey(newStorageKey("books", "pdf"))).toBe(false);
    expect(isPublicKey(newStorageKey("videos", "mp4"))).toBe(false);
    expect(publicMediaUrl(newStorageKey("videos", "mp4"))).toBeNull();
  });
});

describe("embed URL allow-list", () => {
  it("normalises supported providers", () => {
    expect(normalizeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(normalizeEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(normalizeEmbedUrl("https://vimeo.com/123456")).toBe("https://player.vimeo.com/video/123456");
  });

  it("rejects other hosts and schemes", () => {
    expect(normalizeEmbedUrl("https://evil.example.com/embed/x")).toBeNull();
    expect(normalizeEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeEmbedUrl("http://youtu.be/dQw4w9WgXcQ")).toBeNull();
  });
});

describe("safe redirects", () => {
  it("blocks open redirects", () => {
    expect(safeRedirectPath("/lessons")).toBe("/lessons");
    expect(safeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/\\evil.com")).toBe("/dashboard");
    expect(safeRedirectPath(null)).toBe("/dashboard");
  });
});

describe("safe redirects — browser URL quirks", () => {
  it("rejects paths a browser would turn into another site", () => {
    expect(safeRedirectPath("/\t/evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/\n/evil.com")).toBe("/dashboard");
    expect(safeRedirectPath("/a\\b")).toBe("/dashboard");
    expect(safeRedirectPath("/lessons?x=1#y")).toBe("/lessons?x=1#y");
    expect(safeRedirectPath("/books/%2F%2Fevil.com")).toBe("/books/%2F%2Fevil.com");
  });
});
