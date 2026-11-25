// El plano del aula.
//
// El aula es una grilla de celdas cuadradas. El docente toca una celda vacía y
// aparece un escritorio; dos escritorios pegados se dibujan como un solo mueble,
// así se arman grupos, filas, pares o una U sin dibujar nada a mano.
//
// Un aula describe muebles, no personas: pertenece a ningún curso y cualquier
// curso puede mostrarse en cualquier aula. Quién se sienta dónde vive en el
// curso, no acá, así que cambiar de lugar a un alumno nunca mueve los bancos.

import { nuevoId } from "./ids.js";
import { AULA_COLUMNAS, AULA_FILAS } from "./types.js";
import { ordenar } from "./alumnos.js";

export const BANCO = "banco";
export const PIZARRON = "pizarron";
export const PUERTA = "puerta";

/** Un aula nueva: vacía, con el pizarrón adelante y la puerta a un costado. */
export function nuevaAula(nombre = "Mi aula") {
  const centro = Math.floor(AULA_COLUMNAS / 2) - 1;
  return {
    id: nuevoId(),
    nombre,
    columnas: AULA_COLUMNAS,
    filas: AULA_FILAS,
    lugares: [],
    muebles: [
      { id: nuevoId(), tipo: PIZARRON, c: centro, f: 0, ancho: 3 },
      { id: nuevoId(), tipo: PUERTA, c: AULA_COLUMNAS - 2, f: 1, ancho: 2 },
    ],
    actualizadoEn: Date.now(),
  };
}

export function enCelda(aula, c, f) {
  return aula.lugares.find((l) => l.c === c && l.f === f) || null;
}

export function muebleEnCelda(aula, c, f) {
  return (
    aula.muebles.find(
      (m) => m.f === f && c >= m.c && c < m.c + (m.ancho || 1),
    ) || null
  );
}

/**
 * Qué hay en una celda: un escritorio, un mueble, o nada. `exceptoId` sirve al
 * mover: una cosa nunca se estorba a sí misma, y el pizarrón ocupa tres celdas
 * que tiene que poder volver a pisar al correrse de a una.
 */
export function ocupante(aula, c, f, exceptoId = null) {
  const lugar = aula.lugares.find(
    (l) => l.c === c && l.f === f && l.id !== exceptoId,
  );
  if (lugar) return lugar;
  return (
    aula.muebles.find(
      (m) =>
        m.f === f && c >= m.c && c < m.c + (m.ancho || 1) && m.id !== exceptoId,
    ) || null
  );
}

export function dentro(aula, c, f) {
  return c >= 0 && f >= 0 && c < aula.columnas && f < aula.filas;
}

export function libre(aula, c, f, exceptoId = null) {
  return dentro(aula, c, f) && !ocupante(aula, c, f, exceptoId);
}

/** Si algo de `ancho` celdas entra con su esquina izquierda en (c, f). */
export function cabe(aula, c, f, ancho = 1, exceptoId = null) {
  if (c < 0 || c + ancho > aula.columnas) return false;
  for (let i = 0; i < ancho; i++) {
    if (!libre(aula, c + i, f, exceptoId)) return false;
  }
  return true;
}

/** Agrega un escritorio, si la celda está libre. Devuelve el lugar o null. */
export function agregarBanco(aula, c, f) {
  if (!libre(aula, c, f)) return null;
  const lugar = { id: nuevoId(), tipo: BANCO, c, f };
  aula.lugares.push(lugar);
  return lugar;
}

export function quitarLugar(aula, lugarId) {
  aula.lugares = aula.lugares.filter((l) => l.id !== lugarId);
}

/** Mueve un escritorio a otra celda, si está libre. */
export function moverLugar(aula, lugarId, c, f) {
  const lugar = aula.lugares.find((l) => l.id === lugarId);
  if (!lugar || !libre(aula, c, f, lugarId)) return false;
  lugar.c = c;
  lugar.f = f;
  return true;
}

/**
 * Mueve el pizarrón o la puerta. Se toca una celda y el mueble se centra en
 * ella lo mejor que puede: un pizarrón de tres celdas, tocado en el borde,
 * se corre adentro en vez de no moverse.
 */
export function moverMueble(aula, muebleId, c, f) {
  const mueble = aula.muebles.find((m) => m.id === muebleId);
  if (!mueble || !dentro(aula, c, f)) return false;
  const ancho = mueble.ancho || 1;
  const centrado = c - Math.floor((ancho - 1) / 2);
  const candidatos = [centrado, c, c - ancho + 1];
  for (const inicio of candidatos) {
    const recortado = Math.min(Math.max(inicio, 0), aula.columnas - ancho);
    if (cabe(aula, recortado, f, ancho, muebleId)) {
      mueble.c = recortado;
      mueble.f = f;
      return true;
    }
  }
  return false;
}

/** Lo que se puede agarrar en una celda, para el modo Mover. */
export function agarrable(aula, c, f) {
  const cosa = ocupante(aula, c, f);
  if (!cosa) return null;
  const esMueble = aula.muebles.includes(cosa);
  return { tipo: esMueble ? "mueble" : "lugar", cosa };
}

/**
 * Qué lados de un escritorio tocan a otro. El dibujo borra esos bordes, y por
 * eso dos bancos pegados se ven como una mesa de dos.
 */
export function vecinos(aula, lugar) {
  return {
    arriba: !!enCelda(aula, lugar.c, lugar.f - 1),
    abajo: !!enCelda(aula, lugar.c, lugar.f + 1),
    izquierda: !!enCelda(aula, lugar.c - 1, lugar.f),
    derecha: !!enCelda(aula, lugar.c + 1, lugar.f),
  };
}

/** Los escritorios agrupados por contigüidad: cada grupo es un mueble armado. */
export function grupos(aula) {
  const pendientes = new Map(aula.lugares.map((l) => [`${l.c},${l.f}`, l]));
  const salida = [];
  for (const [clave, lugar] of pendientes) {
    if (!pendientes.has(clave)) continue;
    const grupo = [];
    const cola = [lugar];
    pendientes.delete(clave);
    while (cola.length) {
      const actual = cola.pop();
      grupo.push(actual);
      for (const [dc, df] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
        const k = `${actual.c + dc},${actual.f + df}`;
        const vecino = pendientes.get(k);
        if (vecino) {
          pendientes.delete(k);
          cola.push(vecino);
        }
      }
    }
    salida.push(grupo);
  }
  return salida;
}

/**
 * El rectángulo que ocupa lo que hay en el aula. En clase se dibuja sólo esta
 * parte: si el aula usa seis columnas de doce, los escritorios se ven al doble
 * de grande y el dedo no se equivoca.
 */
export function recorte(aula) {
  const cosas = [
    ...aula.lugares.map((l) => ({ c0: l.c, c1: l.c, f: l.f })),
    ...aula.muebles.map((m) => ({ c0: m.c, c1: m.c + (m.ancho || 1) - 1, f: m.f })),
  ];
  if (!cosas.length) return { c0: 0, c1: aula.columnas - 1, f0: 0, f1: aula.filas - 1 };
  return {
    c0: Math.min(...cosas.map((x) => x.c0)),
    c1: Math.max(...cosas.map((x) => x.c1)),
    f0: Math.min(...cosas.map((x) => x.f)),
    f1: Math.max(...cosas.map((x) => x.f)),
  };
}

/** Los lugares en orden de lectura: primera fila primero, de izquierda a derecha. */
export function lugaresEnOrden(aula) {
  return [...aula.lugares].sort((a, b) => a.f - b.f || a.c - b.c);
}

/**
 * Sienta al curso por apellido, primera fila primero. Sólo se usa la primera
 * vez que un curso se muestra en un aula; después manda lo que armó el docente.
 */
export function sentarAutomatico(aula, alumnos) {
  const lugares = lugaresEnOrden(aula);
  const lista = ordenar(alumnos, "apellido");
  const asignacion = {};
  lugares.forEach((lugar, i) => {
    if (lista[i]) asignacion[lugar.id] = lista[i].id;
  });
  return asignacion;
}

/** Los alumnos del curso que quedaron sin lugar. Se tocan igual. */
export function sinLugar(alumnos, asignacion) {
  const sentados = new Set(Object.values(asignacion || {}));
  return alumnos.filter((a) => !sentados.has(a.id));
}

/** Saca a un alumno de donde esté sentado. */
export function levantar(asignacion, alumnoId) {
  for (const [lugarId, id] of Object.entries(asignacion)) {
    if (id === alumnoId) delete asignacion[lugarId];
  }
}

/** Sienta a un alumno en un lugar; si estaba ocupado, los intercambia. */
export function sentar(asignacion, lugarId, alumnoId) {
  const habia = asignacion[lugarId];
  const antes = Object.entries(asignacion).find(([, id]) => id === alumnoId)?.[0];
  if (antes) delete asignacion[antes];
  if (habia && antes) asignacion[antes] = habia;
  asignacion[lugarId] = alumnoId;
}

/** Las formas con las que se puede arrancar un aula en vez de la hoja en blanco. */
export const FORMAS = [
  { valor: "filas", etiqueta: "Filas", ayuda: "Bancos sueltos en hileras" },
  { valor: "pares", etiqueta: "De a dos", ayuda: "Bancos unidos de a dos" },
  { valor: "grupos", etiqueta: "Grupos", ayuda: "Islas de cuatro" },
  { valor: "u", etiqueta: "En U", ayuda: "Todos mirando al centro" },
];

/** Llena un aula vacía con una de las formas de arriba. */
export function aplicarForma(aula, forma, cantidad = 24) {
  aula.lugares = [];
  const col = aula.columnas;
  const poner = (c, f) => {
    if (aula.lugares.length < cantidad) agregarBanco(aula, c, f);
  };

  if (forma === "filas") {
    for (let f = 2; f < aula.filas && aula.lugares.length < cantidad; f += 2) {
      for (let c = 1; c < col - 1 && aula.lugares.length < cantidad; c += 2) poner(c, f);
    }
  }
  if (forma === "pares") {
    for (let f = 2; f < aula.filas && aula.lugares.length < cantidad; f += 2) {
      for (let c = 1; c < col - 1 && aula.lugares.length < cantidad; c += 3) {
        poner(c, f);
        poner(c + 1, f);
      }
    }
  }
  if (forma === "grupos") {
    for (let f = 2; f < aula.filas && aula.lugares.length < cantidad; f += 3) {
      for (let c = 1; c < col - 1 && aula.lugares.length < cantidad; c += 3) {
        poner(c, f);
        poner(c + 1, f);
        poner(c, f + 1);
        poner(c + 1, f + 1);
      }
    }
  }
  if (forma === "u") {
    const fondo = Math.min(aula.filas - 2, 9);
    for (let f = 2; f <= fondo && aula.lugares.length < cantidad; f++) {
      poner(1, f);
      poner(col - 2, f);
    }
    for (let c = 1; c < col - 1 && aula.lugares.length < cantidad; c++) poner(c, fondo);
  }
  aula.actualizadoEn = Date.now();
  return aula;
}
