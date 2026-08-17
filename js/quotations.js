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
                this.goToStep(index + 1);
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
        setVal('p-modules', form.modules);
        setVal('p-leaves', form.leaves);
        setVal('p-qty', form.qty);
        const mullonCb = document.getElementById('p-mullon');
        if (mullonCb) mullonCb.checked = !!form.mullon;

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
    discardDraft() {
        if (!confirm('¿Descartar la cotización en curso y empezar de cero? No se puede deshacer.')) return;

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
        this.resetItemForm();

        // resetItemForm conserva marca/sistema/color/vidrio a propósito (para cargar
        // varias ventanas parecidas); al descartar sí queremos todo en blanco.
        ['p-brand', 'p-system', 'p-color', 'p-glass', 'p-glass-price', 'p-glass-area'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        this.updateSystemDropdown();
        this.renderModuleInfo();
        this.switchProductTab('productos');

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

        // Hojas se autocompleta con Módulos, salvo que el usuario ya haya editado Hojas
        // a mano para este ítem (caso especial: distinta cantidad de hojas que de módulos).
        const modulesInput = document.getElementById('p-modules');
        const leavesInput = document.getElementById('p-leaves');
        if (modulesInput) {
            modulesInput.addEventListener('input', () => {
                if (!this.leavesManuallyEdited) {
                    leavesInput.value = modulesInput.value;
                }
            });
        }
        if (leavesInput) {
            leavesInput.addEventListener('input', () => {
                this.leavesManuallyEdited = true;
            });
        }

        const nextBtn = document.getElementById('btn-next-step-3');
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (this.cart.length === 0) {
                    alert('Debe agregar al menos un producto a la cotización.');
                    return;
                }
                this.goToStep(4);
            });
        }

        const prevBtn = document.getElementById('btn-prev-step-3');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.goToStep(2));
        }

        const brandSelect = document.getElementById('p-brand');
        if(brandSelect) {
            brandSelect.addEventListener('change', () => {
                this.updateSystemDropdown();
                // El módulo trae perfiles de una marca concreta: si se cambia a mano,
                // esa receta deja de servir y se pasa a configuración manual.
                this.clearActiveModule();
            });
        }

        const systemSelect = document.getElementById('p-system');
        if (systemSelect) {
            systemSelect.addEventListener('change', () => this.syncModuleFromSystem());
        }

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

        // Si ya está aplicado ese mismo módulo no se repisan los ajustes manuales.
        if (mod && this.activeModule && this.activeModule.itemId === mod.itemId) {
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

        const brandSelect = document.getElementById('p-brand');
        if (brandSelect && mod.brand) {
            brandSelect.value = mod.brand;
            this.updateSystemDropdown();   // recarga los colores de esa marca
        }

        // Color, vidrio y medidas NO vienen del módulo: los elige quien cotiza,
        // porque cambian de una obra a otra sin cambiar la receta de fabricación.
        this.applyModuleAccessoriesAndLabor(mod);
        this.applyingModule = false;
    }

    /** Vuelca accesorios y mano de obra del módulo en el formulario. Cantidades fijas, sin escalar por área. */
    applyModuleAccessoriesAndLabor(mod) {
        document.querySelectorAll('.acc-input').forEach(input => { input.value = '0'; });

        (mod.accessories || []).forEach(acc => {
            const input = document.querySelector(`.acc-input[data-name="${acc.name}"]`);
            if (input) input.value = acc.qty;
        });

        const labor = mod.labor || {};
        document.getElementById('p-labor-workers').value = labor.workers || 0;
        document.getElementById('p-labor-hours').value = labor.hours || 0;
        document.getElementById('p-transport').value = labor.transport || 0;
        document.getElementById('p-viaticos').value = labor.viaticos || 0;
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
            incluirMullon: !!data.mullon
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
        line('MOB', 'Mano de Obra', d.manoObra.unidades, d.manoObra.costo, 'und');
        return rows;
    }

    /** Muestra el desglose (costo directo, sin margen) en la misma tabla de previsualización. */
    previewVentanaFija1100(data) {
        let vf;
        try {
            vf = this.getVentanaFija1100Result(data);
        } catch (e) {
            alert(e.message);
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
            alert('La cantidad de elementos debe ser un número entero mayor o igual a 1.');
            return;
        }

        let vf;
        try {
            vf = this.getVentanaFija1100Result(data);
        } catch (e) {
            alert(e.message);
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
            description: `Ventana Fija 1100 ${window.SEED_DATA.brands[data.brand].name} (${data.color}) - ${data.modules} módulo(s) - Vidrio ${data.glassType}${data.mullon ? ' - Con mullón' : ''}`,
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

        if (this.isVentanaFija1100System(family)) {
            info.innerHTML = `<i class="fa-solid fa-circle-check"></i>
                Este sistema se cotiza automáticamente para cualquier marca (perfil según proveedor, vidrio y módulos).
                Solo complete marca, color, medidas, módulos y vidrio.`;
            info.style.color = '#137333';
            return;
        }

        const mod = this.activeModule;

        if (mod) {
            const brandName = window.SEED_DATA.brands[mod.brand] ? window.SEED_DATA.brands[mod.brand].name : mod.brand;
            const nAcc = (mod.accessories || []).length;
            const labor = mod.labor || {};
            const hasLabor = (labor.workers && labor.hours) || labor.transport || labor.viaticos;
            info.innerHTML = `<i class="fa-solid fa-circle-check"></i>
                Módulo preestablecido aplicado: <strong>${mod.itemName}</strong> (${brandName}) &middot;
                ${(mod.profiles || []).length} perfil(es), ${nAcc} accesorio(s)${hasLabor ? ', mano de obra incluida' : ', sin mano de obra'}.
                Solo complete color, vidrio y medidas.`;
            info.style.color = '#137333';
            return;
        }

        if (!family) {
            info.innerHTML = 'Elija el sistema: si tiene un módulo preestablecido se completa todo automáticamente.';
            info.style.color = 'var(--text-muted)';
            return;
        }

        info.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>
            <strong>${family}</strong> no tiene módulo preestablecido. Debe cargar a mano los accesorios y la
            mano de obra, y se cobrarán solo los perfiles marcados como requeridos en la base de datos.
            Para no repetirlo cada vez, créelo en <strong>Catálogo &rarr; Módulos</strong>.`;
        info.style.color = '#b45309';
    }

    bindStep4Events() {
        const btnSave = document.getElementById('btn-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => this.saveQuotation());
        }

        const btnPrint = document.getElementById('btn-print');
        if (btnPrint) {
            btnPrint.addEventListener('click', () => {
                if (window.pdfGenerator) {
                    window.pdfGenerator.generate(this);
                } else {
                    alert('Generador de PDF no disponible.');
                }
            });
        }

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

        return {
            brand, system, color, width, height, qty, glassType, glassArea,
            modules, leaves, mullon,
            labor: { workers, hours, transport, viaticos },
            accessories,
            moduleId: mod ? mod.itemId : null,
            moduleName: mod ? mod.itemName : null,
            moduleProfiles: mod ? mod.profiles : null
        };
    }

    previewWindow() {
        const data = this.getFormData();

        if (this.isVentanaFija1100System(data.system)) {
            this.previewVentanaFija1100(data);
            return;
        }

        if (!data.brand || !data.system || !data.color || data.width <= 0 || data.height <= 0) {
            alert('Por favor complete los datos básicos de la ventana (Sistema, Marca, Color, Ancho y Alto).');
            return;
        }

        if (!data.glassType) {
            alert('Debe seleccionar el tipo de vidrio.');
            document.getElementById('p-glass').focus();
            return;
        }

        const costResult = window.calculator.calculateWindowCost(data);
        
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
        const data = this.getFormData();

        if (this.isVentanaFija1100System(data.system)) {
            this.addVentanaFija1100ToCart(data);
            return;
        }

        if (!data.brand || !data.system || !data.color || data.width <= 0 || data.height <= 0) {
            alert('Complete todos los campos requeridos de aluminio.');
            return;
        }

        // El vidrio es obligatorio en toda ventana: sin él la cotización sale incompleta.
        if (!data.glassType) {
            alert('Debe seleccionar el tipo de vidrio antes de agregar el producto.');
            this.switchProductTab('productos');
            document.getElementById('p-glass').focus();
            return;
        }

        if (!Number.isInteger(data.qty) || data.qty < 1) {
            alert('La cantidad de elementos debe ser un número entero mayor o igual a 1.');
            return;
        }

        if (!Number.isInteger(data.labor.workers) || data.labor.workers < 0) {
            alert('El número de trabajadores debe ser un entero mayor o igual a 0.');
            return;
        }
        if (data.labor.hours < 0 || data.labor.transport < 0 || data.labor.viaticos < 0) {
            alert('Horas, transporte y viáticos no pueden ser negativos.');
            return;
        }

        if (data.modules !== null && (!Number.isInteger(data.modules) || data.modules < 0)) {
            alert('Módulos debe ser un número entero mayor o igual a 0.');
            return;
        }
        if (data.leaves !== null && (!Number.isInteger(data.leaves) || data.leaves < 0)) {
            alert('Hojas debe ser un número entero mayor o igual a 0.');
            return;
        }

        const costResult = window.calculator.calculateWindowCost(data);

        if (costResult.total === 0) {
            alert('No se pudo calcular el precio. Revise los colores y el sistema.');
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
            description: data.moduleName
                ? `${data.moduleName} - ${window.SEED_DATA.brands[data.brand].name} (${data.color}) - Vidrio ${data.glassType || 'N/A'}`
                : `Ventana ${window.SEED_DATA.brands[data.brand].name} ${data.system} (${data.color}) - Vidrio ${data.glassType || 'N/A'}`,
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

    resetItemForm() {
        document.getElementById('p-width').value = '';
        document.getElementById('p-height').value = '';
        document.getElementById('p-glass-area').value = '';
        document.getElementById('p-qty').value = '1';
        document.getElementById('p-modules').value = '';
        document.getElementById('p-leaves').value = '';
        this.leavesManuallyEdited = false;
        const mullonCb = document.getElementById('p-mullon');
        if (mullonCb) mullonCb.checked = false;

        // Reset accessories & labor
        document.querySelectorAll('.acc-input').forEach(input => input.value = '0');
        document.getElementById('p-labor-workers').value = '0';
        document.getElementById('p-labor-hours').value = '0';
        document.getElementById('p-transport').value = '0';
        document.getElementById('p-viaticos').value = '0';

        // Si hay un módulo preestablecido activo se recarga, para poder agregar varias
        // unidades del mismo ítem sin volver a llenar accesorios ni mano de obra.
        if (this.activeModule) {
            this.applyModuleAccessoriesAndLabor(this.activeModule);
        }

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
            document.getElementById('p-modules').value = (data.modules === null || data.modules === undefined) ? '' : data.modules;
            document.getElementById('p-leaves').value = (data.leaves === null || data.leaves === undefined) ? '' : data.leaves;
            const mullonCb = document.getElementById('p-mullon');
            if (mullonCb) mullonCb.checked = !!data.mullon;
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
        const summaryGastosLabel = document.getElementById('summary-gastos-label');
        const summaryGastos = document.getElementById('summary-gastos');
        const summaryUtilidadLabel = document.getElementById('summary-utilidad-label');
        const summaryUtilidad = document.getElementById('summary-utilidad');

        const summarySubtotalFinal = document.getElementById('summary-subtotal-final');
        const summaryDescuentoValor = document.getElementById('summary-descuento-valor');

        summarySubtotal.textContent = `$${this.totals.subtotalRaw.toFixed(2)}`;

        const isAdmin = !!(window.authManager && window.authManager.currentUser && window.authManager.currentUser.role === 'admin');
        // Cotización rápida: resumen minimalista (Subtotal, IVA, Total), sin desglose de
        // márgenes ni descuento, ni para admin.
        if (summaryMarginsBox) summaryMarginsBox.style.display = (isAdmin && !this.isQuickQuote) ? '' : 'none';
        const summaryDiscountSection = document.getElementById('summary-discount-section');
        if (summaryDiscountSection) summaryDiscountSection.style.display = this.isQuickQuote ? 'none' : '';

        if (summaryGastosLabel) summaryGastosLabel.textContent = `Gastos Generales (${(this.totals.gastosPct * 100).toFixed(0)}%):`;
        if (summaryGastos) summaryGastos.textContent = `$${this.totals.gastosValor.toFixed(2)}`;

        if (summaryUtilidadLabel) summaryUtilidadLabel.textContent = `Utilidad (${(this.totals.utilidadPct * 100).toFixed(0)}%):`;
        if (summaryUtilidad) summaryUtilidad.textContent = `$${this.totals.utilidadValor.toFixed(2)}`;

        if (summaryIva) summaryIva.textContent = `$${this.totals.ivaValor.toFixed(2)}`;

        const baseTotal = this.totals.total; // Pre-discount total
        const pctInput = document.getElementById('summary-descuento-pct');
        const pctRaw = parseFloat(pctInput ? pctInput.value : 0);
        const pctErrorEl = document.getElementById('summary-descuento-error');
        const outOfRange = !isNaN(pctRaw) && (pctRaw < 0 || pctRaw > 100);
        if (pctErrorEl) pctErrorEl.style.display = outOfRange ? 'block' : 'none';
        const pct = isNaN(pctRaw) ? 0 : Math.min(100, Math.max(0, pctRaw));
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
            const storageKey = `casalum-quotation-counter-${year}-${initial}`;
            const current = Number(localStorage.getItem(storageKey) || 0);
            this.quoteNumber = current + 1;
            localStorage.setItem(storageKey, String(this.quoteNumber));
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
            alert('Datos incompletos para guardar.');
            return;
        }

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

        try {
            const savedQuotation = await window.dbManager.save('quotations', quotation);
            this.id = savedQuotation.id; // assigned ID

            alert(this.editingId ? `Cotización actualizada (${revisionLabel}).` : `Cotización guardada: ${revisionLabel}`);
            this.resetWizardAfterSave();
        } catch (e) {
            console.error('Error saving quotation', e);
            alert('Hubo un error al guardar la cotización.');
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
            alert('Guardá la cotización primero para poder crear una nueva versión.');
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
            alert('Datos incompletos para guardar.');
            return;
        }
        if (!this.baseCode) {
            alert('Esta cotización no tiene un código base todavía. Guardala primero.');
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
            alert(`Nueva versión guardada: ${revisionLabel}`);
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
