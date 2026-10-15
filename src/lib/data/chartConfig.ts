export const TRADINGVIEW_XAU_FALLBACK_URL =
  'https://id.tradingview.com/chart/m0726Zvv/?symbol=OANDA%3AXAUUSD';

export const TRADINGVIEW_SYMBOL = 'OANDA:XAUUSD';

export interface TradingViewWidgetConfig {
  symbol: string;
  interval: string;
  timezone: string;
  theme: 'dark' | 'light';
  style: string;
  locale: string;
  fallbackUrl: string;
}

export const DEFAULT_TRADINGVIEW_CONFIG: TradingViewWidgetConfig = {
  symbol: TRADINGVIEW_SYMBOL,
  interval: '5',
  timezone: 'Asia/Jakarta',
  theme: 'dark',
  style: '1',
  locale: 'id',
  fallbackUrl: TRADINGVIEW_XAU_FALLBACK_URL,
};
