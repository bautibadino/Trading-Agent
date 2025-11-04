-- CreateTable
CREATE TABLE "collectors" (
    "id" SERIAL NOT NULL,
    "pid" INTEGER NOT NULL,
    "timeframe" VARCHAR(10) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stopped_at" TIMESTAMP(3),

    CONSTRAINT "collectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_data" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "timeframe" VARCHAR(10) NOT NULL,
    "last_price" DOUBLE PRECISION NOT NULL,
    "best_bid_price" DOUBLE PRECISION NOT NULL,
    "best_bid_qty" DOUBLE PRECISION NOT NULL,
    "best_ask_price" DOUBLE PRECISION NOT NULL,
    "best_ask_qty" DOUBLE PRECISION NOT NULL,
    "mid_price" DOUBLE PRECISION NOT NULL,
    "spread" DOUBLE PRECISION NOT NULL,
    "spread_bps" DOUBLE PRECISION NOT NULL,
    "imbalance" DOUBLE PRECISION NOT NULL,
    "microprice" DOUBLE PRECISION NOT NULL,
    "taker_buy_quote" DOUBLE PRECISION NOT NULL,
    "taker_sell_quote" DOUBLE PRECISION NOT NULL,
    "taker_buy_ratio" DOUBLE PRECISION NOT NULL,
    "rsi14" DOUBLE PRECISION,
    "sma20" DOUBLE PRECISION,
    "ema9" DOUBLE PRECISION,
    "ema21" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "ema9_above21" BOOLEAN,
    "rsi_state" VARCHAR(20) NOT NULL,
    "buy_pressure" BOOLEAN NOT NULL,
    "funding_rate" DOUBLE PRECISION NOT NULL,
    "index_price" DOUBLE PRECISION NOT NULL,
    "volume_24h" DOUBLE PRECISION NOT NULL,
    "high_24h" DOUBLE PRECISION NOT NULL,
    "low_24h" DOUBLE PRECISION NOT NULL,
    "open_interest" DOUBLE PRECISION,
    "liquidation_volume" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" SERIAL NOT NULL,
    "symbol" VARCHAR(20) NOT NULL,
    "side" VARCHAR(10) NOT NULL,
    "entry_price" DOUBLE PRECISION NOT NULL,
    "exit_price" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL,
    "profit" DOUBLE PRECISION,
    "profit_percent" DOUBLE PRECISION,
    "reason" TEXT,
    "entry_time" TIMESTAMP(3) NOT NULL,
    "exit_time" TIMESTAMP(3),
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "collectors_pid_key" ON "collectors"("pid");

-- CreateIndex
CREATE INDEX "collectors_status_idx" ON "collectors"("status");

-- CreateIndex
CREATE INDEX "collectors_symbol_timeframe_idx" ON "collectors"("symbol", "timeframe");

-- CreateIndex
CREATE INDEX "market_data_symbol_timeframe_timestamp_idx" ON "market_data"("symbol", "timeframe", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "market_data_symbol_timeframe_idx" ON "market_data"("symbol", "timeframe");

-- CreateIndex
CREATE INDEX "market_data_timestamp_idx" ON "market_data"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "market_data_symbol_timeframe_timestamp_key" ON "market_data"("symbol", "timeframe", "timestamp");

-- CreateIndex
CREATE INDEX "trades_symbol_status_idx" ON "trades"("symbol", "status");

-- CreateIndex
CREATE INDEX "trades_entry_time_idx" ON "trades"("entry_time");

