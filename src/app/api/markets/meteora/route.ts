import { NextResponse } from 'next/server';
import { rankMeteoraPools } from '@/lib/engine/paperTrading';
import type { MarketFeedEnvelope, MeteoraFeedData, MeteoraPool } from '@/lib/data/markets';

export const dynamic = 'force-dynamic';

/**
 * GET /api/markets/meteora
 *
 * Feed read-only untuk bot Meteora LP (Solana DLMM). Route ini hanya MEMBACA
 * pool dari Meteora public API lalu meranking fee/TVL dengan `rankMeteoraPools`
 * dari ledger engine. Tidak ada order, tidak ada transaksi on-chain.
 *
 * Anti-fabrikasi:
 *   - Hanya angka yang benar-benar ada di payload feed yang diteruskan.
 *   - Field yang hilang dibiarkan `undefined` → UI menampilkan "—".
 *   - Pool tanpa TVL/fee valid TIDAK diranking (tidak diberi ratio 0 palsu);
 *     ia dikembalikan apa adanya di ekor daftar dengan `feeTvlRatio: null`.
 *
 * Query: `?limit=10&minTvl=0`
 * Env  : `METEORA_API_BASE` (opsional), `METEORA_API_KEY` (opsional)
 */

const DEFAULT_API_BASE = 'https://dlmm-api.meteora.ag';
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

type RawPool = Record<string, unknown>;

function readNumber(raw: RawPool, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric === 'number' && Number.isFinite(numeric)) return numeric;
  }
  return undefined;
}

function readString(raw: RawPool, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return undefined;
}

/** Petakan payload mentah Meteora → baris UI; hanya angka nyata yang diteruskan. */
function mapPool(raw: RawPool): MeteoraPool | null {
  const address = readString(raw, ['address', 'pool_address', 'pubkey']);
  const name = readString(raw, ['name', 'pair_name', 'symbol']);
  if (!address || !name) return null;

  const tvl = readNumber(raw, ['liquidity', 'tvl', 'reserve_usd']);
  const fees24h = readNumber(raw, ['fees_24h', 'fee24h', 'fees24h']);
  const volume24h = readNumber(raw, ['trade_volume_24h', 'volume24h', 'volume_24h']);
  const binStep = readNumber(raw, ['bin_step']);
  const baseFeePct = readNumber(raw, ['base_fee_percentage', 'base_fee_pct']);
  const aprPct = readNumber(raw, ['apr', 'apy']);
  const priceUsd = readNumber(raw, ['current_price', 'price']);

  return {
    address,
    name,
    ...(tvl === undefined ? {} : { tvl }),
    ...(fees24h === undefined ? {} : { fees24h }),
    ...(volume24h === undefined ? {} : { volume24h }),
    binStep: binStep ?? null,
    baseFeePct: baseFeePct ?? null,
    aprPct: aprPct ?? null,
    priceUsd: priceUsd ?? null,
    feeTvlRatio: null,
  };
}

function unavailable(message: string, requires: string[] = []): NextResponse {
  const payload: MarketFeedEnvelope<MeteoraFeedData> = {
    ok: false,
    venue: 'meteora',
    status: requires.length > 0 ? 'unconfigured' : 'unavailable',
    readOnly: true,
    fetchedAt: null,
    source: null,
    reason: message,
    requires,
    warnings: [],
    data: { pools: [], poolCount: 0, rankedCount: 0, minTvl: 0 },
  };
  return NextResponse.json(payload, { status: 200 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiBase = process.env.METEORA_API_BASE || DEFAULT_API_BASE;
  const apiKey = process.env.METEORA_API_KEY;
  const limitParam = Number(searchParams.get('limit'));
  const minTvlParam = Number(searchParams.get('minTvl'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), MAX_LIMIT) : DEFAULT_LIMIT;
  const minTvl = Number.isFinite(minTvlParam) && minTvlParam >= 0 ? minTvlParam : 0;

  try {
    const res = await fetch(`${apiBase}/pair/all`, {
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return unavailable(`Meteora API merespons HTTP ${res.status} — tidak ada pool yang bisa ditampilkan.`);
    }

    const raw = await res.json();
    const rawPools: RawPool[] = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    const mapped = rawPools.map(mapPool).filter((pool): pool is MeteoraPool => pool !== null);

    // Pisahkan pool yang benar-benar punya TVL & fee nyata (boleh masuk ranking)
    // dari pool yang datanya tidak lengkap (tetap ditampilkan, ratio "—").
    const rankable = mapped.filter((pool) => (pool.tvl ?? 0) > 0 && (pool.fees24h ?? -1) >= 0);
    const unrankable = mapped.filter((pool) => !rankable.includes(pool));

    const ranked = rankMeteoraPools(rankable, { minTvl, limit: mapped.length });
    const unrankedSorted = [...unrankable].sort((a, b) => (b.volume24h ?? b.tvl ?? 0) - (a.volume24h ?? a.tvl ?? 0));
    const pools = [...ranked, ...unrankedSorted].slice(0, limit);

    const warnings: string[] = [];
    if (unrankable.length > 0) {
      warnings.push(
        `${unrankable.length} pool tanpa TVL/fee 24 jam yang valid — ratio fee/TVL sengaja dibiarkan "—" dan tidak diranking.`,
      );
    }

    const payload: MarketFeedEnvelope<MeteoraFeedData> = {
      ok: true,
      venue: 'meteora',
      status: 'live',
      readOnly: true,
      fetchedAt: new Date().toISOString(),
      source: `${apiBase}/pair/all`,
      reason: null,
      requires: [],
      warnings,
      data: {
        pools,
        poolCount: mapped.length,
        rankedCount: ranked.length,
        minTvl,
      },
    };
    return NextResponse.json(payload, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'kesalahan tidak diketahui';
    return unavailable(
      `Tidak dapat menghubungi Meteora API (${message}). Pool tidak ditampilkan, harga tidak dikira-kira.`,
    );
  }
}
