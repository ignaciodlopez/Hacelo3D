# Bitcoin3D

Herramientas paramétricas para crear modelos listos para **impresión 3D**, que corren 100 % en el navegador (sin backend). Ajustás parámetros en un panel, ves el resultado en 3D en tiempo real y descargás STL / ZIP por color / 3MF multicolor.

Primera herramienta: **Llavero con nombre** (texto en relieve, grabado o al ras; 9 formas de base; argolla, agujero interno o ranura; íconos; contorno y sombra; lote de nombres acomodado en la cama; ~53 fuentes).

Segunda herramienta: **Topper de torta** (texto con silueta rellena, círculo u óvalo; letras en relieve o al ras; 0 a 3 palitos con punta; ~53 fuentes).

Tercera herramienta: **Código QR** (enlace o texto, red Wi-Fi o contacto; placa o llavero con el código en relieve o al ras, texto debajo y argolla opcionales). Admite huecos para imanes en la cara de atrás (`core/kernel/magnets.js`, reutilizable por otras herramientas). La contraseña del Wi-Fi no se guarda en el navegador ni viaja en el enlace compartido (`volatileKeys` en la definición de la herramienta).

Cuarta herramienta: **Sello** (texto y/o ícono espejados en relieve sobre una placa rectangular, circular u oval, con mango de barra o perilla; se imprime con el mango contra la cama y sin soportes). Los íconos en 2D se comparten en `core/kernel/icon2d.js`.

Quinta herramienta: **Lámpara** (pantalla con silueta recta o curva y 13 texturas —ondas, gajos, facetas, aros, burbujas, zigzag, picos, escamas, enrejado, panal, diamantes, estrías finas— con giro (hasta 160 repeticiones), perfil recto, curvo o de florero, y modelos prediseñados que replican las pantallas "Diamonds" y "Sophie" de Kraken; se enrosca en una base con portalámparas). La base replica la de "Modular Lamp" (`base.stl`): aro de Ø116 con rosca hembra de paso 5 mm, tubo partido con abrazadera M4 y canal para el cable. Las medidas de la rosca están en `tools/lamp/thread.js` y son compatibles con las pantallas y la base de ese modelo. La pantalla sale con la rosca integrada (pared) o maciza para modo vaso, con la rosca integrada en la misma pieza. Las piezas de revolución con relieve se arman "por anillos" (`core/kernel/rings.js`), sin booleanas; la vista "armada" usa `viewOffset` (solo para el visor).

Sexta herramienta: **Chapita para mascota** (nombre, teléfono y una línea extra sobre una forma fija: huesito, círculo, óvalo, rectángulo, corazón, huella, gatito, estrella, escudo, hexágono, flor, casita, pez, nube, o la silueta de cualquiera de ~44 íconos). Es lo inverso del llavero: acá la forma está dada y el texto se ajusta adentro (se agranda o se achica hasta ocupar el lugar libre, lejos del borde y de los agujeros). Sujeción por argolla (orejita o agujero interno, en cualquier lado) o "pasante" con dos ranuras para el collar. Por defecto es el huesito clásico en celeste con letras blancas: se imprime con **un solo cambio de color** (la placa y, encima, las letras y el borde); con el mismo color en placa y letras sale en una sola pieza. Los tamaños del nombre y del teléfono se respetan (solo se achican si no entran); "Llenar la chapita" los agranda hasta ocupar el espacio. Las formas están en `tools/tag/shapes.js`; son diseños propios, no copias de ningún modelo.

Séptima herramienta: **Adorno navideño** (esfera de Ø100 mm con el nombre en relieve, dos barras que lo sujetan al aro, argolla para colgar y hasta 4 adornos calados en el aro (copos de nieve, estrellas, corazones, arbolitos, campanas o muñecos de nieve)). Es el diseño de la "Esfera Editable" que se vende: aro de 3 mm, nombre de 4,3 mm y barras de 2 mm, en **dos colores a la misma altura** (necesita AMS/MMU): el aro y las barras de un color, el nombre de otro. Los adornos son diseños propios generados con código (`tools/ornament/decor.js`; 3 estilos de copo + "variación"). El nombre se ajusta al círculo (ancho máximo y alto limitado para nombres cortos) y las barras se ubican solas sobre la altura de la x y bajo la línea base de la fuente. Los puntos de la i/j y las tildes, que en una pieza así quedarían flotando, se unen al resto con un puentecito (`core/kernel/connect.js`, reutilizable); si queda alguna parte grande suelta se avisa.

Octava herramienta: **Mate** (cuerpo de mate para imprimir parado, con un hueco que es el **negativo del interior de aluminio**: el "Interior para mate 3D" de Bat-Alu, de 70 mm de alto, Ø50 de base, Ø80 de boca y 140 ml). El hueco sale de las medidas del interior (cuerpo apenas cónico, campana cóncava con borde enrollado y fondo redondeado) más una holgura por lado, y todas se pueden corregir en "Interior de aluminio" (están sacadas de la ficha del producto: conviene medir el interior real con calibre). El borde del interior puede quedar al ras o apoyado encima del mate. La silueta es calabaza, recta, florero o ajustada al interior, con las mismas 13 texturas de la lámpara (`core/kernel/surface.js`, compartido); si algún diámetro deja menos pared que la mínima alrededor del hueco, la forma se ensancha sola en ese tramo. La pared mínima se respeta como grosor real (perpendicular a la cara) y el hueco tiene juego también bajo el fondo. **Sin soportes:** por defecto ninguna cara de afuera pasa de 40° con la vertical (ajustable): donde la forma o la textura volarían más, se rellena por debajo con una rampa de ese ángulo (por meridiano, `selfSupport` / `overhangDeg`), y el canto de abajo es un chaflán en vez de un redondeo para que la primera capa apoye. Todo se arma por anillos, sin booleanas (`tools/mate/mate.js`).

Novena herramienta: **Llavero patente** (patente argentina en miniatura, con las proporciones reales llevadas al ancho del llavero). Dos estilos: **Mercosur** (2016–hoy, 400 × 130: placa blanca, franja azul con "REPÚBLICA ARGENTINA", las estrellas del logo a la izquierda y la bandera a la derecha, caracteres negros) y **vieja** (1994–2016, 294 × 129: placa blanca con un recuadro negro donde van los caracteres, "ARGENTINA" en celeste arriba con el escudo a la izquierda, y las cuatro ranuras de la chapa grabadas). Cada estilo guarda su propia patente (`AB 123 CD` / `ABC 123`), su leyenda y sus colores, así cambiar de estilo no los cruza. La leyenda de arriba se puede cambiar o dejar vacía; los caracteres llenan el lugar libre (alto y ancho ajustables, se achican solos si no entran). Lo que en la patente es del color de la placa (en la franja: la leyenda, las estrellas y el blanco de la bandera; en la vieja: los caracteres dentro del recuadro) son huecos por los que se ve la placa. Dos modos de color: **por capas (sin AMS, por defecto)**, donde cada color sube un escalón sobre el anterior (franja → bandera → caracteres en la Mercosur; recuadro → leyenda en la vieja) y cada capa de impresión tiene un solo color, así se imprime pausando y cambiando el filamento (lo de arriba se apoya en un pedestal de los colores de abajo); o **misma altura (AMS)**, todo al mismo nivel en relieve o embutido. Un color igual al de la placa no suma cambios de filamento. Borde opcional, y orejita (izquierda, derecha o arriba) o agujero adentro. La leyenda usa Lato Black (Mercosur) o Arvo, con serifa como la original (vieja), para que salga a 2–3 mm de alto; si queda más chica, avisa. El escudo es una versión simplificada (óvalo con el sol): a ese tamaño el detalle real no se imprime.

El plan completo del proyecto está en [PLAN.md](PLAN.md).

## Pedidos por WhatsApp

Cada herramienta tiene un botón **Pedir por WhatsApp**: abre un diálogo (nombre, cantidad y comentarios) con la vista previa de un mensaje que lleva el resumen del diseño, las medidas y un **enlace que reproduce el diseño exacto** (corto: solo guarda lo que cambió respecto de los valores por defecto). Al enviarlo se abre WhatsApp con el mensaje escrito.

El número que recibe los pedidos se configura en [public/config.json](public/config.json) (se lee al abrir la página: se edita sin recompilar):

```json
{ "shopName": "Bitcoin3D", "whatsapp": "5493416686947", "showOrderButton": true }
```

- `whatsapp`: solo dígitos y con código de país (`549` + código de área + número para un celular argentino). Si ponés 10 dígitos sin código se asume Argentina. Vacío: WhatsApp deja elegir a quién enviarlo.
- `showOrderButton: false` oculta el botón (por ejemplo, para usar la herramienta solo en tu taller).
- Cada herramienta aporta su resumen con `orderSummary(params, { lang, color, option })` en su `index.js` (pares `[etiqueta, valor]`; el QR no incluye su contenido a propósito).

### Cliente y taller (dos vistas de la misma pantalla)

- **Cliente (por defecto):** ve la medida, un botón grande **Pedir por WhatsApp** y una línea de tranquilidad. Nada de triángulos, gramos, instrucciones de cambio de color, perfil de impresora ni descargas.
- **Modo taller:** se prende en la barra lateral ("Modo taller"; con PIN configurado lo pide) y se recuerda en ese navegador. Suma el menú **Archivos** (STL, y ZIP y 3MF solo si el diseño tiene más de un color), los datos técnicos y el perfil de la impresora.
- Si en `config.json` ponés `"showOrderButton": false`, la herramienta queda siempre en modo taller.

### Proteger el modo taller (PIN y sitio público)

Esto es un sitio **estático**: todo el código corre en el navegador de quien lo visita, y esa persona puede mirarlo y modificarlo. Por eso hay **dos capas**, con límites distintos:

**1. PIN (candado de la interfaz).** `npm run pin` pide un PIN de 4 a 12 dígitos (sin mostrarlo, dos veces) y guarda en `public/config.json` solo un verificador (`salt`, `iterations`, `check`), nunca el PIN. Con eso:
- Activar el "Modo taller" pide el PIN. Tras 5 intentos fallidos hay que esperar (30 s, y se duplica hasta 15 min).
- Lo que el navegador recuerda es un token que solo sale de derivar el PIN (PBKDF2-SHA256, 600.000 vueltas). Editar el almacenamiento del navegador, o copiar el valor público `check`, **no** permite saltearlo. Apagar el modo olvida el token.
- `npm run pin -- --remove` quita el PIN. Después de cambiarlo hay que volver a publicar el sitio.
- **Límites:** quien tenga el verificador puede probar PINs offline (con 4 dígitos son 10.000 combinaciones: PBKDF2 lo encarece, no lo impide; usá 6 o más), y quien edite el código en su propio navegador puede mostrar la interfaz igual. Es un candado contra curiosos, no una caja fuerte.

**2. Sitio público sin el código del taller (la protección real).** `npm run build:public` compila con `vite build --mode public`: `__WORKSHOP__` vale `false` y el menú de archivos, los exportadores STL/3MF/ZIP, el diálogo de la impresora y el PIN **no entran al paquete**: no hay nada que saltear. Publicá esa versión para los clientes y usá la completa (`npm run dev`, o `npm run build` publicada en una dirección privada) para vos. `npm run test:build` compila las dos y comprueba que la pública no contiene esas marcas.
- Aun así, cualquiera puede ver el diseño que está generando (la malla está en la memoria del navegador): lo que se evita es ofrecer los archivos listos, no que alguien extraiga la geometría con herramientas de desarrollo.

## Cómo correrlo

Requisitos: Node 20+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitarios (Vitest) — geometría, exportadores, estado
npm run test:e2e   # tests de navegador (Playwright)
npm run lint
npm run build      # genera dist/
npm run preview    # sirve dist/
```

La primera vez que uses los tests E2E: `npx playwright install chromium firefox`. Corren en Chromium y Firefox.

`E2E_PREVIEW=1 npm run test:e2e` corre los E2E contra el **build de producción** en vez del servidor de desarrollo.

## Tecnologías

| Tema | Elección |
|---|---|
| Lenguaje / build | JavaScript (ES modules) + Vite, sin framework |
| Visor | three.js (solo muestra; no genera geometría) |
| Geometría | [manifold-3d](https://github.com/elalish/manifold) (WASM): booleanas, offset 2D, extrusión; garantiza mallas cerradas |
| Texto | opentype.js (TTF/OTF/WOFF) detrás de una interfaz propia (`core/kernel/text.js`) |
| Exportación | STL binario, 3MF (fflate), ZIP |

## Arquitectura en una página

```
[Panel UI] → [toolState] → debounce → [workerClient] ──postMessage──▶ [geometry.worker.js]
   ▲  (schema)  (undo, localStorage)                                   manifold-3d + opentype
   │                                                                   tool.build(params, ctx)
[Viewer three.js] ◀── items (Float32Array/Uint32Array transferibles) ◀──┘
        └─ descargas: core/export/{stl,threemf,zip}
```

- **Todo en milímetros, Z hacia arriba**; la pieza apoya en `z = 0`.
- `tool.build(K, params, ctx)` es una **función pura** (sin DOM ni three.js): corre en el worker y en Node (tests).
- Todo objeto de manifold (`CrossSection`/`Manifold`) se libera con `.delete()` mediante `createScope()` (`core/kernel/manifold.js`). Sin esto el worker pierde memoria en cada regeneración.
- **Visor compartido y fluido:** todas las herramientas usan el mismo `Viewer` (`core/viewer/Viewer.js`), que renderiza solo cuando algo cambia, dibuja a 1x mientras se orbita (y vuelve a la nitidez completa al soltar), y pide la GPU dedicada. No crees un visor propio en una herramienta nueva: `toolPage.js` ya lo monta. `tests/e2e/viewer.spec.js` recorre todas las herramientas activas del registro y falla si pierden esa fluidez.
- El worker descarta respuestas viejas (`reqId`) y, si muere, se recrea y reintenta una vez.
- Los mensajes del build son **códigos** (`ring.thinWall`) que se traducen en la UI (`msg.<código>` en `app/i18n.js`).
- Alturas Z alineadas a la altura de capa del perfil de impresora (evita capas raras y cambios de color a mitad de capa).

```
src/
  app/            shell, router, home, toolPage, i18n, tema, diálogo de impresora
  core/
    kernel/       manifold (init + scope), text, shapes2d, mesh, analysis
    fonts/        catálogo y almacén de fuentes
    printer/      perfiles de impresora (cama, boquilla, capa, AMS)
    export/       stl, 3mf, zip, nombres de archivo
    viewer/       Viewer (three.js)
    ui/           controles y panelFromSchema
    worker/       geometry.worker + workerClient
    state/        toolState (undo/redo), persistence (localStorage, URL compartible)
  tools/
    registry.js   lista de herramientas
    keychain/     index (schema + presets), params, build, layout
public/fonts, public/icons    assets estáticos
scripts/          fetch-fonts.mjs, fetch-icons.mjs
tests/unit, tests/e2e
```

## Cómo agregar una herramienta

1. Creá `src/tools/<id>/` con tres archivos:
   - `params.js` — `defaults` y `normalizeParams(raw)`. **Nunca debe lanzar excepciones**: clampea y completa lo que falte.
   - `build.js` — `export async function build(K, params, ctx)` que devuelve un `BuildResult`:
     ```js
     { items: [{ name, parts: [{ id, label, colorKey, color, positions, indices, volumeMm3, zMin, zMax }],
                 merged: { positions, indices }, sizeMm: [x, y, z], offsetXY: [0, 0] }],
       messages: [{ level: 'info' | 'warn' | 'error', code, params? }],
       info: { colorChanges, gramsByColor, needsMMU, triangles } }
     ```
     `ctx` trae `getFont(id)`, `printer` y, si aplica, `iconPolys`. Usá `createScope()` para liberar la memoria WASM.
   - `index.js` — metadata, `schema` del panel, `presets`, `paramsVersion` + `migrate`, y `build: () => import('./build.js')`.
2. Registrala en `src/tools/registry.js` con `status: 'active'` (si ya estaba como `soon`, reemplazala).
3. Agregá los textos nuevos a `src/app/i18n.js` (mensajes `msg.<código>`).
4. Escribí tests en `tests/unit/` (mallas manifold, volumen > 0, partes sin solapes). Mirá `keychain.matrix.test.js` como modelo.

El panel se genera solo desde el `schema`:

```js
{ section: 'size', title: { es: 'Tamaño', en: 'Size' }, controls: [
  { type: 'number', key: 'sizeMm', label: { es: 'Tamaño', en: 'Size' }, unit: 'mm', min: 5, max: 250, step: 1 },
  { type: 'checkbox', key: 'border', label: { es: 'Borde', en: 'Border' }, advanced: true, showIf: (p) => p.mode === 'single' },
]}
```

Tipos de control: `segmented`, `number`, `slider`, `select`, `textarea`, `checkbox`, `color`, `fontSelect`, `iconSelect`. `showIf(params)` muestra/oculta; `advanced: true` lo manda a "Más opciones". Las claves aceptan rutas con punto (`colors.base`).

## Fuentes e íconos

- `npm run fonts` descarga fuentes **OFL** (TTF estático) de google/fonts, valida que tengan los caracteres del español y regenera `public/fonts/fonts.json` + licencias. Solo estáticas: opentype.js no maneja bien las variables.
- `npm run icons` descarga íconos [Phosphor](https://phosphoricons.com) (MIT, peso "fill").
- Las fuentes que el usuario sube se usan solo en esa sesión (no se persisten). WOFF2 no está soportado.

## Despliegue

Es un sitio estático (`dist/`): Netlify, Vercel, GitHub Pages, cualquier hosting.

- **Cloudflare Workers:** `wrangler.jsonc` publica `dist/` como sitio estático. Comando de build: `npm run build`; comando de deploy: `npx wrangler deploy`. Sin ese archivo, wrangler intenta configurar el proyecto solo y falla al leer `vite.config.js`.
- Subcarpeta (por ejemplo GitHub Pages): `VITE_BASE=/mi-repo/ npm run build`. Todas las rutas a fuentes, íconos y `.wasm` respetan `BASE_URL`.
- El servidor debe enviar `.wasm` como `application/wasm` (Netlify, Vercel y GitHub Pages ya lo hacen; `vite preview` también).
- **Windows + Git Bash:** convierte `/mi-repo/` en una ruta de Windows. Usá `MSYS_NO_PATHCONV=1 VITE_BASE=/mi-repo/ npm run build` o PowerShell (`$env:VITE_BASE='/mi-repo/'; npm run build`).

## Diseño

El sistema visual está documentado en [DESIGN.md](DESIGN.md) (tokens, componentes y reglas; formato de [awesome-design-md](https://github.com/VoltAgent/awesome-design-md)). En `.claude/skills/` hay tres skills de diseño para Claude Code: `design-taste-frontend` y `redesign-existing-projects` (de [taste-skill](https://www.tasteskill.dev/)) y `web-design-guidelines` (de Vercel, revisa la UI contra sus Web Interface Guidelines).

## Verificación en slicers

Ver [docs/verificacion-slicers.md](docs/verificacion-slicers.md). El 3MF multicolor se generó siguiendo la especificación de 3MF Core (un objeto contenedor con una parte por color + `basematerials`), pero **cada slicer lo interpreta distinto** y hay que probarlo a mano en Bambu Studio, OrcaSlicer y PrusaSlicer. El ZIP por color funciona siempre como alternativa.

## Licencias

Copyright © 2026 Ignacio D. López. Todos los derechos reservados.

El código de este proyecto es privado y propietario. No se permite usarlo, copiarlo, modificarlo ni distribuirlo sin autorización expresa del autor.

Componentes de terceros (conservan sus propias licencias): fuentes SIL OFL 1.1 (ver `public/fonts/LICENSES/`), tipografía de la interfaz Geist (SIL OFL 1.1), íconos Phosphor (MIT), las fotos y el video de la home (CC BY / CC BY-SA / CC0, ver `public/home/credits.json`; los créditos se muestran en el pie de la home) y las dependencias de `package.json`. Detalle en la página "Créditos" de la app.
