/**
 * Cotizador — Ventana Fija Modelo 1100 (multi-proveedor)
 *
 * Réplica fiel de las fórmulas reales de "VENTANAS FIJAS.xlsx" (hoja "V. FIJA
 * 1100"). Las celdas Base/Altura de esa hoja NO son una referencia fija de
 * 1x1 — son las medidas reales del cliente, y cada cantidad se calcula
 * DIRECTO a partir de ellas (sin ningún "tarifa por m² x área" intermedio):
 *
 *   Horizontal (m) = Base x 2
 *   Vertical   (m) = Altura x 2 x Módulos
 *   Pisa vidrio(m) = Horizontal + Vertical   (= perímetro real de cada paño)
 *   Vinil      (und) = igual que Pisa vidrio
 *   Mullón     (m, opcional) = Altura x (Módulos - 1)
 *   Vidrio     (m²) = Base x Altura
 *   Tornillos = 30 (fijo) · Silicón = 1 (fijo) · Mano de obra = 4 + (Módulos-1) x 2 (fijo)
 *
 * Ninguno de estos ítems se calcula sobre una ventana "de prueba" de 1x1: se
 * usan las medidas reales desde el primer paso, tal como hace la hoja de
 * cálculo (las fórmulas de Excel referencian directamente las celdas de
 * Base/Altura). SUBTOTAL + 14% Gastos Generales + 30% Utilidad (en cascada)
 * = precio final de esa ventana puntual.
 *
 * La ventana fija 1100 no tiene apertura: solo lleva el perfil perimetral
 * (horizontal + vertical), el junquillo/pisavidrio que retiene el vidrio, y
 * opcionalmente un mullón (divisor vertical) si el cliente lo pide
 * explícitamente — no es obligatorio para ventanas de 2+ módulos.
 *
 * Multi-proveedor: cada proveedor (Cedal, Femec, Fisa, ...) usa su propio
 * código/nombre de producto para la misma pieza funcional. Para no tener que
 * armar una receta por marca, cada producto del catálogo que cumple un rol
 * de esta receta se etiqueta en data/seed.js con `genericRoles: [...]`
 * (ver ROLES abajo). Esta función resuelve el producto correcto según la
 * marca elegida al cotizar, así una sola receta sirve para todos los
 * proveedores que tengan sus perfiles etiquetados.
 */

(function () {
    const GASTOS_GENERALES_PCT = 0.14;
    const UTILIDAD_PCT = 0.30;
    const MANO_OBRA_COSTO_UNITARIO = 5.00;

    /** Roles genéricos que debe cubrir cada marca para poder cotizar la 1100. */
    const ROLES = {
        HORIZONTAL: 'ventana-fija-1100-horizontal',
        VERTICAL: 'ventana-fija-1100-vertical',
        JUNQUILLO: 'ventana-fija-1100-junquillo',
        MULLON: 'ventana-fija-1100-mullon' // opcional
    };

    /** Busca, dentro de todas las categorías de una marca, el producto marcado con ese rol. */
    function buscarPerfilPorRolGenerico(brandData, rol) {
        const categorias = Object.keys(brandData.categories || {});
        for (const catName of categorias) {
            const hit = brandData.categories[catName].products.find(
                p => Array.isArray(p.genericRoles) && p.genericRoles.includes(rol)
            );
            if (hit) return hit;
        }
        return null;
    }

    function precioProducto(product, color) {
        return window.calculator.calculateItemCost(product, color, 1);
    }

    /**
     * Calcula el costo directo (antes de márgenes) de una Ventana Fija 1100
     * con las medidas, módulos, marca y color reales pedidos por el cliente.
     */
    function calcularCostoDirecto(baseCliente, alturaCliente, numModulos, opts) {
        const { brandData, color, glassType, incluirMullon } = opts;

        const horizontal = buscarPerfilPorRolGenerico(brandData, ROLES.HORIZONTAL);
        const vertical = buscarPerfilPorRolGenerico(brandData, ROLES.VERTICAL);
        const junquillo = buscarPerfilPorRolGenerico(brandData, ROLES.JUNQUILLO);
        if (!horizontal || !vertical || !junquillo) {
            throw new Error(`La marca "${brandData.name}" no tiene configurados todos los perfiles necesarios (horizontal, vertical, junquillo) para la Ventana Fija 1100.`);
        }

        let mullon = null;
        if (incluirMullon) {
            mullon = buscarPerfilPorRolGenerico(brandData, ROLES.MULLON);
            if (!mullon) {
                throw new Error(`La marca "${brandData.name}" no tiene mullón disponible para la Ventana Fija 1100.`);
            }
        }

        // Cantidades sobre las medidas REALES (igual que las fórmulas de Excel: E5=Base, E6=Altura).
        const horizontalQty = baseCliente * 2;
        const verticalQty = alturaCliente * 2 * numModulos;
        const junquilloQty = horizontalQty + verticalQty; // Excel: E10 = E5*2 + E6*2 (perímetro real)
        const mullonQty = incluirMullon ? alturaCliente * (numModulos - 1) : 0;

        const costoHorizontal = precioProducto(horizontal, color) * horizontalQty;
        const costoVertical = precioProducto(vertical, color) * verticalQty;
        const costoJunquillo = precioProducto(junquillo, color) * junquilloQty;
        const costoMullon = incluirMullon ? precioProducto(mullon, color) * mullonQty : 0;

        // Vidrio: área REAL (Base x Altura), no una referencia fija.
        let costoVidrio = 0;
        let glass = null;
        const areaVidrio = baseCliente * alturaCliente;
        if (glassType) {
            glass = (window.SEED_DATA.glass || []).find(g => g.type === glassType);
            if (!glass) throw new Error(`Tipo de vidrio "${glassType}" no encontrado en el catálogo.`);
            costoVidrio = glass.pricePerM2 * areaVidrio;
        }

        // Accesorios: compartidos entre proveedores (no cambian por marca).
        const accesorios = window.SEED_DATA.accessories || [];
        const buscarAcc = nombre => accesorios.find(a => a.name.toLowerCase() === nombre.toLowerCase());
        const tornillos = buscarAcc('Tornillos y tacos');
        const vinil = buscarAcc('Vinil');
        const silicon = buscarAcc('Silicon');

        // Tornillos y silicón son cantidades fijas por ventana (no escalan con tamaño ni
        // módulos, igual que en el Excel). Vinil usa la misma cantidad que el pisa vidrio
        // (Excel: E16=E10).
        const tornillosQty = 30;
        const vinilQty = junquilloQty;
        const siliconQty = 1;

        const costoTornillos = tornillos ? tornillos.pricePerUnit * tornillosQty : 0;
        const costoVinil = vinil ? vinil.pricePerUnit * vinilQty : 0;
        const costoSilicon = silicon ? silicon.pricePerUnit * siliconQty : 0;

        // Mano de obra: fija por cantidad de módulos (no por tamaño), 2 unidades por módulo + 2, a $5 cada una.
        const unidadesManoObra = 2 * numModulos + 2;
        const costoManoObra = unidadesManoObra * MANO_OBRA_COSTO_UNITARIO;

        const subtotal = costoHorizontal + costoVertical + costoJunquillo + costoMullon
            + costoVidrio + costoTornillos + costoVinil + costoSilicon + costoManoObra;

        // Gastos generales y utilidad en cascada (igual que Calculator.applyMargins).
        const gastosGenerales = subtotal * GASTOS_GENERALES_PCT;
        const utilidad = (subtotal + gastosGenerales) * UTILIDAD_PCT;
        const precioFinal = subtotal + gastosGenerales + utilidad;

        return {
            precioFinal,
            desglose: {
                horizontal: { codigo: horizontal.code, descripcion: horizontal.description, qty: horizontalQty, costo: costoHorizontal },
                vertical: { codigo: vertical.code, descripcion: vertical.description, qty: verticalQty, costo: costoVertical },
                junquillo: { codigo: junquillo.code, descripcion: junquillo.description, qty: junquilloQty, costo: costoJunquillo },
                mullon: incluirMullon ? { codigo: mullon.code, descripcion: mullon.description, qty: mullonQty, costo: costoMullon } : null,
                vidrio: { tipo: glassType || null, area: glass ? areaVidrio : 0, costo: costoVidrio },
                tornillos: { qty: tornillosQty, costo: costoTornillos },
                vinil: { qty: vinilQty, costo: costoVinil },
                silicon: { qty: siliconQty, costo: costoSilicon },
                manoObra: { unidades: unidadesManoObra, costoUnitario: MANO_OBRA_COSTO_UNITARIO, costo: costoManoObra },
                subtotal,
                gastosGenerales,
                utilidad
            }
        };
    }

    /**
     * Cotiza una Ventana Fija Modelo 1100 para las medidas reales del cliente,
     * en la marca (proveedor) y color elegidos.
     *
     * @param {Object} params
     * @param {number} params.baseCliente - Base solicitada por el cliente (m).
     * @param {number} params.alturaCliente - Altura solicitada por el cliente (m).
     * @param {number} params.numModulos - Número de módulos (entero >= 1).
     * @param {string} params.brand - Clave de la marca en window.SEED_DATA.brands (ej. 'cedal').
     * @param {string} params.color - Color elegido (debe existir en brand.colors).
     * @param {string} [params.glassType] - Tipo de vidrio (window.SEED_DATA.glass[].type).
     * @param {boolean} [params.incluirMullon] - Si el cliente pidió mullón (opcional, poco común).
     * @returns {Object} { precioFinal, areaTotal, marca, desglose }
     */
    function cotizarVentanaFija1100(params) {
        const { baseCliente, alturaCliente, numModulos, brand, color, glassType, incluirMullon = false } = params;

        if (!(baseCliente > 0) || !(alturaCliente > 0)) {
            throw new Error('Base_Cliente y Altura_Cliente deben ser mayores a 0.');
        }
        if (!Number.isInteger(numModulos) || numModulos < 1) {
            throw new Error('Num_Modulos debe ser un entero mayor o igual a 1.');
        }
        if (!brand) throw new Error('Debe indicar la marca (proveedor) de aluminio.');
        if (!color) throw new Error('Debe indicar el color.');

        const brandData = window.SEED_DATA.brands[brand.toLowerCase()];
        if (!brandData) throw new Error(`Marca "${brand}" no encontrada en el catálogo.`);

        const { precioFinal, desglose } = calcularCostoDirecto(baseCliente, alturaCliente, numModulos, {
            brandData, color, glassType, incluirMullon
        });

        return {
            precioFinal,
            areaTotal: baseCliente * alturaCliente,
            marca: brandData.name,
            desglose
        };
    }

    window.buscarPerfilPorRolGenerico = buscarPerfilPorRolGenerico;
    window.calcularCostoDirectoVentana1100 = calcularCostoDirecto;
    window.cotizarVentanaFija1100 = cotizarVentanaFija1100;
})();
