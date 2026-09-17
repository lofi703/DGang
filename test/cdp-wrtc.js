// Manually run the exact doCall logic on page A with step logging
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const PORT=9230;
async function main(){
  const list=await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page=list.find(t=>t.type==='page'&&/^https?:/.test(t.url))||list.find(t=>t.type==='page');
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0,pend=new Map(); const errs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
    else if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails?.exception?.description||'');
    else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errs.push('C:'+m.params.args.map(a=>a.value??'').join(' '));};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  await send('Page.enable');await send('Runtime.enable');
  const res=await ev(`(async()=>{
    const log=[];
    try{
      const s=await navigator.mediaDevices.getUserMedia({video:true,audio:true}); log.push('gum OK');
      const ice=[{urls:'stun:stun.l.google.com:19302'}];
      const x=new RTCPeerConnection({iceServers:ice}); log.push('pc created');
      s.getTracks().forEach(t=>x.addTrack(t,s)); log.push('tracks added');
      x.onicecandidate=e=>log.push('icecand '+(e.candidate?'yes':'end'));
      x.ontrack=e=>log.push('track!');
      const o=await x.createOffer(); log.push('offer created len='+JSON.stringify(o).length);
      await x.setLocalDescription(o); log.push('setLocal done sig='+x.signalingState+' localtype='+(x.localDescription&&x.localDescription.type));
      // trigger candidate gathering settle
      await new Promise(r=>setTimeout(r,2000));
      log.push('gath='+x.iceGatheringState+' conn='+x.iceConnectionState);
      return log.join('\\n');
    }catch(e){ log.push('EXC:'+e.message); return log.join('\\n'); }
  })()`);
  console.log(res);
  console.log('PAGE ERRS:', errs.length?JSON.stringify(errs):'none');
  process.exit(0);
}
main().catch(e=>{console.error('MAIN',e.message);process.exit(1);});