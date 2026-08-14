/**
 * Module Manager — Módulos preestablecidos del catálogo.
 *
 * Un "módulo" es la receta de fabricación de un ítem del catálogo
 * (ej: VENTANA FIJA 1100): qué perfiles del proveedor se usan y con qué
 * fórmula/cantidad fija, qué accesorios y cuánta mano de obra.
 *
 * Se guarda en window.SEED_DATA.modules[itemId] y lo persiste catalog.js
 * junto al resto del catálogo (Firestore + localStorage).
 *
 * Al cotizar, quotations.js aplica el módulo y llena todo automáticamente,
 * sin que el usuario tenga que ingresar nada a mano.
 */

/** Bases de fórmula disponibles. `unit` es la opción "por unidad". */
window.MODULE_FORMULA_BASES = [
    { key: 'width',          label: 'Ancho',            unit: 'm'  },
    { key: 'height',         label: 'Alto',             unit: 'm'  },
    { key: 'perimeter',      label: 'Perímetro',        unit: 'm'  },
    { key: 'area',           label: 'Área (An x Al)',   unit: 'm²' },
    { key: 'width_modules',  label: 'Ancho x Módulos',  unit: 'm'  },
    { key: 'height_modules', label: 'Alto x Módulos',   unit: 'm'  },
    { key: 'unit',           label: 'Unidad',           unit: 'und' }
];

class ModuleManager {
    constructor() {
        this.isAdmin = false;
        this.currentGroup = '';
        this.currentItemId = '';
        this.draft = null;      // módulo en edición
        this.dirty = false;
        this.profileFilter = '';
        this.onlySelected = false;
    }

    init() {
        this.isAdmin = !!(window.authManager && window.authManager.currentUser && window.authManager.currentUser.role === 'admin');
        if (!window.SEED_DATA.modules) window.SEED_DATA.modules = {};
        // Familias renombradas: reapunta los módulos guardados a sus ids nuevos.
        if (window.migrateModuleIds) window.migrateModuleIds(window.SEED_DATA.modules);
        this.bindEvents();
        this.populateGroupSelect();
        this.applyAdminVisibility();
    }

    applyAdminVisibility() {
        const actions = document.getElementById('module-admin-actions');
        if (actions) actions.style.display = this.isAdmin ? 'flex' : 'none';
        const hint = document.getElementById('module-readonly-hint');
        if (hint) hint.style.display = this.isAdmin ? 'none' : 'block';
    }

    // ============================================================
    // NAVEGACIÓN DE VISTAS (Módulos <-> Base de datos)
    // ============================================================
    showView(view) {
        const modulesView = document.getElementById('catalog-modules-view');
        const dbView = document.getElementById('catalog-db-view');
        const btnModules = document.getElementById('btn-catalog-view-modules');
        const btnDb = document.getElementById('btn-catalog-view-db');
        if (!modulesView || !dbView) return;

        const isDb = view === 'db';
        modulesView.style.display = isDb ? 'none' : 'block';
        dbView.style.display = isDb ? 'block' : 'none';

        [[btnModules, !isDb], [btnDb, isDb]].forEach(([btn, active]) => {
            if (!btn) return;
            btn.classList.toggle('btn-primary', active);
            btn.classList.toggle('btn-outline', !active);
        });

        if (isDb && window.catalogManager) window.catalogManager.renderCurrentTab();
    }

    bindEvents() {
        const btnModules = document.getElementById('btn-catalog-view-modules');
        const btnDb = document.getElementById('btn-catalog-view-db');
        if (btnModules) btnModules.addEventListener('click', () => this.showView('modules'));
        if (btnDb) btnDb.addEventListener('click', () => this.showView('db'));

        const groupSel = document.getElementById('module-group-select');
        if (groupSel) groupSel.addEventListener('change', () => {
            this.currentGroup = groupSel.value;
            this.populateItemSelect();
        });

        const itemSel = document.getElementById('module-item-select');
        if (itemSel) itemSel.addEventListener('change', () => this.selectItem(itemSel.value));

        ['module-brand-select', 'module-category-select'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => this.handleHeaderChange(id));
        });

        const filter = document.getElementById('module-profile-filter');
        if (filter) filter.addEventListener('input', () => {
            this.profileFilter = filter.value.trim().toLowerCase();
            this.renderProfiles();
        });

        const onlySel = document.getElementById('module-only-selected');
        if (onlySel) onlySel.addEventListener('change', () => {
            this.onlySelected = onlySel.checked;
            this.renderProfiles();
        });

        const saveBtn = document.getElementById('btn-module-save');
        if (saveBtn) saveBtn.addEventListener('click', () => this.saveModule());

        const deleteBtn = document.getElementById('btn-module-delete');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.deleteModule());

        const copyBtn = document.getElementById('btn-module-copy');
        if (copyBtn) copyBtn.addEventListener('click', () => this.copyFromModule());
    }

    // ============================================================
    // SELECTORES DE CABECERA
    // ============================================================
    populateGroupSelect() {
        const sel = document.getElementById('module-group-select');
        if (!sel || !window.CATALOG_GROUPS) return;
        sel.innerHTML = '';
        window.CATALOG_GROUPS.forEach(g => {
            sel.innerHTML += `<option value="${g}">${g}</option>`;
        });
        this.currentGroup = window.CATALOG_GROUPS[0];
        sel.value = this.currentGroup;
        this.populateItemSelect();
    }

    populateItemSelect() {
        const sel = document.getElementById('module-item-select');
        if (!sel) return;
        const items = (window.CATALOG_ITEMS || []).filter(i => i.group === this.currentGroup);

        sel.innerHTML = '<option value="">Seleccione un ítem del catálogo...</option>';
        let currentFamily = null;
        let html = '';
        items.forEach(it => {
            if (it.family !== currentFamily) {
                if (currentFamily !== null) html += '</optgroup>';
                html += `<optgroup label="${it.family}">`;
                currentFamily = it.family;
            }
            const configured = !!window.SEED_DATA.modules[it.id];
            const note = it.note ? ` — ${it.note}` : '';
            html += `<option value="${it.id}">${configured ? '✔ ' : ''}${it.name}${note}</option>`;
        });
        if (currentFamily !== null) html += '</optgroup>';
        sel.innerHTML += html;

        this.updateProgress();

        // Conserva el ítem abierto al refrescar la lista (navegación, guardado, login).
        const keep = this.currentItemId;
        const keepItem = keep ? window.CATALOG_ITEMS_BY_ID[keep] : null;
        if (keepItem && keepItem.group === this.currentGroup) {
            sel.value = keep;
            if (this.dirty && this.draft) {
                // No pisar cambios sin guardar: solo se repinta lo que ya está en pantalla.
                this.renderHeader();
                this.renderProfiles();
                this.renderAccessories();
                this.renderLabor();
                this.updateStatusBadge();
                this.updateEstimate();
            } else {
                this.selectItem(keep);
            }
        } else {
            this.selectItem('');
        }
    }

    updateProgress() {
        const el = document.getElementById('module-progress');
        if (!el) return;
        const total = (window.CATALOG_ITEMS || []).length;
        const done = Object.keys(window.SEED_DATA.modules || {}).length;
        el.textContent = `${done} de ${total} ítems del catálogo con módulo preestablecido`;
    }

    selectItem(itemId) {
        this.currentItemId = itemId;
        const editor = document.getElementById('module-editor');
        const empty = document.getElementById('module-empty-state');

        if (!itemId) {
            this.draft = null;
            if (editor) editor.style.display = 'none';
            if (empty) empty.style.display = 'block';
            return;
        }

        const item = window.CATALOG_ITEMS_BY_ID[itemId];
        if (!item) return;

        const saved = window.SEED_DATA.modules[itemId];
        this.draft = saved ? JSON.parse(JSON.stringify(saved)) : this.blankDraft(item);
        this.dirty = false;

        if (editor) editor.style.display = 'block';
        if (empty) empty.style.display = 'none';

        const itemSel = document.getElementById('module-item-select');
        if (itemSel && itemSel.value !== itemId) itemSel.value = itemId;

        this.renderHeader();
        this.renderProfiles();
        this.renderAccessories();
        this.renderLabor();
        this.updateStatusBadge();
        this.updateEstimate();
    }

    blankDraft(item) {
        const firstBrand = Object.keys(window.SEED_DATA.brands)[0] || '';
        const brand = window.SEED_DATA.brands[firstBrand];
        return {
            itemId: item.id,
            itemName: item.name,
            group: item.group,
            family: item.family,
            note: item.note || '',
            brand: firstBrand,
            // Vacío = "toda la base de datos del proveedor": los perfiles de un
            // mismo módulo pueden venir de varias categorías.
            category: '',
            profiles: [],
            accessories: [],
            labor: { workers: 0, hours: 0, costPerHour: 5.0, transport: 0, viaticos: 0 },
            updatedAt: null,
            updatedBy: null
        };
    }

    /**
     * Color con el que se muestran los precios de referencia en el editor.
     * El módulo NO fija color: el precio real sale del color que se elige al cotizar.
     */
    referenceColor() {
        const brand = window.SEED_DATA.brands[this.draft ? this.draft.brand : ''];
        return brand && brand.colors.length ? brand.colors[0] : '';
    }

    renderHeader() {
        const d = this.draft;
        if (!d) return;

        const item = window.CATALOG_ITEMS_BY_ID[d.itemId];
        const title = document.getElementById('module-item-title');
        if (title) {
            title.innerHTML = `${item.name}
                <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">
                    &nbsp;·&nbsp; ${item.group} / ${item.family}${item.note ? ' · ' + item.note : ''}
                </span>`;
        }

        // Marca / proveedor
        const brandSel = document.getElementById('module-brand-select');
        if (brandSel) {
            brandSel.innerHTML = '';
            Object.keys(window.SEED_DATA.brands).forEach(k => {
                brandSel.innerHTML += `<option value="${k}">${window.SEED_DATA.brands[k].name}</option>`;
            });
            if (!window.SEED_DATA.brands[d.brand]) d.brand = Object.keys(window.SEED_DATA.brands)[0] || '';
            brandSel.value = d.brand;
        }

        const brand = window.SEED_DATA.brands[d.brand];

        // Categoría principal (los perfiles pueden venir de cualquier categoría de la marca)
        const catSel = document.getElementById('module-category-select');
        if (catSel && brand) {
            catSel.innerHTML = '<option value="__all__">— Toda la base de datos —</option>';
            Object.keys(brand.categories).forEach(c => {
                catSel.innerHTML += `<option value="${c}">${c}</option>`;
            });
            catSel.value = brand.categories[d.category] ? d.category : '__all__';
        }

        // Los selects de la cabecera son de solo lectura para no-admin
        [brandSel, catSel].forEach(el => {
            if (el) el.disabled = !this.isAdmin;
        });
    }

    handleHeaderChange(id) {
        const d = this.draft;
        if (!d) return;
        const el = document.getElementById(id);

        if (id === 'module-brand-select') {
            if (d.profiles.length && !confirm('Cambiar de proveedor borrará los perfiles ya seleccionados en este módulo. ¿Continuar?')) {
                el.value = d.brand;
                return;
            }
            d.brand = el.value;
            d.profiles = [];
            d.category = '';
            this.renderHeader();
        } else if (id === 'module-category-select') {
            d.category = el.value === '__all__' ? '' : el.value;
        }

        this.markDirty();
        this.renderProfiles();
        this.updateEstimate();
    }

    // ============================================================
    // COLUMNA 1: BASE DE DATOS DEL PROVEEDOR
    // ============================================================

    /** Todos los perfiles de la marca; si hay categoría fija, solo esa. */
    visibleProducts() {
        const d = this.draft;
        const brand = window.SEED_DATA.brands[d.brand];
        if (!brand) return [];

        const cats = d.category && brand.categories[d.category]
            ? [d.category]
            : Object.keys(brand.categories);

        const out = [];
        cats.forEach(cat => {
            brand.categories[cat].products.forEach(p => {
                out.push({ category: cat, product: p });
            });
        });
        return out;
    }

    findProfileRow(code, category) {
        return this.draft.profiles.find(p => p.code === code && p.category === category);
    }

    renderProfiles() {
        const container = document.getElementById('module-profiles-table');
        if (!container || !this.draft) return;

        const d = this.draft;
        const editable = this.isAdmin;
        const rows = this.visibleProducts().filter(({ category, product }) => {
            if (this.onlySelected && !this.findProfileRow(product.code, category)) return false;
            if (!this.profileFilter) return true;
            const hay = `${product.code} ${product.description} ${category}`.toLowerCase();
            return hay.indexOf(this.profileFilter) !== -1;
        });

        if (!rows.length) {
            container.innerHTML = '<p class="text-muted" style="padding:1rem;">No hay perfiles que coincidan con el filtro.</p>';
            return;
        }

        const basesOptions = window.MODULE_FORMULA_BASES
            .map(b => `<option value="${b.key}">${b.label}</option>`).join('');

        // El precio mostrado es solo referencial: el color real se elige al cotizar.
        const refColor = this.referenceColor();

        let html = `<table class="table" style="font-size:0.78rem; min-width:640px;">
            <thead><tr style="background: var(--primary); color:#fff;">
                <th style="padding:6px 8px; text-align:center;">Usar</th>
                <th style="padding:6px 8px;">Código</th>
                <th style="padding:6px 8px;">Descripción</th>
                <th style="padding:6px 8px; text-align:center;">Fijo / Fórmula</th>
            </tr></thead><tbody>`;

        let lastCat = null;
        rows.forEach(({ category, product }) => {
            if (category !== lastCat) {
                html += `<tr><td colspan="6" style="padding:4px 8px; background:#eef4ef; font-weight:700; color:var(--primary); font-size:0.75rem;">${category}</td></tr>`;
                lastCat = category;
            }

            const row = this.findProfileRow(product.code, category);
            const used = !!row;
            const formula = row ? row.formula : '';
            const fixedQty = row ? row.fixedQty : 1;

            html += `<tr style="${used ? 'background:#f2fbf3;' : ''}">
                <td style="padding:4px 8px; text-align:center;">
                    <input type="checkbox" class="mod-p-use" data-code="${product.code}" data-cat="${category}" ${used ? 'checked' : ''} ${editable ? '' : 'disabled'} style="width:16px;height:16px;">
                </td>
                <td style="padding:4px 8px; font-weight:600; color:var(--primary);">${product.code}</td>
                <td style="padding:4px 8px;">${product.description}</td>
                <td style="padding:4px 8px;">
                    <div style="display:flex; gap:4px; align-items:center; justify-content:center;">
                        <select class="mod-p-formula" data-code="${product.code}" data-cat="${category}" style="padding:2px; font-size:0.75rem;" ${used && editable ? '' : 'disabled'}>
                            <option value="" ${!formula?'selected':''}>Seleccione...</option>
                            <option value="width_1" ${formula==='width_1'?'selected':''}>Base x1</option>
                            <option value="width_2" ${formula==='width_2'?'selected':''}>Base x2</option>
                            <option value="width_4" ${formula==='width_4'?'selected':''}>Base x4</option>
                            <option value="height_1" ${formula==='height_1'?'selected':''}>Alto x1</option>
                            <option value="height_2" ${formula==='height_2'?'selected':''}>Alto x2</option>
                            <option value="height_4" ${formula==='height_4'?'selected':''}>Alto x4</option>
                            <option value="perimeter" ${formula==='perimeter'?'selected':''}>Perímetro (Base x2 + Alto x2)</option>
                            <option value="fijo" ${formula==='fijo'?'selected':''}>Fijo</option>
                        </select>
                        <input type="number" step="0.01" min="0" class="mod-p-val" data-code="${product.code}" data-cat="${category}"
                            value="${fixedQty}" style="width:58px; padding:2px; font-size:0.75rem; text-align:center; ${formula === 'fijo' ? '' : 'display:none;'}" ${used && editable ? '' : 'disabled'}>
                    </div>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        if (!editable) return;

        container.querySelectorAll('.mod-p-use').forEach(cb => cb.addEventListener('change', e => this.toggleProfile(e)));
        container.querySelectorAll('.mod-p-formula').forEach(s => s.addEventListener('change', e => this.changeProfileFormula(e)));
        container.querySelectorAll('.mod-p-val').forEach(i => i.addEventListener('change', e => this.changeProfileValue(e)));
    }

    unitFor(row) {
        if (!row || row.formula === 'fijo') return 'und';
        return 'm';
    }

    /** Cantidad de muestra con 1.00 x 1.00 m y 1 módulo, para ver el efecto de la fórmula. */
    resolvePreviewQty(row) {
        return window.calculator.resolveModuleQty(row, {
            width: 1, height: 1, perimeter: 4, area: 1, modules: 1
        });
    }

    toggleProfile(e) {
        const code = e.target.getAttribute('data-code');
        const cat = e.target.getAttribute('data-cat');
        const d = this.draft;

        if (e.target.checked) {
            const brand = window.SEED_DATA.brands[d.brand];
            const prod = brand.categories[cat].products.find(p => p.code === code);
            d.profiles.push({
                code: code,
                category: cat,
                description: prod ? prod.description : '',
                formula: '',
                fixedQty: 1
            });
        } else {
            d.profiles = d.profiles.filter(p => !(p.code === code && p.category === cat));
        }

        this.markDirty();
        this.renderProfiles();
        this.updateEstimate();
    }

    changeProfileFormula(e) {
        const row = this.findProfileRow(e.target.getAttribute('data-code'), e.target.getAttribute('data-cat'));
        if (!row) return;
        row.formula = e.target.value;
        this.markDirty();
        this.renderProfiles();
        this.updateEstimate();
    }

    changeProfileValue(e) {
        const row = this.findProfileRow(e.target.getAttribute('data-code'), e.target.getAttribute('data-cat'));
        if (!row) return;
        const val = parseFloat(e.target.value);
        const safe = Number.isNaN(val) || val < 0 ? 0 : val;
        row.fixedQty = safe;
        this.markDirty();
        this.renderProfiles();
        this.updateEstimate();
    }

    // ============================================================
    // COLUMNA 2: ACCESORIOS
    // ============================================================
    renderAccessories() {
        const container = document.getElementById('module-accessories-list');
        if (!container || !this.draft) return;
        const editable = this.isAdmin;

        let html = '';
        window.SEED_DATA.accessories.forEach(acc => {
            const saved = this.draft.accessories.find(a => a.name === acc.name);
            const qty = saved ? saved.qty : 0;
            html += `<div style="display:flex; align-items:center; gap:0.5rem; padding:4px 0; border-bottom:1px dashed var(--border);">
                <div style="flex:1; font-size:0.78rem;">
                    ${acc.name}
                    <div style="color:var(--text-muted); font-size:0.7rem;">$${acc.pricePerUnit.toFixed(2)} / ${acc.unit}</div>
                </div>
                <input type="number" step="0.01" min="0" class="mod-acc-input" data-name="${acc.name}" value="${qty}"
                    style="width:64px; text-align:center; padding:3px; font-size:0.78rem;" ${editable ? '' : 'disabled'}>
            </div>`;
        });
        container.innerHTML = html;

        if (!editable) return;
        container.querySelectorAll('.mod-acc-input').forEach(i => {
            i.addEventListener('change', e => this.changeAccessory(e));
        });
    }

    changeAccessory(e) {
        const name = e.target.getAttribute('data-name');
        const val = parseFloat(e.target.value);
        const qty = Number.isNaN(val) || val < 0 ? 0 : val;
        const acc = window.SEED_DATA.accessories.find(a => a.name === name);
        const existing = this.draft.accessories.find(a => a.name === name);

        if (qty <= 0) {
            this.draft.accessories = this.draft.accessories.filter(a => a.name !== name);
        } else if (existing) {
            existing.qty = qty;
            existing.price = acc ? acc.pricePerUnit : existing.price;
        } else {
            this.draft.accessories.push({ name: name, qty: qty, price: acc ? acc.pricePerUnit : 0 });
        }

        this.markDirty();
        this.updateEstimate();
    }

    // ============================================================
    // COLUMNA 3: MANO DE OBRA
    // ============================================================
    renderLabor() {
        const d = this.draft;
        if (!d) return;
        const map = {
            'module-labor-workers': d.labor.workers,
            'module-labor-hours': d.labor.hours,
            'module-labor-cost': d.labor.costPerHour,
            'module-labor-transport': d.labor.transport,
            'module-labor-viaticos': d.labor.viaticos
        };
        Object.keys(map).forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = map[id];
            el.disabled = !this.isAdmin;
            if (!el.dataset.bound) {
                el.dataset.bound = '1';
                el.addEventListener('change', () => this.changeLabor());
            }
        });
    }

    changeLabor() {
        const d = this.draft;
        if (!d) return;
        const num = (id, int) => {
            const el = document.getElementById(id);
            const v = int ? parseInt(el.value, 10) : parseFloat(el.value);
            return Number.isNaN(v) || v < 0 ? 0 : v;
        };
        d.labor = {
            workers: num('module-labor-workers', true),
            hours: num('module-labor-hours'),
            costPerHour: num('module-labor-cost'),
            transport: num('module-labor-transport'),
            viaticos: num('module-labor-viaticos')
        };
        this.markDirty();
        this.updateEstimate();
    }

    // ============================================================
    // ESTIMADO / ESTADO
    // ============================================================

    /**
     * Costo de referencia del módulo para una ventana de 1.00 x 1.00 m, 1 módulo
     * y sin vidrio (color y vidrio los define quien cotiza, no el módulo).
     */
    updateEstimate() {
        const el = document.getElementById('module-estimate');
        if (!el || !this.draft) return;
        const d = this.draft;

        const result = window.calculator.calculateWindowCost({
            width: 1, height: 1,
            brand: d.brand, system: d.category, color: this.referenceColor(),
            glassType: '', glassArea: 0,
            modules: 1,
            accessories: d.accessories.map(a => ({ name: a.name, price: a.price, qty: a.qty })),
            labor: d.labor,
            moduleProfiles: d.profiles
        });

        el.innerHTML = `Costo de referencia (1.00 x 1.00 m, sin vidrio, color ${this.referenceColor()}):
            <strong>$${result.total.toFixed(2)}</strong>
            &nbsp;·&nbsp; ${d.profiles.length} perfil(es), ${d.accessories.length} accesorio(s)`;
    }

    updateStatusBadge() {
        const badge = document.getElementById('module-status-badge');
        if (!badge) return;
        const saved = window.SEED_DATA.modules[this.currentItemId];
        if (this.dirty) {
            badge.textContent = 'Cambios sin guardar';
            badge.style.background = '#fff4e0';
            badge.style.color = '#b45309';
        } else if (saved) {
            const when = saved.updatedAt ? new Date(saved.updatedAt).toLocaleDateString('es-EC') : '';
            badge.textContent = `Preestablecido guardado${when ? ' · ' + when : ''}`;
            badge.style.background = '#e8f7ec';
            badge.style.color = '#137333';
        } else {
            badge.textContent = 'Sin preestablecer';
            badge.style.background = '#f1f1f1';
            badge.style.color = '#666';
        }

        const delBtn = document.getElementById('btn-module-delete');
        if (delBtn) delBtn.style.display = saved && this.isAdmin ? 'inline-flex' : 'none';
    }

    markDirty() {
        this.dirty = true;
        this.updateStatusBadge();
        const saveBtn = document.getElementById('btn-module-save');
        if (saveBtn) saveBtn.classList.add('btn-pulse');
    }

    // ============================================================
    // GUARDAR / BORRAR / COPIAR
    // ============================================================
    async saveModule() {
        if (!this.isAdmin) { alert('Solo los administradores pueden guardar módulos.'); return; }
        if (!this.draft) return;

        if (!this.draft.profiles.length) {
            if (!confirm('Este módulo no tiene ningún perfil seleccionado. ¿Guardar de todas formas?')) return;
        }

        const btn = document.getElementById('btn-module-save');
        const original = btn ? btn.innerHTML : '';
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...'; }

        this.draft.updatedAt = new Date().toISOString();
        this.draft.updatedBy = (window.authManager && window.authManager.currentUser)
            ? (window.authManager.currentUser.email || window.authManager.currentUser.name || '')
            : '';

        window.SEED_DATA.modules[this.draft.itemId] = JSON.parse(JSON.stringify(this.draft));

        try {
            await window.catalogManager.persistData();
            this.dirty = false;
            if (btn) { btn.disabled = false; btn.innerHTML = original; btn.classList.remove('btn-pulse'); }
            this.refreshAfterSave();
            alert('Módulo preestablecido guardado. Ya está disponible al cotizar.');
        } catch (e) {
            console.error('Error guardando módulo:', e);
            if (btn) { btn.disabled = false; btn.innerHTML = original; }
            this.refreshAfterSave();
            alert('No se pudo guardar en la nube. El módulo quedó guardado localmente en este equipo.');
        }
    }

    refreshAfterSave() {
        const keepId = this.currentItemId;
        this.populateItemSelect();
        const sel = document.getElementById('module-item-select');
        if (sel) sel.value = keepId;
        this.selectItem(keepId);
        if (window.quotationManager) window.quotationManager.syncModuleFromSystem();
    }

    async deleteModule() {
        if (!this.isAdmin) return;
        if (!confirm('¿Eliminar el módulo preestablecido de este ítem? Se podrá volver a crear cuando quiera.')) return;

        delete window.SEED_DATA.modules[this.currentItemId];
        this.dirty = false;
        try {
            await window.catalogManager.persistData();
        } catch (e) {
            console.error('Error eliminando módulo:', e);
        }
        this.refreshAfterSave();
    }

    /** Copia la receta de otro ítem ya preestablecido — acelera cargar variantes de módulos. */
    copyFromModule() {
        if (!this.isAdmin || !this.draft) return;
        const configured = Object.keys(window.SEED_DATA.modules)
            .filter(id => id !== this.currentItemId)
            .map(id => window.SEED_DATA.modules[id]);

        if (!configured.length) {
            alert('Todavía no hay ningún otro módulo preestablecido para copiar.');
            return;
        }

        const list = configured.map((m, i) => `${i + 1}. ${m.itemName} (${window.SEED_DATA.brands[m.brand] ? window.SEED_DATA.brands[m.brand].name : m.brand})`).join('\n');
        const answer = prompt('Escriba el número del módulo que desea copiar:\n\n' + list);
        if (answer === null) return;
        const idx = parseInt(answer, 10) - 1;
        if (Number.isNaN(idx) || idx < 0 || idx >= configured.length) {
            alert('Número no válido.');
            return;
        }

        const src = JSON.parse(JSON.stringify(configured[idx]));
        const item = window.CATALOG_ITEMS_BY_ID[this.currentItemId];
        this.draft = Object.assign(src, {
            itemId: item.id,
            itemName: item.name,
            group: item.group,
            family: item.family,
            note: item.note || '',
            updatedAt: null,
            updatedBy: null
        });

        this.renderHeader();
        this.renderProfiles();
        this.renderAccessories();
        this.renderLabor();
        this.markDirty();
        this.updateEstimate();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.moduleManager = new ModuleManager();
        window.moduleManager.init();
    }, 250);
});
