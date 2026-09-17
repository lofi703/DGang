// Check what app.js browser actually loaded + force fresh by cache-bust reload
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PORT=9230;
async function main(){
  const list=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page=list.find(t=>t.type==='page'&&/^https?:/.test(t.url))||list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0,pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Page.navigate',{url:'https://dgang.mooo.com/'}); await wait(4000);
  // is new code loaded? check for our new onOffer marker 'have-remote-offer'
  console.log('NEW_CODE_LOADED:', await ev(`!!(window.getIceServers?.toString&&getIceServers.toString().includes('turn:140.245.252.78'))`));
  console.log('has onOffer apply:', await ev(`typeof onOffer`));
  // check service worker registrations
  console.log('SW:', await ev(`navigator.serviceWorker.getRegistrations().then(rs=>rs.map(r=>r.active&&r.active.scriptURL)).catch(()=>[])`));
  // force caches.clear + skip waiting
  await ev(`caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k))))`);
  await ev(`navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister()))`).catch(()=>{});
  process.exit(0);
}
main().catch(e=>{console.error('MAIN',e.message);process.exit(1);});