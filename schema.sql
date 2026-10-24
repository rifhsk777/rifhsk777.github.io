CREATE TABLE IF NOT EXISTS rank_vs_bot_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  game_id TEXT NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('FLEXIBLE', 'NO FLEXIBLE')),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  schedule TEXT NOT NULL CHECK (schedule IN ('SEKARANG', 'PAGI', 'SIANG', 'MALAM')),
  notes TEXT NOT NULL DEFAULT '',
  total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'MENUNGGU_PEMBAYARAN',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_rank_vs_bot_orders_created_at ON rank_vs_bot_orders(created_at);
