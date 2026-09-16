// DGang — auth: PIN (bcrypt) + JWT + invite codes + group entry
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const { db, getUser, publicUser, memberOf } = require('./db');

const JWT_SECRET = process.env.DGANG_JWT_SECRET || 'dgang-dev-secret-change-in-prod';
const TOKEN_TTL = '30d';

// ---- PIN hash ----
function hashPin(pin) { return bcrypt.hashSync(String(pin), 10); }
function verifyPin(pin, hash) { try { return bcrypt.compareSync(String(pin), hash); } catch { return false; } }

// ---- JWT ----
function signToken(userId) { return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: TOKEN_TTL }); }
function verifyToken(token) { try { return jwt.verify(token, JWT_SECRET); } catch { return null; } }
function authMiddleware(req, res, next) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : null;
  const p = t && verifyToken(t);
  if (!p) return res.status(401).json({ error: 'unauthorized' });
  const u = getUser.get(p.uid);
  if (!u) return res.status(401).json({ error: 'no_user' });
  req.user = u; next();
}

// ---- invite codes ----
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no confusing chars
function genInviteCode(len = 6) {
  let s = '';
  for (let i = 0; i < len; i++) s += CODE_ALPHABET[randomBytes(1)[0] % CODE_ALPHABET.length];
  return s;
}

const insertUser = db.prepare('INSERT INTO users(name,emoji,c1,c2,pin_hash) VALUES(?,?,?,?,?)');
const findByName = db.prepare('SELECT * FROM users WHERE lower(name)=lower(?)');
const insertGroup = db.prepare('INSERT INTO groups(name,invite_code,pass_phrase,created_by) VALUES(?,?,?,?)');
const insertMember = db.prepare('INSERT INTO group_members(group_id,user_id,role) VALUES(?,?,?)');
const groupById = db.prepare('SELECT * FROM groups WHERE id=?');
const groupByCode = db.prepare('SELECT * FROM groups WHERE invite_code=?');
const userGroups = db.prepare(`SELECT g.*, (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id=g.id) member_count
  FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.user_id=? ORDER BY g.created_at DESC`);
const groupMembers = db.prepare(`SELECT u.id,u.name,u.emoji,u.c1,u.c2,gm.role FROM group_members gm
  JOIN users u ON u.id=gm.user_id WHERE gm.group_id=? ORDER BY gm.id`);

const MAX_GROUP = 20;

module.exports = {
  hashPin, verifyPin, signToken, verifyToken, authMiddleware,
  genInviteCode, MAX_GROUP,
  insertUser, findByName, insertGroup, insertMember,
  groupById, groupByCode, userGroups, groupMembers, publicUser, memberOf,
  db
};