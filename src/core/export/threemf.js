import { zipSync, strToU8 } from 'fflate';

const ESC = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ESC[c]);
const num = (v) => String(Number(v.toFixed(5)));

/**
 * 3MF con un objeto contenedor por pieza y una malla (parte) por color.
 * @param {{ name:string, parts:{label:string,color:string,positions:Float32Array,indices:Uint32Array}[], offsetXY?:[number,number] }[]} items
 * @param {string} [title]
 * @returns {Uint8Array}
 */
export function encode3mf(items, title = 'Bitcoin3D') {
  const colors = [];
  const colorIndex = (hex) => {
    const c = hex.toUpperCase() + 'FF';
    let i = colors.indexOf(c);
    if (i < 0) i = colors.push(c) - 1;
    return i;
  };
  let id = 2; // el id 1 es basematerials
  const objects = [];
  const buildItems = [];
  for (const item of items) {
    const partIds = [];
    for (const part of item.parts) {
      const pid = id++;
      partIds.push(pid);
      const v = [];
      for (let i = 0; i < part.positions.length; i += 3) {
        v.push(`<vertex x="${num(part.positions[i])}" y="${num(part.positions[i + 1])}" z="${num(part.positions[i + 2])}"/>`);
      }
      const tr = [];
      for (let i = 0; i < part.indices.length; i += 3) {
        tr.push(`<triangle v1="${part.indices[i]}" v2="${part.indices[i + 1]}" v3="${part.indices[i + 2]}"/>`);
      }
      objects.push(
        `<object id="${pid}" name="${esc(part.label)}" type="model" pid="1" pindex="${colorIndex(part.color)}"><mesh><vertices>${v.join('')}</vertices><triangles>${tr.join('')}</triangles></mesh></object>`,
      );
    }
    const cid = id++;
    objects.push(
      `<object id="${cid}" name="${esc(item.name.replace(/\n/g, ' '))}" type="model"><components>${partIds.map((p) => `<component objectid="${p}"/>`).join('')}</components></object>`,
    );
    const [ox, oy] = item.offsetXY ?? [0, 0];
    buildItems.push(`<item objectid="${cid}" transform="1 0 0 0 1 0 0 0 1 ${num(ox)} ${num(oy)} 0"/>`);
  }
  const base = colors.map((c, i) => `<base name="Color ${i + 1}" displaycolor="${c}"/>`).join('');
  const model =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<metadata name="Title">${esc(title)}</metadata>` +
    `<metadata name="Application">Bitcoin3D</metadata>` +
    `<resources><basematerials id="1">${base}</basematerials>${objects.join('')}</resources>` +
    `<build>${buildItems.join('')}</build></model>`;
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  return zipSync(
    {
      '[Content_Types].xml': strToU8(contentTypes),
      '_rels/.rels': strToU8(rels),
      '3D/3dmodel.model': strToU8(model),
    },
    { level: 6 },
  );
}
