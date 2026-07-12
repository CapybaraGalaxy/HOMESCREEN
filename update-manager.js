let isUpdating = false;
(() => {

    if (!("serviceWorker" in navigator))
        return;

    let newWorker = null;

    function showUpdateBanner() {

        if (document.getElementById("updateBanner"))
            return;

        const banner = document.createElement("div");

        banner.id = "updateBanner";

        banner.innerHTML = `
            <div class="update-title">
                🚀 Nueva versión disponible
            </div>

            <div class="update-text">
                Se han descargado las últimas mejoras.
            </div>

            <button id="updateNow">
                Actualizar
            </button>
        `;

        document.body.appendChild(banner);

        requestAnimationFrame(() => {
            banner.classList.add("show");
        });

        document
            .getElementById("updateNow")
            .onclick = () => {

                if (!newWorker) return;

                isUpdating = true;

                newWorker.postMessage("SKIP_WAITING");

            };

    }

    navigator.serviceWorker.register("./service-worker.js")
        .then(registration => {

            if (registration.waiting) {

                newWorker = registration.waiting;

                showUpdateBanner();

            }

            registration.addEventListener("updatefound", () => {

                const installing = registration.installing;

                installing.addEventListener("statechange", () => {

                    if (
                        installing.state === "installed" &&
                        navigator.serviceWorker.controller
                    ) {

                        newWorker = installing;

                        showUpdateBanner();

                    }

                });

            });

        });

navigator.serviceWorker.addEventListener(
    "controllerchange",
    () => {

        if (isUpdating) {

            window.location.reload();

        }

    }
);

})();