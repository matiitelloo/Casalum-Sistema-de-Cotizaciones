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
    /**
     * Que color de la lista de precios de ESE producto corresponde al color
     * pedido. Hace falta porque el tubo sale siempre de Fisa (ver
     * resolveModuleProduct) y las marcas no llaman igual a los colores: lo que
     * en Cedal es "madera" o "nogal", en Fisa es "maderado".
     * Devuelve null si ese producto no se hace en ese color.
     */
    colorDisponible(item, color) {
        const clave = String(color || '').toLowerCase();
        if (!item || !item.prices) return null;
        if (item.prices[clave] !== null && item.prices[clave] !== undefined) return clave;

        const equivalencias = {
            madera: 'maderado', nogal: 'maderado', roble: 'maderado',
            maderado: 'madera', champang: 'champagne', champagne: 'champang'
        };
        const alt = equivalencias[clave];
        if (alt && item.prices[alt] !== null && item.prices[alt] !== undefined) return alt;
        return null;
    }

    calculateItemCost(item, color, quantity) {
        // Base cost
        let unitPrice = 0;
        
        if (item.prices) { // It's an aluminum profile
            const colorKey = this.colorDisponible(item, color);
            unitPrice = colorKey === null ? undefined : item.prices[colorKey];
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
     *   - formula 'lineal' -> ver resolveLinear() más abajo
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

        if (row.formula === 'lineal') {
            return this.resolveLinear(row, ctx);
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

    /**
     * Fórmula lineal general: un solo mecanismo que cubre TODOS los patrones
     * reales encontrados al analizar los Excel de fabricación de Casalum
     * (Ventana Fija 1100/Proyectable/Tubo, Cielo Razo, Cubierta, etc.):
     *
     *   cantidad = coefBase        x Base
     *            + coefAltura      x Altura
     *            + coefBaseMod     x Base   x Módulos
     *            + coefAlturaMod   x Altura x Módulos
     *            + coefArea        x (Base x Altura)
     *            + coefModulos     x Módulos            (sin medida: piezas sueltas)
     *            + coefBaseHoja    x AnchoHoja x Hojas  (medida de la hoja que abre)
     *            + coefAlturaHoja  x AltoHoja  x Hojas
     *            + coefBaseDivMod  x (Base / Módulos)   (ancho de UNA hoja)
     *            + fixedQty                              (constante K)
     *
     * `coefBaseDivMod` es para las puertas colgantes y acordeón: el ángulo en
     * T, el hierro y el felpero se miden sobre el ancho de una hoja sola, que
     * es la base repartida entre los módulos. Con 1 módulo equivale a la base
     * entera, así que la misma receta sirve para todas las cantidades.
     *
     * Los términos de "hoja" son para las ventanas proyectables: el perimetral
     * de hoja no se mide sobre la ventana entera sino sobre la hoja que abre,
     * que tiene su propio tamaño (en el Excel, la columna F aparte de la E), y
     * se cobra una vez por cada hoja. Si no se cargan medidas de hoja, se usan
     * las de la ventana.
     *
     * Con esto, sin casos especiales, salen todos los patrones vistos:
     *   - Fijo (tornillos, silicón):        fixedQty=K, resto 0
     *   - Base x2 (horizontal):             coefBase=2
     *   - Altura x2 x Módulos (vertical):   coefAlturaMod=2
     *   - Compuesta (pisa vidrio = horiz.+vert.): coefBase=2 + coefAlturaMod=2 a la vez
     *   - (Módulos-1) (mullón):             coefAltura=-1, coefAlturaMod=+1
     *     -> Altura x Módulos - Altura = Altura x (Módulos-1)
     *   - Marco que crece con módulos pero no borra el fijo (perfil en tubo):
     *     coefBase=2, coefAltura=1, coefAlturaMod=1  -> Base x2 + Altura x(Módulos+1)
     *   - Piezas sueltas por módulo (anclas de la ventana en tubo):
     *     coefModulos=2, fixedQty=2                  -> 2 x Módulos + 2
     *
     * El resultado nunca es negativo (se pisa en 0) porque una cantidad de
     * material no puede ser negativa aunque la combinación de coeficientes
     * lo permita matemáticamente para medidas fuera de rango.
     */
    resolveLinear(row, ctx) {
        if (!row) return 0;
        const modules = ctx.modules && ctx.modules > 0 ? ctx.modules : 1;
        const leaves = ctx.leaves && ctx.leaves > 0 ? ctx.leaves : 1;
        // Sin medidas de hoja cargadas, la hoja se asume del tamaño de la ventana.
        const sashW = ctx.sashWidth && ctx.sashWidth > 0 ? ctx.sashWidth : ctx.width;
        const sashH = ctx.sashHeight && ctx.sashHeight > 0 ? ctx.sashHeight : ctx.height;
        const num = (key) => {
            const v = parseFloat(row[key]);
            return Number.isNaN(v) ? 0 : v;
        };
        const qty = num('coefBase') * ctx.width
            + num('coefAltura') * ctx.height
            + num('coefBaseMod') * ctx.width * modules
            + num('coefAlturaMod') * ctx.height * modules
            + num('coefArea') * ctx.area
            + num('coefModulos') * modules
            + num('coefBaseHoja') * sashW * leaves
            + num('coefAlturaHoja') * sashH * leaves
            + num('coefBaseDivMod') * (ctx.width / modules)
            + num('fixedQty');
        return qty < 0 ? 0 : qty;
    }

    /**
     * Cantidad de un accesorio de módulo: si tiene `qtyFormula` (mismos
     * coeficientes que resolveLinear, ej. Vinil = Base×2 + Altura×2×Módulos,
     * igual que el junquillo que retiene) se calcula en vivo; si no, se usa
     * el número fijo cargado a mano (como siempre).
     */
    resolveAccessoryQty(acc, ctx) {
        if (!acc) return 0;
        if (acc.qtyFormula) return this.resolveLinear(acc.qtyFormula, ctx);
        const v = parseFloat(acc.qty);
        return Number.isNaN(v) || v < 0 ? 0 : v;
    }

    /**
     * Horas de mano de obra de un módulo: si tiene `hoursFormula` (coefModulos
     * x Módulos + base) se calcula en vivo según los módulos reales del
     * formulario; si no, se usa el número fijo cargado a mano (como siempre).
     */
    resolveLaborHours(labor, modules) {
        if (!labor) return 0;
        if (labor.hoursFormula) {
            const n = modules && modules > 0 ? modules : 1;
            const coefModulos = parseFloat(labor.hoursFormula.coefModulos) || 0;
            const base = parseFloat(labor.hoursFormula.base) || 0;
            const hours = coefModulos * n + base;
            return hours < 0 ? 0 : hours;
        }
        const v = parseFloat(labor.hours);
        return Number.isNaN(v) || v < 0 ? 0 : v;
    }

    /** Etiqueta de unidad para el desglose (m / m² / und). */
    moduleQtyUnit(row) {
        if (!row) return 'und';
        if (row.formula === 'fijo' || row.mode === 'fijo') return 'und';
        if (row.base === 'area') return 'm2';
        if (row.base === 'unit') return 'und';
        if (row.formula === 'lineal') {
            const num = (key) => { const v = parseFloat(row[key]); return Number.isNaN(v) ? 0 : v; };
            const onlyArea = num('coefArea') !== 0 && !num('coefBase') && !num('coefAltura') && !num('coefBaseMod') && !num('coefAlturaMod');
            if (onlyArea) return 'm2';
            const onlyFixed = !num('coefBase') && !num('coefAltura') && !num('coefBaseMod') && !num('coefAlturaMod') && !num('coefArea');
            if (onlyFixed) return 'und';
            return 'm';
        }
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
     * Busca, dentro de todas las categorías de una marca, el producto marcado
     * con ese rol genérico (`p.genericRoles` en data/seed.js). Es lo que
     * permite guardar una receta UNA sola vez y que sirva para Cedal, Fisa y
     * Femec: cada marca etiqueta su propio código con el mismo rol funcional.
     */
    findProductByRole(brandData, role) {
        if (!brandData || !role) return null;
        for (const cat of Object.keys(brandData.categories)) {
            const hit = brandData.categories[cat].products.find(
                p => Array.isArray(p.genericRoles) && p.genericRoles.includes(role)
            );
            if (hit) return hit;
        }
        return null;
    }

    /**
     * El tubo lo compra Casalum siempre a Fisa, sea cual sea el proveedor del
     * resto del aluminio (lo pidió el usuario el 20/08/2026). Así que una fila
     * de tubo no se resuelve contra la marca elegida sino siempre contra Fisa.
     */
    static get ROLES_TUBO() {
        // Solo el tubo en si. Ojo: los junquillos de una ventana en tubo se
        // llaman `ventana-tubo-junquillo-espalda`, o sea que tambien dicen
        // "tubo" en el rol, y cambiarlos por un tubo seria un desastre.
        return [/^ventana-tubo-marco$/i, /^batiente-tubo-\d+\s*x\s*\d+$/i];
    }

    esFilaDeTubo(row) {
        const rol = (row && row.role) || '';
        return Calculator.ROLES_TUBO.some(re => re.test(rol));
    }

    /**
     * Una fila de tubo que NO dice la medida en el rol (`ventana-tubo-marco`)
     * la define quien cotiza, con el desplegable "Tubo" del formulario: la
     * misma ventana fija se hace en 4x4, 5x4 o 7x4 y el precio cambia hasta un
     * 77%. Las que sí la dicen (`batiente-tubo-7x4`) ya vienen resueltas por la
     * receta y no se tocan.
     */
    filaDeTuboSinMedida(row) {
        return this.esFilaDeTubo(row) && !/\d\s*x\s*\d/i.test(row.role);
    }

    rolDeTubo(medida) { return 'batiente-tubo-' + String(medida || '').toLowerCase(); }

    /**
     * Resuelve el producto real de una fila de módulo para la marca elegida al
     * cotizar. Si la fila tiene `role` (rol genérico) se busca por rol en esa
     * marca -> multi-proveedor automático. Si no tiene rol, se usa el
     * código+categoría guardados en la fila (comportamiento de siempre,
     * limitado a la marca con la que se armó la receta).
     *
     * `medidaTubo` (opcional) es la medida elegida en el formulario: solo se
     * usa en las filas de tubo sin medida propia.
     */
    resolveModuleProduct(row, brandData, medidaTubo) {
        if (this.esFilaDeTubo(row)) {
            const rol = (medidaTubo && this.filaDeTuboSinMedida(row))
                ? this.rolDeTubo(medidaTubo)
                : row.role;

            const enFisa = this.findProductByRole(window.SEED_DATA.brands['fisa'], rol);
            if (enFisa) return enFisa;

            // Fisa todavia no tiene ese tubo etiquetado con ese rol. Antes de
            // dejar la ventana sin tubo, se usa el de la marca elegida: sale de
            // otro proveedor, pero al menos es la medida que pidieron.
            return this.findProductByRole(brandData, rol)
                || (row.role ? this.findProductByRole(brandData, row.role) : null);
        }

        if (row.role) {
            const hit = this.findProductByRole(brandData, row.role);
            if (hit) return hit;
            // Sin ese rol etiquetado en esta marca todavía: no inventamos precio.
            return null;
        }
        // Sin rol, la fila solo resuelve dentro de su propio proveedor. Los códigos
        // llevan prefijo por marca (CED-/FIS-/FEM-), así que buscar el código de
        // otra marca acá simplemente no encuentra nada, que es lo correcto.
        return this.findProductInBrand(brandData, row.code, row.category);
    }

    /**
     * Estimates the cost of a complete window based on generic dimensions
     * For a real system, this would break down exactly how much of each profile is needed.
     * For this basic demo, we will calculate a rough estimated cost by summing the basic components.
     * @param {Object} params - width, height, brand, system, color, glassType, glassArea, accessories, labor, moduleProfiles
     */
    calculateWindowCost(params) {
        const { width, height, brand, system, color, glassType, glassArea, accessories = [], labor = {}, moduleProfiles = null, tubo = '' } = params;

        // Find brand and system
        const brandData = window.SEED_DATA.brands[brand.toLowerCase()];
        if (!brandData) return { total: 0, details: [] };

        // Basta con que venga la lista de perfiles del módulo, aunque esté vacía:
        // hay recetas que legítimamente no llevan perfiles de aluminio (biselado,
        // cubierta de vidrio, cabina de acero, donde el marco es el sistema M&B).
        // Si acá se exigiera length > 0, esas recetas caerían en el camino viejo
        // —el que cobra todos los productos marcados `isRequired` de la marca— y
        // sumarían perfiles que no tienen nada que ver.
        // quotations.js manda null cuando no hay módulo activo, así que null sigue
        // siendo la señal de "cotización a mano".
        const usingModule = Array.isArray(moduleProfiles);

        // Perimeter (ml)
        const perimeter = (width + height) * 2;

        // Area (m2)
        const area = width * height;

        let totalCost = 0;
        let details = [];
        // Perfiles de la receta que este proveedor no puede cubrir (ver más abajo).
        const perfilesFaltantes = [];

        if (usingModule) {
            const ctx = {
                width, height, perimeter, area,
                modules: params.modules,
                leaves: params.leaves,
                sashWidth: params.sashWidth,
                sashHeight: params.sashHeight
            };
            moduleProfiles.forEach(row => {
                // Cantidad primero: una fila con cantidad 0 a estas medidas/módulos
                // (ej. el mullón con 1 solo módulo) no necesita resolver producto ni
                // avisar de nada, aunque esa marca no tenga ese rol cargado todavía.
                const qty = this.resolveModuleQty(row, ctx);
                if (qty <= 0) return;

                const prod = this.resolveModuleProduct(row, brandData, tubo);
                if (!prod) {
                    // Antes esto solo iba a la consola: el perfil se salteaba en
                    // silencio y la cotización salía sin ese aluminio, más barata,
                    // sin que nadie se enterara. Ahora se devuelve en el resultado
                    // para poder avisarlo en pantalla (ver quotations.js).
                    perfilesFaltantes.push(row.description || row.role || row.code);
                    return;
                }

                const unitPrice = this.calculateItemCost(prod, color, 1);
                if (unitPrice === 0) {
                    // Sin precio para ese color: antes sumaba cero y la ventana
                    // salía más barata sin decir nada.
                    perfilesFaltantes.push((prod.description || row.role) + ' (sin precio en ' + color + ')');
                    return;
                }
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
            // Las cantidades con fórmula salen con muchos decimales (4.5199999);
            // en el desglose se muestran con dos, pero el costo usa el valor exacto.
            const qtyTexto = Number.isInteger(acc.qty) ? String(acc.qty) : Number(acc.qty).toFixed(2);
            details.push({ code: 'ACC', desc: acc.name, unitPrice: acc.price, qty: acc.qty, qtyString: qtyTexto + ' und', total: cost });
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
            perfilesFaltantes: perfilesFaltantes,
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
