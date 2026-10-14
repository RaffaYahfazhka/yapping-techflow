import { NextResponse } from 'next/server';
import { filterAndRankMeteoraPools, MeteoraPool } from '@/lib/engine/paperTrading';

let cachedPools: MeteoraPool[] = [];
let lastFetchTime = 0;
const MIN_REFRESH_INTERVAL_MS = 5000; // API documents 30 requests/second limit, refresh no faster than 5s

export async function GET(request: Request) {
  const url = new URL(request.url);
  const poolAddress = url.searchParams.get('address');
  const now = Date.now();

  try {
    if (poolAddress) {
      // Fetch OHLCV 5m candles for the selected pool
      const candleRes = await fetch(
        `https://dlmm.datapi.meteora.ag/pools/${poolAddress}/ohlcv?timeframe=5m`,
        {
          headers: { Accept: 'application/json' },
          next: { revalidate: 5 },
        }
      );
      if (!candleRes.ok) {
        return NextResponse.json(
          { status: 'stale', address: poolAddress, candles: [], error: `Meteora API responded with ${candleRes.status}` },
          { status: 200 }
        );
      }
      const candleData = await candleRes.json();
      return NextResponse.json({
        status: 'live',
        address: poolAddress,
        candles: Array.isArray(candleData) ? candleData : candleData?.data || [],
        timestamp: now,
      });
    }

    // Serve cached pools if within 5-second window
    if (cachedPools.length > 0 && now - lastFetchTime < MIN_REFRESH_INTERVAL_MS) {
      return NextResponse.json({
        status: 'live',
        pools: cachedPools,
        timestamp: lastFetchTime,
        cached: true,
      });
    }

    const res = await fetch(
      'https://dlmm.datapi.meteora.ag/pools?filter_by=is_blacklisted=false&sort_by=fee_tvl_ratio_24h:desc',
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 5 },
      }
    );

    if (!res.ok) {
      return NextResponse.json({
        status: 'stale',
        pools: cachedPools,
        error: `Meteora API error: HTTP ${res.status}`,
        timestamp: now,
      });
    }

    const data = await res.json();
    const rawPools: MeteoraPool[] = Array.isArray(data) ? data : data?.data || [];
    const eligiblePools = filterAndRankMeteoraPools(rawPools);

    cachedPools = eligiblePools;
    lastFetchTime = now;

    return NextResponse.json({
      status: 'live',
      pools: eligiblePools,
      timestamp: now,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      status: 'stale',
      pools: cachedPools,
      error: `Network error fetching Meteora feed: ${message}`,
      timestamp: now,
    });
  }
}
