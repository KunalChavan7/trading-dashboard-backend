import test from 'node:test';
import assert from 'node:assert/strict';
import { IndicatorStore } from '../services/indicators.js';

test('calculates SMA and EMA after the configured period', () => {
  const indicators = new IndicatorStore(3);
  indicators.seed('btcusdt', [{ close: 1 }, { close: 2 }]);

  const result = indicators.update('btcusdt', 3, true);

  assert.equal(result.sma, 2);
  assert.equal(result.ema, 2);
  assert.equal(result.rsi, null);
});

test('calculates RSI from the latest period of price changes', () => {
  const indicators = new IndicatorStore(3);
  indicators.seed('ethusdt', [{ close: 1 }, { close: 2 }, { close: 3 }]);

  const result = indicators.update('ethusdt', 4, true);

  assert.equal(result.rsi, 100);
});

test('replaces the live candle value without adding it to closed history', () => {
  const indicators = new IndicatorStore(3);
  indicators.seed('solusdt', [{ close: 10 }, { close: 20 }]);

  assert.equal(indicators.update('solusdt', 30, false).sma, 20);
  assert.equal(indicators.update('solusdt', 40, false).sma, 70 / 3);
  assert.equal(indicators.update('solusdt', 40, true).sma, 70 / 3);
  assert.equal(indicators.update('solusdt', 50, false).sma, 110 / 3);
});