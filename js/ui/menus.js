// El editor de un menú de conductas.

import * as estado from "../estado.js";
import { el, icono, hoja, avisar, confirmar, poner } from "./html.js";
import { COLORES, MAXIMO_CONDUCTAS, nuevaConducta, visibles } from "../domain/menus.js";
import { CUENTA, INTERRUPTOR } from "../domain/types.js";

const EMOJIS = [
  "✋", "⭐", "🎒", "⚠️", "💬", "✏️", "📘", "🤝",
  "🔧", "💡", "🧠", "🎯", "🔁", "⏰", "🧩", "👏",
];

export function editorDeMenu(menuId) {
  const cuerpo = el("div");

  const dibujar = () => {
    const menu = estado.menu(menuId);
    if (!menu) return;
    const conductas = visibles(menu);
    poner(
      cuerpo,
      el("label.campo", [
        el("span", "Nombre del menú"),
        el("input", {
          value: menu.nombre,
          onchange: (e) => estado.guardarMenu(menuId, { nombre: e.target.value }),
        }),
      ]),

      el("div.titulo-seccion", `Conductas (${conductas.length} de ${MAXIMO_CONDUCTAS})`),
      ...conductas.map((conducta) =>
        el(
          "div.tarjeta",
          { estilo: { borderLeft: `4px solid ${conducta.color}` } },
          [
            el("div.fila", [
              el("div", { estilo: { flex: "0 0 auto", fontSize: "1.4rem" } }, conducta.emoji),
              el("div", [
                el("strong", conducta.nombre),
                el(
                  "div.apunte",
                  conducta.modo === INTERRUPTOR
                    ? "Prendido o apagado todo el día"
                    : "Suma cada vez que lo tocás",
                ),
              ]),
              el(
                "div",
                { estilo: { flex: "0 0 auto", display: "flex" } },
                [
                  el(
                    "button.icono-boton",
                    {
                      onclick: () => editarConducta(menuId, conducta, dibujar),
                      "aria-label": "Editar",
                    },
                    icono("lapiz", 17),
                  ),
                  el(
                    "button.icono-boton",
                    {
                      onclick: async () => {
                        const seguro = await confirmar(
                          `¿Sacar «${conducta.nombre}»?`,
                          "Sale del menú, pero los toques que ya registraste conservan su nombre en los reportes.",
                          "Sacar del menú",
                        );
                        if (seguro) {
                          estado.quitarConducta(menuId, conducta.id);
                          dibujar();
                        }
                      },
                      "aria-label": "Sacar",
                    },
                    icono("tacho", 17),
                  ),
                ],
              ),
            ]),
          ],
        ),
      ),

      conductas.length < MAXIMO_CONDUCTAS
        ? el(
            "button.boton.ancho",
            {
              onclick: () =>
                editarConducta(
                  menuId,
                  nuevaConducta("", EMOJIS[conductas.length % EMOJIS.length], COLORES[conductas.length % COLORES.length]),
                  dibujar,
                  true,
                ),
            },
            [icono("mas", 18), "Agregar conducta"],
          )
        : el(
            "p.apunte",
            "Ocho es el tope, para que el cuadro nunca necesite desplazarse en medio de la clase.",
          ),
    );
  };

  dibujar();
  hoja("Menú", cuerpo);
}

function editarConducta(menuId, conducta, alTerminar, esNueva = false) {
  const copia = { ...conducta };
  hoja(esNueva ? "Conducta nueva" : copia.nombre || "Conducta", (cerrar) => [
    el("label.campo", [
      el("span", "Nombre"),
      el("input", {
        value: copia.nombre,
        autofocus: esNueva,
        placeholder: "Participó",
        oninput: (e) => (copia.nombre = e.target.value),
      }),
    ]),

    el("div.titulo-seccion", "Ícono"),
    el(
      "div",
      { estilo: { display: "flex", flexWrap: "wrap", gap: "6px" } },
      EMOJIS.map((emoji) => {
        const boton = el(
          "button.boton",
          {
            estilo: { flex: "0 0 auto", fontSize: "1.2rem", padding: "8px 10px", minHeight: "44px" },
            onclick: () => {
              copia.emoji = emoji;
              for (const otro of boton.parentElement.children) {
                otro.style.borderColor = "var(--linea-fuerte)";
                otro.style.borderWidth = "1px";
              }
              boton.style.borderColor = "var(--tinta)";
              boton.style.borderWidth = "2px";
            },
          },
          emoji,
        );
        if (emoji === copia.emoji) {
          boton.style.borderColor = "var(--tinta)";
          boton.style.borderWidth = "2px";
        }
        return boton;
      }),
    ),

    el("div.titulo-seccion", "Color"),
    el(
      "div",
      { estilo: { display: "flex", flexWrap: "wrap", gap: "8px" } },
      COLORES.map((color) => {
        const punto = el("button", {
          "aria-label": "Color",
          estilo: {
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: color === copia.color ? "3px solid var(--tinta)" : "1px solid var(--linea)",
            background: color,
            cursor: "pointer",
          },
          onclick: () => {
            copia.color = color;
            for (const otro of punto.parentElement.children) {
              otro.style.border = "1px solid var(--linea)";
            }
            punto.style.border = "3px solid var(--tinta)";
          },
        });
        return punto;
      }),
    ),

    el("div.titulo-seccion", "Cómo cuenta"),
    el("div.segmentado", [
      el(
        "button",
        {
          "aria-pressed": String(copia.modo === CUENTA),
          onclick: (e) => {
            copia.modo = CUENTA;
            marcar(e.target);
          },
        },
        "Suma cada toque",
      ),
      el(
        "button",
        {
          "aria-pressed": String(copia.modo === INTERRUPTOR),
          onclick: (e) => {
            copia.modo = INTERRUPTOR;
            marcar(e.target);
          },
        },
        "Prendido o apagado",
      ),
    ]),
    el(
      "p.apunte",
      "«Suma cada toque» sirve para participaciones: tres toques son tres veces. «Prendido o apagado» sirve para cosas que pasan una vez por día, como traer el material.",
    ),

    el("div.botonera", [
      el("button.boton", { onclick: cerrar }, "Cancelar"),
      el(
        "button.boton.primario",
        {
          onclick: () => {
            if (!copia.nombre.trim()) return avisar("Falta el nombre");
            if (esNueva) estado.agregarConducta(menuId, copia);
            else estado.editarConducta(menuId, conducta.id, copia);
            cerrar();
            alTerminar();
          },
        },
        "Guardar",
      ),
    ]),
  ]);
}

function marcar(boton) {
  for (const otro of boton.parentElement.children) {
    otro.setAttribute("aria-pressed", "false");
  }
  boton.setAttribute("aria-pressed", "true");
}
