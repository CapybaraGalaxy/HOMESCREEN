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
    const response = await fetch("./version.json", { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`No se pudo cargar version.json: ${response.status}`);
    }
    const info = await response.json();
    if (!info || typeof info !== "object" || !Array.isArray(info.releases)) {
        throw new Error("version.json no contiene el array releases");
    }
    return info;
}

function getUpdateHighlights(info) {
    const latestRelease = info.releases[0];
    if (!latestRelease) return [];
    return latestRelease.sections
        .flatMap(section => String(section.content || "").split(/\n+/))
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => line.replace(/^[-*+]\s+/, ""))
        .slice(0, 3);
}

async function showUpdateBanner(info = null) {
    if (document.getElementById("updateBanner")) {
        return;
    }

    const versionInfo = info || await getVersionInfo();
    const banner = document.createElement("div");
    banner.className = "update-banner";
    banner.id = "updateBanner";

    const title = document.createElement("div");
    title.className = "update-title";
    const currentVersion = document.getElementById("versionTag")?.textContent.trim();
    const latestRelease = versionInfo.releases[0];
    const isNewRelease = latestRelease?.version && latestRelease.version !== currentVersion;
    title.textContent = isNewRelease
        ? `Nueva versión ${latestRelease.version}`
        : "Actualización de Homescreen disponible";
    const description = document.createElement("div");
    description.className = "update-text";
    description.textContent = "La actualización está descargada y lista para instalar.";
    const highlights = getUpdateHighlights(versionInfo);
    if (highlights.length) {
        const list = document.createElement("ul");
        list.className = "update-highlights";
        highlights.forEach(highlight => {
            const item = document.createElement("li");
            item.textContent = highlight;
            list.appendChild(item);
        });
        description.appendChild(list);
    }
    const actions = document.createElement("div");
    actions.className = "update-banner-actions";
    const updateButton = document.createElement("button");
    updateButton.id = "updateNow";
    updateButton.type = "button";
    updateButton.textContent = "Actualizar ahora";
    const changelogButton = document.createElement("button");
    changelogButton.className = "update-secondary";
    changelogButton.type = "button";
    changelogButton.textContent = "Ver cambios";
    changelogButton.addEventListener("click", () => {
        document.getElementById("updateBanner")?.remove();
        document.getElementById("showChangelogBtn")?.click();
    });
    actions.append(updateButton, changelogButton);
    banner.append(title, description, actions);

    document.body.appendChild(banner);

    requestAnimationFrame(() => {
        banner.classList.add("show");
    });

    updateButton.addEventListener("click", () => {
        const waitingWorker = newWorker || currentRegistration?.waiting;
        if (!waitingWorker) {
            showHomescreenToast("La actualización ya no está disponible. Vuelve a comprobar.");
            banner.remove();
            return;
        }
        updateButton.disabled = true;
        updateButton.textContent = "Instalando…";
        waitingWorker.postMessage("SKIP_WAITING");
    });
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
            showHomescreenToast("No se pueden comprobar actualizaciones en este navegador.");
        }
        return { available: false, checked: false };
    }

    const activeRegistration = registration || await ensureRegistration();

    if (!activeRegistration) {
        if (showToast) {
            await new Promise(resolve => setTimeout(resolve, 700));
            showHomescreenToast("No se encontró el servicio de actualizaciones.");
        }
        return { available: false, checked: false };
    }

    try {
        await activeRegistration.update();
    } catch (error) {
        console.warn("No se pudo comprobar la actualización:", error);
        if (showToast) {
            showHomescreenToast("No se pudo comprobar si hay actualizaciones. Revisa tu conexión.");
        }
        return { available: false, checked: false };
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

    navigator.serviceWorker.addEventListener("message", event => {
        if (event.data === "RELOAD_AFTER_UPDATE") {
            window.location.reload();
        }
    });

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

})();