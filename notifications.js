(() => {
    const FEED_URL = "https://raw.githubusercontent.com/CapybaraGalaxy/homescreen-notifications/refs/heads/main/notifications.json";
    const FALLBACK_FEED_URL = "./notifications.json";
    const STATES_STORAGE_KEY = "homescreen.notifications.states.v1";
    const REFRESH_INTERVAL = 30 * 60 * 1000;
    const MIN_CHECK_INTERVAL = 60 * 1000;
    const FALLBACK_ICON = "bell";

    const trigger = document.getElementById("notificationsTrigger");
    const panel = document.getElementById("notificationsPanel");
    const closeButton = document.getElementById("notificationsClose");
    const refreshButton = document.getElementById("notificationsRefresh");
    const refreshStatus = document.getElementById("notificationsRefreshStatus");
    const list = document.getElementById("notificationsList");
    const summary = document.getElementById("notificationsSummary");

    if (!trigger || !panel || !closeButton || !refreshButton || !list || !summary) return;

    let feed = null;
    let notificationStates = readStates();
    let inFlightCheck = null;
    let lastCheckAt = 0;
    let isOpen = false;
    let closeTimer = null;
    let refreshStatusTimer = null;
    let suppressCardClickUntil = 0;
    const notificationAnimationModes = ["fade", "slide-up", "slide-right", "zoom"];
    let savedAnimationMode = null;
    try {
        savedAnimationMode = localStorage.getItem("notificationsAnimation");
    } catch (error) {
        console.warn("No se pudo leer la animación de notificaciones guardada.", error);
    }
    panel.classList.add(`notifications-animation-${notificationAnimationModes.includes(savedAnimationMode) ? savedAnimationMode : "fade"}`);

    function setRefreshIcon(name) {
        const paths = {
            "refresh-cw": ["M20 7v5h-5", "M4 17v-5h5", "M5.64 5.64A9 9 0 0 1 20 12", "M4 12a9 9 0 0 0 14.36 6.36"],
            check: ["m5 12 4 4L19 6"],
            x: ["M18 6 6 18", "m6 6 12 12"]
        };
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        svg.setAttribute("aria-hidden", "true");
        svg.setAttribute("focusable", "false");
        svg.setAttribute("fill", "none");
        svg.setAttribute("stroke", "currentColor");
        svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round");
        svg.setAttribute("stroke-linejoin", "round");
        for (const pathData of paths[name]) {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            path.setAttribute("d", pathData);
            svg.appendChild(path);
        }
        refreshButton.replaceChildren(svg);
    }

    function readJson(key) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            console.warn("No se pudo leer el almacenamiento de notificaciones.", error);
            return null;
        }
    }

    function writeJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn("No se pudo guardar el estado de las notificaciones.", error);
        }
    }

    function isIsoDate(value) {
        return typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value) &&
            Number.isFinite(Date.parse(value));
    }

    function resolveInternalUrl(value) {
        if (typeof value !== "string" || !value.trim() || value.startsWith("/") || value.includes("\\")) return null;
        let appBase;
        let destination;
        try {
            appBase = new URL("./", document.baseURI);
            destination = new URL(value, appBase);
        } catch (error) {
            return null;
        }
        if (destination.origin !== appBase.origin || !destination.pathname.startsWith(appBase.pathname)) return null;
        return destination.href;
    }

    function resolveExternalUrl(value) {
        if (typeof value !== "string") return null;
        try {
            const destination = new URL(value);
            if (!["https:", "http:"].includes(destination.protocol) || !destination.hostname ||
                destination.username || destination.password) return null;
            return destination.href;
        } catch (error) {
            return null;
        }
    }

    function resolveNotificationImage(value) {
        if (typeof value !== "string") return null;
        try {
            const imageUrl = new URL(value);
            if (imageUrl.protocol !== "https:" || !imageUrl.hostname ||
                imageUrl.username || imageUrl.password || !/\.(?:png|jpe?g|svg)$/i.test(imageUrl.pathname)) return null;
            return imageUrl.href;
        } catch (error) {
            return null;
        }
    }

    function validateAction(action) {
        if (!action || typeof action !== "object" || Array.isArray(action)) return null;
        if (action.type === "none") return { type: "none" };
        if (action.type === "internal") {
            const url = resolveInternalUrl(action.url);
            return url ? { type: "internal", url: action.url } : null;
        }
        if (action.type === "external") {
            const url = resolveExternalUrl(action.url);
            return url ? { type: "external", url } : null;
        }
        if (action.type === "changelog") {
            if (action.version !== undefined &&
                (typeof action.version !== "string" || !action.version.trim() || action.version.length > 80)) return null;
            return action.version === undefined
                ? { type: "changelog" }
                : { type: "changelog", version: action.version.trim() };
        }
        return null;
    }

    function canonicalIconName(value) {
        if (typeof value !== "string" || !/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/i.test(value)) return FALLBACK_ICON;
        const canonical = value.split(/[-_]/).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("");
        return window.lucide?.icons?.[canonical] ? value : FALLBACK_ICON;
    }

    function validateFeed(source) {
        if (!source || typeof source !== "object" || Array.isArray(source) ||
            source.schemaVersion !== 1 || typeof source.project !== "string" ||
            !source.project.trim() || !isIsoDate(source.updatedAt) || !Array.isArray(source.notifications)) {
            throw new Error("Formato de notificaciones no válido");
        }
        if (source.notifications.length > 500) throw new Error("El feed contiene demasiadas notificaciones");

        const ids = new Set();
        const notifications = source.notifications.map(item => {
            if (!item || typeof item !== "object" || Array.isArray(item) ||
                typeof item.id !== "string" || !item.id.trim() || item.id.length > 160 ||
                typeof item.type !== "string" || !item.type.trim() || item.type.length > 40 ||
                typeof item.title !== "string" || !item.title.trim() || item.title.length > 200 ||
                typeof item.message !== "string" || item.message.length > 4000 ||
                !isIsoDate(item.date) ||
                (item.expiresAt !== null && !isIsoDate(item.expiresAt)) ||
                typeof item.important !== "boolean") {
                throw new Error("Notificación no válida");
            }
            if (ids.has(item.id)) throw new Error("El feed contiene IDs repetidos");
            ids.add(item.id);
            const action = validateAction(item.action);
            if (!action) throw new Error("Acción de notificación no válida");
            const image = item.image && typeof item.image === "object" && !Array.isArray(item.image)
                ? item.image
                : item.imageUrl
                    ? { url: item.imageUrl, position: item.imagePosition, alt: item.imageAlt }
                    : null;
            let imageUrl = null;
            let imagePosition = "top";
            let imageAlt = "";
            if (image) {
                const resolvedImageUrl = resolveNotificationImage(image.url);
                const validImagePosition = image.position === undefined || ["top", "bottom"].includes(image.position);
                const validImageAlt = image.alt === undefined || (typeof image.alt === "string" && image.alt.length <= 180);
                if (resolvedImageUrl && validImagePosition && validImageAlt) {
                    imageUrl = resolvedImageUrl;
                    imagePosition = image.position || "top";
                    imageAlt = image.alt || "";
                } else {
                    console.warn(`La imagen de la notificación "${item.id}" no es válida; se mostrará sin foto.`);
                }
            }
            return {
                id: item.id,
                type: item.type,
                title: item.title,
                message: item.message,
                date: item.date,
                expiresAt: item.expiresAt,
                icon: canonicalIconName(item.icon),
                important: item.important,
                action,
                imageUrl,
                imagePosition,
                imageAlt
            };
        });

        return {
            schemaVersion: 1,
            project: source.project,
            updatedAt: source.updatedAt,
            notifications
        };
    }

    function readStates() {
        const stored = readJson(STATES_STORAGE_KEY);
        const states = { read: [], dismissed: [] };
        if (stored !== null && (typeof stored !== "object" || Array.isArray(stored))) {
            console.warn("Se ignoró el estado de notificaciones almacenado porque no es válido.");
        } else if (stored && Array.isArray(stored.read) && Array.isArray(stored.dismissed)) {
            states.read = [...new Set(stored.read.filter(id => typeof id === "string"))];
            states.dismissed = [...new Set(stored.dismissed.filter(id => typeof id === "string"))];
        } else if (stored) {
            for (const [key, state] of Object.entries(stored)) {
                if (!key.startsWith("notification:") || !state || typeof state !== "object") continue;
                const id = key.slice("notification:".length);
                if (state.readAt) states.read.push(id);
                if (state.dismissedAt) states.dismissed.push(id);
            }
            states.read = [...new Set(states.read)];
            states.dismissed = [...new Set(states.dismissed)];
            writeJson(STATES_STORAGE_KEY, states);
        }
        try {
            localStorage.removeItem("homescreen.notifications.feed.v1");
        } catch (error) {
            console.warn("No se pudo eliminar el feed de notificaciones almacenado anteriormente.", error);
        }
        return states;
    }

    function isRead(id) {
        return notificationStates.read.includes(id) || notificationStates.dismissed.includes(id);
    }

    function markRead(notifications) {
        let changed = false;
        for (const notification of notifications) {
            if (!notificationStates.read.includes(notification.id)) {
                notificationStates.read.push(notification.id);
                changed = true;
            }
        }
        if (changed) writeJson(STATES_STORAGE_KEY, notificationStates);
        return changed;
    }

    function markVisibleAsRead() {
        markRead(getVisibleNotifications());
    }

    function isPublished(notification, now = Date.now()) {
        const publishedAt = Date.parse(notification.date);
        const expiresAt = notification.expiresAt === null ? null : Date.parse(notification.expiresAt);
        return publishedAt <= now && (expiresAt === null || expiresAt > now);
    }

    function getVisibleNotifications() {
        if (!feed) return [];
        return feed.notifications
            .filter(notification => {
                return isPublished(notification) && !notificationStates.dismissed.includes(notification.id);
            })
            .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    }

    function unreadCount() {
        return getVisibleNotifications().filter(notification => !isRead(notification.id)).length;
    }

    function updateBadge() {
        const count = unreadCount();
        trigger.setAttribute("aria-label", count ? "Notificaciones, hay avisos sin leer" : "Notificaciones");
        trigger.classList.toggle("has-unread", count > 0);
        trigger.setAttribute("aria-description", count ? "Hay avisos nuevos." : "");
    }

    function makeIcon(name, className = "") {
        const icon = document.createElement("i");
        icon.setAttribute("data-lucide", canonicalIconName(name));
        icon.setAttribute("aria-hidden", "true");
        if (className) icon.className = className;
        return icon;
    }

    function updateSummary() {
        const notifications = getVisibleNotifications();
        const unread = notifications.filter(notification => !isRead(notification.id)).length;
        updateBadge();
        summary.textContent = unread
            ? "Hay avisos sin leer"
            : notifications.length
                ? "Estás al día"
                : feed
                    ? "No hay notificaciones disponibles"
                    : "Los avisos aparecerán aquí cuando haya conexión";
    }

    function dismiss(notification, cardElement, direction = 1) {
        const card = [...list.querySelectorAll(".notification-card")]
            .find(item => item.dataset.notificationId === notification.id) || cardElement;
        if (!card || card.classList.contains("is-dismissing")) return;
        const previousIndex = [...list.children].indexOf(card);
        if (notificationStates.dismissed.includes(notification.id)) return;
        notificationStates.dismissed.push(notification.id);
        if (!notificationStates.read.includes(notification.id)) notificationStates.read.push(notification.id);
        writeJson(STATES_STORAGE_KEY, notificationStates);
        card.setAttribute("aria-hidden", "true");
        card.inert = true;
        card.style.transform = "";
        card.style.opacity = "";
        card.style.setProperty("--dismiss-x", `${direction * 36}px`);
        card.style.maxHeight = `${card.offsetHeight}px`;
        card.offsetHeight;
        card.classList.add("is-dismissing");
        card.style.maxHeight = "0px";
        updateSummary();

        if (card.contains(document.activeElement)) closeButton.focus();
        let finished = false;
        const finishDismiss = () => {
            if (finished) return;
            finished = true;
            card.removeEventListener("transitionend", onTransitionEnd);
            card.remove();
            render();
            if (isOpen) {
                const remainingCards = list.querySelectorAll(".notification-card");
                const nextCard = remainingCards[Math.min(previousIndex, remainingCards.length - 1)];
                (nextCard?.querySelector(".notification-card-main") || closeButton).focus();
            }
        };
        const onTransitionEnd = event => {
            if (event.target === card && ["max-height", "opacity"].includes(event.propertyName)) finishDismiss();
        };
        card.addEventListener("transitionend", onTransitionEnd);
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) finishDismiss();
        else window.setTimeout(() => finishDismiss(), 360);
    }

    function closePanel(restoreFocus = true) {
        if (!isOpen) return;
        isOpen = false;
        panel.setAttribute("aria-hidden", "true");
        panel.inert = true;
        panel.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
        window.clearTimeout(closeTimer);
        const closeDelay = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
            document.body.classList.contains("super-performance") ? 0 : 720;
        closeTimer = window.setTimeout(() => {
            if (!isOpen) panel.hidden = true;
        }, closeDelay);
        if (restoreFocus) trigger.focus();
    }

    function performAction(notification) {
        const action = notification.action;
        if (action.type === "internal") {
            closePanel();
            const url = resolveInternalUrl(action.url);
            if (url) window.location.assign(url);
        } else if (action.type === "external") {
            window.open(action.url, "_blank", "noopener,noreferrer");
            closePanel(false);
        } else if (action.type === "changelog" && typeof window.showChangelogModal === "function") {
            closePanel();
            window.showChangelogModal(action.version);
        }
    }

    function renderCard(notification) {
        const card = document.createElement("article");
        card.className = "notification-card";
        card.dataset.notificationId = notification.id;
        card.classList.toggle("is-unread", !isRead(notification.id));
        card.classList.toggle("is-important", notification.important);
        card.setAttribute("role", "listitem");

        const dismissButton = document.createElement("button");
        dismissButton.type = "button";
        dismissButton.className = "notification-dismiss";
        dismissButton.setAttribute("aria-label", "Descartar notificación");
        dismissButton.title = "Descartar notificación";
        dismissButton.appendChild(makeIcon("x"));
        dismissButton.addEventListener("click", () => dismiss(notification, card));

        const mainButton = document.createElement(notification.action.type === "none" ? "div" : "button");
        mainButton.className = "notification-card-main";
        if (notification.action.type === "none") {
            mainButton.classList.add("notification-card-main--static");
            mainButton.tabIndex = -1;
        } else {
            mainButton.type = "button";
        }
        const actionLabels = {
            internal: "Abrir página",
            external: "Abrir enlace",
            changelog: "Ver cambios",
            none: "Notificación"
        };
        if (notification.action.type !== "none") {
            mainButton.setAttribute("aria-label", `${notification.title}. ${actionLabels[notification.action.type]}`);
            mainButton.addEventListener("click", () => {
                if (Date.now() < suppressCardClickUntil) return;
                performAction(notification);
            });
        }

        const icon = makeIcon(notification.icon, "notification-icon");
        const content = document.createElement("div");
        content.className = "notification-content";
        const heading = document.createElement("div");
        heading.className = "notification-card-heading";
        const title = document.createElement("h3");
        title.textContent = notification.title;
        heading.appendChild(title);
        if (notification.important) {
            const important = document.createElement("span");
            important.className = "notification-important";
            important.textContent = "Importante";
            heading.appendChild(important);
        }
        const message = document.createElement("p");
        message.textContent = notification.message;
        const date = document.createElement("time");
        date.className = "notification-date";
        date.dateTime = notification.date;
        date.textContent = new Intl.DateTimeFormat("es-ES", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(new Date(notification.date));
        const image = notification.imageUrl ? document.createElement("img") : null;
        if (image) {
            image.className = `notification-image notification-image--${notification.imagePosition}`;
            image.alt = notification.imageAlt;
            image.loading = "lazy";
            image.decoding = "async";
            image.referrerPolicy = "no-referrer";
            image.addEventListener("error", () => {
                notification.imageUrl = null;
                image.remove();
            }, { once: true });
            image.src = notification.imageUrl;
        }
        content.append(heading);
        if (image?.classList.contains("notification-image--top")) content.append(image);
        content.append(message);
        if (image?.classList.contains("notification-image--bottom")) content.append(image);
        content.append(date);
        const hint = document.createElement("span");
        hint.className = "notification-action-hint";
        hint.textContent = actionLabels[notification.action.type];
        content.appendChild(hint);
        mainButton.append(icon, content);
        card.append(mainButton, dismissButton);

        return card;
    }

    function render() {
        const activeElement = panel.contains(document.activeElement) ? document.activeElement : null;
        const focusedCardId = activeElement?.closest(".notification-card")?.dataset.notificationId;
        const notifications = getVisibleNotifications();
        updateSummary();
        list.replaceChildren();

        if (!notifications.length) {
            const empty = document.createElement("p");
            empty.className = "notifications-empty";
            empty.textContent = feed
                ? "No hay notificaciones disponibles."
                : "Las notificaciones aparecerán aquí cuando haya conexión.";
            list.appendChild(empty);
        } else {
            notifications.forEach(notification => list.appendChild(renderCard(notification)));
        }
        if (window.lucide) window.lucide.createIcons();
        if (isOpen && focusedCardId && activeElement) {
            const card = [...list.querySelectorAll(".notification-card")]
                .find(item => item.dataset.notificationId === focusedCardId);
            (card?.querySelector(".notification-card-main") || closeButton).focus();
        }
    }

    function applyFeed(nextFeed) {
        feed = nextFeed;
        if (isOpen) markVisibleAsRead();
        render();
        updateBadge();
    }

    async function checkFeed(force = false) {
        const now = Date.now();
        if (inFlightCheck) return inFlightCheck;
        if (!force && now - lastCheckAt < MIN_CHECK_INTERVAL) return false;
        lastCheckAt = now;
        inFlightCheck = (async () => {
            const loadFeed = async (url, sourceName) => {
                try {
                    const response = await fetch(url, {
                        cache: "no-store",
                        headers: { Accept: "application/json" }
                    });
                    if (!response.ok) throw new Error(`Error HTTP ${response.status}`);
                    return validateFeed(await response.json());
                } catch (error) {
                    console.warn(`No se pudo cargar el feed ${sourceName} de notificaciones.`, error);
                    return null;
                }
            };
            try {
                const [remoteFeed, localFeed] = await Promise.all([
                    loadFeed(FEED_URL, "remoto"),
                    loadFeed(FALLBACK_FEED_URL, "local")
                ]);
                const availableFeeds = [remoteFeed, localFeed].filter(Boolean);
                if (!availableFeeds.length) {
                    render();
                    return false;
                }
                const byId = new Map();
                for (const source of availableFeeds) {
                    for (const notification of source.notifications) {
                        if (!byId.has(notification.id)) byId.set(notification.id, notification);
                    }
                }
                applyFeed({
                    schemaVersion: 1,
                    project: remoteFeed?.project || localFeed.project,
                    updatedAt: availableFeeds.reduce((latest, source) =>
                        Date.parse(source.updatedAt) > Date.parse(latest) ? source.updatedAt : latest,
                    availableFeeds[0].updatedAt),
                    notifications: [...byId.values()]
                });
                return true;
            } finally {
                inFlightCheck = null;
            }
        })();
        return inFlightCheck;
    }

    function openPanel() {
        window.clearTimeout(closeTimer);
        isOpen = true;
        panel.hidden = false;
        panel.setAttribute("aria-hidden", "false");
        panel.inert = false;
        trigger.setAttribute("aria-expanded", "true");
        markVisibleAsRead();
        render();
        closeButton.focus();
        panel.offsetWidth;
        panel.classList.add("is-open");
    }

    window.openHomescreenNotifications = openPanel;
    window.closeHomescreenNotifications = () => closePanel(false);

    trigger.addEventListener("click", () => {
        if (isOpen) closePanel();
        else openPanel();
    });
    closeButton.addEventListener("click", () => closePanel());
    refreshButton.addEventListener("click", async () => {
        if (refreshButton.disabled) return;
        window.clearTimeout(refreshStatusTimer);
        refreshButton.classList.remove("is-success", "is-error");
        refreshButton.setAttribute("aria-label", "Buscando nuevas noticias");
        refreshButton.setAttribute("title", "Buscando nuevas noticias");
        refreshButton.disabled = true;
        refreshButton.classList.add("is-refreshing");
        if (refreshStatus) refreshStatus.textContent = "Buscando noticias…";
        let succeeded = false;
        try {
            succeeded = await checkFeed(true);
            const message = succeeded ? "Noticias actualizadas" : "No se pudo actualizar";
            if (refreshStatus) refreshStatus.textContent = message;
            refreshButton.classList.add(succeeded ? "is-success" : "is-error");
            refreshButton.setAttribute("aria-label", message);
            refreshButton.setAttribute("title", message);
            setRefreshIcon(succeeded ? "check" : "x");
        } finally {
            refreshButton.disabled = false;
            refreshButton.classList.remove("is-refreshing");
            refreshStatusTimer = window.setTimeout(() => {
                if (refreshStatus) refreshStatus.textContent = "";
                refreshButton.classList.remove("is-success", "is-error");
                refreshButton.setAttribute("aria-label", "Buscar nuevas noticias");
                refreshButton.setAttribute("title", "Buscar nuevas noticias");
                setRefreshIcon("refresh-cw");
            }, 3000);
        }
    });

    let swipe = null;
    list.addEventListener("pointerdown", event => {
        const card = event.target.closest(".notification-card");
        if (!card || event.button !== 0 || card.classList.contains("is-dismissing")) return;
        swipe = {
            card,
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            lastX: event.clientX,
            horizontal: false
        };
    });

    list.addEventListener("pointermove", event => {
        if (!swipe || swipe.pointerId !== event.pointerId) return;
        const deltaX = event.clientX - swipe.startX;
        const deltaY = event.clientY - swipe.startY;
        swipe.lastX = event.clientX;
        if (!swipe.horizontal && Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
            swipe.horizontal = true;
            swipe.card.classList.add("is-swiping");
            swipe.card.setPointerCapture(event.pointerId);
        }
        if (!swipe.horizontal) return;
        if (event.cancelable) event.preventDefault();
        swipe.card.style.transform = `translateX(${deltaX}px)`;
        swipe.card.style.opacity = String(Math.max(0.2, 1 - Math.abs(deltaX) / 240));
    });

    const finishSwipe = event => {
        if (!swipe || swipe.pointerId !== event.pointerId) return;
        const { card, startX, lastX, horizontal } = swipe;
        swipe = null;
        const deltaX = lastX - startX;
        card.classList.remove("is-swiping");
        if (horizontal && Math.abs(deltaX) >= 80) {
            suppressCardClickUntil = Date.now() + 450;
            const notification = feed?.notifications.find(item => item.id === card.dataset.notificationId);
            if (notification) dismiss(notification, card, Math.sign(deltaX));
            return;
        }
        card.style.transform = "";
        card.style.opacity = "";
    };

    list.addEventListener("pointerup", finishSwipe);
    list.addEventListener("pointercancel", finishSwipe);

    document.addEventListener("click", event => {
        const path = event.composedPath();
        if (isOpen && !path.includes(panel) && !path.includes(trigger)) closePanel(false);
    });

    panel.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            event.preventDefault();
            closePanel();
            return;
        }
        if (event.key !== "Tab") return;
        const focusable = [...panel.querySelectorAll("button:not(:disabled), a[href]")];
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkFeed();
    });
    window.addEventListener("online", () => checkFeed(true));
    window.setInterval(() => checkFeed(true), REFRESH_INTERVAL);

    render();
    checkFeed(true);
})();
