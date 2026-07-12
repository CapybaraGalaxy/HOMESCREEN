const CACHE_NAME = "homescreen";

const CORE = [
    "./",
    "./index.html",
    "./manifest.json",
    "./favicon.png",
    "./games.html",
    "./version.json"
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

    if (event.request.method !== "GET")
        return;


    const url = new URL(event.request.url);


    // HTML siempre actualizado
    if (
        event.request.headers.get("accept")?.includes("text/html")
    ) {

        event.respondWith(

            fetch(event.request)
            .then(response => {

                const clone = response.clone();

                caches.open(CACHE_NAME)
                    .then(cache => {
                        cache.put(event.request, clone);
                    });

                return response;

            })
            .catch(() =>
                caches.match(event.request)
            )

        );

        return;
    }


    // Todo lo demás: cache primero
    event.respondWith(

        caches.match(event.request)
        .then(cache => {

            return cache || fetch(event.request)
                .then(response => {

                    const clone = response.clone();

                    caches.open(CACHE_NAME)
                    .then(c =>
                        c.put(event.request, clone)
                    );

                    return response;

                });

        })

    );

});

// ---------- UPDATE ----------
self.addEventListener("message", event => {

    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }

});