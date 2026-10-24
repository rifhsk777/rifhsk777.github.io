CREATE TABLE IF NOT EXISTS rank_vs_bot_orders (
    order_id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    game_id TEXT NOT NULL,
    service TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    schedule TEXT NOT NULL,
    notes TEXT DEFAULT '',
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'MENUNGGU',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rank_vs_bot_orders_created
ON rank_vs_bot_orders(created_at);
