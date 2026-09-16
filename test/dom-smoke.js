// DOM-shim smoke test: load index.html + app.js in jsdom, drive login → run.
const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname,'..','public','index.html'),'utf8');
const dom = new JSDOM(html, {
  url: 'http://localhost:3999/',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;

// polyfills jsdom lacks
window.navigator.serviceWorker = { register: () => Promise.resolve() };
window.HTMLElement.prototype.scrollTo = function(){};
Object.defineProperty(window.HTMLElement.prototype, 'scrollTop', { set(){}, get(){ return 0; } });
Object.defineProperty(window.HTMLElement.prototype, 'scrollHeight', { get(){ return 0; } });
window.scrollTo = function(){};

let lastFetchUrl = null, lastFetchOpts = null;
window.fetch = async (url, opts) => {
  lastFetchUrl = url; lastFetchOpts = opts;
  // simulate: login ok
  if (String(url).includes('/api/auth/login')) return { ok:true, status:200, json: async ()=>({ token:'FAKETOKEN', user:{ id:1, name:'Sonu Test', emoji:'😎', c1:'#14b8ff', c2:'#635bff' } }) };
  if (String(url).includes('/api/groups')) return { ok:true, status:200, json: async ()=>({ groups: [{ id:1, name:'DGang Official', invite_code:'ABCDEF', member_count:1, members:[{id:1,name:'Sonu Test',emoji:'😎',c1:'#14b8ff',c2:'#635bff',role:'admin'}] }] }) };
  if (String(url).match(/\/api\/group\/\d+\/messages/)) return { ok:true, status:200, json: async ()=>({ messages:[] }) };
  if (String(url).match(/\/api\/group\/\d+\/message/) && (!opts || !opts.body)) return { ok:true, status:200, json: async ()=>({ message:{ id:1, group_id:1,user_id:1,type:'text',body:'hi',ts:1,reactions:{},sender:'Sonu Test',emoji:'😎',c1:'#14b8ff',c2:'#635bff' } }) };
  return { ok:true, status:200, json: async ()=>({ ok:true }) };
};

// evaluate app.js
const appjs = fs.readFileSync(path.join(__dirname,'..','public','app.js'),'utf8');
const errors = [];
try {
  window.eval(appjs);
} catch(e){ errors.push('TOP-LEVEL: '+e.message); }

// localStorage needs read before eval? app.js reads on DOMContentLoaded via boot()
const results = {};
try {
  // dispatch DOMContentLoaded to trigger boot()
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
} catch(e){ errors.push('DOMContentLoaded: '+e.message); }

console.log('JS loaded with', errors.length, 'errors');
errors.forEach(e=>console.log('  ERR:', e));
console.log(dom.window.document.querySelector('.logo.big') ? 'AUTH_FOUND' : 'NO_AUTH');
console.log('LAST_FETCH:', lastFetchUrl||'none');
process.exit(errors.length?1:0);