# Hacelo3D — Plan de proyecto (v2, auditado)

Web app que corre 100 % en el navegador con muchas herramientas paramétricas para generar modelos listos para impresión 3D. El usuario ajusta parámetros en un panel, ve el resultado en 3D en tiempo real y descarga STL / 3MF.

**Primera herramienta: "Llavero con nombre".** La captura de referencia (`docs/referencia-llavero.png`; si no está, pedírsela al usuario) muestra el estilo de UI buscado. La herramienta va **más allá de la captura**: el alcance se tomó también de los generadores de llaveros más usados (MakerWorld / OpenSCAD customizers) — varias formas de base, varios tipos de argolla, 1 a 4 colores, texto con contorno o sombra, íconos, lote de nombres acomodado en la cama de la impresora, etc.

Este documento está pensado para que otro modelo/desarrollador lo ejecute fase por fase. Cada fase tiene una **Definición de terminado (DoD)**; no avanzar a la siguiente sin cumplirla.

### Prioridades
Cada funcionalidad tiene prioridad:
- **P0** — imprescindible para la primera versión publicable.
- **P1** — entra en v1, pero después de que P0 funcione completo.
- **P2** — post v1 / backlog. Diseñar el código para que entre sin reescribir, pero no implementar todavía.

---

## 1. Decisiones técnicas (cerradas)

| Tema | Decisión | Motivo |
|---|---|---|
| Lenguaje | JavaScript (ES modules), sin TypeScript. `// @ts-check` + `jsconfig.json` con `checkJs` y JSDoc en los contratos. | Pedido del usuario; igual se obtiene chequeo de tipos en el editor. |
| Bundler / dev server | **Vite** | Arranque instantáneo, soporta WASM y Web Workers de módulo. |
| Framework UI | **Ninguno** (vanilla JS + componentes chicos propios). Paneles generados desde un *schema* (§4). | Pedido del usuario; la UI es un formulario + un canvas. |
| Render 3D | **three.js** + `OrbitControls` | Pedido del usuario. Solo se usa para *mostrar*; no genera geometría. |
| Kernel geométrico | **manifold-3d** (WASM) | Booleanas 2D y 3D robustas, offset 2D (Clipper2 adentro), extrusión, y **garantiza mallas manifold** (cerradas, imprimibles). Sirve para todas las herramientas futuras. |
| Fuentes | **opentype.js** (TTF/OTF/WOFF; **no** WOFF2) | Da los contornos de cada glifo + kerning + ligaduras básicas. El texto se aísla detrás de una interfaz `TextShaper` para poder cambiar a **harfbuzzjs** en P2 (árabe, hebreo, ligaduras contextuales complejas). |
| SVG (íconos, formas, SVG del usuario) | `SVGLoader` de three.js **en el hilo principal** (usa `DOMParser`, que no existe en workers); se mandan polígonos al worker. | Evita escribir un parser de SVG. |
| ZIP / 3MF | **fflate** | ZIP rápido y chico; 3MF es un ZIP con XML. |
| Íconos de diseño (corazón, estrella, pata…) | **Phosphor Icons, peso "fill"** (MIT) — solo los SVG elegidos, copiados al repo. | Íconos rellenos = se pueden extruir directo. |
| Tests | **Vitest** (geometría y exportadores en Node; manifold-3d corre en Node) + **Playwright** (smoke e2e). | |
| CI | GitHub Actions: lint + test + build en cada push. | |
| Backend | **Ninguno** en v1. Sitio estático. | Deploy en Netlify / Vercel / GitHub Pages. |
| Licencia del proyecto | MIT (confirmar con el usuario) + página "Créditos" con licencias de fuentes (OFL) e íconos (MIT). | |

Instalar la última versión estable de cada dependencia y dejarla fijada en `package-lock.json`. Node 20+.

### Convenciones globales
- **Unidades: milímetros** en todo el código.
- **Z hacia arriba** (convención de impresión). La geometría se genera en Z-up y se exporta tal cual. En el visor: `camera.up.set(0, 0, 1)` **antes** de crear `OrbitControls`, y `GridHelper` rotado 90° en X para quedar en el plano XY.
- La pieza se apoya en `z = 0` y queda centrada en XY en el origen.
- Toda la generación de geometría es una **función pura** `params → resultado` que no toca el DOM ni three.js. Corre en un Web Worker y se testea en Node.
- Rutas a assets (`/fonts`, `/icons`) siempre con `import.meta.env.BASE_URL` como prefijo; si no, se rompe al deployar en un subpath (GitHub Pages).
- **Alturas "alineadas a capas"**: todas las alturas Z (base, relieve, incrustación, borde…) se redondean al múltiplo más cercano de la altura de capa del perfil de impresora (§3.1), salvo que el usuario lo desactive. Evita capas raras y cambios de color a mitad de capa.

### Fuera de alcance en v1
- Cuentas de usuario, "talleres", pagos, límites de descarga (el banner "Estás probando sin taller" de la captura **no** se implementa; las descargas son libres).
- Backend, base de datos, guardado en la nube, envío directo a impresoras.
- Escritura de derecha a izquierda y scripts complejos (árabe, devanagari): P2 con harfbuzzjs.

---

## 2. Estructura del repositorio

```
builderfor3d/
  index.html
  package.json
  jsconfig.json
  vite.config.js
  .github/workflows/ci.yml
  public/
    fonts/
      fonts.json            # catálogo de fuentes incluidas (ver §5.13)
      *.ttf
      LICENSES/
    icons/
      icons.json            # catálogo de íconos (id, nombre es/en, archivo, tags)
      *.svg
  src/
    main.js
    app/
      shell.js              # layout: sidebar, header, contenedor
      router.js             # hash router: #/  #/tool/<id>  #/credits
      home.js               # grilla de tarjetas de herramientas
      credits.js            # licencias de terceros
      i18n.js               # diccionarios es/en, t(), detección por navigator.language
      theme.js              # dark/light/sistema
    core/
      kernel/
        manifold.js         # init del WASM (una sola vez), withScope() para liberar memoria
        shapes2d.js         # círculo, rect redondeado, elipse, corazón, etiqueta, hexágono, fitShapeAround()
        text.js             # TextShaper (opentype) → CrossSection (§5.2)
        svg.js              # polígonos de SVG → CrossSection (normaliza tamaño y orientación)
        mesh.js             # Manifold → { positions, indices } (respeta numProp)
        analysis.js         # volumen, bbox, alturas de cambio de color, partes finas, islas
      fonts/
        fontStore.js        # carga/cachea fuentes (incluidas, subidas, P2: catálogo online)
      printer/
        profiles.js         # perfiles de impresora (cama, boquilla, altura de capa)
      export/
        stl.js              # STL binario
        threemf.js          # 3MF multi-parte con colores
        zip.js
        png.js              # captura del visor
        download.js
      viewer/
        Viewer.js
      ui/
        controls/           # segmented, number, slider, select, fontSelect, iconSelect, textarea, checkbox, color, file
        panelFromSchema.js
      worker/
        geometry.worker.js
        workerClient.js
      state/
        toolState.js        # params actuales, versión y migraciones
        history.js          # deshacer / rehacer
        persistence.js      # localStorage + URL compartible
        presets.js          # presets incluidos y del usuario
    tools/
      registry.js
      keychain/
        index.js            # metadata, schema, defaults, presets incluidos, version + migrate
        build.js            # PURO
        layout.js           # acomodo de lote en placas
        validate.js
    styles/
      tokens.css
      app.css
  tests/
    unit/...
    e2e/...
  docs/
    referencia-llavero.png
    verificacion-slicers.md
```

---

## 3. Arquitectura

```
[Panel UI] --params--> [toolState] --(history, persistence)--> debounce 150 ms --> [workerClient]
                                                                                  |
                                                                       postMessage {toolId, params, printer, reqId}
                                                                                  v
                                                                     [geometry.worker.js]
                                                                      manifold-3d + opentype
                                                                      tool.build(params, ctx)
                                                                                  |
                                                        BuildResult (Float32Array/Uint32Array transferibles)
                                                                                  v
                                [Viewer] reemplaza meshes   +   [Panel de info: medidas, triángulos, gramos, cambios de color, warnings]
                                                                                  |
                                                          botones de descarga → export/stl | threemf | zip | png
```

- El worker carga el WASM y las fuentes una vez y las cachea (fuentes por `fontId`).
- Cada pedido lleva un `reqId` incremental; el cliente descarta respuestas viejas.
- Si `build` tira una excepción: mostrar el error en el panel y **mantener la última geometría válida** en el visor.
- Si el worker muere (OOM, error de WASM): recrearlo automáticamente y reintentar una vez.
- Las exportaciones se hacen en el hilo principal con el resultado ya recibido.
- Indicador "Generando…" sobre el visor; la UI nunca se bloquea.

### 3.1 Perfil de impresora (global, compartido por todas las herramientas) — P0
Se edita desde un botón en el header ("🖨 Bambu A1 · 0.4 · 0.2 mm") y se guarda en localStorage.

| Campo | Default | Uso |
|---|---|---|
| `bed` | `256×256` | Validar tamaño y acomodar lotes. Presets: Bambu A1 mini 180×180, A1/P1/X1 256×256, H2D 325×320, Prusa MK4 250×210, Prusa MINI 180×180, Ender-3 220×220, Personalizada. |
| `nozzleMm` | 0.4 | Detección de trazos finos. |
| `layerHeightMm` | 0.2 | Redondeo de alturas y cálculo de capas de cambio de color. |
| `firstLayerMm` | 0.2 | Ídem. |
| `multiMaterial` | `true` | Si es `false` (impresora de un solo extrusor), avisar cuando un diseño necesita AMS/MMU y sugerir alternativas con pausa. |
| `densityGcm3` | 1.24 (PLA) | Estimación de gramos. |

### 3.2 Contratos
```js
/**
 * @typedef {Object} Part
 * @property {string} id                 // 'base', 'letters', 'textOutline', 'border', ...
 * @property {string} label              // "Base", "Letras" — usado en nombres de archivo y en el 3MF
 * @property {string} colorKey           // 'base' | 'text' | 'accent' | 'border'
 * @property {string} color              // hex, para preview y 3MF
 * @property {Float32Array} positions    // xyz por vértice, mm, Z-up
 * @property {Uint32Array} indices
 * @property {number} volumeMm3
 *
 * @typedef {Object} Item                // una pieza física (un llavero). En lote hay varios.
 * @property {string} name               // "Sofía" → archivos "llavero-sofia_*.stl"
 * @property {Part[]} parts              // sin solapes de volumen entre sí (pueden tocarse en caras)
 * @property {{positions: Float32Array, indices: Uint32Array}} merged  // unión de todo, para STL de un color
 * @property {[number, number, number]} sizeMm
 * @property {[number, number]} offsetXY // posición en el visor / placa
 *
 * @typedef {Object} BuildResult
 * @property {Item[]} items
 * @property {{x:number, y:number, w:number, h:number}[][]} [plates] // P1: acomodo por placa (lote)
 * @property {{level:'info'|'warn'|'error', code:string, params?:object}[]} messages  // se traducen en la UI con t(code, params)
 * @property {{colorChanges: {zMm:number, layer:number, toColorKey:string}[] | null,
 *             gramsByColor: Record<string, number>, triangles:number}} info
 */
```
Los mensajes del worker son **códigos** (`'ring.thinWall'`), no texto, para poder traducirlos.

---

## 4. Contrato de herramienta

```js
// src/tools/<id>/index.js
export default {
  id: 'keychain',
  status: 'active',                       // 'active' | 'soon'
  icon: 'key',
  name: { es: 'Llavero con nombre', en: 'Name keychain' },
  description: { es: 'Escribí un nombre y descargá el llavero listo para imprimir, en uno o varios colores', en: '…' },
  paramsVersion: 1,
  migrate(oldParams, fromVersion) { /* devuelve params de la versión actual */ },
  defaults: { /* params */ },
  presets: [ { id: 'classic', name: {es:'Clásico'}, params: {...} }, ... ],
  schema: [ /* secciones y controles */ ],
  exports: ['stl-merged', 'zip-per-color', '3mf', 'png'],
  build: () => import('./build.js'),      // se importa dentro del worker
};
```

Schema del panel:
```js
{ section: 'text', title: {es:'Texto', en:'Text'}, priority: 'P0', controls: [
  { type: 'segmented', key: 'mode', options: [['single', {es:'Un llavero'}], ['batch', {es:'Varios nombres'}]] },
  { type: 'textarea', key: 'text', label: {es:'Texto del llavero'}, showIf: p => p.mode === 'single',
    hint: {es:'Con Enter pasás a otro renglón dentro del mismo llavero.'} },
  { type: 'number', key: 'marginMm', label: {es:'Margen alrededor'}, unit: 'mm', min: 0.5, max: 15, step: 0.5, advanced: false },
]}
```
- Tipos de control: `segmented`, `number` (acepta "1,5" y "1.5"; flechas ↑↓ con step; Shift = ×10), `slider`, `select`, `fontSelect`, `iconSelect`, `textarea`, `checkbox`, `color` (con paleta de colores de filamento comunes + libre), `file`.
- `showIf(params)` para mostrar/ocultar; `advanced: true` para controles que van dentro de un "Más opciones" plegable en cada sección (mantiene la UI simple como en la captura).
- Cada control puede tener `tooltip` explicando para qué sirve en términos de impresión.

---

## 5. Herramienta 1: Llavero con nombre

### 5.1 Parámetros

Notación: `H` = grosor de base, `T` = forma 2D del texto, `S` = silueta (cuerpo + oreja − agujero).

**Texto**
| Param | Tipo | Default | Prio | Notas |
|---|---|---|---|---|
| `mode` | `single`/`batch` | `single` | P0 | |
| `text` | string | `Valentina` | P0 | Multilínea. Máx 3 líneas × 40 caracteres. |
| `batchText` | string | `Sofía\nMateo\nValentina` | P1 | Un nombre por línea (máx 200). Opción `batchSeparator`: salto de línea / coma / punto y coma. Cada entrada puede tener `\n` literal escrito como `\|` para multilínea. |
| `fontId` | string | `pacifico` | P0 | Ver §5.13. |
| `align` | left/center/right | center | P0 | Con varias líneas. |
| `letterSpacingMm` | número | 0 | P0 | −3 a 5. Negativo ayuda a que las cursivas se toquen. |
| `lineSpacing` | factor | 1.0 | P0 | 0.6 a 2. |
| `boldOffsetMm` | número | 0 (o el `recommendedBold` de la fuente) | P0 | 0 a 1. Engorda letras finas. |
| `lineScales` | número[] | `[1, 1, 1]` | P2 | Tamaño relativo por renglón (ej. nombre grande, teléfono chico). |
| `uppercase` | bool | false | P1 | Fuerza mayúsculas. |
| `icon` | id \| null | null | P1 | Ícono de §5.13.2. |
| `iconPosition` | before/after/both | before | P1 | |
| `iconScale` | factor | 1.0 | P1 | Relativo al alto de mayúscula. |
| `arcDegrees` | número | 0 | P2 | Texto en arco (−180 a 180). |

**Tamaño**
| Param | Tipo | Default | Prio | Notas |
|---|---|---|---|---|
| `sizeMode` | `textWidth` / `overallWidth` / `textHeight` / `capHeight` | `textWidth` | P0 | "Ancho de las letras" / "Ancho total del llavero (incluida la argolla)" / "Alto total del texto" / "Alto de mayúscula". |
| `sizeMm` | número | 50 | P0 | Un solo valor, interpretado según `sizeMode`. |
| `batchUniform` | `sameScale` / `sameWidth` | `sameWidth` | P1 | En lote: todos con el mismo ancho, o todos con el mismo tamaño de letra (nombres largos quedan más largos). |

**Forma de la base**
| Param | Tipo | Default | Prio | Notas |
|---|---|---|---|---|
| `shape` | ver lista | `follow` | P0/P1 | P0: `follow` ("Sigue las letras"), `rounded` (rectángulo redondeado / pastilla). P1: `ellipse`, `circle`, `heart`, `tag` (etiqueta de valija), `hexagon`, `cloud`, `badge` (escudo). P2: `svg` (subida por el usuario). |
| `marginMm` | número | 3 | P0 | Distancia mínima del texto al borde. |
| `smoothMm` | número | 1.5 | P0 | Solo `follow`. Rellena muescas entre letras (cierre morfológico). |
| `fillCounters` | bool | true | P0 | Solo `follow`. Rellena los huecos internos (el ojo de la "o" grande, etc.). |
| `cornerRadiusMm` | número | 999 | P0 | Solo `rounded`. Se recorta a alto/2 → con 999 queda pastilla/cápsula. |
| `baseThicknessMm` | número | 3 | P0 | 1.2 a 10. |
| `chamferMm` | número | 0 | P2 | Bisel en el borde superior (extrusión con `scaleTop` no sirve para formas no convexas; hacerlo con capas de offset escalonadas cada `layerHeight`). |

**Letras (estilo y colores)**
| Param | Tipo | Default | Prio | Notas |
|---|---|---|---|---|
| `letterStyle` | `relief` / `engraved` / `flush` | `relief` | P0 | En relieve / Grabado (hundido, 1 color) / Al ras (incrustado, 2 colores). |
| `reliefMm` | número | 1.4 | P0 | `relief`. 0.4 a 5. |
| `engraveDepthMm` | número | 0.6 | P0 | `engraved` y `flush`. Debe dejar ≥ 0.8 mm de piso. |
| `textEffect` | `none` / `outline` / `shadow` | `none` | P1 | Solo con `relief`. |
| `textOutlineMm` | número | 1.2 | P1 | Ancho del contorno de letra (3er color). |
| `textOutlineHeightMm` | número | 0.6 | P1 | Altura de la capa de contorno; las letras se apoyan encima. |
| `shadowDxMm`/`shadowDyMm` | número | 1 / −1 | P1 | Desplazamiento de la sombra. |
| `faceDown` | bool | false | P1 | Solo `flush`/`engraved`: exporta la pieza dada vuelta para imprimir la cara con texto contra la cama (cara lisa/texturada). |

**Borde**
| Param | Tipo | Default | Prio | Notas |
|---|---|---|---|---|
| `border` | bool | false | P0 | "Borde elevado alrededor". |
| `borderWidthMm` | número | 1.2 | P0 | ≥ 2 × boquilla recomendado. |
| `borderHeightMm` | número | = `reliefMm` | P0 | |
| `borderAroundHole` | bool | true | P1 | El borde también rodea el agujero de la argolla. |

**Argolla / fijación**
| Param | Tipo | Default | Prio | Notas |
|---|---|---|---|---|
| `ringType` | `tab` / `internal` / `slot` / `none` | `tab` | P0 (`tab`, `none`), P1 (`internal`, `slot`) | Oreja con agujero / Agujero dentro del cuerpo / Ranura para cinta o correa / Sin argolla (para imán o pegar). |
| `ringPosition` | `left` / `right` / `top` / `topLeft` / `topRight` | `left` | P0 (left/right/top) | |
| `ringOuterMm` | número | 9 | P0 | Diámetro de la oreja. |
| `ringHoleMm` | número | 4.5 | P0 | Diámetro del agujero. |
| `slotWidthMm`/`slotHeightMm` | número | 12 / 3.5 | P1 | Ranura. |
| `ringOffsetXMm`/`ringOffsetYMm` | número | 0 | P0 | Ajuste fino (avanzado). |
| `ringThicknessMm` | número | = H | P2 | Oreja más fina o más gruesa que la base. |

**Colores** (P0: base y texto; P1: contorno/sombra y borde aparte)
| Param | Default | Notas |
|---|---|---|
| `colors.base` | `#3a3a3a` | |
| `colors.text` | `#f2e08a` | Letras e ícono. |
| `colors.accent` | `#ffffff` | Contorno de letra o sombra. |
| `colors.border` | `null` (= text) | Si es `null`, el borde va del color del texto. |

**Reverso** (P2)
| Param | Default | Notas |
|---|---|---|
| `backText` | "" | Texto grabado en la cara inferior (espejado para que se lea desde abajo), ej. un teléfono. |
| `backDepthMm` | 0.4 | |

**Calidad** (P1)
| Param | Default | Notas |
|---|---|---|
| `curveQuality` | `normal` | `draft` (tolerancia 0.08 mm) / `normal` (0.03) / `high` (0.01). Draft se usa automático mientras se arrastra un slider; al soltar se recalcula en la calidad elegida. |
| `snapToLayers` | true | Ver convenciones. |

Todos los números se validan y se *clampean*; el build nunca debe romperse por un input raro. Un input fuera de rango se marca en rojo con el rango válido.

### 5.2 Texto → geometría 2D (`core/kernel/text.js`)
1. Cargar la fuente con opentype.js (cache por `fontId`).
2. Por cada línea: `font.stringToGlyphs(line)` (aplica ligaduras que opentype.js soporte). Posicionar glifos a mano: `x += glyph.advanceWidth + kerning(prev, glyph) + letterSpacing` (kerning con `font.getKerningValue`). No depender de opciones de `getPath` que pueden no existir en la versión instalada.
3. Calcular primero la **escala final** (paso 6) para aplanar con la tolerancia correcta.
4. Para **cada glifo**: `glyph.getPath(x, y, fontSize)` → comandos M/L/Q/C/Z → polígonos, **aplanando** Bézier cuadráticas y cúbicas por subdivisión adaptativa con la tolerancia de `curveQuality` (en mm finales). Invertir Y (opentype usa Y hacia abajo).
5. `new CrossSection(polygons, 'NonZero')` **por glifo** y luego `CrossSection.union(lista)`. Así se resuelven los glifos que se pisan (cursivas: la "f" de Pacifico pisa a la "o" y a la "í") sin depender de la orientación de los contornos entre glifos.
6. Escala según `sizeMode`:
   - `capHeight`: `sizeMm / capHeightFuente` (`font.tables.os2.sCapHeight`; si falta o es 0, medir el bbox de "H").
   - `textHeight`: medir el bbox Y del texto a escala 1 y escalar a `sizeMm`.
   - `textWidth`: medir el bbox X a escala 1 y escalar a `sizeMm`.
   - `overallWidth`: el margen y la argolla son absolutos (no escalan), así que el ancho total es ≈ lineal en la escala. Construir a escala `s0`, medir ancho total `W0` y ancho de texto `w0`; `s1 = s0 · (sizeMm − (W0 − w0)) / w0`. Repetir una vez más si el error > 0.1 mm. Si `sizeMm` es menor que el ancho fijo (margen + oreja), dar error `size.tooSmall`.
   - Para `letterSpacing` en modo ancho: el espaciado es en mm reales, así que aplicarlo después de escalar los glifos (posicionar con avances escalados).
7. Líneas: separación = `lineSpacing × (ascender − descender) × escala`; alinear según `align`.
8. `boldOffset > 0` → `offset(+boldOffset, 'Round')`.
9. Glifos faltantes (`glyph.index === 0`): buscar en la cadena de **fuentes de respaldo** (P1: Noto Sans Bold para latín extendido); si tampoco están, omitir y devolver `text.missingGlyphs` con la lista de caracteres.
10. Ícono (P1): cargar sus polígonos (venidos del hilo principal), escalar a `iconScale × capHeight`, ubicar antes/después de la primera línea con una separación de `0.3 × capHeight`, y unir a `T`.
11. Centrar en el origen. Devolver también la posición de cada línea (bbox por línea) — la usa la argolla.

### 5.3 Forma de la base (`core/kernel/shapes2d.js`)
```
Tm      = offset(T, marginMm, 'Round')
outline = según shape:
  follow  : cerrar(Tm, smoothMm) = offset(offset(Tm, +smooth), −smooth);  si fillCounters → quedarse solo con contornos exteriores
  rounded : rect(bbox(T) + 2·margin) con radio min(cornerRadiusMm, alto/2)
  ellipse : elipse con semiejes (w/2 + m)·√2 y (h/2 + m)·√2   (elipse mínima con la misma proporción que contiene el rectángulo)
  circle  : círculo de radio = distancia máxima del centro a un vértice de Tm (+ 0)
  heart / tag / hexagon / cloud / badge / svg :
            fitShapeAround(formaUnitaria, Tm): búsqueda binaria de la escala uniforme s tal que area(Tm − s·forma) < 0.01 mm²
            (8–12 iteraciones). Cada forma define su "zona útil" (centro óptico) para centrar el texto: ej. el corazón centra el texto un poco arriba del centro.
```
Si `follow` produce **más de un contorno exterior** (letras sueltas con margen chico): warning `shape.islands` con sugerencia (subir margen, suavizado o bajar espaciado) — no se puede imprimir como una pieza.

### 5.4 Argolla / fijación
**Ubicación de la oreja (`tab`)** — para `left` (los demás son simétricos):
1. `yc` = centro vertical de la **primera línea** (no del bbox total: así los descendentes no la corren).
2. Cortar `outline` con una franja horizontal `[yc − R, yc + R]` (`R = ringOuterMm/2`) y tomar `xEdge = minX` de esa intersección. Esto es clave en `follow`: el borde izquierdo real a la altura de la oreja puede estar muy adentro del `minX` global (ej. la "S" de Sofía).
3. Centro de la oreja `c = (xEdge − R + solape, yc)` con `solape = 0.35 · ringOuterMm`.
4. `tab = circle(c, R)`, `hole = circle(c, ringHoleMm/2)`.
5. Si `offset(hole, minWall)` se toca con `T` (`minWall = max(1, 2·nozzle)`), correr `c.x` hacia afuera de a 0.25 mm hasta que no se toquen.
6. Sumar `ringOffsetX/Y`.
7. Unir `tab` a `outline` con un "cuello" para que no quede una unión finita: `cuello = hull(tab, intersección de outline con la franja)` recortado a la franja.

`top`/`topLeft`/`topRight`: análogo con franja vertical / esquina.

**`internal`** (P1): mismo cálculo de posición pero el agujero queda dentro de `outline`; requiere que exista lugar: si `offset(hole, minWall)` se toca con `T` o sale de `outline`, warning `ring.noRoom` y sugerir subir margen o pasar a `tab`.

**`slot`** (P1): ranura = rectángulo redondeado (`slotWidth × slotHeight`) ubicado como el agujero; la oreja pasa a ser un rectángulo redondeado que la contiene con `minWall` de pared.

**Resultado**: `S = (outline ∪ tab ∪ cuello) − hole` (en `none`: `S = outline`).

### 5.5 Construcción por estilo (todo en 2D, se extruye al final)
`T' = T ∩ S` (el texto nunca invade el agujero). Alturas ya redondeadas a capas. `ext(A, h, z)` = extruir `A` con altura `h` y trasladar a `z`.

**relief** (en relieve)
```
base    = ext(S, H, 0)
letters = ext(T', r, H)
```
**engraved** (grabado, 1 color; `e = engraveDepthMm`)
```
base    = ext(S, H − e, 0) ∪ ext(S − T', e, H − e)
```
**flush** (al ras, 2 colores)
```
base    = igual que engraved
letters = ext(T', e, H − e)
```
**textEffect = outline** (P1, solo relief; 3 colores; `o = textOutlineMm`, `ho = textOutlineHeightMm`)
```
outlineLayer = ext((offset(T, o) ∩ S), ho, H)              color accent
letters      = ext(T', r, H + ho)                          color text   (apoyadas sobre el contorno)
```
**textEffect = shadow** (P1, solo relief)
```
shadow2D = (translate(T, dx, dy) ∩ S) − T
shadow   = ext(shadow2D, r · 0.6 redondeado a capas, H)    color accent
```
**border** (cualquier estilo)
```
border2D = S − offset(S, −borderWidthMm)      // como S tiene el agujero como contorno interior, esto ya genera un aro alrededor del agujero
si !borderAroundHole → border2D = border2D − offset(hole, borderWidthMm + 0.01)
border   = ext(border2D, borderHeight, H)
```
Si el borde se toca con el texto (`offset(T, 0.4) ∩ border2D` no vacío), warning `border.touchesText` (sugerir subir margen).

**faceDown** (P1): al final, rotar todo 180° sobre X y trasladar para que `minZ = 0`. El texto queda en las primeras capas contra la cama y se lee correctamente al dar vuelta la pieza.

**Partes y colores**: agrupar sólidos por `colorKey`. Cada `Part` es la unión de los sólidos de ese color. `merged` = unión de todas. Las partes no se solapan en volumen (verificado en tests).

**Memoria WASM**: todo `CrossSection` / `Manifold` se libera con `.delete()`. `core/kernel/manifold.js` expone `withScope(fn)` que registra cada objeto creado dentro de `fn` y los borra al salir (salvo los que se devuelvan explícitamente). Obligatorio en todo `build`.

**Curvas**: `circularSegments` según tamaño (~1 segmento cada 0.4 mm de perímetro, mínimo 32). `simplify(tolerancia de calidad / 2)` antes de extruir.

### 5.6 Información para imprimir (`core/kernel/analysis.js`)
- **Medida** X × Y × Z y **triángulos** (como la captura).
- **Gramos por color** = volumen × densidad (indicar "aprox., pieza 100 % sólida").
- **Cambios de color con pausa** (para impresoras de un extrusor, P0): para cada color calcular el rango Z que ocupa. Si los rangos de distintos colores **no se solapan** en Z, listar "Cambiar a color *Letras* al empezar la capa N (Z = 3.2 mm)" — así se imprime con pausa/M600 sin AMS. Si se solapan (ej. `flush`, borde de otro color al nivel del texto), mostrar "Este diseño necesita multimaterial (AMS/MMU)" y, si el perfil tiene `multiMaterial: false`, warning con sugerencia (pasar a relieve).
- **Tamaño vs. cama**: warning si el ítem (o la placa de lote) no entra en la cama del perfil.

### 5.7 Modo lote (P1)
- Cada nombre se genera por separado con los mismos parámetros (y `batchUniform`).
- `layout.js`: acomodar en **placas** del tamaño de la cama con márgenes de 5 mm y separación 4 mm entre piezas (empaquetado por filas, ordenando por alto descendente; suficiente para piezas similares). Si no entran en una placa, crear más.
- Visor: muestra la placa actual con el contorno de la cama y selector "Placa 1/3". Máximo 60 piezas renderizadas a la vez.
- Nombres repetidos se mantienen (pueden ser intencionales); nombres vacíos se ignoran.
- Exportación: ZIP con un archivo por nombre (STL o par por color) **o** un 3MF por placa (todas las piezas de la placa ya posicionadas).

### 5.8 Validaciones (`validate.js`) — se muestran como lista; no bloquean salvo `error`
| Código | Condición | Nivel |
|---|---|---|
| `text.empty` | texto vacío | error (no se genera; el visor muestra "Escribí un texto") |
| `text.missingGlyphs` | caracteres sin glifo | warn |
| `text.thin` | `offset(offset(T, −n/2), +n/2)` pierde > 15 % de área (`n` = boquilla) | warn: "Hay trazos más finos que la boquilla; subí 'Engrosar letras' o el tamaño" |
| `shape.islands` | más de un contorno exterior en la silueta | error (no se puede imprimir como una pieza) |
| `ring.thinWall` | `(ringOuter − ringHole)/2 < 1.5` | warn |
| `ring.smallHole` | `ringHole < 3.5` | warn: "Puede que no entre la argolla de metal" |
| `ring.noRoom` | `internal` sin lugar | warn |
| `border.touchesText` | ver §5.5 | warn |
| `engrave.thinFloor` | `H − e < 0.8` | error (se clampea) |
| `size.tooSmall` | `overallWidth` menor que margen + oreja | error |
| `size.bedOverflow` | no entra en la cama | warn |
| `color.needsMMU` | colores solapados en Z y perfil sin multimaterial | warn |
| `quality.manyTriangles` | > 500k triángulos | warn |

### 5.9 Visor (`core/viewer/Viewer.js`)
- `WebGLRenderer({ antialias: true })`, `setPixelRatio(Math.min(devicePixelRatio, 2))`, `PerspectiveCamera` (fov 35), `OrbitControls` con damping.
- Grilla en XY: celdas de 10 mm, líneas sutiles (como la captura); en lote se dibuja además el contorno de la cama.
- Luces: `HemisphereLight` + `DirectionalLight`. Material por parte: `MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 })`.
- Normales: `BufferGeometryUtils.toCreasedNormals(geom, 30°)` (caras planas se ven planas, curvas suaves).
- Botones: **Centrar vista**, **Vista superior** (P1), **Captura PNG** (P1), y chips para **mostrar/ocultar cada color** (P1) — útil para ver la incrustación del modo al ras.
- Al recibir geometría nueva: reemplazar meshes y `dispose()` de lo viejo. Re-encuadrar solo si el tamaño cambió > 30 % o en el primer render.
- `ResizeObserver` sobre el contenedor; manejar `webglcontextlost`/`restored`.
- Al salir de la herramienta: `renderer.dispose()` y cortar el loop de animación (render solo cuando algo cambia o los controles se mueven).

### 5.10 Exportación
| Botón | Prio | Contenido | Nombre |
|---|---|---|---|
| **STL (un color)** — principal, naranja | P0 | `merged` | `llavero-sofia.stl` |
| **ZIP por color** | P0 | un STL por `Part`, todos en el mismo sistema de coordenadas | `llavero-sofia_base.stl`, `llavero-sofia_letras.stl`… |
| **3MF multicolor** | P0 | un objeto con una parte por color | `llavero-sofia.3mf` |
| **Captura PNG** | P1 | imagen del visor | `llavero-sofia.png` |

Detalles:
- **STL binario**: header de 80 bytes que **no empiece con `solid`** (algunos lectores lo toman como ASCII); `uint32` cantidad de triángulos; por triángulo normal + 3 vértices (`float32` LE) + `uint16` 0. Tamaño = `84 + 50·n`. Normal calculada con producto cruz y normalizada.
- **Malla desde manifold**: `getMesh()` devuelve `vertProperties` con `numProp` valores por vértice (puede ser > 3); tomar solo los 3 primeros de cada vértice. `triVerts` ya está en orden antihorario visto desde afuera (lo que piden STL y 3MF).
- **3MF**: `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model` con `unit="millimeter"`, `<basematerials>` con un `<base name="Letras" displaycolor="#F2E08AFF"/>` por color, un `<object type="model">` con malla por parte (con `pid`/`pindex` apuntando a su material y `name` legible) y un objeto contenedor con `<components>`; `<build>` con un `<item>` por ítem/pieza. Vértices compartidos (índices de manifold).
  - Verificar manualmente en **Bambu Studio, OrcaSlicer y PrusaSlicer** que se importe como **un objeto con varias partes** (no apiladas ni "caídas" a la cama por separado) y que tome los colores. Registrar el resultado en `docs/verificacion-slicers.md`.
  - P2: si Bambu/Orca no asignan bien los filamentos, agregar los metadatos propios del slicer (`Metadata/model_settings.config` en Bambu/Orca, `Metadata/Slic3r_PE_model.config` en Prusa). **No inventar el formato**: guardar un proyecto multicolor desde cada slicer, abrir el ZIP y copiar la estructura.
- **Nombres de archivo**: quitar acentos (`normalize('NFD')` + quitar diacríticos), espacios → `-`, solo `[a-z0-9-_]`, máx 40 caracteres; si queda vacío, `llavero`.
- En lote: ZIP con los archivos de todos los nombres, o un 3MF por placa (§5.7).

### 5.11 Estado, presets e historial
- **Persistencia** (P0): params en localStorage por herramienta, guardados con `paramsVersion`; al cargar, pasar por `migrate`. Si fallan los datos guardados, volver a defaults sin romper.
- **URL compartible** (P1): `#/tool/keychain?p=<base64url(UTF-8(JSON))>` — **no** usar `btoa` directo (falla con caracteres fuera de Latin-1, ej. emojis). Incluye `v` (versión). Las fuentes subidas por el usuario no viajan en la URL (avisar).
- **Deshacer / rehacer** (P1): Ctrl+Z / Ctrl+Shift+Z; agrupar cambios continuos de un slider en un solo paso.
- **Presets incluidos** (P1): "Clásico" (la captura), "Cursiva al ras 2 colores", "Etiqueta de mochila" (rounded + 2 líneas + borde), "Nombre con contorno 3 colores", "Grabado 1 color", "Sin AMS (pausa)". **Presets del usuario** (P1): guardar/renombrar/borrar en localStorage. Botón "Restablecer".

### 5.12 UI de la herramienta
- Layout como la captura: sidebar angosta a la izquierda (íconos de herramientas, ES/EN, tema, perfil de impresora), contenido con breadcrumb "← Herramientas", título y subtítulo.
- Columna de panel (~320 px, scroll propio) con tarjetas: **Texto, Tamaño, Forma, Letras, Borde, Argolla, Colores**, cada una con "Más opciones" plegable para lo avanzado. Arriba del panel: selector de preset + restablecer.
- Visor ocupando el resto; debajo: "Medida: 61.3 × 33.2 × 4.5 mm · 4012 triángulos · ~4.1 g", cambios de color, warnings, y botones de descarga a la derecha.
- Estilo: tema oscuro (fondo ~`#1a1214`, tarjetas apenas más claras, bordes sutiles), acento naranja `#f97316` para la acción principal, segmented activo en rojo oscuro. Todo en variables de `tokens.css`; tema claro con las mismas variables.
- Responsive: < 900 px → visor arriba (50 vh, sticky) y panel abajo; botones de descarga en barra fija inferior.
- Accesibilidad: labels asociados, foco visible, todo operable con teclado, contraste AA, `aria-live` para warnings.

### 5.13 Fuentes e íconos

#### 5.13.1 Catálogo de fuentes incluidas
Todas **OFL de Google Fonts, en TTF estático** (opentype.js no maneja bien las variables; si una familia solo viene variable, usar la instancia estática de la carpeta `static/` del zip de Google Fonts o del repo `google/fonts`; si no existe, descartarla). Verificar que cada una tenga `á é í ó ú ü ñ Ñ ¿ ¡`.

| Categoría | Fuentes | Notas |
|---|---|---|
| Cursivas que conectan | Pacifico, Lobster, Dancing Script Bold, Kaushan Script, Satisfy, Yellowtail, Cookie, Damion, Leckerli One, Grand Hotel, Norican, Courgette, Playball | Ideales para `follow`. |
| Cursivas finas / elegantes | Great Vibes, Allura, Alex Brush, Parisienne, Sacramento | `thin: true` → `boldOffset` recomendado 0.3–0.5; warning si el tamaño es chico. |
| A mano / casual | Permanent Marker, Caveat Brush, Gochi Hand, Patrick Hand | |
| Display gruesas | Bebas Neue, Anton, Lilita One, Luckiest Guy, Titan One, Bangers, Bowlby One, Righteous, Carter One, Chewy, Shrikhand, Bungee, Russo One, Black Ops One | |
| Serif / slab | Alfa Slab One, Abril Fatface, Ultra, Playfair Display Black, Roboto Slab Bold | |
| Sans | Montserrat Black, Poppins Black, Archivo Black, Oswald Bold, Roboto Black, Nunito Black, Rubik Bold | |
| Temáticas | Pirata One, UnifrakturMaguntia (gótica), Press Start 2P (pixel), Creepster (terror), Mountains of Christmas, Stardos Stencil (stencil) | |
| Respaldo (no se listan) | Noto Sans Bold | Glifos faltantes de latín extendido. |

`public/fonts/fonts.json`:
```json
[{ "id": "pacifico", "name": "Pacifico", "file": "Pacifico-Regular.ttf", "category": "script-connected",
   "thin": false, "recommendedBold": 0, "license": "OFL-1.1" }]
```
- Selector de fuentes (P0 básico, P1 completo): buscador, filtro por categoría, cada opción muestra **el texto actual del usuario** renderizado en esa fuente (cargada con `FontFace` en la UI, lazy al hacer scroll), favoritas (localStorage).
- **Subir fuente** (P1): TTF/OTF/WOFF vía `FileReader` → `ArrayBuffer` → worker (transferible). No se persiste entre sesiones (solo avisar). Si es WOFF2: mensaje claro "Convertila a TTF" (P2: soportar WOFF2 descomprimiendo con `wawoff2`).
- **Catálogo online** (P2): ~1500 fuentes de Google Fonts bajo demanda vía **Fontsource** (sirve archivos WOFF, que opentype.js lee) por jsDelivr. Verificar URLs y subsets (`latin` + `latin-ext`) contra la documentación de Fontsource antes de implementar. Cachear con Cache API.

#### 5.13.2 Íconos (P1)
~40 íconos de Phosphor (fill), copiados como SVG a `public/icons/` con `icons.json` (id, nombres es/en, tags para buscar): corazón, estrella, corona, pata de perro/gato, hueso, flor, hoja, mariposa, rayo, nota musical, pelota de fútbol/básquet, auto, avión, casa, llave, ancla, luna, sol, nube, gota, fuego, calavera, fantasma, árbol de navidad, regalo, café, gamepad, cámara, libro, birrete, cruz, estrella de David, trébol, arcoíris, diamante, smile, pulgar arriba, rueda de bici, montaña.
- Selector con buscador. Se procesan en el hilo principal con `SVGLoader` → polígonos → worker.
- Tratamiento: el ícono se une al texto (`T`), así hereda estilo, color y efectos.

---

## 6. Fases de ejecución

### Fase 0 — Setup
- `git init`, `.gitignore`, `npm create vite@latest` (vanilla JS) en la carpeta actual.
- Dependencias: `three`, `manifold-3d`, `opentype.js`, `fflate`; dev: `vitest`, `@playwright/test`, `eslint`, `prettier`.
- `jsconfig.json` con `checkJs: true`. Scripts: `dev`, `build`, `preview`, `test`, `test:e2e`, `lint`.
- Cargar manifold en un **worker de módulo**: `new Worker(new URL('./geometry.worker.js', import.meta.url), { type: 'module' })`; dentro, `import Module from 'manifold-3d'` + `import wasmUrl from 'manifold-3d/manifold.wasm?url'`, `const wasm = await Module({ locateFile: () => wasmUrl }); wasm.setup();`. **Verificar la ruta real del `.wasm` en `node_modules/manifold-3d`**; si el campo `exports` del paquete bloquea la importación, copiarlo a `public/` con un plugin o script de build.
- CI en GitHub Actions.

**DoD:** `npm run dev` abre una página; la consola del worker imprime el volumen de un cubo de manifold-3d (1000 para 10×10×10). `npm test` y CI en verde.

### Fase 1 — Shell, router, visor, perfil de impresora
- Shell, router por hash, home con tarjetas desde `registry.js` (las "próximamente" deshabilitadas, con badge).
- `Viewer.js` con un cubo de prueba, grilla, "Centrar vista".
- `tokens.css` tema oscuro/claro + switch. i18n con `t()` desde el día 1 (aunque solo esté cargado ES).
- Perfil de impresora (§3.1) en el header.

**DoD:** navegar Home ↔ herramienta con back/forward del navegador; el visor rota/zoom suave, se adapta al resize, y al cambiar de ruta no quedan contextos WebGL vivos (verificar que no crece la memoria tras 20 navegaciones).

### Fase 2 — Kernel + texto
- `manifold.js` (`withScope`), `shapes2d.js` (círculo, rect redondeado), `mesh.js`, `text.js`, `fontStore.js`, `analysis.js` (bbox, volumen).
- Worker + `workerClient` con `reqId`, transferibles, recuperación de errores.
- Incluir 6 fuentes iniciales (Pacifico, Lobster, Bebas Neue, Montserrat Black, Great Vibes, Luckiest Guy) para probar todas las categorías.

**DoD (tests):** "Sofía" en Pacifico → `CrossSection` con área > 0 y un único contorno exterior; `textWidth = 50` → bbox 50 ± 0.05 mm; `capHeight = 10` → alto de "H" 10 ± 0.05 mm; "ñandú", "¿Qué?", "ÁÉÍÓÚ" funcionan; un carácter inexistente devuelve `text.missingGlyphs`; letterSpacing −1 acerca las letras.

### Fase 3 — Llavero MVP
- `panelFromSchema` + controles P0.
- `build.js`: un llavero, `follow` y `rounded`, `relief`, argolla `tab` (left/right/top) y `none`, todos los `sizeMode`, alineación a capas.
- Info: medidas, triángulos, gramos.
- Exportación **STL (un color)**. Persistencia en localStorage.

**DoD:** reproducir la captura (Sofía / Pacifico / ancho de letras 50 / margen 3 / base 3 / relieve 1.5) y que se vea equivalente. El STL abre en un slicer sin "reparaciones": `status() === 'NoError'` y **`genus() === 1`** (un solo agujero pasante: el de la argolla; con `ringType: none`, genus 0). Regeneración < 300 ms con texto de 10 caracteres en una PC normal.

### Fase 4 — Multicolor y exportación completa (resto de P0)
- `engraved` y `flush`, borde, colores base/texto.
- **ZIP por color** + **3MF multicolor**.
- Cálculo de cambios de color con pausa / aviso de multimaterial.
- Todas las validaciones P0 de §5.8.

**DoD:** test que recorre combinaciones representativas (estilos × formas × argollas × borde) y verifica: todas las partes manifold, volumen > 0, sin solapes entre partes (`volumen(A ∩ B) < 0.001`), en `flush` la cara superior de base y letras a la misma Z, en `relief` los cambios de color son `[{zMm: H}]`. El 3MF abre como objeto multiparte de 2 colores en Bambu Studio / OrcaSlicer / PrusaSlicer (verificación manual en `docs/verificacion-slicers.md`). **Esta fase = primera versión publicable.**

### Fase 5 — Llavero completo (P1)
- Formas: `ellipse`, `circle`, `heart`, `tag`, `hexagon`, `cloud`, `badge` con `fitShapeAround`.
- Argolla `internal`, `slot`, `topLeft`/`topRight`.
- `textEffect` outline y shadow (3 colores), color de borde propio, `faceDown`, `borderAroundHole`, `uppercase`.
- Íconos. Fuente de respaldo. Catálogo de fuentes completo + selector con preview, buscador, favoritas. Subir fuente.
- Lote con acomodo en placas y exportación por placa.
- Presets, deshacer/rehacer, URL compartible, `curveQuality` con draft automático al arrastrar.
- Visor: vista superior, PNG, mostrar/ocultar colores, contorno de cama.

**DoD:** lote de 50 nombres se genera en < 10 s, se acomoda en placas de 256×256 sin solapes y exporta ZIP y 3MF por placa correctos. Cada fuente del catálogo pasa el test "genera una pieza manifold de una sola isla con 'Sofía', 'MATEO' y 'ñandú' en `follow` con margen 3" (las que no pasen se ajustan con `recommendedBold`/espaciado por defecto o se sacan del catálogo).

### Fase 6 — Pulido y release
- i18n EN completo; detección de idioma.
- Responsive y mobile (táctil en el visor, barra de descarga fija).
- Accesibilidad (§5.12). Página de créditos/licencias.
- E2E con Playwright: abrir herramienta, escribir texto, cambiar fuente, descargar STL y 3MF (verificar que el archivo se genera y su tamaño es razonable).
- `README.md`: cómo correr, arquitectura en una página, **guía "Cómo agregar una herramienta"** paso a paso con el contrato de §4.
- Build de producción y deploy estático (verificar que el `.wasm` se sirva con `Content-Type: application/wasm` y que los assets respeten `BASE_URL`).
- Opcional: PWA / service worker para uso offline.

**DoD:** Lighthouse ≥ 90 en accesibilidad y buenas prácticas, ≥ 80 en performance (desktop); E2E en verde en Chromium y Firefox.

### Fase 7 — P2 (post v1)
Reverso grabado, texto en arco, `lineScales`, forma desde SVG del usuario, bisel, catálogo online de fuentes (Fontsource), WOFF2 con `wawoff2`, harfbuzzjs (árabe/hebreo/ligaduras contextuales), metadatos específicos de Bambu/Prusa en el 3MF, oreja con grosor propio.

---

## 7. Tests

| Archivo | Qué verifica |
|---|---|
| `unit/kernel.text.test.js` | Los cuatro `sizeMode`; multilínea y alineación; espaciado; glifos faltantes y respaldo; acentos/ñ. |
| `unit/kernel.shapes.test.js` | `fitShapeAround` contiene a `Tm` en todas las formas; elipse/círculo con fórmula correcta. |
| `unit/keychain.build.test.js` | Matriz de combinaciones (§Fase 4 DoD); genus esperado según `ringType`; ubicación de la oreja (el agujero no toca el texto, con `minWall`). |
| `unit/keychain.analysis.test.js` | Cambios de color por estilo; gramos; detección de islas y trazos finos. |
| `unit/keychain.layout.test.js` | Lote: sin solapes, todo dentro de la cama, cantidad de placas correcta. |
| `unit/export.stl.test.js` | Bytes = `84 + 50·n`; header no empieza con "solid"; normales unitarias; lectura de vuelta. |
| `unit/export.3mf.test.js` | El ZIP tiene los 3 archivos; XML válido; un objeto por parte, componentes, colores. |
| `unit/state.test.js` | Migraciones de params; URL compartible round-trip con "Sofía 💛"; datos corruptos → defaults. |
| `unit/memory.test.js` | 200 builds seguidos no hacen crecer el heap de WASM más allá de un umbral. |
| `unit/fonts.catalog.test.js` | Cada fuente del catálogo carga, tiene los caracteres en español y genera pieza de una isla. |
| `e2e/keychain.spec.js` | Flujo completo en el navegador. |

---

## 8. Backlog de herramientas futuras
Agregar al `registry.js` como `status: 'soon'` desde la Fase 1. Todas reutilizan kernel, texto, íconos, visor, exportadores, perfil de impresora y panel por schema.

| # | Herramienta | Reusa |
|---|---|---|
| 1 | **Llavero inicial + nombre** (letra grande de base con el nombre en cursiva encima) | texto, estilos, argolla |
| 2 | **Cartel / placa** (puerta, escritorio con soporte inclinado, agujeros para tornillo o colgar) | texto, formas, borde |
| 3 | **Etiqueta de mascota / bag tag** con texto en ambas caras | texto, reverso |
| 4 | **Llavero / placa con QR** (Wi-Fi, URL, contacto; 2 colores al ras) | estilo flush, librería QR |
| 5 | **SVG → 3D** (logo extruido, un color por relleno del SVG) | svg.js, multicolor |
| 6 | **Cortante de galletitas** (texto, SVG o imagen; pared fina + pestaña) | offset, svg |
| 7 | **Sello** (texto/ícono espejado + mango) | texto, íconos |
| 8 | **Litofanía** (plana, curva, cilíndrica para lámpara, desde foto) | heightmap → malla |
| 9 | **Caja paramétrica** (tapa a presión o corrediza, separadores, texto en tapa) | booleanas 3D |
| 10 | **Gridfinity** (bins y baseplates) | booleanas 3D |
| 11 | **Etiquetas para cables / plantas / estantes** | texto, lote |
| 12 | **Mapa topográfico / en relieve** desde heightmap | heightmap |
| 13 | **Engranajes** paramétricos | perfil 2D + extrusión |
| 14 | **Maceta / vaso en modo espiral** (perfil + torsión) | extrude con twist |
| 15 | **Imanes de heladera / posavasos** con hueco para imán | formas, texto |
| 16 | **Topper de torta** con texto y palitos | texto, `follow` |

---

## 9. Riesgos y mitigación
| Riesgo | Mitigación |
|---|---|
| Fuentes con contornos raros o solo variables | Solo estáticas probadas; cada fuente nueva entra con el test del catálogo. |
| Fuga de memoria WASM | `withScope` obligatorio; test de 200 builds; recreación del worker si muere. |
| Cursivas que no se conectan (islas) | `letterSpacing` negativo, `smoothMm`, `recommendedBold` por fuente, error `shape.islands` claro. |
| Lentitud con textos largos o lotes grandes | Worker, debounce, calidad draft al arrastrar, `simplify`, límites de caracteres/nombres. |
| 3MF interpretado distinto por cada slicer | Verificación manual documentada; ZIP por color siempre disponible; metadatos por slicer en P2 copiados de archivos reales. |
| Usuarios sin AMS que bajan diseños que no pueden imprimir | Perfil `multiMaterial`, cálculo automático de cambios por pausa, preset "Sin AMS". |
| Paquete WASM no resuelto por Vite / mal servido en producción | Verificación en Fase 0 y en el deploy (`Content-Type`, `BASE_URL`). |
| opentype.js sin soporte de shaping complejo | Interfaz `TextShaper`; harfbuzzjs en P2. |
| Licencias | Solo fuentes OFL e íconos MIT; página de créditos. Avisar que las fuentes subidas por el usuario son su responsabilidad. |

---

## 10. Cambios respecto de la v1 del plan (auditoría)

**Errores corregidos**
1. **Genus**: decía "1 por el agujero + contadores". Los ojos de las letras no atraviesan la pieza, así que el genus esperado es **1** (o 0 sin argolla).
2. **Ubicación de la oreja**: usaba el `minX` global del contorno; en formas irregulares (la "S" de Sofía) la oreja quedaba flotando o mal unida. Ahora se mide el borde real a la altura de la oreja con una franja y se agrega un "cuello".
3. **"Ancho total"** era ambiguo (en la captura el valor es el ancho de las letras, no del llavero: 50 vs 61.3 mm). Ahora hay `textWidth` y `overallWidth` (con corrección iterativa porque margen y oreja no escalan).
4. **Borde**: se calculaba sobre el contorno sin la oreja ni el agujero. Ahora se calcula sobre la silueta completa y puede rodear el agujero.
5. **Unión de glifos**: armar un solo `CrossSection` con todo el path podía fallar; ahora va por glifo + unión.
6. **Escala y aplanado**: se aplanaban curvas antes de conocer la escala (tolerancia incorrecta).
7. **Espaciado**: dependía de una opción de `getPath` que puede no existir; ahora se posicionan los glifos a mano.
8. **STL**: faltaba la regla de que el header no empiece con "solid".
9. **Malla de manifold**: faltaba respetar `numProp` al leer `vertProperties`.
10. **URL compartible**: `btoa` sobre JSON rompe con caracteres no Latin-1; ahora base64url de UTF-8 con versión.
11. **Visor**: faltaba `camera.up` antes de `OrbitControls`, rotar la grilla, límite de `pixelRatio`, pérdida de contexto, render bajo demanda.
12. **Assets en deploy con subpath**: faltaba `BASE_URL`.
13. **Carga de manifold**: faltaban `wasm.setup()` y la verificación de la ruta del `.wasm`.

**Mejoras agregadas**
- Perfil de impresora global (cama, boquilla, capa, multimaterial, densidad) y alturas alineadas a capas.
- Estilo **grabado** (1 color), efectos **contorno** y **sombra** (3 colores), color de borde propio, impresión **boca abajo**.
- 9 formas de base (+ SVG en P2) con un ajuste genérico `fitShapeAround`.
- Argolla interna, ranura para cinta, sin argolla, esquinas.
- Íconos, mayúsculas, fuente de respaldo, catálogo de ~55 fuentes por categoría con metadatos, selector con preview, subir fuente, catálogo online en P2.
- Info de impresión: gramos por color y **alturas de cambio de color para imprimir sin AMS**.
- Lote con acomodo en placas de la cama y 3MF por placa.
- Presets, deshacer/rehacer, migraciones de parámetros, calidad de curvas con modo borrador.
- Mensajes como códigos traducibles, recuperación de errores del worker.
- Tests ampliados (memoria, catálogo de fuentes, layout, estado), E2E, CI.
- Prioridades P0/P1/P2 para que la primera versión publicable no se demore.
- Backlog de herramientas ampliado a 16.

---

## 11. Estado de implementación

Fases 0 a 6 implementadas. Resultado verificado: **43 tests unitarios** (Vitest) y **10 E2E** en Chromium y Firefox, tanto contra el servidor de desarrollo como contra el build de producción; lint sin avisos; despliegue en subcarpeta probado. Lighthouse sobre el build de producción (emulación móvil): **Rendimiento 80, Accesibilidad 100, Buenas prácticas 100**.

### Hecho

| Área | Estado |
|---|---|
| P0 completo | Texto multilínea, 4 modos de tamaño, forma que sigue las letras y pastilla, argolla (oreja) en 5 posiciones, sin argolla, relieve / grabado / al ras, borde elevado, colores, alturas alineadas a capa, STL / ZIP por color / 3MF, perfil de impresora, gramos y cambios de color con pausa |
| P1 | 9 formas de base con ajuste automático (`fitShapeAround`), argolla interna y ranura, contorno y sombra (3 colores), `faceDown`, color de borde propio, íconos (54), fuente de respaldo, 53 fuentes + subir fuente, lote con acomodo en placas y 3MF por placa, presets, deshacer/rehacer, enlace compartido, borrador al arrastrar, visor (vista superior, PNG, chips de color, contorno de cama) |
| Fase 6 | i18n ES/EN, responsive con barra de descargas fija, accesibilidad, créditos, README con guía de herramientas, CI, E2E, verificación de subcarpeta y de `.wasm` |
| Calidad | Test de fugas WASM con contador de objetos vivos (detectó y corrigió una fuga real), matriz de combinaciones, catálogo de fuentes, layout de lote |

### Desviaciones respecto al plan (y por qué)

1. **Fuentes:** 53 en vez de ~55. Las que viven en la carpeta `apache/` de google/fonts (Luckiest Guy, Satisfy, Yellowtail, Permanent Marker, Chewy, Carter One…) no son OFL y se dejaron afuera para respetar el criterio "solo OFL". Las familias que solo existen como fuente variable (Montserrat, Dancing Script, Oswald…) tampoco entran. Respaldo: **Lato Bold** (Noto Sans solo existe variable).
2. **Posición de la argolla (§5.4):** el plan decía "centro de la primera línea". Se usa el centro de **toda la pieza**: queda mejor en etiquetas de varias líneas y es idéntico en una sola línea.
3. **`validate.js`** no existe: las validaciones están dentro de `build.js` y se emiten como códigos de mensaje.
4. **`reliefMm` por defecto = 1,4** (como la tabla del plan). El redondeo a capas sobre el valor 1,5 de la captura daba 4,6 mm; con 1,4 la pieza mide 4,4 mm.
5. **Íconos en el worker:** el SVG se convierte a polígonos en el hilo principal (`SVGLoader` necesita DOM) y viaja en el pedido de generación (`extra.iconPolys`).
6. **`fitShapeAround`:** además de la escala uniforme usa un estiramiento horizontal limitado por forma, para que un nombre largo no genere un corazón gigante.
7. **opentype.js 2.0:** algunas fuentes traen tablas GSUB que lanza excepción al formar ligaduras; `shape()` cae a mapeo carácter por carácter en vez de romper.

### Pendiente

- **Verificación manual del 3MF en Bambu Studio / OrcaSlicer / PrusaSlicer** — requiere los programas instalados. Plantilla en [docs/verificacion-slicers.md](docs/verificacion-slicers.md). Si algún slicer no asigna bien los filamentos: copiar `model_settings.config` / `Slic3r_PE_model.config` de un proyecto real (no inventar el formato).
- **P2 (Fase 7), no implementado:** reverso grabado, texto en arco, `lineScales`, forma desde SVG del usuario, bisel, catálogo online de fuentes (Fontsource), WOFF2, harfbuzzjs, metadatos de slicer en el 3MF, grosor propio de la oreja.
- Opcional: PWA / service worker para uso offline; dividir el bundle principal (three.js ya está en su propio chunk).
- Confirmar la licencia del proyecto (README dice MIT).
