/**
 * Quotation Calculator Engine
 */
class Calculator {
    constructor() {
        this.settings = window.SEED_DATA.defaultSettings;
    }

    // Update settings based on user input for a specific quotation
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    /**
     * Calculates the price of a single profile or glass item
     * @param {Object} item - Product from SEED_DATA
     * @param {string} color - The selected color (natural, negro, etc)
     * @param {number} quantity - Quantity of unit
     */
    calculateItemCost(item, color, quantity) {
        // Base cost
        let unitPrice = 0;
        
        if (item.prices) { // It's an aluminum profile
            const colorKey = color.toLowerCase();
            unitPrice = item.prices[colorKey];
            if (unitPrice === null || unitPrice === undefined) {
                console.warn(`Item ${item.code} has no price for color ${color}`);
                return 0; // Invalid color for this item
            }
        } else if (item.pricePerM2) { // It's glass
            unitPrice = item.pricePerM2;
        } else if (item.pricePerUnit) { // It's an accessory
            unitPrice = item.pricePerUnit;
        }

        const rawCost = unitPrice * quantity;
        
        return rawCost;
    }

    /**
     * Resuelve la cantidad de un perfil dentro de un módulo preestablecido.
     * `row` viene de SEED_DATA.modules[itemId].profiles (ver js/modules.js):
     *   - mode 'fijo'    -> cantidad fija, independiente de las medidas
     *   - mode 'formula' -> base (ancho/alto/perímetro/área/...) x factor
     */
    resolveModuleQty(row, ctx) {
        if (!row) return 0;

        // Legacy compatibility
        if (row.mode) {
            if (row.mode === 'fijo') {
                const fixed = parseFloat(row.fixedQty);
                return Number.isNaN(fixed) || fixed < 0 ? 0 : fixed;
            }
            const modules = ctx.modules && ctx.modules > 0 ? ctx.modules : 1;
            const bases = {
                width: ctx.width, height: ctx.height, perimeter: ctx.perimeter,
                area: ctx.area, width_modules: ctx.width * modules,
                height_modules: ctx.height * modules, unit: 1
            };
            const base = bases[row.base];
            const factor = parseFloat(row.factor);
            if (base === undefined || Number.isNaN(factor) || factor < 0) return 0;
            return base * factor;
        }

        // New formula system
        if (row.formula === 'fijo') {
            const fixed = parseFloat(row.fixedQty);
            return Number.isNaN(fixed) || fixed < 0 ? 0 : fixed;
        }

        let calculatedLength = 0;
        const formula = row.formula;

        if (formula === 'width_1') calculatedLength = ctx.width;
        else if (formula === 'width_2') calculatedLength = ctx.width * 2;
        else if (formula === 'width_4') calculatedLength = ctx.width * 4;
        else if (formula === 'height_1') calculatedLength = ctx.height;
        else if (formula === 'height_2') calculatedLength = ctx.height * 2;
        else if (formula === 'height_4') calculatedLength = ctx.height * 4;
        else if (formula === 'perimeter') calculatedLength = ctx.perimeter;
        
        return calculatedLength;
    }

    /** Etiqueta de unidad para el desglose (m / m² / und). */
    moduleQtyUnit(row) {
        if (!row) return 'und';
        if (row.formula === 'fijo' || row.mode === 'fijo') return 'und';
        if (row.base === 'area') return 'm2';
        if (row.base === 'unit') return 'und';
        return 'm';
    }

    /**
     * Busca un perfil dentro de una marca: primero en su categoría de origen,
     * y si no está (categoría renombrada), en el resto del catálogo de la marca.
     */
    findProductInBrand(brandData, code, category) {
        if (category && brandData.categories[category]) {
            const hit = brandData.categories[category].products.find(p => p.code === code);
            if (hit) return hit;
        }
        for (const cat of Object.keys(brandData.categories)) {
            const hit = brandData.categories[cat].products.find(p => p.code === code);
            if (hit) return hit;
        }
        return null;
    }

    /**
     * Estimates the cost of a complete window based on generic dimensions
     * For a real system, this would break down exactly how much of each profile is needed.
     * For this basic demo, we will calculate a rough estimated cost by summing the basic components.
     * @param {Object} params - width, height, brand, system, color, glassType, glassArea, accessories, labor, moduleProfiles
     */
    calculateWindowCost(params) {
        const { width, height, brand, system, color, glassType, glassArea, accessories = [], labor = {}, moduleProfiles = null } = params;

        // Find brand and system
        const brandData = window.SEED_DATA.brands[brand.toLowerCase()];
        if (!brandData) return { total: 0, details: [] };

        const usingModule = Array.isArray(moduleProfiles) && moduleProfiles.length > 0;

        // Perimeter (ml)
        const perimeter = (width + height) * 2;

        // Area (m2)
        const area = width * height;

        let totalCost = 0;
        let details = [];

        if (usingModule) {
            const ctx = { width, height, perimeter, area, modules: params.modules };
            moduleProfiles.forEach(row => {
                const prod = this.findProductInBrand(brandData, row.code, row.category);
                if (!prod) {
                    console.warn(`Módulo: el perfil ${row.code} ya no existe en la base de ${brand}`);
                    return;
                }
                const qty = this.resolveModuleQty(row, ctx);
                if (qty <= 0) return;

                const unitPrice = this.calculateItemCost(prod, color, 1);
                const cost = unitPrice * qty;
                if (cost > 0) {
                    totalCost += cost;
                    details.push({
                        code: prod.code,
                        desc: prod.description,
                        unitPrice: unitPrice,
                        qty: qty,
                        qtyString: qty.toFixed(2) + ' ' + this.moduleQtyUnit(row),
                        total: cost
                    });
                }
            });
        } else {
            // Sin módulo: `system` es la familia del catálogo (VENTANA FIJA 1100, ...),
            // no una categoría del proveedor, así que se recorre toda la marca y se
            // cobran los perfiles marcados como requeridos en la base de datos.
            const allProducts = [];
            Object.keys(brandData.categories).forEach(cat => {
                brandData.categories[cat].products.forEach(p => allProducts.push(p));
            });

            allProducts.forEach(prod => {
                if (!prod.isRequired) return; // Only process items explicitly marked as required by admin

                let calculatedLength = 0;
                const formula = prod.formula;

                if (formula === 'width_1') calculatedLength = width;
                else if (formula === 'width_2') calculatedLength = width * 2;
                else if (formula === 'width_4') calculatedLength = width * 4;
                else if (formula === 'height_1') calculatedLength = height;
                else if (formula === 'height_2') calculatedLength = height * 2;
                else if (formula === 'height_4') calculatedLength = height * 4;
                else if (formula === 'perimeter') calculatedLength = perimeter;
                else if (formula === 'unit_1') calculatedLength = 1;

                if (calculatedLength > 0) {
                    const unitPrice = this.calculateItemCost(prod, color, 1);
                    const cost = unitPrice * calculatedLength;
                    if (cost > 0) {
                        totalCost += cost;
                        details.push({
                            code: prod.code,
                            desc: prod.description,
                            unitPrice: unitPrice,
                            qty: calculatedLength,
                            qtyString: calculatedLength.toFixed(2) + ' m',
                            total: cost
                        });
                    }
                }
            });
        }

        // Add Glass
        if (glassType) {
            const glass = window.SEED_DATA.glass.find(g => g.type === glassType);
            if (glass) {
                const finalGlassArea = glassArea || area;
                const glassUnitPrice = this.calculateItemCost(glass, null, 1);
                const glassCost = glassUnitPrice * finalGlassArea;
                totalCost += glassCost;
                details.push({ code: 'VID', desc: glass.type, unitPrice: glassUnitPrice, qty: finalGlassArea, qtyString: finalGlassArea.toFixed(2) + ' m2', total: glassCost });
            }
        }

        // Add Accessories
        accessories.forEach(acc => {
            const cost = acc.price * acc.qty;
            totalCost += cost;
            details.push({ code: 'ACC', desc: acc.name, unitPrice: acc.price, qty: acc.qty, qtyString: acc.qty + ' und', total: cost });
        });

        // Add Labor — el costo por hora es único y viene de Ajustes de la Empresa,
        // nunca del formulario (ver settingsManager); horas = horas totales del trabajo.
        const n = v => (typeof v === 'number' && !Number.isNaN(v)) ? v : 0;
        const laborCostPerHour = n(this.settings && this.settings.laborCostPerHour);
        const laborCostRaw = (n(labor.workers) * n(labor.hours) * laborCostPerHour) + n(labor.transport) + n(labor.viaticos);
        if (laborCostRaw > 0) {
            totalCost += laborCostRaw;
            details.push({ code: 'MOB', desc: 'Mano de Obra y Transporte', unitPrice: laborCostRaw, qty: 1, qtyString: 'Global', total: laborCostRaw });
        }

        return {
            total: totalCost,
            details: details,
            dimensions: `${width}x${height}m`,
            description: `Ventana ${brand} ${system} (${color}) - Vidrio ${glassType}`
        };
    }

    /**
     * Aplica gastos generales + utilidad (en cascada) sobre un costo crudo.
     * Se llama UNA VEZ POR ÍTEM al agregarlo al carrito (quotations.js#addItemToCart),
     * no sobre el subtotal agregado de la cotización — cada ítem lleva su propio margen.
     */
    applyMargins(rawCost, settings) {
        const s = settings || this.settings;
        const gastosPct = parseFloat(s.gastosGenerales || 0.14);
        const utilidadPct = parseFloat(s.utilidad || 0.30);

        const gastosValor = rawCost * gastosPct;
        const baseUtilidad = rawCost + gastosValor;
        const utilidadValor = baseUtilidad * utilidadPct;
        const finalPrice = rawCost + gastosValor + utilidadValor;

        return { rawCost, gastosPct, gastosValor, utilidadPct, utilidadValor, finalPrice };
    }

    /**
     * Suma los totales ya calculados (con margen) de cada ítem del carrito.
     * items[].total / gastosValor / utilidadValor ya incluyen el margen aplicado
     * en el momento en que se agregó el ítem (ver applyMargins), no se recalculan acá.
     */
    calculateTotalQuotation(items, settings) {
        const s = settings || this.settings;
        const gastosPct = parseFloat(s.gastosGenerales || 0.14);
        const utilidadPct = parseFloat(s.utilidad || 0.30);
        const ivaPct = 0; // IVA fijo en 0%, no configurable

        const subtotalRaw = items.reduce((sum, item) => sum + (item.rawTotal ?? item.total), 0);
        const gastosValor = items.reduce((sum, item) => sum + (item.gastosValor || 0), 0);
        const utilidadValor = items.reduce((sum, item) => sum + (item.utilidadValor || 0), 0);
        const subtotalFinal = items.reduce((sum, item) => sum + item.total, 0); // ya con margen

        const ivaValor = subtotalFinal * ivaPct;
        const total = subtotalFinal + ivaValor;

        return {
            subtotalRaw: subtotalRaw,
            gastosPct: gastosPct,
            gastosValor: gastosValor,
            utilidadPct: utilidadPct,
            utilidadValor: utilidadValor,
            ivaPct: ivaPct,
            ivaValor: ivaValor,
            subtotalFinal: subtotalFinal,
            total: total
        };
    }
}

window.calculator = new Calculator();
