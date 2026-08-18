/** Clave del borrador de la cotización en curso, para que sobreviva a una recarga. */
const DRAFT_KEY = 'casalum_quotation_draft';

/**
 * Quotations Manager
 */
class QuotationManager {
    constructor() {
        this.cart = [];
        this.currentStep = 1;
        this.totals = { subtotal: 0, iva: 0, total: 0 };
        this.editingId = null;
        this.editingDate = null;
        this.baseCode = null;
        this.versionType = null;
        this.versionNumber = null;
        this.revisionLabel = null;
        this.parentId = null;
        this.leavesManuallyEdited = false;
        this.isQuickQuote = false;
        this.activeModule = null;   // módulo preestablecido aplicado al ítem en edición
        this.applyingModule = false;
        this.init();
    }

    init() {
        // Expose nextStep to window.app
        window.app.nextStep = (step) => this.goToStep(step);

        // Bind stepper clicks
        document.querySelectorAll('.stepper .step').forEach((el, index) => {
            el.addEventListener('click', () => {
                const destino = index + 1;
                // Hacer clic en el número del paso saltaba TODAS las validaciones
                // que sí hacen los botones "Siguiente": se podía llegar a Detalles
                // (o al Resumen) sin cliente y sin productos, y sin ningún aviso.
                if (!this.canGoToStep(destino)) return;
                this.goToStep(destino);
            });
        });

        // Bind form events for Step 2 (Detalles)
        this.bindStep2Events();

        // Bind form events for Step 3 (Productos)
        this.bindStep3Events();

        // Bind form events for Step 4 (Resumen)
        this.bindStep4Events();

        // Populate dropdowns
        this.populateDropdowns();
        this.populateSystemSelect();

        // Si recarga justo dentro del margen del guardado diferido, se vuelca ahora
        // para no perder lo último que escribió.
        window.addEventListener('beforeunload', () => {
            clearTimeout(this.draftSaveTimer);
            this.saveDraft();
        });
    }

    // ============================================================
    // BORRADOR EN CURSO (sobrevive a recargar la página)
    // ============================================================

    /** Campos del formulario de cliente tal como están escritos ahora mismo. */
    readClientForm() {
        const val = id => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };
        return {
            id: val('client-id'),
            name: val('client-name'),
            phone: val('client-phone'),
            address: val('client-address')
        };
    }

    /** Campos del producto que se está armando en el Paso 3, tal como están ahora. */
    readItemForm() {
        const val = id => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };
        const accessories = {};
        document.querySelectorAll('.acc-input').forEach(input => {
            const qty = parseFloat(input.value);
            if (qty > 0) accessories[input.getAttribute('data-name')] = input.value;
        });
        const activeTab = document.querySelector('.product-form-tab.active');

        return {
            brand: val('p-brand'),
            system: val('p-system'),
            color: val('p-color'),
            width: val('p-width'),
            height: val('p-height'),
            modules: val('p-modules'),
            leaves: val('p-leaves'),
            mullon: document.getElementById('p-mullon') ? document.getElementById('p-mullon').checked : false,
            vidrioBesado: document.getElementById('p-vidrio-besado') ? document.getElementById('p-vidrio-besado').checked : false,
            glass: val('p-glass'),
            qty: val('p-qty'),
            labor: {
                workers: val('p-labor-workers'),
                hours: val('p-labor-hours'),
                transport: val('p-transport'),
                viaticos: val('p-viaticos')
            },
            accessories: accessories,
            tab: activeTab ? activeTab.getAttribute('data-tab') : 'productos'
        };
    }

    /**
     * Repone el producto a medio escribir. Los desplegables dependientes se
     * recargan a mano (sin disparar eventos) para no borrar el módulo activo.
     */
    restoreItemForm(form) {
        if (!form) return;
        const setVal = (id, v) => {
            const el = document.getElementById(id);
            if (el && v !== undefined && v !== null) el.value = v;
        };

        if (form.brand) {
            setVal('p-brand', form.brand);
            this.updateSystemDropdown();   // repuebla sistema y color de esa marca
            setVal('p-system', form.system);
            setVal('p-color', form.color);
        }

        setVal('p-width', form.width);
        setVal('p-height', form.height);
        this.asegurarOpcion(document.getElementById('p-modules'), form.modules);
        this.asegurarOpcion(document.getElementById('p-leaves'), form.leaves);
        setVal('p-qty', form.qty);
        const mullonCb = document.getElementById('p-mullon');
        if (mullonCb) mullonCb.checked = !!form.mullon;
        const besadoCb = document.getElementById('p-vidrio-besado');
        if (besadoCb) besadoCb.checked = !!form.vidrioBesado;

        setVal('p-glass', form.glass);
        this.updateGlassPrice();

        // El área de vidrio es un campo calculado: se recompone de las medidas.
        const w = parseFloat(form.width) || 0;
        const h = parseFloat(form.height) || 0;
        setVal('p-glass-area', w * h > 0 ? (w * h).toFixed(2) : '');

        if (form.labor) {
            setVal('p-labor-workers', form.labor.workers);
            setVal('p-labor-hours', form.labor.hours);
            setVal('p-transport', form.labor.transport);
            setVal('p-viaticos', form.labor.viaticos);
        }

        // Los accesorios guardados pisan a los que puso el módulo: puede haberlos ajustado.
        if (form.accessories) {
            Object.keys(form.accessories).forEach(name => {
                const input = document.querySelector(`.acc-input[data-name="${name}"]`);
                if (input) input.value = form.accessories[name];
            });
        }

        if (form.tab) this.switchProductTab(form.tab);
    }

    /** Guarda el borrador tras un ratito de inactividad, para no escribir en cada tecla. */
    queueSaveDraft() {
        clearTimeout(this.draftSaveTimer);
        this.draftSaveTimer = setTimeout(() => this.saveDraft(), 400);
    }

    /**
     * Guarda la cotización a medio armar: cliente, notas, carrito, descuento,
     * el paso actual y el producto que se esté escribiendo en ese momento.
     */
    saveDraft() {
        if (this.restoringDraft) return; // no re-guardar mientras se está restaurando

        const user = window.authManager && window.authManager.currentUser;
        if (!user) return;

        const clientForm = this.readClientForm();
        const notes = document.getElementById('q-notes') ? document.getElementById('q-notes').value : '';
        const pctEl = document.getElementById('summary-descuento-pct');
        const itemForm = this.readItemForm();

        // Un producto cuenta como "empezado" en cuanto tiene alguna medida escrita:
        // la marca o el sistema pueden venir preseleccionados sin que el usuario toque nada.
        const itemStarted = !!(itemForm.width || itemForm.height);

        // Si no hay nada que valga la pena guardar, se borra el borrador viejo
        // para no resucitar una cotización que el usuario ya abandonó.
        const hasSomething = this.cart.length > 0 || clientForm.id || clientForm.name || notes.trim() || itemStarted;
        if (!hasSomething) {
            this.clearDraft();
            return;
        }

        const draft = {
            uid: user.uid,
            savedAt: new Date().toISOString(),
            step: this.currentStep,
            cart: this.cart,
            client: window.clientManager ? window.clientManager.currentClient : null,
            clientForm: clientForm,
            notes: notes,
            discountPct: pctEl ? pctEl.value : 0,
            itemForm: itemStarted ? itemForm : null,
            editingId: this.editingId,
            editingDate: this.editingDate,
            quoteNumber: this.quoteNumber || null,
            quoteYear: this.quoteYear || null,
            baseCode: this.baseCode,
            versionType: this.versionType,
            versionNumber: this.versionNumber,
            revisionLabel: this.revisionLabel,
            parentId: this.parentId,
            isQuickQuote: this.isQuickQuote,
            leavesManuallyEdited: this.leavesManuallyEdited,
            // Al editar una cotización vieja se usan sus márgenes históricos, no los actuales.
            settings: window.calculator ? window.calculator.settings : null,
            moduleId: this.activeModule ? this.activeModule.itemId : null
        };

        try {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch (e) {
            // Almacenamiento lleno o navegación privada: no se interrumpe el trabajo.
            console.warn('No se pudo guardar el borrador de la cotización:', e);
        }
    }

    clearDraft() {
        try {
            localStorage.removeItem(DRAFT_KEY);
        } catch (e) { /* nada que hacer */ }
        const banner = document.getElementById('draft-restored-banner');
        if (banner) banner.style.display = 'none';
    }

    /**
     * Reconstruye la cotización que quedó a medias. Devuelve true si había algo
     * que recuperar. La llama app.js una vez que ya se sabe qué usuario entró.
     */
    restoreDraft() {
        const user = window.authManager && window.authManager.currentUser;
        if (!user) return false;

        let draft = null;
        try {
            draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        } catch (e) {
            draft = null;
        }
        // Un borrador de otro usuario del mismo equipo no se toca.
        if (!draft || draft.uid !== user.uid || !Array.isArray(draft.cart)) return false;

        this.restoringDraft = true;
        try {
            this.cart = draft.cart;
            this.editingId = draft.editingId || null;
            this.editingDate = draft.editingDate || null;
            this.quoteNumber = draft.quoteNumber || null;
            this.quoteYear = draft.quoteYear || null;
            this.baseCode = draft.baseCode || null;
            this.versionType = draft.versionType || null;
            this.versionNumber = draft.versionNumber || null;
            this.revisionLabel = draft.revisionLabel || null;
            this.parentId = draft.parentId || null;
            this.isQuickQuote = !!draft.isQuickQuote;
            this.leavesManuallyEdited = !!draft.leavesManuallyEdited;
            this.currentStep = draft.step || 1;

            if (draft.settings && window.calculator) {
                window.calculator.updateSettings(draft.settings);
            }

            // Cliente: el objeto guardado manda; si no lo hay, se repone lo tecleado.
            const cf = draft.clientForm || {};
            const setVal = (id, v) => {
                const el = document.getElementById(id);
                if (el) el.value = v || '';
            };
            setVal('client-id', cf.id);
            setVal('client-name', cf.name);
            setVal('client-phone', cf.phone);
            setVal('client-address', cf.address);
            if (window.clientManager) window.clientManager.currentClient = draft.client || null;

            setVal('q-notes', draft.notes);
            const pctEl = document.getElementById('summary-descuento-pct');
            if (pctEl) pctEl.value = draft.discountPct !== undefined ? draft.discountPct : 0;

            // Módulo que estaba aplicado. Hay que volver a volcar sus accesorios y
            // mano de obra: si no, el próximo ítem se agregaría sin ellos.
            const mod = draft.moduleId ? (window.SEED_DATA.modules || {})[draft.moduleId] : null;
            this.activeModule = mod || null;
            if (mod) this.applyModuleAccessoriesAndLabor(mod);

            // Va después del módulo a propósito: si el usuario había ajustado a mano
            // algún accesorio o la mano de obra, eso pisa a los valores del módulo.
            this.restoreItemForm(draft.itemForm);
            this.renderModuleInfo();

            // Botones que dependen de si se está editando una cotización existente
            const btnSave = document.getElementById('btn-save');
            if (btnSave) {
                btnSave.innerHTML = this.editingId
                    ? '<i class="fa-solid fa-save"></i> Actualizar Cotización'
                    : '<i class="fa-solid fa-save"></i> Guardar Cotización';
            }
            const btnSaveAs = document.getElementById('btn-save-as');
            if (btnSaveAs) btnSaveAs.style.display = this.baseCode ? '' : 'none';

            this.renderCart();
            this.showDraftBanner(draft.savedAt);
        } finally {
            this.restoringDraft = false;
        }

        return true;
    }

    showDraftBanner(savedAt) {
        const banner = document.getElementById('draft-restored-banner');
        if (!banner) return;
        const when = document.getElementById('draft-restored-when');
        if (when && savedAt) {
            const d = new Date(savedAt);
            when.textContent = d.toLocaleString('es-EC', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
        }
        banner.style.display = 'flex';
    }

    /** Tira el borrador y deja el asistente limpio, sin salir de la pantalla. */
    async discardDraft() {
        if (!(await notify.confirm('¿Descartar la cotización en curso y empezar de cero? No se puede deshacer.', { danger: true, confirmText: 'Descartar' }))) return;

        this.clearDraft();
        this.cart = [];
        this.editingId = null;
        this.editingDate = null;
        this.quoteNumber = null;
        this.quoteYear = null;
        this.baseCode = null;
        this.versionType = null;
        this.versionNumber = null;
        this.revisionLabel = null;
        this.parentId = null;
        this.isQuickQuote = false;
        this.leavesManuallyEdited = false;
        this.activeModule = null;

        if (window.settingsManager && window.calculator) {
            window.calculator.settings = window.settingsManager.settings;
        }

        document.getElementById('client-form').reset();
        if (window.clientManager) window.clientManager.currentClient = null;
        const notesEl = document.getElementById('q-notes');
        if (notesEl) notesEl.value = '';
        const pctEl = document.getElementById('summary-descuento-pct');
        if (pctEl) pctEl.value = 0;

        const btnSave = document.getElementById('btn-save');
        if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cotización';
        const btnSaveAs = document.getElementById('btn-save-as');
        if (btnSaveAs) btnSaveAs.style.display = 'none';

        this.renderCart();
        this.resetItemForm();   // deja el formulario del ítem entero en blanco

        this.goToStep(1);
    }

    /**
     * Cotización rápida: en el stepper solo se ven "Cotizar" (Productos) y "Total"
     * (Resumen); Cliente y Detalles quedan ocultos porque el cliente se asigna solo
     * (Consumidor Final) y no hay notas que llenar. Nueva Cotización (modo normal)
     * sigue mostrando los 4 pasos tal cual, sin tocar nada de este método.
     */
    applyStepperMode() {
        document.querySelectorAll('.stepper .step').forEach((el, index) => {
            const stepNum = index + 1;
            if (stepNum <= 2) {
                el.style.display = this.isQuickQuote ? 'none' : '';
                return;
            }
            const label = this.isQuickQuote ? el.getAttribute('data-label-quick') : el.getAttribute('data-label-normal');
            if (label) el.textContent = label;
        });

        // Sin Cliente ni Detalles no hay a dónde volver desde Productos.
        const prevBtn3 = document.getElementById('btn-prev-step-3');
        if (prevBtn3) prevBtn3.style.display = this.isQuickQuote ? 'none' : '';
    }

    /**
     * ¿Se puede saltar al paso `destino` desde el actual? Aplica las mismas
     * condiciones que los botones "Siguiente", para que el stepper no sea un
     * atajo que las esquive.
     *
     * Volver atrás nunca se bloquea: revisar lo ya cargado no rompe nada, y
     * exigir requisitos para retroceder dejaría al usuario encerrado.
     *
     * @returns {boolean} false si falta algo (ya avisa por pantalla).
     */
    canGoToStep(destino) {
        if (destino <= this.currentStep) return true;

        // Para pasar del Paso 1 hace falta un cliente válido. En Cotización
        // Rápida no se pide: ese modo oculta el paso de Cliente y asigna
        // "Consumidor Final" solo, así que exigirlo acá lo trabaría.
        if (destino >= 2 && !this.isQuickQuote
            && window.clientManager && !window.clientManager.validateClientForm()) {
            return false;
        }

        // Al Resumen solo se llega con algo cotizado.
        if (destino >= 4 && this.cart.length === 0) {
            notify.warning('Debe agregar al menos un producto a la cotización.');
            return false;
        }

        return true;
    }

    goToStep(step) {
        this.currentStep = step;

        this.applyStepperMode();

        // Update stepper UI
        document.querySelectorAll('.stepper .step').forEach((el, index) => {
            if (index + 1 === step) {
                el.classList.add('active');
            } else {
                el.classList.remove('active');
            }
        });

        // Hide all step contents, show current
        document.querySelectorAll('.step-content').forEach((el) => {
            el.style.display = 'none';
        });
        const activeContent = document.getElementById(`step-${step}-content`);
        if (activeContent) {
            activeContent.style.display = 'block';
        }

        if (step === 3) {
            // Cotización rápida: sin pestaña de Mano de Obra y Extras.
            const laborTabBtn = document.querySelector('.product-form-tab[data-tab="labor"]');
            if (laborTabBtn) laborTabBtn.style.display = this.isQuickQuote ? 'none' : '';
            if (this.isQuickQuote) this.switchProductTab('productos');
        }

        if (step === 4) {
            this.renderSummary();
        }

        this.saveDraft();
    }

    /** Cambia la sub-pestaña activa del Paso 2 (Productos / Mano de Obra y Extras). */
    switchProductTab(target) {
        document.querySelectorAll('.product-form-tab').forEach(t => {
            const active = t.getAttribute('data-tab') === target;
            t.classList.toggle('active', active);
            t.style.borderBottomColor = active ? 'var(--primary)' : 'transparent';
            t.style.color = active ? 'var(--primary)' : 'var(--text-muted)';
        });
        document.querySelectorAll('.product-tab-content').forEach(c => c.style.display = 'none');
        const content = document.getElementById(`product-tab-${target}`);
        if (content) content.style.display = 'grid';
    }

    /**
     * Cotización rápida: reinicia el wizard, asigna "Consumidor Final" solo (sin
     * pedir datos) y entra directo al Paso 3, que en este modo se ve como
     * "Cotizar" — luego "Total" es el único otro paso visible. Se guarda con el
     * flag `quickQuote` y reutiliza exactamente el mismo motor de cálculo y
     * saveQuotation() que la cotización normal.
     */
    startQuickQuote() {
        this.isQuickQuote = true;
        this.cart = [];
        this.editingId = null;
        this.editingDate = null;
        this.baseCode = null;
        this.versionType = null;
        this.versionNumber = null;
        this.revisionLabel = null;
        this.parentId = null;
        document.getElementById('client-form').reset();
        window.clientManager.currentClient = null;
        this.renderCart();
        window.app.navigate('new-quotation');
        this.goToStep(3);
        // Sin pedir cédula ni nombre: se guarda como "Consumidor Final" de una vez.
        // Si falla la nube (sin señal en el local, etc.) se usa uno local para no
        // dejar la venta rápida sin cliente asignado.
        if (window.clientManager) {
            window.clientManager.useGenericClient().catch(err => {
                console.warn('No se pudo obtener/guardar "Consumidor Final" en la nube; se usa uno local:', err);
                window.clientManager.fillClientForm({ id: '9999999999', name: 'Consumidor Final', phone: '000000', address: '000000' });
            });
        }
    }

    /**
     * Handler del botón "Nueva Cotización". Los dos modos deben ser
     * independientes: si se venía de una Cotización Rápida (o de editar una),
     * ese carrito y ese cliente no pertenecen al modo normal, así que se
     * limpia todo antes de entrar — igual que Cotización Rápida limpia todo
     * al entrar ella. Si ya se estaba en modo normal, solo navega y continúa
     * donde se había quedado (no pierde el trabajo en curso).
     */
    goToNewQuotation() {
        if (!this.isQuickQuote) {
            window.app.navigate('new-quotation');
            return;
        }

        this.isQuickQuote = false;
        this.cart = [];
        this.editingId = null;
        this.editingDate = null;
        this.baseCode = null;
        this.versionType = null;
        this.versionNumber = null;
        this.revisionLabel = null;
        this.parentId = null;
        this.activeModule = null;
        document.getElementById('client-form').reset();
        if (window.clientManager) window.clientManager.currentClient = null;
        const notesEl = document.getElementById('q-notes');
        if (notesEl) notesEl.value = '';
        const pctEl = document.getElementById('summary-descuento-pct');
        if (pctEl) pctEl.value = 0;
        const btnSave = document.getElementById('btn-save');
        if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cotización';
        const btnSaveAs = document.getElementById('btn-save-as');
        if (btnSaveAs) btnSaveAs.style.display = 'none';

        this.renderCart();
        window.app.navigate('new-quotation');
        this.goToStep(1);
    }

    async loadQuotationForEdit(q) {
        this.editingId = q.id;
        this.editingDate = q.date; // Keep original date as user requested
        this.quoteNumber = q.quoteNumber || null;
        this.quoteYear = q.quoteYear || null;
        this.isQuickQuote = !!q.quickQuote;
        this.baseCode = q.baseCode || null;
        this.versionType = q.versionType || 'A';
        this.versionNumber = q.versionNumber || 1;
        this.revisionLabel = q.revisionLabel || null;
        // Si esta cotización ya es una versión (tiene parentId), el "original" al que
        // apuntará cualquier nueva versión sigue siendo ese mismo padre, no esta cotización.
        this.parentId = q.parentId || q.id;

        const btnSaveAs = document.getElementById('btn-save-as');
        if (btnSaveAs) btnSaveAs.style.display = this.baseCode ? '' : 'none';

        this.cart = q.cart || [];
        this.totals = q.totals || {};
        
        // Restore settings (usa los márgenes históricos con los que se creó esta cotización,
        // no los actuales de "Ajustes de la Empresa", para preservar su trazabilidad)
        if (q.settings && window.calculator) {
            window.calculator.updateSettings(q.settings);
        }
        
        // Restore Discount (siempre se fija explícitamente, incluso a 0, para no arrastrar
        // el valor que haya quedado en el input de una cotización anterior en esta sesión)
        const pctInput = document.getElementById('summary-descuento-pct');
        if (pctInput) pctInput.value = (q.totals && q.totals.discountPct !== undefined) ? q.totals.discountPct : 0;

        // Restore Client
        if (q.clientId && window.clientManager) {
            const client = await window.clientManager.getClientById(q.clientId);
            if (client) {
                window.clientManager.fillClientForm(client);
            }
        }

        // Change button text in summary
        const btnSave = document.getElementById('btn-save');
        if (btnSave) {
            btnSave.innerHTML = '<i class="fa-solid fa-save"></i> Actualizar Cotización';
        }

        // Navigate to cart step
        this.renderCart();
        window.app.navigate('new-quotation');
        this.goToStep(3);
    }

    bindStep2Events() {
        const nextBtn = document.getElementById('btn-next-step-2');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.goToStep(3));
        }

        const prevBtn = document.getElementById('btn-prev-step-2');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToStep(1));
        }

        // El borrador se actualiza al salir del campo, no en cada tecla.
        ['client-id', 'client-name', 'client-phone', 'client-address', 'q-notes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.saveDraft());
        });

        const btnDiscard = document.getElementById('btn-discard-draft');
        if (btnDiscard) {
            btnDiscard.addEventListener('click', () => this.discardDraft());
        }
    }

    bindStep3Events() {
        const btnAddItem = document.getElementById('btn-add-item');
        if (btnAddItem) {
            btnAddItem.addEventListener('click', () => this.addItemToCart());
        }

        const btnPreview = document.getElementById('btn-preview-window');
        if (btnPreview) {
            btnPreview.addEventListener('click', () => this.previewWindow());
        }

        // Sub-tabs del Paso 3: Productos / Mano de Obra y Extras (solo cambia qué se
        // ve; el cálculo y el guardado usan los mismos campos sin importar la pestaña activa)
        document.querySelectorAll('.product-form-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchProductTab(tab.getAttribute('data-tab'));
                this.queueSaveDraft();
            });
        });

        // El producto a medio escribir también entra al borrador. Se escucha 'input'
        // (no 'change') para no perderlo si recarga sin salir del campo.
        [
            'p-brand', 'p-system', 'p-color', 'p-width', 'p-height', 'p-modules', 'p-leaves',
            'p-glass', 'p-qty', 'p-labor-workers', 'p-labor-hours',
            'p-transport', 'p-viaticos'
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.queueSaveDraft());
        });
        const mullonInput = document.getElementById('p-mullon');
        if (mullonInput) mullonInput.addEventListener('change', () => this.queueSaveDraft());

        // Los accesorios se generan por JS, así que se escucha en el contenedor.
        const accContainer = document.getElementById('accessories-container');
        if (accContainer) {
            accContainer.addEventListener('input', () => this.queueSaveDraft());
        }

        // Auto-calculate glass area based on width and height. Los accesorios NO
        // se recalculan acá: su cantidad es fija (viene del módulo o la escribe el
        // usuario), independiente de las medidas de la ventana.
        const calcGlassArea = () => {
            const w = parseFloat(document.getElementById('p-width').value) || 0;
            const h = parseFloat(document.getElementById('p-height').value) || 0;
            const area = w * h;
            document.getElementById('p-glass-area').value = area > 0 ? area.toFixed(2) : '';
        };
        const widthInput = document.getElementById('p-width');
        const heightInput = document.getElementById('p-height');
        if (widthInput) widthInput.addEventListener('input', calcGlassArea);
        if (heightInput) heightInput.addEventListener('input', calcGlassArea);

        this.bindValidacionMedidas();

        // Hojas se autocompleta con Módulos, salvo que el usuario ya haya editado Hojas
        // a mano para este ítem (caso especial: distinta cantidad de hojas que de módulos).
        const modulesInput = document.getElementById('p-modules');
        const leavesInput = document.getElementById('p-leaves');
        if (modulesInput) {
            ['input', 'change'].forEach(ev => modulesInput.addEventListener(ev, () => {
                if (!this.leavesManuallyEdited && leavesInput) {
                    this.asegurarOpcion(leavesInput, modulesInput.value);
                }
                this.marcarCantidadesFueraDeRango();
            }));
        }
        if (leavesInput) {
            ['input', 'change'].forEach(ev => leavesInput.addEventListener(ev, () => {
                this.leavesManuallyEdited = true;
                this.marcarCantidadesFueraDeRango();
            }));
        }

        const nextBtn = document.getElementById('btn-next-step-3');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.cart.length === 0) {
                    notify.warning('Debe agregar al menos un producto a la cotización.');
                    return;
                }
                this.goToStep(4);
            });
        }

        const prevBtn = document.getElementById('btn-prev-step-3');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToStep(2));
        }

        // Desde el Resumen se vuelve a Productos, igual que en los otros pasos.
        const prevBtn4 = document.getElementById('btn-prev-step-4');
        if (prevBtn4) {
            prevBtn4.addEventListener('click', () => this.goToStep(3));
        }

        const brandSelect = document.getElementById('p-brand');
        if(brandSelect) {
            brandSelect.addEventListener('change', () => {
                this.updateSystemDropdown();
                // Una receta multi-proveedor resuelve sus perfiles por rol contra
                // la marca elegida, así que cambiar de marca no la invalida: se
                // vuelve a aplicar. Solo las recetas atadas a una marca concreta
                // dejan de servir si se elige otra.
                const mod = this.activeModule;
                if (mod && mod.brand === '__all__') {
                    this.applyModule(mod);
                    this.renderModuleInfo();
                } else {
                    this.clearActiveModule();
                }
                this.syncModuleFromSystem();
            });
        }

        const systemSelect = document.getElementById('p-system');
        if (systemSelect) {
            systemSelect.addEventListener('change', () => {
                this.syncModuleFromSystem();
                this.marcarCantidadesFueraDeRango();   // cada sistema tiene su rango normal
            });
        }

        // Las medidas alimentan las fórmulas de la receta: al cambiarlas hay que
        // rehacer los accesorios y las horas que dependen de ellas.
        ['p-width', 'p-height', 'p-leaves', 'p-sash-width', 'p-sash-height'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            ['input', 'change'].forEach(ev => el.addEventListener(ev, () => {
                this.recalcularFormulasDelModulo();
            }));
        });

        // Dentro de un mismo sistema puede haber un módulo por cantidad de módulos
        // (VENTANA FIJA 1 MODULO, 2 MODULOS, ...): al cambiarlo se reevalúa cuál toca.
        const modulesCountInput = document.getElementById('p-modules');
        if (modulesCountInput) {
            modulesCountInput.addEventListener('change', () => this.syncModuleFromSystem());
        }

        const pGlassSelect = document.getElementById('p-glass');
        if (pGlassSelect) {
            pGlassSelect.addEventListener('change', () => this.updateGlassPrice());
        }
    }

    // ============================================================
    // MÓDULOS PREESTABLECIDOS
    // ============================================================

    /** Llena "Sistema / Categoría" con las familias del catálogo (no las del proveedor). */
    populateSystemSelect() {
        const sel = document.getElementById('p-system');
        if (!sel || !window.CATALOG_FAMILIES) return;

        const previous = sel.value;
        sel.innerHTML = '<option value="">Seleccione el sistema...</option>';

        let currentGroup = null;
        let html = '';
        window.CATALOG_FAMILIES.forEach(f => {
            if (f.group !== currentGroup) {
                if (currentGroup !== null) html += '</optgroup>';
                html += `<optgroup label="${f.group}">`;
                currentGroup = f.group;
            }
            html += `<option value="${f.name}">${f.name}</option>`;
        });
        if (currentGroup !== null) html += '</optgroup>';
        sel.innerHTML += html;

        if (previous) sel.value = previous;

        this.populateCantidadSelects();
    }

    /**
     * Llena "Módulos" y "Hojas" con los números del 1 al 10. Antes eran campos
     * libres: se podía escribir cualquier cosa (y hasta decimales), y no había
     * forma de saber si esa cantidad es de las que se fabrican.
     */
    populateCantidadSelects() {
        [['p-modules', 'Sin módulos'], ['p-leaves', 'Se autocompleta con Módulos']].forEach(([id, vacio]) => {
            const sel = document.getElementById(id);
            if (!sel) return;
            const previo = sel.value;
            let html = `<option value="">${vacio}</option>`;
            for (let n = 1; n <= 10; n++) html += `<option value="${n}">${n}</option>`;
            sel.innerHTML = html;
            if (previo) this.asegurarOpcion(sel, previo);
        });
    }

    /**
     * Deja elegido un valor aunque no esté entre las 10 opciones (cotizaciones
     * viejas cargadas a mano con 12 módulos, por ejemplo): antes de seleccionarlo
     * se agrega la opción, si no el desplegable quedaría vacío y se perdería el dato.
     */
    asegurarOpcion(sel, valor) {
        if (!sel) return;
        const v = String(valor === null || valor === undefined ? '' : valor);
        if (v !== '' && !Array.from(sel.options).some(o => o.value === v)) {
            const op = document.createElement('option');
            op.value = v;
            op.textContent = v;
            sel.appendChild(op);
        }
        sel.value = v;
    }

    /** Cuántos módulos hace normalmente esta familia, según el catálogo. */
    rangoModulos(family) {
        const rangos = window.CATALOG_MODULE_RANGE || {};
        return rangos[family] || null;
    }

    /**
     * Pinta de tomate Módulos u Hojas cuando se pide más de lo que el catálogo
     * contempla para ese sistema. No bloquea nada: se puede cotizar igual, pero
     * queda a la vista que es un trabajo fuera de lo habitual.
     */
    marcarCantidadesFueraDeRango() {
        const family = (document.getElementById('p-system') || {}).value || '';
        const rango = this.rangoModulos(family);
        const modulos = parseInt((document.getElementById('p-modules') || {}).value, 10);
        const hojas = parseInt((document.getElementById('p-leaves') || {}).value, 10);

        const pintar = (id, fuera, texto) => {
            const el = document.getElementById(id);
            const aviso = document.getElementById(id + '-aviso');
            if (el) el.classList.toggle('campo-fuera-de-rango', !!fuera);
            if (aviso) {
                aviso.style.display = fuera ? 'block' : 'none';
                aviso.textContent = fuera ? texto : '';
            }
        };

        const modulosFuera = !!(rango && modulos > rango.max);
        pintar('p-modules', modulosFuera, rango
            ? `El catálogo hace esta ventana de ${rango.min} a ${rango.max} módulos. Con ${modulos} es un trabajo especial: revise medidas y mano de obra.`
            : '');

        // Más hojas que módulos no existe: cada hoja va dentro de un módulo.
        const hojasFuera = !!(modulos > 0 && hojas > modulos);
        pintar('p-leaves', hojasFuera, `No puede haber más hojas (${hojas}) que módulos (${modulos}).`);
    }

    /**
     * Módulos guardados de una familia. Si hay varios (uno por cantidad de módulos),
     * se prefiere el que coincide con lo escrito en el campo "Módulos".
     */
    findModuleForSystem(family, modulesCount) {
        const modules = window.SEED_DATA.modules || {};
        const candidates = (window.CATALOG_ITEMS || [])
            .filter(it => it.family === family && modules[it.id])
            .map(it => modules[it.id]);

        if (!candidates.length) return null;
        if (candidates.length === 1) return candidates[0];

        if (modulesCount > 0) {
            const byCount = candidates.find(m => {
                const match = /(\d+)\s*MODULO/i.exec(m.itemName || '');
                return match && parseInt(match[1], 10) === modulesCount;
            });
            if (byCount) return byCount;
        }
        return candidates[0];
    }

    /**
     * Vuelve a calcular lo que en la receta depende de las medidas: los accesorios
     * con fórmula (vinil = perímetro, biselado = perímetro, anclas por módulo...) y
     * las horas de mano de obra con fórmula.
     *
     * Hace falta porque el módulo se aplica al elegir el sistema, con las medidas
     * que hubiera en ese momento — normalmente ninguna. Antes esto solo se
     * recalculaba al tocar "Módulos", así que en los sistemas que no llevan módulos
     * (cielo raso, biselado, cubierta, puertas batientes) las cantidades quedaban
     * en cero y el ítem salía barato sin que nadie se enterara.
     *
     * Los accesorios sin fórmula no se tocan: esos son los que el usuario ajusta
     * a mano y tienen que sobrevivir a un cambio de medidas.
     */
    recalcularFormulasDelModulo() {
        const mod = this.activeModule;
        if (!mod || this.applyingModule) return;

        if (mod.labor && mod.labor.hoursFormula) {
            document.getElementById('p-labor-hours').value = this.resolveModuleLaborHours(mod);
        }

        if (!(mod.accessories || []).some(a => a.qtyFormula)) return;
        const ctx = this.currentModuleCtx();
        mod.accessories.forEach(acc => {
            if (!acc.qtyFormula) return;
            const input = document.querySelector(`.acc-input[data-name="${acc.name}"]`);
            if (input) input.value = window.calculator.resolveAccessoryQty(acc, ctx);
        });
    }

    /**
     * Se dispara al elegir el sistema: si esa ventana/puerta tiene módulo
     * preestablecido se completa todo solo; si no, se avisa que va a mano.
     */
    syncModuleFromSystem() {
        const systemSelect = document.getElementById('p-system');
        const family = systemSelect ? systemSelect.value : '';

        if (!family) {
            this.activeModule = null;
            this.renderModuleInfo();
            this.queueSaveDraft();
            return;
        }

        const modulesCount = parseInt(document.getElementById('p-modules').value, 10) || 0;
        const mod = this.findModuleForSystem(family, modulesCount);

        // Si ya está aplicado ese mismo módulo no se repisan los ajustes manuales,
        // pero sí se recalculan las horas y los accesorios que usan fórmula
        // (si no usan fórmula, esto no toca nada porque siguen devolviendo el
        // mismo número fijo de siempre).
        if (mod && this.activeModule && this.activeModule.itemId === mod.itemId) {
            this.recalcularFormulasDelModulo();
            this.renderModuleInfo();
            return;
        }

        // Al cambiar de sistema, lo que había puesto el módulo anterior deja de
        // corresponder: se limpia antes de aplicar el nuevo (o de pasar a manual).
        if (this.activeModule) this.clearModuleValues();

        this.activeModule = mod;
        if (mod) this.applyModule(mod);

        this.renderModuleInfo();
        this.queueSaveDraft();
    }

    /**
     * Muestra los campos de medida de hoja solo si la receta activa los usa
     * (alguna fila con coefBaseHoja/coefAlturaHoja). En el resto de los
     * sistemas no aportan nada y solo ensucian el formulario.
     */
    toggleSashFields(mod) {
        const usa = !!(mod && (mod.profiles || []).some(p =>
            parseFloat(p.coefBaseHoja) || parseFloat(p.coefAlturaHoja)));
        ['p-sash-width-group', 'p-sash-height-group'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = usa ? '' : 'none';
        });
        if (!usa) {
            ['p-sash-width', 'p-sash-height'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        }
    }

    /** Vacía accesorios y mano de obra que había cargado un módulo. */
    clearModuleValues() {
        document.querySelectorAll('.acc-input').forEach(input => input.value = '0');
        document.getElementById('p-labor-workers').value = '0';
        document.getElementById('p-labor-hours').value = '0';
        document.getElementById('p-transport').value = '0';
        document.getElementById('p-viaticos').value = '0';
    }

    /** Vuelca la receta en el formulario: marca, color disponible, accesorios y mano de obra. */
    applyModule(mod) {
        this.applyingModule = true;

        // Un módulo "Todos los proveedores" no fija la marca: la elige quien cotiza
        // y los perfiles se resuelven por rol genérico contra esa marca.
        const isAllBrands = mod.brand === '__all__';
        const brandSelect = document.getElementById('p-brand');
        if (brandSelect && mod.brand && !isAllBrands) {
            brandSelect.value = mod.brand;
            this.updateSystemDropdown();   // recarga los colores de esa marca
        }

        // Color, vidrio y medidas NO vienen del módulo: los elige quien cotiza,
        // porque cambian de una obra a otra sin cambiar la receta de fabricación.
        this.applyModuleAccessoriesAndLabor(mod);
        this.applyingModule = false;
    }

    /**
     * Vuelca accesorios y mano de obra del módulo en el formulario. Las
     * cantidades que tienen fórmula (ej. Vinil = mismo perímetro que el
     * junquillo que retiene) se calculan con las medidas y módulos actuales
     * del formulario; el resto son fijas, como siempre.
     */
    applyModuleAccessoriesAndLabor(mod) {
        document.querySelectorAll('.acc-input').forEach(input => { input.value = '0'; });

        const ctx = this.currentModuleCtx();
        (mod.accessories || []).forEach(acc => {
            const input = document.querySelector(`.acc-input[data-name="${acc.name}"]`);
            if (input) input.value = window.calculator.resolveAccessoryQty(acc, ctx);
        });

        const labor = mod.labor || {};
        document.getElementById('p-labor-workers').value = labor.workers || 0;
        document.getElementById('p-labor-hours').value = this.resolveModuleLaborHours(mod);
        document.getElementById('p-transport').value = labor.transport || 0;
        document.getElementById('p-viaticos').value = labor.viaticos || 0;
    }

    /**
     * Avisa si la receta tiene perfiles que el proveedor elegido no fabrica.
     * Sin esto la cotización sale sin ese aluminio y más barata, en silencio:
     * es el caso de la Puerta T45 (solo Cedal) o la Europea (solo Fisa)
     * cotizadas con otra marca.
     */
    avisarPerfilesFaltantes(costResult, data) {
        const faltan = (costResult && costResult.perfilesFaltantes) || [];
        if (!faltan.length) return;
        const marca = window.SEED_DATA.brands[data.brand]
            ? window.SEED_DATA.brands[data.brand].name : data.brand;
        notify.warning(
            `${marca} no tiene: ${faltan.join(', ')}. ` +
            `Esos perfiles NO se cobraron. Elija otro proveedor o cárguelos en Catálogo → Roles Genéricos.`,
            { titulo: 'Faltan perfiles en este proveedor', ms: 15000 }
        );
    }

    /**
     * Base y Alto solo aceptan medidas positivas: un 0 o un negativo daría una
     * ventana sin material y un precio que no significa nada.
     *
     * El borde rojo aparece mientras se escribe (respuesta inmediata) pero el
     * aviso sale recién al salir del campo: escribiendo "0.80" se pasa por "0",
     * y avisar en ese momento sería molestar por algo que el usuario está por
     * corregir solo.
     */
    bindValidacionMedidas() {
        // 'medida' admite decimales (1.20 m); 'cantidad' tiene que ser un entero,
        // porque media hoja o 2.5 módulos no existen en fabricación.
        const campos = [
            ['p-width', 'La Base', 'medida'],
            ['p-height', 'El Alto', 'medida'],
            ['p-sash-width', 'La Base de Hoja', 'medida'],
            ['p-sash-height', 'El Alto de Hoja', 'medida'],
            ['p-modules', 'Los Módulos', 'cantidad'],
            ['p-leaves', 'Las Hojas', 'cantidad'],
            ['p-qty', 'La Cantidad de Elementos', 'cantidad']
        ];
        campos.forEach(([id, nombre, tipo]) => {
            const el = document.getElementById(id);
            if (!el || el.dataset.validacionMedida) return;
            el.dataset.validacionMedida = '1';

            const motivo = () => {
                const txt = el.value.trim();
                if (txt === '') return '';             // vacío todavía no es un error
                const v = parseFloat(txt);
                if (Number.isNaN(v) || v <= 0) {
                    return tipo === 'cantidad'
                        ? `${nombre} debe ser un número entero mayor a 0.`
                        : `${nombre} debe ser mayor a 0. Solo se aceptan medidas positivas.`;
                }
                if (tipo === 'cantidad' && !Number.isInteger(v)) {
                    return `${nombre} debe ser un número entero: no se puede cotizar ${v}.`;
                }
                return '';
            };
            const pintar = () => el.classList.toggle('campo-invalido', !!motivo());

            el.addEventListener('input', pintar);
            el.addEventListener('blur', () => {
                pintar();
                const problema = motivo();
                if (problema) {
                    notify.warning(problema, { titulo: 'Valor no válido' });
                    el.focus();
                }
            });
        });
    }

    /** ¿Hay algún campo en rojo? Se usa antes de calcular o agregar al carrito. */
    hayMedidasInvalidas() {
        return ['p-width', 'p-height', 'p-sash-width', 'p-sash-height',
                'p-modules', 'p-leaves', 'p-qty'].some(id => {
            const el = document.getElementById(id);
            return el && el.classList.contains('campo-invalido');
        });
    }

    /** Contexto (medidas, módulos, hojas) actual del formulario, para fórmulas de módulo. */
    currentModuleCtx() {
        const width = this.numOr(document.getElementById('p-width').value, 0);
        const height = this.numOr(document.getElementById('p-height').value, 0);
        const modules = parseInt(document.getElementById('p-modules').value, 10) || 1;
        const leaves = parseInt(document.getElementById('p-leaves').value, 10) || 1;
        // Medidas de la hoja que abre (proyectables). Vacías = del tamaño de la ventana.
        const sashW = this.numOr((document.getElementById('p-sash-width') || {}).value, 0);
        const sashH = this.numOr((document.getElementById('p-sash-height') || {}).value, 0);
        return {
            width, height, perimeter: (width + height) * 2, area: width * height,
            modules, leaves,
            sashWidth: sashW > 0 ? sashW : width,
            sashHeight: sashH > 0 ? sashH : height
        };
    }

    /** Horas de mano de obra del módulo activo, según los módulos actuales del formulario si usa fórmula. */
    resolveModuleLaborHours(mod) {
        const modulesCount = parseInt(document.getElementById('p-modules').value, 10) || 1;
        return window.calculator.resolveLaborHours(mod.labor || {}, modulesCount);
    }

    clearActiveModule() {
        if (this.applyingModule) return;   // el propio applyModule dispara los change
        if (!this.activeModule) { this.renderModuleInfo(); return; }
        this.activeModule = null;
        this.clearModuleValues();
        this.renderModuleInfo();
    }

    // ============================================================
    // VENTANA FIJA 1100 — cotización automática multi-proveedor
    // (ver js/ventanaFija1100.js). No usa el motor de módulos genérico: el
    // perfil correcto se resuelve solo, por marca, según su "rol genérico"
    // (data/seed.js -> genericRoles). Sirve para Cedal, Femec y Fisa sin
    // tener que configurar una receta por marca.
    // ============================================================
    isVentanaFija1100System(system) {
        return system === 'VENTANA FIJA 1100';
    }

    /** Muestra/oculta el checkbox de mullón: solo aplica a este sistema. */
    toggleMullonField(family) {
        const group = document.getElementById('p-mullon-group');
        if (!group) return;
        const show = this.isVentanaFija1100System(family);
        group.style.display = show ? 'flex' : 'none';
        if (!show) {
            const cb = document.getElementById('p-mullon');
            if (cb) cb.checked = false;
        }
    }

    /** Valida el formulario y llama a cotizarVentanaFija1100(). Tira Error con mensaje legible si algo falta. */
    getVentanaFija1100Result(data) {
        if (!data.brand || !data.color || data.width <= 0 || data.height <= 0) {
            throw new Error('Complete marca, color, ancho y alto.');
        }
        if (!data.glassType) {
            throw new Error('Debe seleccionar el tipo de vidrio.');
        }
        if (!Number.isInteger(data.modules) || data.modules < 1) {
            throw new Error('Para la Ventana Fija 1100, "Módulos" debe ser un entero mayor o igual a 1.');
        }
        return window.cotizarVentanaFija1100({
            baseCliente: data.width,
            alturaCliente: data.height,
            numModulos: data.modules,
            brand: data.brand,
            color: data.color,
            glassType: data.glassType,
            incluirMullon: !!data.mullon,
            // Mano de obra editable: sin esto, cambiar los campos del formulario
            // no movía el total porque el cotizador la calculaba por su cuenta.
            labor: data.labor
        });
    }

    /** Arma un array tipo costResult.details a partir del desglose (ya calculado sobre las medidas reales). */
    buildVentanaFija1100Details(vf) {
        const d = vf.desglose;
        const rows = [];
        const line = (code, desc, qty, costo, unit) => {
            if (!(qty > 0)) return;
            rows.push({
                code: code,
                desc: desc,
                unitPrice: costo / qty,
                qty: qty,
                qtyString: qty.toFixed(2) + ' ' + unit,
                total: costo
            });
        };
        line(d.horizontal.codigo, d.horizontal.descripcion, d.horizontal.qty, d.horizontal.costo, 'm');
        line(d.vertical.codigo, d.vertical.descripcion, d.vertical.qty, d.vertical.costo, 'm');
        line(d.junquillo.codigo, d.junquillo.descripcion, d.junquillo.qty, d.junquillo.costo, 'm');
        if (d.mullon) line(d.mullon.codigo, d.mullon.descripcion, d.mullon.qty, d.mullon.costo, 'm');
        line('VID', 'Vidrio ' + (d.vidrio.tipo || ''), d.vidrio.area, d.vidrio.costo, 'm2');
        line('ACC', 'Tornillos y tacos', d.tornillos.qty, d.tornillos.costo, 'und');
        line('ACC', 'Vinil', d.vinil.qty, d.vinil.costo, 'und');
        line('ACC', 'Silicón', d.silicon.qty, d.silicon.costo, 'und');
        // Se detalla la cuenta (trabajadores x horas, + transporte/viáticos) para que
        // se vea reflejado lo que se escribe en el formulario de mano de obra.
        const mo = d.manoObra;
        const extras = (mo.transporte || 0) + (mo.viaticos || 0);
        const moDesc = 'Mano de Obra'
            + (mo.trabajadores !== undefined ? ` (${mo.trabajadores} x ${mo.horas} h)` : '')
            + (extras > 0 ? ' + transporte/viáticos' : '');
        // No se usa line(): con 0 horas pero transporte cargado la cantidad es 0 y
        // la fila se descartaría, escondiendo un costo que igual suma al subtotal.
        if (mo.costo > 0) {
            rows.push({
                code: 'MOB',
                desc: moDesc,
                unitPrice: mo.unidades > 0 ? mo.costo / mo.unidades : mo.costo,
                qty: mo.unidades,
                qtyString: mo.unidades > 0 ? mo.unidades.toFixed(2) + ' und' : 'Global',
                total: mo.costo
            });
        }
        return rows;
    }

    /** Muestra el desglose (costo directo, sin margen) en la misma tabla de previsualización. */
    previewVentanaFija1100(data) {
        let vf;
        try {
            vf = this.getVentanaFija1100Result(data);
        } catch (e) {
            notify.warning(e.message);
            return;
        }

        const details = this.buildVentanaFija1100Details(vf);
        const container = document.getElementById('preview-breakdown-container');
        const body = document.getElementById('preview-breakdown-body');
        const totalEl = document.getElementById('preview-breakdown-total');

        body.innerHTML = '';
        details.forEach(detail => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${window.escapeHtml(detail.code)}</td>
                <td>${window.escapeHtml(detail.desc)}</td>
                <td>$${detail.unitPrice.toFixed(2)}</td>
                <td>${window.escapeHtml(detail.qtyString)}</td>
                <td>$${detail.total.toFixed(2)}</td>
            `;
            body.appendChild(tr);
        });

        const rawTotal = vf.desglose.subtotal;
        totalEl.textContent = `$${rawTotal.toFixed(2)}`;
        container.style.display = 'block';
        container.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    /** Calcula, aplica márgenes (settings vigentes) y agrega la Ventana Fija 1100 al carrito. */
    addVentanaFija1100ToCart(data) {
        if (!Number.isInteger(data.qty) || data.qty < 1) {
            notify.warning('La cantidad de elementos debe ser un número entero mayor o igual a 1.');
            return;
        }

        let vf;
        try {
            vf = this.getVentanaFija1100Result(data);
        } catch (e) {
            notify.warning(e.message);
            return;
        }

        const details = this.buildVentanaFija1100Details(vf);
        const rawTotal = vf.desglose.subtotal;

        // Gastos generales + utilidad se aplican con los mismos settings vigentes que
        // el resto de ítems (no con los porcentajes internos de ventanaFija1100.js).
        const margins = window.calculator.applyMargins(rawTotal, window.calculator.settings);
        const unitPrice = margins.finalPrice;
        const itemTotal = unitPrice * data.qty;

        this.cart.push({
            id: Date.now().toString(),
            brand: data.brand,
            system: data.system,
            color: data.color,
            width: data.width,
            height: data.height,
            quantity: data.qty,
            glassType: data.glassType,
            modules: data.modules,
            leaves: data.leaves,
            mullon: !!data.mullon,
            dimensions: `${data.width}x${data.height}m`,
            moduleId: null,
            moduleName: null,
            vidrioBesado: data.vidrioBesado,
            description: `Ventana Fija 1100 ${window.SEED_DATA.brands[data.brand].name} (${data.color}) - ${data.modules} módulo(s) - Vidrio ${data.glassType}${data.mullon ? ' - Con mullón' : ''}${data.vidrioBesado ? ' - CON VIDRIO BESADO (sin división, pegado con silicón)' : ''}`,
            details: details,
            unitPrice: unitPrice,
            total: itemTotal,
            rawTotal: rawTotal * data.qty,
            gastosValor: margins.gastosValor * data.qty,
            utilidadValor: margins.utilidadValor * data.qty,
            rawData: data
        });

        document.getElementById('preview-breakdown-container').style.display = 'none';
        this.renderCart();
        this.resetItemForm();
    }

    /** Mensaje bajo "Sistema / Categoría": si hay módulo o si toca cargar a mano. */
    renderModuleInfo() {
        const info = document.getElementById('p-module-info');
        if (!info) return;

        const systemSelect = document.getElementById('p-system');
        const family = systemSelect ? systemSelect.value : '';

        this.toggleMullonField(family);
        this.toggleSashFields(this.activeModule);

        if (this.isVentanaFija1100System(family)) {
            info.innerHTML = `<i class="fa-solid fa-circle-check"></i>
                Este sistema se cotiza automáticamente para cualquier marca (perfil según proveedor, vidrio y módulos).
                Solo complete marca, color, medidas, módulos y vidrio.`;
            info.style.color = '#137333';
            return;
        }

        if (!family) {
            info.innerHTML = 'Elija el sistema: si tiene un módulo preestablecido se completa todo automáticamente.';
            info.style.color = 'var(--text-muted)';
            return;
        }

        // El paso siguiente natural es la marca: hasta elegirla no hay precios,
        // así que se pide eso antes que cualquier otra cosa. Antes acá salía el
        // aviso técnico de "no tiene módulo preestablecido", que aparecía apenas
        // se elegía el sistema y asustaba sin que hubiera nada mal.
        const marcaElegida = (document.getElementById('p-brand') || {}).value;
        if (!marcaElegida) {
            info.innerHTML = `<i class="fa-solid fa-arrow-right"></i>
                Ahora elija la <strong>marca</strong> (el proveedor del aluminio) para continuar.`;
            info.style.color = 'var(--primary)';
            return;
        }

        const mod = this.activeModule;

        if (mod) {
            const brandName = mod.brand === '__all__'
                ? 'todos los proveedores'
                : (window.SEED_DATA.brands[mod.brand] ? window.SEED_DATA.brands[mod.brand].name : mod.brand);
            const nAcc = (mod.accessories || []).length;
            const labor = mod.labor || {};
            const hasLabor = (labor.workers && (labor.hours || labor.hoursFormula)) || labor.transport || labor.viaticos;
            info.innerHTML = `<i class="fa-solid fa-circle-check"></i>
                Módulo preestablecido aplicado: <strong>${mod.itemName}</strong> (${brandName}) &middot;
                ${(mod.profiles || []).length} perfil(es), ${nAcc} accesorio(s)${hasLabor ? ', mano de obra incluida' : ', sin mano de obra'}.
                Solo complete color, vidrio y medidas.`;
            info.style.color = '#137333';
            return;
        }

        info.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>
            <strong>${family}</strong> no tiene módulo preestablecido. Debe cargar a mano los accesorios y la
            mano de obra, y se cobrarán solo los perfiles marcados como requeridos en la base de datos.
            Para no repetirlo cada vez, créelo en <strong>Catálogo &rarr; Módulos</strong>.`;
        info.style.color = '#b45309';
    }

    /** Menú "Guardar como": PDF (plantilla corporativa) o Word (editable). */
    bindExportMenu() {
        const btn = document.getElementById('btn-print');
        const menu = document.getElementById('export-dropdown');
        if (!btn || !menu) return;

        const abrir = (mostrar) => {
            menu.style.display = mostrar ? 'block' : 'none';
            btn.setAttribute('aria-expanded', mostrar ? 'true' : 'false');
        };

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            abrir(menu.style.display === 'none');
        });

        // Cerrar al hacer clic afuera o con Escape.
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && e.target !== btn) abrir(false);
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') abrir(false);
        });

        // Resaltado al pasar el mouse, como el resto de los menús.
        menu.querySelectorAll('button').forEach(op => {
            op.addEventListener('mouseover', () => op.style.background = 'var(--bg-main)');
            op.addEventListener('mouseout', () => op.style.background = 'none');
        });

        const pdfBtn = document.getElementById('btn-export-pdf');
        const wordBtn = document.getElementById('btn-export-word');
        if (pdfBtn) pdfBtn.addEventListener('click', () => { abrir(false); this.exportar('pdf'); });
        if (wordBtn) wordBtn.addEventListener('click', () => { abrir(false); this.exportar('word'); });
    }

    /**
     * Genera el archivo en el formato pedido. El botón queda bloqueado mientras
     * dura para no disparar dos descargas del mismo documento.
     */
    async exportar(formato) {
        const esWord = formato === 'word';
        const generador = esWord ? window.wordGenerator : window.pdfGenerator;
        const nombre = esWord ? 'Word' : 'PDF';

        if (!generador) {
            notify.error(`Generador de ${nombre} no disponible.`);
            return;
        }

        const btn = document.getElementById('btn-print');
        window.setButtonLoading(btn, true, 'Generando...');
        const aviso = notify.loading(`Generando el documento ${nombre}...`);

        try {
            await generador.generate(this);
            aviso.done(`Documento ${nombre} generado`);
        } catch (e) {
            console.error(`Error generando ${nombre}`, e);
            aviso.fail(`No se pudo generar el ${nombre}: ${e.message || 'error desconocido'}`);
        } finally {
            window.setButtonLoading(btn, false);
        }
    }

    bindStep4Events() {
        const btnSave = document.getElementById('btn-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => this.saveQuotation());
        }

        // Volver al paso de Productos sin perder lo ya cargado: goToStep no toca
        // el carrito, solo cambia de vista.
        const btnAddMore = document.getElementById('btn-add-more-items');
        if (btnAddMore) {
            btnAddMore.addEventListener('click', () => {
                this.goToStep(3);
                // Cae en la sub-pestaña de Productos, que es donde se agrega.
                this.switchProductTab('productos');
                const step3 = document.getElementById('step-3-content');
                if (step3) step3.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }

        this.bindExportMenu();

        const btnSaveAs = document.getElementById('btn-save-as');
        if (btnSaveAs) {
            btnSaveAs.addEventListener('click', () => this.openSaveAsModal());
        }

        const versionTypeSelect = document.getElementById('save-as-version-type');
        if (versionTypeSelect) {
            versionTypeSelect.addEventListener('change', () => this.updateSaveAsSuggestion());
        }

        const customToggle = document.getElementById('save-as-custom-toggle');
        if (customToggle) {
            customToggle.addEventListener('change', (e) => {
                document.getElementById('save-as-custom-value').style.display = e.target.checked ? 'block' : 'none';
            });
        }

        const btnConfirmSaveAs = document.getElementById('btn-confirm-save-as');
        if (btnConfirmSaveAs) {
            btnConfirmSaveAs.addEventListener('click', () => this.confirmSaveAs());
        }

        const pctInput = document.getElementById('summary-descuento-pct');
        if (pctInput) {
            pctInput.addEventListener('input', () => this.renderSummary());
            pctInput.addEventListener('change', () => this.saveDraft());
        }
    }

    populateDropdowns() {
        const brandSelect = document.getElementById('p-brand');
        const glassSelect = document.getElementById('p-glass');
        
        if (brandSelect && window.SEED_DATA) {
            brandSelect.innerHTML = '<option value="">Seleccione una marca...</option>';
            Object.keys(window.SEED_DATA.brands).forEach(key => {
                const brand = window.SEED_DATA.brands[key];
                brandSelect.innerHTML += `<option value="${key}">${window.escapeHtml(brand.name)}</option>`;
            });
        }

        if (glassSelect && window.SEED_DATA) {
            // El vidrio es obligatorio: la opción vacía es solo un marcador de posición.
            glassSelect.innerHTML = '<option value="">Seleccione el vidrio...</option>';
            window.SEED_DATA.glass.forEach(g => {
                glassSelect.innerHTML += `<option value="${window.escapeHtml(g.type)}">${window.escapeHtml(g.type)}</option>`;
            });
        }

        const accContainer = document.getElementById('accessories-container');
        if (accContainer && window.SEED_DATA) {
            accContainer.innerHTML = '';
            window.SEED_DATA.accessories.forEach((acc) => {
                accContainer.innerHTML += `
                    <div class="form-group">
                        <label>${window.escapeHtml(acc.name)} ($${acc.pricePerUnit.toFixed(2)}/${window.escapeHtml(acc.unit)})</label>
                        <input type="number" class="form-control acc-input" data-name="${window.escapeHtml(acc.name)}" data-price="${acc.pricePerUnit}" value="0" min="0">
                    </div>
                `;
            });
        }
    }

    /**
     * Recarga los colores según la marca elegida. El sistema ya no depende de la
     * marca: son las familias del catálogo (ver populateSystemSelect).
     */
    updateSystemDropdown() {
        const brandKey = document.getElementById('p-brand').value;
        const colorSelect = document.getElementById('p-color');
        const previousColor = colorSelect.value;

        colorSelect.innerHTML = '<option value="">Seleccione color...</option>';
        if (!brandKey) return;

        const brand = window.SEED_DATA.brands[brandKey];
        if (!brand) return;

        brand.colors.forEach(color => {
            colorSelect.innerHTML += `<option value="${window.escapeHtml(color)}">${window.escapeHtml(color)}</option>`;
        });

        // Si la marca nueva también tiene ese color, se conserva la elección.
        if (previousColor && brand.colors.indexOf(previousColor) !== -1) {
            colorSelect.value = previousColor;
        }
    }

    /** parseInt/parseFloat que solo usa el default para vacío/NaN — nunca enmascara un valor negativo real. */
    numOr(rawValue, fallback, isInt = false) {
        if (rawValue === '' || rawValue === null || rawValue === undefined) return fallback;
        const n = isInt ? parseInt(rawValue, 10) : parseFloat(rawValue);
        return Number.isNaN(n) ? fallback : n;
    }

    getFormData() {
        const brand = document.getElementById('p-brand').value;
        const system = document.getElementById('p-system').value;
        const color = document.getElementById('p-color').value;
        const width = this.numOr(document.getElementById('p-width').value, 0);
        const height = this.numOr(document.getElementById('p-height').value, 0);
        const qty = this.numOr(document.getElementById('p-qty').value, 1, true);

        const glassType = document.getElementById('p-glass').value;
        const glassArea = this.numOr(document.getElementById('p-glass-area').value, width * height);

        const modulesRaw = document.getElementById('p-modules').value;
        const leavesRaw = document.getElementById('p-leaves').value;
        const modules = modulesRaw === '' ? null : parseInt(modulesRaw, 10);
        const leaves = leavesRaw === '' ? null : parseInt(leavesRaw, 10);
        const mullonCb = document.getElementById('p-mullon');
        const mullon = mullonCb ? mullonCb.checked : false;
        const besadoCb = document.getElementById('p-vidrio-besado');
        const vidrioBesado = besadoCb ? besadoCb.checked : false;

        const workers = this.numOr(document.getElementById('p-labor-workers').value, 0, true);
        const hours = this.numOr(document.getElementById('p-labor-hours').value, 0);
        const transport = this.numOr(document.getElementById('p-transport').value, 0);
        const viaticos = this.numOr(document.getElementById('p-viaticos').value, 0);

        const accessories = [];
        document.querySelectorAll('.acc-input').forEach(input => {
            const accQty = parseFloat(input.value) || 0;
            if (accQty > 0) {
                accessories.push({
                    name: input.getAttribute('data-name'),
                    price: parseFloat(input.getAttribute('data-price')),
                    qty: accQty
                });
            }
        });

        const mod = this.activeModule;

        // Medidas de la hoja que abre (proyectables); vacías = las de la ventana.
        const sashWidthRaw = this.numOr((document.getElementById('p-sash-width') || {}).value, 0);
        const sashHeightRaw = this.numOr((document.getElementById('p-sash-height') || {}).value, 0);

        return {
            brand, system, color, width, height, qty, glassType, glassArea,
            modules, leaves, mullon, vidrioBesado,
            sashWidth: sashWidthRaw > 0 ? sashWidthRaw : width,
            sashHeight: sashHeightRaw > 0 ? sashHeightRaw : height,
            labor: { workers, hours, transport, viaticos },
            accessories,
            moduleId: mod ? mod.itemId : null,
            moduleName: mod ? mod.itemName : null,
            moduleProfiles: mod ? mod.profiles : null
        };
    }

    previewWindow() {
        // Con una medida en rojo no tiene sentido calcular: el precio saldría mal.
        if (this.hayMedidasInvalidas()) {
            notify.warning('Corrija los campos marcados en rojo antes de continuar.',
                { titulo: 'Valor no válido' });
            return;
        }

        const data = this.getFormData();

        if (this.isVentanaFija1100System(data.system)) {
            this.previewVentanaFija1100(data);
            return;
        }

        if (!data.brand || !data.system || !data.color || data.width <= 0 || data.height <= 0) {
            notify.warning('Por favor complete los datos básicos de la ventana (Sistema, Marca, Color, Base y Alto).');
            return;
        }

        if (!data.glassType) {
            notify.warning('Debe seleccionar el tipo de vidrio.');
            document.getElementById('p-glass').focus();
            return;
        }

        const costResult = window.calculator.calculateWindowCost(data);
        this.avisarPerfilesFaltantes(costResult, data);
        
        const container = document.getElementById('preview-breakdown-container');
        const body = document.getElementById('preview-breakdown-body');
        const totalEl = document.getElementById('preview-breakdown-total');
        
        body.innerHTML = '';
        costResult.details.forEach(detail => {
            const tr = document.createElement('tr');
            const unitPrice = detail.unitPrice !== undefined ? `$${detail.unitPrice.toFixed(2)}` : '-';
            tr.innerHTML = `
                <td>${window.escapeHtml(detail.code)}</td>
                <td>${window.escapeHtml(detail.desc)}</td>
                <td>${unitPrice}</td>
                <td>${window.escapeHtml(detail.qtyString || detail.qty)}</td>
                <td>$${detail.total.toFixed(2)}</td>
            `;
            body.appendChild(tr);
        });

        totalEl.textContent = `$${costResult.total.toFixed(2)}`;
        container.style.display = 'block';
        
        // Scroll to preview
        container.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    addItemToCart() {
        // Con una medida en rojo no tiene sentido calcular: el precio saldría mal.
        if (this.hayMedidasInvalidas()) {
            notify.warning('Corrija los campos marcados en rojo antes de continuar.',
                { titulo: 'Valor no válido' });
            return;
        }

        const data = this.getFormData();

        if (this.isVentanaFija1100System(data.system)) {
            this.addVentanaFija1100ToCart(data);
            return;
        }

        if (!data.brand || !data.system || !data.color || data.width <= 0 || data.height <= 0) {
            notify.warning('Complete todos los campos requeridos de aluminio.');
            return;
        }

        // El vidrio es obligatorio en toda ventana: sin él la cotización sale incompleta.
        if (!data.glassType) {
            notify.warning('Debe seleccionar el tipo de vidrio antes de agregar el producto.');
            this.switchProductTab('productos');
            document.getElementById('p-glass').focus();
            return;
        }

        if (!Number.isInteger(data.qty) || data.qty < 1) {
            notify.warning('La cantidad de elementos debe ser un número entero mayor o igual a 1.');
            return;
        }

        if (!Number.isInteger(data.labor.workers) || data.labor.workers < 0) {
            notify.warning('El número de trabajadores debe ser un entero mayor o igual a 0.');
            return;
        }
        if (data.labor.hours < 0 || data.labor.transport < 0 || data.labor.viaticos < 0) {
            notify.warning('Horas, transporte y viáticos no pueden ser negativos.');
            return;
        }

        if (data.modules !== null && (!Number.isInteger(data.modules) || data.modules < 0)) {
            notify.warning('Módulos debe ser un número entero mayor o igual a 0.');
            return;
        }
        if (data.leaves !== null && (!Number.isInteger(data.leaves) || data.leaves < 0)) {
            notify.warning('Hojas debe ser un número entero mayor o igual a 0.');
            return;
        }

        const costResult = window.calculator.calculateWindowCost(data);
        this.avisarPerfilesFaltantes(costResult, data);

        if (costResult.total === 0) {
            notify.error('No se pudo calcular el precio. Revise los colores y el sistema.');
            return;
        }

        // Gastos generales + utilidad se aplican por ítem (no sobre el subtotal agregado),
        // así cada línea del carrito ya lleva su precio de venta real.
        const margins = window.calculator.applyMargins(costResult.total, window.calculator.settings);
        const unitPrice = margins.finalPrice;
        const itemTotal = unitPrice * data.qty;
        const rawTotal = costResult.total * data.qty;

        this.cart.push({
            id: Date.now().toString(),
            brand: data.brand,
            system: data.system,
            color: data.color,
            width: data.width,
            height: data.height,
            quantity: data.qty,
            glassType: data.glassType,
            modules: data.modules,
            leaves: data.leaves,
            dimensions: `${data.width}x${data.height}m`,
            moduleId: data.moduleId,
            moduleName: data.moduleName,
            vidrioBesado: data.vidrioBesado,
            description: (data.moduleName
                ? `${data.moduleName} - ${window.SEED_DATA.brands[data.brand].name} (${data.color}) - Vidrio ${data.glassType || 'N/A'}`
                : `Ventana ${window.SEED_DATA.brands[data.brand].name} ${data.system} (${data.color}) - Vidrio ${data.glassType || 'N/A'}`)
                + (data.vidrioBesado ? ' - CON VIDRIO BESADO (sin división, pegado con silicón)' : ''),
            details: costResult.details,
            unitPrice: unitPrice,
            total: itemTotal,
            rawTotal: rawTotal,
            gastosValor: margins.gastosValor * data.qty,
            utilidadValor: margins.utilidadValor * data.qty,
            rawData: data
        });

        // Hide preview after adding
        document.getElementById('preview-breakdown-container').style.display = 'none';

        this.renderCart();
        this.resetItemForm();
    }

    /**
     * Deja el formulario del ítem completamente en blanco para cargar el
     * siguiente: medidas, módulos, accesorios, mano de obra y también marca,
     * sistema, color y vidrio. Se suelta el módulo preestablecido activo y se
     * borran las marcas de campo en rojo que hubieran quedado.
     */
    resetItemForm() {
        ['p-brand', 'p-system', 'p-color', 'p-glass', 'p-glass-price', 'p-glass-area',
         'p-width', 'p-height', 'p-modules', 'p-leaves',
         'p-sash-width', 'p-sash-height'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('p-qty').value = '1';
        this.leavesManuallyEdited = false;
        const mullonCb = document.getElementById('p-mullon');
        if (mullonCb) mullonCb.checked = false;
        const besadoCb = document.getElementById('p-vidrio-besado');
        if (besadoCb) besadoCb.checked = false;

        // Reset accessories & labor
        this.clearModuleValues();

        // Sin sistema elegido no hay receta activa: se sueltan también los campos
        // que solo aparecen con ella (medidas de hoja) y el aviso de módulo.
        this.activeModule = null;
        this.toggleSashFields(null);
        this.updateSystemDropdown();   // deja "Color" sin marca elegida
        this.renderModuleInfo();       // también oculta el mullón
        this.switchProductTab('productos');

        // Las medidas en rojo son del ítem anterior: ya no aplican.
        ['p-width', 'p-height', 'p-sash-width', 'p-sash-height',
         'p-modules', 'p-leaves', 'p-qty'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.remove('campo-invalido');
        });
        this.marcarCantidadesFueraDeRango();   // apaga el tomate y su aviso

        // Corre después de renderCart(): así el borrador guarda el formulario ya
        // vacío y no reaparece el producto que se acaba de pasar al carrito.
        this.saveDraft();
    }

    updateGlassPrice() {
        const type = document.getElementById('p-glass').value;
        const priceInput = document.getElementById('p-glass-price');
        
        if (!type) {
            priceInput.value = '';
            return;
        }
        
        const glass = window.SEED_DATA.glass.find(g => g.type === type);
        if (glass) {
            priceInput.value = `$${glass.pricePerM2.toFixed(2)}`;
        }
    }

    /** Texto pequeño "Mód: X / Hojas: Y" para mostrar junto a las medidas; vacío si el ítem no tiene esos datos (compatibilidad con cotizaciones antiguas). */
    moduleLeavesLabel(item) {
        if (item.modules === null || item.modules === undefined) return '';
        const leaves = (item.leaves === null || item.leaves === undefined) ? '-' : item.leaves;
        return `<br><span style="font-size: 0.75rem; color: var(--text-muted);">Mód: ${item.modules} / Hojas: ${leaves}</span>`;
    }

    renderCart() {
        const tbody = document.getElementById('cart-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        let subtotal = 0;
        
        this.cart.forEach((item, index) => {
            subtotal += item.total;
            tbody.innerHTML += `
                <tr>
                    <td>${item.quantity}</td>
                    <td>${window.escapeHtml(item.description)}</td>
                    <td>${window.escapeHtml(item.dimensions)}${this.moduleLeavesLabel(item)}</td>
                    <td>$${item.total.toFixed(2)}</td>
                    <td>
                        <div style="display:flex; gap:0.25rem;">
                            <button class="btn btn-sm btn-outline" style="border-color: var(--primary); color: var(--primary);" onclick="window.quotationManager.editItem(${index})" title="Modificar">
                                <i class="fa-solid fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="window.quotationManager.removeItem(${index})" title="Eliminar">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

        // Todo cambio del carrito (agregar, quitar, modificar) pasa por acá.
        this.saveDraft();
    }

    removeItem(index) {
        this.cart.splice(index, 1);
        this.renderCart();
    }

    editItem(index) {
        const item = this.cart[index];
        const data = item.rawData;

        if (data) {
            // Se repone el módulo que tenía el ítem, no el que correspondería hoy a
            // ese sistema: así se respeta tal cual como fue cotizado.
            this.activeModule = (data.moduleId && (window.SEED_DATA.modules || {})[data.moduleId])
                ? window.SEED_DATA.modules[data.moduleId]
                : null;

            this.applyingModule = true;
            document.getElementById('p-brand').value = data.brand;
            this.updateSystemDropdown();
            document.getElementById('p-system').value = data.system;
            document.getElementById('p-color').value = data.color;
            this.renderModuleInfo();

            document.getElementById('p-width').value = data.width;
            document.getElementById('p-height').value = data.height;
            document.getElementById('p-qty').value = data.qty;
            this.asegurarOpcion(document.getElementById('p-modules'),
                (data.modules === null || data.modules === undefined) ? '' : data.modules);
            this.asegurarOpcion(document.getElementById('p-leaves'),
                (data.leaves === null || data.leaves === undefined) ? '' : data.leaves);
            const mullonCb = document.getElementById('p-mullon');
            if (mullonCb) mullonCb.checked = !!data.mullon;
            const besadoCb = document.getElementById('p-vidrio-besado');
            if (besadoCb) besadoCb.checked = !!data.vidrioBesado;
            // Se marca como editado manualmente para no pisar una relación módulos/hojas
            // ya intencionalmente distinta (ej: 3 módulos, 2 hojas) si vuelve a tocar módulos.
            this.leavesManuallyEdited = true;

            document.getElementById('p-glass').value = data.glassType || '';
            this.updateGlassPrice();
            
            document.getElementById('p-glass-area').value = data.glassArea > 0 ? data.glassArea.toFixed(2) : '';

            // Restore labor
            if (data.labor) {
                document.getElementById('p-labor-workers').value = data.labor.workers || 0;
                document.getElementById('p-labor-hours').value = data.labor.hours || 0;
                document.getElementById('p-transport').value = data.labor.transport || 0;
                document.getElementById('p-viaticos').value = data.labor.viaticos || 0;
            }

            // Restore accessories
            if (data.accessories) {
                document.querySelectorAll('.acc-input').forEach(input => input.value = '0');
                data.accessories.forEach(acc => {
                    const input = document.querySelector(`.acc-input[data-name="${acc.name}"]`);
                    if (input) input.value = acc.qty;
                });
            }

            this.applyingModule = false;
        }

        // Remove from cart
        this.cart.splice(index, 1);
        this.renderCart();
        
        // Scroll up to the form so the user can edit
        const content = document.getElementById('step-3-content');
        if (content) content.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    renderSummary() {
        const summaryClient = document.getElementById('summary-client');
        const summaryTable = document.getElementById('summary-table');
        const summarySubtotal = document.getElementById('summary-subtotal');
        const summaryIva = document.getElementById('summary-iva');
        const summaryTotal = document.getElementById('summary-total');
        const summaryRevisionLabel = document.getElementById('summary-revision-label');
        if (summaryRevisionLabel) {
            summaryRevisionLabel.textContent = this.revisionLabel ? `Código: ${this.revisionLabel}` : 'El código se asigna al guardar';
        }

        if(window.clientManager && window.clientManager.currentClient) {
            const c = window.clientManager.currentClient;
            summaryClient.innerHTML = `
                <strong>Cliente:</strong> ${window.escapeHtml(c.name)} <br>
                <strong>CI/RUC:</strong> ${window.escapeHtml(c.id)} <br>
                <strong>Dirección:</strong> ${window.escapeHtml(c.address || '')}
            `;
        }

        this.totals = window.calculator.calculateTotalQuotation(this.cart, window.calculator.settings);

        const summaryMarginsBox = document.getElementById('summary-margins-admin-only');
        const summaryGastos = document.getElementById('summary-gastos');
        const summaryUtilidad = document.getElementById('summary-utilidad');

        const summarySubtotalFinal = document.getElementById('summary-subtotal-final');
        const summaryDescuentoValor = document.getElementById('summary-descuento-valor');

        summarySubtotal.textContent = `$${this.totals.subtotalRaw.toFixed(2)}`;

        // Cotización rápida: resumen minimalista (Subtotal, IVA, Total), sin
        // desglose de márgenes ni descuento. Gastos Generales y Utilidad son
        // el margen del negocio: solo el admin los ve, aunque haya vendedores
        // con cuenta propia armando cotizaciones.
        const isAdmin = !!(window.authManager && window.authManager.currentUser && window.authManager.currentUser.role === 'admin');
        if (summaryMarginsBox) summaryMarginsBox.style.display = (this.isQuickQuote || !isAdmin) ? 'none' : '';
        const summaryDiscountSection = document.getElementById('summary-discount-section');
        if (summaryDiscountSection) summaryDiscountSection.style.display = this.isQuickQuote ? 'none' : '';

        // Las etiquetas quedan fijas en el HTML: antes se les pegaba el
        // porcentaje ("Gastos Generales (14%)"), y el resumen va sin ese detalle.
        if (summaryGastos) summaryGastos.textContent = `$${this.totals.gastosValor.toFixed(2)}`;
        if (summaryUtilidad) summaryUtilidad.textContent = `$${this.totals.utilidadValor.toFixed(2)}`;

        if (summaryIva) summaryIva.textContent = `$${this.totals.ivaValor.toFixed(2)}`;

        const baseTotal = this.totals.total; // Pre-discount total
        const pctInput = document.getElementById('summary-descuento-pct');
        const pctRaw = parseFloat(pctInput ? pctInput.value : 0);
        const pctErrorEl = document.getElementById('summary-descuento-error');
        const outOfRange = !isNaN(pctRaw) && (pctRaw < 0 || pctRaw > 100);
        if (pctErrorEl) pctErrorEl.style.display = outOfRange ? 'block' : 'none';
        // Fuera de rango (ej. 150%) no se recorta a 100 — eso aplicaría un
        // descuento del 100% sin que el usuario lo haya pedido, dejando el
        // total en $0.00 mientras se ve el aviso de error. Se ignora el
        // descuento hasta que corrija el número: el total muestra el valor
        // real sin descontar nada.
        const pct = (isNaN(pctRaw) || outOfRange) ? 0 : pctRaw;
        const discountValor = baseTotal * (pct / 100);
        const finalTotal = baseTotal - discountValor;
        
        this.totals.discountPct = pct;
        this.totals.discountValor = discountValor;
        this.totals.total = finalTotal;
        this.totals.subtotalFinal = baseTotal;

        if(summarySubtotalFinal) summarySubtotalFinal.textContent = `$${baseTotal.toFixed(2)}`;
        if(summaryDescuentoValor) summaryDescuentoValor.textContent = `-$${discountValor.toFixed(2)}`;
        summaryTotal.textContent = `$${finalTotal.toFixed(2)}`;
        
        // Copy cart rows to summary table
        const tbody = document.getElementById('cart-body');
        if(tbody && summaryTable) {
             summaryTable.innerHTML = tbody.innerHTML;
             // Remove the action column in summary
             summaryTable.querySelectorAll('td:last-child').forEach(td => td.remove());
        }
    }

    async ensureQuotationNumber() {
        const initial = (window.authManager?.currentUser?.username || 'X').charAt(0).toUpperCase();
        if (this.quoteNumber && this.quoteYear) {
            return { number: this.quoteNumber, year: this.quoteYear, initial };
        }
        const year = new Date().getFullYear();
        try {
            if (!window.dbManager?.db) await window.dbManager.init();
            this.quoteNumber = await window.dbManager.nextQuotationNumber(year, initial);
        } catch (error) {
            // Printing must remain available during a temporary Firestore outage
            // or while rules are being updated. The browser keeps a monotonic
            // emergency sequence until Firestore becomes available again.
            console.warn('No se pudo reservar el consecutivo en Firestore; se usará respaldo local.', error);
            // Este respaldo ya corre porque Firestore falló: si además localStorage
            // no está disponible (modo privado), no puede tirar otra excepción y
            // dejar sin número a la cotización.
            const storageKey = `casalum-quotation-counter-${year}-${initial}`;
            let current = 0;
            try { current = Number(localStorage.getItem(storageKey) || 0); } catch (e) { /* sin caché */ }
            this.quoteNumber = current + 1;
            try { localStorage.setItem(storageKey, String(this.quoteNumber)); } catch (e) { /* sin caché */ }
        }
        this.quoteYear = year;
        return { number: this.quoteNumber, year: this.quoteYear, initial };
    }

    buildBaseCode(initial, number, year) {
        return `${initial}${String(number).padStart(3, '0')}-${String(year).slice(-2)}`;
    }

    resetWizardAfterSave() {
        // La cotización ya quedó guardada en la base: el borrador pierde sentido.
        this.clearDraft();
        this.cart = [];
        this.editingId = null;
        this.editingDate = null;
        this.quoteNumber = null;
        this.quoteYear = null;
        this.baseCode = null;
        this.versionType = null;
        this.versionNumber = null;
        this.revisionLabel = null;
        this.parentId = null;
        this.isQuickQuote = false;
        // Editing an old quotation temporarily overrides calculator.settings with its
        // historical snapshot (see loadQuotationForEdit) — restore current company settings.
        if (window.settingsManager) window.calculator.settings = window.settingsManager.settings;
        this.renderCart();
        document.getElementById('client-form').reset();
        window.clientManager.currentClient = null;
        // El descuento es por-cotización: nunca debe arrastrarse a la próxima.
        const pctInput = document.getElementById('summary-descuento-pct');
        if (pctInput) pctInput.value = 0;

        const btnSave = document.getElementById('btn-save');
        if (btnSave) btnSave.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Cotización';
        const btnSaveAs = document.getElementById('btn-save-as');
        if (btnSaveAs) btnSaveAs.style.display = 'none';

        window.app.loadRecentQuotations();
        window.app.updateDashboardStats();
        window.app.navigate('dashboard');
    }

    async saveQuotation() {
        if (!window.clientManager.currentClient || this.cart.length === 0) {
            notify.warning('Datos incompletos para guardar.');
            return;
        }

        // Guardar es asincrónico (reserva el consecutivo y escribe en Firestore):
        // sin este cerrojo, un doble clic dispara dos guardados en paralelo y
        // deja la cotización duplicada.
        if (this._guardando) return;
        this._guardando = true;
        const btnGuardar = document.getElementById('btn-save');
        if (window.setButtonLoading) window.setButtonLoading(btnGuardar, true, 'Guardando...');
        try {
            await this._saveQuotationInterno();
        } finally {
            this._guardando = false;
            if (window.setButtonLoading) window.setButtonLoading(btnGuardar, false);
        }
    }

    async _saveQuotationInterno() {

        const reserved = await this.ensureQuotationNumber();
        const baseCode = this.baseCode || this.buildBaseCode(reserved.initial, reserved.number, reserved.year);
        const versionType = this.versionType || 'A';
        const versionNumber = this.versionNumber || 1;
        const revisionLabel = this.revisionLabel || `${baseCode} ${versionType}.${versionNumber}`;

        const quotation = {
            clientId: window.clientManager.currentClient.id,
            date: this.editingDate || new Date().toISOString(), // Keep old date if editing
            cart: this.cart,
            totals: this.totals,
            settings: window.calculator.settings,
            quoteNumber: reserved.number,
            quoteYear: reserved.year,
            author: window.authManager.currentUser.username,
            authorName: window.authManager.currentUser.name,
            baseCode: baseCode,
            versionType: versionType,
            versionNumber: versionNumber,
            revisionLabel: revisionLabel,
            parentId: this.parentId || null,
            status: 'active',
            quickQuote: !!this.isQuickQuote
        };

        if (this.editingId) {
            quotation.id = this.editingId;
        }

        // Guardar va a la nube: sin señal de progreso parecía que no pasaba nada.
        const btn = document.getElementById('btn-save');
        window.setButtonLoading(btn, true, 'Guardando...');

        try {
            const savedQuotation = await window.dbManager.save('quotations', quotation);
            this.id = savedQuotation.id; // assigned ID

            notify.success(this.editingId ? `Cotización actualizada (${revisionLabel}).` : `Cotización guardada: ${revisionLabel}`);
            this.resetWizardAfterSave();
        } catch (e) {
            console.error('Error saving quotation', e);
            notify.error('Hubo un error al guardar la cotización.');
        } finally {
            window.setButtonLoading(btn, false);
        }
    }

    /** Cuenta las versiones existentes de un tipo (A/B) para un baseCode, para sugerir el próximo número. */
    async suggestNextVersion(versionType) {
        if (!this.baseCode) return 1;
        try {
            const snap = await window.dbManager.db.collection('quotations')
                .where('baseCode', '==', this.baseCode)
                .where('versionType', '==', versionType)
                .get();
            let max = 0;
            snap.forEach(doc => {
                const n = doc.data().versionNumber || 0;
                if (n > max) max = n;
            });
            return max + 1;
        } catch (e) {
            console.error('Error sugiriendo número de versión:', e);
            return 1;
        }
    }

    openSaveAsModal() {
        if (!this.baseCode) {
            notify.warning('Guardá la cotización primero para poder crear una nueva versión.');
            return;
        }
        document.getElementById('save-as-base-code').textContent = this.baseCode;
        document.getElementById('save-as-custom-toggle').checked = false;
        document.getElementById('save-as-custom-value').style.display = 'none';
        document.getElementById('save-as-custom-value').value = '';
        document.getElementById('save-as-msg').style.display = 'none';
        document.getElementById('modal-save-as').style.display = 'flex';
        this.updateSaveAsSuggestion();
    }

    closeSaveAsModal() {
        document.getElementById('modal-save-as').style.display = 'none';
    }

    async updateSaveAsSuggestion() {
        const type = document.getElementById('save-as-version-type').value;
        const next = await this.suggestNextVersion(type);
        this._suggestedVersionNumber = next;
        document.getElementById('save-as-suggested').value = `${this.baseCode} ${type}.${next}`;
    }

    async confirmSaveAs() {
        const type = document.getElementById('save-as-version-type').value;
        const customToggle = document.getElementById('save-as-custom-toggle').checked;
        const msgEl = document.getElementById('save-as-msg');
        let versionNumber = this._suggestedVersionNumber || 1;
        let customLabel = null;

        if (customToggle) {
            const customValue = document.getElementById('save-as-custom-value').value.trim();
            if (!customValue) {
                msgEl.textContent = 'Ingresá el código de versión manual (ej: A.5).';
                msgEl.style.color = 'var(--danger)';
                msgEl.style.display = 'block';
                return;
            }
            customLabel = `${this.baseCode} ${customValue}`;

            const alreadyExists = await this.revisionLabelExists(customLabel);
            if (alreadyExists) {
                msgEl.textContent = `Ya existe una versión con el código "${customLabel}". Elegí otro.`;
                msgEl.style.color = 'var(--danger)';
                msgEl.style.display = 'block';
                return;
            }
        }

        await this.saveQuotationAs(type, versionNumber, customLabel);
    }

    /** Verifica si ya existe una cotización guardada con ese revisionLabel exacto. */
    async revisionLabelExists(label) {
        try {
            const snap = await window.dbManager.db.collection('quotations')
                .where('revisionLabel', '==', label)
                .limit(1)
                .get();
            return !snap.empty;
        } catch (e) {
            console.error('Error verificando unicidad de versión:', e);
            return false; // no bloquear el guardado por un error de red/permisos
        }
    }

    /** Crea un documento NUEVO ligado al mismo baseCode, sin modificar la cotización original. */
    async saveQuotationAs(versionType, versionNumber, customLabel) {
        if (!window.clientManager.currentClient || this.cart.length === 0) {
            notify.warning('Datos incompletos para guardar.');
            return;
        }
        if (!this.baseCode) {
            notify.warning('Esta cotización no tiene un código base todavía. Guardala primero.');
            return;
        }

        const revisionLabel = customLabel || `${this.baseCode} ${versionType}.${versionNumber}`;
        // Si la cotización actual ya es una versión (tiene parentId), toda nueva versión
        // debe seguir apuntando al mismo original, no encadenarse a esta versión intermedia.
        const parentId = this.parentId || this.editingId;

        const quotation = {
            clientId: window.clientManager.currentClient.id,
            date: new Date().toISOString(),
            cart: this.cart,
            totals: this.totals,
            settings: window.calculator.settings,
            quoteNumber: this.quoteNumber,
            quoteYear: this.quoteYear,
            author: window.authManager.currentUser.username,
            authorName: window.authManager.currentUser.name,
            baseCode: this.baseCode,
            versionType: versionType,
            versionNumber: versionNumber,
            revisionLabel: revisionLabel,
            parentId: parentId,
            status: 'active',
            quickQuote: !!this.isQuickQuote
            // Sin "id": Firestore genera uno nuevo -> documento nuevo, el original queda intacto.
        };

        try {
            await window.dbManager.save('quotations', quotation);
            this.closeSaveAsModal();
            notify.success(`Nueva versión guardada: ${revisionLabel}`);
            this.resetWizardAfterSave();
        } catch (e) {
            console.error('Error saving quotation version', e);
            const msgEl = document.getElementById('save-as-msg');
            if (msgEl) {
                msgEl.textContent = 'Hubo un error al guardar la nueva versión.';
                msgEl.style.color = 'var(--danger)';
                msgEl.style.display = 'block';
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.quotationManager = new QuotationManager();
    }, 600);
});
