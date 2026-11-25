// El armazón: arranca la app, elige qué pantalla mostrar y dibuja las pestañas.

import * as estado from "./estado.js";
import { avisar, cerrarCapas, el, icono, poner } from "./ui/html.js";
import { pantallaCursos, pantallaCurso } from "./ui/cursos.js";
import { pantallaClase } from "./ui/clase.js";
import { pantallaTrabajos, pantallaTrabajo } from "./ui/trabajos.js";
import { pantallaAulas, pantallaAula } from "./ui/aulas.js";
import { pantallaReportes } from "./ui/reportes.js";
import { pantallaAjustes } from "./ui/ajustes.js";
import {
  alCambiarNube,
  arrancarSincronizacion,
  leerEnlaceDeConfiguracion,
} from "./nube.js";

const RUTAS = [
  { patron: /^\/?$/, pantalla: pantallaCursos, pestana: "cursos" },
  { patron: /^\/curso\/([^/]+)$/, pantalla: pantallaCurso, pestana: "cursos" },
  { patron: /^\/clase\/([^/]+)$/, pantalla: pantallaClase, pestana: "clase", limpia: true },
  { patron: /^\/trabajos$/, pantalla: pantallaTrabajos, pestana: "trabajos" },
  { patron: /^\/trabajo\/([^/]+)$/, pantalla: pantallaTrabajo, pestana: "trabajos" },
  { patron: /^\/aulas$/, pantalla: pantallaAulas, pestana: "cursos" },
  { patron: /^\/aula\/([^/]+)$/, pantalla: pantallaAula, pestana: "cursos", limpia: true },
  { patron: /^\/reportes$/, pantalla: pantallaReportes, pestana: "reportes" },
  { patron: /^\/ajustes$/, pantalla: pantallaAjustes, pestana: "ajustes" },
  { patron: /^\/conectar\/([^/]+)$/, pantalla: pantallaConectar, pestana: "ajustes" },
];

/** Un enlace de configuración traído desde otro dispositivo. */
function pantallaConectar({ parametro }) {
  const listo = leerEnlaceDeConfiguracion(parametro);
  setTimeout(() => ir("#/ajustes"), 0);
  setTimeout(
    () =>
      avisar(
        listo
          ? "Proyecto configurado. Ahora entrá con tu cuenta."
          : "Ese enlace no se entiende; configuralo a mano",
      ),
    300,
  );
  return el("div.pantalla", el("p.apunte", "Configurando…"));
}

const PESTANAS = [
  { id: "cursos", etiqueta: "Cursos", icono: "gente", ruta: "#/" },
  { id: "clase", etiqueta: "Clase", icono: "pantalla", ruta: "#/clase" },
  { id: "trabajos", etiqueta: "Trabajos", icono: "papel", ruta: "#/trabajos" },
  { id: "reportes", etiqueta: "Reportes", icono: "tabla", ruta: "#/reportes" },
  { id: "ajustes", etiqueta: "Ajustes", icono: "engranaje", ruta: "#/ajustes" },
];

const raiz = document.getElementById("app");
let rutaActual = "";

export function ir(ruta) {
  location.hash = ruta.startsWith("#") ? ruta : "#" + ruta;
}

export function volver() {
  if (history.length > 1) history.back();
  else ir("#/");
}

function rutaDeHash() {
  const crudo = location.hash.replace(/^#/, "") || "/";
  // "#/clase" sin curso abre el último usado.
  if (crudo === "/clase") {
    const curso = estado.cursoActual();
    return curso ? `/clase/${curso.id}` : "/";
  }
  return crudo;
}

function dibujar() {
  const ruta = rutaDeHash();
  rutaActual = ruta;
  for (const { patron, pantalla, pestana, limpia } of RUTAS) {
    const coincide = ruta.match(patron);
    if (!coincide) continue;
    document.body.classList.toggle("en-clase", !!limpia);
    const contenido = pantalla({ parametro: coincide[1], ir, volver });
    poner(raiz, contenido, limpia ? null : pestanas(pestana));
    window.scrollTo(0, 0);
    return;
  }
  ir("#/");
}

function pestanas(activa) {
  return el(
    "nav.pestanas",
    PESTANAS.map((p) =>
      el(
        "button.pestana",
        {
          onclick: () => ir(p.ruta),
          "aria-current": p.id === activa ? "page" : null,
        },
        [icono(p.icono, 21), el("span", p.etiqueta)],
      ),
    ),
  );
}

/** Vuelve a dibujar cuando cambian los datos, sin perder la pantalla. */
let redibujoPedido = false;
function alCambiarDatos() {
  if (redibujoPedido) return;
  redibujoPedido = true;
  requestAnimationFrame(() => {
    redibujoPedido = false;
    if (rutaDeHash() === rutaActual) dibujar();
  });
}

async function arrancar() {
  await estado.cargar();
  estado.suscribir(alCambiarDatos);
  window.addEventListener("hashchange", () => {
    cerrarCapas();
    dibujar();
  });
  window.addEventListener("pagehide", () => estado.guardarYa());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") estado.guardarYa();
  });
  dibujar();
  alCambiarNube(() => {
    if (rutaDeHash() === "/ajustes") alCambiarDatos();
  });
  arrancarSincronizacion();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* sin conexión la primera vez; ya se registrará */
    });
  }
}

arrancar();
