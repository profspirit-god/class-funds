/* ====== EDIT THESE TWO (Supabase > Project Settings > API). The anon key is public by design. ====== */
const SUPA_URL='https://jhvmbtfpcdfiazhqufdq.supabase.co', SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impodm1idGZwY2RmaWF6aHF1ZmRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3ODQ3NDEsImV4cCI6MjExMDM2MDc0MX0.GJzSEagna541i8VqDqc_Y7g92uv79XO3t1gKCpNwrh8';
/* ================================================================================================= */
const LABELS=['July class work','August class work','September class work','Event Management – Initial','Event Management – Additional','Membership Fee','Activity Fee','Intrams Day 1 Laro ng Lahi','Intrams Day 2 Laro ng Lahi'];
const FEE_DUES=[40,20]; // Membership, Activity (change if wrong)
// Intrams amount depends on the attendance column: Both = 0, Log In/Out Only = 25, Absent = 50, blank = not shown
const intramsDue=a=>{a=String(a||'').toLowerCase();return/both/.test(a)?0:/only/.test(a)?25:/absent/.test(a)?50:null};
const EVENT_DUES=[50,25]; // amount every student must pay for the two event columns
const db=supabase.createClient(SUPA_URL,SUPA_KEY);
const $=s=>document.querySelector(s), S={tab:'home',online:0,view:null};
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const php=n=>'₱'+Number(n).toLocaleString('en-PH');
const I={menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',home:'<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L3 20l1-4.6A8 8 0 1 1 21 12z"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',chev:'<path d="M6 9l6 6 6-6"/>',send:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>'};
const ic=(n,s=20)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;
let tt;function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('show'),3500)}
function theme(t){if(t)localStorage.setItem('theme',t);const v=localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');document.documentElement.dataset.theme=v;return v}
const idOk=v=>/^\d{2}-?\d{5,6}$/.test(v.trim());

async function boot(){
  theme();
  if(!(await db.auth.getSession()).data.session){const r=await db.auth.signInAnonymously();if(r.error)return $('#app').innerHTML=`<div class="wrap"><h1>Can't connect</h1><p class="muted">${esc(r.error.message)}</p></div>`}
  S.uid=(await db.auth.getUser()).data.user.id;
  const {data:p}=await db.from('cf_profiles').select('name,sid,role').eq('user_id',S.uid).maybeSingle();
  if(!p)return onboard();
  Object.assign(S,p);shell();presence();
  db.channel('msgs').on('postgres_changes',{event:'INSERT',schema:'public',table:'cf_messages'},()=>{if(S.tab==='chat')chat()}).subscribe();
}
function onboard(){
  $('#app').innerHTML=`<div class="wrap"><h1>Class Funds</h1><p class="muted">Check what you need to pay. Enter your details to start.</p>
  <form id="f"><label>Your name</label><input id="n" required maxlength="60" placeholder="Surname, First name (e.g. AFABLE, PAULINE)">
  <label>Student ID</label><input id="i" required inputmode="numeric" placeholder="YY-NNNNN (e.g. 24-03177)"><div class="hint">Format: two digits, a dash, then the rest of your ID number.</div>
  <label>Class code</label><input id="c" required placeholder="Ask your treasurer"><p><button class="btn" style="width:100%">Continue</button></p></form></div>`;
  $('#f').onsubmit=async e=>{e.preventDefault();if(!idOk($('#i').value))return toast('ID format should look like 24-03177');
    const {error}=await db.rpc('cf_register',{p_name:$('#n').value,p_sid:$('#i').value,p_code:$('#c').value});
    if(error)return toast(/wrong code/.test(error.message)?'Wrong class code':error.message);boot()};
}
function presence(){const ch=db.channel('online',{config:{presence:{key:S.uid}}});
  ch.on('presence',{event:'sync'},()=>{S.online=Object.keys(ch.presenceState()).length;const e=$('#eyeN');if(e)e.textContent=S.online}).subscribe(s=>{if(s==='SUBSCRIBED')ch.track({t:Date.now()})})}
function shell(){
  const T=[['home','Dashboard','home'],['chat','Chat','chat'],['help','Help','help'],['admin','Admin','shield']].filter(t=>t[0]==='home'||t[0]==='help'||(t[0]==='chat'&&S.role!=='visitor')||(t[0]==='admin'&&S.role==='admin'));
  $('#app').innerHTML=`<header><button id="bg" aria-label="Menu">${ic('menu',22)}</button><h1>Class Funds</h1><div class="eye" title="People online now">${ic('eye')}<span id="eyeN">${S.online}</span></div></header>
  <div id="menu" hidden><button data-t="settings">Settings</button></div><main id="main"></main><nav>${T.map(t=>`<button data-t="${t[0]}">${ic(t[2])}${t[1]}</button>`).join('')}</nav>`;
  $('#bg').onclick=()=>$('#menu').hidden=!$('#menu').hidden;
  document.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>go(b.dataset.t));go(S.tab);
}
function go(t){S.tab=t;$('#menu').hidden=true;document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));({home,chat,help,admin,settings})[t]()}

function card(d){
  const s=d.student;if(!s)return`<div class="panel">No record found for that ID. Ask the treasurer to check it.</div>`;
  const its=(s.items||[]).filter(i=>!(d.hidden||[]).includes(i.l)),bal=i=>Math.max(i.due-i.paid,0),tot=its.reduce((a,i)=>a+bal(i),0);
  return`${d.announcement?`<div class="note">${esc(d.announcement)}</div>`:''}<div class="hero"><span class="muted">${esc(s.name)} · ${esc(s.sid)}</span><div class="big">${tot?php(tot):'All settled'}</div><span class="muted">${tot?'Amount you still need to pay':'Nothing to pay right now'}${d.as_of?' · as of '+esc(d.as_of):''}</span></div>
  ${its.map(i=>`<details class="item"><summary><span>${esc(i.l)}</span><b class="${bal(i)?'owe':'ok'}">${bal(i)?php(bal(i)):(i.due?'Paid':'Not required')}</b>${ic('chev',16)}</summary><dl><dt>Amount to pay</dt><dd>${php(i.due)}</dd><dt>Paid</dt><dd>${php(i.paid)}</dd><dt>Remaining</dt><dd>${php(bal(i))}</dd>${d.dates?.[i.l]?`<dt>Due date</dt><dd>${esc(d.dates[i.l])}</dd>`:''}</dl></details>`).join('')}`;
}
async function home(){
  const m=$('#main');m.innerHTML='<p class="muted">Loading…</p>';
  const {data:d,error}=await db.rpc('cf_lookup',{p_sid:S.view||S.sid});if(error)return m.innerHTML=`<p class="muted">${esc(error.message)}</p>`;
  m.innerHTML=`<p class="hi">${S.view?'Classmate':'Hi, '+esc(S.name)}</p>${card(d)}<form id="sf" class="find"><input id="q" inputmode="numeric" placeholder="Classmate ID, e.g. 24-03177"><button class="btn">Find</button></form>${S.view?'<button class="link" id="me">Back to my balance</button>':''}`;
  $('#sf').onsubmit=e=>{e.preventDefault();if(!idOk($('#q').value))return toast('ID format should look like 24-03177');S.view=$('#q').value;home()};
  if(S.view)$('#me').onclick=()=>{S.view=null;home()};
}
async function chat(){
  const m=$('#main'),adm=S.role==='admin';let {data:ms}=await db.from('cf_messages').select('*').order('created_at');ms=ms||[];let th=S.uid,list='';
  if(adm){const {data:pr}=await db.from('cf_profiles').select('user_id,name'),nm=Object.fromEntries((pr||[]).map(p=>[p.user_id,p.name])),ids=[...new Set(ms.map(x=>x.thread))];th=ids.includes(S.th)?S.th:ids[0];S.th=th;
    list=`<div class="chips">${ids.map(i=>`<button class="chip ${i===th?'on':''}" data-th="${i}">${esc(nm[i]||'Student')}</button>`).join('')||'<span class="muted">No messages yet</span>'}</div>`}
  m.innerHTML=`${list}<div class="msgs">${ms.filter(x=>x.thread===th).map(x=>`<div class="b ${x.sender===S.uid?'me':''}"><small>${esc(x.sender_name)}${x.is_admin?' · Treasurer':''}</small>${esc(x.body)}</div>`).join('')||'<p class="muted">Send your concern to the treasurer. Only you and the treasurer can see this chat.</p>'}</div>${th?`<form id="cf" class="find"><input id="ci" maxlength="1000" placeholder="Type a message" autocomplete="off"><button class="btn" aria-label="Send">${ic('send')}</button></form>`:''}`;
  m.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{S.th=b.dataset.th;chat()});window.scrollTo(0,document.body.scrollHeight);
  if(th)$('#cf').onsubmit=async e=>{e.preventDefault();const v=$('#ci').value.trim();if(!v)return;const {error}=await db.from('cf_messages').insert({thread:th,sender_name:S.name,is_admin:adm,body:v});if(error)toast(error.message);else chat()};
}
function help(){$('#main').innerHTML=`<p class="hi">Help</p><div class="panel"><b>Why this app exists</b><p class="muted">Classmates kept asking the treasurer how much they still owe. This page shows it any time, so nobody has to ask.</p></div>
  <div class="panel"><b>How to use it</b><p class="muted"><b>Dashboard:</b> your total amount to pay. Tap an item to see its amount, what you paid and the due date if one is set. Use the box at the bottom to check a classmate by ID.<br><b>Chat:</b> message the treasurer privately about a concern. It unlocks when the treasurer approves you; new users start as visitors.<br><b>Eye icon:</b> how many people are online now.<br><b>Settings (top left):</b> dark or light mode, change your name or ID.</p></div>
  <div class="panel"><b>Good to know</b><p class="muted">Balances come from the treasurer's Excel record and are updated by the treasurer, so a payment may take a little time to appear. If something looks wrong, send it in Chat with your receipt. This app stores only your name and ID, and anyone with the class code can look up a student's balance by ID, so please don't share the class code outside the class.</p></div>`}
function settings(){
  const t=theme();$('#main').innerHTML=`<p class="hi">Settings</p><h2>Appearance</h2><div class="seg"><button data-th="light" class="${t==='light'?'on':''}">Light</button><button data-th="dark" class="${t==='dark'?'on':''}">Dark</button></div>
  <h2>Your details</h2><label>Name</label><input id="sn" maxlength="60" value="${esc(S.name)}"><label>Student ID</label><input id="si" value="${esc(S.sid)}" inputmode="numeric" placeholder="24-03177"><p><button class="btn" id="ss">Save</button></p>
  ${S.role==='admin'?'':`<h2>Treasurer</h2><details><summary class="link">Treasurer sign-in</summary><label>Email</label><input id="ae" type="email"><label>Password</label><input id="ap" type="password"><p><button class="btn ghost" id="al">Sign in</button></p></details>`}`;
  document.querySelectorAll('[data-th]').forEach(b=>b.onclick=()=>{theme(b.dataset.th);settings()});
  $('#ss').onclick=async()=>{if(!idOk($('#si').value))return toast('ID format should look like 24-03177');const {error}=await db.rpc('cf_rename',{p_name:$('#sn').value,p_sid:$('#si').value});if(error)return toast(error.message);toast('Saved');boot()};
  if($('#al'))$('#al').onclick=async()=>{const {error}=await db.auth.signInWithPassword({email:$('#ae').value,password:$('#ap').value});if(error)return toast('Sign-in failed');location.reload()};
}
async function admin(){
  const m=$('#main');const {data:c}=await db.from('cf_config').select('as_of,announcement,hidden,dates').eq('id',1).single(),{data:us}=await db.from('cf_profiles').select('user_id,name,sid,role').order('name');
  const hid=c.hidden||[],dt=c.dates||{};
  m.innerHTML=`<p class="hi">Admin</p><h2>Update data</h2><p class="muted">Choose the latest Class Funds Tracker (.xlsx). This replaces all balances shown in the app.</p><input type="file" id="fx" accept=".xlsx"><p id="um" class="muted"></p>
  <h2>Dashboard display</h2><label>As of (text shown to students)</label><input id="ao" value="${esc(c.as_of)}"><label>Announcement (optional)</label><textarea id="an" rows="2">${esc(c.announcement)}</textarea><label>Show items and due dates</label>
  ${LABELS.map((l,i)=>`<div class="row"><label class="chk"><input type="checkbox" data-h="${i}" ${hid.includes(l)?'':'checked'}>${esc(l)}</label><input data-d="${i}" placeholder="Due date" value="${esc(dt[l]||'')}"></div>`).join('')}<p><button class="btn" id="sv">Save display</button></p>
  <h2>Class code</h2><div class="find"><input id="nc" placeholder="New class code"><button class="btn" id="sc">Set</button></div>
  <h2>Users</h2><button class="btn ghost" id="pa">Make all visitors students</button>${(us||[]).map(u=>`<div class="row"><span>${esc(u.name)} <small>${esc(u.sid)}</small></span><select data-u="${u.user_id}">${['visitor','student','admin'].map(r=>`<option ${u.role===r?'selected':''}>${r}</option>`).join('')}</select></div>`).join('')}`;
  $('#fx').onchange=e=>upload(e.target.files[0]);
  $('#sv').onclick=async()=>{const h=[],d={};LABELS.forEach((l,i)=>{if(!m.querySelector(`[data-h="${i}"]`).checked)h.push(l);const v=m.querySelector(`[data-d="${i}"]`).value.trim();if(v)d[l]=v});
    const {error}=await db.from('cf_config').update({as_of:$('#ao').value,announcement:$('#an').value,hidden:h,dates:d}).eq('id',1);toast(error?error.message:'Saved')};
  $('#sc').onclick=async()=>{if($('#nc').value.length<4)return toast('Use at least 4 characters');const {error}=await db.rpc('cf_set_code',{p_code:$('#nc').value});toast(error?error.message:'Class code changed')};
  $('#pa').onclick=async()=>{const {error}=await db.from('cf_profiles').update({role:'student'}).eq('role','visitor');toast(error?error.message:'Done');admin()};
  m.querySelectorAll('[data-u]').forEach(s=>s.onchange=async()=>{const {error}=await db.from('cf_profiles').update({role:s.value}).eq('user_id',s.dataset.u);toast(error?error.message:'Role updated')});
}
async function upload(f){
  const o=$('#um');if(!f)return;o.textContent='Reading file…';
  const ws=XLSX.read(await f.arrayBuffer()).Sheets['Collections'];if(!ws)return o.textContent='Sheet "Collections" not found.';
  const R=XLSX.utils.sheet_to_json(ws,{header:1,defval:null});if(String(R[2]?.[2]).trim()!=='NAME')return o.textContent='Header row not recognized (expected NAME in C3).';
  const out=[],skip=[];
  for(const r of R.slice(3,80)){if(!r[2])continue;const sid=String(r[1]||'').replace(/\D/g,'');if(!sid){skip.push(r[2]);continue}
    const it=[[6,7,0],[10,11,1],[14,15,2]].filter(([d])=>r[d]!=null&&r[d]!=='').map(([d,p,i])=>({l:LABELS[i],due:+r[d],paid:+r[p]||0}));
    [18,19].forEach((c,i)=>it.push({l:LABELS[5+i],due:FEE_DUES[i],paid:+r[c]||0}));
    [[20,21,7],[22,23,8]].forEach(([c,a,k])=>{const d=intramsDue(r[a]);if(d!==null)it.push({l:LABELS[k],due:d,paid:+r[c]||0})});
    [24,25].forEach((c,i)=>it.push({l:LABELS[3+i],due:EVENT_DUES[i],paid:+r[c]||0}));out.push({sid,sid_show:String(r[1]),name:r[2],status:r[3],items:it})}
  let e=(await db.from('cf_students').delete().neq('sid','')).error;if(!e)e=(await db.from('cf_students').insert(out)).error;
  if(e)return o.textContent='Upload failed: '+e.message;
  await db.from('cf_config').update({as_of:new Date().toLocaleDateString('en-PH',{month:'long',day:'numeric',year:'numeric'})}).eq('id',1);
  o.textContent=`Uploaded ${out.length} students.${skip.length?' Skipped (no ID in Excel): '+skip.join('; ')+'.':''}`;
}
boot();
