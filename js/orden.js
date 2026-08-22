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

    construirHTML(datos, membreteDataUri) {
        const { cart } = datos;
        // Los mismos margenes que la cotizacion: son los que deja libres el
        // membrete (medidos sobre la imagen), para no escribir encima.
        const doc = window.wordGenerator && window.wordGenerator.constructor;
        const M = (doc && doc.MARGENES) || { arriba: 39, abajo: 23, izquierda: 19, derecha: 10 };
        // El fondo se coloca igual que en la cotizacion (ver QuotationDocument.FONDO).
        const estiloFondo = (doc && doc.estiloFondo)
            ? doc.estiloFondo()
            : 'position:fixed; top:0; left:-4.9mm; width:214.9mm; height:297mm; z-index:0;';

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
    /* Sin margenes de pagina: el lugar libre lo reserva la tabla de afuera, asi
       se repite en todas las hojas y no solo en la primera. */
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; }
    * { box-sizing: border-box; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
    table.marco { width: 100%; border-collapse: collapse; position: relative; z-index: 1; }
    table.marco > thead > tr > td, table.marco > tfoot > tr > td, table.marco > tbody > tr > td { border: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; color: #000; margin: 0; }
    /* El aire de arriba lo pide el membrete: sin el, el titulo queda pegado a la
       linea del sitio web y parece parte del logo. */
    h1 { margin: 7mm 0 12pt; font-size: 18pt; color: #0b4a8f; letter-spacing: 0.5pt; }
    table.piezas { width: 100%; border-collapse: collapse; font-size: 11.5pt; }
    th { background: #f2e9e4; border: 1px solid #666; padding: 5pt; font-size: 10pt; text-transform: uppercase; }
    td { border: 1px solid #666; padding: 7pt 6pt; }
    .n { width: 8%; text-align: center; font-weight: bold; }
    .tipo { width: 42%; }
    .med { width: 32%; font-weight: bold; letter-spacing: 0.5pt; }
    .cant { width: 18%; text-align: center; font-weight: bold; font-size: 13pt; }
    .firma { margin-top: 40pt; width: 60%; border-top: 1px solid #333; padding-top: 4pt; font-size: 10pt; text-align: center; }
</style></head>
<body>
    ${membreteDataUri ? `<img src="${membreteDataUri}" alt="" style="${estiloFondo}">` : ''}
    <table class="marco">
        <thead><tr><td style="height:${M.arriba}mm;">&nbsp;</td></tr></thead>
        <tfoot><tr><td style="height:${M.abajo}mm;">&nbsp;</td></tr></tfoot>
        <tbody><tr><td style="padding:0 ${M.derecha}mm 0 ${M.izquierda}mm; vertical-align:top;">

    <h1>ORDEN DE CORTE</h1>
    <table class="piezas">
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

        </td></tr></tbody>
    </table>
</body></html>`;
    }

    /** Imprime la orden de corte de una venta de vidrio guardada. */
    async imprimir(q) {
        if (!q || !(q.cart || []).length) {
            notify.warning('Esa venta no tiene vidrios cargados.');
            return;
        }
        if (!window.wordGenerator || !window.wordGenerator.imprimirHTML) {
            notify.error('No se pudo abrir la impresión.');
            return;
        }

        // El membrete lo carga el mismo que arma la cotizacion, que ya lo tiene
        // guardado. Si no se pudiera leer, la hoja sale igual pero en blanco.
        let membrete = '';
        try { membrete = await window.wordGenerator.membrete(); }
        catch (e) { console.warn('No se pudo cargar el membrete:', e); }

        const html = this.construirHTML({ cart: q.cart }, membrete);
        await window.wordGenerator.imprimirHTML(html);
    }
}

window.ordenDeTrabajo = new OrdenDeTrabajo();
