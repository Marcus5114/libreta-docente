// Reportes: las tablas que se miran después de la clase y los archivos que se bajan.

import * as estado from "../estado.js";
import { el, icono, bajarArchivo, poner } from "./html.js";
import { barra } from "./cursos.js";
import { apellidoPrimero } from "../domain/alumnos.js";
import { RANGOS } from "../domain/dias.js";
import {
  nombreDeArchivo,
  participacion,
  participacionCsv,
  planillaDeTrabajos,
  semana,
  todoCsv,
  trabajosCsv,
} from "../domain/reportes.js";
import { escribirNota, tituloCorto } from "../domain/trabajos.js";
import { ENTREGADO, NO_ENTREGADO, PENDIENTE } from "../domain/types.js";

const VISTAS = [
  { valor: "participacion", etiqueta: "Participación" },
  { valor: "semana", etiqueta: "Semana" },
  { valor: "trabajos", etiqueta: "Trabajos" },
];

export function pantallaReportes({ ir }) {
  const curso = estado.cursoActual();
  if (!curso) {
    return [
      barra("Reportes"),
      el("main.pantalla", [
        el("div.vacio", [
          el("h2", "Todavía no hay nada que mirar"),
          el("p", "Creá un curso y registrá una clase."),
          el("button.boton.primario", { onclick: () => ir("#/") }, "Ir a cursos"),
        ]),
      ]),
    ];
  }

  let vista = pantallaReportes.vista || "participacion";
  let rango = pantallaReportes.rango || "mes";
  const zona = el("div");

  const dibujar = () => {
    poner(
      zona,
      vista === "participacion"
        ? tablaParticipacion(curso, rango)
        : vista === "semana"
          ? tablaSemana(curso)
          : tablaTrabajos(curso),
    );
  };

  const selector = el("div.segmentado", { estilo: { marginBottom: "12px" } },
    VISTAS.map((v) =>
      el(
        "button",
        {
          "aria-pressed": String(vista === v.valor),
          onclick: (e) => {
            vista = v.valor;
            pantallaReportes.vista = v.valor;
            for (const otro of e.target.parentElement.children) {
              otro.setAttribute("aria-pressed", "false");
            }
            e.target.setAttribute("aria-pressed", "true");
            rangos.style.display = v.valor === "participacion" ? "" : "none";
            dibujar();
          },
        },
        v.etiqueta,
      ),
    ),
  );

  const rangos = el("div.segmentado", { estilo: { marginBottom: "12px" } },
    RANGOS.map((r) =>
      el(
        "button",
        {
          "aria-pressed": String(rango === r.valor),
          onclick: (e) => {
            rango = r.valor;
            pantallaReportes.rango = r.valor;
            for (const otro of e.target.parentElement.children) {
              otro.setAttribute("aria-pressed", "false");
            }
            e.target.setAttribute("aria-pressed", "true");
            dibujar();
          },
        },
        r.etiqueta,
      ),
    ),
  );
  rangos.style.display = vista === "participacion" ? "" : "none";

  dibujar();

  return [
    barra("Reportes"),
    el("main.pantalla", [
      selectorDeCurso(curso),
      selector,
      rangos,
      zona,
      el("div.titulo-seccion", "Bajar"),
      el(
        "button.boton.ancho",
        {
          estilo: { marginBottom: "8px" },
          onclick: () =>
            bajarArchivo(
              nombreDeArchivo([curso.nombre, "participación", rango]),
              participacionCsv(curso, estado.datos, rango),
            ),
        },
        [icono("bajar", 18), "Participación"],
      ),
      el(
        "button.boton.ancho",
        {
          estilo: { marginBottom: "8px" },
          onclick: () =>
            bajarArchivo(
              nombreDeArchivo([curso.nombre, "trabajos"]),
              trabajosCsv(curso, estado.datos),
            ),
        },
        [icono("bajar", 18), "Planilla de trabajos"],
      ),
      el(
        "button.boton.ancho",
        {
          onclick: () =>
            bajarArchivo(nombreDeArchivo(["Libreta", "todo"]), todoCsv(estado.datos)),
        },
        [icono("bajar", 18), "Todo lo registrado"],
      ),
      el(
        "div.apunte",
        { estilo: { marginTop: "10px", textAlign: "center" } },
        "Los archivos se abren en Excel o LibreOffice. Esta pantalla también se puede imprimir.",
      ),
    ]),
  ];
}

function selectorDeCurso(actual) {
  if (estado.datos.cursos.length < 2) return null;
  return el(
    "div.segmentado",
    { estilo: { marginBottom: "12px" } },
    estado.datos.cursos.map((curso) =>
      el(
        "button",
        {
          "aria-pressed": String(curso.id === actual.id),
          onclick: () => estado.elegirCurso(curso.id),
        },
        curso.nombre,
      ),
    ),
  );
}

// -------------------------------------------------------------- las tablas

function tablaParticipacion(curso, rango) {
  const { conductas, filas } = participacion(curso, estado.datos, rango);
  if (!filas.length) return vacio("Nada registrado en este período.");

  return el("div.envoltorio-tabla", [
    el("table", [
      el("thead", [
        el("tr", [
          el("th.nombre", "Alumno"),
          ...conductas.map((c) => el("th", { title: c.nombre }, c.emoji || c.nombre)),
          el("th", "Total"),
          el("th", "Faltas"),
        ]),
      ]),
      el(
        "tbody",
        filas.map((fila) =>
          el("tr", [
            el("td.nombre", apellidoPrimero(fila.alumno)),
            ...fila.cuentas.map((n) =>
              el("td" + (n ? "" : ".nada"), n || "·"),
            ),
            el("td", el("strong", String(fila.total))),
            el("td" + (fila.ausente ? "" : ".nada"), fila.ausente || "·"),
          ]),
        ),
      ),
    ]),
  ]);
}

function tablaSemana(curso) {
  const { dias, filas } = semana(curso, estado.datos);
  if (!filas.length) return vacio("Este curso no tiene alumnos.");

  return el("div.envoltorio-tabla", [
    el("table", [
      el("thead", [
        el("tr", [
          el("th.nombre", "Alumno"),
          ...dias.map((d) =>
            el("th", { estilo: d.hoy ? { color: "var(--tinta)" } : {} }, `${d.etiqueta} ${d.dia}`),
          ),
          el("th", "Total"),
        ]),
      ]),
      el(
        "tbody",
        filas.map((fila) =>
          el("tr", [
            el("td.nombre", apellidoPrimero(fila.alumno)),
            ...fila.dias.map((celda) =>
              celda.ausente
                ? el("td", el("span.pildora.mal", "A"))
                : el("td" + (celda.cuenta ? "" : ".nada"), celda.cuenta || "·"),
            ),
            el("td", el("strong", String(fila.total))),
          ]),
        ),
      ),
    ]),
  ]);
}

function tablaTrabajos(curso) {
  const { trabajos, filas } = planillaDeTrabajos(curso, estado.datos);
  if (!trabajos.length) return vacio("Este curso no tiene trabajos cargados.");

  const marca = (entrega) => {
    if (!entrega || entrega.estado === PENDIENTE) return el("span.pildora", "—");
    if (entrega.estado === NO_ENTREGADO) return el("span.pildora.mal", "✗");
    return el("span.pildora" + (entrega.aTiempo ? ".bien" : ""), entrega.aTiempo ? "✓" : "tarde");
  };

  return el("div.envoltorio-tabla", [
    el("table", [
      el("thead", [
        el("tr", [
          el("th.nombre", "Alumno"),
          ...trabajos.flatMap((t) => [
            el("th", { title: t.nombre }, tituloCorto(t)),
            el("th", "Nota"),
          ]),
          el("th", "Prom."),
        ]),
      ]),
      el(
        "tbody",
        filas.map((fila) =>
          el("tr", [
            el("td.nombre", apellidoPrimero(fila.alumno)),
            ...fila.celdas.flatMap((celda) => [
              el("td", [
                marca(celda.entrega),
                celda.entrega?.reentrega &&
                  el("span.pildora", { estilo: { marginLeft: "3px" } }, "R"),
              ]),
              el(
                "td" + (celda.nota === null ? ".nada" : ""),
                celda.nota === null ? "·" : el("strong", escribirNota(celda.nota)),
              ),
            ]),
            el(
              "td" + (fila.promedio === null ? ".nada" : ""),
              fila.promedio === null ? "·" : el("strong", escribirNota(fila.promedio)),
            ),
          ]),
        ),
      ),
    ]),
  ]);
}

function vacio(texto) {
  return el("div.vacio", el("p", texto));
}

export { ENTREGADO };
