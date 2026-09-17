// Diagnose login failure - capture full body + screenshot after submit
const WebSocket=global.WebSocket, fs=require('fs'); const wait=ms=>new Promise(r=>setTimeout(r,ms));
const EMAIL=process.env.FD_EMAIL, PASS=process.env.FD_PASS;
async function main(){
  const page=(await (await fetch('http://127.0.0.1:9222/json/list')).json())[0];
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  await send('Page.enable'); await send('Runtime.enable');
  // fresh start at home
  await send('Page.navigate',{url:'https://freedns.afraid.org/'}); await wait(3000);
  console.log('URL:', await ev('location.href'));
  // is there a login form?
  const hasLogin=await ev(`!!document.querySelector('input[name="email"]')`);
  console.log('login form present:', hasLogin);
  if(hasLogin){
    await ev(`document.querySelector('input[name="email"]').value=${JSON.stringify(EMAIL)}`);
    await ev(`document.querySelector('input[name="password"]').value=${JSON.stringify(PASS)}`);
    // screenshot BEFORE submit
    let s=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('/tmp/fd_before.png',Buffer.from(s.result.data,'base64'));
    await ev(`document.querySelector('form').submit()`); await wait(4000);
  }
  console.log('URL after:', await ev('location.href'));
  const body=await ev('document.body.innerText||""');
  console.log('=== body (logged in?):', /logout/i.test(body)?'LOGGED_IN':'NOT_LOGGED');
  console.log(body.replace(/\s+/g,' ').slice(0,500));
  let s2=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('/tmp/fd_after.png',Buffer.from(s2.result.data,'base64'));
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});