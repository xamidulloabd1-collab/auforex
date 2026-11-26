import { describe, expect, it } from "vitest";
import { isR2Endpoint, isValidBucketName, parseS3Config } from "@/lib/storage/config";

const base = {
  S3_ENDPOINT: "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com",
  S3_BUCKET: "auforex-media",
  S3_ACCESS_KEY_ID: "AKIAEXAMPLEKEY",
  S3_SECRET_ACCESS_KEY: "secret-access-key-example-123",
};

const error = (env: Record<string, string | undefined>) => {
  const r = parseS3Config(env);
  return r.ok ? null : r.error;
};

describe("S3 / R2 settings", () => {
  it("accepts the Cloudflare R2 S3 API address", () => {
    const r = parseS3Config(base);
    expect(r).toEqual({
      ok: true,
      config: { endpoint: base.S3_ENDPOINT, bucket: "auforex-media", accessKeyId: base.S3_ACCESS_KEY_ID, secretAccessKey: base.S3_SECRET_ACCESS_KEY, region: "auto" },
    });
    expect(isR2Endpoint(base.S3_ENDPOINT)).toBe(true);
  });

  it("is off when any of the four values is missing (no error)", () => {
    expect(parseS3Config({ ...base, S3_SECRET_ACCESS_KEY: "" })).toEqual({ ok: true, config: null });
    expect(parseS3Config({})).toEqual({ ok: true, config: null });
  });

  it("accepts the endpoint with the bucket pasted at the end (as Cloudflare shows it)", () => {
    const r = parseS3Config({ ...base, S3_ENDPOINT: `${base.S3_ENDPOINT}/auforex-media/` });
    expect(r.ok && r.config?.endpoint).toBe(base.S3_ENDPOINT);
  });

  it("trims spaces copied with the values", () => {
    const r = parseS3Config({ ...base, S3_BUCKET: " auforex-media ", S3_ACCESS_KEY_ID: ` ${base.S3_ACCESS_KEY_ID}\n` });
    expect(r.ok && r.config?.bucket).toBe("auforex-media");
    expect(r.ok && r.config?.accessKeyId).toBe(base.S3_ACCESS_KEY_ID);
  });

  it("explains the common mistakes", () => {
    expect(error({ ...base, S3_ENDPOINT: "https://pub-123.r2.dev" })).toMatch(/r2\.dev/);
    expect(error({ ...base, S3_ENDPOINT: "http://acc.r2.cloudflarestorage.com" })).toMatch(/https:\/\//);
    expect(error({ ...base, S3_ENDPOINT: "acc.r2.cloudflarestorage.com" })).toMatch(/to‘liq manzil/);
    expect(error({ ...base, S3_ENDPOINT: `${base.S3_ENDPOINT}/other-bucket` })).toMatch(/yo‘l bo‘lmasin/);
    expect(error({ ...base, S3_ENDPOINT: `${base.S3_ENDPOINT}?x=1` })).toMatch(/\?…/);
    expect(error({ ...base, S3_BUCKET: "Auforex_Media" })).toMatch(/S3_BUCKET/);
    expect(error({ ...base, S3_SECRET_ACCESS_KEY: "short" })).toMatch(/juda qisqa/);
  });

  it("allows http only for an emulator on this computer, and any https S3-compatible host", () => {
    expect(error({ ...base, S3_ENDPOINT: "http://127.0.0.1:9000" })).toBeNull();
    expect(error({ ...base, S3_ENDPOINT: "http://localhost:9000" })).toBeNull();
    expect(error({ ...base, S3_ENDPOINT: "http://10.0.0.5:9000" })).toMatch(/https:\/\//);
    expect(error({ ...base, S3_ENDPOINT: "https://s3.eu-central-1.amazonaws.com", S3_REGION: "eu-central-1" })).toBeNull();
  });

  it("bucket naming rules", () => {
    expect(isValidBucketName("auforex-media")).toBe(true);
    expect(isValidBucketName("a.b-c")).toBe(true);
    expect(isValidBucketName("ab")).toBe(false);
    expect(isValidBucketName("-abc")).toBe(false);
    expect(isValidBucketName("a..b")).toBe(false);
    expect(isValidBucketName("192.168.1.1")).toBe(false);
  });
});
