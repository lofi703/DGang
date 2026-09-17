// Login, capture cookies, navigate within SAME CDP session and re-inject cookies
const WebSocket=global.WebSocket; const wait=ms=>new Promise(r=>setTimeout(r,ms));
const EMAIL=process.env.FD_EMAIL, PASS=process.env.FD_PASS;
async function main(){
  const page=(await (await fetch('http://127.0.0.1:9222/json/list')).json())[0];
  const ws=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  let id=0;const pend=new Map();
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);}};
  const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}));});
  const ev=async expr=>{const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true});return r.result.result.value;};
  await send('Network.enable'); await send('Page.enable'); await send('Runtime.enable');

  // Go login page
  await send('Page.navigate',{url:'https://freedns.afraid.org/'}); await wait(2500);
  console.log('login form:', await ev(`!!document.querySelector('input[name="email"]')`));
  if(await ev(`!!document.querySelector('input[name="email"]')`)){
    await ev(`document.querySelector('input[name="email"]').value=${JSON.stringify(EMAIL)}`);
    await ev(`document.querySelector('input[name="password"]').value=${JSON.stringify(PASS)}`);
    await ev(`document.querySelector('form').submit()`); await wait(4000);
  }
  console.log('after login logout?', await ev('/logout/i.test(""+document.body.innerText)'));
  // collect cookies
  const ck=await send('Network.getAllCookies'); const cookies=ck.result.cookies;
  console.log('COOKIES:', cookies.map(c=>c.name+'='+(c.name==='session_id'?String(c.value).slice(0,10)+'...':c.value)).join(', '));
  const sess=cookies.find(c=>/session/i.test(c.name));
  console.log('session cookie found:', !!sess);

  // Now navigate to domain page DESPITE redirect, passing cookies
  await send('Network.clearBrowserCookies');
  await send('Network.setCookies',{cookies:cookies.map(c=>({name:c.name,value:c.value,domain:c.domain,path:c.path||'/',secure:!!c.secure,httpOnly:!!c.httpOnly,sameSite:c.sameSite}))});
  await send('Page.navigate',{url:'https://freedns.afraid.org/domain/'}); await wait(3000);
  console.log('DOMAIN URL:', await ev('location.href'));
  const txt=await ev('document.body.innerText||""');
  console.log('bad.mn:', /bad\.mn/i.test(txt), '| msoo:', /msoo\.com/i.test(txt), '| logout:', /logout/i.test(txt));
  console.log('BODY:', txt.replace(/\s+/g,' ').slice(0,700));
  ws.close();
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});