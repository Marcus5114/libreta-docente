// Cuatro ayudas para escribir pantallas sin una biblioteca.
//
// `el` arma un elemento: etiqueta con clases y id al estilo CSS, un objeto de
// propiedades y los hijos. Las funciones en las propiedades que empiezan con
// "on" se enganchan como eventos.
//
//   el("button.primario", { onclick: guardar }, "Guardar")
//   el("ul", lista.map((x) => el("li", x.nombre)))

export function el(selector, props, hijos) {
  if (props !== undefined && (Array.isArray(props) || typeof props !== "object" || props instanceof Node)) {
    hijos = props;
    props = {};
  }
  props = props || {};

  const [etiqueta, ...resto] = String(selector).split(/(?=[.#])/);
  const nodo = document.createElement(etiqueta || "div");
  for (const parte of resto) {
    if (parte[0] === ".") nodo.classList.add(parte.slice(1));
    if (parte[0] === "#") nodo.id = parte.slice(1);
  }

  for (const [llave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (llave.startsWith("on") && typeof valor === "function") {
      nodo.addEventListener(llave.slice(2), valor);
    } else if (llave === "clase") {
      nodo.className += " " + valor;
    } else if (llave === "estilo") {
      Object.assign(nodo.style, valor);
    } else if (llave === "datos") {
      for (const [k, v] of Object.entries(valor)) nodo.dataset[k] = v;
    } else if (llave in nodo && llave !== "list") {
      nodo[llave] = valor;
    } else {
      nodo.setAttribute(llave, valor === true ? "" : valor);
    }
  }

  agregar(nodo, hijos);
  return nodo;
}

export function agregar(nodo, hijos) {
  if (hijos === null || hijos === undefined || hijos === false) return nodo;
  if (Array.isArray(hijos)) {
    for (const hijo of hijos) agregar(nodo, hijo);
    return nodo;
  }
  nodo.append(hijos instanceof Node ? hijos : document.createTextNode(String(hijos)));
  return nodo;
}

export function vaciar(nodo) {
  while (nodo.firstChild) nodo.removeChild(nodo.firstChild);
  return nodo;
}

export function poner(nodo, ...hijos) {
  vaciar(nodo);
  agregar(nodo, hijos);
  return nodo;
}

/** Un ícono dibujado con trazos, del mismo grosor en toda la app. */
const TRAZOS = {
  atras: "M15 5l-7 7 7 7",
  mas: "M12 5v14M5 12h14",
  menos: "M5 12h14",
  tilde: "M4 12l5 5L20 6",
  cruz: "M6 6l12 12M18 6L6 18",
  lapiz: "M4 20h4L19 9a2 2 0 10-3-3L5 17v3z",
  tacho: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13",
  bajar: "M12 4v12m0 0l-5-5m5 5l5-5M4 20h16",
  subir: "M12 20V8m0 0l-5 5m5-5l5 5M4 4h16",
  menu: "M4 7h16M4 12h16M4 17h16",
  gente: "M4 20a5 5 0 0110 0M9 11a3 3 0 100-6 3 3 0 000 6M15 20a5 5 0 017-4.6M17 11a3 3 0 100-6",
  aula: "M4 5h16v14H4zM4 10h16M9 10v9M15 10v9",
  papel: "M6 3h8l4 4v14H6zM14 3v4h4",
  tabla: "M3 5h18v14H3zM3 10h18M9 10v9M15 10v9",
  nube: "M7 18a4 4 0 010-8 5 5 0 019.6-1A3.5 3.5 0 1117 18z",
  engranaje: "M12 15a3 3 0 100-6 3 3 0 000 6M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1",
  reloj: "M12 21a9 9 0 100-18 9 9 0 000 18M12 7v5l3 2",
  pantalla: "M3 5h18v11H3zM8 20h8M12 16v4",
};

export function icono(nombre, tamano = 20) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", tamano);
  svg.setAttribute("height", tamano);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.classList.add("icono");
  const trazo = document.createElementNS(ns, "path");
  trazo.setAttribute("d", TRAZOS[nombre] || TRAZOS.papel);
  svg.append(trazo);
  return svg;
}

/** Un aviso corto abajo de la pantalla. */
let avisoAbierto = null;
export function avisar(texto, tono = "") {
  avisoAbierto?.remove();
  const nodo = el("div.aviso" + (tono ? "." + tono : ""), texto);
  document.body.append(nodo);
  avisoAbierto = nodo;
  setTimeout(() => nodo.classList.add("yendose"), 2200);
  setTimeout(() => nodo.remove(), 2600);
}

/** Una pregunta de sí o no. Devuelve una promesa. */
export function confirmar(titulo, detalle, textoSi = "Sí") {
  return new Promise((listo) => {
    const cerrar = (respuesta) => {
      fondo.remove();
      listo(respuesta);
    };
    const fondo = el("div.fondo-modal", { onclick: (e) => e.target === fondo && cerrar(false) }, [
      el("div.modal", [
        el("h2", titulo),
        detalle && el("p", detalle),
        el("div.botonera", [
          el("button.boton", { onclick: () => cerrar(false) }, "Cancelar"),
          el("button.boton.peligro", { onclick: () => cerrar(true) }, textoSi),
        ]),
      ]),
    ]);
    document.body.append(fondo);
  });
}

/** Cierra cualquier hoja o diálogo abierto. Se usa al cambiar de pantalla. */
export function cerrarCapas() {
  for (const capa of document.querySelectorAll(".fondo-hoja, .fondo-modal")) {
    capa.remove();
  }
}

/** Una hoja que sube desde abajo. Devuelve el nodo donde poner el contenido. */
export function hoja(titulo, contenido, alCerrar) {
  const fondo = el("div.fondo-hoja", {
    onclick: (e) => {
      if (e.target === fondo) cerrar();
    },
  });
  const cerrar = () => {
    fondo.classList.add("yendose");
    setTimeout(() => fondo.remove(), 200);
    alCerrar?.();
  };
  const cuerpo = el("div.hoja", [
    el("div.tirador"),
    el("header.hoja-cabeza", [
      el("h2", titulo),
      el("button.icono-boton", { onclick: cerrar, "aria-label": "Cerrar" }, icono("cruz")),
    ]),
    el("div.hoja-cuerpo", typeof contenido === "function" ? contenido(cerrar) : contenido),
  ]);
  fondo.append(cuerpo);
  document.body.append(fondo);
  requestAnimationFrame(() => fondo.classList.add("abierta"));
  return { fondo, cuerpo, cerrar };
}

/** Baja un archivo generado en el momento. */
export function bajarArchivo(nombre, contenido, tipo = "text/csv;charset=utf-8") {
  const enlace = el("a", {
    href: URL.createObjectURL(new Blob([contenido], { type: tipo })),
    download: nombre,
  });
  document.body.append(enlace);
  enlace.click();
  setTimeout(() => {
    URL.revokeObjectURL(enlace.href);
    enlace.remove();
  }, 1000);
}
