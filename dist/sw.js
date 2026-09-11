const CACHE='ca-ngua-static-v2.1.0';
const ASSETS=['/','/style.css','/app.mjs','/engine.mjs','/icons.mjs','/motion.mjs','/geometry.mjs','/horse-geometry.mjs','/board3d.mjs','/board-art.mjs','/turn-status.mjs','/assets/walnut.png','/pwa.mjs','/manifest.webmanifest','/favicon.svg','/pwa/icon-192.png','/pwa/icon-512.png','/pwa/maskable-512.png','/pwa/apple-touch-icon.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{const keys=await caches.keys();await Promise.all(keys.filter(key=>key.startsWith('ca-ngua-static-')&&key!==CACHE).map(key=>caches.delete(key)));await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Never cache room data, SSE streams, credentials or any writes.
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    // A controlled page uses one complete asset version, including offline launches.
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match('/'))||fetch(request)));
  }else if(ASSETS.includes(url.pathname)){
    event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.pathname))||fetch(request)));
  }
});
