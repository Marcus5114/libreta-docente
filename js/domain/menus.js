// Menús de conductas: la lista que aparece al tocar a un alumno.
//
// Un menú tiene como mucho ocho conductas, para que el cuadro nunca necesite
// desplazarse en medio de la clase.

import { nuevoId } from "./ids.js";
import { CUENTA, INTERRUPTOR } from "./types.js";

export const MAXIMO_CONDUCTAS = 8;

/** La paleta con la que se distinguen las conductas de un vistazo. */
export const COLORES = [
  "#2f6f4e", // verde
  "#8a4b2a", // tierra
  "#355b8c", // azul
  "#7d3a5c", // ciruela
  "#6b6b2f", // oliva
  "#9a5b1e", // ocre
  "#4a4a7d", // violeta
  "#7a3030", // ladrillo
];

export function nuevaConducta(nombre, emoji, color, modo = CUENTA) {
  return {
    id: nuevoId(),
    nombre,
    emoji,
    color,
    modo,
  };
}

/** El menú con el que arranca un docente que recién empieza. */
export function menuPorDefecto() {
  return {
    id: nuevoId(),
    nombre: "Participación",
    conductas: [
      nuevaConducta("Participó", "✋", COLORES[0]),
      nuevaConducta("Buena actitud", "⭐", COLORES[2]),
      nuevaConducta("Trajo el material", "🎒", COLORES[4], INTERRUPTOR),
      nuevaConducta("Llamado de atención", "⚠️", COLORES[7]),
    ],
    actualizadoEn: Date.now(),
  };
}

/** Las conductas que se muestran: las que no fueron quitadas del menú. */
export function visibles(menu) {
  return (menu?.conductas ?? []).filter((c) => !c.quitada);
}

/** Una conducta por id, mirando en todos los menús. Sirve para los reportes. */
export function buscarConducta(menus, id) {
  for (const menu of menus) {
    const hallada = menu.conductas.find((c) => c.id === id);
    if (hallada) return hallada;
  }
  return {
    id,
    nombre: "Conducta borrada",
    emoji: "•",
    color: "#8a8a8a",
    modo: CUENTA,
  };
}
