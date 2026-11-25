// Trabajos prácticos y exámenes, y lo que cada alumno hizo con ellos.
//
// Un trabajo es algo que el docente le da al curso una vez: tiene número, nombre,
// el día en que se entregó la consigna, la fecha límite y, si hubo, la fecha de
// reentrega. Una entrega es lo que un alumno hizo con ese trabajo.
//
// La nota de la reentrega se guarda aparte de la original, para que quede
// registro de las dos. La que cuenta para el promedio es la última que haya.

import { nuevoId } from "./ids.js";
import { clave } from "./dias.js";
import { ENTREGADO, EXAMEN, NO_ENTREGADO, PENDIENTE, TP } from "./types.js";

export const TIPOS = [
  { valor: TP, etiqueta: "Trabajo práctico", corto: "TP" },
  { valor: EXAMEN, etiqueta: "Examen", corto: "Ex" },
];

export function nuevoTrabajo(cursoId, tipo = TP) {
  return {
    id: nuevoId(),
    cursoId,
    tipo,
    numero: "",
    nombre: "",
    fechaConsigna: clave(),
    fechaLimite: "",
    fechaReentrega: "",
    notaMaxima: 10,
    notaAprobacion: 6,
    peso: 1,
    observaciones: "",
    actualizadoEn: Date.now(),
  };
}

export function nuevaEntrega(trabajoId, alumnoId) {
  return {
    id: nuevoId(),
    trabajoId,
    alumnoId,
    estado: PENDIENTE,
    aTiempo: true,
    reentrega: false,
    nota: null,
    notaReentrega: null,
    comentario: "",
    actualizadoEn: Date.now(),
  };
}

/** "TP 3 · Landing page" o "Examen · Primer parcial". Lo que se muestra arriba. */
export function titulo(trabajo) {
  const tipo = TIPOS.find((t) => t.valor === trabajo.tipo);
  const cabeza = [tipo?.corto, trabajo.numero].filter(Boolean).join(" ");
  return [cabeza, trabajo.nombre].filter(Boolean).join(" · ") || "Sin título";
}

/** Corto, para encabezados de tabla: "TP 3". */
export function tituloCorto(trabajo) {
  const tipo = TIPOS.find((t) => t.valor === trabajo.tipo);
  const cabeza = [tipo?.corto, trabajo.numero].filter(Boolean).join(" ");
  return cabeza || trabajo.nombre || "—";
}

/** La nota que cuenta: la de la reentrega si la hubo, si no la original. */
export function notaFinal(entrega) {
  if (!entrega) return null;
  if (entrega.notaReentrega !== null && entrega.notaReentrega !== undefined) {
    return entrega.notaReentrega;
  }
  return entrega.nota ?? null;
}

export function aprobado(entrega, trabajo) {
  const nota = notaFinal(entrega);
  if (nota === null) return null;
  return nota >= (trabajo?.notaAprobacion ?? 6);
}

/** Las entregas de un trabajo, una por alumno, creando las que falten. */
export function entregasDe(entregas, trabajoId) {
  return entregas.filter((e) => e.trabajoId === trabajoId);
}

export function entregaDe(entregas, trabajoId, alumnoId) {
  return (
    entregas.find((e) => e.trabajoId === trabajoId && e.alumnoId === alumnoId) || null
  );
}

/**
 * El resumen de un trabajo sobre un curso: cuántos entregaron, cuántos a
 * tiempo, cuántos reentregaron, cuántos aprobaron y el promedio del curso.
 */
export function resumen(trabajo, entregas, alumnos) {
  const ids = new Set(alumnos.map((a) => a.id));
  const propias = entregasDe(entregas, trabajo.id).filter((e) => ids.has(e.alumnoId));
  const entregados = propias.filter((e) => e.estado === ENTREGADO);
  const notas = propias.map(notaFinal).filter((n) => n !== null);
  return {
    total: alumnos.length,
    entregados: entregados.length,
    pendientes: alumnos.length - propias.filter((e) => e.estado !== PENDIENTE).length,
    noEntregados: propias.filter((e) => e.estado === NO_ENTREGADO).length,
    tarde: entregados.filter((e) => !e.aTiempo).length,
    reentregas: propias.filter((e) => e.reentrega).length,
    aprobados: propias.filter((e) => aprobado(e, trabajo) === true).length,
    calificados: notas.length,
    promedio: notas.length ? redondear(suma(notas) / notas.length) : null,
  };
}

/**
 * El promedio de un alumno sobre varios trabajos. Un trabajo no entregado
 * cuenta como cero si `noEntregadoEsCero`; si no, se saltea.
 */
export function promedioDe(alumnoId, trabajos, entregas, noEntregadoEsCero = true) {
  let puntos = 0;
  let pesos = 0;
  for (const trabajo of trabajos) {
    const entrega = entregas.find(
      (e) => e.trabajoId === trabajo.id && e.alumnoId === alumnoId,
    );
    const peso = trabajo.peso || 1;
    const nota = notaFinal(entrega);
    if (nota !== null) {
      puntos += nota * peso;
      pesos += peso;
    } else if (noEntregadoEsCero && entrega?.estado === NO_ENTREGADO) {
      pesos += peso;
    }
  }
  return pesos ? redondear(puntos / pesos) : null;
}

/** Lo que le falta a un alumno: trabajos sin entregar o sin nota. */
export function pendientesDe(alumnoId, trabajos, entregas) {
  return trabajos.filter((trabajo) => {
    const entrega = entregas.find(
      (e) => e.trabajoId === trabajo.id && e.alumnoId === alumnoId,
    );
    if (!entrega || entrega.estado === PENDIENTE) return true;
    return entrega.estado === ENTREGADO && notaFinal(entrega) === null;
  });
}

/** Los trabajos de un curso, el más reciente primero. */
export function trabajosDe(trabajos, cursoId) {
  return trabajos
    .filter((t) => t.cursoId === cursoId)
    .sort(
      (a, b) =>
        (b.fechaConsigna || "").localeCompare(a.fechaConsigna || "") ||
        b.actualizadoEn - a.actualizadoEn,
    );
}

/** Los mismos, del más viejo al más nuevo, que es como se leen en una planilla. */
export function trabajosEnOrden(trabajos, cursoId) {
  return trabajosDe(trabajos, cursoId).reverse();
}

const suma = (ns) => ns.reduce((t, n) => t + n, 0);
const redondear = (n) => Math.round(n * 100) / 100;

/** La nota escrita para mostrar: "8", "7,5" o "—". */
export function escribirNota(nota) {
  if (nota === null || nota === undefined || nota === "") return "—";
  return String(nota).replace(".", ",");
}

/** Lee una nota tipeada, con coma o con punto. Devuelve null si está vacía. */
export function leerNota(texto, maxima = 10) {
  const limpio = String(texto).trim().replace(",", ".");
  if (!limpio) return null;
  const n = Number(limpio);
  if (!Number.isFinite(n)) return null;
  return Math.min(Math.max(n, 0), maxima);
}
