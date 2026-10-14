import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Opt-in gate for routes that spend server-side provider credentials (Jira, Gemini).
 *
 * - KANTOR_API_TOKEN set: requests must send `Authorization: Bearer <token>`.
 * - KANTOR_API_TOKEN unset: allowed (local single-user mode). Pair this with
 *   `next start -H 127.0.0.1` (see package.json) so the server is not reachable
 *   from other machines. Setting the token is required for any shared exposure.
 */
export function requireApiToken(request: Request): NextResponse | null {
  const rawExpected = process.env.KANTOR_API_TOKEN;
  if (rawExpected === undefined) return null;
  const expected = rawExpected.trim();
  if (expected.length === 0) {
    return NextResponse.json({ error: 'Server misconfigured: KANTOR_API_TOKEN is empty' }, { status: 500 });
  }
  const header = request.headers.get('authorization') || '';
  const given = header.startsWith('Bearer ') ? header.slice(7) : '';
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  const ok = timingSafeEqual(a, b);
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return null;
}
