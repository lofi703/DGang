// DGang service worker — NEVER cache html/js/css so bug-fixes reach users
// Only cache icons + manifest (static shell). App logic always fetches fresh.
const C='dgang-v2';
const CORE=['./','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(CORE).catch(()=>{})));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('push', e => {
  let data = { title: 'DGang', body: '', url: '/' };
  try{ if(e.data) data = Object.assign(data, e.data.json()); }catch(_){}
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: data.url } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(cls => {
    for(const c of cls){ if('focus' in c){ c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  // Never serve stale app logic or API/socket/media from cache
  if(e.request.method!=='GET')return;
  if(url.pathname.startsWith('/api')||url.pathname.startsWith('/media')||url.pathname.startsWith('/socket.io'))return;
  if(/\.(html?|js|css)$/i.test(url.pathname)||url.pathname==='/'||url.pathname.endsWith('/'))return; // always network
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cp=res.clone();caches.open(C).then(c=>c.put(e.request,cp));return res;}).catch(()=>caches.match('icons/icon-192.png'))));
});