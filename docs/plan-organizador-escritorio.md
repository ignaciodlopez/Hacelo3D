# Diseño — Herramienta "Organizador de escritorio"

La herramienta se rehízo desde cero a partir de un modelo real: **Lapicero UAI** (un lapicero con soporte de celular, de 6,5 × 3,25 × 3,2 pulgadas), sin el logo grabado en el frente de la taza. La primera versión era un bloque de módulos (lapicero, celular, notas adhesivas, tarjetas, bandeja y texto); se descartó entera.

> Texto de la tarjeta: **Organizador de escritorio** — *Un lapicero grande y un soporte inclinado para el celular, sobre la misma base.*

**No hacer commits.** El usuario commitea solo; tampoco ofrecerlos.

## 1. Modelo de referencia (medido del STL)

El STL tiene 740 triángulos, 165,10 × 82,55 × 81,28 mm (6,5 × 3,25 × 3,2 pulgadas) y 197,1 cm³. Una sola pieza, parada, sin soportes:

| Parte | Medida |
|---|---|
| Base | 165,1 × 82,55 × 5,08 mm (0,2″), esquinas verticales de radio 12,7 mm |
| Taza (lapicero) | 76,2 × 82,55 mm en planta, 81,28 mm de alto, pared de 3,81 mm (0,15″); el fondo de adentro es la base. Un solo compartimiento |
| Logo | "UAI" grabado 1,1 mm en la pared de adelante de la taza (**se quitó**) |
| Soporte | 88,9 mm de ancho (3,5″), pegado a la pared de la taza, a todo lo ancho hasta el borde de la base |
| Placa | Inclinada 15° hacia atrás, 3,81 mm de espesor (3,94 en horizontal), llega a 81,28 mm con el borde de arriba horizontal |
| Ranura | 16,5 mm medidos en horizontal entre el labio y la placa a nivel de la base (15,9 en perpendicular) |
| Labio | 3,43 mm de ancho y 5,48 mm sobre la base, con la punta en medio círculo; a 12,7 mm del borde de adelante |
| Respaldo | Pared vertical de 3,81 mm que sube desde la base hasta unirse con la cara de atrás de la placa a unos 55 mm de altura |
| Túnel | Entre la placa y el respaldo, a lo largo de todo el soporte: sube hasta unos 27 mm y termina en arco. Es un aligeramiento: ahorra material y se ve como un arco en el extremo |

Todo es una extrusión a lo largo de X salvo la taza, así que el soporte entero sale de **un perfil en el plano YZ**.

## 2. Qué cambió respecto del modelo

- **Parametrizable:** las medidas del modelo son los valores por defecto (`params.js`), pero se pueden cambiar: ancho, fondo y alto de la taza, divisiones, ancho de la ranura, inclinación, ancho y alto del soporte, alto del labio, pared, base, esquinas y bordes.
- **Divisiones** (0 a 3) en la taza, de la altura de la taza. Se limitan solas para que cada compartimiento mida al menos 12 mm (`desk.dividersLimited`).
- **Soporte centrado en el fondo** de la base, con al menos una esquina redondeada de aire adelante y atrás. En el modelo el labio estaba a 12,7 mm del borde y el soporte quedaba corrido hacia adelante. Si el soporte necesita más fondo que la taza (placa alta y muy inclinada), la base crece y la taza la acompaña.
- **Techo del túnel a dos aguas de 45°** en vez de un arco: se puede comprobar con `scanOverhangs` que no hay puentes (el arco tiene tramos casi horizontales). El túnel termina en punta cuando su ancho llega a 4 mm (`ARCH_TOP`).
- **Bordes suaves:** el canto de arriba de la taza y de la base está redondeado (`edgeRadiusMm`, 1,5 mm) y la entrada de la taza lleva un chaflán de 0,6 mm.
- **De qué lado va el celular** (`phoneSide`): derecho (como el modelo) o izquierdo. Solo cambia dónde se ponen los dos módulos; el soporte es simétrico en X.
- Se pueden apagar los dos módulos por separado (solo lapicero, solo soporte). Con los dos apagados: error `desk.empty`.
- Sin ranura para el cable ni texto: el modelo no los tiene. (Con el celular apoyado en la base el enchufe no tiene dónde ir; si se quiere cargar mientras está parado hace falta un hueco en la base, que es otro diseño.)

Con los valores por defecto la pieza mide 165,1 × 82,55 × 81,3 mm y pesa 194,9 cm³ (un 1 % menos que el modelo: sin logo y con los cantos redondeados).

## 3. Geometría (`build.js` y `layout.js`)

`layout.js` es **puro y sin manifold** (se prueba en milisegundos): calcula el acomodo en planta y el perfil del soporte. `build.js` lo convierte en sólidos.

- **Planta:** `ancho = taza + soporte`, pegados. `fondo = max(fondo de la taza, fondo del soporte + 2·max(esquina, 8))`.
- **Base:** un bloque suave (`soft()`) de `ancho × fondo × baseMm`.
- **Taza:** un bloque suave de la altura pedida, menos la cavidad (rectángulo redondeado con esquinas concéntricas, pared pareja) y el chaflán de entrada; más las divisiones, que se meten 0,5 mm en las paredes.
- **Soporte:** `standProfile()` devuelve tres polígonos en (y, z), con y = 0 en el frente del labio:
  - `outer`: la placa y la cuña hasta el respaldo vertical. El respaldo se une a la placa al `BRACE` = 66 % de su altura.
  - `cavity`: el túnel, entre la cara de atrás de la placa y la de adelante del respaldo, con techo a 45°.
  - `lip`: el labio con la punta redondeada.
  Se extruyen a lo largo de X (`alongX`), el túnel se resta del cuerpo y todo se une a la base.
- **Unión con la taza:** el soporte se mete 1 mm en la pared de la taza (unión volumétrica, sin caras que apenas se tocan). El túnel sale por el extremo libre y del otro lado lo cierra la pared de la taza.
- **El soporte se hunde hasta la mitad de la base** (`zo = baseMm / 2`), no más: el redondeo del canto de la base nunca pasa de esa mitad, así que en el extremo del soporte no queda un escalón de 0,1 mm con una cara que mira hacia abajo (lo encontró `scanOverhangs`).

**Por qué se imprime sin soportes:** la cara de adelante de la placa mira hacia arriba, la de atrás vuela como mucho `phoneAngleDeg` ≤ 30° desde la vertical, el techo del túnel vuela 45° (`nz = −0,707`, por encima del límite −0,75 del test) y todo lo demás es vertical o mira hacia arriba.

## 4. Parámetros

| Clave | Por defecto | Rango |
|---|---|---|
| `pens`, `phone` | `true` | módulos prendidos |
| `cupWidthMm`, `cupDepthMm`, `cupHeightMm` | 76,2 · 82,55 · 81,28 | 40–140 · 40–140 · 30–150 |
| `cupDividers` | 0 | 0–3 |
| `phoneWidthMm` | 88,9 | 60–140 (con 140 entra una tablet) |
| `phoneSlotMm` | 16 | 8–30: grosor del celular con funda + 1 o 2 mm |
| `phoneAngleDeg` | 15 | 0–30 |
| `phoneHeightMm`, `phoneLipMm` | 81,28 · 5,5 | 40–150 · 3–20 |
| `phoneSide` | `right` | `left` / `right` |
| `wallMm`, `baseMm` | 3,81 · 5,08 | 1,6–6 · 2–8 |
| `cornerRadiusMm`, `edgeRadiusMm` | 12,7 · 1,5 | 0–25 · 0–4 |
| `colors.base`, `curveQuality`, `snapToLayers` | `#4fb3f0` (celeste), `normal`, `true` | |

`PARAMS_VERSION = 2`: los parámetros guardados de la versión 1 (otro diseño) se descartan (`migrate: () => ({})`). Las alturas (`baseMm`, `cupHeightMm`, `phoneHeightMm` y el tope del labio) se alinean a la capa con `snapZ` antes de armar el layout.

Presets: Clásico (los valores por defecto), Compacto para cama de 18 cm, Lapicero con divisiones, Solo lapicero, Solo soporte de celular. No pisan el juego de la ranura, de qué lado va el celular, el color ni la calidad.

## 5. Tests

- `tests/unit/desk.layout.test.js` (sin WASM): acomodo, medidas del modelo, perfil del soporte (ángulo, espesor, ranura, respaldo, túnel con techo a 45°, labio) y normalización.
- `tests/unit/desk.build.test.js`: pieza válida de una sola isla en toda la matriz (lado × módulos × divisiones), medidas de referencia, taza hueca hasta la base, divisiones por `slice().toPolygons()`, celular simulado que entra sin pisar la pieza con 0°, 15° y 30° (y uno 2 mm más grueso que no entra), túnel abierto del lado libre y cerrado del lado de la taza, `scanOverhangs` sin caras que vuelen en ninguna combinación, cama de 256, 180 y 150 mm, vista previa, presets y resumen del pedido.
- `tests/e2e/desk.spec.js`: abrir la herramienta, apagar el soporte, elegir un ejemplo, todo apagado → error, descargar el STL (`organizador-escritorio.stl`).

El túnel pasante deja la pieza con **género 1** cuando se apaga la taza (queda abierto de los dos lados), y también si la placa es más alta que la taza (el túnel asoma por encima de su pared). Los tests lo esperan así.

## 6. Pendiente

- **Probarlo impreso:** el juego de la ranura sale de medir el modelo (15,9 mm en perpendicular) y de un celular simulado; falta ver un celular real.
- Si se quiere cargar el celular parado: un hueco en la base para el enchufe.
- Huecos para patitas de goma abajo (Ø 8 × 1,5 mm), reusando `core/kernel/magnets.js`.
- Texto o nombre en el frente de la taza (el modelo tenía el logo ahí).
