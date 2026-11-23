import { describe, expect, it } from "vitest";
import { presignUrl, signHeaders, uriEncode } from "@/lib/storage/s3";

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

  it("encodes like SigV4 expects", () => {
    expect(uriEncode("a b/c~d*é", true)).toBe("a%20b/c~d%2A%C3%A9");
    expect(uriEncode("a/b")).toBe("a%2Fb");
  });
});
