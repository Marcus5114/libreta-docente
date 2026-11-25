// Las formas de todo lo que Libreta guarda.
//
// Un registro es un objeto plano con `id` y `updatedAt` (milisegundos). Eso alcanza
// para sincronizar: lo más reciente gana, salvo los toques y las ausencias, que sólo
// se suman porque nunca se editan.
//
//   Curso      un grupo de alumnos que se junta seguido: "4° A Programación"
//   Alumno     una persona en la lista de un curso
//   Conducta   algo que el docente registra tocando: participó, trajo el material
//   Menú       la lista de conductas que aparece al tocar a un alumno
//   Toque      un registro: qué alumno, qué conducta, cuándo
//   Ausencia   un alumno que no estuvo en el aula un día
//   Aula       un plano de escritorios, compartido entre cursos
//   Lugar      un escritorio del plano; puede estar vacío
//   Trabajo    un TP o un examen que se le da al curso
//   Entrega    lo que hizo un alumno con un trabajo: entregó, a tiempo, nota
//
// Los trabajos y las entregas son lo que Libreta agrega sobre un registro de
// participación: el día a día del aula y la nota del cuatrimestre en el mismo lugar.

/** Columnas del plano. El aula entra en una grilla de celdas cuadradas. */
export const AULA_COLUMNAS = 12;
export const AULA_FILAS = 14;

/** Los dos modos de una conducta. */
export const CUENTA = "cuenta"; // suma cada toque
export const INTERRUPTOR = "interruptor"; // prendido o apagado, todo el día

/** Los dos tipos de trabajo. */
export const TP = "tp";
export const EXAMEN = "examen";

/** Estados posibles de una entrega. */
export const PENDIENTE = "pendiente";
export const ENTREGADO = "entregado";
export const NO_ENTREGADO = "no-entregado";

/** Un dato vacío, tal como arranca la app la primera vez. */
export function datosVacios() {
  return {
    version: 1,
    cursos: [],
    aulas: [],
    menus: [],
    toques: [],
    ausencias: [],
    trabajos: [],
    entregas: [],
    borrados: {}, // id → milisegundos en que se borró, para que la nube se entere
    ultimoCursoId: null,
    ultimoRespaldoEn: null,
  };
}

/**
 * Las colecciones que se sincronizan, y cómo.
 * "union" se suma sin pisar nada; "ultimo" deja ganar al más reciente.
 */
export const COLECCIONES = {
  cursos: "ultimo",
  aulas: "ultimo",
  menus: "ultimo",
  trabajos: "ultimo",
  entregas: "ultimo",
  toques: "union",
  ausencias: "union",
};
