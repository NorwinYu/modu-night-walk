/* 12-landmarks — the skyline that identifies Modu, modelled to its real
   proportions: Star Pearl (468 m), Modu Tower (632 m), YUNQUE (492 m),
   Jinyue (420.5 m), plus the far skyline, the Dawnlight media wall and the
   traffic on the Shenjiang. Glazed surfaces use the procedural facade shader. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, scene = G.scene, C = G.CITY;
  const U = G.util;
  const { R, RI, pick, clamp, lerp, M4, boxGeo, mergeGeoms } = U;
  const add = C.add;
  const LM = (window.__OSM && window.__OSM.lm) || {};
  const lm = (k, fx, fz) => (LM[k] ? [LM[k].cx, LM[k].cz] : [fx, fz]);
  const TAU = Math.PI * 2;

  function tag(m, name) {
    m.name = name; m.userData.passable = true; m.userData.surfaceProcedural = true; m.receiveShadow = true;
    scene.add(m); return m;
  }
  const merged = (list, mat, name, vc = false) => (list.length ? tag(new THREE.Mesh(mergeGeoms(list, { vertexColors: vc }), mat), name) : null);
  function place(geo, mat, x, y, z, name, ry = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.y = ry;
    return tag(m, name || 'landmark-part');
  }
  const std = (o) => { const m = new THREE.MeshStandardMaterial(o); m.userData.surfaceProcedural = true; return m; };
  const metalSilver = std({ color: 0x9aa1a8, roughness: 0.34, metalness: 0.85, envMapIntensity: 1.5 });
  const metalDark = std({ color: 0x23272d, roughness: 0.5, metalness: 0.6, envMapIntensity: 1.0, side: THREE.DoubleSide });
  const whiteGlow = std({ color: 0xdfeaff, emissive: 0xbfe0ff, emissiveIntensity: 2.6, roughness: 0.3 });
  const coolBand = std({ color: 0x1b2430, emissive: 0x8fc4ff, emissiveIntensity: 1.1, roughness: 0.35, metalness: 0.4 });
  const blueGlow = std({ color: 0x9fd8ff, emissive: 0x2f9aff, emissiveIntensity: 4.0, roughness: 0.3 });
  const goldGlow = std({ color: 0xffd9a0, emissive: 0xffb45e, emissiveIntensity: 2.6, roughness: 0.3 });
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.2, 0.15) });
  const beacons = [];
  const beacon = (x, y, z, r = 0.8) => beacons.push({ geometry: new THREE.SphereGeometry(r, 20, 14), matrix: M4(x, y, z) });

  // closed parametric skin: fn(i, j) -> [x, y, z, u, v]; seam normals are averaged
  function skinGeo(seg, rows, fn, skip) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= seg; i++) { const p = fn(i, j); pos.push(p[0], p[1], p[2]); uv.push(p[3], p[4]); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < seg; i++) {
      if (skip && skip(i, j)) continue;
      const a = j * (seg + 1) + i, b = a + 1, c = a + seg + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const n = g.attributes.normal;
    for (let j = 0; j <= rows; j++) {
      const a = j * (seg + 1), b = a + seg;
      const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b), l = Math.hypot(x, y, z) || 1;
      n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l);
    }
    g.computeBoundingSphere(); g.computeBoundingBox();
    return g;
  }
  // straight walls round a CCW polygon (x right, z up)
  function ring(gb, poly, y0, y1, v0, floors, bay, tint, seed, lit, kind, led, topV, wash) {
    const m = poly.length, ch = (y1 - y0) / floors;
    let u = RI(0, 20) * 12;
    for (let i = 0; i < m; i++) {
      const a = poly[i], c = poly[(i + 1) % m];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 0.2) continue;
      const bays = Math.max(1, Math.round(len / bay));
      gb.wall(a, c, y0, y1, u, u + bays, v0, v0 + floors, tint, [seed, lit, typeof kind === 'function' ? kind(i) : kind, led], [len / bays, ch, topV, wash]);
      u += Math.ceil(bays / 12) * 12 + 12;
    }
  }
  const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  function capGeo(poly, y) {
    const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], -p[1]))));
    g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
    return g;
  }
  function quadGeo(a, b, c, d) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
    g.computeVertexNormals();
    return g;
  }
  const FXG = { glass: new G.FacadeGB(), panel: new G.FacadeGB(), stone: new G.FacadeGB() };
  const WHITE = new THREE.Color(1, 1, 1);
  const darkParts = [], roofParts = [];

  // ================================================== 1. STAR PEARL TOWER
  (function pearl() {
    const [cx, cz] = lm('星珠塔', -412, -494);
    function sphereSkin() {
      const W = 1024, H = 512, c = document.createElement('canvas'), e = document.createElement('canvas');
      c.width = e.width = W; c.height = e.height = H;
      const ctx = c.getContext('2d'), ec = e.getContext('2d');
      const gr = ctx.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#26262a'); gr.addColorStop(0.5, '#4a4a50'); gr.addColorStop(1, '#202024');
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
      const eg = ec.createLinearGradient(0, 0, 0, H);
      eg.addColorStop(0, '#191919'); eg.addColorStop(0.5, '#3c3c3c'); eg.addColorStop(1, '#141414');
      ec.fillStyle = eg; ec.fillRect(0, 0, W, H);
      // triangulated steel lattice with an LED at every node
      const S = 32;
      for (const [k, x] of [[ctx, 'rgba(210,210,220,.5)'], [ec, 'rgba(190,190,190,.8)']]) {
        k.strokeStyle = x; k.lineWidth = 2; k.beginPath();
        for (let i = -H; i < W + H; i += S) { k.moveTo(i, 0); k.lineTo(i + H, H); k.moveTo(i, 0); k.lineTo(i - H, H); }
        for (let y = 0; y <= H; y += S / 2) { k.moveTo(0, y); k.lineTo(W, y); }
        k.stroke();
      }
      ec.fillStyle = '#ffffff';
      for (let y = 0; y <= H; y += S / 2) for (let x = (y / (S / 2)) % 2 ? S / 2 : 0; x <= W; x += S) ec.fillRect(x - 1.5, y - 1.5, 3, 3);
      // the observation deck is a ring of lit glass at the equator
      const y0 = H * 0.455, hh = H * 0.07;
      ctx.fillStyle = '#10141c'; ctx.fillRect(0, y0, W, hh);
      ec.fillStyle = '#000'; ec.fillRect(0, y0, W, hh);
      for (let x = 0; x < W; x += 16) { ec.fillStyle = R() < 0.82 ? `rgba(255,${200 + RI(0, 40)},${150 + RI(0, 50)},1)` : '#221812'; ec.fillRect(x + 2, y0 + 3, 12, hh - 6); }
      const t1 = new THREE.CanvasTexture(c), t2 = new THREE.CanvasTexture(e);
      for (const t of [t1, t2]) { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 8; }
      return std({ map: t1, emissiveMap: t2, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.24, metalness: 0.5, envMapIntensity: 1.5 });
    }
    const sphereMat = sphereSkin();
    const columnMat = std({ color: 0xc4c8d2, roughness: 0.5, metalness: 0.25, emissive: 0x7a4aa0, emissiveIntensity: 0.3, envMapIntensity: 1.2 });
    const pinkGlow = std({ color: 0xffc0d8, emissive: 0xff3f8a, emissiveIntensity: 3.2, roughness: 0.3 });
    const lawn = std({ color: 0x24402a, roughness: 0.95, metalness: 0 });
    tag(new THREE.Mesh(new THREE.CylinderGeometry(56, 58, 0.5, 64), lawn), 'pearl-lawn').position.set(cx, 0.2, cz);
    // base pavilion: a glazed drum under the legs
    const drum = new THREE.CylinderGeometry(38, 40, 10, 96, 1, true);
    { const uv = drum.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 84, uv.getY(i) * 2); }
    G.fxAttrs(drum, { seed: 0.61, lit: 1.3, kind: 1, bay: 2.9, fh: 5, top: 2, tint: new THREE.Color(0.95, 0.92, 0.9) });
    tag(new THREE.Mesh(drum, M.fx.panel), 'pearl-pavilion').position.set(cx, 5, cz);
    roofParts.push({ geometry: new THREE.CylinderGeometry(38.4, 38.4, 0.6, 64), matrix: M4(cx, 10.3, cz) });
    const col = [], sph = [], glow = [];
    const ANG = [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + 2 * TAU / 3];
    for (const a of ANG) {
      // vertical column, ground to the upper sphere
      col.push({ geometry: new THREE.CylinderGeometry(4.5, 4.5, 286, 28), matrix: M4(cx + Math.cos(a) * 11, 143, cz + Math.sin(a) * 11) });
      // raking strut at 60 degrees, with a small sphere where it meets the ground
      const A = new THREE.Vector3(cx + Math.cos(a) * 48, 0, cz + Math.sin(a) * 48), B = new THREE.Vector3(cx + Math.cos(a) * 11, 66, cz + Math.sin(a) * 11);
      const dir = B.clone().sub(A), len = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      col.push({ geometry: new THREE.CylinderGeometry(3.4, 3.4, len, 24), matrix: new THREE.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)) });
      sph.push({ geometry: new THREE.SphereGeometry(5.5, 32, 20), matrix: M4(A.x, 5.5, A.z) });
    }
    // lower sphere (50 m), five hotel spheres, upper sphere (45 m), space module
    sph.push({ geometry: new THREE.SphereGeometry(25, 64, 40), matrix: M4(cx, 93, cz) });
    for (const y of [136, 161, 186, 211, 236]) {
      sph.push({ geometry: new THREE.SphereGeometry(6.2, 32, 20), matrix: M4(cx, y, cz) });
      const t = new THREE.TorusGeometry(15.6, 0.5, 12, 48); t.rotateX(Math.PI / 2);
      col.push({ geometry: t, matrix: M4(cx, y - 12, cz) });
    }
    sph.push({ geometry: new THREE.SphereGeometry(22.5, 64, 40), matrix: M4(cx, 272, cz) });
    col.push({ geometry: new THREE.CylinderGeometry(3.6, 4.6, 44, 28), matrix: M4(cx, 314, cz) });
    sph.push({ geometry: new THREE.SphereGeometry(8, 40, 24), matrix: M4(cx, 342, cz) });
    // stepped antenna mast with service platforms
    for (const [r0, r1, ya, yb] of [[1.6, 2.4, 349, 392], [1.0, 1.5, 392, 432], [0.35, 0.9, 432, 468]]) {
      col.push({ geometry: new THREE.CylinderGeometry(r0, r1, yb - ya, 20), matrix: M4(cx, (ya + yb) / 2, cz) });
      col.push({ geometry: new THREE.CylinderGeometry(r1 + 1.3, r1 + 1.3, 0.5, 24), matrix: M4(cx, ya + 0.3, cz) });
    }
    for (const [y, r] of [[93, 25.25], [272, 22.75], [342, 8.2]]) {
      const t = new THREE.TorusGeometry(r, 0.3, 12, 96); t.rotateX(Math.PI / 2);
      glow.push({ geometry: t, matrix: M4(cx, y + r * 0.42, cz, 0, 0, 0, 0.908, 1, 0.908) });
      glow.push({ geometry: t, matrix: M4(cx, y - r * 0.42, cz, 0, 0, 0, 0.908, 1, 0.908) });
    }
    merged(col, columnMat, 'pearl-columns');
    merged(sph, sphereMat, 'pearl-spheres');
    merged(glow, pinkGlow, 'pearl-ring-lights');
    beacon(cx, 469, cz, 1.0);
    // the lower sphere throws its colour onto the plaza
    const lamp = place(new THREE.SphereGeometry(0.5, 16, 12), pinkGlow, cx, 93, cz, 'pearl-sphere-core');
    const pl = new THREE.PointLight(0xff5a8a, 260, 220, 2);
    pl.position.copy(lamp.position); scene.add(pl);
    // ---- light programmes: the sphere lattice is lit in neutral grey and coloured in
    // the shader, so the whole tower can cycle looks without new textures or lights.
    const PU = { uPT: { value: 0 }, uPA: { value: 0 }, uPB: { value: 0 }, uPMix: { value: 0 }, uPC: { value: new THREE.Vector2(cx, cz) } };
    sphereMat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, PU);
      s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPW;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vPW;
uniform float uPT, uPA, uPB, uPMix;
uniform vec2 uPC;
vec3 pHue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
float pHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 pearlCol(float m, vec2 uv) {
  float y = vPW.y, a = atan(vPW.z - uPC.y, vPW.x - uPC.x);
  vec2 cell = floor(uv * vec2(32.0, 32.0));
  if (m < 0.5) return vec3(1.0, 0.26, 0.55) * (0.85 + 0.2 * sin(uPT * 1.2));
  if (m < 1.5) return mix(vec3(0.12, 0.45, 1.8), vec3(0.35, 1.35, 1.7), 0.5 + 0.5 * sin(y * 0.022 - uPT * 0.7));
  if (m < 2.5) return vec3(1.45, 0.88, 0.4) + step(0.94, pHash(cell + floor(uPT * 2.5))) * vec3(1.4, 1.2, 0.9);
  if (m < 3.5) return pHue(a / 6.2832 + uPT * 0.07 + y * 0.0012) * 1.45;
  if (m < 4.5) return mix(vec3(0.05, 0.22, 0.5), vec3(1.6, 1.6, 1.8), smoothstep(0.55, 1.0, sin(y * 0.055 - uPT * 2.6)));
  return mix(vec3(0.12, 0.16, 0.6), vec3(1.9, 1.9, 2.1), step(0.86, pHash(cell + floor(uPT * 5.0))));
}`).replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
  vec4 emissiveColor = texture2D(emissiveMap, vEmissiveMapUv);
  float pWarm = step(0.472, vEmissiveMapUv.y) * step(vEmissiveMapUv.y, 0.548);
  vec3 pDyn = mix(pearlCol(uPA, vEmissiveMapUv), pearlCol(uPB, vEmissiveMapUv), uPMix);
  totalEmissiveRadiance *= mix(emissiveColor.rgb * pDyn, emissiveColor.rgb, pWarm);
#endif`);
    };
    const PCOL = [0xff3f8a, 0x3fb6ff, 0xffb45e, null, 0x9fd6ff, 0x5a74ff].map((h) => (h === null ? null : new THREE.Color(h)));
    const colA = new THREE.Color(), colB = new THREE.Color(), colM = new THREE.Color();
    const progCol = (m, t, out) => (PCOL[m] ? out.copy(PCOL[m]) : out.setHSL((t * 0.07) % 1, 0.9, 0.58));
    const colBase = new THREE.Color(0x7a4aa0);
    G.PEARL_PROGRAMMES = ['经典粉', '冰蓝', '香槟金', '彩虹环', '上升波', '星光'];
    G.pearlFx = (t, show) => {
      const per = show ? 7 : 22, fade = show ? 1.2 : 3, n = PCOL.length;
      const k = t / per, a = Math.floor(k) % n, b = (a + 1) % n;
      const into = (k - Math.floor(k)) * per, f = Math.min(1, Math.max(0, (into - (per - fade)) / fade));
      const mix = f * f * (3 - 2 * f);
      PU.uPT.value = t * (show ? 1.8 : 1); PU.uPA.value = a; PU.uPB.value = b; PU.uPMix.value = mix;
      colM.lerpColors(progCol(a, t, colA), progCol(b, t, colB), mix);
      pinkGlow.emissive.copy(colM); pl.color.copy(colM);
      pinkGlow.emissiveIntensity = show ? 4.2 : 3.2;
      columnMat.emissive.copy(colBase).lerp(colM, 0.55);
      return a;
    };    C.landmarks.pearl = { x: cx, z: cz, h: 468 };
    // the glazed drum is round: slice its real footprint instead of a square that pokes out at the diagonals
    { const ring = []; for (let i = 0; i < 48; i++) { const t = (i / 48) * TAU; ring.push([cx + Math.cos(t) * 39.6, cz + Math.sin(t) * 39.6]); } C.addFootprint(ring, 30, 'pearl'); }
    for (const a of ANG) {
      const x = cx + Math.cos(a) * 47.4, z = cz + Math.sin(a) * 47.4;
      add({ x0: x - 3.6, x1: x + 3.6, z0: z - 3.6, z1: z + 3.6, y0: 0, y1: 12, kind: 'pearl-legs' });
    }
  })();

  // ================================================== 2. MODU TOWER
  (function moduTower() {
    const [cx, cz] = lm('魔都中心大厦', 168, 209); const H = 632;
    const TWIST = 2.094, FH = 4.5, BAYS = 168;
    // rounded triangle that turns 120 degrees on the way up, with the V notch riding one corner
    const radius = (a, y) => {
      const t = clamp(y / H, 0, 1), tw = TWIST * t;
      const rad = lerp(42, 20.5, Math.pow(t, 0.85));
      const lobe = 1 + 0.15 * Math.cos(3 * (a - tw));
      const da = ((a - tw + Math.PI * 3) % TAU) - Math.PI;
      return rad * lobe * (1 - 0.2 * Math.exp(-Math.pow(da / 0.13, 2)));
    };
    // the crown is an open parapet that climbs once round the plan and breaks at the notch
    const topY = (a) => { const rel = (((a - TWIST - 0.2) % TAU) + TAU) % TAU / TAU; return H - 54 * rel; };
    const SEG = 168, ROWS = 110;
    // the lobby entrance: a 6 m portal through the north face of the base, lined up with the lobby on x = 168
    const EX0 = 165, EX1 = 171, skinZ = cz - radius(1.5 * Math.PI, 0);
    const eA0 = 1.5 * Math.PI + Math.asin((EX0 - cx) / (cz - skinZ)), eA1 = 1.5 * Math.PI + Math.asin((EX1 - cx) / (cz - skinZ));
    const ei0 = Math.floor(eA0 / TAU * SEG), ei1 = Math.ceil(eA1 / TAU * SEG);
    const g = skinGeo(SEG, ROWS, (i, j) => {
      const a = i / SEG * TAU, y = (j / ROWS) * topY(a), r = radius(a, y);
      return [Math.cos(a) * r, y, Math.sin(a) * r, i / SEG * BAYS, y / FH];
    }, (i, j) => j === 0 && i >= ei0 && i < ei1);
    G.fxAttrs(g, { seed: 0.37, lit: 0.85, led: 0.6, bay: 1.35, fh: FH, top: 1e4, tint: new THREE.Color(0.8, 0.9, 1.0) });
    tag(new THREE.Mesh(g, M.fx.glass), 'modu-tower').position.set(cx, 0, cz);
    // inside of the open crown, and the roof it hides
    const inner = skinGeo(96, 4, (i, j) => {
      const a = i / 96 * TAU, y = lerp(572, topY(a), j / 4), r = radius(a, y) * 0.965;
      return [Math.cos(a) * r, y, Math.sin(a) * r, 0, 0];
    });
    darkParts.push({ geometry: inner, matrix: M4(cx, 0, cz) });
    darkParts.push({ geometry: new THREE.CylinderGeometry(22, 22, 1, 48), matrix: M4(cx, 574, cz) });
    darkParts.push({ geometry: new THREE.CylinderGeometry(9, 9, 22, 32), matrix: M4(cx, 586, cz) });
    // eight mechanical floors divide the nine zones; each reads as a band of light
    const bands = [];
    for (let k = 1; k <= 8; k++) {
      const yb = k / 9 * 578;
      bands.push({ geometry: skinGeo(120, 1, (i, j) => { const a = i / 120 * TAU, y = yb + j * 5.2, r = radius(a, y) * 1.008; return [Math.cos(a) * r, y, Math.sin(a) * r, i / 6, j]; }), matrix: M4(cx, 0, cz) });
    }
    merged(bands, coolBand, 'modu-zone-bands');
    const rim = skinGeo(168, 1, (i, j) => { const a = i / 168 * TAU, y = topY(a) - 2.4 + j * 2.6, r = radius(a, y) * 1.012; return [Math.cos(a) * r, y, Math.sin(a) * r, i / 6, j]; });
    tag(new THREE.Mesh(rim, whiteGlow), 'modu-crown-rim').position.set(cx, 0, cz);
    beacon(cx + Math.cos(TWIST + 0.2) * 20, H + 1.5, cz + Math.sin(TWIST + 0.2) * 20, 0.9);
    // retail podium
    const px0 = cx - 63, px1 = cx + 55, pz0 = cz - 39, pz1 = cz + 47;
    // the shopfront storey folds in along the entrance passage, so the passage is lined with lit glass
    const LZ = 191;
    ring(FXG.glass, [[px0, pz0], [EX0, pz0], [EX0, LZ], [EX1, LZ], [EX1, pz0], [px1, pz0], [px1, pz1], [px0, pz1]], 0, 6, 0, 1, 3.1, WHITE, 0.22, 1.2, 1, 0, 8, 0);
    ring(FXG.glass, rect(px0, pz0, px1, pz1), 6, 34, 1, 6, 1.6, WHITE, 0.22, 1.3, 0, 0.6, 7, 0);
    roofParts.push({ geometry: boxGeo(px1 - px0 + 0.8, 1.2, pz1 - pz0 + 0.8, 8, 8), matrix: M4((px0 + px1) / 2, 34.6, (pz0 + pz1) / 2) });
    add({ x0: cx - 26, x1: cx + 26, z0: cz - 26, z1: cz + 26, y0: 0, y1: H, kind: 'modu-tower' });
    add({ x0: px0, x1: px1, z0: pz0, z1: pz1, y0: 0, y1: 35, kind: 'modu-podium' });
    C.landmarks.modu = { x: cx, z: cz, h: H };
    const holeX = (i) => cx + Math.cos(i / SEG * TAU) * radius(i / SEG * TAU, 0);
    C.towerEntry = { x0: EX0, x1: EX1, skinZ, podiumZ: pz0, lobbyZ: LZ, h: (1 / ROWS) * topY(1.5 * Math.PI), holeX0: holeX(ei0), holeX1: holeX(ei1) };
  })();

  // ================================================== 3. YUNQUE (the bottle opener)
  (function yunque() {
    const [cx, cz] = lm('云阙金融中心', 337, 103); const H = 492;
    // square plan, two opposite corners shaved by a 3 km arc until only a blade is left at the top
    const HD = 41, RC = 3084, BAY = 1.5, FH = 4.2, Y0 = 427, Y1 = 470;
    const UA = [-0.661, 0.751], WA = [-0.751, -0.661];   // blade axis, aperture axis
    const dOf = (y) => HD - (RC - Math.sqrt(RC * RC - y * y));
    const hwOf = (y) => lerp(17, 25, clamp((y - Y0) / (Y1 - Y0), 0, 1));
    const P = (u, w, y) => [cx + u * UA[0] + w * WA[0], y, cz + u * UA[1] + w * WA[1]];
    const hex = (y) => { const d = dOf(y), e = HD - d; return [[HD, 0], [e, d], [-e, d], [-HD, 0], [-e, -d], [e, -d]]; };
    const pierL = (y) => { const d = dOf(y), e = HD - d, h = hwOf(y); return [[-e, d], [-HD, 0], [-e, -d], [-h, -d], [-h, d]]; };
    const pierR = (y) => { const d = dOf(y), e = HD - d, h = hwOf(y); return [[e, -d], [HD, 0], [e, d], [h, d], [h, -d]]; };
    const tint = new THREE.Color(0.78, 0.88, 1.0);
    // one storey-band of a prism; refs[i] anchors face i so mullions stay vertical as the face changes width
    function section(polyOf, ya, yb, refs, kinds) {
      const A = polyOf(ya), B = polyOf(yb), m = A.length;
      for (let i = 0; i < m; i++) {
        const k = (i + 1) % m;
        let dx = B[k][0] - B[i][0], dz = B[k][1] - B[i][1];
        const len = Math.hypot(dx, dz);
        if (len < 0.05) continue;
        dx /= len; dz /= len;
        const cu = (p) => ((p[0] - refs[i][0]) * dx + (p[1] - refs[i][1]) * dz) / BAY;
        FXG.glass.quad(P(A[i][0], A[i][1], ya), P(A[k][0], A[k][1], ya), P(B[k][0], B[k][1], yb), P(B[i][0], B[i][1], yb),
          [[cu(A[i]), ya / FH], [cu(A[k]), ya / FH], [cu(B[k]), yb / FH], [cu(B[i]), yb / FH]], tint, [0.71, 0.8, kinds ? kinds[i] : 0, 0], [BAY, FH, 1e4, 0]);
      }
    }
    const O = [0, 0], E = [HD, 0], Wc = [-HD, 0];
    const ys = []; for (let y = 0; y < Y0; y += Y0 / 16) ys.push(y); ys.push(Y0);
    for (let i = 0; i + 1 < ys.length; i++) section(hex, ys[i], ys[i + 1], [E, O, Wc, Wc, O, E]);
    for (const [ya, yb] of [[Y0, 441], [441, 456], [456, Y1]]) {
      section(pierL, ya, yb, [Wc, Wc, O, O, O], [0, 0, 0, 3, 0]);
      section(pierR, ya, yb, [E, E, O, O, O], [0, 0, 0, 3, 0]);
    }
    section(hex, Y1, 481, [E, O, Wc, Wc, O, E]); section(hex, 481, H, [E, O, Wc, Wc, O, E]);
    // sill and soffit of the aperture, and the roof slab
    for (const [y, up] of [[Y0, 1], [Y1, -1]]) {
      const d = dOf(y), h = hwOf(y);
      darkParts.push({ geometry: quadGeo(P(-h, -d, y), P(h, -d, y), P(h, d, y), P(-h, d, y)) }); void up;
    }
    { const d = dOf(H), e = HD - d; darkParts.push({ geometry: quadGeo(P(-e, -d, H), P(e, -d, H), P(e, d, H), P(-e, d, H)) }); }
    // light lines round the aperture on both faces, and along the blade edge
    const lines = [];
    const tube = (a, b, r = 0.3) => {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      lines.push({ geometry: new THREE.CylinderGeometry(r, r, len, 8), matrix: new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)) });
    };
    for (const s of [-1, 1]) {
      const d0 = dOf(Y0) + 0.25, d1 = dOf(Y1) + 0.25;
      tube(P(-17, s * d0, Y0), P(17, s * d0, Y0)); tube(P(-25, s * d1, Y1), P(25, s * d1, Y1));
      tube(P(-17, s * d0, Y0), P(-25, s * d1, Y1)); tube(P(17, s * d0, Y0), P(25, s * d1, Y1));
    }
    tube(P(-HD + 1.5, 0, H + 0.3), P(HD - 1.5, 0, H + 0.3), 0.36);
    merged(lines, blueGlow, 'yunque-aperture-lights');
    beacon(...P(-HD + 2, 0, H + 1.6), 0.7); beacon(...P(HD - 2, 0, H + 1.6), 0.7);
    C.addFootprint(hex(0).map((p) => { const q = P(p[0], p[1], 0); return [q[0], q[2]]; }).filter((p, i, arr) => i === 0 || Math.hypot(p[0] - arr[i - 1][0], p[1] - arr[i - 1][1]) > 0.5), H, 'yunque');
    C.landmarks.yunque = { x: cx, z: cz, h: H };
  })();

  // ================================================== 4. JINYUE
  (function jinYue() {
    const [cx, cz] = lm('金岳大厦', 183, 28);
    const tint = new THREE.Color(1.0, 0.95, 0.86);
    // square plan with re-entrant corners; thirteen pagoda tiers that shorten by an eighth each time
    const plan = (a) => { const n = a * 0.2, b = a - n; return [[-b, -a], [b, -a], [b, -b], [a, -b], [a, b], [b, b], [b, a], [-b, a], [-b, b], [-a, b], [-a, -b], [-b, -b]].map((p) => [cx + p[0], cz + p[1]]); };
    const eaves = [], gold = [];
    const lip = (a, y, k = 1) => {
      const poly = plan(a + 0.8);
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const m = M4((p[0] + q[0]) / 2, y, (p[1] + q[1]) / 2, -Math.atan2(q[1] - p[1], q[0] - p[0]));
        eaves.push({ geometry: boxGeo(len + 0.5, 0.55, 0.9, 4, 1), matrix: m });
        gold.push({ geometry: boxGeo(len + 0.5, 0.16 * k, 0.16 * k, 4, 1), matrix: M4((p[0] + q[0]) / 2, y + 0.42, (p[1] + q[1]) / 2, -Math.atan2(q[1] - p[1], q[0] - p[0])) });
      }
    };
    let y = 0, v = 0, a = 26.5;
    const tiers = [61, 53, 46, 38, 30, 27, 23, 19, 15, 11.4, 9.5, 7.6].map((h) => [h, 1.05, 1.0])
      .concat([[11, 2.6, 1.7], [10, 3.0, 1.8], [9, 2.5, 1.9], [9, 2.2, 2.0]]);
    tiers.forEach(([h, step, lit], i) => {
      const floors = Math.max(1, Math.round(h / 3.9)), poly = plan(a);
      ring(FXG.panel, poly, y, y + h, v, floors, 2.3, tint, 0.53, lit, 0, 0.2, v + floors, 0);
      y += h; v += floors;
      roofParts.push({ geometry: capGeo(poly, y) });
      lip(a, y, i >= 12 ? 1.6 : 1);
      a -= step;
    });
    merged(eaves, metalSilver, 'jinyue-eaves');
    merged(gold, goldGlow, 'jinyue-eave-lights');
    place(new THREE.CylinderGeometry(0.3, 3.0, 40.5, 16), metalSilver, cx, y + 20.25, cz, 'jinyue-spire');
    beacon(cx, y + 41.2, cz, 0.7);
    // podium
    const px0 = cx - 39, px1 = cx + 35, pz0 = cz - 31, pz1 = cz + 35;
    ring(FXG.stone, rect(px0, pz0, px1, pz1), 0, 5.4, 0, 1, 3.1, tint, 0.41, 1.2, 1, 0, 5, 0.4);
    ring(FXG.stone, rect(px0, pz0, px1, pz1), 5.4, 18, 1, 3, 3.2, tint, 0.41, 1.2, 0, 0, 4, 0.4);
    roofParts.push({ geometry: boxGeo(px1 - px0 + 0.8, 1.0, pz1 - pz0 + 0.8, 8, 8), matrix: M4((px0 + px1) / 2, 18.5, (pz0 + pz1) / 2) });
    add({ x0: cx - 27.3, x1: cx + 27.3, z0: cz - 27.3, z1: cz + 27.3, y0: 0, y1: 340, kind: 'jinyue' });
    add({ x0: px0, x1: px1, z0: pz0, z1: pz1, y0: 0, y1: 18, kind: 'jinyue-podium' });
    C.landmarks.jinyue = { x: cx, z: cz, h: 421 };
  })();

  // ================================================== 5. THE OTHER SKYLINE BLOCKS
  // Twin towers + mall podium + glass pavilion, the gold media tower and the riverside mall.
  // Their OSM footprints carry the skip flag, so the city pass leaves them to this section.
  const OSMB = (window.__OSM && window.__OSM.b) || [];
  function osmPoly(name) {
    const a = OSMB.find((r) => r[r.length - 3] === name); if (!a) return null;
    const p = []; for (let i = 0; i + 1 < a.length - 5; i += 2) p.push([a[i], a[i + 1]]);
    let s = 0; for (let i = 0; i < p.length; i++) { const q = p[i], r = p[(i + 1) % p.length]; s += q[0] * r[1] - r[0] * q[1]; }
    return s < 0 ? p.reverse() : p;   // positive shoelace order puts the wall normal outside (same as rect)
  }
  const centroidOf = (p) => { let x = 0, z = 0; for (const q of p) { x += q[0]; z += q[1]; } return [x / p.length, z / p.length]; };
  const edgeN = (a, c) => { const l = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1; return [(c[1] - a[1]) / l, -(c[0] - a[0]) / l, l]; };
  // every vertex moves d metres inward along its corner bisector (negative d grows the outline)
  function inset(poly, d) {
    const n = poly.length;
    return poly.map((q, i) => {
      const p = poly[(i + n - 1) % n], r = poly[(i + 1) % n];
      let ax = q[0] - p[0], az = q[1] - p[1]; const la = Math.hypot(ax, az) || 1; ax /= la; az /= la;
      let bx = r[0] - q[0], bz = r[1] - q[1]; const lb = Math.hypot(bx, bz) || 1; bx /= lb; bz /= lb;
      let mx = -az - bz, mz = ax + bx; const lm2 = Math.hypot(mx, mz) || 1; mx /= lm2; mz /= lm2;
      const k = d / Math.max(0.35, mx * -az + mz * ax);
      return [q[0] + mx * k, q[1] + mz * k];
    });
  }
  // a storey band between two outlines with matching vertices; walls lean in when the upper one is smaller
  function band(gb, A, B, ya, yb, bay, fh, tint, bld, yTop) {
    const n = A.length; let u = 0;
    for (let i = 0; i < n; i++) {
      const k = (i + 1) % n, len = Math.hypot(A[k][0] - A[i][0], A[k][1] - A[i][1]);
      if (len < 0.1) continue;
      const yI = yTop ? yTop(B[i]) : yb, yK = yTop ? yTop(B[k]) : yb, u1 = u + len / bay;
      gb.quad([A[i][0], ya, A[i][1]], [A[k][0], ya, A[k][1]], [B[k][0], yK, B[k][1]], [B[i][0], yI, B[i][1]],
        [[u, ya / fh], [u1, ya / fh], [u1, yK / fh], [u, yI / fh]], tint, bld, [bay, fh, 1e4, 0]);
      u = Math.ceil(u1) + 6;
    }
  }
  function tubeTo(list, a, b, r) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    if (len < 0.05) return;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    list.push({ geometry: new THREE.CylinderGeometry(r, r, len, 6, 1, true), matrix: new THREE.Matrix4().compose(A.add(B).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)) });
  }
  const circle = (cx, cz, r, n = 24) => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * TAU) * r, cz + Math.sin(i / n * TAU) * r]);
  const whiteLines = [], goldLines = [], steelParts = [];

  function ledTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 512;
    const ctx = c.getContext('2d');
    const gr = ctx.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#ff2fbe'); gr.addColorStop(0.35, '#6d1e6e'); gr.addColorStop(0.68, '#1b2a5e'); gr.addColorStop(1, '#ff2fbe');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, 256, 512);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 22; i++) { ctx.fillStyle = i % 3 ? '#ff9fe0' : '#7de8ff'; ctx.fillRect(0, i * 24 + Math.sin(i) * 6, 256, 3 + (i % 4)); }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(8,6,18,.72)'; ctx.fillRect(18, 168, 220, 176);
    ctx.strokeStyle = '#ff6fd6'; ctx.lineWidth = 3; ctx.strokeRect(18, 168, 220, 176);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 74px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.fillText('夜魔都', 128, 232);
    ctx.font = '600 19px "SF Mono",monospace'; ctx.fillStyle = '#8fe8ff';
    ctx.fillText('I ♥ MODU', 128, 292);
    ctx.font = '500 13px "SF Mono",monospace'; ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('LINJIANGZUI AFTER RAIN', 128, 318);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }
  const ledMat = (tex, k = 1.7) => std({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: k, color: 0x333333, roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide });
  // an LED skin that follows a run of facade edges (chain of [x,z] points, already pushed off the wall)
  function ledSkin(chain, y0, y1, tex, name) {
    const acc = [0]; for (let i = 1; i < chain.length; i++) acc.push(acc[i - 1] + Math.hypot(chain[i][0] - chain[i - 1][0], chain[i][1] - chain[i - 1][1]));
    const L = acc[acc.length - 1], pos = [], uv = [], idx = [];
    chain.forEach((p, i) => { pos.push(p[0], y0, p[1], p[0], y1, p[1]); uv.push(1 - acc[i] / L, 0, 1 - acc[i] / L, 1); });
    for (let i = 0; i + 1 < chain.length; i++) { const a = 2 * i; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    const m = tag(new THREE.Mesh(g, ledMat(tex)), name);
    (G.ledScreens = G.ledScreens || []).push({ mesh: m, tex, base: 1.7 });
    return m;
  }

  // ---- 臻金中心: two near-identical towers (249.9 m / 259.9 m) on a six-storey mall
  const ZJ = new THREE.Color(0.84, 0.9, 0.98);
  function zhenjinTower(name, H, seed) {
    const P = osmPoly(name); if (!P) return null;
    const FH = 4.3, y1 = H - 36, y2 = H - 24, floors = Math.round(y1 / FH);
    ring(FXG.glass, P, 0, y1, 0, floors, 1.5, ZJ, seed, 0.95, 2, 0, floors, 0);
    // a lit two-storey setback, then the crown: sloping glass planes that lean in to a lit roof frame
    const P1 = inset(P, 1.6), P3 = inset(P, 8);
    band(FXG.glass, P1, P1, y1, y2, 1.5, FH, ZJ, [seed, 1.35, 0, 0]);
    band(FXG.glass, P1, P3, y2, H, 1.5, FH, ZJ, [seed + 0.1, 0.55, 0, 0]);
    roofParts.push({ geometry: capGeo(P, y1) }); roofParts.push({ geometry: capGeo(P3, H) });
    for (let i = 0; i < P.length; i++) {
      const k = (i + 1) % P.length;
      tubeTo(whiteLines, [P3[i][0], H + 0.2, P3[i][1]], [P3[k][0], H + 0.2, P3[k][1]], 0.34);
      // corner ribs run on past the roof frame, so the crown reads as an open claw at night
      const ex = (t) => [P1[i][0] + (P3[i][0] - P1[i][0]) * t, y2 + (H - y2) * t, P1[i][1] + (P3[i][1] - P1[i][1]) * t];
      tubeTo(whiteLines, ex(0), ex(1.4), 0.26);
      tubeTo(whiteLines, [P1[i][0], y2 + 0.1, P1[i][1]], [P1[k][0], y2 + 0.1, P1[k][1]], 0.2);
    }
    const c = centroidOf(P);
    steelParts.push({ geometry: new THREE.CylinderGeometry(0.25, 0.6, 9, 8), matrix: M4(c[0], H + 4.5, c[1]) });
    beacon(c[0], H + 9.4, c[1], 0.7);
    C.addFootprint(P, H, 'zhenjin-tower');
    return P;
  }
  (function zhenjin() {
    const T1 = zhenjinTower('臻金中心一期', 249.9, 0.61), T2 = zhenjinTower('臻金中心二期', 259.9, 0.66);
    const MP = osmPoly('臻金中心商场');
    if (MP) {
      const TV = [...(T1 || []), ...(T2 || [])];
      const onTower = (p) => TV.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.8);
      const stoneT = new THREE.Color(0.93, 0.9, 0.86);
      let u = 0;
      for (let i = 0; i < MP.length; i++) {
        const a = MP[i], c = MP[(i + 1) % MP.length];
        if (onTower(a) && onTower(c)) continue;   // that edge is a tower face, which already runs to the ground
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]); if (len < 0.3) continue;
        const bays = Math.max(1, Math.round(len / 3.4));
        FXG.glass.wall(a, c, 0, 6.8, u, u + bays, 0, 1, ZJ, [0.27, 1.3, 1, 0], [len / bays, 6.8, 1, 0]);
        FXG.stone.wall(a, c, 6.8, 24.8, u, u + bays, 1, 6, stoneT, [0.27, 0.5, 0, 0], [len / bays, 3.6, 6, 0.55]);
        u += bays + 12;
      }
      roofParts.push({ geometry: capGeo(MP, 24.8) });
      // a lit cornice that traces the podium roof
      for (let i = 0; i < MP.length; i++) { const a = MP[i], c = MP[(i + 1) % MP.length]; if (!(onTower(a) && onTower(c))) tubeTo(goldLines, [a[0], 24.9, a[1]], [c[0], 24.9, c[1]], 0.12); }
      C.addFootprint(MP, 24.8, 'zhenjin-mall');
    }
    // the glass pavilion in the forecourt: a 12.5 m glass drum over a spiral stair down to the shop floor
    const GP = osmPoly('臻金玻璃厅');
    if (GP) {
      const [x, z] = centroidOf(GP), r = 8.4, h = 12.5;
      const pane = std({ color: 0xd6ecff, roughness: 0.04, metalness: 0.1, transparent: true, opacity: 0.2, envMapIntensity: 2.2, side: THREE.DoubleSide, depthWrite: false });
      place(new THREE.CylinderGeometry(r, r, h, 64, 1, true), pane, x, h / 2, z, 'zhenjin-pavilion-glass').renderOrder = 3;
      steelParts.push({ geometry: new THREE.CylinderGeometry(r + 0.2, r + 0.2, 0.4, 64), matrix: M4(x, h + 0.2, z) });
      place(new THREE.CylinderGeometry(r - 0.25, r - 0.25, 0.08, 64), whiteGlow, x, h - 0.08, z, 'zhenjin-pavilion-ceiling');
      for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; steelParts.push({ geometry: boxGeo(0.03, h, 0.22, 1, 1), matrix: M4(x + Math.cos(a) * (r - 0.22), h / 2, z + Math.sin(a) * (r - 0.22), -a) }); }
      steelParts.push({ geometry: new THREE.CylinderGeometry(1.1, 1.1, h, 24, 1, true), matrix: M4(x, h / 2, z) });
      for (let k = 0; k < 30; k++) { const a = k / 30 * TAU * 1.25, y = 0.25 + k * 0.32; steelParts.push({ geometry: boxGeo(3.2, 0.12, 1.1, 1, 1), matrix: M4(x + Math.cos(a) * 2.8, y, z + Math.sin(a) * 2.8, -a) }); }
      C.addFootprint(circle(x, z, r), h, 'zhenjin-pavilion');
    }
    C.landmarks.zhenjin = T2 ? { x: centroidOf(T2)[0], z: centroidOf(T2)[1], h: 259.9 } : C.landmarks.zhenjin;
  })();

  // ---- 晨曦国际大楼 (185 m): gold glass, a crown cut by a plane that falls toward the river,
  // and an LED skin over the whole curved river face
  (function dawnlight() {
    const P = osmPoly('晨曦国际大楼'); if (!P) return;
    const H = 185, Y1 = 160, FH = 4.1, GOLD = new THREE.Color(1.0, 0.84, 0.6);
    let x0 = 1e9, x1 = -1e9; for (const p of P) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    const yTop = (p) => lerp(H - 17, H, (p[0] - x0) / (x1 - x0));
    const floors = Math.round(Y1 / FH);
    ring(FXG.glass, P, 0, Y1, 0, floors, 1.5, GOLD, 0.44, 0.9, 2, 0, floors, 0);
    const P1 = inset(P, 0.8);
    band(FXG.glass, P1, P1, Y1, H, 1.5, FH, GOLD, [0.47, 0.5, 0, 0], yTop);
    roofParts.push({ geometry: capGeo(P, Y1) });
    const cap = capGeo(P1, 0), cp = cap.attributes.position;
    for (let i = 0; i < cp.count; i++) cp.setY(i, yTop([cp.getX(i), cp.getZ(i)]) + 0.05);
    cap.computeVertexNormals(); roofParts.push({ geometry: cap });
    for (let i = 0; i < P1.length; i++) {
      const a = P1[i], c = P1[(i + 1) % P1.length];
      tubeTo(goldLines, [a[0], yTop(a) + 0.2, a[1]], [c[0], yTop(c) + 0.2, c[1]], 0.3);
      tubeTo(goldLines, [P[i][0], Y1 + 0.15, P[i][1]], [P[(i + 1) % P.length][0], Y1 + 0.15, P[(i + 1) % P.length][1]], 0.18);
    }
    let hi = P1[0]; for (const p of P1) if (p[0] > hi[0]) hi = p;
    beacon(hi[0], yTop(hi) + 1.2, hi[1], 0.7);
    // the river-facing run of edges, pushed 0.45 m off the glass
    const n = P.length, out = inset(P, -0.45), west = (i) => edgeN(P[i], P[(i + 1) % n])[0] < -0.3;
    let s = -1; for (let i = 0; i < n; i++) if (west(i) && !west((i + n - 1) % n)) { s = i; break; }
    if (s >= 0) {
      const chain = []; for (let k = 0; k < n && west((s + k) % n); k++) chain.push(out[(s + k) % n]);
      chain.push(out[(s + chain.length) % n]);
      ledSkin(chain, 24, 150, ledTexture(), 'dawnlight-media-wall');
    }
    C.addFootprint(P, H, 'dawnlight');
    const c = centroidOf(P); C.landmarks.dawnlight = { x: c[0], z: c[1], h: H };
  })();

  // ---- 明澜广场 (49.9 m, ten storeys): the riverside mall, glazed toward the water, blank and signed elsewhere
  (function minglan() {
    const P = osmPoly('明澜广场'); if (!P) return;
    const H = 49.9, Y1 = 44, n = P.length, T = new THREE.Color(0.95, 0.9, 0.84), SKY = new THREE.Color(0.86, 0.92, 1.0);
    const riverE = (i) => P[i][0] < -546 && P[(i + 1) % n][0] < -546;
    let u = 0, best = null, bestRiver = null;
    for (let i = 0; i < n; i++) {
      const a = P[i], c = P[(i + 1) % n], [nx, nz, len] = edgeN(a, c);
      if (len < 0.3) continue;
      const bays = Math.max(1, Math.round(len / 3.6));
      FXG.glass.wall(a, c, 0, 6.2, u, u + bays, 0, 1, T, [0.31, 1.35, 1, 0], [len / bays, 6.2, 1, 0]);
      if (riverE(i)) FXG.glass.wall(a, c, 6.2, Y1, u, u + bays * 2, 1, 9, SKY, [0.33, 1.05, 0, 0], [len / bays / 2, (Y1 - 6.2) / 8, 9, 0]);
      else FXG.panel.wall(a, c, 6.2, Y1, u, u + bays, 1, 9, T, [0.31, 0.1, 3, 0], [len / bays, (Y1 - 6.2) / 8, 9, 0.75]);
      u += bays * 2 + 12;
      if (!riverE(i) && (!best || len > best.len)) best = { a, c, nx, nz, len };
      if (nx < -0.4 && (!bestRiver || len > bestRiver.len)) bestRiver = { a, c, nx, nz, len };
    }
    const P1 = inset(P, 3.5);
    ring(FXG.glass, P1, Y1, H, 9, 1, 3.2, SKY, 0.35, 1.15, 0, 0.5, 10, 0);
    roofParts.push({ geometry: capGeo(P, Y1) }); roofParts.push({ geometry: capGeo(P1, H) });
    for (let i = 0; i < n; i++) { const a = P[i], c = P[(i + 1) % n]; tubeTo(goldLines, [a[0], Y1 + 0.1, a[1]], [c[0], Y1 + 0.1, c[1]], 0.14); }
    // rooftop name sign over the river face
    if (bestRiver || best) {
      const e = bestRiver || best, cv = document.createElement('canvas'); cv.width = 1024; cv.height = 256;
      const k = cv.getContext('2d'); k.textAlign = 'center'; k.textBaseline = 'middle';
      k.font = '900 190px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'; k.fillStyle = '#fff'; k.fillText('明澜广场', 512, 132);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const mx = (e.a[0] + e.c[0]) / 2 - e.nx * 2.5, mz = (e.a[1] + e.c[1]) / 2 - e.nz * 2.5;
      const sign = place(new THREE.PlaneGeometry(44, 11), new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(3.2, 0.55, 0.42), transparent: true, depthWrite: false, side: THREE.DoubleSide }), mx, H + 6.6, mz, 'minglan-roof-sign', Math.atan2(e.nx, e.nz));
      sign.renderOrder = 2;
      steelParts.push({ geometry: boxGeo(40, 1.2, 0.3, 4, 1), matrix: M4(mx - e.nx * 0.4, H + 0.6, mz - e.nz * 0.4, Math.atan2(e.nx, e.nz)) });
      for (const s2 of [-16, 0, 16]) steelParts.push({ geometry: boxGeo(0.3, 6, 0.3, 1, 1), matrix: M4(mx - e.nx * 0.4 + e.nz * s2, H + 3, mz - e.nz * 0.4 - e.nx * s2) });
    }
    // a static media panel on the longest street face
    if (best) {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 320;
      const k = cv.getContext('2d'), gr = k.createLinearGradient(0, 0, 512, 320);
      gr.addColorStop(0, '#ff7a3d'); gr.addColorStop(0.55, '#c2185b'); gr.addColorStop(1, '#3b1a6e'); k.fillStyle = gr; k.fillRect(0, 0, 512, 320);
      k.globalAlpha = 0.18; k.fillStyle = '#fff'; for (let i = 0; i < 14; i++) k.fillRect(0, i * 23, 512, 2); k.globalAlpha = 1;
      k.textAlign = 'center'; k.fillStyle = '#fff'; k.font = '800 92px "PingFang SC","Hiragino Sans GB",sans-serif'; k.fillText('雨夜集市', 256, 150);
      k.font = '600 26px "SF Mono",monospace'; k.fillStyle = '#ffe3c2'; k.fillText('MINGLAN NIGHT MARKET · L1–L3', 256, 212);
      k.font = '500 20px "SF Mono",monospace'; k.fillStyle = 'rgba(255,255,255,.75)'; k.fillText('OPEN TILL 22:00', 256, 252);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const e = best, mx = (e.a[0] + e.c[0]) / 2 + e.nx * 0.35, mz = (e.a[1] + e.c[1]) / 2 + e.nz * 0.35, w = Math.min(38, e.len * 0.5);
      place(new THREE.PlaneGeometry(w, w * 0.625), ledMat(tex, 1.5), mx, 27, mz, 'minglan-media-panel', Math.atan2(e.nx, e.nz));
    }
    C.addFootprint(P, H, 'minglan');
    const c = centroidOf(P); C.landmarks.minglan = { x: c[0], z: c[1], h: H };
  })();

  merged(whiteLines, whiteGlow, 'zhenjin-crown-lights');
  merged(goldLines, goldGlow, 'skyline-gold-lines');
  merged(steelParts, metalSilver, 'skyline-steel-parts');
  // ================================================== 6. PEARL RING (星珠环) + 明澜连廊
  // The elevated pedestrian ring over the Linjiangzui roundabout: a steel box girder
  // on round piers, glass balustrades, cool LED lines. Every walkable surface is
  // described in C.decks, so the game walks it without teleports.
  (function pearlRing() {
    const S = C.site.ring, cx = S.cx, cz = S.cz, y = S.y, RM = S.r;
    const r0 = RM - S.w / 2, r1 = RM + S.w / 2, GY = 0.17, D2R = Math.PI / 180;
    const steelL = [], railL = [], treadL = [];
    const acc = () => ({ p: [], n: [], u: [], c: [] });
    const A = { pave: acc(), steel: acc(), glass: acc(), led: acc(), wash: acc() };
    const COOL = [1.3, 2.4, 4.0], WARM = [3.2, 2.5, 1.7], GLOW = [0.34, 0.27, 0.18], Z3 = [0, 0, 0], W3 = [1, 1, 1];
    const decks = (C.decks = C.decks || []);
    function push(a, P, N, U, K) { a.p.push(P[0], P[1], P[2]); a.n.push(N[0], N[1], N[2]); a.u.push(U[0], U[1]); a.c.push(K[0], K[1], K[2]); }
    // flat quad pa-pb-pc-pd; winding fixed from the wanted normal; colour ka on pa/pb, kd on pc/pd
    function quad(a, pa, pb, pc, pd, n, ka = W3, kd = ka) {
      const ux = pb[0] - pa[0], uy = pb[1] - pa[1], uz = pb[2] - pa[2], vx = pd[0] - pa[0], vy = pd[1] - pa[1], vz = pd[2] - pa[2];
      const flip = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] < 0;
      const L = Math.hypot(ux, uy, uz) / 3, Wd = Math.hypot(vx, vy, vz) / 3;
      const V = [[pa, ka, 0, 0], [pb, ka, L, 0], [pc, kd, L, Wd], [pd, kd, 0, Wd]];
      for (const k of flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]) push(a, V[k][0], n, [V[k][2], V[k][3]], V[k][1]);
    }
    // strip swept round the centre between two profile points [radius, height]
    function band(a, A0, B0, a0, a1, hint, ka = W3, kb = ka) {
      let nr = B0[1] - A0[1], ny = -(B0[0] - A0[0]);
      const l = Math.hypot(nr, ny) || 1; nr /= l; ny /= l;
      const flip = nr * hint[0] + ny * hint[1] < 0;
      if (flip) { nr = -nr; ny = -ny; }
      const n = Math.max(1, Math.ceil((a1 - a0) / (TAU / 180)));
      const vert = (ang, P, K) => { const c = Math.cos(ang), s = Math.sin(ang); push(a, [cx + c * P[0], P[1], cz + s * P[0]], [c * nr, ny, s * nr], [ang * RM / 3, (P[0] + P[1]) / 3], K); };
      for (let i = 0; i < n; i++) {
        const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n;
        if (!flip) { vert(t0, A0, ka); vert(t0, B0, kb); vert(t1, A0, ka); vert(t0, B0, kb); vert(t1, B0, kb); vert(t1, A0, ka); }
        else { vert(t0, A0, ka); vert(t1, A0, ka); vert(t0, B0, kb); vert(t0, B0, kb); vert(t1, A0, ka); vert(t1, B0, kb); }
      }
    }
    const build = (a, color) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(a.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(a.u, 2));
      if (color) g.setAttribute('color', new THREE.Float32BufferAttribute(a.c, 3));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    };
    const onRoad = (x, z, pad) => { for (const r of C.roads) for (const p of r.samp) if (Math.hypot(p[0] - x, p[1] - z) < r.half + pad) return true; return false; };
    function pier(x, z, top, rad = 0.55) {
      steelL.push({ geometry: new THREE.CylinderGeometry(rad, rad * 1.08, top - 0.9, 20), matrix: M4(x, (top - 0.9) / 2, z) });
      steelL.push({ geometry: new THREE.CylinderGeometry(rad * 2.2, rad, 0.9, 20), matrix: M4(x, top - 0.45, z) });
      steelL.push({ geometry: new THREE.CylinderGeometry(rad * 1.5, rad * 1.6, 0.3, 20), matrix: M4(x, 0.3, z) });
      add({ x0: x - rad - 0.15, x1: x + rad + 0.15, z0: z - rad - 0.15, z1: z + rad + 0.15, y0: 0, y1: top, kind: 'ring-pier' });
    }

    // ---- girder
    band(A.pave, [r0, y], [r1, y], 0, TAU, [0, 1]);
    band(A.steel, [r1, y], [r1, y - 0.5], 0, TAU, [1, 0]);
    band(A.steel, [r1, y - 0.5], [r1 - 1.7, y - 1.2], 0, TAU, [1, -1]);
    band(A.steel, [r1 - 1.7, y - 1.2], [r0 + 1.7, y - 1.2], 0, TAU, [0, -1]);
    band(A.steel, [r0 + 1.7, y - 1.2], [r0, y - 0.5], 0, TAU, [-1, -1]);
    band(A.steel, [r0, y - 0.5], [r0, y], 0, TAU, [-1, 0]);
    band(A.led, [r1 + 0.03, y - 0.13], [r1 + 0.03, y - 0.31], 0, TAU, [1, 0], COOL);
    band(A.led, [r0 - 0.03, y - 0.13], [r0 - 0.03, y - 0.31], 0, TAU, [-1, 0], COOL);
    band(A.led, [r1 - 0.62, y - 0.78], [r1 - 0.92, y - 0.9], 0, TAU, [1, -1], COOL);
    band(A.led, [r0 + 0.62, y - 0.78], [r0 + 0.92, y - 0.9], 0, TAU, [-1, -1], COOL);

    // ---- balustrades: the outer one opens at the stairs and the skyway
    function balustrade(rb, s, e, sgn) {
      band(A.glass, [rb, y + 0.14], [rb, y + 1.16], s, e, [sgn, 0]);
      band(A.steel, [rb - 0.05, y], [rb - 0.05, y + 0.14], s, e, [-1, 0]);
      band(A.steel, [rb + 0.05, y], [rb + 0.05, y + 0.14], s, e, [1, 0]);
      band(A.steel, [rb - 0.05, y + 0.14], [rb + 0.05, y + 0.14], s, e, [0, 1]);
      band(A.steel, [rb - 0.05, y + 1.23], [rb + 0.05, y + 1.23], s, e, [0, 1]);
      band(A.steel, [rb - 0.05, y + 1.16], [rb - 0.05, y + 1.23], s, e, [-1, 0]);
      band(A.steel, [rb + 0.05, y + 1.16], [rb + 0.05, y + 1.23], s, e, [1, 0]);
      band(A.led, [rb - sgn * 0.056, y + 1.19], [rb - sgn * 0.056, y + 1.165], s, e, [-sgn, 0], WARM);
      band(A.wash, [rb - sgn * 0.1, y + 0.025], [rb - sgn * 2.7, y + 0.025], s, e, [0, 1], GLOW, Z3);
      const n = Math.max(1, Math.round((e - s) * rb / 2.3));
      for (let i = 0; i <= n; i++) {
        const a = s + (e - s) * i / n;
        railL.push({ geometry: boxGeo(0.1, 1.12, 0.05, 1, 1), matrix: M4(cx + Math.cos(a) * rb, y + 0.66, cz + Math.sin(a) * rb, -a) });
      }
    }
    const gaps = S.stairs.map((d) => [d * D2R, 1.6 / r1]).concat([[S.sky * D2R, 2.6 / r1]]).sort((p, q) => p[0] - q[0]);
    for (let i = 0; i < gaps.length; i++) {
      const g0 = gaps[i], g1 = gaps[(i + 1) % gaps.length];
      const s = g0[0] + g0[1]; let e = g1[0] - g1[1];
      if (e < s) e += TAU;
      balustrade(r1 - 0.1, s, e, 1);
    }
    balustrade(r0 + 0.1, 0, TAU, -1);

    // ---- piers: under the girder where the ground is free, otherwise an outrigger beside the road
    for (let k = 0; k < 14; k++) {
      let done = false;
      for (const dr of [0, 4, 7, 10, 13]) {
        for (const off of [0, 5, -5, 10, -10]) {
          const a = k / 14 * TAU + off * D2R, rp = RM + dr, x = cx + Math.cos(a) * rp, z = cz + Math.sin(a) * rp;
          if (onRoad(x, z, 1.4) || C.keepOut(x, z, -2) && dr > 0 && dr < 4) continue;
          let hit = false;
          for (const c of C.colliders) if (x > c.x0 - 1.5 && x < c.x1 + 1.5 && z > c.z0 - 1.5 && z < c.z1 + 1.5) { hit = true; break; }
          if (hit) continue;
          for (const deg of S.stairs.concat([S.sky])) { const d = Math.abs(Math.atan2(Math.sin(a - deg * D2R), Math.cos(a - deg * D2R))); if (d * rp < 4.5 && dr > 0) hit = true; }
          if (hit) continue;
          pier(x, z, y - (dr ? 1.75 : 1.2), dr ? 0.6 : 0.55);
          if (dr) steelL.push({ geometry: boxGeo(dr + 2.2, 0.75, 0.9, 2, 2), matrix: M4(cx + Math.cos(a) * (RM + dr / 2 - 0.5), y - 1.5, cz + Math.sin(a) * (RM + dr / 2 - 0.5), -a) });
          done = true; break;
        }
        if (done) break;
      }
    }

    // ---- stairs: two flights and a landing, running straight out along angle a
    const stairM = std({ color: 0x8d9299, roughness: 0.82, metalness: 0.05 });
    function stair(px, pz, a, id) {
      const dx = Math.cos(a), dz = Math.sin(a), ry = Math.PI / 2 - a;
      const rise = y - GY, nR = Math.round(rise / 0.172 / 2) * 2, rh = rise / nR, td = 0.29, half = nR / 2;
      const f1 = half * td, land = 1.6, run = 2 * f1 + land, W = 3.0, yMid = y - half * rh, th = Math.atan2(half * rh, f1), Ls = Math.hypot(f1, half * rh);
      const P = (lx, ly, lz) => [px + dx * lz + dz * lx, ly, pz + dz * lz - dx * lx];
      const box = (list, w, h, d, lx, ly, lz, rx = 0) => { const p = P(lx, ly, lz); list.push({ geometry: boxGeo(w, h, d, 2, 2), matrix: M4(p[0], p[1], p[2], ry, rx) }); };
      for (let i = 0; i < nR - 1; i++) {
        const second = i >= half;
        if (i === half - 1) continue;                      // that tread is the landing
        box(treadL, W, 0.06, td + 0.03, 0, y - (i + 1) * rh - 0.03, (i + 0.5) * td + (second ? land : 0));
      }
      box(treadL, W + 0.24, 0.24, land + td, 0, yMid - 0.12, f1 + land / 2 - td / 2);
      const lp = P(0, 0, f1 + land / 2);
      pier(lp[0], lp[1 + 1], yMid - 0.24, 0.3);
      const nrm = [dz, 0, -dx];
      for (const [z0, ya, yb] of [[0, y, yMid], [f1 + land, yMid, GY]]) {
        const zm = z0 + f1 / 2, ym = (ya + yb) / 2;
        for (const sx of [-1, 1]) {
          const lx = sx * (W / 2 + 0.07);
          box(steelL, 0.14, 0.42, Ls + 0.3, lx, ym - 0.3, zm, th);
          box(steelL, 0.07, 0.07, Ls, lx, ym + 1.08, zm, th);
          quad(A.glass, P(lx, ya + 0.02, z0), P(lx, yb + 0.02, z0 + f1), P(lx, yb + 1.0, z0 + f1), P(lx, ya + 1.0, z0), nrm);
          const li = sx * (W / 2 + 0.03);
          quad(A.led, P(li, ya + 1.03, z0), P(li, yb + 1.03, z0 + f1), P(li, yb + 0.99, z0 + f1), P(li, ya + 0.99, z0), [-sx * dz, 0, sx * dx], WARM);
          for (let k = 0; k <= 3; k++) box(railL, 0.05, 1.1, 0.09, lx, lerp(ya, yb, k / 3) + 0.53, z0 + f1 * k / 3);
        }
      }
      for (const sx of [-1, 1]) {
        const lx = sx * (W / 2 + 0.07);
        quad(A.glass, P(lx, yMid + 0.02, f1), P(lx, yMid + 0.02, f1 + land), P(lx, yMid + 1.0, f1 + land), P(lx, yMid + 1.0, f1), nrm);
        box(steelL, 0.07, 0.07, land, lx, yMid + 1.08, f1 + land / 2);
      }
      // no walking through the low end from the side; the last steps stay open
      for (let lz = run - 3.9; lz < run - 0.95; lz += 0.75) for (const lx of [-1.1, 0, 1.1]) {
        const p = P(lx, 0, lz + 0.375), hx = Math.abs(dx) * 0.375 + Math.abs(dz) * 0.55, hz = Math.abs(dz) * 0.375 + Math.abs(dx) * 0.55;
        add({ x0: p[0] - hx, x1: p[0] + hx, z0: p[2] - hz, z1: p[2] + hz, y0: 0, y1: 2, kind: 'ring-stair' });
      }
      const seg = (z0, z1, ya, yb, extra) => { const pa = P(0, 0, z0), pb = P(0, 0, z1); decks.push(Object.assign({ id, type: 'ramp', ax: pa[0], az: pa[2], bx: pb[0], bz: pb[2], hw: W / 2 - 0.3, ya, yb }, extra || {})); };
      seg(-0.95, 0.05, y, y);
      seg(0, f1, y, yMid);
      seg(f1, f1 + land, yMid, yMid);
      seg(f1 + land, run, yMid, GY, { ground: true });
      const ft = P(0, 0, run + 1.1), tp = P(0, 0, -0.6);
      return { a, top: [tp[0], tp[2]], foot: [ft[0], ft[2]] };
    }
    const stairs = S.stairs.map((d, i) => stair(cx + Math.cos(d * D2R) * r1, cz + Math.sin(d * D2R) * r1, d * D2R, 'ring-stair-' + i));

    // ---- skyway towards the Minglan Plaza forecourt
    const sa = S.sky * D2R, sdx = Math.cos(sa), sdz = Math.sin(sa), SW = 5, sLen = S.skyR - r1 + 0.3;
    const SP = (lx, ly, lz) => [cx + sdx * (r1 - 0.3 + lz) + sdz * lx, ly, cz + sdz * (r1 - 0.3 + lz) - sdx * lx];
    {
      const ry = Math.PI / 2 - sa, mid = SP(0, 0, sLen / 2);
      steelL.push({ geometry: boxGeo(SW, 0.5, sLen, 2, 2), matrix: M4(mid[0], y - 0.26, mid[2], ry) });
      steelL.push({ geometry: boxGeo(SW - 2.4, 0.7, sLen, 2, 2), matrix: M4(mid[0], y - 0.85, mid[2], ry) });
      quad(A.pave, SP(-SW / 2, y, 0), SP(-SW / 2, y, sLen), SP(SW / 2, y, sLen), SP(SW / 2, y, 0), [0, 1, 0]);
      for (const sx of [-1, 1]) {
        const lx = sx * (SW / 2 - 0.1), n = [sx * sdz, 0, -sx * sdx];
        quad(A.glass, SP(lx, y + 0.14, 0.6), SP(lx, y + 0.14, sLen), SP(lx, y + 1.16, sLen), SP(lx, y + 1.16, 0.6), n);
        quad(A.led, SP(sx * (SW / 2 + 0.01), y - 0.12, 0.6), SP(sx * (SW / 2 + 0.01), y - 0.12, sLen), SP(sx * (SW / 2 + 0.01), y - 0.3, sLen), SP(sx * (SW / 2 + 0.01), y - 0.3, 0.6), n, COOL);
        quad(A.led, SP(lx - sx * 0.056, y + 1.19, 0.6), SP(lx - sx * 0.056, y + 1.19, sLen), SP(lx - sx * 0.056, y + 1.165, sLen), SP(lx - sx * 0.056, y + 1.165, 0.6), [-n[0], 0, -n[2]], WARM);
        quad(A.wash, SP(lx - sx * 0.1, y + 0.025, 0.6), SP(lx - sx * 0.1, y + 0.025, sLen), SP(lx - sx * 2.3, y + 0.025, sLen), SP(lx - sx * 2.3, y + 0.025, 0.6), [0, 1, 0], GLOW, Z3);
        const hm = SP(lx, y + 1.195, sLen / 2 + 0.3);
        railL.push({ geometry: boxGeo(0.1, 0.07, sLen - 0.6, 1, 1), matrix: M4(hm[0], hm[1], hm[2], ry) });
        for (let k = 0; k <= 18; k++) { const p = SP(lx, y + 0.66, 0.6 + (sLen - 0.6) * k / 18); railL.push({ geometry: boxGeo(0.05, 1.12, 0.1, 1, 1), matrix: M4(p[0], p[1], p[2], ry) }); }
        // end returns either side of the stair head
        const e0 = SP(sx * 1.6, 0, sLen), e1 = SP(sx * SW / 2, 0, sLen);
        quad(A.glass, [e0[0], y + 0.14, e0[2]], [e1[0], y + 0.14, e1[2]], [e1[0], y + 1.16, e1[2]], [e0[0], y + 1.16, e0[2]], [sdx, 0, sdz]);
      }
      for (const lz of [10.5, 26.5, sLen - 1.2]) { const p = SP(0, 0, lz); pier(p[0], p[2], y - 1.2, 0.5); }
      const pa = SP(0, 0, -0.65), pb = SP(0, 0, sLen + 0.05);
      decks.push({ id: 'skyway', place: 'skyway', type: 'ramp', ax: pa[0], az: pa[2], bx: pb[0], bz: pb[2], hw: SW / 2 - 0.4, ya: y, yb: y });
    }
    const se = SP(0, 0, sLen), skyStair = stair(se[0], se[2], sa, 'skyway-stair');
    decks.push({ id: 'ring', place: 'ring', type: 'ring', cx, cz, r0: r0 + 0.4, r1: r1 - 0.4, y });

    tag(new THREE.Mesh(build(A.pave), M.promenade), 'pearl-ring-paving');
    const steel = std({ color: 0xc3c8ce, roughness: 0.42, metalness: 0.55, envMapIntensity: 1.25, emissive: 0x141a22, emissiveIntensity: 0.5, side: THREE.DoubleSide });
    tag(new THREE.Mesh(mergeGeoms(steelL.concat([{ geometry: build(A.steel) }])), steel), 'pearl-ring-structure').castShadow = true;
    merged(railL, metalSilver, 'pearl-ring-rail-posts');
    merged(treadL, stairM, 'pearl-ring-stair-treads');
    const glass = std({ color: 0xbfe2f2, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
    tag(new THREE.Mesh(build(A.glass), glass), 'pearl-ring-glass').renderOrder = 3;
    tag(new THREE.Mesh(build(A.led, true), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })), 'pearl-ring-led');
    const wash = tag(new THREE.Mesh(build(A.wash, true), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), 'pearl-ring-light-wash');
    wash.renderOrder = 2; G.noReflect.push(wash);

    // ---- people: most of them on the Pearl side, at the rail with their phones out
    const crowd = [];
    for (let i = 0; i < 30; i++) {
      const a = (i < 18 ? R(196, 292) : R(0, 360)) * D2R, atRail = i % 3 !== 0;
      const rr = atRail ? r1 - R(0.75, 1.0) : RM + R(-1.8, 1.6);
      const out = Math.atan2(Math.cos(a), Math.sin(a)), along = Math.atan2(-Math.sin(a), Math.cos(a)) + (i % 2 ? Math.PI : 0);
      const pose = atRail ? pick(['photo', 'photo', 'lean', 'phone', 'point', 'stand']) : pick(['stride', 'stride', 'talk', 'stand']);
      crowd.push({ look: pose === 'photo' ? { hold: 'phone' } : {}, pose, x: cx + Math.cos(a) * rr, y, z: cz + Math.sin(a) * rr, ry: atRail ? out + R(-0.35, 0.35) : along + R(-0.2, 0.2) });
    }
    scene.add(G.people.crowd(crowd, 'pearl-ring-people', 0));

    C.ringBridge = { cx, cz, r0, r1, r: RM, y, stairs, sky: sa };
    C.skyway = { ax: se[0], az: se[2], bx: cx + sdx * r1, bz: cz + sdz * r1, y, len: sLen, foot: skyStair.foot, top: skyStair.top };
    C.landmarks.bridge = { x: cx, z: cz, h: y + 1.4 };
  })();
  // ================================================== 7. FAR SKYLINE
  (function skyline() {
    const wet = (x, z, w, d) => [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]].some((k) => C.pointInWater(x + k[0] * (w / 2 + 25), z + k[1] * (d / 2 + 25)));
    const tower = (x, z, h, w, d) => {
      if (wet(x, z, w, d)) return;
      const style = pick(['glass', 'glass', 'panel', 'stone']);
      const P = style === 'glass' ? [1.6, 4.0] : style === 'panel' ? [3.0, 3.8] : [3.3, 3.05];
      const floors = Math.max(2, Math.round(h / P[1]));
      const tint = new THREE.Color(0.8 + R(0, 0.2), 0.84 + R(0, 0.16), 0.88 + R(0, 0.12));
      const led = style !== 'stone' && R() < 0.45 ? pick([0.2, 0.4, 0.6, 0.8]) : 0;
      ring(FXG[style], rect(x - w / 2, z - d / 2, x + w / 2, z + d / 2), 0, h, 0, floors, P[0], tint, R(0.05, 0.95), R(0.8, 1.4), 0, led, floors, 0);
      roofParts.push({ geometry: boxGeo(w, 0.6, d, 6, 6), matrix: M4(x, h + 0.3, z) });
      if (h > 120) beacon(x + w * 0.2, h + 1.6, z - d * 0.2, 0.7);
    };
    // North Lantan: the row stands on the far bank of the river, not in it
    const farBank = (x) => { let wet = false; for (let z = -640; z > -2000; z -= 10) { const w = C.pointInWater(x, z); if (w) wet = true; else if (wet) return z; } return -1560; };
    // west of x = -150 the north bank is real OSM data (13-lantan)
    for (let i = 0; i < 34; i++) { const x = -560 + i * 34 + R(-12, 12); if (x < -150) continue; tower(x, farBank(x) - 60 - R(0, 150), 40 + R(0, 190), 22 + R(0, 22), 22 + R(0, 22)); }
    for (let i = 0; i < 30; i++) tower(840 + R(0, 190), -330 + i * 36 + R(-12, 12), 30 + R(0, 200), 24 + R(0, 26), 24 + R(0, 26));
    for (let i = 0; i < 22; i++) tower(-380 + i * 52 + R(-16, 16), 760 + R(0, 170), 30 + R(0, 150), 26 + R(0, 26), 26 + R(0, 26));
  })();

  // ================================================== 8. RIVER TRAFFIC
  (function river() {
    const curve = new THREE.CatmullRomCurve3([[-1000, -900], [-1000, -560], [-1040, -300], [-1015, -100], [-910, 100], [-710, 300], [-530, 500], [-360, 650], [-150, 850]].map((p) => new THREE.Vector3(p[0], 0, p[1])));
    const LEN = curve.getLength();
    function winTex() {
      const c = document.createElement('canvas'); c.width = 256; c.height = 32;
      const x = c.getContext('2d'); x.fillStyle = '#07090c'; x.fillRect(0, 0, 256, 32);
      for (let i = 0; i < 16; i++) { x.fillStyle = R() < 0.8 ? `rgb(255,${205 + RI(0, 30)},${150 + RI(0, 40)})` : '#1a1410'; x.fillRect(i * 16 + 2, 6, 12, 20); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
    }
    const wt = winTex();
    const winMat = std({ map: wt, emissiveMap: wt, emissive: 0xffffff, emissiveIntensity: 1.8, roughness: 0.3, metalness: 0.2 });
    const whiteHull = std({ color: 0xd9dde0, roughness: 0.45, metalness: 0.15 }), navyHull = std({ color: 0x16202c, roughness: 0.5, metalness: 0.3 });
    const rustHull = std({ color: 0x3a2b24, roughness: 0.8, metalness: 0.2 }), sand = std({ color: 0x8a7a5c, roughness: 0.95 });
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.15, 0.1) }), green = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 5, 1.5) });
    function hullGeo(w, h, len, bow = 0.22) {
      const g = new THREE.BoxGeometry(w, h, len, 4, 2, 14);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), t = z / (len / 2);
        let k = 1, lift = 0;
        if (t > 1 - bow * 2) { const q = (t - (1 - bow * 2)) / (bow * 2); k = Math.sqrt(Math.max(0, 1 - q * q)) * 0.95 + 0.05; lift = q * q * h * 0.35; }
        else if (t < -0.82) k = 0.84 + 0.16 * (t + 1) / 0.18;
        p.setXYZ(i, x * k * (0.8 + 0.2 * (y / h + 0.5)), y + (y > 0 ? lift : 0), z);
      }
      g.computeVertexNormals(); return g;
    }
    function winStrip(list, w, len, y, h, z = 0) {
      for (const s of [-1, 1]) {
        const g = new THREE.PlaneGeometry(len, h); const uv = g.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * len / 14);
        list.push({ geometry: g, matrix: M4(s * (w / 2 + 0.03), y, z, s * Math.PI / 2) });
      }
    }
    function vessel(kind) {
      const g = new THREE.Group(), white = [], dark = [], wins = [], glow = [], cargo = [];
      let L = 30, Wd = 8;
      if (kind === 'cruise') {
        L = 46; Wd = 9.5;
        dark.push({ geometry: hullGeo(Wd, 3.2, L), matrix: M4(0, 0.9, 0) });
        white.push({ geometry: boxGeo(Wd * 0.9, 2.7, L * 0.74, 4, 2), matrix: M4(0, 3.85, -1.5) });
        white.push({ geometry: boxGeo(Wd * 0.78, 2.5, L * 0.56, 4, 2), matrix: M4(0, 6.45, -3) });
        white.push({ geometry: boxGeo(Wd * 0.84, 0.18, L * 0.62, 4, 2), matrix: M4(0, 7.8, -3) });
        white.push({ geometry: boxGeo(Wd * 0.5, 2.2, 4.5, 2, 2), matrix: M4(0, 8.9, L * 0.14) });
        winStrip(wins, Wd * 0.9, L * 0.7, 3.95, 1.5, -1.5); winStrip(wins, Wd * 0.78, L * 0.52, 6.5, 1.4, -3);
        const g2 = new THREE.PlaneGeometry(Wd * 0.44, 1.1); wins.push({ geometry: g2, matrix: M4(0, 9.2, L * 0.14 + 2.28) });
        for (const [yy, ww, ll, zz] of [[2.55, Wd, L * 0.92, 0], [5.25, Wd * 0.92, L * 0.75, -1.5], [7.95, Wd * 0.86, L * 0.63, -3]]) for (const s of [-1, 1]) glow.push({ geometry: boxGeo(0.1, 0.1, ll, 1, 1), matrix: M4(s * ww / 2, yy, zz) });
        dark.push({ geometry: new THREE.CylinderGeometry(0.1, 0.14, 5, 12), matrix: M4(0, 12.4, L * 0.1) });
      } else if (kind === 'barge') {
        L = 64; Wd = 11.5;
        cargo.push({ geometry: hullGeo(Wd, 2.6, L, 0.12), matrix: M4(0, 0.5, 0) });
        for (let i = 0; i < 3; i++) {
          const z = 22 - i * 15.5;
          dark.push({ geometry: boxGeo(Wd * 0.8, 0.7, 13.5, 4, 4), matrix: M4(0, 2.1, z) });
          const m = new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2);
          cargo.push({ geometry: m, matrix: M4(0, 2.3, z, 0, 0, 0, Wd * 0.36, 2.2 + (i % 2) * 0.5, 6.2), color: new THREE.Color(2.3, 2.1, 1.7) });
        }
        white.push({ geometry: boxGeo(Wd * 0.62, 5.2, 6.5, 2, 2), matrix: M4(0, 4.4, -L / 2 + 6) });
        white.push({ geometry: boxGeo(Wd * 0.7, 0.2, 7.4, 2, 2), matrix: M4(0, 7.1, -L / 2 + 6) });
        winStrip(wins, Wd * 0.62, 5.6, 5.9, 1.1, -L / 2 + 6);
        wins.push({ geometry: new THREE.PlaneGeometry(Wd * 0.56, 1.1), matrix: M4(0, 5.9, -L / 2 + 9.28) });
        dark.push({ geometry: new THREE.CylinderGeometry(0.08, 0.12, 4.5, 12), matrix: M4(0, 9.4, -L / 2 + 6) });
      } else {
        L = 32; Wd = 9;
        white.push({ geometry: hullGeo(Wd, 2.8, L, 0.16), matrix: M4(0, 0.8, 0) });
        dark.push({ geometry: boxGeo(Wd * 1.0, 0.5, L * 0.96, 4, 2), matrix: M4(0, 0.2, -0.4) });
        white.push({ geometry: boxGeo(Wd * 0.92, 2.6, L * 0.78, 4, 2), matrix: M4(0, 3.5, -1) });
        white.push({ geometry: boxGeo(Wd * 0.6, 2.3, L * 0.3, 4, 2), matrix: M4(0, 5.95, 2) });
        white.push({ geometry: boxGeo(Wd * 0.98, 0.16, L * 0.82, 4, 2), matrix: M4(0, 4.88, -1) });
        winStrip(wins, Wd * 0.92, L * 0.74, 3.6, 1.4, -1); winStrip(wins, Wd * 0.6, L * 0.26, 6.05, 1.2, 2);
        for (const s of [-1, 1]) glow.push({ geometry: boxGeo(0.08, 0.08, L * 0.8, 1, 1), matrix: M4(s * Wd * 0.49, 4.95, -1) });
        dark.push({ geometry: new THREE.CylinderGeometry(0.08, 0.1, 3.4, 12), matrix: M4(0, 8.8, 2) });
      }
      const addPart = (list, mat, vc) => { if (list.length) { const m = new THREE.Mesh(mergeGeoms(list, { vertexColors: !!vc }), mat); m.userData.passable = true; m.userData.surfaceProcedural = true; g.add(m); } };
      addPart(white, whiteHull); addPart(dark, kind === 'ferry' ? std({ color: 0x1f4f8a, roughness: 0.5, metalness: 0.2 }) : navyHull); addPart(wins, winMat);
      if (cargo.length) { const cm = sand.clone(); cm.vertexColors = true; cm.color.set(0x3a2b24); cm.userData.surfaceProcedural = true; addPart(cargo, cm, true); }
      if (glow.length) addPart(glow, std({ color: 0xffffff, emissive: pick([0xff3f9a, 0x3fd0ff, 0xffb040]), emissiveIntensity: 3.0, roughness: 0.4 }));
      const lamp = (mat, x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), mat); m.position.set(x, y, z); m.userData.passable = true; m.userData.surfaceProcedural = true; g.add(m); };
      lamp(red, Wd / 2, 3.2, L * 0.25); lamp(green, -Wd / 2, 3.2, L * 0.25);
      lamp(new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.6) }), 0, kind === 'barge' ? 11.7 : kind === 'cruise' ? 15 : 10.6, kind === 'barge' ? -L / 2 + 6 : kind === 'cruise' ? L * 0.1 : 2);
      g.name = 'river-' + kind; scene.add(g);
      return g;
    }
    const fleet = [['cruise', 0.50, 5.2, 1, 70], ['barge', 0.18, 3.4, 1, 95], ['ferry', 0.64, 4.6, -1, 60], ['barge', 0.86, 3.2, -1, 105], ['cruise', 0.30, 5.0, -1, 40]]
      .map(([kind, s, speed, dir, lane]) => ({ group: vessel(kind), s: s * LEN, speed, dir, lane }));
    const pt = new THREE.Vector3(), tg = new THREE.Vector3();
    function placeBoat(b, t) {
      const u = clamp(b.s / LEN, 0, 1);
      curve.getPointAt(u, pt); curve.getTangentAt(u, tg);
      const tx = tg.x * b.dir, tz = tg.z * b.dir;
      b.group.position.set(pt.x - tz * b.lane, 0.15 + Math.sin(t * 0.7 + b.lane) * 0.06, pt.z + tx * b.lane);
      b.group.rotation.set(0, Math.atan2(tx, tz), Math.sin(t * 0.5 + b.lane) * 0.008);
    }
    let clock = 0;
    C.updateRiver = (dt) => {
      clock += dt;
      for (const b of fleet) {
        b.s += b.speed * b.dir * dt;
        if (b.s > LEN) b.s -= LEN; else if (b.s < 0) b.s += LEN;
        placeBoat(b, clock);
      }
    };
    for (const b of fleet) placeBoat(b, 0);
    C.river = { curve, length: LEN, fleet };
    C.boat = fleet[0].group;
  })();

  // ================================================== 9. VIEWPOINT PROPS
  (function viewpoints() {
    const post = [], hoop = [], plates = [];
    for (const s of C.spots.filter((q) => q.id !== 'ferry' && q.id !== 'lantan')) {
      post.push({ geometry: boxGeo(0.24, 1.3, 0.24, 2, 2), matrix: M4(s.pos[0] + 2.2, 0.65, s.pos[1] + 1.2) });
      const g = new THREE.TorusGeometry(0.55, 0.05, 32, 32); g.rotateX(Math.PI / 2);
      hoop.push({ geometry: g, matrix: M4(s.pos[0] + 2.2, 1.34, s.pos[1] + 1.2) });
      plates.push(G.atlasQuad(s.pos[0] + 2.2, 1.05, s.pos[1] + 1.33, 1.3, 0.62, 9, 0));
    }
    merged(post, M.darkMetal, 'viewpoint-posts');
    merged(hoop, whiteGlow, 'viewpoint-rings');
    merged(plates, M.sign, 'viewpoint-plates');
  })();

  for (const k of Object.keys(FXG)) if (FXG[k].count) tag(new THREE.Mesh(FXG[k].build(), M.fx[k]), 'landmark-facades-' + k);
  merged(darkParts, metalDark, 'landmark-dark-parts');
  merged(roofParts, M.roof, 'landmark-roofs');
  tag(new THREE.Mesh(mergeGeoms(beacons), beaconMat), 'aviation-beacons');

  G.landmarks = C.landmarks;
  G.t = G.t || {}; G.t.landmarks = performance.now();
})();
