/**
 * Salida en PDF de la cotización.
 *
 * Ya no dibuja nada: delega en el documento único de js/word.js y lo manda a
 * imprimir, para que el usuario elija "Guardar como PDF". Así el PDF y el Word
 * son el mismo documento y no hay dos maquetas que mantener sincronizadas.
 *
 * Antes acá se estampaba texto en coordenadas fijas sobre PLANTILLA.pdf: solo
 * entraban 3 ítems por página, la descripción se cortaba a 43 caracteres y
 * cualquier texto un poco más largo se pisaba con la columna de al lado.
 *
 * Se mantiene `window.pdfGenerator.generate(manager)` porque es lo que llaman
 * quotations.js (menú "Guardar como") y app.js (reimprimir del historial).
 */
class PDFGenerator {
    get documento() {
        return window.wordGenerator;
    }

    async generate(manager) {
        const doc = this.documento;
        if (!doc) throw new Error('No se pudo preparar el documento.');
        await doc.generatePDF(manager);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.pdfGenerator = new PDFGenerator(); });
