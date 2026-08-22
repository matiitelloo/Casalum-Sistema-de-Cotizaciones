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
        // Vidrios sueltos que va llevando el cliente en Cotizar Vidrio.
        this.glassCart = [];
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
                // Los ítems del menú son enlaces de verdad (<a href="#...">)
                // para que el clic derecho ofrezca "Abrir en una pestaña nueva".
                // Con Ctrl/Cmd/Shift o el botón del medio se deja pasar la
                // navegación del navegador, que es lo que abre la otra pestaña.
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
                e.preventDefault();

                // De marcar el boton se encarga navigate().
                this.navigate(e.currentTarget.getAttribute('data-page'));
            });
        });

        // Las dos tarjetas de Inicio llevan al listado que resumen. Mismo trato que
        // el menú: son enlaces, así que con Ctrl o el botón del medio se deja pasar
        // la navegación del navegador para abrir en otra pestaña.
        document.querySelectorAll('.stat-card[data-page]').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;
                e.preventDefault();
                this.navigate(card.getAttribute('data-page'));
            });
        });

        // Ni los dos botones del submenú Catálogo ni los de Cotización necesitan
        // manejador propio: cada uno lleva su data-page ("catalog"/"catalog-db",
        // "new-quotation"/"quick-quote") y navigate() abre la vista o el modo
        // que corresponde según la sección. "Nueva Cotización" y "Cotización
        // Rápida" comparten pantalla pero son modos independientes: entrar a
        // una limpia lo que dejó la otra.

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
        // Se busca la PANTALLA, no la sección: "catalog-db" no tiene un
        // page-catalog-db propio, comparte page-catalog con "catalog".
        if (!document.getElementById(`page-${this.pantallaDe(pageId)}`)) return;
        if (pageId === 'settings' && user.role !== 'admin') return;     // no la puede ver

        // replace: la restauración es la primera pantalla de la sesión, no un
        // paso al que se pueda "volver" con la flecha de atrás.
        this.navigate(pageId, { replace: true });
        this.syncNavActive(pageId);

        // Si se recuperó una cotización en curso se vuelve al paso donde la dejó;
        // si no hay nada que recuperar, el asistente abre limpio en el Paso 1.
        // Vale para los dos modos: "quick-quote" es la misma pantalla.
        if (this.pantallaDe(pageId) === 'new-quotation' && window.quotationManager) {
            const qm = window.quotationManager;
            const step = draftRestored ? (qm.currentStep || 1) : (qm.isQuickQuote ? 3 : 1);
            qm.goToStep(step);
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
            // Cotización Rápida es la misma pantalla en otro modo, pero con su
            // propia dirección: así se puede recargar o compartir el enlace.
            'quick-quote': 'cotizacion-rapida',
            'clients': 'clientes',
            // Catálogo tiene dos vistas dentro de la misma pantalla. Cada una
            // lleva su propia dirección para que recargar con F5 vuelva a la
            // que se estaba viendo, y para poder compartir el enlace.
            'catalog': 'preestablecer',
            'catalog-db': 'base_de_datos',
            'glass-quote': 'cotizar-vidrio',
            'settings': 'ajustes',
            'profile': 'perfil'
        };
    }

    /**
     * Secciones que comparten pantalla con otra: cada una tiene su dirección
     * pero abre el mismo <div class="page">, en un modo o vista distinta.
     * Clave: sección de la URL. Valor: id de la pantalla.
     */
    static get PANTALLAS() {
        return {
            'catalog-db': 'catalog',        // Base de Datos vive en page-catalog
            'quick-quote': 'new-quotation'  // Cotización Rápida, en page-new-quotation
        };
    }

    /** Cuál de las dos vistas del Catálogo abre cada sección. */
    static get SUBVISTA_CATALOGO() {
        return { 'catalog': 'modules', 'catalog-db': 'db' };
    }

    /** Id del <div class="page"> que le corresponde a una sección. */
    pantallaDe(pageId) {
        return App.PANTALLAS[pageId] || pageId;
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
        // Enlaces viejos: el Catálogo era una sola dirección "#catalogo" y hoy
        // son dos. Se abre en Preestablecer Ítems, que era lo que mostraba.
        if (ruta === 'catalogo') return 'catalog';
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

            // La pantalla, no la sección: "catalog-db" comparte page-catalog.
            if (!document.getElementById(`page-${this.pantallaDe(pageId)}`)) return;

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
        // "catalog-db" no tiene pantalla propia: es page-catalog con la otra
        // vista abierta (ver SUBVISTA_CATALOGO).
        const pantalla = this.pantallaDe(pageId);
        const targetPage = document.getElementById(`page-${pantalla}`);
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

        // El menu se marca aca y no en cada boton: a la pantalla se llega
        // tambien desde las tarjetas de Inicio, desde el historial del
        // navegador y al recargar, y antes cada camino tenia que acordarse.
        this.syncNavActive(pageId);

        // Update title
        const titles = {
            'dashboard': this.tituloInicio(),
            'new-quotation': 'Nueva Cotización',
            'clients': 'Directorio de Clientes',
            'history': 'Historial de Cotizaciones',
            'catalog': 'Catálogo de Productos',
            'catalog-db': 'Catálogo de Productos',
            'glass-quote': 'Cotizar Vidrio',
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
        } else if (pantalla === 'catalog') {
            // Cuál de las dos vistas abrir sale de la sección, o sea de la URL.
            if (window.moduleManager) window.moduleManager.showView(App.SUBVISTA_CATALOGO[pageId] || 'modules');
            this.loadCatalogPreview();
        } else if (pantalla === 'new-quotation') {
            // El modo sale de la sección, o sea de la URL.
            const qm = window.quotationManager;
            if (qm) {
                if (pageId === 'quick-quote') {
                    // Solo si no estaba ya en ese modo: startQuickQuote() vacía
                    // el carrito, y al recargar en "#cotizacion-rapida" se
                    // llevaría puesto el borrador que se acaba de recuperar.
                    if (!qm.isQuickQuote) qm.startQuickQuote();
                } else {
                    // No hace nada si ya venía en modo normal (no pierde lo cargado).
                    qm.goToNewQuotation();
                }
            }
        } else if (pageId === 'history') {
            this.loadRecentQuotations();
        } else if (pageId === 'glass-quote') {
            this.initGlassQuote();
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

            /**
             * Lee el formulario y calcula el precio de ese vidrio. Devuelve null
             * (y avisa) si falta algo. El vidrio se corta 5 cm mas grande de la
             * medida pedida, y sobre esa medida se cobra.
             */
            const leerVidrio = () => {
                const type = sel.value;
                const base = parseFloat(baseInput.value);
                const height = parseFloat(heightInput.value);
                const qty = parseInt(document.getElementById('gq-qty').value, 10) || 1;

                if (!type) { notify.warning('Seleccione un tipo de vidrio.'); return null; }
                if (!base || base <= 0) { notify.warning('Ingrese la base en metros.'); return null; }
                if (!height || height <= 0) { notify.warning('Ingrese la altura en metros.'); return null; }
                if (qty < 1) { notify.warning('La cantidad tiene que ser 1 o más.'); return null; }

                const glassData = window.SEED_DATA.glassSale || window.SEED_DATA.glass;
                const glass = glassData.find(g => g.type === type);
                if (!glass) return null;

                const area = (base + 0.05) * (height + 0.05);   // +5 cm por lado
                const unitario = glass.pricePerM2 * area;
                return { type, base, height, qty, area, unitario, total: unitario * qty };
            };

            const calculate = () => {
                const v = leerVidrio();
                if (!v) return;
                const { type, base, height, qty } = v;
                const price = v.total;

                resultLabel.textContent = qty > 1 ? `${type} (x${qty})` : `${type}`;
                resultArea.textContent = `${base.toFixed(2)} × ${height.toFixed(2)} m`;
                resultPrice.textContent = `$${price.toFixed(2)}`;
                resultDiv.style.display = 'block';

            };

            document.getElementById('gq-calculate').addEventListener('click', calculate);

            // Agregar a la lista: un cliente puede llevar varios vidrios de
            // distinto tipo y medida en la misma compra.
            document.getElementById('gq-add').addEventListener('click', () => {
                const v = leerVidrio();
                if (!v) return;
                this.glassCart.push(v);
                this.renderGlassCart();
                // El formulario queda listo para el siguiente, conservando el tipo
                // de vidrio: lo mas comun es pedir varias piezas del mismo.
                baseInput.value = '';
                heightInput.value = '';
                document.getElementById('gq-qty').value = '1';
                resultDiv.style.display = 'none';
                baseInput.focus();
            });

            document.getElementById('gq-clear').addEventListener('click', () => {
                sel.value = '';
                baseInput.value = '';
                heightInput.value = '';
                document.getElementById('gq-qty').value = '1';
                resultDiv.style.display = 'none';
                this.glassCart = [];
                this.renderGlassCart();
            });

            document.getElementById('gq-save').addEventListener('click', () => this.guardarVentaDeVidrio());

            // Allow Enter key to calculate
            [baseInput, heightInput].forEach(inp => {
                inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); calculate(); } });
            });
        }
    }

    /** Dibuja la lista de vidrios de la venta y su total. */
    renderGlassCart() {
        const caja = document.getElementById('gq-lista-caja');
        const cuerpo = document.getElementById('gq-lista-cuerpo');
        const guardar = document.getElementById('gq-save');
        if (!caja || !cuerpo) return;

        const lista = this.glassCart || [];
        caja.style.display = lista.length ? 'block' : 'none';
        if (guardar) guardar.style.display = lista.length ? 'inline-block' : 'none';

        // Se arma con DOM y textContent: el tipo de vidrio sale del catálogo y
        // podría traer comillas o HTML.
        cuerpo.innerHTML = '';
        lista.forEach((v, i) => {
            const tr = document.createElement('tr');
            const celda = (texto) => {
                const td = document.createElement('td');
                td.textContent = texto;
                return td;
            };
            const quitar = document.createElement('button');
            quitar.className = 'btn btn-sm btn-danger';
            quitar.innerHTML = '<i class="fa-solid fa-trash"></i>';
            quitar.title = 'Quitar de la lista';
            quitar.addEventListener('click', () => {
                this.glassCart.splice(i, 1);
                this.renderGlassCart();
            });
            const tdQuitar = document.createElement('td');
            tdQuitar.appendChild(quitar);

            tr.append(
                celda(i + 1),
                celda(v.type),
                celda(`${v.base.toFixed(2)} × ${v.height.toFixed(2)} m`),
                celda(v.qty),
                celda(`$${v.total.toFixed(2)}`),
                tdQuitar
            );
            cuerpo.appendChild(tr);
        });

        const total = lista.reduce((s, v) => s + v.total, 0);
        const elTotal = document.getElementById('gq-lista-total');
        if (elTotal) elTotal.textContent = `$${total.toFixed(2)}`;
    }

    /** Guarda toda la lista como una sola venta en el historial. */
    async guardarVentaDeVidrio() {
        const lista = this.glassCart || [];
        if (!lista.length) { notify.warning('Agregue al menos un vidrio a la lista.'); return; }

        const total = lista.reduce((s, v) => s + v.total, 0);
        try {
            await window.dbManager.save('quotations', {
                clientId: 'MOSTRADOR',
                clientName: 'Venta de Vidrio Mostrador',
                date: new Date().toISOString(),
                cart: lista.map(v => ({
                    quantity: v.qty,
                    description: `Vidrio suelto: ${v.type}`,
                    dimensions: `${v.base.toFixed(2)} × ${v.height.toFixed(2)}m`,
                    unitPrice: v.unitario,
                    rawTotal: v.total,
                    total: v.total,
                    type: 'glass-sale'
                })),
                totals: { total: total },
                settings: (window.calculator && window.calculator.settings) || {},
                author: window.authManager.currentUser.username,
                authorName: window.authManager.currentUser.name,
                revisionLabel: 'Venta de Vidrio',   // se muestra en lugar del código
                parentId: null,
                status: 'active',
                quickQuote: true,
                isGlassQuote: true
            });
            notify.success(lista.length === 1
                ? 'Venta de vidrio guardada en el historial.'
                : `Venta de ${lista.length} vidrios guardada en el historial.`);

            this.glassCart = [];
            this.renderGlassCart();
            document.getElementById('gq-base').value = '';
            document.getElementById('gq-height').value = '';
            document.getElementById('gq-qty').value = '1';
            document.getElementById('gq-glass-type').value = '';
            document.getElementById('gq-result').style.display = 'none';
        } catch (e) {
            console.error('Error guardando la venta de vidrio:', e);
            notify.error('Hubo un error al guardar la venta.');
        }
    }

    /**
     * Los dos números de Inicio. Se piden a la nube, así que tardan: hasta que
     * llegan se muestra "Cargando...". Antes arrancaban en 0, y al recargar la
     * página parecía por un momento que no había ninguna cotización ni ningún
     * cliente.
     */
    async updateDashboardStats() {
        const poner = (id, valor) => {
            const el = document.getElementById(id);
            if (el) el.textContent = valor;
        };
        poner('stat-clients-count', 'Cargando...');
        poner('stat-quotations-count', 'Cargando...');

        // Los dos a la vez: uno no tiene por qué esperar al otro.
        const [clientes, cotizaciones] = await Promise.all([
            window.dbManager.count('clients').catch(() => null),
            window.dbManager.count('quotations').catch(() => null)
        ]);

        // Sin señal se dice, no se inventa un cero.
        poner('stat-clients-count', clientes === null ? '—' : clientes);
        poner('stat-quotations-count', cotizaciones === null ? '—' : cotizaciones);
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
