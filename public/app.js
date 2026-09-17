/* ============ DGang — frontend app ============ */
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const ESC=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=t=>{const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>e.classList.remove('show'),2200);};
const FILE_HOST='';
let TOK=localStorage.getItem('dg_tok')||null, ME=null, SOCK=null;
let SCREEN='groups', AG=[], CURG=null, MSGS={}, REELS=[], ONLINE={}, TYPING={};

/* ---------- session ---------- */
function saveTok(){localStorage.setItem('dg_tok',TOK||'');}
function av(u,cls){return `<div class="grp-av ${cls||''}" style="background:linear-gradient(135deg,${u.c1},${u.c2})">${u.emoji}</div>`;}
function miniAv(u){return `<span style="display:inline-block;width:24px;height:24px;border-radius:8px;background:linear-gradient(135deg,${u.c1},${u.c2});font-size:13px;display:flex;align-items:center;justify-content:center;margin-left:-4px;z-index:2;position:relative">${u.emoji}</span>`;}
function timeH(ts){const d=new Date(ts*1000),now=new Date();if(d.toDateString()===now.toDateString())return d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});return d.toLocaleDateString([],{day:'2-digit',month:'short'});}

/* ============ INIT ============ */
async function boot(){
  bindAuth(); bindNav(); bindModal(); bindMedia();
  if(TOK){ try{ await refreshAll(); connect(); showApp(); }catch(e){ showAuth(); } }
  else showAuth();
}
function showAuth(){$('#auth').classList.remove('hidden');$('#app').classList.add('hidden');}
function showApp(){$('#auth').classList.add('hidden');$('#app').classList.remove('hidden');}

async function api(path,opts={}){
  const h=opts.headers||{}; if(TOK)h['Authorization']='Bearer '+TOK;
  const r=await fetch(FILE_HOST+path,{...opts,headers:h});
  const j=await r.json().catch(()=>({}));
  if(r.status===401){TOK=null;saveTok();showAuth();throw new Error('auth');}
  if(!r.ok)throw new Error(j.error||('HTTP '+r.status));
  return j;
}

async function refreshAll(){
  const d=await api('/api/groups');
  AG=d.groups;
  MSGS={}; REELS={};
  for(const g of AG){ const m=await api('/api/group/'+g.id+'/messages'); MSGS[g.id]=m.messages||[]; }
  renderGroups();
}

/* ---------- socket ---------- */
function connect(){
  if(SOCK)SOCK.close();
  SOCK=io({auth:{token:TOK},transports:['websocket','polling']});
  SOCK.on('connect',()=>{});
  SOCK.on('ready',d=>{ME=d.me; if(d.presence)d.presence.forEach(p=>ONLINE[p.group_id]=new Set(p.members)); renderTop();});
  SOCK.on('message',m=>{ if(!MSGS[m.group_id])MSGS[m.group_id]=[];
    if(!MSGS[m.group_id].some(x=>x.id===m.id)){ MSGS[m.group_id].push(m);
      if(CURG&&CURG.id===m.group_id)renderChat(); else notif(); renderGroups(); } });
  SOCK.on('reaction',d=>{ MSGS[d.message_id]?.forEach?.(()=>{}); bumpReaction(d); });
  SOCK.on('reel_new',r=>{ if(!REELS[CURG?.id]&&CURG){} if(r.group_id===CURG?.id){REELS[r.group_id]=[r,...(REELS[r.group_id]||[])]; if(SCREEN==='reels')renderReels();} });
  SOCK.on('reel_like',d=>{ if(REELS[d.reel_id])REELS[d.reel_id].likes=d.likes; if(SCREEN==='reels')renderReels(); });
  SOCK.on('presence',d=>{ ONLINE[d.group_id]=new Set(d.online); if(CURG&&CURG.id===d.group_id)renderChatHead(); renderGroups(); });
  SOCK.on('typing',d=>{ TYPING[d.group_id]=d; renderTyping(); setTimeout(()=>{delete TYPING[d.group_id];renderTyping();},1500); });
  SOCK.on('stop_typing',d=>{ delete TYPING[d.group_id]; renderTyping(); });
  SOCK.on('call',d=>notif(d.from.name+' ko call aaya 🔔'));
  initCall();
}
function bumpReaction(d){
  for(const k in MSGS){ const m=MSGS[k].find(x=>x.id===d.message_id); if(m){m.reactions=d.reactions;if(CURG&&CURG.id===k)renderChat();break;} }
}

/* ============ AUTH ============ */
function bindAuth(){
  let emoji='😎';
  $$('#aEmoji span').forEach(el=>el.onclick=()=>{$$('#aEmoji span').forEach(x=>x.classList.remove('on'));el.classList.add('on');emoji=el.dataset.e;});
  $('#aGo').onclick=async()=>{
    const name=$('#aName').value.trim(), pin=$('#aPin').value;
    if(!name)return toast('Naam daalo bhai 😄');
    if(pin.length<4)return toast('PIN kam se kam 4 digit');
    try{
      const d=await api('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,pin,emoji})});
      TOK=d.token; ME=d.user; saveTok();
      await refreshAll(); connect(); showApp(); notif('Welcome '+ME.name+' 🎉'); go('groups');
    }catch(e){ toast(e.message==='wrong_pin'?'PIN galat hai 🤨':'Try again!'); }
  };
}

/* ============ NAV ============ */
function bindNav(){ $$('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.screen)); }
function go(s){ SCREEN=s; $$('.nav button').forEach(b=>b.classList.toggle('act',b.dataset.screen===s));
  ['groups','chat','reels','yt','game','profile'].forEach(x=>$('#screen-'+x).classList.add('hidden'));
  if(s==='groups'){$('#screen-groups').classList.remove('hidden');renderGroups();renderTop('DGang');}
  else if(s==='chat'&&CURG){$('#screen-chat').classList.remove('hidden');renderChat();renderChatHead();}
  else if(s==='reels'){$('#screen-reels').classList.remove('hidden');renderReels();}
  else if(s==='yt'){$('#screen-yt').classList.remove('hidden');renderYT();}
  else if(s==='game'){openGame();}
  else if(s==='profile'){renderProfile();}
}
function renderTop(t){ const e=$('#topTitle'); if(t)e.textContent=t; }

/* ============ GROUPS ============ */
function renderGroups(){
  if(SCREEN==='groups'){
    $('#screen-groups').innerHTML =
      `<button class="btn grad newgrp" id="btnNewGroup">＋ Naya group banao</button>`+
      (AG.length===0?'<div class="mini" style="text-align:center;margin-top:30px">Abhi koi group nahi.<br>Pehla group banao ya kisi ka invite code maango.</div>':
      AG.map(g=>{
        const last=MSGS[g.id]&&MSGS[g.id].length?MSGS[g.id][MSGS[g.id].length-1]:null;
        const online=ONLINE[g.id]?ONLINE[g.id].size:0;
        const shown=last?(last.type==='photo'?'🖼️ Photo':last.type==='video'?'🎬 Video':last.body):'';
        return `<div class="grp-card glass" data-open="${g.id}">
          ${av(g.members[0]||{c1:'#14b8ff',c2:'#635bff',emoji:'👥'})}
          <div class="grp-meta"><div class="grp-name">${ESC(g.name)}</div>
          <div class="grp-sub">${shown||'Kuch likho...'}</div></div>
          <div class="grp-last">${last?timeH(last.ts):''}<br><span class="${online?'online-badge':''}">${online?online+' on':''}</span></div>
        </div>`;}).join(''));
    $$('.grp-card').forEach(el=>el.onclick=()=>openGroup(+el.dataset.open));
    $('#btnNewGroup').onclick=openNewGroup;
  }
}

function openNewGroup(){
  modal('Naya Group',`
    <input id="ngName" class="ipt" placeholder="Group ka naam" maxlength="30">
    <input id="ngPass" class="ipt" placeholder="Password (optional)" maxlength="20">
    <button class="btn grad" id="ngCreate">Banao →</button>
    <div class="mini" style="margin:14px 0 4px;text-align:center">— ya —</div>
    <button class="btn copybtn" id="ngJoin">🔑 Invite code se join karo</button>`);
  $('#ngCreate').onclick=async()=>{
    const name=$('#ngName').value.trim(); if(!name)return toast('Group ka naam do');
    try{ const d=await api('/api/group/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,pass_phrase:$('#ngPass').value||null})});
      AG.unshift(d.group); MSGS[d.group.id]=[]; closeModal(); await refreshAll(); toast('Group ban gaya! 🎉'); renderGroups(); }
    catch(e){toast(e.message);}
  };
  $('#ngJoin').onclick=()=>{modal('Group join karo',`
    <input id="jgCode" class="ipt" placeholder="6-digit invite code" maxlength="6">
    <input id="jgPass" class="ipt" placeholder="Password (agar hai toh)" maxlength="20">
    <button class="btn grad" id="jgGo">Join →</button>`);
  $('#jgGo').onclick=async()=>{
    const code=$('#jgCode').value.trim(); if(!code)return toast('Code daalo');
    try{ const d=await api('/api/group/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,pass_phrase:$('#jgPass').value||null})});
      AG.unshift(d.group); MSGS[d.group.id]=[]; closeModal(); await refreshAll(); toast('Group join ho gaya! 🎉'); renderGroups(); }
    catch(e){toast(e.message==='invalid_code'?'Code galat hai':e.message==='group_full'?'Group full hai (20)':'Galat password / try again');}
  }; };  // close jgGo onclick + ngJoin handler
}

function openGroup(id){
  const g=AG.find(x=>x.id===id); if(!g)return;
  CURG=g; go('chat');
}

/* ============ CHAT ============ */
function renderChatHead(){
  if(!CURG||!$('#screen-chat'))return;
  const online=ONLINE[CURG.id]||new Set();
  const head=$('#chatHead');
  head.innerHTML=`${av(CURG.members[0]||{c1:'#14b8ff',c2:'#635bff',emoji:'👥'})}
    <div style="flex:1;min-width:0"><div class="grp-name">${ESC(CURG.name)}</div>
    <div class="grp-sub">${online.size?online.size+' online':'sab offline'}</div></div>
    <button class="bell" id="btnCallVideo" style="color:#21c77a" aria-label="video call">📹</button>
    <button class="bell" id="btnCallAudio" style="color:#16a8ff" aria-label="audio call">📞</button>
    <button class="bell" id="chInfo">ℹ️</button>`;
  $('#chInfo').onclick=showGroupInfo;
  $('#btnCallVideo').onclick=()=>startCall('video');
  $('#btnCallAudio').onclick=()=>startCall('audio');
}
function renderChat(){
  if(!CURG||SCREEN!=='chat')return;
  const ms=MSGS[CURG.id]||[]; const meId=ME.id;
  const c=$('#chatMsg');
  c.innerHTML=ms.map(m=>{
    const mine=m.user_id===meId;
    let body='';
    if(m.type==='photo') body=`<img class="msg-media" src="media/${m.media_url.split('/').pop()}" onclick="window.open(this.src)">`;
    else if(m.type==='video') body=`<video class="msg-video" controls src="media/${m.media_url.split('/').pop()}"></video>`;
    else body=ESC(m.body);
    const reacts=Object.entries(m.reactions||{}).map(([e,us])=>
      `<span class="react-chip ${us.some(x=>x.id===meId)?'on':''}" data-e="${e}" data-m="${m.id}">${e} ${us.length}</span>`).join('');
    return `<div class="msg ${mine?'mine':'theirs'}">
      ${mine?'':`<div class="msg-info">${m.sender} · ${timeH(m.ts)}</div>`}
      <div class="bubble">${body}${reacts?`<div class="reacts">${reacts}</div>`:''}</div>
      ${mine?`<div class="msg-info">${timeH(m.ts)} ✓</div>`:''}
    </div>`;
  }).join('');
  $$('.react-chip').forEach(el=>el.onclick=()=>react(+el.dataset.m,el.dataset.e));
  c.scrollTop=c.scrollHeight;
}
function renderTyping(){ const t=$('#typing');const vals=Object.values(TYPING).filter(x=>x.group_id===CURG?.id);
  if(vals.length)t.textContent=vals.map(v=>v.name).join(', ')+' typing...'; else t.textContent=''; }
function notif(){ const d=$('#notifDot'); if(CURG&&SCREEN!=='chat')d.classList.add('show'); }

async function sendMsg(type,body){
  if(!CURG)return;
  try{ const d=await api('/api/group/'+CURG.id+'/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type,body})});
    if(!MSGS[CURG.id])MSGS[CURG.id]=[]; if(!MSGS[CURG.id].some(x=>x.id===d.message.id))MSGS[CURG.id].push(d.message); renderChat(); emitTypingStop();
  }catch(e){toast('Send fail');}
}
function emitTypingStop(){ if(SOCK&&CURG)SOCK.emit('stop_typing',{group_id:CURG.id}); }
async function react(mid,emoji){
  try{ await api('/api/message/'+mid+'/react',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({emoji})}); }catch(e){}
}

function bindMedia(){
  $('#btnPhoto').onclick=()=>$('#fPhoto').click();
  $('#btnVideo').onclick=()=>$('#fVideo').click();
  $('#fPhoto').onchange=e=>uploadMedia(e.target.files[0],'photo');
  $('#fVideo').onchange=e=>uploadMedia(e.target.files[0],'video');
  $('#btnReelAdd').onclick=()=>$('#fReel').click();
  $('#fReel').onchange=e=>uploadReel(e.target.files[0]);
}
async function uploadMedia(file,type){
  if(!CURG||!file)return;
  const fd=new FormData(); fd.append('file',file); fd.append('type',type);
  toast('Uploading...');
  try{ const d=await api('/api/group/'+CURG.id+'/message',{method:'POST',body:fd});
    if(!MSGS[CURG.id])MSGS[CURG.id]=[]; if(!MSGS[CURG.id].some(x=>x.id===d.message.id))MSGS[CURG.id].push(d.message); renderChat();
  }catch(e){toast('Fail');}
}
function emitTyping(kind){
  if(!SOCK||!CURG)return;
  if(kind) SOCK.emit('typing',{group_id:CURG.id}); else SOCK.emit('stop_typing',{group_id:CURG.id});
}
function bindChatInput(){
  const inp=$('#chatInput'), btn=$('#btnSend');
  const send=()=>{const t=inp.value.trim();if(!t)return;sendMsg('text',t);inp.value='';emitTyping(false);};
  btn.onclick=send;
  inp.onkeydown=e=>{ if(e.key==='Enter')send();
    if(inp.value.trim())emitTyping(true); };
  inp.oninput=()=>{ emitTyping(true); clearTimeout(inp._t); inp._t=setTimeout(()=>emitTyping(false),1200); };
  // quick emoji row
  const er=document.createElement('div'); er.className='emoji-row';
  ['😆','😂','🔥','🥵','😈','💀','🤣','🫨','❤️','😏','🫢','🤬'].forEach(e=>{const b=document.createElement('button');b.textContent=e;b.onclick=()=>{inp.value+=e;inp.focus();};er.appendChild(b);});
  $('#screen-chat').insertBefore(er,$('#chatMsg'));
}

/* ============ GROUP INFO ============ */
function showGroupInfo(){
  if(!CURG)return;
  const online=ONLINE[CURG.id]||new Set();
  modal('Group info',`
    <div class="grp-card glass" style="margin-bottom:10px">${av(CURG.members[0]||{c1:'#14b8ff',c2:'#635bff',emoji:'👥'})}
      <div class="grp-meta"><div class="grp-name">${ESC(CURG.name)}</div>
      <div class="grp-sub">${CURG.member_count}/20 members</div></div></div>
    <div class="mini" style="margin-bottom:8px">Invite code (isiko share karo):</div>
    <button class="copybtn" id="copyCode">🔗 ${CURG.invite_code} — copy</button>
    <div class="mini" style="margin:14px 0 6px">Members:</div>
    ${CURG.members.map(m=>`<div class="member-row"><div class="av" style="background:linear-gradient(135deg,${m.c1},${m.c2})">${m.emoji}</div>
      <b>${ESC(m.name)}</b>${m.role==='admin'?'<span class="role">admin</span>':''}
      <span class="${online.has(m.id)?'online':'offline'}">${online.has(m.id)?'● online':'offline'}</span></div>`).join('')}`);
  $('#copyCode').onclick=()=>{navigator.clipboard.writeText(CURG.invite_code).then(()=>toast('Code copy! 🔗'));};
}

/* ============ REELS ============ */
async function loadReels(){
  if(!CURG)return;
  try{ const d=await api('/api/group/'+CURG.id+'/reels'); REELS[CURG.id]=d.reels; renderReels(); }catch(e){}
}
function renderReels(){
  if(SCREEN!=='reels'||!CURG){ if(!REELS[CURG?.id])loadReels(); return; }
  if(!REELS[CURG.id]){ loadReels(); return; }
  const feed=$('#reelFeed');
  if(!REELS[CURG.id].length){feed.innerHTML='<div class="mini" style="text-align:center;margin-top:40px">Abhi koi reels nahi.<br>Group ki funny clips upload karo ➕</div>';return;}
  feed.innerHTML=REELS[CURG.id].map(r=>`
    <div class="reel-card">
      <video class="reel-vid" src="media/${r.video_url.split('/').pop()}" poster="${r.poster_url?'media/'+r.poster_url.split('/').pop():''}" controls loop playsinline preload="metadata"></video>
      <div class="reel-cap"><div class="av" style="width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,${r.c1},${r.c2});display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">${r.emoji}</div>
        <div class="reel-vmeta"><b>${ESC(r.sender)}</b>${r.caption?' · '+ESC(r.caption):''}</div>
        <button class="reel-like" data-r="${r.id}">❤️<div class="likes">${r.likes}</div></button>
      </div></div>`).join('');
  $$('.reel-like').forEach(el=>el.onclick=()=>likeReel(+el.dataset.r));
}
async function likeReel(id){ try{ await api('/api/reel/'+id+'/like',{method:'POST'}); }catch(e){} }
async function uploadReel(file){
  if(!CURG||!file)return;
  const fd=new FormData(); fd.append('file',file);
  toast('Uploading reel...');
  try{ await api('/api/group/'+CURG.id+'/reel',{method:'POST',body:fd}); loadReels(); toast('Reel live! 🎬'); }catch(e){toast('Fail');}
}

/* ============ YOUTUBE ============ */
let YT_CUR=null;
function renderYT(){
  const p=$('#ytPanel');
  p.innerHTML=`<div class="yt-head">Koi YouTube video paste karo — app ke andar chale</div>
    <input id="ytUrl" class="ipt" placeholder="youtube link paste karo" autocomplete="off">
    <button class="btn grad" style="margin:8px 0 0" id="ytGo">Play ▶</button>
    ${YT_CUR?`<div class="yt-vid"><iframe src="${YT_CUR}" allowfullscreen allow="autoplay;encrypted-media"></iframe></div>`:''}`;
  $('#ytGo').onclick=()=>{
    const u=$('#ytUrl').value.trim(); if(!u)return toast('URL daalo');
    const id=ytId(u); if(!id)return toast('Valid YouTube link nahi');
    YT_CUR='https://www.youtube-nocookie.com/embed/'+id;
    renderYT();
  };
}
function ytId(u){
  const m=u.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/); return m?m[1]:null;
}

/* ============ GAME ============ */
function openGame(){
  $('#screen-chat').classList.add('hidden'); $('#screen-reels').classList.add('hidden');
  $('#screen-yt').classList.add('hidden'); $('#screen-groups').classList.add('hidden'); $('#screen-profile').classList.add('hidden');
  const sc=$('#screen-game'); sc.classList.remove('hidden');
  const COLS=['#16a8ff','#ff3ec8','#21c77a','#ff8b2e'];
  const col=COLS[(CURG?.id||0)%COLS.length];
  sc.innerHTML=`<div class="game-card glass" style="border:1px solid ${col}">
    <div class="game-ico">🎰</div>
    <div class="game-title">Truth or Dare</div>
    <div class="game-desc">Spin karo — kiski baari aur kya? Friend group ka classic.</div>
    <div class="tot-scale grad-text" id="totScale">Spin karne ka intazaar...</div>
    <button class="btn grad" id="totSpin">🎲 Spin!</button>
    <div class="tot-box" id="totBox"></div>
    <button class="btn copybtn" id="totSend" style="display:none">📨 Group mein bhejo</button>
  </div>
  <div class="game-card glass">
    <div class="game-ico">⭕</div><div class="game-title">Tic-Tac-Toe</div>
    <div class="game-desc">Dost ke sath 1v1 khelo.</div>
    <div class="ttt" id="ttt">${[1,2,3,4,5,6,7,8,9].map(i=>`<div class="ttt-cell" data-i="${i}"></div>`).join('')}</div>
    <button class="btn grad" id="tttReset">Reset</button>
  </div>
  <div class="mini" style="text-align:center;margin-top:16px">Server pe live sync Phase 4 mein · abhi local fun 🎮</div>`;
  $('#totSpin').onclick=spinTOT;
  $('#totSend').onclick=()=>{const t=$('#totScale').textContent; if(t.indexOf('Spin')<0)sendMsg('text','🎮 '+t); toast('Bhej diya!');};
  let cur=null; const cells=$$('#ttt .ttt-cell');
  const won=()=>{const w=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const [a,b,c] of w){if(cells[a].textContent&&cells[a].textContent===cells[b].textContent&&cells[a].textContent===cells[c].textContent)return cells[a].textContent;}return null;};
  cells.forEach((c,i)=>c.onclick=()=>{
    if(c.textContent||won())return; c.textContent=(cells.filter(x=>x.textContent).length%2===0)?'❌':'⭕';
    if(won())toast(won()+' wins! 🎉'); else if(cells.every(x=>x.textContent))toast('Draw 🤝');
  });
  $('#tttReset').onclick=()=>cells.forEach(c=>c.textContent='');
}
function spinTOT(){
  const mems=CURG?CURG.members:[{name:'Tu'}];
  const who=mems[Math.floor(Math.random()*mems.length)].name;
  const tod=Math.random()<0.5?'TRUTH':'DARE';
  const q=tod==='TRUTH'
    ?pick(['Kabhi kisi ko secretly matlab hai? 👀','Sabse embarassing moment kya tha?','Kis se jalte ho sabse zyada?','Last time kab roye the?','Ek secret batao jo kisi ko nahi pata 💀'])
    :pick(['Kisi aur ki profile emoji se selfie lo 🤳','10 baar bolna "I am a potato" 🥔','Group ke liye ek shayari sunao 🎤','Ek minute funny dance 🕺','Apne aakhri crush ko daant ke bol lo "maaf kar, khatam" 😅']);
  $('#totScale').textContent='🎯 '+who+' — '+tod;
  $('#totBox').textContent='❔ '+q;
  $('#totSend').style.display='';
}
function pick(a){return a[Math.floor(Math.random()*a.length)];}

/* ============ CALLS (WebRTC + coturn TURN) ============ */
let pc=null, localStream=null, callTimer=null, callActive=false, callType='video';
let pendingCall=null, pendingOffer=null, isCaller=false, remoteName='';
const callScreen=()=>$('#callScreen');

async function getIceServers(){
  try{ const d=await api('/api/turn'); return d.iceServers; }catch(e){ return [{urls:'stun:stun.l.google.com:19302'}]; }
}
async function initCall(){
  if(callBooted) return;
  callBooted=true;
  SOCK.on('call',d=>onIncoming(d));
  SOCK.on('call_offer',d=>onOffer(d));
  SOCK.on('call_answer',d=>onAnswer(d));
  SOCK.on('call_ice',d=>onIce(d));
  SOCK.on('call_hangup',d=>onRemoteHangup(d));
}
let callBooted=false;

function startCall(type){
  if(!CURG)return toast('Pehle group kholo');
  callType=type; remoteName=CURG.name; isCaller=true;
  showCallUI('Calling '+CURG.name+'...');
  SOCK.emit('call',{group_id:CURG.id,type});
  doCall(true);
}
async function doCall(asCaller){
  try{
    localStream=await navigator.mediaDevices.getUserMedia({video:callType==='video',audio:true});
    $('#callLocal').srcObject=localStream;
    pc=new RTCPeerConnection({iceServers:await getIceServers()});
    localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
    pc.onicecandidate=e=>{ if(e.candidate&&CURG)SOCK.emit('call_ice',{group_id:CURG.id,candidate:e.candidate}); };
    pc.ontrack=e=>{ $('#callRemote').srcObject=e.streams[0]; };
    if(asCaller){
      const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
      SOCK.emit('call_offer',{group_id:CURG.id,sdp:pc.localDescription,type:callType});
      clearTimeout(callTimer); callTimer=setTimeout(()=>{ if(!callActive){hangup(true);toast('No answer — Call hua nahi 📵');} },30000);
    } else if(pendingOffer){
      await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
      const ans=await pc.createAnswer(); await pc.setLocalDescription(ans);
      SOCK.emit('call_answer',{group_id:CURG.id,sdp:pc.localDescription});
      callActive=true; showCallUI('Connected — '+remoteName);
    }
  }catch(e){ hangup(true); toast('Camera/Mic access nahi — Chrome mein allow karo 🎤'); }
}

async function onIncoming(d){
  if(callActive) return;
  callType=d.type||'video'; remoteName=d.from.name; isCaller=false;
  pendingCall={from:d.from,type:callType}; pendingOffer=null;
  showCallUI(d.from.name+' 👋 (Video)','ring');
}
async function acceptCall(){
  const f=pendingCall; if(!f){ hangup(true); return; }
  remoteName=f.from.name; pendingCall=null;
  showCallUI('Connecting with '+remoteName+'...');
  await doCall(false);
}
async function onOffer(d){
  if(!d||!d.sdp)return;
  // ring ke dauran -> store karo, accept pe use hoga
  if(pendingCall){ pendingOffer=d.sdp; return; }
  // already in a call expecting answer -> apply offer directly
  if(pc && !isCaller && pc.signalingState!=='have-remote-offer'){
    try{
      await pc.setRemoteDescription(new RTCSessionDescription(d.sdp));
      const ans=await pc.createAnswer(); await pc.setLocalDescription(ans);
      SOCK.emit('call_answer',{group_id:CURG.id,sdp:pc.localDescription});
      callActive=true; showCallUI('Connected — '+remoteName);
    }catch(e){}
  }
}
async function onAnswer(d){
  if(!pc||!d.sdp)return;
  try{ await pc.setRemoteDescription(new RTCSessionDescription(d.sdp)); callActive=true; showCallUI('Connected — '+remoteName); clearTimeout(callTimer); }catch(e){}
}
async function onIce(d){
  if(!pc||!d.candidate)return;
  try{ await pc.addIceCandidate(new RTCIceCandidate(d.candidate)); }catch(e){}
}
function onRemoteHangup(d){ if(callActive||callTimer){ hangup(true); toast(remoteName+' call cut ho gaya'); } }
function hangup(sendSignal){
  if(SOCK&&CURG&&sendSignal)SOCK.emit('call_hangup',{group_id:CURG.id});
  if(pc){ try{pc.close();}catch(e){} pc=null; }
  if(localStream){ localStream.getTracks().forEach(t=>t.stop()); localStream=null; }
  try{ $('#callRemote').srcObject=null; $('#callLocal').srcObject=null; }catch(e){}
  callActive=false; pendingCall=null; pendingOffer=null; clearTimeout(callTimer); callScreen().classList.add('hidden');
}

function showCallUI(info, mode){
  callScreen().classList.remove('hidden');
  $('#callInfo').textContent=info||'Call...';
  const overlay=$('#modal'); if(overlay)overlay.classList.add('hidden');
  const btns=$('.call-btns');
  if(mode==='ring'){
    btns.innerHTML=`<button class="cbtn" id="callReject" style="background:var(--red)">✖</button><button class="cbtn" id="callAccept" style="background:var(--green)">📞</button>`;
    $('#callReject').onclick=()=>{ pendingCall=null; callScreen().classList.add('hidden'); };
    $('#callAccept').onclick=acceptCall;
  } else {
    btns.innerHTML=`<button id="callMic" class="cbtn" aria-label="mic">🎤</button><button id="callCam" class="cbtn" aria-label="cam">📷</button><button id="callEnd" class="cbtn end" aria-label="end">📞</button>`;
    $('#callMic').onclick=()=>{ const el=$('#callMic'); const t=localStream.getAudioTracks()[0]; if(t){t.enabled=!t.enabled; el.classList.toggle('off',!t.enabled);} };
    $('#callCam').onclick=()=>{ const el=$('#callCam'); const t=localStream.getVideoTracks()[0]; if(t){t.enabled=!t.enabled; el.classList.toggle('off',!t.enabled);} $('#callLocal').style.display=(t&&t.enabled)?'':'none'; };
    $('#callEnd').onclick=()=>{ hangup(true); };
  }
}

/* ============ PROFILE ============ */
function renderProfile(){
  $('#screen-profile').classList.remove('hidden');
  const sc=$('#screen-profile');
  sc.innerHTML=`<div class="me-card glass">
    <div class="me-av" style="background:linear-gradient(135deg,${ME.c1},${ME.c2})">${ME.emoji}</div>
    <div class="me-name">${ESC(ME.name)}</div>
    <div class="me-sub">DGang user</div>
    <div class="row-line"><span>Mere groups</span><b>${AG.length}</b></div>
    <div class="row-line"><span>App</span><span>DGang v1.0</span></div>
    <div class="row-line"><span>License</span><span style="font-size:12px">MIT · Open Source</span></div>
    <button class="btn grad" style="margin-top:18px" id="btnLogout">Logout</button>
    <div class="mini" style="text-align:center;margin-top:12px">Made with 🖤 · Nayan Mondal</div>
  </div>`;
  $('#btnLogout').onclick=()=>{TOK=null;saveTok();location.reload();};
}

/* ============ MODAL ============ */
function modal(t,body){$('#mTitle').textContent=t;$('#mBody').innerHTML=body;$('#modal').classList.remove('hidden');}
function closeModal(){$('#modal').classList.add('hidden');}
function bindModal(){ $('#mClose').onclick=closeModal; $('#modal').onclick=e=>{if(e.target.id==='modal')closeModal();}; }

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded',()=>{boot();bindChatInput();});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});