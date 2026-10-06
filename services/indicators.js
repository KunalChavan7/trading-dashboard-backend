export class IndicatorStore {
  constructor(period = 14, historyLimit = 500) {
    if (!Number.isInteger(period) || period < 2) {
      throw new RangeError('Indicator period must be an integer greater than 1');
    }

    this.period = period;
    this.historyLimit = historyLimit;
    this.history = new Map();
    this.current = new Map();
  }

  seed(symbol, candles) {
    const closes = candles
      .map((candle) => Number(candle.close))
      .filter(Number.isFinite)
      .slice(-this.historyLimit);

    this.history.set(symbol, closes);
    this.current.delete(symbol);
  }

  update(symbol, close, isClosed) {
    const value = Number(close);
    if (!Number.isFinite(value)) {
      throw new TypeError('Candle close must be a finite number');
    }

    const closes = this.history.get(symbol) ?? [];
    if (isClosed) {
      closes.push(value);
      if (closes.length > this.historyLimit) closes.shift();
      this.current.delete(symbol);
    } else {
      this.current.set(symbol, value);
    }

    const values = this.current.has(symbol)
      ? [...closes, this.current.get(symbol)]
      : closes;

    this.history.set(symbol, closes);
    return this.calculate(values);
  }

  calculate(values) {
    const { period } = this;
    const window = values.slice(-period);
    const sma = window.length === period
      ? window.reduce((sum, value) => sum + value, 0) / period
      : null;

    let ema = null;
    if (values.length >= period) {
      const seed = values.slice(0, period);
      ema = seed.reduce((sum, value) => sum + value, 0) / period;
      const multiplier = 2 / (period + 1);
      for (const value of values.slice(period)) {
        ema = (value - ema) * multiplier + ema;
      }
    }

    let rsi = null;
    if (values.length > period) {
      const recent = values.slice(-period - 1);
      const changes = recent.slice(1).map((value, index) => value - recent[index]);
      const averageGain = changes.reduce((sum, change) => sum + Math.max(change, 0), 0) / period;
      const averageLoss = changes.reduce((sum, change) => sum + Math.max(-change, 0), 0) / period;

      if (averageLoss === 0) {
        rsi = averageGain === 0 ? 50 : 100;
      } else {
        const relativeStrength = averageGain / averageLoss;
        rsi = 100 - 100 / (1 + relativeStrength);
      }
    }

    return { sma, ema, rsi };
  }
}