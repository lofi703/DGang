# DGang — Tumhare group ka apna social app 🎉

Private, self-hosted group social app for you & your friends (max 20 per group).

- 💬 Realtime group chat + emoji reactions + typing/presence
- 🖼️ Photo share · 🎬 Prank MP4 video share
- 🎭 Truth or Dare game + Tic-Tac-Toe (in-app)
- 🎞️ "Recs" — apna khud ka vertical short-video feed
- ▶️ YouTube section (app ke andar play)
- 🔒 PIN auth + JWT + invite-code group entry

Self-hosted on Oracle Cloud free tier. 100% open source (MIT).

## Repo structure
```
server/    Node.js + Express + Socket.IO + SQLite backend
public/    PWA frontend (dark-glass UI)
build/     APK build scripts + icon generator
deploy/    systemd unit + nginx vhost + finalize script
test/      local test harness (DOM-shim + CDP driver)
data/      sqlite db (gitignored)
media/     uploads (gitignored)
```

## Run locally
```bash
cd server && npm install && npm start   # -> http://localhost:3000
```

## Production (dgang.bad.mn)
See [deploy/README](deploy/README) for DNS → certbot → systemd steps.

## License
[MIT](LICENSE) — Nayan Mondal