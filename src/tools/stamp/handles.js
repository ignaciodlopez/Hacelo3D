// Perfiles de mangos manuales: cabeza contra la cama (z=0), cuello hacia la placa (z=1).
// Radios relativos; las secciones nunca llegan a cero para conservar un agarre sólido. Cada perfil termina en
// su cintura: desde ahí el ensanche (`flareEase`) sube hasta la placa sin collares ni escalones.
export const HANDLE_MODELS = {
  knob: {
    name: { es: 'Clásico', en: 'Classic' },
    hint: { es: 'Cabeza redondeada y cuello torneado, como un sello de escritorio tradicional.', en: 'Rounded head and turned neck, like a traditional desk stamp.' },
    dimensions: { handleWidthMm: 26, handleLengthMm: 26, handleHeightMm: 32 },
    profile: [[0, 0.82], [0.08, 0.92], [0.19, 1], [0.31, 0.96], [0.47, 0.74], [0.64, 0.55], [0.83, 0.52], [1, 0.52]],
  },
  mushroom: {
    name: { es: 'Hongo', en: 'Mushroom' },
    hint: { es: 'Cabeza ancha para apoyar la palma y cuello corto para sujetar con los dedos.', en: 'Wide head for your palm and a short neck to grip with your fingers.' },
    dimensions: { handleWidthMm: 34, handleLengthMm: 34, handleHeightMm: 24 },
    profile: [[0, 0.86], [0.1, 0.96], [0.21, 1], [0.32, 0.93], [0.47, 0.62], [0.63, 0.46], [0.84, 0.45], [1, 0.45]],
  },
  ergonomic: {
    name: { es: 'Ergonómico', en: 'Ergonomic' },
    hint: { es: 'Agarre ovalado con cintura suave: ayuda a reconocer la orientación del sello al tacto.', en: 'Oval grip with a soft waist: feel which way the stamp is facing.' },
    dimensions: { handleWidthMm: 26, handleLengthMm: 38, handleHeightMm: 30 },
    profile: [[0, 0.86], [0.12, 0.96], [0.25, 1], [0.44, 0.9], [0.64, 0.7], [0.84, 0.64], [1, 0.64]],
  },
  bar: {
    name: { es: 'Barra', en: 'Bar' },
    hint: { es: 'Barra larga con cantos suaves y cintura de agarre, para sellos rectangulares y textos anchos.', en: 'Long bar with soft edges and a grip waist, for rectangular stamps and wide text.' },
    dimensions: { handleWidthMm: 18, handleLengthMm: 50, handleHeightMm: 22 },
    profile: [[0, 0.92], [0.16, 1], [0.32, 0.98], [0.57, 0.8], [0.8, 0.76], [1, 0.76]],
  },
  compact: {
    name: { es: 'Compacto', en: 'Compact' },
    hint: { es: 'Bloque bajo con laterales cóncavos para tomar entre los dedos y guardar en poco espacio.', en: 'Low block with concave sides to hold between your fingers and store in a small space.' },
    dimensions: { handleWidthMm: 15, handleLengthMm: 38, handleHeightMm: 10 },
    profile: [[0, 0.95], [0.18, 1], [0.36, 0.95], [0.62, 0.84], [0.84, 0.83], [1, 0.83]],
  },
  none: {
    name: { es: 'Sin mango', en: 'None' },
    hint: { es: 'Solo la placa y el relieve: podés pegarla a un soporte propio.', en: 'Just the plate and relief: glue it to your own mount.' },
    dimensions: {},
    profile: [],
  },
};

export const elongatedHandle = (id) => ['bar', 'ergonomic', 'compact'].includes(id);

/**
 * Forma del ensanche cuello → placa, como fracción del recorrido e(s) para s de 0 (cuello) a 1 (placa): arranca
 * vertical con un redondeo de curvatura FLARE_CURVE (sin arista con el cuello) y sigue recto, a la pendiente
 * constante FLARE_RATE. Es la curva de curvatura acotada que menos alto necesita para el mismo ángulo máximo.
 */
const FLARE_CURVE = 5;
export const FLARE_RATE = FLARE_CURVE - Math.sqrt(FLARE_CURVE ** 2 - 2 * FLARE_CURVE);
export const FLARE_KNEE = FLARE_RATE / FLARE_CURVE;
export const flareEase = (s) => (s < FLARE_KNEE ? (FLARE_CURVE * s * s) / 2 : (FLARE_CURVE * FLARE_KNEE ** 2) / 2 + FLARE_RATE * (s - FLARE_KNEE));
export const flareRate = (s) => (s < FLARE_KNEE ? FLARE_CURVE * s : FLARE_RATE);

/** Pendientes de una curva cúbica monótona (Fritsch–Carlson): suave en cada nodo y sin pasarse de los radios definidos. */
function nodeSlopes(nodes) {
  const n = nodes.length;
  const h = [];
  const s = [];
  for (let i = 0; i < n - 1; i++) {
    h.push(nodes[i + 1][0] - nodes[i][0]);
    s.push((nodes[i + 1][1] - nodes[i][1]) / h[i]);
  }
  if (n === 2) return [s[0], s[0]];
  const m = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) {
    if (s[i - 1] * s[i] <= 0) continue;
    const w1 = 2 * h[i] + h[i - 1];
    const w2 = h[i] + 2 * h[i - 1];
    m[i] = (w1 + w2) / (w1 / s[i - 1] + w2 / s[i]);
  }
  const edge = (h0, h1, s0, s1) => {
    const d = ((2 * h0 + h1) * s0 - h0 * s1) / (h0 + h1);
    if (d * s0 <= 0) return 0;
    return s0 * s1 <= 0 && Math.abs(d) > 3 * Math.abs(s0) ? 3 * s0 : d;
  };
  m[0] = edge(h[0], h[1], s[0], s[1]);
  // el cuello termina vertical: el ensanche hacia la placa también arranca vertical y la unión no tiene arista
  m[n - 1] = 0;
  return m;
}

/** Perfil [z, radio] continuo, con `divisions` muestras por tramo entre nodos. */
export function handleProfile(id, divisions = 8) {
  const nodes = HANDLE_MODELS[id].profile;
  if (!nodes.length) return [];
  const m = nodeSlopes(nodes);
  const points = nodes.slice(0, 1);
  for (let i = 1; i < nodes.length; i++) {
    const [z0, r0] = nodes[i - 1];
    const [z1, r1] = nodes[i];
    const h = z1 - z0;
    for (let j = 1; j <= divisions; j++) {
      const u = j / divisions;
      const u2 = u * u;
      const u3 = u2 * u;
      const r = (2 * u3 - 3 * u2 + 1) * r0 + (u3 - 2 * u2 + u) * h * m[i - 1] + (-2 * u3 + 3 * u2) * r1 + (u3 - u2) * h * m[i];
      points.push([z0 + h * u, r]);
    }
  }
  return points;
}

/** Ancho de placa (mm) con el que se ilustra cada modelo en el selector: el de su preset o uno típico. */
const PREVIEW_PLATE = { knob: 40, mushroom: 36, ergonomic: 52, bar: 58, compact: 46, none: 46 };

/**
 * Silueta lateral para el selector, en posición de uso (cabeza arriba, relieve abajo), con las medidas sugeridas
 * del modelo y el mismo perfil y ensanche que la pieza real. Coordenadas SVG de 80 × 64.
 */
export function handlePreview(id) {
  const plateW = PREVIEW_PLATE[id];
  const plateT = 3;
  const relief = 1.6;
  const model = HANDLE_MODELS[id];
  const tapers = id === 'bar' || id === 'compact';
  const half = id === 'none' ? 0 : (elongatedHandle(id) ? model.dimensions.handleLengthMm : model.dimensions.handleWidthMm) / 2;
  const profile = id === 'none' ? [] : handleProfile(id, 6);
  const widthAt = (r) => half * (tapers ? 0.75 + 0.25 * r : r);
  const gripH = model.dimensions.handleHeightMm ?? 0;
  const neck = profile.length ? widthAt(profile.at(-1)[1]) : 0;
  // mismo alto de ensanche que calcula la geometría para un contorno circular: pendiente FLARE_RATE a 0.97
  const flareH = profile.length ? (Math.max(0, plateW / 2 - neck) * FLARE_RATE) / 0.97 : 0;
  const totalH = gripH + flareH + plateT + relief;
  const scale = Math.min(72 / Math.max(plateW, 2 * half), 56 / totalH);
  const top = (64 - totalH * scale) / 2;
  const X = (x) => 40 + x * scale;
  const Y = (z) => top + z * scale;
  const side = [
    ...profile.map(([z, r]) => [widthAt(r), z * gripH]),
    ...(profile.length ? Array.from({ length: 16 }, (_, k) => (k + 1) / 16).map((u) => [neck + (plateW / 2 - neck) * flareEase(u), gripH + flareH * u]) : []),
    [plateW / 2, gripH + flareH],
    [plateW / 2, gripH + flareH + plateT],
  ];
  const outline = [...side, ...side.map(([x, z]) => [-x, z]).reverse()];
  const fmt = (pts) => `M${pts.map(([x, z]) => `${X(x).toFixed(2)},${Y(z).toFixed(2)}`).join('L')}Z`;
  // tres letras en relieve bajo la placa
  const y0 = gripH + flareH + plateT;
  const letters = [-0.3, 0, 0.3].map((c) => fmt([[(c - 0.09) * plateW, y0], [(c + 0.09) * plateW, y0], [(c + 0.09) * plateW, y0 + relief], [(c - 0.09) * plateW, y0 + relief]]));
  return [fmt(outline), ...letters].join(' ');
}
