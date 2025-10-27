/**
 * Simple in-memory rate limiter for authentication endpoints
 * Note: In production with multiple serverless instances, use Redis or similar
 */

type RateLimitEntry = {
  count: number;
  resetTime: number;
  blockedUntil?: number;
};

const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now && (!entry.blockedUntil || entry.blockedUntil < now)) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Number of failures before account lockout */
  maxFailures?: number;
  /** Lockout duration in milliseconds (default: 15 minutes) */
  lockoutDurationMs?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  blocked?: boolean;
  blockedUntil?: number;
}

/**
 * Check if a request is within rate limits
 * @param identifier - Unique identifier (IP address, email, etc.)
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Check if blocked
  if (entry?.blockedUntil && entry.blockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
      blocked: true,
      blockedUntil: entry.blockedUntil,
    };
  }

  // Create new entry or reset if window expired
  if (!entry || entry.resetTime < now) {
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetTime: newEntry.resetTime,
    };
  }

  // Increment count
  entry.count++;
  rateLimitStore.set(identifier, entry);

  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetTime: entry.resetTime,
  };
}

/**
 * Record a failed authentication attempt and apply lockout if needed
 * @param identifier - Unique identifier (email, IP, etc.)
 * @param config - Rate limit configuration with lockout settings
 */
export function recordFailedAttempt(
  identifier: string,
  config: RateLimitConfig
): void {
  const now = Date.now();
  const lockoutKey = `lockout:${identifier}`;
  const entry = rateLimitStore.get(lockoutKey);

  const maxFailures = config.maxFailures || 5;
  const lockoutDuration = config.lockoutDurationMs || 15 * 60 * 1000; // 15 minutes

  if (!entry || entry.resetTime < now) {
    rateLimitStore.set(lockoutKey, {
      count: 1,
      resetTime: now + config.windowMs,
    });
  } else {
    entry.count++;

    if (entry.count >= maxFailures) {
      entry.blockedUntil = now + lockoutDuration;
    }

    rateLimitStore.set(lockoutKey, entry);
  }
}

/**
 * Check if an identifier is currently locked out
 * @param identifier - Unique identifier to check
 * @returns Lockout status
 */
export function isLockedOut(identifier: string): {
  locked: boolean;
  until?: number;
} {
  const lockoutKey = `lockout:${identifier}`;
  const entry = rateLimitStore.get(lockoutKey);

  if (!entry?.blockedUntil) {
    return { locked: false };
  }

  const now = Date.now();
  if (entry.blockedUntil > now) {
    return { locked: true, until: entry.blockedUntil };
  }

  return { locked: false };
}

/**
 * Clear rate limit entries for an identifier (e.g., after successful login)
 * @param identifier - Unique identifier to clear
 */
export function clearRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
  rateLimitStore.delete(`lockout:${identifier}`);
}

/**
 * Get client IP address from request headers (for Vercel/Next.js)
 * @param request - Next.js request object
 * @returns IP address or 'unknown'
 */
export function getClientIp(request: Request): string {
  // Vercel provides x-real-ip header
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  // Fallback to x-forwarded-for
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  return 'unknown';
}
