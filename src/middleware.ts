import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { checkRateLimit } from './lib/rate-limit';

/**
 * Apply rate limiting only to the actual credential-login endpoint
 * (POST /api/auth/callback/credentials). NextAuth uses many helper
 * paths under /api/auth/* (csrf, providers, session) that don't need
 * throttling.
 */
export async function middleware(request: NextRequest) {
  // Bypass for automated tests — set DISABLE_RATE_LIMIT=1 in the dev server.
  if (process.env.DISABLE_RATE_LIMIT === '1') {
    return NextResponse.next();
  }

  // Auto-bypass on Vercel (or any serverless host) unless Upstash is
  // configured: the in-memory Map limiter does not share state between
  // lambda invocations, so it produces unpredictable 429s that lock
  // real users out. Without a shared Redis the only correct behaviour
  // is "no rate limit" — accept that as the cost of single-instance
  // simplicity. Set UPSTASH_REDIS_REST_URL to opt back in.
  const isServerless = process.env.VERCEL === '1';
  const hasSharedStore = Boolean(process.env.UPSTASH_REDIS_REST_URL);
  if (isServerless && !hasSharedStore) {
    return NextResponse.next();
  }

  if (
    request.method === 'POST' &&
    request.nextUrl.pathname === '/api/auth/callback/credentials'
  ) {
    const ip =
      request.ip ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      '127.0.0.1';
    const result = checkRateLimit(`login:${ip}`);

    if (!result.success) {
      return new NextResponse('Too Many Requests', {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
          'Retry-After': String(Math.ceil(result.retryAfterMs / 1000))
        }
      });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/callback/credentials']
};
