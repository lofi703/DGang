// Check the real Domains page (=/domain/) for bad.mn and msoo.com
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
  await go('https://freedns.afraid.org/domain/');
  const txt=await ev('document.body.innerText||""');
  console.log('URL:', await ev('location.href'));
  // domain table rows: name + edit links
  const rows=await ev(`(()=>{const out=[];[...document.querySelectorAll('a')].forEach(a=>{const t=(a.textContent||'').trim();const h=a.href;if(t&&h&&(h.includes('edit_domain')||h.includes('subdomain')))out.push({t,h});});return out;})()`);
  console.log('bad.mn present:', /bad\.mn/i.test(txt), '| msoo present:', /msoo\.com/i.test(txt));
  console.log('EDITS:', JSON.stringify(rows.slice(0,25)));
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});