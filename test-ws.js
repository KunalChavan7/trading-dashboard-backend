import 'dotenv/config';
import WebSocket from 'ws';

const url = process.env.WS_URL ?? 'ws://localhost:3001/ws';
const socket = new WebSocket(url);

socket.on('open', () => console.info(`Connected to ${url}`));
socket.on('message', (raw) => {
  const message = JSON.parse(raw.toString());
  if (message.type === 'snapshot') {
    console.info(`Snapshot: exchange=${message.exchange}, symbols=${message.data.length}`);
    return;
  }

  if (message.type === 'market_update') {
    const { symbol, candle, indicators } = message;
    console.info(
      `[${symbol}] close=${candle.close} closed=${candle.closed} ` +
      `sma${indicators.period}=${indicators.sma ?? 'null'} ` +
      `ema${indicators.period}=${indicators.ema ?? 'null'} ` +
      `rsi${indicators.period}=${indicators.rsi ?? 'null'}`,
    );
  }
});

socket.on('error', (error) => {
  console.error(`WebSocket error: ${error.message}`);
  process.exitCode = 1;
});
socket.on('close', () => process.exit());

const duration = Number.parseInt(process.env.TEST_DURATION_MS ?? '0', 10);
if (duration > 0) {
  setTimeout(() => socket.close(1000, 'Smoke test complete'), duration).unref();
}

process.on('SIGINT', () => socket.close(1000, 'Smoke test stopped'));