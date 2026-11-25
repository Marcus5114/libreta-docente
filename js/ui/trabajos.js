// Trabajos prácticos y exámenes: la lista, la ficha de uno y la carga de notas.

import * as estado from "../estado.js";
import { el, icono, hoja, avisar, confirmar, poner, bajarArchivo } from "./html.js";
import { barra } from "./cursos.js";
import { activos, nombreCompleto, ordenar } from "../domain/alumnos.js";
import { enPalabras } from "../domain/dias.js";
import { trabajosCsv } from "../domain/reportes.js";
import { nombreDeArchivo } from "../domain/reportes.js";
import {
  TIPOS,
  escribirNota,
  leerNota,
  notaFinal,
  promedioDe,
  resumen,
  titulo,
  trabajosDe,
} from "../domain/trabajos.js";
import { ENTREGADO, EXAMEN, NO_ENTREGADO, PENDIENTE, TP } from "../domain/types.js";

export function pantallaTrabajos({ ir }) {
  const curso = estado.cursoActual();
  if (!curso) {
    return [
      barra("Trabajos"),
      el("main.pantalla", [
        el("div.vacio", [
          el("h2", "Primero hace falta un curso"),
          el("p", "Creá un curso y después cargá sus trabajos."),
          el("button.boton.primario", { onclick: () => ir("#/") }, "Ir a cursos"),
        ]),
      ]),
    ];
  }

  const trabajos = trabajosDe(estado.datos.trabajos, curso.id);
  const alumnos = activos(curso.alumnos);

  return [
    barra("Trabajos", [
      el(
        "button.icono-boton",
        { onclick: () => nuevoTrabajo(curso, ir), "aria-label": "Nuevo trabajo" },
        icono("mas"),
      ),
    ]),
    el("main.pantalla", [
      selectorDeCurso(curso),

      !trabajos.length
        ? el("div.vacio", [
            el("h2", "Sin trabajos todavía"),
            el("p", "Cargá el primer TP o examen de este curso."),
            el(
              "button.boton.primario",
              { onclick: () => nuevoTrabajo(curso, ir) },
              "Nuevo trabajo",
            ),
          ])
        : el(
            "div",
            trabajos.map((trabajo) => {
              const r = resumen(trabajo, estado.datos.entregas, alumnos);
              return el(
                "button.tarjeta.tocable",
                { onclick: () => ir(`#/trabajo/${trabajo.id}`) },
                [
                  el("div.fila", [
                    el("div", [
                      el("strong", titulo(trabajo)),
                      el(
                        "div.apunte",
                        [
                          trabajo.fechaConsigna && "Dado el " + enPalabras(trabajo.fechaConsigna),
                          trabajo.fechaLimite && "entrega " + enPalabras(trabajo.fechaLimite),
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      ),
                    ]),
                    el(
                      "div",
                      { estilo: { flex: "0 0 auto" } },
                      el("span.pildora", trabajo.tipo === EXAMEN ? "Examen" : "TP"),
                    ),
                  ]),
                  el(
                    "div",
                    {
                      estilo: {
                        display: "flex",
                        gap: "6px",
                        flexWrap: "wrap",
                        marginTop: "10px",
                      },
                    },
                    [
                      el("span.pildora", `${r.entregados}/${r.total} entregaron`),
                      r.tarde > 0 && el("span.pildora", `${r.tarde} tarde`),
                      r.reentregas > 0 && el("span.pildora", `${r.reentregas} reentrega(s)`),
                      r.promedio !== null &&
                        el("span.pildora", `Promedio ${escribirNota(r.promedio)}`),
                      r.calificados < r.total &&
                        el(
                          "span.pildora.mal",
                          `${r.total - r.calificados} sin nota`,
                        ),
                    ],
                  ),
                ],
              );
            }),
          ),

      trabajos.length > 0 &&
        el("div", [
          el("div.titulo-seccion", "Planilla"),
          el(
            "button.boton.ancho",
            {
              onclick: () =>
                bajarArchivo(
                  nombreDeArchivo([curso.nombre, "trabajos"]),
                  trabajosCsv(curso, estado.datos),
                ),
            },
            [icono("bajar", 18), "Bajar planilla completa"],
          ),
          el(
            "div.apunte",
            { estilo: { marginTop: "8px", textAlign: "center" } },
            "Un archivo que abrís en Excel o LibreOffice, con entregas, reentregas, notas y promedios.",
          ),
        ]),
    ]),
  ];
}

function selectorDeCurso(actual) {
  if (estado.datos.cursos.length < 2) return null;
  return el(
    "div.segmentado",
    { estilo: { marginBottom: "14px" } },
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

// ------------------------------------------------------------- un trabajo

export function pantallaTrabajo({ parametro, ir, volver }) {
  const trabajo = estado.trabajo(parametro);
  if (!trabajo) {
    return [barra("Trabajo"), el("main.pantalla", el("p", "Ese trabajo ya no está."))];
  }
  const curso = estado.curso(trabajo.cursoId);
  const alumnos = ordenar(activos(curso?.alumnos ?? []), "apellido");
  const r = resumen(trabajo, estado.datos.entregas, alumnos);

  return [
    barra(
      titulo(trabajo),
      [
        el(
          "button.icono-boton",
          { onclick: () => editarTrabajo(trabajo), "aria-label": "Editar" },
          icono("lapiz"),
        ),
      ],
      volver,
    ),
    el("main.pantalla", [
      el("div.tarjeta", [
        el(
          "div",
          { estilo: { display: "flex", gap: "6px", flexWrap: "wrap" } },
          [
            el("span.pildora", `${r.entregados}/${r.total} entregaron`),
            r.tarde > 0 && el("span.pildora", `${r.tarde} tarde`),
            r.noEntregados > 0 && el("span.pildora.mal", `${r.noEntregados} no entregaron`),
            r.reentregas > 0 && el("span.pildora", `${r.reentregas} reentrega(s)`),
            r.promedio !== null && el("span.pildora", `Promedio ${escribirNota(r.promedio)}`),
          ],
        ),
        el(
          "div.apunte",
          { estilo: { marginTop: "10px" } },
          [
            trabajo.fechaConsigna && "Consigna: " + enPalabras(trabajo.fechaConsigna),
            trabajo.fechaLimite && "Límite: " + enPalabras(trabajo.fechaLimite),
            trabajo.fechaReentrega && "Reentrega: " + enPalabras(trabajo.fechaReentrega),
          ]
            .filter(Boolean)
            .join("  ·  "),
        ),
        trabajo.observaciones && el("p.apunte", { estilo: { marginTop: "8px" } }, trabajo.observaciones),
      ]),

      el("div.botonera", { estilo: { marginTop: "0" } }, [
        el(
          "button.boton",
          { onclick: () => marcarTodos(trabajo, alumnos, ENTREGADO) },
          "Todos entregaron",
        ),
        el(
          "button.boton",
          { onclick: () => marcarTodos(trabajo, alumnos, NO_ENTREGADO) },
          "Ninguno entregó",
        ),
      ]),

      el("div.titulo-seccion", "Carga por alumno"),
      el(
        "div.tarjeta",
        { estilo: { padding: "0" } },
        alumnos.map((alumno, i) => filaDeCarga(trabajo, alumno, i)),
      ),
    ]),
  ];
}

const CICLO = [PENDIENTE, ENTREGADO, "tarde", NO_ENTREGADO];

function estadoVisible(entrega) {
  if (!entrega || entrega.estado === PENDIENTE) return PENDIENTE;
  if (entrega.estado === NO_ENTREGADO) return NO_ENTREGADO;
  return entrega.aTiempo ? ENTREGADO : "tarde";
}

const ASPECTO = {
  [PENDIENTE]: { texto: "—", clase: "", ayuda: "Sin cargar" },
  [ENTREGADO]: { texto: "✓", clase: "bien", ayuda: "Entregó a tiempo" },
  tarde: { texto: "✓ tarde", clase: "", ayuda: "Entregó fuera de fecha" },
  [NO_ENTREGADO]: { texto: "✗", clase: "mal", ayuda: "No entregó" },
};

function filaDeCarga(trabajo, alumno, indice) {
  const entrega = estado.datos.entregas.find(
    (e) => e.trabajoId === trabajo.id && e.alumnoId === alumno.id,
  );
  const visible = estadoVisible(entrega);
  const aspecto = ASPECTO[visible];

  return el(
    "div",
    {
      estilo: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        borderTop: indice ? "1px solid var(--linea)" : "0",
      },
    },
    [
      el(
        "button",
        {
          estilo: {
            flex: "1 1 auto",
            minWidth: "0",
            border: "0",
            background: "none",
            font: "inherit",
            color: "inherit",
            textAlign: "left",
            padding: "4px 0",
            cursor: "pointer",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          },
          onclick: () => fichaDeEntrega(trabajo, alumno),
        },
        [
          el("strong", { estilo: { fontSize: "0.9rem" } }, nombreCompleto(alumno)),
          entrega?.reentrega &&
            el("span.pildora", { estilo: { marginLeft: "6px" } }, "R"),
        ],
      ),

      el(
        "button.pildora" + (aspecto.clase ? "." + aspecto.clase : ""),
        {
          estilo: {
            flex: "0 0 auto",
            border: "1px solid var(--linea)",
            cursor: "pointer",
            minHeight: "34px",
            minWidth: "60px",
            justifyContent: "center",
            font: "inherit",
            fontSize: "0.72rem",
            fontWeight: "700",
          },
          title: aspecto.ayuda,
          onclick: () => cicloDeEstado(trabajo, alumno, visible),
        },
        aspecto.texto,
      ),

      el("input", {
        estilo: {
          flex: "0 0 58px",
          width: "58px",
          minHeight: "34px",
          padding: "4px 6px",
          textAlign: "center",
          fontWeight: "700",
        },
        inputmode: "decimal",
        placeholder: "–",
        "aria-label": "Nota de " + nombreCompleto(alumno),
        value: entrega ? notaEscrita(entrega) : "",
        onchange: (e) => {
          const nota = leerNota(e.target.value, trabajo.notaMaxima);
          const campo = entrega?.reentrega ? "notaReentrega" : "nota";
          const cambios = { [campo]: nota };
          if (nota !== null && (!entrega || entrega.estado === PENDIENTE)) {
            cambios.estado = ENTREGADO;
          }
          estado.guardarEntrega(trabajo.id, alumno.id, cambios);
        },
      }),
    ],
  );
}

function notaEscrita(entrega) {
  const nota = notaFinal(entrega);
  return nota === null ? "" : String(nota).replace(".", ",");
}

function cicloDeEstado(trabajo, alumno, visible) {
  const siguiente = CICLO[(CICLO.indexOf(visible) + 1) % CICLO.length];
  const cambios = {
    [PENDIENTE]: { estado: PENDIENTE, aTiempo: true },
    [ENTREGADO]: { estado: ENTREGADO, aTiempo: true },
    tarde: { estado: ENTREGADO, aTiempo: false },
    [NO_ENTREGADO]: { estado: NO_ENTREGADO, aTiempo: false },
  }[siguiente];
  estado.guardarEntrega(trabajo.id, alumno.id, cambios);
}

function marcarTodos(trabajo, alumnos, estadoNuevo) {
  for (const alumno of alumnos) {
    estado.guardarEntrega(trabajo.id, alumno.id, {
      estado: estadoNuevo,
      aTiempo: estadoNuevo === ENTREGADO,
    });
  }
  avisar(estadoNuevo === ENTREGADO ? "Marcados como entregados" : "Marcados como no entregados");
}

/** La ficha completa de un alumno en un trabajo: reentrega, notas, comentario. */
function fichaDeEntrega(trabajo, alumno) {
  const actual =
    estado.datos.entregas.find(
      (e) => e.trabajoId === trabajo.id && e.alumnoId === alumno.id,
    ) || {};
  const copia = {
    estado: actual.estado ?? PENDIENTE,
    aTiempo: actual.aTiempo ?? true,
    reentrega: actual.reentrega ?? false,
    nota: actual.nota ?? null,
    notaReentrega: actual.notaReentrega ?? null,
    comentario: actual.comentario ?? "",
  };

  const cuerpo = el("div");
  const dibujar = (cerrar) =>
    poner(
      cuerpo,
      el("div.titulo-seccion", "Entrega"),
      el("div.segmentado", [
        boton("Sin cargar", copia.estado === PENDIENTE, () => {
          copia.estado = PENDIENTE;
          dibujar(cerrar);
        }),
        boton("Entregó", copia.estado === ENTREGADO, () => {
          copia.estado = ENTREGADO;
          dibujar(cerrar);
        }),
        boton("No entregó", copia.estado === NO_ENTREGADO, () => {
          copia.estado = NO_ENTREGADO;
          dibujar(cerrar);
        }),
      ]),

      copia.estado === ENTREGADO &&
        el("label.campo", { estilo: { marginTop: "14px" } }, [
          el("span", "¿Llegó en fecha?"),
          el("div.segmentado", [
            boton("A tiempo", copia.aTiempo, () => {
              copia.aTiempo = true;
              dibujar(cerrar);
            }),
            boton("Fuera de fecha", !copia.aTiempo, () => {
              copia.aTiempo = false;
              dibujar(cerrar);
            }),
          ]),
        ]),

      el("label.campo", [
        el("span", `Nota (de 0 a ${trabajo.notaMaxima})`),
        el("input", {
          inputmode: "decimal",
          value: copia.nota === null ? "" : String(copia.nota).replace(".", ","),
          oninput: (e) => (copia.nota = leerNota(e.target.value, trabajo.notaMaxima)),
        }),
      ]),

      el(
        "label",
        {
          estilo: {
            display: "flex",
            alignItems: "center",
            gap: "10px",
            margin: "4px 0 14px",
          },
        },
        [
          el("input", {
            type: "checkbox",
            checked: copia.reentrega,
            onchange: (e) => {
              copia.reentrega = e.target.checked;
              dibujar(cerrar);
            },
          }),
          el("span", "Hizo una reentrega"),
        ],
      ),

      copia.reentrega &&
        el("label.campo", [
          el("span", "Nota de la reentrega"),
          el("input", {
            inputmode: "decimal",
            value:
              copia.notaReentrega === null
                ? ""
                : String(copia.notaReentrega).replace(".", ","),
            oninput: (e) =>
              (copia.notaReentrega = leerNota(e.target.value, trabajo.notaMaxima)),
          }),
          el("div.apunte", "Es la que cuenta para el promedio. La original queda guardada."),
        ]),

      el("label.campo", [
        el("span", "Observación"),
        el("input", {
          value: copia.comentario,
          placeholder: "Opcional",
          oninput: (e) => (copia.comentario = e.target.value),
        }),
      ]),

      el("div.botonera", [
        el("button.boton", { onclick: cerrar }, "Cancelar"),
        el(
          "button.boton.primario",
          {
            onclick: () => {
              estado.guardarEntrega(trabajo.id, alumno.id, copia);
              cerrar();
            },
          },
          "Guardar",
        ),
      ]),
    );

  const { cerrar } = hoja(nombreCompleto(alumno), cuerpo);
  dibujar(cerrar);
}

function boton(texto, activo, alTocar) {
  return el("button", { "aria-pressed": String(activo), onclick: alTocar }, texto);
}

// ------------------------------------------------------- alta y edición

function nuevoTrabajo(curso, ir) {
  const trabajos = trabajosDe(estado.datos.trabajos, curso.id);
  const ultimoNumero = trabajos
    .filter((t) => t.tipo === TP)
    .map((t) => parseInt(t.numero, 10))
    .filter(Number.isFinite)
    .sort((a, b) => b - a)[0];
  const borrador = {
    tipo: TP,
    numero: String((ultimoNumero ?? 0) + 1),
  };
  formularioDeTrabajo("Trabajo nuevo", borrador, (campos) => {
    const creado = estado.crearTrabajo(curso.id, campos);
    ir(`#/trabajo/${creado.id}`);
  });
}

function editarTrabajo(trabajo) {
  formularioDeTrabajo(
    "Editar trabajo",
    { ...trabajo },
    (campos) => estado.guardarTrabajo(trabajo.id, campos),
    trabajo,
  );
}

function formularioDeTrabajo(encabezado, borrador, guardar, existente = null) {
  const copia = {
    tipo: borrador.tipo ?? TP,
    numero: borrador.numero ?? "",
    nombre: borrador.nombre ?? "",
    fechaConsigna: borrador.fechaConsigna ?? "",
    fechaLimite: borrador.fechaLimite ?? "",
    fechaReentrega: borrador.fechaReentrega ?? "",
    notaMaxima: borrador.notaMaxima ?? 10,
    notaAprobacion: borrador.notaAprobacion ?? 6,
    peso: borrador.peso ?? 1,
    observaciones: borrador.observaciones ?? "",
  };

  hoja(encabezado, (cerrar) => [
    el("div.segmentado", { estilo: { marginBottom: "14px" } },
      TIPOS.map((t) =>
        boton(t.etiqueta, copia.tipo === t.valor, (e) => {
          copia.tipo = t.valor;
          for (const otro of e.target.parentElement.children) {
            otro.setAttribute("aria-pressed", "false");
          }
          e.target.setAttribute("aria-pressed", "true");
        }),
      ),
    ),

    el("div.fila", [
      el("label.campo", { estilo: { flex: "0 0 90px" } }, [
        el("span", "Número"),
        el("input", {
          value: copia.numero,
          inputmode: "numeric",
          oninput: (e) => (copia.numero = e.target.value),
        }),
      ]),
      el("label.campo", [
        el("span", "Nombre o tema"),
        el("input", {
          value: copia.nombre,
          placeholder: "Landing page",
          oninput: (e) => (copia.nombre = e.target.value),
        }),
      ]),
    ]),

    el("label.campo", [
      el("span", "Fecha de la consigna"),
      el("input", {
        type: "date",
        value: copia.fechaConsigna,
        oninput: (e) => (copia.fechaConsigna = e.target.value),
      }),
      el("div.apunte", "El día en que se lo diste al curso."),
    ]),
    el("div.fila", [
      el("label.campo", [
        el("span", "Fecha límite"),
        el("input", {
          type: "date",
          value: copia.fechaLimite,
          oninput: (e) => (copia.fechaLimite = e.target.value),
        }),
      ]),
      el("label.campo", [
        el("span", "Reentrega"),
        el("input", {
          type: "date",
          value: copia.fechaReentrega,
          oninput: (e) => (copia.fechaReentrega = e.target.value),
        }),
      ]),
    ]),

    el("div.fila", [
      el("label.campo", [
        el("span", "Nota máxima"),
        el("input", {
          type: "number",
          value: copia.notaMaxima,
          inputmode: "numeric",
          oninput: (e) => (copia.notaMaxima = Number(e.target.value) || 10),
        }),
      ]),
      el("label.campo", [
        el("span", "Aprueba con"),
        el("input", {
          type: "number",
          value: copia.notaAprobacion,
          inputmode: "decimal",
          oninput: (e) => (copia.notaAprobacion = Number(e.target.value) || 6),
        }),
      ]),
      el("label.campo", [
        el("span", "Peso"),
        el("input", {
          type: "number",
          value: copia.peso,
          inputmode: "decimal",
          oninput: (e) => (copia.peso = Number(e.target.value) || 1),
        }),
      ]),
    ]),
    el(
      "div.apunte",
      { estilo: { marginTop: "-6px", marginBottom: "14px" } },
      "El peso multiplica la nota en el promedio: poné 2 si este examen vale el doble que un TP.",
    ),

    el("label.campo", [
      el("span", "Observaciones o criterios"),
      el("input", {
        value: copia.observaciones,
        placeholder: "Opcional",
        oninput: (e) => (copia.observaciones = e.target.value),
      }),
    ]),

    existente &&
      el(
        "button.boton.ancho.peligro",
        {
          onclick: async () => {
            const seguro = await confirmar(
              `¿Borrar ${titulo(existente)}?`,
              "Se borran también todas las notas cargadas de este trabajo.",
              "Borrar",
            );
            if (seguro) {
              estado.borrarTrabajo(existente.id);
              cerrar();
              location.hash = "#/trabajos";
            }
          },
        },
        "Borrar este trabajo",
      ),

    el("div.botonera", [
      el("button.boton", { onclick: cerrar }, "Cancelar"),
      el(
        "button.boton.primario",
        {
          onclick: () => {
            if (!copia.numero.trim() && !copia.nombre.trim()) {
              return avisar("Poné al menos un número o un nombre");
            }
            guardar(copia);
            cerrar();
          },
        },
        "Guardar",
      ),
    ]),
  ]);
}

export { promedioDe };
