'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { css } from '@emotion/css';
import Modal from '@/components/ui/Modal';
import { AGENTS } from '@/lib/data/agents';
import {
  loadPaperState,
  savePaperState,
  resetPaperState,
  submitPolymarketTrade,
  PaperState,
  MeteoraPool,
  PolymarketMarket,
} from '@/lib/engine/paperTrading';

interface TradingBotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBotId?: string;
  onFocusAgentInScene?: (id: string) => void;
}

const styles = {
  tabNav: css`
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    background: rgba(18, 20, 29, 0.7);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    overflow-x: auto;
  `,
  tabBtn: (isActive: boolean, color: string) => css`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 10px;
    border: 1px solid ${isActive ? color : 'rgba(255, 255, 255, 0.08)'};
    background: ${isActive ? `${color}18` : 'rgba(255, 255, 255, 0.03)'};
    color: ${isActive ? '#ffffff' : '#a1a1aa'};
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;

    &:hover {
      background: ${isActive ? `${color}25` : 'rgba(255, 255, 255, 0.06)'};
      color: #ffffff;
    }
  `,
  botDot: (color: string) => css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${color};
    box-shadow: 0 0 8px ${color};
  `,
  container: css`
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    max-height: calc(85vh - 120px);
    overflow-y: auto;
  `,
  headerCard: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    padding: 16px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 14px;
  `,
  metricItem: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,
  metricLabel: css`
    font-size: 11px;
    font-family: ui-monospace, monospace;
    color: #71717a;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `,
  metricValue: (color = '#ffffff') => css`
    font-size: 20px;
    font-weight: 800;
    font-family: ui-monospace, monospace;
    color: ${color};
  `,
  statusBadge: (status: 'live' | 'stale' | 'unavailable' | 'connecting') => css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    font-weight: 700;
    font-family: ui-monospace, monospace;
    padding: 3px 8px;
    border-radius: 6px;
    width: fit-content;
    background: ${status === 'live'
      ? 'rgba(16, 185, 129, 0.15)'
      : status === 'stale'
      ? 'rgba(245, 158, 11, 0.15)'
      : status === 'connecting'
      ? 'rgba(56, 189, 248, 0.15)'
      : 'rgba(239, 68, 68, 0.15)'};
    color: ${status === 'live'
      ? '#34d399'
      : status === 'stale'
      ? '#fbbf24'
      : status === 'connecting'
      ? '#38bdf8'
      : '#f87171'};
    border: 1px solid
      ${status === 'live'
        ? 'rgba(16, 185, 129, 0.3)'
        : status === 'stale'
        ? 'rgba(245, 158, 11, 0.3)'
        : status === 'connecting'
        ? 'rgba(56, 189, 248, 0.3)'
        : 'rgba(239, 68, 68, 0.3)'};
  `,
  chartBox: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px;
    background: rgba(10, 11, 16, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
  `,
  chartHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    font-weight: 600;
    color: #a1a1aa;
  `,
  svgWrap: css`
    width: 100%;
    height: 180px;
    position: relative;
  `,
  tableBox: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 14px;
    overflow-x: auto;
  `,
  tableHeader: css`
    font-size: 13px;
    font-weight: 700;
    color: #e4e4e7;
    margin-bottom: 4px;
  `,
  nativeTable: css`
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;

    th {
      padding: 8px 10px;
      font-size: 11px;
      font-family: ui-monospace, monospace;
      color: #71717a;
      text-transform: uppercase;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    td {
      padding: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      color: #d4d4d8;
    }
  `,
  inputRow: css`
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    padding: 14px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  `,
  stakeInput: css`
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    color: #ffffff;
    font-family: ui-monospace, monospace;
    width: 110px;

    &:focus {
      outline: none;
      border-color: #8b5cf6;
    }
  `,
  actionBtn: (bgColor: string) => css`
    background: ${bgColor};
    color: #ffffff;
    font-size: 12px;
    font-weight: 700;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: opacity 0.15s ease;

    &:hover {
      opacity: 0.9;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `,
  alertBanner: (isError = false) => css`
    padding: 12px 16px;
    border-radius: 10px;
    font-size: 12px;
    line-height: 1.5;
    background: ${isError ? 'rgba(239, 68, 68, 0.12)' : 'rgba(56, 189, 248, 0.12)'};
    border: 1px solid ${isError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(56, 189, 248, 0.3)'};
    color: ${isError ? '#fca5a5' : '#bae6fd'};
  `,
};

function NativePriceChart({
  points,
  strokeColor,
  label,
}: {
  points: number[];
  strokeColor: string;
  label: string;
}) {
  if (points.length < 2) {
    return (
      <div className={styles.chartBox}>
        <div className={styles.chartHeader}>
          <span>{label}</span>
          <span>Waiting for candle/tick series...</span>
        </div>
        <div
          style={{
            height: '140px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#71717a',
            fontSize: '12px',
          }}
        >
          No price points recorded yet
        </div>
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 600;
  const height = 140;
  const pad = 12;

  const coords = points.map((val, idx) => {
    const x = pad + (idx / (points.length - 1)) * (width - pad * 2);
    const y = height - pad - ((val - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const pathD = `M ${coords.join(' L ')}`;
  const currentVal = points[points.length - 1];

  return (
    <div className={styles.chartBox}>
      <div className={styles.chartHeader}>
        <span>{label}</span>
        <span style={{ fontFamily: 'ui-monospace, monospace', color: strokeColor }}>
          Current: {currentVal.toFixed(4)} (Min: {min.toFixed(4)} · Max: {max.toFixed(4)})
        </span>
      </div>
      <div className={styles.svgWrap}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: '100%', overflow: 'visible' }}
        >
          {/* Subtle grid lines */}
          <line
            x1={pad}
            y1={pad}
            x2={width - pad}
            y2={pad}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeDasharray="4 4"
          />
          <line
            x1={pad}
            y1={height / 2}
            x2={width - pad}
            y2={height / 2}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeDasharray="4 4"
          />
          <line
            x1={pad}
            y1={height - pad}
            x2={width - pad}
            y2={height - pad}
            stroke="rgba(255, 255, 255, 0.05)"
            strokeDasharray="4 4"
          />

          {/* Area fill */}
          <path
            d={`${pathD} L ${width - pad},${height - pad} L ${pad},${height - pad} Z`}
            fill={`${strokeColor}15`}
          />

          {/* Price Line */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Last point pulse */}
          {coords.length > 0 && (
            <circle
              cx={coords[coords.length - 1].split(',')[0]}
              cy={coords[coords.length - 1].split(',')[1]}
              r="4"
              fill={strokeColor}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export default function TradingBotsModal({
  isOpen,
  onClose,
  initialBotId = 'meteora-lp',
  onFocusAgentInScene,
}: TradingBotsModalProps) {
  const tradingBots = useMemo(
    () => AGENTS.filter((a) => a.workspace === 'trading'),
    []
  );

  const [activeBotId, setActiveBotId] = useState(initialBotId);
  const [paperState, setPaperState] = useState<PaperState | null>(null);
  const [stateCorrupt, setStateCorrupt] = useState(false);

  // Meteora state
  const [meteoraPools, setMeteoraPools] = useState<MeteoraPool[]>([]);
  const [meteoraStatus, setMeteoraStatus] = useState<'live' | 'stale' | 'connecting'>('connecting');
  const [meteoraCandles, setMeteoraCandles] = useState<number[]>([]);

  // Polymarket state
  const [polymarkets, setPolymarkets] = useState<PolymarketMarket[]>([]);
  const [polyStatus, setPolyStatus] = useState<'live' | 'stale' | 'connecting'>('connecting');
  const [polyMessage, setPolyMessage] = useState('');
  const [polyStake, setPolyStake] = useState('2.00');
  const [polyStakeError, setPolyStakeError] = useState('');

  // Exness state
  const [exnessStatus, setExnessStatus] = useState<'live' | 'stale' | 'unavailable' | 'connecting'>('connecting');
  const [exnessMessage, setExnessMessage] = useState('');
  const [xauTicks, setXauTicks] = useState<number[]>([]);
  const [latestXau, setLatestXau] = useState<{ bid: number; ask: number } | null>(null);

  // Sync initial bot ID
  useEffect(() => {
    if (initialBotId && tradingBots.some((b) => b.id === initialBotId)) {
      setActiveBotId(initialBotId);
    }
  }, [initialBotId, tradingBots]);

  // Load paper state on mount
  useEffect(() => {
    if (!isOpen) return;
    const { state, isCorrupt } = loadPaperState();
    setPaperState(state);
    setStateCorrupt(isCorrupt);
  }, [isOpen]);

  // Fetch Meteora pools
  const fetchMeteora = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/meteora');
      const data = await res.json();
      if (data.pools) {
        setMeteoraPools(data.pools);
        setMeteoraStatus(data.status === 'live' ? 'live' : 'stale');
        if (data.pools[0]?.current_price) {
          const prices = data.pools.slice(0, 10).map((p: MeteoraPool) => Number(p.current_price || 0)).filter((p: number) => p > 0);
          if (prices.length > 1) setMeteoraCandles(prices);
        }
      }
    } catch {
      setMeteoraStatus('stale');
    }
  }, []);

  // Fetch Polymarket 5m crypto
  const fetchPolymarket = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/polymarket');
      const data = await res.json();
      setPolyStatus(data.status === 'live' ? 'live' : 'stale');
      setPolymarkets(data.markets || []);
      setPolyMessage(data.message || '');
    } catch {
      setPolyStatus('stale');
    }
  }, []);

  // Poll Exness status
  const fetchExness = useCallback(async () => {
    try {
      const res = await fetch('/api/trading/exness');
      const data = await res.json();
      if (!data.available) {
        setExnessStatus('unavailable');
        setExnessMessage(data.reason || 'Exness XAUUSD feed unavailable');
      } else {
        setExnessStatus(data.status || 'live');
        if (data.tick) {
          setLatestXau({ bid: data.tick.bid, ask: data.tick.ask });
          setXauTicks((prev) => [...prev.slice(-30), data.tick.bid]);
        }
      }
    } catch {
      setExnessStatus('unavailable');
      setExnessMessage('Exness XAUUSD feed unavailable');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchMeteora();
    fetchPolymarket();
    fetchExness();

    const interval = setInterval(() => {
      fetchMeteora();
      fetchPolymarket();
      fetchExness();
    }, 6000);

    return () => clearInterval(interval);
  }, [isOpen, fetchMeteora, fetchPolymarket, fetchExness]);

  const activeBot = useMemo(
    () => tradingBots.find((b) => b.id === activeBotId) || tradingBots[0],
    [activeBotId, tradingBots]
  );

  const currentBalance = paperState?.balances[activeBotId as 'meteora-lp' | 'prediction-market' | 'xauusd-ea'] ?? 0;
  const recentTrades = useMemo(
    () => (paperState?.trades || []).filter((t) => t.botId === activeBotId),
    [paperState, activeBotId]
  );

  const [resetNotPersisted, setResetNotPersisted] = useState(false);

  const handleResetStorage = () => {
    const { state: fresh, persisted } = resetPaperState();
    setPaperState(fresh);
    setStateCorrupt(false);
    setResetNotPersisted(!persisted);
  };

  const handlePolyOrder = (side: 'up' | 'down', market: PolymarketMarket) => {
    if (!paperState) return;
    setPolyStakeError('');
    const stakeNum = parseFloat(polyStake);
    if (isNaN(stakeNum) || stakeNum <= 0) {
      setPolyStakeError('Stake harus berupa angka positif.');
      return;
    }
    const token = market.tokens?.find((t) => t.outcome.toLowerCase() === side);
    const price = token ? token.price : 0.5;

    const res = submitPolymarketTrade(paperState, {
      marketId: market.id,
      question: market.question,
      side,
      stake: stakeNum,
      price,
    });

    if (!res.success) {
      setPolyStakeError(res.error || 'Gagal membuat paper order.');
      return;
    }

    setPaperState(res.newState);
    savePaperState(res.newState);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Trading Bots Workspace"
      subtitle="Paper-trading & real-time market feeds — virtual balances only, no live execution"
    >
      {/* 3 Fixed Bot Tabs */}
      <div className={styles.tabNav}>
        {tradingBots.map((bot) => {
          const isActive = bot.id === activeBotId;
          const color = bot.color || '#10b981';
          return (
            <button
              key={bot.id}
              type="button"
              className={styles.tabBtn(isActive, color)}
              onClick={() => {
                setActiveBotId(bot.id);
                onFocusAgentInScene?.(bot.id);
              }}
            >
              <span className={styles.botDot(color)} />
              <span>{bot.name}</span>
              <span style={{ fontSize: '11px', opacity: 0.6 }}>({bot.employeeId})</span>
            </button>
          );
        })}
      </div>

      <div className={styles.container}>
        {stateCorrupt && (
          <div className={styles.alertBanner(true)}>
            Data paper trading lokal rusak atau tidak kompatibel.{' '}
            <button
              type="button"
              className={styles.actionBtn('#ef4444')}
              style={{ marginLeft: 10, padding: '4px 10px' }}
              onClick={handleResetStorage}
            >
              Reset Saldo ke Default
            </button>
          </div>
        )}

        {resetNotPersisted && (
          <div className={styles.alertBanner(true)} role="alert">
            Saldo sudah di-reset untuk sesi ini, tetapi penyimpanan gagal. Setelah reload, portofolio lama
            bisa muncul kembali.
          </div>
        )}

        {/* Top Header Metric Card */}
        <div className={styles.headerCard}>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Virtual Balance (Paper)</span>
            <span className={styles.metricValue(activeBot.color)}>
              ${currentBalance.toFixed(2)}
            </span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Connection Feed</span>
            {activeBotId === 'meteora-lp' && (
              <span className={styles.statusBadge(meteoraStatus)}>
                {meteoraStatus.toUpperCase()} (Meteora DLMM)
              </span>
            )}
            {activeBotId === 'prediction-market' && (
              <span className={styles.statusBadge(polyStatus)}>
                {polyStatus.toUpperCase()} (Polymarket Gamma)
              </span>
            )}
            {activeBotId === 'xauusd-ea' && (
              <span className={styles.statusBadge(exnessStatus)}>
                {exnessStatus.toUpperCase()} (Exness Demo)
              </span>
            )}
          </div>

          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Execution Mode</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#e4e4e7' }}>
              Paper Only (Simulation)
            </span>
          </div>

          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Strategy Status</span>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#a1a1aa' }}>
              {activeBotId === 'prediction-market' ? 'Repo belum dipilih' : activeBot.duties.split(';')[0]}
            </span>
          </div>
        </div>

        {/* Specific Bot View */}
        {activeBotId === 'meteora-lp' && (
          <>
            <div className={styles.alertBanner(false)}>
              <strong>Meteora LP Worker (Read-Only):</strong> Memeringkat pool Solana dari rasio fee/TVL 24 jam. Saldo virtual $30 tetap tidak dialokasikan karena metrik API tidak memodelkan impermanent loss atau bin-range fee DLMM personal.
            </div>

            <NativePriceChart
              points={meteoraCandles}
              strokeColor="#14f195"
              label="Meteora Top Pool Price Index"
            />

            <div className={styles.tableBox}>
              <div className={styles.tableHeader}>Top Ranked DLMM Pools (Sorted by 24h Fee/TVL Ratio)</div>
              {meteoraPools.length === 0 ? (
                <div style={{ padding: 12, color: '#71717a', fontSize: 12 }}>
                  {meteoraStatus === 'stale' ? 'Meteora feed stale / offline' : 'Loading pools...'}
                </div>
              ) : (
                <table className={styles.nativeTable}>
                  <thead>
                    <tr>
                      <th>Pool Name</th>
                      <th>Fee/TVL 24h</th>
                      <th>24h Volume</th>
                      <th>Current Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meteoraPools.slice(0, 8).map((pool) => (
                      <tr key={pool.address}>
                        <td style={{ fontWeight: 600 }}>{pool.name || pool.address.slice(0, 8)}</td>
                        <td style={{ color: '#14f195', fontFamily: 'ui-monospace, monospace' }}>
                          {pool.fee_tvl_ratio_24h ? `${(pool.fee_tvl_ratio_24h * 100).toFixed(2)}%` : '—'}
                        </td>
                        <td style={{ fontFamily: 'ui-monospace, monospace' }}>
                          ${Number(pool.trade_volume_24h || 0).toLocaleString()}
                        </td>
                        <td style={{ fontFamily: 'ui-monospace, monospace' }}>
                          {pool.current_price ? `$${Number(pool.current_price).toFixed(4)}` : '—'}
                        </td>
                        <td>
                          <span style={{ color: '#34d399', fontSize: 11 }}>Eligible</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeBotId === 'prediction-market' && (
          <>
            <div className={styles.alertBanner(false)}>
              <strong>Polymarket 5m Crypto Worker:</strong> Memfilter pasar prediksi crypto Up/Down berdurasi 300 detik. Mendukung simulasi paper trade manual. Otomasi bot berstatus <em>Repo belum dipilih</em> hingga URL repositori GitHub diserahkan dan ditinjau.
            </div>

            {/* Stake Input Form */}
            <div className={styles.inputRow}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Paper Stake ($):</span>
              <input
                type="number"
                step="0.5"
                min="0.1"
                max={currentBalance}
                value={polyStake}
                onChange={(e) => setPolyStake(e.target.value)}
                className={styles.stakeInput}
              />
              <span style={{ fontSize: 11, color: '#71717a' }}>
                Tersedia: ${currentBalance.toFixed(2)}
              </span>
              {polyStakeError && (
                <span style={{ color: '#f87171', fontSize: 12, fontWeight: 600 }}>
                  {polyStakeError}
                </span>
              )}
            </div>

            {/* Active 5-minute markets */}
            <div className={styles.tableBox}>
              <div className={styles.tableHeader}>
                Active 5-Minute Crypto Up/Down Markets ({polymarkets.length})
              </div>
              {polymarkets.length === 0 ? (
                <div style={{ padding: 16, color: '#a1a1aa', fontSize: 13 }}>
                  {polyMessage || 'No active 5-minute crypto Up/Down market'}
                </div>
              ) : (
                <table className={styles.nativeTable}>
                  <thead>
                    <tr>
                      <th>Market Question</th>
                      <th>Up Price</th>
                      <th>Down Price</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {polymarkets.map((m) => {
                      const upToken = m.tokens?.find((t) => t.outcome.toLowerCase() === 'up');
                      const downToken = m.tokens?.find((t) => t.outcome.toLowerCase() === 'down');
                      return (
                        <tr key={m.id}>
                          <td style={{ fontWeight: 600, maxWidth: 300 }}>{m.question}</td>
                          <td style={{ color: '#34d399', fontFamily: 'ui-monospace, monospace' }}>
                            ${upToken ? upToken.price.toFixed(2) : '0.50'}
                          </td>
                          <td style={{ color: '#f87171', fontFamily: 'ui-monospace, monospace' }}>
                            ${downToken ? downToken.price.toFixed(2) : '0.50'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button
                                type="button"
                                className={styles.actionBtn('#10b981')}
                                onClick={() => handlePolyOrder('up', m)}
                              >
                                Paper UP
                              </button>
                              <button
                                type="button"
                                className={styles.actionBtn('#ef4444')}
                                onClick={() => handlePolyOrder('down', m)}
                              >
                                Paper DOWN
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {activeBotId === 'xauusd-ea' && (
          <>
            {exnessStatus === 'unavailable' ? (
              <div className={styles.alertBanner(true)}>
                <strong>Exness XAUUSD feed unavailable.</strong> {exnessMessage || 'Kredensial server-only (EXN_API_KEY, EXN_PRIVATE_KEY, EXN_ACCOUNT_ID, EXN_API_BASE_URL) atau instrumen XAUUSD belum terkonfigurasi. EA dalam status jeda (paused) tanpa harga simulasi buatan.'}
              </div>
            ) : (
              <div className={styles.alertBanner(false)}>
                <strong>Exness Demo Feed Connected:</strong> Menampilkan Bid/Ask live XAUUSD via signed WebSocket SSE relay. Baseline eksperimental EMA(9)/EMA(21) + ATR(14) stop 1.5x aktif.
              </div>
            )}

            <NativePriceChart
              points={xauTicks}
              strokeColor="#f59e0b"
              label="XAUUSD Real-Time Price (Exness)"
            />

            {latestXau && (
              <div className={styles.headerCard}>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Bid</span>
                  <span className={styles.metricValue('#f59e0b')}>{latestXau.bid.toFixed(2)}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Ask</span>
                  <span className={styles.metricValue('#f59e0b')}>{latestXau.ask.toFixed(2)}</span>
                </div>
                <div className={styles.metricItem}>
                  <span className={styles.metricLabel}>Spread</span>
                  <span className={styles.metricValue('#a1a1aa')}>
                    {(latestXau.ask - latestXau.bid).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* Recent Trades / Activity Ledger */}
        <div className={styles.tableBox}>
          <div className={styles.tableHeader}>Recent Paper Trades & Signals ({recentTrades.length})</div>
          {recentTrades.length === 0 ? (
            <div style={{ padding: 12, color: '#71717a', fontSize: 12 }}>
              Belum ada riwayat paper trade untuk bot ini.
            </div>
          ) : (
            <table className={styles.nativeTable}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Market</th>
                  <th>Side</th>
                  <th>Stake</th>
                  <th>Entry Price</th>
                  <th>Exit Price</th>
                  <th>Gross P&L</th>
                  <th>Outcome</th>
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>
                      {new Date(t.openedAt).toLocaleTimeString()}
                    </td>
                    <td>{t.market}</td>
                    <td style={{ textTransform: 'uppercase', fontWeight: 700 }}>{t.side}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace' }}>${t.stake.toFixed(2)}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace' }}>${t.entryPrice.toFixed(4)}</td>
                    <td style={{ fontFamily: 'ui-monospace, monospace' }}>
                      {t.exitPrice ? `$${t.exitPrice.toFixed(4)}` : '—'}
                    </td>
                    <td
                      style={{
                        fontFamily: 'ui-monospace, monospace',
                        fontWeight: 700,
                        color: (t.grossPnl || 0) > 0 ? '#34d399' : (t.grossPnl || 0) < 0 ? '#f87171' : '#a1a1aa',
                      }}
                    >
                      {t.grossPnl !== undefined ? `$${t.grossPnl.toFixed(4)}` : '—'}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          background:
                            t.outcome === 'win'
                              ? 'rgba(16, 185, 129, 0.2)'
                              : t.outcome === 'loss'
                              ? 'rgba(239, 68, 68, 0.2)'
                              : 'rgba(255, 255, 255, 0.08)',
                          color:
                            t.outcome === 'win'
                              ? '#34d399'
                              : t.outcome === 'loss'
                              ? '#f87171'
                              : '#a1a1aa',
                        }}
                      >
                        {t.outcome || 'pending'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Modal>
  );
}
