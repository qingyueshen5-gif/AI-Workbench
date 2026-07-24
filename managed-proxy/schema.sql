CREATE TABLE IF NOT EXISTS installations (
  installation_hash TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  revoked_at TEXT,
  revoked_reason TEXT
);

CREATE TABLE IF NOT EXISTS daily_usage (
  usage_date TEXT NOT NULL,
  installation_hash TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (usage_date, installation_hash, ip_hash)
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS monthly_model_budget (
  month_key TEXT NOT NULL,
  model TEXT NOT NULL,
  reserved_micro_usd INTEGER NOT NULL DEFAULT 0,
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (month_key, model)
);

CREATE TABLE IF NOT EXISTS monthly_platform_budget (
  month_key TEXT PRIMARY KEY,
  reserved_micro_usd INTEGER NOT NULL DEFAULT 0,
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_usage_date ON daily_usage (usage_date);
CREATE INDEX IF NOT EXISTS idx_daily_usage_installation ON daily_usage (usage_date, installation_hash);
CREATE INDEX IF NOT EXISTS idx_daily_usage_ip ON daily_usage (usage_date, ip_hash);
