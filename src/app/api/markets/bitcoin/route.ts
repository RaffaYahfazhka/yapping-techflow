import { NextResponse } from 'next/server';
import type { MarketFeedEnvelope } from '@/lib/data/markets';

export const dynamic = 'force-dynamic';

export interface BitcoinFeedData {
  priceUsd: number | null;
  change24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume24h: number | null;
  lastUpdatedAt: number | null;
}

const DEFAULT_COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_last_updated_at=true';

const FALLBACK_COINBASE_URL = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';

export async function GET() {
  const fetchedAt = new Date().toISOString();

  // Try CoinGecko first
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(DEFAULT_COINGECKO_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      const btc = json?.bitcoin;
      if (btc && typeof btc.usd === 'number' && Number.isFinite(btc.usd)) {
        const payload: MarketFeedEnvelope<BitcoinFeedData> = {
          ok: true,
          venue: 'polymarket' as any, // Typed for market envelope
          status: 'live',
          readOnly: true,
          fetchedAt,
          source: 'coingecko',
          reason: null,
          requires: [],
          warnings: [],
          data: {
            priceUsd: btc.usd,
            change24h: typeof btc.usd_24h_change === 'number' ? btc.usd_24h_change : null,
            high24h: null,
            low24h: null,
            volume24h: typeof btc.usd_24h_vol === 'number' ? btc.usd_24h_vol : null,
            lastUpdatedAt: typeof btc.last_updated_at === 'number' ? btc.last_updated_at * 1000 : Date.now(),
          },
        };
        return NextResponse.json(payload, { status: 200 });
      }
    }
  } catch {
    // Continue to fallback
  }

  // Fallback to Coinbase spot price if CoinGecko is rate-limited or fails
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(FALLBACK_COINBASE_URL, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      const amount = Number(json?.data?.amount);
      if (Number.isFinite(amount) && amount > 0) {
        const payload: MarketFeedEnvelope<BitcoinFeedData> = {
          ok: true,
          venue: 'polymarket' as any,
          status: 'live',
          readOnly: true,
          fetchedAt,
          source: 'coinbase-fallback',
          reason: null,
          requires: [],
          warnings: ['CoinGecko unavailable, using Coinbase spot fallback.'],
          data: {
            priceUsd: amount,
            change24h: null,
            high24h: null,
            low24h: null,
            volume24h: null,
            lastUpdatedAt: Date.now(),
          },
        };
        return NextResponse.json(payload, { status: 200 });
      }
    }
  } catch {
    // Failed fallback
  }

  const unavailable: MarketFeedEnvelope<BitcoinFeedData> = {
    ok: false,
    venue: 'polymarket' as any,
    status: 'unavailable',
    readOnly: true,
    fetchedAt,
    source: null,
    reason: 'Upstream spot feed unavailable. Live prices temporarily offline.',
    requires: [],
    warnings: [],
    data: {
      priceUsd: null,
      change24h: null,
      high24h: null,
      low24h: null,
      volume24h: null,
      lastUpdatedAt: null,
    },
  };
  return NextResponse.json(unavailable, { status: 200 });
}
