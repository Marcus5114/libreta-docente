// Pruebas de las reglas: lo que no se ve pero tiene que estar bien.
// Se corren con:  node --test pruebas/

import test from "node:test";
import assert from "node:assert/strict";

import { leerLista, iniciales, ordenar, apellidoPrimero } from "../js/domain/alumnos.js";
import { alTocar, cuantas } from "../js/domain/toques.js";
import { clave, inicioDeRango } from "../js/domain/dias.js";
import { CUENTA, INTERRUPTOR, ENTREGADO, NO_ENTREGADO } from "../js/domain/types.js";
import {
  nuevaAula,
  aplicarForma,
  agregarBanco,
  vecinos,
  recorte,
  sentarAutomatico,
  sentar,
} from "../js/domain/aula.js";
import { notaFinal, promedioDe, leerNota, resumen } from "../js/domain/trabajos.js";
import { aCsv, trabajosCsv } from "../js/domain/reportes.js";
import { fusionar, limpiarUrl } from "../js/nube.js";

// --------------------------------------------------------------- alumnos

test("la lista acepta las formas en que vienen las listas de clase", () => {
  const lista = leerLista(`
    Pérez, Juan
    María Gómez
    12. Álvarez, Lucas
    3) Sosa, Benjamín
    Cher
  `);
  assert.equal(lista.length, 5);
  assert.deepEqual(
    lista.map((a) => [a.nombre, a.apellido]),
    [
      ["Juan", "Pérez"],
      ["María", "Gómez"],
      ["Lucas", "Álvarez"],
      ["Benjamín", "Sosa"],
      ["Cher", ""],
    ],
  );
});

test("sin coma se lee «Nombre Apellido»; con coma, el apellido va primero", () => {
  const [a] = leerLista("Juan De la Fuente");
  assert.equal(a.nombre, "Juan");
  assert.equal(a.apellido, "De la Fuente");
  const [b] = leerLista("De la Fuente, Juan Martín");
  assert.equal(b.apellido, "De la Fuente");
  assert.equal(b.nombre, "Juan Martín");
});

test("ordena con los acentos donde van", () => {
  const lista = leerLista("Zapata, Ana\nÁlvarez, Beto\nAcosta, Carla");
  assert.deepEqual(
    ordenar(lista, "apellido").map((a) => a.apellido),
    ["Acosta", "Álvarez", "Zapata"],
  );
});

test("las iniciales salen del nombre y del apellido", () => {
  assert.equal(iniciales({ nombre: "Juan", apellido: "Pérez" }), "JP");
  assert.equal(iniciales({ nombre: "Cher", apellido: "" }), "C");
  assert.equal(apellidoPrimero({ nombre: "Juan", apellido: "Pérez" }), "Pérez, Juan");
});

// ---------------------------------------------------------------- toques

test("una conducta que cuenta suma cada toque", () => {
  const conducta = { id: "c1", modo: CUENTA };
  let toques = [];
  for (let i = 0; i < 3; i++) {
    const paso = alTocar(toques, "a1", conducta, Date.now());
    toques = [...toques, paso.agregar];
  }
  assert.equal(cuantas(toques, "a1", "c1", clave()), 3);
});

test("una conducta de interruptor se apaga al tocarla de nuevo", () => {
  const conducta = { id: "c1", modo: INTERRUPTOR };
  const primero = alTocar([], "a1", conducta, Date.now());
  const toques = [primero.agregar];
  const segundo = alTocar(toques, "a1", conducta, Date.now());
  assert.ok(segundo.quitar, "el segundo toque tiene que apagar, no sumar");
  assert.equal(segundo.agregar, undefined);
});

test("los toques de ayer no cuentan para hoy", () => {
  const ayer = Date.now() - 36 * 60 * 60 * 1000;
  const toques = [{ id: "t", alumno: "a1", conducta: "c1", en: ayer }];
  assert.equal(cuantas(toques, "a1", "c1", clave()), 0);
  assert.equal(cuantas(toques, "a1", "c1", clave(ayer)), 1);
});

test("la semana arranca el lunes", () => {
  const miercoles = new Date(2026, 10, 25, 15, 0); // 25/11/2026, miércoles
  const inicio = new Date(inicioDeRango("semana", miercoles));
  assert.equal(inicio.getDay(), 1);
  assert.equal(inicio.getDate(), 23);
});

// ------------------------------------------------------------------ aula

test("los escritorios pegados se reconocen como unidos", () => {
  const aula = nuevaAula();
  const a = agregarBanco(aula, 3, 5);
  agregarBanco(aula, 4, 5);
  const lados = vecinos(aula, a);
  assert.equal(lados.derecha, true);
  assert.equal(lados.izquierda, false);
  assert.equal(lados.arriba, false);
});

test("no entran dos escritorios en la misma celda ni encima de un mueble", () => {
  const aula = nuevaAula();
  assert.ok(agregarBanco(aula, 2, 4));
  assert.equal(agregarBanco(aula, 2, 4), null);
  const pizarron = aula.muebles[0];
  assert.equal(agregarBanco(aula, pizarron.c, pizarron.f), null);
});

test("la forma «grupos» arma islas de cuatro, unidas entre sí", () => {
  const aula = aplicarForma(nuevaAula(), "grupos", 8);
  assert.equal(aula.lugares.length, 8);
  const unidos = aula.lugares.filter((l) => {
    const v = vecinos(aula, l);
    return v.arriba || v.abajo || v.izquierda || v.derecha;
  });
  assert.equal(unidos.length, 8, "en grupos, cada banco toca a otro");
});

test("el recorte deja afuera las filas vacías", () => {
  const aula = nuevaAula();
  aula.muebles = [];
  agregarBanco(aula, 4, 6);
  agregarBanco(aula, 5, 6);
  assert.deepEqual(recorte(aula), { c0: 4, c1: 5, f0: 6, f1: 6 });
});

test("sentar a alguien que ya estaba sentado los intercambia", () => {
  const aula = aplicarForma(nuevaAula(), "filas", 4);
  const alumnos = leerLista("Ana A\nBeto B\nCarla C\nDiego D");
  const asignacion = sentarAutomatico(aula, alumnos);
  const lugares = Object.keys(asignacion);
  const [l1, l2] = lugares;
  const quienEstabaEn1 = asignacion[l1];
  const quienEstabaEn2 = asignacion[l2];
  sentar(asignacion, l1, quienEstabaEn2);
  assert.equal(asignacion[l1], quienEstabaEn2);
  assert.equal(asignacion[l2], quienEstabaEn1, "el otro ocupa el lugar que quedó");
});

// -------------------------------------------------------------- trabajos

test("la nota de la reentrega es la que cuenta", () => {
  assert.equal(notaFinal({ nota: 4, notaReentrega: 8 }), 8);
  assert.equal(notaFinal({ nota: 4, notaReentrega: null }), 4);
  assert.equal(notaFinal({ nota: null, notaReentrega: null }), null);
  assert.equal(notaFinal({ nota: 4, notaReentrega: 0 }), 0, "un cero es una nota");
});

test("las notas se escriben con coma o con punto", () => {
  assert.equal(leerNota("7,5"), 7.5);
  assert.equal(leerNota("7.5"), 7.5);
  assert.equal(leerNota(""), null);
  assert.equal(leerNota("abc"), null);
  assert.equal(leerNota("15", 10), 10, "no se pasa de la nota máxima");
});

test("el promedio pondera por peso y cuenta el no entregado como cero", () => {
  const trabajos = [
    { id: "t1", peso: 1 },
    { id: "t2", peso: 3 },
    { id: "t3", peso: 1 },
  ];
  const entregas = [
    { trabajoId: "t1", alumnoId: "a", estado: ENTREGADO, nota: 10, notaReentrega: null },
    { trabajoId: "t2", alumnoId: "a", estado: ENTREGADO, nota: 6, notaReentrega: null },
    { trabajoId: "t3", alumnoId: "a", estado: NO_ENTREGADO, nota: null, notaReentrega: null },
  ];
  // (10·1 + 6·3 + 0·1) / 5 = 5,6
  assert.equal(promedioDe("a", trabajos, entregas), 5.6);
  // Sin contar el no entregado: (10 + 18) / 4 = 7
  assert.equal(promedioDe("a", trabajos, entregas, false), 7);
});

test("un alumno sin ninguna nota no tiene promedio, no tiene cero", () => {
  assert.equal(promedioDe("a", [{ id: "t1", peso: 1 }], []), null);
});

test("el resumen cuenta entregas, tardes y reentregas", () => {
  const trabajo = { id: "t1", notaAprobacion: 6, peso: 1 };
  const alumnos = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const entregas = [
    { trabajoId: "t1", alumnoId: "a", estado: ENTREGADO, aTiempo: true, nota: 8, notaReentrega: null },
    { trabajoId: "t1", alumnoId: "b", estado: ENTREGADO, aTiempo: false, reentrega: true, nota: 3, notaReentrega: 7 },
    { trabajoId: "t1", alumnoId: "c", estado: NO_ENTREGADO, aTiempo: false, nota: null, notaReentrega: null },
  ];
  const r = resumen(trabajo, entregas, alumnos);
  assert.equal(r.entregados, 2);
  assert.equal(r.tarde, 1);
  assert.equal(r.reentregas, 1);
  assert.equal(r.noEntregados, 1);
  assert.equal(r.aprobados, 2, "la reentrega de 7 aprueba");
  assert.equal(r.promedio, 7.5);
});

// --------------------------------------------------------------- archivos

test("la planilla entrecomilla lo que podría romper el archivo", () => {
  const csv = aCsv([["a;b", 'dijo "hola"', "linea\nrota"]]);
  assert.ok(csv.includes('"a;b"'));
  assert.ok(csv.includes('"dijo ""hola"""'));
  assert.ok(csv.startsWith("﻿"), "el marcador deja los acentos bien en Excel");
});

test("la planilla de trabajos trae una columna por dato y el promedio", () => {
  const curso = {
    id: "c1",
    nombre: "4° A",
    alumnos: leerLista("Pérez, Juan"),
  };
  const alumnoId = curso.alumnos[0].id;
  const datos = {
    cursos: [curso],
    menus: [],
    toques: [],
    ausencias: [],
    trabajos: [
      { id: "t1", cursoId: "c1", tipo: "tp", numero: "1", nombre: "Uno", fechaConsigna: "2026-03-01", peso: 1 },
    ],
    entregas: [
      {
        id: "e1",
        trabajoId: "t1",
        alumnoId,
        estado: ENTREGADO,
        aTiempo: false,
        reentrega: true,
        nota: 4,
        notaReentrega: 8,
      },
    ],
  };
  const csv = trabajosCsv(curso, datos);
  const [encabezado, fila] = csv.replace("﻿", "").trim().split("\n");
  assert.equal(encabezado, "Alumno;TP 1 entregó;TP 1 a tiempo;TP 1 reentrega;TP 1 nota;Promedio");
  assert.equal(fila, "Pérez, Juan;sí;no;sí;8;8");
});

// ------------------------------------------------------------------ nube

const base = () => ({
  cursos: [],
  aulas: [],
  menus: [],
  toques: [],
  ausencias: [],
  trabajos: [],
  entregas: [],
  borrados: {},
  ultimoCursoId: null,
  ultimoRespaldoEn: null,
});

test("los toques de dos dispositivos se suman, no se pisan", () => {
  const local = { ...base(), toques: [{ id: "t1", alumno: "a", conducta: "c", en: 1 }] };
  const remoto = { ...base(), toques: [{ id: "t2", alumno: "a", conducta: "c", en: 2 }] };
  const unido = fusionar(local, remoto);
  assert.deepEqual(unido.toques.map((t) => t.id).sort(), ["t1", "t2"]);
});

test("en lo editable gana el que se tocó más tarde", () => {
  const local = { ...base(), cursos: [{ id: "c1", nombre: "Nuevo", actualizadoEn: 200 }] };
  const remoto = { ...base(), cursos: [{ id: "c1", nombre: "Viejo", actualizadoEn: 100 }] };
  assert.equal(fusionar(local, remoto).cursos[0].nombre, "Nuevo");
  assert.equal(fusionar(remoto, local).cursos[0].nombre, "Nuevo", "no depende del orden");
});

test("lo borrado no vuelve de la nube", () => {
  const remoto = {
    ...base(),
    toques: [{ id: "t1", alumno: "a", conducta: "c", en: 1 }],
    cursos: [{ id: "c1", nombre: "X", actualizadoEn: 100 }],
  };
  const local = { ...base(), borrados: { t1: Date.now(), c1: Date.now() } };
  const unido = fusionar(local, remoto);
  assert.equal(unido.toques.length, 0);
  assert.equal(unido.cursos.length, 0);
});

test("lo que se volvió a editar después de borrarlo sí vuelve", () => {
  const borradoEn = Date.now() - 10000;
  const remoto = { ...base(), cursos: [{ id: "c1", nombre: "X", actualizadoEn: Date.now() }] };
  const local = { ...base(), borrados: { c1: borradoEn } };
  assert.equal(fusionar(local, remoto).cursos.length, 1);
});

test("fusionar con la nube vacía deja todo como estaba", () => {
  const local = { ...base(), cursos: [{ id: "c1", nombre: "X", actualizadoEn: 1 }] };
  assert.deepEqual(fusionar(local, null), local);
});

test("fusionar dos veces da lo mismo que fusionar una", () => {
  const local = {
    ...base(),
    toques: [{ id: "t1", alumno: "a", conducta: "c", en: 1 }],
    cursos: [{ id: "c1", nombre: "A", actualizadoEn: 5 }],
  };
  const remoto = {
    ...base(),
    toques: [{ id: "t2", alumno: "b", conducta: "c", en: 2 }],
    cursos: [{ id: "c1", nombre: "B", actualizadoEn: 9 }],
  };
  const una = fusionar(local, remoto);
  const dos = fusionar(una, remoto);
  assert.deepEqual(dos, una);
});

test("la URL del proyecto se limpia venga como venga", () => {
  const base = "https://saelmfjcpyvcftsmthdz.supabase.co";
  for (const pegada of [
    base,
    base + "/",
    base + "/rest/v1/",
    base + "/rest/v1",
    base + "/auth/v1/",
    "  " + base + "/rest/v1/  ",
  ]) {
    assert.equal(limpiarUrl(pegada), base, `no limpió: ${pegada}`);
  }
});
