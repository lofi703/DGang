// Dump current state of whatever page we're on
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const list=await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const page=list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  const go=async url=>{await send('Page.navigate',{url});await wait(2800);};
  await send('Page.enable'); await send('Runtime.enable');
  console.log('URL now:', await ev('location.href'));
  // go to main menu
  await go('https://freedns.afraid.org/'); 
  console.log('URL:', await ev('location.href'), '| title:', await ev('document.title'));
  // main menu links
  const links=await ev(`([...document.querySelectorAll('a')]).map(a=>({t:(a.textContent||'').trim(),h:a.href})).filter(x=>x.t&&(/domain/i.test(x.t)||/subdomain/i.test(x.t)))`);
  console.log('MENU LINKS:', JSON.stringify(links));
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});