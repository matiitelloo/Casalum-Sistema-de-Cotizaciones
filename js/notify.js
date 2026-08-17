/**
 * Avisos flotantes (toasts) y estado de "cargando".
 *
 * Reemplaza a los alert() del navegador, que bloquean la página, se ven fuera
 * de lugar y no distinguen un error de una confirmación.
 *
 * Uso:
 *   notify.error('No se pudo guardar');       // rojo, queda más tiempo
 *   notify.success('Cotización guardada');    // verde
 *   notify.warning('Falta el color');         // ámbar
 *   notify.info('Sin cambios para guardar');  // azul
 *
 *   const t = notify.loading('Guardando...'); // con spinner, no se cierra solo
 *   t.done('Listo');                          // lo convierte en éxito
 *   t.fail('No se pudo');                     // lo convierte en error
 *
 *   setButtonLoading(btn, true);              // spinner dentro del botón
 *   setButtonLoading(btn, false);             // lo deja como estaba
 */
(function () {
    const TIPOS = {
        success: { icono: 'fa-circle-check',        color: 'var(--success)', fondo: 'var(--success-bg)', ms: 4000, rol: 'status' },
        info:    { icono: 'fa-circle-info',         color: 'var(--info)',    fondo: 'var(--info-bg)',    ms: 5000, rol: 'status' },
        warning: { icono: 'fa-triangle-exclamation',color: 'var(--warning)', fondo: 'var(--warning-bg)', ms: 7000, rol: 'alert'  },
        error:   { icono: 'fa-circle-exclamation',  color: 'var(--danger)',  fondo: 'var(--danger-bg)',  ms: 9000, rol: 'alert'  },
        loading: { icono: 'fa-spinner fa-spin',     color: 'var(--primary)', fondo: 'var(--info-bg)',    ms: 0,    rol: 'status' }
    };

    const MAX_VISIBLES = 4;

    function contenedor() {
        let c = document.getElementById('notify-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'notify-container';
            c.setAttribute('aria-live', 'polite');
            c.setAttribute('aria-atomic', 'false');
            document.body.appendChild(c);
        }
        return c;
    }

    /**
     * Escapa el texto: los mensajes suelen traer datos cargados por el usuario.
     * No se delega en window.escapeHtml sin más porque este archivo carga antes
     * que data/seed.js (para poder atrapar errores tempranos) y el respaldo
     * también tiene que escapar de verdad, no devolver el texto crudo.
     */
    function esc(texto) {
        if (window.escapeHtml) return window.escapeHtml(texto);
        return String(texto == null ? '' : texto)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function cerrar(el) {
        if (!el || el.dataset.cerrando) return;
        el.dataset.cerrando = '1';
        el.classList.add('notify-saliendo');
        // Si la animación no corre (reduced motion, pestaña oculta), se quita igual.
        const quitar = () => el.remove();
        el.addEventListener('animationend', quitar, { once: true });
        setTimeout(quitar, 400);
    }

    function mostrar(tipo, mensaje, opciones) {
        const cfg = TIPOS[tipo] || TIPOS.info;
        const opts = opciones || {};
        const c = contenedor();

        // No apilar infinito: se van los más viejos. Se itera sobre una lista ya
        // tomada y se ignoran los que ya están cerrándose, porque cerrar() no
        // saca el nodo en el acto (espera la animación): mirar c.children acá
        // daría un bucle sin fin.
        const vivos = Array.from(c.children).filter(n => !n.dataset.cerrando);
        while (vivos.length >= MAX_VISIBLES) cerrar(vivos.shift());

        const el = document.createElement('div');
        el.className = 'notify notify-' + tipo;
        el.setAttribute('role', cfg.rol);
        el.style.setProperty('--notify-color', cfg.color);
        el.style.setProperty('--notify-bg', cfg.fondo);

        el.innerHTML = `
            <i class="fa-solid ${cfg.icono} notify-icono" aria-hidden="true"></i>
            <div class="notify-cuerpo">
                ${opts.titulo ? `<strong class="notify-titulo">${esc(opts.titulo)}</strong>` : ''}
                <span class="notify-texto">${esc(mensaje)}</span>
            </div>
            <button class="notify-cerrar" type="button" aria-label="Cerrar aviso">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>`;

        el.querySelector('.notify-cerrar').addEventListener('click', () => cerrar(el));
        c.appendChild(el);

        const duracion = opts.ms !== undefined ? opts.ms : cfg.ms;
        let temporizador = null;
        const programar = ms => { if (ms > 0) temporizador = setTimeout(() => cerrar(el), ms); };
        programar(duracion);

        // Leer con calma: al pasar el mouse no se cierra.
        el.addEventListener('mouseenter', () => clearTimeout(temporizador));
        el.addEventListener('mouseleave', () => programar(duracion));

        return {
            el,
            close: () => { clearTimeout(temporizador); cerrar(el); },
            /** Convierte un aviso de "cargando" en resultado final. */
            update: (nuevoTipo, nuevoMensaje, nuevasOpts) => {
                clearTimeout(temporizador);
                cerrar(el);
                return mostrar(nuevoTipo, nuevoMensaje, nuevasOpts);
            }
        };
    }

    const notify = {
        success: (m, o) => mostrar('success', m, o),
        info:    (m, o) => mostrar('info', m, o),
        warning: (m, o) => mostrar('warning', m, o),
        error:   (m, o) => mostrar('error', m, o),

        /** Aviso persistente con spinner. Devuelve handle con done()/fail()/close(). */
        loading: (m, o) => {
            const t = mostrar('loading', m || 'Cargando...', Object.assign({ ms: 0 }, o || {}));
            return {
                el: t.el,
                close: t.close,
                done: (msg, opts) => t.update('success', msg || 'Listo', opts),
                fail: (msg, opts) => t.update('error', msg || 'Ocurrió un error', opts)
            };
        },

        /** Cierra todos los avisos visibles. */
        clear: () => {
            const c = document.getElementById('notify-container');
            if (c) Array.from(c.children).forEach(cerrar);
        }
    };

    /**
     * Spinner dentro de un botón mientras dura una acción. Guarda el contenido
     * original para restaurarlo, así no hace falta repetirlo en cada llamada.
     */
    function setButtonLoading(boton, cargando, textoCargando) {
        const btn = typeof boton === 'string' ? document.getElementById(boton) : boton;
        if (!btn) return;

        if (cargando) {
            if (!btn.dataset.htmlOriginal) btn.dataset.htmlOriginal = btn.innerHTML;
            btn.disabled = true;
            btn.classList.add('btn-cargando');
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${esc(textoCargando || 'Cargando...')}`;
        } else {
            if (btn.dataset.htmlOriginal) {
                btn.innerHTML = btn.dataset.htmlOriginal;
                delete btn.dataset.htmlOriginal;
            }
            btn.disabled = false;
            btn.classList.remove('btn-cargando');
        }
    }

    window.notify = notify;
    window.setButtonLoading = setButtonLoading;

    // Errores que nadie atrapó: antes solo quedaban en la consola y el usuario
    // veía la pantalla congelada sin explicación.
    window.addEventListener('error', e => {
        if (!e || !e.message) return;
        notify.error(e.message, { titulo: 'Error inesperado' });
    });

    window.addEventListener('unhandledrejection', e => {
        const motivo = e && e.reason;
        const msg = motivo && motivo.message ? motivo.message : String(motivo || 'Error desconocido');
        notify.error(msg, { titulo: 'Error inesperado' });
    });
})();
