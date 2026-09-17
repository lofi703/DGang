// Login to freedns.afraid.org + check which domains are in the account
const WebSocket = global.WebSocket;
const EMAIL = process.env.FD_EMAIL, PASS = process.env.FD_PASS;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
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

  await go('https://freedns.afraid.org/');
  console.log('PAGE:', await ev('document.title'));
  await ev(`document.querySelector('input[name="email"]').value=${JSON.stringify(EMAIL)}`);
  await ev(`document.querySelector('input[name="password"]').value=${JSON.stringify(PASS)}`);
  const logged=await ev(`(()=>{const f=[...document.querySelectorAll('form')].find(f=>f.querySelector('input[name="email"]'));f.querySelector('input[type="submit"],button[type="submit"]').click();return 'submitted';})()`);
  console.log('LOGIN:', logged);
  await wait(3500);
  console.log('TITLE_AFTER:', await ev('document.title'), '| has sub menu:', await ev(`!!document.querySelector('a[href*="subdomain"]')`));

  // domains registry - is mooo.com addable?
  await go('https://freedns.afraid.org/domain/registry/');
  const hasMooo=await ev(`navigator` && `!!(document.body.innerText.match(/mooo\.com/i))`);
  console.log('REGISTRY has mooo.com:', hasMooo);
  const moooLink=await ev(`(()=>{const a=[...document.querySelectorAll('a')].find(a=>a.textContent.trim()==='mooo.com');return a?a.href:null})()`);
  console.log('mooo.com link:', moooLink);
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});