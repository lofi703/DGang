# DGang — Group Social App (Open Source) · Full Plan

_A "rooms mit bolte hain" private social app for you & your friend group (max 20)._
Name: **DGang**. Targets: Android APK (WebView-wrapped PWA) + installable Web App.
Self-hosted on your Oracle Cloud free tier VPS at **https://dgang.bad.mn**.

---

## 1. Vision (ek line mein)
Ek private, invite-only social app jahan tumhara friend group chat kare, photos/MP4 share kare,
video/audio call kare, game khele, aur apne hi reels + YouTube content app ke andar dekhe.
**Sab tumhare apne server pe — koi 3rd party, koi costing, poora open source.**

---

## 2. IMPORTANT kya POSSIBLE hai aur kya NAHI (pehle ye padho)

| Feature | Realistic? | Note |
|---|---|---|
| Group chat + emojis + reactions | ✅ | Socket.io realtime |
| Photo / bill / document share | ✅ | Upload → VPS storage → CDN-ish URL |
| Prank MP4 video share | ✅ | Upload, playback in-app |
| Video / audio call | ⚠️ | WebRTC; needs TURN server + open UDP ports |
| Game (multiplayer) | ✅ | WebSocket-based, e.g. TicTacToe/Quiz/Snake duel |
| YouTube section in-app | ✅ | Embedded WebView/iframe tab |
| **Instagram reels in-app** | ❌ | **Blocked by policy**. Instagram API/3rd-party embed wale ka ni. Use **apna reels** instead |
| Apna reels section | ✅ | Users upload short MP4 clips → vertical feed |

> **Reels decision:** Instagram ko link karna **technically/galat** hai. Banayenge **khud ka vertical short-video feed** ("Recs") jahan group members clips daalte hain. Same vibe, full control, 100% legal.

---

## 3. High-level Architecture

```
┌─────────────────────────────────────────────┐
│  BROWSER / ANDROID APK (WebView)            │
│  PWA  (index.html + app.js + sw.js)         │
│  • Chat UI  • Reels  • YouTube tab          │
│  • Game     • Profile                       │
└───────────────┬─────────────────────────────┘
                │ HTTPS (wss://)
┌───────────────▼─────────────────────────────┐
│  BACKEND  — Node.js (Express + Socket.io)   │
│  192.168.1.148 / nynmondal.bad.mn  (:443)   │
│  • Auth (JWT)   • Rooms/Groups              │
│  • Messages (DB) • Uploads                  │
│  • Call signaling (WebRTC)                  │
│  • Game state                               │
└───────────────┬─────────────────────────────┘
                │
    ┌───────────┼───────────────┐
┌───▼───┐  ┌────▼────┐   ┌─────▼─────┐
│ SQLite│  │  FILE   │   │  TURN     │
│ (msgs │  │ UPLOAD │   │ server    │
│ users)│  │ /media │   │ (coturn)  │
└───────┘  └─────────┘   └───────────┘
```

**Frontend:** Pure HTML/CSS/JS (RoomSplit style — dark-blue glass `#061126`, gradient avatars) → same `/roomsplit/` design language so you know it.
**APK:** Same `build_*.apk.sh` WebView wrapper (aapt2 + d8, no Gradle) — proven pipeline.

---

## 4. Tech Stack (all free / self-hosted)

- **Server:** Node.js ≥18 + Express (4.23) + Socket.IO (4.x)
- **DB:** SQLite (via `better-sqlite3`) — simple, no install pain, file-based
- **Realtime:** Socket.IO (websocket, wss behind nginx TLS)
- **Auth:** JWT (jsonwebtoken) + PIN + invite code
- **Uploads:** multer → `/var/www/bolo/media/` → served via nginx
- **Media serving:** nginx static + `X-Accel-Redirect` for protected files
- **Calling:** PeerJS / simple WebRTC peer with Socket.IO signaling + **coturn** (TURN/STUN)
- **Reels:** upload short MP4 + poster.jpg → vertical `<video>` feed
- **YouTube:** iframe embed of watch URLs (`youtube-nocookie.com`)
- **Process manager:** systemd (`bolo.service`) — same as `chandni.service` pattern
- **TLS:** Let's Encrypt certbot (already working on nynmondal.bad.mn)

---

## 5. Data Model (SQLite)

```
users        id, name, emoji, c1, c2, pin_hash, created_at
groups       id, name, invite_code, created_by, pass_phrase
group_members user_id, group_id, role(admin/member), joined_at
messages     id, group_id, user_id, type(text/photo/video/doc/reel), body, media_url, ts
reactions    message_id, user_id, emoji
reels        id, user_id, video_url, poster_url, caption, ts, likes
reel_likes   reel_id, user_id
calls        id, group_id, type(audio/video), started_by, status, ts
game_sessions id, group_id, game, state(JSON), players(JSON), ts
```

---

## 6. Features by Phase (build order)

### PHASE 1 — Core chat (v1.0)
- [ ] User create/join with **PIN** (like RoomSplit lock)
- [ ] **Group** banaye + **invite code** share (6-digit)
- [ ] Realtime **group chat**: text + emojis
- [ ] Message **reactions** (❤️😂👍) on tap
- [ ] **Photo share** (upload → VPS)
- [ ] **MP4 prank video share** + in-app player
- [ ] Typing indicator • online presence • last-seen
- [ ] Chat history (infinite scroll) • unread badges

### PHASE 2 — Calls (v1.5)
- [ ] **Audio call** group (WebRTC)
- [ ] **Video call** peer-to-peer
- [ ] TURN server setup (coturn on Oracle) for NAT-safe calls
- [ ] Ringtone UI, mute/hangup, on-screen video tiles

### PHASE 3 — Media & reels (v2.0)
- [ ] **"Recs" reel section**: upload ≤15s vertical MP4 + caption
- [ ] Vertical swipe feed (like reels)
- [ ] Like ❤️, comment on reels
- [ ] **YouTube tab**: paste/select video → app ke andar play

### PHASE 4 — Game + Polish (v2.5)
- [ ] **Multiplayer game** (WebSocket) — TIC-TAC-TOE duel / Word-Quiz / Truth-or-Dare
- [ ] Scoreboard per group
- [ ] Push/notifications polish, dark theme toggle
- [ ] Final APK + PWA polish

---

## 7. Folder Layout (proposed)

```
/home/ubuntu/bolo/
├── server/               # Node backend
│   ├── index.js          # express + socket.io entry
│   ├── db.js             # sqlite init + helpers
│   ├── auth.js           # JWT + PIN
│   ├── routes/
│   │   ├── auth.js
│   │   ├── group.js
│   │   ├── message.js
│   │   ├── media.js      # uploads
│   │   ├── reel.js
│   │   └── call.js
│   ├── socket/           # realtime handlers
│   │   ├── chat.js
│   │   ├── presence.js
│   │   ├── call.js
│   │   └── game.js
│   └── package.json
├── public/               # frontend PWA (served static)
│   ├── index.html
│   ├── app.js
│   ├── style.css
│   ├── sw.js
│   ├── manifest.json
│   └── icons/
├── media/                # uploaded photos/videos/reels (gitignored)
├── data/                 # sqlite file (gitignored)
├── deploy/
│   ├── bolo.service      # systemd unit
│   └── nginx.conf        # vhost for /bolo/
└── build/
    └── build_bolo_apk.sh # WebView APK build (RoomSplit pipeline)
```

---

## 8. Deployment (nynmondal.bad.mn)

- Sub-path or subdomain: **`https://nynmondal.bad.mn/bolo/`**
- nginx reverse proxy → Node `localhost:PORT` (e.g. 3000)
- WebSocket upgrade header forward
- Socket.IO over same TLS (wss)
- `/media/` served with auth or secret-token URL
- APK WebView points to `https://nynmondal.bad.mn/bolo/`
- SSL: existing Let's Encrypt wildcard/cert auto-renews

---

## 9. Security / Privacy

- PIN-auth (hashed) → JWT per session
- Group invite code = entry gate
- Media URLs signed + `X-Accel-Redirect` (no public dump)
- Rate-limit uploads & socket connections
- SQLite prepared statements (no injection)
- Reels/content only visible to members of that group
- No tracking / no ads / open source

---

## 10. Open Source

- License: **MIT**
- Repo on GitHub (**public — "open source"**): `nayanmondal/bolo`
- Full code: server + frontend + build scripts + docs
- `.gitignore`: `node_modules/` `media/` `data/` `*.keystore` `*.apk`
- README with self-host instructions
- Contribution friendly

---

## 11. Your input needed (decision points)

1. **App name** — **DGang** ✅
2. **Host path** — **subdomain `dgang.bad.mn`** ✅
3. **APK vs PWA pehle** — dono same hain (WebView wraps PWA), pehle web pe online, phir APK. ✅
4. **Game kaunsa pehle** — **Truth or Dare** (primary) + **Tic-Tac-Toe duel** (bonus) ✅
5. **Max group members** — **20** ✅

---

## 12. Next Action (recommended)
**→ Phase 1 core chat skeleton** (server + DB + auth + group chat + photo + MP4 share) build karna shuru karein, realtime group mein test karein, phir APK. Ye kabhi-thoda sa poora realtime app ban jaye — baaki phases add karte jayenge.

---
_Planned for: Deep Facke · Nayan Mondal · hosted on Oracle Cloud free tier_