(function () {
    'use strict';

    const databaseName = 'homescreen-custom-tools';
    const databaseVersion = 2;
    const maximumHtmlSize = 1024 * 1024;
    const maximumDataSize = 64 * 1024;
    const instances = new Map();
    let databasePromise;
    let editor;
    let editorMode = 'create';
    let editingId = null;
    let validatedTool = null;

    function openDatabase() {
        if (databasePromise) return databasePromise;
        databasePromise = new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error('Este navegador no permite guardar herramientas personalizadas.'));
                return;
            }
            const request = indexedDB.open(databaseName, databaseVersion);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains('tools')) {
                    request.result.createObjectStore('tools', { keyPath: 'id' });
                }
                if (!request.result.objectStoreNames.contains('onlineCache')) {
                    request.result.createObjectStore('onlineCache', { keyPath: 'key' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('No se pudo abrir la base de herramientas.'));
        });
        return databasePromise;
    }

    async function readAll() {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const request = db.transaction('tools', 'readonly').objectStore('tools').getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('No se pudieron leer las herramientas.'));
        });
    }

    async function readTool(id) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const request = db.transaction('tools', 'readonly').objectStore('tools').get(id);
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error || new Error('No se pudo leer la herramienta.'));
        });
    }

    async function writeTool(tool) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('tools', 'readwrite');
            transaction.objectStore('tools').put(tool);
            transaction.oncomplete = () => resolve(tool);
            transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar la herramienta.'));
            transaction.onabort = () => reject(transaction.error || new Error('Se canceló el guardado de la herramienta.'));
        });
    }

    async function setToolData(toolId, key, value) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('tools', 'readwrite');
            const store = transaction.objectStore('tools');
            const request = store.get(toolId);
            request.onsuccess = () => {
                const tool = request.result;
                if (!tool) {
                    transaction.abort();
                    reject(new Error('La herramienta ya no existe.'));
                    return;
                }
                try {
                    tool.data = tool.data && typeof tool.data === 'object' ? tool.data : {};
                    tool.data[key] = safeData(value);
                    if (JSON.stringify(tool.data).length > maximumDataSize) {
                        throw new Error('El almacenamiento total de la herramienta supera 64 KB.');
                    }
                    store.put(tool);
                } catch (error) {
                    transaction.abort();
                    reject(error);
                }
            };
            request.onerror = () => reject(request.error || new Error('No se pudieron leer los datos.'));
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('No se pudieron guardar los datos.'));
        });
    }

    async function removeTool(id) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('tools', 'readwrite');
            transaction.objectStore('tools').delete(id);
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('No se pudo eliminar la herramienta.'));
        });
    }

    async function readOnlineCache(key) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const request = db.transaction('onlineCache', 'readonly').objectStore('onlineCache').get(key);
            request.onsuccess = () => resolve(request.result?.value ?? null);
            request.onerror = () => reject(request.error || new Error('No se pudo leer la caché de la tienda.'));
        });
    }

    async function writeOnlineCache(key, value) {
        const db = await openDatabase();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction('onlineCache', 'readwrite');
            transaction.objectStore('onlineCache').put({ key, value, cachedAt: new Date().toISOString() });
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('No se pudo guardar la caché de la tienda.'));
        });
    }

    function validateMetadata(documentNode) {
        const element = documentNode.querySelector('meta[name="homescreen-tool"]');
        if (!element) throw new Error('Falta la etiqueta meta name="homescreen-tool".');

        let metadata;
        try {
            metadata = JSON.parse(element.content);
        } catch (error) {
            throw new Error('El contenido de los metadatos no es JSON válido.');
        }
        if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || metadata.version !== 1) {
            throw new Error('La versión de metadatos debe ser 1.');
        }
        if (typeof metadata.title !== 'string' || !metadata.title.trim() || metadata.title.length > 60) {
            throw new Error('El nombre debe tener entre 1 y 60 caracteres.');
        }
        if (typeof metadata.icon !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(metadata.icon)) {
            throw new Error('El icono debe ser un nombre Lucide válido.');
        }
        const dimensions = ['width', 'height', 'minWidth', 'minHeight'];
        for (const key of dimensions) {
            if (metadata[key] !== undefined &&
                (!Number.isInteger(metadata[key]) || metadata[key] < 180 || metadata[key] > 1200)) {
                throw new Error(`El valor "${key}" debe ser un entero entre 180 y 1200.`);
            }
        }
        if ((metadata.minWidth || 260) > (metadata.width || 340) ||
            (metadata.minHeight || 220) > (metadata.height || 360)) {
            throw new Error('El tamaño mínimo no puede superar el tamaño inicial.');
        }
        if (metadata.supportsPip !== undefined && typeof metadata.supportsPip !== 'boolean') {
            throw new Error('supportsPip debe ser true o false.');
        }

        return {
            version: 1,
            title: metadata.title.trim(),
            icon: metadata.icon,
            width: metadata.width || 340,
            height: metadata.height || 360,
            minWidth: metadata.minWidth || 260,
            minHeight: metadata.minHeight || 220,
            supportsPip: metadata.supportsPip === true
        };
    }

    function validateHtml(html) {
        if (typeof html !== 'string' || !html.trim()) throw new Error('Pega un documento HTML completo.');
        if (html.length > maximumHtmlSize) throw new Error('El documento supera el límite de 1 MB.');

        const documentNode = new DOMParser().parseFromString(html, 'text/html');
        if (documentNode.querySelector('parsererror')) throw new Error('No se pudo interpretar el documento HTML.');
        if (documentNode.querySelector('base, iframe, frame, object, embed, portal, meta[http-equiv="refresh"], [ping], link[rel~="stylesheet"]')) {
            throw new Error('El documento contiene elementos de navegación o carga externa no permitidos.');
        }
        for (const element of documentNode.querySelectorAll('script[src], [srcdoc]')) {
            throw new Error('Los scripts deben estar incluidos dentro del propio documento.');
        }
        for (const element of documentNode.querySelectorAll('[src], [href], [poster], [srcset], [xlink\\:href]')) {
            for (const attribute of ['src', 'href', 'poster', 'srcset', 'xlink:href']) {
                const value = element.getAttribute(attribute)?.trim();
                if (!value) continue;
                const external = /^(?:https?:)?\/\//i.test(value) || /^[a-z][a-z0-9+.-]*:/i.test(value);
                const isExplicitWebLink = element.localName === 'a' && attribute === 'href' && /^https:\/\//i.test(value);
                if (external && !isExplicitWebLink) {
                    throw new Error('No se permiten recursos remotos. Usa recursos incluidos en el HTML.');
                }
            }
        }
        if (/@import\s+(?:url\s*\()?\s*['"]?https?:/i.test(html)) {
            throw new Error('No se permiten hojas de estilo remotas.');
        }
        return validateMetadata(documentNode);
    }

    function replaceMetadataTitle(html, title) {
        const documentNode = new DOMParser().parseFromString(html, 'text/html');
        const element = documentNode.querySelector('meta[name="homescreen-tool"]');
        const metadata = JSON.parse(element.content);
        metadata.title = title;
        element.content = JSON.stringify(metadata);
        return '<!doctype html>\n' + documentNode.documentElement.outerHTML;
    }

    function safeData(value) {
        let serialized;
        try {
            serialized = JSON.stringify(value);
        } catch (error) {
            throw new Error('El valor debe poder convertirse a JSON.');
        }
        if (serialized === undefined || serialized.length > maximumDataSize) {
            throw new Error('Los datos de cada herramienta no pueden superar 64 KB.');
        }
        return JSON.parse(serialized);
    }

    function contentSecurityPolicy() {
        return "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; navigate-to 'none'";
    }

    function bridgeSource(token, instanceId) {
        return `<script>(function(){'use strict';const token=${JSON.stringify(token)};const instanceId=${JSON.stringify(instanceId)};let serial=0;const pending=new Map();function call(op,args){return new Promise((resolve,reject)=>{const requestId=++serial;pending.set(requestId,{resolve,reject});parent.postMessage({channel:'homescreen-custom-tool',token,instanceId,requestId,op,args},'*');setTimeout(()=>{if(pending.has(requestId)){pending.delete(requestId);reject(new Error('La solicitud a Homescreen ha caducado.'));}},10000);});}addEventListener('message',event=>{if(event.source!==parent)return;const data=event.data;if(!data||data.channel!=='homescreen-custom-tool-response'||data.token!==token||!Number.isInteger(data.requestId))return;const request=pending.get(data.requestId);if(!request)return;pending.delete(data.requestId);if(data.error)request.reject(new Error(data.error));else request.resolve(data.value);});const api=Object.freeze({storage:Object.freeze({get:key=>call('storage.get',{key}),set:(key,value)=>call('storage.set',{key,value})}),notify:message=>call('notify',{message}),window:Object.freeze({setTitle:title=>call('window.setTitle',{title}),setSize:(width,height)=>call('window.setSize',{width,height}),minimize:()=>call('window.minimize',{}),close:()=>call('window.close',{})}),pip:Object.freeze({setLabel:text=>call('pip.setLabel',{text})})});Object.defineProperty(window,'hs',{value:api,writable:false,configurable:false});})();</script>`;
    }

    function sandboxDocument(html, token, instanceId) {
        const security = `<meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy()}">`;
        const bridge = token
            ? bridgeSource(token, instanceId)
            : `<script>(function(){const denied=()=>Promise.resolve(false);const memory={};Object.defineProperty(window,'hs',{value:Object.freeze({storage:Object.freeze({get:key=>Promise.resolve(memory[key]??null),set:(key,value)=>{memory[key]=value;return Promise.resolve(true);}}),notify:denied,window:Object.freeze({setTitle:denied,setSize:denied,minimize:denied,close:denied}),pip:Object.freeze({setLabel:denied})})});})();</script>`;
        const head = /<head(?:\s[^>]*)?>/i;
        if (head.test(html)) return html.replace(head, match => match + security + bridge);
        return `<!doctype html><html><head>${security}${bridge}</head><body>${html}</body></html>`;
    }

    function reportError(message) {
        window.dispatchEvent(new CustomEvent('homescreen:tool-notify', { detail: { message } }));
    }

    function ensureEditor() {
        if (editor) return editor;
        editor = document.createElement('div');
        editor.className = 'hs-custom-editor';
        editor.hidden = true;
        editor.setAttribute('role', 'dialog');
        editor.setAttribute('aria-modal', 'true');
        editor.setAttribute('aria-labelledby', 'hsCustomEditorTitle');
        editor.innerHTML = `
            <section class="hs-custom-editor-card">
                <header class="hs-custom-editor-header">
                    <div><h2 id="hsCustomEditorTitle">Crear herramienta</h2><p>Pega un documento HTML autocontenido con sus metadatos.</p></div>
                    <button class="hs-icon-button" type="button" data-editor-close aria-label="Cerrar editor"><i data-lucide="x"></i></button>
                </header>
                <label class="hs-editor-label" for="hsCustomToolSource">Documento HTML</label>
                <textarea id="hsCustomToolSource" spellcheck="false" placeholder="<!doctype html>…"></textarea>
                <div class="hs-editor-status" role="status" aria-live="polite"></div>
                <iframe class="hs-custom-preview" title="Vista previa de herramienta" sandbox="allow-scripts" referrerpolicy="no-referrer" hidden></iframe>
                <footer class="hs-custom-editor-actions">
                    <button class="hs-secondary-button" type="button" data-editor-preview>Vista previa</button>
                    <button class="hs-primary-button" type="button" data-editor-save>Guardar herramienta</button>
                </footer>
            </section>`;
        document.body.appendChild(editor);
        editor.querySelector('[data-editor-close]').addEventListener('click', closeEditor);
        editor.addEventListener('click', event => {
            if (event.target === editor) closeEditor();
        });
        editor.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeEditor();
        });
        editor.querySelector('[data-editor-preview]').addEventListener('click', previewEditor);
        editor.querySelector('[data-editor-save]').addEventListener('click', saveEditor);
        return editor;
    }

    function setEditorStatus(message, isError) {
        const status = ensureEditor().querySelector('.hs-editor-status');
        status.textContent = message;
        status.classList.toggle('is-error', !!isError);
    }

    function openEditor(mode, tool) {
        const view = ensureEditor();
        editorMode = mode;
        editingId = tool ? tool.id : null;
        validatedTool = null;
        view.querySelector('#hsCustomEditorTitle').textContent = mode === 'edit' ? 'Editar herramienta' : 'Crear herramienta';
        view.querySelector('#hsCustomToolSource').value = tool ? tool.html : '';
        view.querySelector('[data-editor-save]').textContent = mode === 'edit' ? 'Guardar cambios' : 'Guardar herramienta';
        view.querySelector('.hs-custom-preview').hidden = true;
        view.querySelector('.hs-custom-preview').srcdoc = '';
        setEditorStatus('Valida el documento antes de guardarlo.', false);
        view.hidden = false;
        document.body.classList.add('hs-custom-editor-open');
        if (window.lucide) window.lucide.createIcons();
        requestAnimationFrame(() => view.querySelector('#hsCustomToolSource').focus());
    }

    function closeEditor() {
        if (!editor || editor.hidden) return;
        editor.hidden = true;
        document.body.classList.remove('hs-custom-editor-open');
    }

    function previewEditor() {
        const view = ensureEditor();
        try {
            validatedTool = validateHtml(view.querySelector('#hsCustomToolSource').value);
            const preview = view.querySelector('.hs-custom-preview');
            preview.srcdoc = sandboxDocument(view.querySelector('#hsCustomToolSource').value, null);
            preview.hidden = false;
            setEditorStatus(`Documento válido: ${validatedTool.title} (${validatedTool.width} × ${validatedTool.height}).`, false);
        } catch (error) {
            validatedTool = null;
            setEditorStatus(error.message, true);
        }
    }

    async function saveEditor() {
        const view = ensureEditor();
        const html = view.querySelector('#hsCustomToolSource').value;
        try {
            const metadata = validateHtml(html);
            const existing = editingId ? await readTool(editingId) : null;
            const tool = {
                id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`),
                title: metadata.title,
                icon: metadata.icon,
                metadata,
                html,
                data: existing ? existing.data || {} : {},
                updatedAt: new Date().toISOString()
            };
            await writeTool(tool);
            validatedTool = metadata;
            setEditorStatus('Herramienta guardada.', false);
            closeEditor();
            window.dispatchEvent(new CustomEvent('homescreen:custom-tools-change'));
        } catch (error) {
            setEditorStatus(error.message || 'No se pudo guardar la herramienta.', true);
        }
    }

    function canonicalIcon(value) {
        const name = value.split('-').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('');
        return window.lucide?.icons?.[name] ? value : 'box';
    }

    function sendResponse(target, token, requestId, value, error) {
        target.postMessage({
            channel: 'homescreen-custom-tool-response',
            token,
            requestId,
            value,
            error: error || null
        }, '*');
    }

    async function handleRequest(instance, message) {
        const { op, args, requestId } = message;
        if (!Number.isInteger(requestId) || requestId < 1 || requestId > 1e9 ||
            !args || typeof args !== 'object' || Array.isArray(args)) {
            throw new Error('Solicitud no válida.');
        }
        const manager = window.homescreenWindowManager;
        if (!manager || !manager.windows.has(instance.windowId)) throw new Error('La ventana ya no está disponible.');

        if (op === 'storage.get' || op === 'storage.set') {
            if (typeof args.key !== 'string' || !args.key.trim() || args.key.length > 120) {
                throw new Error('La clave de almacenamiento no es válida.');
            }
            if (!instance.toolId) {
                if (op === 'storage.get') return instance.storageData[args.key] ?? null;
                instance.storageData[args.key] = safeData(args.value);
                if (JSON.stringify(instance.storageData).length > maximumDataSize) {
                    delete instance.storageData[args.key];
                    throw new Error('El almacenamiento total de la herramienta supera 64 KB.');
                }
                return true;
            }
            if (op === 'storage.get') {
                const tool = await readTool(instance.toolId);
                if (!tool) throw new Error('La herramienta ya no existe.');
                return tool.data?.[args.key] ?? null;
            }
            await setToolData(instance.toolId, args.key, args.value);
            return true;
        }
        if (op === 'notify') {
            if (typeof args.message !== 'string' || !args.message.trim() || args.message.length > 300) {
                throw new Error('El mensaje debe tener entre 1 y 300 caracteres.');
            }
            reportError(args.message.trim());
            return true;
        }
        if (op === 'window.setTitle') {
            if (typeof args.title !== 'string' || args.title.length > 80) throw new Error('El título no es válido.');
            if (!manager.setWindowTitle(instance.windowId, args.title)) throw new Error('No se pudo cambiar el título.');
            return true;
        }
        if (op === 'window.setSize') {
            if (!Number.isFinite(args.width) || !Number.isFinite(args.height)) throw new Error('El tamaño no es válido.');
            if (!manager.setWindowSize(instance.windowId, args.width, args.height)) throw new Error('No se pudo cambiar el tamaño.');
            return true;
        }
        if (op === 'window.minimize') {
            manager.minimizeWindow(instance.windowId);
            return true;
        }
        if (op === 'window.close') {
            manager.closeWindow(instance.windowId);
            return true;
        }
        if (op === 'pip.setLabel') {
            if (typeof args.text !== 'string' || args.text.length > 80) throw new Error('La etiqueta PiP no es válida.');
            manager.updatePipLabel(instance.windowId, args.text);
            return true;
        }
        throw new Error('Operación no permitida.');
    }

    window.addEventListener('message', event => {
        const message = event.data;
        if (!message || message.channel !== 'homescreen-custom-tool' || typeof message.token !== 'string') return;
        const instance = instances.get(message.token);
        if (!instance || event.source !== instance.iframe.contentWindow || instance.windowId !== message.instanceId) return;
        let serialized;
        try {
            serialized = JSON.stringify(message);
        } catch (error) {
            return;
        }
        if (!serialized || serialized.length > maximumDataSize + 4096 ||
            !Number.isInteger(message.requestId) || message.requestId <= (instance.lastRequestId || 0)) return;
        instance.lastRequestId = message.requestId;
        handleRequest(instance, message).then(
            value => sendResponse(event.source, instance.token, message.requestId, value, null),
            error => sendResponse(event.source, instance.token, message.requestId, null, error.message || 'La solicitud no se pudo completar.')
        );
    });

    window.addEventListener('homescreen:window-closed', event => {
        const instance = instances.get(event.detail?.id);
        if (!instance) return;
        instances.delete(instance.token);
    });

    function openTool(tool) {
        const metadata = tool.metadata || validateHtml(tool.html);
        const manager = window.homescreenWindowManager;
        if (!manager) throw new Error('El motor de ventanas todavía no está disponible.');
        const width = Math.min(metadata.width, Math.max(180, window.innerWidth - 24));
        const height = Math.min(metadata.height, Math.max(180, window.innerHeight - 24));
        const state = manager.createWindow({
            title: tool.title || metadata.title,
            icon: canonicalIcon(metadata.icon || tool.icon || 'box'),
            width,
            height,
            minW: metadata.minWidth,
            minH: metadata.minHeight,
            supportsPip: metadata.supportsPip,
            contentRenderFn(container, windowState) {
                windowState.minW = Math.min(windowState.minW, windowState.w);
                windowState.minH = Math.min(windowState.minH, windowState.h);
                const iframe = document.createElement('iframe');
                const token = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
                iframe.className = 'hs-custom-tool-frame';
                iframe.title = tool.title || metadata.title;
                iframe.setAttribute('sandbox', 'allow-scripts');
                iframe.setAttribute('referrerpolicy', 'no-referrer');
                iframe.srcdoc = sandboxDocument(tool.html, token, windowState.id);
                container.appendChild(iframe);
                instances.set(token, {
                    token,
                    toolId: tool.persistent === false ? null : tool.id,
                    storageData: {},
                    windowId: windowState.id,
                    iframe
                });
                windowState.toolData.stopFn = () => instances.delete(token);
            }
        });
        return state;
    }

    async function duplicateTool(id) {
        const original = await readTool(id);
        if (!original) throw new Error('La herramienta ya no existe.');
        const title = `${original.title.slice(0, 52)} (copia)`;
        const html = replaceMetadataTitle(original.html, title);
        const metadata = validateHtml(html);
        const { source, ...personalCopy } = original;
        await writeTool({
            ...personalCopy,
            id: crypto.randomUUID ? crypto.randomUUID() : `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title,
            icon: metadata.icon,
            metadata,
            html,
            data: {},
            updatedAt: new Date().toISOString()
        });
        window.dispatchEvent(new CustomEvent('homescreen:custom-tools-change'));
    }

    function normalizeOnlineTool(tool) {
        if (!tool || typeof tool.catalogId !== 'string' || !tool.catalogId ||
            typeof tool.name !== 'string' || !tool.name.trim() || tool.name.length > 60 ||
            typeof tool.version !== 'string' || !tool.version.trim() || typeof tool.html !== 'string') {
            throw new Error('La herramienta de la tienda no contiene metadatos válidos.');
        }
        const html = replaceMetadataTitle(tool.html, tool.name.trim());
        const metadata = validateHtml(html);
        return { catalogId: tool.catalogId, name: tool.name.trim(), version: tool.version, html, metadata };
    }

    async function findOnlineInstall(catalogId) {
        const tools = await readAll();
        return tools.find(tool => tool.source?.type === 'online' && tool.source.catalogId === catalogId) || null;
    }

    async function openOnlineTool(tool) {
        const normalized = normalizeOnlineTool(tool);
        return openTool({
            id: `online:${normalized.catalogId}`,
            title: normalized.name,
            html: normalized.html,
            metadata: normalized.metadata,
            persistent: false
        });
    }

    async function installOnlineTool(tool) {
        const normalized = normalizeOnlineTool(tool);
        const existing = await findOnlineInstall(normalized.catalogId);
        if (existing) return { tool: existing, alreadyInstalled: true };
        const saved = await writeTool({
            id: crypto.randomUUID ? crypto.randomUUID() : `tool-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            title: normalized.name,
            icon: normalized.metadata.icon,
            metadata: normalized.metadata,
            html: normalized.html,
            data: {},
            source: { type: 'online', catalogId: normalized.catalogId, version: normalized.version },
            updatedAt: new Date().toISOString()
        });
        window.dispatchEvent(new CustomEvent('homescreen:custom-tools-change'));
        return { tool: saved, alreadyInstalled: false };
    }

    async function updateOnlineTool(id, tool) {
        const normalized = normalizeOnlineTool(tool);
        const existing = await readTool(id);
        if (!existing || existing.source?.type !== 'online' || existing.source.catalogId !== normalized.catalogId) {
            throw new Error('Solo se puede actualizar una copia instalada de esta herramienta.');
        }
        const updated = {
            ...existing,
            title: normalized.name,
            icon: normalized.metadata.icon,
            metadata: normalized.metadata,
            html: normalized.html,
            source: { type: 'online', catalogId: normalized.catalogId, version: normalized.version },
            updatedAt: new Date().toISOString()
        };
        await writeTool(updated);
        window.dispatchEvent(new CustomEvent('homescreen:custom-tools-change'));
        return updated;
    }

    async function deleteTool(id) {
        await removeTool(id);
        window.dispatchEvent(new CustomEvent('homescreen:custom-tools-change'));
    }

    async function exportTool(id) {
        const tool = await readTool(id);
        if (!tool) throw new Error('La herramienta ya no existe.');
        const blob = new Blob([tool.html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${tool.title.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'herramienta'}.html`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function validateBackup(payload) {
        if (!payload || payload.version !== 1 || !Array.isArray(payload.tools) || payload.tools.length > 200) {
            throw new Error('La sección de herramientas personalizadas de la copia no es válida.');
        }
        const ids = new Set();
        return payload.tools.map(tool => {
            if (!tool || typeof tool.id !== 'string' || !tool.id || tool.id.length > 100 || ids.has(tool.id)) {
                throw new Error('La copia contiene identificadores de herramientas no válidos o repetidos.');
            }
            ids.add(tool.id);
            const metadata = validateHtml(tool.html);
            const data = tool.data && typeof tool.data === 'object' && !Array.isArray(tool.data)
                ? safeData(tool.data)
                : {};
            if (JSON.stringify(data).length > maximumDataSize) throw new Error('La copia contiene datos demasiado grandes.');
            return {
                id: tool.id,
                title: metadata.title,
                icon: metadata.icon,
                metadata,
                html: tool.html,
                data,
                ...(tool.source?.type === 'online' && typeof tool.source.catalogId === 'string' && typeof tool.source.version === 'string'
                    ? { source: { type: 'online', catalogId: tool.source.catalogId, version: tool.source.version } }
                    : {}),
                updatedAt: typeof tool.updatedAt === 'string' ? tool.updatedAt : new Date().toISOString()
            };
        });
    }

    async function importBackup(payload) {
        const tools = validateBackup(payload);
        if (!tools.length) return;
        const db = await openDatabase();
        await new Promise((resolve, reject) => {
            const transaction = db.transaction('tools', 'readwrite');
            const store = transaction.objectStore('tools');
            tools.forEach(tool => store.put(tool));
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error || new Error('No se pudieron restaurar las herramientas.'));
        });
        window.dispatchEvent(new CustomEvent('homescreen:custom-tools-change'));
    }

    async function exportBackup() {
        const tools = await readAll();
        return {
            version: 1,
            tools: tools.map(tool => ({
                id: tool.id,
                title: tool.title,
                icon: tool.icon,
                html: tool.html,
                metadata: tool.metadata,
                data: tool.data || {},
                ...(tool.source?.type === 'online' ? { source: tool.source } : {}),
                updatedAt: tool.updatedAt
            }))
        };
    }

    window.HomescreenCustomTools = Object.freeze({
        list: async () => (await readAll()).sort((a, b) => a.title.localeCompare(b.title, 'es')),
        open: openTool,
        create: () => openEditor('create', null),
        edit: async id => {
            const tool = await readTool(id);
            if (!tool) throw new Error('La herramienta ya no existe.');
            openEditor('edit', tool);
        },
        duplicate: duplicateTool,
        remove: deleteTool,
        export: exportTool,
        readOnlineCache,
        writeOnlineCache,
        openOnlineTool,
        installOnlineTool,
        findOnlineInstall,
        updateOnlineTool,
        validateHtml,
        exportBackup,
        validateBackup,
        importBackup
    });
})();
