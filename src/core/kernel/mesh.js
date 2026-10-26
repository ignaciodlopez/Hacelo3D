/**
 * Manifold → malla indexada simple. `vertProperties` puede tener numProp > 3
 * valores por vértice; solo se usan los 3 primeros (xyz).
 * @param {any} manifold
 * @returns {{ positions: Float32Array, indices: Uint32Array }}
 */
export function manifoldToMesh(manifold) {
  const mesh = manifold.getMesh();
  const np = mesh.numProp;
  const nv = mesh.vertProperties.length / np;
  const positions = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    positions[i * 3] = mesh.vertProperties[i * np];
    positions[i * 3 + 1] = mesh.vertProperties[i * np + 1];
    positions[i * 3 + 2] = mesh.vertProperties[i * np + 2];
  }
  return { positions, indices: new Uint32Array(mesh.triVerts) };
}

/**
 * La pieza entera (todos los colores unidos), para el STL de un color. Unir partes apoyadas cara con cara (las letras
 * sobre la placa) es lo más lento de toda la generación y la vista previa no la usa: con `skip` no se une y queda
 * `merged: null` (el exportador pide otra generación completa). Con una sola parte la unión no cuesta nada y se hace igual.
 * @param {any} K
 * @param {(o:any)=>any} t  tracker de memoria
 * @param {any[]} manifolds  una por color
 * @param {boolean} [skip]
 * @returns {{ merged: any|null, box: { min:number[], max:number[] }, triangles: number }}
 */
export function mergeParts(K, t, manifolds, skip = false) {
  if (skip && manifolds.length > 1) {
    const boxes = manifolds.map((m) => m.boundingBox());
    const min = [0, 1, 2].map((k) => Math.min(...boxes.map((b) => b.min[k])));
    const max = [0, 1, 2].map((k) => Math.max(...boxes.map((b) => b.max[k])));
    return { merged: null, box: { min, max }, triangles: manifolds.reduce((n, m) => n + m.numTri(), 0) };
  }
  const m = manifolds.length === 1 ? manifolds[0] : t(K.Manifold.union(manifolds));
  const mesh = manifoldToMesh(m);
  const b = m.boundingBox();
  return {
    merged: { ...mesh, status: m.status(), genus: m.genus(), volumeMm3: m.volume() },
    box: { min: b.min, max: b.max },
    triangles: mesh.indices.length / 3,
  };
}
