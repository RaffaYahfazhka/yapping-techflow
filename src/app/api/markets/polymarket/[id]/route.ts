import { NextResponse } from 'next/server';
import type { MarketFeedEnvelope, PolymarketMarket } from '@/lib/data/markets';

export const dynamic = 'force-dynamic';

const DEFAULT_GAMMA_BASE = 'https://gamma-api.polymarket.com';

export interface PolymarketDetailFeedData {
  market: PolymarketMarket | null;
  resolved: boolean;
  winningOutcome: string | null;
  clobBook?: {
    bids: Array<{ price: number; size: number }>;
    asks: Array<{ price: number; size: number }>;
  } | null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const fetchedAt = new Date().toISOString();

  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'Missing market id' }, { status: 400 });
  }

  const gammaBase = process.env.POLYMARKET_GAMMA_BASE || DEFAULT_GAMMA_BASE;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${gammaBase}/markets/${encodeURIComponent(id)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    clearTimeout(timer);

    if (!res.ok) {
      const payload: MarketFeedEnvelope<PolymarketDetailFeedData> = {
        ok: false,
        venue: 'polymarket',
        status: 'unavailable',
        readOnly: true,
        fetchedAt,
        source: gammaBase,
        reason: `Polymarket Gamma returned HTTP ${res.status}`,
        requires: [],
        warnings: [],
        data: { market: null, resolved: false, winningOutcome: null, clobBook: null },
      };
      return NextResponse.json(payload, { status: 200 });
    }

    const raw = await res.json();
    const closed = Boolean(raw.closed);
    const active = Boolean(raw.active);

    // Determine resolution
    let resolved = false;
    let winningOutcome: string | null = null;

    if (closed) {
      // Check for resolution fields
      if (typeof raw.winningOutcome === 'string' && raw.winningOutcome.length > 0) {
        resolved = true;
        winningOutcome = raw.winningOutcome;
      } else if (raw.resolvedOutcome) {
        resolved = true;
        winningOutcome = String(raw.resolvedOutcome);
      } else if (Array.isArray(raw.outcomePrices)) {
        // In Polymarket Gamma, settled markets often have winning outcome at price 1 and losing at 0
        const outcomes: string[] = Array.isArray(raw.outcomes) ? raw.outcomes : [];
        const prices: number[] = raw.outcomePrices.map((p: any) => Number(p));
        const winIdx = prices.findIndex((p) => p >= 0.99);
        if (winIdx >= 0 && outcomes[winIdx]) {
          resolved = true;
          winningOutcome = outcomes[winIdx];
        }
      }
    }

    const market: PolymarketMarket = {
      id: String(raw.id || raw.conditionId || id),
      question: raw.question || raw.title,
      slug: raw.slug,
      category: raw.category,
      startDate: raw.startDate || raw.start_date,
      endDate: raw.endDate || raw.end_date,
      durationSeconds: Number(raw.durationSeconds) || undefined,
      active,
      closed,
      outcomes: Array.isArray(raw.outcomes)
        ? raw.outcomes.map((label: string, idx: number) => ({
            outcome: label,
            price: Array.isArray(raw.outcomePrices) ? Number(raw.outcomePrices[idx]) || null : null,
          }))
        : [],
      bestBid: typeof raw.bestBid === 'number' ? raw.bestBid : null,
      bestAsk: typeof raw.bestAsk === 'number' ? raw.bestAsk : null,
      spread: typeof raw.spread === 'number' ? raw.spread : null,
      volume24h: typeof raw.volume24hr === 'number' ? raw.volume24hr : undefined,
      url: raw.slug ? `https://polymarket.com/event/${raw.slug}` : null,
    };

    const payload: MarketFeedEnvelope<PolymarketDetailFeedData> = {
      ok: true,
      venue: 'polymarket',
      status: 'live',
      readOnly: true,
      fetchedAt,
      source: 'polymarket-gamma',
      reason: null,
      requires: [],
      warnings: [],
      data: {
        market,
        resolved,
        winningOutcome,
        clobBook: null,
      },
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (err: any) {
    const payload: MarketFeedEnvelope<PolymarketDetailFeedData> = {
      ok: false,
      venue: 'polymarket',
      status: 'unavailable',
      readOnly: true,
      fetchedAt,
      source: null,
      reason: `Failed to fetch market details: ${err?.message || 'network timeout'}`,
      requires: [],
      warnings: [],
      data: { market: null, resolved: false, winningOutcome: null, clobBook: null },
    };
    return NextResponse.json(payload, { status: 200 });
  }
}
