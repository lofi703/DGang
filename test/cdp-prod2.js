// Pick the right page tab (http) and run E2E
const WebSocket=global.WebSocket, fs=require('fs'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
const CDP=9223;
async function main(){
  const list=await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json();
  // find a page-type target with http url
  const page=list.find(t=>t.type==='page'&&/^https?:/.test(t.url)) || list.find(t=>t.type==='page');
  console.log('TARGET TAB:', page.url.slice(0,70));
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0,pend=new Map(); const errs=[];
  const handler=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
    else if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text);
    else if(m.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(m.params.type))errs.push('CONSOLE['+m.params.type+']:'+m.params.args.map(a=>a.value??a.description??'').join(' '));};
  ws.onmessage=handler;
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate',{url:'https://dgang.mooo.com/'}); await wait(4500);
  console.log('TITLE:', await ev('document.title'));
  console.log('authVisible:', await ev(`!document.getElementById('auth').classList.contains('hidden')`));
  // if already logged in, logout state
  await ev(`document.getElementById('aName').value='Nayan Pro'`);
  await ev(`document.getElementById('aPin').value='8918'`);
  await ev(`localStorage.removeItem('dg_tok')`); // fresh
  await send('Page.navigate',{url:'https://dgang.mooo.com/'}); await wait(3500);
  await ev(`document.getElementById('aName').value='Nayan Pro'`);
  await ev(`document.getElementById('aPin').value='8918'`);
  await ev(`document.getElementById('aGo').click()`); await wait(3000);
  console.log('appVisible:', await ev(`!document.getElementById('app').classList.contains('hidden')`));
  await ev(`document.getElementById('btnNewGroup').click()`); await wait(400);
  await ev(`document.getElementById('ngName').value='DGang Fun Group'`);
  await ev(`document.getElementById('ngCreate').click()`); await wait(3500);
  console.log('GROUP:', await ev(`document.querySelector('.grp-card')?document.querySelector('.grp-name').textContent:'NONE'`));
  await ev(`document.querySelector('.grp-card').click()`); await wait(600);
  await ev(`document.getElementById('chatInput').value='Aaj party kya bro 🎉'`);
  await ev(`document.getElementById('btnSend').click()`); await wait(2000);
  console.log('CHAT:', JSON.stringify(await ev(`[...document.querySelectorAll('#chatMsg .bubble')].map(b=>b.textContent.trim())`)));
  await ev(`document.querySelector('.nav button[data-screen="reels"]').click()`); await wait(300);
  await ev(`document.querySelector('.nav button[data-screen="game"]').click()`); await wait(300);
  const gameShown=await ev(`!document.getElementById('screen-game').classList.contains('hidden')`);
  console.log('GAME screen shown:', gameShown);
  // spin TOT
  await ev(`document.getElementById('totSpin')?document.getElementById('totSpin').click():null`); await wait(400);
  console.log('TOT:', await ev(`document.getElementById('totScale')?document.getElementById('totScale').textContent:'none'`));
  await ev(`document.querySelector('.nav button[data-screen="chat"]').click()`); await wait(300);
  const shot=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('/tmp/dgang_prod.png',Buffer.from(shot.result.data,'base64'));
  console.log('ERR LOGS:', errs.length?JSON.stringify(errs,null,2):'none');
  ws.close(); process.exit(0);
}
main().catch(e=>{console.error('ERR',e);process.exit(1);});