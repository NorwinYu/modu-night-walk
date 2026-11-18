/* 13b-riverside — the Shendong bank opposite the Lantan waterfront.
   A piled timber wharf (亲水平台) carries the cafe, the bar, the night-market
   stalls, buskers and an upper viewing boardwalk; behind it stands the Harbour
   Plaza shell that houses the mall rooms of 16-mall. Footprints come from
   C.site (10-city), which keeps the OSM passes out of the way. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, TEX = G.TEX, scene = G.scene, C = G.CITY;
  const { R, pick, lerp, clamp, M4, boxGeo, mergeGeoms, makeCanvas, canvasTexture } = G.util;
  const add = C.add, W = C.site.wharf, Y = W.y, GY = 0.17;
  const std = (o) => { const m = new THREE.MeshStandardMaterial(o); m.userData.surfaceProcedural = true; return m; };
  const tag = (m, name) => { m.name = name; m.userData.passable = true; m.userData.surfaceProcedural = true; m.receiveShadow = true; scene.add(m); return m; };
  const merged = (list, mat, name, vc = false) => (list.length ? tag(new THREE.Mesh(mergeGeoms(list, { vertexColors: vc }), mat), name) : null);
  const decks = (C.decks = C.decks || []);
  const col = (r, g, b) => new THREE.Color(r, g, b);

  // ---------------------------------------------------------------- materials
  function plankTex() {
    const c = makeCanvas(512, 512), x = c.getContext('2d');
    for (let i = 0; i < 16; i++) {
      const v = 0.74 + Math.random() * 0.3;
      x.fillStyle = `rgb(${Math.round(132 * v)},${Math.round(100 * v)},${Math.round(72 * v)})`;
      x.fillRect(0, i * 32, 512, 32);
      for (let k = 0; k < 46; k++) { x.fillStyle = `rgba(40,26,14,${0.05 + Math.random() * 0.12})`; x.fillRect(Math.random() * 512, i * 32 + 2 + Math.random() * 28, 30 + Math.random() * 130, 1); }
      x.fillStyle = 'rgba(16,11,8,0.92)'; x.fillRect(0, i * 32, 512, 2);
      const jx = (i * 149) % 512;
      x.fillRect(jx, i * 32, 2, 32);
      x.fillStyle = 'rgba(22,22,24,0.85)';
      for (const dx of [-7, 9]) for (const dy of [9, 23]) { x.beginPath(); x.arc((jx + dx + 512) % 512, i * 32 + dy, 1.5, 0, 6.3); x.fill(); }
    }
    const t = canvasTexture(c, true, 1, 1, 8);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const plankM = std({ map: plankTex(), roughness: 0.62, metalness: 0.0, envMapIntensity: 1.1 });
  const stoneM = std({ color: 0x8b8780, roughness: 0.82 });
  const pileM = std({ color: 0x4a4640, roughness: 0.9 });
  const steelM = std({ color: 0x8d949b, roughness: 0.35, metalness: 0.8, envMapIntensity: 1.3 });
  const darkM = std({ color: 0x24282d, roughness: 0.5, metalness: 0.55 });
  const paintM = std({ color: 0xffffff, vertexColors: true, roughness: 0.68, metalness: 0.05 });
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  const poolM = new THREE.MeshBasicMaterial({ map: TEX.lightPool, color: col(1.7, 1.15, 0.7), transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false });
  const glassM = std({ color: 0xbfe2f2, transparent: true, opacity: 0.2, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6 });
  const WARM = col(3.3, 2.2, 1.15), AMBER = col(3.6, 1.9, 0.6), COOLW = col(2.2, 2.6, 3.2);

  const stone = [], piles = [], planks = [], steel = [], dark = [], paint = [], glow = [], pools = [], glassL = [], treadL = [];
  // horizontal rectangle with world-space UVs (boards run along x)
  function flat(x0, x1, z0, z1, y, su = 4.8, sv = 2.4) {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0); g.rotateX(-Math.PI / 2); g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
    const p = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / su, p.getZ(i) / sv);
    return { geometry: g };
  }
  const box = (list, w, h, d, x, y, z, ry = 0, rx = 0, color) => list.push({ geometry: boxGeo(w, h, d, 2, 2), matrix: M4(x, y, z, ry, rx), color });
  const cyl = (list, r0, r1, h, x, y, z, color, seg = 14) => list.push({ geometry: new THREE.CylinderGeometry(r0, r1, h, seg), matrix: M4(x, y, z), color });
  const ball = (list, r, x, y, z, color, sx = 1, sy = 1, sz = 1) => list.push({ geometry: new THREE.SphereGeometry(r, 10, 7), matrix: M4(x, y, z, 0, 0, 0, sx, sy, sz), color });
  const pool = (x, z, s, y = Y + 0.03) => pools.push({ geometry: new THREE.PlaneGeometry(s, s), matrix: M4(x, y, z, 0, -Math.PI / 2) });

  // ---------------------------------------------------------------- sign atlas
  const SIGNS = ['热红酒 · MULLED WINE', '糖炒栗子 · CHESTNUTS', '炭火烤串 · SKEWERS', '生煎 · 锅贴 · 小馄饨', '亲水平台', '澜滩 · 对望  LANTAN WATERFRONT', '夜航小馆  NIGHT SHIFT BAR', '滨江步道  RIVER BOARDWALK'];
  const signTex = (() => {
    const c = makeCanvas(1024, 1024), x = c.getContext('2d');
    const bg = ['#3a1014', '#33200e', '#2c1410', '#12222c', '#0e2430', '#101c24', '#0b0d12', '#0e2430'];
    const fg = ['#ffd9c2', '#ffe2a8', '#ffd0a0', '#e8f4f8', '#eaf6fa', '#eaf2f6', '#ffe8c8', '#eaf6fa'];
    SIGNS.forEach((s, i) => {
      x.fillStyle = bg[i]; x.fillRect(0, i * 128, 1024, 128);
      x.strokeStyle = fg[i]; x.globalAlpha = 0.55; x.lineWidth = 4; x.strokeRect(8, i * 128 + 8, 1008, 112); x.globalAlpha = 1;
      x.fillStyle = fg[i]; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.font = '700 62px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
      x.fillText(s, 512, i * 128 + 66);
    });
    return canvasTexture(c, true, 1, 1, 8);
  })();
  const signL = [];
  function sign(row, w, h, x, y, z, ry, u0 = 0, u1 = 1) {
    const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, lerp(u0, u1, uv.getX(i)), 1 - (row + 1 - uv.getY(i)) / 8);
    signL.push({ geometry: g, matrix: M4(x, y, z, ry) });
  }

  // ================================================================ WHARF
  planks.push(flat(W.x0, W.x1, W.z0, W.z1, Y));
  // edge beams, piles where the deck stands over water
  for (const [w, d, x, z] of [[W.x1 - W.x0 + 0.5, 0.5, (W.x0 + W.x1) / 2, W.z0 - 0.0], [W.x1 - W.x0 + 0.5, 0.5, (W.x0 + W.x1) / 2, W.z1], [0.5, W.z1 - W.z0, W.x0, (W.z0 + W.z1) / 2], [0.5, W.z1 - W.z0, W.x1, (W.z0 + W.z1) / 2]]) box(stone, w, 0.62, d, x, Y - 0.33, z);
  for (let x = W.x0 + 0.6; x <= W.x1; x += 5.3) for (let z = W.z0 + 0.6; z <= W.z1; z += 5.85) {
    if (!C.pointInWater(x, z)) continue;
    cyl(piles, 0.3, 0.34, 4.2, x, -1.7, z);
    box(stone, 0.9, 0.3, 0.9, x, Y - 0.5, z);
  }
  for (let z = W.z0 + 0.6; z <= W.z1; z += 5.85) if (C.pointInWater(W.x0 + 2, z)) box(stone, W.x1 - W.x0, 0.34, 0.4, (W.x0 + W.x1) / 2, Y - 0.2, z);
  // land-side steps along the north and east edges
  const EZ = 119.6, STEP = (Y - GY) / 3;
  for (let k = 1; k <= 2; k++) {
    const top = Y - k * STEP;
    box(stone, W.x1 - W.x0 + 0.4 * k, top, 0.4, (W.x0 + W.x1) / 2 + 0.2 * k, top / 2, W.z0 - (k - 0.5) * 0.4);
    box(stone, 0.4, top, EZ - W.z0 + 0.4 * k, W.x1 + (k - 0.5) * 0.4, top / 2, (W.z0 + EZ) / 2 - 0.2 * k);
  }
  // railing: steel posts, cables, timber cap with a warm LED under it
  function rail(x0, z0, x1, z1, y = Y, collide = true) {
    const len = Math.hypot(x1 - x0, z1 - z0), alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    const ry = alongX ? 0 : Math.PI / 2;
    box(paint, len, 0.07, 0.14, mx, y + 1.1, mz, ry, 0, col(0.36, 0.25, 0.16));
    box(glow, len, 0.025, 0.05, mx, y + 1.05, mz, ry, 0, WARM);
    for (const h of [0.3, 0.55, 0.8]) box(steel, len, 0.018, 0.018, mx, y + h, mz, ry);
    const n = Math.max(1, Math.round(len / 1.6));
    for (let i = 0; i <= n; i++) box(steel, 0.06, 1.06, 0.06, lerp(x0, x1, i / n), y + 0.53, lerp(z0, z1, i / n));
    if (collide) add({ x0: Math.min(x0, x1) - 0.15, x1: Math.max(x0, x1) + 0.15, z0: Math.min(z0, z1) - 0.15, z1: Math.max(z0, z1) + 0.15, y0: 0, y1: y + 1.2, kind: 'wharf-rail' });
  }
  const GANG = [120.5, 123.1];                                   // opening to the cruise gangway
  rail(W.x0 + 0.12, W.z0, W.x0 + 0.12, GANG[0]);
  rail(W.x0 + 0.12, GANG[1], W.x0 + 0.12, W.z1 - 0.12);
  rail(W.x0 + 0.12, W.z1 - 0.12, W.x1 - 0.12, W.z1 - 0.12);
  rail(W.x1 - 0.12, W.z1 - 0.12, W.x1 - 0.12, EZ);
  // lifebuoys and mooring bollards on the river side
  for (const z of [92, 110]) { const g = new THREE.TorusGeometry(0.3, 0.085, 8, 18); g.rotateY(Math.PI / 2); paint.push({ geometry: g, matrix: M4(W.x0 + 0.26, Y + 0.72, z), color: col(0.85, 0.2, 0.1) }); }
  for (const x of [-628, -616, -604]) { cyl(dark, 0.2, 0.24, 0.42, x, Y + 0.21, W.z1 - 0.7); cyl(dark, 0.3, 0.3, 0.1, x, Y + 0.44, W.z1 - 0.7); }

  // deck lamps: slim posts with a warm globe
  function lamp(x, z, y = Y, h = 3.5) {
    cyl(dark, 0.055, 0.075, h, x, y + h / 2, z);
    cyl(dark, 0.16, 0.2, 0.25, x, y + 0.12, z);
    ball(glow, 0.2, x, y + h + 0.12, z, WARM);
    cyl(dark, 0.24, 0.05, 0.1, x, y + h + 0.33, z);
    pool(x, z, 10, y + 0.03);
    add({ x0: x - 0.2, x1: x + 0.2, z0: z - 0.2, z1: z + 0.2, y0: 0, y1: 3, kind: 'lamp' });
  }
  const LAMPS = [[-602, 86], [-602, 99], [-602.5, 116], [-618, 84.5], [-614, 116.5], [-626.5, 108], [-634.6, 96], [-634.6, 116.6]];
  LAMPS.forEach(([x, z]) => lamp(x, z));
  // festoon strings over the terrace and the market row
  const wire = [];
  function festoon(a, b, n = 12, sag = 0.55) {
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = [lerp(a[0], b[0], t), lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag, lerp(a[2], b[2], t)];
      if (prev) wire.push(prev[0], prev[1], prev[2], p[0], p[1], p[2]);
      if (i > 0 && i < n) ball(glow, 0.065, p[0], p[1] - 0.08, p[2], i % 3 ? WARM : AMBER);
      prev = p;
    }
  }
  const LT = Y + 3.62;
  festoon([-624, Y + 3.9, 107.2], [-626.5, LT, 108]); festoon([-626.5, LT, 108], [-614, LT, 116.5], 16); festoon([-614, LT, 116.5], [-612, Y + 3.9, 107.2], 10);
  festoon([-612, Y + 3.9, 107.2], [-602.5, LT, 116], 12); festoon([-612, Y + 3.9, 96.4], [-602, LT, 99], 10); festoon([-602, LT, 99], [-602, LT, 86], 14); festoon([-602, LT, 86], [-618, LT, 84.5], 16);
  {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    tag(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x15171a })), 'riverside-festoon-wires');
  }

  // ---- cafe and bar: roofs, eave lights and outside signs (the rooms come from 14-cafe / 14b-bar)
  box(dark, 13.4, 0.24, 12.6, -618, Y + 3.74, 101.5);
  box(glow, 13.0, 0.04, 0.06, -618, Y + 3.6, 107.72, 0, 0, WARM);
  box(dark, 11.4, 0.24, 11.4, -627, Y + 3.74, 89);
  box(glow, 0.06, 0.04, 11.0, -621.36, Y + 3.6, 89, 0, 0, AMBER);
  sign(6, 3.6, 0.45, -621.84, Y + 3.15, 89, Math.PI / 2);
  // timber slat screens on the blind walls
  for (let i = 0; i < 24; i++) { box(paint, 0.09, 3.3, 0.06, -623.75 + i * 0.5, Y + 1.65, 95.86, 0, 0, col(0.42, 0.3, 0.2)); box(paint, 0.06, 3.3, 0.09, -611.86, Y + 1.65, 96.3 + i * 0.41, 0, 0, col(0.42, 0.3, 0.2)); }
  for (let i = 0; i < 20; i++) box(paint, 0.09, 3.3, 0.06, -631.75 + i * 0.5, Y + 1.65, 94.34, 0, 0, col(0.3, 0.22, 0.16));

  // ---- lookout furniture on the river edge
  // lantan viewpoint plate (same family as the other photo spots)
  {
    const s = C.spots.find((q) => q.id === 'lantan');
    const px = W.x0 + 0.75, pz = s.pos[1];
    box(dark, 0.2, 1.1, 0.2, px, Y + 0.55, pz);
    const g = new THREE.TorusGeometry(0.5, 0.045, 10, 28); g.rotateX(Math.PI / 2);
    glow.push({ geometry: g, matrix: M4(px, Y + 1.14, pz), color: COOLW });
    sign(5, 2.2, 0.275, px + 0.12, Y + 0.8, pz, Math.PI / 2);
  }
  // coin telescope
  const TEL = { x: W.x0 + 0.85, z: 109 };
  cyl(dark, 0.07, 0.11, 1.15, TEL.x, Y + 0.57, TEL.z); cyl(dark, 0.2, 0.24, 0.08, TEL.x, Y + 0.04, TEL.z);
  box(steel, 0.5, 0.26, 0.32, TEL.x - 0.05, Y + 1.3, TEL.z);
  for (const dz of [-0.09, 0.09]) { const g = new THREE.CylinderGeometry(0.06, 0.075, 0.2, 12); g.rotateZ(Math.PI / 2); steel.push({ geometry: g, matrix: M4(TEL.x + 0.3, Y + 1.3, TEL.z + dz) }); dark.push({ geometry: g.clone(), matrix: M4(TEL.x - 0.36, Y + 1.3, TEL.z + dz) }); }
  add({ x0: TEL.x - 0.35, x1: TEL.x + 0.35, z0: TEL.z - 0.3, z1: TEL.z + 0.3, y0: 0, y1: 2.2, kind: 'telescope' });
  C.telescope = { x: TEL.x + 0.75, z: TEL.z, eye: [TEL.x - 0.45, Y + 1.3, TEL.z], yaw: -Math.PI / 2 };
  // benches facing the water
  function bench(x, z) {
    for (let i = 0; i < 4; i++) box(paint, 0.11, 0.045, 1.9, x - 0.2 + i * 0.13, Y + 0.46, z, 0, 0, col(0.45, 0.32, 0.2));
    for (let i = 0; i < 3; i++) box(paint, 0.045, 0.1, 1.9, x + 0.36, Y + 0.62 + i * 0.14, z, 0, 0, col(0.45, 0.32, 0.2));
    for (const dz of [-0.8, 0.8]) { box(dark, 0.6, 0.44, 0.06, x + 0.05, Y + 0.22, z + dz); box(dark, 0.05, 0.6, 0.06, x + 0.38, Y + 0.7, z + dz); }
    add({ x0: x - 0.3, x1: x + 0.45, z0: z - 0.95, z1: z + 0.95, y0: 0, y1: 1.2, kind: 'bench' });
  }
  bench(W.x0 + 1.5, 99.5); bench(W.x0 + 1.5, 113.2);
  C.riverBench = { x: W.x0 + 1.45, z: 99.5, yaw: -Math.PI / 2, stand: [W.x0 + 2.5, 99.5] };
  // name totem at the land corner
  box(dark, 0.9, 2.7, 0.22, -600.6, Y + 1.35, 83.6, -0.6);
  sign(4, 0.7, 2.2, -600.6 + Math.sin(-0.6) * 0.12, Y + 1.5, 83.6 + Math.cos(-0.6) * 0.12, -0.6, 0.3, 0.7);
  glow.push({ geometry: boxGeo(0.92, 0.05, 0.24), matrix: M4(-600.6, Y + 2.73, 83.6, -0.6), color: COOLW });
  // planters
  for (const [x, z] of [[-606, 83.2], [-613, 83.2], [-599.4, 92], [-599.4, 106], [-620.6, 95.2]]) {
    box(paint, 1.5, 0.55, 0.7, x, Y + 0.28, z, 0, 0, col(0.22, 0.23, 0.25));
    for (const dx of [-0.42, 0, 0.42]) ball(paint, 0.34, x + dx, Y + 0.7, z, col(0.2 + R(0, 0.06), 0.36 + R(0, 0.1), 0.17), 1, 0.8, 0.9);
    add({ x0: x - 0.75, x1: x + 0.75, z0: z - 0.35, z1: z + 0.35, y0: 0, y1: 1.4, kind: 'planter' });
  }

  // ================================================================ NIGHT MARKET
  const people = [];
  const P = G.people;
  const who = (pose, x, z, ry, look, y = Y) => people.push({ look: look || (pose === 'photo' ? { hold: 'phone' } : {}), pose, x, y, z, ry });
  const base = (x, z, ry, y = Y) => { const b = M4(x, y, z, ry); return (lx, ly, lz, ry2 = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => b.clone().multiply(M4(lx, ly, lz, ry2, rx, rz, sx, sy, sz)); };
  // a stall: counter, striped awning on four posts, signboard, goods; +z is the customer side
  function stall(x, z, ry, kind, row, c1, c2) {
    const at = base(x, z, ry);
    const put = (list, geo, m, color) => list.push({ geometry: geo, matrix: m, color });
    put(paint, boxGeo(2.2, 0.86, 0.9, 2, 2), at(0, 0.45, 0), c1);
    put(paint, boxGeo(2.34, 0.06, 1.04, 2, 2), at(0, 0.91, 0), col(0.5, 0.36, 0.24));
    for (const sx of [-1.1, 1.1]) for (const sz of [-0.55, 0.62]) put(dark, new THREE.CylinderGeometry(0.03, 0.03, 2.3, 8), at(sx, 1.15, sz));
    for (let i = 0; i < 6; i++) put(paint, boxGeo(0.4, 0.04, 1.5, 1, 1), at(-1.0 + i * 0.4, 2.36, 0.05, 0, 0.16), i % 2 ? c2 : col(0.92, 0.9, 0.84));
    for (let i = 0; i < 6; i++) put(paint, boxGeo(0.4, 0.22, 0.03, 1, 1), at(-1.0 + i * 0.4, 2.13, 0.79), i % 2 ? c2 : col(0.92, 0.9, 0.84));
    const g = new THREE.PlaneGeometry(2.0, 0.26), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - (row + 1 - uv.getY(i)) / 8);
    signL.push({ geometry: g, matrix: at(0, 0.5, 0.456) });
    put(glow, new THREE.SphereGeometry(0.075, 8, 6), at(-0.6, 2.0, 0.2), WARM);
    put(glow, new THREE.SphereGeometry(0.075, 8, 6), at(0.6, 2.0, 0.2), WARM);
    if (kind === 'wine') {
      put(steel, new THREE.CylinderGeometry(0.24, 0.2, 0.36, 14), at(-0.55, 1.12, -0.05));
      put(paint, new THREE.CylinderGeometry(0.22, 0.22, 0.02, 14), at(-0.55, 1.29, -0.05), col(0.35, 0.03, 0.06));
      put(glow, boxGeo(0.34, 0.03, 0.34), at(-0.55, 0.95, -0.05), col(2.4, 0.7, 0.15));
      for (let i = 0; i < 5; i++) put(paint, new THREE.CylinderGeometry(0.045, 0.035, 0.11, 8), at(0.1 + i * 0.16, 1.0, 0.22), col(0.9, 0.88, 0.82));
      for (let i = 0; i < 4; i++) put(paint, new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), at(0.25 + i * 0.14, 1.09, -0.22), col(0.1, 0.22, 0.12));
    } else if (kind === 'chestnut') {
      put(dark, new THREE.CylinderGeometry(0.46, 0.3, 0.26, 16), at(-0.4, 1.07, 0));
      put(paint, new THREE.SphereGeometry(0.42, 12, 6, 0, 6.3, 0, 1.2), at(-0.4, 0.95, 0, 0, 0, 0, 1, 0.5, 1), col(0.25, 0.13, 0.07));
      put(glow, boxGeo(0.5, 0.03, 0.5), at(-0.4, 0.94, 0), col(2.6, 0.9, 0.2));
      for (let i = 0; i < 4; i++) put(paint, boxGeo(0.16, 0.22, 0.1, 1, 1), at(0.35 + i * 0.2, 1.05, 0.15), col(0.72, 0.55, 0.34));
      put(steel, boxGeo(0.3, 0.05, 0.3), at(0.8, 0.97, -0.2));
    } else {
      put(dark, boxGeo(1.1, 0.16, 0.42, 2, 1), at(-0.35, 1.02, 0));
      put(glow, boxGeo(1.0, 0.02, 0.32), at(-0.35, 1.105, 0), col(3.0, 0.8, 0.12));
      for (let i = 0; i < 9; i++) { put(paint, boxGeo(0.03, 0.03, 0.5, 1, 1), at(-0.8 + i * 0.11, 1.13, 0.02), col(0.55, 0.26, 0.12)); }
      for (let i = 0; i < 3; i++) put(paint, boxGeo(0.24, 0.04, 0.34, 1, 1), at(0.5 + i * 0.28, 0.96, 0.1), col(0.86, 0.84, 0.8));
    }
    pool(x + Math.sin(ry) * 1.2, z + Math.cos(ry) * 1.2, 6);
    const hx = Math.abs(Math.cos(ry)) * 1.1 + Math.abs(Math.sin(ry)) * 0.5, hz = Math.abs(Math.sin(ry)) * 1.1 + Math.abs(Math.cos(ry)) * 0.5;
    add({ x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y0: 0, y1: 2.4, kind: 'food-stall' });
    who('hold', x - Math.sin(ry) * 0.95, z - Math.cos(ry) * 0.95, ry, { acc: ['apron'], top: 'shirt' });
  }
  const E = Math.PI / 2;
  C.stalls = [{ x: -609.5, z: 97.6, kind: 'wine' }, { x: -609.5, z: 101.0, kind: 'chestnut' }, { x: -609.5, z: 104.4, kind: 'skewer' }];
  stall(-609.5, 97.6, E, 'wine', 0, col(0.36, 0.1, 0.12), col(0.62, 0.12, 0.14));
  stall(-609.5, 101.0, E, 'chestnut', 1, col(0.34, 0.22, 0.1), col(0.72, 0.46, 0.12));
  stall(-609.5, 104.4, E, 'skewer', 2, col(0.2, 0.2, 0.22), col(0.16, 0.34, 0.5));
  for (const [z, pose] of [[97.3, 'stand'], [100.6, 'phone'], [101.5, 'talk'], [104.6, 'point']]) who(pose, -607.2 + R(-0.2, 0.3), z, -E + R(-0.2, 0.2));
  // snack cart: stainless body, glass case, steamers, lit header
  {
    const x = -603.2, z = 111.5, at = base(x, z, -E);
    const put = (list, geo, m, color) => list.push({ geometry: geo, matrix: m, color });
    put(steel, boxGeo(1.9, 0.8, 0.95, 2, 2), at(0, 0.62, 0));
    put(glassL, boxGeo(1.1, 0.5, 0.6, 1, 1), at(-0.35, 1.28, 0.12));
    for (const sx of [-0.9, 0.9]) for (const sz of [-0.42, 0.42]) put(dark, new THREE.CylinderGeometry(0.025, 0.025, 1.4, 8), at(sx, 1.7, sz));
    put(paint, boxGeo(2.1, 0.08, 1.2, 2, 2), at(0, 2.42, 0), col(0.75, 0.18, 0.14));
    for (let i = 0; i < 3; i++) put(paint, new THREE.CylinderGeometry(0.22, 0.22, 0.1, 14), at(0.55, 1.08 + i * 0.11, -0.08), col(0.78, 0.66, 0.44));
    put(glow, boxGeo(1.0, 0.03, 0.5), at(-0.35, 1.06, 0.12), WARM);
    for (const sx of [-0.7, 0.7]) { const g = new THREE.CylinderGeometry(0.26, 0.26, 0.08, 14); g.rotateZ(Math.PI / 2); put(dark, g, at(sx, 0.26, 0.5)); put(dark, g.clone(), at(sx, 0.26, -0.5)); }
    const g = new THREE.PlaneGeometry(1.9, 0.24), uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), 1 - (3 + 1 - uv.getY(i)) / 8);
    signL.push({ geometry: g, matrix: at(0, 2.24, 0.61) });
    put(glow, new THREE.SphereGeometry(0.075, 8, 6), at(0, 2.3, 0.3), WARM);
    add({ x0: x - 0.55, x1: x + 0.55, z0: z - 1.0, z1: z + 1.0, y0: 0, y1: 2.4, kind: 'food-stall' });
    pool(x - 1.2, z, 6);
    who('hold', x + 0.95, z, -E, { acc: ['apron'], top: 'tee' });
    who('stand', x - 1.5, z - 0.3, E); who('phone', x - 2.3, z + 0.4, E + 0.3);
    C.foodCart = new THREE.Vector3(x - 0.6, Y, z);
  }
  // buskers: a guitarist with amp and open case, a saxophonist under a lamp
  {
    const gx = -606.2, gz = 119.2, at = base(gx, gz, Math.PI - 0.5);
    const put = (list, geo, m, color) => list.push({ geometry: geo, matrix: m, color });
    who('hold', gx, gz, Math.PI - 0.5, { top: 'jacket', hairStyle: 'beanie', sex: 'm' });
    put(paint, new THREE.CylinderGeometry(0.2, 0.2, 0.1, 14), at(0.08, 1.02, 0.2, 0, Math.PI / 2, 0.5, 1, 1, 1.25), col(0.62, 0.36, 0.14));
    put(paint, boxGeo(0.06, 0.03, 0.62, 1, 1), at(0.34, 1.2, 0.21, 0, 0, 0.5), col(0.2, 0.12, 0.07));
    put(dark, boxGeo(0.5, 0.48, 0.3, 2, 2), at(-0.9, 0.24, -0.2));
    put(glow, boxGeo(0.04, 0.04, 0.02), at(-0.72, 0.42, -0.04), col(3, 0.4, 0.2));
    put(dark, new THREE.CylinderGeometry(0.012, 0.012, 1.5, 6), at(0.0, 0.75, 0.55));
    put(dark, new THREE.SphereGeometry(0.045, 8, 6), at(0.0, 1.52, 0.5));
    put(paint, boxGeo(1.05, 0.1, 0.4, 2, 1), at(0.5, 0.05, 1.3, 0.3), col(0.12, 0.1, 0.1));
    put(paint, boxGeo(0.96, 0.02, 0.32, 2, 1), at(0.5, 0.105, 1.3, 0.3), col(0.5, 0.1, 0.12));
    add({ x0: gx - 0.75, x1: gx + 0.75, z0: gz - 0.6, z1: gz + 0.6, y0: 0, y1: 1.9, kind: 'busker' });
    for (const [a, pose] of [[2.2, 'stand'], [2.7, 'phone'], [3.3, 'stand'], [3.8, 'talk']]) who(pose, gx + Math.sin(a) * 2.9, gz + Math.cos(a) * 2.9, a + Math.PI + R(-0.2, 0.2));
    const sx = -627.5, sz = 111.6, as = base(sx, sz, E + 0.3);
    who('hold', sx, sz, E + 0.3, { top: 'suit', sex: 'm' });
    put(paint, new THREE.CylinderGeometry(0.03, 0.075, 0.6, 10), as(0.12, 1.02, 0.24, 0, 0.35, 0), col(0.85, 0.62, 0.18));
    put(paint, new THREE.CylinderGeometry(0.1, 0.06, 0.16, 10), as(0.12, 0.78, 0.42, 0, 1.2, 0), col(0.85, 0.62, 0.18));
    put(dark, new THREE.CylinderGeometry(0.012, 0.012, 1.2, 6), as(-0.5, 0.6, 0.6));
    put(paint, boxGeo(0.42, 0.3, 0.02, 1, 1), as(-0.5, 1.22, 0.6, 0, -0.3), col(0.1, 0.1, 0.11));
    put(paint, new THREE.CylinderGeometry(0.2, 0.16, 0.12, 12), as(0.4, 0.06, 1.1), col(0.14, 0.12, 0.12));
    add({ x0: sx - 0.6, x1: sx + 0.6, z0: sz - 0.6, z1: sz + 0.6, y0: 0, y1: 1.9, kind: 'busker' });
    for (const [a, pose] of [[0.9, 'stand'], [1.5, 'phone'], [2.1, 'stand']]) who(pose, sx + Math.sin(a) * 2.8, sz + Math.cos(a) * 2.8, a + Math.PI + R(-0.2, 0.2));
    C.buskers = [{ x: gx, z: gz, kind: 'guitar' }, { x: sx, z: sz, kind: 'sax' }];
  }
  // a couple at the rail who want their picture taken with the Lantan waterfront behind them
  who('wave', W.x0 + 0.95, 116.4, E, { sex: 'f', top: 'coat', acc: ['scarf'] });
  who('stand', W.x0 + 0.95, 117.2, E, { sex: 'm', top: 'jacket' });
  add({ x0: W.x0 + 0.55, x1: W.x0 + 1.35, z0: 115.9, z1: 117.7, y0: 0, y1: 1.8, kind: 'tourists' });
  C.photoTourist = [W.x0 + 3.4, 116.8];
  // the rest of the evening crowd
  for (const [z, pose] of [[86.5, 'lean'], [91, 'photo'], [95.5, 'point'], [102.5, 'photo'], [106.2, 'lean'], [111.2, 'photo'], [119.2, 'lean']]) who(pose, W.x0 + 0.85 + R(0, 0.15), z, -E + R(-0.3, 0.3));
  for (const [x, pose] of [[-629, 'lean'], [-620.5, 'photo'], [-611, 'lean'], [-601.5, 'phone']]) who(pose, x, W.z1 - 0.85, R(-0.3, 0.3));
  for (const [x, z, ry] of [[-617.5, 113.5, 2.2], [-622.4, 106.9, 0.4], [-604, 94, -1.2], [-615, 88.5, 1.6], [-600.5, 103, 3.0]]) { who('talk', x, z, ry); who('talk', x + Math.sin(ry) * 0.8, z + Math.cos(ry) * 0.8, ry + Math.PI); }
  for (const [x, z, ry] of [[-606, 89, 2.6], [-613.5, 110.8, -1.3], [-624, 99.5, 0.2], [-630.5, 104.5, 2.9]]) who('stride', x, z, ry);

  // ================================================================ UPPER BOARDWALK
  const BW = { x0: -634, x1: -608, z0: 119.5, z1: 123.5, y: Y + 3.2 };
  planks.push(flat(BW.x0, BW.x1, BW.z0, BW.z1, BW.y));
  box(steel, BW.x1 - BW.x0, 0.3, 0.16, (BW.x0 + BW.x1) / 2, BW.y - 0.16, BW.z0 + 0.08);
  box(steel, BW.x1 - BW.x0, 0.3, 0.16, (BW.x0 + BW.x1) / 2, BW.y - 0.16, BW.z1 - 0.08);
  box(dark, BW.x1 - BW.x0 - 0.2, 0.06, BW.z1 - BW.z0 - 0.3, (BW.x0 + BW.x1) / 2, BW.y - 0.04, (BW.z0 + BW.z1) / 2);
  for (let i = 0; i <= 13; i++) box(steel, 0.12, 0.22, BW.z1 - BW.z0, lerp(BW.x0 + 0.06, BW.x1 - 0.06, i / 13), BW.y - 0.18, (BW.z0 + BW.z1) / 2);
  for (const x of [BW.x0 + 0.4, -627.5, -621, -614.5, BW.x1 - 0.4]) for (const z of [BW.z0 + 0.4, BW.z1 - 0.4]) {
    cyl(steel, 0.13, 0.13, BW.y - Y - 0.3, x, Y + (BW.y - Y - 0.3) / 2, z);
    add({ x0: x - 0.22, x1: x + 0.22, z0: z - 0.22, z1: z + 0.22, y0: 0, y1: BW.y, kind: 'boardwalk-post' });
  }
  box(glow, BW.x1 - BW.x0, 0.03, 0.05, (BW.x0 + BW.x1) / 2, BW.y - 0.33, BW.z0 + 0.08, 0, 0, COOLW);
  box(glow, BW.x1 - BW.x0, 0.03, 0.05, (BW.x0 + BW.x1) / 2, BW.y - 0.33, BW.z1 - 0.08, 0, 0, COOLW);
  const SX = [BW.x0 + 1, BW.x1 - 1];                               // stair centre lines
  rail(BW.x0 + 0.1, BW.z1 - 0.1, BW.x1 - 0.1, BW.z1 - 0.1, BW.y, false);
  rail(BW.x0 + 0.1, BW.z0 + 0.1, BW.x0 + 0.1, BW.z1 - 0.1, BW.y, false);
  rail(BW.x1 - 0.1, BW.z0 + 0.1, BW.x1 - 0.1, BW.z1 - 0.1, BW.y, false);
  rail(SX[0] + 1.05, BW.z0 + 0.1, SX[1] - 1.05, BW.z0 + 0.1, BW.y, false);
  sign(7, 3.2, 0.4, (BW.x0 + BW.x1) / 2, BW.y - 0.12, BW.z0 - 0.02, Math.PI);
  const nR = 19, rh = (BW.y - Y) / nR, td = 0.28, runB = nR * td, footZ = BW.z0 - runB;
  const bwStairs = [];
  for (const xs of SX) {
    for (let i = 0; i < nR - 1; i++) box(treadL, 2.0, 0.05, td + 0.03, xs, BW.y - (i + 1) * rh - 0.025, BW.z0 - (i + 0.5) * td);
    const th = Math.atan2(BW.y - Y, runB), Ls = Math.hypot(runB, BW.y - Y), zm = (BW.z0 + footZ) / 2, ym = (BW.y + Y) / 2;
    for (const sx of [-1, 1]) {
      box(steel, 0.1, 0.3, Ls + 0.2, xs + sx * 1.05, ym - 0.22, zm, 0, -th);
      box(paint, 0.07, 0.06, Ls, xs + sx * 1.05, ym + 1.0, zm, 0, -th, col(0.36, 0.25, 0.16));
      box(glow, 0.03, 0.025, Ls, xs + sx * 1.02, ym + 0.95, zm, 0, -th, WARM);
      for (let k = 0; k <= 4; k++) box(steel, 0.05, 1.05, 0.05, xs + sx * 1.05, lerp(BW.y, Y, k / 4) + 0.5, lerp(BW.z0, footZ, k / 4));
    }
    add({ x0: xs - 1.12, x1: xs + 1.12, z0: footZ + 0.9, z1: footZ + 3.3, y0: 0, y1: 2.6, kind: 'boardwalk-stair' });
    decks.push({ id: 'boardwalk-stair', type: 'ramp', ax: xs, az: BW.z0 + 1.1, bx: xs, bz: BW.z0 - 0.05, hw: 0.7, ya: BW.y, yb: BW.y });
    decks.push({ id: 'boardwalk-stair', type: 'ramp', ax: xs, az: BW.z0, bx: xs, bz: footZ, hw: 0.7, ya: BW.y, yb: Y, ground: true });
    bwStairs.push({ foot: [xs, footZ - 1.0], top: [xs, BW.z0 + 0.9] });
  }
  decks.push({ id: 'boardwalk', place: 'boardwalk', type: 'ramp', ax: BW.x0 + 0.35, az: (BW.z0 + BW.z1) / 2, bx: BW.x1 - 0.35, bz: (BW.z0 + BW.z1) / 2, hw: (BW.z1 - BW.z0) / 2 - 0.35, ya: BW.y, yb: BW.y });
  C.boardwalk = { x0: BW.x0, x1: BW.x1, z0: BW.z0, z1: BW.z1, y: BW.y, stairs: bwStairs };
  for (const [x, pose] of [[-630, 'photo'], [-625.2, 'lean'], [-618, 'point'], [-612, 'photo']]) who(pose, x, BW.z1 - 0.8, R(-0.3, 0.3), null, BW.y);
  who('lean', BW.x0 + 0.8, 121.6, -E, null, BW.y);

  // ================================================================ HARBOUR PLAZA (环港广场)
  const ML = C.site.mall, MH = 15.2, GH = 5.6;
  const cutN = [ML.cut + ML.z0, ML.z0], cutE = [ML.x1, ML.x1 - ML.cut];
  const poly = [[ML.x0, ML.z0], cutN, cutE, [ML.x1, ML.z1], [ML.x0, ML.z1]];
  const FX = { glass: new G.FacadeGB(), panel: new G.FacadeGB() };
  const TINT = col(0.94, 0.97, 1.0);
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const shops = Math.max(1, Math.round(len / 3.2)), bays = Math.max(1, Math.round(len / 2.0)), u = i * 60;
    FX.panel.wall(a, c, GY, GH, u, u + shops, 0, 1, TINT, [0.61 + i * 0.07, 1, 1, 0.2], [len / shops, GH - GY, 3, 0.35]);
    FX.glass.wall(a, c, GH, MH, u, u + bays, 1, 3, TINT, [0.23 + i * 0.11, 0.92, 0, 0.45], [len / bays, (MH - GH) / 2, 3, 0.5]);
    // parapet and a light line at the storey break
    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, ry = -Math.atan2(c[1] - a[1], c[0] - a[0]);
    box(dark, len + 0.3, 0.9, 0.35, mx, MH + 0.45, mz, ry);
    box(glow, len + 0.2, 0.07, 0.42, mx, GH + 0.05, mz, ry, 0, WARM);
    box(glow, len + 0.3, 0.06, 0.4, mx, MH + 0.93, mz, ry, 0, COOLW);
    // collision: thin wall pieces (the diagonal one in short steps), so the rooms inside stay walkable
    const n = Math.abs(c[0] - a[0]) > 0.5 && Math.abs(c[1] - a[1]) > 0.5 ? Math.ceil(len / 0.9) : 1;
    for (let k = 0; k < n; k++) {
      const x0 = lerp(a[0], c[0], k / n), x1 = lerp(a[0], c[0], (k + 1) / n), z0 = lerp(a[1], c[1], k / n), z1 = lerp(a[1], c[1], (k + 1) / n);
      add({ x0: Math.min(x0, x1) - 0.35, x1: Math.max(x0, x1) + 0.35, z0: Math.min(z0, z1) - 0.35, z1: Math.max(z0, z1) + 0.35, y0: 0, y1: MH, kind: 'mall' });
    }
  }
  {
    const g = new THREE.ShapeGeometry(new THREE.Shape(poly.map((p) => new THREE.Vector2(p[0], -p[1]))));
    g.rotateX(-Math.PI / 2); g.translate(0, MH, 0);
    tag(new THREE.Mesh(g, M.roof), 'harbour-plaza-roof');
  }
  // glazed barrel vault over the atrium
  {
    const c = makeCanvas(512, 256), x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffe2b4'); gr.addColorStop(0.5, '#fff1d6'); gr.addColorStop(1, '#ffd9a0');
    x.fillStyle = gr; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#2a2622';
    for (let i = 0; i <= 16; i++) x.fillRect(i * 32 - 2, 0, 4, 256);
    for (let j = 0; j <= 8; j++) x.fillRect(0, j * 32 - 1, 512, 3);
    const t = canvasTexture(c, true, 1, 1, 8);
    const vm = new THREE.MeshBasicMaterial({ map: t, color: col(1.45, 1.15, 0.8) });
    const g = new THREE.CylinderGeometry(7, 7, 30, 28, 1, true, 0, Math.PI); g.rotateZ(Math.PI / 2);
    const caps = [];
    for (const sx of [-1, 1]) { const cg = new THREE.CircleGeometry(7, 20, 0, Math.PI); cg.rotateY(sx * Math.PI / 2); caps.push({ geometry: cg, matrix: M4(-590 + sx * 15, MH, 70) }); }
    tag(new THREE.Mesh(mergeGeoms([{ geometry: g, matrix: M4(-590, MH, 70) }].concat(caps)), vm), 'harbour-plaza-skylight');
    box(dark, 31, 0.5, 14.8, -590, MH + 0.2, 70);
  }
  // roof plant
  for (const [x, z, w, d] of [[-610, 56, 5, 3], [-570, 76, 4, 3], [-612, 76, 3, 3]]) box(dark, w, 1.6, d, x, MH + 0.8, z);
  // entrance: portal, glass doors, canopy and the name
  {
    const dz = ML.z1;
    C.carve(-592.9, -587.1, dz - 0.6, dz + 0.6, /^mall$/);   // walk straight in through the portal
    box(dark, 6.6, 4.8, 0.4, -590, GY + 2.4, dz + 0.05);
    box(glow, 5.8, 4.2, 0.06, -590, GY + 2.15, dz + 0.26, 0, 0, col(1.5, 1.12, 0.74));
    for (const dx of [-1.45, 0, 1.45]) box(dark, 0.07, 4.2, 0.1, -590 + dx, GY + 2.15, dz + 0.29);
    box(dark, 5.8, 0.08, 0.1, -590, GY + 2.5, dz + 0.29);
    box(dark, 10, 0.2, 3.4, -590, 5.3, dz + 1.7);
    box(glow, 9.6, 0.04, 0.08, -590, 5.17, dz + 3.3, 0, 0, WARM);
    for (const dx of [-3.2, 0, 3.2]) box(glow, 0.5, 0.03, 0.5, -590 + dx, 5.18, dz + 1.7, 0, 0, WARM);
    pool(-590, dz + 2.4, 12, GY + 0.03);
    const c = makeCanvas(1024, 256), x = c.getContext('2d');
    x.fillStyle = '#0c1116'; x.fillRect(0, 0, 1024, 256);
    x.fillStyle = '#fff3dc'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '700 124px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'; x.fillText('环港广场', 512, 100);
    x.font = '600 40px "Helvetica Neue",Arial,sans-serif'; x.fillStyle = '#ffc77a'; x.fillText('H A R B O U R   P L A Z A', 512, 204);
    const t = canvasTexture(c, true, 1, 1, 8);
    const sm = new THREE.MeshBasicMaterial({ map: t, color: col(1.5, 1.4, 1.25) });
    const nameL = [{ geometry: new THREE.PlaneGeometry(13, 3.25), matrix: M4(-590, 8.4, dz + 0.3) }, { geometry: new THREE.PlaneGeometry(13, 3.25), matrix: M4(ML.x0 - 0.3, 9.6, 66, -Math.PI / 2) }];
    tag(new THREE.Mesh(mergeGeoms(nameL), sm), 'harbour-plaza-name');
    box(dark, 13.6, 3.7, 0.2, -590, 8.4, dz + 0.16); box(dark, 0.2, 3.7, 13.6, ML.x0 - 0.16, 9.6, 66);
    // forecourt: bollards, planters, people
    for (let i = 0; i < 9; i++) { const bx = -606 + i * 4; if (Math.abs(bx + 590) < 3) continue; cyl(steel, 0.09, 0.09, 0.8, bx, GY + 0.4, dz + 6.4); ball(glow, 0.05, bx, GY + 0.84, dz + 6.4, WARM); add({ x0: bx - 0.15, x1: bx + 0.15, z0: dz + 6.25, z1: dz + 6.55, y0: 0, y1: 1, kind: 'bollard' }); }
    for (const dx of [-7.5, 7.5]) {
      box(paint, 2.4, 0.6, 1.0, -590 + dx, GY + 0.3, dz + 1.3, 0, 0, col(0.2, 0.21, 0.23));
      for (const q of [-0.7, 0, 0.7]) ball(paint, 0.42, -590 + dx + q, GY + 0.82, dz + 1.3, col(0.2 + R(0, 0.06), 0.38 + R(0, 0.1), 0.18), 1, 0.85, 1);
      add({ x0: -590 + dx - 1.2, x1: -590 + dx + 1.2, z0: dz + 0.8, z1: dz + 1.8, y0: 0, y1: 1.4, kind: 'planter' });
    }
    for (const [x, z, pose, ry] of [[-594.5, dz + 3.2, 'talk', 1.3], [-593.6, dz + 3.4, 'talk', -1.8], [-586, dz + 2.6, 'phone', 0.2], [-583, dz + 4.6, 'stride', -1.5], [-599, dz + 4.2, 'stride', 1.5], [-590.6, dz + 5.2, 'stride', Math.PI], [-579.5, dz + 2.2, 'stand', 0.4]]) who(pose, x, z, ry, null, GY);
  }
  for (const k of Object.keys(FX)) if (FX[k].count) tag(new THREE.Mesh(FX[k].build(), M.fx[k]), 'harbour-plaza-facade-' + k);

  // ================================================================ build
  tag(new THREE.Mesh(mergeGeoms(planks), plankM), 'riverside-wharf-deck');
  merged(stone, stoneM, 'riverside-wharf-stonework');
  merged(piles, pileM, 'riverside-wharf-piles');
  merged(steel, steelM, 'riverside-steelwork');
  merged(dark, darkM, 'riverside-dark-metal');
  merged(treadL, plankM, 'riverside-boardwalk-treads');
  merged(paint, paintM, 'riverside-props', true);
  merged(glow, glowM, 'riverside-lights', true);
  merged(glassL, glassM, 'riverside-glass');
  merged(signL, new THREE.MeshBasicMaterial({ map: signTex, color: col(1.25, 1.2, 1.1), side: THREE.DoubleSide }), 'riverside-signs');
  const pm = merged(pools, poolM, 'riverside-light-pools'); pm.renderOrder = 2; G.noReflect.push(pm);
  const crowd = P.crowd(people, 'riverside-people', 0); scene.add(crowd);

  // ================================================================ exports
  C.platform = { x0: W.x0, x1: W.x1, z0: W.z0, z1: W.z1, y: Y };
  // floor height on and around the wharf: the deck, or the three steps on its land side
  C.wharfY = (x, z) => {
    if (x >= W.x0 && x <= W.x1 && z >= W.z0 && z <= W.z1) return Y;
    if (x < W.x0 || z > EZ) return null;
    const d = Math.max(W.z0 - z, x - W.x1);
    return d < 0.8 ? lerp(Y, GY, clamp(d / 0.8, 0, 1)) : null;
  };
  G.t = G.t || {}; G.t.riverside = performance.now();
})();
