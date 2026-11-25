// Identificadores. Tienen que ser únicos entre dispositivos, porque dos teléfonos
// pueden crear registros sin verse y después sincronizar.

export function nuevoId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  // Para navegadores viejos: hora más azar, suficiente para un solo docente.
  return (
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 10) +
    Math.random().toString(36).slice(2, 6)
  );
}

/** El identificador de este dispositivo, para saber quién escribió último. */
export function idDeDispositivo() {
  const CLAVE = "libreta-dispositivo";
  let id = localStorage.getItem(CLAVE);
  if (!id) {
    id = nuevoId();
    localStorage.setItem(CLAVE, id);
  }
  return id;
}
