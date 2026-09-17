// DGang — main server: Express API + Socket.io realtime
const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const httpServer = require('http').Server;
const { Server } = require('socket.io');
const multer = require('multer');

const { db, publicUser } = require('./db');
const auth = require('./auth');
const webpush = require('web-push');
// VAPID keys
let VAPID_KEY='', VAPID_PRIV='';
try{ const v=fs.readFileSync(path.join(__dirname,'..','.vapid'),'utf8').split('\n'); VAPID_KEY=v[0].trim(); VAPID_PRIV=v[1].trim();
  webpush.setVapidDetails('mailto:nayanmonda245@gmail.com', VAPID_KEY, VAPID_PRIV); }catch(e){ console.log('No VAPID keys:', e.message); }

// ---------- config ----------
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const MEDIA_DIR = path.join(__dirname, '..', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// ---------- app ----------
const app = express();
const server = httpServer(app);
const io = new Server(server, { cors: { origin: '*' }, maxHttpBufferSize: 5e7 });

app.use(express.json({ limit: '6mb' }));
app.use('/media', express.static(MEDIA_DIR, { maxAge: '30d', immutable: true }));

// ---------- uploads ----------
const upload = multer({
  storage: multer.diskStorage({
    destination: (r, f, cb) => cb(null, MEDIA_DIR),
    filename: (r, f, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(f.originalname))
  }),
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});
function mediaUrl(f) { return `/media/${f.filename}`; }

// ---------- auth endpoints ----------
app.get('/api/health', (req, res) => res.json({ ok: true, name: 'DGang' }));

// register or login: name + pin + (emoji/colors)
app.post('/api/auth/login', (req, res) => {
  const { name, pin, emoji, c1, c2 } = req.body || {};
  if (!name || !pin) return res.status(400).json({ error: 'name_and_pin_required' });
  let u = auth.findByName.get(name.trim());
  if (!u) {
    // auto-register first time
    const r = auth.insertUser.run(name.trim(), emoji || '😎', c1 || '#14b8ff', c2 || '#635bff', auth.hashPin(pin));
    u = auth.db.prepare('SELECT * FROM users WHERE id=?').get(r.lastInsertRowid);
  } else if (!auth.verifyPin(pin, u.pin_hash)) {
    return res.status(401).json({ error: 'wrong_pin' });
  }
  res.json({ token: auth.signToken(u.id), user: publicUser(u) });
});

// create group
app.post('/api/group/create', auth.authMiddleware, (req, res) => {
  const { name, pass_phrase } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'group_name_required' });
  let code = auth.genInviteCode();
  while (auth.groupByCode.get(code)) code = auth.genInviteCode();
  const r = auth.insertGroup.run(String(name).trim(), code, pass_phrase || null, req.user.id);
  const gid = r.lastInsertRowid;
  auth.insertMember.run(gid, req.user.id, 'admin');
  joinSocketRoom(req.user.id, gid);
  res.json({ group: groupJson(gid), invite_code: code });
});

// join group by invite code
app.post('/api/group/join', auth.authMiddleware, (req, res) => {
  const { code, pass_phrase } = req.body || {};
  if (!code) return res.status(400).json({ error: 'code_required' });
  const g = auth.groupByCode.get(String(code).trim().toUpperCase());
  if (!g) return res.status(404).json({ error: 'invalid_code' });
  if (auth.memberOf.get(g.id, req.user.id)) return res.json({ group: groupJson(g.id) });
  const cnt = auth.db.prepare('SELECT COUNT(*) c FROM group_members WHERE group_id=?').get(g.id).c;
  if (cnt >= auth.MAX_GROUP) return res.status(400).json({ error: 'group_full' });
  if (g.pass_phrase && g.pass_phrase !== pass_phrase) return res.status(403).json({ error: 'wrong_pass' });
  auth.insertMember.run(g.id, req.user.id, 'member');
  joinSocketRoom(req.user.id, g.id);
  res.json({ group: groupJson(g.id) });
});

// list my groups
app.get('/api/groups', auth.authMiddleware, (req, res) => {
  const rows = auth.userGroups.all(req.user.id);
  res.json({ groups: rows.map(r => groupJson(r.id)) });
});

// messages of a group
app.get('/api/group/:id/messages', auth.authMiddleware, (req, res) => {
  const gid = +req.params.id;
  if (!auth.memberOf.get(gid, req.user.id)) return res.status(403).json({ error: 'not_member' });
  const before = +req.query.before || 1e15;
  const msgs = db.prepare(`SELECT m.*, u.name sender, u.emoji, u.c1, u.c2
    FROM messages m JOIN users u ON u.id=m.user_id
    WHERE m.group_id=? AND m.id<? ORDER BY m.id DESC LIMIT 50`).all(gid, before);
  const richer = msgs.reverse().map(rowWithReactions);
  res.json({ messages: richer });
});

// send message (photo/video upload or text) — REST fallback
app.post('/api/group/:id/message', auth.authMiddleware, upload.single('file'), (req, res) => {
  const gid = +req.params.id;
  if (!auth.memberOf.get(gid, req.user.id)) return res.status(403).json({ error: 'not_member' });
  let type = req.body.type || 'text';
  let media = null, body = req.body.body || '';
  if (req.file) { media = mediaUrl(req.file); if (type === 'text') type = /\.(mp4|webm|mov|avi)$/i.test(req.file.filename) ? 'video' : 'photo'; }
  const r = db.prepare('INSERT INTO messages(group_id,user_id,type,body,media_url) VALUES(?,?,?,?,?)')
    .run(gid, req.user.id, type, body, media);
  const m = rowWithReactions(db.prepare(`SELECT m.*, u.name sender, u.emoji, u.c1, u.c2 FROM messages m
    JOIN users u ON u.id=m.user_id WHERE m.id=?`).get(r.lastInsertRowid));
  io.to('g' + gid).emit('message', m);
  // push to offline group members
  const off = groupMemberIds.all(gid).map(x=>x.uid).filter(uid=>uid!==req.user.id && !online.has(uid));
  if(off.length) sendPush(off, '💬 '+req.user.name, m.type==='photo'?'🖼️ Photo share hui':m.type==='video'?'🎬 Video share hua':(m.body||'').slice(0,120), '/');
  res.json({ message: m });
});

// react to a message
app.post('/api/message/:id/react', auth.authMiddleware, (req, res) => {
  const mid = +req.params.id;
  const emoji = (req.body || {}).emoji;
  if (!emoji) return res.status(400).json({ error: 'emoji_required' });
  const m = db.prepare('SELECT * FROM messages WHERE id=?').get(mid);
  if (!m) return res.status(404).json({ error: 'not_found' });
  if (!auth.memberOf.get(m.group_id, req.user.id)) return res.status(403).json({ error: 'not_member' });
  db.prepare('INSERT OR IGNORE INTO reactions(message_id,user_id,emoji) VALUES(?,?,?)').run(mid, req.user.id, emoji);
  io.to('g' + m.group_id).emit('reaction', { message_id: mid, reactions: reactionsOf(mid) });
  res.json({ ok: true, reactions: reactionsOf(mid) });
});

// reels endpoints
app.post('/api/group/:id/reel', auth.authMiddleware, upload.single('file'), (req, res) => {
  const gid = +req.params.id;
  if (!auth.memberOf.get(gid, req.user.id)) return res.status(403).json({ error: 'not_member' });
  if (!req.file) return res.status(400).json({ error: 'video_required' });
  const caption = req.body.caption || '';
  const r = db.prepare('INSERT INTO reels(user_id,group_id,video_url,poster_url,caption) VALUES(?,?,?,?,?)')
    .run(req.user.id, gid, mediaUrl(req.file), req.body.poster || null, caption);
  const reel = reelJson(r.lastInsertRowid);
  io.to('g' + gid).emit('reel_new', reel);
  res.json({ reel });
});
app.get('/api/group/:id/reels', auth.authMiddleware, (req, res) => {
  const gid = +req.params.id;
  if (!auth.memberOf.get(gid, req.user.id)) return res.status(403).json({ error: 'not_member' });
  res.json({ reels: db.prepare('SELECT id FROM reels WHERE group_id=? ORDER BY id DESC LIMIT 100').all(gid).map(r => reelJson(r.id)) });
});
app.post('/api/reel/:id/like', auth.authMiddleware, (req, res) => {
  const reel = db.prepare('SELECT * FROM reels WHERE id=?').get(+req.params.id);
  if (!reel) return res.status(404).json({ error: 'not_found' });
  if (!auth.memberOf.get(reel.group_id, req.user.id)) return res.status(403).json({ error: 'not_member' });
  db.prepare('INSERT OR IGNORE INTO reel_likes(reel_id,user_id) VALUES(?,?)').run(reel.id, req.user.id);
  io.to('g' + reel.group_id).emit('reel_like', { reel_id: reel.id, likes: likerCount(reel.id), by: req.user.id });
  res.json({ ok: true, likes: likerCount(reel.id) });
});

// ---------- helpers ----------
function reactionsOf(mid) {
  const rows = db.prepare(`SELECT r.emoji, u.id uid, u.name, u.emoji ue, u.c1 c1 FROM reactions r
    JOIN users u ON u.id=r.user_id WHERE r.message_id=?`).all(mid);
  const map = {};
  rows.forEach(x => { (map[x.emoji] = map[x.emoji] || []).push({ id: x.uid, name: x.name, emoji: x.ue, c1: x.c1 }); });
  return map;
}
function rowWithReactions(row) {
  if (!row) return row;
  return { ...row, reactions: reactionsOf(row.id), likes: undefined, sender: row.sender || (row.name) };
}
function replyFmt(row) { return { ...rowWithReactions(row), group_id: undefined }; }
function groupJson(gid) {
  const g = auth.groupById.get(gid);
  const ms = auth.groupMembers.all(gid);
  return { id: g.id, name: g.name, invite_code: g.invite_code, has_pass: !!g.pass_phrase,
    members: ms.map(m => ({ id: m.id, name: m.name, emoji: m.emoji, c1: m.c1, c2: m.c2, role: m.role })),
    member_count: ms.length }; }
function reelJson(rid) {
  const r = db.prepare('SELECT r.*, u.name sender, u.emoji su, u.c1 sc1, u.c2 sc2 FROM reels r JOIN users u ON u.id=r.user_id WHERE r.id=?').get(rid);
  return { id: r.id, video_url: r.video_url, poster_url: r.poster_url, caption: r.caption,
    ts: r.ts, sender: r.sender, emoji: r.su, c1: r.sc1, c2: r.sc2, likes: likerCount(rid) }; }
function likerCount(rid) { return db.prepare('SELECT COUNT(*) c FROM reel_likes WHERE reel_id=?').get(rid).c; }

// ---------- TURN credentials (coturn REST API auth) ----------
const TURN_SECRET = process.env.DGANG_TURN_SECRET || 'm6IF6PHtj/qKeLkcFgzSpP9qayc+J/s/';
const TURN_LIFETIME = 24 * 3600;
const crypto = require('crypto');
function turnCreds(uid) {
  const ts = Math.floor(Date.now() / 1000) + TURN_LIFETIME;
  const username = ts + ':' + uid;
  const cred = crypto.createHmac('sha1', TURN_SECRET).update(username).digest('base64');
  return { username, credential: cred, ttl: TURN_LIFETIME };
}
app.get('/api/turn', auth.authMiddleware, (req, res) => {
  res.json({ iceServers: [
    { urls: ['stun:140.245.252.78:3478', 'stun:dgang.mooo.com:3478'] },
    { urls: ['turn:140.245.252.78:3478?transport=udp','turn:140.245.252.78:3478?transport=tcp',
             'turn:dgang.mooo.com:3478?transport=udp','turn:dgang.mooo.com:3478?transport=tcp'],
      username: turnCreds('dgang').username, credential: turnCreds('dgang').credential }
  ]});
});

// ---------- Web Push ----------
app.get('/api/push/vapidkey', (req, res) => res.json({ key: VAPID_KEY }));
app.post('/api/push/subscribe', auth.authMiddleware, (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!endpoint || !keys) return res.status(400).json({ error: 'bad_subscription' });
  db.prepare('INSERT OR REPLACE INTO push_subs(user_id,endpoint,keys) VALUES(?,?,?)')
    .run(req.user.id, endpoint, JSON.stringify(keys));
  res.json({ ok: true });
});
function subsForUsers(userIds) {
  if (!userIds.length) return [];
  const ph = userIds.map(()=>'?').join(',');
  const rows = db.prepare(`SELECT endpoint, keys FROM push_subs WHERE user_id IN (${ph})`).all(...userIds);
  return rows.map(r => ({ endpoint: r.endpoint, keys: JSON.parse(r.keys) }));
}
function sendPush(userIds, title, body, url) {
  const payload = JSON.stringify({ title, body, url });
  subsForUsers(userIds).forEach(sub => {
    webpush.sendNotification(sub, payload, { TTL: 60 }).catch(err => {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subs WHERE endpoint=?').run(sub.endpoint);
      }
    });
  });
}
const groupMemberIds = db.prepare('SELECT user_id uid FROM group_members WHERE group_id=?');

// ---------- socket presence ----------
const online = new Set(); // userIds
function joinSocketRoom(uid, gid) {
  const g = userGroupIds(uid);
  const s = io.sockets.sockets;
  s.forEach(sock => { if (sock.data.uid === uid) { g.forEach(id => sock.join('g' + id)); } });
}
function userGroupIds(uid) { return auth.userGroups.all(uid).map(r => r.id); }

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  const p = token && auth.verifyToken(token);
  if (!p) return next(new Error('unauthorized'));
  const u = auth.db.prepare('SELECT * FROM users WHERE id=?').get(p.uid);
  if (!u) return next(new Error('no_user'));
  socket.data.uid = u.id; socket.data.user = publicUser(u);
  next();
});

io.on('connection', (socket) => {
  const uid = socket.data.uid;
  online.add(uid);
  const gids = userGroupIds(uid);
  gids.forEach(g => socket.join('g' + g));
  // presence broadcast
  const presence = gids.map(g => ({ group_id: g, members: currentOnline(g) }));
  socket.emit('ready', { me: socket.data.user, presence });
  gids.forEach(g => io.to('g' + g).emit('presence', { group_id: g, online: currentOnline(g) }));

  // typing
  socket.on('typing', ({ group_id }) => {
    if (!auth.memberOf.get(group_id, uid)) return;
    socket.to('g' + group_id).emit('typing', { group_id, user_id: uid, name: socket.data.user.name });
  });
  socket.on('stop_typing', ({ group_id }) => {
    socket.to('g' + group_id).emit('stop_typing', { group_id, user_id: uid });
  });

  // call signaling (WebRTC) — Phase 2
  socket.on('call', (payload) => {
    socket.to('g' + payload.group_id).emit('call', { from: socket.data.user, type: payload.type });
    // push incoming call to offline members
    const off = groupMemberIds.all(payload.group_id).map(x=>x.uid).filter(uid=>uid!==socket.data.uid && !online.has(uid));
    if(off.length) sendPush(off, '📞 '+socket.data.user.name, (payload.type==='video'?'Video':'Audio')+' call aa raha hai', '/');
  });
  socket.on('call_offer', (p) => { socket.to('g' + p.group_id).emit('call_offer', { from: socket.data.user, ...p }); });
  socket.on('call_answer', (p) => { socket.to('g' + p.group_id).emit('call_answer', { from: socket.data.user, ...p }); });
  socket.on('call_ice', (p) => { socket.to('g' + p.group_id).emit('call_ice', { from: socket.data.user, ...p }); });
  socket.on('call_hangup', (p) => { socket.to('g' + p.group_id).emit('call_hangup', { from: socket.data.user, ...p }); });

  socket.on('disconnect', () => {
    online.delete(uid);
    gids.forEach(g => io.to('g' + g).emit('presence', { group_id: g, online: currentOnline(g) }));
  });
});

function currentOnline(gid) {
  const ids = auth.groupMembers.all(gid).filter(m => online.has(m.id)).map(m => m.id);
  return ids;
}

// ---------- serve frontend ----------
app.use(express.static(PUBLIC_DIR));

server.listen(PORT, '0.0.0.0', () => console.log(`DGang server on :${PORT}`));