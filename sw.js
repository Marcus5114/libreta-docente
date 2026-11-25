// El trabajador de servicio: lo que hace que Libreta abra sin conexión.
//
// Estrategia: los archivos de la app se guardan al instalar y se sirven desde
// la caché (son pocos y chicos). Lo que va a Supabase nunca se cachea, porque
// de eso se encarga la sincronización. Al publicar una versión nueva se cambia
// VERSION y la caché vieja se tira.

const VERSION = "libreta-v3";

const ARCHIVOS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/estilos.css",
  "./fuentes/montserrat.woff2",
  "./iconos/icono.svg",
  "./js/app.js",
  "./js/estado.js",
  "./js/deposito.js",
  "./js/nube.js",
  "./js/domain/alumnos.js",
  "./js/domain/aula.js",
  "./js/domain/dias.js",
  "./js/domain/ids.js",
  "./js/domain/menus.js",
  "./js/domain/reportes.js",
  "./js/domain/toques.js",
  "./js/domain/trabajos.js",
  "./js/domain/types.js",
  "./js/ui/ajustes.js",
  "./js/ui/aulas.js",
  "./js/ui/clase.js",
  "./js/ui/cursos.js",
  "./js/ui/html.js",
  "./js/ui/menus.js",
  "./js/ui/reportes.js",
  "./js/ui/trabajos.js",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(claves.filter((c) => c !== VERSION).map((c) => caches.delete(c))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;

  const url = new URL(pedido.url);
  if (url.origin !== self.location.origin) return; // Supabase y demás van derecho

  evento.respondWith(
    caches.match(pedido).then((guardado) => {
      if (guardado) {
        // Se sirve lo guardado y, de fondo, se busca una versión más nueva.
        fetch(pedido)
          .then((respuesta) => {
            if (respuesta.ok) caches.open(VERSION).then((c) => c.put(pedido, respuesta));
          })
          .catch(() => {});
        return guardado;
      }
      return fetch(pedido)
        .then((respuesta) => {
          if (respuesta.ok && respuesta.type === "basic") {
            const copia = respuesta.clone();
            caches.open(VERSION).then((c) => c.put(pedido, copia));
          }
          return respuesta;
        })
        .catch(() => caches.match("./index.html"));
    }),
  );
});
