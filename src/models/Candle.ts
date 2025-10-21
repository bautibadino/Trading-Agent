export interface CandleJSON {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
  openDate: string;
  closeDate: string;
  range: number;
  body: number;
  isBullish: boolean;
  isBearish: boolean;
}

export type CandleArray = [
  number | string,
  string,
  string,
  string,
  string,
  string,
  number | string,
  string,
  number | string,
  string,
  string,
  string?
];

export interface CandleObject {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
  ignore?: unknown;
}

export type CandleSource = CandleArray | CandleObject;

const toNumber = (value: string | number): number => {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new TypeError(`Valor numérico inválido: ${value}`);
  }
  return parsed;
};

/**
 * Modelo para representar una vela OHLCV
 */
export class Candle {
  public readonly openTime: number;
  public readonly open: number;
  public readonly high: number;
  public readonly low: number;
  public readonly close: number;
  public readonly volume: number;
  public readonly closeTime: number;
  public readonly quoteVolume: number;
  public readonly trades: number;
  public readonly takerBuyBaseVolume: number;
  public readonly takerBuyQuoteVolume: number;
  public readonly ignore: unknown;

  constructor(data: CandleSource) {
    if (Array.isArray(data)) {
      this.openTime = Number(data[0]);
      this.open = toNumber(data[1]);
      this.high = toNumber(data[2]);
      this.low = toNumber(data[3]);
      this.close = toNumber(data[4]);
      this.volume = toNumber(data[5]);
      this.closeTime = Number(data[6]);
      this.quoteVolume = toNumber(data[7]);
      this.trades = Number(data[8]);
      this.takerBuyBaseVolume = toNumber(data[9]);
      this.takerBuyQuoteVolume = toNumber(data[10]);
      this.ignore = data[11];
    } else {
      this.openTime = data.openTime;
      this.open = data.open;
      this.high = data.high;
      this.low = data.low;
      this.close = data.close;
      this.volume = data.volume;
      this.closeTime = data.closeTime;
      this.quoteVolume = data.quoteVolume;
      this.trades = data.trades;
      this.takerBuyBaseVolume = data.takerBuyBaseVolume;
      this.takerBuyQuoteVolume = data.takerBuyQuoteVolume;
      this.ignore = data.ignore;
    }
  }

  getOpenDate(): Date {
    return new Date(this.openTime);
  }

  getCloseDate(): Date {
    return new Date(this.closeTime);
  }

  getRange(): number {
    return this.high - this.low;
  }

  getBody(): number {
    return this.close - this.open;
  }

  isBullish(): boolean {
    return this.close > this.open;
  }

  isBearish(): boolean {
    return this.close < this.open;
  }

  toJSON(): CandleJSON {
    return {
      openTime: this.openTime,
      open: this.open,
      high: this.high,
      low: this.low,
      close: this.close,
      volume: this.volume,
      closeTime: this.closeTime,
      quoteVolume: this.quoteVolume,
      trades: this.trades,
      takerBuyBaseVolume: this.takerBuyBaseVolume,
      takerBuyQuoteVolume: this.takerBuyQuoteVolume,
      openDate: this.getOpenDate().toISOString(),
      closeDate: this.getCloseDate().toISOString(),
      range: this.getRange(),
      body: this.getBody(),
      isBullish: this.isBullish(),
      isBearish: this.isBearish()
    };
  }

  static fromJSON(json: CandleJSON): Candle {
    return new Candle({
      openTime: json.openTime,
      open: json.open,
      high: json.high,
      low: json.low,
      close: json.close,
      volume: json.volume,
      closeTime: json.closeTime,
      quoteVolume: json.quoteVolume,
      trades: json.trades,
      takerBuyBaseVolume: json.takerBuyBaseVolume,
      takerBuyQuoteVolume: json.takerBuyQuoteVolume
    });
  }
}
