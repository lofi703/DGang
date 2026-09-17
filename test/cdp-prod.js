// Production E2E on dgang.mooo.com: login -> create group -> chat -> reels -> screenshot
const WebSocket=global.WebSocket, fs=require('fs'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
const CDP=9223, TARGET='https://dgang.mooo.com/';
async function main(){
  const page=(await (await fetch(`http://127.0.0.1:${CDP}/json/list`)).json())[0];
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0,pend=new Map(); const errs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
    else if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text);};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  // capture console errors too
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
    else if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text);
    else if(m.method==='Runtime.consoleAPICalled'&&['error','warning'].includes(m.params.type))errs.push('CONSOLE['+m.params.type+']:'+m.params.args.map(a=>a.value??a.description??'').join(' '));};
  await send('Page.navigate',{url:TARGET}); await wait(3500);
  console.log('TITLE:', await ev('document.title'), '| authVisible:', await ev(`!document.getElementById('auth').classList.contains('hidden')`));
  console.log('URL:', await ev('location.href'));
  // login
  await ev(`document.getElementById('aName').value='Nayan Pro'`);
  await ev(`document.getElementById('aPin').value='8918'`);
  await ev(`document.getElementById('aGo').click()`);
  await wait(3000);
  console.log('appVisible:', await ev(`!document.getElementById('app').classList.contains('hidden')`));
  // create group
  await ev(`document.getElementById('btnNewGroup').click()`); await wait(400);
  await ev(`document.getElementById('ngName').value='DGang Fun Group'`);
  await ev(`document.getElementById('ngCreate').click()`); await wait(3000);
  const hasGrp=await ev(`document.querySelector('.grp-card')?document.querySelector('.grp-name').textContent:'NONE'`);
  console.log('GROUP:', hasGrp);
  await ev(`document.querySelector('.grp-card').click()`); await wait(600);
  // chat
  await ev(`document.getElementById('chatInput').value='Aaj party kya bro 🎉'`);
  await ev(`document.getElementById('btnSend').click()`); await wait(2000);
  const msgs=await ev(`[...document.querySelectorAll('#chatMsg .bubble')].map(b=>b.textContent.trim())`);
  console.log('CHAT MSGS:', JSON.stringify(msgs));
  // go to reels tab
  await ev(`document.querySelector('.nav button[data-screen="reels"]').click()`); await wait(500);
  console.log('REELS screen shown:', await ev(`!document.getElementById('screen-reels').classList.contains('hidden')`));
  await ev(`document.querySelector('.nav button[data-screen="yt"]').click()`); await wait(400);
  console.log('YT screen shown:', await ev(`!document.getElementById('screen-yt').classList.contains('hidden')`));
  // screenshot
  await ev(`document.querySelector('.nav button[data-screen="chat"]').click()`); await wait(400);
  const shot=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('/tmp/dgang_prod.png',Buffer.from(shot.result.data,'base64'));
  console.log('ERR LOGS:', errs.length?JSON.stringify(errs,null,2):'none');
  ws.close();
}
main().catch(e=>{console.error('ERR',e);process.exit(1);});