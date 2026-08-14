/**
 * Catalog Manager — Full CRUD for SEED_DATA
 * Editable only by admin users.
 * Persists changes to Firestore (primary) and localStorage (cache).
 */
class CatalogManager {
    constructor() {
        this.isAdmin = false;
        this.hasChanges = false;
        this.currentBrand = '';
        this.currentCategory = '';
        this.currentTab = 'profiles';
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
                    localStorage.setItem('casalum_catalog_data', JSON.stringify(parsed));
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
            modules: window.SEED_DATA.modules || {}
        };
        // Save to localStorage as cache
        localStorage.setItem('casalum_catalog_data', JSON.stringify(toSave));
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
            sel.innerHTML += `<option value="${key}">${window.SEED_DATA.brands[key].name}</option>`;
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
            sel.innerHTML += `<option value="${cat}">${cat}</option>`;
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
                <td style="padding:6px 8px; font-weight:600; color: var(--primary);">${editable ? `<input type="text" value="${prod.code}" data-field="code" data-idx="${idx}" class="catalog-edit-input" style="width:75px;">` : prod.code}</td>
                <td style="padding:6px 8px;">${editable ? `<input type="text" value="${prod.description}" data-field="desc" data-idx="${idx}" class="catalog-edit-input" style="width:200px;">` : prod.description}</td>`;
                
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
        } else {
            prod[field] = input.value.trim().toUpperCase();
        }

        this.markChanged();
    }

    deleteProduct(idx) {
        if (!confirm('¿Eliminar este producto del catálogo?')) return;
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
                <td style="padding:8px;">${editable ? `<input type="text" value="${g.type}" data-gfield="type" data-gidx="${idx}" class="catalog-glass-input" style="width:180px;">` : g.type}</td>
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

    deleteGlass(idx) {
        if (!confirm('¿Eliminar este tipo de vidrio?')) return;
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
                <td style="padding:8px;">${editable ? `<input type="text" value="${g.type}" data-gsfield="type" data-gsidx="${idx}" class="catalog-glass-sale-input" style="width:180px;">` : g.type}</td>
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

    deleteGlassSale(idx) {
        if (!confirm('¿Eliminar este tipo de vidrio de venta?')) return;
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
                <td style="padding:8px;">${editable ? `<input type="text" value="${acc.name}" data-afield="name" data-aidx="${idx}" class="catalog-acc-input" style="width:220px;">` : acc.name}</td>
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

    deleteAccessory(idx) {
        if (!confirm('¿Eliminar este accesorio?')) return;
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
            brandSel.innerHTML += `<option value="${key}">${window.SEED_DATA.brands[key].name}</option>`;
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
                catSel.innerHTML += `<option value="${cat}">${cat}</option>`;
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
            alert('Debe ingresar el código y la descripción del producto.');
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
            alert('Marca o categoría no válida.');
            return;
        }

        brand.categories[catName].products.push({ code, description: desc, unit, prices });
        this.markChanged();

        // Update view if we're looking at the same brand/category
        if (this.currentBrand === brandKey && this.currentCategory === catName) {
            this.renderProfilesTable();
        }

        this.closeAddModal();
        // Clear form
        document.getElementById('add-p-code').value = '';
        document.getElementById('add-p-desc').value = '';

        alert('Producto agregado exitosamente.');
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
            alert('Catálogo actualizado y guardado correctamente en la base de datos. Los cambios se reflejarán en las nuevas cotizaciones.');
        } catch (e) {
            console.error('Error saving catalog:', e);
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios';
            }
            alert('Error al guardar en la base de datos. Los cambios se guardaron localmente.');
        }
    }

}

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
            // Familias renombradas: reapunta los módulos guardados a sus ids nuevos.
            if (window.migrateModuleIds) window.migrateModuleIds(window.SEED_DATA.modules);
            // parsed.brands ES window.SEED_DATA.brands (misma referencia), así que esto
            // también deja el parche aplicado en lo que se guarda abajo en localStorage.
            const patched = applyGenericRolePatches();
            localStorage.setItem('casalum_catalog_data', JSON.stringify(parsed));

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
