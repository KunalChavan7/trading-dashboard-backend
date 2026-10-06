import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import { INDICATOR_PERIOD, INTERVAL, PORT, SYMBOLS } from './config/symbols.js';
import { BinanceClient } from './services/binanceClient.js';

const app = express();
const server = createServer(app);
const webSocketServer = new WebSocketServer({ noServer: true });
const latestBySymbol = new Map();
let exchangeStatus = 'starting';

app.get('/health', (_request, response) => {
  response.json({
    status: 'ok',
    exchange: exchangeStatus,
    symbols: SYMBOLS,
    interval: INTERVAL,
    clients: webSocketServer.clients.size,
  });
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (pathname !== '/ws') {
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
    webSocketServer.emit('connection', webSocket, request);
  });
});

webSocketServer.on('connection', (webSocket) => {
  webSocket.send(JSON.stringify({
    type: 'snapshot',
    exchange: exchangeStatus,
    data: [...latestBySymbol.values()],
  }));
});

const binance = new BinanceClient({
  symbols: SYMBOLS,
  interval: INTERVAL,
  indicatorPeriod: INDICATOR_PERIOD,
  onData: (update) => {
    latestBySymbol.set(update.symbol, update);
    const message = JSON.stringify(update);
    for (const client of webSocketServer.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  },
  onStatus: (status) => {
    if (status.type === 'connected') exchangeStatus = 'connected';
    if (status.type === 'disconnected' || status.type === 'socket_error') exchangeStatus = 'disconnected';
    if (status.type === 'connecting') exchangeStatus = 'connecting';
    if (status.type.endsWith('_error')) console.warn(`[binance] ${status.type}: ${status.message}`);
    if (status.type === 'backfill') console.info(`[binance] backfilled ${status.candles} candles for ${status.symbol}`);
  },
});

server.listen(PORT, () => {
  console.info(`Trading dashboard backend listening on http://localhost:${PORT}`);
  console.info(`WebSocket relay: ws://localhost:${PORT}/ws`);
  binance.start().catch((error) => {
    exchangeStatus = 'disconnected';
    console.error(`[binance] startup failed: ${error.message}`);
  });
});

function shutdown() {
  binance.stop();
  for (const client of webSocketServer.clients) client.close(1001, 'Server shutting down');
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);