// Toques y ausencias: lo que se registra durante la clase.
//
// Un toque nunca se edita. Se agrega, o se borra el último si el docente se
// equivocó. Por eso la nube los puede unir sin pensar: dos teléfonos que tocaron
// cosas distintas terminan con la suma de las dos.

import { clave } from "./dias.js";
import { nuevoId } from "./ids.js";
import { INTERRUPTOR } from "./types.js";

/** Cuántas veces un alumno recibió una conducta en un día. */
export function cuantas(toques, alumnoId, conductaId, dia) {
  return toques.filter(
    (t) => t.alumno === alumnoId && t.conducta === conductaId && clave(t.en) === dia,
  ).length;
}

/** Todos los toques de un alumno en un día, sea cual sea la conducta. */
export function totalDelDia(toques, alumnoId, dia) {
  return toques.filter((t) => t.alumno === alumnoId && clave(t.en) === dia).length;
}

/** El toque más reciente que coincide, o null. */
export function ultimo(toques, alumnoId, conductaId, dia) {
  let encontrado = null;
  for (const t of toques) {
    if (t.alumno !== alumnoId || t.conducta !== conductaId) continue;
    if (clave(t.en) !== dia) continue;
    if (!encontrado || t.en >= encontrado.en) encontrado = t;
  }
  return encontrado;
}

/**
 * Qué hacer con un toque nuevo. Devuelve { agregar } o { quitar }, y el store
 * se encarga de guardarlo. Una conducta de interruptor que ya está prendida hoy
 * se apaga en lugar de contar otra vez.
 */
export function alTocar(toques, alumnoId, conducta, ahora = Date.now()) {
  const hoy = clave(ahora);
  if (conducta.modo === INTERRUPTOR && cuantas(toques, alumnoId, conducta.id, hoy) > 0) {
    return { quitar: ultimo(toques, alumnoId, conducta.id, hoy) };
  }
  return {
    agregar: {
      id: nuevoId(),
      alumno: alumnoId,
      conducta: conducta.id,
      en: ahora,
    },
  };
}

export function estaAusente(ausencias, alumnoId, dia) {
  return ausencias.some((a) => a.alumno === alumnoId && a.dia === dia);
}

export function ausenciaDe(ausencias, alumnoId, dia) {
  return ausencias.find((a) => a.alumno === alumnoId && a.dia === dia) || null;
}

/** Cuántos días faltó un alumno, entre los días que se le pasen. */
export function diasAusente(ausencias, alumnoId, dias = null) {
  return ausencias.filter(
    (a) => a.alumno === alumnoId && (!dias || dias.includes(a.dia)),
  ).length;
}
