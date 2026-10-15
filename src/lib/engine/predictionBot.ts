import type { PolymarketMarket } from '@/lib/data/markets';
import type { PaperLedgerV2 } from './paperLedgerV2';
import { placePolymarketOrderV2, settlePolymarketOrderV2, type PolySide } from './paperPolymarketV2';
import type { V2Position } from './paperLedgerOrders';

export type BotStrategy = 'btc_scalper' | 'arbitrage' | 'momentum';

export interface BotSignal {
  id: string;
  marketId: string;
  strategy: BotStrategy;
  side: PolySide;
  price: number; // executable ask price
  confidence: number; // 0..1 estimated win probability
  stakeUsdc: number; // Kelly-sized stake in whole USD/cents
  reason: string;
  timestamp: number;
}

export interface PredictionBotConfig {
  maxStakeUsdc: number;
  minStakeUsdc: number;
  maxPortfolioRiskFraction: number;
  kellyFraction: number;
  slippageTolerance: number;
  maxStaleQuoteAgeMs: number;
}

export const DEFAULT_BOT_CONFIG: PredictionBotConfig = {
  maxStakeUsdc: 50,
  minStakeUsdc: 1,
  maxPortfolioRiskFraction: 0.05, // 5% max per position
  kellyFraction: 0.25, // Quarter-Kelly for conservative capital preservation
  slippageTolerance: 0.01, // 1%
  maxStaleQuoteAgeMs: 60_000, // 60 seconds
};

/**
 * Kelly Criterion Position Sizing
 * Formula: f* = (p * b - q) / b
 * where:
 *   p = estimated probability of winning (confidence)
 *   q = 1 - p
 *   b = net payout odds = (1 - price) / price
 */
export function calculateKellyStake(
  availableUsdc: number,
  confidence: number,
  price: number,
  config: PredictionBotConfig = DEFAULT_BOT_CONFIG
): { stakeUsdc: number; fStar: number; rawFraction: number } {
  if (availableUsdc <= 0 || confidence <= 0 || confidence >= 1 || price <= 0 || price >= 1) {
    return { stakeUsdc: 0, fStar: 0, rawFraction: 0 };
  }

  const b = (1 - price) / price;
  if (b <= 0) return { stakeUsdc: 0, fStar: 0, rawFraction: 0 };

  const q = 1 - confidence;
  const fStar = (confidence * b - q) / b;

  if (fStar <= 0) {
    return { stakeUsdc: 0, fStar, rawFraction: 0 };
  }

  // Fractional Kelly (e.g. 0.25 * f*)
  const fraction = fStar * config.kellyFraction;
  const cappedFraction = Math.min(fraction, config.maxPortfolioRiskFraction);

  let stake = availableUsdc * cappedFraction;
  // Bound to min and max stake
  if (stake < config.minStakeUsdc) {
    return { stakeUsdc: 0, fStar, rawFraction: fraction };
  }
  stake = Math.min(stake, config.maxStakeUsdc);

  // Round to 2 decimal places (cents)
  const roundedStake = Math.round(stake * 100) / 100;
  return { stakeUsdc: roundedStake, fStar, rawFraction: fraction };
}

/** Check if market quote is fresh and usable */
export function isQuoteUsable(
  market: PolymarketMarket,
  nowMs: number,
  _maxAgeMs = DEFAULT_BOT_CONFIG.maxStaleQuoteAgeMs
): { usable: boolean; reason?: string } {
  if (!market || !market.id) {
    return { usable: false, reason: 'missing-market-id' };
  }
  if (market.closed) {
    return { usable: false, reason: 'market-closed' };
  }
  if (market.active === false) {
    return { usable: false, reason: 'market-inactive' };
  }

  // Check bestAsk and bestBid
  const ask = market.bestAsk;
  if (typeof ask !== 'number' || !Number.isFinite(ask) || ask <= 0.01 || ask >= 0.99) {
    return { usable: false, reason: 'invalid-ask-price' };
  }

  // Check timestamps if available
  if (market.endDate) {
    const endMs = Date.parse(market.endDate);
    if (Number.isFinite(endMs) && endMs < nowMs) {
      return { usable: false, reason: 'market-expired' };
    }
  }

  return { usable: true };
}

/** Strategy 1: BTC Scalper */
export function evaluateBtcScalper(
  market: PolymarketMarket,
  btcPriceUsd: number,
  btcChange24h: number | null,
  availableUsdc: number,
  nowMs: number,
  config: PredictionBotConfig = DEFAULT_BOT_CONFIG
): BotSignal | null {
  const check = isQuoteUsable(market, nowMs, config.maxStaleQuoteAgeMs);
  if (!check.usable || !market.bestAsk) return null;

  // We look for BTC 5-minute Up/Down markets
  const qLower = (market.question || '').toLowerCase();
  const slugLower = (market.slug || '').toLowerCase();
  const isBtcMarket = qLower.includes('btc') || qLower.includes('bitcoin') || slugLower.includes('btc');
  if (!isBtcMarket) return null;

  // Derive side from question / outcomes
  const isUpTarget = qLower.includes('up') || qLower.includes('above') || qLower.includes('higher');
  const isDownTarget = qLower.includes('down') || qLower.includes('below') || qLower.includes('lower');
  if (!isUpTarget && !isDownTarget) return null;

  const side: PolySide = isUpTarget ? 'up' : 'down';
  const ask = market.bestAsk;

  // Estimated edge from spot momentum
  const momentum = (btcChange24h ?? 0) / 100;
  // If BTC trending up and market side is up, model confidence is higher than implied ask
  let confidence: number;
  if (side === 'up') {
    confidence = Math.min(0.85, Math.max(0.15, 0.50 + momentum * 0.5));
  } else {
    confidence = Math.min(0.85, Math.max(0.15, 0.50 - momentum * 0.5));
  }

  // Edge must exceed 2% over ask price to justify entry
  const edge = confidence - ask;
  if (edge <= 0.02) return null;

  const { stakeUsdc } = calculateKellyStake(availableUsdc, confidence, ask, config);
  if (stakeUsdc <= 0) return null;

  return {
    id: `sig-scalp-${market.id}-${nowMs}`,
    marketId: market.id,
    strategy: 'btc_scalper',
    side,
    price: ask,
    confidence,
    stakeUsdc,
    reason: `BTC Spot $${Math.round(btcPriceUsd)} ${momentum >= 0 ? '+' : ''}${(momentum * 100).toFixed(2)}% gives ${(confidence * 100).toFixed(1)}% vs ask ${(ask * 100).toFixed(1)}% (edge +${(edge * 100).toFixed(1)}%)`,
    timestamp: nowMs,
  };
}

/** Strategy 2: Statistical Arbitrage / Implied Mispricing */
export function evaluateArbitrage(
  market: PolymarketMarket,
  availableUsdc: number,
  nowMs: number,
  config: PredictionBotConfig = DEFAULT_BOT_CONFIG
): BotSignal | null {
  const check = isQuoteUsable(market, nowMs, config.maxStaleQuoteAgeMs);
  if (!check.usable) return null;

  // Check outcome prices sum
  if (market.outcomes && market.outcomes.length === 2) {
    const [o1, o2] = market.outcomes;
    const p1 = o1?.price;
    const p2 = o2?.price;
    if (typeof p1 === 'number' && typeof p2 === 'number' && p1 > 0 && p2 > 0) {
      const sum = p1 + p2;
      // If sum deviates noticeably from 1.0 (e.g. sum < 0.96)
      if (sum < 0.96) {
        // Underpriced basket — buy the cheaper side with higher implied return
        const side: PolySide = p1 <= p2 ? 'up' : 'down';
        const price = side === 'up' ? p1 : p2;
        const confidence = 1 - price; // conservative expectation
        if (confidence > price + 0.03) {
          const { stakeUsdc } = calculateKellyStake(availableUsdc, confidence, price, config);
          if (stakeUsdc > 0) {
            return {
              id: `sig-arb-${market.id}-${nowMs}`,
              marketId: market.id,
              strategy: 'arbitrage',
              side,
              price,
              confidence,
              stakeUsdc,
              reason: `Basket sum ${sum.toFixed(3)} < 0.96 mispricing arbitrage`,
              timestamp: nowMs,
            };
          }
        }
      }
    }
  }

  return null;
}

/** Strategy 3: Volume Momentum */
export function evaluateMomentum(
  market: PolymarketMarket,
  availableUsdc: number,
  nowMs: number,
  config: PredictionBotConfig = DEFAULT_BOT_CONFIG
): BotSignal | null {
  const check = isQuoteUsable(market, nowMs, config.maxStaleQuoteAgeMs);
  if (!check.usable || !market.bestAsk) return null;

  // Tight spread (< 0.04) and high 24h volume (> 1000)
  const spread = market.spread ?? (market.bestBid ? market.bestAsk - market.bestBid : 0.05);
  const vol = market.volume24h ?? market.volume ?? 0;
  if (spread <= 0.04 && vol >= 1000) {
    // If ask is between 0.40 and 0.65 with clear spread compression
    const ask = market.bestAsk;
    const side: PolySide = ask >= 0.5 ? 'up' : 'down';
    const confidence = side === 'up' ? ask + 0.05 : (1 - ask) + 0.05;

    if (confidence > ask + 0.03) {
      const { stakeUsdc } = calculateKellyStake(availableUsdc, confidence, ask, config);
      if (stakeUsdc > 0) {
        return {
          id: `sig-mom-${market.id}-${nowMs}`,
          marketId: market.id,
          strategy: 'momentum',
          side,
          price: ask,
          confidence,
          stakeUsdc,
          reason: `High volume (${Math.round(vol)}) tight spread (${(spread * 100).toFixed(1)}c) momentum`,
          timestamp: nowMs,
        };
      }
    }
  }

  return null;
}

/** Execute a paper signal on the Ledger v2 */
export function executeBotOrder(
  ledger: PaperLedgerV2,
  signal: BotSignal,
  orderId: string,
  nowMs: number
): { ok: true; ledger: PaperLedgerV2; position: V2Position } | { ok: false; reason: string } {
  // Validate order price
  if (!(signal.price > 0 && signal.price < 1)) {
    return { ok: false, reason: 'invalid-price' };
  }

  return placePolymarketOrderV2(ledger, {
    id: orderId,
    side: signal.side,
    stakeUsdc: signal.stakeUsdc,
    price: signal.price,
    now: nowMs,
    label: `[Bot: ${signal.strategy}] ${signal.reason}`,
  });
}

/** Settle an open position based on official Polymarket market resolution */
export function settleBotPosition(
  ledger: PaperLedgerV2,
  position: V2Position,
  marketClosed: boolean,
  resolvedOutcome: string | null,
  nowMs: number
): { ok: true; ledger: PaperLedgerV2; position: V2Position } | { ok: false; reason: string } {
  if (!marketClosed) {
    return { ok: false, reason: 'market-not-closed' };
  }
  if (!resolvedOutcome || typeof resolvedOutcome !== 'string' || resolvedOutcome.trim().length === 0) {
    return { ok: false, reason: 'unresolved-outcome' };
  }

  const outNorm = resolvedOutcome.trim().toLowerCase();
  let winningSide: PolySide | null = null;
  if (outNorm === 'up' || outNorm === 'yes' || outNorm === 'higher' || outNorm === 'above') {
    winningSide = 'up';
  } else if (outNorm === 'down' || outNorm === 'no' || outNorm === 'lower' || outNorm === 'below') {
    winningSide = 'down';
  }

  if (!winningSide) {
    // Ambiguous outcome label — reject settlement rather than guessing!
    return { ok: false, reason: 'ambiguous-outcome-label' };
  }

  const posSide = (position.side || 'up').toLowerCase() as PolySide;
  const entryPrice = position.price || 0.5;

  return settlePolymarketOrderV2(
    ledger,
    position,
    entryPrice,
    winningSide,
    posSide,
    nowMs
  );
}
