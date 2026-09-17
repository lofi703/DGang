// DGang — SQLite database layer (better-sqlite3)
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'dgang.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  emoji      TEXT DEFAULT '😎',
  c1         TEXT DEFAULT '#14b8ff',
  c2         TEXT DEFAULT '#635bff',
  pin_hash   TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS groups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  invite_code   TEXT UNIQUE NOT NULL,
  pass_phrase   TEXT,
  created_by    INTEGER NOT NULL REFERENCES users(id),
  created_at    INTEGER DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS group_members (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT DEFAULT 'member',          -- admin | member
  joined_at  INTEGER DEFAULT (unixepoch()),
  UNIQUE(group_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id),
  type      TEXT DEFAULT 'text',             -- text | photo | video | reel | game
  body      TEXT,
  media_url TEXT,
  ts        INTEGER DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS reactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  emoji      TEXT NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);
CREATE TABLE IF NOT EXISTS reels (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  video_url  TEXT NOT NULL,
  poster_url TEXT,
  caption    TEXT,
  ts         INTEGER DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS reel_likes (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  reel_id INTEGER NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  UNIQUE(reel_id, user_id)
);
CREATE TABLE IF NOT EXISTS games (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,                    -- truth_dare | tictactoe
  state     TEXT,                             -- JSON
  created_by INTEGER NOT NULL REFERENCES users(id),
  ts        INTEGER DEFAULT (unixepoch())
);
CREATE TABLE IF NOT EXISTS push_subs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint      TEXT NOT NULL UNIQUE,
  keys          TEXT NOT NULL,                -- JSON {auth,p256dh}
  created_at    INTEGER DEFAULT (unixepoch())
);
`);

// ---- helpers ----
const getUser = db.prepare('SELECT id,name,emoji,c1,c2,created_at FROM users WHERE id=?');
const publicUser = u => u ? { id:u.id, name:u.name, emoji:u.emoji, c1:u.c1, c2:u.c2 } : null;
const memberOf = db.prepare('SELECT * FROM group_members WHERE group_id=? AND user_id=?');

module.exports = { db, getUser, publicUser, memberOf };