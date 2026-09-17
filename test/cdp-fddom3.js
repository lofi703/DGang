// Logged in now - check Domains page for bad.mn / msoo.com / what zones user owns
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const page=(await (await fetch('http://127.0.0.1:9222/json/list')).json())[0];
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  const go=async url=>{await send('Page.navigate',{url});await wait(2800);};
  await send('Page.enable'); await send('Runtime.enable');
  await go('https://freedns.afraid.org/domain/');
  console.log('URL:', await ev('location.href'), '| logged:', await ev('/logout/i.test(""+document.body.innerText)'));
  const txt=await ev('document.body.innerText||""');
  console.log('bad.mn:', /bad\.mn/i.test(txt), '| msoo.com:', /msoo\.com/i.test(txt));
  // domains table
  const doms=await ev(`(()=>{const out=[];[...document.querySelectorAll('a')].forEach(a=>{const t=(a.textContent||'').trim(),h=a.href;if(t&&h&&(h.includes('edit_domain_id')||/\.(mn|com|net|org)$/.test(t)))out.push({t,h});});return [...new Map(out.map(x=>[x.t,x])).values()];})()`);
  console.log('DOMAINS:', JSON.stringify(doms.slice(0,30),null,0));
  // body preview of middle section
  console.log('BODY:', txt.replace(/\s+/g,' ').slice(0,800));
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});