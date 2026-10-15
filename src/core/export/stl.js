const HEADER = 'binary STL - Hacelo3D';

/**
 * STL binario. El header NO empieza con "solid" (algunos lectores lo toman como ASCII).
 * Tamaño = 84 + 50·n.
 * @param {{ positions: Float32Array, indices: Uint32Array }} mesh
 * @param {[number, number, number]} [offset] traslación aplicada a los vértices
 */
export function encodeStl(mesh, offset = [0, 0, 0]) {
  const { positions: P, indices: I } = mesh;
  const n = I.length / 3;
  const buf = new ArrayBuffer(84 + 50 * n);
  const dv = new DataView(buf);
  for (let i = 0; i < HEADER.length; i++) dv.setUint8(i, HEADER.charCodeAt(i));
  dv.setUint32(80, n, true);
  let o = 84;
  const v = new Array(12);
  for (let f = 0; f < n; f++) {
    const a = I[f * 3] * 3;
    const b = I[f * 3 + 1] * 3;
    const c = I[f * 3 + 2] * 3;
    const ax = P[a] + offset[0];
    const ay = P[a + 1] + offset[1];
    const az = P[a + 2] + offset[2];
    const bx = P[b] + offset[0];
    const by = P[b + 1] + offset[1];
    const bz = P[b + 2] + offset[2];
    const cx = P[c] + offset[0];
    const cy = P[c + 1] + offset[1];
    const cz = P[c + 2] + offset[2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    v[0] = nx; v[1] = ny; v[2] = nz;
    v[3] = ax; v[4] = ay; v[5] = az;
    v[6] = bx; v[7] = by; v[8] = bz;
    v[9] = cx; v[10] = cy; v[11] = cz;
    for (let k = 0; k < 12; k++) {
      dv.setFloat32(o, v[k], true);
      o += 4;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return new Uint8Array(buf);
}
