/**
 * Fixed-window in-memory rate limiter for application endpoints (uploads, progress,
 * submissions). Authentication endpoints use Better Auth's database-backed limiter.
 *
 * Note: memory buckets are per server instance. For multi-instance deployments,
 * swap this for a shared store (Redis/Upstash) behind the same function signature.
 */
export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Juda ko‘p so‘rov yuborildi. Birozdan so‘ng qayta urinib ko‘ring.");
  }
}

type Bucket = { count: number; resetAt: number };

const globalBuckets = globalThis as unknown as { __auRateBuckets?: Map<string, Bucket> };
const buckets = (globalBuckets.__auRateBuckets ??= new Map<string, Bucket>());

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    throw new RateLimitError(Math.ceil((bucket.resetAt - now) / 1000));
  }
}
