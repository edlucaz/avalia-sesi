// Service worker simples: guarda o "shell" do app (login, ícones, manifest)
// pra abrir mesmo sem internet, e usa stale-while-revalidate pras páginas já
// visitadas. Não tenta sincronizar respostas de prova offline — isso fica
// pra uma fase futura, exige fila de reenvio pra não arriscar perder nota.
const CACHE_NAME = "avalia-sesi-v1";
const PRECACHE_URLS = [
  "/login",
  "/manifest.json",
  "/sesi-logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // POST (responder/enviar) sempre vai direto pra rede

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // deixa as chamadas pro backend passarem direto

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cacheado = await cache.match(request);
      const buscaRede = fetch(request)
        .then((resposta) => {
          if (resposta.ok) cache.put(request, resposta.clone());
          return resposta;
        })
        .catch(() => cacheado);
      return cacheado || buscaRede;
    })
  );
});
