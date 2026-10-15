# DESIGN.md — Hacelo3D

Sistema visual de la interfaz, en el formato de [awesome-design-md](https://github.com/VoltAgent/awesome-design-md). Se tomó la estructura y las reglas de **Linear** (herramienta densa, oscura, sin adornos) y se adaptó a la marca de Hacelo3D: **naranja** como único acento y tema claro/oscuro. Los tokens reales viven en [src/styles/tokens.css](src/styles/tokens.css); si cambian, actualizá este archivo.

Para un agente: leé esto antes de tocar la UI. La app es una **herramienta** (panel de parámetros + visor 3D), no una landing: priorizá claridad y densidad sobre efectos.

## Principios

- **Un solo acento.** El naranja (`--accent`) es para la acción principal, el estado activo, el foco y el logo. Nada de segundo color (el rojo anterior de los segmentados se eliminó).
- **La jerarquía la dan las superficies**, no las sombras: `--bg` → `--card` → `--card-2`, con borde de 1 px (`--border`). Sombra solo en lo que flota (diálogo, toast).
- **Sin degradados ni brillos.** Botón primario plano; el hover aclara el relleno.
- **Controles de 8 px de radio** (`--radius-ctl`), contenedores de 12 px (`--radius`). Sin botones en píldora.
- **Un solo tipo de letra de interfaz:** Geist (variable, SIL OFL), cargada con `@fontsource-variable/geist`. Números con `tabular-nums` donde se alinean (medidas, cantidades). Los títulos llevan tracking negativo y `text-wrap: balance`.
- **Español rioplatense, voseo, oración normal (no Title Case).** Sin signos de exclamación en confirmaciones.

## Tokens

| Rol | Oscuro | Claro |
|---|---|---|
| Fondo `--bg` | `#1a1214` | `#f6f3f2` |
| Superficie `--card` / `--card-2` | `#221a1d` / `#2a2023` | `#ffffff` / `#f1ecea` |
| Borde `--border` | `#3a2c30` | `#e0d6d3` |
| Texto / secundario | `#f1e9ea` / `#a8979b` | `#261c1e` / `#6e5d61` |
| Acento `--accent` (relleno, texto `--accent-text`) | `#f97316` / `#1a0e05` | `#ea580c` / `#1a0e05` (el texto blanco sobre `#ea580c` no llega a contraste AA) |
| Segmento activo `--seg-active` | `#f97316` | `#c2410c` (contraste AA con texto blanco) |
| Estados | peligro `#ef4444`, aviso `#f59e0b`, info `#60a5fa` | `#dc2626`, `#b45309`, `#2563eb` |

Espaciado base de 4 px; gutter de página 16 px; ancho máximo de contenido 1500 px.

## Componentes

- **Botón primario** (`.btn.primary`): relleno `--accent`, texto `--accent-text`, 8 px. Hover `--accent-2`. Pressed: `translateY(1px) scale(.99)`.
- **Botón secundario** (`.btn`): `--card` + borde; hover sube a `--card-2` y borde `--text-dim`.
- **Segmentado** (`.segmented`): fondo `--seg-bg`; activo relleno `--seg-active`.
- **Tarjetas de panel** (`.card`): `--card`, borde, 12 px, padding 14–16 px. Las opciones avanzadas van en `<details>` con separador sólido.
- **Home:** título grande a la izquierda, herramientas **disponibles** como tarjeta (ícono relleno + flecha) y las **próximas** como lista compacta sin tarjetas.
- **Chips y barras sobre el visor:** 8 px, fondo `--card` al 85–88 %.
- **Foco:** `:focus-visible` con 2 px de `--accent`. Nunca quitar el outline sin reemplazo.
- **Movimiento:** transiciones de 100–150 ms sobre `background-color`, `border-color`, `color` y `transform`. Nunca `transition: all`. `prefers-reduced-motion` lo reduce a ~0.

## Qué no hacer

- No agregar un segundo color de acento ni degradados ni sombras de color.
- No usar `100vh` solo: va `100vh` + `100dvh` de respaldo.
- No volver a tarjetas idénticas con ícono arriba para listas de herramientas.
- No usar monoespaciada fuera de código.
- No poner `<div>` con `onclick`: usá `<button>` o `<a>`.

## Accesibilidad

Botones solo-ícono con `aria-label` y `title`; enlace "Saltar al contenido"; `aria-expanded` en los selectores desplegables; `aria-live` para mensajes de generación; `color-scheme` y `theme-color` siguen el tema.
