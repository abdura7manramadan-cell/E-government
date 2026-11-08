const VERSION='zeno-shell-v7';
const asset=path=>new URL(path,self.registration.scope).href;
const HOME=asset('index.html');
const SHELL=['index.html','styles-v7.css','polish.css','routing.css','app-v7.js','manifest.webmanifest','icons/zeno-192.svg','icons/zeno-512.svg'].map(asset);
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('zeno-shell-')&&key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{if(response.ok)caches.open(VERSION).then(cache=>cache.put(HOME,response.clone()));return response}).catch(()=>caches.match(HOME)));return}
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy))}return response}).catch(()=>Response.error())));
});
