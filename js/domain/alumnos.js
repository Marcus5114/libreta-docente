// Alumnos: cómo se leen de una lista pegada, cómo se ordenan y cómo se muestran.

import { nuevoId } from "./ids.js";

/**
 * Lee una lista pegada y devuelve alumnos. Acepta un alumno por línea, en
 * cualquiera de estas formas, que son las que salen de una planilla o del SIU:
 *
 *   Pérez, Juan
 *   Juan Pérez
 *   12. Pérez, Juan        (el número de orden se descarta)
 *
 * Con coma, lo de la izquierda es el apellido: así vienen casi todas las
 * listas de clase. Sin coma se lee «Nombre Apellido», que es como se escribe
 * un nombre a mano, así que la primera palabra es el nombre y el resto el
 * apellido. Un nombre compuesto sin coma («Juan Martín De la Fuente») queda
 * partido donde no va; para esos casos conviene la coma, y si no, se corrige
 * desde la ficha del alumno.
 */
export function leerLista(texto) {
  return String(texto)
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((linea) => linea.replace(/^\s*\d+\s*[.)\-–]?\s+/, "")) // número de orden
    .filter(Boolean)
    .map(unAlumno);
}

function unAlumno(linea) {
  let apellido = "";
  let nombre = "";
  if (linea.includes(",")) {
    const [izq, ...der] = linea.split(",");
    apellido = izq.trim();
    nombre = der.join(",").trim();
  } else {
    const palabras = linea.split(/\s+/);
    nombre = palabras.shift();
    apellido = palabras.join(" ");
  }
  return { id: nuevoId(), nombre, apellido, actualizadoEn: Date.now() };
}

/** "Juan Pérez" */
export function nombreCompleto(alumno) {
  return [alumno.nombre, alumno.apellido].filter(Boolean).join(" ").trim();
}

/** "Pérez, Juan", para listas y planillas. */
export function apellidoPrimero(alumno) {
  if (!alumno.apellido) return alumno.nombre;
  return `${alumno.apellido}, ${alumno.nombre}`.trim();
}

/** Las iniciales que van en el casillero: "JP". */
export function iniciales(alumno) {
  const a = (alumno.nombre || "").trim()[0] || "";
  const b = (alumno.apellido || "").trim()[0] || "";
  return (a + b).toUpperCase() || "?";
}

export const ORDENES = [
  { valor: "apellido", etiqueta: "Por apellido" },
  { valor: "nombre", etiqueta: "Por nombre" },
  { valor: "propio", etiqueta: "A mano" },
];

/** Los alumnos en el orden pedido. No modifica la lista original. */
export function ordenar(alumnos, orden = "apellido", ordenPropio = []) {
  const lista = [...alumnos];
  if (orden === "propio" && ordenPropio.length) {
    const lugar = new Map(ordenPropio.map((id, i) => [id, i]));
    return lista.sort(
      (a, b) => (lugar.get(a.id) ?? 1e9) - (lugar.get(b.id) ?? 1e9),
    );
  }
  const comparar = new Intl.Collator("es", { sensitivity: "base" }).compare;
  if (orden === "nombre") {
    return lista.sort(
      (a, b) => comparar(a.nombre, b.nombre) || comparar(a.apellido, b.apellido),
    );
  }
  return lista.sort(
    (a, b) => comparar(a.apellido, b.apellido) || comparar(a.nombre, b.nombre),
  );
}

/** Los que siguen en el curso. Los dados de baja conservan su historia. */
export function activos(alumnos) {
  return alumnos.filter((a) => !a.baja);
}
