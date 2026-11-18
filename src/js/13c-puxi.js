/* 13c-puxi — the far bank made walkable. The last ferry lands at 十八埠 on the
   west-bank side; behind 江滨东二路 is 永安里, a 1920s 石库门 lane, and at the end of
   it the six-storey walk-up where the night ends, in a rented room on the 4th
   floor. Also the double-ended ferry that makes the crossing (C.ferryRide).
   Light in the lane is baked: every vertex carries the warm light of the wall
   lamps, shop windows and doorways near it (attribute aGlow), which the lane
   materials add as emission, so the lane reads lit without real lights. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, scene = G.scene, C = G.CITY;
  const { R, RI, pick, clamp, lerp, M4, roundedBox, mergeGeoms, makeCanvas, canvasTexture } = G.util;
  const add = C.add, TAU = Math.PI * 2, GY = 0.17, PI = Math.PI;
  const I4 = new THREE.Matrix4();
  const col = (c) => (c && c.isColor ? c : new THREE.Color(c));
  const rgb = (r, g, b) => new THREE.Color(r, g, b);
  const CJK = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
  const SERIF = '"Songti SC","STSong","SimSun","Noto Serif CJK SC",serif';

  // ================================================================ baked light
  const LAMPS = [];
  const lamp = (x, y, z, c, k, rad) => LAMPS.push({ x, y, z, c, k, rad });
  function bakeGlow(g, lamps) {
    const p = g.attributes.position, n = g.attributes.normal, cnt = p.count, bb = g.boundingBox;
    const out = new Float32Array(cnt * 3);
    const L = lamps.filter((l) => { const m = l.rad * 4; return l.x > bb.min.x - m && l.x < bb.max.x + m && l.y > bb.min.y - m && l.y < bb.max.y + m && l.z > bb.min.z - m && l.z < bb.max.z + m; });
    if (L.length) for (let i = 0; i < cnt; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
      let r = 0, gg = 0, b = 0;
      for (const l of L) {
        const dx = l.x - x, dy = l.y - y, dz = l.z - z, d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2) + 1e-4;
        const cut = 1 - d / (l.rad * 4); if (cut <= 0) continue;
        const lam = (dx * nx + dy * ny + dz * nz) / d; if (lam < -0.05) continue;
        const f = l.k / (1 + d2 / (l.rad * l.rad)) * (0.2 + 0.8 * Math.max(0, lam)) * cut * cut;
        r += l.c[0] * f; gg += l.c[1] * f; b += l.c[2] * f;
      }
      out[i * 3] = Math.min(r, 2.2); out[i * 3 + 1] = Math.min(gg, 2.2); out[i * 3 + 2] = Math.min(b, 2.2);
    }
    g.setAttribute('aGlow', new THREE.BufferAttribute(out, 3));
  }
  function gmat(o) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true, roughness: 0.8, metalness: 0.0, envMapIntensity: 0.8 }, o));
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aGlow;\nvarying vec3 vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = aGlow;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vGlow;').replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * vGlow;');
    };
    m.customProgramCacheKey = () => 'puxi-glow';
    m.userData.surfaceProcedural = true;
    return m;
  }

  // ================================================================ geometry bins
  // pieces are baked to their final coordinates; tile = metres per texture repeat
  function worldUV(g, su, sv) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (ay > 0.72) uv.setXY(i, x / su, z / sv); else if (ax > az) uv.setXY(i, z / su, y / sv); else uv.setXY(i, x / su, y / sv);
    }
  }
  class Bin {
    constructor() { this.items = []; }
    geo(g, m, color, tile) {
      let q = g.index ? g.toNonIndexed() : g.clone();
      if (g !== q) g.dispose();
      if (m) q.applyMatrix4(m);
      if (!q.attributes.uv) q.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(q.attributes.position.count * 2), 2));
      if (tile) worldUV(q, tile[0], tile[1] || tile[0]);
      this.items.push({ geometry: q, matrix: I4, color: col(color === undefined ? 0xffffff : color) });
      return this;
    }
    box(w, h, d, m, color, tile, seg) {
      const s = seg || 99;
      return this.geo(new THREE.BoxGeometry(w, h, d, Math.max(1, Math.ceil(w / s)), Math.max(1, Math.ceil(h / s)), Math.max(1, Math.ceil(d / s))), m, color, tile);
    }
    quad(w, h, m, rect, color) {
      const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, rect.u0 + uv.getX(i) * (rect.u1 - rect.u0), rect.v0 + uv.getY(i) * (rect.v1 - rect.v0));
      return this.geo(g, m, color);
    }
    build(name, mat, o = {}) {
      if (!this.items.length) return null;
      const g = mergeGeoms(this.items, { vertexColors: true });
      for (const it of this.items) it.geometry.dispose();
      this.items = [];
      if (o.glow) bakeGlow(g, o.glow);
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = name; mesh.userData.passable = true; mesh.userData.surfaceProcedural = true;
      mesh.receiveShadow = o.receive !== false; mesh.castShadow = !!o.cast;
      (o.parent || scene).add(mesh);
      return mesh;
    }
  }
  const bins = (keys) => Object.fromEntries(keys.map((k) => [k, new Bin()]));
  // a box between two points (rods, wires, poles, frame tubes)
  const _up = new THREE.Vector3(0, 1, 0);
  function rodM(a, b, base) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b), dir = vb.clone().sub(va), len = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(_up, dir.normalize());
    const m = new THREE.Matrix4().compose(va.add(vb).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
    return base ? base.clone().multiply(m) : m;
  }
  const rod = (bin, a, b, r, color, base) => bin.geo(new THREE.BoxGeometry(r, 1, r), rodM(a, b, base), color);
  const tube = (bin, a, b, r, color, base, seg = 8) => bin.geo(new THREE.CylinderGeometry(r, r, 1, seg, 1, true), rodM(a, b, base), color);
  const lm = (base, x, y, z, ry = 0, rx = 0, rz = 0) => base.clone().multiply(M4(x, y, z, ry, rx, rz));

  // ================================================================ textures
  function noiseFill(x, w, h, base, amp, n) {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { const v = R(-1, 1); x.fillStyle = v > 0 ? `rgba(255,255,255,${(v * amp).toFixed(3)})` : `rgba(0,0,0,${(-v * amp).toFixed(3)})`; x.fillRect(R(0, w), R(0, h), R(2, 10), R(2, 10)); }
  }
  function streaks(x, w, h, n, a) { for (let i = 0; i < n; i++) { const sx = R(0, w), len = R(h * 0.2, h); const gr = x.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(20,18,14,${a})`); gr.addColorStop(1, 'rgba(20,18,14,0)'); x.fillStyle = gr; x.fillRect(sx, 0, R(2, 7), len); } }
  const TX = {};
  { // grey 青砖 with red brick string courses: 2 m square
    const c = makeCanvas(512, 512), x = c.getContext('2d');
    x.fillStyle = '#8a867d'; x.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 32; r++) {
      const red = r % 11 === 5 || r % 11 === 6;
      for (let k = -1; k < 9; k++) {
        const v = R(-1, 1), bx = k * 64 + (r % 2 ? 32 : 0);
        x.fillStyle = red ? `rgb(${(126 + v * 16) | 0},${(58 + v * 9) | 0},${(44 + v * 7) | 0})` : `rgb(${(80 + v * 13) | 0},${(84 + v * 13) | 0},${(88 + v * 14) | 0})`;
        x.fillRect(bx + 2, r * 16 + 2, 60, 13);
        x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(bx + 2, r * 16 + 2, 60, 2);
      }
    }
    streaks(x, 512, 512, 26, 0.10);
    TX.brick = canvasTexture(c, true, 1, 1, 8);
  }
  { // lime plaster of the 1980s walk-up, rain-stained: 4 m square
    const c = makeCanvas(512, 512), x = c.getContext('2d');
    noiseFill(x, 512, 512, '#bdb5a5', 0.05, 900); streaks(x, 512, 512, 40, 0.12);
    TX.plaster = canvasTexture(c, true, 1, 1, 8);
  }
  { // red clay machine tiles: 2 m square, 8 courses
    const c = makeCanvas(512, 512), x = c.getContext('2d');
    x.fillStyle = '#2c1a14'; x.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 8; r++) for (let k = -1; k < 11; k++) {
      const v = R(-1, 1), tx = k * 51 + (r % 2 ? 25 : 0), ty = r * 64;
      const gr = x.createLinearGradient(0, ty, 0, ty + 62);
      gr.addColorStop(0, `rgb(${(92 + v * 14) | 0},${(44 + v * 8) | 0},${(34 + v * 6) | 0})`); gr.addColorStop(1, `rgb(${(58 + v * 10) | 0},${(28 + v * 6) | 0},${(22 + v * 5) | 0})`);
      x.fillStyle = gr; x.fillRect(tx + 1, ty + 1, 49, 61);
      x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(tx + 22, ty + 4, 6, 56);
    }
    for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${40 + RI(0, 20)},${50 + RI(0, 20)},30,0.25)`; x.beginPath(); x.arc(R(0, 512), R(0, 512), R(4, 16), 0, TAU); x.fill(); }
    TX.roof = canvasTexture(c, true, 1, 1, 8);
  }
  { // 石库门 stone (a warm limestone render): 1 m square
    const c = makeCanvas(256, 256), x = c.getContext('2d');
    noiseFill(x, 256, 256, '#b2a68e', 0.06, 500); streaks(x, 256, 256, 10, 0.08);
    TX.stone = canvasTexture(c, true, 1, 1, 8);
  }
  { // 弹格路 cobbles, wet: 1.5 m square
    const c = makeCanvas(512, 512), x = c.getContext('2d');
    x.fillStyle = '#1c1c1d'; x.fillRect(0, 0, 512, 512);
    for (let r = 0; r < 14; r++) for (let k = 0; k < 13; k++) {
      const cx = k * 40 + (r % 2 ? 20 : 0) + R(-4, 4), cy = r * 37 + 18 + R(-3, 3), v = R(-1, 1);
      x.fillStyle = `rgb(${(66 + v * 14) | 0},${(66 + v * 13) | 0},${(68 + v * 12) | 0})`;
      x.beginPath(); x.ellipse(cx, cy, R(15, 19), R(13, 16), R(0, 3), 0, TAU); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.07)'; x.beginPath(); x.ellipse(cx - 4, cy - 4, 8, 5, 0.4, 0, TAU); x.fill();
    }
    TX.cobble = canvasTexture(c, true, 1, 1, 8);
  }
  { // trowelled concrete with joints: 3 m square
    const c = makeCanvas(512, 512), x = c.getContext('2d');
    noiseFill(x, 512, 512, '#77746d', 0.05, 700);
    x.fillStyle = 'rgba(0,0,0,0.35)'; x.fillRect(0, 0, 512, 3); x.fillRect(0, 0, 3, 512);
    TX.conc = canvasTexture(c, true, 1, 1, 8);
  }
  { // black-lacquered 石库门 leaves with brass rings
    const c = makeCanvas(256, 448), x = c.getContext('2d');
    x.fillStyle = '#111011'; x.fillRect(0, 0, 256, 448);
    for (const lx of [8, 132]) {
      x.fillStyle = '#1b1a1a'; x.fillRect(lx, 8, 116, 432);
      x.strokeStyle = '#2a2726'; x.lineWidth = 3;
      for (const [py, ph] of [[24, 150], [190, 70], [276, 150]]) x.strokeRect(lx + 14, py, 88, ph);
      x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(lx + 4, 8, 6, 432);
    }
    x.fillStyle = '#060606'; x.fillRect(124, 0, 8, 448);
    for (const rx of [110, 146]) { x.strokeStyle = '#b08a3e'; x.lineWidth = 5; x.beginPath(); x.arc(rx, 228, 13, 0, TAU); x.stroke(); x.fillStyle = '#8a6a2e'; x.beginPath(); x.arc(rx, 214, 6, 0, TAU); x.fill(); }
    TX.door = canvasTexture(c, true, 1, 1, 8);
  }
  { // 2F casements of the lane houses: 4 cells (warm, fluorescent, dark, red curtain)
    const a = makeCanvas(512, 256), e = makeCanvas(512, 256), x = a.getContext('2d'), y = e.getContext('2d');
    y.fillStyle = '#000'; y.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 4; i++) {
      const x0 = i * 128;
      x.fillStyle = '#3b281b'; x.fillRect(x0, 0, 128, 256);
      const lit = i !== 2, warm = i === 0 || i === 3;
      for (const [gx, gy, gw, gh] of [[x0 + 12, 12, 50, 72], [x0 + 66, 12, 50, 72], [x0 + 12, 90, 50, 72], [x0 + 66, 90, 50, 72], [x0 + 12, 168, 50, 76], [x0 + 66, 168, 50, 76]]) {
        if (lit) {
          const gr = x.createLinearGradient(0, gy, 0, gy + gh);
          gr.addColorStop(0, warm ? '#f6d095' : '#d9ecf0'); gr.addColorStop(1, warm ? '#c78549' : '#97b8c0');
          x.fillStyle = gr; x.fillRect(gx, gy, gw, gh); y.fillStyle = gr; y.fillRect(gx, gy, gw, gh);
        } else { x.fillStyle = '#0d1116'; x.fillRect(gx, gy, gw, gh); x.fillStyle = 'rgba(140,160,180,0.10)'; x.fillRect(gx + 4, gy + 4, 10, gh - 8); }
      }
      if (lit) { // curtains drawn half across, the bright gap in the middle
        const cc = i === 3 ? 'rgba(150,40,34,0.88)' : i === 1 ? 'rgba(210,214,200,0.6)' : 'rgba(180,120,70,0.75)';
        for (const [cx, cw] of [[x0 + 12, 34], [x0 + 82, 34]]) { x.fillStyle = cc; x.fillRect(cx, 12, cw, 232); y.fillStyle = i === 3 ? 'rgba(90,20,14,0.9)' : 'rgba(70,46,24,0.7)'; y.fillRect(cx, 12, cw, 232); }
        x.fillStyle = 'rgba(30,20,10,0.25)'; for (let k = 0; k < 8; k++) x.fillRect(x0 + 14 + k * 4, 12, 1, 232);
      }
    }
    TX.winS = canvasTexture(a, true, 1, 1, 8); TX.winSe = canvasTexture(e, true, 1, 1, 8);
  }
  { // steel windows of the walk-up with flat 防盗窗 bars: warm, cool, dark, TV blue
    const a = makeCanvas(512, 128), e = makeCanvas(512, 128), x = a.getContext('2d'), y = e.getContext('2d');
    y.fillStyle = '#000'; y.fillRect(0, 0, 512, 128);
    const tones = [['#f2c98a', '#b97a42'], ['#e2eef0', '#9fbcc4'], null, ['#7fa6e8', '#2c4a8a']];
    for (let i = 0; i < 4; i++) {
      const x0 = i * 128;
      x.fillStyle = '#69756e'; x.fillRect(x0, 0, 128, 128);
      for (const [gx, gy, gw, gh] of [[x0 + 8, 8, 36, 112], [x0 + 46, 8, 36, 112], [x0 + 84, 8, 36, 112]]) {
        if (tones[i]) { const gr = x.createLinearGradient(0, gy, 0, gy + gh); gr.addColorStop(0, tones[i][0]); gr.addColorStop(1, tones[i][1]); x.fillStyle = gr; x.fillRect(gx, gy, gw, gh); y.fillStyle = gr; y.fillRect(gx, gy, gw, gh); }
        else { x.fillStyle = '#0c1014'; x.fillRect(gx, gy, gw, gh); }
      }
      if (tones[i] && i !== 3) { x.fillStyle = 'rgba(160,110,70,0.7)'; x.fillRect(x0 + 8, 8, 30, 112); y.fillStyle = 'rgba(60,40,20,0.8)'; y.fillRect(x0 + 8, 8, 30, 112); }
      x.fillStyle = '#2b302e'; y.fillStyle = '#000';
      for (let k = 0; k < 9; k++) { x.fillRect(x0 + 6 + k * 14.5, 0, 3, 128); y.fillRect(x0 + 6 + k * 14.5, 0, 3, 128); }
      x.fillRect(x0, 60, 128, 4); y.fillRect(x0, 60, 128, 4);
    }
    TX.winL = canvasTexture(a, true, 1, 1, 8); TX.winLe = canvasTexture(e, true, 1, 1, 8);
  }
  { // 地板革 vinyl floor of the rented room
    const c = makeCanvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#7a5a3c'; x.fillRect(0, 0, 256, 256);
    for (let r = 0; r < 8; r++) { const v = R(-1, 1); x.fillStyle = `rgb(${(128 + v * 14) | 0},${(92 + v * 10) | 0},${(60 + v * 8) | 0})`; x.fillRect(0, r * 32 + 1, 256, 30); for (let k = 0; k < 20; k++) { x.fillStyle = 'rgba(60,36,20,0.25)'; x.fillRect(R(0, 256), r * 32 + R(2, 28), R(20, 60), 1); } x.fillStyle = 'rgba(40,24,12,0.6)'; x.fillRect((r * 97) % 256, r * 32, 2, 32); }
    TX.floor = canvasTexture(c, true, 1, 1, 8);
  }

  // ---- one sign atlas, shelf-packed
  const SIGNS = {};
  const atlas = makeCanvas(1024, 1024), ax = atlas.getContext('2d');
  { let px = 0, py = 0, rowH = 0;
    const sign = (key, w, h, draw) => {
      if (px + w > 1024) { px = 0; py += rowH + 2; rowH = 0; }
      ax.save(); ax.translate(px, py); ax.beginPath(); ax.rect(0, 0, w, h); ax.clip(); draw(ax, w, h); ax.restore();
      SIGNS[key] = { u0: px / 1024, u1: (px + w) / 1024, v0: 1 - (py + h) / 1024, v1: 1 - py / 1024 };
      px += w + 2; rowH = Math.max(rowH, h);
    };
    const T = (x, s, X, Y, font, color, align = 'center') => { x.font = font; x.fillStyle = color; x.textAlign = align; x.textBaseline = 'middle'; x.fillText(s, X, Y); };
    const carved = (x, w, h, text, size) => {
      noiseFill(x, w, h, '#b6aa92', 0.05, 120); x.strokeStyle = '#7c705c'; x.lineWidth = 4; x.strokeRect(5, 5, w - 10, h - 10);
      T(x, text, w / 2 + 2, h / 2 + 2, `700 ${size}px ${SERIF}`, 'rgba(255,250,235,0.5)'); T(x, text, w / 2, h / 2, `700 ${size}px ${SERIF}`, '#3d342a');
    };
    sign('ferryBig', 768, 160, (x, w, h) => { x.fillStyle = '#120a0a'; x.fillRect(0, 0, w, h); x.shadowColor = '#ff3a2a'; x.shadowBlur = 18; T(x, '十 八 埠 渡 口', w / 2, h / 2 + 4, `800 112px ${CJK}`, '#ff6a4e'); x.shadowBlur = 0; T(x, '十 八 埠 渡 口', w / 2, h / 2 + 4, `800 112px ${CJK}`, '#ffd2c0'); });
    sign('arch', 512, 160, (x, w, h) => { carved(x, w, h, '永 安 里', 104); T(x, '一九二八', w - 56, h - 26, `600 22px ${SERIF}`, '#4a4034'); });
    sign('ferryGate', 512, 128, (x, w, h) => { x.fillStyle = '#0b2634'; x.fillRect(0, 0, w, h); x.strokeStyle = '#c9d8e0'; x.lineWidth = 4; x.strokeRect(4, 4, w - 8, h - 8); T(x, '十八埠渡口', w / 2, 50, `700 48px ${CJK}`, '#eef6f8'); T(x, 'SHIBABU FERRY · 往东晟路', w / 2, 100, '500 22px "SF Mono",monospace', '#8fb4c9'); });
    sign('shop24', 512, 128, (x, w, h) => { x.fillStyle = '#0d6b4a'; x.fillRect(0, 0, w, h); x.fillStyle = '#f4f8f2'; x.fillRect(0, 96, w, 32); T(x, '好邻里', 170, 50, `800 64px ${CJK}`, '#ffffff'); T(x, '24H', 400, 50, '800 60px "Helvetica Neue",Arial,sans-serif', '#ffd84a'); T(x, '便利店 · 热饮 · 关东煮', w / 2, 112, `600 20px ${CJK}`, '#0d6b4a'); });
    sign('storeInt', 256, 128, (x, w, h) => { x.fillStyle = '#f3f5ec'; x.fillRect(0, 0, w, h); for (let r = 0; r < 4; r++) { x.fillStyle = '#c9ccc2'; x.fillRect(0, 20 + r * 27, w, 3); for (let k = 0; k < 22; k++) { x.fillStyle = pick(['#d8432f', '#f2b630', '#3a8ad4', '#2fa86a', '#e86aa0', '#ffffff', '#8a5a2a']); x.fillRect(4 + k * 11.5, 4 + r * 27, 9, 15); } } });
    sign('tobacco', 384, 96, (x, w, h) => { x.fillStyle = '#a81e18'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f2d36a'; x.lineWidth = 3; x.strokeRect(5, 5, w - 10, h - 10); T(x, '永安烟杂店', w / 2, h / 2 + 2, `800 54px ${CJK}`, '#ffe17a'); });
    sign('noodle', 384, 96, (x, w, h) => { x.fillStyle = '#efe4c8'; x.fillRect(0, 0, w, h); T(x, '老王面馆', w / 2 - 30, h / 2, `800 56px ${SERIF}`, '#3a1e12'); T(x, '葱油拌面 · 小馄饨', w - 70, h - 18, `600 14px ${CJK}`, '#8a2a18'); });
    sign('barber', 256, 96, (x, w, h) => { x.fillStyle = '#1b2b4a'; x.fillRect(0, 0, w, h); T(x, '新风理发', w / 2, h / 2, `800 44px ${CJK}`, '#f0f4ff'); });
    sign('repair', 256, 96, (x, w, h) => { x.fillStyle = '#d6d2c4'; x.fillRect(0, 0, w, h); T(x, '修车 · 配钥匙', w / 2, 38, `800 34px ${CJK}`, '#2a2a2a'); T(x, '电瓶车维修 充气', w / 2, 74, `600 18px ${CJK}`, '#a02a1a'); });
    sign('timetable', 256, 256, (x, w, h) => { x.fillStyle = '#0a1216'; x.fillRect(0, 0, w, h); x.strokeStyle = '#6fd8ff'; x.lineWidth = 3; x.strokeRect(4, 4, w - 8, h - 8); T(x, '十八埠 — 东晟路', w / 2, 40, `700 26px ${CJK}`, '#9fe8ff'); T(x, '首班 05:00', w / 2, 96, `600 24px ${CJK}`, '#e8f4f8'); T(x, '末班 23:30', w / 2, 136, `700 26px ${CJK}`, '#ffd27a'); T(x, '航程约 6 分钟', w / 2, 180, `500 20px ${CJK}`, '#9fb8c0'); T(x, '票价 2 元 · 可带电瓶车', w / 2, 216, `500 18px ${CJK}`, '#9fb8c0'); });
    sign('boatName', 512, 96, (x, w, h) => { x.fillStyle = '#1f5a45'; x.fillRect(0, 0, w, h); T(x, '申渡 7 号', 160, h / 2, `800 52px ${CJK}`, '#f4f6f0'); T(x, 'SHENDU No.7', 380, h / 2, '700 30px "Helvetica Neue",Arial,sans-serif', '#d8e8de'); });
    sign('boatRoute', 256, 64, (x, w, h) => { x.fillStyle = '#f2f2ec'; x.fillRect(0, 0, w, h); T(x, '东晟路 ⇄ 十八埠', w / 2, h / 2, `700 28px ${CJK}`, '#1f5a45'); });
    sign('notice', 256, 160, (x, w, h) => { x.fillStyle = '#e8e4d8'; x.fillRect(0, 0, w, h); x.fillStyle = '#a8231b'; x.fillRect(0, 0, w, 30); T(x, '永安里社区宣传栏', w / 2, 15, `700 18px ${CJK}`, '#fff'); [['#f6f0d0', '防汛防台 提示'], ['#d8ecf4', '垃圾分类 每晚 19-21 时'], ['#f4dcd4', '旧改征询 第二轮']].forEach(([bg, t], i) => { x.fillStyle = bg; x.fillRect(8 + i * 82, 40, 76, 112); x.fillStyle = '#333'; x.font = `600 11px ${CJK}`; x.textAlign = 'left'; x.fillText(t, 12 + i * 82, 54, 70); for (let k = 0; k < 8; k++) x.fillRect(12 + i * 82, 66 + k * 10, R(40, 66), 2); }); });
    sign('bins', 384, 64, (x, w, h) => { x.fillStyle = '#1d4f7a'; x.fillRect(0, 0, w, h); T(x, '垃圾分类投放点', w / 2, h / 2, `700 34px ${CJK}`, '#ffffff'); });
    sign('hydrant', 128, 160, (x, w, h) => { x.fillStyle = '#b01c16'; x.fillRect(0, 0, w, h); x.strokeStyle = '#e8e0d0'; x.lineWidth = 4; x.strokeRect(8, 8, w - 16, h - 16); T(x, '消火栓', w / 2, 52, `800 30px ${CJK}`, '#fff'); T(x, '119', w / 2, 104, '800 34px Arial', '#fff'); });
    sign('ads', 128, 128, (x, w, h) => { x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, w, h); x.fillStyle = '#5b5d58'; x.fillRect(0, 0, w, h); [['开锁换锁', 8, 8], ['通下水道', 64, 30], ['房屋出租', 14, 64], ['高价回收', 60, 92]].forEach(([t, X, Y]) => { x.fillStyle = '#f2f0e8'; x.fillRect(X, Y, 56, 28); x.fillStyle = '#c0281c'; x.font = `700 12px ${CJK}`; x.textAlign = 'left'; x.fillText(t, X + 3, Y + 11); x.fillStyle = '#222'; x.font = '600 9px monospace'; x.fillText('139****' + RI(1000, 9999), X + 3, Y + 23); }); });
    sign('mail', 128, 96, (x, w, h) => { x.fillStyle = '#2e5a3a'; x.fillRect(0, 0, w, h); for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { x.strokeStyle = '#1a3322'; x.lineWidth = 2; x.strokeRect(4 + k * 30, 4 + r * 30, 28, 28); x.fillStyle = '#e8e4d0'; x.fillRect(8 + k * 30, 8 + r * 30, 14, 6); x.fillStyle = '#0a1a10'; x.fillRect(8 + k * 30, 20 + r * 30, 20, 3); } });
    sign('calendar', 96, 128, (x, w, h) => { x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, w, h); x.fillStyle = '#c0281c'; x.fillRect(0, 0, w, 34); T(x, '十一月', w / 2, 17, `700 18px ${CJK}`, '#fff'); x.fillStyle = '#333'; for (let r = 0; r < 5; r++) for (let k = 0; k < 7; k++) x.fillRect(6 + k * 12.4, 42 + r * 16, 8, 8); });
    sign('poster', 128, 176, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#20324a'); gr.addColorStop(1, '#d88a4a'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = '#0b0f16'; for (let k = 0; k < 9; k++) x.fillRect(k * 14, h - 40 - R(10, 80), 12, 200); T(x, '外 滩', w / 2, 30, `700 26px ${SERIF}`, '#f4e8d0'); });
    sign('laptop', 128, 80, (x, w, h) => { x.fillStyle = '#1a2a44'; x.fillRect(0, 0, w, h); x.fillStyle = '#e8eef8'; x.fillRect(10, 10, 74, 52); x.fillStyle = '#4a7ad8'; x.fillRect(10, 10, 74, 8); x.fillStyle = '#9aa6b8'; for (let k = 0; k < 6; k++) x.fillRect(14, 24 + k * 6, R(30, 66), 2); });
    sign('hoard', 512, 128, (x, w, h) => { x.fillStyle = '#e8ecee'; x.fillRect(0, 0, w, h); x.fillStyle = '#1d5a9a'; x.fillRect(0, 0, w, 40); T(x, '滨江防汛墙改造工程', w / 2, 21, `700 26px ${CJK}`, '#fff'); T(x, '施工期间 请绕行 江滨东二路', w / 2, 80, `600 30px ${CJK}`, '#1d3a5a'); x.fillStyle = '#3a3f42'; x.fillRect(0, 112, w, 16); });
    sign('shutter', 128, 128, (x, w, h) => { x.fillStyle = '#8a8c88'; x.fillRect(0, 0, w, h); for (let k = 0; k < 32; k++) { x.fillStyle = k % 2 ? '#6a6c68' : '#a2a4a0'; x.fillRect(0, k * 4, w, 2); } streaks(x, w, h, 6, 0.15); });
    sign('cL', 48, 256, (x, w, h) => { x.fillStyle = '#a82a20'; x.fillRect(0, 0, w, h); ['天', '增', '岁', '月'].forEach((c, i) => T(x, c, w / 2, 32 + i * 62, `800 36px ${SERIF}`, '#1a0a06')); });
    sign('cR', 48, 256, (x, w, h) => { x.fillStyle = '#a82a20'; x.fillRect(0, 0, w, h); ['春', '满', '乾', '坤'].forEach((c, i) => T(x, c, w / 2, 32 + i * 62, `800 36px ${SERIF}`, '#1a0a06')); });
    sign('fu', 72, 72, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#b02a20'; x.translate(w / 2, h / 2); x.rotate(PI / 4); x.fillRect(-24, -24, 48, 48); x.rotate(-PI / 4); T(x, '福', 0, 2, `800 38px ${SERIF}`, '#1a0a06'); });
    ['紫气东来', '安居乐业', '福寿康宁', '竹苞松茂'].forEach((t, i) => sign('tihe' + i, 256, 72, (x, w, h) => carved(x, w, h, t, 44)));
    for (let n = 1; n <= 30; n++) sign('plate' + n, 96, 60, (x, w, h) => { x.fillStyle = '#1d4f9a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f2f4f8'; x.lineWidth = 3; x.strokeRect(4, 4, w - 8, h - 8); T(x, '永安里', w / 2, 18, `600 13px ${CJK}`, '#f2f4f8'); T(x, n + '号', w / 2, 40, `800 22px ${CJK}`, '#ffffff'); });
    sign('plateXH', 128, 60, (x, w, h) => { x.fillStyle = '#1d4f9a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f2f4f8'; x.lineWidth = 3; x.strokeRect(4, 4, w - 8, h - 8); T(x, '新河路', w / 2, 18, `600 13px ${CJK}`, '#fff'); T(x, '101号', w / 2, 40, `800 22px ${CJK}`, '#fff'); });
    sign('lane2', 192, 72, (x, w, h) => { x.fillStyle = '#1d4f9a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#fff'; x.lineWidth = 3; x.strokeRect(4, 4, w - 8, h - 8); T(x, '永安里 后弄', w / 2, 26, `700 24px ${CJK}`, '#fff'); T(x, '通 新河路', w / 2, 52, `600 16px ${CJK}`, '#dfe8f8'); });
  }
  TX.signs = canvasTexture(atlas, true, 1, 1, 8);

  // ================================================================ materials
  const MAT = {
    brick: gmat({ map: TX.brick, roughness: 0.88 }),
    plaster: gmat({ map: TX.plaster, roughness: 0.9 }),
    roof: gmat({ map: TX.roof, roughness: 0.62, envMapIntensity: 1.1 }),
    stone: gmat({ map: TX.stone, roughness: 0.82 }),
    cobble: gmat({ map: TX.cobble, roughness: 0.3, metalness: 0.05, envMapIntensity: 1.5 }),
    conc: gmat({ map: TX.conc, roughness: 0.55, envMapIntensity: 1.1 }),
    paint: gmat({ roughness: 0.55, envMapIntensity: 1.0 }),
    metal: gmat({ roughness: 0.38, metalness: 0.65, envMapIntensity: 1.2 }),
    door: gmat({ map: TX.door, roughness: 0.32, envMapIntensity: 1.2 }),
    winS: gmat({ map: TX.winS, emissiveMap: TX.winSe, emissive: 0xffffff, emissiveIntensity: 1.05, roughness: 0.22, envMapIntensity: 1.3 }),
    winL: gmat({ map: TX.winL, emissiveMap: TX.winLe, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.25, envMapIntensity: 1.2 }),
    signFlat: gmat({ map: TX.signs, roughness: 0.7 }),
    signCut: gmat({ map: TX.signs, roughness: 0.7, alphaTest: 0.5, transparent: false }),
    signLit: new THREE.MeshStandardMaterial({ map: TX.signs, emissiveMap: TX.signs, emissive: 0xffffff, emissiveIntensity: 1.25, roughness: 0.45 }),
    floor: gmat({ map: TX.floor, roughness: 0.42, envMapIntensity: 0.9 }),
    cloth: gmat({ roughness: 0.95, side: THREE.DoubleSide }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa8c0cc, transparent: true, opacity: 0.16, roughness: 0.04, metalness: 0.3, depthWrite: false }),
    puddle: gmat({ color: 0x0c0d0f, roughness: 0.04, metalness: 0.2, envMapIntensity: 1.8 }),
  };
  for (const k of ['signLit', 'glow', 'glass']) MAT[k].userData.surfaceProcedural = true;

  const DARK = 0x18191b, WHITE = 0xffffff;

  // ================================================================ props shared by the lane and the boat
  function ebike(B, m0, colr, o = {}) {
    const P = (x, y, z, r = 0, rx = 0, rz = 0) => lm(m0, x, y, z, r, rx, rz);
    B.paint.geo(roundedBox(0.34, 0.3, 1.0, 0.08, 2), P(0, 0.47, -0.08), colr);
    B.paint.geo(roundedBox(0.32, 0.58, 0.1, 0.04, 2), P(0, 0.74, 0.45, 0, -0.22), colr);
    B.paint.geo(roundedBox(0.28, 0.1, 0.5, 0.04, 2), P(0, 0.79, -0.22), DARK);
    B.paint.geo(new THREE.BoxGeometry(0.32, 0.05, 0.46), P(0, 0.31, 0.18), 0x2a2b2d);
    for (const z of [-0.56, 0.58]) {
      B.paint.geo(new THREE.CylinderGeometry(0.22, 0.22, 0.09, 20), P(0, 0.22, z, 0, 0, PI / 2), DARK);
      B.metal.geo(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12), P(0, 0.22, z, 0, 0, PI / 2), 0x9aa0a6);
    }
    rod(B.metal, [0, 0.62, 0.5], [0, 1.0, 0.42], 0.04, 0x55595e, m0);
    B.metal.geo(new THREE.BoxGeometry(0.58, 0.035, 0.035), P(0, 1.02, 0.42), 0x2a2c30);
    for (const s of [-1, 1]) { rod(B.metal, [s * 0.2, 1.02, 0.42], [s * 0.27, 1.22, 0.45], 0.015, 0x2a2c30, m0); B.paint.geo(new THREE.BoxGeometry(0.1, 0.06, 0.02), P(s * 0.28, 1.24, 0.45), DARK); }
    B.glow.geo(new THREE.SphereGeometry(0.06, 10, 8), P(0, 0.93, 0.53), o.on ? rgb(2.2, 2.1, 1.8) : rgb(0.5, 0.5, 0.46));
    B.glow.geo(new THREE.BoxGeometry(0.16, 0.05, 0.02), P(0, 0.58, -0.6), rgb(o.on ? 2.6 : 0.5, 0.08, 0.06));
    B.metal.geo(new THREE.BoxGeometry(0.3, 0.025, 0.3), P(0, 0.66, -0.56), 0x3a3d40);
    if (o.quilt) { // the quilted 挡风被 every Shanghai e-bike wears in winter
      const q = o.quilt;
      B.cloth.geo(roundedBox(0.72, 0.52, 0.2, 0.08, 2), P(0, 0.8, 0.56, 0, 0.12), q);
      for (const s of [-1, 1]) B.cloth.geo(roundedBox(0.2, 0.15, 0.28, 0.06, 2), P(s * 0.3, 1.02, 0.44), q);
    }
    if (o.box) B.paint.geo(roundedBox(0.44, 0.4, 0.42, 0.05, 2), P(0, 0.9, -0.48), o.box);
  }
  function bicycle(B, m0) {
    const F = 0x15161a, K = (a, b, r = 0.028) => rod(B.metal, a, b, r, F, m0);
    for (const z of [-0.54, 0.54]) { B.paint.geo(new THREE.TorusGeometry(0.34, 0.022, 6, 32), lm(m0, 0, 0.36, z, PI / 2), DARK); B.metal.geo(new THREE.TorusGeometry(0.3, 0.008, 4, 28), lm(m0, 0, 0.36, z, PI / 2), 0x9aa0a6); }
    K([0, 0.34, 0], [0, 0.86, -0.18]); K([0, 0.86, -0.18], [0, 0.9, 0.38]); K([0, 0.34, 0], [0, 0.88, 0.38]); K([0, 0.34, 0], [0, 0.36, -0.54]); K([0, 0.86, -0.18], [0, 0.36, -0.54]);
    K([0, 0.9, 0.38], [0, 0.36, 0.54]); K([0, 0.9, 0.38], [0, 1.08, 0.34]);
    B.metal.geo(new THREE.BoxGeometry(0.52, 0.03, 0.03), lm(m0, 0, 1.08, 0.32), F);
    B.paint.geo(roundedBox(0.14, 0.06, 0.26, 0.03, 2), lm(m0, 0, 0.94, -0.22), DARK);
    B.metal.geo(new THREE.BoxGeometry(0.22, 0.02, 0.36), lm(m0, 0, 0.78, -0.48), F);
  }
  function plant(B, m0, s = 1) {
    B.paint.geo(new THREE.CylinderGeometry(0.2 * s, 0.15 * s, 0.32 * s, 14), lm(m0, 0, 0.16 * s, 0), 0x7a4a32);
    for (let k = 0; k < 3; k++) B.paint.geo(new THREE.IcosahedronGeometry(R(0.16, 0.24) * s, 1), lm(m0, R(-0.08, 0.08) * s, (0.42 + k * 0.12) * s, R(-0.08, 0.08) * s), pick([0x2f4a2a, 0x3a5a30, 0x26402a]));
  }
  // ================================================================ east-bank kerbside e-bikes
  // Rows of parked e-bikes at the back of the pavement along the big roads near
  // the start, built from the same model as the lane and the boat. Each bike is
  // checked against carriageways, water and colliders so none ends up in the road.
  {
    const PB = bins(['paint', 'metal', 'glow', 'cloth']);
    const CARS = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'secondary_link', 'tertiary_link', 'residential', 'unclassified', 'primary_link', 'trunk_link', 'service']);
    const roads = C.roads.filter((r) => r.samp && r.samp.length > 1 && r.half > 0 && CARS.has(r.hw)).map((r) => {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const p of r.samp) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
      return { r, x0: x0 - r.half - 2, x1: x1 + r.half + 2, z0: z0 - r.half - 2, z1: z1 + r.half + 2 };
    });
    const onRoad = (x, z, pad) => roads.some((o) => {
      if (x < o.x0 || x > o.x1 || z < o.z0 || z > o.z1) return false;
      const s = o.r.samp, lim = o.r.half + pad;
      for (let i = 0; i + 1 < s.length; i++) {
        const ax = s[i][0], az = s[i][1], ux = s[i + 1][0] - ax, uz = s[i + 1][1] - az, L2 = ux * ux + uz * uz || 1;
        const t = clamp(((x - ax) * ux + (z - az) * uz) / L2, 0, 1), dx = x - ax - ux * t, dz = z - az - uz * t;
        if (dx * dx + dz * dz < lim * lim) return true;
      }
      return false;
    });
    const blocked = (x, z) => C.colliders.some((c) => x > c.x0 - 0.6 && x < c.x1 + 0.6 && z > c.z0 - 0.6 && z < c.z1 + 0.6);
    const clear = (x, z) => !C.pointInWater(x, z) && !onRoad(x, z, 0.7) && !blocked(x, z);
    const body = [0xe8e8e2, 0x2b3a48, 0x6a2a2a, 0x1d1e22, 0xb8bcc0, 0x8a2a36, 0x3e5f86, 0xe8e8e2];
    const quilts = [0x26304a, 0x5a2430, 0x2a3a2a, 0x3a3030, 0x1f2a3a, 0x4a3a26];
    const S0 = C.start;
    let rows = 0, made = 0;
    const placed = [];
    for (const r of C.roads) {
      if (rows >= 20 || !(r.width >= 10) || !r.samp || r.samp.length < 2) continue;
      let len = 0; for (let k = 1; k < r.samp.length; k++) len += Math.hypot(r.samp[k][0] - r.samp[k - 1][0], r.samp[k][1] - r.samp[k - 1][1]);
      const step = Math.max(1, Math.round(r.samp.length * 12 / Math.max(12, len)));
      for (let i = 0; i < r.samp.length - 1 && rows < 20; i += step) {
        const p = r.samp[i], q = r.samp[i + 1];
        if (Math.hypot(p[0] - S0[0], p[1] - S0[1]) > 230 || placed.some((o) => Math.hypot(o[0] - p[0], o[1] - p[1]) < 40)) continue;
        let tx = q[0] - p[0], tz = q[1] - p[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const nx = tz, nz = -tx, n = 3 + (rows % 3);
        let spot = null, side = 1;
        for (const sd of [rows % 2 ? 1 : -1, rows % 2 ? -1 : 1]) for (const off of [r.half + 1.7, r.half + 2.6, r.half + 3.6]) {
          if (spot) break;
          side = sd;
          const cx = p[0] + nx * side * off, cz = p[1] + nz * side * off, list = [];
          for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * 0.74; list.push([cx + tx * a, cz + tz * a]); }
          if (list.every(([x, z]) => clear(x, z) && clear(x + nx * side * 0.6, z + nz * side * 0.6) && clear(x - nx * side * 0.6, z - nz * side * 0.6))) spot = list;
        }
        if (!spot) continue;
        placed.push(p);
        // noses toward the kerb, angled a little the same way, as a row parked by hand
        const yaw = Math.atan2(-nx * side, -nz * side) + 0.32;
        for (const [x, z] of spot) {
          const ry = yaw + R(-0.07, 0.07), box = R(0, 1) < 0.22 ? pick([0xf2c230, 0x1e8fe0]) : null;
          ebike(PB, M4(x, GY, z, ry), pick(body), { quilt: R(0, 1) < 0.55 ? pick(quilts) : null, box });
          add({ x0: x - 0.42, x1: x + 0.42, z0: z - 0.42, z1: z + 0.42, y0: 0, y1: 1.2, kind: 'ebike' });
          made++;
        }
        rows++;
      }
    }
    PB.paint.build('parked-ebikes', MAT.paint, { glow: [], cast: true });
    PB.metal.build('parked-ebike-metal', MAT.metal, { glow: [] });
    PB.glow.build('parked-ebike-lamps', MAT.glow, { receive: false });
    PB.cloth.build('parked-ebike-quilts', MAT.cloth, { glow: [] });
    C.parkedEbikes = made;
  }
  function foamBox(B, m0) { // 泡沫箱 vegetable patch: scallions in a polystyrene box
    B.paint.geo(new THREE.BoxGeometry(0.62, 0.3, 0.42), lm(m0, 0, 0.15, 0), 0xe6e8e2);
    B.paint.geo(new THREE.BoxGeometry(0.56, 0.02, 0.36), lm(m0, 0, 0.29, 0), 0x3a2a1e);
    for (let k = 0; k < 14; k++) rod(B.paint, [R(-0.25, 0.25), 0.29, R(-0.15, 0.15)], [R(-0.3, 0.3), R(0.5, 0.65), R(-0.2, 0.2)], 0.018, pick([0x4a7a30, 0x5a8a38, 0x3a6a2a]), m0);
  }

  // ================================================================ the ferry: 申渡 7 号
  const FERRY = (() => {
    const boat = new THREE.Group(); boat.name = 'ferry-boat';
    const B = bins(['hull', 'paint', 'metal', 'glow', 'cloth', 'signFlat', 'signLit', 'glassDark']);
    const DECK = 1.02, HB = 5.0, ZT = 10.4, LE = 15.0;
    const outline = (inset) => {
      const hb = HB - inset, zt = ZT, le = LE - inset, s = new THREE.Shape();
      const P = (x, z) => new THREE.Vector2(x, -z);
      s.moveTo(hb, -zt); s.lineTo(hb, zt);
      s.quadraticCurveTo(hb, le, 0, le); s.quadraticCurveTo(-hb, le, -hb, zt);
      s.lineTo(-hb, -zt); s.quadraticCurveTo(-hb, -le, 0, -le); s.quadraticCurveTo(hb, -le, hb, -zt);
      return s;
    };
    const slab = (inset, y0, y1, color, bin = B.hull) => { const g = new THREE.ExtrudeGeometry(outline(inset), { depth: y1 - y0, bevelEnabled: false, curveSegments: 12 }); g.rotateX(-PI / 2); g.translate(0, y0, 0); bin.geo(g, null, color); };
    slab(0.0, -0.6, 0.12, 0x121314);
    slab(0.0, 0.12, 0.86, 0x1f5a45);
    slab(0.0, 0.86, DECK - 0.01, 0xe8e9e2);
    { const g = new THREE.ShapeGeometry(outline(0.12), 12); g.rotateX(-PI / 2); g.translate(0, DECK, 0); B.paint.geo(g, null, 0x48524b); }
    // rubbing fender round the sheer
    { const pts = outline(-0.12).getPoints(24).map((p) => new THREE.Vector3(p.x, 0.92, -p.y));
      B.paint.geo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 160, 0.14, 8, true), null, 0x141414); }
    // yellow lane lines and the hatched ramp aprons
    for (const s of [-1, 1]) B.paint.geo(new THREE.BoxGeometry(0.1, 0.01, 27), M4(s * 2.45, DECK + 0.006, 0), 0xd8b23a);
    // side cabins: port and starboard saloons on the main deck
    for (const s of [-1, 1]) {
      B.paint.box(2.0, 2.3, 20, M4(s * 3.7, DECK + 1.15, 0), 0xeeeee8);
      B.paint.box(2.04, 0.24, 20.04, M4(s * 3.7, DECK + 0.12, 0), 0x1f5a45);
      for (let i = 0; i < 9; i++) {
        const z = -8.4 + i * 2.1;
        B.glow.geo(new THREE.PlaneGeometry(1.4, 0.78), M4(s * 4.712, DECK + 1.5, z, s * PI / 2), rgb(1.9, 1.5, 0.95));
        B.glassDark.geo(new THREE.PlaneGeometry(1.5, 0.86), M4(s * 4.706, DECK + 1.5, z, s * PI / 2), 0x1b2226);
        if (i % 2 === 0 && Math.abs(z) < 8) B.glow.geo(new THREE.PlaneGeometry(1.2, 0.7), M4(s * 2.692, DECK + 1.55, z, -s * PI / 2), rgb(1.7, 1.4, 0.9));
      }
      for (const z of [-9.2, 9.2]) B.paint.geo(new THREE.PlaneGeometry(0.8, 1.9), M4(s * 2.69, DECK + 0.97, z, -s * PI / 2), 0x3a4a44);
      B.signFlat.quad(4.6, 0.86, M4(s * 4.93, DECK + 2.74, 0, s * PI / 2), SIGNS.boatName);
    }
    // upper deck, its fluorescent strip lights over the bike lane
    B.paint.box(9.8, 0.22, 22, M4(0, DECK + 2.41, 0), 0xf0f0ea);
    B.paint.box(9.86, 0.16, 22.06, M4(0, DECK + 2.24, 0), 0x1f5a45);
    const DL = [];
    for (let z = -9; z <= 9; z += 3) for (const s of [-1, 1]) {
      B.glow.geo(new THREE.BoxGeometry(0.07, 0.04, 1.2), M4(s * 1.3, DECK + 2.27, z), rgb(2.4, 2.5, 2.4));
      DL.push({ x: s * 1.3, y: DECK + 2.1, z, c: [0.85, 0.92, 0.95], k: 0.55, rad: 2.4 });
    }
    const UD = DECK + 2.52;
    B.paint.box(6.8, 2.1, 12.8, M4(0, UD + 1.05, 0), 0xf2f2ec);
    for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
      B.glow.geo(new THREE.PlaneGeometry(1.5, 0.9), M4(s * 3.41, UD + 1.25, -5 + i * 2, s * PI / 2), rgb(1.8, 1.45, 0.95));
    }
    for (const e of [-1, 1]) { B.glassDark.geo(new THREE.PlaneGeometry(5.6, 0.9), M4(0, UD + 1.25, e * 6.41, e > 0 ? 0 : PI), 0x1b2a2e); B.signFlat.quad(2.6, 0.62, M4(0, UD + 2.32, e * 6.43, e > 0 ? 0 : PI), SIGNS.boatRoute); }
    B.paint.box(7.4, 0.16, 13.6, M4(0, UD + 2.18, 0), 0xe6e6e0);
    const WH = UD + 2.26;
    B.paint.box(4.4, 1.7, 3.6, M4(0, WH + 0.85, 0), 0xf2f2ec);
    for (const e of [-1, 1]) B.glassDark.geo(new THREE.PlaneGeometry(4.0, 0.8), M4(0, WH + 1.1, e * 1.81, e > 0 ? 0 : PI), 0x16302c);
    for (const s of [-1, 1]) B.glassDark.geo(new THREE.PlaneGeometry(3.2, 0.8), M4(s * 2.21, WH + 1.1, 0, s * PI / 2), 0x16302c);
    B.paint.box(4.9, 0.14, 4.1, M4(0, WH + 1.77, 0), 0x1f5a45);
    rod(B.metal, [0, WH + 1.8, 0], [0, WH + 4.4, 0], 0.12, 0xdadad2);
    B.metal.geo(new THREE.BoxGeometry(1.7, 0.08, 0.08), M4(0, WH + 3.6, 0), 0xdadad2);
    B.metal.geo(new THREE.BoxGeometry(1.4, 0.1, 0.24), M4(0, WH + 2.25, 0.4), 0x2a2c2e);
    B.glow.geo(new THREE.SphereGeometry(0.12, 12, 8), M4(0, WH + 4.5, 0), rgb(3, 3, 2.8));
    B.glow.geo(new THREE.BoxGeometry(0.16, 0.2, 0.3), M4(-2.34, WH + 1.2, 0), rgb(3.2, 0.15, 0.1));
    B.glow.geo(new THREE.BoxGeometry(0.16, 0.2, 0.3), M4(2.34, WH + 1.2, 0), rgb(0.1, 2.8, 0.6));
    for (const e of [-1, 1]) B.glow.geo(new THREE.SphereGeometry(0.1, 10, 8), M4(0, UD + 0.5, e * 11), rgb(2.6, 2.6, 2.4));
    // twin exhaust stacks
    for (const s of [-1, 1]) {
      B.paint.geo(new THREE.CylinderGeometry(0.34, 0.36, 2.0, 24), M4(s * 4.15, UD + 1.0, 0), 0xf2f2ec);
      B.paint.geo(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 24), M4(s * 4.15, UD + 1.8, 0), 0x1f5a45);
      B.paint.geo(new THREE.CylinderGeometry(0.33, 0.34, 0.35, 24), M4(s * 4.15, UD + 2.17, 0), 0x111111);
    }
    // upper deck rail, lifebuoys, raft canisters
    const rail = (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 1.1));
      for (let k = 0; k <= n; k++) { const f = k / n; B.metal.geo(new THREE.BoxGeometry(0.05, 1.0, 0.05), M4(lerp(ax, bx, f), UD + 0.5, lerp(az, bz, f)), 0xd8d8d0); }
      for (const h of [0.5, 1.0]) rod(B.metal, [ax, UD + h, az], [bx, UD + h, bz], 0.045, 0xd8d8d0);
    };
    rail(-4.85, -10.9, 4.85, -10.9); rail(-4.85, 10.9, 4.85, 10.9); rail(-4.85, -10.9, -4.85, 10.9); rail(4.85, -10.9, 4.85, 10.9);
    for (const [x, z] of [[-4.9, -8], [4.9, 8], [-4.9, 7], [4.9, -7]]) for (let k = 0; k < 8; k++) B.paint.geo(new THREE.TorusGeometry(0.32, 0.07, 8, 6, TAU / 8), M4(x, UD + 0.78, z, PI / 2, 0, k * TAU / 8), k % 2 ? 0xf2f2ee : 0xe8561e);
    for (const z of [-9.6, 9.6]) for (const x of [-2.6, 2.6]) { B.paint.geo(new THREE.CapsuleGeometry(0.3, 0.8, 6, 16), M4(x, UD + 0.45, z, 0, 0, PI / 2), 0xf4f4f0); B.metal.geo(new THREE.BoxGeometry(1.1, 0.12, 0.5), M4(x, UD + 0.1, z), 0x4a4d50); }
    // main-deck rails on the open shoulders at both ends
    for (const e of [-1, 1]) for (const s of [-1, 1]) {
      const pts = [[s * 2.7, e * 10.2], [s * 4.7, e * 10.7], [s * 4.2, e * 12.6], [s * 3.2, e * 13.9], [s * 2.7, e * 14.3]];
      for (let i = 0; i + 1 < pts.length; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; for (const h of [0.55, 1.05]) rod(B.metal, [ax, DECK + h, az], [bx, DECK + h, bz], 0.045, 0xd8d8d0); B.metal.geo(new THREE.BoxGeometry(0.05, 1.05, 0.05), M4(ax, DECK + 0.52, az), 0xd8d8d0); }
      B.paint.geo(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 16), M4(s * 3.6, DECK + 0.21, e * 12.2), 0x1a1a1a);
    }
    // tyre fenders hanging on the topsides
    for (const s of [-1, 1]) for (let z = -9; z <= 9; z += 3) B.paint.geo(new THREE.TorusGeometry(0.3, 0.12, 8, 18), M4(s * 5.12, 0.45, z, PI / 2), 0x121212);
    // the hinged end ramps, each its own group so they can be raised: a ribbed
    // steel plate between two box girders, hazard band only on the lip, hinge
    // barrel at the deck edge; an A-frame gantry lifts each one on two wires
    const ramps = {}, wires = [];
    const steelM = MAT.metal;
    for (const e of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(0, DECK, e * 14.2);
      const RB = bins(['paint', 'metal']), L = 2.3;
      RB.paint.box(4.5, 0.1, L, M4(0, -0.05, e * L / 2), 0x4a4e50);
      for (let k = 0; k < 16; k++) RB.metal.box(4.3, 0.035, 0.045, M4(0, 0.016, e * (0.12 + k * 0.135)), 0x6a6e70);
      for (let k = 0; k < 9; k++) RB.paint.box(0.5, 0.012, 0.32, M4(-2.0 + k * 0.5, 0.04, e * (L - 0.2), 0, 0, 0), k % 2 ? 0x16171a : 0xd8b23a);
      RB.metal.box(4.5, 0.08, 0.1, M4(0, 0.0, e * (L - 0.02)), 0x2a2c2e);
      for (const s of [-1, 1]) {
        RB.paint.box(0.16, 0.34, L, M4(s * 2.3, 0.1, e * L / 2), 0x1f5a45);
        RB.metal.box(0.06, 0.06, L, M4(s * 2.3, 0.3, e * L / 2), 0xd8d8d0);
        RB.metal.geo(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 12), M4(s * 2.3, 0.3, e * (L - 0.1)), 0xb8bcbe);
      }
      RB.metal.geo(new THREE.CylinderGeometry(0.11, 0.11, 4.4, 16), M4(0, -0.04, 0, 0, 0, PI / 2), 0x2a2c2e);
      RB.paint.build('ferry-ramp', MAT.paint, { parent: g });
      RB.metal.build('ferry-ramp-steel', steelM, { parent: g });
      boat.add(g); ramps[e > 0 ? 'front' : 'back'] = g;
      // gantry: two posts, a crossbeam with sheaves, a lamp under it
      for (const s of [-1, 1]) {
        B.paint.box(0.22, 4.6, 0.22, M4(s * 2.75, DECK + 2.3, e * 13.55), 0xeeeee8);
        B.paint.box(0.4, 0.12, 0.4, M4(s * 2.75, DECK + 0.06, e * 13.55), 0x1f5a45);
        B.metal.geo(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 16), M4(s * 2.3, DECK + 4.45, e * 13.55, 0, 0, PI / 2), 0x2a2c2e);
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 32), new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.5, metalness: 0.7 }));
        w.userData.passable = true; w.userData.surfaceProcedural = true; w.name = 'ferry-ramp-wire'; boat.add(w);
        wires.push({ mesh: w, e, s, top: new THREE.Vector3(s * 2.3, DECK + 4.38, e * 13.55) });
      }
      B.paint.box(5.72, 0.3, 0.3, M4(0, DECK + 4.6, e * 13.55), 0x1f5a45);
      B.glow.geo(new THREE.BoxGeometry(0.9, 0.05, 0.12), M4(0, DECK + 4.43, e * 13.55), rgb(2.6, 2.6, 2.4));
      DL.push({ x: 0, y: DECK + 4.2, z: e * 13.9, c: [0.9, 0.92, 0.95], k: 0.7, rad: 3 });
    }    // commuters: e-bikes with 挡风被 and their riders, a crew member at the gate
    const OB = [], people = [];
    const quilts = [0x26304a, 0x5a2430, 0x2a3a2a, 0x3a3030, 0x1f2a3a];
    [[-1.72, -7.6, 1], [1.72, -7.2, 0], [-1.72, -4.6, 0], [1.72, -2.2, 1], [-1.72, 0.6, 1], [1.72, 2.8, 0], [-1.72, 5.4, 0]].forEach(([x, z, rider], i) => {
      ebike(B, M4(x, DECK, z, 0), pick([0x2b3a48, 0x6a2a2a, 0xd8d8d0, 0x2d3b2d, 0x1d1e22]), { quilt: quilts[i % quilts.length], box: i === 3 ? 0xe2b324 : null, on: !!rider });
      OB.push({ x0: x - 0.36, x1: x + 0.36, z0: z - 0.9, z1: z + 0.9 });
      if (rider) people.push({ look: { top: pick(['coat', 'jacket']), hairStyle: pick(['short', 'beanie', 'cap']), sex: pick(['m', 'f']) }, pose: 'ride', x, y: DECK + 0.14, z: z - 0.18, ry: 0 });
      else if (i % 2 === 0) { people.push({ look: { hold: 'phone' }, pose: 'phone', x: x + (x < 0 ? 0.62 : -0.62), y: DECK, z: z - 0.3, ry: x < 0 ? 0.4 : -0.4 }); OB.push({ x0: x + (x < 0 ? 0.3 : -0.94), x1: x + (x < 0 ? 0.94 : -0.3), z0: z - 0.6, z1: z }); }
    });
    people.push({ look: { top: 'jacket', topColor: 0xe0662a, hairStyle: 'cap', sex: 'm' }, pose: 'stand', x: 2.05, y: DECK, z: 12.4, ry: PI });
    OB.push({ x0: 1.7, x1: 2.4, z0: 12.05, z1: 12.75 });
    const crowd = G.people.crowd(people, 'ferry-passengers'); boat.add(crowd);
    B.hull.build('ferry-hull', MAT.paint, { parent: boat });
    B.paint.build('ferry-superstructure', MAT.paint, { parent: boat, glow: DL });
    B.metal.build('ferry-rails', MAT.metal, { parent: boat });
    B.cloth.build('ferry-quilts', MAT.cloth, { parent: boat, glow: DL });
    B.glassDark.build('ferry-glazing', gmat({ roughness: 0.1, metalness: 0.4, envMapIntensity: 1.6 }), { parent: boat });
    B.signFlat.build('ferry-name', MAT.signFlat, { parent: boat });
    B.glow.build('ferry-lights', MAT.glow, { parent: boat, receive: false });
    // wake: white water spreading behind whichever end is astern
    const wakeTex = (() => { const c = makeCanvas(128, 256), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 128, 256); for (let i = 0; i < 90; i++) { const t = R(0, 1), sp = 10 + t * 50; x.fillStyle = `rgba(255,255,255,${(0.5 * (1 - t)).toFixed(2)})`; for (const s of [-1, 1]) x.fillRect(64 + s * sp + R(-6, 6), t * 256, R(2, 6), R(4, 14)); if (t < 0.5) { x.fillStyle = `rgba(255,255,255,${(0.25 * (1 - t * 2)).toFixed(2)})`; x.fillRect(64 + R(-14, 14), t * 256, R(3, 8), R(6, 18)); } } return canvasTexture(c, true, 1, 1, 4); })();
    const wakeMat = new THREE.MeshBasicMaterial({ map: wakeTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.75, 0.82, 0.86) });
    wakeMat.userData.surfaceProcedural = true;
    const wg = new THREE.PlaneGeometry(13, 34); wg.rotateX(-PI / 2);
    const wake = new THREE.Mesh(wg, wakeMat); wake.position.set(0, 0.07, -32); wake.name = 'ferry-wake'; wake.userData.passable = true; wake.renderOrder = 3; boat.add(wake);
    if (G.noReflect) G.noReflect.push(wake);
    // bow wave: white water peeling off both shoulders, flowing aft along the hull
    const bowTex = (() => { const c = makeCanvas(128, 256), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, 128, 256); for (let i = 0; i < 160; i++) { const t = R(0, 1), a = (1 - t) * 0.6; x.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; const px = 6 + t * 70 + R(-6, 6); x.fillRect(px, R(0, 256), R(2, 7), R(6, 22)); } const t = canvasTexture(c, true, 1, 1, 4); t.wrapT = THREE.RepeatWrapping; return t; })();
    const bowMat = new THREE.MeshBasicMaterial({ map: bowTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.8, 0.86, 0.9), side: THREE.DoubleSide });
    bowMat.userData.surfaceProcedural = true;
    for (const s of [-1, 1]) {
      const bg = new THREE.PlaneGeometry(4.5, 26); bg.rotateX(-PI / 2);
      const bw = new THREE.Mesh(bg, bowMat); bw.position.set(s * (HB + 1.9), 0.08, 2); bw.rotation.y = s * 0.12; bw.scale.x = s;
      bw.name = 'ferry-bow-wave'; bw.userData.passable = true; bw.renderOrder = 3; boat.add(bw); if (G.noReflect) G.noReflect.push(bw);
    }
    const flow = (dt, v) => { wakeTex.offset.y = (wakeTex.offset.y + dt * v / 34) % 1; bowTex.offset.y = (bowTex.offset.y + dt * v / 26) % 1; bowMat.opacity = wakeMat.opacity * 0.85; };    const id = [{ name: 'hull', extents: [10, 1.6, 30] }, { name: 'cabin', extents: [6.8, 2.1, 12.8] }];
    boat.userData.identity = id;
    boat.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.userData.identity = id; o.userData.parts = ['hull', 'cabin']; o.castShadow = o !== wake && o.name !== 'ferry-bow-wave'; } });
    scene.add(boat);
    wakeTex.wrapT = THREE.RepeatWrapping;
    return { boat, ramps, wires, flow, rampUp: 0.62, wake, wakeMat, deckY: DECK, walk: { x0: -2.32, x1: 2.32, z0: -14.0, z1: 14.0, zLand: 15.9 }, obstacles: OB };
  })();

  // ================================================================ 十八埠: pontoon, gangway, terminal (pier frame)
  const GAP = C.site.puxiGap;
  const bankAt = (z) => { let x = -1000; for (; x < -500; x += 2) if (C.pointInWater(x, z)) break; let lo = x - 2, hi = x; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (C.pointInWater(m, z)) hi = m; else lo = m; } return hi; };
  const TAN = (() => { const dx = bankAt(GAP.z + 20) - bankAt(GAP.z - 20), l = Math.hypot(dx, 40); return [dx / l, 40 / l]; })();
  const NRM = [TAN[1], -TAN[0]];                       // points into the river
  const PYAW = Math.atan2(TAN[0], TAN[1]);
  const PW = (t, n) => [GAP.x + TAN[0] * t + NRM[0] * n, GAP.z + TAN[1] * t + NRM[1] * n];
  const PM = (t, y, n, r = 0, rx = 0, rz = 0) => { const w = PW(t, n); return M4(w[0], y, w[1], PYAW + r, rx, rz); };
  const toPier = (x, z) => { const dx = x - GAP.x, dz = z - GAP.z; return [dx * TAN[0] + dz * TAN[1], dx * NRM[0] + dz * NRM[1]]; };
  const PY = 0.86;                                     // pontoon deck
  const PT0 = -5, PT1 = 23, PN0 = 7, PN1 = 16, BT = 11;  // pontoon extent, berth centre line
  // colliders along a pier-frame polyline: small overlapping boxes, so a diagonal still holds
  function chain(t0, n0, t1, n1, kind, y1 = 1.3, pad = 0.16) {
    const L = Math.hypot(t1 - t0, n1 - n0), k = Math.max(1, Math.ceil(L / 0.3));
    for (let i = 0; i < k; i++) {
      const a = PW(lerp(t0, t1, i / k), lerp(n0, n1, i / k)), b = PW(lerp(t0, t1, (i + 1) / k), lerp(n0, n1, (i + 1) / k));
      add({ x0: Math.min(a[0], b[0]) - pad, x1: Math.max(a[0], b[0]) + pad, z0: Math.min(a[1], b[1]) - pad, z1: Math.max(a[1], b[1]) + pad, y0: 0, y1, kind });
    }
  }
  const rectChain = (t0, t1, n0, n1, kind, y1) => { chain(t0, n0, t1, n0, kind, y1, 0.3); chain(t1, n0, t1, n1, kind, y1, 0.3); chain(t1, n1, t0, n1, kind, y1, 0.3); chain(t0, n1, t0, n0, kind, y1, 0.3); };
  {
    const B = bins(['steel', 'paint', 'metal', 'glow', 'conc', 'signLit', 'signFlat', 'roofM']);
    const PL = [];
    // pontoon hull and deck
    B.steel.box(PN1 - PN0, 1.4, PT1 - PT0, PM((PT0 + PT1) / 2, PY - 0.7, (PN0 + PN1) / 2), 0x2a2e31, null);
    B.paint.box(PN1 - PN0 + 0.02, 0.3, PT1 - PT0 + 0.02, PM((PT0 + PT1) / 2, 0.06, (PN0 + PN1) / 2), 0x5a2a22);
    B.conc.geo(new THREE.BoxGeometry(PN1 - PN0 - 0.1, 0.04, PT1 - PT0 - 0.1, 16, 1, 40), PM((PT0 + PT1) / 2, PY - 0.01, (PN0 + PN1) / 2), 0x8a9088, [3, 3]);
    for (const n of [PN0 + 0.25, PN1 - 0.25]) B.paint.geo(new THREE.BoxGeometry(0.12, 0.012, PT1 - PT0 - 0.6), PM((PT0 + PT1) / 2, PY + 0.02, n), 0xd8b23a);
    // shelter over the pontoon
    for (const t of [-4, 3.4, 7.6, 14.4, 18.6, 22.2]) for (const n of [PN0 + 0.6, PN1 - 0.6]) { B.metal.geo(new THREE.BoxGeometry(0.16, 2.9, 0.16), PM(t, PY + 1.45, n), 0x3a4a52); add(Object.assign(aabbAt(PW(t, n), 0.22), { y0: 0, y1: 3, kind: 'pontoon-post' })); }
    B.roofM.box(PN1 - PN0 + 1.2, 0.18, PT1 - PT0 + 0.6, PM((PT0 + PT1) / 2, PY + 3.0, (PN0 + PN1) / 2), 0x46525a, null, 2);
    B.paint.box(0.1, 0.5, PT1 - PT0 + 0.6, PM((PT0 + PT1) / 2, PY + 2.8, PN1 + 0.62), 0x1f4a64);
    B.signLit.quad(8.5, 0.46, PM(BT, PY + 2.8, PN1 + 0.68, PI / 2), SIGNS.ferryGate);
    for (let t = PT0 + 2; t < PT1 - 1; t += 3.5) { B.glow.geo(new THREE.BoxGeometry(0.08, 0.05, 1.3), PM(t, PY + 2.88, (PN0 + PN1) / 2), rgb(2.4, 2.5, 2.4)); PL.push({ ...xyz(PW(t, (PN0 + PN1) / 2), PY + 2.7), c: [0.85, 0.92, 0.96], k: 0.9, rad: 3.4 }); }
    // benches, bollards, fenders, rails
    for (const t of [-2, 2.5, 17, 20.5]) { B.paint.box(0.5, 0.08, 1.8, PM(t, PY + 0.45, PN0 + 0.8), 0x6a4a30); B.paint.box(0.08, 0.45, 1.8, PM(t, PY + 0.7, PN0 + 0.58), 0x6a4a30); B.metal.box(0.4, 0.42, 0.06, PM(t, PY + 0.21, PN0 + 0.8), 0x2a2c2e); }
    for (const t of [3, 19]) { B.paint.geo(new THREE.CylinderGeometry(0.2, 0.24, 0.5, 20), PM(t, PY + 0.25, PN1 - 0.5), 0x1a1a1a); B.paint.geo(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), PM(t, PY + 0.52, PN1 - 0.5), 0x1a1a1a); }
    for (let t = PT0 + 1; t < PT1; t += 2.2) B.paint.geo(new THREE.TorusGeometry(0.3, 0.12, 8, 18), PM(t, 0.4, PN1 + 0.12), 0x121212);
    const railRun = (t0, n0, t1, n1) => {
      const L = Math.hypot(t1 - t0, n1 - n0), k = Math.max(1, Math.round(L / 1.5));
      for (let i = 0; i <= k; i++) B.metal.geo(new THREE.BoxGeometry(0.06, 1.1, 0.06), PM(lerp(t0, t1, i / k), PY + 0.55, lerp(n0, n1, i / k)), 0xb8bcbe);
      for (const h of [0.55, 1.08]) { const a = PW(t0, n0), b = PW(t1, n1); rod(B.metal, [a[0], PY + h, a[1]], [b[0], PY + h, b[1]], 0.05, 0xb8bcbe); }
    };
    railRun(PT0, PN0, -1.75, PN0); railRun(1.75, PN0, PT1, PN0); railRun(PT0, PN1, BT - 2.7, PN1); railRun(BT + 2.7, PN1, PT1, PN1);
    railRun(PT0, PN0, PT0, PN1); railRun(PT1, PN0, PT1, PN1);
    for (let k = 0; k < 9; k++) B.paint.geo(new THREE.BoxGeometry(0.05, 1.0, 0.05), PM(BT - 2.6 + k * 0.65, PY + 0.5, PN1 - 0.05), k % 2 ? 0x1a1a1a : 0xd8b23a);
    rod(B.metal, ...[PW(BT - 2.7, PN1), PW(BT + 2.7, PN1)].map((p) => [p[0], PY + 1.0, p[1]]), 0.06, 0xd8b23a);
    rectChain(PT0, PT1, PN0, PN1, 'pontoon-rail');
    C.mapDecks = C.mapDecks || [];
    C.mapDecks.push([PW(PT0, PN0), PW(PT1, PN0), PW(PT1, PN1), PW(PT0, PN1)], [PW(-1.65, -0.6), PW(1.65, -0.6), PW(1.65, PN0), PW(-1.65, PN0)]);
    C.carve(...aabbOf([PW(-1.6, PN0 - 0.6), PW(1.6, PN0 - 0.6), PW(1.6, PN0 + 0.6), PW(-1.6, PN0 + 0.6)]), /pontoon-rail/);
    // gangway: a covered steel bridge from the quay down to the pontoon
    {
      const L = PN0 + 0.6, rise = PY - GY, a = Math.atan2(rise, L);
      B.metal.geo(new THREE.BoxGeometry(L + 0.2, 0.08, 3.3, 8, 1, 2), PM(0, (GY + PY) / 2 - 0.03, (PN0 - 0.6) / 2, 0, 0, a), 0x4a5054);
      for (const s of [-1, 1]) {
        for (let k = 0; k <= 5; k++) { const n = -0.6 + k * L / 5, y = GY + rise * (k / 5); B.metal.geo(new THREE.BoxGeometry(0.07, 1.1, 0.07), PM(s * 1.62, y + 0.55, n), 0xb8bcbe); B.metal.geo(new THREE.BoxGeometry(0.1, 3.0, 0.1), PM(s * 1.72, y + 1.5, n), 0x3a4a52); }
        for (const h of [0.55, 1.08]) { const p0 = PW(s * 1.62, -0.6), p1 = PW(s * 1.62, PN0); rod(B.metal, [p0[0], GY + h, p0[1]], [p1[0], PY + h, p1[1]], 0.05, 0xb8bcbe); }
        chain(s * 1.72, -0.8, s * 1.72, PN0 + 0.1, 'gangway-rail', 1.3, 0.14);
      }
      B.roofM.box(L + 0.4, 0.14, 4.0, PM(0, (GY + PY) / 2 + 3.05, (PN0 - 0.6) / 2, 0, 0, a), 0x46525a);
      for (const n of [1.5, 4.5]) { B.glow.geo(new THREE.BoxGeometry(1.2, 0.05, 0.08), PM(0, GY + 3.0 + n * 0.08, n), rgb(2.4, 2.5, 2.4)); PL.push({ ...xyz(PW(0, n), GY + 2.8), c: [0.85, 0.92, 0.96], k: 0.8, rad: 3 }); }
    }
    // the terminal: ticket hall, exit canopy, the lit name on the roof facing the river
    {
      const T0 = -15.5, T1 = -3.2, N0 = -15, N1 = -4.2, H = 4.6, tc = (T0 + T1) / 2, nc = (N0 + N1) / 2;
      B.conc.box(N1 - N0, H, T1 - T0, PM(tc, GY + H / 2, nc), 0xd2d4d0, [3, 3], 1.2);
      B.paint.box(N1 - N0 + 0.3, 0.5, T1 - T0 + 0.3, PM(tc, GY + H + 0.2, nc), 0x2a3a46);
      for (let i = 0; i < 4; i++) { const t = T0 + 1.6 + i * 2.9; B.paint.geo(new THREE.PlaneGeometry(2.3, 1.8), PM(t, GY + 2.0, N1 + 0.02, PI / 2), i === 1 ? 0x5a6a62 : 0x141a1e); if (i === 1) { B.glow.geo(new THREE.PlaneGeometry(1.2, 0.8), PM(t, GY + 1.6, N1 + 0.03, PI / 2), rgb(1.6, 1.5, 1.2)); PL.push({ ...xyz(PW(t, N1 + 0.5), GY + 1.6), c: [1.0, 0.9, 0.7], k: 0.7, rad: 1.8 }); } }
      B.signFlat.quad(2.6, 0.7, PM(T1 - 2.6, GY + 3.4, N1 + 0.04, PI / 2), SIGNS.ferryGate);
      B.signLit.quad(10.5, 2.2, PM(tc, GY + H + 1.6, N1 + 0.25, PI / 2), SIGNS.ferryBig);
      B.metal.box(0.1, 1.4, 10.5, PM(tc, GY + H + 1.1, N1 + 0.15), 0x2a2c2e);
      B.signLit.quad(5.2, 1.1, PM(tc, GY + H + 1.1, N0 - 0.3, -PI / 2), SIGNS.ferryBig);
      PL.push({ ...xyz(PW(tc, N1 + 3), GY + H + 1.6), c: [1.6, 0.35, 0.25], k: 0.55, rad: 4 });
      rectChain(T0, T1, N0, N1, 'ferry-terminal', H + 0.5);
      // exit canopy from the gangway to the street, turnstiles left open after the last boat
      for (const s of [-1, 1]) for (let n = -15; n <= -1; n += 3.5) { B.metal.geo(new THREE.BoxGeometry(0.16, 3.0, 0.16), PM(s * 2.4, GY + 1.5, n), 0x3a4a52); add(Object.assign(aabbAt(PW(s * 2.4, n), 0.2), { y0: 0, y1: 3, kind: 'canopy-post' })); }
      B.roofM.box(16, 0.16, 5.4, PM(0, GY + 3.05, -8.2), 0x46525a);
      for (let n = -14; n <= -2; n += 4) { B.glow.geo(new THREE.BoxGeometry(1.4, 0.05, 0.08), PM(0, GY + 2.96, n), rgb(2.4, 2.5, 2.4)); PL.push({ ...xyz(PW(0, n), GY + 2.7), c: [0.85, 0.92, 0.96], k: 0.8, rad: 3.2 }); }
      for (const t of [-1.2, 0, 1.2]) { B.metal.box(0.25, 1.0, 0.9, PM(t * 1.25 - 0.62, GY + 0.5, -6.5), 0x8a9094); B.glow.geo(new THREE.BoxGeometry(0.1, 0.06, 0.1), PM(t * 1.25 - 0.62, GY + 1.04, -6.1), rgb(0.2, 2.4, 0.6)); }
      B.signLit.quad(1.7, 1.7, PM(2.36, GY + 1.9, -3.2, -PI / 2), SIGNS.timetable);
    }
    for (const l of PL) LAMPS.push(l);
    const all = LAMPS;
    B.steel.build('shibabu-pontoon', MAT.paint, { glow: all });
    B.paint.build('shibabu-fittings', MAT.paint, { glow: all });
    B.metal.build('shibabu-steel', MAT.metal, { glow: all });
    B.conc.build('shibabu-terminal', MAT.conc, { glow: all });
    B.roofM.build('shibabu-roofs', MAT.paint, { glow: all, cast: true });
    B.glow.build('shibabu-lights', MAT.glow, { receive: false });
    B.signLit.build('shibabu-signs', MAT.signLit);
    B.signFlat.build('shibabu-boards', MAT.signFlat, { glow: all });
  }
  function aabbAt(p, r) { return { x0: p[0] - r, x1: p[0] + r, z0: p[1] - r, z1: p[1] + r }; }
  function aabbOf(pts) { return [Math.min(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[1]))]; }
  function xyz(p, y) { return { x: p[0], y, z: p[1] }; }
  C.groundHook = (x, z) => {
    if (x < -748 || x > -700 || z < 600 || z > 640) return null;
    const [t, n] = toPier(x, z);
    if (t >= PT0 && t <= PT1 && n >= PN0 && n <= PN1) return PY;
    if (t >= -1.8 && t <= 1.8 && n >= -0.6 && n < PN0) return lerp(GY, PY, clamp((n + 0.6) / (PN0 + 0.6), 0, 1));
    return null;
  };

  // ---- the route across: end-on at 东晟路, end-on at the 十八埠 pontoon
  {
    const H = C.ferryHall, E = { x: H.x0 - 0.5 - 15.2, z: (H.z0 + H.z1) / 2, yaw: -PI / 2 };
    const Wd = PW(BT, PN1 + 0.25 + 15.2), W = { x: Wd[0], z: Wd[1], yaw: Math.atan2(-NRM[0], -NRM[1]) };
    const A1 = PW(BT, PN1 + 15.2 + 28), A2 = PW(BT, PN1 + 15.2 + 11);
    const pts = [[E.x, E.z], [E.x - 45, E.z], [-300, 610], [-500, 594], [-640, 584], A1, A2, [W.x, W.z]].map((p) => new THREE.Vector3(p[0], 0, p[1]));
    const route = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const land = PW(BT, PN1 - 1.4);
    C.ferryRide = Object.assign(FERRY, { east: E, west: W, route, length: route.getLength(), landing: { x: land[0], z: land[1], yaw: Math.atan2(-TAN[0], -TAN[1]) } });
    C.ferryBoat = FERRY.boat;
    FERRY.place = (x, z, yaw, bob) => { FERRY.boat.position.set(x, bob || 0, z); FERRY.boat.rotation.set(0, yaw, 0); };
    const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0), _tip = new THREE.Vector3(), _d = new THREE.Vector3();
    FERRY.setRamps = (front, back) => {
      FERRY.ramps.front.rotation.x = -front; FERRY.ramps.back.rotation.x = back;
      // each wire runs from its sheave to the lip of its ramp
      for (const w of FERRY.wires) {
        const a = w.e > 0 ? front : back;
        _tip.set(w.s * 2.3, FERRY.deckY + 0.3 * Math.cos(a) + 2.2 * Math.sin(a), w.e * (14.2 + 2.2 * Math.cos(a) - 0.3 * Math.sin(a)));
        _d.subVectors(_tip, w.top); const len = _d.length();
        w.mesh.position.copy(w.top).addScaledVector(_d, 0.5); w.mesh.quaternion.copy(_q.setFromUnitVectors(_up, _d.normalize())); w.mesh.scale.set(1, len, 1);
      }
    };
    FERRY.place(E.x, E.z, E.yaw); FERRY.setRamps(FERRY.rampUp, FERRY.rampUp);
  }

  // ================================================================ north closure across the quay at z 548
  {
    const B = bins(['signFlat', 'metal', 'glow']), z = 548, xa = -870, xb = bankAt(z) + 3;
    for (let x = xa; x < xb; x += 4) { const w = Math.min(4, xb - x); B.signFlat.quad(w, 2.6, M4(x + w / 2, GY + 1.3, z + 0.02, 0), SIGNS.hoard); B.signFlat.quad(w, 2.6, M4(x + w / 2, GY + 1.3, z - 0.02, PI), SIGNS.hoard); B.metal.box(0.08, 2.7, 0.08, M4(x, GY + 1.35, z), 0x3a3f42); }
    for (let x = xa + 2; x < xb; x += 8) B.glow.geo(new THREE.SphereGeometry(0.1, 10, 8), M4(x, GY + 2.75, z + 0.1), rgb(4.5, 0.35, 0.2));
    add({ x0: xa, x1: xb, z0: z - 0.3, z1: z + 0.3, y0: 0, y1: 2.8, kind: 'hoarding' });
    B.signFlat.build('bund-floodwall-hoarding', MAT.signFlat); B.metal.build('bund-hoarding-posts', MAT.metal); B.glow.build('bund-hoarding-lamps', MAT.glow, { receive: false });
  }

  // ================================================================ 永安里
  const LZ0 = 678.2, LZ1 = 681.8, XW = -856.5, UW = 4.3, XE = XW + UW * 10;   // XE = -813.5
  const EAVE = GY + 7.35, RIDGE = GY + 10.25;
  const L = bins(['brick', 'stone', 'roof', 'plaster', 'paint', 'metal', 'door', 'winS', 'winL', 'signFlat', 'signCut', 'signLit', 'glow', 'cobble', 'cloth', 'conc', 'puddle', 'glass']);
  // lamps first: every surface below is baked against this list
  const laneLamps = [];
  const wallLamp = (x, z, side) => {   // side: +1 lamp on the north wall facing south, -1 on the south wall
    const y = GY + 3.1, lz = z + side * 0.42;
    rod(L.metal, [x, y + 0.1, z], [x, y + 0.1, lz], 0.03, 0x1a1c1e);
    L.metal.geo(new THREE.ConeGeometry(0.17, 0.14, 16, 1, true), M4(x, y + 0.07, lz), 0x2a2c2e);
    L.glow.geo(new THREE.SphereGeometry(0.07, 12, 8), M4(x, y, lz), rgb(4.2, 3.0, 1.6));
    laneLamps.push({ x, y: y - 0.05, z: lz, c: [1.0, 0.66, 0.34], k: 1.35, rad: 3.0 });
  };
  [[-851.5, 1], [-843.2, -1], [-834.6, 1], [-826.5, -1], [-819.2, 1]].forEach(([x, s]) => wallLamp(x, s > 0 ? LZ0 : LZ1, s));
  laneLamps.push({ x: -815.5, y: GY + 3.25, z: 680, c: [1.0, 0.72, 0.4], k: 1.2, rad: 2.6 });     // under the arch
  laneLamps.push({ x: -856.0, y: GY + 2.75, z: 680, c: [0.95, 0.9, 0.8], k: 1.0, rad: 2.2 });      // over the walk-up door
  laneLamps.push({ x: -833.8, y: GY + 3.0, z: 666, c: [1.0, 0.7, 0.38], k: 1.1, rad: 2.6 });       // back lane
  laneLamps.push({ x: -833.8, y: GY + 3.0, z: 657, c: [1.0, 0.7, 0.38], k: 0.9, rad: 2.4 });
  for (const l of laneLamps) LAMPS.push(l);

  // ---- one 石库门 house in its own frame: a along the lane, d into the block, lane at d < 0
  function shikumen(F, D, no, o) {
    const W = UW, m = (a, y, d, r = 0, rx = 0, rz = 0) => lm(F, a, y, d, r, rx, rz);
    const BR = (w, h, dd, a, y, d, c = WHITE) => L.brick.box(w, h, dd, m(a, y, d), c, [2, 2], 0.6);
    const ST = (w, h, dd, a, y, d, c = WHITE) => L.stone.box(w, h, dd, m(a, y, d), c, [1, 1], 0.6);
    const a1 = W / 2 - 0.78, a2 = W / 2 + 0.78, wallH = 4.1;
    // courtyard wall and the stone door
    BR(a1, wallH, 0.32, a1 / 2, GY + wallH / 2, 0.16); BR(W - a2, wallH, 0.32, (a2 + W) / 2, GY + wallH / 2, 0.16);
    BR(a2 - a1, wallH - 2.75, 0.32, W / 2, GY + 2.75 + (wallH - 2.75) / 2, 0.16);
    ST(0.3, 2.75, 0.42, a1 - 0.15, GY + 1.375, 0.12); ST(0.3, 2.75, 0.42, a2 + 0.15, GY + 1.375, 0.12);
    ST(a2 - a1 + 0.6, 0.3, 0.44, W / 2, GY + 2.9, 0.12);
    ST(a2 - a1 + 0.95, 0.14, 0.58, W / 2, GY + 3.12, 0.1);
    ST(W + 0.04, 0.12, 0.44, W / 2, GY + wallH + 0.06, 0.16);
    ST(a2 - a1 + 0.2, 0.15, 0.36, W / 2, GY + 0.075, -0.16);
    const ped = o.ped;
    if (ped === 0) { const s = new THREE.Shape([new THREE.Vector2(-1.15, 0), new THREE.Vector2(1.15, 0), new THREE.Vector2(0, 0.82)]); const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false }); L.stone.geo(g, m(W / 2, GY + 3.19, -0.12), WHITE, [1, 1]); }
    else if (ped === 1) { const s = new THREE.Shape(); s.moveTo(-1.1, 0); s.lineTo(1.1, 0); s.quadraticCurveTo(1.1, 0.75, 0, 0.78); s.quadraticCurveTo(-1.1, 0.75, -1.1, 0); const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: false, curveSegments: 10 }); L.stone.geo(g, m(W / 2, GY + 3.19, -0.12), WHITE, [1, 1]); }
    else { ST(2.3, 0.62, 0.14, W / 2, GY + 3.5, -0.05); for (const s of [-1, 1]) L.stone.geo(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 16, 1, false, 0, PI), m(W / 2 + s * 1.15, GY + 3.5, -0.05, 0, PI / 2, 0), WHITE, [1, 1]); }
    L.signFlat.quad(1.05, 0.3, m(W / 2, GY + 3.42, -0.135, PI), SIGNS['tihe' + (no % 4)]);
    L.door.quad(a2 - a1, 2.75, m(W / 2, GY + 1.375, 0.13, PI), { u0: 0, u1: 1, v0: 0, v1: 1 });
    L.signFlat.quad(0.34, 0.21, m(a2 + 0.62, GY + 2.2, -0.012, PI), SIGNS['plate' + no]);
    if (o.couplet) { L.signFlat.quad(0.2, 1.1, m(a2 + 0.15, GY + 1.75, -0.092, PI), SIGNS.cL); L.signFlat.quad(0.2, 1.1, m(a1 - 0.15, GY + 1.75, -0.092, PI), SIGNS.cR); L.signCut.quad(0.36, 0.36, m(W / 2 + 0.4, GY + 1.55, 0.125, PI), SIGNS.fu); }
    if (o.meter) { L.paint.box(0.36, 0.48, 0.14, m(0.42, GY + 2.3, -0.07), 0x8a8e88); rod(L.metal, [0.42, GY + 2.05, -0.05], [0.42, GY + 0.1, -0.05], 0.035, 0x3a3c3e, F); }
    // courtyard: floor, party wall, a pot or two
    L.conc.box(W, 0.05, 3.0, m(W / 2, GY + 0.025, 1.8), 0xa29e94, [3, 3]);
    BR(0.24, wallH, 3.0, 0, GY + wallH / 2, 1.8);
    if (o.end) BR(0.24, wallH, 3.0, W, GY + wallH / 2, 1.8);
    plant(L, m(0.6, GY, 2.7)); if (no % 3 === 0) foamBox(L, m(W - 0.6, GY, 2.9));
    // house front: 2F windows over the wall
    BR(W, EAVE - GY, 0.3, W / 2, (GY + EAVE) / 2, 3.45);
    ST(W, 0.16, 0.38, W / 2, GY + 4.35, 3.32);
    BR(W, 0.22, 0.5, W / 2, EAVE - 0.06, 3.35);
    for (const [k, aw] of [[0, W * 0.28], [1, W * 0.72]]) {
      const v = o.win[k];
      L.winS.quad(0.98, 1.66, m(aw, GY + 5.5, 3.295, PI), { u0: v * 0.25, u1: v * 0.25 + 0.25, v0: 0, v1: 1 });
      ST(1.18, 0.08, 0.22, aw, GY + 4.62, 3.21); ST(1.12, 0.12, 0.08, aw, GY + 6.4, 3.29);
      if (v !== 2) laneLampsLocal.push(m(aw, GY + 5.4, 2.6));
    }
    if (o.ac) { L.paint.box(0.8, 0.55, 0.3, m(W / 2, GY + 6.75, 3.12), 0xd8d8d2); L.metal.box(0.5, 0.42, 0.02, m(W / 2 + 0.06, GY + 6.75, 2.965), 0x3a3c3e); }
    // the back: kitchen and 亭子间 under a flat 晒台 roof
    const RD0 = 13.8, RH = GY + 6.9;
    BR(W, RH - GY, D - RD0, W / 2, (GY + RH) / 2, (RD0 + D) / 2, rgb(0.92, 0.9, 0.88));
    L.conc.box(W, 0.12, D - RD0, m(W / 2, RH + 0.06, (RD0 + D) / 2), 0x8a8a84, [3, 3]);
    BR(W, 0.9, 0.14, W / 2, RH + 0.45, D - 0.07); BR(0.14, 0.9, D - RD0, 0, RH + 0.45, (RD0 + D) / 2);
    if (o.end) BR(0.14, 0.9, D - RD0, W, RH + 0.45, (RD0 + D) / 2);
    for (const aw of [W * 0.3, W * 0.72]) L.winS.quad(0.8, 1.2, m(aw, GY + 4.7, D + 0.012), { u0: (no + (aw > 2 ? 1 : 0)) % 4 * 0.25, u1: (no + (aw > 2 ? 1 : 0)) % 4 * 0.25 + 0.25, v0: 0.1, v1: 0.9 });
    rod(L.metal, [W * 0.1, RH + 1.6, RD0 + 0.6], [W * 0.1, RH + 1.6, D - 0.6], 0.04, 0x6a5a3a, F);
    if (no % 2 === 0) for (let k = 0; k < 3; k++) L.cloth.box(0.04, R(0.5, 0.8), R(0.4, 0.7), m(W * 0.1, RH + 1.25, RD0 + 1.4 + k * 1.1), pick([0x8a3a3a, 0x3a5a8a, 0xd8d4c8, 0x4a6a4a, 0xc8a24a]));
  }
  const laneLampsLocal = [];
  // the long roof of a row: one slab per slope, gables at both ends, dormers on the front
  function rowRoof(F, Wtot, D, o) {
    const m = (a, y, d, r = 0, rx = 0, rz = 0) => lm(F, a, y, d, r, rx, rz);
    const f0 = 3.05, rd = 8.6, b1 = 13.95, fl = Math.hypot(rd - f0, RIDGE - EAVE), bl = Math.hypot(b1 - rd, RIDGE - EAVE);
    const af = Math.atan2(RIDGE - EAVE, rd - f0), ab = Math.atan2(RIDGE - EAVE, b1 - rd);
    L.roof.box(Wtot + 0.5, 0.12, fl + 0.5, m(Wtot / 2, (EAVE + RIDGE) / 2 + 0.06, (f0 + rd) / 2 - 0.2, 0, -af, 0), WHITE, [2, 2], 1.2);
    L.roof.box(Wtot + 0.5, 0.12, bl + 0.3, m(Wtot / 2, (EAVE + RIDGE) / 2 + 0.06, (rd + b1) / 2 + 0.1, 0, ab, 0), WHITE, [2, 2], 1.2);
    L.stone.box(Wtot + 0.5, 0.18, 0.34, m(Wtot / 2, RIDGE + 0.12, rd), rgb(0.5, 0.48, 0.46), [1, 1]);
    for (const a of [0, Wtot]) {
      const s = new THREE.Shape([new THREE.Vector2(f0, EAVE), new THREE.Vector2(b1, EAVE), new THREE.Vector2(rd, RIDGE + 0.1)]);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); g.rotateY(-PI / 2); g.translate(a + (a ? 0.15 : 0.15), 0, 0);
      L.brick.geo(g, F, WHITE, [2, 2]);
      L.brick.box(0.3, EAVE - GY, D, m(a, (GY + EAVE) / 2, D / 2), WHITE, [2, 2], 0.8);
    }
    for (const a of o.dormers) {
      const dd = 5.0, y0 = EAVE + (dd - f0) * Math.tan(af);
      L.brick.box(1.5, 1.3, 1.6, m(a, y0 + 0.4, dd + 0.4), WHITE, [2, 2]);
      L.winS.quad(0.9, 0.82, m(a, y0 + 0.5, dd - 0.41, PI), { u0: (a * 7 | 0) % 4 * 0.25, u1: (a * 7 | 0) % 4 * 0.25 + 0.25, v0: 0.3, v1: 0.75 });
      for (const s of [-1, 1]) L.roof.box(1.0, 0.08, 1.9, m(a + s * 0.42, y0 + 1.2, dd + 0.35, 0, 0, s * 0.55), WHITE, [2, 2]);
    }
  }
  // south row: numbers 2-20, back walls on the map edge
  {
    const D = 700.5 - LZ1;
    for (let i = 0; i < 10; i++) {
      const F = M4(XW + i * UW, 0, LZ1, 0);
      shikumen(F, D, 2 + i * 2, { ped: i % 3, couplet: i % 3 !== 1, meter: i % 2 === 0, ac: i % 3 === 0, end: i === 9, win: [[0, 2, 1, 3, 0, 2, 3, 0, 1, 2][i], [2, 0, 3, 0, 1, 1, 0, 2, 0, 3][i]] });
    }
    rowRoof(M4(XW, 0, LZ1, 0), UW * 10, D, { dormers: [XW + 6.5 - XW, 15.1, 23.7, 36.6] });
    add({ x0: XW, x1: XE, z0: LZ1, z1: 700.6, y0: 0, y1: 11, kind: 'yongan-row' });
  }
  // north row: numbers 1-9, backs onto 新河路 with shops in the old kitchens
  const NB = 655.0;
  {
    const D = LZ0 - NB;
    for (let i = 0; i < 5; i++) {
      const F = M4(XW + (i + 1) * UW, 0, LZ0, PI);
      shikumen(F, D, 1 + i * 2, { ped: (i + 1) % 3, couplet: i !== 2, meter: i % 2 === 1, ac: i % 2 === 0, end: i === 0, win: [[3, 0, 2, 0, 1][i], [0, 2, 0, 3, 0][i]] });
    }
    rowRoof(M4(XW + 5 * UW, 0, LZ0, PI), UW * 5, D, { dormers: [6.4, 15.0] });
    add({ x0: XW, x1: XW + 5 * UW, z0: NB, z1: LZ0, y0: 0, y1: 11, kind: 'yongan-row' });
    // 新河路 frontage: roller shutters, a tailor, the noodle shop still open
    for (let i = 0; i < 5; i++) {
      const x = XW + i * UW + UW / 2, z = NB - 0.01;
      if (i === 1) {
        L.glow.geo(new THREE.PlaneGeometry(3.0, 2.0), M4(x, GY + 1.3, z - 0.04, PI), rgb(1.9, 1.5, 0.95));
        L.glass.geo(new THREE.PlaneGeometry(3.2, 2.3), M4(x, GY + 1.4, z - 0.1, PI));
        L.signLit.quad(3.2, 0.8, M4(x, GY + 2.95, z - 0.12, PI), SIGNS.noodle);
        L.paint.box(3.6, 0.08, 0.9, M4(x, GY + 2.5, z - 0.45), 0x8a2a20);
        LAMPS.push({ x, y: GY + 1.3, z: z - 1.2, c: [1.0, 0.75, 0.45], k: 1.2, rad: 2.8 });
      } else {
        L.signFlat.quad(3.2, 2.5, M4(x, GY + 1.25, z - 0.03, PI), SIGNS.shutter);
        if (i === 3) L.signFlat.quad(2.6, 0.66, M4(x, GY + 2.85, z - 0.04, PI), SIGNS.repair);
      }
    }
  }
  // the back lane (支弄) and the corner house on 江滨东二路
  const BLX0 = XW + 5 * UW, BLX1 = BLX0 + 2.4;          // -835 .. -832.6
  const zDiag = (x) => 652 + (x + 835) * (21 / 22);
  {
    // east gable of the north row on the back lane: a blind brick wall, meters, a pipe
    L.brick.box(0.3, EAVE - GY, LZ0 - NB, M4(BLX0 - 0.15, (GY + EAVE) / 2, (NB + LZ0) / 2), WHITE, [2, 2], 0.8);
    L.paint.box(0.14, 0.5, 0.36, M4(BLX0 + 0.07, GY + 2.3, 668), 0x8a8e88);
    rod(L.metal, [BLX0 + 0.08, EAVE, 672.5], [BLX0 + 0.08, GY + 0.1, 672.5], 0.08, 0x4a4c4e);
    // back-lane gate onto 新河路
    for (const x of [BLX0 + 0.12, BLX1 - 0.12]) { L.brick.box(0.36, 3.3, 0.36, M4(x, GY + 1.65, NB + 0.2), WHITE, [2, 2]); add({ x0: x - 0.2, x1: x + 0.2, z0: NB, z1: NB + 0.4, y0: 0, y1: 3.3, kind: 'lane-gate' }); }
    L.brick.box(BLX1 - BLX0 + 0.4, 0.42, 0.36, M4((BLX0 + BLX1) / 2, GY + 3.3, NB + 0.2), WHITE, [2, 2]);
    L.signFlat.quad(1.3, 0.5, M4((BLX0 + BLX1) / 2, GY + 3.3, NB + 0.01, PI), SIGNS.lane2);
    L.metal.box(0.04, 0.04, 2.2, M4(BLX0 + 0.3, GY + 0.04, NB + 0.6), 0x2a2c2e);
    // the corner house: three floors of stucco, shops on the ground floor
    const P = [[BLX1, LZ0], [XE, LZ0], [XE, zDiag(XE) + 0.5], [BLX1, zDiag(BLX1) + 0.5]];
    const H = 3 * 3.3, cream = rgb(0.98, 0.92, 0.8);
    for (let i = 0; i < 4; i++) {
      const a = P[i], c = P[(i + 1) % 4], len = Math.hypot(c[0] - a[0], c[1] - a[1]), ry = Math.atan2(c[0] - a[0], c[1] - a[1]);
      const nx = -(c[1] - a[1]) / len, nz = (c[0] - a[0]) / len;   // outward for this winding
      const mid = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
      L.plaster.box(0.3, H, len + 0.3, M4(mid[0] - nx * 0.15, GY + H / 2, mid[1] - nz * 0.15, ry), cream, [4, 4], 1.0);
      for (const y of [GY + 3.3, GY + 6.6]) L.stone.box(0.12, 0.2, len + 0.4, M4(mid[0] + nx * 0.04, y, mid[1] + nz * 0.04, ry), rgb(0.86, 0.8, 0.7), [1, 1]);
      L.stone.box(0.2, 0.8, len + 0.4, M4(mid[0] + nx * 0.06, GY + H + 0.4, mid[1] + nz * 0.06, ry), rgb(0.86, 0.8, 0.7), [1, 1]);
      const bays = Math.max(1, Math.floor(len / 2.6));
      for (let b = 0; b < bays; b++) {
        const f = (b + 0.5) / bays, px = lerp(a[0], c[0], f) + nx * 0.012, pz = lerp(a[1], c[1], f) + nz * 0.012;
        const face = Math.atan2(nx, nz);
        for (const fl of [1, 2]) { const v = (b + fl + i) % 4; L.winL.quad(1.4, 1.5, M4(px, GY + fl * 3.3 + 1.6, pz, face), { u0: v * 0.25, u1: v * 0.25 + 0.25, v0: 0, v1: 1 }); L.stone.box(0.2, 0.08, 1.6, M4(px + nx * 0.06, GY + fl * 3.3 + 0.8, pz + nz * 0.06, ry), rgb(0.86, 0.8, 0.7)); if (v !== 2) LAMPS.push({ x: px + nx * 0.8, y: GY + fl * 3.3 + 1.6, z: pz + nz * 0.8, c: [1.0, 0.8, 0.55], k: 0.25, rad: 1.6 }); }
      }
      C.cornerFaces = C.cornerFaces || []; C.cornerFaces.push({ a, c, nx, nz, len, ry });
    }
    { const s = new THREE.Shape(P.map((p) => new THREE.Vector2(p[0], -p[1]))); const g = new THREE.ShapeGeometry(s); g.rotateX(-PI / 2); g.translate(0, GY + H + 0.02, 0); L.conc.geo(g, null, 0x6a6a66, [3, 3]); }
    // ground floor shops: 好邻里 24H on the corner, 理发 down the diagonal, the 烟杂店 by the lane
    const faces = C.cornerFaces; delete C.cornerFaces;
    const diag = faces[2], east = faces[1];
    const shop = (fc, f0, f1, signKey, light, glowCol, interior) => {
      const a = fc.a, c = fc.c, fm = (f0 + f1) / 2, px = lerp(a[0], c[0], fm), pz = lerp(a[1], c[1], fm), w = (f1 - f0) * fc.len, face = Math.atan2(fc.nx, fc.nz);
      L.glow.geo(new THREE.PlaneGeometry(w - 0.3, 2.3), M4(px - fc.nx * 0.5, GY + 1.35, pz - fc.nz * 0.5, face), glowCol);
      if (interior) L.signLit.quad(w - 0.4, 1.6, M4(px - fc.nx * 0.45, GY + 1.2, pz - fc.nz * 0.45, face), SIGNS.storeInt);
      L.glass.geo(new THREE.PlaneGeometry(w - 0.2, 2.5), M4(px + fc.nx * 0.03, GY + 1.4, pz + fc.nz * 0.03, face));
      L.signLit.quad(Math.min(w, 4.6), Math.min(w, 4.6) / 4, M4(px + fc.nx * 0.08, GY + 2.95, pz + fc.nz * 0.08, face), SIGNS[signKey]);
      for (const f of [f0, f1]) L.stone.box(0.3, 2.8, 0.3, M4(lerp(a[0], c[0], f) + fc.nx * 0.05, GY + 1.4, lerp(a[1], c[1], f) + fc.nz * 0.05, fc.ry), rgb(0.82, 0.78, 0.7));
      LAMPS.push({ x: px + fc.nx * 1.4, y: GY + 1.4, z: pz + fc.nz * 1.4, c: light, k: 1.6, rad: 3.4 });
    };
    shop(diag, 0.0, 0.3, 'shop24', [0.8, 0.98, 0.9], rgb(2.0, 2.2, 2.0), true);
    shop(diag, 0.62, 0.8, 'barber', [0.85, 0.9, 1.0], rgb(1.7, 1.8, 2.0), false);
    shop(east, 0.15, 0.75, 'tobacco', [1.0, 0.72, 0.4], rgb(2.0, 1.4, 0.8), false);
    L.signFlat.quad(3.0, 2.4, M4(lerp(diag.a[0], diag.c[0], 0.46) + diag.nx * 0.02, GY + 1.25, lerp(diag.a[1], diag.c[1], 0.46) + diag.nz * 0.02, Math.atan2(diag.nx, diag.nz)), SIGNS.shutter);
    { // barber pole by the door
      const f = 0.82, px = lerp(diag.a[0], diag.c[0], f) + diag.nx * 0.3, pz = lerp(diag.a[1], diag.c[1], f) + diag.nz * 0.3;
      for (let k = 0; k < 6; k++) L.glow.geo(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 16), M4(px, GY + 1.6 + k * 0.14, pz, k * 0.5), k % 3 === 0 ? rgb(2.6, 0.3, 0.25) : k % 3 === 1 ? rgb(2.4, 2.4, 2.4) : rgb(0.3, 0.6, 2.6));
    }
    L.signFlat.quad(0.42, 0.2, M4(XE + 0.012, GY + 2.3, 677.4, PI / 2), SIGNS.plateXH);
    // the corner house's lane side: back doors of the flats above the shops, barred kitchen windows
    for (const [x, v] of [[-830.2, 0], [-825.4, 1], [-821.0, 3]]) {
      const z = LZ0 + 0.012;
      L.door.quad(1.0, 2.2, M4(x, GY + 1.1, z, 0), { u0: 0, u1: 1, v0: 0, v1: 1 });
      L.stone.box(1.3, 0.14, 0.2, M4(x, GY + 2.27, LZ0 + 0.08), rgb(0.82, 0.78, 0.7));
      for (const s of [-1, 1]) L.stone.box(0.14, 2.3, 0.18, M4(x + s * 0.57, GY + 1.15, LZ0 + 0.07), rgb(0.82, 0.78, 0.7));
      L.stone.box(1.2, 0.12, 0.4, M4(x, GY + 0.06, LZ0 + 0.2), rgb(0.7, 0.68, 0.64));
      L.winS.quad(0.8, 0.9, M4(x + 1.45, GY + 1.75, z, 0), { u0: v * 0.25, u1: v * 0.25 + 0.25, v0: 0.1, v1: 0.9 });
      for (let k = 0; k < 5; k++) L.metal.box(0.025, 0.95, 0.025, M4(x + 1.13 + k * 0.16, GY + 1.75, LZ0 + 0.06), 0x2a2c2e);
      L.paint.box(0.3, 0.42, 0.14, M4(x - 0.95, GY + 2.0, LZ0 + 0.07), 0x8a8e88);
      if (v !== 2) LAMPS.push({ x: x + 1.45, y: GY + 1.75, z: LZ0 + 0.7, c: [1.0, 0.8, 0.55], k: 0.3, rad: 1.4 });
    }
    // collider strips under the diagonal face
    for (let x = BLX1; x < XE - 0.01; x += 0.6) { const xb = Math.min(XE, x + 0.6); add({ x0: x, x1: xb, z0: zDiag(x) + 0.5, z1: LZ0, y0: 0, y1: H, kind: 'corner-house' }); }
  }
  // the 过街楼 over the lane mouth: an arched passage with a room on top and the lane's name
  {
    const x0 = XE - 4.0, x1 = XE, zc = (LZ0 + LZ1) / 2, y0 = GY + 3.45, y1 = EAVE + 0.1;
    L.brick.box(x1 - x0, y1 - y0, LZ1 - LZ0 + 0.1, M4((x0 + x1) / 2, (y0 + y1) / 2, zc), WHITE, [2, 2], 0.8);
    L.plaster.box(x1 - x0 - 0.1, 0.08, LZ1 - LZ0, M4((x0 + x1) / 2, y0 - 0.03, zc), rgb(0.8, 0.78, 0.72), [4, 4], 0.6);
    const s = new THREE.Shape(); s.moveTo(-2.15, 0); s.lineTo(2.15, 0); s.lineTo(2.15, y1 - GY); s.lineTo(-2.15, y1 - GY); s.lineTo(-2.15, 0);
    const hole = new THREE.Path(); hole.moveTo(-1.8, 0); hole.lineTo(1.8, 0); hole.lineTo(1.8, 2.75); hole.quadraticCurveTo(0, 3.85, -1.8, 2.75); hole.lineTo(-1.8, 0); s.holes.push(hole);
    for (const [xf, ry] of [[x1, PI / 2], [x0, -PI / 2]]) {
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.36, bevelEnabled: false, curveSegments: 14 });
      L.stone.geo(g, M4(xf - (ry > 0 ? 0.36 : -0.36) * 0 + (ry > 0 ? -0.2 : 0.2), GY, zc, ry), WHITE, [1, 1]);
    }
    L.signFlat.quad(2.2, 0.68, M4(x1 + 0.18, GY + 4.3, zc, PI / 2), SIGNS.arch);
    for (const s2 of [-1, 1]) { L.winS.quad(0.9, 1.4, M4(x1 + 0.17, GY + 5.9, zc + s2 * 0.95, PI / 2), { u0: 0, u1: 0.25, v0: 0, v1: 1 }); L.winS.quad(0.9, 1.4, M4(x0 - 0.17, GY + 5.9, zc + s2 * 0.95, -PI / 2), { u0: 0.75, u1: 1, v0: 0, v1: 1 }); }
    L.roof.box(x1 - x0 + 0.6, 0.12, LZ1 - LZ0 + 0.8, M4((x0 + x1) / 2, y1 + 0.1, zc), WHITE, [2, 2]);
    rod(L.metal, [-815.5, y0, zc], [-815.5, y0 - 0.35, zc], 0.02, 0x1a1a1a);
    L.glow.geo(new THREE.SphereGeometry(0.09, 12, 8), M4(-815.5, y0 - 0.42, zc), rgb(4.0, 2.9, 1.5));
    // recycling point outside on the pavement
    const binsAt = [[0x4a4e52, 'dry'], [0x6a4a2a, 'wet'], [0x1d5aa0, 'rec'], [0xb02a20, 'haz']];
    binsAt.forEach(([c], k) => { const z = 683.2 + k * 0.78; L.paint.geo(roundedBox(0.68, 1.05, 0.62, 0.05, 2), M4(XE + 0.55, GY + 0.53, z), c); L.paint.geo(roundedBox(0.72, 0.08, 0.66, 0.03, 2), M4(XE + 0.55, GY + 1.08, z, 0, 0, -0.04), c); for (const s3 of [-1, 1]) L.paint.geo(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 14), M4(XE + 0.88, GY + 0.09, z + s3 * 0.22, 0, 0, PI / 2), DARK); });
    add({ x0: XE + 0.15, x1: XE + 0.95, z0: 682.8, z1: 686.1, y0: 0, y1: 1.1, kind: 'bins' });
    L.signFlat.quad(1.8, 0.3, M4(XE + 0.012, GY + 1.85, 684.4, PI / 2), SIGNS.bins);
    LAMPS.push({ x: XE + 1.4, y: GY + 2.6, z: 684.4, c: [0.9, 0.9, 0.95], k: 0.6, rad: 2 });
  }
  // the walk-up at the end of the lane: 永安里 28 号, six floors, 402 is home
  const HOME = { x0: -862.3, x1: -856.78, z0: 682.0, z1: 685.6, y: GY + 0.45 + 3 * 2.8 };
  const WX0 = -870.4, WX1 = XW, WZ0 = NB, WZ1 = 700.5, FH = 2.8, WB = GY + 0.45, WTOP = WB + 6 * FH;
  const WIN = { z0: 683.0, z1: 684.6, y0: HOME.y + 0.9, y1: HOME.y + 2.3 };
  {
    const pl = rgb(0.96, 0.92, 0.82);
    const wall = (x0, x1, z0, z1, y0, y1) => L.plaster.box(x1 - x0, y1 - y0, z1 - z0, M4((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), pl, [4, 4], 1.2);
    // shell; the east wall is split round the real window of 402
    wall(WX0, WX0 + 0.3, WZ0, WZ1, GY, WTOP); wall(WX0, WX1, WZ0, WZ0 + 0.3, GY, WTOP); wall(WX0, WX1, WZ1 - 0.3, WZ1, GY, WTOP);
    wall(WX1 - 0.3, WX1, WZ0, WIN.z0, GY, WTOP); wall(WX1 - 0.3, WX1, WIN.z1, WZ1, GY, WTOP);
    wall(WX1 - 0.3, WX1, WIN.z0, WIN.z1, GY, WIN.y0); wall(WX1 - 0.3, WX1, WIN.z0, WIN.z1, WIN.y1, WTOP);
    L.conc.box(WX1 - WX0, 0.2, WZ1 - WZ0, M4((WX0 + WX1) / 2, WTOP + 0.1, (WZ0 + WZ1) / 2), 0x5a5a56, [3, 3]);
    L.stone.box(WX1 - WX0 + 0.3, 0.45, WZ1 - WZ0 + 0.3, M4((WX0 + WX1) / 2, GY + 0.22, (WZ0 + WZ1) / 2), rgb(0.55, 0.55, 0.52), [1, 1]);
    for (const [ax, az, bx, bz] of [[WX0, WZ0, WX1, WZ0], [WX1, WZ0, WX1, WZ1], [WX1, WZ1, WX0, WZ1], [WX0, WZ1, WX0, WZ0]]) {
      const cx = (ax + bx) / 2, cz = (az + bz) / 2, len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      L.plaster.box(0.5, 0.9, len + 0.5, M4(cx, WTOP + 0.45, cz, ry), rgb(0.85, 0.82, 0.74), [4, 4]);
      for (let f = 1; f < 6; f++) L.stone.box(0.06, 0.14, len + 0.1, M4(cx, WB + f * FH - 0.05, cz, ry), rgb(0.72, 0.7, 0.64), [1, 1]);
    }
    // windows: quads on every face, cages and AC units where the lane or 新河路 can see them
    const face = (axis, fixed, a0, a1, outward, floors) => {
      const len = a1 - a0, bays = Math.round(len / 3.2);
      for (let b = 0; b < bays; b++) for (const f of floors) {
        const a = a0 + (b + 0.5) * len / bays, y = WB + f * FH + 1.55;
        const isHome = axis === 'x' && outward > 0 && f === 3 && a > WIN.z0 - 0.2 && a < WIN.z1 + 0.2;
        const stair = axis === 'x' && outward > 0 && a > LZ0 && a < LZ1;
        if (isHome || stair) continue;
        const v = (b * 3 + f * 5 + (fixed | 0)) % 4, wx = axis === 'x' ? fixed + outward * 0.012 : a, wz = axis === 'x' ? a : fixed + outward * 0.012;
        const ry = axis === 'x' ? (outward > 0 ? PI / 2 : -PI / 2) : (outward > 0 ? 0 : PI);
        L.winL.quad(1.5, 1.4, M4(wx, y, wz, ry), { u0: v * 0.25, u1: v * 0.25 + 0.25, v0: 0, v1: 1 });
        const ox = axis === 'x' ? outward : 0, oz = axis === 'x' ? 0 : outward;
        L.stone.box(axis === 'x' ? 0.2 : 1.7, 0.07, axis === 'x' ? 1.7 : 0.2, M4(wx + ox * 0.08, y - 0.74, wz + oz * 0.08), rgb(0.7, 0.68, 0.62));
        const seen = (axis === 'x' && outward > 0 && f >= 3) || (axis === 'z' && outward < 0);
        if (seen && (b + f) % 2 === 0) {   // 防盗窗 cage, the drying pole stuck out of it
          const cx = wx + ox * 0.22, cz = wz + oz * 0.22, sw = axis === 'x' ? [0.44, 1.64] : [1.64, 0.44];
          L.metal.box(sw[0], 0.04, sw[1], M4(cx, y - 0.72, cz), 0x4a4d4a); L.metal.box(sw[0], 0.04, sw[1], M4(cx, y + 0.72, cz), 0x4a4d4a);
          for (let k = 0; k <= 7; k++) { const t = -0.8 + k * (1.6 / 7); L.metal.box(0.02, 1.44, 0.02, M4(cx + ox * 0.2 + (axis === 'x' ? 0 : t), y, cz + oz * 0.2 + (axis === 'x' ? t : 0)), 0x4a4d4a); }
          if (b % 3 === 0) { rod(L.metal, [cx, y + 0.5, cz], [cx + ox * 1.6, y + 0.62, cz + oz * 1.6], 0.035, 0x8a7a4a); L.cloth.box(axis === 'x' ? 0.5 : 0.04, 0.6, axis === 'x' ? 0.04 : 0.5, M4(cx + ox * 1.1, y + 0.2, cz + oz * 1.1), pick([0x7a3030, 0x30507a, 0xd0ccc0])); }
        }
        if (seen && (b + f) % 3 === 1) { L.paint.box(axis === 'x' ? 0.3 : 0.8, 0.55, axis === 'x' ? 0.8 : 0.3, M4(wx + ox * 0.2 + (axis === 'x' ? 0 : 1.1), y - 1.05, wz + oz * 0.2 + (axis === 'x' ? 1.1 : 0)), 0xd8d8d2); }
        if (v !== 2 && seen) LAMPS.push({ x: wx + ox * 0.9, y, z: wz + oz * 0.9, c: [1, 0.8, 0.55], k: 0.22, rad: 1.6 });
      }
    };
    face('x', WX1, WZ0 + 0.3, WZ1 - 0.3, 1, [3, 4, 5]);
    face('x', WX0, WZ0 + 0.3, WZ1 - 0.3, -1, [0, 1, 2, 3, 4, 5]);
    face('z', WZ0, WX0 + 0.3, WX1, -1, [0, 1, 2, 3, 4, 5]);
    face('z', WZ1, WX0 + 0.3, WX1, 1, [0, 1, 2, 3, 4, 5]);
    // stairwell over the door: half-landing windows, the light on in a few
    for (let f = 0; f < 6; f++) { const y = WB + f * FH + 2.25, v = f % 3 === 1 ? 2 : 1; L.winL.quad(0.9, 0.9, M4(WX1 + 0.012, y, 680, PI / 2), { u0: v * 0.25, u1: v * 0.25 + 0.25, v0: 0, v1: 1 }); }
    // the door: steel security door, canopy, plate, mailboxes, meters, adverts
    L.paint.box(0.08, 2.2, 1.2, M4(WX1 + 0.04, GY + 0.45 + 1.1, 680), 0x2c4a3a);
    L.metal.box(0.1, 2.32, 0.08, M4(WX1 + 0.05, GY + 0.45 + 1.16, 679.36), 0x2a2c2e); L.metal.box(0.1, 2.32, 0.08, M4(WX1 + 0.05, GY + 0.45 + 1.16, 680.64), 0x2a2c2e);
    L.glow.geo(new THREE.BoxGeometry(0.03, 0.16, 0.12), M4(WX1 + 0.1, GY + 1.75, 680.86), rgb(0.4, 1.6, 2.2));
    L.stone.box(0.9, 0.2, 1.4, M4(WX1 + 0.45, GY + 0.1, 680), rgb(0.6, 0.6, 0.56));
    L.conc.box(1.0, 0.1, 1.8, M4(WX1 + 0.5, GY + 2.95, 680), 0x7a7a74, [3, 3]);
    L.signFlat.quad(0.36, 0.22, M4(WX1 + 0.012, GY + 2.45, 681.0, PI / 2), SIGNS.plate28);
    L.signFlat.quad(0.64, 0.48, M4(WX1 + 0.02, GY + 1.45, 678.85, PI / 2), SIGNS.mail);
    L.paint.box(0.14, 0.5, 0.66, M4(WX1 + 0.07, GY + 1.45, 678.85), 0x2e5a3a);
    L.signFlat.quad(0.5, 0.5, M4(WX1 + 0.012, GY + 1.3, 681.4, PI / 2), SIGNS.ads);
    L.glow.geo(new THREE.SphereGeometry(0.08, 12, 8), M4(WX1 + 0.25, GY + 2.82, 680), rgb(3.0, 2.8, 2.4));
    // the roof: stair hut, water tanks, an antenna
    L.plaster.box(3.4, 2.6, 3.8, M4(-860, WTOP + 1.3, 680), pl, [4, 4]);
    for (const z of [664, 692]) { L.conc.box(2.6, 1.6, 2.0, M4(-864, WTOP + 1.4, z), 0x7a7a72, [3, 3]); for (const s of [-1, 1]) L.metal.box(0.12, 0.6, 0.12, M4(-864 + s * 1.1, WTOP + 0.3, z), 0x3a3c3e); }
    rod(L.metal, [-866, WTOP, 672], [-866, WTOP + 3.2, 672], 0.05, 0x5a5c5e); for (let k = 0; k < 4; k++) L.metal.box(1.2 - k * 0.2, 0.03, 0.03, M4(-866, WTOP + 2.0 + k * 0.35, 672), 0x5a5c5e);
    add({ x0: WX0, x1: WX1, z0: WZ0, z1: WZ1, y0: 0, y1: WTOP + 1, kind: 'yongan-28' });
  }
  // ---- the lane floor and everything that stands in it
  {
    const pave = (x0, x1, z0, z1) => { const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0, Math.ceil((x1 - x0) / 0.6), Math.ceil((z1 - z0) / 0.6)); g.rotateX(-PI / 2); L.cobble.geo(g, M4((x0 + x1) / 2, GY + 0.018, (z0 + z1) / 2), WHITE, [1.5, 1.5]); };
    pave(XW, XE + 0.6, LZ0, LZ1); pave(BLX0, BLX1, NB, LZ0);
    L.stone.box(XE - XW, 0.03, 0.22, M4((XW + XE) / 2, GY + 0.02, LZ0 + 0.2), rgb(0.35, 0.35, 0.34));
    for (let x = XW + 4; x < XE; x += 7.5) L.metal.box(0.5, 0.02, 0.24, M4(x, GY + 0.04, LZ0 + 0.2), 0x1f2022);
    for (const [x, z, w, d] of [[-848, 680.6, 1.6, 0.9], [-831, 679.4, 2.2, 1.1], [-822, 680.9, 1.2, 0.7], [-833.8, 662, 0.9, 1.6]]) { const g = new THREE.CircleGeometry(0.5, 32); g.rotateX(-PI / 2); g.scale(w, 1, d); L.puddle.geo(g, M4(x, GY + 0.024, z, R(0, 3), 0, 0), WHITE); }
    // overhead: power and phone lines along and across, empty bamboo drying poles
    const wire = (a, b, sag, r = 0.012) => { const n = 6; let p = a; for (let k = 1; k <= n; k++) { const f = k / n, q = [lerp(a[0], b[0], f), lerp(a[1], b[1], f) - Math.sin(f * PI) * sag, lerp(a[2], b[2], f)]; rod(L.metal, p, q, r, 0x0e0f10); p = q; } };
    for (let x = XW + 2; x < XE - 1; x += 8.6) { wire([x, GY + 6.1, LZ0 - 0.1], [x + 8.6, GY + 6.1, LZ0 - 0.1], 0.35); wire([x, GY + 5.8, LZ0 - 0.1], [x + 8.6, GY + 5.8, LZ0 - 0.1], 0.3, 0.018); L.paint.box(0.3, 0.4, 0.18, M4(x, GY + 5.6, LZ0 - 0.1), 0x6a6e6a); }
    for (const x of [-852, -839, -828]) wire([x, GY + 6.0, LZ0 - 0.1], [x + 1.2, GY + 4.3, LZ1 + 0.1], 0.2);
    for (const x of [-846.5, -836.2, -824]) rod(L.paint, [x, GY + 6.3, LZ0 - 3.2], [x + 0.4, GY + 4.35, LZ1 + 0.25], 0.045, 0x9a8a4a);
    // e-bikes with 挡风被, an old 28-inch bicycle, pots and vegetable boxes
    const LB = { paint: L.paint, metal: L.metal, glow: L.glow, cloth: L.cloth };
    ebike(LB, M4(-849.6, GY, LZ1 - 0.45, PI / 2), 0x2b3a48, { quilt: 0x26304a }); add({ x0: -850.6, x1: -848.6, z0: LZ1 - 0.8, z1: LZ1, y0: 0, y1: 1.2, kind: 'ebike' });
    ebike(LB, M4(-847.4, GY, LZ1 - 0.45, PI / 2), 0x6a2a2a, { quilt: 0x5a2430 }); add({ x0: -848.4, x1: -846.4, z0: LZ1 - 0.8, z1: LZ1, y0: 0, y1: 1.2, kind: 'ebike' });
    ebike(LB, M4(-824.2, GY, LZ1 - 0.45, -PI / 2), 0xd8d8d0, { quilt: 0x2a3a2a, box: 0xe2b324 }); add({ x0: -825.2, x1: -823.2, z0: LZ1 - 0.8, z1: LZ1, y0: 0, y1: 1.2, kind: 'ebike' });
    bicycle(LB, M4(-838.2, GY, LZ0 + 0.35, PI / 2)); add({ x0: -839, x1: -837.4, z0: LZ0, z1: LZ0 + 0.6, y0: 0, y1: 1.1, kind: 'bicycle' });
    for (const [x, z] of [[-853.8, LZ0 + 0.35], [-841.5, LZ1 - 0.35], [-830.2, LZ0 + 0.35], [-833.0, 660]]) { plant(L, M4(x, GY, z), 1.2); add({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, y0: 0, y1: 0.9, kind: 'pot' }); }
    for (const [x, z] of [[-845.0, LZ0 + 0.3], [-819.8, LZ1 - 0.3]]) { foamBox(L, M4(x, GY, z)); add({ x0: x - 0.35, x1: x + 0.35, z0: z - 0.25, z1: z + 0.25, y0: 0, y1: 0.7, kind: 'pot' }); }
    // fire hose cabinet, the community notice board (lit), a tap
    L.paint.box(0.7, 0.9, 0.2, M4(-840.8, GY + 1.2, LZ0 + 0.1), 0xb01c16); L.signFlat.quad(0.58, 0.72, M4(-840.8, GY + 1.2, LZ0 + 0.205), SIGNS.hydrant);
    L.paint.box(1.9, 1.2, 0.12, M4(-829.0, GY + 1.75, LZ1 - 0.06), 0x2a3a4a); L.signLit.quad(1.7, 1.06, M4(-829.0, GY + 1.75, LZ1 - 0.125, PI), SIGNS.notice);
    LAMPS.push({ x: -829, y: GY + 1.7, z: LZ1 - 0.9, c: [0.9, 0.92, 1.0], k: 0.55, rad: 1.6 });
    L.metal.geo(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 12), M4(-836.4, GY + 0.45, LZ1 - 0.12), 0x5a5c5e);
    L.paint.box(0.6, 0.1, 0.4, M4(-836.4, GY + 0.05, LZ1 - 0.3), 0x8a8a84);
    // a stool, a radio, a cat on the courtyard wall
    L.paint.box(0.32, 0.04, 0.32, M4(-818.4, GY + 0.42, LZ0 + 0.55), 0x6a4a2a); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) L.paint.box(0.03, 0.42, 0.03, M4(-818.4 + sx * 0.13, GY + 0.21, LZ0 + 0.55 + sz * 0.13), 0x4a3a2a);
    L.paint.box(0.26, 0.16, 0.1, M4(-817.7, GY + 0.08, LZ0 + 0.4), 0x8a2a20);
    { const cx = -844.2, cy = GY + 4.28, cz = LZ1 + 0.16, cat = 0x4a3a2e; L.paint.geo(new THREE.SphereGeometry(0.17, 14, 10), M4(cx, cy + 0.12, cz, 0, 0, 0, 1.5, 0.75, 0.8), cat); L.paint.geo(new THREE.SphereGeometry(0.1, 12, 10), M4(cx + 0.24, cy + 0.24, cz - 0.02), cat); for (const s of [-1, 1]) L.paint.geo(new THREE.ConeGeometry(0.035, 0.07, 8), M4(cx + 0.26, cy + 0.34, cz + s * 0.05), cat); rod(L.paint, [cx - 0.22, cy + 0.1, cz], [cx - 0.42, cy - 0.12, cz + 0.06], 0.035, cat); }
    add({ x0: -819.0, x1: -817.4, z0: LZ0, z1: LZ0 + 0.85, y0: 0, y1: 1.2, kind: 'stool' });
  }
  // people of the lane at a quarter to midnight
  {
    const ppl = [
      { look: { sex: 'm', top: 'coat', hairStyle: 'short', hair: 0x8a8680, topColor: 0x3a3a34 }, pose: 'sit', x: -818.4, y: GY + 0.02, z: LZ0 + 0.55, ry: -PI / 2 },
      { look: { sex: 'f', top: 'coat', hold: 'umbrella', holdColor: 0x7a2430 }, pose: 'stride', x: -836.8, y: GY, z: 680.3, ry: -PI / 2 },
      { look: { sex: 'm', top: 'jacket', topColor: 0x2a6ab0, hairStyle: 'cap' }, pose: 'phone', x: -810.6, y: GY, z: 669.6, ry: PI * 0.75 },
      { look: { sex: 'f', top: 'hoodie' }, pose: 'talk', x: -809.0, y: GY, z: 667.8, ry: -PI * 0.7 },
      { look: { sex: 'm', top: 'jacket' }, pose: 'stand', x: -844.0, y: GY, z: NB - 1.6, ry: PI },
    ];
    scene.add(G.people.crowd(ppl, 'yongan-people'));
    const LB = { paint: L.paint, metal: L.metal, glow: L.glow, cloth: L.cloth };
    ebike(LB, M4(-811.4, GY, 670.6, PI * 0.75), 0xe8e8e0, { quilt: 0x1f2a3a, box: 0xe2b324, on: true });
    add({ x0: -812.4, x1: -810.4, z0: 669.6, z1: 671.6, y0: 0, y1: 1.2, kind: 'ebike' });
  }

  // ================================================================ 402: the rented room
  {
    const H = HOME, y = H.y, Hc = 2.62, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2;
    const IB = bins(['paint', 'floor', 'cloth', 'metal', 'glow', 'signFlat', 'glass', 'wood']);
    const lampP = { x: cx, y: y + Hc - 0.12, z: cz, c: [1.0, 0.93, 0.8], k: 1.25, rad: 2.3 };
    const RL = [lampP, { x: -860.1, y: y + 0.32, z: 685.25, c: [1.0, 0.45, 0.15], k: 0.6, rad: 0.9 }, { x: -857.1, y: y + 1.0, z: 683.8, c: [0.6, 0.72, 1.0], k: 0.25, rad: 0.7 }];
    IB.floor.geo(new THREE.PlaneGeometry(H.x1 - H.x0, H.z1 - H.z0, 12, 8).rotateX(-PI / 2), M4(cx, y + 0.005, cz), WHITE, [1.6, 1.6]);
    IB.paint.geo(new THREE.PlaneGeometry(H.x1 - H.x0, H.z1 - H.z0, 10, 6).rotateX(PI / 2), M4(cx, y + Hc, cz), 0xe8e6de);
    // walls: lime white over a green 墙裙, seen from inside only
    const wallIn = (w, h, m, c) => IB.paint.geo(new THREE.PlaneGeometry(w, h, Math.ceil(w / 0.4), Math.ceil(h / 0.4)), m, c);
    const sides = [[H.x1 - H.x0, M4(cx, 0, H.z0, 0)], [H.x1 - H.x0, M4(cx, 0, H.z1, PI)], [H.z1 - H.z0, M4(H.x0, 0, cz, PI / 2)]];
    for (const [w, mm] of sides) { wallIn(w, 1.1, mm.clone().multiply(M4(0, y + 0.55, 0)), 0x4a6a58); wallIn(w, Hc - 1.1, mm.clone().multiply(M4(0, y + 1.1 + (Hc - 1.1) / 2, 0)), 0xe2ded2); IB.paint.geo(new THREE.PlaneGeometry(w, 0.04), mm.clone().multiply(M4(0, y + 1.1, 0.004)), 0x2a3a30); }
    { // east wall round the window
      const E = H.x1 - 0.002, m = (zz, yy) => M4(E, yy, zz, -PI / 2);
      const z0 = WIN.z0, z1 = WIN.z1;
      wallIn(z0 - H.z0, Hc, m((H.z0 + z0) / 2, y + Hc / 2), 0xe2ded2); wallIn(H.z1 - z1, Hc, m((z1 + H.z1) / 2, y + Hc / 2), 0xe2ded2);
      wallIn(z1 - z0, WIN.y0 - y, m((z0 + z1) / 2, (y + WIN.y0) / 2), 0xe2ded2); wallIn(z1 - z0, y + Hc - WIN.y1, m((z0 + z1) / 2, (WIN.y1 + y + Hc) / 2), 0xe2ded2);
      for (const zz of [z0, z1]) IB.paint.box(0.3, WIN.y1 - WIN.y0, 0.02, M4(H.x1 + 0.13, (WIN.y0 + WIN.y1) / 2, zz + (zz === z0 ? 0.01 : -0.01)), 0xd8d4c8);
      IB.paint.box(0.3, 0.02, z1 - z0, M4(H.x1 + 0.13, WIN.y1 - 0.01, (z0 + z1) / 2), 0xd8d4c8);
      IB.paint.box(0.36, 0.04, z1 - z0 + 0.1, M4(H.x1 + 0.12, WIN.y0, (z0 + z1) / 2), 0xb8b4a8);
      // aluminium sash, two panes, half open
      IB.metal.box(0.05, WIN.y1 - WIN.y0, 0.05, M4(H.x1 + 0.2, (WIN.y0 + WIN.y1) / 2, (z0 + z1) / 2), 0xb8bcbe);
      for (const yy of [WIN.y0 + 0.03, WIN.y1 - 0.03]) IB.metal.box(0.05, 0.05, z1 - z0, M4(H.x1 + 0.2, yy, (z0 + z1) / 2), 0xb8bcbe);
      IB.glass.geo(new THREE.PlaneGeometry(0.78, WIN.y1 - WIN.y0 - 0.06), M4(H.x1 + 0.21, (WIN.y0 + WIN.y1) / 2, z0 + 0.4, -PI / 2));
      // the 防盗窗 cage outside, and a towel left on it
      const ox = WX1 + 0.42;
      IB.metal.box(0.44, 0.04, z1 - z0 + 0.3, M4(WX1 + 0.22, WIN.y0 - 0.05, (z0 + z1) / 2), 0x4a4d4a); IB.metal.box(0.44, 0.04, z1 - z0 + 0.3, M4(WX1 + 0.22, WIN.y1 + 0.05, (z0 + z1) / 2), 0x4a4d4a);
      for (let k = 0; k <= 8; k++) IB.metal.box(0.02, WIN.y1 - WIN.y0 + 0.1, 0.02, M4(ox, (WIN.y0 + WIN.y1) / 2, z0 - 0.15 + k * (z1 - z0 + 0.3) / 8), 0x4a4d4a);
      IB.cloth.box(0.02, 0.5, 0.42, M4(ox + 0.02, WIN.y1 - 0.25, z1 - 0.3), 0x6a8aa8);
      // curtains, floral, one drawn
      IB.cloth.box(0.04, Hc - 0.5, 0.6, M4(H.x1 - 0.12, y + (Hc - 0.5) / 2 + 0.4, z1 + 0.05), 0xb88a5a);
      IB.cloth.box(0.04, Hc - 0.5, 0.35, M4(H.x1 - 0.12, y + (Hc - 0.5) / 2 + 0.4, z0 - 0.05), 0xb88a5a);
      rod(IB.metal, [H.x1 - 0.12, y + Hc - 0.08, H.z0 + 0.3], [H.x1 - 0.12, y + Hc - 0.08, H.z1 - 0.3], 0.02, 0xc0c0b8);
    }
    // the door to the landing, slippers, a hook with a coat
    IB.wood.box(0.86, 2.0, 0.05, M4(-860.45, y + 1.0, H.z0 + 0.03), 0x7a5a3a);
    IB.metal.geo(new THREE.SphereGeometry(0.035, 10, 8), M4(-860.1, y + 1.0, H.z0 + 0.07), 0xc8a85a);
    for (const s of [-1, 1]) IB.paint.geo(roundedBox(0.1, 0.04, 0.26, 0.02, 2), M4(-861.0 + s * 0.08, y + 0.02, H.z0 + 0.35, 0.2 * s), 0x3a6aa8);
    IB.cloth.box(0.42, 0.9, 0.14, M4(-861.5, y + 1.35, H.z0 + 0.1), 0x2a2e36);
    // bed with a floral sheet, pillow and folded quilt, a suitcase under it
    const BX0 = -862.2, BX1 = -860.2, BZ0 = 684.35, BZ1 = 685.55;
    IB.metal.box(BX1 - BX0, 0.05, BZ1 - BZ0, M4((BX0 + BX1) / 2, y + 0.3, (BZ0 + BZ1) / 2), 0x3a3c40);
    for (const [px, pz] of [[BX0 + 0.03, BZ0 + 0.03], [BX1 - 0.03, BZ0 + 0.03], [BX0 + 0.03, BZ1 - 0.03], [BX1 - 0.03, BZ1 - 0.03]]) IB.metal.box(0.04, 0.32, 0.04, M4(px, y + 0.16, pz), 0x3a3c40);
    IB.metal.box(0.04, 0.55, BZ1 - BZ0, M4(BX0 + 0.02, y + 0.6, (BZ0 + BZ1) / 2), 0x3a3c40);
    IB.cloth.geo(roundedBox(BX1 - BX0 - 0.04, 0.16, BZ1 - BZ0 - 0.04, 0.05, 2), M4((BX0 + BX1) / 2, y + 0.41, (BZ0 + BZ1) / 2), 0xd8a8a0);
    IB.cloth.geo(roundedBox(0.4, 0.12, 0.7, 0.05, 2), M4(BX0 + 0.3, y + 0.55, (BZ0 + BZ1) / 2), 0xf0ece0);
    IB.cloth.geo(roundedBox(0.7, 0.2, 1.1, 0.07, 2), M4(BX1 - 0.5, y + 0.58, (BZ0 + BZ1) / 2), 0x8a4a5a);
    IB.paint.geo(roundedBox(0.7, 0.24, 0.48, 0.04, 2), M4(-861.0, y + 0.13, 684.95), 0x2a4a6a);
    // 布衣柜: a steel-tube wardrobe with a fabric cover
    IB.cloth.box(0.5, 1.7, 1.0, M4(-862.0, y + 0.9, 682.65), 0x8a9aa8);
    IB.paint.box(0.52, 0.04, 1.02, M4(-862.0, y + 1.76, 682.65), 0x5a6a78);
    // desk under the window: laptop, noodle cup, the red 热水瓶, a desk lamp
    const DX = -857.12;
    IB.wood.box(0.6, 0.04, 1.2, M4(DX, y + 0.74, 683.8), 0xc8b08a);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) IB.metal.box(0.03, 0.72, 0.03, M4(DX + sx * 0.26, y + 0.36, 683.8 + sz * 0.56), 0x6a6c6e);
    IB.paint.box(0.26, 0.015, 0.34, M4(DX - 0.05, y + 0.765, 683.55), 0x2a2c30);
    IB.paint.box(0.015, 0.22, 0.34, M4(DX + 0.08, y + 0.88, 683.55, 0, 0, 0.25), 0x2a2c30);
    IB.signFlat.quad(0.32, 0.2, M4(DX + 0.067, y + 0.88, 683.55, -PI / 2, 0, -0.25), SIGNS.laptop);
    IB.paint.geo(new THREE.CylinderGeometry(0.055, 0.045, 0.11, 18), M4(DX - 0.1, y + 0.815, 684.15), 0xe8c84a);
    IB.paint.geo(new THREE.CylinderGeometry(0.07, 0.07, 0.34, 18), M4(DX, y + 0.93, 684.32), 0xc0281c);
    IB.paint.geo(new THREE.CylinderGeometry(0.045, 0.06, 0.06, 18), M4(DX, y + 1.13, 684.32), 0xe8e4d8);
    IB.metal.geo(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), M4(DX + 0.1, y + 0.77, 683.15), 0x2a2c30);
    rod(IB.metal, [DX + 0.1, y + 0.78, 683.15], [DX - 0.05, y + 1.15, 683.15], 0.015, 0x2a2c30);
    IB.glow.geo(new THREE.ConeGeometry(0.07, 0.1, 16, 1, true), M4(DX - 0.07, y + 1.1, 683.15), rgb(2.0, 1.8, 1.3));
    IB.paint.geo(roundedBox(0.36, 0.42, 0.36, 0.06, 2), M4(-857.95, y + 0.21, 683.75), 0xc0281c);
    // fridge with the rice cooker and kettle on top, magnets
    IB.paint.geo(roundedBox(0.52, 0.86, 0.52, 0.03, 2), M4(-857.08, y + 0.43, 682.33), 0xe8e8e2);
    IB.metal.box(0.02, 0.3, 0.03, M4(-857.35, y + 0.6, 682.5), 0x8a8c8e);
    for (let k = 0; k < 4; k++) IB.paint.box(0.01, 0.05, 0.05, M4(-857.35, y + 0.4 + R(0, 0.3), 682.15 + R(0, 0.3)), pick([0xd8432f, 0x3a8ad4, 0xf2b630]));
    IB.paint.geo(new THREE.CylinderGeometry(0.13, 0.14, 0.22, 20), M4(-857.0, y + 0.97, 682.25), 0xf0ece4);
    IB.paint.geo(new THREE.CylinderGeometry(0.08, 0.09, 0.2, 18), M4(-857.15, y + 0.96, 682.5), 0x8a9aa8);
    // clothes on a stand by the window, a mirror, the calendar and a poster
    rod(IB.metal, [-858.4, y, 685.35], [-858.4, y + 1.6, 685.35], 0.025, 0xb8bcbe); rod(IB.metal, [-857.4, y, 685.35], [-857.4, y + 1.6, 685.35], 0.025, 0xb8bcbe);
    rod(IB.metal, [-858.4, y + 1.58, 685.35], [-857.4, y + 1.58, 685.35], 0.025, 0xb8bcbe);
    [0x3a4a6a, 0xd8d0c0, 0x6a3a3a].forEach((c, k) => IB.cloth.box(0.26, 0.62, 0.05, M4(-858.25 + k * 0.33, y + 1.22, 685.35), c));
    IB.signFlat.quad(0.3, 0.4, M4(-858.9, y + 1.7, H.z1 - 0.01, PI), SIGNS.calendar);
    IB.signFlat.quad(0.5, 0.68, M4(H.x0 + 0.01, y + 1.6, 684.0, PI / 2), SIGNS.poster);
    IB.glass.geo(new THREE.PlaneGeometry(0.36, 0.8), M4(-859.2, y + 1.5, H.z0 + 0.01));
    // the 小太阳 heater glowing by the bed, the AC unit over the door, the ceiling ring lamp
    IB.metal.geo(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24), M4(-860.05, y + 0.34, 685.3, 0, PI / 2), 0x9a9a92);
    IB.glow.geo(new THREE.CircleGeometry(0.15, 24), M4(-860.05, y + 0.34, 685.26, PI), rgb(3.0, 1.2, 0.3));
    IB.metal.box(0.08, 0.3, 0.08, M4(-860.05, y + 0.15, 685.3), 0x9a9a92);
    IB.paint.geo(roundedBox(0.8, 0.26, 0.2, 0.04, 2), M4(-858.6, y + 2.25, H.z0 + 0.12), 0xf2f2ec);
    IB.glow.geo(new THREE.TorusGeometry(0.2, 0.025, 8, 32).rotateX(PI / 2), M4(cx, y + Hc - 0.05, cz), rgb(2.6, 2.5, 2.3));
    IB.paint.build('home-402-room', MAT.paint, { glow: RL });
    IB.floor.build('home-402-floor', MAT.floor, { glow: RL });
    IB.cloth.build('home-402-soft', MAT.cloth, { glow: RL });
    IB.metal.build('home-402-metal', MAT.metal, { glow: RL });
    IB.wood.build('home-402-wood', MAT.paint, { glow: RL });
    IB.signFlat.build('home-402-paper', MAT.signFlat, { glow: RL });
    IB.glass.build('home-402-glass', MAT.glass, { receive: false });
    IB.glow.build('home-402-lights', MAT.glow, { receive: false });
    // the window seen from the lane: lit from inside
    LAMPS.push({ x: WX1 + 0.6, y: (WIN.y0 + WIN.y1) / 2, z: (WIN.z0 + WIN.z1) / 2, c: [1, 0.9, 0.7], k: 0.4, rad: 1.6 });
    C.decks = C.decks || [];
    C.decks.push({ id: 'home-a', room: 'home', type: 'rect', x0: -861.55, x1: -857.85, z0: 682.42, z1: 684.15, y });
    C.decks.push({ id: 'home-b', room: 'home', type: 'rect', x0: -860.05, x1: -858.0, z0: 684.1, z1: 685.2, y });
    C.puxiHome = Object.assign({}, H, { door: [WX1, 680.0], doorY: GY, inside: [-860.45, 682.85], inner: [-860.45, 682.42], bed: [-860.6, 684.1], window: [-857.9, 683.8], kettle: [-857.6, 682.45], eye: y + 1.6 });
  }

  // ================================================================ build the lane
  for (const m of laneLampsLocal) { const p = new THREE.Vector3().setFromMatrixPosition(m); LAMPS.push({ x: p.x, y: p.y, z: p.z, c: [1.0, 0.78, 0.5], k: 0.32, rad: 1.8 }); }
  L.brick.build('yongan-brick', MAT.brick, { glow: LAMPS, cast: true });
  L.stone.build('yongan-stone', MAT.stone, { glow: LAMPS });
  L.roof.build('yongan-roofs', MAT.roof, { glow: LAMPS, cast: true });
  L.plaster.build('yongan-plaster', MAT.plaster, { glow: LAMPS, cast: true });
  L.paint.build('yongan-things', MAT.paint, { glow: LAMPS });
  L.metal.build('yongan-metal', MAT.metal, { glow: LAMPS });
  L.door.build('yongan-doors', MAT.door, { glow: LAMPS });
  L.winS.build('yongan-windows', MAT.winS, { glow: LAMPS });
  L.winL.build('yongan-28-windows', MAT.winL, { glow: LAMPS });
  L.signFlat.build('yongan-plates', MAT.signFlat, { glow: LAMPS });
  L.signCut.build('yongan-fu', MAT.signCut, { glow: LAMPS });
  L.signLit.build('yongan-shop-signs', MAT.signLit);
  L.glow.build('yongan-lamps', MAT.glow, { receive: false });
  L.cobble.build('yongan-cobbles', MAT.cobble, { glow: LAMPS });
  L.cloth.build('yongan-laundry', MAT.cloth, { glow: LAMPS });
  L.conc.build('yongan-concrete', MAT.conc, { glow: LAMPS });
  L.puddle.build('yongan-puddles', MAT.puddle, { glow: LAMPS });
  L.glass.build('yongan-shop-glass', MAT.glass, { receive: false });

  // ================================================================ 老城厢 beyond the map edge (seen from Pudong and the pier)
  {
    const FX = { stone: new G.FacadeGB(), panel: new G.FacadeGB() }, RB = bins(['roof', 'flat', 'ground']);
    const inMap = (x, z) => x > -872 && z < 702 && x < -600;
    const wet = (x, z) => C.pointInWater(x, z) || C.pointInWater(x + 6, z) || C.pointInWater(x, z - 6);
    const box4 = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
    const put = (x0, z0, x1, z1, h, style, roof) => {
      const pts = box4(x0, z0, x1, z1), k = Math.abs(Math.sin(x0 * 12.9 + z0 * 78.2)) % 1;
      const P = style === 'stone' ? [3.4, 3.2] : [3.0, 2.9], floors = Math.max(1, Math.round(h / P[1]));
      let u = RI(0, 20) * 12;
      for (let i = 0; i < 4; i++) {
        const a = pts[i], c = pts[(i + 1) % 4], len = Math.hypot(c[0] - a[0], c[1] - a[1]), bays = Math.max(1, Math.round(len / P[0]));
        FX[style].wall(a, c, GY, GY + h, u, u + bays, 0, floors, style === 'stone' ? rgb(1.0, 0.9 + k * 0.06, 0.8) : rgb(0.86 + k * 0.1, 0.86, 0.84), [k, 0.55 + k * 0.4, 0, 0], [len / bays, h / floors, floors, 0]);
        u += Math.ceil(bays / 12) * 12 + 12;
      }
      if (roof === 'pitch') {
        const w = x1 - x0, d = z1 - z0, rh = Math.min(w, d) * 0.32, along = w > d;
        const s = new THREE.Shape(along ? [new THREE.Vector2(-d / 2 - 0.3, 0), new THREE.Vector2(d / 2 + 0.3, 0), new THREE.Vector2(0, rh)] : [new THREE.Vector2(-w / 2 - 0.3, 0), new THREE.Vector2(w / 2 + 0.3, 0), new THREE.Vector2(0, rh)]);
        const g = new THREE.ExtrudeGeometry(s, { depth: (along ? w : d) + 0.4, bevelEnabled: false });
        g.translate(0, 0, -((along ? w : d) + 0.4) / 2); if (along) g.rotateY(PI / 2);
        RB.roof.geo(g, M4((x0 + x1) / 2, GY + h, (z0 + z1) / 2), rgb(0.8 + k * 0.2, 0.8, 0.8), [2, 2]);
      } else RB.flat.box(x1 - x0 + 0.3, 0.6, z1 - z0 + 0.3, M4((x0 + x1) / 2, GY + h + 0.3, (z0 + z1) / 2), 0x55524c);
    };
    for (let gx = -1000; gx < -640; gx += 19) for (let gz = 546; gz < 830; gz += 16) {
      const w = R(10, 16), d = R(9, 13), x0 = gx + R(0, 3), z0 = gz + R(0, 2), x1 = x0 + w, z1 = z0 + d;
      if (inMap(x1 + 2, z0 - 2) || inMap(x0 + 2, z0 - 2) || wet(x0, z0) || wet(x1, z1) || wet(x1, z0) || wet(x0, z1) || wet(x1 + 8, z0)) continue;
      const far = gx < -930, r = R(0, 1);
      if (far && r < 0.16) put(x0, z0, x0 + 18, z0 + 16, R(48, 92), 'panel', 'flat');
      else if (r < 0.3) put(x0, z0, x1, z1, 17.4, 'panel', 'flat');
      else put(x0, z0, x1, z1, R(6.5, 9.5), 'stone', 'pitch');
    }
    // ground over there, short of the river promenade
    const edge = []; for (let z = 700.4; z <= 830; z += 10) edge.push([bankAt(z) - 9, z]);
    const ring = [[-1010, 540], [-870.3, 540], [-870.3, 700.4], ...edge, [-1010, 830]];
    const s = new THREE.Shape(ring.map((p) => new THREE.Vector2(p[0], -p[1]))); const g = new THREE.ShapeGeometry(s); g.rotateX(-PI / 2); g.translate(0, GY - 0.006, 0);
    RB.ground.geo(g, null, 0x2c2c2e);
    for (const k of Object.keys(FX)) if (FX[k].count) { const m = new THREE.Mesh(FX[k].build(), M.fx[k]); m.name = 'laochengxiang-' + k; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); }
    RB.roof.build('laochengxiang-roofs', MAT.roof);
    RB.flat.build('laochengxiang-roof-slabs', MAT.paint);
    RB.ground.build('laochengxiang-ground', gmat({ roughness: 0.5, envMapIntensity: 1.2 }));
  }

  C.puxi = { lane: { x0: XW, x1: XE, z0: LZ0, z1: LZ1 }, mouth: [XE + 1.2, (LZ0 + LZ1) / 2], pier: PW(0, -3), landing: C.ferryRide.landing };
})();
