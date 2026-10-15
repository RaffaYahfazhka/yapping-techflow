'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LineChart, AlertTriangle } from 'lucide-react';
import {
  TRADINGVIEW_SYMBOL,
  TRADINGVIEW_XAU_FALLBACK_URL,
  DEFAULT_TRADINGVIEW_CONFIG,
} from '@/lib/data/chartConfig';

export { TRADINGVIEW_SYMBOL, TRADINGVIEW_XAU_FALLBACK_URL };

export interface TradingViewXauChartProps {
  height?: number | string;
  className?: string;
}

export default function TradingViewXauChart({
  height = 420,
  className = '',
}: TradingViewXauChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if script already exists or create widget
    let timeout: NodeJS.Timeout | null = null;
    let cancelled = false;

    try {
      const widgetDiv = document.createElement('div');
      widgetDiv.className = 'tradingview-widget-container__widget';
      widgetDiv.style.height = '100%';
      widgetDiv.style.width = '100%';

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
      script.async = true;
      script.innerHTML = JSON.stringify({
        autosize: true,
        symbol: TRADINGVIEW_SYMBOL,
        interval: '5',
        timezone: 'Asia/Jakarta',
        theme: 'dark',
        style: '1',
        locale: 'id',
        enable_publishing: false,
        backgroundColor: 'rgba(9, 9, 11, 0.95)',
        gridColor: 'rgba(255, 255, 255, 0.05)',
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        calendar: false,
        support_host: 'https://www.tradingview.com',
      });

      script.onload = () => {
        if (!cancelled) setLoaded(true);
      };
      script.onerror = () => {
        if (!cancelled) setLoadFailed(true);
      };

      container.innerHTML = '';
      container.appendChild(widgetDiv);
      container.appendChild(script);

      // Timeout fallback: if widget hasn't loaded in 6 seconds, show fallback banner
      timeout = setTimeout(() => {
        if (!cancelled && !loaded) {
          // Check if iframe was injected
          const hasIframe = container.querySelector('iframe');
          if (!hasIframe) {
            setLoadFailed(true);
          }
        }
      }, 6000);
    } catch {
      setLoadFailed(true);
    }

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (container) {
        container.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className={`flex flex-col gap-2 rounded-2xl border border-white/10 bg-black/40 p-3 md:p-4 ${className}`}>
      {/* Header bar with symbol info and external fallback link */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/25">
            <LineChart size={15} />
          </div>
          <div>
            <span className="font-bold text-white tracking-wide">{TRADINGVIEW_SYMBOL}</span>
            <span className="ml-2 text-[11px] text-zinc-400">TradingView Advanced Chart (M5)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-500 hidden sm:inline">
            Feed independen (Visual Chart) &bull; EA Paper menggunakan Exness
          </span>
          <a
            href={TRADINGVIEW_XAU_FALLBACK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            aria-label="Buka chart OANDA:XAUUSD langsung di TradingView (tab baru)"
          >
            <span>Buka di TradingView</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Widget Container or Blocked Fallback */}
      <div
        className="relative w-full overflow-hidden rounded-xl bg-black/60"
        style={{ height }}
      >
        {loadFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle size={32} className="text-amber-400 opacity-80" />
            <div className="max-w-md">
              <h4 className="text-sm font-semibold text-white">Widget TradingView Terblokir</h4>
              <p className="mt-1 text-xs text-zinc-400">
                Browser atau ad-blocker memblokir embed eksternal TradingView. Anda tetap dapat membuka chart langsung melalui link resmi di bawah.
              </p>
            </div>
            <a
              href={TRADINGVIEW_XAU_FALLBACK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300"
            >
              <ExternalLink size={14} />
              <span>Buka OANDA:XAUUSD di TradingView</span>
            </a>
          </div>
        ) : (
          <div ref={containerRef} className="tradingview-widget-container h-full w-full" />
        )}
      </div>

      <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1">
        <span>Sumber visual: TradingView Advanced Chart</span>
        <span>Simulasi EA: Exness Gateway Paper Feed</span>
      </div>
    </div>
  );
}
