# Logos de herramientas

Siluetas locales de los logos reales, preparadas el 27 de octubre de 2026. No requieren servicios externos al usar el sitio.

| Marca | Archivo de origen | Preparación |
| --- | --- | --- |
| DeWalt | [Worldvectorlogo](https://cdn.worldvectorlogo.com/logos/dewalt-1.svg) | Vector, una tinta. |
| Milwaukee | [SVG del encabezado oficial](https://www.milwaukeetool.com/) | Vector, conserva la palabra y el rayo. |
| Makita | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Makita_Logo.svg) | Vector, se quitó el fondo rojo. |
| Bosch | [Sitio oficial](https://www.bosch-professional.com/media/professional/central_assets/bosch_logo/bosch.svg) | Vector, símbolo y palabra en una tinta. |
| Stanley | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Stanley_Hand_Tools_logo.svg) | Vector, se quitó el fondo amarillo y el espacio vacío. |
| Black+Decker | [Sitio oficial](https://www.blackanddecker.com/cdn/shop/t/182/assets/Logo-Grey.svg?v=146770065678055879911727771188) | Vector, conserva el contorno. |
| Total | [Total Chile](https://herramientastotal.cl/cdn/shop/files/LOGO_TOTAL_487x157.svg?v=1792502953) | Vector, solo la marca; se quitó el eslogan pequeño. |
| Ingco | [Iconape](https://iconape.com/ingco-logo-logo-icon-svg-png.html) ([SVG](https://iconape.com/wp-content/files/hz/277696/svg/277696.svg)) | Vector, se quitó el fondo oscuro. |
| Emtop | [Manual ECDL620012 distribuido por Millasur](https://cdn.millasur.com/sites/default/files/product_attachments/maquinaria/ECDL620012/TALADRO-BATERIA-EMTOP-20V-45NM-151-P20S-%28INCLUYE-2-BATERIAS-2Ah-CARGADOR-MALETIN%29%20%5B108538%5D.pdf) | **Vectorización del bitmap real**, no un SVG oficial: imagen de 438 × 105 px de la portada, sin eslogan. VTracer, modo binario/spline, umbral 30/255, recorte superior de 68 px. |
| Lüsqtoff | [Sitio oficial](https://lusqtoff.com.ar/2023/pics/lusqtoff-logo-2024.svg) | Vector, símbolo y palabra; se quitó el eslogan pequeño. |

Se conservaron los trazados y sus huecos, se unificó el color a negro y se ajustó el `viewBox` al dibujo con margen del 1,2 %. Los colores de la pieza se aplican por separado desde el módulo. Se eliminaron estilos CSS, metadatos y fondos que interferían con la extrusión.

`npm run logos` solo genera los archivos faltantes y actualiza el catálogo: nunca sobrescribe estos SVG. Para reemplazar un logo deliberadamente: `npm run logos:import -- <carpeta> --force` y actualizar esta tabla según la procedencia del nuevo archivo.

Las marcas pertenecen a sus respectivos titulares. Esta lista documenta la procedencia de los dibujos, no una licencia ni una afiliación.
