/** Clave donde se guarda la última sección abierta para restaurarla al recargar. */
const LAST_PAGE_KEY = 'casalum_last_page';

/**
 * Main Application Logic
 */
class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.historyPageSize = 15;
        this.historyVisibleCount = 15;
        this.init();
    }

    async init() {
        this.setupNavigation();

        try {
            await window.dbManager.init();
            console.log('Database initialized successfully');

            window.authManager.onAuthReady(async () => {
                await window.settingsManager.load();
                window.settingsManager.applyAdminState();
                this.updateDashboardStats();
                this.loadRecentQuotations();
                this.loadCatalogPreview();
                // El borrador se reconstruye antes de abrir la sección, para que el
                // asistente ya tenga el carrito y el cliente puestos al mostrarse.
                const draftRestored = window.quotationManager
                    ? window.quotationManager.restoreDraft()
                    : false;
                this.restoreLastPage(draftRestored);
            });
            await window.authManager.init();
        } catch (error) {
            console.error('Error initializing DB/Auth:', error);
            // Si falla el arranque no se puede dejar la pantalla de carga puesta:
            // se cae al login para que el usuario pueda reintentar.
            if (window.authManager) window.authManager.checkAuth();
        }
    }

    setupNavigation() {
        this.bindHistoryNavigation();

        const btnFrase = document.getElementById('btn-frase');
        if (btnFrase) {
            btnFrase.addEventListener('click', () => this.mostrarFrase());
            // Inicio ya viene activo desde el HTML, sin pasar por navigate():
            // sin esto el botón no aparece hasta cambiar de sección y volver.
            btnFrase.style.display = this.currentPage === 'dashboard' ? 'inline-flex' : 'none';
        }

        // Solo los nav-item que realmente navegan a una página (excluye el botón que
        // abre/cierra el submenú "Cotización", que no tiene data-page).
        const navButtons = document.querySelectorAll('.nav-item[data-page]');

        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Update active button
                navButtons.forEach(b => b.classList.remove('active'));
                const clickedBtn = e.currentTarget;
                clickedBtn.classList.add('active');

                // Navigate
                const targetPage = clickedBtn.getAttribute('data-page');
                this.navigate(targetPage);
            });
        });

        const navQuickQuote = document.getElementById('nav-quick-quote');
        if (navQuickQuote) {
            navQuickQuote.addEventListener('click', () => {
                if (window.quotationManager) window.quotationManager.startQuickQuote();
            });
        }

        // "Nueva Cotización" y "Cotización Rápida" comparten página pero deben ser
        // modos independientes: este handler evita que la rápida deje residuos
        // (carrito, cliente, stepper de 2 pasos) al entrar a la normal.
        const navNewQuotation = document.getElementById('nav-new-quotation');
        if (navNewQuotation) {
            navNewQuotation.addEventListener('click', () => {
                if (window.quotationManager) window.quotationManager.goToNewQuotation();
            });
        }

        // Acceso directo a "Base de Datos" desde el submenú Cotización: navega a
        // Catálogo y abre esa pestaña de una vez (en vez de la de Módulos, que es
        // la que abre por defecto). La edición sigue restringida a admins: reutiliza
        // la misma vista de Catálogo, que ya solo habilita los campos para ellos.
        const navCatalogDb = document.getElementById('nav-catalog-db');
        if (navCatalogDb) {
            navCatalogDb.addEventListener('click', () => {
                this.navigate('catalog');
                if (window.moduleManager) window.moduleManager.showView('db');
            });
        }
        const navCatalogModules = document.getElementById('nav-catalog-modules');
        if (navCatalogModules) {
            navCatalogModules.addEventListener('click', () => {
                this.navigate('catalog');
                if (window.moduleManager) window.moduleManager.showView('modules');
            });
        }

        const bindGroupToggle = (toggleId, submenuId, arrowId) => {
            const toggle = document.getElementById(toggleId);
            if (!toggle) return;
            toggle.addEventListener('click', () => {
                const submenu = document.getElementById(submenuId);
                const arrow = document.getElementById(arrowId);
                const isOpen = submenu.style.display === 'flex';
                submenu.style.display = isOpen ? 'none' : 'flex';
                toggle.setAttribute('aria-expanded', String(!isOpen));
                if (arrow) arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
            });
        };
        // Submenús desplegables: "Cotización" y "Catálogo"
        bindGroupToggle('nav-group-cotizacion', 'nav-submenu-cotizacion', 'nav-group-cotizacion-arrow');
        bindGroupToggle('nav-group-catalogo', 'nav-submenu-catalogo', 'nav-group-catalogo-arrow');

        // History: search, filters panel, apply/clear, load more
        const searchInput = document.getElementById('history-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => this.loadRecentQuotations());
        }

        const btnToggleFilters = document.getElementById('btn-toggle-filters');
        if (btnToggleFilters) {
            btnToggleFilters.addEventListener('click', () => {
                const panel = document.getElementById('history-filters-panel');
                panel.style.display = panel.style.display === 'none' ? 'grid' : 'none';
            });
        }

        const btnApplyFilters = document.getElementById('btn-apply-filters');
        if (btnApplyFilters) {
            btnApplyFilters.addEventListener('click', () => this.loadRecentQuotations());
        }

        const btnClearFilters = document.getElementById('btn-clear-filters');
        if (btnClearFilters) {
            btnClearFilters.addEventListener('click', () => {
                document.getElementById('filter-user').value = 'ALL';
                document.getElementById('filter-status').value = 'ALL';
                document.getElementById('filter-version-type').value = 'ALL';
                document.getElementById('filter-date-from').value = '';
                document.getElementById('filter-date-to').value = '';
                document.getElementById('history-search').value = '';
                this.loadRecentQuotations();
            });
        }

        const btnLoadMore = document.getElementById('btn-history-load-more');
        if (btnLoadMore) {
            btnLoadMore.addEventListener('click', () => {
                this.historyVisibleCount += this.historyPageSize;
                this.loadRecentQuotations(false);
            });
        }
    }

    getHistoryFilters() {
        return {
            search: (document.getElementById('history-search')?.value || '').trim().toLowerCase(),
            user: document.getElementById('filter-user')?.value || 'ALL',
            status: document.getElementById('filter-status')?.value || 'ALL',
            versionType: document.getElementById('filter-version-type')?.value || 'ALL',
            dateFrom: document.getElementById('filter-date-from')?.value || '',
            dateTo: document.getElementById('filter-date-to')?.value || ''
        };
    }

    /**
     * Guarda la sección abierta para reabrirla en la próxima recarga.
     * Se guarda junto al uid: si en el mismo equipo entra otro usuario, arranca
     * en su propia última sección y no en la del anterior.
     */
    rememberPage(pageId) {
        const user = window.authManager && window.authManager.currentUser;
        if (!user) return; // sin sesión todavía no hay nada que recordar
        try {
            localStorage.setItem(LAST_PAGE_KEY, JSON.stringify({ uid: user.uid, page: pageId }));
        } catch (e) {
            // Navegación privada o almacenamiento lleno: recordar la sección no es crítico.
            console.warn('No se pudo recordar la última sección:', e);
        }
    }

    /**
     * Reabre la última sección tras recargar. Se llama cuando ya se conoce el usuario.
     * @param {boolean} draftRestored si se recuperó una cotización a medio armar.
     */
    restoreLastPage(draftRestored) {
        const user = window.authManager && window.authManager.currentUser;
        if (!user) return;

        // Un enlace compartido manda: si la URL ya trae una sección, se abre esa
        // y no la última que estuviera guardada de la sesión anterior.
        const deLaUrl = this.seccionDe(location.hash ? location.hash.slice(1) : '');

        let saved = null;
        try {
            saved = JSON.parse(localStorage.getItem(LAST_PAGE_KEY) || 'null');
        } catch (e) {
            saved = null;
        }
        if (!deLaUrl && (!saved || saved.uid !== user.uid)) return;

        const pageId = deLaUrl || saved.page;
        if (!pageId || pageId === 'dashboard') return;                  // ya es la pantalla inicial
        if (!document.getElementById(`page-${pageId}`)) return;         // sección que ya no existe
        if (pageId === 'settings' && user.role !== 'admin') return;     // no la puede ver

        // replace: la restauración es la primera pantalla de la sesión, no un
        // paso al que se pueda "volver" con la flecha de atrás.
        this.navigate(pageId, { replace: true });
        this.syncNavActive(pageId);

        // Si se recuperó una cotización en curso se vuelve al paso donde la dejó;
        // si no hay nada que recuperar, el asistente abre limpio en el Paso 1.
        if (pageId === 'new-quotation' && window.quotationManager) {
            const step = draftRestored ? (window.quotationManager.currentStep || 1) : 1;
            window.quotationManager.goToStep(step);
        }
    }

    // ============================================================
    // HISTORIAL DEL NAVEGADOR (flechas atrás / adelante)
    // ============================================================

    /** Frases del botón del ojo, al lado del saludo de Inicio. */
    static get FRASES() {
        return [
            'Cada cotización bien hecha es un cliente que vuelve.',
            'El aluminio se corta una sola vez: medí dos veces, cotizá tranquilo.',
            'Un precio claro vende más que un precio bajo.',
            'La obra grande empieza por la primera ventana.',
            'Hoy es un buen día para cerrar ese presupuesto pendiente.',
            'Lo que se mide bien, se fabrica bien y se cobra bien.',
            'La prolijidad en el taller se nota en la fachada.',
            'No hay competencia que gane contra un trabajo bien terminado.',
            'Cotizar rápido también es dar buen servicio.',
            'El cliente recuerda cómo lo atendieron mucho después del precio.',
            'Cada obra terminada es publicidad que camina.',
            'Un buen presupuesto se explica solo.',
            'La constancia arma más ventanas que la suerte.',
            'Revisá el detalle: ahí está la diferencia entre bueno y excelente.',
            'El vidrio refleja el trabajo de quien lo instaló.',
            'Paso a paso, módulo a módulo.',
            'Un día ocupado es mejor que un día perdido.',
            'La confianza se construye con cada entrega a tiempo.',
            'Hacelo bien la primera vez y no lo hacés dos veces.',
            'Detrás de cada cotización hay una casa que alguien está soñando.'
        ];
    }

    /** Muestra una frase al azar en una tarjeta flotante. */
    mostrarFrase() {
        const frases = App.FRASES;
        // No repetir la anterior: sacando dos veces seguidas la misma, el botón
        // parece roto.
        let i = Math.floor(Math.random() * frases.length);
        if (frases.length > 1 && i === this._ultimaFrase) i = (i + 1) % frases.length;
        this._ultimaFrase = i;

        document.querySelectorAll('.frase-overlay').forEach(el => el.remove());

        const overlay = document.createElement('div');
        overlay.className = 'frase-overlay';
        overlay.innerHTML = `
            <div class="frase-card" role="dialog" aria-label="Mensaje del día">
                <button type="button" class="frase-cerrar" aria-label="Cerrar">
                    <i class="fa-solid fa-xmark"></i>
                </button>
                <i class="fa-solid fa-quote-left frase-comilla" aria-hidden="true"></i>
                <p class="frase-texto">${window.escapeHtml(frases[i])}</p>
                <button type="button" class="btn btn-outline btn-sm frase-otra">
                    <i class="fa-solid fa-shuffle"></i> Otra frase
                </button>
            </div>`;
        document.body.appendChild(overlay);

        const cerrar = () => {
            document.removeEventListener('keydown', onKey);
            overlay.remove();
        };
        const onKey = e => { if (e.key === 'Escape') cerrar(); };
        document.addEventListener('keydown', onKey);
        overlay.addEventListener('click', e => { if (e.target === overlay) cerrar(); });
        overlay.querySelector('.frase-cerrar').addEventListener('click', cerrar);
        overlay.querySelector('.frase-otra').addEventListener('click', () => this.mostrarFrase());
    }

    /**
     * Saludo del inicio, con el nombre de quien entró. La sesión la resuelve
     * Firebase en forma asincrónica, así que mientras no esté lista se muestra
     * el saludo sin nombre en lugar de un "Bienvenido undefined".
     */
    tituloInicio() {
        const user = window.authManager && window.authManager.currentUser;
        const nombre = user && (user.name || user.username);
        return nombre
            ? `Hola, ${nombre}. Bienvenido al sistema de cotizaciones de Casalum.`
            : 'Bienvenido al sistema de cotizaciones de Casalum.';
    }

    /**
     * Traduce el identificador interno de cada sección al texto que se ve en la
     * barra de direcciones. Adentro las secciones siguen llamándose igual
     * (page-new-quotation y compañía, que aparecen por todo el HTML), pero la
     * URL que ve y comparte el usuario va en español.
     */
    static get RUTAS() {
        return {
            'dashboard': 'inicio',
            'history': 'historial',
            'new-quotation': 'nueva-cotizacion',
            'clients': 'clientes',
            'catalog': 'catalogo',
            'glass-quote': 'cotizar-vidrio',
            'quick-price': 'precio-rapido',
            'settings': 'ajustes',
            'profile': 'perfil'
        };
    }

    /** Sección interna -> texto de la URL. */
    rutaDe(pageId) {
        return App.RUTAS[pageId] || pageId;
    }

    /**
     * Texto de la URL -> sección interna. Acepta también los nombres viejos en
     * inglés, así los enlaces y favoritos que alguien ya haya guardado siguen
     * funcionando.
     */
    seccionDe(ruta) {
        if (!ruta) return '';
        const enEspanol = Object.keys(App.RUTAS).find(k => App.RUTAS[k] === ruta);
        if (enEspanol) return enEspanol;
        return App.RUTAS[ruta] ? ruta : ruta;   // ya venía en inglés (enlace viejo)
    }

    /**
     * Deja la sección actual en el historial del navegador, para que las
     * flechas de atrás y adelante se muevan entre secciones en vez de sacar
     * al usuario de la aplicación entera.
     */
    pushHistory(pageId, replace) {
        const estado = { casalumPage: pageId };
        const url = '#' + this.rutaDe(pageId);
        const actual = history.state && history.state.casalumPage;

        // Repetir la misma sección no genera una entrada nueva: si no, había
        // que apretar atrás varias veces para salir de donde ya se estaba.
        if (!replace && actual === pageId) return;

        if (replace || actual === undefined) {
            history.replaceState(estado, '', url);
        } else {
            history.pushState(estado, '', url);
        }
    }

    /** Conecta las flechas del navegador con la navegación interna. */
    bindHistoryNavigation() {
        window.addEventListener('popstate', e => {
            const pageId = (e.state && e.state.casalumPage)
                || this.seccionDe(location.hash ? location.hash.slice(1) : '')
                || 'dashboard';

            if (!document.getElementById(`page-${pageId}`)) return;

            // Sección de admin: si el usuario no puede verla, no se abre.
            const user = window.authManager && window.authManager.currentUser;
            if (pageId === 'settings' && (!user || user.role !== 'admin')) return;

            this.navigate(pageId, { fromHistory: true });
            this.syncNavActive(pageId);
        });
    }

    /** Deja marcado en el menú lateral el botón de la sección abierta. */
    syncNavActive(pageId) {
        const buttons = [...document.querySelectorAll('.nav-item[data-page]')];
        buttons.forEach(b => b.classList.remove('active'));

        // "Cotización Rápida" comparte data-page con "Nueva Cotización": se marca
        // la primera coincidencia, que es la entrada del submenú.
        const match = buttons.find(b => b.getAttribute('data-page') === pageId);
        if (!match) return;
        match.classList.add('active');

        // Si la sección vive dentro de un submenú desplegable, se despliega.
        [
            ['nav-submenu-cotizacion', 'nav-group-cotizacion', 'nav-group-cotizacion-arrow'],
            ['nav-submenu-catalogo', 'nav-group-catalogo', 'nav-group-catalogo-arrow']
        ].forEach(([submenuId, toggleId, arrowId]) => {
            const submenu = document.getElementById(submenuId);
            if (!submenu || !submenu.contains(match)) return;
            submenu.style.display = 'flex';
            const toggle = document.getElementById(toggleId);
            const arrow = document.getElementById(arrowId);
            if (toggle) toggle.setAttribute('aria-expanded', 'true');
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        });
    }

    /**
     * @param {string} pageId
     * @param {Object} [opts]
     * @param {boolean} [opts.fromHistory] - true si viene de las flechas del
     *   navegador: en ese caso NO se agrega una entrada nueva al historial,
     *   porque el navegador ya se movió solo (si no, quedaría trabado).
     * @param {boolean} [opts.replace] - reemplaza la entrada actual en vez de
     *   apilar una nueva (para la restauración inicial de sesión).
     */
    navigate(pageId, opts) {
        const targetPage = document.getElementById(`page-${pageId}`);
        if (!targetPage) {
            console.warn(`navigate(): página desconocida "${pageId}", se ignora.`);
            return;
        }

        const o = opts || {};
        if (!o.fromHistory) this.pushHistory(pageId, o.replace);

        this.rememberPage(pageId);

        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });

        // Show target page
        targetPage.classList.add('active');

        // Update title
        const titles = {
            'dashboard': this.tituloInicio(),
            'new-quotation': 'Nueva Cotización',
            'clients': 'Directorio de Clientes',
            'history': 'Historial de Cotizaciones',
            'catalog': 'Catálogo de Productos',
            'glass-quote': 'Cotizar Vidrio',
            'quick-price': 'Precio Rápido',
            'settings': 'Ajustes de la Empresa'
        };
        document.getElementById('page-title').textContent = titles[pageId] || 'CASALUM';

        // El ojo acompaña al saludo: fuera de Inicio no viene a cuento.
        const btnFrase = document.getElementById('btn-frase');
        if (btnFrase) btnFrase.style.display = pageId === 'dashboard' ? 'inline-flex' : 'none';
        
        // Mobile sidebar close on navigate
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar && overlay) {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        }

        // Specific page logic
        if (pageId === 'dashboard') {
            this.updateDashboardStats();
        } else if (pageId === 'clients') {
            if (window.clientManager) {
                window.clientManager.loadClientsList();
            }
        } else if (pageId === 'catalog') {
            this.loadCatalogPreview();
        } else if (pageId === 'history') {
            this.loadRecentQuotations();
        } else if (pageId === 'glass-quote') {
            this.initGlassQuote();
        } else if (pageId === 'quick-price') {
            this.initQuickPrice();
        }
    }

    /** Inicializa la página de cotización rápida de vidrio suelto. */
    initGlassQuote() {
        const sel = document.getElementById('gq-glass-type');
        if (!sel || !window.SEED_DATA) return;

        // Populate glass types from glassSale (sale pricing)
        const glassData = window.SEED_DATA.glassSale || window.SEED_DATA.glass;
        sel.innerHTML = '<option value="">Seleccione el tipo de vidrio...</option>';
        glassData.forEach(g => {
            sel.innerHTML += `<option value="${window.escapeHtml(g.type)}">${window.escapeHtml(g.type)}</option>`;
        });

        // Wire up events only once
        if (!this._glassQuoteReady) {
            this._glassQuoteReady = true;

            const baseInput = document.getElementById('gq-base');
            const heightInput = document.getElementById('gq-height');
            const resultDiv = document.getElementById('gq-result');
            const resultLabel = document.getElementById('gq-result-label');
            const resultArea = document.getElementById('gq-result-area');
            const resultPrice = document.getElementById('gq-result-price');

            const calculate = () => {
                const type = sel.value;
                const base = parseFloat(baseInput.value);
                const height = parseFloat(heightInput.value);

                if (!type) { notify.warning('Seleccione un tipo de vidrio.'); return; }
                if (!base || base <= 0) { notify.warning('Ingrese la base en metros.'); return; }
                if (!height || height <= 0) { notify.warning('Ingrese la altura en metros.'); return; }

                const glassData = window.SEED_DATA.glassSale || window.SEED_DATA.glass;
                const glass = glassData.find(g => g.type === type);
                if (!glass) return;

                const adjustedBase = base + 0.05;   // +5 cm
                const adjustedHeight = height + 0.05; // +5 cm
                const area = adjustedBase * adjustedHeight;
                const price = glass.pricePerM2 * area;

                resultLabel.textContent = `${type}`;
                resultArea.textContent = `${base.toFixed(2)} × ${height.toFixed(2)} m`;
                resultPrice.textContent = `$${price.toFixed(2)}`;
                resultDiv.style.display = 'block';

                const saveBtn = document.getElementById('gq-save');
                if (saveBtn) {
                    saveBtn.style.display = 'inline-block';
                    saveBtn.onclick = async () => {
                        try {
                            const quotation = {
                                clientId: 'MOSTRADOR',
                                clientName: 'Venta de Vidrio Mostrador',
                                date: new Date().toISOString(),
                                cart: [{
                                    quantity: 1,
                                    description: `Vidrio suelto: ${type}`,
                                    dimensions: `${base.toFixed(2)} × ${height.toFixed(2)}m`,
                                    rawTotal: price,
                                    total: price,
                                    type: 'glass-sale'
                                }],
                                totals: { total: price },
                                settings: window.calculator?.settings || {},
                                author: window.authManager.currentUser.username,
                                authorName: window.authManager.currentUser.name,
                                revisionLabel: 'Venta de Vidrio', // Se muestra en lugar de COT-XXX
                                parentId: null,
                                status: 'active',
                                quickQuote: true,
                                isGlassQuote: true // Flag to identify it in history
                            };

                            await window.dbManager.save('quotations', quotation);
                            notify.success('Cotización de vidrio guardada en el historial.');

                            // Reset
                            baseInput.value = '';
                            heightInput.value = '';
                            sel.value = '';
                            resultDiv.style.display = 'none';
                            saveBtn.style.display = 'none';
                        } catch (e) {
                            console.error('Error saving glass quote', e);
                            notify.error('Hubo un error al guardar la cotización.');
                        }
                    };
                }
            };

            document.getElementById('gq-calculate').addEventListener('click', calculate);

            document.getElementById('gq-clear').addEventListener('click', () => {
                sel.value = '';
                baseInput.value = '';
                heightInput.value = '';
                resultDiv.style.display = 'none';
                const saveBtn = document.getElementById('gq-save');
                if (saveBtn) saveBtn.style.display = 'none';
            });

            // Allow Enter key to calculate
            [baseInput, heightInput].forEach(inp => {
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); calculate(); } });
            });
        }
    }

    /** Inicializa "Precio Rápido": lista de precio de referencia por m² de cada ítem preestablecido. */
    initQuickPrice() {
        const groupSel = document.getElementById('qp-group');
        if (!groupSel || !window.CATALOG_GROUPS) return;

        if (!this._quickPriceReady) {
            this._quickPriceReady = true;
            groupSel.innerHTML = '<option value="">Todos los grupos</option>' +
                window.CATALOG_GROUPS.map(g => `<option value="${window.escapeHtml(g)}">${window.escapeHtml(g)}</option>`).join('');

            const filterEl = document.getElementById('qp-filter');
            const render = () => this.renderQuickPrice();
            filterEl.addEventListener('input', render);
            groupSel.addEventListener('change', render);
        }

        this.renderQuickPrice();
    }

    /** Pinta la lista de precios de referencia según los filtros actuales de "Precio Rápido". */
    renderQuickPrice() {
        const cont = document.getElementById('qp-results');
        const empty = document.getElementById('qp-empty');
        if (!cont || !window.SEED_DATA || !window.calculator) return;

        const q = (document.getElementById('qp-filter').value || '').trim().toLowerCase();
        const group = document.getElementById('qp-group').value;

        // Solo ítems con receta cargada: sin módulo no hay nada que calcular.
        const items = (window.CATALOG_ITEMS || []).filter(it => {
            if (!window.SEED_DATA.modules[it.id]) return false;
            if (group && it.group !== group) return false;
            if (q && it.name.toLowerCase().indexOf(q) === -1) return false;
            return true;
        });

        if (!items.length) {
            cont.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        empty.style.display = 'none';

        // Agrupa por familia para que las variantes (2, 3, 4 módulos) queden juntas.
        const porFamilia = {};
        items.forEach(it => (porFamilia[it.family] = porFamilia[it.family] || []).push(it));

        let html = '';
        Object.keys(porFamilia).sort().forEach(fam => {
            html += `<div style="font-weight:700; color:var(--primary); margin: 1rem 0 0.5rem;">${window.escapeHtml(fam)}</div>
                <table class="table" style="font-size:0.85rem;"><tbody>`;
            porFamilia[fam].forEach(it => {
                const mod = window.SEED_DATA.modules[it.id];
                this.quickPriceRowsForModule(mod).forEach(({ brandName, price, faltantes }) => {
                    const celda = price === null
                        ? `<span class="text-muted" title="Falta cargar en esta marca: ${window.escapeHtml(faltantes.join(', '))}">Incompleto</span>`
                        : `$${price.toFixed(2)}/m²`;
                    html += `<tr>
                        <td style="padding:6px 8px;">${window.escapeHtml(it.name)}</td>
                        <td style="padding:6px 8px; color:var(--text-muted);">${window.escapeHtml(brandName)}</td>
                        <td style="padding:6px 8px; text-align:right; font-weight:700; color:var(--primary);">${celda}</td>
                    </tr>`;
                });
            });
            html += '</tbody></table>';
        });
        cont.innerHTML = html;
    }

    /**
     * Precio de referencia (1.00 x 1.00 m, con gastos generales + utilidad ya
     * aplicados) de un módulo preestablecido. En modo "Todos los proveedores"
     * devuelve una fila por marca, porque el precio real depende de cuál se
     * elija al cotizar (mismo cálculo que el "Costo de referencia" del editor
     * de recetas, ver ModuleManager.updateEstimate en js/modules.js).
     */
    quickPriceRowsForModule(mod) {
        const brandKeys = mod.brand === ModuleManager.ALL_BRANDS ? Object.keys(window.SEED_DATA.brands) : [mod.brand];

        return brandKeys.map(brandKey => {
            const brand = window.SEED_DATA.brands[brandKey];
            const brandName = brand ? brand.name : brandKey;
            if (!brand || !brand.colors.length) return { brandName, price: null, faltantes: ['sin color cargado'] };

            const color = brand.colors[0];
            const ctx = { width: 1, height: 1, perimeter: 4, area: 1, modules: 1 };
            const result = window.calculator.calculateWindowCost({
                width: 1, height: 1,
                brand: brandKey, system: mod.category, color: color,
                glassType: '', glassArea: 0,
                modules: 1,
                accessories: (mod.accessories || []).map(a => ({ name: a.name, price: a.price, qty: window.calculator.resolveAccessoryQty(a, ctx) })),
                labor: { ...(mod.labor || {}), hours: window.calculator.resolveLaborHours(mod.labor || {}, 1) },
                moduleProfiles: mod.profiles || []
            });

            if (result.perfilesFaltantes && result.perfilesFaltantes.length) {
                return { brandName, price: null, faltantes: result.perfilesFaltantes };
            }
            const { finalPrice } = window.calculator.applyMargins(result.total);
            return { brandName, price: finalPrice, faltantes: [] };
        });
    }

    async updateDashboardStats() {
        const count = await window.dbManager.count('clients');
        document.getElementById('stat-clients-count').textContent = count;
        
        const quotCount = await window.dbManager.count('quotations');
        document.getElementById('stat-quotations-count').textContent = quotCount;
    }

    async loadRecentQuotations(resetPage = true) {
        if (resetPage) this.historyVisibleCount = this.historyPageSize;

        let quotations = await window.dbManager.getAll('quotations');
        const container = document.getElementById('dashboard-quotations');
        const loadMoreBtn = document.getElementById('btn-history-load-more');
        const filters = this.getHistoryFilters();

        if (filters.user !== 'ALL') quotations = quotations.filter(q => q.author === filters.user);
        if (filters.status !== 'ALL') quotations = quotations.filter(q => (q.status || 'active') === filters.status);
        if (filters.versionType !== 'ALL') quotations = quotations.filter(q => (q.versionType || 'A') === filters.versionType);
        if (filters.dateFrom) quotations = quotations.filter(q => new Date(q.date) >= new Date(filters.dateFrom));
        if (filters.dateTo) quotations = quotations.filter(q => new Date(q.date) <= new Date(filters.dateTo + 'T23:59:59'));

        if (filters.search) {
            const clients = await window.dbManager.getAll('clients');
            const clientNameById = {};
            clients.forEach(c => { clientNameById[c.id] = (c.name || '').toLowerCase(); });

            quotations = quotations.filter(q => {
                const clientName = clientNameById[q.clientId] || '';
                return (q.clientId || '').toLowerCase().includes(filters.search) ||
                    clientName.includes(filters.search) ||
                    (q.baseCode || '').toLowerCase().includes(filters.search) ||
                    this.quotationDisplayCode(q).toLowerCase().includes(filters.search);
            });
        }

        if (quotations.length === 0) {
            container.innerHTML = '<p class="text-muted text-center py-4">No hay cotizaciones para mostrar.</p>';
            if (loadMoreBtn) loadMoreBtn.style.display = 'none';
            return;
        }

        // Agrupar por baseCode (cotizaciones anteriores a esta versión del sistema, sin
        // baseCode, quedan cada una en su propio grupo de un solo elemento).
        const groups = new Map();
        quotations.forEach(q => {
            const key = q.baseCode || `legacy-${q.id}`;
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(q);
        });

        const groupList = Array.from(groups.values()).map(versions => {
            versions.sort((a, b) => new Date(a.date) - new Date(b.date));
            const root = versions.find(v => !v.parentId) || versions[0];
            const others = versions.filter(v => v.id !== root.id).sort((a, b) => new Date(b.date) - new Date(a.date));
            const latestDate = Math.max(...versions.map(v => new Date(v.date).getTime()));
            return { root, others, latestDate };
        });

        groupList.sort((a, b) => b.latestDate - a.latestDate);

        const visibleGroups = groupList.slice(0, this.historyVisibleCount);

        let html = '<table class="table" style="width:100%; border-collapse:collapse; margin-top:1rem;"><thead><tr><th>Código</th><th>Fecha y Hora</th><th>Cliente CI</th><th>Autor</th><th>Estado</th><th>Total</th><th>Acciones</th></tr></thead><tbody>';

        visibleGroups.forEach(({ root, others }) => {
            html += this.renderQuotationRow(root, { versionCount: others.length });
            others.forEach(v => {
                html += this.renderQuotationRow(v, { isVersion: true, groupKey: root.baseCode });
            });
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        if (loadMoreBtn) {
            loadMoreBtn.style.display = groupList.length > this.historyVisibleCount ? 'inline-block' : 'none';
        }
    }

    /** Código visible de una cotización: revisionLabel si existe, o el viejo COT-XXXXXX derivado del docId. */
    quotationDisplayCode(q) {
        if (q.revisionLabel) return q.revisionLabel;
        const displayId = (typeof q.id === 'string' && q.id.length > 10) ? q.id.substring(0, 6) : String(q.id).padStart(5, '0');
        return `COT-${displayId.toUpperCase()}`;
    }

    renderQuotationRow(q, { versionCount = 0, isVersion = false, groupKey = null } = {}) {
        const dateObj = new Date(q.date);
        const dateStr = dateObj.toLocaleDateString('es-ES') + ' ' + dateObj.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const authorName = q.authorName || q.author || 'N/A';
        const code = this.quotationDisplayCode(q);
        const status = q.status || 'active';
        const statusLabels = { active: ['Activa', 'var(--success)'], archived: ['Archivada', 'var(--text-muted)'], voided: ['Anulada', 'var(--danger)'] };
        const [statusLabel, statusColor] = statusLabels[status] || statusLabels.active;

        const toggleBtn = versionCount > 0
            ? `<button class="btn btn-sm btn-outline" style="margin-left:8px; padding:2px 8px; font-size:0.75rem;" onclick="window.app.toggleVersions(this, '${q.baseCode || ''}')">+${versionCount} versiones</button>`
            : '';

        const versionAttr = isVersion ? `data-version-of="${groupKey || ''}"` : '';
        const rowExtraStyle = isVersion ? 'display:none; background: var(--bg-alt);' : '';
        const codeCellPrefix = isVersion ? '<span style="color: var(--text-muted);">&#8627;</span> ' : '';
        const quickBadge = q.quickQuote
            ? '<span title="Cotización rápida" style="margin-left:6px; background: var(--warning-light, #fef3c7); color: var(--warning, #b45309); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600;"><i class="fa-solid fa-bolt"></i> Rápida</span>'
            : '';

        const archiveOrRestoreBtn = status === 'archived'
            ? `<button class="btn btn-sm btn-outline" onclick="window.app.setQuotationStatus('${q.id}', 'active')" title="Restaurar" style="margin-left: 5px;"><i class="fa-solid fa-box-open"></i></button>`
            : `<button class="btn btn-sm btn-outline" onclick="window.app.setQuotationStatus('${q.id}', 'archived')" title="Archivar" style="margin-left: 5px;"><i class="fa-solid fa-box-archive"></i></button>`;
        const voidOrRestoreBtn = status === 'voided'
            ? `<button class="btn btn-sm btn-outline" onclick="window.app.setQuotationStatus('${q.id}', 'active')" title="Restaurar" style="margin-left: 5px;"><i class="fa-solid fa-rotate-left"></i></button>`
            : `<button class="btn btn-sm btn-outline" onclick="window.app.setQuotationStatus('${q.id}', 'voided')" title="Anular" style="margin-left: 5px; color: var(--danger); border-color: var(--danger);"><i class="fa-solid fa-ban"></i></button>`;

        return `
            <tr ${versionAttr} style="border-bottom: 1px solid var(--border-light); ${rowExtraStyle}">
                <td style="padding: 10px;">${codeCellPrefix}${code}${quickBadge}${toggleBtn}</td>
                <td style="padding: 10px;">${dateStr}</td>
                <td style="padding: 10px;">${window.escapeHtml(q.clientName || q.clientId)}</td>
                <td style="padding: 10px;"><span style="background: var(--bg-alt); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.8rem; color: var(--text-secondary);">${window.escapeHtml(authorName)}</span></td>
                <td style="padding: 10px;"><span style="color: ${statusColor}; font-weight: 600; font-size: 0.8rem;">${statusLabel}</span></td>
                <td style="padding: 10px; font-weight:600; color:var(--primary);">$${(q.totals?.total ?? 0).toFixed(2)}</td>
                <td style="padding: 10px; white-space: nowrap;">
                    ${q.isGlassQuote ? '' : `<button class="btn btn-sm btn-outline" onclick="window.app.printQuotation('${q.id}')" title="Imprimir cotización" style="border-color: var(--primary); color: var(--primary);">
                        <i class="fa-solid fa-print"></i>
                    </button>
                    <button class="btn btn-sm btn-outline" onclick="window.app.editQuotation('${q.id}')" title="Editar / Versionar" style="margin-left: 5px;">
                        <i class="fa-solid fa-pen"></i>
                    </button>`}
                    ${archiveOrRestoreBtn}
                    ${voidOrRestoreBtn}
                    <button class="btn btn-sm btn-danger" onclick="window.app.deleteQuotation('${q.id}')" title="Borrar cotización" style="margin-left: 5px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }

    toggleVersions(btn, baseCode) {
        const rows = document.querySelectorAll(`tr[data-version-of="${baseCode}"]`);
        if (!rows.length) return;
        const isHidden = rows[0].style.display === 'none';
        rows.forEach(r => { r.style.display = isHidden ? 'table-row' : 'none'; });
        btn.textContent = isHidden ? 'Ocultar versiones' : `+${rows.length} versiones`;
    }

    async setQuotationStatus(id, status) {
        try {
            await window.dbManager.save('quotations', { id, status }, 'id');
            this.loadRecentQuotations(false);
        } catch (e) {
            console.error('Error updating quotation status', e);
            notify.error('Hubo un error al actualizar el estado de la cotización.');
        }
    }

    async editQuotation(id) {
        const q = await window.dbManager.getById('quotations', id);
        if (q && window.quotationManager) {
            window.quotationManager.loadQuotationForEdit(q);
        }
    }

    async printQuotation(id) {
        const q = await window.dbManager.getById('quotations', id);
        if (!q) return;

        const client = await window.dbManager.getById('clients', q.clientId);
        
        const tempQM = {
            id: q.id,
            cart: q.cart,
            totals: q.totals,
            quoteNumber: q.quoteNumber,
            quoteYear: q.quoteYear,
            editingDate: q.date,
            ensureQuotationNumber: async () => {
                if (q.quoteNumber && q.quoteYear) {
                    return { number: q.quoteNumber, year: q.quoteYear };
                }
                return window.quotationManager.ensureQuotationNumber();
            }
        };

        const originalClient = window.clientManager.currentClient;
        const originalUser = window.authManager.currentUser;
        const originalSettings = window.calculator.settings;

        window.clientManager.currentClient = client || { id: q.clientId, name: q.clientName || 'Consumidor Final', address: q.clientAddress || '' };
        window.authManager.currentUser = { name: q.authorName || q.author };
        window.calculator.settings = q.settings || window.calculator.settings;

        if (window.pdfGenerator) {
            window.pdfGenerator.generate(tempQM);
        } else {
            notify.error('Generador de PDF no disponible.');
        }

        // Restore
        window.clientManager.currentClient = originalClient;
        window.authManager.currentUser = originalUser;
        window.calculator.settings = originalSettings;
    }

    async deleteQuotation(id) {
        if (!(await notify.confirm('¿Está seguro de que desea eliminar esta cotización? Esta acción no se puede deshacer.', { danger: true, confirmText: 'Eliminar' }))) {
            return;
        }

        try {
            await window.dbManager.delete('quotations', id);
            
            let activeFilter = 'ALL';
            const activeBtn = document.querySelector('.filter-btn.btn-primary');
            if (activeBtn) {
                activeFilter = activeBtn.getAttribute('data-user');
            }
            this.loadRecentQuotations(activeFilter);
            this.updateDashboardStats();
        } catch (e) {
            console.error('Error deleting quotation', e);
            notify.error('Hubo un error al intentar eliminar la cotización.');
        }
    }
    
    loadCatalogPreview() {
        const isAdmin = !!(window.authManager && window.authManager.currentUser && window.authManager.currentUser.role === 'admin');

        if (window.catalogManager) {
            window.catalogManager.isAdmin = isAdmin;
            window.catalogManager.showAdminControls();
            window.catalogManager.renderCurrentTab();
        }

        // El rol se conoce recién al autenticar, así que el editor de módulos
        // se refresca acá y no al construirse.
        if (window.moduleManager) {
            window.moduleManager.isAdmin = isAdmin;
            window.moduleManager.applyAdminVisibility();
            window.moduleManager.populateItemSelect();
        }
    }
}

// Start app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
