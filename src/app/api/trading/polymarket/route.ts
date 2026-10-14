import { NextResponse } from 'next/server';
import { filterPolymarket5mCrypto, PolymarketMarket } from '@/lib/engine/paperTrading';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = Date.now();

  try {
    // Fetch active markets from Polymarket Gamma API
    const res = await fetch(
      'https://gamma-api.polymarket.com/markets?limit=100&active=true&closed=false',
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 10 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({
        status: 'stale',
        markets: [],
        message: `Polymarket Gamma API responded with ${res.status}`,
        timestamp: now,
      });
    }

    const rawData: unknown = await res.json();
    let list: unknown[] = [];
    if (Array.isArray(rawData)) {
      list = rawData;
    } else if (rawData && typeof rawData === 'object' && 'data' in rawData) {
      const dataProp = (rawData as Record<string, unknown>).data;
      if (Array.isArray(dataProp)) {
        list = dataProp;
      }
    }

    const rawMarkets: PolymarketMarket[] = list
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((m) => {
        const id = String(m.id ?? m.condition_id ?? m.market_slug ?? '');
        const tokensList = Array.isArray(m.tokens) ? m.tokens : [];
        const outcomePrices = Array.isArray(m.outcomePrices) ? m.outcomePrices : [];
        return {
          id,
          question: String(m.question ?? m.title ?? ''),
          description: String(m.description ?? ''),
          category: String(m.category ?? ''),
          active: Boolean(m.active),
          closed: Boolean(m.closed),
          startDate: typeof m.start_date_iso === 'string' ? m.start_date_iso : typeof m.startDate === 'string' ? m.startDate : undefined,
          endDate: typeof m.end_date_iso === 'string' ? m.end_date_iso : typeof m.endDate === 'string' ? m.endDate : undefined,
          secondsDelay: typeof m.seconds_delay === 'number' ? m.seconds_delay : undefined,
          slug: typeof m.slug === 'string' ? m.slug : typeof m.market_slug === 'string' ? m.market_slug : undefined,
          tokens: tokensList.length > 0
            ? tokensList
                .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
                .map((t) => ({
                  token_id: String(t.token_id ?? ''),
                  outcome: String(t.outcome ?? ''),
                  price: typeof t.price === 'number' ? t.price : Number(t.price ?? 0.5),
                }))
            : [
                { token_id: `${id}-up`, outcome: 'Up', price: Number(outcomePrices[0] ?? 0.5) },
                { token_id: `${id}-down`, outcome: 'Down', price: Number(outcomePrices[1] ?? 0.5) },
              ],
        };
      });

    const matching = filterPolymarket5mCrypto(rawMarkets);

    if (matching.length === 0) {
      return NextResponse.json({
        status: 'live',
        markets: [],
        message: 'No active 5-minute crypto Up/Down market',
        clobWsUrl: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
        timestamp: now,
      });
    }

    return NextResponse.json({
      status: 'live',
      markets: matching,
      message: `${matching.length} active 5-minute crypto Up/Down market(s) available`,
      clobWsUrl: 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
      timestamp: now,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      status: 'stale',
      markets: [],
      message: `Failed to fetch Polymarket feed: ${message}`,
      timestamp: now,
    });
  }
}
