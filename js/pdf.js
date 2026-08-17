/** PDF corporativo basado en PLANTILLA.pdf. */
class PDFGenerator {
    constructor() {
        this.templateUrl = 'assets/casalum-corporate-quotation-template.pdf';
        this.height = 842;
        this.rowTops = [283, 300, 317];
    }

    async generate(manager) {
        const client = window.clientManager?.currentClient;
        const cart = manager.cart || [];
        if (!client || !cart.length) return notify.warning('Debe seleccionar un cliente y agregar al menos un producto.');
        try {
            await this.ensurePdfLibrary();
            const quote = await this.resolveQuoteNumber(manager);
            const binaryString = window.atob(window.PLANTILLA_PDF_B64);
            const len = binaryString.length;
            const existingPdfBytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                existingPdfBytes[i] = binaryString.charCodeAt(i);
            }
            const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
            const template = await PDFDocument.load(existingPdfBytes);
            const pdf = await PDFDocument.create();
            const regular = await pdf.embedFont(StandardFonts.Helvetica);
            const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
            const black = rgb(0, 0, 0);
            const meta = this.metadata(client, cart, quote, manager.editingDate);
            const count = Math.ceil(cart.length / this.rowTops.length);

            for (let pageIndex = 0; pageIndex < count; pageIndex++) {
                const [page] = await pdf.copyPages(template, [0]);
                pdf.addPage(page);
                this.drawHeader(page, meta, regular, bold, black);
                this.drawTable(page, cart.slice(pageIndex * 3, pageIndex * 3 + 3), pageIndex * 3, regular, bold, black);
                if (pageIndex === count - 1) this.drawTotals(page, manager.totals, cart, regular, bold, black);
                else this.clearTotals(page, rgb);
                this.text(page, `Página ${pageIndex + 1} de ${count}`, 480, 780, 7, regular, black);
            }
            pdf.setTitle(meta.number);
            pdf.setAuthor('CASALUM');
            const bytes = await pdf.save();
            this.download(bytes, `${meta.number}-${this.safe(client.name)}.pdf`);
        } catch (error) {
            console.error('Error de PDF corporativo:', error);
            notify.error(`No fue posible generar el PDF corporativo: ${error.message || 'error desconocido'}`);
        }
    }

    async ensurePdfLibrary() {
        if (window.PDFLib) return;
        // Covers a slow initial load or a browser cache that skipped the script
        // in index.html. The bundled file means no internet is required.
        await new Promise((resolve, reject) => {
            const existing = document.querySelector('script[data-casalum-pdf-lib]');
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', () => reject(new Error('No se pudo cargar assets/pdf-lib.min.js')), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.src = 'assets/pdf-lib.min.js';
            script.async = true;
            script.dataset.casalumPdfLib = 'true';
            script.onload = resolve;
            script.onerror = () => reject(new Error('No se pudo cargar assets/pdf-lib.min.js'));
            document.head.appendChild(script);
        });
        if (!window.PDFLib) throw new Error('La biblioteca PDF no quedó disponible');
    }

    async resolveQuoteNumber(manager) {
        if (typeof manager.ensureQuotationNumber === 'function') return manager.ensureQuotationNumber();
        if (manager.quoteNumber && manager.quoteYear) return { number: manager.quoteNumber, year: manager.quoteYear };
        if (window.quotationManager?.ensureQuotationNumber) return window.quotationManager.ensureQuotationNumber();
        return { number: 1, year: new Date().getFullYear() };
    }
    metadata(client, cart, quote, savedDate) {
        const colors = [...new Set(cart.map(x => x.color).filter(Boolean))].join(' / ') || 'POR DEFINIR';
        const glasses = [...new Set(cart.map(x => x.glassType).filter(Boolean))].join(' / ') || 'SIN VIDRIO';
        const date = new Date(savedDate || Date.now()).toLocaleDateString('es-EC', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase();
        return { number: `COT-${quote.year}-${String(quote.number).padStart(6, '0')}`, date, client: this.clean(client.name), address: this.clean(client.address || 'NO REGISTRA'), phone: this.clean(client.phone || 'NO REGISTRA'), aluminum: colors.toUpperCase(), glass: glasses.toUpperCase() };
    }
    clean(v) { return String(v || '').replace(/[\r\n]+/g, ' ').trim(); }
    safe(v) { return this.clean(v).replace(/[^a-z0-9áéíóúüñ]+/gi, '_') || 'Cliente'; }
    money(v) { return `$${(Number(v) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
    fit(v, chars) { const t = this.clean(v); return t.length > chars ? `${t.slice(0, chars - 3).trim()}...` : t; }
    y(top, size) { return this.height - top - size; }
    erase(page, x, top, width, height, rgb) { page.drawRectangle({ x, y: this.height - top - height, width, height, color: rgb(1, 1, 1) }); }
    text(page, value, x, top, size, font, color) { page.drawText(this.clean(value), { x, y: this.y(top, size), size, font, color }); }
    right(page, value, x, top, size, font, color) { const t = this.clean(value); page.drawText(t, { x: x - font.widthOfTextAtSize(t, size), y: this.y(top, size), size, font, color }); }
    drawHeader(page, data, font, bold, color) {
        const { rgb } = window.PDFLib;
        this.erase(page, 452, 9, 95, 18, rgb); this.erase(page, 116, 128, 195, 15, rgb); this.erase(page, 364, 128, 175, 15, rgb);
        this.erase(page, 135, 145, 175, 15, rgb); this.erase(page, 373, 145, 165, 15, rgb); this.erase(page, 132, 215, 180, 15, rgb); this.erase(page, 355, 215, 175, 15, rgb);
        this.text(page, data.number, 454, 12, 8, bold, color); this.text(page, data.date, 118, 131, 8, font, color);
        this.text(page, this.fit(data.client, 30), 365, 131, 8, bold, color); this.text(page, this.fit(data.address, 31), 136, 148, 8, font, color);
        this.text(page, this.fit(data.phone, 22), 374, 148, 8, font, color); this.text(page, this.fit(data.aluminum, 27), 133, 219, 7.5, font, color); this.text(page, this.fit(data.glass, 28), 356, 219, 7.5, font, color);
    }
    drawTable(page, items, offset, font, bold, color) {
        const { rgb } = window.PDFLib;
        // Build three consistent rows within the original table panel.
        for (let i = 1; i <= 3; i++) page.drawLine({ start: { x: 69.5, y: this.height - (278 + i * 17) }, end: { x: 553, y: this.height - (278 + i * 17) }, thickness: 0.6, color: rgb(0.72, 0.78, 0.86) });
        items.forEach((item, index) => {
            const top = this.rowTops[index];
            this.text(page, String(offset + index + 1), 80, top, 7, font, color);
            this.text(page, String(item.quantity || 1), 110, top, 7, font, color);
            this.text(page, this.fit(item.description || 'Producto de aluminio', 43), 147, top, 7, font, color);
            this.text(page, this.fit(item.dimensions || '', 11), 378, top, 7, font, color);
            this.right(page, this.money(item.unitPrice), 485, top, 7, font, color);
            this.right(page, this.money(item.total), 548, top, 7, font, color);
        });
    }
    clearTotals(page, rgb) { this.erase(page, 464, 342, 88, 69, rgb); }
    drawTotals(page, totals, cart, font, bold, color) {
        const { rgb } = window.PDFLib;
        this.clearTotals(page, rgb);
        const subtotal = cart.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        const total = Number(totals?.total) || subtotal;
        const discount = Math.max(0, subtotal - total);
        this.right(page, this.money(subtotal), 546, 348, 8, bold, color);
        this.right(page, '$0.00', 546, 371, 8, font, color);
        this.right(page, this.money(discount), 546, 395, 8, font, color);
        this.right(page, this.money(total), 546, 418, 10, bold, rgb(1, 1, 1));
    }
    download(bytes, filename) { const blob = new Blob([bytes], { type: 'application/pdf' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
document.addEventListener('DOMContentLoaded', () => { window.pdfGenerator = new PDFGenerator(); });
