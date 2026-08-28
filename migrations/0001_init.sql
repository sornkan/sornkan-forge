CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  brief TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  preview_url TEXT,
  published_url TEXT,
  d1_id TEXT,
  d1_name TEXT,
  r2_prefix TEXT,
  logs TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS files (
  project_id TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, path)
);

CREATE TABLE IF NOT EXISTS annotations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  note TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
