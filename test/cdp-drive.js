// Minimal CDP driver via Node's global WebSocket — drives Chromium, captures console + screenshots
const CDP = require('node:inspector').Session; // not used; use raw ws
const WebSocket = global.WebSocket;
const fs = require('fs');

const CDP_PORT = process.env.CDP_PORT || 9222;
const TARGET_URL = process.env.TARGET || 'http://localhost:3999/';

async function main() {
  // find a page target
  const list = await (await fetch(`http://localhost:${CDP_PORT}/json/list`)).json();
  let page = list.find(t => t.type === 'page');
  if (!page) { console.log('no page'); return; }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map(); const logs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method === 'Runtime.consoleAPICalled') {
      const vals = m.params.args.map(a => a.value ?? a.description ?? '').join(' ');
      if (/Log\.|ERROR|warn|error/i.test(vals)) logs.push('CONSOLE: ' + vals);
    } else if (m.method === 'Runtime.exceptionThrown') {
      logs.push('EXCEPTION: ' + (m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text));
    }
  };
  const send = (method, params={}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({id:i, method, params})); });

  await send('Page.enable'); await send('Runtime.enable'); await send('Page.navigate', { url: TARGET_URL });
  await new Promise(r => setTimeout(r, 2500));

  const res = {};
  res.title = await send('Runtime.evaluate', { expression: 'document.title', returnByValue: true }).then(r=>r.result.result.value);
  res.authVisible = await send('Runtime.evaluate', { expression: "!document.getElementById('auth').classList.contains('hidden')", returnByValue: true }).then(r=>r.result.result.value);

  // login via JS
  await send('Runtime.evaluate', { expression: `
    document.getElementById('aName').value='Sonu Test';
    document.getElementById('aPin').value='8918';
    document.getElementById('aGo').click();` });
  await new Promise(r => setTimeout(r, 2500));
  res.appVisible = await send('Runtime.evaluate', { expression: "!document.getElementById('app').classList.contains('hidden')", returnByValue: true }).then(r=>r.result.result.value);
  res.groupsHtml = await send('Runtime.evaluate', { expression: "document.getElementById('screen-groups').innerHTML.length", returnByValue: true }).then(r=>r.result.result.value);
  res.toast = await send('Runtime.evaluate', { expression: "document.getElementById('toast').textContent.trim()", returnByValue: true }).then(r=>r.result.result.value);

  const shot = await send('Page.captureScreenshot', { format:'png' }).then(r=>r.result.data);
  fs.writeFileSync('/tmp/dgang_shot.png', Buffer.from(shot, 'base64'));

  res.logs = logs;
  console.log(JSON.stringify(res, null, 2));
  ws.close();
}
main().catch(e => { console.error('DRIVER_ERR', e.message); process.exit(1); });