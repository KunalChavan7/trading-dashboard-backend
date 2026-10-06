import WebSocket from 'ws';
import { IndicatorStore } from './indicators.js';

const BACKFILL_LIMIT = 100;
const RECONNECT_MAX_MS = 30_000;

export class BinanceClient {
  constructor({ symbols, interval, indicatorPeriod, onData, onStatus }) {
    this.symbols = symbols;
    this.interval = interval;
    this.onData = onData;
    this.onStatus = onStatus;
    this.indicators = new IndicatorStore(indicatorPeriod);
    this.socket = null;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.reconnectAttempts = 0;
    this.stopped = false;
  }

  async start() {
    await this.backfill();
    this.connect();
  }

  async backfill() {
    const restBaseUrl = process.env.BINANCE_REST_URL ?? 'https://api.binance.com';

    await Promise.all(this.symbols.map(async (symbol) => {
      const params = new URLSearchParams({
        symbol: symbol.toUpperCase(),
        interval: this.interval,
        limit: String(BACKFILL_LIMIT),
      });

      try {
        const response = await fetch(`${restBaseUrl}/api/v3/klines?${params}`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) throw new Error(`Binance REST returned HTTP ${response.status}`);

        const rows = await response.json();
        const closedCandles = rows
          .filter((row) => Number(row[6]) < Date.now())
          .map((row) => ({ close: Number(row[4]) }));
        this.indicators.seed(symbol, closedCandles);
        this.onStatus?.({ type: 'backfill', symbol, candles: closedCandles.length });
      } catch (error) {
        this.indicators.seed(symbol, []);
        this.onStatus?.({ type: 'backfill_error', symbol, message: error.message });
      }
    }));
  }

  connect() {
    if (this.stopped) return;

    const baseUrl = process.env.BINANCE_WS_URL ?? 'wss://stream.binance.com:9443/stream';
    const streams = this.symbols.map((symbol) => `${symbol}@kline_${this.interval}`).join('/');
    const separator = baseUrl.includes('?') ? '&' : '?';
    const socket = new WebSocket(`${baseUrl}${separator}streams=${streams}`);
    this.socket = socket;
    this.onStatus?.({ type: 'connecting' });

    socket.on('open', () => {
      this.reconnectAttempts = 0;
      this.onStatus?.({ type: 'connected' });
      this.startHeartbeat(socket);
    });

    socket.on('message', (raw) => {
      try {
        this.handleMessage(JSON.parse(raw.toString()));
      } catch (error) {
        this.onStatus?.({ type: 'message_error', message: error.message });
      }
    });

    socket.on('error', (error) => {
      this.onStatus?.({ type: 'socket_error', message: error.message });
    });

    socket.on('close', () => {
      this.stopHeartbeat();
      if (this.socket === socket) this.socket = null;
      this.onStatus?.({ type: 'disconnected' });
      this.scheduleReconnect();
    });
  }

  handleMessage(message) {
    const kline = message.data?.k;
    if (!kline) return;

    const symbol = kline.s.toLowerCase();
    if (!this.symbols.includes(symbol)) return;

    const closed = Boolean(kline.x);
    const indicators = this.indicators.update(symbol, Number(kline.c), closed);
    this.onData?.({
      type: 'market_update',
      symbol,
      interval: this.interval,
      candle: {
        time: Math.floor(Number(kline.t) / 1000),
        open: Number(kline.o),
        high: Number(kline.h),
        low: Number(kline.l),
        close: Number(kline.c),
        volume: Number(kline.v),
        closed,
      },
      indicators: {
        period: this.indicators.period,
        ...indicators,
      },
      eventTime: Number(message.data?.E ?? Date.now()),
    });
  }

  startHeartbeat(socket) {
    this.stopHeartbeat();
    let alive = true;

    socket.on('pong', () => { alive = true; });
    this.heartbeatTimer = setInterval(() => {
      if (!alive) {
        socket.terminate();
        return;
      }
      alive = false;
      socket.ping();
    }, 30_000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    const delay = Math.min(1_000 * 2 ** this.reconnectAttempts, RECONNECT_MAX_MS);
    const jitteredDelay = Math.round(delay * (0.8 + Math.random() * 0.4));
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, jitteredDelay);
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
  }
}