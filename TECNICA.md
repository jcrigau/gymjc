# Técnica de los ejercicios — cómo está hecho y cómo mantenerlo

> ⚠️ **Leé esto cada vez que cambies las rutinas.** Si sumás un ejercicio que
> no está en la lista de abajo, el botón "Cómo se hace" no le va a aparecer
> hasta que lo agregues acá.

## Qué hace

Cada ejercicio puede tener una ficha de técnica que se abre con el botón
**ⓘ Cómo se hace**, disponible en dos lugares:

- **Durante el entrenamiento**, arriba a la derecha de la hoja de carga.
- **En la biblioteca de ejercicios**, al tocar cualquier ejercicio.

La ficha muestra: dibujo del cuerpo con los músculos resaltados, preparación,
ejecución paso a paso, errores comunes, advertencias de seguridad y un botón
para buscar un video en YouTube (eso último sí necesita internet; el resto
funciona offline).

Si un ejercicio **no tiene** técnica cargada, el botón simplemente no aparece.
No molesta ni muestra una ficha vacía.

## Decisión de diseño: por qué no están los 162

Se cargaron a mano solo los **38 ejercicios que usás o usaste alguna vez**
(los del historial hasta el 15/08/2026 + los de las tres rutinas del plan).
Escribir técnica de calidad para los 162 de la biblioteca daría mucho texto
de relleno; es preferible tener menos fichas y que sean buenas.

## Archivos involucrados

| Archivo | Qué contiene |
|---|---|
| `js/data/technique.js` | **El contenido.** Textos, músculos y tabla de alias. Es el que se edita normalmente. |
| `js/components/muscleMap.js` | El dibujo SVG del cuerpo y los ids de músculo válidos. |
| `js/components/techniqueSheet.js` | La hoja que se muestra. Casi nunca hay que tocarla. |

## Cómo agregar un ejercicio nuevo

Abrí `js/data/technique.js` y sumá una entrada en `TECHNIQUE`:

```js
'sentadilla con barra': {                    // clave: nombre en minúsculas, SIN tildes
  primary: ['cuadriceps'],                   // músculos principales
  secondary: ['gluteo', 'isquios', 'lumbar'],// secundarios (se pintan más suaves)
  setup:  ['Barra apoyada en el trapecio…', 'Pies al ancho de hombros…'],
  exec:   ['Bajá controlado…', 'Empujá el piso…'],
  errors: ['Rodillas hacia adentro.', 'Redondear la espalda baja.'],
  caution: 'Texto naranja de advertencia. Opcional.',
  note:    'Aclaración al pie. Opcional.',
},
```

**Ids de músculo válidos** (tienen que existir en `muscleMap.js`, si no, no se
pinta nada):

`trapecio` · `deltoide-ant` · `deltoide-med` · `deltoide-post` · `manguito` ·
`pecho` · `dorsal` · `lumbar` · `biceps` · `triceps` · `antebrazo` ·
`abdominales` · `oblicuos` · `gluteo` · `cuadriceps` · `aductores` ·
`isquios` · `gemelos`

## Cómo funcionan los nombres alternativos

**La búsqueda es por NOMBRE, no por id.** Se hizo así a propósito: los
ejercicios personalizados tienen ids tipo `c_mrcl1r4kv2agl` que son distintos
en cada dispositivo, así que buscar por id no serviría.

Si el mismo ejercicio se conoce con otro nombre (traducción, variante
regional, o un ejercicio personalizado que creaste con otro nombre), se suma a
la tabla `ALIASES`:

```js
export const ALIASES = {
  'subida al cajon': 'step up',   // alias  ->  nombre canónico
};
```

Ambos lados van en minúsculas y sin tildes.

### Alias ya detectados en tu historial

Estos eran ejercicios personalizados duplicados que ya tenías cargados:

| Nombre que usaste | Apunta a | Nota |
|---|---|---|
| Subida al cajón | Step up | Tenías los dos cargados por separado |
| Vuelos laterales | Elevaciones laterales | Estaba mal clasificado en grupo "Espalda" |
| Estocada | Zancadas | |
| Isquiotibiales en máquina | Curl femoral sentado | |
| Izquiotobiales en máquina | Curl femoral sentado | Error de tipeo del original |

> 💡 Ojo con **"Vuelos laterales"**: se interpretó como elevaciones laterales
> (deltoide medio). Si en realidad lo hacías inclinado hacia adelante, es
> deltoide **posterior** y correspondería apuntarlo a `pajaros (deltoide posterior)`.

También se cargaron alias de uso común por las dudas: `prensa`, `leg press`,
`dorsalera`, `polea al pecho`, `remo bajo`, `tijeras`, `desplantes`,
`pantorrillas`, `rompecraneos`, `perro de caza`, `manguito rotador`, entre otros.

## Los 38 ejercicios cargados

**Pecho** — Press de banca · Press de banca con mancuernas · Press inclinado con
mancuernas · Press inclinado 45° con mancuernas · Press inclinado con barra

**Espalda** — Jalón al pecho · Jalón con agarre neutro · Remo con mancuerna ·
Remo en máquina · Remo en polea baja · Remo en punta (T-bar) · Peso muerto · Face pull

**Hombros** — Elevaciones laterales · Elevaciones laterales en polea ·
Press de hombros con mancuernas · Rotación externa en polea

**Bíceps** — Curl con barra · Curl con barra Z · Curl con mancuernas · Curl martillo

**Tríceps** — Press francés · Extensión en polea (cuerda)

**Piernas y glúteos** — Prensa de piernas · Extensión de cuádriceps ·
Curl femoral sentado · Step up · Zancadas · Sentadilla sumo · Hip thrust

**Gemelos** — Elevación de gemelos en prensa · Elevación de gemelos de pie

**Core** — Plancha · Plancha lateral · Bird-dog · Pallof press ·
Gato-camello + rotación torácica

**Cardio** — Bicicleta fija

## Checklist al actualizar rutinas

1. ¿Los ejercicios nuevos ya están en `TECHNIQUE`? Si no, agregalos.
2. ¿Alguno se llama distinto a como figura en la biblioteca? Sumalo a `ALIASES`.
3. Subí `VERSION` en `js/app.js` y `CACHE` en `sw.js`.
4. Si creaste archivos nuevos, agregalos a la lista `ASSETS` de `sw.js`.
