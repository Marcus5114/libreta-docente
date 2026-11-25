// Modo clase: la pantalla que el docente usa mientras da clase.
//
// Un toque corto sobre un alumno abre el cuadro de conductas. Mantener el dedo
// apretado llena el casillero y, cuando se completa, lo marca ausente: el
// llenado es la confirmación, así no hay ningún cartel que cortar en el medio.

import * as estado from "../estado.js";
import { el, icono, hoja, avisar, poner } from "./html.js";
import { iniciales, nombreCompleto, ordenar, activos, ORDENES } from "../domain/alumnos.js";
import { visibles } from "../domain/menus.js";
import { clave, enPalabras } from "../domain/dias.js";
import { cuantas, estaAusente, totalDelDia } from "../domain/toques.js";
import { INTERRUPTOR } from "../domain/types.js";
import { enCelda, muebleEnCelda, recorte, vecinos } from "../domain/aula.js";

const SOSTENER = 700; // milisegundos hasta marcar ausente

export function pantallaClase({ parametro, volver }) {
  const curso = estado.curso(parametro);
  if (!curso) return el("div.pantalla", el("p", "Ese curso ya no está."));

  const hoy = clave();
  const menu = estado.menuDe(curso.id);
  const aula = estado.aula(curso.aulaId);
  const enAula = curso.vista === "aula" && aula;

  return el("div.clase", [
    el("header.clase-cabeza", [
      el(
        "button.icono-boton",
        { onclick: volver, "aria-label": "Salir del modo clase" },
        icono("atras"),
      ),
      el("h2", [curso.nombre, el("span.sub", enPalabras(hoy))]),
      el(
        "button.icono-boton",
        { onclick: () => pasarLista(curso, hoy), "aria-label": "Pasar lista" },
        icono("tilde"),
      ),
    ]),

    el("div.clase-cuerpo", enAula ? vistaAula(curso, aula, hoy, menu) : vistaGrilla(curso, hoy, menu)),

    el("footer.clase-pie", [
      aula &&
        el("div.segmentado", { estilo: { flex: "0 0 auto" } }, [
          el(
            "button",
            {
              "aria-pressed": String(!enAula),
              onclick: () => estado.guardarPreferenciaDeVista(curso.id, { vista: "grilla" }),
            },
            "Lista",
          ),
          el(
            "button",
            {
              "aria-pressed": String(!!enAula),
              onclick: () => estado.guardarPreferenciaDeVista(curso.id, { vista: "aula" }),
            },
            "Aula",
          ),
        ]),
      !enAula &&
        el(
          "div.segmentado",
          { estilo: { flex: "1 1 auto" } },
          ORDENES.filter((o) => o.valor !== "propio").map((orden) =>
            el(
              "button",
              {
                "aria-pressed": String((curso.orden || "apellido") === orden.valor),
                onclick: () =>
                  estado.guardarPreferenciaDeVista(curso.id, { orden: orden.valor }),
              },
              orden.etiqueta,
            ),
          ),
        ),
      el(
        "div.pildora",
        { estilo: { flex: "0 0 auto", marginLeft: "auto" } },
        `${toquesDelDia(curso, hoy)} hoy`,
      ),
    ]),
  ]);
}

function toquesDelDia(curso, dia) {
  const ids = new Set(curso.alumnos.map((a) => a.id));
  return estado.datos.toques.filter((t) => ids.has(t.alumno) && clave(t.en) === dia).length;
}

// ------------------------------------------------------------------ vistas

function vistaGrilla(curso, hoy, menu) {
  const lista = ordenar(activos(curso.alumnos), curso.orden || "apellido", curso.ordenPropio);
  if (!lista.length) {
    return el("div.vacio", [
      el("h2", "Curso sin alumnos"),
      el("p", "Agregá la lista desde la ficha del curso."),
    ]);
  }
  return el("div.grilla", lista.map((alumno) => casillero(alumno, curso, hoy, menu)));
}

function vistaAula(curso, aula, hoy, menu) {
  const asientos = estado.asientosDe(curso.id, aula.id);
  const porAlumno = new Map(Object.entries(asientos).map(([lugar, id]) => [id, lugar]));
  const sueltos = activos(curso.alumnos).filter((a) => !porAlumno.has(a.id));

  // En clase se dibuja sólo la parte del aula que tiene algo, para que los
  // escritorios salgan lo más grandes que entren en la pantalla.
  const { c0, c1, f0, f1 } = recorte(aula);
  const plano = el("div.plano.en-clase", {
    estilo: {
      // Nunca por debajo de 46 px: un escritorio tiene que poder tocarse sin
      // apuntar. Si no entra a lo ancho, el plano se desliza.
      gridTemplateColumns: `repeat(${c1 - c0 + 1}, minmax(46px, 1fr))`,
      minWidth: "min-content",
    },
  });

  for (let f = f0; f <= f1; f++) {
    for (let c = c0; c <= c1; c++) {
      const lugar = enCelda(aula, c, f);
      const mueble = muebleEnCelda(aula, c, f);
      const celda = el("div.celda");
      if (mueble) {
        if (mueble.c === c) {
          celda.style.gridColumn = `span ${mueble.ancho || 1}`;
          celda.classList.add("ancha");
          celda.append(
            el(
              "div.mueble" + (mueble.tipo === "puerta" ? ".puerta" : ""),
              mueble.tipo === "puerta" ? "Puerta" : "Pizarrón",
            ),
          );
          c += (mueble.ancho || 1) - 1;
        } else {
          continue;
        }
      } else if (lugar) {
        const alumnoId = asientos[lugar.id];
        const alumno = curso.alumnos.find((a) => a.id === alumnoId && !a.baja);
        celda.append(bancoConAlumno(aula, lugar, alumno, curso, hoy, menu));
      }
      plano.append(celda);
    }
  }

  return [
    plano,
    sueltos.length > 0
      ? el("div", { estilo: { marginTop: "12px" } }, [
          el("div.titulo-seccion", "Sin lugar"),
          el("div.grilla", sueltos.map((a) => casillero(a, curso, hoy, menu))),
        ])
      : null,
  ];
}

function bancoConAlumno(aula, lugar, alumno, curso, hoy, menu) {
  const unidos = vecinos(aula, lugar);
  const clases = Object.entries(unidos)
    .filter(([, si]) => si)
    .map(([lado]) => "une-" + lado)
    .join(".");

  if (!alumno) {
    return el("div.banco.libre" + (clases ? "." + clases : ""), "");
  }

  const ausente = estaAusente(estado.datos.ausencias, alumno.id, hoy);
  const total = totalDelDia(estado.datos.toques, alumno.id, hoy);
  const banco = el(
    "div.banco" + (clases ? "." + clases : ""),
    {
      estilo: {
        opacity: ausente ? "0.35" : total ? "1" : "0.55",
        cursor: "pointer",
      },
    },
    [
      el("span", iniciales(alumno)),
      total > 0 && el("span", { estilo: { marginLeft: "3px" } }, String(total)),
    ],
  );
  engancharToque(banco, alumno, curso, hoy, menu);
  return banco;
}

function casillero(alumno, curso, hoy, menu) {
  const ausente = estaAusente(estado.datos.ausencias, alumno.id, hoy);
  const total = totalDelDia(estado.datos.toques, alumno.id, hoy);
  const conductas = visibles(menu);

  const nodo = el(
    "button.casillero" +
      (ausente ? ".ausente" : "") +
      (!total && !ausente ? ".sin-tocar" : ""),
    [
      el("div.relleno"),
      total > 0 && el("span.cuenta", String(total)),
      el("span.iniciales", iniciales(alumno)),
      el("span.nombrecito", nombreCompleto(alumno)),
      el(
        "span.marcas",
        conductas
          .filter((c) => cuantas(estado.datos.toques, alumno.id, c.id, hoy) > 0)
          .slice(0, 5)
          .map((c) => el("i", { estilo: { background: c.color } })),
      ),
    ],
  );
  engancharToque(nodo, alumno, curso, hoy, menu);
  return nodo;
}

// Marcar una ausencia vuelve a dibujar la pantalla, así que el casillero que
// recibe el dedo levantado ya no es el mismo que lo recibió apretado. Por eso
// el aviso de "recién se sostuvo" vive acá afuera y no en el casillero.
let sostuvoRecien = 0;

/** Toque corto: abre el cuadro. Toque sostenido: marca ausente. */
function engancharToque(nodo, alumno, curso, hoy, menu) {
  let reloj = null;
  let sostuvo = false;

  const empezar = () => {
    sostuvo = false;
    nodo.classList.add("sosteniendo");
    reloj = setTimeout(() => {
      sostuvo = true;
      sostuvoRecien = Date.now();
      nodo.classList.remove("sosteniendo");
      const ausenteAhora = estado.alternarAusencia(alumno.id, hoy);
      if (navigator.vibrate) navigator.vibrate(18);
      avisar(
        ausenteAhora
          ? `${nombreCompleto(alumno)} queda ausente`
          : `${nombreCompleto(alumno)} vuelve a estar presente`,
      );
    }, SOSTENER);
  };

  const soltar = (abrir) => {
    clearTimeout(reloj);
    nodo.classList.remove("sosteniendo");
    const vieneDeUnSostenido = Date.now() - sostuvoRecien < 500;
    if (abrir && !sostuvo && !vieneDeUnSostenido) {
      cuadroDeToque(alumno, curso, hoy, menu);
    }
  };

  nodo.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    empezar();
  });
  nodo.addEventListener("pointerup", () => soltar(true));
  nodo.addEventListener("pointerleave", () => soltar(false));
  nodo.addEventListener("pointercancel", () => soltar(false));
  nodo.addEventListener("contextmenu", (e) => e.preventDefault());
}

// ------------------------------------------------------------ cuadro de toque

function cuadroDeToque(alumno, curso, hoy, menu) {
  const conductas = visibles(menu);
  if (!conductas.length) {
    return avisar("Este menú no tiene conductas todavía");
  }

  let cerrarHoja;
  const cuerpo = el("div");

  const dibujar = () => {
    const ausente = estaAusente(estado.datos.ausencias, alumno.id, hoy);
    poner(
      cuerpo,
      ausente &&
        el(
          "div.pildora.mal",
          { estilo: { marginBottom: "12px" } },
          "Hoy figura ausente",
        ),
      el(
        "div.cuadro-toque",
        conductas.map((conducta) => {
          const veces = cuantas(estado.datos.toques, alumno.id, conducta.id, hoy);
          const prendida = conducta.modo === INTERRUPTOR && veces > 0;
          return el(
            "button.conducta-boton" + (prendida ? ".prendida" : ""),
            {
              estilo: { "--color": conducta.color },
              onclick: () => {
                estado.tocar(alumno.id, conducta);
                if (navigator.vibrate) navigator.vibrate(10);
                cerrarHoja();
              },
            },
            [
              el("span.emoji", conducta.emoji),
              el("span", conducta.nombre),
              veces > 0 &&
                el("span.veces", conducta.modo === INTERRUPTOR ? "✓" : String(veces)),
            ],
          );
        }),
      ),
      el("div.titulo-seccion", "Corregir"),
      el(
        "div.cuadro-toque",
        conductas
          .filter((c) => cuantas(estado.datos.toques, alumno.id, c.id, hoy) > 0)
          .map((conducta) =>
            el(
              "button.conducta-boton",
              {
                estilo: { "--color": conducta.color },
                onclick: () => {
                  estado.deshacerToque(alumno.id, conducta.id, hoy);
                  avisar(`Se borró un «${conducta.nombre}»`);
                  dibujar();
                },
              },
              [el("span.emoji", "−1"), el("span", conducta.nombre)],
            ),
          ),
      ),
      el(
        "button.boton.ancho",
        {
          estilo: { marginTop: "12px" },
          onclick: () => {
            estado.alternarAusencia(alumno.id, hoy);
            cerrarHoja();
          },
        },
        ausente ? "Marcar presente" : "Marcar ausente",
      ),
    );
  };

  dibujar();
  cerrarHoja = hoja(nombreCompleto(alumno), cuerpo).cerrar;
}

// -------------------------------------------------------------- pasar lista

function pasarLista(curso, hoy) {
  const cuerpo = el("div");
  const dibujar = () => {
    const lista = ordenar(activos(curso.alumnos), "apellido");
    const ausentes = lista.filter((a) => estaAusente(estado.datos.ausencias, a.id, hoy));
    poner(
      cuerpo,
      el(
        "p.apunte",
        `${lista.length - ausentes.length} presentes · ${ausentes.length} ausentes`,
      ),
      el("div.tarjeta", { estilo: { padding: "0" } },
        lista.map((alumno, i) => {
          const ausente = estaAusente(estado.datos.ausencias, alumno.id, hoy);
          return el(
            "button.tarjeta.tocable",
            {
              estilo: {
                margin: "0",
                border: "0",
                borderTop: i ? "1px solid var(--linea)" : "0",
                borderRadius: "0",
              },
              onclick: () => {
                estado.alternarAusencia(alumno.id, hoy);
                dibujar();
              },
            },
            el("div.fila", [
              el(
                "div",
                { estilo: { opacity: ausente ? "0.5" : "1" } },
                el("strong", nombreCompleto(alumno)),
              ),
              el(
                "div",
                { estilo: { flex: "0 0 auto" } },
                ausente
                  ? el("span.pildora.mal", "Ausente")
                  : el("span.pildora.bien", "Presente"),
              ),
            ]),
          );
        }),
      ),
    );
  };
  dibujar();
  hoja("Lista de " + enPalabras(hoy), cuerpo);
}
