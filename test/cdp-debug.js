// Full-log CDP driver: capture every console msg + exception + network
const WebSocket = global.WebSocket, fs = require('fs');
const CDP_PORT = 9222, TARGET = 'http://127.0.0.1:3999/';
async function main(){
  const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
  const page = list.find(t=>t.type==='page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0; const pend=new Map(); const logs=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}
    else if(m.method==='Runtime.consoleAPICalled'){logs.push('CONSOLE['+m.params.type+']: '+m.params.args.map(a=>a.value??a.description??'').join(' '));}
    else if(m.method==='Runtime.exceptionThrown'){logs.push('EXC: '+(m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text));}
    else if(m.method==='Network.loadingFailed'){logs.push('NETFAIL: '+(m.params.errorText||'')+' url='+(m.params.requestId));}};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Page.navigate',{url:TARGET}); await new Promise(r=>setTimeout(r,2500));
  const [g1,t1]=await Promise.all([
    send('Runtime.evaluate',{expression:"document.getElementById('screen-groups').innerHTML",returnByValue:true}),
    send('Runtime.evaluate',{expression:"document.getElementById('toast').textContent",returnByValue:true})]);
  console.log('EARLY_GROUPS_HTML:', g1.result.result.value.slice(0,120).replace(/\n/g,' '));
  console.log('EARLY_TOAST:', JSON.stringify(t1.result.result.value));
  // login
  await send('Runtime.evaluate',{expression:`document.getElementById('aName').value='Sonu Test';document.getElementById('aPin').value='8918';document.getElementById('aGo').click();`});
  await new Promise(r=>setTimeout(r,3000));
  const g2=await send('Runtime.evaluate',{expression:"document.getElementById('screen-groups').innerHTML",returnByValue:true}).then(r=>r.result.result.value);
  const t2=await send('Runtime.evaluate',{expression:"document.getElementById('toast').textContent",returnByValue:true}).then(r=>r.result.result.value);
  const loc=await send('Runtime.evaluate',{expression:"document.location.href + ' | tok=' + !!localStorage.getItem('dg_tok')",returnByValue:true}).then(r=>r.result.result.value);
  console.log('AFTER_GROUPS_HTML:', g2.slice(0,200).replace(/\n/g,' '));
  console.log('AFTER_TOAST:', JSON.stringify(t2));
  console.log('LOC:', loc);
  console.log('BODY_HIDDEN:', await send('Runtime.evaluate',{expression:"document.getElementById('app').className",returnByValue:true}).then(r=>r.result.result.value));
  console.log('===== LOGS =====');
  logs.forEach(l=>console.log(l));
  const shot=await send('Page.captureScreenshot',{format:'png'}).then(r=>r.result.data);
  fs.writeFileSync('/tmp/dgang_shot.png',Buffer.from(shot,'base64'));
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});