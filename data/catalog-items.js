/**
 * CATALOGO CASALUM JULIO 2026 — Lista maestra de ítems cotizables.
 * Fuente: "Catalogo Casalum Julio 2026.xlsx" (hoja "Catalogo").
 *
 * Cada ítem de esta lista puede tener un MÓDULO PREESTABLECIDO asociado
 * (window.SEED_DATA.modules[itemId]) que define qué perfiles, accesorios y
 * mano de obra hacen falta para fabricarlo. Ver js/modules.js.
 */
(function () {
    const items = [];

    function slug(s) {
        return s
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    /**
     * Agrega un ítem cotizable. `family` solo agrupa visualmente (es el título del
     * bloque en el catálogo impreso), así que un renglon cuyo nombre es igual al de
     * su familia se descarta: es un encabezado, no un ítem que se pueda cotizar.
     */
    function add(group, family, name, note) {
        if (name === family) return;
        const fs = slug(family);
        const ns = slug(name);
        items.push({
            id: fs === ns ? ns : fs + '--' + ns,
            group: group,
            family: family,
            name: name,
            note: note || ''
        });
    }

    /** Expande "(2-3-4-5-6) MODULOS" en un ítem por cada cantidad de módulos. */
    function addRange(group, family, prefix, counts, suffix, note) {
        counts.forEach(n => add(group, family, `${prefix} ${n} ${suffix}`, note));
    }

    // ============================================================
    // VENTANAS
    // ============================================================
    const V = 'VENTANAS';

    add(V, 'VENTANA FIJA 1100', 'VENTANA FIJA 1 MODULO');
    add(V, 'VENTANA FIJA 1100', 'VENTANA FIJA 2 MODULOS');

    add(V, 'VENTANA FIJA EN TUBO', 'VENTANA FIJA 1 MODULO');
    add(V, 'VENTANA FIJA EN TUBO', 'VENTANA FIJA 2 MODULOS');
    add(V, 'VENTANA FIJA EN TUBO', 'VENTANA FIJA 3 MODULOS');
    add(V, 'VENTANA FIJA EN TUBO', 'VENTANA FIJA 4 MODULOS');

    add(V, 'VENTANA FIJA CON PERFIL PROYECTABLE', 'VENTANA FIJA CON PERFIL PROYECTABLE 1 MODULO');
    add(V, 'VENTANA FIJA CON PERFIL PROYECTABLE', 'VENTANA FIJA CON PERFIL PROYECTABLE 2 MODULOS');
    add(V, 'VENTANA FIJA CON PERFIL PROYECTABLE', 'VENTANA FIJA CON PERFIL PROYECTABLE 3 MODULOS');
    add(V, 'VENTANA FIJA CON PERFIL PROYECTABLE', 'VENTANA FIJA CON PERFIL PROYECTABLE 4 MODULOS');

    add(V, 'VENTANA CORREDIZA 1300', 'VENTANA CORREDIZA 2 MODULOS');
    add(V, 'VENTANA CORREDIZA 1300', 'VENTANA CORREDIZA 3 MODULOS');
    add(V, 'VENTANA CORREDIZA 1300', 'VENTANA CORREDIZA 4 MODULOS');

    add(V, 'VENTANA PROYECTABLE', 'VENTANAS PROYECTABLES 2 MODULOS');
    add(V, 'VENTANA PROYECTABLE', 'VENTANAS PROYECTABLES 3 MODULOS');
    add(V, 'VENTANA PROYECTABLE', 'VENTANAS PROYECTABLES 4 MODULOS');
    add(V, 'VENTANA PROYECTABLE', 'VENTANAS PROYECTABLES 5 MODULOS');
    add(V, 'VENTANA PROYECTABLE', 'VENTANAS PROYECTABLES 6 MODULOS');

    addRange(V, 'VENTANA EN TUBO', 'VENTANA EN TUBO 4X4', [2, 3, 4, 5, 6], 'MODULOS');
    addRange(V, 'VENTANA EN TUBO', 'VENTANA EN TUBO 5X4', [2, 3, 4, 5, 6], 'MODULOS');
    addRange(V, 'VENTANA EN TUBO', 'VENTANA EN TUBO 7X4', [2, 3, 4, 5, 6], 'MODULOS');

    // ============================================================
    // PUERTAS
    // ============================================================
    const P = 'PUERTAS';

    add(P, 'PUERTAS BATIENTE', 'PUERTAS BATIENTES EN TUBO DE 5X4');
    add(P, 'PUERTAS BATIENTE', 'PUERTAS BATIENTES EN TUBO DE 7X4');

    add(P, 'PUERTA CORREDIZA 2000', 'PUERTA CORREDIZAS 2000 2 MODULOS', '1 MODULO FIJO Y 1 CORREDIZO');
    add(P, 'PUERTA CORREDIZA 2000', 'PUERTA CORREDIZAS 2000 3 MODULOS', '1 MODULO FIJO Y 2 CORREDIZOS');

    add(P, 'PUERTA CORREDIZA EUROPEA APILABLE', 'PUERTA CORREDIZA EUROPEA APILABLE 2 MODULOS', '1 MODULO FIJO Y 1 CORREDIZO');
    add(P, 'PUERTA CORREDIZA EUROPEA APILABLE', 'PUERTA CORREDIZA EUROPEA APILABLE 3 MODULOS', '1 MODULO FIJO Y 2 CORREDIZOS');
    add(P, 'PUERTA CORREDIZA EUROPEA APILABLE', 'PUERTA CORREDIZA EUROPEA APILABLE 4 MODULOS', '1 MODULO FIJO Y 3 CORREDIZOS');

    add(P, 'PUERTA T45', 'PUERTA T45 2 MODULOS', '1 MODULO FIJO Y 1 CORREDIZO');
    add(P, 'PUERTA T45', 'PUERTA T45 3 MODULOS', '1 MODULO FIJO Y 2 CORREDIZOS');
    add(P, 'PUERTA T45', 'PUERTA T45 4 MODULOS', '1 MODULO FIJO Y 3 CORREDIZOS');

    add(P, 'MAMPARAS FIJAS', 'MAMPARAS FIJAS');
    add(P, 'MAMPARAS FIJAS', 'MAMPARAS 2 MODULOS');
    add(P, 'MAMPARAS FIJAS', 'MAMPARAS EN ALUMINIO 2 MODULOS');

    addRange(P, 'PUERTA COLGANTE EN TUBO', 'PUERTA COLGANTE EN TUBO 4X4', [1, 2, 3, 4], 'MODULOS');
    addRange(P, 'PUERTA COLGANTE EN TUBO', 'PUERTA COLGANTE EN TUBO 5X4', [1, 2, 3, 4], 'MODULOS');
    addRange(P, 'PUERTA COLGANTE EN TUBO', 'PUERTA COLGANTE EN TUBO 7X4', [1, 2, 3, 4], 'MODULOS');

    // ============================================================
    // CABINAS DE BAÑO
    // ============================================================
    const C = 'CABINAS DE BAÑO';

    add(C, 'CABINAS ACERO Y VIDRIO', 'CABINA CORREDIZA 2 MODULOS', 'Solo corrediza');
    add(C, 'CABINAS ACERO Y VIDRIO', 'CABINA BATIENTE 2 MODULOS', 'Visagras');

    add(C, 'CABINA EN ALUMINIO', 'CABINA CORREDIZA 2 MODULOS');

    window.CATALOG_ITEMS = items;

    /** Índice id -> ítem, para resolver módulos guardados rápido. */
    window.CATALOG_ITEMS_BY_ID = items.reduce((acc, it) => { acc[it.id] = it; return acc; }, {});

    /** Grupos en orden de aparición del catálogo impreso. */
    window.CATALOG_GROUPS = ['VENTANAS', 'PUERTAS', 'CABINAS DE BAÑO'];

    /**
     * Familias en orden de catálogo: son los "sistemas" que se eligen al cotizar
     * (VENTANA FIJA 1100, PUERTA T45, ...), no las categorías internas del proveedor.
     */
    window.CATALOG_FAMILIES = (function () {
        const seen = new Set();
        return items.reduce((acc, it) => {
            const key = it.group + '|' + it.family;
            if (seen.has(key)) return acc;
            seen.add(key);
            acc.push({ group: it.group, name: it.family });
            return acc;
        }, []);
    })();

    /**
     * Familias que cambiaron de nombre. Como el id de cada ítem se arma con el
     * nombre de su familia, sin esto los módulos ya guardados quedarían huérfanos.
     */
    const RENAMED_FAMILIES = {
        'ventanas-proyectables': 'ventana-proyectable',
        'puertas-batientes': 'puertas-batiente',
        'mamparas': 'mamparas-fijas'
    };

    /** Reescribe los ids viejos de un mapa de módulos. Devuelve true si cambió algo. */
    window.migrateModuleIds = function (modules) {
        if (!modules) return false;
        let changed = false;

        Object.keys(modules).forEach(oldId => {
            if (window.CATALOG_ITEMS_BY_ID[oldId]) return; // el id sigue siendo válido

            const sep = oldId.indexOf('--');
            const oldFamily = sep === -1 ? oldId : oldId.slice(0, sep);
            const newFamily = RENAMED_FAMILIES[oldFamily];
            if (!newFamily) return;

            const newId = sep === -1 ? newFamily : newFamily + oldId.slice(sep);
            const item = window.CATALOG_ITEMS_BY_ID[newId];
            if (!item || modules[newId]) return; // no existe destino, o ya hay uno guardado

            const mod = modules[oldId];
            mod.itemId = newId;
            mod.family = item.family;
            modules[newId] = mod;
            delete modules[oldId];
            changed = true;
        });

        return changed;
    };
})();
