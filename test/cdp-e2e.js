// Full E2E: login → create group → send msg → screenshot
const WebSocket = global.WebSocket, fs=require('fs');
async function main(){
  const list=await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const page=list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pend=new Map();const logs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
    else if(m.method==='Runtime.exceptionThrown')logs.push('EXC: '+(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text));};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  await send('Page.enable');await send('Runtime.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:3999/'});await new Promise(r=>setTimeout(r,2000));
  const ev=r=>send('Runtime.evaluate',{expression:r,awaitPromise:true,returnByValue:true}).then(x=>x.result.result.value);
  // login fresh user
  await ev(`document.getElementById('aName').value='Vijay Test';document.getElementById('aPin').value='1234';document.getElementById('aGo').click()`);
  await new Promise(r=>setTimeout(r,2500));
  // create group
  await ev(`document.getElementById('btnNewGroup').click()`);
  await new Promise(r=>setTimeout(r,400));
  await ev(`document.getElementById('ngName').value='DGang Fun Group'`);
  await ev(`document.getElementById('ngCreate').click()`);
  await new Promise(r=>setTimeout(r,2500));
  const hasGrp=await ev(`document.querySelector('.grp-card')?document.querySelector('.grp-name').textContent:'NONE'`);
  console.log('GROUP_CREATED:', hasGrp);
  // open group
  await ev(`document.querySelector('.grp-card').click()`);
  await new Promise(r=>setTimeout(r,500));
  // send message
  await ev(`document.getElementById('chatInput').value='Aaj party kya bro 🎉';document.getElementById('btnSend').click()`);
  await new Promise(r=>setTimeout(r,1800));
  const msgs=await ev(`[...document.querySelectorAll('#chatMsg .bubble')].map(b=>b.textContent.trim())`);
  console.log('MESSAGES:', JSON.stringify(msgs));
  // this group minus token state: capture screenshot of chat
  await new Promise(r=>setTimeout(r,500));
  const shot=await send('Page.captureScreenshot',{format:'png'}).then(r=>r.result.data);
  fs.writeFileSync('/tmp/dgang_chat.png',Buffer.from(shot,'base64'));
  console.log('LOGS:', logs.length?logs:'none');
  ws.close();
}
main().catch(e=>{console.error('ERR',e);process.exit(1);});