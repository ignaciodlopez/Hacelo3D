# Plan — Herramienta "Organizador de escritorio"

Plan para implementar una herramienta nueva en Hacelo3D. Está escrito para que otro modelo o desarrollador lo ejecute fase por fase sin tener que volver a decidir nada: cada fase tiene su **Definición de terminado (DoD)** y no se avanza a la siguiente sin cumplirla. Prioridades como en [PLAN.md](../PLAN.md): **P0** imprescindible, **P1** después de que P0 funcione, **P2** backlog (dejar el código preparado, no implementarlo).

> Texto de la tarjeta (pedido del usuario): **Organizador de escritorio** — *Cantidad y tamaño de espacios para lápices, celular y notas adhesivas.*

## 0. Reglas para quien lo implemente

- **No hacer commits.** El usuario commitea solo; tampoco ofrecerlos.
- Leer antes de escribir código: [README.md](../README.md) ("Cómo agregar una herramienta" y "Arquitectura en una página") y la herramienta **"Para tus herramientas"** en `src/tools/organizer/`, que es la más parecida: bloques con huecos, impresos parados, sin soportes. Copiar su estilo (comentarios en español, `L(es, en)`, `normalizeParams` que nunca lanza, `createScope()` y `t()` en cada objeto de manifold).
- Unidades en mm, Z hacia arriba, la pieza apoya en `z = 0`, centrada en XY. **El frente es la cara de −Y** (igual que en el organizador).
- `build.js` es una función pura (sin DOM ni three.js). Los mensajes son códigos (`desk.empty`) traducidos en `src/app/i18n.js` como `msg.desk.empty` (ES y EN).
- Todo se imprime **en una sola pieza, parada, sin soportes**: todas las cavidades se abren hacia arriba y ninguna cara vuela más de 45° desde la vertical.
- Por defecto, **un solo color**: tiene que imprimirse sin AMS.
- Correr `npx vitest run tests/unit/desk*` y `npx eslint src tests` al terminar cada fase; al final, toda la suite unitaria y el E2E de la herramienta.

## 1. Qué es

Un bloque de escritorio de una sola pieza armado con **módulos**, que se acomodan solos uno al lado del otro:

| Módulo | Para qué | Prioridad |
|---|---|---|
| **Lapicero** | Celdas para lápices, biromes y tijeras (redondas, cuadradas o hexagonales), en filas escalonadas: la de atrás más alta | P0 |
| **Celular** | Ranura inclinada donde el celular queda parado mirando a quien lo usa, con muesca para el cable de carga | P0 |
| **Notas adhesivas** | Bolsillo para un taco de Post-it (76 × 76 por defecto) con muesca para agarrar las hojas | P0 |
| **Bandeja** | Franja baja adelante, a todo lo ancho, para clips, gomas y pendrives, con fondo redondeado contra la pared de adelante | P1 |
| **Tarjetas** | Ranura para tarjetas personales (90 × 50) | P1 |
| **Texto en el frente** | Nombre o leyenda grabada o en relieve en el frente | P1 |

El usuario elige **qué módulos lleva**, **cuántos espacios** (celdas del lapicero) y **de qué tamaño** (celda, ancho y grosor del celular, tamaño de las notas). No hay un editor libre de módulos: el schema del panel no tiene un control de "lista" y no hace falta crearlo.

## 2. Archivos

```
src/tools/desk/
  index.js      metadata, schema del panel, presets, orderSummary
  params.js     defaults, normalizeParams, constantes (tamaños de notas)
  build.js      build(K, params, ctx) → BuildResult; arma la pieza
  layout.js     PURO y sin manifold: calcula las zonas en planta (x, y, w, d, alto) a partir de los params
tests/unit/desk.build.test.js
tests/unit/desk.layout.test.js
tests/e2e/desk.spec.js
```

Además:
- `src/tools/registry.js`: importar `desk` y ubicarlo después de `organizer`.
- `src/app/icons.js`: agregar el ícono `desk` (trazo 24×24, mismo estilo que los demás; por ejemplo un vaso con dos lápices y un rectángulo bajo al lado).
- `src/app/i18n.js`: mensajes `msg.desk.*` en ES y EN.
- `README.md`: un párrafo "Undécima herramienta: Organizador de escritorio" con el mismo estilo que los otros.
- `filePrefix: 'organizador-escritorio'`.

**`layout.js` separado de `build.js`** permite testear el acomodo en milisegundos y sin WASM, y es lo que más va a cambiar si después se agregan módulos.

## 3. Parámetros (`params.js`)

`PARAMS_VERSION = 1`. Rango y default de cada uno; `normalizeParams` clampea todo (copiar `clamp`, `int`, `pick`, `bool` y `hex` de `organizer/params.js`).

### Generales
| Clave | Default | Rango / valores | Notas |
|---|---|---|---|
| `wallMm` | 2.4 | 1.6 – 5 | Pared exterior y entre zonas |
| `floorMm` | 2 | 1.2 – 5 | Fondo de todas las cavidades |
| `cornerRadiusMm` | 6 | 0 – 20 | Solo las esquinas verticales de afuera |
| `phoneSide` | `'left'` | `left` / `right` | De qué lado va el celular; las notas van del otro lado del lapicero |
| `colors` | `{ base: '#2b2b2b', accent: '#f2c14e' }` | hex | `accent` solo para el texto en relieve (P1) |
| `curveQuality` | `'normal'` | `draft` / `normal` / `high` | Copiar `qualityOf` del organizador |
| `snapToLayers` | `true` | bool | Alturas con `snapZ(z, printer)` |

### Lapicero
| Clave | Default | Rango | Notas |
|---|---|---|---|
| `pens` | `true` | bool | |
| `penShape` | `'round'` | `round` / `square` / `hex` | |
| `penCols` | 2 | 1 – 6 | Celdas a lo ancho |
| `penRows` | 2 | 1 – 3 | Filas; cada una un escalón más alta que la de adelante |
| `penCellMm` | 30 | 14 – 70 | Diámetro (redonda), lado (cuadrada) o entre caras (hex). 30 entra un puñado de biromes |
| `penHeightMm` | 95 | 40 – 150 | Alto de la fila de atrás |
| `penStepMm` | 15 | 0 – 40 | Cuánto más baja es cada fila de adelante |

### Celular
| Clave | Default | Rango | Notas |
|---|---|---|---|
| `phone` | `true` | bool | |
| `phoneWidthMm` | 82 | 60 – 100 | Ancho del celular **con funda** (la ranura mide esto + 4 mm) |
| `phoneThicknessMm` | 12 | 7 – 22 | Grosor con funda (la ranura mide esto + 1,5 mm) |
| `phoneAngleDeg` | 15 | 0 – 30 | Inclinación hacia atrás desde la vertical. **Máximo 30**: la cara de adelante de la ranura vuela ese ángulo |
| `phoneLipMm` | 14 | 8 – 30 | Alto del labio de adelante sobre el fondo de la ranura |
| `phoneBackMm` | 70 | 40 – 120 | Alto del respaldo |
| `phoneCable` | `true` | bool | Muesca en el labio para el cable |

### Notas adhesivas
| Clave | Default | Rango | Notas |
|---|---|---|---|
| `notes` | `'76x76'` | `none` / `76x76` / `51x76` / `38x51` / `custom` | Tamaños de Post-it estándar (ancho × fondo en planta) |
| `notesWidthMm`, `notesDepthMm` | 76, 76 | 30 – 130 | Solo con `custom` (`advanced`) |
| `notesClearanceMm` | 1.5 | 0.5 – 4 | Por lado |
| `notesHeightMm` | 30 | 15 – 60 | Alto de la zona; el bolsillo es este alto menos `floorMm` |
| `notesNotch` | `true` | bool | Muesca semicircular en la pared de adelante para sacar las hojas |

### Bandeja (P1)
`tray` (bool, `false`), `trayDepthMm` (35, 20 – 80), `trayHeightMm` (20, 12 – 40), `trayDividers` (0, 0 – 4), `trayScoop` (bool, `true`).

### Tarjetas (P1)
`cards` (bool, `false`): ranura de 92 × 6 mm a 15° detrás del bolsillo de notas o sobre la bandeja; ver §5.6.

### Texto en el frente (P1)
`label` (string, `''`, máx. 30), `fontId` (`'lato-black'`), `labelStyle` (`engraved` / `relief`), `labelSizeMm` (8, 4 – 20), `labelDepthMm` (0.6, 0.4 – 1.6).

**`presetKeep`**: `['colors', 'phoneWidthMm', 'phoneThicknessMm', 'label', 'fontId', 'curveQuality', 'snapToLayers']`: las medidas de tu celular y tu texto no cambian al elegir un ejemplo.

## 4. Acomodo en planta (`layout.js`)

Función pura `layoutDesk(p)` que devuelve `{ zones, width, depth, ok, messages }`. Cada zona es `{ kind, x0, x1, y0, y1, height, ... }` con datos propios del módulo (centros de celdas, etc.), sin redondear todavía a capas (eso lo hace `build.js` con `zf`).

**Orden de izquierda a derecha:** `celular | lapicero | notas` con `phoneSide: 'left'`; espejado con `right`. Los módulos apagados no ocupan lugar. Entre zonas vecinas hay **una sola pared** (`wallMm`), no dos.

**Ancho de cada zona (interior, sin paredes):**
- Lapicero: `penCols · cell + (penCols − 1) · wall`, con `cell = penCellMm` (para hex, `cell` es el ancho entre vértices en X: `penCellMm · 2/√3`).
- Celular: `phoneWidthMm + 4`.
- Notas: `notesW + 2 · clearance`.

**Fondo:** todas las zonas de la fila principal tienen el **mismo fondo** `D = max(fondo propio de cada zona)`: el bloque queda rectangular y se apoya parejo. El contenido de una zona menos profunda se centra en Y dentro de `D` (las notas y el lapicero) o se pega atrás (el celular, para que el labio quede al frente).
- Lapicero: `penRows · cell + (penRows − 1) · wall`.
- Celular: `lipFront (3) + slotW / cos(θ) + phoneBackMm · tan(θ) + backWall (4)`, donde `slotW = phoneThicknessMm + 1,5`. Es lo que ocupa la ranura inclinada vista desde arriba, más el labio y el respaldo.
- Notas: `notesD + 2 · clearance`.

**Bandeja (P1):** franja adelante de la fila principal, de `x` mínimo a máximo, con fondo `trayDepthMm`.

**Total:** `width = Σ anchos + (n + 1) · wall`, `depth = D + 2 · wall (+ trayDepthMm + wall si hay bandeja)`. Se centra en el origen.

**Errores y avisos:**
- Ningún módulo prendido → `error` `desk.empty`.
- No entra en la cama → `warn` `size.bedOverflow` (el que ya existe), como en el organizador.
- `phoneBackMm > penHeightMm + 10` → `info` `desk.phoneTaller` (queda raro a la vista, pero no es un error).

## 5. Geometría (`build.js`)

Estructura igual a `organizer/build.js`: `normalizeParams`, `normalizePrinter`, `createScope`, `zf = snapToLayers ? snapZ : id`, y un `makeItem` local (copiarlo). Un solo item, `name: 'organizador'`; una parte `base` (y `accent` si hay texto en relieve de otro color, P1).

### 5.1 Cuerpo
1. Contorno exterior 2D: `roundedRect(K, t, width, depth, cornerRadiusMm, 0, 0, seg)`.
2. Para cada zona, el rectángulo de la zona **más sus paredes** (media pared de cada lado que comparte, pared entera de los lados de afuera) **intersecado con el contorno** y extruido a `zf(zone.height)`. Unir todo con `K.Manifold.union`. Así las esquinas de afuera salen redondeadas y las alturas escalonadas no dejan rendijas.
3. Las paredes entre dos zonas de distinta altura toman la **altura mayor** (el escalón queda del lado bajo).

### 5.2 Lapicero
Como `buildHolder` del organizador: una fila por escalón (`height = penHeightMm − (penRows − 1 − i) · penStepMm` desde adelante), una celda por columna. Cada celda es un hueco que va de `floorMm` hasta arriba (+1 mm), con un **chaflán de entrada de 0,6 mm a 45°** (copiar el truco de `extrude(h, 0, 0, [k, k])` de `buildHolder`). Las celdas redondas con `segmentsFor(r, seg)`, las hex con `circle(R, 6)`.

### 5.3 Celular
Se arma el **perfil en el plano YZ** y se extruye en X por el ancho de la ranura:
1. La zona se extruye a `phoneBackMm` (respaldo).
2. Se rebaja todo lo que está **delante de la ranura** por encima de `floorMm + phoneLipMm`: queda el labio adelante.
3. La ranura: un paralelogramo de grosor `slotW`, inclinado `θ` hacia atrás, con el fondo plano en `z = floorMm`, que sube hasta pasar la altura del respaldo. Se construye como `CrossSection` de 4 puntos en (y, z), `extrude(phoneWidthMm + 4)`, y se rota para que la extrusión quede en X.
4. Con `phoneCable`: una muesca en U en el **labio**, centrada en X, de 12 mm de ancho, desde el borde del labio hasta el fondo de la ranura. Se abre hacia arriba, sin puentes.

**Por qué se imprime sin soportes:** la cara de atrás de la ranura mira hacia arriba (el celular se apoya ahí); la de adelante vuela `θ` desde la vertical, y `θ ≤ 30°`. El fondo es plano y está apoyado. El test de §7 lo comprueba con `scanOverhangs` (`core/kernel/analysis.js`).

### 5.4 Notas adhesivas
Bolsillo rectangular de `notesW + 2·clearance` × `notesD + 2·clearance`, desde `floorMm` hasta arriba, con esquinas interiores de 1 mm (para que el taco no se trabe en el radio). Con `notesNotch`: semicírculo de Ø 30 mm (o `0,4 · notesW` si es más chico) cortado en la pared de adelante, desde arriba hasta `floorMm + 6`, para meter el dedo.

### 5.5 Bandeja (P1)
Reusar la idea de `buildBox` del organizador: hueco con fondo redondeado contra la pared de adelante (`scoopRadiusMm = min(12, trayHeight − floor − 1)`), divisiones opcionales a lo ancho. La pared entre la bandeja y la fila principal es la pared de adelante de esa fila.

### 5.6 Tarjetas (P1)
Ranura de 92 × 6 mm, inclinada 15° hacia atrás (mismo método que el celular), en una zona propia de 96 mm de ancho y 45 mm de alto, que va a la derecha de las notas. Si no hay notas, al lado del lapicero.

### 5.7 Texto en el frente (P1)
Igual que `logoOnFront` del organizador: `textToCrossSection` con `fontId`, parado sobre la cara de −Y de la **zona más baja de la fila de adelante** (la bandeja si existe; si no, la cara de adelante del bloque, a la altura del labio del celular). Grabado: se resta (1 color). En relieve: sobresale `labelDepthMm` y entra 0,4 mm en la pared; si su color es distinto del de la base es otra parte y necesita AMS (mismo aviso `color.needsMMU`). Si no entra en el frente, `warn` `desk.labelNoRoom` y sigue sin texto.

### 5.8 Resultado
`info.sizeMm` con el ancho, fondo y alto total. `info.colorChanges: null` salvo que haya texto en relieve de otro color.

## 6. Panel (`index.js`)

- `id: 'desk'`, `icon: 'desk'`, `name: L('Organizador de escritorio', 'Desk organizer')`, `short: L('Escritorio', 'Desk')`, `description: L('Cantidad y tamaño de espacios para lápices, celular y notas adhesivas.', 'Number and size of spaces for pens, phone and sticky notes.')`.
- `exports: ['stl-merged', 'zip-per-color', '3mf', 'png']`.
- Secciones en este orden: **Lapicero** · **Celular** · **Notas adhesivas** · **Bandeja** (P1) · **Texto** (P1) · **Medidas generales** (`collapsed: true`: pared, fondo, esquinas, `phoneSide`) · **Colores** · **Calidad** (`collapsed: true`, copiar la del organizador).
- Cada sección arranca con su checkbox (`pens`, `phone`, el `select` de `notes`); los demás controles de la sección con `showIf` del módulo prendido. Las tolerancias (`notesClearanceMm`, `phoneThicknessMm` extra) van en `advanced: true`.
- `phoneAngleDeg` con `tooltip`: "Más de 30° no se imprime sin soportes".
- `orderSummary`: `[['Medidas', '230 × 95 × 95 mm'], ['Lapicero', '4 celdas redondas de 30 mm'], ['Celular', 'hasta 82 × 12 mm'], ['Notas', '76 × 76'], ['Color', color(p.colors.base)]]`; las filas de módulos apagados con valor `''` (el diálogo las omite, mirar `organizer/index.js`).

### Presets
| id | Nombre | Qué cambia |
|---|---|---|
| `full` | Completo: celular, lapicero y notas | defaults |
| `compact` | Compacto para cama de 18 cm | `penCols: 2, penRows: 1, penCellMm: 28, phoneWidthMm: 78`; tiene que entrar en 180 × 180 |
| `pens-only` | Solo lapicero (6 celdas) | `phone: false, notes: 'none', penCols: 3, penRows: 2` |
| `phone-notes` | Base para celular con notas | `pens: false` |
| `big` | Grande con bandeja (P1) | `tray: true, penCols: 3`, notas `76x127` como `custom` |

## 7. Tests

### `tests/unit/desk.layout.test.js` (sin WASM)
- Con los defaults: tres zonas en orden `phone, pens, notes`; con `phoneSide: 'right'` el orden se invierte.
- Ninguna zona se solapa con otra, y entre vecinas queda exactamente `wallMm`.
- El ancho total es `Σ anchos + (n + 1)·wall`; todas las zonas tienen el mismo fondo.
- Todo apagado → `desk.empty`.
- Hex: el ancho de la celda es `penCellMm · 2/√3`.

### `tests/unit/desk.build.test.js` (modelo: `organizer.build.test.js`)
- **Matriz**: `pens × phone × notes` (con todo apagado excluido) × `penShape` × `phoneSide`: sin errores, malla `NoError`, `genus 0` (todos los huecos son ciegos), volumen > 0, apoya en `z = 0`.
- **Celdas del lapicero**: un corte `merged.slice(z)` a media altura de la fila de adelante tiene `penCols` agujeros más los de las otras zonas; usar `toPolygons()` y contar contornos.
- **Escalones**: la altura máxima del bloque es `penHeightMm` (alineada a capa) y la fila de adelante es `penStepMm` más baja.
- **Celular sin soportes**: `scanOverhangs(positions, indices, floorMm + 0.01, -0.71)` → `fraction === 0` con `phoneAngleDeg` 0, 15 y 30. Con 30 el peor ángulo es ≤ 30,5°.
- **Ranura del celular**: un celular simulado (`cube` de `phoneWidthMm × phoneThicknessMm × 150`, rotado `θ` y apoyado en el fondo de la ranura) **no pisa** la pieza (`intersect(...).volume() < 0.01`).
- **Notas**: un taco simulado de `notesW × notesD × 20` apoyado en el fondo del bolsillo no pisa la pieza, y sobra `clearance` por lado.
- **Cama**: los defaults entran en 256 × 256; el preset `compact`, en 180 × 180 (sin `size.bedOverflow` con `printer: { bed: [180, 180] }`).
- **Normalizar**: basura (`null`, strings, números fuera de rango, `notes: 'xxx'`) nunca lanza y queda en rango.
- **Presets**: todos generan pieza válida.
- **Vista previa**: con `ctx.preview` mismas medidas y `merged` como en el organizador (mirar su test "vista previa").
- **Resumen del pedido**: etiquetas y valores en ES y EN.

### `tests/e2e/desk.spec.js` (modelo: `organizer.spec.js`)
Abrir `#/tool/desk` en modo taller, esperar "triángulos", sin `.messages .error`, apagar el celular (cambia la medida en `.info-line`), elegir el preset `pens-only` con `getByLabel('Ejemplos para empezar')`, bajar el STL (`organizador-escritorio.stl`). `tests/e2e/viewer.spec.js`, `tests/unit/order.test.js` y `tests/unit/preview.test.js` ya recorren todas las herramientas activas del registro: tienen que pasar sin tocarlos.

## 8. Fases

### Fase 1 — Esqueleto y lapicero (P0)
`params.js`, `layout.js` (solo lapicero), `build.js` (cuerpo + celdas), `index.js` con las secciones Lapicero, Medidas generales, Colores y Calidad, registro, ícono e i18n.
**DoD:** la herramienta aparece en la home y en la barra lateral, genera el lapicero en el navegador, y pasan `desk.layout` y la parte de lapicero de `desk.build`.

### Fase 2 — Celular (P0)
Zona, ranura inclinada, labio, muesca del cable, `phoneSide`.
**DoD:** tests de sin soportes y del celular simulado en verde para 0°, 15° y 30°.

### Fase 3 — Notas adhesivas (P0)
Zona, tamaños estándar y `custom`, muesca.
**DoD:** test del taco simulado en verde; matriz completa de §7 en verde.

### Fase 4 — Cierre de P0
Presets (menos `big`), `orderSummary`, textos ES/EN, párrafo en el README, E2E.
**DoD:** suite unitaria completa + `desk.spec.js` + `viewer.spec.js` en verde; `eslint` sin avisos; probar a mano en el navegador cambiar cada control y mirar que ninguno deje la pieza rota.

### Fase 5 — P1
Bandeja, tarjetas, texto en el frente, preset `big`.
**DoD:** cada módulo nuevo entra en la matriz de tests; el texto en relieve de otro color avisa AMS si la impresora no tiene.

### P2 (no implementar, dejar el código preparado)
- **Huecos para patitas de goma** abajo (Ø 8 × 1,5 mm), reusando `core/kernel/magnets.js` (sirve igual para imanes).
- **Módulos encastrables**: cada zona como pieza separada con colas de milano entre sí, para camas chicas. Por eso `layout.js` devuelve zonas y no un sólido.
- **Texturas** en las paredes de afuera (`core/kernel/surface.js`).
- **Salida del cable por atrás**: un canal por debajo del fondo de la ranura (requiere un puente de 12 mm, verificar que imprima).
- **Celular acostado** (horizontal, para ver videos).

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| La ranura inclinada vuela demasiado | `phoneAngleDeg ≤ 30` en `normalizeParams` + test con `scanOverhangs` |
| La funda del celular no entra o queda floja | Medidas "con funda" en el label, +1,5 mm de grosor y +4 mm de ancho; ajustable en avanzadas |
| El bloque queda más ancho que la cama | Aviso `size.bedOverflow` + preset `compact` para 180 × 180 |
| El celular, más pesado arriba, vuelca el organizador | Respaldo y labio sobre el mismo bloque, con fondo `D` igual en todas las zonas; avisar con `desk.phoneTaller` si el respaldo supera mucho al lapicero |
| Booleanas lentas con muchas celdas | Unir los huecos en un solo `union` antes de restar (como `buildHolder`); probar el preset más grande en `draft` < 1 s |
| El taco de notas se traba en las esquinas | Esquinas interiores de 1 mm y holgura de 1,5 mm por lado |

## 10. Estado de implementación

Fases 1 a 5 (P0 y P1) implementadas en `src/tools/desk/`. Verificado: lint sin avisos, 345 tests unitarios (68 propios), E2E de la herramienta y del visor en Chromium; mirada en el navegador. **Falta probarlo impreso:** el juego del celular y del taco de notas está sacado de medidas típicas, no de una impresión real.

### Desviaciones respecto del plan (y por qué)

1. **Color del texto:** la clave es `colors.text` (no `accent`): en el resto de la app `color.text` ya se traduce como "Letras".
2. **Nombre de archivo:** `filePrefix: 'organizador'` y el item se llama `escritorio` (la descarga sale `organizador-escritorio.stl`); con el prefijo completo salía repetido.
3. **Perfil de la ranura inclinada:** la ranura y "lo que queda adelante por encima del labio" son **un solo corte** (un polígono de 6 puntos). Como dos cortes con una cara coincidente, al sumarle la muesca del cable la malla quedaba con un vértice degenerado y `genus` 1 (un "asa" que no existe).
4. **Muesca del cable con bandeja:** si hay bandeja, la muesca sube hasta la altura de la bandeja, para que no quede un puente sobre ella (y el pedido de `genus 0` siga valiendo).
5. **Chaflán del lapicero:** en las filas que tienen detrás una fila más alta, el chaflán no se mete en esa pared (dejaba un techo plano de 0,01 mm que `scanOverhangs` contaba como voladizo).
6. **Preset `compact`:** `penCols 2, penRows 1, penCellMm 26, notes 'none'`. Con notas de cualquier tamaño y el celular (86 mm de ranura) el bloque pasaba de 180 mm; sin notas mide unos 148 mm. No pisa `phoneWidthMm`.
7. **Con la bandeja, el texto** va en el frente de la bandeja; sin ella, en el del lapicero, o bajo la muesca de las notas, o en el labio del celular solo si no hay muesca de cable (ver `labelOnFront` en `build.js`); si no entra, avisa `desk.labelNoRoom`.
8. **Tarjetas:** zona de 92 mm de ancho con ranura de 6 mm a 15°, labio de 8 mm y respaldo de 45 mm (constantes `CARD` en `layout.js`, no se editan desde el panel).

### Rediseño visual (después de la primera versión)

La primera versión salió como cajas pegadas de aristas vivas. Se rehízo para que sea más suave, moderno y simple:

- **Módulos separados sobre un zócalo:** nuevo `podGapMm` (4 mm por defecto; 0 = paredes compartidas como antes). Cada módulo es un bloque propio con sus dos paredes, apoyado en un zócalo de 5 mm que cubre todo el contorno (`spacing()` en `layout.js`).
- **Bloques suaves:** esquinas verticales redondeadas (`cornerRadiusMm`, 10 por defecto) y borde de arriba redondeado (`edgeRadiusMm`, 1,5 por defecto; se limita a `pared − chaflán − 0,9 mm` para que quede un poco de plano arriba). Se construyen como el casco convexo de cuatro "pucks" con alturas y radios propios por esquina; abajo quedan planos y verticales, sin soportes.
- **Respaldo en cuña** del celular y de las tarjetas (sube del labio al respaldo, de adelante hacia atrás).
- **Paredes parejas:** el bolsillo de notas y los huecos de la bandeja tienen esquinas concéntricas con las de afuera; el bolsillo se limita a `3,4 × juego` para no tocar las esquinas vivas del taco.
- **Valores por defecto:** pared 3 mm, fondo 2,4, lapicero 90 mm, labio 12 mm, pared de atrás de las ranuras 5 mm.
