/**
 * ORDEN DE TRABAJO DE VENTA DE VIDRIO
 *
 * La hoja que va al que corta el vidrio: una tabla con el tipo, la medida y la
 * cantidad de cada pieza, y nada mas. Sin precios: al taller no le sirven y no
 * tienen por que circular por ahi.
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

    construirHTML(datos) {
        const { cart } = datos;

        // Una sola tabla: tipo, medida y cantidad. Nada mas.
        const filas = (cart || []).map((it, i) => `
            <tr>
                <td class="n">${i + 1}</td>
                <td class="tipo">${this.esc(this.tipoDeVidrio(it.description))}</td>
                <td class="med">${this.esc(it.dimensions || '')}</td>
                <td class="cant">${parseInt(it.quantity, 10) || 1}</td>
            </tr>`).join('');

        return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>ORDEN DE CORTE</title>
<style>
    @page { size: A4; margin: 18mm 14mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; margin: 0; }
    h1 { margin: 0 0 12pt; font-size: 18pt; color: #0b4a8f; letter-spacing: 0.5pt; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5pt; }
    th { background: #f2e9e4; border: 1px solid #666; padding: 5pt; font-size: 10pt; text-transform: uppercase; }
    td { border: 1px solid #666; padding: 7pt 6pt; }
    .n { width: 8%; text-align: center; font-weight: bold; }
    .tipo { width: 42%; }
    .med { width: 32%; font-weight: bold; letter-spacing: 0.5pt; }
    .cant { width: 18%; text-align: center; font-weight: bold; font-size: 13pt; }
    .firma { margin-top: 40pt; width: 60%; border-top: 1px solid #333; padding-top: 4pt; font-size: 10pt; text-align: center; }
</style></head>
<body>
    <h1>ORDEN DE CORTE</h1>
    <table>
        <thead>
            <tr>
                <th class="n">N&deg;</th>
                <th class="tipo">Tipo de vidrio</th>
                <th class="med">Medida</th>
                <th class="cant">Cant.</th>
            </tr>
        </thead>
        <tbody>${filas}</tbody>
    </table>

    <div class="firma">Entregado al cliente</div>
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
