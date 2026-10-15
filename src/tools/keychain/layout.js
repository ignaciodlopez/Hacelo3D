// Acomodo del lote en placas del tamaño de la cama de la impresora.
// Empaquetado por filas, respetando el orden de los nombres.

/**
 * @param {{ bboxXY: [number, number, number, number] }[]} items  bbox local de cada pieza
 * @param {[number, number]} bed
 * @param {{ edge?: number, gap?: number }} [opts]
 * @returns {{ plates: { items: number[] }[], offsets: [number, number][], overflow: number[] }}
 */
export function layoutPlates(items, bed, { edge = 5, gap = 4 } = {}) {
  const W = bed[0] - 2 * edge;
  const H = bed[1] - 2 * edge;
  const plates = [{ items: [] }];
  const offsets = [];
  const overflow = [];
  let x = 0;
  let y = 0;
  let rowH = 0;
  items.forEach((it, i) => {
    const [x0, y0, x1, y1] = it.bboxXY;
    const w = x1 - x0;
    const h = y1 - y0;
    if (w > W || h > H) {
      // no entra ni sola: va en su propia placa y se avisa
      overflow.push(i);
      if (plates[plates.length - 1].items.length) plates.push({ items: [] });
      plates[plates.length - 1].items.push(i);
      offsets[i] = [edge - x0, edge - y0];
      plates.push({ items: [] });
      x = 0;
      y = 0;
      rowH = 0;
      return;
    }
    if (x > 0 && x + w > W) {
      x = 0;
      y += rowH + gap;
      rowH = 0;
    }
    if (y + h > H) {
      plates.push({ items: [] });
      x = 0;
      y = 0;
      rowH = 0;
    }
    plates[plates.length - 1].items.push(i);
    offsets[i] = [edge + x - x0, edge + y - y0];
    x += w + gap;
    rowH = Math.max(rowH, h);
  });
  return { plates: plates.filter((p) => p.items.length), offsets, overflow };
}
