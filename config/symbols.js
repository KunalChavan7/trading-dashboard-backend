import 'dotenv/config';

const supportedIntervals = new Set([
  '1s', '1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M',
]);

export const SYMBOLS = (process.env.SYMBOLS ?? 'btcusdt,ethusdt,solusdt')
  .split(',')
  .map((symbol) => symbol.trim().toLowerCase())
  .filter(Boolean);

if (SYMBOLS.length === 0 || SYMBOLS.some((symbol) => !/^[a-z0-9]{5,20}$/.test(symbol))) {
  throw new Error('SYMBOLS must be a comma-separated list of Binance symbol names, such as btcusdt,ethusdt');
}

export const INTERVAL = process.env.KLINE_INTERVAL ?? '1m';

if (!supportedIntervals.has(INTERVAL)) {
  throw new Error(`Unsupported KLINE_INTERVAL: ${INTERVAL}`);
}

export const INDICATOR_PERIOD = Number.parseInt(process.env.INDICATOR_PERIOD ?? '14', 10);

if (!Number.isInteger(INDICATOR_PERIOD) || INDICATOR_PERIOD < 2) {
  throw new Error('INDICATOR_PERIOD must be an integer greater than 1');
}

export const PORT = Number.parseInt(process.env.PORT ?? '3001', 10);