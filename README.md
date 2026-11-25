# Libreta Docente

Registro de aula y de trabajos prácticos, para el teléfono. Tocás a un alumno,
tocás qué hizo, y Libreta Docente lleva la cuenta. Después cargás los TP y los exámenes
sobre el mismo curso, y las notas y la participación salen de un solo lugar.

Se instala como una aplicación y funciona sin conexión. Si configurás la nube,
lo que cargás en el aula aparece en la notebook.

## Qué hace

- **Cursos en un minuto.** Pegás la lista de alumnos. Acepta «Apellido, Nombre»
  y «Nombre Apellido», y descarta los números de orden.
- **Modo clase.** Pantalla completa. Un toque corto abre el menú de conductas;
  mantener el dedo apretado llena el casillero y marca ausente. El `−1` corrige.
- **Aula.** Un plano de escritorios cuadrados: tocás una celda y aparece un
  banco, deslizás y aparecen varios. Dos bancos pegados se dibujan como un solo
  mueble, así salen grupos, filas, de a dos o una U. En modo Mover se toca qué
  mover y después adónde, y vale igual para los bancos, el pizarrón y la
  puerta. El aula no pertenece a ningún curso: cualquier curso se muestra en
  cualquier aula, y cada curso guarda sus propios lugares.
- **Trabajos.** TP y exámenes con número, nombre, fecha de consigna, fecha
  límite y fecha de reentrega. Por alumno: entregó, a tiempo, reentrega, nota
  original y nota de reentrega. La nota que cuenta es la última que haya.
- **Reportes.** Participación por rango, la semana día por día y la planilla de
  trabajos con promedios. Todo se baja en CSV y la pantalla se puede imprimir.
- **Sin cuenta obligatoria.** Sin configurar nada, los datos viven sólo en el
  teléfono. El respaldo es un archivo.

## Las palabras

Las mismas en el código, en la pantalla y en este archivo.

| Palabra | Qué es |
| --- | --- |
| **Curso** | Un grupo de alumnos que se junta seguido: «4° A Innovación». |
| **Alumno** | Una persona en la lista de un curso. Dado de baja conserva su historia. |
| **Conducta** | Algo que se registra tocando: participó, trajo el material. |
| **Menú** | La lista de conductas que aparece al tocar. Hasta ocho, para que nunca haya que desplazarse en medio de la clase. Varios cursos pueden compartirlo. |
| **Toque** | Un registro: qué alumno, qué conducta, cuándo. Nunca se edita. |
| **Ausencia** | Un alumno que no estuvo, un día. No es una conducta: responde «¿vino?», no «¿qué hizo?». |
| **Día** | Lo que cubren las cuentas. El día calendario del docente; no hay nada que abrir ni cerrar. |
| **Aula** | Un plano de escritorios. Describe muebles, no personas. |
| **Lugar** | Un escritorio del plano. Puede estar vacío. |
| **Trabajo** | Un TP o un examen que se le da al curso. |
| **Entrega** | Lo que un alumno hizo con un trabajo. |

## Las decisiones

- **Un toque no se edita, se borra.** El `−1` elimina el toque en vez de
  registrar una corrección, así la cuenta siempre es la cantidad de toques.
- **La ausencia se marca sosteniendo, sin cartel.** El llenado del casillero es
  la confirmación. Un cartel en medio de la clase es un cartel que hay que
  cerrar.
- **Ocho conductas como máximo.** Si el cuadro necesita desplazarse, el docente
  deja de usarlo.
- **La nota de la reentrega se guarda aparte de la original.** Las dos quedan;
  para el promedio cuenta la última.
- **El no entregado cuenta como cero en el promedio.** Un trabajo sin cargar,
  en cambio, no cuenta: todavía no pasó nada.
- **Una conducta sacada del menú no se borra**, para que los toques viejos sigan
  teniendo nombre en los reportes.
- **Mover es en dos toques, no arrastrando.** En una pantalla chica el dedo
  tapa justamente lo que se está moviendo, y soltar fuera de lugar es fácil.
- **El aula se recorta en modo clase.** Se dibuja sólo la parte que tiene algo,
  y nunca por debajo de 46 píxeles por escritorio, para que el dedo no falle.

## Cómo está hecho

JavaScript a secas, sin compilar y sin dependencias. Son módulos ES que el
navegador carga tal cual, así que para trabajar alcanza con servir la carpeta:

```sh
python3 -m http.server 8777
# o
npx serve .
```

Las pruebas de las reglas corren con Node, sin instalar nada:

```sh
node --test "pruebas/*.test.mjs"
```

```
index.html            la cáscara
sw.js                 lo que hace que abra sin conexión
manifest.webmanifest  lo que la vuelve instalable
css/estilos.css       todo el estilo, una hoja
fuentes/              Montserrat, servida desde acá para que ande sin conexión
js/
  app.js              arranque, rutas y pestañas
  estado.js           todo lo que Libreta sabe, y cómo se cambia
  deposito.js         dónde se guarda (IndexedDB)
  nube.js             sincronización con Supabase y la fusión
  domain/             las reglas, sin pantalla: alumnos, toques, aula,
                      trabajos, reportes, días
  ui/                 una pantalla por archivo
pruebas/              pruebas de las reglas
```

Los datos son un solo documento JSON en IndexedDB. Cada registro tiene `id` y
`actualizadoEn`, que es lo único que necesita la sincronización.

## La nube (opcional)

Libreta Docente anda sin esto. Sirve para abrir lo mismo en el teléfono y en la
notebook.

1. Creá un proyecto gratuito en [supabase.com](https://supabase.com).
2. En el editor SQL, corré una vez:

```sql
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
  on public.libretas for update using (auth.uid() = id);
```

   El `grant` importa: sin él Postgres rechaza todo con «permission denied
   for table», antes de mirar las políticas.

3. En la app, Ajustes → Configurar, pegá la URL del proyecto y la clave
   pública (`anon`), que están en Project Settings → API.
4. Creá tu cuenta con mail y contraseña desde la misma pantalla.

La clave pública está pensada para vivir en la aplicación; lo que protege los
datos son las reglas de arriba, que atan cada fila a su dueño.

### Cómo se fusiona

Se baja la fila, se fusiona con lo que hay en el teléfono y, si el resultado
difiere, se sube. Fusionar es siempre del lado del cliente y no depende del
orden:

- **Toques y ausencias se suman.** Nunca se editan, así que dos dispositivos
  desconectados terminan con la suma de los dos.
- **El resto se resuelve por fecha:** gana el registro tocado más tarde.
- **Lo borrado queda anotado con su hora**, para que no vuelva de la nube. Las
  anotaciones de más de noventa días se tiran.

El límite conocido: un curso es un registro, con su lista de alumnos adentro.
Si editás la lista del mismo curso en dos dispositivos sin sincronizar en el
medio, gana la última edición entera. Para un docente con un teléfono y una
notebook no suele pasar; si llegara a molestar, el paso siguiente sería sacar
los alumnos a su propia colección.

## De dónde viene

La idea del registro por toques, el modo clase y el plano del aula vienen de
[Tap & Tally](https://github.com/teacherdotdev/tap-and-tally), de Elliot Roe
(Apache-2.0). Libreta Docente es una reescritura para el teléfono, en otro stack, con
el agregado del gestor de trabajos prácticos y exámenes.
