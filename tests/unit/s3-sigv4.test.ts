import { afterEach, describe, expect, it, vi } from "vitest";
import { presignUrl, S3Client, signHeaders, uriEncode } from "@/lib/storage/s3";

/**
 * Reference examples from the AWS documentation ("Signature Version 4 — examples"):
 * the same credentials, date and requests must produce exactly AWS's published signatures.
 */
const config = {
  region: "us-east-1",
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};
const now = new Date("2013-05-24T00:00:00Z");
const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const sig = (authorization: string) => authorization.match(/Signature=([0-9a-f]{64})/)?.[1];

afterEach(() => vi.unstubAllGlobals());

describe("AWS Signature V4", () => {
  it("GET object with a Range header", () => {
    const h = signHeaders(config, "GET", "https://examplebucket.s3.amazonaws.com/test.txt", {
      headers: { range: "bytes=0-9" },
      payloadHash: EMPTY,
      now,
    });
    expect(h.authorization).toContain("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date");
    expect(sig(h.authorization)).toBe("f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
  });

  it("PUT object with a special character in the key", () => {
    const h = signHeaders(config, "PUT", "https://examplebucket.s3.amazonaws.com/test$file.text", {
      headers: { date: "Fri, 24 May 2013 00:00:00 GMT", "x-amz-storage-class": "REDUCED_REDUNDANCY" },
      payloadHash: "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072",
      now,
    });
    expect(sig(h.authorization)).toBe("98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd");
  });

  it("GET with a query parameter that has no value (?lifecycle)", () => {
    const h = signHeaders(config, "GET", "https://examplebucket.s3.amazonaws.com/?lifecycle", { payloadHash: EMPTY, now });
    expect(sig(h.authorization)).toBe("fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543");
  });

  it("GET with sorted query parameters (?max-keys=2&prefix=J)", () => {
    const h = signHeaders(config, "GET", "https://examplebucket.s3.amazonaws.com/?max-keys=2&prefix=J", { payloadHash: EMPTY, now });
    expect(sig(h.authorization)).toBe("34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7");
  });

  it("presigned GET URL valid for 24 hours", () => {
    const url = new URL(presignUrl(config, "GET", "https://examplebucket.s3.amazonaws.com/test.txt", { expiresSeconds: 86400, now }));
    expect(url.searchParams.get("X-Amz-Credential")).toBe("AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toBe("aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });

  it("presigns a path-style R2 PUT and binds the exact Content-Type", () => {
    const rawUrl = "https://account.r2.cloudflarestorage.com/auforex-media/founder/portrait.png";
    const signed = new URL(presignUrl(config, "PUT", rawUrl, {
      expiresSeconds: 3600,
      headers: { "content-type": "image/png" },
      now,
    }));
    const otherType = new URL(presignUrl(config, "PUT", rawUrl, {
      expiresSeconds: 3600,
      headers: { "content-type": "application/octet-stream" },
      now,
    }));

    expect(signed.pathname).toBe("/auforex-media/founder/portrait.png");
    expect(signed.searchParams.get("X-Amz-SignedHeaders")).toBe("content-type;host");
    expect(signed.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
    expect(signed.searchParams.get("X-Amz-Signature")).not.toBe(otherType.searchParams.get("X-Amz-Signature"));
  });

  it("encodes like SigV4 expects", () => {
    expect(uriEncode("a b/c~d*é", true)).toBe("a%20b/c~d%2A%C3%A9");
    expect(uriEncode("a/b")).toBe("a%2Fb");
  });

  it("does not mistake an S3 permission failure for a missing object", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    const client = new S3Client({
      ...config,
      endpoint: "https://account.r2.cloudflarestorage.com",
      bucket: "private-media",
    });

    await expect(client.head("founder/portrait.png")).rejects.toMatchObject({ status: 403 });
  });

  it("returns null only when S3 confirms that the object is missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    const client = new S3Client({
      ...config,
      endpoint: "https://account.r2.cloudflarestorage.com",
      bucket: "private-media",
    });

    await expect(client.head("founder/portrait.png")).resolves.toBeNull();
  });
});

describe("AWS Signature V4 with temporary credentials", () => {
  const temp = { ...config, sessionToken: "temporary-session-token-abc" };
  it("signs the X-Amz-Security-Token header; changing the token changes the signature", () => {
    const h = signHeaders(temp, "GET", "https://examplebucket.s3.amazonaws.com/test.txt", { payloadHash: EMPTY, now });
    expect((h as Record<string, string>)["x-amz-security-token"]).toBe("temporary-session-token-abc");
    expect(h.authorization).toMatch(/SignedHeaders=[^,]*x-amz-security-token/);
    const other = signHeaders({ ...temp, sessionToken: "another-session-token" }, "GET", "https://examplebucket.s3.amazonaws.com/test.txt", { payloadHash: EMPTY, now });
    expect(sig(other.authorization)).not.toBe(sig(h.authorization));
  });

  it("puts the session token into presigned URLs (signed), and not for permanent keys", () => {
    const url = new URL(presignUrl(temp, "PUT", "https://examplebucket.s3.amazonaws.com/a.mp4", { expiresSeconds: 60, now }));
    expect(url.searchParams.get("X-Amz-Security-Token")).toBe("temporary-session-token-abc");
    const other = new URL(presignUrl({ ...temp, sessionToken: "another-session-token" }, "PUT", "https://examplebucket.s3.amazonaws.com/a.mp4", { expiresSeconds: 60, now }));
    expect(other.searchParams.get("X-Amz-Signature")).not.toBe(url.searchParams.get("X-Amz-Signature"));
    const plain = new URL(presignUrl(config, "PUT", "https://examplebucket.s3.amazonaws.com/a.mp4", { expiresSeconds: 60, now }));
    expect(plain.searchParams.has("X-Amz-Security-Token")).toBe(false);
  });
});
