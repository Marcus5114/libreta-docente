// Aulas: la lista de planos y el editor.
//
// El editor es una grilla de celdas. Tocás una celda vacía y aparece un
// escritorio; arrastrás el dedo y aparecen varios. Dos escritorios pegados se
// dibujan sin la pared del medio, así una fila de cuatro se ve como una mesa
// de cuatro sin que haya que dibujar nada.

import * as estado from "../estado.js";
import { el, icono, hoja, avisar, confirmar, poner } from "./html.js";
import { barra } from "./cursos.js";
import { activos, iniciales, nombreCompleto, ordenar } from "../domain/alumnos.js";
import {
  FORMAS,
  agarrable,
  agregarBanco,
  aplicarForma,
  enCelda,
  levantar,
  libre,
  lugaresEnOrden,
  moverLugar,
  moverMueble,
  muebleEnCelda,
  quitarLugar,
  sentar,
  sentarAutomatico,
  sinLugar,
  vecinos,
} from "../domain/aula.js";

export function pantallaAulas({ ir, volver }) {
  const { aulas } = estado.datos;
  return [
    barra(
      "Aulas",
      [
        el(
          "button.icono-boton",
          {
            onclick: () => {
              const nombre = prompt("Nombre del aula", "Mi aula");
              if (!nombre) return;
              const aula = estado.crearAula(nombre);
              ir(`#/aula/${aula.id}`);
            },
            "aria-label": "Nueva aula",
          },
          icono("mas"),
        ),
      ],
      volver,
    ),
    el("main.pantalla", [
      el(
        "p.apunte",
        "Un aula describe muebles, no personas. Cualquier curso puede mostrarse en cualquier aula, y cada curso guarda sus propios lugares.",
      ),
      !aulas.length
        ? el("div.vacio", [
            el("h2", "Sin aulas"),
            el("p", "Armá el plano de tu aula para tocar a los alumnos donde están sentados."),
          ])
        : el(
            "div",
            aulas.map((aula) =>
              el(
                "button.tarjeta.tocable",
                { onclick: () => ir(`#/aula/${aula.id}`) },
                el("div.fila", [
                  el("div", [
                    el("strong", aula.nombre),
                    el("div.apunte", `${aula.lugares.length} escritorios`),
                  ]),
                  el("div", { estilo: { flex: "0 0 auto" } }, miniatura(aula)),
                ]),
              ),
            ),
          ),
    ]),
  ];
}

function miniatura(aula) {
  const caja = el("div", {
    estilo: {
      display: "grid",
      gridTemplateColumns: `repeat(${aula.columnas}, minmax(0, 1fr))`,
      gap: "1px",
      width: "72px",
    },
  });
  for (let f = 0; f < aula.filas; f++) {
    for (let c = 0; c < aula.columnas; c++) {
      const hay = enCelda(aula, c, f);
      caja.append(
        el("div", {
          estilo: {
            aspectRatio: "1",
            background: hay ? "var(--tinta-media)" : "var(--cebra)",
            borderRadius: "1px",
          },
        }),
      );
    }
  }
  return caja;
}

// ------------------------------------------------------------------ editor

const MODOS = [
  { valor: "agregar", etiqueta: "Agregar" },
  { valor: "mover", etiqueta: "Mover" },
  { valor: "quitar", etiqueta: "Quitar" },
  { valor: "sentar", etiqueta: "Sentar" },
];

const AYUDA = {
  agregar: "Deslizá para poner varios",
  mover: "Tocá qué mover y después adónde",
  quitar: "Deslizá para sacar varios",
  sentar: "Tocá un escritorio",
};

export function pantallaAula({ parametro, volver }) {
  const aula = estado.aula(parametro);
  if (!aula) return el("div.pantalla", el("p", "Esa aula ya no está."));

  let modo = pantallaAula.modo || "agregar";
  // Lo agarrado en el modo Mover: { tipo: "lugar" | "mueble", id }.
  let agarrado = null;
  const curso = estado.cursoActual();
  const sentando = () => modo === "sentar" && curso;
  const asientos = () =>
    curso ? estado.asientosDe(curso.id, aula.id) : {};

  const contenedor = el("div.clase");
  const zonaPlano = el("div.clase-cuerpo");
  const piePersonas = el("div");

  const dibujar = () => {
    poner(zonaPlano, planoEditable(), sentando() ? piePersonas : null);
    if (sentando()) dibujarSueltos();
    dibujarPie();
  };

  const planoEditable = () => {
    const plano = el("div.plano", {
      estilo: {
        gridTemplateColumns: `repeat(${aula.columnas}, minmax(0, 1fr))`,
      },
    });

    let pintando = false;
    const pintar = (c, f) => {
      if (modo === "agregar" && libre(aula, c, f)) {
        estado.guardarAula(aula.id, (a) => agregarBanco(a, c, f));
        dibujar();
      }
      if (modo === "quitar") {
        const lugar = enCelda(aula, c, f);
        if (lugar) {
          estado.guardarAula(aula.id, (a) => {
            quitarLugar(a, lugar.id);
            for (const cur of estado.datos.cursos) {
              if (cur.asientos?.[aula.id]) delete cur.asientos[aula.id][lugar.id];
            }
          });
          dibujar();
        }
      }
    };

    for (let f = 0; f < aula.filas; f++) {
      for (let c = 0; c < aula.columnas; c++) {
        const lugar = enCelda(aula, c, f);
        const mueble = muebleEnCelda(aula, c, f);
        if (mueble && mueble.c !== c) continue;

        // El dibujo de un mueble adelanta `c` hasta su última celda, así que
        // la columna donde se tocó se guarda antes de eso.
        const columna = c;
        const celda = el("div.celda" + (lugar || mueble ? "" : ".vacia"), {
          datos: { c, f },
        });

        if (mueble) {
          celda.style.gridColumn = `span ${mueble.ancho || 1}`;
          celda.classList.add("ancha");
          celda.append(
            el(
              "div.mueble" +
                (mueble.tipo === "puerta" ? ".puerta" : "") +
                (agarrado?.id === mueble.id ? ".elegido" : ""),
              mueble.tipo === "puerta" ? "Puerta" : "Pizarrón",
            ),
          );
          c += (mueble.ancho || 1) - 1;
        } else if (lugar) {
          celda.append(bancoDibujado(lugar));
        }

        celda.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          if (sentando()) {
            if (lugar) elegirQuienSeSienta(lugar);
            return;
          }
          if (modo === "mover") {
            tocarParaMover(columna, f);
            return;
          }
          pintando = true;
          pintar(c, f);
        });
        celda.addEventListener("pointerenter", () => {
          if (pintando && !sentando()) pintar(Number(celda.dataset.c), Number(celda.dataset.f));
        });
        plano.append(celda);
      }
    }

    const soltar = () => (pintando = false);
    plano.addEventListener("pointerup", soltar);
    plano.addEventListener("pointerleave", soltar);
    plano.addEventListener("pointercancel", soltar);

    return plano;
  };

  /**
   * Mover es en dos toques: uno elige qué, el otro adónde. En una pantalla
   * chica sale mejor que arrastrar, porque el dedo tapa justamente lo que se
   * está moviendo y soltar fuera de lugar es fácil.
   */
  const tocarParaMover = (c, f) => {
    const aquí = agarrable(aula, c, f);

    if (!agarrado) {
      if (!aquí) return avisar("Tocá un escritorio, el pizarrón o la puerta");
      agarrado = { tipo: aquí.tipo, id: aquí.cosa.id };
      dibujar();
      return;
    }

    // Tocar de nuevo lo agarrado lo suelta.
    if (aquí && aquí.cosa.id === agarrado.id) {
      agarrado = null;
      dibujar();
      return;
    }

    let movido = false;
    const queMueve = agarrado;
    estado.guardarAula(aula.id, (a) => {
      movido =
        queMueve.tipo === "mueble"
          ? moverMueble(a, queMueve.id, c, f)
          : moverLugar(a, queMueve.id, c, f);
    });

    if (movido) {
      agarrado = null;
      dibujar();
      return;
    }

    // No entraba: si lo tocado es otra cosa, se pasa a mover esa.
    if (aquí) {
      agarrado = { tipo: aquí.tipo, id: aquí.cosa.id };
      dibujar();
    } else {
      avisar("Ahí no entra");
    }
  };

  const bancoDibujado = (lugar) => {
    const unidos = vecinos(aula, lugar);
    const clases = Object.entries(unidos)
      .filter(([, si]) => si)
      .map(([lado]) => "une-" + lado)
      .join(".");
    let texto = "";
    if (sentando()) {
      const alumnoId = asientos()[lugar.id];
      const alumno = curso.alumnos.find((a) => a.id === alumnoId);
      texto = alumno ? iniciales(alumno) : "";
    }
    return el(
      "div.banco" +
        (clases ? "." + clases : "") +
        (sentando() && !texto ? ".libre" : "") +
        (agarrado?.id === lugar.id ? ".elegido" : ""),
      texto || (sentando() ? "+" : ""),
    );
  };

  const dibujarSueltos = () => {
    const libres = sinLugar(activos(curso.alumnos), asientos());
    poner(
      piePersonas,
      el("div.titulo-seccion", `Sin lugar (${libres.length})`),
      libres.length
        ? el(
            "div",
            { estilo: { display: "flex", flexWrap: "wrap", gap: "6px" } },
            libres.map((alumno) => el("span.pildora", nombreCompleto(alumno))),
          )
        : el("p.apunte", "Están todos sentados."),
      el(
        "button.boton.ancho",
        {
          estilo: { marginTop: "12px" },
          onclick: () => {
            estado.guardarAsientos(
              curso.id,
              aula.id,
              sentarAutomatico(aula, activos(curso.alumnos)),
            );
            dibujar();
            avisar("Sentados por apellido, primera fila primero");
          },
        },
        "Sentar automáticamente",
      ),
    );
  };

  const elegirQuienSeSienta = (lugar) => {
    const mapa = asientos();
    const actual = mapa[lugar.id];
    hoja("¿Quién se sienta acá?", (cerrar) => [
      actual &&
        el(
          "button.boton.ancho",
          {
            onclick: () => {
              const copia = { ...mapa };
              delete copia[lugar.id];
              estado.guardarAsientos(curso.id, aula.id, copia);
              cerrar();
              dibujar();
            },
          },
          "Dejar el lugar vacío",
        ),
      el(
        "div.tarjeta",
        { estilo: { padding: "0", marginTop: "12px" } },
        ordenar(activos(curso.alumnos), "apellido").map((alumno, i) =>
          el(
            "button.tarjeta.tocable",
            {
              estilo: {
                margin: "0",
                border: "0",
                borderTop: i ? "1px solid var(--linea)" : "0",
                borderRadius: "0",
              },
              onclick: () => {
                const copia = { ...mapa };
                sentar(copia, lugar.id, alumno.id);
                estado.guardarAsientos(curso.id, aula.id, copia);
                cerrar();
                dibujar();
              },
            },
            el("div.fila", [
              el("strong", nombreCompleto(alumno)),
              alumno.id === actual &&
                el("div", { estilo: { flex: "0 0 auto" } }, icono("tilde", 16)),
            ]),
          ),
        ),
      ),
    ]);
  };

  const pie = el("footer.clase-pie.apilado");

  const dibujarPie = () =>
    poner(
      pie,
      el(
        "div.apunte",
        { estilo: { textAlign: "center" } },
        agarrado
          ? "Ahora tocá adónde va"
          : sentando()
            ? `Tocá un escritorio para sentar a ${curso.nombre}`
            : AYUDA[modo],
      ),
      el(
        "div.segmentado",
        MODOS.filter((m) => m.valor !== "sentar" || curso).map((m) =>
          el(
            "button",
            {
              "aria-pressed": String(modo === m.valor),
              onclick: () => {
                modo = m.valor;
                pantallaAula.modo = m.valor;
                agarrado = null;
                dibujar();
              },
            },
            m.etiqueta,
          ),
        ),
      ),
    );

  poner(contenedor, [
    el("header.clase-cabeza", [
      el("button.icono-boton", { onclick: volver, "aria-label": "Volver" }, icono("atras")),
      el("h2", [aula.nombre, el("span.sub", `${aula.lugares.length} escritorios`)]),
      el(
        "button.icono-boton",
        { onclick: () => opcionesDeAula(aula, dibujar, volver), "aria-label": "Opciones" },
        icono("menu"),
      ),
    ]),
    zonaPlano,
    pie,
  ]);

  dibujarPie();
  dibujar();
  return contenedor;
}

function opcionesDeAula(aula, dibujar, volver) {
  hoja(aula.nombre, (cerrar) => [
    el("label.campo", [
      el("span", "Nombre"),
      el("input", {
        value: aula.nombre,
        onchange: (e) => estado.guardarAula(aula.id, (a) => (a.nombre = e.target.value)),
      }),
    ]),

    el("div.titulo-seccion", "Empezar de una forma"),
    el("p.apunte", "Reemplaza los escritorios que haya por una disposición armada."),
    ...FORMAS.map((forma) =>
      el(
        "button.boton.ancho",
        {
          estilo: { marginBottom: "8px" },
          onclick: async () => {
            if (
              aula.lugares.length &&
              !(await confirmar(
                "¿Reemplazar el plano?",
                "Se quitan los escritorios actuales y se arma la forma elegida.",
                "Reemplazar",
              ))
            ) {
              return;
            }
            estado.guardarAula(aula.id, (a) => aplicarForma(a, forma.valor));
            cerrar();
            dibujar();
          },
        },
        [el("strong", forma.etiqueta), el("span.apunte", " · " + forma.ayuda)],
      ),
    ),

    el("div.titulo-seccion", "Cuidado"),
    el(
      "button.boton.ancho",
      {
        onclick: async () => {
          if (await confirmar("¿Vaciar el aula?", "Quedan sólo el pizarrón y la puerta.", "Vaciar")) {
            estado.guardarAula(aula.id, (a) => (a.lugares = []));
            cerrar();
            dibujar();
          }
        },
      },
      "Vaciar el plano",
    ),
    el(
      "button.boton.ancho.peligro",
      {
        estilo: { marginTop: "8px" },
        onclick: async () => {
          if (
            await confirmar(
              `¿Borrar ${aula.nombre}?`,
              "Se pierden también los lugares que cada curso tenía en esta aula.",
              "Borrar el aula",
            )
          ) {
            estado.borrarAula(aula.id);
            cerrar();
            volver();
          }
        },
      },
      "Borrar esta aula",
    ),
  ]);
}

export { lugaresEnOrden, levantar };
