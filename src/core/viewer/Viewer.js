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
    // resolución dinámica al orbitar: si los cuadros tardan, baja de a pasos (1x → 0.75x → 0.5x)
    this.ratioSteps = [Math.min(this.fullRatio, 1), 0.75, 0.5];
    this.ratioIdx = 0;
    this.frameEma = 0;
    this.frameCount = 0;
    this.lastFrameAt = 0;
    /** @type {((info: { fps: number, gpu: string }) => void) | null} avisa una vez si orbitar va lento aun a la mínima resolución */
    this.onSlow = null;
    this.slowNotified = false;
    this.winTotal = 0;
    this.winSlow = 0;
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
      this.ratioIdx = 0;
      this.frameEma = 0;
      this.frameCount = 0;
      this.lastFrameAt = 0;
      this.setRatio(this.ratioSteps[0]);
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
    this.perf = new URLSearchParams(location.search).has('perf') ? this.createPerfHud(container) : null;
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

  /** Nombre de la GPU que usa el navegador (p. ej. "NVIDIA GeForce RTX 3060" o "SwiftShader" si dibuja por software). */
  gpuName() {
    const gl = this.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  }

  /**
   * Medidor para diagnosticar lag: se activa agregando `?perf` a la URL (…/?perf#/tool/keychain).
   * Muestra la GPU que usa el navegador, cuadros por segundo al orbitar y la resolución actual.
   */
  createPerfHud(container) {
    const el = document.createElement('div');
    el.className = 'viewer-perf';
    container.appendChild(el);
    const ext = this.renderer.getContext().getExtension('WEBGL_debug_renderer_info');
    const gpu = ext ? this.renderer.getContext().getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'GPU desconocida';
    let frames = 0;
    let cpuMs = 0;
    let since = 0;
    return {
      sample: (ms, now) => {
        if (!since) since = now;
        frames++;
        cpuMs += ms;
        if (now - since < 1000) return;
        const info = this.renderer.info;
        el.textContent = `${gpu}
${Math.round((frames * 1000) / (now - since))} cuadros/s · render ${(cpuMs / frames).toFixed(1)} ms · resolución ${this.renderer.getPixelRatio()}x · ${Math.round(info.render.triangles / 1000)}k triángulos · ${info.render.calls} dibujos`;
        frames = 0;
        cpuMs = 0;
        since = now;
      },
    };
  }

  /** Mide el tiempo entre cuadros mientras se orbita y baja la resolución si no llega a ~35 fps. */
  adaptRatio(now) {
    if (this.lastFrameAt) {
      const dt = now - this.lastFrameAt;
      this.frameEma = this.frameEma ? this.frameEma * 0.7 + dt * 0.3 : dt;
      this.frameCount++;
      // ventana de 60 cuadros: si 1 de cada 7 tarda más de 33 ms hay cortes aunque el promedio sea bueno
      this.winTotal++;
      if (dt > 33) this.winSlow++;
      if (this.winTotal >= 60) {
        if (this.winSlow >= 9 && !this.slowNotified && this.onSlow) {
          this.slowNotified = true;
          this.onSlow({ fps: Math.round(1000 / Math.max(this.frameEma, 1)), gpu: this.gpuName() });
        }
        this.winTotal = 0;
        this.winSlow = 0;
      }
      if (this.frameCount >= 6 && this.frameEma > 28 && this.ratioIdx < this.ratioSteps.length - 1) {
        this.setRatio(this.ratioSteps[++this.ratioIdx]);
        this.frameCount = 0;
        this.frameEma = 0;
      }
    }
    this.lastFrameAt = now;
  }

  loop() {
    if (this.disposed) return;
    const moved = this.controls.update();
    const now = performance.now();
    if (!moved && !this.interacting && now > this.restoreAt) this.setRatio(this.fullRatio);
    if (moved && this.interacting) this.adaptRatio(now);
    else this.lastFrameAt = 0;
    if (moved || this.dirty) {
      const t0 = this.perf ? performance.now() : 0;
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
      if (this.perf) this.perf.sample(performance.now() - t0, now);
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
   * `viewOffset` (opcional, solo para mostrar) reemplaza a `offsetXY`: p. ej. una pieza armada encima de otra.
   * @param {{ parts: any[], offsetXY?: [number, number], viewOffset?: [number, number, number] }[]} items
   */
  setItems(items) {
    this.clear();
    // Una sola malla por color (con todas las piezas del lote ya desplazadas): pocas draw calls
    // y una sola pasada de normales, en vez de 2 mallas por pieza.
    /** @type {Map<string, { color: string, parts: any[], dx: number, dy: number, dz: number }[]>} */
    const byColor = new Map();
    for (const item of items) {
      const [dx, dy, dz] = item.viewOffset ?? [item.offsetXY?.[0] ?? 0, item.offsetXY?.[1] ?? 0, 0];
      for (const part of item.parts) {
        if (!byColor.has(part.colorKey)) byColor.set(part.colorKey, []);
        byColor.get(part.colorKey).push({ color: part.color, part, dx, dy, dz });
      }
    }
    for (const [colorKey, list] of byColor) {
      let verts = 0;
      let idxs = 0;
      for (const { part } of list) {
        verts += part.positions.length / 3;
        idxs += part.indices.length;
      }
      const positions = new Float32Array(verts * 3);
      const indices = new Uint32Array(idxs);
      let vo = 0;
      let io = 0;
      for (const { part, dx, dy, dz } of list) {
        const src = part.positions;
        for (let i = 0; i < src.length; i += 3) {
          positions[vo * 3 + i] = src[i] + dx;
          positions[vo * 3 + i + 1] = src[i + 1] + dy;
          positions[vo * 3 + i + 2] = src[i + 2] + dz;
        }
        for (let j = 0; j < part.indices.length; j++) indices[io + j] = part.indices[j] + vo;
        vo += src.length / 3;
        io += part.indices.length;
      }
      let geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setIndex(new THREE.BufferAttribute(indices, 1));
      geom = toCreasedNormals(geom, (30 * Math.PI) / 180);
      const mat = new THREE.MeshStandardMaterial({ color: list[0].color, roughness: 0.6, metalness: 0 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData.colorKey = colorKey;
      mesh.visible = !this.hidden.has(colorKey);
      this.root.add(mesh);
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
      this.bedLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffbd59 }));
      this.scene.add(this.bedLine);
    }
    this.dirty = true;
  }

  /** @param {'iso'|'top'|'bottom'} [mode] */
  fitView(mode = 'iso') {
    const box = new THREE.Box3().setFromObject(this.root);
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 5);
    // encuadre por el campo de visión más angosto: en un visor angosto manda el ancho, no el alto
    const vFov = (this.camera.fov * Math.PI) / 180;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const dist = (radius / Math.sin(Math.min(vFov, hFov) / 2)) * 0.95;
    const dir = mode === 'top' ? new THREE.Vector3(0, -0.001, 1) : mode === 'bottom' ? new THREE.Vector3(0.18, 0.4, -1) : new THREE.Vector3(0.35, -0.8, 0.75);
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
