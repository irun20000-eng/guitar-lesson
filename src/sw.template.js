// 인터넷 없이 열기(서비스 워커). build.mjs가 이 틀에서 sw.js를 만든다. sw.js를 직접 고치지 않는다.
// 화면(index.html)은 늘 새 판을 먼저 받아 보고, 연결이 없을 때만 저장본을 쓴다(새로 올린 판이 바로 보이게).
// 아이콘과 manifest는 저장본을 먼저 쓴다. 판이 바뀌면 VERSION이 바뀌어 옛 저장본을 지운다.
const VERSION = '__VERSION__';
const CACHE = 'yeoseotjul-' + VERSION;
const FILES = __FILES__;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('yeoseotjul-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((cache) => cache.put('./', copy)); }
        return res;
      })
      .catch(() => caches.match('./').then((hit) => hit || caches.match('index.html'))));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});