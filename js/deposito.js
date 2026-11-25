// Dónde se guardan los datos en el teléfono.
//
// Todo Libreta es un solo documento JSON. Vive en IndexedDB, que a diferencia
// del almacenamiento común no tiene un techo de cinco megas: un año de toques
// de varios cursos entra sin apretar.

const BASE = "libreta";
const DEPOSITO = "datos";
const CLAVE = "documento";

let promesaDeBase = null;

function abrir() {
  if (promesaDeBase) return promesaDeBase;
  promesaDeBase = new Promise((listo, falla) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => {
      const base = pedido.result;
      if (!base.objectStoreNames.contains(DEPOSITO)) base.createObjectStore(DEPOSITO);
    };
    pedido.onsuccess = () => listo(pedido.result);
    pedido.onerror = () => falla(pedido.error);
  });
  return promesaDeBase;
}

export async function leer() {
  try {
    const base = await abrir();
    return await new Promise((listo, falla) => {
      const pedido = base.transaction(DEPOSITO, "readonly").objectStore(DEPOSITO).get(CLAVE);
      pedido.onsuccess = () => listo(pedido.result ?? null);
      pedido.onerror = () => falla(pedido.error);
    });
  } catch {
    // Si IndexedDB está bloqueado (modo incógnito en algunos navegadores),
    // se intenta el almacenamiento común antes de darse por vencido.
    try {
      const crudo = localStorage.getItem(BASE);
      return crudo ? JSON.parse(crudo) : null;
    } catch {
      return null;
    }
  }
}

export async function escribir(datos) {
  try {
    const base = await abrir();
    await new Promise((listo, falla) => {
      const trans = base.transaction(DEPOSITO, "readwrite");
      trans.objectStore(DEPOSITO).put(datos, CLAVE);
      trans.oncomplete = () => listo();
      trans.onerror = () => falla(trans.error);
    });
    return true;
  } catch {
    try {
      localStorage.setItem(BASE, JSON.stringify(datos));
      return true;
    } catch {
      return false;
    }
  }
}

/** Pide al navegador que no borre estos datos si le falta espacio. */
export async function pedirPersistencia() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* no pasa nada si no se puede */
  }
  return false;
}

/** Cuánto lugar ocupa Libreta, para mostrarlo en Ajustes. */
export async function espacioUsado() {
  try {
    const { usage } = (await navigator.storage?.estimate?.()) || {};
    return usage ?? null;
  } catch {
    return null;
  }
}
