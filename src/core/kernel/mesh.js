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
