// Check socket.io availability + global error trap
const WebSocket = global.WebSocket;
async function main(){
  const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  const page = list.find(t=>t.type==='page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0; const pend=new Map(); const logs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
    else if(m.method==='Runtime.exceptionThrown')logs.push('EXC: '+(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text));
    else if(m.method==='Runtime.consoleAPICalled')logs.push('CONSOLE['+m.params.type+']: '+m.params.args.map(a=>a.value??a.description??'').join(' '));};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  await send('Runtime.enable');
  // install global trap
  await send('Runtime.evaluate',{expression:`window.__errs=[];window.addEventListener('error',e=>window.__errs.push(String(e.message)+' @ '+(e.filename||'')+':'+e.lineno));window.addEventListener('unhandledrejection',e=>window.__errs.push('PROMISE: '+String(e.reason)));`});
  // reload clean
  await send('Page.navigate',{url:'http://127.0.0.1:3999/'}); await new Promise(r=>setTimeout(r,2000));
  const ioType=await send('Runtime.evaluate',{expression:"typeof window.io",returnByValue:true}).then(r=>r.result.result.value);
  const fetchOK=await send('Runtime.evaluate',{expression:"fetch('/api/health').then(r=>r.ok).catch(e=>'FETCHERR:'+e.message)",awaitPromise:true,returnByValue:true}).then(r=>r.result.result.value).then(v=>v);
  console.log('io type:', ioType);
  // login
  await send('Runtime.evaluate',{expression:`document.getElementById('aName').value='Sonu Test';document.getElementById('aPin').value='8918';document.getElementById('aGo').click();`});
  await new Promise(r=>setTimeout(r,3000));
  const errs=await send('Runtime.evaluate',{expression:"window.__errs",returnByValue:true}).then(r=>r.result.result.value);
  const appShown=await send('Runtime.evaluate',{expression:"!document.getElementById('app').classList.contains('hidden')",returnByValue:true}).then(r=>r.result.result.value);
  console.log('appShown:', appShown);
  console.log('captured errors:', JSON.stringify(errs,null,2));
  const sock=await send('Runtime.evaluate',{expression:"SOCK ? (SOCK.connected?'connected':'connecting') : 'no-sock'",returnByValue:true}).then(r=>r.result.result.value);
  console.log('socket:', sock);
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});