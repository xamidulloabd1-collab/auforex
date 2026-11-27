import { afterEach, describe, expect, it, vi } from "vitest";
import { S3Client, S3Error } from "@/lib/storage/s3";
import { probeStorage } from "@/lib/storage/probe";

const config = {
  endpoint: "https://account.r2.cloudflarestorage.com",
  bucket: "media",
  region: "auto",
  accessKeyId: "AKIDEXAMPLE1",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
};

afterEach(() => vi.unstubAllGlobals());

describe("S3 client resilience", () => {
  it("retries a GET after a 5xx answer and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(new Response("hello", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await new S3Client(config).get("books/a.pdf");
    expect(await res.text()).toBe("hello");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries network failures, then reports them as an S3Error the UI can explain", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new S3Client(config).head("books/a.pdf")).rejects.toMatchObject({ status: 503, code: "NetworkError" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("never repeats a POST (creating a multipart upload twice would leave an orphan)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<Error><Code>InternalError</Code></Error>", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new S3Client(config).createMultipartUpload("videos/a.mp4", "video/mp4")).rejects.toBeInstanceOf(S3Error);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a 4xx answer and keeps the S3 error code", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("<Error><Code>NoSuchBucket</Code><Message>x</Message></Error>", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(new S3Client(config).get("books/a.pdf")).rejects.toMatchObject({ status: 404, code: "NoSuchBucket" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("signs every attempt again (a retried request carries a fresh signature)", async () => {
    const auth: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      auth.push(String((init.headers as Record<string, string>).authorization));
      return auth.length < 2 ? new Response(null, { status: 500 }) : new Response(null, { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await new S3Client(config).delete("books/a.pdf");
    expect(auth).toHaveLength(2);
    expect(auth[0]).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE1\//);
  });
});

describe("storage check (npm run storage:check, Super admin → Tizim)", () => {
  /** A fake bucket: stores objects; CORS allows only `allowedOrigin` and optionally exposes ETag. */
  function fakeBucket(opts: { allowedOrigin: string; exposeEtag: boolean; deny?: boolean }) {
    const objects = new Map<string, Uint8Array>();
    return vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? "GET";
      const path = new URL(url).pathname;
      const headers = new Headers(init.headers);
      const origin = headers.get("origin");
      if (opts.deny && !origin) return new Response("<Error><Code>AccessDenied</Code></Error>", { status: 403 });
      const cors: Record<string, string> =
        origin === opts.allowedOrigin
          ? { "access-control-allow-origin": origin, "access-control-allow-methods": "GET, PUT, HEAD", "access-control-allow-headers": "content-type, range", ...(opts.exposeEtag ? { "access-control-expose-headers": "ETag" } : {}) }
          : {};
      if (method === "OPTIONS") return new Response(null, { status: origin === opts.allowedOrigin ? 200 : 403, headers: cors });
      if (method === "PUT") {
        objects.set(path, new Uint8Array(await new Response(init.body as BodyInit).arrayBuffer()));
        return new Response(null, { status: 200, headers: { etag: '"abc"', ...cors } });
      }
      if (method === "HEAD") {
        const o = objects.get(path);
        return o ? new Response(null, { status: 200, headers: { "content-length": String(o.length) } }) : new Response(null, { status: 404 });
      }
      if (method === "GET") {
        const o = objects.get(path);
        return o ? new Response(o as BodyInit, { status: 200 }) : new Response(null, { status: 404 });
      }
      if (method === "DELETE") {
        objects.delete(path);
        return new Response(null, { status: 204 });
      }
      if (method === "POST" && url.includes("uploads=")) return new Response("<InitiateMultipartUploadResult><UploadId>u1</UploadId></InitiateMultipartUploadResult>");
      return new Response(null, { status: 200 });
    });
  }

  it("passes with the right CORS rule", async () => {
    vi.stubGlobal("fetch", fakeBucket({ allowedOrigin: "https://auforex.uz", exposeEtag: true }));
    const steps = await probeStorage(config, "https://auforex.uz");
    expect(steps.every((s) => s.ok)).toBe(true);
  });

  it("names a missing site origin and a missing ETag exposure", async () => {
    vi.stubGlobal("fetch", fakeBucket({ allowedOrigin: "https://other.example", exposeEtag: true }));
    const wrongOrigin = await probeStorage(config, "https://auforex.uz");
    expect(wrongOrigin.find((s) => s.name.startsWith("CORS: https://auforex.uz"))).toMatchObject({ ok: false });

    vi.stubGlobal("fetch", fakeBucket({ allowedOrigin: "https://auforex.uz", exposeEtag: false }));
    const noEtag = await probeStorage(config, "https://auforex.uz");
    expect(noEtag.find((s) => s.name.includes("ETag"))).toMatchObject({ ok: false, detail: expect.stringMatching(/ExposeHeaders/) });
  });

  it("stops after a key/permission failure with a clear reason", async () => {
    vi.stubGlobal("fetch", fakeBucket({ allowedOrigin: "https://auforex.uz", exposeEtag: true, deny: true }));
    const steps = await probeStorage(config, "https://auforex.uz");
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ ok: false, detail: expect.stringMatching(/kalitlar noto‘g‘ri/) });
  });
});

describe("object size when HEAD has no Content-Length (Next.js runtime with R2)", () => {
  it("falls back to a one-byte ranged GET and reads the total from Content-Range", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      calls.push(`${init.method} ${headers.range ?? ""}`.trim());
      if (init.method === "HEAD") return new Response(null, { status: 200, headers: { "content-type": "video/mp4" } });
      return new Response("x", { status: 206, headers: { "content-range": "bytes 0-0/14113902", "content-length": "1" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const info = await new S3Client(config).head("videos/a.mp4");
    expect(info).toEqual({ size: 14113902, contentType: "video/mp4" });
    expect(calls).toEqual(["HEAD", "GET bytes=0-0"]);
  });

  it("uses Content-Length when HEAD has it (no extra request) and reports an empty object as 0", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      init.method === "HEAD" ? new Response(null, { status: 200, headers: { "content-length": "55" } }) : new Response(null, { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect((await new S3Client(config).head("books/a.pdf"))?.size).toBe(55);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) =>
        init.method === "HEAD" ? new Response(null, { status: 200 }) : new Response("<Error><Code>InvalidRange</Code></Error>", { status: 416 }),
      ),
    );
    expect((await new S3Client(config).head("books/empty.pdf"))?.size).toBe(0);
  });
});
