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
 * El diseño reproduce el formulario que armó el usuario
 * (assets/membrete-formulario.png): ficha del cliente, tabla de detalle,
 * cuadro de totales, condiciones comerciales, formas de pago y firmas.
 *
 * MARCO: `assets/membrete.png` es ese mismo diseño pero SIN el formulario —
 * solo el logo, la franja azul, la barra lateral y el pie. Se le borró el
 * cuerpo a propósito: si se dejara el formulario dibujado en la imagen, habría
 * que escribir los datos en coordenadas fijas y volveríamos al problema viejo
 * (descripciones cortadas y una cantidad tope de filas por hoja). Acá la
 * imagen es solo el papel y el formulario se dibuja en HTML, así la tabla
 * crece y pagina sola.
 *
 * El marco va como imagen fija a hoja completa, repetida en todas las páginas.
 * El contenido no lo pisa porque la tabla exterior reserva con thead/tfoot el
 * alto del encabezado y del pie en CADA hoja — un padding-top se aplica una
 * sola vez y las hojas siguientes arrancarían encima del logo.
 *
 * Todo el maquetado va con TABLAS y estilos en línea a propósito: Word no
 * entiende flexbox ni grid, y las hojas de estilo aparte las aplica a medias.
 */
class QuotationDocument {

    // Zona libre de la hoja, medida sobre assets/membrete.png (mm sobre A4):
    // el logo y la franja azul llegan hasta 38,6 mm; la barra lateral ocupa los
    // primeros 16,6 mm de ancho; el pie arranca a los 275,7 mm.
    static get MARGENES() {
        return { arriba: 39, abajo: 23, izquierda: 19, derecha: 10 };
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
        const version = {
            etiqueta: manager && manager.revisionLabel,
            tipo: (manager && manager.versionType) || 'A',
            numero: (manager && manager.versionNumber) || 1
        };

        const quote = await this.resolveQuoteNumber(manager);

        // Los datos de la empresa viven en Ajustes (Firestore), pero ese
        // formulario solo edita porcentajes: el resto nunca se guardó ahí. Sin
        // este respaldo el documento sale sin representante ni condiciones.
        const guardados = (window.calculator && window.calculator.settings) || {};
        const porDefecto = (window.SEED_DATA && window.SEED_DATA.defaultSettings) || {};
        const ajustes = Object.assign({}, porDefecto, guardados);

        return {
            meta: this.metadata(datosCliente, cart, quote, manager && manager.editingDate, version),
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

    metadata(client, cart, quote, savedDate, version) {
        const marcas = [...new Set(cart.map(x => this.nombreMarca(x.brand)).filter(Boolean))].join(' / ');
        const colores = [...new Set(cart.map(x => x.color).filter(Boolean))].join(' / ') || 'POR DEFINIR';
        const vidrios = [...new Set(cart.map(x => x.glassType).filter(Boolean))].join(' / ') || 'SIN VIDRIO';
        const fecha = new Date(savedDate || Date.now())
            .toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' })
            .toUpperCase();
        // Código tal como va en el papel: "001-26 A.1" — consecutivo de tres
        // dígitos, los dos últimos del año, y la versión.
        //
        // SIN la inicial del usuario. La app numera por usuario y arma el código
        // como "A001-26" (ver buildBaseCode en quotations.js): esa letra sirve
        // para el historial, para saber quién la hizo, pero al cliente no le
        // dice nada y las cotizaciones en papel nunca la llevaron.
        //
        // Si todavía no se guardó no hay etiqueta de revisión, así que se arma
        // igual con el número ya reservado y la versión en curso: el código que
        // se ve en el PDF antes de guardar es el mismo que queda después.
        const codigo = version && version.etiqueta
            ? this.sinInicial(version.etiqueta)
            : `${String(quote.number).padStart(3, '0')}-${String(quote.year).slice(2)}`
              + ` ${(version && version.tipo) || 'A'}.${(version && version.numero) || 1}`;
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

    /** "A001-26 A.1" -> "001-26 A.1". Solo quita la letra inicial del código. */
    sinInicial(etiqueta) {
        return String(etiqueta || '').replace(/^[A-Za-z](?=\d)/, '');
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
    /** Porcentaje sin decimales de relleno: 15 -> "15", 12.5 -> "12.5". */
    pct(v) { return String(Math.round((Number(v) || 0) * 100) / 100); }
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

        const AZUL = '#003E89';
        const AZUL_OSC = '#003676';
        const GRIS_BG = '#ECEFF2';
        const BORDE = '#C9D2DE';
        const GRIS_TX = '#6B7280';

        const subtotal = Number(totals.subtotalFinal) ||
            cart.reduce((s, i) => s + (Number(i.total) || 0), 0);
        const pctDescuento = Number(totals.discountPct) || 0;
        const valorDescuento = Number(totals.discountValor) || 0;
        const total = Number(totals.total) || subtotal;
        const formaPago = Array.isArray(ajustes.formaPago) ? ajustes.formaPago : [];

        const filas = cart.map((item, i) => {
            const md = this.medidas(item);
            // Si no son medidas numéricas (típico de un producto manual: "a
            // convenir", "según plano"), se muestra el texto tal cual se cargó.
            const medida = (md.base && md.alto) ? `${md.base} x ${md.alto}` : this.clean(item.dimensions);
            const fondo = i % 2 ? ' background:#F7F9FC;' : '';
            return `<tr style="${fondo}">
                <td style="${this.cel} text-align:center; color:${GRIS_TX};">${i + 1}</td>
                <td style="${this.cel} text-align:center; font-weight:bold;">${this.esc(item.quantity || 1)}</td>
                <td style="${this.cel}">${this.esc(item.description || 'PRODUCTO DE ALUMINIO')}</td>
                <td style="${this.cel} text-align:center; white-space:nowrap;">${medida}</td>
                <td style="${this.cel} text-align:right; white-space:nowrap;">${this.num(item.unitPrice)}</td>
                <td style="${this.cel} text-align:right; white-space:nowrap; font-weight:bold;">${this.num(item.total)}</td>
            </tr>`;
        }).join('');

        // Rótulo azul + valor, como en el diseño del formulario.
        const campo = (rot, val) =>
            `<span style="color:${AZUL}; font-weight:bold;">${rot}</span> ${this.esc(val || '')}`;

        const filaTotal = (rot, val, destacado) => `<tr${destacado ? ` style="background:${AZUL}; color:#FFF;"` : ''}>
            <td style="padding:4pt 8pt; font-size:${destacado ? '11' : '9'}pt; font-weight:bold; text-align:right; ${destacado ? '' : `background:${GRIS_BG}; color:${AZUL};`} border:1px solid ${BORDE};">${rot}</td>
            <td style="padding:4pt 8pt; font-size:${destacado ? '11' : '9'}pt; font-weight:bold; text-align:right; white-space:nowrap; border:1px solid ${BORDE};">${val}</td>
        </tr>`;

        const cajaPago = (titulo, detalle) => `<td style="width:33.33%; padding:0 3pt;">
            <div style="background:${GRIS_BG}; padding:6pt 4pt; text-align:center;">
                <div style="color:${AZUL}; font-weight:bold; font-size:9pt;">${this.esc(titulo)}</div>
                <div style="color:${GRIS_TX}; font-size:8pt;">${this.esc(detalle)}</div>
            </div>
        </td>`;

        // "50% A LA FIRMA DEL CONTRATO" -> titulo "50%" + detalle. Si el ajuste
        // no trae porcentaje adelante, va todo como titulo.
        const partirPago = (txt) => {
            const m = this.clean(txt).match(/^(\d+%)\s+(.*)$/);
            return m ? { t: m[1], d: m[2] } : { t: this.clean(txt), d: '' };
        };

        const cuerpo = `
<table style="width:100%; border-collapse:collapse; margin-bottom:7pt;">
    <tr>
        <td style="text-align:right; font-size:11pt;">
            <span style="color:${AZUL}; font-weight:bold;">COTIZACION:</span>
            <span style="font-weight:bold;">${this.esc(meta.codigo)}</span>
        </td>
    </tr>
</table>

<!-- Ficha del cliente -->
<table style="width:100%; border-collapse:collapse; border:1px solid ${BORDE}; margin-bottom:9pt;">
    <tr>
        <td style="width:4pt; background:${AZUL}; padding:0;"></td>
        <td style="padding:7pt 10pt;">
            <table style="width:100%; border-collapse:collapse;">
                <tr>
                    <td style="${this.ficha} width:52%;">${campo('FECHA:', 'CUENCA ' + meta.date)}</td>
                    <td style="${this.ficha}">${campo('CLIENTE:', meta.client)}</td>
                </tr>
                <tr>
                    <td style="${this.ficha}">${campo('DIRECCIÓN:', meta.address)}</td>
                    <td style="${this.ficha}">${campo('TELÉFONO:', meta.phone)}</td>
                </tr>
            </table>
            <div style="border-top:1px solid ${BORDE}; margin:6pt 0;"></div>
            <div style="font-size:9pt; font-weight:bold; color:${AZUL};">De nuestras consideraciones:</div>
            <div style="font-size:9pt; margin-bottom:6pt;">Detallamos a continuación nuestra cotización para el suministro de aluminio según su solicitud:</div>
            <table style="width:100%; border-collapse:collapse;">
                <tr>
                    <td style="${this.ficha} width:52%;">${campo('ALUMINIO:', meta.aluminum)}</td>
                    <td style="${this.ficha}">${campo('VIDRIO:', meta.glass)}</td>
                </tr>
            </table>
        </td>
    </tr>
</table>

<!-- Detalle -->
<table style="width:100%; border-collapse:collapse; margin-bottom:9pt;">
    <thead>
        <tr style="background:${AZUL}; color:#FFFFFF;">
            <th style="${this.enc} width:5%;">#</th>
            <th style="${this.enc} width:7%;">CANT</th>
            <th style="${this.enc} text-align:left;">DESCRIPCIÓN</th>
            <th style="${this.enc} width:15%;">MEDIDAS</th>
            <th style="${this.enc} width:13%; text-align:right;">V. UNIT</th>
            <th style="${this.enc} width:14%; text-align:right;">SUBTOTAL</th>
        </tr>
    </thead>
    <tbody>${filas}</tbody>
</table>

<!-- Totales -->
<table style="width:100%; border-collapse:collapse; margin-bottom:12pt; page-break-inside:avoid;">
    <tr>
        <td style="width:58%;"></td>
        <td>
            <table style="width:100%; border-collapse:collapse;">
                ${filaTotal('SUBTOTAL:', this.money(subtotal), false)}
                ${filaTotal('IVA 0%:', this.money(0), false)}
                ${pctDescuento > 0 ? filaTotal(`DESCUENTO ${this.pct(pctDescuento)}%:`, '-' + this.money(valorDescuento), false) : ''}
                ${filaTotal('TOTAL:', this.money(total), true)}
            </table>
        </td>
    </tr>
</table>

<!-- Condiciones -->
<div style="page-break-inside:avoid;">
    <div style="color:${AZUL}; font-weight:bold; font-size:9.5pt; letter-spacing:0.6pt;">CONDICIONES COMERCIALES Y DE FABRICACIÓN</div>
    <div style="border-top:1px solid ${BORDE}; margin:4pt 0 6pt;"></div>
    <table style="width:100%; border-collapse:collapse; font-size:8.5pt;">
        ${[
            'Las estructuras en aluminio y vidrio están sujetas a liquidación.',
            `<b>Validez de la Oferta:</b> ${this.esc(ajustes.validezOferta || '7 días laborables a partir de la presente fecha de emisión.')}`,
            `<b>Plazo de Entrega:</b> ${this.esc(ajustes.plazoEntrega || 'A convenir.')}`,
            `<b>Garantía:</b> ${this.esc(ajustes.garantia || '1 año de garantía y mantenimiento técnico por defectos de fabricación o ensamble.')}`,
            `<b>Facturación:</b> Nosotros facturamos con tarifa 0% IVA por ${this.esc(ajustes.companyCalif || '')}.`
        ].map(t => `<tr>
            <td style="width:14pt; vertical-align:top; padding:1.5pt 0; color:${AZUL};">&bull;</td>
            <td style="padding:1.5pt 0;">${t}</td>
        </tr>`).join('')}
    </table>
</div>

${formaPago.length ? `<div style="margin-top:10pt; page-break-inside:avoid;">
    <div style="color:${AZUL}; font-weight:bold; font-size:9pt; margin-bottom:5pt;">FORMA DE PAGO:</div>
    <table style="width:100%; border-collapse:collapse;">
        <tr>${formaPago.slice(0, 3).map(p => { const s = partirPago(p); return cajaPago(s.t, s.d); }).join('')}</tr>
    </table>
</div>` : ''}

<!-- Firmas -->
<table style="width:100%; border-collapse:collapse; margin-top:16pt; page-break-inside:avoid;">
    <tr>
        <!-- Los rótulos van en el mismo recuadro que la firma y el nombre. -->
        <td style="width:50%; font-size:8.5pt; font-style:italic; color:${GRIS_TX}; text-align:center; padding:0 24pt 0 0;">Atentamente,</td>
        <td style="font-size:8.5pt; font-style:italic; color:${GRIS_TX}; text-align:center; padding:0 0 0 24pt;">Aceptado conforme,</td>
    </tr>
    <tr>
        <!-- La firma se apoya sobre la línea; el alto fijo reserva su lugar
             aunque la imagen no llegue a cargar. Lleva el MISMO recuadro que la
             celda del nombre de abajo (centrado y padding-right 24pt) para que
             quede centrada sobre la línea y no corrida a un costado. -->
        <td style="height:46pt; vertical-align:bottom; text-align:center; padding:0 24pt 0 0;">
            ${firmaDataUri ? `<img src="${firmaDataUri}" alt="" style="height:44pt; margin-bottom:-8pt;">` : '&nbsp;'}
        </td>
        <td style="padding:0;">&nbsp;</td>
    </tr>
    <tr>
        <td style="font-size:8.5pt; text-align:center; padding-right:24pt;">
            <div style="border-top:1px solid ${AZUL_OSC}; margin-bottom:3pt;"></div>
            <div style="font-weight:bold;">${this.esc(ajustes.companyRep || '')}</div>
            <div style="color:${GRIS_TX};">${this.esc(ajustes.companyRepTitle || '')}</div>
        </td>
        <td style="font-size:8.5pt; text-align:center; padding-left:24pt;">
            <div style="border-top:1px solid ${AZUL_OSC}; margin-bottom:3pt;"></div>
            <div style="font-weight:bold;">${this.esc(meta.client)}</div>
            <div style="color:${GRIS_TX};">CLIENTE / FIRMA DE ACEPTACIÓN</div>
        </td>
    </tr>
</table>`;

        // El marco va como imagen fija a hoja completa: al imprimir, los
        // elementos "fixed" se repiten en todas las páginas. Se usa <img> y no
        // un background de CSS porque los fondos solo se imprimen si el usuario
        // activa "Gráficos de fondo", que viene apagado.
        const fondo = membreteDataUri
            ? `<img src="${membreteDataUri}" alt="" style="position:fixed; top:0; left:0; width:210mm; height:297mm; z-index:0;">`
            : '';

        // La tabla exterior reserva el alto del marco arriba y abajo en CADA
        // hoja: thead y tfoot se repiten solos al cortar la página.
        return `${fondo}
<table style="width:100%; border-collapse:collapse; position:relative; z-index:1;">
    <thead><tr><td style="height:${M.arriba}mm; border:0; padding:0;">&nbsp;</td></tr></thead>
    <tfoot><tr><td style="height:${M.abajo}mm; border:0; padding:0;">&nbsp;</td></tr></tfoot>
    <tbody><tr><td style="border:0; padding:0 ${M.derecha}mm 0 ${M.izquierda}mm; vertical-align:top;">${cuerpo}</td></tr></tbody>
</table>`;
    }

    /** Estilos repetidos, para no reescribirlos en cada celda. */
    get cel()   { return 'border:1px solid #C9D2DE; padding:3.5pt 5pt; font-size:8pt; vertical-align:top;'; }
    get enc()   { return 'border:1px solid #003E89; padding:4.5pt; font-size:8pt; text-align:center; font-weight:bold;'; }
    get ficha() { return 'padding:2pt 0; font-size:9pt; vertical-align:top;'; }

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

        await this.imprimirHTML(html);
    }

    /**
     * Manda a imprimir un documento HTML completo. Va en un iframe aparte para
     * que la impresion no arrastre los estilos ni el contenido de la aplicacion.
     * Lo usan la cotizacion (arriba) y la orden de trabajo (js/orden.js).
     */
    async imprimirHTML(html) {
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
