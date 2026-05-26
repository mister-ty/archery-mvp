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
  // Never enable in production.
  if (process.env.DISABLE_RATE_LIMIT === '1') {
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
