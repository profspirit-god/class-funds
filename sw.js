const C='cf-v5',CORE=['./','index.html','style.css','app.js','manifest.webmanifest','icon-192.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>clients.claim()))});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!=='GET')return;
  const put=x=>{const y=x.clone();caches.open(C).then(c=>c.put(r,y));return x};
  if(u.origin===location.origin)e.respondWith(fetch(r).then(put).catch(()=>caches.match(r).then(m=>m||caches.match('index.html'))));
  else if(/cdn\.jsdelivr\.net|cdnjs\.cloudflare\.com/.test(u.host))e.respondWith(fetch(r).then(put).catch(()=>caches.match(r)))});
