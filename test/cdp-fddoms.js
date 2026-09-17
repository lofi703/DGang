// After login: check 'Domains' page - does this account control bad.mn? 
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
  const go=async url=>{await send('Page.navigate',{url});await wait(2500);};
  await send('Page.enable'); await send('Runtime.enable');

  // Domains page
  await go('https://freedns.afraid.org/domains/');
  const txt=await ev('(document.body.innerText||"")');
  console.log('DOMAINS_PAGE_HAS_bad.mn:', /bad\.mn/i.test(txt), '| msoo:', /msoo\.com/i.test(txt));
  // list domain names with edit links
  const domains=await ev(`([...document.querySelectorAll('a')].map(a=>({t:(a.textContent||'').trim(),h:a.href})).filter(x=>x.t&&x.h.includes('edit_domain')))`);
  console.log('DOMAIN LINKS:', JSON.stringify(domains.slice(0,20)));
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});