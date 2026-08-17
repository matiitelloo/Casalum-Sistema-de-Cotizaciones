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
    /**
     * Valor de "proveedor" que indica que la receta no está atada a una marca:
     * los perfiles pueden venir de Cedal, Fisa y Femec a la vez, y al cotizar
     * se resuelve contra la marca elegida (por rol genérico, ver calculator.js).
     */
    static ALL_BRANDS = '__all__';

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
        const title = document.getElementById('catalog-page-title');
        const navModules = document.getElementById('nav-catalog-modules');
        const navDb = document.getElementById('nav-catalog-db');
        if (!modulesView || !dbView) return;

        const isDb = view === 'db';
        modulesView.style.display = isDb ? 'none' : 'block';
        dbView.style.display = isDb ? 'block' : 'none';
        if (title) title.textContent = isDb ? 'Base de Datos' : 'Preestablecer Ítems';

        [[navModules, !isDb], [navDb, isDb]].forEach(([btn, active]) => {
            if (!btn) return;
            btn.classList.toggle('active', active);
        });

        if (isDb && window.catalogManager) window.catalogManager.renderCurrentTab();
    }

    bindEvents() {
        const navModules = document.getElementById('nav-catalog-modules');
        const navDb = document.getElementById('nav-catalog-db');
        if (navModules) navModules.addEventListener('click', () => this.showView('modules'));
        if (navDb) navDb.addEventListener('click', () => this.showView('db'));

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
            html += `<option value="${window.escapeHtml(it.id)}">${configured ? '✔ ' : ''}${window.escapeHtml(it.name)}${window.escapeHtml(note)}</option>`;
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
            labor: { workers: 0, hours: 0, transport: 0, viaticos: 0 },
            updatedAt: null,
            updatedBy: null
        };
    }

    /** true si la receta está en modo "Todos los proveedores". */
    isAllBrands() {
        return !!this.draft && this.draft.brand === ModuleManager.ALL_BRANDS;
    }

    /**
     * Marca concreta con la que se arma la vista previa de costo. En modo "Todos"
     * no hay una sola marca, así que se toma la primera que tenga catálogo: el
     * estimado es orientativo, el precio real sale de la marca que se elija al cotizar.
     */
    estimateBrand() {
        if (!this.draft) return '';
        if (!this.isAllBrands()) return this.draft.brand;
        const firstRow = (this.draft.profiles || []).find(p => p.brand);
        if (firstRow) return firstRow.brand;
        return Object.keys(window.SEED_DATA.brands)[0] || '';
    }

    /**
     * Color con el que se muestran los precios de referencia en el editor.
     * El módulo NO fija color: el precio real sale del color que se elige al cotizar.
     */
    referenceColor() {
        const brand = window.SEED_DATA.brands[this.estimateBrand()];
        return brand && brand.colors.length ? brand.colors[0] : '';
    }

    renderHeader() {
        const d = this.draft;
        if (!d) return;

        const item = window.CATALOG_ITEMS_BY_ID[d.itemId];
        const title = document.getElementById('module-item-title');
        if (title) {
            title.innerHTML = `${window.escapeHtml(item.name)}
                <span style="font-size:0.8rem; font-weight:400; color:var(--text-muted);">
                    &nbsp;·&nbsp; ${window.escapeHtml(item.group)} / ${window.escapeHtml(item.family)}${item.note ? ' · ' + window.escapeHtml(item.note) : ''}
                </span>`;
        }

        // Marca / proveedor
        const brandSel = document.getElementById('module-brand-select');
        if (brandSel) {
            brandSel.innerHTML = `<option value="${ModuleManager.ALL_BRANDS}">— Todos los proveedores —</option>`;
            Object.keys(window.SEED_DATA.brands).forEach(k => {
                brandSel.innerHTML += `<option value="${k}">${window.SEED_DATA.brands[k].name}</option>`;
            });
            if (d.brand !== ModuleManager.ALL_BRANDS && !window.SEED_DATA.brands[d.brand]) {
                d.brand = Object.keys(window.SEED_DATA.brands)[0] || '';
            }
            brandSel.value = d.brand;
            // En modo "Todos" no hay un logo único que mostrar.
            if (window.updateBrandLogo) {
                window.updateBrandLogo('module-brand-logo', this.isAllBrands() ? '' : d.brand);
            }
        }

        const allBrands = this.isAllBrands();
        const brand = window.SEED_DATA.brands[d.brand];

        // Categoría principal (los perfiles pueden venir de cualquier categoría de la marca).
        // En modo "Todos" las categorías se repiten entre proveedores, así que el filtro
        // por categoría se desactiva y se muestra la base completa de los tres.
        const catSel = document.getElementById('module-category-select');
        if (catSel) {
            if (allBrands) {
                catSel.innerHTML = '<option value="__all__">— Toda la base de datos (3 proveedores) —</option>';
                catSel.value = '__all__';
                d.category = '';
            } else if (brand) {
                catSel.innerHTML = '<option value="__all__">— Toda la base de datos —</option>';
                Object.keys(brand.categories).forEach(c => {
                    catSel.innerHTML += `<option value="${c}">${c}</option>`;
                });
                catSel.value = brand.categories[d.category] ? d.category : '__all__';
            }
        }

        // Aviso de cómo funciona el modo "Todos": sin rol genérico la fila solo
        // sirve para su propio proveedor, que es el error fácil de cometer acá.
        const hint = document.getElementById('module-allbrands-hint');
        if (hint) {
            hint.style.display = allBrands ? 'block' : 'none';
        }

        // Los selects de la cabecera son de solo lectura para no-admin
        if (brandSel) brandSel.disabled = !this.isAdmin;
        // En modo "Todos" el filtro por categoría no aplica (ver arriba).
        if (catSel) catSel.disabled = !this.isAdmin || allBrands;
    }

    /** Producto de una marca que cumple ese rol genérico, con su categoría. */
    findProductByRole(brandKey, role) {
        const brand = window.SEED_DATA.brands[brandKey];
        if (!brand || !role) return null;
        for (const cat of Object.keys(brand.categories || {})) {
            const hit = (brand.categories[cat].products || []).find(
                p => Array.isArray(p.genericRoles) && p.genericRoles.includes(role)
            );
            if (hit) return { product: hit, category: cat };
        }
        return null;
    }

    /**
     * Cambia el proveedor de la receta.
     *
     * Antes esto borraba todos los perfiles: elegir Fisa en una receta armada
     * con Cedal dejaba el módulo vacío, como si no hubiera nada guardado. Ya no
     * hace falta: si un perfil tiene rol genérico, su equivalente en el
     * proveedor nuevo se encuentra solo, que es justamente para lo que están
     * los roles. Solo se pierden los que no tienen rol (o cuyo rol no está
     * asignado en el proveedor destino), y en ese caso se avisa cuáles son y
     * se pide confirmación.
     *
     * @returns {boolean} false si el usuario canceló (hay que dejar todo como estaba).
     */
    async changeBrand(select) {
        const d = this.draft;
        const destino = select.value;
        const anterior = d.brand;

        // Pasar a "Todos" no toca nada: los perfiles ya elegidos siguen siendo
        // válidos, solo se les fija la marca de la que salieron.
        if (destino === ModuleManager.ALL_BRANDS) {
            d.profiles.forEach(p => { if (!p.brand) p.brand = anterior; });
            d.brand = destino;
            d.category = '';
            this.renderHeader();
            return true;
        }

        const conservados = [];
        const perdidos = [];

        d.profiles.forEach(row => {
            const equivalente = row.role ? this.findProductByRole(destino, row.role) : null;
            if (!equivalente) {
                perdidos.push(row.description || row.code);
                return;
            }
            // Se mantiene la fórmula y los coeficientes; cambia solo a qué
            // producto apuntan.
            conservados.push(Object.assign({}, row, {
                code: equivalente.product.code,
                category: equivalente.category,
                description: equivalente.product.description,
                brand: destino
            }));
        });

        if (perdidos.length) {
            const nombreDestino = window.SEED_DATA.brands[destino]
                ? window.SEED_DATA.brands[destino].name : destino;
            const aviso = `Estos perfiles no tienen equivalente en ${nombreDestino} `
                + `(les falta el rol genérico) y se van a quitar de la receta:\n\n· `
                + perdidos.join('\n· ')
                + `\n\nLos puede mapear en Catálogo → Roles Genéricos. ¿Continuar igual?`;
            if (!(await notify.confirm(aviso, { danger: true, confirmText: 'Continuar' }))) {
                select.value = anterior;   // se deshace el cambio en pantalla
                return false;
            }
        }

        d.profiles = conservados;
        d.brand = destino;
        d.category = '';
        this.renderHeader();

        if (conservados.length) {
            notify.success(`${conservados.length} perfil(es) reapuntados a ${window.SEED_DATA.brands[destino].name}.`);
        }
        return true;
    }

    async handleHeaderChange(id) {
        const d = this.draft;
        if (!d) return;
        const el = document.getElementById(id);

        if (id === 'module-brand-select') {
            if (!(await this.changeBrand(el))) return;
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

    /**
     * Perfiles disponibles para elegir. Con una marca fija son los de esa marca
     * (y, si hay categoría fija, solo esa categoría). En modo "Todos" se listan
     * los de los tres proveedores, cada fila etiquetada con la marca a la que
     * pertenece — por eso los códigos llevan prefijo CED-/FIS-/FEM-.
     */
    visibleProducts() {
        const d = this.draft;
        const brandKeys = this.isAllBrands()
            ? Object.keys(window.SEED_DATA.brands)
            : [d.brand];

        const out = [];
        brandKeys.forEach(brandKey => {
            const brand = window.SEED_DATA.brands[brandKey];
            if (!brand) return;

            const cats = !this.isAllBrands() && d.category && brand.categories[d.category]
                ? [d.category]
                : Object.keys(brand.categories);

            cats.forEach(cat => {
                brand.categories[cat].products.forEach(p => {
                    out.push({ brandKey: brandKey, category: cat, product: p });
                });
            });
        });
        return out;
    }

    /**
     * Marca efectiva de una fila guardada. Las recetas viejas (de una sola marca)
     * no guardan `brand` en cada perfil: en ese caso vale la marca de la receta.
     */
    rowBrand(row) {
        return row.brand || (this.draft ? this.draft.brand : '');
    }

    findProfileRow(code, category, brandKey) {
        return this.draft.profiles.find(p =>
            p.code === code &&
            p.category === category &&
            (!brandKey || this.rowBrand(p) === brandKey)
        );
    }

    /** Fila apuntada por un input de la tabla de perfiles. */
    rowFromEvent(e) {
        return this.findProfileRow(
            e.target.getAttribute('data-code'),
            e.target.getAttribute('data-cat'),
            e.target.getAttribute('data-brand')
        );
    }

    renderProfiles() {
        const container = document.getElementById('module-profiles-table');
        if (!container || !this.draft) return;

        const d = this.draft;
        const editable = this.isAdmin;
        const rows = this.visibleProducts().filter(({ brandKey, category, product }) => {
            if (this.onlySelected && !this.findProfileRow(product.code, category, brandKey)) return false;
            if (!this.profileFilter) return true;
            const brandName = window.SEED_DATA.brands[brandKey] ? window.SEED_DATA.brands[brandKey].name : brandKey;
            const hay = `${product.code} ${product.description} ${category} ${brandName}`.toLowerCase();
            return hay.indexOf(this.profileFilter) !== -1;
        });

        if (!rows.length) {
            // El mensaje dice cuál de los dos filtros está vaciando la lista: con
            // "Solo usados" tildado y ningún perfil marcado, "no coincide con el
            // filtro" hacía parecer que la receta se había perdido.
            let motivo;
            if (this.onlySelected && !d.profiles.length) {
                motivo = 'Este módulo todavía no tiene perfiles marcados. Destilde <strong>Solo usados</strong> para ver la base del proveedor y elegirlos.';
            } else if (this.onlySelected) {
                motivo = 'Ningún perfil marcado coincide con la búsqueda.';
            } else {
                motivo = 'No hay perfiles que coincidan con el filtro.';
            }
            container.innerHTML = `<p class="text-muted" style="padding:1rem;">${motivo}</p>`;
            return;
        }

        // El precio mostrado es solo referencial: el color real se elige al cotizar.
        const refColor = this.referenceColor();
        const coefFields = [
            ['coefBase', 'Base'], ['coefAltura', 'Alto'],
            ['coefBaseMod', 'Base×Mód'], ['coefAlturaMod', 'Alto×Mód'],
            ['coefArea', 'Área']
        ];

        let html = `<table class="table" style="font-size:0.78rem; min-width:900px;">
            <thead><tr style="background: var(--primary); color:#fff;">
                <th style="padding:6px 8px; text-align:center;">Usar</th>
                <th style="padding:6px 8px;">Código</th>
                <th style="padding:6px 8px;">Descripción</th>
                <th style="padding:6px 8px; text-align:center;">Fijo / Fórmula</th>
                <th style="padding:6px 8px; text-align:center;" title="Etiqueta compartida entre proveedores: si Cedal, Fisa y Femec tienen un perfil con el mismo rol, esta receta cotiza con cualquiera de los tres sin duplicarla.">Rol genérico (multi-proveedor)</th>
            </tr></thead><tbody>`;

        let lastGroup = null;
        rows.forEach(({ brandKey, category, product }) => {
            // En modo "Todos" la misma categoría existe en los tres proveedores,
            // así que el encabezado agrupa por marca + categoría.
            const brandName = window.SEED_DATA.brands[brandKey] ? window.SEED_DATA.brands[brandKey].name : brandKey;
            const groupKey = `${brandKey}|${category}`;
            if (groupKey !== lastGroup) {
                const label = this.isAllBrands()
                    ? `${window.escapeHtml(brandName)} &nbsp;·&nbsp; ${window.escapeHtml(category)}`
                    : window.escapeHtml(category);
                html += `<tr><td colspan="6" style="padding:4px 8px; background:#eef4ef; font-weight:700; color:var(--primary); font-size:0.75rem;">${label}</td></tr>`;
                lastGroup = groupKey;
            }

            const row = this.findProfileRow(product.code, category, brandKey);
            const used = !!row;
            const formula = row ? row.formula : '';
            const fixedQty = row ? row.fixedQty : 1;
            const isLineal = formula === 'lineal';
            const roleVal = row ? (row.role || '') : '';

            html += `<tr style="${used ? 'background:#f2fbf3;' : ''}">
                <td style="padding:4px 8px; text-align:center;">
                    <input type="checkbox" class="mod-p-use" data-code="${product.code}" data-cat="${category}" data-brand="${brandKey}" ${used ? 'checked' : ''} ${editable ? '' : 'disabled'} style="width:16px;height:16px;">
                </td>
                <td style="padding:4px 8px; font-weight:600; color:var(--primary);">${product.code}</td>
                <td style="padding:4px 8px;">${product.description}</td>
                <td style="padding:4px 8px;">
                    <div style="display:flex; gap:4px; align-items:center; justify-content:center; flex-wrap:wrap;">
                        <select class="mod-p-formula" data-code="${product.code}" data-cat="${category}" data-brand="${brandKey}" style="padding:2px; font-size:0.75rem;" ${used && editable ? '' : 'disabled'}>
                            <option value="" ${!formula?'selected':''}>Seleccione...</option>
                            <option value="width_1" ${formula==='width_1'?'selected':''}>Base x1</option>
                            <option value="width_2" ${formula==='width_2'?'selected':''}>Base x2</option>
                            <option value="width_4" ${formula==='width_4'?'selected':''}>Base x4</option>
                            <option value="height_1" ${formula==='height_1'?'selected':''}>Alto x1</option>
                            <option value="height_2" ${formula==='height_2'?'selected':''}>Alto x2</option>
                            <option value="height_4" ${formula==='height_4'?'selected':''}>Alto x4</option>
                            <option value="perimeter" ${formula==='perimeter'?'selected':''}>Perímetro (Base x2 + Alto x2)</option>
                            <option value="lineal" ${isLineal?'selected':''}>Coeficientes (compuesta / módulos-1 / ×módulos)</option>
                            <option value="fijo" ${formula==='fijo'?'selected':''}>Fijo</option>
                        </select>
                        <input type="number" step="0.01" min="0" class="mod-p-val" data-code="${product.code}" data-cat="${category}" data-brand="${brandKey}"
                            value="${fixedQty}" title="Cantidad fija" style="width:58px; padding:2px; font-size:0.75rem; text-align:center; ${formula === 'fijo' ? '' : 'display:none;'}" ${used && editable ? '' : 'disabled'}>
                        <span class="mod-p-lineal" data-code="${product.code}" data-cat="${category}" data-brand="${brandKey}" style="display:${isLineal ? 'inline-flex' : 'none'}; gap:3px; align-items:center; flex-wrap:wrap;">
                            ${coefFields.map(([key, label]) => `
                                <label style="display:flex; flex-direction:column; align-items:center; font-size:0.62rem; color:var(--text-muted);">${label}
                                    <input type="number" step="0.01" class="mod-p-coef" data-coef="${key}" data-code="${product.code}" data-cat="${category}" data-brand="${brandKey}"
                                        value="${row && row[key] ? row[key] : ''}" placeholder="0" style="width:44px; padding:2px; font-size:0.72rem; text-align:center;" ${used && editable ? '' : 'disabled'}>
                                </label>`).join('')}
                            <label style="display:flex; flex-direction:column; align-items:center; font-size:0.62rem; color:var(--text-muted);">+K
                                <input type="number" step="0.01" class="mod-p-coef" data-coef="fixedQty" data-code="${product.code}" data-cat="${category}" data-brand="${brandKey}"
                                    value="${row && row.fixedQty ? row.fixedQty : ''}" placeholder="0" style="width:44px; padding:2px; font-size:0.72rem; text-align:center;" ${used && editable ? '' : 'disabled'}>
                            </label>
                        </span>
                    </div>
                </td>
                <td style="padding:4px 8px; text-align:center;">
                    <input type="text" class="mod-p-role" data-code="${product.code}" data-cat="${category}" data-brand="${brandKey}"
                        value="${window.escapeHtml(roleVal)}" placeholder="ej: ventana-t45-marco" style="width:150px; padding:2px; font-size:0.72rem;" ${used && editable ? '' : 'disabled'}>
                </td>
            </tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;

        if (!editable) return;

        container.querySelectorAll('.mod-p-use').forEach(cb => cb.addEventListener('change', e => this.toggleProfile(e)));
        container.querySelectorAll('.mod-p-formula').forEach(s => s.addEventListener('change', e => this.changeProfileFormula(e)));
        container.querySelectorAll('.mod-p-val').forEach(i => i.addEventListener('change', e => this.changeProfileValue(e)));
        container.querySelectorAll('.mod-p-coef').forEach(i => i.addEventListener('change', e => this.changeProfileCoef(e)));
        container.querySelectorAll('.mod-p-role').forEach(i => i.addEventListener('change', e => this.changeProfileRole(e)));
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
        const brandKey = e.target.getAttribute('data-brand') || this.draft.brand;
        const d = this.draft;

        if (e.target.checked) {
            const brand = window.SEED_DATA.brands[brandKey];
            const prod = brand && brand.categories[cat]
                ? brand.categories[cat].products.find(p => p.code === code)
                : null;
            // Si el producto ya trae un rol genérico etiquetado (ver data/seed.js),
            // se precarga acá para no tener que volver a escribirlo a mano.
            const role = (prod && Array.isArray(prod.genericRoles) && prod.genericRoles.length) ? prod.genericRoles[0] : '';
            d.profiles.push({
                code: code,
                category: cat,
                // La marca del perfil se guarda siempre: en modo "Todos" una misma
                // receta mezcla perfiles de Cedal, Fisa y Femec.
                brand: brandKey,
                description: prod ? prod.description : '',
                formula: '',
                fixedQty: 1,
                role: role
            });
        } else {
            d.profiles = d.profiles.filter(p =>
                !(p.code === code && p.category === cat && this.rowBrand(p) === brandKey)
            );
        }

        this.markDirty();
        this.renderProfiles();
        this.updateEstimate();
    }

    changeProfileFormula(e) {
        const row = this.rowFromEvent(e);
        if (!row) return;
        row.formula = e.target.value;
        this.markDirty();
        this.renderProfiles();
        this.updateEstimate();
    }

    changeProfileValue(e) {
        const row = this.rowFromEvent(e);
        if (!row) return;
        const val = parseFloat(e.target.value);
        const safe = Number.isNaN(val) || val < 0 ? 0 : val;
        row.fixedQty = safe;
        this.markDirty();
        this.renderProfiles();
        this.updateEstimate();
    }

    /** Coeficientes de la fórmula lineal (coefBase, coefAltura, coefBaseMod, coefAlturaMod, coefArea, fixedQty=K). */
    changeProfileCoef(e) {
        const row = this.rowFromEvent(e);
        if (!row) return;
        const key = e.target.getAttribute('data-coef');
        const val = parseFloat(e.target.value);
        row[key] = Number.isNaN(val) ? 0 : val;
        this.markDirty();
        this.updateEstimate();
        // No re-renderiza toda la tabla acá para no perder el foco mientras se
        // escriben varios coeficientes seguidos.
    }

    /** Rol genérico (multi-proveedor) de la fila. Vacío = solo funciona con la marca guardada. */
    changeProfileRole(e) {
        const row = this.rowFromEvent(e);
        if (!row) return;
        row.role = e.target.value.trim();
        this.markDirty();
    }

    // ============================================================
    // COLUMNA 2: ACCESORIOS
    // ============================================================
    renderAccessories() {
        const container = document.getElementById('module-accessories-list');
        if (!container || !this.draft) return;
        const editable = this.isAdmin;
        const coefFields = [
            ['coefBase', 'Base'], ['coefAltura', 'Alto'],
            ['coefBaseMod', 'Base×Mód'], ['coefAlturaMod', 'Alto×Mód'], ['coefArea', 'Área']
        ];

        let html = '';
        window.SEED_DATA.accessories.forEach(acc => {
            const saved = this.draft.accessories.find(a => a.name === acc.name);
            const qty = saved ? saved.qty : 0;
            const nameAttr = window.escapeHtml(acc.name);
            const hasFormula = !!(saved && saved.qtyFormula);
            html += `<div style="padding:4px 0; border-bottom:1px dashed var(--border);">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <div style="flex:1; font-size:0.78rem;">
                        ${nameAttr}
                        <div style="color:var(--text-muted); font-size:0.7rem;">$${acc.pricePerUnit.toFixed(2)} / ${window.escapeHtml(acc.unit)}</div>
                    </div>
                    <input type="number" step="0.01" min="0" class="mod-acc-input" data-name="${nameAttr}" value="${qty}"
                        title="Cantidad fija" style="width:64px; text-align:center; padding:3px; font-size:0.78rem; ${hasFormula ? 'display:none;' : ''}" ${editable ? '' : 'disabled'}>
                </div>
                <label style="display:flex; align-items:center; gap:0.3rem; font-size:0.68rem; color:var(--text-muted); margin-top:2px;">
                    <input type="checkbox" class="mod-acc-formula-toggle" data-name="${nameAttr}" ${hasFormula ? 'checked' : ''} ${editable ? '' : 'disabled'} style="width:auto;">
                    Cantidad por fórmula (ej: escala igual que un perfil)
                </label>
                <div class="mod-acc-formula-wrap" data-name="${nameAttr}" style="display:${hasFormula ? 'flex' : 'none'}; gap:3px; margin-top:2px; flex-wrap:wrap;">
                    ${coefFields.map(([key, label]) => `
                        <label style="display:flex; flex-direction:column; align-items:center; font-size:0.62rem; color:var(--text-muted);">${label}
                            <input type="number" step="0.01" class="mod-acc-coef" data-coef="${key}" data-name="${nameAttr}"
                                value="${saved && saved.qtyFormula && saved.qtyFormula[key] ? saved.qtyFormula[key] : ''}" placeholder="0" style="width:40px; padding:2px; font-size:0.7rem; text-align:center;" ${editable ? '' : 'disabled'}>
                        </label>`).join('')}
                    <label style="display:flex; flex-direction:column; align-items:center; font-size:0.62rem; color:var(--text-muted);">+K
                        <input type="number" step="0.01" class="mod-acc-coef" data-coef="fixedQty" data-name="${nameAttr}"
                            value="${saved && saved.qtyFormula && saved.qtyFormula.fixedQty ? saved.qtyFormula.fixedQty : ''}" placeholder="0" style="width:40px; padding:2px; font-size:0.7rem; text-align:center;" ${editable ? '' : 'disabled'}>
                    </label>
                </div>
            </div>`;
        });
        container.innerHTML = html;

        if (!editable) return;
        container.querySelectorAll('.mod-acc-input').forEach(i => {
            i.addEventListener('change', e => this.changeAccessory(e));
        });
        container.querySelectorAll('.mod-acc-formula-toggle').forEach(cb => {
            cb.addEventListener('change', e => this.toggleAccessoryFormula(e));
        });
        container.querySelectorAll('.mod-acc-coef').forEach(i => {
            i.addEventListener('change', e => this.changeAccessoryCoef(e));
        });
    }

    changeAccessory(e) {
        const name = e.target.getAttribute('data-name');
        const val = parseFloat(e.target.value);
        const qty = Number.isNaN(val) || val < 0 ? 0 : val;
        const acc = window.SEED_DATA.accessories.find(a => a.name === name);
        const existing = this.draft.accessories.find(a => a.name === name);

        if (qty <= 0 && !(existing && existing.qtyFormula)) {
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

    /** Activa/desactiva que la cantidad de un accesorio del módulo se calcule por fórmula en vez de a mano. */
    toggleAccessoryFormula(e) {
        const name = e.target.getAttribute('data-name');
        const acc = window.SEED_DATA.accessories.find(a => a.name === name);
        let row = this.draft.accessories.find(a => a.name === name);
        if (e.target.checked) {
            if (!row) {
                row = { name: name, qty: 0, price: acc ? acc.pricePerUnit : 0 };
                this.draft.accessories.push(row);
            }
            row.qtyFormula = { coefBase: 0, coefAltura: 0, coefBaseMod: 0, coefAlturaMod: 0, coefArea: 0, fixedQty: 0 };
        } else if (row) {
            delete row.qtyFormula;
            if (!row.qty) this.draft.accessories = this.draft.accessories.filter(a => a.name !== name);
        }
        this.markDirty();
        this.renderAccessories();
        this.updateEstimate();
    }

    changeAccessoryCoef(e) {
        const name = e.target.getAttribute('data-name');
        const row = this.draft.accessories.find(a => a.name === name);
        if (!row || !row.qtyFormula) return;
        const key = e.target.getAttribute('data-coef');
        const val = parseFloat(e.target.value);
        row.qtyFormula[key] = Number.isNaN(val) ? 0 : val;
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
        this.renderLaborFormula();
    }

    /**
     * Mano de obra por fórmula: "Horas" (en realidad, unidades de mano de obra
     * a $/hora fijo de Ajustes) = coefModulos x Módulos + K. Cubre los
     * patrones vistos en los Excel (4 fijo, 2xN+2, N+3, etc.) sin tener que
     * volver a este editor cada vez que cambia la cantidad de módulos.
     * Si no está activada, Horas se sigue llenando a mano como siempre.
     */
    renderLaborFormula() {
        const d = this.draft;
        const wrap = document.getElementById('module-labor-formula-wrap');
        const toggle = document.getElementById('module-labor-formula-toggle');
        const coefModEl = document.getElementById('module-labor-formula-coefmod');
        const kEl = document.getElementById('module-labor-formula-k');
        if (!wrap || !toggle || !d) return;

        const hf = d.labor.hoursFormula || null;
        toggle.checked = !!hf;
        toggle.disabled = !this.isAdmin;
        coefModEl.value = hf ? (hf.coefModulos || 0) : 0;
        kEl.value = hf ? (hf.base || 0) : 0;
        coefModEl.disabled = kEl.disabled = !this.isAdmin || !hf;
        wrap.style.display = hf ? 'flex' : 'none';
        document.getElementById('module-labor-hours').disabled = !this.isAdmin || !!hf;

        if (!toggle.dataset.bound) {
            toggle.dataset.bound = '1';
            toggle.addEventListener('change', () => {
                this.draft.labor.hoursFormula = toggle.checked ? { coefModulos: 0, base: this.draft.labor.hours || 0 } : null;
                this.markDirty();
                this.renderLaborFormula();
                this.updateEstimate();
            });
        }
        [coefModEl, kEl].forEach(el => {
            if (!el.dataset.bound) {
                el.dataset.bound = '1';
                el.addEventListener('change', () => {
                    if (!this.draft.labor.hoursFormula) return;
                    this.draft.labor.hoursFormula.coefModulos = parseFloat(coefModEl.value) || 0;
                    this.draft.labor.hoursFormula.base = parseFloat(kEl.value) || 0;
                    this.markDirty();
                    this.updateEstimate();
                });
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
            transport: num('module-labor-transport'),
            viaticos: num('module-labor-viaticos'),
            hoursFormula: d.labor.hoursFormula || null
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

        const previewModules = 1;
        const previewCtx = { width: 1, height: 1, perimeter: 4, area: 1, modules: previewModules };
        const estBrand = this.estimateBrand();
        const result = window.calculator.calculateWindowCost({
            width: 1, height: 1,
            brand: estBrand, system: d.category, color: this.referenceColor(),
            glassType: '', glassArea: 0,
            modules: previewModules,
            accessories: d.accessories.map(a => ({ name: a.name, price: a.price, qty: window.calculator.resolveAccessoryQty(a, previewCtx) })),
            labor: { ...d.labor, hours: window.calculator.resolveLaborHours(d.labor, previewModules) },
            moduleProfiles: d.profiles
        });

        // En modo "Todos" el estimado se arma con un proveedor concreto y se aclara
        // cuál, porque el costo real depende de la marca que se elija al cotizar.
        const estBrandName = window.SEED_DATA.brands[estBrand] ? window.SEED_DATA.brands[estBrand].name : estBrand;
        const brandNote = this.isAllBrands() ? `, referencia ${estBrandName}` : '';

        el.innerHTML = `Costo de referencia (1.00 x 1.00 m, sin vidrio, color ${this.referenceColor()}${brandNote}):
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
        if (!this.isAdmin) { notify.warning('Solo los administradores pueden guardar módulos.'); return; }
        if (!this.draft) return;

        if (!this.draft.profiles.length) {
            if (!(await notify.confirm('Este módulo no tiene ningún perfil seleccionado. ¿Guardar de todas formas?'))) return;
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
            notify.success('Módulo preestablecido guardado. Ya está disponible al cotizar.');
        } catch (e) {
            console.error('Error guardando módulo:', e);
            if (btn) { btn.disabled = false; btn.innerHTML = original; }
            this.refreshAfterSave();
            notify.error('No se pudo guardar en la nube. El módulo quedó guardado localmente en este equipo.');
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
        if (!(await notify.confirm('¿Eliminar el módulo preestablecido de este ítem? Se podrá volver a crear cuando quiera.', { danger: true, confirmText: 'Eliminar' }))) return;

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
            notify.info('Todavía no hay ningún otro módulo preestablecido para copiar.');
            return;
        }

        const brandLabel = (b) => b === ModuleManager.ALL_BRANDS
            ? 'Todos los proveedores'
            : (window.SEED_DATA.brands[b] ? window.SEED_DATA.brands[b].name : b);
        const list = configured.map((m, i) => `${i + 1}. ${m.itemName} (${brandLabel(m.brand)})`).join('\n');
        const answer = prompt('Escriba el número del módulo que desea copiar:\n\n' + list);
        if (answer === null) return;
        const idx = parseInt(answer, 10) - 1;
        if (Number.isNaN(idx) || idx < 0 || idx >= configured.length) {
            notify.warning('Número no válido.');
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
