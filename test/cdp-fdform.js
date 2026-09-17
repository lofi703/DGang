// Extract the exact login form action + fields from the page DOM
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  const page=(await (await fetch('http://127.0.0.1:9222/json/list')).json())[0];
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate',{url:'https://freedns.afraid.org/'}); await wait(2500);
  const form=await ev(`(()=>{const f=[...document.querySelectorAll('form')].find(x=>x.querySelector('input[name="email"]'));if(!f)return 'none';return JSON.stringify({action:f.action||f.getAttribute('action'),method:(f.getAttribute('method')||'get'),inputs:[...f.querySelectorAll('input')].map(i=>({name:i.name,type:i.type,value:i.value}))});})()`);
  console.log('LOGIN FORM:', form);
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});