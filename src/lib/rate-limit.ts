// ==============================================================================
// GapLens AI — Sliding-Window Rate Limiter for AI Endpoints
// Protects Groq & Jina AI routes against burst abuse while remaining test-safe.
// ==============================================================================

import { NextResponse } from "next/server";

interface RateBucket {
  timestamps: number[];
}

const buckets = new Map<string, RateBucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Checks and records a request against a sliding-window rate limit.
 * Automatically bypassed during Vitest runs to avoid throttling automated tests.
 */
export function checkRateLimit(
  key: string,
  maxRequests = 30,
  windowMs = 60_000
): RateLimitResult {
  if (process.env.VITEST) {
    return { allowed: true, remaining: maxRequests, retryAfterSeconds: 0 };
  }

  const now = Date.now();
  const cutoff = now - windowMs;
  const bucket = buckets.get(key) || { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= maxRequests) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  // Periodic cleanup to prevent unbounded memory growth
  if (buckets.size > 1000) {
    for (const [k, b] of buckets.entries()) {
      if (b.timestamps.every((t) => t <= cutoff)) {
        buckets.delete(k);
      }
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.timestamps.length),
    retryAfterSeconds: 0,
  };
}

/**
 * Builds a standard 429 Too Many Requests JSON response with Retry-After header.
 */
export function rateLimitExceededResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    {
      error: `Rate limit exceeded. Please wait ${retryAfterSeconds}s before retrying.`,
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}
