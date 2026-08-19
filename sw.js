/**
 * Service Worker — lo que convierte al cotizador en una app instalable.
 *
 * Reglas que NO hay que romper:
 *
 * 1. NUNCA se toca Firebase/Firestore. La app es privada: cotizaciones,
 *    clientes y catálogo no se guardan en la caché del teléfono. Todo lo que
 *    no sea de este dominio (salvo las dos CDN de estilos) se deja pasar
 *    derecho a la red, sin respondWith, que es como si este archivo no
 *    existiera.
 *
 * 2. Los archivos propios van RED PRIMERO, caché de respaldo. El proyecto
 *    actualiza JS y CSS subiendo el "?v=" en index.html; si acá se sirviera
 *    de caché primero, un cambio recién subido no aparecería hasta vaciar
 *    datos del sitio a mano. Con red primero, estando con señal siempre se ve
 *    lo último, y la caché solo entra cuando no hay internet.
 *
 * 3. Al cambiar CACHE_VERSION se borran las cachés viejas en el activate.
 */

const CACHE_VERSION = 'casalum-v2';

// CDN de estilos: son archivos con versión fija en la URL, no cambian nunca.
// Se guardan aparte porque a estos sí conviene servirlos de caché primero.
const CDN_PERMITIDAS = [
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
    'https://cdnjs.cloudflare.com'
];

// Armazón mínimo para que la app abra sin señal. NO incluye datos del usuario.
const ARMAZON = [
    './',
    './index.html',
    './manifest.json',
    './css/styles.css',
    './css/print.css',
    './js/notify.js',
    './js/auth.js',
    './js/db.js',
    './js/calculator.js',
    './js/app.js',
    './js/quotations.js',
    './js/clients.js',
    './js/catalog.js',
    './js/modules.js',
    './js/settings.js',
    './js/ventanaFija1100.js',
    './js/pdf.js',
    './js/word.js',
    './data/seed.js',
    './data/catalog-items.js',
    './assets/logo.png',
    './assets/favicon.png',
    './assets/icon-192.png',
    './assets/icon-512.png',
    // Membrete y firma del documento de cotización: sin estos, una cotización
    // generada sin señal saldría sin el papel membretado.
    './assets/membrete.png',
    './assets/firma.png'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_VERSION);
        // De a uno y tolerando fallos: con cache.addAll(), un solo archivo que
        // no esté (o que devuelva 404) tira abajo la instalación entera y la
        // app se queda sin service worker, sin ningún aviso.
        await Promise.all(ARMAZON.map(async url => {
            try {
                await cache.add(new Request(url, { cache: 'reload' }));
            } catch (e) {
                console.warn('[sw] no se pudo precachear:', url, e);
            }
        }));
        // Que la versión nueva tome el control sin esperar a que se cierren
        // todas las pestañas.
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const nombres = await caches.keys();
        await Promise.all(
            nombres.filter(n => n !== CACHE_VERSION).map(n => caches.delete(n))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    const req = event.request;

    // Solo GET. Un POST/PUT a Firestore no se cachea ni se reintenta.
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const mismoOrigen = url.origin === self.location.origin;
    const esCdnPermitida = CDN_PERMITIDAS.includes(url.origin);

    // Firebase, Firestore, Google Auth y cualquier otro tercero: ni se miran.
    if (!mismoOrigen && !esCdnPermitida) return;

    if (esCdnPermitida) {
        // Caché primero: las fuentes y los iconos no cambian.
        event.respondWith((async () => {
            const enCache = await caches.match(req);
            if (enCache) return enCache;
            const resp = await fetch(req);
            if (resp && (resp.ok || resp.type === 'opaque')) {
                const cache = await caches.open(CACHE_VERSION);
                cache.put(req, resp.clone());
            }
            return resp;
        })());
        return;
    }

    // Archivos propios: red primero, caché de respaldo (ver regla 2).
    event.respondWith((async () => {
        try {
            const resp = await fetch(req);
            if (resp && resp.ok) {
                const cache = await caches.open(CACHE_VERSION);
                cache.put(req, resp.clone());
            }
            return resp;
        } catch (e) {
            const enCache = await caches.match(req);
            if (enCache) return enCache;
            // Sin señal y sin copia: si es una navegación, se muestra la app
            // guardada en vez del error del navegador.
            if (req.mode === 'navigate') {
                const inicio = await caches.match('./index.html');
                if (inicio) return inicio;
            }
            throw e;
        }
    })());
});
