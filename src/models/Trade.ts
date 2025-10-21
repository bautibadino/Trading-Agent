export interface TradeJSON {
  id: number;
  price: number;
  quantity: number;
  timestamp: number;
  isBuyerMaker: boolean;
  symbol: string;
  date: string;
  total: number;
  isBuy: boolean;
  isSell: boolean;
}

interface TradeSource {
  id: number;
  price: string | number;
  quantity: string | number;
  timestamp: number;
  isBuyerMaker: boolean;
  symbol: string;
}

const toNumber = (value: string | number): number => {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new TypeError(`Valor numérico inválido: ${value}`);
  }
  return parsed;
};

/**
 * Modelo para representar un trade/transacción
 */
export class Trade {
  public readonly id: number;
  public readonly price: number;
  public readonly quantity: number;
  public readonly timestamp: number;
  public readonly isBuyerMaker: boolean;
  public readonly symbol: string;

  constructor(data: TradeSource) {
    this.id = data.id;
    this.price = toNumber(data.price);
    this.quantity = toNumber(data.quantity);
    this.timestamp = data.timestamp;
    this.isBuyerMaker = data.isBuyerMaker;
    this.symbol = data.symbol;
  }

  getDate(): Date {
    return new Date(this.timestamp);
  }

  getTotal(): number {
    return this.price * this.quantity;
  }

  isBuy(): boolean {
    return !this.isBuyerMaker;
  }

  isSell(): boolean {
    return this.isBuyerMaker;
  }

  toJSON(): TradeJSON {
    return {
      id: this.id,
      price: this.price,
      quantity: this.quantity,
      timestamp: this.timestamp,
      isBuyerMaker: this.isBuyerMaker,
      symbol: this.symbol,
      date: this.getDate().toISOString(),
      total: this.getTotal(),
      isBuy: this.isBuy(),
      isSell: this.isSell()
    };
  }

  static fromJSON(json: TradeJSON): Trade {
    return new Trade({
      id: json.id,
      price: json.price,
      quantity: json.quantity,
      timestamp: json.timestamp,
      isBuyerMaker: json.isBuyerMaker,
      symbol: json.symbol
    });
  }
}
