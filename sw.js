// Service worker: o app abre mesmo com internet ruim (os dados vêm do Supabase, então precisam de conexão).
// Arquivos do próprio app: tenta a rede primeiro (você vê as mudanças logo) e usa o cache se estiver offline.
// Ao mudar a lista abaixo, aumente a versão do CACHE.
const CACHE = 'meu-caixa-v2';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('supabase.co')) return;   // chamadas ao banco nunca passam pelo cache
  const guardar = res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); } return res; };
  if (u.origin === location.origin) e.respondWith(fetch(e.request).then(guardar).catch(() => caches.match(e.request)));
  else e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(guardar)));
});
