// Test if getUserMedia works in this headless chromium
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PORT=9230;
async function main(){
  const list=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page=list.find(t=>t.type==='page'&&/^https?:/.test(t.url))||list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0,pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  await send('Page.enable');await send('Runtime.enable');
  console.log('mediaDevices exists:', await ev(`!!navigator.mediaDevices&&'getUserMedia' in navigator.mediaDevices`));
  const res=await ev(`new Promise(r=>{const t=setTimeout(()=>r('TIMEOUT_10s'),10000);navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(s=>{clearTimeout(t);const v=s.getVideoTracks().length,a=s.getAudioTracks().length;const cvt=document.createElement('canvas');clearTimeout(t);r('OK video='+v+' audio='+a+' device='+(s.getVideoTracks()[0]&&s.getVideoTracks()[0].label))}).catch(e=>{clearTimeout(t);r('ERR:'+e.message)})})`);
  console.log('GETUSERMEDIA:', res);
  process.exit(0);
}
main().catch(e=>{console.error('MAIN',e.message);process.exit(1);});