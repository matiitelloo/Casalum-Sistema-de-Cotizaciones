/**
 * Exporta la cotización a Word.
 *
 * El archivo es un documento HTML con las marcas de Office, guardado con
 * extensión .doc: Word lo abre y lo deja editar como cualquier documento, y
 * desde ahí se puede "Guardar como" .docx si se quiere el formato nativo.
 *
 * Por qué así y no un .docx de verdad: un .docx es un ZIP con XML adentro, y
 * generarlo en el navegador exigiría sumar una biblioteca de compresión. Este
 * camino no agrega dependencias y da lo que hace falta acá — un documento
 * editable, con la tabla y los totales, que abre en Word sin pasos extra.
 *
 * A diferencia del PDF (que calca la plantilla corporativa con posiciones
 * fijas), acá el objetivo es que el contenido se pueda modificar.
 */
class WordGenerator {
    /** Reusa los formateadores del generador de PDF para no duplicar criterios. */
    get pdf() {
        return window.pdfGenerator;
    }

    async generate(manager) {
        const client = window.clientManager && window.clientManager.currentClient;
        const cart = (manager && manager.cart) || [];

        if (!client || !cart.length) {
            notify.warning('Debe seleccionar un cliente y agregar al menos un producto.');
            return;
        }

        const p = this.pdf;
        if (!p) throw new Error('No se pudo preparar el documento (falta el generador base).');

        const quote = await p.resolveQuoteNumber(manager);
        const meta = p.metadata(client, cart, quote, manager.editingDate);
        const ajustes = (window.calculator && window.calculator.settings) || {};

        const html = this.buildDocument(meta, cart, manager.totals, ajustes);
        this.download(html, `${meta.number}-${p.safe(client.name)}.doc`);
    }

    /** Escapa el texto: descripciones y datos del cliente los carga el usuario. */
    esc(v) {
        return window.escapeHtml ? window.escapeHtml(v == null ? '' : v) : String(v == null ? '' : v);
    }

    money(v) {
        return this.pdf ? this.pdf.money(v) : `$${(Number(v) || 0).toFixed(2)}`;
    }

    buildDocument(meta, cart, totals, ajustes) {
        const subtotal = cart.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        const total = Number(totals && totals.total) || subtotal;
        const descuento = Math.max(0, subtotal - total);

        const filas = cart.map((item, i) => `
            <tr>
                <td style="${this.tdCentro}">${i + 1}</td>
                <td style="${this.tdCentro}">${this.esc(item.quantity || 1)}</td>
                <td style="${this.td}">${this.esc(item.description || 'Producto de aluminio')}</td>
                <td style="${this.tdCentro}">${this.esc(item.dimensions || '')}</td>
                <td style="${this.tdDerecha}">${this.money(item.unitPrice)}</td>
                <td style="${this.tdDerecha}">${this.money(item.total)}</td>
            </tr>`).join('');

        const formaPago = Array.isArray(ajustes.formaPago) ? ajustes.formaPago : [];

        // Word entiende mejor los estilos escritos en cada etiqueta que una hoja
        // de estilos aparte, por eso van todos en línea.
        return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${this.esc(meta.number)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>
    @page { size: A4; margin: 2cm; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #1A1D26; }
</style>
</head>
<body>

<table style="width:100%; border-collapse:collapse; margin-bottom:18pt;">
    <tr>
        <td style="vertical-align:top;">
            <div style="font-size:20pt; font-weight:bold; color:#1B3A6B;">${this.esc(ajustes.companyName || 'CASALUM')}</div>
            <div style="font-size:9pt; color:#4A5568;">${this.esc(ajustes.companySubtitle || '')}</div>
            <div style="font-size:8pt; color:#8492A6;">
                ${this.esc(ajustes.companyAddress || '')}<br>
                ${this.esc(ajustes.companyWebsite || '')}<br>
                ${this.esc(ajustes.companyCalif || '')}
            </div>
        </td>
        <td style="vertical-align:top; text-align:right;">
            <div style="font-size:13pt; font-weight:bold; color:#1B3A6B;">COTIZACIÓN</div>
            <div style="font-size:11pt; font-weight:bold;">${this.esc(meta.number)}</div>
            <div style="font-size:9pt; color:#4A5568;">${this.esc(meta.date)}</div>
        </td>
    </tr>
</table>

<table style="width:100%; border-collapse:collapse; margin-bottom:16pt; background:#F0F2F5;">
    <tr>
        <td style="${this.tdDato}"><b>Cliente:</b> ${this.esc(meta.client)}</td>
        <td style="${this.tdDato}"><b>Teléfono:</b> ${this.esc(meta.phone)}</td>
    </tr>
    <tr>
        <td style="${this.tdDato}"><b>Dirección:</b> ${this.esc(meta.address)}</td>
        <td style="${this.tdDato}"><b>Color aluminio:</b> ${this.esc(meta.aluminum)}</td>
    </tr>
    <tr>
        <td style="${this.tdDato}"><b>Vidrio:</b> ${this.esc(meta.glass)}</td>
        <td style="${this.tdDato}"></td>
    </tr>
</table>

<table style="width:100%; border-collapse:collapse; margin-bottom:14pt;">
    <thead>
        <tr style="background:#1B3A6B; color:#FFFFFF;">
            <th style="${this.th}">#</th>
            <th style="${this.th}">Cant.</th>
            <th style="${this.th}">Descripción</th>
            <th style="${this.th}">Medidas</th>
            <th style="${this.th}">P. Unitario</th>
            <th style="${this.th}">Total</th>
        </tr>
    </thead>
    <tbody>${filas}</tbody>
</table>

<table style="width:45%; border-collapse:collapse; margin-left:55%; margin-bottom:18pt;">
    <tr>
        <td style="${this.tdTotal}">Subtotal</td>
        <td style="${this.tdTotalValor}">${this.money(subtotal)}</td>
    </tr>
    ${descuento > 0 ? `<tr>
        <td style="${this.tdTotal}">Descuento</td>
        <td style="${this.tdTotalValor}">-${this.money(descuento)}</td>
    </tr>` : ''}
    <tr style="background:#1B3A6B; color:#FFFFFF;">
        <td style="${this.tdTotal} font-weight:bold;">TOTAL</td>
        <td style="${this.tdTotalValor} font-weight:bold;">${this.money(total)}</td>
    </tr>
</table>

<table style="width:100%; border-collapse:collapse; font-size:8.5pt; color:#4A5568;">
    <tr><td style="padding:3pt 0;"><b>Plazo de entrega:</b> ${this.esc(ajustes.plazoEntrega || 'A CONVENIR')}</td></tr>
    <tr><td style="padding:3pt 0;"><b>Garantía:</b> ${this.esc(ajustes.garantia || '')}</td></tr>
    ${formaPago.length ? `<tr><td style="padding:3pt 0;"><b>Forma de pago:</b> ${formaPago.map(f => this.esc(f)).join(' · ')}</td></tr>` : ''}
</table>

<div style="margin-top:40pt; text-align:center; font-size:9pt;">
    <div style="border-top:1px solid #1A1D26; width:220pt; margin:0 auto 4pt;"></div>
    <div><b>${this.esc(ajustes.companyRep || '')}</b></div>
    <div style="color:#8492A6;">${this.esc(ajustes.companyRepTitle || '')}</div>
</div>

</body></html>`;
    }

    // Estilos repetidos de la tabla, para no reescribirlos en cada celda.
    get th()            { return 'border:1px solid #1B3A6B; padding:5pt; font-size:9pt; text-align:center;'; }
    get td()            { return 'border:1px solid #C8D0DC; padding:5pt; font-size:9pt;'; }
    get tdCentro()      { return this.td + ' text-align:center;'; }
    get tdDerecha()     { return this.td + ' text-align:right;'; }
    get tdDato()        { return 'padding:5pt 8pt; font-size:9pt; border:1px solid #C8D0DC;'; }
    get tdTotal()       { return 'padding:5pt 8pt; font-size:9.5pt; border:1px solid #C8D0DC;'; }
    get tdTotalValor()  { return this.tdTotal + ' text-align:right;'; }

    download(html, filename) {
        // El BOM le avisa a Word que el archivo es UTF-8; sin él, los acentos y
        // la eñe se abren rotos.
        const blob = new Blob(['﻿', html], { type: 'application/msword' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.wordGenerator = new WordGenerator(); });
