let isUpdating = false;
let newWorker = null;
let currentRegistration = null;

function showHomescreenToast(message, duration = 2600) {
    const existingToast = document.getElementById("homescreenToast");
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement("div");
    toast.id = "homescreenToast";
    toast.innerHTML = `<span>${message}</span>`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    window.setTimeout(() => {
        toast.classList.remove("show");
        window.setTimeout(() => toast.remove(), 250);
    }, duration);
}

async function getVersionInfo() {
    try {
        const response = await fetch("./version.json", { cache: "no-store" });
        if (!response.ok) {
            throw new Error("No se pudo cargar version.json");
        }
        return await response.json();
    } catch (error) {
        return { version: "", changes: [] };
    }
}

async function showUpdateBanner(info = null) {
    if (document.getElementById("updateBanner")) {
        return;
    }

    const versionInfo = info || await getVersionInfo();
    const banner = document.createElement("div");
    banner.id = "updateBanner";

    banner.innerHTML = `
        <div class="update-title">
            🚀 HOMESCREEN ${versionInfo.version || ""}
        </div>

        <div class="update-text">
            Nueva versión disponible
            ${versionInfo.changes?.length ? "<br><br>" + versionInfo.changes.map(c => "✓ " + c).join("<br>") : ""}
        </div>

        <button id="updateNow">
            Actualizar
        </button>
    `;

    document.body.appendChild(banner);

    requestAnimationFrame(() => {
        banner.classList.add("show");
    });

    document.getElementById("updateNow").onclick = () => {
        if (newWorker) {
            newWorker.postMessage("SKIP_WAITING");
        }
    };
}

function canUseServiceWorker() {
    if (!("serviceWorker" in navigator)) {
        return false;
    }

    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    return protocol === "https:" || (
        protocol === "http:" && (
            hostname === "localhost" ||
            hostname === "127.0.0.1" ||
            hostname === "::1" ||
            hostname === "[::1]"
        )
    );
}

async function ensureRegistration() {
    if (currentRegistration) {
        return currentRegistration;
    }

    if (!canUseServiceWorker()) {
        return null;
    }

    currentRegistration = await navigator.serviceWorker.getRegistration();

    if (!currentRegistration) {
        currentRegistration = await navigator.serviceWorker.register("./service-worker.js");
    }

    return currentRegistration;
}

async function checkForUpdates(options = {}) {
    const { showToast = false, registration = null } = options;

    if (!canUseServiceWorker()) {
        if (showToast) {
            await new Promise(resolve => setTimeout(resolve, 700));
            showHomescreenToast("✓ Ya tienes la última versión");
        }
        return { available: false, checked: false };
    }

    const activeRegistration = registration || await ensureRegistration();

    if (!activeRegistration) {
        if (showToast) {
            await new Promise(resolve => setTimeout(resolve, 700));
            showHomescreenToast("✓ Ya tienes la última versión");
        }
        return { available: false, checked: false };
    }

    try {
        await activeRegistration.update();
    } catch (error) {
        console.warn("No se pudo comprobar la actualización:", error);
    }

    if (activeRegistration.waiting) {
        newWorker = activeRegistration.waiting;
        const versionInfo = await getVersionInfo();
        await showUpdateBanner(versionInfo);
        return { available: true, checked: true };
    }

    if (showToast) {
        showHomescreenToast("✓ Ya tienes la última versión");
    }

    return { available: false, checked: true };
}

window.checkForUpdates = checkForUpdates;
window.showHomescreenToast = showHomescreenToast;
window.getVersionInfo = getVersionInfo;

(() => {
    if (!("serviceWorker" in navigator)) {
        return;
    }

    ensureRegistration()
        .then(registration => {
            if (!registration) {
                return;
            }

            registration.addEventListener("updatefound", () => {
                const installing = registration.installing;
                if (!installing) {
                    return;
                }

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

            return checkForUpdates({ showToast: false, registration });
        })
        .catch(error => {
            console.warn("No se pudo inicializar el gestor de actualizaciones:", error);
        });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (isUpdating) {
            window.location.reload();
        }
    });
})();