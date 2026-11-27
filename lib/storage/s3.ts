/**
 * Minimal S3-compatible client (Cloudflare R2, AWS S3, Backblaze B2, MinIO …) with AWS Signature V4.
 * No SDK: only the operations this app needs, so the Vercel bundle stays small.
 *
 * Objects are addressed path-style: <endpoint>/<bucket>/<key>.
 * Browsers upload directly to the bucket with short-lived presigned URLs (Vercel functions accept at
 * most 4.5 MB per request, so large videos can never pass through the app).
 */
import { createHash, createHmac } from "node:crypto";

export type S3Config = {
  endpoint: string; // e.g. https://<account>.r2.cloudflarestorage.com
  region: string; // "auto" for R2
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Temporary credentials only (R2 Temporary Credentials API, AWS STS): sent as X-Amz-Security-Token. */
  sessionToken?: string;
};

type SigningConfig = Pick<S3Config, "region" | "accessKeyId" | "secretAccessKey" | "sessionToken">;

const sha256Hex = (data: string | Uint8Array) => createHash("sha256").update(data).digest("hex");
const hmac = (key: string | Buffer, data: string) => createHmac("sha256", key).update(data).digest();

/** RFC 3986 encoding as SigV4 requires (keeps A-Z a-z 0-9 - _ . ~). */
export function uriEncode(value: string, keepSlash = false) {
  let out = "";
  for (const ch of value) {
    if (/[A-Za-z0-9\-_.~]/.test(ch) || (keepSlash && ch === "/")) out += ch;
    else for (const byte of Buffer.from(ch, "utf8")) out += `%${byte.toString(16).toUpperCase().padStart(2, "0")}`;
  }
  return out;
}

export function amzDate(now = new Date()) {
  return now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // 20130524T000000Z
}

function canonicalQuery(params: Record<string, string>) {
  return Object.keys(params)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(params[k]!)}`)
    .join("&");
}

function signingKey(secret: string, date: string, region: string, service: string) {
  return hmac(hmac(hmac(hmac(`AWS4${secret}`, date), region), service), "aws4_request");
}

type SignInput = {
  method: string;
  url: URL;
  headers: Record<string, string>; // must include host
  query: Record<string, string>;
  payloadHash: string;
  date: string; // amzDate
  config: SigningConfig;
};

function signature({ method, url, headers, query, payloadHash, date, config }: SignInput) {
  const names = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort();
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.trim().replace(/\s+/g, " ")]));
  const canonical = [
    method,
    uriEncode(decodeURIComponent(url.pathname), true),
    canonicalQuery(query),
    names.map((n) => `${n}:${lower[n]}\n`).join(""),
    names.join(";"),
    payloadHash,
  ].join("\n");
  const day = date.slice(0, 8);
  const scope = `${day}/${config.region}/s3/aws4_request`;
  const toSign = ["AWS4-HMAC-SHA256", date, scope, sha256Hex(canonical)].join("\n");
  const sig = createHmac("sha256", signingKey(config.secretAccessKey, day, config.region, "s3")).update(toSign).digest("hex");
  return { sig, scope, signedHeaders: names.join(";") };
}

/** Presigned URL (query-string authentication). `headers` are headers the client must send exactly. */
export function presignUrl(
  config: S3Config | SigningConfig,
  method: string,
  rawUrl: string,
  opts: { expiresSeconds: number; query?: Record<string, string>; headers?: Record<string, string>; now?: Date },
) {
  const url = new URL(rawUrl);
  const date = amzDate(opts.now);
  const headers = { host: url.host, ...(opts.headers ?? {}) };
  const signedHeaders = Object.keys(headers)
    .map((h) => h.toLowerCase())
    .sort()
    .join(";");
  const query: Record<string, string> = {
    ...(opts.query ?? {}),
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${config.accessKeyId}/${date.slice(0, 8)}/${config.region}/s3/aws4_request`,
    "X-Amz-Date": date,
    "X-Amz-Expires": String(Math.max(1, Math.min(604800, Math.floor(opts.expiresSeconds)))),
    "X-Amz-SignedHeaders": signedHeaders,
    // Temporary credentials: the session token is part of the signed query.
    ...(config.sessionToken ? { "X-Amz-Security-Token": config.sessionToken } : {}),
  };
  const { sig } = signature({ method, url, headers, query, payloadHash: "UNSIGNED-PAYLOAD", date, config });
  return `${url.origin}${url.pathname}?${canonicalQuery(query)}&X-Amz-Signature=${sig}`;
}

/** Authorization-header signing for server-side requests. */
export function signHeaders(
  config: SigningConfig,
  method: string,
  rawUrl: string,
  opts: { headers?: Record<string, string>; payloadHash: string; now?: Date },
) {
  const url = new URL(rawUrl);
  const date = amzDate(opts.now);
  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => (query[k] = v));
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": opts.payloadHash,
    "x-amz-date": date,
    ...(config.sessionToken ? { "x-amz-security-token": config.sessionToken } : {}),
    ...(opts.headers ?? {}),
  };
  const { sig, scope, signedHeaders } = signature({ method, url, headers, query, payloadHash: opts.payloadHash, date, config });
  const { host: _host, ...rest } = headers;
  void _host;
  return {
    ...rest,
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`,
  };
}

/* ---------------------------------------------------------------------------------------------- */

export class S3Error extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Time allowed until the bucket answers (headers), per attempt. */
export const S3_TIMEOUT_MS = 20_000;
const S3_ATTEMPTS = 3;
const pause = (attempt: number) => new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));

const xmlValue = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))?.[1] ?? null;
const xmlEscape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export class S3Client {
  constructor(readonly config: S3Config) {}

  objectUrl(key: string) {
    return `${this.config.endpoint.replace(/\/$/, "")}/${uriEncode(this.config.bucket)}/${uriEncode(key, true)}`;
  }

  /**
   * Signed request. The response headers must arrive within `S3_TIMEOUT_MS` (a hung bucket
   * connection would otherwise hold a serverless function until its time limit); streaming the
   * body afterwards is not limited. Idempotent requests (GET/HEAD/PUT/DELETE) are retried on
   * network errors, timeouts and 5xx answers; POST (create/complete multipart) is sent once.
   */
  private async send(method: string, url: string, opts: { headers?: Record<string, string>; body?: string | Uint8Array } = {}) {
    const body = opts.body;
    const payloadHash = body === undefined ? sha256Hex("") : sha256Hex(body);
    const attempts = method === "POST" ? 1 : S3_ATTEMPTS;
    for (let attempt = 1; ; attempt++) {
      // Signed per attempt: the signature carries the request time.
      const headers = signHeaders(this.config, method, url, { headers: opts.headers, payloadHash });
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), S3_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(url, { method, headers, body: body as BodyInit | undefined, cache: "no-store", signal: controller.signal });
      } catch (err) {
        clearTimeout(timer);
        if (attempt < attempts) {
          await pause(attempt);
          continue;
        }
        const timedOut = controller.signal.aborted;
        throw new S3Error(
          timedOut ? 504 : 503,
          timedOut ? "Timeout" : "NetworkError",
          timedOut ? `S3 ${method}: ${S3_TIMEOUT_MS / 1000} s ichida javob kelmadi` : `S3 ${method}: ulanib bo‘lmadi (${(err as Error)?.message ?? err})`,
        );
      }
      clearTimeout(timer);
      if (res.ok || res.status === 206) return res;
      if (res.status >= 500 && attempt < attempts) {
        await res.body?.cancel().catch(() => {});
        await pause(attempt);
        continue;
      }
      const text = method === "HEAD" ? "" : await res.text().catch(() => "");
      throw new S3Error(res.status, xmlValue(text, "Code") ?? String(res.status), xmlValue(text, "Message") ?? `S3 ${method} ${res.status}`);
    }
  }

  async head(key: string): Promise<{ size: number; contentType: string | null } | null> {
    try {
      const res = await this.send("HEAD", this.objectUrl(key));
      const contentType = res.headers.get("content-type");
      const length = res.headers.get("content-length");
      if (length !== null && length !== "") return { size: Number(length), contentType };
      // Inside Next.js (server actions, route handlers — also on Vercel) the HEAD answer from R2 arrives
      // without Content-Length, which read as 0 bytes and failed every upload's size check. Ask for one
      // byte instead: the total size is in Content-Range ("bytes 0-0/<size>").
      return { size: await this.sizeByRange(key), contentType };
    } catch (err) {
      if (err instanceof S3Error && err.status === 404) return null;
      throw err;
    }
  }

  /** Object size from a one-byte ranged GET (Content-Range total); 0 for an empty object. */
  private async sizeByRange(key: string): Promise<number> {
    try {
      const res = await this.send("GET", this.objectUrl(key), { headers: { range: "bytes=0-0" } });
      await res.body?.cancel().catch(() => {});
      const total = /\/(\d+)\s*$/.exec(res.headers.get("content-range") ?? "")?.[1];
      if (total) return Number(total);
      // A full 200 answer (range ignored): its length is the object size.
      const length = res.headers.get("content-length");
      if (res.status === 200 && length) return Number(length);
      throw new S3Error(502, "NoObjectSize", "S3 did not report the object size");
    } catch (err) {
      // An empty object cannot satisfy "bytes=0-0".
      if (err instanceof S3Error && err.status === 416) return 0;
      throw err;
    }
  }

  /** GET with an optional inclusive byte range. */
  async get(key: string, range?: { start: number; end: number }) {
    const res = await this.send("GET", this.objectUrl(key), { headers: range ? { range: `bytes=${range.start}-${range.end}` } : undefined });
    return res;
  }

  async put(key: string, data: Uint8Array, contentType: string) {
    await this.send("PUT", this.objectUrl(key), { headers: { "content-type": contentType }, body: data });
  }

  async delete(key: string) {
    try {
      await this.send("DELETE", this.objectUrl(key));
    } catch (err) {
      if (!(err instanceof S3Error && err.status === 404)) throw err;
    }
  }

  async createMultipartUpload(key: string, contentType: string) {
    const res = await this.send("POST", `${this.objectUrl(key)}?uploads=`, { headers: { "content-type": contentType } });
    const uploadId = xmlValue(await res.text(), "UploadId");
    if (!uploadId) throw new S3Error(502, "NoUploadId", "S3 did not return an UploadId");
    return uploadId;
  }

  presignPart(key: string, uploadId: string, partNumber: number, expiresSeconds: number) {
    return presignUrl(this.config, "PUT", this.objectUrl(key), {
      expiresSeconds,
      query: { partNumber: String(partNumber), uploadId },
    });
  }

  presignPut(key: string, contentType: string, expiresSeconds: number) {
    return presignUrl(this.config, "PUT", this.objectUrl(key), { expiresSeconds, headers: { "content-type": contentType } });
  }

  presignGet(key: string, expiresSeconds: number) {
    return presignUrl(this.config, "GET", this.objectUrl(key), { expiresSeconds });
  }

  async completeMultipartUpload(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]) {
    const body =
      "<CompleteMultipartUpload>" +
      [...parts]
        .sort((a, b) => a.partNumber - b.partNumber)
        .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${xmlEscape(p.etag)}</ETag></Part>`)
        .join("") +
      "</CompleteMultipartUpload>";
    const res = await this.send("POST", `${this.objectUrl(key)}?uploadId=${uriEncode(uploadId)}`, {
      headers: { "content-type": "application/xml" },
      body,
    });
    // S3 may answer 200 with an <Error> body when completion fails.
    const text = await res.text();
    if (/<Error>/.test(text)) throw new S3Error(400, xmlValue(text, "Code") ?? "CompleteFailed", xmlValue(text, "Message") ?? "Complete failed");
  }

  async abortMultipartUpload(key: string, uploadId: string) {
    try {
      await this.send("DELETE", `${this.objectUrl(key)}?uploadId=${uriEncode(uploadId)}`);
    } catch (err) {
      if (!(err instanceof S3Error && err.status === 404)) throw err;
    }
  }
}
