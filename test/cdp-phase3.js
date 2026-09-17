// Phase3 smoke: login, check SW ready, push setup, profile notif button, reels polish render
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PORT=9240,BASE='https://dgang.mooo.com';
async function main(){
  for(let i=0;i<8;i++){ try{ await fetch(`http://127.0.0.1:${PORT}/json/version`); break; }catch(e){ await wait(3000); } }
  const list=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page=list.find(t=>t.type==='page'&&/^https?:/.test(t.url))||list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0,pend=new Map(); const errs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
    else if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails?.exception?.description||'');
    else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push('C:'+m.params.args.map(a=>a.value??'').join(' '));};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url:BASE+'/'}); await wait(4000);
  await ev(`localStorage.removeItem('dg_tok')`); await send('Page.navigate',{url:BASE+'/'}); await wait(4000);
  await ev(`document.getElementById('aName').value='Phase3Test'`);
  await ev(`document.getElementById('aPin').value='8989'`);
  await ev(`document.getElementById('aGo').click()`); await wait(3000);
  console.log('logged in:', await ev(`!document.getElementById('app').classList.contains('hidden')`));
  await wait(2000);
  console.log('SW ready:', await ev(`(async()=>{try{await navigator.serviceWorker.ready;return true}catch(e){return false}})()`));
  console.log('SW registered:', await ev(`(async()=>{const r=await navigator.serviceWorker.getRegistration();return r?!!r.active:'none'})()`));
  // check profile notif button exists
  await ev(`document.querySelector('.nav button[data-screen="profile"]').click()`); await wait(400);
  console.log('Notif button:', await ev(`document.getElementById('btnNotifPrompt')?document.getElementById('btnNotifPrompt').textContent:'MISSING'`));
  console.log('Notification API:', await ev(`'Notification' in window ? Notification.permission : 'NO_API'`));
  // reels render function check
  console.log('reel-mute fn defined:', await ev(`typeof renderReels==='function' && document.querySelector('.reel-like-big')===null`));
  console.log('vapid fetch:', await ev(`fetch('/api/push/vapidkey').then(r=>r.status)`));
  console.log('ERRS:', errs.length?JSON.stringify(errs):'none');
  process.exit(0);
}
main().catch(e=>{console.error('MAIN',e.message);process.exit(1);});