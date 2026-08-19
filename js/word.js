/**
 * Documento de la cotización — una sola maqueta, dos salidas.
 *
 * Antes había dos diseños en paralelo: el Word (HTML) y el PDF (texto estampado
 * en coordenadas fijas sobre la plantilla escaneada). El PDF entraba solo 3
 * ítems por página y cortaba la descripción a 43 caracteres, así que cualquier
 * cotización real salía mal cuadrada.
 *
 * Ahora el documento se arma UNA vez en `buildHTML()` y de ahí salen los dos:
 *   · Word -> el mismo HTML con marcas de Office, descargado como .doc
 *   · PDF  -> el mismo HTML impreso desde un iframe aislado (Guardar como PDF)
 *
 * El formato copia la cotización real de Casalum (ver 167-26 A.1): mismas
 * columnas (VIDRIO, BASE y ALTURA separadas), mismo encabezado de carta y
 * mismo bloque de condiciones y firmas.
 *
 * MEMBRETE: va como imagen de fondo a hoja completa, repetida en todas las
 * páginas. El contenido no se dibuja encima porque la tabla exterior reserva
 * con thead/tfoot el alto del encabezado y del pie en CADA hoja — un
 * padding-top no serviría, se aplica una sola vez y las hojas siguientes
 * arrancarían pisando el logo.
 *
 * Los márgenes salen de medir la cotización real: texto desde el 6,3% del
 * ancho, arriba al 12,8% y abajo hasta el 92,4% del alto.
 *
 * Todo el maquetado va con TABLAS y estilos en línea a propósito: Word no
 * entiende flexbox ni grid, y las hojas de estilo aparte las aplica a medias.
 */
class QuotationDocument {

    // Zona libre de la hoja, medida sobre la cotización real (mm sobre A4).
    static get MARGENES() {
        return { arriba: 38, abajo: 25, izquierda: 13, derecha: 8 };
    }

    // ── Datos ────────────────────────────────────────────────────

    /**
     * Reúne todo lo que necesita el documento. El cliente se lee de forma
     * SÍNCRONA, antes de cualquier await: app.js restaura `currentClient` ni
     * bien llama a generar, así que leerlo más tarde traería el cliente
     * equivocado al reimprimir una cotización del historial.
     */
    async buildData(manager) {
        const client = window.clientManager && window.clientManager.currentClient;
        const cart = (manager && manager.cart) || [];
        if (!client || !cart.length) {
            notify.warning('Debe seleccionar un cliente y agregar al menos un producto.');
            return null;
        }
        const datosCliente = {
            name: client.name, id: client.id,
            address: client.address, phone: client.phone
        };
        const etiquetaRevision = manager && manager.revisionLabel;

        const quote = await this.resolveQuoteNumber(manager);

        // Los datos de la empresa viven en Ajustes (Firestore), pero ese
        // formulario solo edita porcentajes: el resto nunca se guardó ahí. Sin
        // este respaldo el documento sale sin representante ni condiciones.
        const guardados = (window.calculator && window.calculator.settings) || {};
        const porDefecto = (window.SEED_DATA && window.SEED_DATA.defaultSettings) || {};
        const ajustes = Object.assign({}, porDefecto, guardados);

        return {
            meta: this.metadata(datosCliente, cart, quote, manager && manager.editingDate, etiquetaRevision),
            cart,
            totals: (manager && manager.totals) || {},
            ajustes
        };
    }

    async resolveQuoteNumber(manager) {
        if (manager && typeof manager.ensureQuotationNumber === 'function') return manager.ensureQuotationNumber();
        if (manager && manager.quoteNumber && manager.quoteYear) return { number: manager.quoteNumber, year: manager.quoteYear };
        if (window.quotationManager && window.quotationManager.ensureQuotationNumber) return window.quotationManager.ensureQuotationNumber();
        return { number: 1, year: new Date().getFullYear() };
    }

    metadata(client, cart, quote, savedDate, etiquetaRevision) {
        const marcas = [...new Set(cart.map(x => this.nombreMarca(x.brand)).filter(Boolean))].join(' / ');
        const colores = [...new Set(cart.map(x => x.color).filter(Boolean))].join(' / ') || 'POR DEFINIR';
        const vidrios = [...new Set(cart.map(x => x.glassType).filter(Boolean))].join(' / ') || 'SIN VIDRIO';
        const fecha = new Date(savedDate || Date.now())
            .toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })
            .toUpperCase();
        // "167-26 A.1", igual que las cotizaciones en papel. Si todavía no hay
        // etiqueta de revisión (cotización nueva sin guardar) se arma con el
        // número reservado y los dos últimos dígitos del año.
        const codigo = etiquetaRevision || `${quote.number}-${String(quote.year).slice(2)}`;
        return {
            codigo,
            date: fecha,
            client: this.clean(client.name),
            clientId: this.clean(client.id || ''),
            address: this.clean(client.address || ''),
            phone: this.clean(client.phone || ''),
            aluminum: `${colores.toUpperCase()}${marcas ? ` (${marcas.toUpperCase()})` : ''}`,
            glass: vidrios.toUpperCase()
        };
    }

    nombreMarca(clave) {
        if (!clave) return '';
        const marcas = (window.SEED_DATA && window.SEED_DATA.brands) || {};
        return marcas[clave] ? marcas[clave].name : clave;
    }

    // ── Formato ──────────────────────────────────────────────────

    clean(v) { return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim(); }
    safe(v) { return this.clean(v).replace(/[^a-z0-9áéíóúüñ]+/gi, '_') || 'Cliente'; }
    num(v) { return (Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    money(v) { return `$${this.num(v)}`; }
    esc(v) { return window.escapeHtml ? window.escapeHtml(v == null ? '' : v) : String(v == null ? '' : v); }

    /**
     * Etiqueta corta del vidrio para su columna, como en las cotizaciones en
     * papel: de "Templado 6mm Bronce" sale "6mm", y de "Camara 6+8+6" sale
     * "6+8+6". Si no se reconoce el espesor se deja el texto completo.
     */
    vidrioCorto(tipo) {
        const t = this.clean(tipo);
        if (!t) return '';
        const m = t.match(/(\d+\s*(?:\+\s*\d+\s*)*)mm/i);
        return m ? m[1].replace(/\s+/g, '') + 'mm' : t;
    }

    /** Base y Alto en columnas separadas; si son viejas, se parte "1.20x0.80m". */
    medidas(item) {
        let base = Number(item.width), alto = Number(item.height);
        if (!(base > 0) || !(alto > 0)) {
            const m = this.clean(item.dimensions).match(/([\d.]+)\s*x\s*([\d.]+)/i);
            if (m) { base = parseFloat(m[1]); alto = parseFloat(m[2]); }
        }
        return {
            base: base > 0 ? base.toFixed(2) : '',
            alto: alto > 0 ? alto.toFixed(2) : ''
        };
    }

    /** Imagen incrustada en base64: un .doc enviado por correo no resuelve rutas. */
    async incrustar(ruta, cacheKey) {
        if (this[cacheKey] !== undefined) return this[cacheKey];
        try {
            const blob = await (await fetch(ruta)).blob();
            this[cacheKey] = await new Promise((res, rej) => {
                const fr = new FileReader();
                fr.onload = () => res(fr.result);
                fr.onerror = rej;
                fr.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn('No se pudo incrustar', ruta, e);
            this[cacheKey] = null;   // el documento sale igual, sin membrete
        }
        return this[cacheKey];
    }

    membrete() { return this.incrustar('assets/membrete.png', '_membrete'); }

    /** Firma del gerente, tal cual sale del PDF original (solo se le quitó el fondo blanco). */
    firma() { return this.incrustar('assets/firma.png', '_firma'); }

    // ── Maqueta (compartida por Word y PDF) ──────────────────────

    buildHTML(data, membreteDataUri, firmaDataUri) {
        const { meta, cart, totals, ajustes } = data;
        const M = QuotationDocument.MARGENES;

        const totalSinDescuento = Number(totals.subtotalFinal) ||
            cart.reduce((s, i) => s + (Number(i.total) || 0), 0);
        const pctDescuento = Number(totals.discountPct) || 0;
        const totalFinal = Number(totals.total) || totalSinDescuento;
        const unidades = cart.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
        const formaPago = Array.isArray(ajustes.formaPago) ? ajustes.formaPago : [];

        const filas = cart.map((item, i) => {
            const md = this.medidas(item);
            return `<tr>
                <td style="${this.cel} text-align:center;">${i + 1}</td>
                <td style="${this.cel} text-align:center;">${this.esc(item.quantity || 1)}</td>
                <td style="${this.cel} font-weight:bold;">${this.esc(item.description || 'PRODUCTO DE ALUMINIO')}</td>
                <td style="${this.cel} text-align:center;">${this.esc(this.vidrioCorto(item.glassType))}</td>
                <td style="${this.cel} text-align:center;">${md.base}</td>
                <td style="${this.cel} text-align:center;">${md.alto}</td>
                <td style="${this.cel} text-align:center;">${this.num(item.unitPrice)}</td>
                <td style="${this.cel} text-align:center;">${this.num(item.total)}</td>
            </tr>`;
        }).join('');

        // Última fila del cuadro: cantidad total de unidades y el importe, igual
        // que en las cotizaciones en papel.
        const filaCierre = `<tr>
            <td style="${this.cel}">&nbsp;</td>
            <td style="${this.cel} text-align:center; font-weight:bold;">${unidades}</td>
            <td style="${this.cel}">&nbsp;</td>
            <td style="${this.cel}">&nbsp;</td>
            <td style="${this.cel}">&nbsp;</td>
            <td style="${this.cel}">&nbsp;</td>
            <td style="${this.cel}">&nbsp;</td>
            <td style="${this.cel} text-align:center; font-weight:bold; background:#FFFF00;">${this.num(totalSinDescuento)}</td>
        </tr>`;

        const cuerpo = `
<!-- Encabezado de carta: solo en la primera hoja -->
<table style="width:100%; border-collapse:collapse; margin-bottom:6pt;">
    <tr>
        <td style="${this.dato} width:62%;">FECHA:&nbsp; CUENCA ${this.esc(meta.date)}</td>
        <td style="${this.dato} color:#1B6EC2; font-weight:bold;">COTIZACION ${this.esc(meta.codigo)}</td>
    </tr>
    <tr>
        <td style="${this.dato}">CLIENTE: ${this.esc(meta.client)}</td>
        <td style="${this.dato} color:#1B6EC2;">TELF : ${this.esc(meta.phone)}</td>
    </tr>
    <tr>
        <td style="${this.dato}" colspan="2">DIRECCION: ${this.esc(meta.address)}</td>
    </tr>
</table>

<div style="font-size:8pt; font-weight:bold; margin-bottom:3pt;">De nuestras consideraciones:</div>
<div style="font-size:8pt; font-weight:bold; margin-bottom:5pt;">Detallamos a continuación nuestra cotización para el suministro de aluminio según su solicitud:</div>
<div style="font-size:9pt; font-weight:bold;">ALUMINIO : ${this.esc(meta.aluminum)}</div>
<div style="font-size:9pt; font-weight:bold; margin-bottom:6pt;">VIDRIO: ${this.esc(meta.glass)}</div>

<table style="width:100%; border-collapse:collapse;">
    <thead>
        <tr>
            <th style="${this.enc} width:4%;">&nbsp;</th>
            <th style="${this.enc} width:6%;">CANT</th>
            <th style="${this.enc}">DESCRIPCION</th>
            <th style="${this.enc} width:8%;">VIDRIO</th>
            <th style="${this.enc} width:7%;">BASE</th>
            <th style="${this.enc} width:8%;">ALTURA</th>
            <th style="${this.enc} width:9%;">VALOR<br>UNIT</th>
            <th style="${this.enc} width:9%;">TOTAL</th>
        </tr>
    </thead>
    <tbody>${filas}${filaCierre}</tbody>
</table>

<table style="width:100%; border-collapse:collapse; margin-top:6pt;">
    <tr>
        <td style="font-size:11pt; font-weight:bold; padding:2pt 0; width:30%;">TOTAL</td>
        <td style="font-size:11pt; font-weight:bold; padding:2pt 0;">${this.num(totalSinDescuento)}</td>
    </tr>
    ${pctDescuento > 0 ? `<tr>
        <td style="font-size:10.5pt; font-weight:bold; padding:2pt 0; text-align:right;">DESCUENTO ${this.num(pctDescuento).replace(/\.00$/, '')}% =&nbsp;&nbsp;</td>
        <td style="font-size:10.5pt; font-weight:bold; padding:2pt 0;">${this.num(totalFinal)}</td>
    </tr>` : ''}
</table>

<div style="margin-top:6pt; font-size:8pt; line-height:1.55;">
    <div>ESTRUCTURAS EN ALUMINIO Y VIDRIO ESTAN SUJETAS A LIQUIDACION</div>
    ${formaPago.length ? `<div>FORMA DE PAGO: ${this.esc(formaPago[0])}</div>` +
        formaPago.slice(1).map(f => `<div style="padding-left:78pt;">${this.esc(f)}</div>`).join('') : ''}
    <div style="font-weight:bold;">VALIDEZ DE LA OFERTA : ${this.esc(ajustes.validezOferta || '7 DIAS LABORABLES')}</div>
    <div style="font-weight:bold;">PLAZO DE ENTREGA : ${this.esc(ajustes.plazoEntrega || 'A CONVENIR')}</div>
    <div style="font-weight:bold;">GARANTIA Y MANTENIMIENTO DE ${this.esc(ajustes.garantia || 'UN AÑO POR DEFECTOS DE FABRICACION')}</div>
    <div style="font-weight:bold;">NOSOTROS FACTURAMOS CON TARIFA 0 &nbsp; ${this.esc(ajustes.companyCalif || '')}</div>
    <div style="margin-top:2pt;">ATENTAMENTE</div>
</div>

<table style="width:100%; border-collapse:collapse; margin-top:14pt; page-break-inside:avoid;">
    <tr>
        <!-- La firma se apoya sobre la línea, como en la cotización original.
             El alto fijo reserva su espacio aunque la imagen no cargue. -->
        <td style="width:48%; height:44pt; vertical-align:bottom; padding:0;">
            ${firmaDataUri ? `<img src="${firmaDataUri}" alt="" style="height:42pt; margin-bottom:-6pt;">` : '&nbsp;'}
        </td>
        <td style="padding:0;">&nbsp;</td>
    </tr>
    <tr>
        <td style="font-size:8.5pt; vertical-align:top;">
            <div style="border-top:1px solid #000; width:170pt;"></div>
            <div style="font-weight:bold;">${this.esc(ajustes.companyRep || '')}</div>
            <div style="padding-left:22pt;">${this.esc(ajustes.companyRepTitle || '')}</div>
        </td>
        <td style="font-size:8.5pt; vertical-align:top;">
            <div style="border-top:1px solid #000; width:200pt;"></div>
            <div>${this.esc(meta.client)}</div>
            <div style="padding-left:40pt;">CLIENTE</div>
        </td>
    </tr>
</table>`;

        // El membrete va como imagen fija a hoja completa: en la impresión los
        // elementos "fixed" se repiten en todas las páginas. Se usa <img> y no
        // un background de CSS porque los fondos solo se imprimen si el usuario
        // activa "Gráficos de fondo", que viene apagado.
        const fondo = membreteDataUri
            ? `<img src="${membreteDataUri}" alt="" style="position:fixed; top:0; left:0; width:210mm; height:297mm; z-index:0;">`
            : '';

        // La tabla exterior reserva el alto del membrete arriba y abajo en CADA
        // hoja: thead y tfoot se repiten solos al cortar la página.
        return `${fondo}
<table style="width:100%; border-collapse:collapse; position:relative; z-index:1;">
    <thead><tr><td style="height:${M.arriba}mm; border:0; padding:0;">&nbsp;</td></tr></thead>
    <tfoot><tr><td style="height:${M.abajo}mm; border:0; padding:0;">&nbsp;</td></tr></tfoot>
    <tbody><tr><td style="border:0; padding:0 ${M.derecha}mm 0 ${M.izquierda}mm; vertical-align:top;">${cuerpo}</td></tr></tbody>
</table>`;
    }

    /** Estilos repetidos, para no reescribirlos en cada celda. */
    get cel() { return 'border:1px solid #000; padding:2.5pt 3pt; font-size:7.5pt; vertical-align:middle;'; }
    get enc() { return 'border:1px solid #000; padding:3pt; font-size:7.5pt; text-align:center; font-weight:bold; vertical-align:middle;'; }
    get dato() { return 'padding:1pt 0; font-size:9pt; font-weight:bold; vertical-align:top;'; }

    /** Envuelve la maqueta en un documento completo. */
    envolver(cuerpo, titulo, paraWord) {
        const marcasOffice = paraWord
            ? `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->`
            : '';
        return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8">
<title>${this.esc(titulo)}</title>
${marcasOffice}
<style>
    /* Sin márgenes de página: el espacio libre lo reserva la tabla exterior,
       para que se repita en todas las hojas y no solo en la primera. */
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Calibri, Carlito, Arial, sans-serif; font-size: 9pt; color: #000; }
    table { border-collapse: collapse; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
    img { max-width: 100%; }
</style>
</head>
<body>${cuerpo}</body></html>`;
    }

    // ── Salida: Word ─────────────────────────────────────────────

    /**
     * Se entrega como .doc (HTML con marcas de Office) y no como .docx: un
     * .docx es un ZIP con XML adentro y habría que sumar una biblioteca de
     * compresión. Word lo abre y lo deja editar igual, y desde ahí se puede
     * "Guardar como" .docx si hace falta el formato nativo.
     */
    async generate(manager) {
        const data = await this.buildData(manager);
        if (!data) return;
        const [membrete, firma] = await Promise.all([this.membrete(), this.firma()]);
        const html = this.envolver(this.buildHTML(data, membrete, firma), `COTIZACION ${data.meta.codigo}`, true);
        // El BOM le avisa a Word que el archivo es UTF-8; sin él, los acentos y
        // la eñe se abren rotos.
        this.descargar(new Blob(['﻿', html], { type: 'application/msword' }),
            `COTIZACION ${data.meta.codigo} - ${this.safe(data.meta.client)}.doc`);
    }

    // ── Salida: PDF ──────────────────────────────────────────────

    /**
     * Imprime el MISMO documento desde un iframe aislado, para que el usuario
     * elija "Guardar como PDF". Se hace así, y no dibujando el PDF aparte,
     * porque garantiza que el PDF y el Word salgan idénticos: es una sola
     * maqueta. El iframe no hereda el CSS de la app, así que no se cuela nada
     * de la pantalla.
     */
    async generatePDF(manager) {
        const data = await this.buildData(manager);
        if (!data) return;
        const [membrete, firma] = await Promise.all([this.membrete(), this.firma()]);
        const html = this.envolver(this.buildHTML(data, membrete, firma), `COTIZACION ${data.meta.codigo}`, false);

        const previo = document.getElementById('marco-impresion');
        if (previo) previo.remove();

        const marco = document.createElement('iframe');
        marco.id = 'marco-impresion';
        marco.setAttribute('aria-hidden', 'true');
        // Fuera de la vista pero con tamaño real: con width/height en 0 algunos
        // navegadores no llegan a maquetar y sale una hoja en blanco.
        marco.style.cssText = 'position:fixed; right:0; bottom:0; width:210mm; height:297mm; opacity:0; pointer-events:none; border:0; z-index:-1;';
        document.body.appendChild(marco);

        await new Promise(resolve => {
            marco.onload = resolve;
            marco.srcdoc = html;
        });

        // Espera a que el membrete incrustado termine de decodificarse: si no,
        // la primera impresión puede salir sin fondo.
        try {
            const imgs = [...marco.contentDocument.images];
            await Promise.all(imgs.map(im => im.complete ? null : im.decode().catch(() => null)));
        } catch (e) { /* si falla, se imprime igual */ }
        await new Promise(r => setTimeout(r, 250));

        try {
            marco.contentWindow.focus();
            marco.contentWindow.print();
        } catch (e) {
            marco.remove();
            throw new Error('El navegador no permitió abrir la impresión. Pruebe con "Documento Word".');
        }

        // No se borra en el acto: en varios navegadores print() no bloquea y
        // quitar el iframe antes de tiempo cancela el diálogo.
        setTimeout(() => marco.remove(), 60000);
    }

    descargar(blob, filename) {
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

document.addEventListener('DOMContentLoaded', () => {
    window.wordGenerator = new QuotationDocument();
});
