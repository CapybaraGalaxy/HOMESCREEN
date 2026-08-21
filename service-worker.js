// Cambia este número cada vez que lances una nueva versión:
const VERSION = "1.5.1.2";
const CACHE_NAME = `homescreen-v${VERSION}`;

// Archivos esenciales para que la app cargue sin conexión
const CORE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./favicon.png",
    "./style.css",
    "./pwa.png",
    "./games.html",
    "./version.json"
];

// ---------- INSTALL ----------
self.addEventListener("install", event => {
    // Forzar a que el nuevo Service Worker se active lo antes posible
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CORE))
    );
});

// ---------- ACTIVATE (Solución al Fallo 2) ----------
self.addEventListener("activate", event => {
    event.waitUntil(
        // Buscar todas las cachés guardadas
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    // Si el nombre de la caché no coincide con la versión actual, se elimina
                    if (cache !== CACHE_NAME) {
                        console.log("Eliminando caché antigua:", cache);
                        return caches.delete(cache);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// ---------- FETCH ----------
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);
    const sameOrigin = url.origin === self.location.origin;
    if (!sameOrigin) return;

    // HTML siempre actualizado desde la red
    if (event.request.headers.get("accept")?.includes("text/html")) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, clone);
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // version.json siempre desde red sin guardar en caché persistente
    if (url.pathname.endsWith("/version.json") || url.pathname.endsWith("version.json")) {
        event.respondWith(
            fetch(event.request, { cache: "no-store" })
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Todo lo demás: busca en caché primero, si no está, va a la red
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then(response => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, clone);
                });
                return response;
            });
        })
    );
});

// ---------- UPDATE / MESSAGES ----------
self.addEventListener("message", event => {
    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
});