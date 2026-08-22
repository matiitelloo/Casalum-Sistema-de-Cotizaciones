/**
 * ORDEN DE TRABAJO DE VENTA DE VIDRIO
 *
 * La hoja que va al que corta el vidrio: qué piezas hay que cortar, de qué tipo
 * y de qué medida. No lleva precios: al taller no le sirven y no tienen por qué
 * circular por ahí.
 *
 * Sale de una venta de vidrio ya guardada (las que en el historial aparecen como
 * "Venta de Vidrio"). Cada renglón del carrito es un tipo y una medida, con su
 * cantidad.
 */
class OrdenDeTrabajo {

    esc(v) {
        return String(v === null || v === undefined ? '' : v)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    fecha(iso) {
        const d = iso ? new Date(iso) : new Date();
        return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    /** "Vidrio suelto: Claro 6mm" -> "Claro 6mm". */
    tipoDeVidrio(descripcion) {
        return String(descripcion || '').replace(/^vidrio suelto:\s*/i, '').trim() || 'Vidrio';
    }

    /**
     * Junta las piezas por tipo de vidrio, que es como se pide y como se corta:
     * el que corta trabaja una plancha a la vez.
     */
    porTipo(cart) {
        const grupos = new Map();
        (cart || []).forEach(it => {
            const tipo = this.tipoDeVidrio(it.description);
            if (!grupos.has(tipo)) grupos.set(tipo, []);
            grupos.get(tipo).push({
                medidas: it.dimensions || '',
                cantidad: parseInt(it.quantity, 10) || 1
            });
        });
        return [...grupos.entries()].map(([tipo, piezas]) => ({ tipo, piezas }));
    }

    construirHTML(datos) {
        const { codigo, cliente, fecha, autor, cart } = datos;
        const grupos = this.porTipo(cart);
        const totalPiezas = (cart || []).reduce((s, it) => s + (parseInt(it.quantity, 10) || 1), 0);

        let n = 0;
        const bloques = grupos.map(g => {
            const filas = g.piezas.map(p => {
                n++;
                return `
                <tr>
                    <td class="n">${n}</td>
                    <td class="med">${this.esc(p.medidas)}</td>
                    <td class="cant">${p.cantidad}</td>
                    <td class="ok"></td>
                </tr>`;
            }).join('');
            const piezasDelTipo = g.piezas.reduce((s, p) => s + p.cantidad, 0);
            return `
            <section class="grupo">
                <div class="grupo-cab">
                    <span class="tipo">${this.esc(g.tipo)}</span>
                    <span class="cuenta">${piezasDelTipo} pieza${piezasDelTipo === 1 ? '' : 's'}</span>
                </div>
                <table class="piezas">
                    <thead>
                        <tr><th class="n">N&deg;</th><th class="med">Medida (base &times; altura)</th><th class="cant">Cant.</th><th class="ok">Cortado</th></tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </section>`;
        }).join('');

        return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>ORDEN DE CORTE ${this.esc(codigo)}</title>
<style>
    @page { size: A4; margin: 14mm 12mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; margin: 0; }
    .cab { border-bottom: 3px solid #0b4a8f; padding-bottom: 6pt; margin-bottom: 10pt; }
    .cab h1 { margin: 0; font-size: 18pt; color: #0b4a8f; letter-spacing: 0.5pt; }
    .cab .sub { font-size: 9pt; color: #444; margin-top: 2pt; }
    .datos { width: 100%; border-collapse: collapse; margin-bottom: 14pt; font-size: 10pt; }
    .datos td { padding: 4pt 7pt; border: 1px solid #bbb; }
    .datos .et { background: #eef3f9; font-weight: bold; width: 20%; }
    .grupo { margin-bottom: 14pt; page-break-inside: avoid; }
    .grupo-cab { display: flex; justify-content: space-between; align-items: baseline;
                 background: #0b4a8f; color: #fff; padding: 4pt 8pt; border-radius: 3pt 3pt 0 0; }
    .grupo-cab .tipo { font-size: 12pt; font-weight: bold; }
    .grupo-cab .cuenta { font-size: 9.5pt; }
    table.piezas { width: 100%; border-collapse: collapse; font-size: 11pt; }
    table.piezas th { background: #f2e9e4; border: 1px solid #999; padding: 4pt; font-size: 9.5pt; text-transform: uppercase; }
    table.piezas td { border: 1px solid #999; padding: 6pt 5pt; }
    table.piezas .n { width: 8%; text-align: center; font-weight: bold; }
    table.piezas .med { font-size: 12pt; font-weight: bold; letter-spacing: 0.5pt; }
    table.piezas .cant { width: 12%; text-align: center; font-size: 12pt; font-weight: bold; }
    table.piezas .ok { width: 16%; }
    .pie { margin-top: 16pt; font-size: 10pt; }
    .pie .total { font-weight: bold; }
    .notas { margin-top: 10pt; border: 1px dashed #999; border-radius: 3pt; padding: 6pt 8pt; font-size: 9.5pt; color: #555; }
    .notas div { margin-bottom: 16pt; }
    .firmas { margin-top: 26pt; display: flex; gap: 30pt; }
    .firma { flex: 1; border-top: 1px solid #333; padding-top: 3pt; font-size: 9pt; text-align: center; }
</style></head>
<body>
    <div class="cab">
        <h1>ORDEN DE CORTE &mdash; VIDRIO</h1>
        <div class="sub">CASALUM &nbsp;·&nbsp; Aluminio y Vidrio &nbsp;·&nbsp; Cuenca</div>
    </div>

    <table class="datos">
        <tr>
            <td class="et">Venta</td><td>${this.esc(codigo)}</td>
            <td class="et">Fecha</td><td>${this.esc(fecha)}</td>
        </tr>
        <tr>
            <td class="et">Cliente</td><td>${this.esc(cliente)}</td>
            <td class="et">Atendió</td><td>${this.esc(autor || '-')}</td>
        </tr>
    </table>

    ${bloques}

    <div class="pie">
        <span class="total">Total: ${totalPiezas} pieza${totalPiezas === 1 ? '' : 's'}</span>
        en ${grupos.length} tipo${grupos.length === 1 ? '' : 's'} de vidrio.
    </div>

    <div class="notas">
        <strong>Observaciones:</strong>
        <div></div>
    </div>

    <div class="firmas">
        <div class="firma">Cortado por</div>
        <div class="firma">Revisado por</div>
        <div class="firma">Entregado al cliente</div>
    </div>
</body></html>`;
    }

    /** Imprime la orden de corte de una venta de vidrio guardada. */
    async imprimir(q) {
        if (!q || !(q.cart || []).length) {
            notify.warning('Esa venta no tiene vidrios cargados.');
            return;
        }
        const html = this.construirHTML({
            codigo: q.revisionLabel || 'Venta de Vidrio',
            cliente: q.clientName || 'Mostrador',
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
