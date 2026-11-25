// El estado de la app: todo lo que Libreta sabe, y cómo se cambia.
//
// Una sola variable `datos` con todo adentro. Cada cambio pasa por una función
// de este archivo, que marca el registro con la hora y avisa a la pantalla.
// Guardar es automático y con un respiro de medio segundo, para que tocar
// quince veces seguidas no escriba quince veces en el disco.

import * as deposito from "./deposito.js";
import { nuevoId } from "./domain/ids.js";
import { clave } from "./domain/dias.js";
import { datosVacios } from "./domain/types.js";
import { menuPorDefecto } from "./domain/menus.js";
import { leerLista } from "./domain/alumnos.js";
import { alTocar, ausenciaDe, estaAusente } from "./domain/toques.js";
import { nuevaAula, sentarAutomatico } from "./domain/aula.js";
import { nuevaEntrega, nuevoTrabajo } from "./domain/trabajos.js";

export let datos = datosVacios();

const oyentes = new Set();
let pendienteDeGuardar = null;
let alGuardar = null;

/** Se llama una vez al arrancar. */
export async function cargar() {
  const guardado = await deposito.leer();
  if (guardado && guardado.cursos) datos = migrar(guardado);
  deposito.pedirPersistencia();
  avisar();
}

/** Para que la sincronización sepa cuándo hay algo nuevo que subir. */
export function alCambiar(fn) {
  alGuardar = fn;
}

export function suscribir(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function avisar() {
  for (const fn of oyentes) fn(datos);
}

/** Marca el cambio, avisa a la pantalla y guarda sin apuro. */
function cambio() {
  avisar();
  clearTimeout(pendienteDeGuardar);
  pendienteDeGuardar = setTimeout(async () => {
    await deposito.escribir(datos);
    alGuardar?.(datos);
  }, 500);
}

/** Guarda ya mismo. Se usa al cerrar la app. */
export async function guardarYa() {
  clearTimeout(pendienteDeGuardar);
  await deposito.escribir(datos);
}

/** Reemplaza todo: restaurar un respaldo o traer lo de la nube. */
export function reemplazar(nuevos) {
  datos = migrar(nuevos);
  cambio();
}

function migrar(viejos) {
  return { ...datosVacios(), ...viejos };
}

const ahora = () => Date.now();
const tocado = (registro) => {
  registro.actualizadoEn = ahora();
  return registro;
};

// ------------------------------------------------------------------ cursos

export function curso(id) {
  return datos.cursos.find((c) => c.id === id) || null;
}

export function cursoActual() {
  return curso(datos.ultimoCursoId) || datos.cursos[0] || null;
}

export function crearCurso(nombre, lista = "") {
  if (!datos.menus.length) datos.menus.push(menuPorDefecto());
  const nuevo = tocado({
    id: nuevoId(),
    nombre: nombre.trim() || "Curso sin nombre",
    alumnos: leerLista(lista),
    menuId: datos.menus[0].id,
    orden: "apellido",
    ordenPropio: [],
    vista: "grilla",
    aulaId: null,
    asientos: {},
  });
  datos.cursos.push(nuevo);
  datos.ultimoCursoId = nuevo.id;
  cambio();
  return nuevo;
}

export function renombrarCurso(id, nombre) {
  const c = curso(id);
  if (!c) return;
  c.nombre = nombre.trim() || c.nombre;
  tocado(c);
  cambio();
}

export function elegirCurso(id) {
  datos.ultimoCursoId = id;
  cambio();
}

export function borrarCurso(id) {
  const c = curso(id);
  if (!c) return;
  const ids = new Set(c.alumnos.map((a) => a.id));
  datos.cursos = datos.cursos.filter((x) => x.id !== id);
  datos.toques = datos.toques.filter((t) => !ids.has(t.alumno));
  datos.ausencias = datos.ausencias.filter((a) => !ids.has(a.alumno));
  const trabajos = datos.trabajos.filter((t) => t.cursoId === id).map((t) => t.id);
  datos.trabajos = datos.trabajos.filter((t) => t.cursoId !== id);
  datos.entregas = datos.entregas.filter((e) => !trabajos.includes(e.trabajoId));
  datos.borrados[id] = ahora();
  for (const t of trabajos) datos.borrados[t] = ahora();
  if (datos.ultimoCursoId === id) datos.ultimoCursoId = datos.cursos[0]?.id ?? null;
  cambio();
}

export function guardarPreferenciaDeVista(cursoId, cambios) {
  const c = curso(cursoId);
  if (!c) return;
  Object.assign(c, cambios);
  tocado(c);
  cambio();
}

// ----------------------------------------------------------------- alumnos

export function agregarAlumnos(cursoId, lista) {
  const c = curso(cursoId);
  if (!c) return [];
  const nuevos = leerLista(lista);
  c.alumnos.push(...nuevos);
  tocado(c);
  cambio();
  return nuevos;
}

export function editarAlumno(cursoId, alumnoId, cambios) {
  const c = curso(cursoId);
  const alumno = c?.alumnos.find((a) => a.id === alumnoId);
  if (!alumno) return;
  Object.assign(alumno, cambios, { actualizadoEn: ahora() });
  tocado(c);
  cambio();
}

/** Da de baja a un alumno. Su historia queda; puede volver. */
export function darDeBaja(cursoId, alumnoId, baja = true) {
  editarAlumno(cursoId, alumnoId, { baja: baja || undefined });
}

// ------------------------------------------------------------------- menús

export function menu(id) {
  return datos.menus.find((m) => m.id === id) || null;
}

export function menuDe(cursoId) {
  const c = curso(cursoId);
  return menu(c?.menuId) || datos.menus[0] || null;
}

export function crearMenu(nombre = "Menú nuevo") {
  const nuevo = tocado({ id: nuevoId(), nombre, conductas: [] });
  datos.menus.push(nuevo);
  cambio();
  return nuevo;
}

export function guardarMenu(menuId, cambios) {
  const m = menu(menuId);
  if (!m) return;
  Object.assign(m, cambios);
  tocado(m);
  cambio();
}

export function agregarConducta(menuId, conducta) {
  const m = menu(menuId);
  if (!m) return;
  m.conductas.push(conducta);
  tocado(m);
  cambio();
}

export function editarConducta(menuId, conductaId, cambios) {
  const m = menu(menuId);
  const c = m?.conductas.find((x) => x.id === conductaId);
  if (!c) return;
  Object.assign(c, cambios);
  tocado(m);
  cambio();
}

/** La saca del menú pero la conserva, para que los toques viejos tengan nombre. */
export function quitarConducta(menuId, conductaId) {
  editarConducta(menuId, conductaId, { quitada: true });
}

// ------------------------------------------------------------------ toques

export function tocar(alumnoId, conducta, cuando = Date.now()) {
  const paso = alTocar(datos.toques, alumnoId, conducta, cuando);
  if (paso.agregar) datos.toques.push(paso.agregar);
  if (paso.quitar) datos.toques = datos.toques.filter((t) => t !== paso.quitar);
  cambio();
  return paso;
}

/** El menos uno: borra el último toque de esa conducta, hoy. */
export function deshacerToque(alumnoId, conductaId, dia = clave()) {
  let ultimo = null;
  for (const t of datos.toques) {
    if (t.alumno !== alumnoId || t.conducta !== conductaId) continue;
    if (clave(t.en) !== dia) continue;
    if (!ultimo || t.en >= ultimo.en) ultimo = t;
  }
  if (!ultimo) return false;
  datos.toques = datos.toques.filter((t) => t !== ultimo);
  datos.borrados[ultimo.id] = ahora();
  cambio();
  return true;
}

export function marcarAusente(alumnoId, dia = clave()) {
  if (estaAusente(datos.ausencias, alumnoId, dia)) return false;
  datos.ausencias.push({ id: nuevoId(), alumno: alumnoId, dia });
  cambio();
  return true;
}

export function marcarPresente(alumnoId, dia = clave()) {
  const ausencia = ausenciaDe(datos.ausencias, alumnoId, dia);
  if (!ausencia) return false;
  datos.ausencias = datos.ausencias.filter((a) => a !== ausencia);
  datos.borrados[ausencia.id] = ahora();
  cambio();
  return true;
}

export function alternarAusencia(alumnoId, dia = clave()) {
  return estaAusente(datos.ausencias, alumnoId, dia)
    ? !marcarPresente(alumnoId, dia)
    : marcarAusente(alumnoId, dia);
}

// -------------------------------------------------------------------- aula

export function aula(id) {
  return datos.aulas.find((a) => a.id === id) || null;
}

export function crearAula(nombre) {
  const nueva = nuevaAula(nombre);
  datos.aulas.push(nueva);
  cambio();
  return nueva;
}

export function guardarAula(aulaId, cambiar) {
  const a = aula(aulaId);
  if (!a) return;
  cambiar(a);
  tocado(a);
  cambio();
}

export function borrarAula(aulaId) {
  datos.aulas = datos.aulas.filter((a) => a.id !== aulaId);
  for (const c of datos.cursos) {
    if (c.asientos?.[aulaId]) delete c.asientos[aulaId];
    if (c.aulaId === aulaId) c.aulaId = null;
    tocado(c);
  }
  datos.borrados[aulaId] = ahora();
  cambio();
}

/** Los asientos de un curso en un aula, creándolos la primera vez. */
export function asientosDe(cursoId, aulaId) {
  const c = curso(cursoId);
  const a = aula(aulaId);
  if (!c || !a) return {};
  if (!c.asientos) c.asientos = {};
  if (!c.asientos[aulaId]) {
    c.asientos[aulaId] = sentarAutomatico(
      a,
      c.alumnos.filter((x) => !x.baja),
    );
    tocado(c);
    cambio();
  }
  return c.asientos[aulaId];
}

export function guardarAsientos(cursoId, aulaId, asignacion) {
  const c = curso(cursoId);
  if (!c) return;
  if (!c.asientos) c.asientos = {};
  c.asientos[aulaId] = asignacion;
  tocado(c);
  cambio();
}

// ---------------------------------------------------------------- trabajos

export function trabajo(id) {
  return datos.trabajos.find((t) => t.id === id) || null;
}

export function crearTrabajo(cursoId, campos = {}) {
  const nuevo = { ...nuevoTrabajo(cursoId), ...campos, actualizadoEn: ahora() };
  datos.trabajos.push(nuevo);
  cambio();
  return nuevo;
}

export function guardarTrabajo(trabajoId, cambios) {
  const t = trabajo(trabajoId);
  if (!t) return;
  Object.assign(t, cambios);
  tocado(t);
  cambio();
}

export function borrarTrabajo(trabajoId) {
  datos.trabajos = datos.trabajos.filter((t) => t.id !== trabajoId);
  const quitadas = datos.entregas.filter((e) => e.trabajoId === trabajoId);
  datos.entregas = datos.entregas.filter((e) => e.trabajoId !== trabajoId);
  datos.borrados[trabajoId] = ahora();
  for (const e of quitadas) datos.borrados[e.id] = ahora();
  cambio();
}

/** La entrega de un alumno, creándola la primera vez que se la toca. */
export function entrega(trabajoId, alumnoId) {
  let e = datos.entregas.find(
    (x) => x.trabajoId === trabajoId && x.alumnoId === alumnoId,
  );
  if (!e) {
    e = nuevaEntrega(trabajoId, alumnoId);
    datos.entregas.push(e);
  }
  return e;
}

export function guardarEntrega(trabajoId, alumnoId, cambios) {
  const e = entrega(trabajoId, alumnoId);
  Object.assign(e, cambios);
  tocado(e);
  cambio();
  return e;
}

// ------------------------------------------------------------------ varios

export function marcarRespaldo() {
  datos.ultimoRespaldoEn = ahora();
  cambio();
}

/** Deja la app como recién instalada. */
export function borrarTodo() {
  datos = datosVacios();
  cambio();
}
