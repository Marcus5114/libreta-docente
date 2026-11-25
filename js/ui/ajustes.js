// Ajustes: la nube, los respaldos y el borrón y cuenta nueva.

import * as estado from "../estado.js";
import { el, icono, hoja, avisar, confirmar, poner, bajarArchivo } from "./html.js";
import { barra } from "./cursos.js";
import { espacioUsado } from "../deposito.js";
import {
  SQL_DE_INSTALACION,
  enlaceDeConfiguracion,
  entrar,
  esClaveSecreta,
  guardarConfig,
  nube,
  registrarse,
  salir,
  sincronizar,
} from "../nube.js";

const TEXTO_ESTADO = {
  "sin-configurar": "Sin configurar",
  desconectada: "Configurada, falta entrar",
  conectada: "Conectada",
  sincronizando: "Sincronizando…",
  "al-dia": "Al día",
  "sin-conexion": "Sin conexión; se sincroniza cuando vuelva",
  error: "Hubo un problema al sincronizar",
};

export function pantallaAjustes() {
  const { datos } = estado;
  const totalToques = datos.toques.length;
  const totalAlumnos = datos.cursos.reduce((n, c) => n + c.alumnos.length, 0);

  const espacio = el("div.apunte", "Calculando el espacio usado…");
  espacioUsado().then((bytes) => {
    espacio.textContent =
      bytes === null
        ? "El navegador no informa cuánto espacio se usa."
        : `Libreta Docente ocupa ${(bytes / 1024 / 1024).toFixed(1)} MB en este dispositivo.`;
  });

  return [
    barra("Ajustes"),
    el("main.pantalla", [
      el("div.titulo-seccion", "Sincronización"),
      tarjetaNube(),

      el("div.titulo-seccion", "Respaldo"),
      el("div.tarjeta", [
        el(
          "p.apunte",
          datos.ultimoRespaldoEn
            ? "Último respaldo: " + new Date(datos.ultimoRespaldoEn).toLocaleString("es-AR")
            : "Todavía no bajaste ningún respaldo.",
        ),
        el(
          "button.boton.ancho",
          {
            estilo: { marginBottom: "8px" },
            onclick: () => {
              const nombre = `libreta-docente-${new Date().toISOString().slice(0, 10)}.json`;
              bajarArchivo(nombre, JSON.stringify(estado.datos), "application/json");
              estado.marcarRespaldo();
              avisar("Respaldo bajado");
            },
          },
          [icono("bajar", 18), "Bajar un respaldo"],
        ),
        el("button.boton.ancho", { onclick: restaurar }, [
          icono("subir", 18),
          "Restaurar desde un archivo",
        ]),
      ]),

      el("div.titulo-seccion", "Este dispositivo"),
      el("div.tarjeta", [
        el(
          "p.apunte",
          `${datos.cursos.length} curso(s), ${totalAlumnos} alumno(s), ${totalToques} toque(s), ${datos.trabajos.length} trabajo(s).`,
        ),
        espacio,
      ]),

      el("div.titulo-seccion", "Cuidado"),
      el(
        "button.boton.ancho.peligro",
        {
          onclick: async () => {
            const seguro = await confirmar(
              "¿Borrar todo?",
              "Se borran los cursos, los toques, las ausencias, los trabajos y las notas de este dispositivo. Si tenés sincronización activa, bajá antes un respaldo.",
              "Borrar todo",
            );
            if (seguro) {
              estado.borrarTodo();
              avisar("Listo, Libreta Docente quedó como recién instalada");
            }
          },
        },
        "Borrar todo",
      ),

      el("div.titulo-seccion", "Sobre Libreta Docente"),
      el("div.tarjeta", [
        el(
          "p.apunte",
          "Registro de aula y de trabajos prácticos. Funciona sin conexión: todo se guarda en el teléfono y, si configurás la nube, viaja a tus otros dispositivos.",
        ),
        el("p.apunte", "Inspirada en Tap & Tally, de Elliot Roe."),
      ]),
    ]),
  ];
}

function tarjetaNube() {
  const tarjeta = el("div.tarjeta");

  const dibujar = () => {
    poner(
      tarjeta,
      el("div.fila", [
        el("div", [
          el("strong", TEXTO_ESTADO[nube.estado] || "Sin configurar"),
          nube.ultimaSincronizacion &&
            el(
              "div.apunte",
              "Última vez: " +
                new Date(nube.ultimaSincronizacion).toLocaleString("es-AR"),
            ),
        ]),
        el("div", { estilo: { flex: "0 0 auto" } }, icono("nube")),
      ]),

      !nube.configurada &&
        el(
          "p.apunte",
          { estilo: { marginTop: "10px" } },
          "Sin configurar, Libreta Docente funciona igual: los datos viven sólo en este dispositivo.",
        ),

      el("div.botonera", [
        el(
          "button.boton",
          { onclick: () => configurarNube(dibujar) },
          nube.configurada ? "Cambiar proyecto" : "Configurar",
        ),
        nube.configurada &&
          !nube.conectada &&
          el("button.boton.primario", { onclick: () => acceder(dibujar) }, "Entrar"),
        nube.conectada &&
          el(
            "button.boton.primario",
            {
              onclick: async () => {
                avisar("Sincronizando…");
                const r = await sincronizar({ silencioso: true });
                dibujar();
                avisar(r.hecho ? "Al día" : "No se pudo: " + (r.motivo || "error"));
              },
            },
            "Sincronizar ahora",
          ),
      ]),

      nube.configurada &&
        el(
          "button.boton.ancho",
          {
            estilo: { marginTop: "8px" },
            onclick: async () => {
              const enlace = enlaceDeConfiguracion();
              try {
                await navigator.clipboard.writeText(enlace);
                avisar("Enlace copiado; abrilo en el otro dispositivo");
              } catch {
                prompt("Copiá este enlace y abrilo en el otro dispositivo:", enlace);
              }
            },
          },
          "Copiar enlace para otro dispositivo",
        ),

      nube.conectada &&
        el(
          "button.boton.ancho",
          {
            estilo: { marginTop: "8px" },
            onclick: () => {
              salir();
              dibujar();
              avisar("Saliste de la cuenta; los datos siguen en el teléfono");
            },
          },
          "Salir de la cuenta",
        ),
    );
  };

  dibujar();
  return tarjeta;
}

function configurarNube(alTerminar) {
  const config = nube.config;
  let url = config.url;
  let clave = config.clave;

  hoja("Conectar con Supabase", (cerrar) => [
    el(
      "p.apunte",
      "Creá un proyecto gratuito en supabase.com, corré el SQL de abajo una vez y pegá acá los dos datos que te da el panel, en Project Settings → API.",
    ),
    el("label.campo", [
      el("span", "URL del proyecto"),
      el("input", {
        value: url,
        placeholder: "https://xxxxxxxx.supabase.co",
        inputmode: "url",
        oninput: (e) => (url = e.target.value),
      }),
      el("div.apunte", "Sólo la base. Si copiás una que termina en /rest/v1/, se recorta sola."),
    ]),
    el("label.campo", [
      el("span", "Clave pública (anon)"),
      el("input", {
        value: clave,
        placeholder: "eyJhbGciOi…",
        oninput: (e) => (clave = e.target.value),
      }),
    ]),
    el("div.apunte", "La clave pública está pensada para estar en la app; no es secreta. Lo que protege tus datos son las reglas del SQL."),

    el("div.titulo-seccion", "SQL de instalación"),
    el("pre", {
      estilo: {
        background: "var(--cebra)",
        padding: "12px",
        borderRadius: "8px",
        fontSize: "0.7rem",
        overflowX: "auto",
        whiteSpace: "pre",
      },
      textContent: SQL_DE_INSTALACION,
    }),
    el(
      "button.boton.ancho",
      {
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(SQL_DE_INSTALACION);
            avisar("SQL copiado");
          } catch {
            avisar("No se pudo copiar; seleccionalo a mano");
          }
        },
      },
      "Copiar el SQL",
    ),

    el("div.botonera", [
      el("button.boton", { onclick: cerrar }, "Cancelar"),
      el(
        "button.boton.primario",
        {
          onclick: () => {
            if (!url.trim() || !clave.trim()) return avisar("Faltan datos");
            if (esClaveSecreta(clave)) {
              return avisar(
                "Esa es la clave secreta; va la pública (anon)",
                "mal",
              );
            }
            guardarConfig(url, clave);
            cerrar();
            alTerminar();
            avisar("Guardado. Ahora entrá con tu mail.");
          },
        },
        "Guardar",
      ),
    ]),
  ]);
}

function acceder(alTerminar) {
  let mail = "";
  let contrasena = "";
  let creando = false;

  const cuerpo = el("div");
  const dibujar = (cerrar) =>
    poner(
      cuerpo,
      el("div.segmentado", { estilo: { marginBottom: "14px" } }, [
        el(
          "button",
          {
            "aria-pressed": String(!creando),
            onclick: () => {
              creando = false;
              dibujar(cerrar);
            },
          },
          "Ya tengo cuenta",
        ),
        el(
          "button",
          {
            "aria-pressed": String(creando),
            onclick: () => {
              creando = true;
              dibujar(cerrar);
            },
          },
          "Crear cuenta",
        ),
      ]),
      el("label.campo", [
        el("span", "Mail"),
        el("input", {
          type: "email",
          value: mail,
          inputmode: "email",
          autocomplete: "email",
          oninput: (e) => (mail = e.target.value),
        }),
      ]),
      el("label.campo", [
        el("span", "Contraseña"),
        el("input", {
          type: "password",
          value: contrasena,
          autocomplete: creando ? "new-password" : "current-password",
          oninput: (e) => (contrasena = e.target.value),
        }),
      ]),
      el("div.botonera", [
        el("button.boton", { onclick: cerrar }, "Cancelar"),
        el(
          "button.boton.primario",
          {
            onclick: async (e) => {
              const boton = e.target;
              boton.disabled = true;
              try {
                if (creando) {
                  const r = await registrarse(mail, contrasena);
                  avisar(r.listo ? "Cuenta creada" : r.aviso);
                } else {
                  await entrar(mail, contrasena);
                  avisar("Conectado");
                }
                cerrar();
                alTerminar();
                sincronizar();
              } catch (error) {
                avisar(error.message);
                boton.disabled = false;
              }
            },
          },
          creando ? "Crear cuenta" : "Entrar",
        ),
      ]),
    );

  const { cerrar } = hoja("Tu cuenta", cuerpo);
  dibujar(cerrar);
}

function restaurar() {
  const entrada = el("input", { type: "file", accept: "application/json,.json" });
  entrada.addEventListener("change", async () => {
    const archivo = entrada.files?.[0];
    if (!archivo) return;
    try {
      const texto = await archivo.text();
      const datos = JSON.parse(texto);
      if (!datos || !Array.isArray(datos.cursos)) {
        return avisar("Ese archivo no parece un respaldo de Libreta Docente");
      }
      const seguro = await confirmar(
        "¿Restaurar este respaldo?",
        `Reemplaza todo lo que hay en este dispositivo por el archivo: ${datos.cursos.length} curso(s).`,
        "Restaurar",
      );
      if (seguro) {
        estado.reemplazar(datos);
        avisar("Respaldo restaurado");
      }
    } catch {
      avisar("No se pudo leer el archivo");
    }
  });
  entrada.click();
}
