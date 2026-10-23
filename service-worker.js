const CACHE_NAME = "homescreen-cache-v6";
const CORE = [
    "./",
    "./index.html",
    "./about.html",
    "./config.html",
    "./games.html",
    "./labs.html",
    "./manifest.json",
    "./favicon.png",
    "./styles.css",
    "./lucide.min.js",
    "./changelog.js",
    "./update-manager.js",
    "./version.json",
    "./vendor/canvas-confetti.min.js",
    "./vendor/pdf.min.js",
    "./vendor/pdf.worker.min.js",
    "./vendor/mammoth.browser.min.js",
    "./vendor/html2canvas.min.js",
    "./vendor/qr-code-styling.js",
    "./Apps/aleatorio.html",
    "./Apps/appmaker.html",
    "./Apps/base64.html",
    "./Apps/binario.html",
    "./Apps/bocetos.html",
    "./Apps/calculadora-descarga.html",
    "./Apps/calendario.html",
    "./Apps/color.html",
    "./Apps/combos.html",
    "./Apps/comparador.html",
    "./Apps/consejos.html",
    "./Apps/contador-palabras.html",
    "./Apps/conversor.html",
    "./Apps/countdown.html",
    "./Apps/counter.html",
    "./Apps/craftpalette.html",
    "./Apps/day-brief.html",
    "./Apps/dinero.html",
    "./Apps/duolingo.html",
    "./Apps/editor-fotos.html",
    "./Apps/estudio-ritmos.html",
    "./Apps/horarios.html",
    "./Apps/html-preview.html",
    "./Apps/icons.html",
    "./Apps/icontest.html",
    "./Apps/kanban.html",
    "./Apps/limpia-textos.html",
    "./Apps/lorem-ipsum.html",
    "./Apps/markdown.html",
    "./Apps/material-you-new.html",
    "./Apps/material-you.html",
    "./Apps/mayus-minus.html",
    "./Apps/medidas.html",
    "./Apps/meme.html",
    "./Apps/metadata.html",
    "./Apps/modchecker.html",
    "./Apps/morse.html",
    "./Apps/notas.html",
    "./Apps/noticias.html",
    "./Apps/num-let.html",
    "./Apps/num-romanos.html",
    "./Apps/paste.html",
    "./Apps/progreso.html",
    "./Apps/qr.html",
    "./Apps/quiz-studio.html",
    "./Apps/rosco.html",
    "./Apps/symbols.html",
    "./Apps/tasks.html",
    "./Apps/text.html",
    "./Apps/tierlist.html",
    "./Apps/tts.html",
    "./Apps/typing.html",
    "./Apps/wingdings.html",
    "./Games/cybersort.html",
    "./Games/memory.html",
    "./Games/neon-blast.html",
    "./Games/neon-corp.html",
    "./Games/neon-match.html",
    "./Games/zero-sum.html",
    "./Media/terminal.html",
    "./Media/transparency.html",
    "./Media/Folder icon.ico",
    "./Media/og.png",
    "./Media/og large.png",
    "./Media/pwa.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE))
            .catch(error => {
                console.error("No se pudieron precargar los recursos offline:", error);
                throw error;
            })
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(async cacheNames => {
                const hasPreviousCache = cacheNames.some(cacheName =>
                    (cacheName.startsWith("homescreen-cache-") || cacheName.startsWith("homescreen-v")) &&
                    cacheName !== CACHE_NAME
                );
                await Promise.all(
                    cacheNames
                        .filter(cacheName =>
                            (cacheName.startsWith("homescreen-cache-") || cacheName.startsWith("homescreen-v")) &&
                            cacheName !== CACHE_NAME
                        )
                        .map(cacheName => caches.delete(cacheName))
                );
                await self.clients.claim();
                if (!hasPreviousCache) return;
                const clients = await self.clients.matchAll({ type: "window" });
                clients.forEach(client => client.postMessage("RELOAD_AFTER_UPDATE"));
            })
    );
});

self.addEventListener("fetch", event => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const isVersionFile = url.pathname.endsWith("/version.json") || url.pathname.endsWith("version.json");
    const isHtml = request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");

    if (isVersionFile || isHtml) {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response.ok) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
                    }
                    return response;
                })
                .catch(async () => {
                    const cachedResponse = await caches.match(request);
                    if (cachedResponse) return cachedResponse;
                    if (request.mode === "navigate") {
                        const homePage = await caches.match("./index.html");
                        if (homePage) return homePage;
                    }
                    return Response.error();
                })
        );
        return;
    }

    event.respondWith(
        caches.match(request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return fetch(request).then(response => {
                if (response.ok) {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
                }
                return response;
            });
        })
    );
});

self.addEventListener("message", event => {
    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
});
