/* ====== EDIT THESE TWO (Supabase > Project Settings > API). The anon key is public by design. ====== */
const SUPA_URL='https://jhvmbtfpcdfiazhqufdq.supabase.co', SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impodm1idGZwY2RmaWF6aHF1ZmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3ODQ3NDEsImV4cCI6MjExMDM2MDc0MX0.GJzSEagna541i8VqDqc_Y7g92uv79XO3t1gKCpNwrh8';
/* ================================================================================================= */
const LABELS=['July class work','August class work','September class work','Event Management – Initial','Event Management – Additional','Membership Fee','Activity Fee','Intrams Day 1 Laro ng Lahi','Intrams Day 2 Laro ng Lahi'];
const FEE_DUES=[40,20]; // Membership, Activity (change if wrong)
// Intrams amount depends on the attendance column: Both = 0, Log In/Out Only = 25, Absent = 50, blank = not shown
const intramsDue=a=>{a=String(a||'').toLowerCase();return/both/.test(a)?0:/only/.test(a)?25:/absent/.test(a)?50:null};
const EVENT_DUES=[50,25]; // amount every student must pay for the two event columns
const BUL='00000000-0000-0000-0000-00000000b011',ROLES=['visitor','student','officer','admin'];
const PERMS=[['chat','Chat'],['officer_dash','Officer'],['data_export','Export'],['data_import','Import'],['manage_roles','Roles']];
const db=supabase.createClient(SUPA_URL,SUPA_KEY);
const $=s=>document.querySelector(s),S={tab:'home',online:0,view:null,perms:[],os:'ov',seg:'tr',lay:localStorage.getItem('lay')||'pills'};
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const php=n=>'₱'+Number(n||0).toLocaleString('en-PH'),has=p=>S.perms.includes(p),isNet=e=>/fetch|network|load failed|offline/i.test(e?.message||'');
const ls={g:k=>{try{return JSON.parse(localStorage.getItem('cf_'+k))}catch{return null}},s:(k,v)=>{try{localStorage.setItem('cf_'+k,JSON.stringify(v))}catch{}}};
const I={menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L3 20l1-4.6A8 8 0 1 1 21 12z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',chev:'<path d="M6 9l6 6 6-6"/>',send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',dl:'<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16"/>',off:'<path d="M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8a15 15 0 0 0-9-3.7M5 12.9a10 10 0 0 1 5-2.7M19 12.9a10 10 0 0 0-2.4-1.9M8.5 16.4a5 5 0 0 1 7 0M12 20h.01M3 3l18 18"/>',rows:'<path d="M4 6h16M4 12h16M4 18h16"/>',pills:'<rect x="3" y="5" width="18" height="5" rx="2.5"/><rect x="3" y="14" width="13" height="5" rx="2.5"/>'};
const ic=(n,s=20)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
let tt;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('show'),3500)}
function theme(t){if(t)localStorage.setItem('theme',t);const v=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.dataset.theme=v;return v}
const idOk=v=>/^\d{2}-?\d{5,6}$/.test(v.trim()),tm=t=>t?new Date(t).toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'}):'sending…';
/* Offline: every read is saved on the phone and shown when there is no signal */
async function cached(key,fn){try{const r=await fn();if(r.error)throw r.error;ls.s(key,{t:Date.now(),d:r.data});S.stale=null;updOff();return r.data}catch(e){const c=ls.g(key);if(c&&(!navigator.onLine||isNet(e))){S.stale=c.t;updOff();return c.d}throw e}}
function updOff(){const o=$('#off');if(!o)return;const on=!navigator.onLine||S.stale;o.hidden=!on;if(on)o.lastChild.textContent=' Offline. Showing data saved '+(S.stale?new Date(S.stale).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'earlier')+'.'}
const outbox=()=>ls.g('out')||[];
async function flush(){const q=outbox();if(!q.length||!navigator.onLine)return;const rest=[];for(const x of q){const {error}=await db.from('cf_messages').insert(x);if(error)rest.push(x)}ls.s('out',rest);if(S.tab==='chat')chat()}
async function send(x){if(!navigator.onLine){ls.s('out',[...outbox(),x]);return toast('Offline. Message will send when you reconnect.')}const {error}=await db.from('cf_messages').insert(x);if(error){if(isNet(error))ls.s('out',[...outbox(),x]);else toast(error.message)}}

async function boot(){
  theme();let {data:{session}}=await db.auth.getSession();
  if(!session){if(!navigator.onLine)return $('#app').innerHTML='<div class="wrap"><h1>Offline</h1><p class="muted">Connect once to set up the app. After that it works offline.</p></div>';
    const r=await db.auth.signInAnonymously();if(r.error)return $('#app').innerHTML=`<div class="wrap"><h1>Can't connect</h1><p class="muted">${esc(r.error.message)}</p></div>`;session=r.data.session}
  S.uid=session.user.id;let p;
  try{const r=await db.from('cf_profiles').select('name,sid,role').eq('user_id',S.uid).maybeSingle();if(r.error)throw r.error;p=r.data;ls.s('prof',p)}catch(e){p=ls.g('prof')}
  if(!p)return onboard();Object.assign(S,p);
  try{S.perms=await cached('perms',()=>db.rpc('cf_my_perms'))||[]}catch{S.perms=[]}
  shell();if(navigator.onLine){presence();flush()}
  db.channel('msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'cf_messages'},()=>{if(S.tab==='chat')chat()}).subscribe();
}
function onboard(){
  $('#app').innerHTML=`<div class="wrap"><h1>Class Funds</h1><p class="muted">Check what you need to pay. Enter your details to start.</p>
  <form id="f"><label>Your name</label><input id="n" required maxlength="60" autocomplete="name" placeholder="Surname, First name (e.g. AFABLE, PAULINE)">
  <label>Student ID</label><input id="i" required inputmode="numeric" placeholder="YY-NNNNN (e.g. 24-03177)"><div class="hint">Format: two digits, a dash, then the rest of your ID number.</div>
  <label>Class code</label><input id="c" required placeholder="Ask your treasurer"><p><button class="btn" style="width:100%">Continue</button></p></form></div>`;
  $('#f').onsubmit=async e=>{e.preventDefault();if(!idOk($('#i').value))return toast('ID format should look like 24-03177');
    const {error}=await db.rpc('cf_register',{p_name:$('#n').value,p_sid:$('#i').value,p_code:$('#c').value});
    if(error)return toast(/wrong code/.test(error.message)?'Wrong class code':error.message);boot()};
}
function presence(){try{const ch=db.channel('online',{config:{presence:{key:S.uid}}});
  ch.on('presence',{event:'sync'},()=>{S.online=Object.keys(ch.presenceState()).length;const e=$('#eyeN');if(e)e.textContent=S.online}).subscribe(s=>{if(s==='SUBSCRIBED')ch.track({t:Date.now()})})}catch{}}
function shell(){
  const T=[['home','Home','home',1],['chat','Chat','chat',has('chat')],['help','Help','help',1],['officer','Officer','chart',has('officer_dash')],['admin','Admin','shield',S.role==='admin']].filter(t=>t[3]);
  $('#app').innerHTML=`<header><button id="bg" aria-label="Menu">${ic('menu',22)}</button><h1>Class Funds</h1><div class="eye" title="People online now">${ic('eye')}<span id="eyeN">${S.online}</span></div></header>
  <div id="off" class="off" hidden>${ic('off',16)}<span></span></div><div id="menu" hidden><button data-t="settings">Settings</button></div><main id="main"></main><nav>${T.map(t=>`<button data-t="${t[0]}">${ic(t[2])}<span>${t[1]}</span></button>`).join('')}</nav>`;
  $('#bg').onclick=()=>$('#menu').hidden=!$('#menu').hidden;
  document.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>go(b.dataset.t));updOff();go(S.tab);
}
function go(t){S.tab=t;$('#menu').hidden=true;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));window.scrollTo(0,0);({home,chat,help,officer,admin,settings})[t]()}

function card(d){
  const s=d.student;if(!s)return`<div class="panel">No record found for that ID. Ask the treasurer to check it.</div>`;
  const its=(s.items||[]).filter(i=>!(d.hidden||[]).includes(i.l)),bal=i=>Math.max(i.due-i.paid,0),tot=its.reduce((a,i)=>a+bal(i),0);
  return`${d.announcement?`<div class="note">${esc(d.announcement)}</div>`:''}<div class="hero"><span class="muted">${esc(s.name)} · ${esc(s.sid)}</span><div class="big">${tot?php(tot):'All settled'}</div><span class="muted">${tot?'Amount you still need to pay':'Nothing to pay right now'}${d.as_of?' · as of '+esc(d.as_of):''}</span></div>
  ${its.map(i=>`<details class="item"><summary><span>${esc(i.l)}</span><b class="${bal(i)?'owe':'ok'}">${bal(i)?php(bal(i)):(i.due?'Paid':'Not required')}</b>${ic('chev',16)}</summary><dl><dt>Amount to pay</dt><dd>${php(i.due)}</dd><dt>Paid</dt><dd>${php(i.paid)}</dd><dt>Remaining</dt><dd>${php(bal(i))}</dd>${d.dates?.[i.l]?`<dt>Due date</dt><dd>${esc(d.dates[i.l])}</dd>`:''}</dl></details>`).join('')}`;
}
async function home(){
  const m=$('#main'),k=S.view||S.sid;m.innerHTML='<p class="muted">Loading…</p>';let d;
  try{d=await cached('home:'+k,()=>db.rpc('cf_lookup',{p_sid:k}))}catch(e){return m.innerHTML=`<p class="muted">${esc(e.message)}</p>`}
  m.innerHTML=`<p class="hi">${S.view?'Classmate':'Hi, '+esc(S.name)}</p>${card(d)}<form id="sf" class="find"><input id="q" inputmode="numeric" placeholder="Classmate ID, e.g. 24-03177"><button class="btn">Find</button></form>${S.view?'<button class="link" id="me">Back to my balance</button>':''}`;
  $('#sf').onsubmit=e=>{e.preventDefault();if(!idOk($('#q').value))return toast('ID format should look like 24-03177');S.view=$('#q').value;home()};
  if(S.view)$('#me').onclick=()=>{S.view=null;home()};
}
async function chat(){
  const m=$('#main'),adm=S.role==='admin',staff=adm||S.role==='officer';if(!staff)S.seg='tr';const bu=S.seg==='bu';let ms=[],list='',th=bu?BUL:S.uid;
  try{ms=await cached('chat',()=>db.from('cf_messages').select('*').order('created_at'))||[]}catch(e){toast(e.message)}
  if(adm&&!bu){let nm={};try{const {data:pr}=await db.from('cf_profiles').select('user_id,name');nm=Object.fromEntries((pr||[]).map(p=>[p.user_id,p.name]))}catch{}
    const ids=[...new Set(ms.map(x=>x.thread))].filter(i=>i!==BUL);th=ids.includes(S.th)?S.th:ids[0];S.th=th;
    list=`<div class="chips">${ids.map(i=>`<button class="chip ${i===th?'on':''}" data-th="${i}">${esc(nm[i]||'Student')}</button>`).join('')||'<span class="muted">No messages yet</span>'}</div>`}
  const all=[...ms.filter(x=>x.thread===th),...outbox().filter(x=>x.thread===th).map(x=>({...x,sender:S.uid,pending:1}))];
  m.innerHTML=`<div class="bar">${staff?`<div class="seg sm"><button data-sg="tr" class="${bu?'':'on'}">Treasurer</button><button data-sg="bu" class="${bu?'on':''}">Officer bulletin</button></div>`:'<span></span>'}<div class="seg lay"><button data-ly="rows" aria-label="Rows" class="${S.lay==='rows'?'on':''}">${ic('rows',18)}</button><button data-ly="pills" aria-label="Pills" class="${S.lay==='pills'?'on':''}">${ic('pills',18)}</button></div></div>${list}
  <div class="msgs ${S.lay}">${all.map(x=>`<div class="b ${x.sender===S.uid?'me':''} ${x.pending?'pend':''}"><small>${esc(x.sender_name)}${x.is_admin?' · Treasurer':''} · ${tm(x.created_at)}</small>${esc(x.body)}</div>`).join('')||`<p class="muted">${bu?'Officer-only board for announcements and updates.':'Send your concern to the treasurer. Only you and the treasurer can see this chat.'}</p>`}</div>
  ${th?`<form id="cf" class="find"><input id="ci" maxlength="1000" placeholder="${bu?'Post to the bulletin':'Type a message'}" autocomplete="off"><button class="btn" aria-label="Send">${ic('send')}</button></form>`:''}`;
  m.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{S.th=b.dataset.th;chat()});m.querySelectorAll('[data-sg]').forEach(b=>b.onclick=()=>{S.seg=b.dataset.sg;chat()});
  m.querySelectorAll('[data-ly]').forEach(b=>b.onclick=()=>{S.lay=b.dataset.ly;localStorage.setItem('lay',S.lay);chat()});window.scrollTo(0,document.body.scrollHeight);
  if(th)$('#cf').onsubmit=async e=>{e.preventDefault();const v=$('#ci').value.trim();if(!v)return;await send({thread:th,sender_name:S.name,is_admin:adm,body:v});chat()};
}
function help(){$('#main').innerHTML=`<p class="hi">Help</p><div class="panel"><b>Why this app exists</b><p class="muted">Classmates kept asking the treasurer how much they still owe. This page shows it any time, so nobody has to ask.</p></div>
  <div class="panel"><b>How to use it</b><p class="muted"><b>Home:</b> your total amount to pay. Tap an item to see its amount, what you paid and the due date if one is set. Use the box at the bottom to check a classmate by ID.<br><b>Chat:</b> message the treasurer privately about a concern. It unlocks when the treasurer approves you; new users start as visitors.<br><b>Offline:</b> the app keeps your last balance, so you can open it without signal. It refreshes when you reconnect.<br><b>Eye icon:</b> how many people are online now.<br><b>Settings (top left):</b> dark or light mode, change your name or ID.</p></div>
  <div class="panel"><b>Good to know</b><p class="muted">Balances come from the treasurer's Excel record and are updated by the treasurer, so a payment may take a little time to appear. If something looks wrong, send it in Chat with your receipt. This app stores only your name and ID, and anyone with the class code can look up a student's balance by ID, so please don't share the class code outside the class.</p></div>`}
function settings(){
  const t=theme();$('#main').innerHTML=`<p class="hi">Settings</p><h2>Appearance</h2><div class="seg"><button data-th="light" class="${t==='light'?'on':''}">Light</button><button data-th="dark" class="${t==='dark'?'on':''}">Dark</button></div>
  <h2>Your details</h2><label>Name</label><input id="sn" maxlength="60" value="${esc(S.name)}"><label>Student ID</label><input id="si" value="${esc(S.sid)}" inputmode="numeric" placeholder="24-03177"><p><button class="btn" id="ss">Save</button></p>
  ${['officer','admin'].includes(S.role)?'':`<h2>Treasurer</h2><details><summary class="link">Treasurer sign-in</summary><label>Email</label><input id="ae" type="email"><label>Password</label><input id="ap" type="password"><p><button class="btn ghost" id="al">Sign in</button></p></details>`}`;
  document.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{theme(b.dataset.th);settings()});
  $('#ss').onclick=async()=>{if(!idOk($('#si').value))return toast('ID format should look like 24-03177');const {error}=await db.rpc('cf_rename',{p_name:$('#sn').value,p_sid:$('#si').value});if(error)return toast(error.message);toast('Saved');boot()};
  if($('#al'))$('#al').onclick=async()=>{const {error}=await db.auth.signInWithPassword({email:$('#ae').value,password:$('#ap').value});if(error)return toast('Sign-in failed');location.reload()};
}
/* ---------- Officer dashboard ---------- */
function officer(){
  const t=[['ov','Overview',1],['data','Data tools',has('data_import')||has('data_export')],['roles','Roles',has('manage_roles')||S.role==='admin']].filter(x=>x[2]);if(!t.find(x=>x[0]===S.os))S.os=t[0][0];
  $('#main').innerHTML=`<div class="seg sub">${t.map(x=>`<button data-os="${x[0]}" class="${S.os===x[0]?'on':''}">${x[1]}</button>`).join('')}</div><div id="ob"></div>`;
  document.querySelectorAll('[data-os]').forEach(b=>b.onclick=()=>{S.os=b.dataset.os;officer()});({ov,data:dataTools,roles:rolesTab})[S.os]();
}
const pct=c=>{const t=c.col+c.out;return t?Math.round(c.col/t*100):100},bar=(p,c='')=>`<div class="pb"><i class="${c}" style="width:${Math.min(p,100)}%"></i></div>`;
async function ov(){
  const b=$('#ob');b.innerHTML='<p class="muted">Loading…</p>';let o;
  try{o=await cached('ov',()=>db.rpc('cf_overview'))}catch(e){return b.innerHTML=`<p class="muted">${esc(e.message)}</p>`}
  const s=o.summary||{},f=s.fund||{},cols=s.cols||[];if(!cols.length)return b.innerHTML='<div class="panel">No data yet. Import the tracker in Data tools.</div>';
  const cur=cols.find(c=>c.l===o.current)||cols[2]||cols[0],tc=cols.reduce((a,c)=>a+c.col,0),to=cols.reduce((a,c)=>a+c.out,0),sp=[['Cash',f.cash,'g'],['Spent',f.expenses,'o'],['Remitted',f.remitted,'p']],st=sp.reduce((a,x)=>a+(x[1]||0),0)||1,mx=Math.max(...cols.map(c=>c.out),1);
  b.innerHTML=`<div class="banner"><span>Cash on hand</span><div class="big">${php(f.cash)}</div><span class="sub">${o.as_of?'As of '+esc(o.as_of):''}</span><div class="chips2"><span>Collected ${php(f.collected)}</span><span>Spent ${php(f.expenses)}</span><span>Remitted ${php(f.remitted)}</span></div></div>
  <h2>Current collection</h2><div class="panel"><b>${esc(cur.l)}</b><div class="two"><div><small>Collected</small><div class="n ok">${php(cur.col)}</div></div><div><small>Outstanding</small><div class="n owe">${php(cur.out)}</div></div></div>${bar(pct(cur))}<small>${pct(cur)}% collected${cur.unpaid!=null?' · '+cur.unpaid+' students with a balance':''}</small></div>
  <h2>All collections</h2>${cols.map(c=>`<div class="panel slim"><div class="row"><b>${esc(c.l)}</b><span class="muted">${pct(c)}%</span></div>${bar(pct(c))}<div class="row"><small>Collected ${php(c.col)}</small><small class="${c.out?'owe':''}">Outstanding ${php(c.out)}</small></div></div>`).join('')}
  <h2>Figures</h2><div class="tiles"><div class="panel"><small>Total outstanding</small><div class="n owe">${php(to)}</div></div><div class="panel"><small>Students owing</small><div class="n">${(s.stu||{}).owing??'–'}</div></div><div class="panel"><small>Collection rate</small><div class="n">${tc+to?Math.round(tc/(tc+to)*100):100}%</div></div></div>
  <div class="panel"><b>Where the money is</b><div class="stack">${sp.map(x=>`<i class="${x[2]}" style="width:${(x[1]||0)/st*100}%"></i>`).join('')}</div><div class="leg">${sp.map(x=>`<span><i class="${x[2]}"></i>${x[0]} ${php(x[1])}</span>`).join('')}</div></div>
  <div class="panel"><b>Outstanding by collection</b>${cols.filter(c=>c.out>0).map(c=>`<div class="hb"><span>${esc(c.l)}</span><div class="pb"><i class="o" style="width:${c.out/mx*100}%"></i></div><small>${php(c.out)}</small></div>`).join('')||'<p class="muted">Nothing outstanding.</p>'}</div>`;
}
/* parse tracker */
function parseXlsx(buf){
  const wb=XLSX.read(buf),ws=wb.Sheets['Collections'];if(!ws)throw Error('Sheet "Collections" not found.');
  const R=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});if(String(R[2]?.[2]).trim()!=='NAME')throw Error('Header row not recognized (expected NAME in C3).');
  const students=[],skip=[];
  for(const r of R.slice(3,80)){if(!r[2])continue;const sid=String(r[1]||'').replace(/\D/g,'');if(!sid){skip.push(r[2]);continue}
    const it=[[6,7,0],[10,11,1],[14,15,2]].filter(([d])=>r[d]!=null&&r[d]!=='').map(([d,p,i])=>({l:LABELS[i],due:+r[d],paid:+r[p]||0}));
    [18,19].forEach((c,i)=>it.push({l:LABELS[5+i],due:FEE_DUES[i],paid:+r[c]||0}));
    [[20,21,7],[22,23,8]].forEach(([c,a,k])=>{const d=intramsDue(r[a]);if(d!==null)it.push({l:LABELS[k],due:d,paid:+r[c]||0})});
    [24,25].forEach((c,i)=>it.push({l:LABELS[3+i],due:EVENT_DUES[i],paid:+r[c]||0}));students.push({sid,sid_show:String(r[1]),name:r[2],status:r[3],items:it})}
  const D=XLSX.utils.sheet_to_json(wb.Sheets['Dashboard']||{},{header:1,defval:null}),val=k=>+(D.find(r=>String(r[0]||'').trim().toLowerCase()===k)?.[1])||0;
  const cols=LABELS.map(l=>{const r=D.find(r=>r[0]&&String(r[0]).startsWith(l)),its=students.flatMap(s=>s.items.filter(i=>i.l===l)),bl=i=>Math.max(i.due-i.paid,0),num=typeof r?.[1]==='number'&&typeof r?.[3]==='number';
    return{l,col:r?+r[2]||0:its.reduce((a,i)=>a+i.paid,0),due:num?r[1]:its.reduce((a,i)=>a+i.due,0),out:num?r[3]:its.reduce((a,i)=>a+bl(i),0),unpaid:its.filter(i=>bl(i)>0).length}});
  const fund={cash:val('cash on hand'),collected:val('total collected'),outstanding:val('total outstanding (unpaid balances)'),expenses:val('total expenses'),remitted:val('remitted to cbma')};
  return{students,skip,summary:{fund,cols,stu:{owing:students.filter(s=>s.items.some(i=>i.due>i.paid)).length}}};
}
function dl(name,blob){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}
function dataTools(){
  const b=$('#ob'),ex=has('data_export'),im=has('data_import');
  b.innerHTML=`${ex?`<h2>Export</h2><p class="muted">Download balances as Excel, or a full backup you can import later.</p><div class="find"><button class="btn" id="xx">${ic('dl',18)}&nbsp;Excel</button><button class="btn ghost" id="xj">${ic('dl',18)}&nbsp;Backup (.json)</button></div>`:''}
  ${im?`<h2>Import</h2><p class="muted">Choose the Class Funds Tracker (.xlsx) or a backup (.json). You will see a preview before anything changes.</p><input type="file" id="fi" accept=".xlsx,.json"><div id="pv"></div>`:''}${ex||im?'':'<p class="muted">No data tools are enabled for your role.</p>'}`;
  const get=async()=>{const {data,error}=await db.rpc('cf_export');if(error)throw error;return data};
  if(ex){$('#xj').onclick=async()=>{try{dl('class-funds-backup.json',new Blob([JSON.stringify(await get())],{type:'application/json'}))}catch(e){toast(e.message)}};
    $('#xx').onclick=async()=>{try{const d=await get(),H=['ID','Name','Status',...LABELS.map(l=>l+' (remaining)'),'Total remaining'],bal=i=>Math.max(i.due-i.paid,0);
      const rows=d.students.map(s=>{const v=LABELS.map(l=>{const i=s.items.find(x=>x.l===l);return i?bal(i):''});return[s.sid_show,s.name,s.status,...v,v.reduce((a,x)=>a+(+x||0),0)]});
      const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([H,...rows]),'Balances');XLSX.writeFile(w,'class-funds-balances.xlsx')}catch(e){toast(e.message)}}}
  if(im)$('#fi').onchange=async e=>{const f=e.target.files[0],pv=$('#pv');if(!f)return;pv.textContent='Reading file…';let r;
    try{if(/\.json$/i.test(f.name)){const j=JSON.parse(await f.text());if(!Array.isArray(j.students))throw Error('Not a backup file.');r={students:j.students,skip:[],summary:j.summary||{},asOf:j.as_of}}else r=parseXlsx(await f.arrayBuffer())}catch(x){return pv.innerHTML=`<p class="owe">${esc(x.message)}</p>`}
    const fu=(r.summary||{}).fund||{};pv.innerHTML=`<div class="panel"><b>Preview</b><p class="muted">${r.students.length} students · ${(r.summary.stu||{}).owing??'?'} with a balance · cash on hand ${php(fu.cash)}${r.skip.length?'<br>Skipped (no ID): '+esc(r.skip.join('; ')):''}<br>This replaces all balances in the app.</p><div class="find"><button class="btn" id="ap">Apply</button><button class="btn ghost" id="ca">Cancel</button></div></div>`;
    $('#ca').onclick=()=>{pv.innerHTML='';$('#fi').value=''};
    $('#ap').onclick=async()=>{const {error}=await db.rpc('cf_import',{p_students:r.students,p_summary:r.summary,p_as_of:r.asOf||new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})});pv.innerHTML=error?`<p class="owe">Import failed: ${esc(error.message)}</p>`:`<p class="ok">Imported ${r.students.length} students.</p>`}};
}
async function rolesTab(){
  const b=$('#ob'),adm=S.role==='admin',{data:us,error}=await db.from('cf_profiles').select('user_id,name,sid,role').order('name');if(error)return b.innerHTML=`<p class="muted">${esc(error.message)}</p>`;
  let pm=[];if(adm){const r=await db.from('cf_perms').select('role,perm,allowed');pm=r.data||[]}
  const can=(r,p)=>pm.some(x=>x.role===r&&x.perm===p&&x.allowed),opts=adm?ROLES:['visitor','student'];
  b.innerHTML=`<h2>People</h2><input id="sq" placeholder="Search name or ID"><p><button class="btn ghost" id="pa">Make all visitors students</button></p><div id="ul">${(us||[]).map(u=>`<div class="row" data-q="${esc((u.name+' '+u.sid).toLowerCase())}"><span>${esc(u.name)} <small>${esc(u.sid)}</small></span>${adm||['visitor','student'].includes(u.role)?`<select data-u="${u.user_id}">${opts.map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}</select>`:`<span class="badge">${u.role}</span>`}</div>`).join('')}</div>
  ${adm?`<h2>Permissions</h2><p class="muted">Admin always has everything. Officers can only change roles up to student.</p><div class="scroll"><table class="mx"><tr><th></th>${PERMS.map(p=>`<th>${p[1]}</th>`).join('')}</tr>${['visitor','student','officer'].map(r=>`<tr><td>${r}</td>${PERMS.map(p=>`<td><input type="checkbox" data-r="${r}" data-p="${p[0]}" ${can(r,p[0])?'checked':''}></td>`).join('')}</tr>`).join('')}</table></div>`:''}`;
  $('#sq').oninput=e=>{const q=e.target.value.toLowerCase();b.querySelectorAll('[data-q]').forEach(r=>r.hidden=!r.dataset.q.includes(q))};
  $('#pa').onclick=async()=>{const {error}=await db.from('cf_profiles').update({role:'student'}).eq('role','visitor');toast(error?error.message:'Done');rolesTab()};
  b.querySelectorAll('[data-u]').forEach(s=>s.onchange=async()=>{const {error}=await db.from('cf_profiles').update({role:s.value}).eq('user_id',s.dataset.u);toast(error?error.message:'Role updated')});
  b.querySelectorAll('[data-r]').forEach(c=>c.onchange=async()=>{const {error}=await db.from('cf_perms').upsert({role:c.dataset.r,perm:c.dataset.p,allowed:c.checked});toast(error?error.message:'Saved')});
}
async function admin(){
  const m=$('#main');let c;try{c=await cached('cfg',()=>db.from('cf_config').select('as_of,announcement,hidden,dates,current').eq('id',1).single())}catch(e){return m.innerHTML=`<p class="muted">${esc(e.message)}</p>`}
  const hid=c.hidden||[],dt=c.dates||{};
  m.innerHTML=`<p class="hi">Admin</p><p class="muted">Import data and manage people in the Officer tab.</p>
  <h2>Dashboard display</h2><label>As of (text shown to students)</label><input id="ao" value="${esc(c.as_of)}"><label>Announcement (optional)</label><textarea id="an" rows="2">${esc(c.announcement)}</textarea><label>Current collection (officer dashboard)</label><select id="cu">${LABELS.map(l=>`<option ${c.current===l?'selected':''}>${esc(l)}</option>`).join('')}</select><label>Show items and due dates</label>
  ${LABELS.map((l,i)=>`<div class="row"><label class="chk"><input type="checkbox" data-h="${i}" ${hid.includes(l)?'':'checked'}>${esc(l)}</label><input data-d="${i}" placeholder="Due date" value="${esc(dt[l]||'')}"></div>`).join('')}<p><button class="btn" id="sv">Save display</button></p>
  <h2>Class code</h2><div class="find"><input id="nc" placeholder="New class code"><button class="btn" id="sc">Set</button></div>`;
  $('#sv').onclick=async()=>{const h=[],d={};LABELS.forEach((l,i)=>{if(!m.querySelector(`[data-h="${i}"]`).checked)h.push(l);const v=m.querySelector(`[data-d="${i}"]`).value.trim();if(v)d[l]=v});
    const {error}=await db.from('cf_config').update({as_of:$('#ao').value,announcement:$('#an').value,hidden:h,dates:d,current:$('#cu').value}).eq('id',1);toast(error?error.message:'Saved')};
  $('#sc').onclick=async()=>{if($('#nc').value.length<4)return toast('Use at least 4 characters');const {error}=await db.rpc('cf_set_code',{p_code:$('#nc').value});toast(error?error.message:'Class code changed')};
}
addEventListener('online',()=>{updOff();flush();if(S.uid)go(S.tab)});addEventListener('offline',updOff);
if(navigator.serviceWorker)navigator.serviceWorker.register('sw.js').catch(()=>{});
boot();
