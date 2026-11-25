// Cursos: la lista de todos y la ficha de uno.

import * as estado from "../estado.js";
import { el, icono, hoja, confirmar, avisar } from "./html.js";
import { activos, apellidoPrimero, ordenar } from "../domain/alumnos.js";
import { visibles } from "../domain/menus.js";
import { clave } from "../domain/dias.js";
import { estaAusente } from "../domain/toques.js";
import { trabajosDe } from "../domain/trabajos.js";
import { editorDeMenu } from "./menus.js";

export function pantallaCursos({ ir }) {
  const { cursos } = estado.datos;

  if (!cursos.length) {
    return [
      barra("Libreta Docente"),
      el("main.pantalla", [
        el("div.vacio", [
          el("h2", "Todavía no hay cursos"),
          el("p", "Creá el primero pegando la lista de alumnos. Lleva un minuto."),
          el("button.boton.primario", { onclick: () => nuevoCurso(ir) }, "Crear un curso"),
        ]),
      ]),
    ];
  }

  return [
    barra("Libreta Docente", [
      el(
        "button.icono-boton",
        { onclick: () => nuevoCurso(ir), "aria-label": "Nuevo curso" },
        icono("mas"),
      ),
    ]),
    el("main.pantalla", [
      el("div.titulo-seccion", "Mis cursos"),
      ...cursos.map((curso) => tarjetaDeCurso(curso, ir)),
      el("div.titulo-seccion", "Lo compartido"),
      el(
        "button.tarjeta.tocable",
        { onclick: () => ir("#/aulas") },
        el("div.fila", [
          el("div", [
            el("strong", "Aulas"),
            el("div.apunte", `${estado.datos.aulas.length} plano(s) de escritorios`),
          ]),
          el("div", { estilo: { flex: "0 0 auto" } }, icono("aula")),
        ]),
      ),
      el(
        "button.tarjeta.tocable",
        { onclick: () => abrirMenus() },
        el("div.fila", [
          el("div", [
            el("strong", "Menús de conductas"),
            el("div.apunte", `${estado.datos.menus.length} menú(s)`),
          ]),
          el("div", { estilo: { flex: "0 0 auto" } }, icono("menu")),
        ]),
      ),
    ]),
  ];
}

function tarjetaDeCurso(curso, ir) {
  const hoy = clave();
  const presentes = activos(curso.alumnos).filter(
    (a) => !estaAusente(estado.datos.ausencias, a.id, hoy),
  ).length;
  const toquesHoy = estado.datos.toques.filter(
    (t) => curso.alumnos.some((a) => a.id === t.alumno) && clave(t.en) === hoy,
  ).length;
  const pendientes = trabajosDe(estado.datos.trabajos, curso.id).length;

  return el("div.tarjeta", [
    el("div.fila", [
      el("div", [
        el("h2", curso.nombre),
        el(
          "div.apunte",
          `${activos(curso.alumnos).length} alumnos · ${pendientes} trabajo(s)`,
        ),
      ]),
      el(
        "div",
        { estilo: { flex: "0 0 auto" } },
        el(
          "button.icono-boton",
          { onclick: () => ir(`#/curso/${curso.id}`), "aria-label": "Ver curso" },
          icono("lapiz"),
        ),
      ),
    ]),
    el("div.botonera", [
      el(
        "button.boton.primario",
        {
          onclick: () => {
            estado.elegirCurso(curso.id);
            ir(`#/clase/${curso.id}`);
          },
        },
        "Empezar clase",
      ),
    ]),
    toquesHoy > 0 &&
      el(
        "div.apunte",
        { estilo: { marginTop: "10px" } },
        `Hoy: ${toquesHoy} toque(s), ${presentes} presente(s)`,
      ),
  ]);
}

export function pantallaCurso({ parametro, ir, volver }) {
  const curso = estado.curso(parametro);
  if (!curso) return [barra("Curso"), el("main.pantalla", el("p", "Ese curso ya no está."))];

  const menu = estado.menuDe(curso.id);
  const aula = estado.aula(curso.aulaId);
  const lista = ordenar(curso.alumnos, "apellido");

  return [
    barra(curso.nombre, [
      el(
        "button.icono-boton",
        {
          onclick: async () => {
            const nombre = prompt("Nombre del curso", curso.nombre);
            if (nombre) estado.renombrarCurso(curso.id, nombre);
          },
          "aria-label": "Renombrar",
        },
        icono("lapiz"),
      ),
    ], volver),
    el("main.pantalla", [
      el("div.botonera", { estilo: { marginTop: "0", marginBottom: "16px" } }, [
        el(
          "button.boton.primario",
          {
            onclick: () => {
              estado.elegirCurso(curso.id);
              ir(`#/clase/${curso.id}`);
            },
          },
          "Empezar clase",
        ),
      ]),

      el("div.titulo-seccion", "Cómo se registra"),
      el(
        "button.tarjeta.tocable",
        { onclick: () => elegirMenu(curso) },
        el("div.fila", [
          el("div", [
            el("strong", menu ? menu.nombre : "Sin menú"),
            el(
              "div.apunte",
              menu
                ? visibles(menu).map((c) => c.emoji + " " + c.nombre).join("  ·  ")
                : "Elegí qué conductas vas a registrar",
            ),
          ]),
          el("div", { estilo: { flex: "0 0 auto" } }, icono("menu")),
        ]),
      ),
      el(
        "button.tarjeta.tocable",
        { onclick: () => elegirAula(curso, ir) },
        el("div.fila", [
          el("div", [
            el("strong", aula ? aula.nombre : "Sin aula"),
            el(
              "div.apunte",
              aula
                ? `${aula.lugares.length} escritorios`
                : "Opcional: un plano para tocar donde están sentados",
            ),
          ]),
          el("div", { estilo: { flex: "0 0 auto" } }, icono("aula")),
        ]),
      ),

      el("div.titulo-seccion", `Alumnos (${activos(curso.alumnos).length})`),
      el("div.tarjeta", { estilo: { padding: "0" } }, [
        ...lista.map((alumno, i) =>
          el(
            "button.tarjeta.tocable",
            {
              onclick: () => editarAlumno(curso, alumno),
              estilo: {
                margin: "0",
                border: "0",
                borderTop: i ? "1px solid var(--linea)" : "0",
                borderRadius: "0",
                opacity: alumno.baja ? "0.45" : "1",
              },
            },
            el("div.fila", [
              el("div", [
                el("strong", apellidoPrimero(alumno)),
                alumno.baja && el("div.apunte", "Dado de baja"),
              ]),
              el("div", { estilo: { flex: "0 0 auto" } }, icono("lapiz", 16)),
            ]),
          ),
        ),
      ]),
      el(
        "button.boton.ancho",
        { onclick: () => agregarAlumnos(curso) },
        [icono("mas", 18), "Agregar alumnos"],
      ),

      el("div.titulo-seccion", "Cuidado"),
      el(
        "button.boton.ancho.peligro",
        {
          onclick: async () => {
            const seguro = await confirmar(
              `¿Borrar ${curso.nombre}?`,
              "Se borran también sus toques, ausencias, trabajos y notas. No se puede deshacer.",
              "Borrar el curso",
            );
            if (seguro) {
              estado.borrarCurso(curso.id);
              ir("#/");
            }
          },
        },
        "Borrar este curso",
      ),
    ]),
  ];
}

// ----------------------------------------------------------------- piezas

export function barra(titulo, acciones = [], volver = null) {
  return el("header.barra", [
    volver &&
      el(
        "button.icono-boton",
        { onclick: volver, "aria-label": "Volver" },
        icono("atras"),
      ),
    el("h1", titulo),
    ...acciones,
  ]);
}

function nuevoCurso(ir) {
  let nombre = "";
  let lista = "";
  const { cerrar } = hoja("Curso nuevo", (cerrarHoja) => [
    el("label.campo", [
      el("span", "Nombre del curso"),
      el("input", {
        placeholder: "4° A · Innovación Tecnológica",
        oninput: (e) => (nombre = e.target.value),
        autofocus: true,
      }),
    ]),
    el("label.campo", [
      el("span", "Lista de alumnos"),
      el("textarea", {
        placeholder: "Un alumno por línea:\n\nPérez, Juan\nGómez, María\nÁlvarez, Lucas",
        oninput: (e) => (lista = e.target.value),
      }),
      el(
        "div.apunte",
        "Acepta «Apellido, Nombre» o «Nombre Apellido». Los números de orden se descartan.",
      ),
    ]),
    el("div.botonera", [
      el("button.boton", { onclick: cerrarHoja }, "Cancelar"),
      el(
        "button.boton.primario",
        {
          onclick: () => {
            if (!nombre.trim()) return avisar("Falta el nombre del curso");
            const curso = estado.crearCurso(nombre, lista);
            cerrarHoja();
            ir(`#/curso/${curso.id}`);
          },
        },
        "Crear",
      ),
    ]),
  ]);
  return cerrar;
}

function agregarAlumnos(curso) {
  let lista = "";
  hoja("Agregar alumnos", (cerrar) => [
    el("label.campo", [
      el("span", "Uno por línea"),
      el("textarea", { autofocus: true, oninput: (e) => (lista = e.target.value) }),
    ]),
    el("div.botonera", [
      el("button.boton", { onclick: cerrar }, "Cancelar"),
      el(
        "button.boton.primario",
        {
          onclick: () => {
            const nuevos = estado.agregarAlumnos(curso.id, lista);
            cerrar();
            avisar(`${nuevos.length} alumno(s) agregado(s)`);
          },
        },
        "Agregar",
      ),
    ]),
  ]);
}

function editarAlumno(curso, alumno) {
  let nombre = alumno.nombre;
  let apellido = alumno.apellido;
  hoja(apellidoPrimero(alumno), (cerrar) => [
    el("div.fila", [
      el("label.campo", [
        el("span", "Nombre"),
        el("input", { value: nombre, oninput: (e) => (nombre = e.target.value) }),
      ]),
      el("label.campo", [
        el("span", "Apellido"),
        el("input", { value: apellido, oninput: (e) => (apellido = e.target.value) }),
      ]),
    ]),
    el(
      "button.boton.ancho",
      {
        onclick: () => {
          estado.darDeBaja(curso.id, alumno.id, !alumno.baja);
          cerrar();
          avisar(alumno.baja ? "Volvió al curso" : "Dado de baja; su historia queda");
        },
      },
      alumno.baja ? "Traer de vuelta al curso" : "Dar de baja",
    ),
    el("div.botonera", [
      el("button.boton", { onclick: cerrar }, "Cancelar"),
      el(
        "button.boton.primario",
        {
          onclick: () => {
            estado.editarAlumno(curso.id, alumno.id, { nombre, apellido });
            cerrar();
          },
        },
        "Guardar",
      ),
    ]),
  ]);
}

function elegirMenu(curso) {
  hoja("Menú de conductas", (cerrar) => [
    el("p.apunte", "El menú que aparece al tocar a un alumno. Se puede compartir entre cursos."),
    ...estado.datos.menus.map((menu) =>
      el(
        "button.tarjeta.tocable",
        {
          onclick: () => {
            estado.guardarPreferenciaDeVista(curso.id, { menuId: menu.id });
            cerrar();
          },
        },
        el("div.fila", [
          el("div", [
            el("strong", menu.nombre),
            el(
              "div.apunte",
              visibles(menu).map((c) => c.emoji).join(" ") || "Sin conductas",
            ),
          ]),
          menu.id === curso.menuId &&
            el("div", { estilo: { flex: "0 0 auto" } }, icono("tilde")),
        ]),
      ),
    ),
    el("div.botonera", [
      el(
        "button.boton",
        {
          onclick: () => {
            cerrar();
            abrirMenus();
          },
        },
        "Editar menús",
      ),
    ]),
  ]);
}

export function abrirMenus() {
  hoja("Menús de conductas", (cerrar) => [
    ...estado.datos.menus.map((menu) =>
      el(
        "button.tarjeta.tocable",
        {
          onclick: () => {
            cerrar();
            editorDeMenu(menu.id);
          },
        },
        el("div.fila", [
          el("div", [
            el("strong", menu.nombre),
            el(
              "div.apunte",
              visibles(menu).map((c) => `${c.emoji} ${c.nombre}`).join("  ·  ") ||
                "Sin conductas",
            ),
          ]),
          el("div", { estilo: { flex: "0 0 auto" } }, icono("lapiz", 16)),
        ]),
      ),
    ),
    el(
      "button.boton.ancho",
      {
        onclick: () => {
          const menu = estado.crearMenu("Menú nuevo");
          cerrar();
          editorDeMenu(menu.id);
        },
      },
      [icono("mas", 18), "Menú nuevo"],
    ),
  ]);
}

function elegirAula(curso, ir) {
  hoja("Aula del curso", (cerrar) => [
    el("p.apunte", "Elegí en qué plano se sienta este curso. El plano se comparte entre cursos."),
    el(
      "button.tarjeta.tocable",
      {
        onclick: () => {
          estado.guardarPreferenciaDeVista(curso.id, { aulaId: null, vista: "grilla" });
          cerrar();
        },
      },
      el("div.fila", [
        el("div", [
          el("strong", "Sin aula"),
          el("div.apunte", "Casilleros ordenados por apellido"),
        ]),
        !curso.aulaId && el("div", { estilo: { flex: "0 0 auto" } }, icono("tilde")),
      ]),
    ),
    ...estado.datos.aulas.map((aula) =>
      el(
        "button.tarjeta.tocable",
        {
          onclick: () => {
            estado.guardarPreferenciaDeVista(curso.id, { aulaId: aula.id });
            cerrar();
          },
        },
        el("div.fila", [
          el("div", [
            el("strong", aula.nombre),
            el("div.apunte", `${aula.lugares.length} escritorios`),
          ]),
          aula.id === curso.aulaId &&
            el("div", { estilo: { flex: "0 0 auto" } }, icono("tilde")),
        ]),
      ),
    ),
    el(
      "button.boton.ancho",
      {
        onclick: () => {
          cerrar();
          ir("#/aulas");
        },
      },
      "Administrar aulas",
    ),
  ]);
}
