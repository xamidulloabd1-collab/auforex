/**
 * Content sniffing by magic bytes. The declared Content-Type / filename from the
 * client is never trusted for what gets stored or served.
 */
export type DetectedFile = { mime: string; ext: "mp4" | "webm" | "pdf" | "png" | "jpg" | "webp" };

export function detectFileType(head: Uint8Array): DetectedFile | null {
  const b = head;
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...Array.from(b.subarray(start, start + len)));

  if (b.length >= 5 && ascii(0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf" };
  if (b.length >= 8 && b[0] === 0x89 && ascii(1, 3) === "PNG") return { mime: "image/png", ext: "png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return { mime: "video/webm", ext: "webm" };
  }
  if (b.length >= 12 && ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    // ISO base media brands commonly used for H.264/AAC MP4 files
    if (/^(isom|iso2|iso5|iso6|mp41|mp42|avc1|dash|M4V |MSNV|f4v )$/.test(brand)) {
      return { mime: "video/mp4", ext: "mp4" };
    }
  }
  return null;
}

export const UPLOAD_KINDS = {
  video: { area: "videos", mimes: ["video/mp4", "video/webm"] },
  book: { area: "books", mimes: ["application/pdf"] },
  cover: { area: "covers", mimes: ["image/png", "image/jpeg", "image/webp"] },
  thumbnail: { area: "thumbnails", mimes: ["image/png", "image/jpeg", "image/webp"] },
  founder: { area: "founder", mimes: ["image/png", "image/jpeg", "image/webp"] },
  avatar: { area: "avatars", mimes: ["image/png", "image/jpeg", "image/webp"] },
  submission: { area: "submissions", mimes: ["image/png", "image/jpeg", "image/webp"] },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;
