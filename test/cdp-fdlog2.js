// Login then IMMEDIATELY check /domain/ in same session
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const EMAIL=process.env.FD_EMAIL, PASS=process.env.FD_PASS;
async function main(){
  const list=await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const page=list[0];
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  const go=async url=>{await send('Page.navigate',{url});await wait(3000);};
  await send('Page.enable'); await send('Runtime.enable');
  await wait(1500);
  console.log('START URL:', await ev('location.href'));
  // login form only if present
  if(await ev(`!!document.querySelector('input[name="email"]')`)){
    await ev(`document.querySelector('input[name="email"]').value=${JSON.stringify(EMAIL)}`);
    await ev(`document.querySelector('input[name="password"]').value=${JSON.stringify(PASS)}`);
    await ev(`([...document.querySelectorAll('form')].find(f=>f.querySelector('input[name="email"]'))).submit()`);
    await wait(3500);
  }
  console.log('AFTER LOGIN URL:', await ev('location.href'), '| title:', await ev('document.title'));
  console.log('logged menu:', await ev(`!!document.querySelector('a[href*="subdomain"]')`));
  // go to domains
  await ev(`location.href='https://freedns.afraid.org/domain/'`); await wait(3000);
  console.log('DOMAIN URL:', await ev('location.href'));
  const txt=await ev('document.body.innerText||""');
  console.log('bad.mn:', /bad\.mn/i.test(txt), '| msoo:', /msoo\.com/i.test(txt));
  console.log('body head:', txt.replace(/\s+/g,' ').slice(0,400));
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});