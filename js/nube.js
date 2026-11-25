// Sincronización con Supabase, sin bibliotecas.
//
// Supabase es, por abajo, una API REST común. Lo único que hace falta es
// mandar la clave pública y el token de la sesión en los encabezados, así que
// alcanza con `fetch` y esto se puede servir sin compilar nada.
//
// Libreta guarda todo como un solo documento JSON, una fila por docente. Al
// sincronizar se baja la fila, se la fusiona con lo que hay en el teléfono y,
// si el resultado difiere, se sube. Fusionar es siempre del lado del cliente,
// así que dos dispositivos que estuvieron desconectados terminan igual:
//
//   · toques y ausencias se suman, porque nunca se editan;
//   · el resto se resuelve por fecha: gana el registro tocado más tarde;
//   · lo borrado queda anotado con su hora, para que no vuelva de la nube.

import * as estado from "./estado.js";
import { COLECCIONES, datosVacios } from "./domain/types.js";
import { idDeDispositivo } from "./domain/ids.js";

const CONFIG = "libreta-nube";
const SESION = "libreta-sesion";
const TABLA = "libretas";

let sincronizando = false;
let pendiente = false;
let alCambiarEstadoNube = null;

export const nube = {
  get config() {
    return leerJson(CONFIG) || { url: "", clave: "" };
  },
  get sesion() {
    return leerJson(SESION);
  },
  get configurada() {
    const c = this.config;
    return !!(c.url && c.clave);
  },
  get conectada() {
    return !!this.sesion?.access_token;
  },
  ultimaSincronizacion: leerJson("libreta-ultima-sync") || null,
  estado: "sin-configurar",
};

export function alCambiarNube(fn) {
  alCambiarEstadoNube = fn;
}

function anunciar(nuevo) {
  nube.estado = nuevo;
  alCambiarEstadoNube?.(nuevo);
}

function leerJson(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave) || "null");
  } catch {
    return null;
  }
}

function guardarJson(clave, valor) {
  if (valor === null) localStorage.removeItem(clave);
  else localStorage.setItem(clave, JSON.stringify(valor));
}

/**
 * Deja la URL en la base del proyecto. El panel de Supabase muestra la
 * dirección con `/rest/v1/` colgando en la sección de la API, y es lo que uno
 * termina copiando; la app le agrega esa parte sola, así que acá se saca.
 */
export function limpiarUrl(url) {
  return String(url)
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/(rest|auth|storage|realtime|functions)\/v\d+$/, "")
    .replace(/\/+$/, "");
}

/**
 * Una clave no lleva espacios en ningún lado. Al copiarla en el teléfono se
 * cuelan saltos de línea y espacios del medio que el navegador manda tal cual,
 * y Supabase contesta «Invalid API key» sin decir por qué: se sacan todos.
 */
export function limpiarClave(clave) {
  return String(clave).replace(/\s+/g, "");
}

/**
 * Avisa si la clave pegada es la secreta. Esa salta las reglas de seguridad:
 * quien la tenga lee y escribe los datos de todos, y en una app que se publica
 * queda a la vista de cualquiera. Mejor frenar acá que después.
 */
export function esClaveSecreta(clave) {
  const limpia = limpiarClave(clave);
  if (limpia.startsWith("sb_secret_")) return true;
  const partes = limpia.split(".");
  if (partes.length !== 3) return false;
  try {
    const carga = JSON.parse(
      atob(partes[1].replace(/-/g, "+").replace(/_/g, "/")),
    );
    return carga.role === "service_role";
  } catch {
    return false;
  }
}

export function guardarConfig(url, clave) {
  guardarJson(CONFIG, { url: limpiarUrl(url), clave: limpiarClave(clave) });
  anunciar(nube.configurada ? "desconectada" : "sin-configurar");
}

/**
 * Un enlace que lleva la configuración adentro, para no volver a tipear la
 * clave en cada dispositivo: abrirlo en el teléfono lo deja configurado. Sólo
 * viaja lo público (la dirección del proyecto y la clave pública), que es lo
 * mismo que cualquiera puede leer en el código de la app; la cuenta se sigue
 * necesitando aparte.
 */
export function enlaceDeConfiguracion() {
  const { url, clave } = nube.config;
  const empaquetado = btoa(JSON.stringify({ url, clave }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return location.origin + location.pathname + "#/conectar/" + empaquetado;
}

/** Lee el enlace de arriba. Devuelve true si quedó configurado. */
export function leerEnlaceDeConfiguracion(empaquetado) {
  try {
    const crudo = atob(empaquetado.replace(/-/g, "+").replace(/_/g, "/"));
    const { url, clave } = JSON.parse(crudo);
    if (!url || !clave) return false;
    guardarConfig(url, clave);
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ acceso

async function pedir(camino, opciones = {}, conSesion = true) {
  const { url, clave } = nube.config;
  if (!url || !clave) throw new Error("Falta configurar la nube");

  const encabezados = {
    apikey: clave,
    "Content-Type": "application/json",
    ...(opciones.headers || {}),
  };
  if (conSesion && nube.sesion?.access_token) {
    encabezados.Authorization = `Bearer ${nube.sesion.access_token}`;
  }

  const respuesta = await fetch(url + camino, { ...opciones, headers: encabezados });
  if (respuesta.status === 401 && conSesion && nube.sesion?.refresh_token) {
    const renovada = await renovarSesion();
    if (renovada) return pedir(camino, opciones, conSesion);
  }
  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    throw new Error(mensajeLegible(respuesta.status, cuerpo));
  }
  if (respuesta.status === 204) return null;
  const texto = await respuesta.text();
  return texto ? JSON.parse(texto) : null;
}

function mensajeLegible(codigo, cuerpo) {
  let detalle = cuerpo;
  try {
    const json = JSON.parse(cuerpo);
    detalle = json.msg || json.message || json.error_description || json.error || cuerpo;
  } catch {
    /* se usa el texto crudo */
  }
  if (/permission denied for table/i.test(detalle)) {
    return "Falta el permiso de la tabla en Supabase. Corré el SQL de Ajustes otra vez: la línea del grant es la que falta.";
  }
  if (/invalid api key/i.test(detalle)) {
    return "La clave pública no es la de este proyecto, o se copió incompleta. Fijate que la URL y la clave salgan del mismo proyecto.";
  }
  if (codigo === 400 && /invalid login/i.test(detalle)) return "Mail o contraseña incorrectos";
  if (codigo === 422) return "Esa contraseña es muy corta (mínimo seis caracteres)";
  if (codigo === 404) return "Falta crear la tabla en Supabase; está el paso a paso en Ajustes";
  return detalle || `Error ${codigo}`;
}

export async function registrarse(mail, contrasena) {
  const datos = await pedir(
    "/auth/v1/signup",
    { method: "POST", body: JSON.stringify({ email: mail, password: contrasena }) },
    false,
  );
  if (datos?.access_token) {
    guardarJson(SESION, datos);
    anunciar("conectada");
    return { listo: true };
  }
  // Supabase puede pedir confirmación por mail antes de dar la sesión.
  return { listo: false, aviso: "Te mandamos un mail para confirmar la cuenta." };
}

export async function entrar(mail, contrasena) {
  const datos = await pedir(
    "/auth/v1/token?grant_type=password",
    { method: "POST", body: JSON.stringify({ email: mail, password: contrasena }) },
    false,
  );
  guardarJson(SESION, datos);
  anunciar("conectada");
  return datos;
}

async function renovarSesion() {
  try {
    const datos = await pedir(
      "/auth/v1/token?grant_type=refresh_token",
      {
        method: "POST",
        body: JSON.stringify({ refresh_token: nube.sesion.refresh_token }),
      },
      false,
    );
    guardarJson(SESION, datos);
    return true;
  } catch {
    guardarJson(SESION, null);
    anunciar("desconectada");
    return false;
  }
}

export function salir() {
  guardarJson(SESION, null);
  anunciar(nube.configurada ? "desconectada" : "sin-configurar");
}

function idDeUsuario() {
  return nube.sesion?.user?.id || null;
}

// --------------------------------------------------------------- fusionar

/** Une dos documentos de Libreta. El resultado no depende del orden. */
export function fusionar(local, remoto) {
  if (!remoto) return local;
  if (!local) return remoto;

  const salida = { ...datosVacios() };
  const borrados = { ...(remoto.borrados || {}), ...(local.borrados || {}) };
  for (const [id, cuando] of Object.entries(local.borrados || {})) {
    borrados[id] = Math.max(cuando, remoto.borrados?.[id] ?? 0);
  }

  for (const [nombre, modo] of Object.entries(COLECCIONES)) {
    const porId = new Map();
    for (const registro of remoto[nombre] || []) porId.set(registro.id, registro);
    for (const registro of local[nombre] || []) {
      const otro = porId.get(registro.id);
      if (!otro) {
        porId.set(registro.id, registro);
      } else if (modo === "ultimo") {
        const mio = registro.actualizadoEn ?? 0;
        const suyo = otro.actualizadoEn ?? 0;
        if (mio >= suyo) porId.set(registro.id, registro);
      }
    }
    // Lo borrado después de su última edición no vuelve.
    salida[nombre] = [...porId.values()].filter((registro) => {
      const cuandoSeBorro = borrados[registro.id];
      if (!cuandoSeBorro) return true;
      return (registro.actualizadoEn ?? 0) > cuandoSeBorro;
    });
  }

  salida.borrados = podar(borrados);
  salida.ultimoCursoId = local.ultimoCursoId ?? remoto.ultimoCursoId ?? null;
  salida.ultimoRespaldoEn = Math.max(
    local.ultimoRespaldoEn || 0,
    remoto.ultimoRespaldoEn || 0,
  ) || null;
  return salida;
}

/** Las lápidas de más de noventa días ya no le sirven a nadie. */
function podar(borrados) {
  const limite = Date.now() - 90 * 24 * 60 * 60 * 1000;
  return Object.fromEntries(
    Object.entries(borrados).filter(([, cuando]) => cuando > limite),
  );
}

// ------------------------------------------------------------ sincronizar

export async function sincronizar({ silencioso = true } = {}) {
  if (!nube.configurada || !nube.conectada) return { hecho: false };
  if (!navigator.onLine) {
    anunciar("sin-conexion");
    return { hecho: false, motivo: "sin conexión" };
  }
  if (sincronizando) {
    pendiente = true;
    return { hecho: false };
  }

  sincronizando = true;
  anunciar("sincronizando");
  try {
    const usuario = idDeUsuario();
    const fila = await pedir(
      `/rest/v1/${TABLA}?id=eq.${usuario}&select=documento`,
      { method: "GET" },
    );
    const remoto = fila?.[0]?.documento || null;
    const fusionado = fusionar(estado.datos, remoto);

    const cambioLocal = JSON.stringify(fusionado) !== JSON.stringify(estado.datos);
    const cambioRemoto = JSON.stringify(fusionado) !== JSON.stringify(remoto);

    if (cambioRemoto) {
      await pedir(`/rest/v1/${TABLA}`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          id: usuario,
          documento: fusionado,
          dispositivo: idDeDispositivo(),
          actualizado: new Date().toISOString(),
        }),
      });
    }
    if (cambioLocal) estado.reemplazar(fusionado);

    nube.ultimaSincronizacion = Date.now();
    guardarJson("libreta-ultima-sync", nube.ultimaSincronizacion);
    anunciar("al-dia");
    return { hecho: true, cambioLocal, cambioRemoto };
  } catch (error) {
    anunciar("error");
    if (!silencioso) throw error;
    return { hecho: false, motivo: error.message };
  } finally {
    sincronizando = false;
    if (pendiente) {
      pendiente = false;
      setTimeout(() => sincronizar(), 1500);
    }
  }
}

// ---------------------------------------------------------------- arranque

let esperando = null;

export function arrancarSincronizacion() {
  anunciar(
    !nube.configurada ? "sin-configurar" : nube.conectada ? "conectada" : "desconectada",
  );

  estado.alCambiar(() => {
    clearTimeout(esperando);
    esperando = setTimeout(() => sincronizar(), 4000);
  });

  window.addEventListener("online", () => sincronizar());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") sincronizar();
  });
  if (nube.conectada) sincronizar();
}

/** El SQL que hay que correr una vez en Supabase. Se muestra en Ajustes. */
export const SQL_DE_INSTALACION = `-- Pegá esto en el editor SQL de Supabase y ejecutalo una vez.

-- 1. La tabla: una fila por docente, con toda su Libreta adentro.
create table if not exists public.libretas (
  id uuid primary key references auth.users on delete cascade,
  documento jsonb not null default '{}'::jsonb,
  dispositivo text,
  actualizado timestamptz not null default now()
);

-- 2. El permiso. Desde mayo de 2026 las tablas nuevas no lo reciben solas:
--    sin esto, Postgres rechaza todo con "permission denied for table",
--    antes incluso de mirar las políticas de abajo.
grant select, insert, update on table public.libretas to authenticated;

-- 3. Las políticas: cada docente, sólo su fila.
alter table public.libretas enable row level security;

create policy "cada docente ve lo suyo"
  on public.libretas for select using (auth.uid() = id);

create policy "cada docente escribe lo suyo"
  on public.libretas for insert with check (auth.uid() = id);

create policy "cada docente actualiza lo suyo"
  on public.libretas for update using (auth.uid() = id);`;
