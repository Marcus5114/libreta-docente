// Las tablas que el docente mira después de la clase, y los archivos que se baja.

import { clave, inicioDeRango, semanaDe, corta } from "./dias.js";
import { apellidoPrimero, ordenar } from "./alumnos.js";
import { buscarConducta, visibles } from "./menus.js";
import {
  escribirNota,
  notaFinal,
  promedioDe,
  tituloCorto,
  trabajosEnOrden,
} from "./trabajos.js";
import { ENTREGADO, NO_ENTREGADO, PENDIENTE } from "./types.js";

/**
 * Participación de un curso en un rango: una fila por alumno, una columna por
 * conducta, más los días que faltó. Las conductas sacadas del menú siguen
 * teniendo columna si se tocaron en el rango, para que la historia no se rompa.
 */
export function participacion(curso, datos, rango = "todo", ahora = new Date()) {
  const desde = inicioDeRango(rango, ahora);
  const ids = new Set(curso.alumnos.map((a) => a.id));
  const toques = datos.toques.filter((t) => ids.has(t.alumno) && t.en >= desde);
  const ausencias = datos.ausencias.filter(
    (a) => ids.has(a.alumno) && a.dia >= clave(desde || 0),
  );

  const menu = datos.menus.find((m) => m.id === curso.menuId);
  const enMenu = visibles(menu);
  const enMenuIds = new Set(enMenu.map((c) => c.id));
  const extras = [...new Set(toques.map((t) => t.conducta))]
    .filter((id) => !enMenuIds.has(id))
    .map((id) => ({ ...buscarConducta(datos.menus, id), fuera: true }));
  const conductas = [...enMenu, ...extras];

  const tuvoAlgo = (id) =>
    toques.some((t) => t.alumno === id) || ausencias.some((a) => a.alumno === id);

  const filas = ordenar(curso.alumnos, "apellido")
    .filter((a) => !a.baja || tuvoAlgo(a.id))
    .map((alumno) => ({
      alumno,
      cuentas: conductas.map(
        (c) =>
          toques.filter((t) => t.alumno === alumno.id && t.conducta === c.id).length,
      ),
      total: toques.filter((t) => t.alumno === alumno.id).length,
      ausente: ausencias.filter((a) => a.alumno === alumno.id).length,
    }));

  return { conductas, filas };
}

/** La semana de un curso: para cada alumno, qué pasó cada día. */
export function semana(curso, datos, ahora = new Date()) {
  const dias = semanaDe(ahora);
  const clavesDias = dias.map((d) => d.clave);
  const ids = new Set(curso.alumnos.map((a) => a.id));
  const toques = datos.toques.filter(
    (t) => ids.has(t.alumno) && clavesDias.includes(clave(t.en)),
  );
  const ausencias = datos.ausencias.filter(
    (a) => ids.has(a.alumno) && clavesDias.includes(a.dia),
  );

  const filas = ordenar(curso.alumnos, "apellido")
    .filter((a) => !a.baja)
    .map((alumno) => ({
      alumno,
      dias: dias.map((d) => ({
        ausente: ausencias.some((a) => a.alumno === alumno.id && a.dia === d.clave),
        cuenta: toques.filter(
          (t) => t.alumno === alumno.id && clave(t.en) === d.clave,
        ).length,
      })),
      total: toques.filter((t) => t.alumno === alumno.id).length,
    }));

  return { dias, filas };
}

/**
 * La planilla de trabajos: una fila por alumno, un bloque por trabajo con
 * entregó / a tiempo / reentrega / nota, y el promedio al final. Es la versión
 * en pantalla de la planilla que se imprime.
 */
export function planillaDeTrabajos(curso, datos, filtro = "todos") {
  const trabajos = trabajosEnOrden(datos.trabajos, curso.id).filter(
    (t) => filtro === "todos" || t.tipo === filtro,
  );
  const filas = ordenar(curso.alumnos, "apellido")
    .filter((a) => !a.baja)
    .map((alumno) => ({
      alumno,
      celdas: trabajos.map((trabajo) => {
        const entrega =
          datos.entregas.find(
            (e) => e.trabajoId === trabajo.id && e.alumnoId === alumno.id,
          ) || null;
        return { trabajo, entrega, nota: notaFinal(entrega) };
      }),
      promedio: promedioDe(alumno.id, trabajos, datos.entregas),
    }));
  return { trabajos, filas };
}

// ---------------------------------------------------------------- archivos

/** Filas de celdas como el texto de una planilla, entrecomillando lo que haga falta. */
export function aCsv(filas) {
  const celda = (valor) => {
    const texto = valor === null || valor === undefined ? "" : String(valor);
    return /[";\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
  };
  // Punto y coma: es lo que esperan Excel y LibreOffice configurados en español.
  return "﻿" + filas.map((f) => f.map(celda).join(";")).join("\n") + "\n";
}

export function participacionCsv(curso, datos, rango) {
  const { conductas, filas } = participacion(curso, datos, rango);
  const encabezado = [
    "Alumno",
    ...conductas.map((c) => c.nombre + (c.fuera ? " (fuera del menú)" : "")),
    "Total",
    "Días ausente",
  ];
  const cuerpo = filas.map((f) => [
    apellidoPrimero(f.alumno) + (f.alumno.baja ? " (baja)" : ""),
    ...f.cuentas,
    f.total,
    f.ausente,
  ]);
  return aCsv([encabezado, ...cuerpo]);
}

export function trabajosCsv(curso, datos, filtro = "todos") {
  const { trabajos, filas } = planillaDeTrabajos(curso, datos, filtro);
  const encabezado = ["Alumno"];
  for (const t of trabajos) {
    const nombre = tituloCorto(t);
    encabezado.push(`${nombre} entregó`, `${nombre} a tiempo`, `${nombre} reentrega`, `${nombre} nota`);
  }
  encabezado.push("Promedio");

  const si = (v) => (v ? "sí" : "no");
  const cuerpo = filas.map((f) => {
    const linea = [apellidoPrimero(f.alumno)];
    for (const celda of f.celdas) {
      const e = celda.entrega;
      if (!e || e.estado === PENDIENTE) {
        linea.push("", "", "", "");
      } else {
        linea.push(
          e.estado === ENTREGADO ? "sí" : "no",
          e.estado === ENTREGADO ? si(e.aTiempo) : "",
          si(e.reentrega),
          celda.nota === null ? "" : escribirNota(celda.nota),
        );
      }
    }
    linea.push(f.promedio === null ? "" : escribirNota(f.promedio));
    return linea;
  });
  return aCsv([encabezado, ...cuerpo]);
}

/** Todo lo registrado, un renglón por toque o ausencia, de lo viejo a lo nuevo. */
export function todoCsv(datos) {
  const quien = new Map();
  for (const curso of datos.cursos) {
    for (const alumno of curso.alumnos) {
      quien.set(alumno.id, {
        curso: curso.nombre,
        nombre: apellidoPrimero(alumno) + (alumno.baja ? " (baja)" : ""),
      });
    }
  }
  const dosDigitos = (n) => String(n).padStart(2, "0");
  const renglones = [];
  for (const toque of datos.toques) {
    const persona = quien.get(toque.alumno);
    if (!persona) continue;
    const f = new Date(toque.en);
    renglones.push({
      en: toque.en,
      linea: [
        clave(f),
        `${dosDigitos(f.getHours())}:${dosDigitos(f.getMinutes())}`,
        persona.curso,
        persona.nombre,
        buscarConducta(datos.menus, toque.conducta).nombre,
      ],
    });
  }
  for (const ausencia of datos.ausencias) {
    const persona = quien.get(ausencia.alumno);
    if (!persona) continue;
    renglones.push({
      en: new Date(ausencia.dia + "T00:00:00").getTime(),
      linea: [ausencia.dia, "", persona.curso, persona.nombre, "Ausente"],
    });
  }
  renglones.sort((a, b) => a.en - b.en);
  return aCsv([
    ["Fecha", "Hora", "Curso", "Alumno", "Qué"],
    ...renglones.map((r) => r.linea),
  ]);
}

/** Un nombre de archivo que no pise al anterior ni rompa en Windows. */
export function nombreDeArchivo(partes) {
  return (
    partes
      .filter(Boolean)
      .join(" - ")
      .replace(/[\\/:*?"<>|]/g, "-")
      .slice(0, 120) + ".csv"
  );
}

export { corta, NO_ENTREGADO };
