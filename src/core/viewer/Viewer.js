import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Visor 3D (Z hacia arriba, mm). Solo muestra; la geometría viene ya generada.
 * Render bajo demanda: solo dibuja cuando algo cambia.
 */
export class Viewer {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
    this.disposed = false;
    this.dirty = true;
    this.fitted = false;
    this.lastSize = 0;
    this.groupsByColor = new Map();
    this.hidden = new Set();

    const dark = !document.documentElement.matches('[data-theme="light"]');
    // powerPreference pide la GPU dedicada en notebooks híbridas; sin preserveDrawingBuffer
    // (la captura PNG vuelve a renderizar justo antes de leer el canvas).
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.fullRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.fullRatio);
    this.interacting = false;
    this.restoreAt = 0;
    this.renderer.domElement.className = 'viewer-canvas';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(dark ? 0x1b1a1d : 0xe9e9ee);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.5, 5000);
    this.camera.up.set(0, 0, 1); // ANTES de crear OrbitControls
    this.camera.position.set(60, -90, 80);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.addEventListener('change', () => (this.dirty = true));
    // mientras se arrastra se dibuja a resolución 1x (más fluido en pantallas HiDPI) y al soltar se vuelve a la nítida
    this.controls.addEventListener('start', () => {
      this.interacting = true;
      this.setRatio(1);
    });
    this.controls.addEventListener('end', () => {
      this.interacting = false;
      this.restoreAt = performance.now() + 150;
    });

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x555566, 1.4));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-60, -80, 140);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.8);
    fill.position.set(90, 60, 40);
    this.scene.add(fill);

    this.grid = new THREE.GridHelper(400, 40, dark ? 0x4a4a52 : 0x9a9aa6, dark ? 0x2f2f36 : 0xc4c4ce);
    this.grid.rotation.x = Math.PI / 2; // GridHelper nace en XZ; llevarlo al plano XY
    this.grid.position.z = -0.01;
    this.scene.add(this.grid);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.bedLine = null;

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.onContextLost = (e) => e.preventDefault();
    this.onContextRestored = () => (this.dirty = true);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  setRatio(ratio) {
    if (this.renderer.getPixelRatio() === ratio) return;
    this.renderer.setPixelRatio(ratio);
    this.resize();
  }

  loop() {
    if (this.disposed) return;
    const moved = this.controls.update();
    if (!moved && !this.interacting && performance.now() > this.restoreAt) this.setRatio(this.fullRatio);
    if (moved || this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  clear() {
    for (const child of [...this.root.children]) {
      this.root.remove(child);
      child.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.dispose();
        }
      });
    }
    this.groupsByColor.clear();
  }

  /**
   * @param {{ parts: any[], offsetXY?: [number, number] }[]} items
   */
  setItems(items) {
    this.clear();
    for (const item of items) {
      const g = new THREE.Group();
      g.position.set(item.offsetXY?.[0] ?? 0, item.offsetXY?.[1] ?? 0, 0);
      for (const part of item.parts) {
        let geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
        geom.setIndex(new THREE.BufferAttribute(part.indices, 1));
        geom = toCreasedNormals(geom, (30 * Math.PI) / 180);
        const mat = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.6, metalness: 0 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.userData.colorKey = part.colorKey;
        mesh.visible = !this.hidden.has(part.colorKey);
        g.add(mesh);
      }
      this.root.add(g);
    }
    const box = new THREE.Box3().setFromObject(this.root);
    const size = box.isEmpty() ? 0 : box.getSize(new THREE.Vector3()).length();
    if (!this.fitted || (this.lastSize > 0 && Math.abs(size - this.lastSize) / this.lastSize > 0.3)) this.fitView();
    this.lastSize = size;
    this.dirty = true;
  }

  setColorVisible(colorKey, visible) {
    if (visible) this.hidden.delete(colorKey);
    else this.hidden.add(colorKey);
    this.root.traverse((o) => {
      if (o.isMesh && o.userData.colorKey === colorKey) o.visible = visible;
    });
    this.dirty = true;
  }

  /** Dibuja el contorno de la cama (en lote). `bed = null` lo quita. */
  setBed(bed) {
    if (this.bedLine) {
      this.scene.remove(this.bedLine);
      this.bedLine.geometry.dispose();
      this.bedLine.material.dispose();
      this.bedLine = null;
    }
    if (bed) {
      const [w, h] = bed;
      const pts = [
        [0, 0],
        [w, 0],
        [w, h],
        [0, h],
        [0, 0],
      ].map(([x, y]) => new THREE.Vector3(x, y, 0.02));
      this.bedLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf97316 }));
      this.scene.add(this.bedLine);
    }
    this.dirty = true;
  }

  /** @param {'iso'|'top'} [mode] */
  fitView(mode = 'iso') {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 5);
    const dist = radius / Math.sin((this.camera.fov * Math.PI) / 360) * 0.95;
    const dir = mode === 'top' ? new THREE.Vector3(0, -0.001, 1) : new THREE.Vector3(0.35, -0.8, 0.75);
    dir.normalize();
    this.camera.position.copy(center).addScaledVector(dir, dist);
    this.camera.near = Math.max(0.1, dist / 200);
    this.camera.far = dist * 20;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(center);
    this.controls.update();
    this.fitted = true;
    this.dirty = true;
  }

  /** PNG del visor actual. */
  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return new Promise((resolve) => this.renderer.domElement.toBlob(resolve, 'image/png'));
  }

  setTheme(isDark) {
    this.scene.background = new THREE.Color(isDark ? 0x1b1a1d : 0xe9e9ee);
    this.grid.material.color?.set?.(isDark ? 0x2f2f36 : 0xc4c4ce);
    this.dirty = true;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.clear();
    this.setBed(null);
    this.grid.geometry.dispose();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
