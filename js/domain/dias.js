// El día del docente. Los toques y las ausencias se cuentan por día calendario:
// no hay nada que abrir ni cerrar, y mañana la pantalla arranca limpia.

const dosDigitos = (n) => String(n).padStart(2, "0");

/** El día de una fecha como "AAAA-MM-DD", en la zona horaria del docente. */
export function clave(cuando = new Date()) {
  const f = new Date(cuando);
  return `${f.getFullYear()}-${dosDigitos(f.getMonth() + 1)}-${dosDigitos(f.getDate())}`;
}

/** Una clave de día de vuelta a Date, al mediodía para esquivar husos horarios. */
export function desdeClave(clave) {
  const [a, m, d] = clave.split("-").map(Number);
  return new Date(a, m - 1, d, 12);
}

/** "12 de marzo", para mostrar. Con año si no es el actual. */
export function enPalabras(claveDia, hoy = new Date()) {
  const f = desdeClave(claveDia);
  const opciones = { day: "numeric", month: "long" };
  if (f.getFullYear() !== hoy.getFullYear()) opciones.year = "numeric";
  return f.toLocaleDateString("es-AR", opciones);
}

/** "12/03", corto, para tablas. */
export function corta(claveDia) {
  const [, m, d] = claveDia.split("-");
  return `${d}/${m}`;
}

export const RANGOS = [
  { valor: "hoy", etiqueta: "Hoy" },
  { valor: "semana", etiqueta: "Esta semana" },
  { valor: "mes", etiqueta: "Este mes" },
  { valor: "todo", etiqueta: "Todo" },
];

/** El primer instante de un rango. La semana empieza el lunes. */
export function inicioDeRango(rango, ahora = new Date()) {
  const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  if (rango === "todo") return 0;
  if (rango === "semana") inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7));
  if (rango === "mes") inicio.setDate(1);
  return inicio.getTime();
}

/** Los días de la semana que contiene una fecha, de lunes a viernes. */
export function semanaDe(ahora = new Date()) {
  const inicio = new Date(inicioDeRango("semana", ahora));
  return Array.from({ length: 5 }, (_, i) => {
    const f = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i);
    return {
      clave: clave(f),
      etiqueta: f.toLocaleDateString("es-AR", { weekday: "short" }),
      dia: f.getDate(),
      hoy: clave(f) === clave(ahora),
      porVenir: clave(f) > clave(ahora),
    };
  });
}

/** Los días, de más nuevo a más viejo, en que pasó algo en este curso. */
export function diasConRegistro(toques, ausencias) {
  const dias = new Set();
  for (const t of toques) dias.add(clave(t.en));
  for (const a of ausencias) dias.add(a.dia);
  return [...dias].sort().reverse();
}
