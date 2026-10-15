# Verificación manual en slicers

El 3MF multicolor se genera en `src/core/export/threemf.js` con la estructura de la especificación 3MF Core:

- `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model` (`unit="millimeter"`).
- Un `<basematerials>` con un `<base displaycolor="#RRGGBBAA">` por color.
- Un `<object type="model">` por parte (una por color, con `pid`/`pindex`) y un objeto contenedor con `<components>` que las agrupa.
- `<build>` con un `<item>` por pieza y su `transform` (en lote: posición dentro de la placa).

Lo que **sí está verificado automáticamente** (tests unitarios y E2E): el ZIP contiene los 3 archivos, el XML tiene un objeto por parte + contenedor, los colores están y las mallas son manifold. Lo que **no se puede verificar sin el programa instalado** es cómo cada slicer lo interpreta. Completá esta tabla probando el archivo `llavero-sofia.3mf` descargado con la configuración por defecto.

| Slicer | Versión | ¿Abre sin errores? | ¿Un objeto con 2 partes? | ¿Colores asignados? | ¿Partes alineadas? | Notas |
|---|---|---|---|---|---|---|
| Bambu Studio | | | | | | |
| OrcaSlicer | | | | | | |
| PrusaSlicer | | | | | | |

## Cómo probar

1. Abrí la herramienta con los valores por defecto y descargá **3MF multicolor**.
2. Importalo en el slicer. Debería aparecer **un solo objeto** con dos partes (Base y Letras), no dos objetos sueltos ni apilados.
3. Verificá que cada parte tenga un color distinto y que la base apoye en la cama.
4. Repetí con un diseño de 3 colores (preset "Nombre con contorno") y con el modo lote.

## Si algún slicer no asigna bien los filamentos

No inventar el formato. Guardá un proyecto multicolor desde ese slicer, descomprimí el `.3mf` y copiá la estructura de sus metadatos propios:

- Bambu Studio / OrcaSlicer: `Metadata/model_settings.config`.
- PrusaSlicer: `Metadata/Slic3r_PE_model.config`.

Mientras tanto, el **ZIP por color** (un STL por color, todos en las mismas coordenadas) se importa en cualquier slicer como "objeto de varias partes".
