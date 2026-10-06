# Real-Time Trading Dashboard Backend

A Node.js relay that reads public Binance kline streams, computes SMA, EMA, and RSI, and broadcasts normalized updates to browser clients. It does not require Binance credentials.

## Requirements

- Node.js 20.6 or newer
- Network access to Binance public REST and WebSocket endpoints

## Run

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The HTTP health check is available at `http://localhost:3001/health`; clients connect to `ws://localhost:3001/ws`. Run the smoke client in a second terminal with `npm run test:ws` after installing dependencies (or use `node test-ws.js`).

Set `TEST_DURATION_MS=15000` to have the smoke client exit after 15 seconds. The default `0` keeps it running until interrupted.

## Configuration

Copy `.env.example` to `.env` and change `SYMBOLS`, `KLINE_INTERVAL`, `INDICATOR_PERIOD`, or `PORT` as needed. Symbols are lowercase Binance market names. On startup, the backend requests up to 100 recent klines per symbol so indicators can be populated immediately; a REST failure is logged and live streaming still starts.

## WebSocket messages

The server sends a `snapshot` when a client connects, followed by `market_update` messages as Binance updates each active kline. Candle `time` is a Unix timestamp in seconds, suitable for charting libraries that use epoch-second values.

```json
{
  "type": "market_update",
  "symbol": "btcusdt",
  "interval": "1m",
  "candle": {
    "time": 1730000000,
    "open": 67000,
    "high": 67100,
    "low": 66900,
    "close": 67050,
    "volume": 12.5,
    "closed": false
  },
  "indicators": {
    "period": 14,
    "sma": 67012.5,
    "ema": 67020.1,
    "rsi": 54.2
  },
  "eventTime": 1730000000123
}
```

Indicator values are `null` until enough candles are available. SMA and EMA require `period` closes; RSI requires `period` price changes. Open-candle updates revise the current indicator values without adding duplicate history.

## Verify

```powershell
npm test
npm run test:ws
```