/**
 * ORDEN DE TRABAJO
 *
 * La hoja que baja al taller. Dice QUÉ hay que fabricar y CON QUÉ, y no lleva
 * ni un precio: al maestro no le sirven y no tienen por qué circular por el
 * taller.
 *
 * Sale de lo que ya quedó guardado en la cotización: cada ítem del carrito
 * trae su desglose (`details`), que es la lista de materiales que calculó la
 * receta. Acá se separa en perfiles, vidrio y accesorios, se quitan los
 * importes y se agrega el resumen de material de toda la obra, que es lo que
 * se usa para pedir a los proveedores.
 */
class OrdenDeTrabajo {

    /** Filas del desglose que no son material: la mano de obra es plata, no cosas. */
    static get NO_MATERIAL() { return ['MOB']; }

    esVidrio(d) { return d.code === 'VID'; }
    esAccesorio(d) { return d.code === 'ACC'; }
    esPerfil(d) { return !this.esVidrio(d) && !this.esAccesorio(d) && !OrdenDeTrabajo.NO_MATERIAL.includes(d.code); }

    /** Escapa texto para meterlo en el HTML. */
    esc(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    fecha(iso) {
        const d = iso ? new Date(iso) : new Date();
        return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    /**
     * Junta todo el material de la orden para pedirlo de una: mismo código y
     * misma unidad se suman. Es lo que se lleva al proveedor.
     */
    resumenDeMateriales(cart) {
        const total = new Map();
        (cart || []).forEach(item => {
            const veces = parseInt(item.quantity, 10) || 1;
            (item.details || []).forEach(d => {
                if (OrdenDeTrabajo.NO_MATERIAL.includes(d.code)) return;
                const unidad = (d.qtyString || '').replace(/^[\d.,\s]+/, '').trim() || 'und';
                const clave = (d.code || '') + '|' + d.desc + '|' + unidad;
                const previo = total.get(clave) || { desc: d.desc, code: d.code, unidad, cantidad: 0 };
                previo.cantidad += (parseFloat(d.qty) || 0) * veces;
                total.set(clave, previo);
            });
        });
        // Primero los perfiles, después el vidrio, al final los accesorios: es el
        // orden en que se compra.
        const orden = { VID: 1, ACC: 2 };
        return [...total.values()].sort((a, b) =>
            (orden[a.code] || 0) - (orden[b.code] || 0) || a.desc.localeCompare(b.desc));
    }

    /** Una tabla de materiales, sin precios. */
    tablaMateriales(filas, titulo) {
        if (!filas.length) return '';
        const cuerpo = filas.map(f => `
            <tr>
                <td>${this.esc(f.desc)}</td>
                <td class="num">${this.esc(f.cantidad)}</td>
            </tr>`).join('');
        return `
        <div class="bloque">
            <div class="bloque-titulo">${this.esc(titulo)}</div>
            <table class="mat">
                <tbody>${cuerpo}</tbody>
            </table>
        </div>`;
    }

    /** Un ítem de la cotización: qué es, de qué medida, y con qué se hace. */
    bloqueItem(item, n) {
        const d = item.details || [];
        const fila = (x) => ({ desc: x.desc, cantidad: x.qtyString || x.qty });

        const perfiles = d.filter(x => this.esPerfil(x)).map(fila);
        const vidrio = d.filter(x => this.esVidrio(x)).map(fila);
        const accesorios = d.filter(x => this.esAccesorio(x)).map(fila);

        const rd = item.rawData || {};
        const datos = [
            rd.modules ? `${rd.modules} módulos` : '',
            rd.leaves ? `${rd.leaves} hojas` : '',
            rd.tubo ? `tubo ${rd.tubo}` : '',
            item.vidrioBesado ? 'VIDRIO BESADO' : ''
        ].filter(Boolean).join(' · ');

        const sinDesglose = !perfiles.length && !vidrio.length && !accesorios.length;

        return `
        <section class="item">
            <div class="item-cab">
                <div class="item-n">${n}</div>
                <div class="item-desc">
                    <strong>${this.esc(item.quantity || 1)} × ${this.esc(item.description || '')}</strong>
                    <div class="item-medidas">
                        ${this.esc(item.dimensions || '')}${datos ? ' &nbsp;·&nbsp; ' + this.esc(datos) : ''}
                    </div>
                </div>
                <div class="item-check">Hecho <span class="cuadro"></span></div>
            </div>
            ${sinDesglose
                ? '<div class="aviso">Este ítem se cargó a mano: no tiene lista de materiales.</div>'
                : this.tablaMateriales(perfiles, 'Perfiles')
                  + this.tablaMateriales(vidrio, 'Vidrio')
                  + this.tablaMateriales(accesorios, 'Accesorios')}
            <div class="notas"><span>Observaciones del taller:</span></div>
        </section>`;
    }

    /** Arma la hoja completa. */
    construirHTML(datos) {
        const { codigo, cliente, direccion, fecha, autor, cart } = datos;

        const items = (cart || []).map((it, i) => this.bloqueItem(it, i + 1)).join('');
        const resumen = this.resumenDeMateriales(cart).map(m => `
            <tr>
                <td>${this.esc(m.desc)}</td>
                <td class="num">${this.esc(Math.round(m.cantidad * 100) / 100)} ${this.esc(m.unidad)}</td>
            </tr>`).join('');

        const piezas = (cart || []).reduce((s, it) => s + (parseInt(it.quantity, 10) || 1), 0);

        return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>ORDEN DE TRABAJO ${this.esc(codigo)}</title>
<style>
    @page { size: A4; margin: 12mm 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #000; margin: 0; }
    .cab { border-bottom: 3px solid #0b4a8f; padding-bottom: 6pt; margin-bottom: 10pt; }
    .cab h1 { margin: 0; font-size: 17pt; color: #0b4a8f; letter-spacing: 0.5pt; }
    .cab .sub { font-size: 9pt; color: #444; margin-top: 2pt; }
    .datos { width: 100%; border-collapse: collapse; margin-bottom: 12pt; font-size: 10pt; }
    .datos td { padding: 3pt 6pt; border: 1px solid #bbb; }
    .datos .et { background: #eef3f9; font-weight: bold; width: 22%; }
    .item { border: 1px solid #999; border-radius: 3pt; padding: 7pt 9pt; margin-bottom: 9pt; page-break-inside: avoid; }
    .item-cab { display: flex; align-items: flex-start; gap: 9pt; border-bottom: 1px dashed #999; padding-bottom: 5pt; margin-bottom: 6pt; }
    .item-n { background: #0b4a8f; color: #fff; font-weight: bold; width: 20pt; height: 20pt; border-radius: 50%; text-align: center; line-height: 20pt; flex: 0 0 auto; }
    .item-desc { flex: 1 1 auto; }
    .item-medidas { font-size: 9.5pt; color: #333; margin-top: 2pt; }
    .item-check { font-size: 9pt; color: #444; flex: 0 0 auto; }
    .cuadro { display: inline-block; width: 13pt; height: 13pt; border: 1.5px solid #333; vertical-align: -3pt; margin-left: 3pt; }
    .bloque { margin-bottom: 5pt; }
    .bloque-titulo { font-size: 9pt; font-weight: bold; color: #0b4a8f; text-transform: uppercase; margin-bottom: 2pt; }
    table.mat { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
    table.mat td { border: 1px solid #ccc; padding: 2.5pt 5pt; }
    table.mat td.num { width: 22%; text-align: right; white-space: nowrap; }
    .aviso { font-size: 9.5pt; font-style: italic; color: #a00; }
    .notas { margin-top: 5pt; font-size: 9pt; color: #666; border-top: 1px dotted #bbb; padding-top: 4pt; }
    .notas span { display: block; margin-bottom: 14pt; }
    .resumen { page-break-before: always; }
    .resumen h2 { font-size: 13pt; color: #0b4a8f; margin: 0 0 3pt; }
    .resumen .nota { font-size: 9pt; color: #555; margin-bottom: 7pt; }
    .firmas { margin-top: 26pt; display: flex; gap: 30pt; }
    .firma { flex: 1; border-top: 1px solid #333; padding-top: 3pt; font-size: 9pt; text-align: center; }
</style></head>
<body>
    <div class="cab">
        <h1>ORDEN DE TRABAJO</h1>
        <div class="sub">CASALUM &nbsp;·&nbsp; Aluminio y Vidrio &nbsp;·&nbsp; Cuenca</div>
    </div>

    <table class="datos">
        <tr>
            <td class="et">Cotización</td><td>${this.esc(codigo)}</td>
            <td class="et">Fecha</td><td>${this.esc(fecha)}</td>
        </tr>
        <tr>
            <td class="et">Cliente</td><td>${this.esc(cliente)}</td>
            <td class="et">Piezas</td><td>${piezas}</td>
        </tr>
        <tr>
            <td class="et">Dirección</td><td colspan="3">${this.esc(direccion || '-')}</td>
        </tr>
        <tr>
            <td class="et">Cotizó</td><td>${this.esc(autor || '-')}</td>
            <td class="et">Maestro</td><td></td>
        </tr>
    </table>

    ${items}

    <div class="resumen">
        <h2>Material de toda la orden</h2>
        <div class="nota">Suma de todos los ítems, para pedir al proveedor. Los metros son totales, no la lista de cortes.</div>
        <table class="mat"><tbody>${resumen}</tbody></table>
        <div class="firmas">
            <div class="firma">Entregado por</div>
            <div class="firma">Recibido por el maestro</div>
            <div class="firma">Fecha de entrega</div>
        </div>
    </div>
</body></html>`;
    }

    /** Imprime la orden de trabajo de una cotización ya guardada. */
    async imprimir(q, cliente) {
        if (!q || !(q.cart || []).length) {
            notify.warning('Esa cotización no tiene ítems.');
            return;
        }
        const codigo = q.revisionLabel
            || (q.quoteNumber ? `${String(q.quoteNumber).padStart(3, '0')}-${String(q.quoteYear).slice(2)}` : '(sin código)');

        const html = this.construirHTML({
            codigo,
            cliente: (cliente && cliente.name) || q.clientName || 'Consumidor Final',
            direccion: (cliente && cliente.address) || q.clientAddress || '',
            fecha: this.fecha(q.date),
            autor: q.authorName || q.author || '',
            cart: q.cart
        });

        if (!window.wordGenerator || !window.wordGenerator.imprimirHTML) {
            notify.error('No se pudo abrir la impresión.');
            return;
        }
        await window.wordGenerator.imprimirHTML(html);
    }
}

window.ordenDeTrabajo = new OrdenDeTrabajo();
