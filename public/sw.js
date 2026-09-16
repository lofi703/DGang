// DGang service worker — NEVER cache html/js/css so bug-fixes reach users
// Only cache icons + manifest (static shell). App logic always fetches fresh.
const C='dgang-v1';
const CORE=['./','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(CORE).catch(()=>{})));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  // Never serve stale app logic or API/socket/media from cache
  if(e.request.method!=='GET')return;
  if(url.pathname.startsWith('/api')||url.pathname.startsWith('/media')||url.pathname.startsWith('/socket.io'))return;
  if(/\.(html?|js|css)$/i.test(url.pathname)||url.pathname==='/'||url.pathname.endsWith('/'))return; // always network
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));return res;}).catch(()=>caches.match('icons/icon-192.png'))));
});