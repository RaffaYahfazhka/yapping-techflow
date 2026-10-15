import assert from 'node:assert/strict';
import { register } from 'node:module';
register('./ts-import-loader.mjs', import.meta.url);

const {
  TRADINGVIEW_SYMBOL,
  TRADINGVIEW_XAU_FALLBACK_URL,
  DEFAULT_TRADINGVIEW_CONFIG,
} = await import('../src/lib/data/chartConfig');

let passed = 0;
const test = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
};

test('symbol is configured exactly to OANDA:XAUUSD', () => {
  assert.equal(TRADINGVIEW_SYMBOL, 'OANDA:XAUUSD');
  assert.equal(DEFAULT_TRADINGVIEW_CONFIG.symbol, 'OANDA:XAUUSD');
});

test('fallback URL matches approved link exactly', () => {
  const expected = 'https://id.tradingview.com/chart/m0726Zvv/?symbol=OANDA%3AXAUUSD';
  assert.equal(TRADINGVIEW_XAU_FALLBACK_URL, expected);
  assert.equal(DEFAULT_TRADINGVIEW_CONFIG.fallbackUrl, expected);
});

test('default config specifies dark theme, M5 interval, Asia/Jakarta timezone', () => {
  assert.equal(DEFAULT_TRADINGVIEW_CONFIG.theme, 'dark');
  assert.equal(DEFAULT_TRADINGVIEW_CONFIG.interval, '5');
  assert.equal(DEFAULT_TRADINGVIEW_CONFIG.timezone, 'Asia/Jakarta');
});

console.log(`\nResults: ${passed} passed, 0 failed`);
