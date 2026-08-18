/**
 * Catalog Manager — Full CRUD for SEED_DATA
 * Editable only by admin users.
 * Persists changes to Firestore (primary) and localStorage (cache).
 */
/**
 * Guarda en localStorage sin poder tumbar al que llama.
 *
 * localStorage tira excepción si el navegador está en modo privado o si se pasó
 * la cuota (el catálogo ya ronda los 40 KB). Antes eso cortaba persistData()
 * ANTES de escribir en Firestore, así que un caché que no se puede escribir
 * hacía perder el guardado de verdad. El caché es una comodidad; la nube es la
 * fuente. Si falla, se sigue.
 */
function guardarCacheLocal(clave, valor) {
    try {
        localStorage.setItem(clave, valor);
        return true;
    } catch (e) {
        console.warn('No se pudo escribir el caché local (se guarda igual en la nube):', e.message);
        return false;
    }
}

class CatalogManager {
    constructor() {
        this.isAdmin = false;
        this.hasChanges = false;
        this.currentBrand = '';
        this.currentCategory = '';
        this.currentTab = 'profiles';
        this.rolesFilter = '';
        this.rolesOnlyIncomplete = false;
        // Roles recién creados que todavía no se asignaron a ningún perfil: no
        // viven en ningún producto, así que se listan aparte hasta que se usen.
        this.pendingRoles = [];
    }

    init() {
        this.isAdmin = window.authManager && window.authManager.currentUser && window.authManager.currentUser.role === 'admin';
        this.bindEvents();
        this.populateBrandSelect();
        this.showAdminControls();
    }

    /** Load catalog from Firestore (primary) or localStorage (cache) */
    async loadPersistedData() {
        // Try Firestore first
        try {
            if (window.dbManager && window.dbManager.db) {
                const doc = await window.dbManager.db.collection('catalog').doc('data').get();
                if (doc.exists) {
                    const parsed = doc.data();
                    if (parsed.brands) window.SEED_DATA.brands = parsed.brands;
                    if (parsed.glass) window.SEED_DATA.glass = parsed.glass;
                    if (parsed.glassSale) window.SEED_DATA.glassSale = parsed.glassSale;
                    if (parsed.accessories) window.SEED_DATA.accessories = parsed.accessories;
                    if (parsed.modules) window.SEED_DATA.modules = parsed.modules;
                    // Update local cache
                    guardarCacheLocal('casalum_catalog_data', JSON.stringify(parsed));
                    return;
                }
            }
        } catch (e) {
            console.warn('Firestore catalog load failed, falling back to localStorage:', e);
        }
        // Fallback: localStorage
        const saved = localStorage.getItem('casalum_catalog_data');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.brands) window.SEED_DATA.brands = parsed.brands;
                if (parsed.glass) window.SEED_DATA.glass = parsed.glass;
                if (parsed.glassSale) window.SEED_DATA.glassSale = parsed.glassSale;
                if (parsed.accessories) window.SEED_DATA.accessories = parsed.accessories;
                if (parsed.modules) window.SEED_DATA.modules = parsed.modules;
            } catch (e) {
                console.error('Error loading persisted catalog from localStorage:', e);
            }
        }
    }

    /** Save current SEED_DATA to Firestore (primary) and localStorage (cache) */
    async persistData() {
        const toSave = {
            brands: window.SEED_DATA.brands,
            glass: window.SEED_DATA.glass,
            glassSale: window.SEED_DATA.glassSale || [],
            accessories: window.SEED_DATA.accessories,
            modules: window.SEED_DATA.modules || {},
            // Marca que los roles genéricos se editan a mano: apaga el parche de
            // data/seed.js para que no pise lo guardado (ver applyGenericRolePatches).
            rolesCustomized: !!window.SEED_DATA.rolesCustomized
        };
        // Save to localStorage as cache
        guardarCacheLocal('casalum_catalog_data', JSON.stringify(toSave));
        // Save to Firestore
        if (window.dbManager && window.dbManager.db) {
            await window.dbManager.db.collection('catalog').doc('data').set(toSave);
        }
    }

    showAdminControls() {
        const adminActions = document.getElementById('catalog-admin-actions');
        if (adminActions) {
            adminActions.style.display = this.isAdmin ? 'flex' : 'none';
        }
    }

    bindEvents() {
        // Tab switching
        document.querySelectorAll('.catalog-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.catalog-tab').forEach(t => {
                    t.classList.remove('active');
                    t.style.borderBottomColor = 'transparent';
                    t.style.color = 'var(--text-muted)';
                });
                tab.classList.add('active');
                tab.style.borderBottomColor = 'var(--primary)';
                tab.style.color = 'var(--primary)';

                document.querySelectorAll('.catalog-tab-content').forEach(c => c.style.display = 'none');
                const target = tab.getAttribute('data-tab');
                this.currentTab = target;
                document.getElementById(`catalog-tab-${target}`).style.display = 'block';
                this.renderCurrentTab();
            });
        });

        // Activate the first tab visually
        const firstTab = document.querySelector('.catalog-tab.active');
        if (firstTab) {
            firstTab.style.borderBottomColor = 'var(--primary)';
            firstTab.style.color = 'var(--primary)';
        }

        // Brand & Category selectors
        const brandSel = document.getElementById('catalog-brand-select');
        if (brandSel) {
            brandSel.addEventListener('change', () => {
                this.currentBrand = brandSel.value;
                if (window.updateBrandLogo) window.updateBrandLogo('catalog-brand-logo', this.currentBrand);
                this.populateCategorySelect();
            });
        }

        const catSel = document.getElementById('catalog-category-select');
        if (catSel) {
            catSel.addEventListener('change', () => {
                this.currentCategory = catSel.value;
                this.renderProfilesTable();
            });
        }

        // Filtros del tab de roles genéricos
        const rolesFilter = document.getElementById('roles-filter');
        if (rolesFilter) {
            rolesFilter.addEventListener('input', () => {
                this.rolesFilter = rolesFilter.value.trim();
                this.renderRolesTable();
            });
        }

        const rolesIncomplete = document.getElementById('roles-only-incomplete');
        if (rolesIncomplete) {
            rolesIncomplete.addEventListener('change', () => {
                this.rolesOnlyIncomplete = rolesIncomplete.checked;
                this.renderRolesTable();
            });
        }

        // Save button
        const saveBtn = document.getElementById('btn-catalog-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveChanges());
        }

        // Add product button
        const addBtn = document.getElementById('btn-catalog-add-product');
        if (addBtn) {
            addBtn.addEventListener('click', () => this.openAddModal());
        }

        // Modal close / cancel
        const closeModal = document.getElementById('btn-close-add-modal');
        const cancelAdd = document.getElementById('btn-cancel-add');
        if (closeModal) closeModal.addEventListener('click', () => this.closeAddModal());
        if (cancelAdd) cancelAdd.addEventListener('click', () => this.closeAddModal());

        // Confirm add
        const confirmAdd = document.getElementById('btn-confirm-add');
        if (confirmAdd) {
            confirmAdd.addEventListener('click', () => this.confirmAddProduct());
        }

        // Add brand change in modal
        const addBrand = document.getElementById('add-p-brand');
        if (addBrand) {
            addBrand.addEventListener('change', () => this.updateModalCategories());
        }
    }

    populateBrandSelect() {
        const sel = document.getElementById('catalog-brand-select');
        if (!sel || !window.SEED_DATA) return;
        sel.innerHTML = '';
        const brands = Object.keys(window.SEED_DATA.brands);
        brands.forEach((key, i) => {
            sel.innerHTML += `<option value="${window.escapeHtml(key)}">${window.escapeHtml(window.SEED_DATA.brands[key].name)}</option>`;
        });
        if (brands.length > 0) {
            this.currentBrand = brands[0];
            sel.value = brands[0];
            if (window.updateBrandLogo) window.updateBrandLogo('catalog-brand-logo', this.currentBrand);
            this.populateCategorySelect();
        }
    }

    populateCategorySelect() {
        const sel = document.getElementById('catalog-category-select');
        if (!sel) return;
        sel.innerHTML = '';
        const brand = window.SEED_DATA.brands[this.currentBrand];
        if (!brand) return;

        const cats = Object.keys(brand.categories);
        cats.forEach((cat, i) => {
            sel.innerHTML += `<option value="${window.escapeHtml(cat)}">${window.escapeHtml(cat)}</option>`;
        });
        if (cats.length > 0) {
            this.currentCategory = cats[0];
            sel.value = cats[0];
            this.renderProfilesTable();
        }
    }

    renderCurrentTab() {
        if (this.currentTab === 'profiles') this.renderProfilesTable();
        else if (this.currentTab === 'glass') this.renderGlassTable();
        else if (this.currentTab === 'accessories') this.renderAccessoriesTable();
        else if (this.currentTab === 'roles') this.renderRolesTable();
    }

    // ============================================================
    // PROFILES TABLE
    // ============================================================
    renderProfilesTable() {
        const container = document.getElementById('catalog-profiles-table');
        if (!container) return;
        const brand = window.SEED_DATA.brands[this.currentBrand];
        if (!brand) { container.innerHTML = '<p>Marca no encontrada.</p>'; return; }
        const cat = brand.categories[this.currentCategory];
        if (!cat) { container.innerHTML = '<p>Seleccione una categoría.</p>'; return; }

        const colors = brand.colors;
        const editable = this.isAdmin;

        let html = `<table class="table" style="font-size: 0.82rem; min-width: 700px;">
            <thead><tr style="background: var(--primary); color: white;">
                <th style="padding:8px;">Código</th>
                <th style="padding:8px;">Descripción</th>`;
        colors.forEach(c => {
            html += `<th style="padding:8px; text-align:center;">${c}</th>`;
        });
        if (editable) html += `<th style="padding:8px; text-align:center;"><i class="fa-solid fa-cog"></i></th>`;
        html += `</tr></thead><tbody>`;

        cat.products.forEach((prod, idx) => {
            html += `<tr>
                <td style="padding:6px 8px; font-weight:600; color: var(--primary);">${editable ? `<input type="text" value="${window.escapeHtml(prod.code)}" data-field="code" data-idx="${idx}" class="catalog-edit-input" style="width:75px;">` : window.escapeHtml(prod.code)}</td>
                <td style="padding:6px 8px;">${editable ? `<input type="text" value="${window.escapeHtml(prod.description)}" data-field="desc" data-idx="${idx}" class="catalog-edit-input" style="width:200px;">` : window.escapeHtml(prod.description)}</td>`;
                
            if (editable) {
                // Fijo/Fórmula fue transferido a Módulos
            }

            colors.forEach(c => {
                const colorKey = c.toLowerCase();
                const price = prod.prices[colorKey];
                const val = price !== null && price !== undefined ? price.toFixed(2) : '-';
                if (editable) {
                    html += `<td style="padding:6px 4px; text-align:center;">
                        <input type="number" step="0.01" value="${price !== null && price !== undefined ? price : ''}" 
                            data-field="price" data-color="${colorKey}" data-idx="${idx}" 
                            class="catalog-edit-input" style="width:65px; text-align:center;">
                    </td>`;
                } else {
                    html += `<td style="padding:6px 8px; text-align:center;">${val !== '-' ? '$' + val : '<span style="color:#ccc;">N/A</span>'}</td>`;
                }
            });
            if (editable) {
                html += `<td style="padding:6px 8px; text-align:center;">
                    <button class="btn btn-sm btn-danger" onclick="window.catalogManager.deleteProduct(${idx})" title="Eliminar">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>`;
            }
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

        // Bind edit listeners
        if (editable) {
            container.querySelectorAll('.catalog-edit-input').forEach(input => {
                input.addEventListener('change', (e) => this.handleProfileEdit(e));
            });
        }
    }

    handleProfileEdit(e) {
        const input = e.target;
        const idx = parseInt(input.getAttribute('data-idx'));
        const field = input.getAttribute('data-field');
        const prod = window.SEED_DATA.brands[this.currentBrand].categories[this.currentCategory].products[idx];

        if (field === 'price') {
            const colorKey = input.getAttribute('data-color');
            const val = input.value.trim();
            prod.prices[colorKey] = val === '' ? null : parseFloat(val);
        } else if (field === 'code') {
            // Se re-aplica el prefijo del proveedor por si lo borraron al editar.
            prod.code = window.prefixCode(input.value.trim().toUpperCase(), this.currentBrand);
            input.value = prod.code;
        } else {
            prod[field] = input.value.trim().toUpperCase();
        }

        this.markChanged();
    }

    async deleteProduct(idx) {
        if (!(await notify.confirm('¿Eliminar este producto del catálogo?', { danger: true, confirmText: 'Eliminar' }))) return;
        const brand = window.SEED_DATA.brands[this.currentBrand];
        const cat = brand.categories[this.currentCategory];
        cat.products.splice(idx, 1);
        this.markChanged();
        this.renderProfilesTable();
    }

    // ============================================================
    // GLASS TABLE (sub-tabs: Cotización / Venta)
    // ============================================================

    /** Inicializa los sub-tabs de vidrio (solo una vez). */
    initGlassSubTabs() {
        if (this._glassSubTabsReady) return;
        this._glassSubTabsReady = true;

        document.querySelectorAll('.glass-sub-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-glasstab');
                // Toggle active styles
                document.querySelectorAll('.glass-sub-tab').forEach(b => {
                    b.classList.remove('active');
                    b.style.color = 'var(--text-muted)';
                    b.style.borderBottomColor = 'transparent';
                });
                btn.classList.add('active');
                btn.style.color = 'var(--primary)';
                btn.style.borderBottomColor = 'var(--primary)';

                // Show/hide tables
                document.getElementById('catalog-glass-table').style.display = target === 'quotation' ? '' : 'none';
                document.getElementById('catalog-glass-sale-table').style.display = target === 'sale' ? '' : 'none';

                // Render on demand
                if (target === 'sale') this.renderGlassSaleTable();
            });
        });
    }

    renderGlassTable() {
        this.initGlassSubTabs();

        const container = document.getElementById('catalog-glass-table');
        if (!container) return;
        const editable = this.isAdmin;

        let html = `<table class="table" style="font-size: 0.85rem;">
            <thead><tr style="background: var(--primary); color: white;">
                <th style="padding:8px;">Tipo de Vidrio</th>
                <th style="padding:8px; text-align:center;">Peso (kg/m²)</th>
                <th style="padding:8px; text-align:center;">Precio por m² (USD)</th>`;
        if (editable) html += `<th style="padding:8px; text-align:center;"><i class="fa-solid fa-cog"></i></th>`;
        html += `</tr></thead><tbody>`;

        window.SEED_DATA.glass.forEach((g, idx) => {
            html += `<tr>
                <td style="padding:8px;">${editable ? `<input type="text" value="${window.escapeHtml(g.type)}" data-gfield="type" data-gidx="${idx}" class="catalog-glass-input" style="width:180px;">` : window.escapeHtml(g.type)}</td>
                <td style="padding:8px; text-align:center;">${editable ? `<input type="number" step="1" value="${g.weight}" data-gfield="weight" data-gidx="${idx}" class="catalog-glass-input" style="width:70px; text-align:center;">` : g.weight}</td>
                <td style="padding:8px; text-align:center;">${editable ? `<input type="number" step="0.01" value="${g.pricePerM2.toFixed(2)}" data-gfield="pricePerM2" data-gidx="${idx}" class="catalog-glass-input" style="width:80px; text-align:center;">` : '$' + g.pricePerM2.toFixed(2)}</td>`;
            if (editable) {
                html += `<td style="padding:8px; text-align:center;">
                    <button class="btn btn-sm btn-danger" onclick="window.catalogManager.deleteGlass(${idx})"><i class="fa-solid fa-trash"></i></button>
                </td>`;
            }
            html += `</tr>`;
        });

        if (editable) {
            html += `<tr style="background: #f0faf0;">
                <td colspan="${editable ? 4 : 3}" style="padding:8px;">
                    <button class="btn btn-sm btn-outline" onclick="window.catalogManager.addGlass()" style="border-color: var(--success); color: var(--success);">
                        <i class="fa-solid fa-plus"></i> Agregar Vidrio
                    </button>
                </td>
            </tr>`;
        }

        html += `</tbody></table>`;
        container.innerHTML = html;

        if (editable) {
            container.querySelectorAll('.catalog-glass-input').forEach(input => {
                input.addEventListener('change', (e) => this.handleGlassEdit(e));
            });
        }
    }

    handleGlassEdit(e) {
        const input = e.target;
        const idx = parseInt(input.getAttribute('data-gidx'));
        const field = input.getAttribute('data-gfield');
        const glass = window.SEED_DATA.glass[idx];

        if (field === 'type') glass.type = input.value.trim();
        else if (field === 'weight') glass.weight = parseFloat(input.value) || 0;
        else if (field === 'pricePerM2') glass.pricePerM2 = parseFloat(input.value) || 0;

        this.markChanged();
    }

    async deleteGlass(idx) {
        if (!(await notify.confirm('¿Eliminar este tipo de vidrio?', { danger: true, confirmText: 'Eliminar' }))) return;
        window.SEED_DATA.glass.splice(idx, 1);
        this.markChanged();
        this.renderGlassTable();
    }

    addGlass() {
        window.SEED_DATA.glass.push({ type: 'Nuevo Vidrio', weight: 10, pricePerM2: 0 });
        this.markChanged();
        this.renderGlassTable();
    }

    // --- Glass Sale table ---

    renderGlassSaleTable() {
        const container = document.getElementById('catalog-glass-sale-table');
        if (!container) return;
        const editable = this.isAdmin;

        // Garantizar que glassSale exista
        if (!window.SEED_DATA.glassSale) window.SEED_DATA.glassSale = [];

        let html = `<table class="table" style="font-size: 0.85rem;">
            <thead><tr style="background: #0e7c5a; color: white;">
                <th style="padding:8px;">Tipo de Vidrio</th>
                <th style="padding:8px; text-align:center;">Precio por m² (USD)</th>`;
        if (editable) html += `<th style="padding:8px; text-align:center;"><i class="fa-solid fa-cog"></i></th>`;
        html += `</tr></thead><tbody>`;

        window.SEED_DATA.glassSale.forEach((g, idx) => {
            html += `<tr>
                <td style="padding:8px;">${editable ? `<input type="text" value="${window.escapeHtml(g.type)}" data-gsfield="type" data-gsidx="${idx}" class="catalog-glass-sale-input" style="width:180px;">` : window.escapeHtml(g.type)}</td>
                <td style="padding:8px; text-align:center;">${editable ? `<input type="number" step="0.01" value="${g.pricePerM2.toFixed(2)}" data-gsfield="pricePerM2" data-gsidx="${idx}" class="catalog-glass-sale-input" style="width:80px; text-align:center;">` : '$' + g.pricePerM2.toFixed(2)}</td>`;
            if (editable) {
                html += `<td style="padding:8px; text-align:center;">
                    <button class="btn btn-sm btn-danger" onclick="window.catalogManager.deleteGlassSale(${idx})"><i class="fa-solid fa-trash"></i></button>
                </td>`;
            }
            html += `</tr>`;
        });

        if (editable) {
            html += `<tr style="background: #f0faf0;">
                <td colspan="${editable ? 3 : 2}" style="padding:8px;">
                    <button class="btn btn-sm btn-outline" onclick="window.catalogManager.addGlassSale()" style="border-color: var(--success); color: var(--success);">
                        <i class="fa-solid fa-plus"></i> Agregar Vidrio
                    </button>
                </td>
            </tr>`;
        }

        html += `</tbody></table>`;
        container.innerHTML = html;

        if (editable) {
            container.querySelectorAll('.catalog-glass-sale-input').forEach(input => {
                input.addEventListener('change', (e) => this.handleGlassSaleEdit(e));
            });
        }
    }

    handleGlassSaleEdit(e) {
        const input = e.target;
        const idx = parseInt(input.getAttribute('data-gsidx'));
        const field = input.getAttribute('data-gsfield');
        const glass = window.SEED_DATA.glassSale[idx];

        if (field === 'type') glass.type = input.value.trim();
        else if (field === 'pricePerM2') glass.pricePerM2 = parseFloat(input.value) || 0;

        this.markChanged();
    }

    async deleteGlassSale(idx) {
        if (!(await notify.confirm('¿Eliminar este tipo de vidrio de venta?', { danger: true, confirmText: 'Eliminar' }))) return;
        window.SEED_DATA.glassSale.splice(idx, 1);
        this.markChanged();
        this.renderGlassSaleTable();
    }

    addGlassSale() {
        if (!window.SEED_DATA.glassSale) window.SEED_DATA.glassSale = [];
        window.SEED_DATA.glassSale.push({ type: 'Nuevo Vidrio', pricePerM2: 0 });
        this.markChanged();
        this.renderGlassSaleTable();
    }

    // ============================================================
    // ACCESSORIES TABLE
    // ============================================================
    // ============================================================
    // TAB: ROLES GENÉRICOS (matriz rol x proveedor)
    // ============================================================

    /**
     * Todos los roles conocidos: los que ya están asignados a algún producto y
     * los que alguna receta preestablecida menciona. Los segundos importan
     * porque un rol usado en una receta pero sin asignar en ninguna marca es
     * justamente el que hay que completar acá.
     */
    allGenericRoles() {
        const roles = new Set();

        Object.keys(window.SEED_DATA.brands || {}).forEach(bk => {
            const brand = window.SEED_DATA.brands[bk];
            Object.keys(brand.categories || {}).forEach(cat => {
                (brand.categories[cat].products || []).forEach(p => {
                    (p.genericRoles || []).forEach(r => roles.add(r));
                });
            });
        });

        Object.values(window.SEED_DATA.modules || {}).forEach(mod => {
            (mod.profiles || []).forEach(row => {
                if (row.role) roles.add(row.role);
            });
        });

        return Array.from(roles).sort();
    }

    /** Producto de una marca que tiene ese rol (el primero, igual que calculator.js). */
    productWithRole(brandKey, role) {
        const brand = window.SEED_DATA.brands[brandKey];
        if (!brand) return null;
        for (const cat of Object.keys(brand.categories || {})) {
            const hit = (brand.categories[cat].products || []).find(
                p => Array.isArray(p.genericRoles) && p.genericRoles.includes(role)
            );
            if (hit) return { product: hit, category: cat };
        }
        return null;
    }

    /**
     * Asigna (o quita, con code vacío) un rol dentro de una marca. El rol queda
     * en un solo producto por marca: calculator.findProductByRole devuelve el
     * primero que encuentra, así que tenerlo repetido daría un resultado
     * impredecible según el orden del catálogo.
     */
    assignRole(brandKey, role, code) {
        const brand = window.SEED_DATA.brands[brandKey];
        if (!brand) return;

        Object.keys(brand.categories || {}).forEach(cat => {
            (brand.categories[cat].products || []).forEach(p => {
                const has = Array.isArray(p.genericRoles) && p.genericRoles.includes(role);
                if (p.code === code) {
                    if (!has) p.genericRoles = (p.genericRoles || []).concat(role);
                } else if (has) {
                    p.genericRoles = p.genericRoles.filter(r => r !== role);
                }
            });
        });

        // A partir de la primera edición manual, seed.js deja de imponer roles.
        window.SEED_DATA.rolesCustomized = true;
        this.markChanged();
        this.renderRolesTable();
    }

    addRole() {
        const name = (prompt('Nombre del nuevo rol genérico (ej: ventana-corrediza-riel):') || '').trim();
        if (!name) return;

        // Se comparan también los recién creados: todavía no están en ningún
        // producto, así que allGenericRoles() por sí sola no los ve.
        if (this.allGenericRoles().concat(this.pendingRoles || []).includes(name)) {
            notify.warning('Ese rol ya existe.');
            return;
        }
        // El rol nace sin asignar: queda listado como incompleto hasta que se le
        // elija un perfil en cada proveedor.
        this.pendingRoles = (this.pendingRoles || []).concat(name);
        window.SEED_DATA.rolesCustomized = true;
        this.markChanged();
        this.renderRolesTable();
    }

    async deleteRole(role) {
        const usedBy = Object.values(window.SEED_DATA.modules || {})
            .filter(m => (m.profiles || []).some(p => p.role === role))
            .map(m => m.itemName);

        const warn = usedBy.length
            ? `\n\nATENCIÓN: lo usan ${usedBy.length} receta(s) preestablecida(s):\n· ${usedBy.join('\n· ')}\nEsas recetas van a dejar de cotizar ese perfil.`
            : '';

        if (!(await notify.confirm(`¿Quitar el rol "${role}" de todos los proveedores?${warn}`, { danger: true, confirmText: 'Quitar' }))) return;

        Object.keys(window.SEED_DATA.brands || {}).forEach(bk => {
            const brand = window.SEED_DATA.brands[bk];
            Object.keys(brand.categories || {}).forEach(cat => {
                (brand.categories[cat].products || []).forEach(p => {
                    if (Array.isArray(p.genericRoles) && p.genericRoles.includes(role)) {
                        p.genericRoles = p.genericRoles.filter(r => r !== role);
                    }
                });
            });
        });

        this.pendingRoles = (this.pendingRoles || []).filter(r => r !== role);
        window.SEED_DATA.rolesCustomized = true;
        this.markChanged();
        this.renderRolesTable();
    }

    renderRolesTable() {
        const container = document.getElementById('catalog-roles-table');
        if (!container) return;
        const editable = this.isAdmin;

        const brandKeys = Object.keys(window.SEED_DATA.brands || {});
        const roles = Array.from(new Set(this.allGenericRoles().concat(this.pendingRoles || []))).sort();

        const filter = (this.rolesFilter || '').toLowerCase();
        const onlyIncomplete = !!this.rolesOnlyIncomplete;

        // Se resuelve una vez por rol: se reusa para el resumen, el filtro y las celdas.
        const rows = roles.map(role => {
            const assigned = {};
            brandKeys.forEach(bk => { assigned[bk] = this.productWithRole(bk, role); });
            const missing = brandKeys.filter(bk => !assigned[bk]);
            return { role, assigned, missing };
        });

        const incompleteCount = rows.filter(r => r.missing.length).length;
        const summary = document.getElementById('roles-summary');
        if (summary) {
            summary.innerHTML = incompleteCount
                ? `<span style="color:#b45309; font-weight:600;">${incompleteCount} de ${rows.length} rol(es) sin completar en los ${brandKeys.length} proveedores</span>`
                : `<span style="color:#137333; font-weight:600;">Los ${rows.length} roles están asignados en los ${brandKeys.length} proveedores</span>`;
        }

        const visible = rows.filter(r => {
            if (onlyIncomplete && !r.missing.length) return false;
            if (!filter) return true;
            const hay = r.role + ' ' + brandKeys.map(bk =>
                r.assigned[bk] ? r.assigned[bk].product.code + ' ' + r.assigned[bk].product.description : ''
            ).join(' ');
            return hay.toLowerCase().indexOf(filter) !== -1;
        });

        let html = `<table class="table" style="font-size: 0.82rem; min-width: 820px;">
            <thead><tr style="background: var(--primary); color: white;">
                <th style="padding:8px; text-align:left;">Rol genérico</th>`;
        brandKeys.forEach(bk => {
            html += `<th style="padding:8px; text-align:left;">${window.escapeHtml(window.SEED_DATA.brands[bk].name)}</th>`;
        });
        html += `<th style="padding:8px; text-align:center;">Estado</th>`;
        if (editable) html += `<th style="padding:8px; text-align:center;"><i class="fa-solid fa-cog"></i></th>`;
        html += `</tr></thead><tbody>`;

        if (!visible.length) {
            html += `<tr><td colspan="${brandKeys.length + (editable ? 3 : 2)}" style="padding:1rem; text-align:center; color: var(--text-muted);">
                ${roles.length ? 'Ningún rol coincide con el filtro.' : 'Todavía no hay roles genéricos. Agregue uno para empezar.'}
            </td></tr>`;
        }

        visible.forEach(({ role, assigned, missing }) => {
            const ok = !missing.length;
            html += `<tr style="${ok ? '' : 'background:#fffbeb;'}">
                <td style="padding:8px; font-weight:600; color: var(--primary); white-space:nowrap;">${window.escapeHtml(role)}</td>`;

            brandKeys.forEach(bk => {
                const cur = assigned[bk];
                if (editable) {
                    html += `<td style="padding:6px 8px;">
                        <select class="roles-assign" data-brand="${bk}" data-role="${window.escapeHtml(role)}" style="width:100%; min-width:190px; padding:3px; font-size:0.78rem;">
                            <option value="">— sin asignar —</option>`;
                    const brand = window.SEED_DATA.brands[bk];
                    Object.keys(brand.categories || {}).forEach(cat => {
                        html += `<optgroup label="${window.escapeHtml(cat)}">`;
                        (brand.categories[cat].products || []).forEach(p => {
                            const sel = cur && cur.product.code === p.code ? ' selected' : '';
                            html += `<option value="${window.escapeHtml(p.code)}"${sel}>${window.escapeHtml(p.code)} · ${window.escapeHtml(p.description)}</option>`;
                        });
                        html += `</optgroup>`;
                    });
                    html += `</select></td>`;
                } else {
                    html += `<td style="padding:8px;">${cur
                        ? `<strong>${window.escapeHtml(cur.product.code)}</strong><br><span style="color:var(--text-muted); font-size:0.75rem;">${window.escapeHtml(cur.product.description)}</span>`
                        : '<span style="color:#b45309;">— sin asignar —</span>'}</td>`;
                }
            });

            html += `<td style="padding:8px; text-align:center; white-space:nowrap;">${ok
                ? '<span style="color:#137333; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Completo</span>'
                : `<span style="color:#b45309; font-weight:600;" title="Falta en: ${missing.map(m => window.SEED_DATA.brands[m].name).join(', ')}"><i class="fa-solid fa-triangle-exclamation"></i> Falta en ${missing.length}</span>`}</td>`;

            if (editable) {
                html += `<td style="padding:8px; text-align:center;">
                    <button class="btn btn-sm btn-danger" onclick="window.catalogManager.deleteRole('${role.replace(/'/g, "\\'")}')" title="Quitar el rol de todos los proveedores"><i class="fa-solid fa-trash"></i></button>
                </td>`;
            }
            html += `</tr>`;
        });

        if (editable) {
            html += `<tr style="background: #f0faf0;">
                <td colspan="${brandKeys.length + 3}" style="padding:8px;">
                    <button class="btn btn-sm btn-outline" onclick="window.catalogManager.addRole()" style="border-color: var(--success); color: var(--success);">
                        <i class="fa-solid fa-plus"></i> Agregar Rol Genérico
                    </button>
                </td>
            </tr>`;
        }

        html += `</tbody></table>`;
        container.innerHTML = html;

        if (!editable) return;
        container.querySelectorAll('.roles-assign').forEach(sel => {
            sel.addEventListener('change', e => this.assignRole(
                e.target.getAttribute('data-brand'),
                e.target.getAttribute('data-role'),
                e.target.value
            ));
        });
    }

    renderAccessoriesTable() {
        const container = document.getElementById('catalog-accessories-table');
        if (!container) return;
        const editable = this.isAdmin;

        let html = `<table class="table" style="font-size: 0.85rem;">
            <thead><tr style="background: var(--primary); color: white;">
                <th style="padding:8px;">Accesorio</th>
                <th style="padding:8px; text-align:center;">Precio Unitario (USD)</th>`;
        if (editable) html += `<th style="padding:8px; text-align:center;"><i class="fa-solid fa-cog"></i></th>`;
        html += `</tr></thead><tbody>`;

        window.SEED_DATA.accessories.forEach((acc, idx) => {
            html += `<tr>
                <td style="padding:8px;">${editable ? `<input type="text" value="${window.escapeHtml(acc.name)}" data-afield="name" data-aidx="${idx}" class="catalog-acc-input" style="width:220px;">` : window.escapeHtml(acc.name)}</td>
                <td style="padding:8px; text-align:center;">${editable ? `<input type="number" step="0.01" value="${acc.pricePerUnit.toFixed(2)}" data-afield="pricePerUnit" data-aidx="${idx}" class="catalog-acc-input" style="width:80px; text-align:center;">` : '$' + acc.pricePerUnit.toFixed(2)}</td>`;
            if (editable) {
                html += `<td style="padding:8px; text-align:center;">
                    <button class="btn btn-sm btn-danger" onclick="window.catalogManager.deleteAccessory(${idx})"><i class="fa-solid fa-trash"></i></button>
                </td>`;
            }
            html += `</tr>`;
        });

        if (editable) {
            html += `<tr style="background: #f0faf0;">
                <td colspan="3" style="padding:8px;">
                    <button class="btn btn-sm btn-outline" onclick="window.catalogManager.addAccessory()" style="border-color: var(--success); color: var(--success);">
                        <i class="fa-solid fa-plus"></i> Agregar Accesorio
                    </button>
                </td>
            </tr>`;
        }

        html += `</tbody></table>`;
        container.innerHTML = html;

        if (editable) {
            container.querySelectorAll('.catalog-acc-input').forEach(input => {
                input.addEventListener('change', (e) => this.handleAccEdit(e));
            });
        }
    }

    handleAccEdit(e) {
        const input = e.target;
        const idx = parseInt(input.getAttribute('data-aidx'));
        const field = input.getAttribute('data-afield');
        const acc = window.SEED_DATA.accessories[idx];

        if (field === 'name') acc.name = input.value.trim();
        else if (field === 'pricePerUnit') acc.pricePerUnit = parseFloat(input.value) || 0;

        this.markChanged();
    }

    async deleteAccessory(idx) {
        if (!(await notify.confirm('¿Eliminar este accesorio?', { danger: true, confirmText: 'Eliminar' }))) return;
        window.SEED_DATA.accessories.splice(idx, 1);
        this.markChanged();
        this.renderAccessoriesTable();
    }

    addAccessory() {
        window.SEED_DATA.accessories.push({ name: 'Nuevo Accesorio', pricePerUnit: 0, unit: 'und' });
        this.markChanged();
        this.renderAccessoriesTable();
    }

    // ============================================================
    // ADD PRODUCT MODAL
    // ============================================================
    openAddModal() {
        const modal = document.getElementById('modal-add-product');
        modal.style.display = 'flex';

        // Populate modal brand select
        const brandSel = document.getElementById('add-p-brand');
        brandSel.innerHTML = '';
        Object.keys(window.SEED_DATA.brands).forEach(key => {
            brandSel.innerHTML += `<option value="${window.escapeHtml(key)}">${window.escapeHtml(window.SEED_DATA.brands[key].name)}</option>`;
        });
        brandSel.value = this.currentBrand || Object.keys(window.SEED_DATA.brands)[0];
        this.updateModalCategories();
    }

    updateModalCategories() {
        const brandKey = document.getElementById('add-p-brand').value;
        const catSel = document.getElementById('add-p-category');
        const brand = window.SEED_DATA.brands[brandKey];
        catSel.innerHTML = '';
        if (brand) {
            Object.keys(brand.categories).forEach(cat => {
                catSel.innerHTML += `<option value="${window.escapeHtml(cat)}">${window.escapeHtml(cat)}</option>`;
            });
        }

        // Populate price fields for this brand's colors
        const pricesDiv = document.getElementById('add-p-prices');
        pricesDiv.innerHTML = '';
        if (brand) {
            brand.colors.forEach(c => {
                pricesDiv.innerHTML += `
                    <div class="form-group" style="margin-bottom: 0.25rem;">
                        <label style="font-size: 0.8rem;">${c}</label>
                        <input type="number" step="0.01" class="form-control add-price-input" data-color="${c.toLowerCase()}" placeholder="0.00" style="font-size: 0.85rem;">
                    </div>`;
            });
        }
    }

    closeAddModal() {
        document.getElementById('modal-add-product').style.display = 'none';
    }

    confirmAddProduct() {
        const brandKey = document.getElementById('add-p-brand').value;
        const catName = document.getElementById('add-p-category').value;
        const code = document.getElementById('add-p-code').value.trim().toUpperCase();
        const desc = document.getElementById('add-p-desc').value.trim().toUpperCase();
        const unit = 'ml'; // Hardcoded since UI field is removed

        if (!code || !desc) {
            notify.warning('Debe ingresar el código y la descripción del producto.');
            return;
        }

        const prices = {};
        document.querySelectorAll('.add-price-input').forEach(inp => {
            const color = inp.getAttribute('data-color');
            const val = inp.value.trim();
            prices[color] = val === '' ? null : parseFloat(val);
        });

        const brand = window.SEED_DATA.brands[brandKey];
        if (!brand || !brand.categories[catName]) {
            notify.warning('Marca o categoría no válida.');
            return;
        }

        // El código se guarda siempre con el prefijo del proveedor (CED-/FIS-/FEM-),
        // lo escriba o no quien lo carga: así no conviven dos formatos en el catálogo.
        const finalCode = window.prefixCode(code, brandKey);

        const dup = brand.categories[catName].products.some(p => p.code === finalCode);
        if (dup) {
            notify.warning(`Ya existe un producto con el código ${finalCode} en esta categoría.`);
            return;
        }

        brand.categories[catName].products.push({ code: finalCode, description: desc, unit, prices });
        this.markChanged();

        // Update view if we're looking at the same brand/category
        if (this.currentBrand === brandKey && this.currentCategory === catName) {
            this.renderProfilesTable();
        }

        this.closeAddModal();
        // Clear form
        document.getElementById('add-p-code').value = '';
        document.getElementById('add-p-desc').value = '';

        notify.success('Producto agregado exitosamente.');
    }

    // ============================================================
    // PERSISTENCE
    // ============================================================
    markChanged() {
        this.hasChanges = true;
        const saveBtn = document.getElementById('btn-catalog-save');
        if (saveBtn) {
            saveBtn.style.display = 'inline-flex';
            saveBtn.classList.add('btn-pulse');
        }
    }

    async saveChanges() {
        const saveBtn = document.getElementById('btn-catalog-save');
        // Show loading state
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
        }
        try {
            await this.persistData();
            this.hasChanges = false;
            if (saveBtn) {
                saveBtn.style.display = 'none';
                saveBtn.classList.remove('btn-pulse');
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
            }
            // Update the quotation form dropdowns if they exist
            if (window.quotationManager) {
                window.quotationManager.populateDropdowns();
            }
            notify.success('Catálogo actualizado y guardado correctamente en la base de datos. Los cambios se reflejarán en las nuevas cotizaciones.');
        } catch (e) {
            console.error('Error saving catalog:', e);
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
            }
            notify.error('Error al guardar en la base de datos. Los cambios se guardaron localmente.');
        }
    }

}

/** Prefijo de código por proveedor: el código pasa a ser único entre marcas. */
const BRAND_CODE_PREFIX = { cedal: 'CED-', fisa: 'FIS-', femec: 'FEM-' };
window.BRAND_CODE_PREFIX = BRAND_CODE_PREFIX;

/** true si el código ya arranca con el prefijo de alguna marca conocida. */
function hasBrandPrefix(code) {
    return typeof code === 'string' &&
        Object.values(BRAND_CODE_PREFIX).some(p => code.indexOf(p) === 0);
}

/** Devuelve el código con el prefijo de su marca; si ya lo tiene, lo deja igual. */
function prefixCode(code, brandKey) {
    const p = BRAND_CODE_PREFIX[brandKey];
    if (!p || !code || hasBrandPrefix(code)) return code;
    return p + code;
}
window.prefixCode = prefixCode;

/**
 * Migra los códigos del catálogo guardado al formato con prefijo de proveedor
 * (CED-/FIS-/FEM-), y reapunta los códigos que las recetas de módulos guardan.
 *
 * Por qué hace falta: igual que applyGenericRolePatches, el catálogo real no sale
 * de data/seed.js sino de Firestore/localStorage, que lo sobreescribe entero al
 * cargar. Renombrar los códigos solo en seed.js no tendría ningún efecto: el
 * catálogo guardado seguiría con los códigos viejos y los pisaría en cada carga.
 *
 * Es idempotente: si el código ya tiene prefijo no lo vuelve a agregar, así que
 * puede correr en cada carga sin acumular "CED-CED-".
 *
 * Corre ANTES de applyGenericRolePatches, porque ese parche busca por código
 * exacto y las claves de window.GENERIC_ROLE_PATCHES ya vienen prefijadas.
 *
 * @returns {boolean} true si modificó algo (para saber si conviene volver a guardar).
 */
function applyCodePrefixes() {
    if (!window.SEED_DATA || !window.SEED_DATA.brands) return false;

    let changed = false;

    // 1) Catálogo: los productos de cada marca.
    Object.keys(window.SEED_DATA.brands).forEach(brandKey => {
        const brand = window.SEED_DATA.brands[brandKey];
        if (!brand || !BRAND_CODE_PREFIX[brandKey]) return;
        Object.keys(brand.categories || {}).forEach(catName => {
            (brand.categories[catName].products || []).forEach(p => {
                const next = prefixCode(p.code, brandKey);
                if (next !== p.code) {
                    p.code = next;
                    changed = true;
                }
            });
        });
    });

    // 2) Recetas de módulos: los perfiles guardan el código del producto. Cada
    //    fila puede traer su propia marca (módulos multi-proveedor); si no la
    //    trae, se usa la de la receta.
    const modules = window.SEED_DATA.modules || {};
    Object.keys(modules).forEach(itemId => {
        const mod = modules[itemId];
        if (!mod || !Array.isArray(mod.profiles)) return;
        mod.profiles.forEach(row => {
            const brandKey = row.brand || mod.brand;
            const next = prefixCode(row.code, brandKey);
            if (next !== row.code) {
                row.code = next;
                changed = true;
            }
        });
    });

    return changed;
}
window.applyCodePrefixes = applyCodePrefixes;

/**
 * Reaplica los `genericRoles` de window.GENERIC_ROLE_PATCHES (armado en data/seed.js)
 * sobre los productos ya cargados desde Firestore/localStorage, buscando por código
 * exacto dentro de cada marca. No toca precios ni descripciones.
 *
 * Por qué hace falta: el catálogo real no sale de data/seed.js — sale de Firestore
 * (con localStorage como caché), que sobreescribe window.SEED_DATA.brands entero al
 * cargar. Si ese catálogo guardado es de antes de que un producto tuviera
 * `genericRoles` (ej. los de la Ventana Fija 1100), la etiqueta se pierde aunque
 * seed.js la tenga. Esta función la vuelve a poner cada vez que se carga el catálogo.
 *
 * @returns {boolean} true si modificó algo (para saber si conviene volver a guardar).
 */
function applyGenericRolePatches() {
    const patches = window.GENERIC_ROLE_PATCHES;
    if (!patches || !window.SEED_DATA || !window.SEED_DATA.brands) return false;

    // Si los roles ya se administran a mano desde Catálogo → Roles Genéricos, este
    // parche deja de correr: si no, cada recarga volvería a imponer los roles de
    // data/seed.js y desharía lo que se haya editado (o vuelto a quitar) ahí.
    if (window.SEED_DATA.rolesCustomized) return false;

    let changed = false;
    Object.keys(patches).forEach(brandKey => {
        const brand = window.SEED_DATA.brands[brandKey];
        if (!brand) return;
        const codeMap = patches[brandKey];
        Object.keys(brand.categories || {}).forEach(catName => {
            (brand.categories[catName].products || []).forEach(p => {
                const roles = codeMap[p.code];
                if (!roles) return;
                if (JSON.stringify(p.genericRoles || []) !== JSON.stringify(roles)) {
                    p.genericRoles = roles.slice();
                    changed = true;
                }
            });
        });
    });
    return changed;
}
window.applyGenericRolePatches = applyGenericRolePatches;

// Load persisted data from localStorage immediately (sync) so other managers
// see updated SEED_DATA before async Firestore load completes.
(function loadPersistedCatalogSync() {
    const saved = localStorage.getItem('casalum_catalog_data');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.brands) window.SEED_DATA.brands = parsed.brands;
            if (parsed.glass) window.SEED_DATA.glass = parsed.glass;
            if (parsed.glassSale) window.SEED_DATA.glassSale = parsed.glassSale;
            if (parsed.accessories) window.SEED_DATA.accessories = parsed.accessories;
            if (parsed.modules) window.SEED_DATA.modules = parsed.modules;
            window.SEED_DATA.rolesCustomized = !!parsed.rolesCustomized;
            applyCodePrefixes();
            applyGenericRolePatches();
        } catch (e) {
            console.error('Error loading catalog from localStorage:', e);
        }
    }
})();

// Load from Firestore once a user is actually authenticated (Firestore rules
// require request.auth != null, so calling this before login would fail).
async function loadCatalogFromFirestore() {
    try {
        if (!window.dbManager || !window.dbManager.db) return;
        const doc = await window.dbManager.db.collection('catalog').doc('data').get();
        if (doc.exists) {
            const parsed = doc.data();
            if (parsed.brands) window.SEED_DATA.brands = parsed.brands;
            if (parsed.glass) window.SEED_DATA.glass = parsed.glass;
            if (parsed.glassSale) window.SEED_DATA.glassSale = parsed.glassSale;
            if (parsed.accessories) window.SEED_DATA.accessories = parsed.accessories;
            if (parsed.modules) window.SEED_DATA.modules = parsed.modules;
            window.SEED_DATA.rolesCustomized = !!parsed.rolesCustomized;
            // Familias renombradas: reapunta los módulos guardados a sus ids nuevos.
            if (window.migrateModuleIds) window.migrateModuleIds(window.SEED_DATA.modules);
            // parsed.brands ES window.SEED_DATA.brands (misma referencia), así que esto
            // también deja el parche aplicado en lo que se guarda abajo en localStorage.
            // El prefijo de códigos va primero: applyGenericRolePatches busca por código
            // exacto y sus claves ya vienen con prefijo desde data/seed.js.
            const prefixed = applyCodePrefixes();
            const patched = applyGenericRolePatches() || prefixed;
            guardarCacheLocal('casalum_catalog_data', JSON.stringify(parsed));

            // Si el parche cambió algo y quien está logueado es admin, se guarda una
            // sola vez en Firestore para que quede fijo y no dependa de que alguien
            // entre a Catálogo y presione "Guardar Cambios".
            const isAdmin = window.authManager && window.authManager.currentUser && window.authManager.currentUser.role === 'admin';
            if (patched && isAdmin && window.catalogManager) {
                window.catalogManager.persistData().catch(e => {
                    console.warn('No se pudo fijar el parche de roles genéricos en Firestore:', e);
                });
            }

            // Re-render if catalogManager is already initialized
            if (window.catalogManager) {
                window.catalogManager.populateBrandSelect();
                window.catalogManager.renderCurrentTab();
            }
            // Los módulos preestablecidos alimentan el catálogo y el formulario de cotización
            if (window.moduleManager) {
                window.moduleManager.populateItemSelect();
            }
            if (window.quotationManager) {
                window.quotationManager.syncModuleFromSystem();
            }
        }
    } catch (e) {
        console.warn('Async Firestore catalog load failed:', e);
    }
}

(async function registerCatalogFirestoreLoad() {
    for (let i = 0; i < 20; i++) {
        if (window.authManager) break;
        await new Promise(r => setTimeout(r, 200));
    }
    if (window.authManager) {
        window.authManager.onAuthReady(loadCatalogFromFirestore);
    }
})();

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        window.catalogManager = new CatalogManager();
        window.catalogManager.init();
    }, 200);
});
