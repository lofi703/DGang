// Detailed call debug: dump full pc state on both sides after connection attempt
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const A_PORT=9230,B_PORT=9231,BASE='https://dgang.mooo.com';
async function attach(port){
  const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
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
  const go=async url=>{await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url});await wait(4000);};
  return {ev,go,errs};
}
async function login(c,n,p){ await c.go(BASE+'/'); await c.ev(`localStorage.removeItem('dg_tok')`); await c.go(BASE+'/');
  await c.ev(`document.getElementById('aName').value=${JSON.stringify(n)}`); await c.ev(`document.getElementById('aPin').value=${JSON.stringify(p)}`);
  await c.ev(`document.getElementById('aGo').click()`); await wait(3000); }
async function main(){
  const A=await attach(A_PORT),B=await attach(B_PORT);
  await login(A,'CallerX','1111'); await login(B,'RecvY','2222');
  // A create group
  await A.ev(`document.getElementById('btnNewGroup').click()`); await wait(400);
  await A.ev(`document.getElementById('ngName').value='CallTest'`); await A.ev(`document.getElementById('ngCreate').click()`); await wait(3000);
  await A.ev(`document.querySelector('.grp-card').click()`); await wait(400);
  await A.ev(`document.getElementById('chInfo').click()`); await wait(400);
  const code=await A.ev(`document.querySelector('#copyCode').textContent.match(/[A-Z0-9]{6}/)[0]`);
  await A.ev(`document.getElementById('mClose').click()`);
  // B join
  await B.ev(`document.getElementById('btnNewGroup').click()`); await wait(400);
  await B.ev(`document.getElementById('ngJoin').click()`); await wait(400);
  await B.ev(`document.getElementById('jgCode').value=${JSON.stringify(code)}`); await B.ev(`document.getElementById('jgGo').click()`); await wait(2500);
  await B.ev(`document.querySelector('.grp-card').click()`); await wait(400);
  console.log('INVITE:',code,'| both in group');
  // call
  await A.ev(`document.getElementById('btnCallVideo').click()`); wait(1500);
  await B.ev(`document.getElementById('callAccept').click()`); 
  await wait(6000);
  const dump=c=>c.ev(`(()=>{if(!pc)return 'no-pc';return JSON.stringify({sig:pc.signalingState,ice:pc.iceConnectionState,gath:pc.iceGatheringState,local:pc.localDescription&&pc.localDescription.type,remote:pc.remoteDescription&&pc.remoteDescription.type,info:document.getElementById('callInfo').textContent,act:callActive,pendingOffer:!!pendingOffer,isCaller})})()`);
  console.log('A STATE:', await dump(A));
  console.log('B STATE:', await dump(B));
  // log accumulated sdp lengths / candidate counts via ice candidates emitted
  console.log('A ERR:', A.errs.length?JSON.stringify(A.errs):'none');
  console.log('B ERR:', B.errs.length?JSON.stringify(B.errs):'none');
  await A.ev(`document.getElementById('callEnd')?document.getElementById('callEnd').click():null`);
  process.exit(0);
}
main().catch(e=>{console.error('MAIN',e);process.exit(1);});