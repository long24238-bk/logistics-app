// 홈 화면 추가(앱 설치)를 위한 최소 서비스워커 — 항상 최신 내용을 서버에서 받아옵니다.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => { if (e.request.method === 'GET') e.respondWith(fetch(e.request)); });
