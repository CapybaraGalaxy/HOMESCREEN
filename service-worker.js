const CACHE_NAME = "homescreen-v2";

const CORE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./favicon.png",
    "./games.html"
];

// ---------- INSTALL ----------
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CORE))
    );
});

// ---------- ACTIVATE ----------
self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

// ---------- FETCH ----------
self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") return;

    event.respondWith(

        caches.match(event.request).then(cache => {

            const networkFetch = fetch(event.request)
                .then(response => {

                    if (
                        response &&
                        response.status === 200 &&
                        event.request.url.startsWith(self.location.origin)
                    ) {

                        caches.open(CACHE_NAME).then(c => {
                            c.put(event.request, response.clone());
                        });

                    }

                    return response;

                })
                .catch(() => cache);

            return cache || networkFetch;

        })

    );

});

// ---------- UPDATE ----------
self.addEventListener("message", event => {

    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }

});