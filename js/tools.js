(function () {
    'use strict';

    const nativeTools = [
        { key: 'note', title: 'Nota rápida', icon: 'file-text', open: 'openNote' },
        { key: 'calculator', title: 'Calculadora', icon: 'calculator', open: 'openCalc' },
        { key: 'tasks', title: 'Lista de tareas', icon: 'check-square', open: 'openTasks' },
        { key: 'pomodoro', title: 'Pomodoro', icon: 'timer', open: 'openPomodoro' },
        { key: 'stopwatch', title: 'Cronómetro', icon: 'watch', open: 'openStopwatch' }
    ];

    const anchor = document.getElementById('homescreenToolsAnchor');
    const trigger = document.getElementById('homescreenToolsTrigger');
    if (!anchor || !trigger) return;

    const menu = document.createElement('section');
    menu.id = 'homescreenToolsMenu';
    menu.className = 'hs-tools-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', 'Herramientas flotantes');
    document.body.appendChild(menu);

    let activeView = 'native';
    let currentWindows = [];
    let closeTimer = null;
    let resizeTimer = null;
    let renderRevision = 0;
    let menuHeader;
    let menuBody;
    let windowSection;
    let windowList;
    let shopEntries = [];
    let selectedShopEntry = null;
    let shopQuery = '';
    let shopCategory = 'all';
    let shopStatus = '';

    const shopRoot = 'https://raw.githubusercontent.com/CapybaraGalaxy/homescreen-online/refs/heads/main/custom-tools/';
    const shopCatalogUrl = `${shopRoot}tools.json`;
    const shopCacheKey = 'catalog-v1';
    const shopCacheDuration = 6 * 60 * 60 * 1000;
    const assistantPrompt = 'PLACEHOLDER_PROMPT_HERRAMIENTAS';

    function icon(name, size) {
        const element = document.createElement('i');
        element.setAttribute('data-lucide', name);
        element.setAttribute('aria-hidden', 'true');
        if (size) element.setAttribute('size', String(size));
        return element;
    }

    function refreshIcons() {
        if (window.lucide) window.lucide.createIcons();
    }

    function ensureMenuShell() {
        if (menuBody) return;
        menu.replaceChildren();
        menuHeader = document.createElement('header');
        menuHeader.className = 'hs-tools-menu-header';
        menuBody = document.createElement('div');
        menuBody.className = 'hs-tools-menu-body';
        windowSection = document.createElement('section');
        windowSection.className = 'hs-tools-window-section';
        const title = document.createElement('h3');
        title.textContent = 'Ventanas abiertas';
        windowSection.appendChild(title);
        windowList = document.createElement('div');
        windowList.className = 'hs-tools-window-list';
        windowSection.appendChild(windowList);
        menu.append(menuHeader, menuBody, windowSection);
    }

    function animateMenuUpdate(update) {
        const wasVisible = !menu.hidden && menu.classList.contains('is-open');
        const previousHeight = wasVisible ? menu.getBoundingClientRect().height : 0;
        update();
        if (!wasVisible || !previousHeight) return;

        menu.style.height = 'auto';
        const maxHeight = parseFloat(getComputedStyle(menu).maxHeight);
        const targetHeight = Math.min(menu.scrollHeight, Number.isFinite(maxHeight) ? maxHeight : menu.scrollHeight);
        if (Math.abs(targetHeight - previousHeight) < 2) {
            menu.style.height = '';
            return;
        }
        menu.style.height = `${previousHeight}px`;
        menu.classList.add('is-resizing');
        menu.getBoundingClientRect();
        window.clearTimeout(resizeTimer);
        requestAnimationFrame(() => {
            menu.style.height = `${targetHeight}px`;
            positionMenu();
        });
        resizeTimer = window.setTimeout(() => {
            menu.classList.remove('is-resizing');
            menu.style.height = '';
            positionMenu();
        }, 280);
    }

    function notify(message) {
        window.dispatchEvent(new CustomEvent('homescreen:tool-notify', { detail: { message } }));
    }

    function addHeader(title, back) {
        const header = document.createElement('header');
        header.className = 'hs-tools-menu-header';
        if (back) {
            const backButton = document.createElement('button');
            backButton.type = 'button';
            backButton.className = 'hs-icon-button';
            backButton.setAttribute('aria-label', activeView === 'store-detail' ? 'Volver a la tienda' : 'Volver a herramientas');
            backButton.appendChild(icon('arrow-left'));
            backButton.addEventListener('click', () => {
                activeView = activeView === 'store-detail' ? 'store' : activeView === 'store' ? 'custom' : 'native';
                renderMenu();
            });
            header.appendChild(backButton);
        }
        const heading = document.createElement('h2');
        heading.textContent = title;
        header.appendChild(heading);
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'hs-icon-button';
        closeButton.setAttribute('aria-label', 'Cerrar selector');
        closeButton.appendChild(icon('x'));
        closeButton.addEventListener('click', closeMenu);
        header.appendChild(closeButton);
        return header;
    }

    function makeToolButton(tool, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'hs-tool-launch';
        button.appendChild(icon(tool.icon || 'box'));
        const label = document.createElement('span');
        label.textContent = tool.title;
        button.appendChild(label);
        button.addEventListener('click', onClick);
        return button;
    }

    function renderWindowSection() {
        ensureMenuShell();
        windowSection.hidden = activeView !== 'native' || !currentWindows.length;
        windowList.replaceChildren();
        if (windowSection.hidden) return;
        currentWindows.forEach(item => {
            const row = document.createElement('div');
            row.className = 'hs-tools-window-row';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'hs-tool-launch hs-tool-window-launch';
            button.appendChild(icon(item.icon || 'box'));
            const label = document.createElement('span');
            label.textContent = `${item.title}${item.isMinimized ? ' · Minimizada' : item.isPip ? ' · PiP' : ''}`;
            button.appendChild(label);
            button.addEventListener('click', () => {
                const manager = window.homescreenWindowManager;
                const state = manager?.windows.get(item.id);
                if (!state) return;
                if (state.isPip) manager.exitPipMode(item.id);
                else if (state.isMinimized) {
                    manager.restoreWindow(item.id);
                    manager.focusWindow(item.id);
                } else if (manager.activeWindowId === item.id) manager.minimizeWindow(item.id);
                else manager.focusWindow(item.id);
            });
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'hs-icon-button hs-tools-window-close';
            close.title = 'Cerrar ventana';
            close.setAttribute('aria-label', `Cerrar ${item.title}`);
            close.appendChild(icon('x'));
            close.addEventListener('click', event => {
                event.stopPropagation();
                window.homescreenWindowManager?.closeWindow(item.id);
            });
            row.appendChild(button);
            row.appendChild(close);
            windowList.appendChild(row);
        });
    }

    function addCustomActions(row, tool) {
        const actions = document.createElement('div');
        actions.className = 'hs-tool-actions';
        const items = [
            ['pencil', 'Editar', () => {
                closeMenu();
                window.HomescreenCustomTools.edit(tool.id).catch(error => notify(error.message));
            }],
            ['copy-plus', 'Duplicar', () => window.HomescreenCustomTools.duplicate(tool.id).catch(error => notify(error.message))],
            ['download', 'Exportar HTML', () => window.HomescreenCustomTools.export(tool.id).catch(error => notify(error.message))],
            ['trash-2', 'Eliminar', () => {
                if (window.confirm(`¿Eliminar "${tool.title}"?`)) {
                    window.HomescreenCustomTools.remove(tool.id).catch(error => notify(error.message));
                }
            }]
        ];
        items.forEach(([iconName, label, action]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'hs-icon-button';
            button.title = label;
            button.setAttribute('aria-label', label);
            button.appendChild(icon(iconName));
            button.addEventListener('click', action);
            actions.appendChild(button);
        });
        row.appendChild(actions);
    }

    async function copyAssistantPrompt() {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(assistantPrompt);
            } else {
                const helper = document.createElement('textarea');
                helper.value = assistantPrompt;
                helper.setAttribute('readonly', '');
                helper.style.position = 'fixed';
                helper.style.opacity = '0';
                document.body.appendChild(helper);
                helper.select();
                const copied = document.execCommand('copy');
                helper.remove();
                if (!copied) throw new Error('El navegador no permitió copiar el prompt.');
            }
            notify('Prompt copiado al portapapeles.');
        } catch (error) {
            notify(error.message || 'No se pudo copiar el prompt.');
        }
    }

    function makeCustomToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'hs-store-toolbar';
        const storeButton = document.createElement('button');
        storeButton.type = 'button';
        storeButton.className = 'hs-store-entry';
        storeButton.append(icon('store'), document.createTextNode('Tienda'));
        storeButton.addEventListener('click', () => {
            activeView = 'store';
            renderMenu();
        });
        const promptButton = document.createElement('button');
        promptButton.type = 'button';
        promptButton.className = 'hs-prompt-copy';
        promptButton.append(icon('copy'), document.createTextNode('Copiar prompt IA'));
        promptButton.addEventListener('click', copyAssistantPrompt);
        toolbar.append(storeButton, promptButton);
        return toolbar;
    }

    async function renderCustomTools(revision) {
        const toolbar = makeCustomToolbar();
        const create = document.createElement('button');
        create.type = 'button';
        create.className = 'hs-custom-create';
        create.append(icon('plus'), document.createTextNode('Crear herramienta'));
        create.addEventListener('click', () => {
            closeMenu();
            window.HomescreenCustomTools.create();
        });
        const loading = document.createElement('p');
        loading.className = 'hs-tools-empty';
        loading.textContent = 'Cargando herramientas…';
        animateMenuUpdate(() => menuBody.replaceChildren(toolbar, create, loading));

        let tools;
        try {
            tools = await window.HomescreenCustomTools.list();
        } catch (error) {
            if (revision !== renderRevision || activeView !== 'custom') return;
            const failed = document.createElement('p');
            failed.className = 'hs-tools-empty is-error';
            failed.textContent = error.message || 'No se pudieron cargar las herramientas.';
            animateMenuUpdate(() => menuBody.replaceChildren(toolbar, create, failed));
            return;
        }
        if (revision !== renderRevision || activeView !== 'custom') return;

        const list = document.createElement('div');
        list.className = 'hs-tools-list hs-custom-tools-list';
        if (!tools.length) {
            const empty = document.createElement('p');
            empty.className = 'hs-tools-empty';
            empty.textContent = 'Todavía no has creado herramientas.';
            list.appendChild(empty);
        }
        tools.forEach(tool => {
            const row = document.createElement('div');
            row.className = 'hs-custom-tool-row';
            const launch = makeToolButton({ title: tool.title, icon: tool.icon }, () => {
                try {
                    window.HomescreenCustomTools.open(tool);
                    closeMenu();
                } catch (error) {
                    notify(error.message || 'No se pudo abrir la herramienta.');
                }
            });
            row.appendChild(launch);
            if (tool.source?.type === 'online') {
                const source = document.createElement('span');
                source.className = 'hs-custom-tool-source';
                source.title = 'Instalada desde la tienda';
                source.setAttribute('aria-label', 'Instalada desde la tienda');
                source.appendChild(icon('store'));
                row.appendChild(source);
            }
            addCustomActions(row, tool);
            list.appendChild(row);
        });
        animateMenuUpdate(() => menuBody.replaceChildren(toolbar, create, list));
    }

    function validateCatalog(payload) {
        if (!payload || payload.schemaVersion !== 1 || !Array.isArray(payload.tools) || payload.tools.length > 200) {
            throw new Error('El catálogo de herramientas no tiene un formato válido.');
        }
        const ids = new Set();
        return payload.tools.map(tool => {
            if (!tool || typeof tool !== 'object' || Array.isArray(tool) ||
                typeof tool.id !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(tool.id) || ids.has(tool.id)) {
                throw new Error('El catálogo contiene identificadores no válidos o repetidos.');
            }
            ids.add(tool.id);
            if (tool.status !== undefined && typeof tool.status !== 'string') {
                throw new Error(`El estado de "${tool.id}" no es válido.`);
            }
            if (tool.status === 'disabled') return null;
            if (typeof tool.name !== 'string' || !tool.name.trim() || tool.name.length > 60 ||
                typeof tool.file !== 'string' || !/^[a-z0-9._/-]+\.html$/i.test(tool.file) ||
                tool.file.split('/').some(part => !part || part === '.' || part === '..')) {
                throw new Error(`La ficha de "${tool.id}" está incompleta o no es válida.`);
            }
            const optionalText = ['description', 'category', 'author', 'version'];
            for (const key of optionalText) {
                if (tool[key] !== undefined && (typeof tool[key] !== 'string' || tool[key].length > 500)) {
                    throw new Error(`El campo "${key}" de "${tool.id}" no es válido.`);
                }
            }
            if (tool.icon !== undefined && (typeof tool.icon !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(tool.icon))) {
                throw new Error(`El icono de "${tool.id}" no es válido.`);
            }
            if (tool.tags !== undefined && (!Array.isArray(tool.tags) || tool.tags.length > 30 ||
                tool.tags.some(tag => typeof tag !== 'string' || tag.length > 50))) {
                throw new Error(`Las etiquetas de "${tool.id}" no son válidas.`);
            }
            if (tool.featured !== undefined && typeof tool.featured !== 'boolean') {
                throw new Error(`El campo featured de "${tool.id}" no es válido.`);
            }
            if (tool.order !== undefined && !Number.isFinite(tool.order)) {
                throw new Error(`El orden de "${tool.id}" no es válido.`);
            }
            return {
                id: tool.id,
                name: tool.name.trim(),
                description: tool.description || '',
                category: tool.category || 'Otros',
                tags: tool.tags || [],
                icon: tool.icon || 'box',
                file: tool.file,
                version: tool.version || '1.0.0',
                author: tool.author || '',
                status: tool.status || 'active',
                featured: tool.featured === true,
                order: tool.order || 0
            };
        }).filter(Boolean).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es'));
    }

    async function loadShopCatalog(forceRefresh) {
        const tools = window.HomescreenCustomTools;
        if (!tools) throw new Error('La tienda no está disponible en este momento.');
        let cached = null;
        try {
            cached = await tools.readOnlineCache(shopCacheKey);
        } catch (error) {
            shopStatus = `No se pudo leer la caché: ${error.message}`;
        }

        if (!forceRefresh && cached && Date.now() - Date.parse(cached.fetchedAt) < shopCacheDuration) {
            shopEntries = validateCatalog(cached.catalog);
            shopStatus = `Catálogo guardado · ${new Date(cached.fetchedAt).toLocaleString()}`;
            return;
        }

        try {
            const response = await fetch(shopCatalogUrl, { cache: forceRefresh ? 'no-store' : 'default' });
            if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
            const text = await response.text();
            if (text.length > 512 * 1024) throw new Error('El catálogo supera el límite permitido.');
            const catalog = JSON.parse(text);
            const entries = validateCatalog(catalog);
            const fetchedAt = new Date().toISOString();
            shopEntries = entries;
            shopStatus = `Actualizado · ${new Date(fetchedAt).toLocaleString()}`;
            try {
                await tools.writeOnlineCache(shopCacheKey, { catalog, fetchedAt });
            } catch (error) {
                shopStatus += ` · No se pudo guardar la caché: ${error.message}`;
            }
        } catch (error) {
            if (!cached) throw error;
            shopEntries = validateCatalog(cached.catalog);
            shopStatus = `Sin conexión: mostrando el último catálogo válido · ${new Date(cached.fetchedAt).toLocaleString()}`;
        }
    }

    async function loadShopHtml(entry) {
        const tools = window.HomescreenCustomTools;
        const cacheKey = `tool:${entry.id}:${entry.version}`;
        const cached = await tools.readOnlineCache(cacheKey);
        if (typeof cached?.html === 'string') {
            try {
                tools.validateHtml(cached.html);
                return cached.html;
            } catch (error) {
                console.warn(`La copia en caché de "${entry.name}" no es válida.`, error);
            }
        }

        const url = new URL(entry.file, shopRoot);
        if (url.origin !== new URL(shopRoot).origin || !url.pathname.startsWith(new URL(shopRoot).pathname)) {
            throw new Error('La ruta de la herramienta no pertenece al catálogo.');
        }
        const response = await fetch(url.href, { cache: 'default' });
        if (!response.ok) throw new Error(`La herramienta no está disponible (HTTP ${response.status}).`);
        const html = await response.text();
        if (html.length > 1024 * 1024) throw new Error('La herramienta supera el límite de 1 MB.');
        tools.validateHtml(html);
        try {
            await tools.writeOnlineCache(cacheKey, { html });
        } catch (error) {
            notify(`Se abrió la herramienta, pero no se pudo guardar la caché: ${error.message}`);
        }
        return html;
    }

    function makeStoreBadges(entry) {
        const badges = document.createElement('div');
        badges.className = 'hs-store-badges';
        const add = (label, className) => {
            const badge = document.createElement('span');
            badge.className = `hs-store-badge ${className || ''}`.trim();
            badge.textContent = label;
            badges.appendChild(badge);
        };
        if (entry.featured) add('Destacada', 'featured');
        if (entry.status === 'demo') add('Demostración', 'demo');
        if (entry.status === 'experimental' || entry.tags.some(tag => tag.toLowerCase() === 'experimental')) {
            add('Experimental', 'experimental');
        }
        return badges;
    }

    function renderShopResults(results) {
        results.replaceChildren();
        const query = shopQuery.trim().toLocaleLowerCase('es');
        const filtered = shopEntries.filter(entry => {
            const matchesQuery = !query ||
                `${entry.name} ${entry.description} ${entry.tags.join(' ')}`.toLocaleLowerCase('es').includes(query);
            return matchesQuery && (shopCategory === 'all' || entry.category === shopCategory);
        });
        if (!filtered.length) {
            const empty = document.createElement('p');
            empty.className = 'hs-tools-empty';
            empty.textContent = shopEntries.length ? 'No hay herramientas que coincidan con la búsqueda.' : 'No hay herramientas publicadas en el catálogo.';
            results.appendChild(empty);
            return;
        }
        const list = document.createElement('div');
        list.className = 'hs-tools-list';
        filtered.forEach(entry => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'hs-tool-launch hs-store-tool';
            button.appendChild(icon(entry.icon));
            const info = document.createElement('span');
            info.className = 'hs-store-tool-info';
            const title = document.createElement('span');
            title.className = 'hs-store-tool-title';
            title.appendChild(document.createElement('span'));
            title.firstElementChild.textContent = entry.name;
            const badges = makeStoreBadges(entry);
            title.appendChild(badges);
            info.appendChild(title);
            const description = document.createElement('span');
            description.className = 'hs-store-tool-description';
            description.textContent = entry.description;
            info.appendChild(description);
            button.appendChild(info);
            button.setAttribute('aria-label', `Detalles de ${entry.name}`);
            button.addEventListener('click', () => {
                selectedShopEntry = entry;
                activeView = 'store-detail';
                renderMenu();
            });
            list.appendChild(button);
        });
        results.appendChild(list);
    }

    function renderShopList() {
        const controls = document.createElement('div');
        controls.className = 'hs-store-controls';
        const search = document.createElement('input');
        search.className = 'hs-store-search';
        search.type = 'search';
        search.placeholder = 'Buscar herramientas…';
        search.setAttribute('aria-label', 'Buscar por nombre, descripción o etiquetas');
        search.value = shopQuery;
        search.addEventListener('input', () => {
            shopQuery = search.value;
            renderShopResults(results);
        });
        const categories = [...new Set(shopEntries.map(entry => entry.category))].sort((a, b) => a.localeCompare(b, 'es'));
        if (shopCategory !== 'all' && !categories.includes(shopCategory)) shopCategory = 'all';
        const select = document.createElement('select');
        select.className = 'hs-store-category';
        select.setAttribute('aria-label', 'Filtrar por categoría');
        [['all', 'Todas'], ...categories.map(category => [category, category])].forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            select.appendChild(option);
        });
        select.value = shopCategory;
        select.addEventListener('change', () => {
            shopCategory = select.value;
            renderShopResults(results);
        });
        const refresh = document.createElement('button');
        refresh.type = 'button';
        refresh.className = 'hs-icon-button hs-store-refresh';
        refresh.title = 'Actualizar catálogo';
        refresh.setAttribute('aria-label', 'Actualizar catálogo');
        refresh.appendChild(icon('refresh-cw'));
        refresh.addEventListener('click', () => renderShop(true));
        controls.append(search, select, refresh);

        const status = document.createElement('p');
        status.className = 'hs-store-status';
        status.textContent = shopStatus;
        const results = document.createElement('div');
        results.className = 'hs-store-results';
        renderShopResults(results);
        animateMenuUpdate(() => menuBody.replaceChildren(controls, status, results));
        refreshIcons();
    }

    async function renderShop(forceRefresh) {
        selectedShopEntry = null;
        const revision = ++renderRevision;
        const loading = document.createElement('p');
        loading.className = 'hs-tools-empty';
        loading.textContent = forceRefresh ? 'Actualizando catálogo…' : 'Cargando catálogo…';
        animateMenuUpdate(() => menuBody.replaceChildren(loading));
        try {
            await loadShopCatalog(forceRefresh);
            if (revision !== renderRevision || activeView !== 'store') return;
            renderShopList();
        } catch (error) {
            if (revision !== renderRevision || activeView !== 'store') return;
            const failed = document.createElement('p');
            failed.className = 'hs-tools-empty is-error';
            failed.textContent = `No se pudo cargar el catálogo: ${error.message}`;
            const retry = document.createElement('button');
            retry.type = 'button';
            retry.className = 'hs-secondary-button';
            retry.textContent = 'Reintentar';
            retry.addEventListener('click', () => renderShop(true));
            animateMenuUpdate(() => menuBody.replaceChildren(failed, retry));
        }
    }

    async function renderShopDetail() {
        const entry = selectedShopEntry;
        const revision = ++renderRevision;
        const detail = document.createElement('section');
        detail.className = 'hs-store-detail';
        const title = document.createElement('h3');
        title.textContent = entry.name;
        detail.appendChild(title);
        if (entry.description) {
            const description = document.createElement('p');
            description.textContent = entry.description;
            detail.appendChild(description);
        }
        detail.appendChild(makeStoreBadges(entry));
        [['Categoría', entry.category], ['Versión', entry.version], ['Autor', entry.author]]
            .filter(([, value]) => value)
            .forEach(([label, value]) => {
                const line = document.createElement('p');
                line.textContent = `${label}: ${value}`;
                detail.appendChild(line);
            });
        if (entry.tags.length) {
            const tags = document.createElement('p');
            tags.className = 'hs-store-tags';
            tags.textContent = `Etiquetas: ${entry.tags.join(', ')}`;
            detail.appendChild(tags);
        }
        const status = document.createElement('p');
        status.className = 'hs-store-status';
        status.textContent = 'El documento se descargará y validará al abrirlo o añadirlo.';
        detail.appendChild(status);
        const actions = document.createElement('div');
        actions.className = 'hs-store-detail-actions';
        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'hs-primary-button';
        open.textContent = 'Abrir';
        const install = document.createElement('button');
        install.type = 'button';
        install.className = 'hs-secondary-button';
        install.textContent = 'Añadir a mis herramientas';
        actions.append(open, install);
        detail.appendChild(actions);
        animateMenuUpdate(() => menuBody.replaceChildren(detail));

        let installed;
        try {
            installed = await window.HomescreenCustomTools.findOnlineInstall(entry.id);
        } catch (error) {
            status.classList.add('is-error');
            status.textContent = `No se pudo comprobar si está instalada: ${error.message}`;
        }
        if (revision !== renderRevision || activeView !== 'store-detail') return;
        let update = null;
        if (installed) {
            status.textContent = `Ya está en tus herramientas · versión ${installed.source.version}`;
            install.textContent = installed.source.version === entry.version
                ? `Añadida · v${installed.source.version}`
                : `Actualizar a v${entry.version}`;
            install.disabled = installed.source.version === entry.version;
            if (!install.disabled) update = true;
        }

        const run = async action => {
            open.disabled = true;
            install.disabled = true;
            status.classList.remove('is-error');
            status.textContent = 'Descargando y validando la herramienta…';
            try {
                const html = await loadShopHtml(entry);
                const payload = { catalogId: entry.id, name: entry.name, version: entry.version, html };
                if (action === 'open') {
                    await window.HomescreenCustomTools.openOnlineTool(payload);
                    closeMenu();
                    return;
                }
                if (update) {
                    if (!window.confirm(`Actualizar "${entry.name}" a la versión ${entry.version}? El código de la copia instalada se sustituirá y sus datos persistentes se conservarán.`)) {
                        status.textContent = `Actualización cancelada · versión ${installed.source.version}`;
                        return;
                    }
                    await window.HomescreenCustomTools.updateOnlineTool(installed.id, payload);
                    status.textContent = `Actualizada a la versión ${entry.version}.`;
                } else {
                    const result = await window.HomescreenCustomTools.installOnlineTool(payload);
                    status.textContent = result.alreadyInstalled
                        ? `Ya está en tus herramientas · versión ${result.tool.source.version}`
                        : 'Añadida a tus herramientas personalizadas.';
                }
                renderShopDetail();
            } catch (error) {
                status.classList.add('is-error');
                status.textContent = error.message || 'No se pudo obtener la herramienta.';
            } finally {
                open.disabled = false;
                if (activeView === 'store-detail' && install.textContent !== `Añadida · v${entry.version}`) {
                    install.disabled = false;
                }
            }
        };
        open.addEventListener('click', () => run('open'));
        install.addEventListener('click', () => run('install'));
        refreshIcons();
    }

    function renderMenu() {
        ensureMenuShell();
        const revision = ++renderRevision;
        const headerTitle = activeView === 'native' ? 'Herramientas'
            : activeView === 'custom' ? 'Herramientas personalizadas'
                : activeView === 'store-detail' && selectedShopEntry ? selectedShopEntry.name : 'Tienda';
        const back = activeView !== 'native';
        const nextHeader = addHeader(headerTitle, back);
        menuHeader.replaceWith(nextHeader);
        menuHeader = nextHeader;
        windowSection.hidden = activeView !== 'native';
        if (activeView === 'native') {
            const customButton = document.createElement('button');
            customButton.type = 'button';
            customButton.className = 'hs-custom-tools-link';
            customButton.append(icon('code-xml'), document.createTextNode('Herramientas personalizadas'), icon('chevron-right'));
            customButton.addEventListener('click', () => {
                activeView = 'custom';
                renderMenu();
            });

            const list = document.createElement('div');
            list.className = 'hs-tools-list';
            nativeTools.forEach(tool => {
                list.appendChild(makeToolButton(tool, () => {
                    const launcher = window.homescreenNativeTools;
                    if (!launcher || typeof launcher[tool.open] !== 'function') {
                        notify('La herramienta todavía no está disponible.');
                        return;
                    }
                    launcher[tool.open]();
                    closeMenu();
                }));
            });
            animateMenuUpdate(() => menuBody.replaceChildren(customButton, list));
            renderWindowSection();
        } else if (activeView === 'custom') {
            renderCustomTools(revision);
            renderWindowSection();
        } else if (activeView === 'store') {
            renderWindowSection();
            renderShop(false);
        } else {
            renderWindowSection();
            renderShopDetail();
        }

        refreshIcons();
        positionMenu();
    }

    function positionMenu() {
        const rect = trigger.getBoundingClientRect();
        const width = Math.min(380, window.innerWidth - 32);
        const spaceAbove = Math.max(0, rect.top - 20);
        const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - 20);
        menu.style.width = `${width}px`;
        menu.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`;
        if (spaceAbove >= 220 || spaceAbove >= spaceBelow) {
            menu.style.top = 'auto';
            menu.style.bottom = `${window.innerHeight - rect.top + 10}px`;
            menu.style.maxHeight = `${Math.max(80, spaceAbove)}px`;
        } else {
            menu.style.top = `${rect.bottom + 10}px`;
            menu.style.bottom = 'auto';
            menu.style.maxHeight = `${Math.max(80, spaceBelow)}px`;
        }
    }

    function openMenu() {
        window.clearTimeout(closeTimer);
        activeView = 'native';
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        renderMenu();
        requestAnimationFrame(() => menu.classList.add('is-open'));
    }

    function closeMenu() {
        if (menu.hidden) return;
        menu.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => { menu.hidden = true; }, 180);
    }

    trigger.addEventListener('click', event => {
        event.stopPropagation();
        if (menu.hidden) openMenu();
        else closeMenu();
    });

    document.addEventListener('pointerdown', event => {
        if (!menu.hidden && !menu.contains(event.target) && !anchor.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !menu.hidden) {
            closeMenu();
            trigger.focus();
        }
    });
    window.addEventListener('resize', () => {
        if (!menu.hidden) positionMenu();
    }, { passive: true });

    window.addEventListener('homescreen:windows-change', event => {
        currentWindows = event.detail.windows;
        if (!menu.hidden && activeView === 'native') {
            animateMenuUpdate(renderWindowSection);
            refreshIcons();
            positionMenu();
        }
    });
    window.addEventListener('homescreen:custom-tools-change', () => {
        if (!menu.hidden && activeView === 'custom') renderMenu();
    });
    window.addEventListener('homescreen:tool-notify', event => {
        const toast = document.getElementById('homescreenToast');
        if (!toast) return;
        toast.textContent = String(event.detail?.message || 'Herramienta actualizada');
        toast.classList.add('show');
        window.clearTimeout(toast._hsToolsToastTimer);
        toast._hsToolsToastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
    });
})();
