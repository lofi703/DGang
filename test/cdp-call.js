// Two-browser WebRTC call test: A creates group, B joins, A calls B, B accepts, verify connection.
const WebSocket = global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const A_PORT=9230, B_PORT=9231, BASE='https://dgang.mooo.com';

async function attach(port){
  const list=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page=list.find(t=>t.type==='page'&&/^https?:/.test(t.url)) || list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0,pend=new Map(); const errs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
    else if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails?.exception?.description||'');
    else if(m.method==='Runtime.consoleAPICalled'&&['error'].includes(m.params.type))errs.push('C:'+m.params.args.map(a=>a.value??'').join(' '));};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  const go=async url=>{await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url});await wait(4000);};
  return {ev,go,errs};
}
async function clearToken(c){
  await c.ev(`localStorage.removeItem('dg_tok')`);
}
async function login(c,name,pin){
  await c.go(BASE+'/');
  await c.ev(`localStorage.removeItem('dg_tok')`); await c.go(BASE+'/');
  await c.ev(`document.getElementById('aName').value=${JSON.stringify(name)}`);
  await c.ev(`document.getElementById('aPin').value=${JSON.stringify(pin)}`);
  await c.ev(`document.getElementById('aGo').click()`); await wait(3000);
  return await c.ev(`!document.getElementById('app').classList.contains('hidden')`);
}
async function createGroup(c,name){
  await c.ev(`document.getElementById('btnNewGroup').click()`); await wait(500);
  await c.ev(`document.getElementById('ngName').value=${JSON.stringify(name)}`);
  await c.ev(`document.getElementById('ngCreate').click()`); await wait(3000);
  // open group info to copy invite code
  const hasGrp=await c.ev(`document.querySelector('.grp-card')?1:0`);
  if(!hasGrp) return null;
  await c.ev(`document.querySelector('.grp-card').click()`); await wait(500);
  await c.ev(`document.getElementById('chInfo').click()`); await wait(500);
  const code=await c.ev(`document.querySelector('#copyCode').textContent.match(/[A-Z0-9]{6}/)[0]`);
  await c.ev(`document.getElementById('mClose').click()`); await wait(200);
  return code;
}
async function joinGroup(c,name,code){
  await c.ev(`document.getElementById('btnNewGroup').click()`); await wait(400);
  await c.ev(`document.getElementById('ngJoin').click()`); await wait(400);
  await c.ev(`document.getElementById('jgCode').value=${JSON.stringify(code)}`);
  await c.ev(`document.getElementById('jgGo').click()`); await wait(2500);
  await c.ev(`document.querySelector('.grp-card').click()`); await wait(500);
}
async function main(){
  const A=await attach(A_PORT), B=await attach(B_PORT);
  const a=await login(A,'CallerA','1111');
  const b=await login(B,'ReceiverB','2222');
  console.log('A logged in:',a,'| B logged in:',b);
  const code=await createGroup(A,'Call Test Group');
  console.log('INVITE CODE:', code);
  await joinGroup(B,'ReceiverB',code);
  console.log('B joined group. Group open on both.');
  await wait(500);
  // A initiates video call
  await A.ev(`document.getElementById('btnCallVideo').click()`); await wait(2500);
  console.log('A ringing...');
  // B should see ring -> accept
  const ringShown=await B.ev(`!document.getElementById('callScreen').classList.contains('hidden')`);
  console.log('B ring visible:', ringShown);
  if(ringShown){
    await B.ev(`document.getElementById('callAccept').click()`); await wait(4000);
  }
  // check connection states
  const aState=await A.ev(`pc?pc.connectionState:'no-pc'`);
  const bState=await B.ev(`pc?pc.connectionState:'no-pc'`);
  console.log('A pc state:', aState, '| B pc state:', bState);
  const aInfo=await A.ev(`document.getElementById('callInfo').textContent`);
  const bInfo=await B.ev(`document.getElementById('callInfo').textContent`);
  console.log('A info:', aInfo, '| B info:', bInfo);
  // remote video track?
  const aHasRemote=await A.ev(`!!document.getElementById('callRemote').srcObject`);
  const bHasRemote=await B.ev(`!!document.getElementById('callRemote').srcObject`);
  console.log('A remote video:', aHasRemote, '| B remote video:', bHasRemote);
  console.log('A ERRORS:', A.errs.length?JSON.stringify(A.errs):'none');
  console.log('B ERRORS:', B.errs.length?JSON.stringify(B.errs):'none');
  // hang up from A
  await A.ev(`document.getElementById('callEnd').click()`); await wait(1000);
  process.exit(0);
}
main().catch(e=>{console.error('MAIN ERR',e);process.exit(1);});