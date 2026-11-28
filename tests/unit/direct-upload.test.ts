import { describe, expect, it } from "vitest";
import { handleRouteError } from "@/lib/api";
import { normalizeUploadCompletionError } from "@/lib/storage/direct";
import { UploadError } from "@/lib/storage";
import { S3Error } from "@/lib/storage/s3";

describe("multipart upload completion errors", () => {
  it.each([
    [400, "InvalidPart"],
    [404, "NoSuchUpload"],
  ])("turns S3 status %i into a safe client upload error", async (status, code) => {
    const result = normalizeUploadCompletionError(new S3Error(status, code, "provider response"));
    expect(result).toBeInstanceOf(UploadError);
    expect(result).toMatchObject({ status: 400, message: "Fayl bo‘laklarini birlashtirib bo‘lmadi — qayta yuklang" });
    if (!(result instanceof UploadError)) throw new Error("Expected an UploadError");
    expect(result.message).not.toContain("provider response");
    const response = handleRouteError(result);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: result.message });
  });

  it("keeps conflicts actionable and leaves genuine storage failures as server errors", () => {
    const conflict = normalizeUploadCompletionError(new S3Error(409, "Conflict", "provider response"));
    const unavailable = new S3Error(503, "ServiceUnavailable", "provider response");

    expect(conflict).toMatchObject({ status: 409 });
    expect(normalizeUploadCompletionError(unavailable)).toBe(unavailable);
  });
});
