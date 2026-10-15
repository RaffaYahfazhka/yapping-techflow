'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import type { PolymarketMarket } from '@/lib/data/markets';
import type { BotSignal, BotStrategy } from '@/lib/engine/predictionBot';
import {
  evaluateBtcScalper,
  evaluateArbitrage,
  evaluateMomentum,
  executeBotOrder,
  settleBotPosition,
} from '@/lib/engine/predictionBot';
import { loadPaperLedger, savePaperLedger } from '@/lib/storage/paperLedger';
import type { PaperLedgerV2 } from '@/lib/engine/paperLedgerV2';

export interface BotRuntimeTelemetry {
  running: boolean;
  lastTickAt: number | null;
  btcPrice: number | null;
  btcChange24h: number | null;
  activeStrategy: BotStrategy | null;
  lastSignal: BotSignal | null;
  totalExecutions: number;
  totalSettlements: number;
}

interface PredictionBotContextType {
  telemetry: BotRuntimeTelemetry;
  setRunning: (running: boolean) => void;
  toggleRunning: () => void;
}

const PredictionBotContext = createContext<PredictionBotContextType | null>(null);

const POLL_INTERVAL_MS = 10_000; // 10s poll cycle
const KENZO_ACCOUNT = 'kenzo-usdc';

export function PredictionBotProvider({ children }: { children: React.ReactNode }) {
  const [running, setRunningState] = useState(true);
  const [telemetry, setTelemetry] = useState<BotRuntimeTelemetry>({
    running: true,
    lastTickAt: null,
    btcPrice: null,
    btcChange24h: null,
    activeStrategy: null,
    lastSignal: null,
    totalExecutions: 0,
    totalSettlements: 0,
  });

  const runningRef = useRef(running);
  runningRef.current = running;

  const setRunning = useCallback((next: boolean) => {
    setRunningState(next);
    setTelemetry((prev) => ({ ...prev, running: next }));
  }, []);

  const toggleRunning = useCallback(() => {
    setRunningState((prev) => {
      const next = !prev;
      setTelemetry((t) => ({ ...t, running: next }));
      return next;
    });
  }, []);

  // Set up poller singleton
  useEffect(() => {
    let active = true;
    let timer: NodeJS.Timeout | null = null;
    let inFlight = false;

    // Track recently executed markets to avoid duplicate executions
    const executedMarketTicks = new Set<string>();

    const tick = async () => {
      if (!active || !runningRef.current || inFlight) return;
      inFlight = true;

      try {
        const nowMs = Date.now();

        // 1. Fetch BTC Spot
        let btcPrice: number | null = null;
        let btcChange: number | null = null;
        try {
          const btcRes = await fetch('/api/markets/bitcoin');
          if (btcRes.ok) {
            const btcEnv = await btcRes.json();
            if (btcEnv?.ok && btcEnv.data?.priceUsd) {
              btcPrice = btcEnv.data.priceUsd;
              btcChange = btcEnv.data.change24h ?? null;
            }
          }
        } catch {
          // BTC feed error
        }

        // 2. Fetch Polymarket 5m crypto markets
        let markets: PolymarketMarket[] = [];
        try {
          const polyRes = await fetch('/api/markets/polymarket?token=btc&limit=50');
          if (polyRes.ok) {
            const polyEnv = await polyRes.json();
            if (polyEnv?.ok && Array.isArray(polyEnv.data?.markets)) {
              markets = polyEnv.data.markets;
            }
          }
        } catch {
          // Polymarket feed error
        }

        // 3. Load authoritative ledger v2
        const loadOutcome = await loadPaperLedger();
        if (loadOutcome.status !== 'ready') {
          inFlight = false;
          return;
        }

        let currentLedger: PaperLedgerV2 = loadOutcome.ledger;
        const kenzoAcc = currentLedger.accounts[KENZO_ACCOUNT];
        const availableUsdc = (kenzoAcc?.available ?? 0) / 1_000_000; // in dollars

        // 4. Check settlements for open positions
        let settledCount = 0;
        const openPositions = (currentLedger.positions || []).filter(
          (p) => p.accountId === KENZO_ACCOUNT && p.status === 'OPEN'
        );

        for (const pos of openPositions) {
          if (!pos.label?.includes('[Bot:')) continue;
          // Check if market has closed
          try {
            // Find corresponding market in current feed or detail route
            const targetMarket = markets.find((m) => m.id === pos.id || pos.label.includes(m.id));
            if (targetMarket?.closed) {
              // Fetch detailed resolution
              const detailRes = await fetch(`/api/markets/polymarket/${targetMarket.id}`);
              if (detailRes.ok) {
                const detailEnv = await detailRes.json();
                if (detailEnv?.ok && detailEnv.data?.resolved && detailEnv.data.winningOutcome) {
                  const sRes = settleBotPosition(
                    currentLedger,
                    pos,
                    true,
                    detailEnv.data.winningOutcome,
                    nowMs
                  );
                  if (sRes.ok) {
                    currentLedger = sRes.ledger;
                    settledCount += 1;
                  }
                }
              }
            }
          } catch {
            // Settlement probe failed
          }
        }

        // 5. Evaluate strategies for candidate markets
        let triggeredSignal: BotSignal | null = null;
        let executedOrder = false;

        if (availableUsdc >= 5 && markets.length > 0) {
          for (const m of markets) {
            if (executedMarketTicks.has(m.id)) continue;

            // Strategy priority: BTC scalper -> arbitrage -> momentum
            let signal: BotSignal | null = null;

            if (btcPrice !== null) {
              signal = evaluateBtcScalper(m, btcPrice, btcChange, availableUsdc, nowMs);
            }
            if (!signal) {
              signal = evaluateArbitrage(m, availableUsdc, nowMs);
            }
            if (!signal) {
              signal = evaluateMomentum(m, availableUsdc, nowMs);
            }

            if (signal && signal.stakeUsdc >= 1) {
              const orderId = `poly-bot-${m.id}-${nowMs}`;
              const execRes = executeBotOrder(currentLedger, signal, orderId, nowMs);
              if (execRes.ok) {
                currentLedger = execRes.ledger;
                triggeredSignal = signal;
                executedOrder = true;
                executedMarketTicks.add(m.id);
                // Limit to 1 order per tick cycle to avoid burst allocations
                break;
              }
            }
          }
        }

        // 6. Save modified ledger if orders or settlements occurred
        if (executedOrder || settledCount > 0) {
          await savePaperLedger(currentLedger);
        }

        // 7. Update telemetry
        if (active) {
          setTelemetry((prev) => ({
            ...prev,
            lastTickAt: nowMs,
            btcPrice,
            btcChange24h: btcChange,
            activeStrategy: triggeredSignal ? triggeredSignal.strategy : prev.activeStrategy,
            lastSignal: triggeredSignal || prev.lastSignal,
            totalExecutions: prev.totalExecutions + (executedOrder ? 1 : 0),
            totalSettlements: prev.totalSettlements + settledCount,
          }));
        }
      } catch {
        // Safe cycle error swallow
      } finally {
        inFlight = false;
      }
    };

    // Run first tick after 2s
    const initTimer = setTimeout(() => {
      void tick();
      timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
    }, 2000);

    return () => {
      active = false;
      clearTimeout(initTimer);
      clearInterval(timer);
    };
  }, []);

  const value = { telemetry, setRunning, toggleRunning };

  return (
    <PredictionBotContext.Provider value={value}>
      {children}
    </PredictionBotContext.Provider>
  );
}

export function usePredictionBot(): PredictionBotContextType {
  const ctx = useContext(PredictionBotContext);
  if (!ctx) {
    // Provide safe no-op fallback when used outside provider
    return {
      telemetry: {
        running: false,
        lastTickAt: null,
        btcPrice: null,
        btcChange24h: null,
        activeStrategy: null,
        lastSignal: null,
        totalExecutions: 0,
        totalSettlements: 0,
      },
      setRunning: () => {},
      toggleRunning: () => {},
    };
  }
  return ctx;
}
