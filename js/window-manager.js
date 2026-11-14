(function () {
    const host = document.getElementById('hsToolsRoot');
    if (!host) throw new Error('No se encontro el contenedor del sistema de ventanas.');
    window.homescreenDesktop = host.querySelector('#desktop');
    window.homescreenCreateIcons = function () {
        if (window.lucide) window.lucide.createIcons();
    };
        class WindowManager {
            constructor(desktop) {
                this.desktop = desktop;
                this.windows = new Map();
                this.bubbles = new Map();
                this.activeWindowId = null;
                this.baseZIndex = 100;
                this.pipZIndex = 999000;
                this.nextWindowId = 1;

                window.addEventListener('resize', () => this.handleViewportResize());
            }

            createWindow(config) {
                const id = `win_${Date.now().toString(36)}_${(this.nextWindowId++).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
                const winElem = document.createElement('div');
                winElem.className = 'window';
                winElem.id = id;

                const isMobile = window.innerWidth <= 600;
                const defaultWidth = isMobile ? Math.min(340, window.innerWidth - 24) : (config.width || 350);
                const defaultHeight = isMobile ? Math.min(400, window.innerHeight - 100) : (config.height || 360);

                const offset = (this.windows.size * 22) % 120;
                const initialLeft = isMobile ? 12 : Math.max(16, Math.min(80 + offset, window.innerWidth - defaultWidth - 20));
                const initialTop = isMobile ? 24 : Math.max(20, Math.min(50 + offset, window.innerHeight - defaultHeight - 90));

                const state = {
                    id,
                    title: config.title || 'Ventana',
                    icon: config.icon || 'box',
                    x: initialLeft,
                    y: initialTop,
                    w: defaultWidth,
                    h: defaultHeight,
                    minW: config.minW || 220,
                    minH: config.minH || 160,
                    supportsPip: !!config.supportsPip,
                    isMinimized: false,
                    isMaximized: false,
                    isPip: false,
                    prevRect: null,
                    elem: winElem,
                    toolData: config.initialToolData || {}
                };

                // Build HTML Frame
                winElem.innerHTML = `
                    <div class="window-header">
                        <div class="window-title">
                            <i data-lucide="${state.icon}" size="15"></i>
                            <span></span>
                        </div>
                        <div class="window-controls">
                            ${state.supportsPip ? '<button class="win-btn pip-btn" title="Convertir en Burbuja PiP"><i data-lucide="picture-in-picture-2" size="13"></i></button>' : ''}
                            <button class="win-btn min-btn" title="Minimizar"><i data-lucide="minus" size="13"></i></button>
                            <button class="win-btn max-btn" title="Maximizar"><i data-lucide="maximize-2" size="13"></i></button>
                            <button class="win-btn close-btn" title="Cerrar"><i data-lucide="x" size="13"></i></button>
                        </div>
                    </div>
                    <div class="window-body"></div>
                    <!-- 8-Direction Resize Handles -->
                    <div class="resize-handle rh-n" data-dir="n"></div>
                    <div class="resize-handle rh-s" data-dir="s"></div>
                    <div class="resize-handle rh-e" data-dir="e"></div>
                    <div class="resize-handle rh-w" data-dir="w"></div>
                    <div class="resize-handle rh-nw" data-dir="nw"></div>
                    <div class="resize-handle rh-ne" data-dir="ne"></div>
                    <div class="resize-handle rh-sw" data-dir="sw"></div>
                    <div class="resize-handle rh-se" data-dir="se"></div>
                `;

                winElem.querySelector('.window-title span').textContent = state.title;
                const bodyContainer = winElem.querySelector('.window-body');
                if (config.contentRenderFn) {
                    config.contentRenderFn(bodyContainer, state);
                }

                this.desktop.appendChild(winElem);
                this.windows.set(id, state);

                this.applyTransformGeometry(state);
                this.setupInteractions(state);

                requestAnimationFrame(() => {
                    winElem.classList.add('visible');
                    this.focusWindow(id);
                    window.homescreenCreateIcons();
                });

                this.updateTaskbar();
                return state;
            }

            applyTransformGeometry(state) {
                const { elem, x, y, w, h } = state;
                elem.style.setProperty('--win-x', `${x}px`);
                elem.style.setProperty('--win-y', `${y}px`);
                elem.style.width = `${w}px`;
                elem.style.height = `${h}px`;
                if (elem.classList.contains('visible')) {
                    elem.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1) translateY(0)`;
                }
            }

            focusWindow(id) {
                if (!this.windows.has(id)) return;

                this.activeWindowId = id;
                let highestZ = this.baseZIndex;

                this.windows.forEach((win) => {
                    const z = parseInt(win.elem.style.zIndex || this.baseZIndex, 10);
                    if (z > highestZ && z < this.pipZIndex) highestZ = z;
                    
                    win.elem.classList.remove('active-window');
                    win.elem.classList.add('inactive-window');
                });

                const activeState = this.windows.get(id);
                activeState.elem.style.zIndex = highestZ + 1;
                activeState.elem.classList.remove('inactive-window');
                activeState.elem.classList.add('active-window');

                if (activeState.isMinimized) {
                    this.restoreWindow(id);
                }

                if (activeState.isPip) {
                    this.exitPipMode(id);
                }

                this.updateTaskbar();
            }

            setupInteractions(state) {
                const { elem, id } = state;
                const header = elem.querySelector('.window-header');

                elem.addEventListener('pointerdown', () => this.focusWindow(id));

                // Titlebar Pointer Drag Engine
                let isDragging = false;
                let dragStart = { x: 0, y: 0 };
                let initialPos = { x: 0, y: 0 };
                let dragRafId = null;

                const onDragPointerDown = (e) => {
                    if (e.target.closest('.win-btn') || state.isMaximized) return;
                    
                    isDragging = true;
                    elem.classList.add('dragging');
                    dragStart = { x: e.clientX, y: e.clientY };
                    initialPos = { x: state.x, y: state.y };
                    
                    header.setPointerCapture(e.pointerId);
                    header.addEventListener('pointermove', onDragPointerMove);
                    header.addEventListener('pointerup', onDragPointerUp);
                    header.addEventListener('pointercancel', onDragPointerUp);
                };

                const onDragPointerMove = (e) => {
                    if (!isDragging) return;
                    const dx = e.clientX - dragStart.x;
                    const dy = e.clientY - dragStart.y;

                    if (dragRafId) cancelAnimationFrame(dragRafId);

                    dragRafId = requestAnimationFrame(() => {
                        const maxX = window.innerWidth - 40;
                        const maxY = window.innerHeight - 60;
                        state.x = Math.max(-state.w + 60, Math.min(initialPos.x + dx, maxX));
                        state.y = Math.max(0, Math.min(initialPos.y + dy, maxY));
                        this.applyTransformGeometry(state);
                    });
                };

                const onDragPointerUp = (e) => {
                    isDragging = false;
                    elem.classList.remove('dragging');
                    try {
                        header.releasePointerCapture(e.pointerId);
                    } catch (_) {}
                    header.removeEventListener('pointermove', onDragPointerMove);
                    header.removeEventListener('pointerup', onDragPointerUp);
                    header.removeEventListener('pointercancel', onDragPointerUp);
                };

                header.addEventListener('pointerdown', onDragPointerDown);

                // 8-Direction Handle Resize Engine
                const handles = elem.querySelectorAll('.resize-handle');
                handles.forEach(handle => {
                    handle.addEventListener('pointerdown', (e) => {
                        if (state.isMaximized) return;
                        e.stopPropagation();
                        e.preventDefault();

                        const dir = handle.dataset.dir;
                        let isResizing = true;
                        elem.classList.add('resizing');

                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startW = state.w;
                        const startH = state.h;
                        const startPosX = state.x;
                        const startPosY = state.y;
                        let resizeRafId = null;

                        handle.setPointerCapture(e.pointerId);

                        const onResizeMove = (re) => {
                            if (!isResizing) return;
                            const dx = re.clientX - startX;
                            const dy = re.clientY - startY;

                            if (resizeRafId) cancelAnimationFrame(resizeRafId);

                            resizeRafId = requestAnimationFrame(() => {
                                let newW = startW;
                                let newH = startH;
                                let newX = startPosX;
                                let newY = startPosY;

                                // East & West calculation
                                if (dir.includes('e')) {
                                    newW = Math.max(state.minW, startW + dx);
                                } else if (dir.includes('w')) {
                                    const possibleW = startW - dx;
                                    if (possibleW >= state.minW) {
                                        newW = possibleW;
                                        newX = startPosX + dx;
                                    } else {
                                        newW = state.minW;
                                        newX = startPosX + (startW - state.minW);
                                    }
                                }

                                // South & North calculation
                                if (dir.includes('s')) {
                                    newH = Math.max(state.minH, startH + dy);
                                } else if (dir.includes('n')) {
                                    const possibleH = startH - dy;
                                    if (possibleH >= state.minH) {
                                        newH = possibleH;
                                        newY = startPosY + dy;
                                    } else {
                                        newH = state.minH;
                                        newY = startPosY + (startH - state.minH);
                                    }
                                }

                                state.w = newW;
                                state.h = newH;
                                state.x = newX;
                                state.y = newY;
                                this.applyTransformGeometry(state);
                            });
                        };

                        const onResizeUp = (re) => {
                            isResizing = false;
                            elem.classList.remove('resizing');
                            try {
                                handle.releasePointerCapture(re.pointerId);
                            } catch (_) {}
                            handle.removeEventListener('pointermove', onResizeMove);
                            handle.removeEventListener('pointerup', onResizeUp);
                            handle.removeEventListener('pointercancel', onResizeUp);
                        };

                        handle.addEventListener('pointermove', onResizeMove);
                        handle.addEventListener('pointerup', onResizeUp);
                        handle.addEventListener('pointercancel', onResizeUp);
                    });
                });

                // Window Control Event Listeners
                const pipBtn = elem.querySelector('.pip-btn');
                if (pipBtn) {
                    pipBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.enterPipMode(id);
                    });
                }

                elem.querySelector('.min-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.minimizeWindow(id);
                });

                elem.querySelector('.max-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.toggleMaximizeWindow(id);
                });

                elem.querySelector('.close-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeWindow(id);
                });
            }

            enterPipMode(id) {
                const state = this.windows.get(id);
                if (!state || !state.supportsPip || state.isPip) return;

                state.isPip = true;
                state.elem.style.display = 'none'; // Hide main full window

                // Create PiP Bubble Widget
                const bubElem = document.createElement('div');
                bubElem.className = 'pip-bubble';
                bubElem.id = `pip_${id}`;

                const initialX = Math.min(state.x + 20, window.innerWidth - 160);
                const initialY = Math.max(20, state.y - 10);

                state.bubX = initialX;
                state.bubY = initialY;

                bubElem.style.setProperty('--bub-x', `${initialX}px`);
                bubElem.style.setProperty('--bub-y', `${initialY}px`);

                bubElem.innerHTML = `
                    <div class="pip-bubble-icon">
                        <i data-lucide="${state.icon}" size="15"></i>
                    </div>
                    <div class="pip-bubble-label" id="pip_label_${id}"></div>
                    <div class="pip-bubble-actions">
                        <button class="pip-btn-action expand" title="Restaurar Ventana"><i data-lucide="maximize-2" size="11"></i></button>
                        <button class="pip-btn-action close" title="Cerrar"><i data-lucide="x" size="11"></i></button>
                    </div>
                `;
                bubElem.querySelector('.pip-bubble-label').textContent = state.toolData.pipLabel || '--:--';

                this.desktop.appendChild(bubElem);
                this.bubbles.set(id, bubElem);

                // Setup Bubble Dragging Physics
                let isBubDragging = false;
                let bubStart = { x: 0, y: 0 };
                let bubPos = { x: initialX, y: initialY };
                let bubRafId = null;

                const onBubPointerDown = (e) => {
                    if (e.target.closest('.pip-btn-action')) return;
                    isBubDragging = true;
                    bubElem.classList.add('dragging');
                    bubStart = { x: e.clientX, y: e.clientY };
                    bubPos = { x: state.bubX, y: state.bubY };

                    bubElem.setPointerCapture(e.pointerId);
                    bubElem.addEventListener('pointermove', onBubPointerMove);
                    bubElem.addEventListener('pointerup', onBubPointerUp);
                    bubElem.addEventListener('pointercancel', onBubPointerUp);
                };

                const onBubPointerMove = (e) => {
                    if (!isBubDragging) return;
                    const dx = e.clientX - bubStart.x;
                    const dy = e.clientY - bubStart.y;

                    if (bubRafId) cancelAnimationFrame(bubRafId);

                    bubRafId = requestAnimationFrame(() => {
                        const maxX = window.innerWidth - bubElem.offsetWidth - 10;
                        const maxY = window.innerHeight - bubElem.offsetHeight - 70;
                        state.bubX = Math.max(10, Math.min(bubPos.x + dx, maxX));
                        state.bubY = Math.max(10, Math.min(bubPos.y + dy, maxY));

                        bubElem.style.setProperty('--bub-x', `${state.bubX}px`);
                        bubElem.style.setProperty('--bub-y', `${state.bubY}px`);
                    });
                };

                const onBubPointerUp = (e) => {
                    isBubDragging = false;
                    bubElem.classList.remove('dragging');
                    try {
                        bubElem.releasePointerCapture(e.pointerId);
                    } catch (_) {}
                    bubElem.removeEventListener('pointermove', onBubPointerMove);
                    bubElem.removeEventListener('pointerup', onBubPointerUp);
                    bubElem.removeEventListener('pointercancel', onBubPointerUp);
                };

                bubElem.addEventListener('pointerdown', onBubPointerDown);

                bubElem.querySelector('.pip-btn-action.expand').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.exitPipMode(id);
                });

                bubElem.querySelector('.pip-btn-action.close').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeWindow(id);
                });

                requestAnimationFrame(() => {
                    bubElem.classList.add('visible');
                    window.homescreenCreateIcons();
                });

                this.updateTaskbar();
            }

            exitPipMode(id) {
                const state = this.windows.get(id);
                if (!state || !state.isPip) return;

                const bubElem = this.bubbles.get(id);
                if (bubElem) {
                    bubElem.classList.remove('visible');
                    setTimeout(() => bubElem.remove(), 180);
                    this.bubbles.delete(id);
                }

                state.isPip = false;
                state.elem.style.display = 'flex';
                this.focusWindow(id);
                this.updateTaskbar();
            }

            updatePipLabel(id, text) {
                const state = this.windows.get(id);
                if (state) state.toolData.pipLabel = text;
                const labelElem = this.desktop.getRootNode().getElementById(`pip_label_${id}`);
                if (labelElem) {
                    labelElem.textContent = text;
                }
            }

            minimizeWindow(id) {
                const state = this.windows.get(id);
                if (!state) return;

                if (state.isPip) {
                    this.exitPipMode(id);
                }

                state.isMinimized = true;
                state.elem.classList.add('minimized');

                const remaining = Array.from(this.windows.values())
                    .filter(w => !w.isMinimized && !w.isPip && w.id !== id);

                if (remaining.length > 0) {
                    this.focusWindow(remaining[remaining.length - 1].id);
                } else {
                    this.activeWindowId = null;
                }

                this.updateTaskbar();
            }

            restoreWindow(id) {
                const state = this.windows.get(id);
                if (!state) return;

                if (state.isPip) {
                    this.exitPipMode(id);
                    return;
                }

                state.isMinimized = false;
                state.elem.classList.remove('minimized');
                this.updateTaskbar();
            }

            toggleMaximizeWindow(id) {
                const state = this.windows.get(id);
                if (!state) return;

                const maxBtnIcon = state.elem.querySelector('.max-btn i');

                if (!state.isMaximized) {
                    state.prevRect = { x: state.x, y: state.y, w: state.w, h: state.h };
                    state.isMaximized = true;
                    state.x = 0;
                    state.y = 0;
                    state.w = window.innerWidth;
                    state.h = window.innerHeight;
                    state.elem.classList.add('maximized');
                    if (maxBtnIcon) maxBtnIcon.setAttribute('data-lucide', 'minimize-2');
                } else {
                    state.isMaximized = false;
                    state.elem.classList.remove('maximized');
                    if (state.prevRect) {
                        state.x = state.prevRect.x;
                        state.y = state.prevRect.y;
                        state.w = state.prevRect.w;
                        state.h = state.prevRect.h;
                    }
                    if (maxBtnIcon) maxBtnIcon.setAttribute('data-lucide', 'maximize-2');
                }
                this.applyTransformGeometry(state);
                window.homescreenCreateIcons();
            }

            closeWindow(id) {
                const state = this.windows.get(id);
                if (!state) return;

                state.isClosing = true;
                window.dispatchEvent(new CustomEvent('homescreen:window-closed', { detail: { id } }));

                // Stop tool interval if running
                if (state.toolData && state.toolData.stopFn) {
                    state.toolData.stopFn();
                }

                if (state.isPip) {
                    const bubElem = this.bubbles.get(id);
                    if (bubElem) bubElem.remove();
                    this.bubbles.delete(id);
                }

                state.elem.classList.add('closing');
                setTimeout(() => {
                    state.elem.remove();
                    this.windows.delete(id);
                    if (this.activeWindowId === id) {
                        this.activeWindowId = null;
                    }
                    this.updateTaskbar();
                }, 140);
            }

            handleViewportResize() {
                this.windows.forEach(state => {
                    if (state.isMaximized) {
                        state.w = window.innerWidth;
                        state.h = window.innerHeight;
                        this.applyTransformGeometry(state);
                        return;
                    }
                    let changed = false;
                    if (state.x + state.w > window.innerWidth) {
                        state.x = Math.max(10, window.innerWidth - state.w - 10);
                        changed = true;
                    }
                    if (state.y + state.h > window.innerHeight) {
                        state.y = Math.max(10, window.innerHeight - state.h - 70);
                        changed = true;
                    }
                    if (changed) this.applyTransformGeometry(state);
                });
            }

            setWindowTitle(id, title) {
                const state = this.windows.get(id);
                if (!state || typeof title !== 'string' || !title.trim() || title.length > 80) return false;
                state.title = title.trim();
                state.elem.querySelector('.window-title span').textContent = state.title;
                this.updateTaskbar();
                return true;
            }

            setWindowSize(id, width, height) {
                const state = this.windows.get(id);
                if (!state || state.isMaximized || !Number.isFinite(width) || !Number.isFinite(height)) return false;
                const maxWidth = Math.max(state.minW, Math.min(1200, window.innerWidth - 24));
                const maxHeight = Math.max(state.minH, Math.min(1000, window.innerHeight - 24));
                state.w = Math.max(state.minW, Math.min(maxWidth, Math.round(width)));
                state.h = Math.max(state.minH, Math.min(maxHeight, Math.round(height)));
                this.applyTransformGeometry(state);
                return true;
            }

            updateTaskbar() {
                window.dispatchEvent(new CustomEvent('homescreen:windows-change', {
                    detail: { windows: Array.from(this.windows.values(), state => ({
                        id: state.id, title: state.title, icon: state.icon,
                        isMinimized: state.isMinimized, isPip: state.isPip, isMaximized: state.isMaximized
                    })), activeWindowId: this.activeWindowId }
                }));
                return;
            }
        }

        const wm = new WindowManager(window.homescreenDesktop);
        window.homescreenWindowManager = wm;

        const appLauncher = {
            openNote: () => {
                wm.createWindow({
                    title: 'Nota Rapid',
                    icon: 'file-text',
                    width: 360,
                    height: 300,
                    contentRenderFn: (container, winState) => {
                        const textarea = document.createElement('textarea');
                        textarea.className = 'note-editor';
                        textarea.placeholder = 'Escribe tus notas aquí...';
                        textarea.value = localStorage.getItem(`neo_note_${winState.id}`) || '';
                        textarea.addEventListener('input', (e) => {
                            localStorage.setItem(`neo_note_${winState.id}`, e.target.value);
                        });
                        container.appendChild(textarea);
                    }
                });
            },

            openCalc: () => {
                wm.createWindow({
                    title: 'Calculadora',
                    icon: 'calculator',
                    width: 280,
                    height: 360,
                    minW: 240,
                    minH: 320,
                    contentRenderFn: (container) => {
                        container.innerHTML = `
                            <div class="calc-container">
                                <div class="calc-display">0</div>
                                <div class="calc-grid">
                                    <button class="calc-btn danger" onclick="calcEngine.clear(this)">C</button>
                                    <button class="calc-btn op" onclick="calcEngine.press('/', this)">÷</button>
                                    <button class="calc-btn op" onclick="calcEngine.press('*', this)">×</button>
                                    <button class="calc-btn danger" onclick="calcEngine.backspace(this)">⌫</button>
                                    
                                    <button class="calc-btn" onclick="calcEngine.press('7', this)">7</button>
                                    <button class="calc-btn" onclick="calcEngine.press('8', this)">8</button>
                                    <button class="calc-btn" onclick="calcEngine.press('9', this)">9</button>
                                    <button class="calc-btn op" onclick="calcEngine.press('-', this)">−</button>
                                    
                                    <button class="calc-btn" onclick="calcEngine.press('4', this)">4</button>
                                    <button class="calc-btn" onclick="calcEngine.press('5', this)">5</button>
                                    <button class="calc-btn" onclick="calcEngine.press('6', this)">6</button>
                                    <button class="calc-btn op" onclick="calcEngine.press('+', this)">+</button>
                                    
                                    <button class="calc-btn" onclick="calcEngine.press('1', this)">1</button>
                                    <button class="calc-btn" onclick="calcEngine.press('2', this)">2</button>
                                    <button class="calc-btn" onclick="calcEngine.press('3', this)">3</button>
                                    <button class="calc-btn eq" style="grid-row: span 2; height: 100%;" onclick="calcEngine.eval(this)">=</button>
                                    
                                    <button class="calc-btn" style="grid-column: span 2;" onclick="calcEngine.press('0', this)">0</button>
                                    <button class="calc-btn" onclick="calcEngine.press('.', this)">.</button>
                                </div>
                            </div>
                        `;
                    }
                });
            },

            openTasks: () => {
                wm.createWindow({
                    title: 'Lista de Tareas',
                    icon: 'check-square',
                    width: 340,
                    height: 380,
                    contentRenderFn: (container) => {
                        let tasks = [
                            { id: 1, text: 'Probar resize de 8 direcciones', done: true },
                            { id: 2, text: 'Convertir Pomodoro a Burbuja PiP', done: false }
                        ];

                        const renderList = () => {
                            const listEl = container.querySelector('.task-list');
                            if (!listEl) return;
                            listEl.innerHTML = '';

                            tasks.forEach(task => {
                                const row = document.createElement('div');
                                row.className = 'task-row';
                                row.innerHTML = `
                                    <div class="task-left">
                                        <div class="task-checkbox ${task.done ? 'done' : ''}" onclick="taskEngine.toggle(${task.id}, this)">
                                            ${task.done ? '<i data-lucide="check" size="11" style="color:#000"></i>' : ''}
                                        </div>
                                        <span class="task-text ${task.done ? 'done' : ''}">${escapeHtml(task.text)}</span>
                                    </div>
                                    <button class="task-del-btn" onclick="taskEngine.remove(${task.id}, this)">
                                        <i data-lucide="trash-2" size="13"></i>
                                    </button>
                                `;
                                listEl.appendChild(row);
                            });
                            window.homescreenCreateIcons();
                        };

                        container.innerHTML = `
                            <div class="task-container">
                                <div class="task-input-bar">
                                    <input type="text" class="task-input" placeholder="Nueva tarea..." onkeydown="if(event.key==='Enter') taskEngine.add(this)">
                                    <button class="task-add-btn" onclick="taskEngine.add(this)"><i data-lucide="plus" size="15"></i></button>
                                </div>
                                <div class="task-list"></div>
                            </div>
                        `;

                        container.taskState = tasks;
                        container.renderList = renderList;
                        renderList();
                    }
                });
            },

            openPomodoro: () => {
                wm.createWindow({
                    title: 'Pomodoro',
                    icon: 'timer',
                    width: 320,
                    height: 260,
                    supportsPip: true,
                    contentRenderFn: (container, winState) => {
                        const totalSecs = 25 * 60;
                        let remainingSecs = totalSecs;
                        let isRunning = false;
                        let lastTimestamp = null;
                        let timerInterval = null;

                        const formatTime = (secs) => {
                            const m = Math.floor(secs / 60).toString().padStart(2, '0');
                            const s = Math.floor(secs % 60).toString().padStart(2, '0');
                            return `${m}:${s}`;
                        };

                        container.innerHTML = `
                            <div class="timer-container">
                                <div class="timer-display" id="pomo_disp_${winState.id}">${formatTime(remainingSecs)}</div>
                                <div class="timer-controls">
                                    <button class="timer-btn primary" id="pomo_start_${winState.id}">
                                        <i data-lucide="play" size="14"></i> <span>Iniciar</span>
                                    </button>
                                    <button class="timer-btn" id="pomo_reset_${winState.id}">
                                        <i data-lucide="rotate-ccw" size="14"></i> <span>Reiniciar</span>
                                    </button>
                                </div>
                            </div>
                        `;

                        const updateUI = () => {
                            const formatted = formatTime(remainingSecs);
                            const disp = container.querySelector(`#pomo_disp_${winState.id}`);
                            if (disp) disp.innerText = formatted;
                            wm.updatePipLabel(winState.id, formatted);
                        };

                        const tick = () => {
                            if (!isRunning) return;
                            const now = Date.now();
                            const elapsed = (now - lastTimestamp) / 1000;
                            lastTimestamp = now;

                            remainingSecs = Math.max(0, remainingSecs - elapsed);
                            updateUI();

                            if (remainingSecs <= 0) {
                                isRunning = false;
                                clearInterval(timerInterval);
                                const disp = container.querySelector(`#pomo_disp_${winState.id}`);
                                if (disp) disp.classList.add('error-shake');
                            }
                        };

                        const toggleStart = () => {
                            isRunning = !isRunning;
                            const startBtn = container.querySelector(`#pomo_start_${winState.id}`);
                            if (isRunning) {
                                lastTimestamp = Date.now();
                                timerInterval = setInterval(tick, 200);
                                if (startBtn) startBtn.innerHTML = '<i data-lucide="pause" size="14"></i> <span>Pausar</span>';
                            } else {
                                clearInterval(timerInterval);
                                if (startBtn) startBtn.innerHTML = '<i data-lucide="play" size="14"></i> <span>Iniciar</span>';
                            }
                            window.homescreenCreateIcons();
                        };

                        const reset = () => {
                            isRunning = false;
                            clearInterval(timerInterval);
                            remainingSecs = totalSecs;
                            const startBtn = container.querySelector(`#pomo_start_${winState.id}`);
                            if (startBtn) startBtn.innerHTML = '<i data-lucide="play" size="14"></i> <span>Iniciar</span>';
                            updateUI();
                            window.homescreenCreateIcons();
                        };

                        container.querySelector(`#pomo_start_${winState.id}`).addEventListener('click', toggleStart);
                        container.querySelector(`#pomo_reset_${winState.id}`).addEventListener('click', reset);

                        winState.toolData.stopFn = () => clearInterval(timerInterval);
                        updateUI();
                    }
                });
            },

            openStopwatch: () => {
                wm.createWindow({
                    title: 'Cronómetro',
                    icon: 'watch',
                    width: 320,
                    height: 260,
                    supportsPip: true,
                    contentRenderFn: (container, winState) => {
                        let elapsedMs = 0;
                        let isRunning = false;
                        let startTime = null;
                        let timerInterval = null;

                        const formatTime = (ms) => {
                            const totalSecs = Math.floor(ms / 1000);
                            const m = Math.floor(totalSecs / 60).toString().padStart(2, '0');
                            const s = (totalSecs % 60).toString().padStart(2, '0');
                            const tenths = Math.floor((ms % 1000) / 100);
                            return `${m}:${s}.${tenths}`;
                        };

                        container.innerHTML = `
                            <div class="timer-container">
                                <div class="timer-display" id="sw_disp_${winState.id}">${formatTime(0)}</div>
                                <div class="timer-controls">
                                    <button class="timer-btn primary" id="sw_start_${winState.id}">
                                        <i data-lucide="play" size="14"></i> <span>Iniciar</span>
                                    </button>
                                    <button class="timer-btn" id="sw_reset_${winState.id}">
                                        <i data-lucide="rotate-ccw" size="14"></i> <span>Reiniciar</span>
                                    </button>
                                </div>
                            </div>
                        `;

                        const updateUI = () => {
                            const formatted = formatTime(elapsedMs);
                            const disp = container.querySelector(`#sw_disp_${winState.id}`);
                            if (disp) disp.innerText = formatted;
                            wm.updatePipLabel(winState.id, formatted);
                        };

                        const tick = () => {
                            if (!isRunning) return;
                            const now = performance.now();
                            elapsedMs += (now - startTime);
                            startTime = now;
                            updateUI();
                        };

                        const toggleStart = () => {
                            isRunning = !isRunning;
                            const startBtn = container.querySelector(`#sw_start_${winState.id}`);
                            if (isRunning) {
                                startTime = performance.now();
                                timerInterval = setInterval(tick, 80);
                                if (startBtn) startBtn.innerHTML = '<i data-lucide="pause" size="14"></i> <span>Pausar</span>';
                            } else {
                                clearInterval(timerInterval);
                                if (startBtn) startBtn.innerHTML = '<i data-lucide="play" size="14"></i> <span>Iniciar</span>';
                            }
                            window.homescreenCreateIcons();
                        };

                        const reset = () => {
                            isRunning = false;
                            clearInterval(timerInterval);
                            elapsedMs = 0;
                            const startBtn = container.querySelector(`#sw_start_${winState.id}`);
                            if (startBtn) startBtn.innerHTML = '<i data-lucide="play" size="14"></i> <span>Iniciar</span>';
                            updateUI();
                            window.homescreenCreateIcons();
                        };

                        container.querySelector(`#sw_start_${winState.id}`).addEventListener('click', toggleStart);
                        container.querySelector(`#sw_reset_${winState.id}`).addEventListener('click', reset);

                        winState.toolData.stopFn = () => clearInterval(timerInterval);
                        updateUI();
                    }
                });
            }
        };

        window.homescreenNativeTools = appLauncher;

        window.calcEngine = {
            getDisplay: (btn) => btn.closest('.calc-container').querySelector('.calc-display'),
            press: (val, btn) => {
                const disp = calcEngine.getDisplay(btn);
                if (disp.innerText === '0' || disp.innerText === 'Error') disp.innerText = '';
                disp.innerText += val;
            },
            clear: (btn) => {
                calcEngine.getDisplay(btn).innerText = '0';
            },
            backspace: (btn) => {
                const disp = calcEngine.getDisplay(btn);
                disp.innerText = disp.innerText.slice(0, -1) || '0';
            },
            eval: (btn) => {
                const disp = calcEngine.getDisplay(btn);
                try {
                    const sanitized = disp.innerText.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
                    disp.innerText = Function(`'use strict'; return (${sanitized})`)();
                } catch (e) {
                    disp.innerText = 'Error';
                    disp.classList.add('error-shake');
                    setTimeout(() => disp.classList.remove('error-shake'), 250);
                }
            }
        };
        const calcEngine = window.calcEngine;

        window.taskEngine = {
            add: (btnOrInput) => {
                const container = btnOrInput.closest('.task-container').parentElement;
                const input = container.querySelector('.task-input');
                const val = input.value.trim();

                if (!val) {
                    input.classList.add('error-shake');
                    setTimeout(() => input.classList.remove('error-shake'), 250);
                    return;
                }

                container.taskState.push({ id: Date.now(), text: val, done: false });
                input.value = '';
                container.renderList();
            },
            toggle: (id, el) => {
                const container = el.closest('.task-container').parentElement;
                const task = container.taskState.find(t => t.id === id);
                if (task) {
                    task.done = !task.done;
                    container.renderList();
                }
            },
            remove: (id, el) => {
                const container = el.closest('.task-container').parentElement;
                container.taskState = container.taskState.filter(t => t.id !== id);
                container.renderList();
            }
        };
        const taskEngine = window.taskEngine;

        function escapeHtml(str) {
            return str.replace(/[&<>"']/g, (m) => ({
                '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
            })[m]);
        }


})();
