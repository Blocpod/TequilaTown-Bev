// Persistent 3D can. One object, one renderer, driven by a pose the choreography tweens.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import gsap from 'gsap';

export const FLAVORS = ['xoconostle', 'guava', 'tamarind', 'guanabana'];
const RIM = { xoconostle: 0xc85a7a, guava: 0xd46a92, tamarind: 0xff8a3d, guanabana: 0x8cc06a };

export function createCan(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  if (!renderer.getContext()) return null;

  const isMobile = matchMedia('(max-width: 899px)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.6 : 1.85);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  camera.position.set(0, 0, 8.6);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const key = new THREE.DirectionalLight(0xfff1dc, 1.15); key.position.set(3, 4.5, 5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xdbe7ff, 0.45); fill.position.set(-4.5, 1, 3); scene.add(fill);
  const front = new THREE.DirectionalLight(0xfff7ea, 0.55); front.position.set(-1.2, 2.2, 6); scene.add(front);
  const rim = new THREE.PointLight(RIM.xoconostle, 30, 20, 1.6); rim.position.set(-2.6, 1.4, -2.2); scene.add(rim);
  const rim2 = new THREE.PointLight(0xffffff, 10, 20, 1.6); rim2.position.set(2.8, -1.2, -1.8); scene.add(rim2);

  // ---- geometry ----
  const R = 0.5, BODY = 2.52, TOP = BODY / 2;
  const group = new THREE.Group();
  scene.add(group);

  const labelMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.48, metalness: 0.06,
    clearcoat: 0.22, clearcoatRoughness: 0.5, envMapIntensity: 0.5,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(R, R, BODY, 160, 1, true, -Math.PI / 2, Math.PI * 2), labelMat);
  group.add(body);

  const aluMat = new THREE.MeshStandardMaterial({ color: 0xdedcd6, metalness: 0.92, roughness: 0.26, envMapIntensity: 1.15, side: THREE.DoubleSide });
  const lathe = (pts) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0] * R, p[1])), 128);
  const shoulder = new THREE.Mesh(lathe([
    [1, TOP], [0.99, TOP + 0.02], [0.955, TOP + 0.07], [0.905, TOP + 0.13], [0.87, TOP + 0.17],
    [0.87, TOP + 0.20], [0.905, TOP + 0.225], [0.905, TOP + 0.25], [0.86, TOP + 0.25], [0.82, TOP + 0.215], [0.0, TOP + 0.215],
  ]), aluMat);
  const bottom = new THREE.Mesh(lathe([
    [0, -TOP - 0.05], [0.74, -TOP - 0.06], [0.80, -TOP - 0.11], [0.86, -TOP - 0.11], [0.92, -TOP - 0.08], [0.975, -TOP - 0.035], [1, -TOP],
  ]), aluMat);
  group.add(shoulder, bottom);

  // Soft contact shadow (billboard)
  const sc = document.createElement('canvas'); sc.width = 256; sc.height = 64;
  const sx = sc.getContext('2d');
  const grd = sx.createRadialGradient(128, 32, 4, 128, 32, 120);
  grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(0.45, 'rgba(0,0,0,.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  sx.save(); sx.scale(1, 0.25); sx.fillStyle = grd; sx.fillRect(0, 0, 256, 256); sx.restore();
  const shadowTex = new THREE.CanvasTexture(sc);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.4 }));
  scene.add(shadow);

  // ---- textures ----
  const loader = new THREE.TextureLoader();
  const textures = {};
  let ready = false;
  const readyPromise = Promise.all(FLAVORS.map(f => new Promise((res) => {
    loader.load(`/img/label-${f}.jpg`, (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.wrapS = THREE.RepeatWrapping;
      textures[f] = t; res();
    }, undefined, () => res());
  }))).then(() => {
    ready = true;
    labelMat.map = textures[FLAVORS[0]];
    labelMat.needsUpdate = true;
  });

  // ---- state ----
  const POSE_DEFAULTS = { nx: 0, ny: -0.04, scale: 0, rotY: 0, tiltX: 0, tiltZ: 0, float: 1, shadow: 1 };
  const POSE_KEYS = Object.keys(POSE_DEFAULTS);
  const pose = { ...POSE_DEFAULTS };
  // additive topic layer (Inside section): blended by topicMix so travels can fade it in/out without fighting tweens
  const topic = { rotY: 0, tiltX: 0, dy: 0, mix: 0 };
  const state = { spin: 0, sway: 0.11, scrollSpin: 0 };
  const TAU = Math.PI * 2;
  const CAN_H = BODY + 0.25 + 0.11, CAN_W = 2 * R;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let flavor = 0;

  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  function setFlavor(i, { spin = true } = {}) {
    if (i === flavor) return;
    flavor = i;
    const f = FLAVORS[i];
    gsap.to(rim.color, { r: ((RIM[f] >> 16) & 255) / 255, g: ((RIM[f] >> 8) & 255) / 255, b: (RIM[f] & 255) / 255, duration: 0.9 });
    const swap = () => { if (textures[f]) { labelMat.map = textures[f]; labelMat.needsUpdate = true; } };
    if (!spin) { swap(); return; }
    let swapped = false;
    // always land on a full turn so the label faces the viewer, even if a swap interrupts a spin
    const target = (Math.floor(state.spin / TAU + 0.02) + 1) * TAU;
    gsap.to(state, {
      spin: target, duration: 1.0, ease: 'power2.inOut', overwrite: 'auto',
      onUpdate() { if (!swapped && this.progress() > 0.5) { swap(); swapped = true; } },
      onComplete() { if (!swapped) swap(); },
    });
  }

  function to(target, opts = {}) {
    return gsap.to(pose, { ...target, duration: opts.duration ?? 1.2, ease: opts.ease ?? 'power3.inOut', overwrite: opts.overwrite ?? 'auto', delay: opts.delay ?? 0 });
  }
  function set(target) { gsap.killTweensOf(pose); Object.assign(pose, target); }
  function kick() { /* scroll no longer rotates the can; the label must face the viewer */ }

  // ---- resize ----
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- frame ----
  let hidden = false, t0 = performance.now();
  function frame() {
    const t = (performance.now() - t0) / 1000;
    for (const k of POSE_KEYS) if (!Number.isFinite(pose[k])) { console.warn('can pose NaN', k); pose[k] = POSE_DEFAULTS[k]; }
    if (pose.scale < 0.003) {
      if (!hidden) { renderer.clear(); hidden = true; }
      return;
    }
    hidden = false;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const halfW = halfH * camera.aspect;
    mouse.x += (mouse.tx - mouse.x) * 0.05; mouse.y += (mouse.ty - mouse.y) * 0.05;

    // pose.scale = desired can height as a fraction of viewport height, capped at 26% of viewport width
    let s = (pose.scale * 2 * halfH) / CAN_H;
    s = Math.min(s, (0.26 * 2 * halfW) / CAN_W);
    group.position.x = pose.nx * halfW;
    group.position.y = (pose.ny + topic.dy * topic.mix) * halfH + Math.sin(t * 1.15) * 0.05 * s * pose.float;
    group.scale.setScalar(s);
    group.rotation.y = pose.rotY + topic.rotY * topic.mix + state.spin; // front-facing at rest; swaps always end on a full turn
    group.rotation.z = pose.tiltZ + mouse.x * -0.04 + Math.sin(t * 0.6) * 0.012;
    group.rotation.x = pose.tiltX + topic.tiltX * topic.mix + mouse.y * 0.035 + Math.sin(t * 0.9) * 0.01;

    shadow.position.set(group.position.x, group.position.y - 1.72 * s - Math.sin(t * 1.15) * 0.03, 0);
    shadow.scale.set(s, s, 1);
    shadow.material.opacity = 0.42 * pose.shadow * Math.min(1, s);
    renderer.render(scene, camera);
  }
  gsap.ticker.add(frame);

  return {
    pose, state, topic, setFlavor, to, set, kick,
    labelName() { return FLAVORS.find((f) => textures[f] === labelMat.map) || null; },
    get ready() { return ready; },
    readyPromise,
    dispose() { gsap.ticker.remove(frame); renderer.dispose(); },
  };
}
