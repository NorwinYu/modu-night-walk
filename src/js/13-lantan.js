/* 13-lantan — the west bank of the Shenjiang: the Lantan waterfront's 1920s bank row in its
   real north-to-south order (the names in the code are only handles), the
   raised promenade in front of it and the Shenxi skyline behind. Everything
   follows the OSM west bank, so the river width and the bend are real.
   It is only ever seen from 450 m or more, or through the telescope. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, scene = G.scene, C = G.CITY;
  const { R, RI, pick, clamp, lerp, M4, boxGeo, mergeGeoms, makeCanvas, canvasTexture } = G.util;
  const TAU = Math.PI * 2, BASE_Y = 1.25, QUAY_Y = 3.1, PROM = 18, SET = 62;
  const col = (r, g, b) => new THREE.Color(r, g, b);
  const WHITE = col(1, 1, 1), ROOF = col(0.10, 0.105, 0.115), TRIM = col(0.80, 0.74, 0.62);

  // ---------------------------------------------------------------- bank path (north -> south)
  const bankX = (z) => { for (let x = -1420; x < 0; x += 2) if (C.pointInWater(x, z)) return x; return -1160; };
  const raw = []; for (let z = -640; z <= 720; z += 20) raw.push([bankX(z), z]);
  const path = raw.map((p, i) => [(raw[Math.max(0, i - 1)][0] + 2 * p[0] + raw[Math.min(raw.length - 1, i + 1)][0]) / 4 - 0.6, p[1]]);
  const N = path.length, cum = [0];
  for (let i = 1; i < N; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]));
  const S_MAX = cum[N - 1];
  const KCUT = (() => { const k = path.findIndex((p) => p[1] > 540); return k < 0 ? N - 1 : k - 1; })();
  // point at arc length s: tangent t runs south, n points at the river
  function at(s) {
    s = clamp(s, 0, S_MAX - 0.01);
    let i = 0; while (cum[i + 1] < s) i++;
    const a = path[i], b = path[i + 1], f = (s - cum[i]) / (cum[i + 1] - cum[i]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), tx = (b[0] - a[0]) / len, tz = (b[1] - a[1]) / len;
    return { x: lerp(a[0], b[0], f), z: lerp(a[1], b[1], f), tx, tz, nx: tz, nz: -tx };
  }
  const sOfZ = (z) => { let i = 0; while (i < N - 2 && path[i + 1][1] < z) i++; return cum[i] + (z - path[i][1]) / (path[i + 1][1] - path[i][1]) * (cum[i + 1] - cum[i]); };
  // per-vertex river normals for the ribbons
  const vn = path.map((p, i) => {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(N - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return [(b[1] - a[1]) / l, -(b[0] - a[0]) / l];
  });
  const off = (i, d) => [path[i][0] - vn[i][0] * d, path[i][1] - vn[i][1] * d];

  // ---------------------------------------------------------------- accumulators
  const L = {};
  const put = (k, geometry, matrix, color) => (L[k] || (L[k] = [])).push({ geometry, matrix, color: color || WHITE });
  const FX = { lantan: new G.FacadeGB(), stone: new G.FacadeGB(), panel: new G.FacadeGB(), glass: new G.FacadeGB() };
  // local frame of a plot: +z faces the river, +x runs north along the bank
  function frameAt(ox, oz, ry) {
    const cs = Math.cos(ry), sn = Math.sin(ry);
    const W = (lx, lz) => [ox + cs * lx + sn * lz, oz - sn * lx + cs * lz];
    return { W, ry, m: (lx, y, lz, r = 0, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const w = W(lx, lz); return M4(w[0], y, w[1], ry + r, rx, rz, sx, sy, sz); } };
  }
  const frame = (s, set = SET) => { const p = at(s); return frameAt(p.x - p.nx * set, p.z - p.nz * set, Math.atan2(p.nx, p.nz)); };
  function walls(F, style, x0, z0, x1, z1, y0, y1, o = {}) {
    const floors = Math.max(1, Math.round((y1 - y0) / (o.fh || 4.2))), bay = o.bay || 3.3, v0 = o.v0 || 0;
    const pts = [F.W(x0, z0), F.W(x1, z0), F.W(x1, z1), F.W(x0, z1)];
    const seed = o.seed ?? R(0.05, 0.95);
    let u = RI(0, 20) * 12;
    for (let i = 0; i < 4; i++) {
      const a = pts[i], c = pts[(i + 1) % 4], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const bays = Math.max(1, Math.round(len / bay));
      FX[style].wall(a, c, y0, y1, u, u + bays, v0, v0 + floors, o.tint || WHITE, [seed, o.lit ?? 0.5, o.kind ?? 0, o.led || 0], [len / bays, (y1 - y0) / floors, o.top ?? v0 + floors, o.wash ?? 0]);
      u += Math.ceil(bays / 12) * 12 + 12;
    }
  }
  const prism = (w, h, d) => {
    const sh = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]);
    const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
  };
  const pyramid = (side, h) => { const g = new THREE.ConeGeometry(side / Math.SQRT2, h, 4, 1); g.rotateY(Math.PI / 4); return g; };
  const dome = (r, sy = 1) => { const g = new THREE.SphereGeometry(r, 18, 8, 0, TAU, 0, Math.PI / 2); g.scale(1, sy, 1); return g; };
  // strip between two rows of 3D points, flat-shaded
  function strip(k, A, B, color) {
    const pos = [];
    for (let i = 0; i + 1 < A.length; i++) pos.push(...A[i], ...B[i], ...A[i + 1], ...A[i + 1], ...B[i], ...B[i + 1]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
    g.computeVertexNormals();
    put(k, g, new THREE.Matrix4(), color);
  }

  // ---------------------------------------------------------------- one Lantan house
  const COPPER = col(0.20, 0.42, 0.33), SLATE = col(0.16, 0.17, 0.19), FLAG = col(1.5, 0.10, 0.08);
  const clockFaces = [];
  function flag(F, x, y, z) {
    put('stone', new THREE.CylinderGeometry(0.07, 0.1, 7, 6), F.m(x, y + 3.5, z), TRIM);
    put('glow', new THREE.PlaneGeometry(2.6, 1.6), F.m(x, y + 6.0, z + 1.4, Math.PI / 2), FLAG);
  }
  function colonnade(F, x0, x1, n, y0, h, r, z, trim) {
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? (x0 + x1) / 2 : lerp(x0, x1, i / (n - 1));
      put('stone', new THREE.CylinderGeometry(r * 0.86, r, h, 10), F.m(x, y0 + h / 2, z), trim);
      put('stone', boxGeo(r * 2.6, 0.5, r * 2.6), F.m(x, y0 + h + 0.25, z), trim);
      put('stone', boxGeo(r * 2.5, 0.6, r * 2.5), F.m(x, y0 - 0.3, z), trim);
    }
    put('stone', boxGeo(x1 - x0 + r * 4, 1.5, r * 3.2), F.m((x0 + x1) / 2, y0 + h + 1.25, z), trim);
  }
  function turret(F, x, z, y, side, h, cap, trim, tint) {
    walls(F, 'lantan', x - side / 2, z - side / 2, x + side / 2, z + side / 2, y, y + h, { fh: h / Math.max(1, Math.round(h / 4)), bay: side / 2, tint, wash: 4, lit: 0.35, v0: 9 });
    put('stone', boxGeo(side + 0.9, 0.6, side + 0.9), F.m(x, y + h + 0.3, z), trim);
    if (cap === 'dome') { put('copper', dome(side * 0.5, 1.15), F.m(x, y + h + 0.6, z), COPPER); put('stone', new THREE.CylinderGeometry(0.1, 0.22, 3, 6), F.m(x, y + h + 0.6 + side * 0.57 + 1.4, z), TRIM); }
    else if (cap === 'spire') { put('copper', pyramid(side * 0.92, side * 1.5), F.m(x, y + h + 0.6 + side * 0.75, z), COPPER); }
    else put('roof', pyramid(side * 0.96, side * 0.55), F.m(x, y + h + 0.6 + side * 0.27, z), SLATE);
  }
  function house(s, sp) {
    const F = frame(s), w = sp.w, d = sp.d || 26, h = sp.h, fh = sp.fh || 4.3, top = BASE_Y + h;
    const tint = sp.tint || col(1, 0.95, 0.84), trim = sp.trim || TRIM, hw = w / 2;
    walls(F, 'lantan', -hw, -d, hw, 0, BASE_Y, top, { fh, bay: sp.bay || 3.3, tint, wash: sp.wash ?? 2.2, lit: sp.lit ?? 0.42 });
    // plinth, string course, cornice, parapet, roof
    put('stone', boxGeo(w + 0.5, 1.3, 0.7), F.m(0, BASE_Y + 0.65, 0.2), trim);
    put('stone', boxGeo(w + 0.5, 0.5, 0.7), F.m(0, BASE_Y + fh * 2, 0.2), trim);
    put('stone', boxGeo(w + 1.5, 0.9, d + 1.5), F.m(0, top - 0.1, -d / 2), trim);
    put('stone', boxGeo(w + 0.4, 1.1, 0.5), F.m(0, top + 0.9, -0.05), trim);
    put('stone', boxGeo(0.5, 1.1, d), F.m(-hw, top + 0.9, -d / 2), trim);
    put('stone', boxGeo(0.5, 1.1, d), F.m(hw, top + 0.9, -d / 2), trim);
    put('roof', boxGeo(w - 0.4, 0.4, d - 0.4), F.m(0, top + 0.5, -d / 2), ROOF);
    const ro = sp.roof || 'flat';
    if (ro === 'flat' || ro === 'attic' || ro === 'pediment') {
      if (ro === 'attic') {
        walls(F, 'lantan', -hw + 2.5, -d + 3, hw - 2.5, -2.5, top + 0.4, top + 4.6, { fh: 4.2, tint, wash: 4, lit: 0.3, v0: 9 });
        put('roof', boxGeo(w - 4.4, 0.5, d - 5), F.m(0, top + 4.85, -d / 2 - 0.25), SLATE);
      } else put('roof', boxGeo(w * 0.3, 3, d * 0.3), F.m(w * 0.12, top + 2, -d * 0.6), SLATE);
      if (ro === 'pediment') {
        const n = sp.cols || 4, cw = Math.min(w * 0.62, n * 3.6), ch = fh * (sp.colFloors || 2);
        colonnade(F, -cw / 2, cw / 2, n, BASE_Y + fh, ch, 0.62, 1.1, trim);
        put('stone', prism(cw + 3.4, 3.2, 1.6), F.m(0, top + 0.3, 0.3), trim);
      }
      flag(F, 0, top + (ro === 'attic' ? 4.9 : 1.2), -3);
    } else if (ro === 'cupolas') {
      const ts = sp.ts || 5.2;
      for (const sx of [-1, 1]) turret(F, sx * (hw - ts / 2 - 0.3), -ts / 2 - 0.3, top + 0.3, ts, sp.th || 6.5, sp.cap || 'dome', trim, tint);
      if (sp.cols) colonnade(F, -w * 0.2, w * 0.2, sp.cols, BASE_Y + fh, fh * 2, 0.55, 1.0, trim);
      flag(F, 0, top + 1.2, -3);
    } else if (ro === 'corner') {
      const ts = 6.5, sx = sp.side || 1;
      turret(F, sx * (hw - ts / 2), -ts / 2, top + 0.3, ts, 8, 'spire', trim, tint);
      put('roof', boxGeo(w * 0.3, 3, d * 0.3), F.m(-sx * w * 0.15, top + 2, -d * 0.6), SLATE);
      flag(F, -sx * w * 0.2, top + 1.2, -3);
    } else if (ro === 'deco') {
      // stepped art-deco centre with fins
      walls(F, 'lantan', -w * 0.24, -d * 0.7, w * 0.24, -0.6, top + 0.3, top + 9.3, { fh: 4.5, bay: 2.4, tint, wash: 4.5, lit: 0.3, v0: 9 });
      put('stone', boxGeo(w * 0.48 + 0.8, 0.7, d * 0.7), F.m(0, top + 9.6, -d * 0.35 - 0.3), trim);
      walls(F, 'lantan', -w * 0.13, -d * 0.5, w * 0.13, -1.6, top + 9.9, top + 14.4, { fh: 4.5, bay: 2.4, tint, wash: 6, lit: 0.2, v0: 12 });
      put('stone', boxGeo(w * 0.26 + 0.6, 0.6, d * 0.5 - 1), F.m(0, top + 14.7, -d * 0.25 - 0.8), trim);
      for (let i = -3; i <= 3; i++) put('stone', boxGeo(0.5, 9.6, 0.7), F.m(i * w * 0.07, top + 4.9, -0.3), trim);
      flag(F, 0, top + 15, -4);
    } else if (ro === 'boc') {
      // the hipped-roof bank: a setback tower under a shallow blue-green hipped roof
      walls(F, 'lantan', -10, -d + 4, 10, -1.5, top + 0.3, top + 24.3, { fh: 4, bay: 2.9, tint, wash: 5, lit: 0.38, v0: 11 });
      for (const sx of [-1, 1]) put('stone', boxGeo(1.1, 24, 1.2), F.m(sx * 10, top + 12.3, -1.2), trim);
      put('stone', boxGeo(22.4, 0.8, d - 3.6), F.m(0, top + 24.7, -d / 2 + 1.2), trim);
      put('copper', boxGeo(24.4, 0.35, d - 1.8), F.m(0, top + 25.3, -d / 2 + 1.2), col(0.16, 0.36, 0.40));
      const g = pyramid(22, 6.4); g.scale(1, 1, (d - 4.4) / 22);
      put('copper', g, F.m(0, top + 28.6, -d / 2 + 1.2), col(0.16, 0.36, 0.40));
      flag(F, 0, top + 31.6, -d / 2 + 1.2);
    } else if (ro === 'peace') {
      // Sassoon House: the tower at the river corner under the green copper pyramid
      const tz = -7.5;
      walls(F, 'lantan', -6.8, tz - 6.8, 6.8, tz + 6.8, top + 0.3, top + 17.3, { fh: 4.2, bay: 2.7, tint, wash: 5, lit: 0.45, v0: 10 });
      put('stone', boxGeo(14.8, 0.9, 14.8), F.m(0, top + 17.7, tz), trim);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put('stone', boxGeo(1.4, 3.2, 1.4), F.m(sx * 6.3, top + 19.6, tz + sz * 6.3), trim);
      put('copper', pyramid(12.4, 19), F.m(0, top + 27.6, tz), col(0.17, 0.46, 0.33));
      put('stone', new THREE.CylinderGeometry(0.08, 0.2, 5, 6), F.m(0, top + 39.5, tz), TRIM);
      put('glow', new THREE.SphereGeometry(0.5, 8, 6), F.m(0, top + 37.4, tz), col(2.4, 3.6, 2.6));
      put('roof', boxGeo(w * 0.34, 3.4, d * 0.3), F.m(-w * 0.2, top + 2.1, -d * 0.7), SLATE);
    } else if (ro === 'clock') {
      // Custom House: Doric portico, square clock tower, stepped crown
      colonnade(F, -7.5, 7.5, 4, BASE_Y + 1.3, fh * 3 - 1.3, 1.05, 1.5, trim);
      const tw = 10.4, tz = -6.4, t0 = top + 0.3, t1 = t0 + 25.5;
      walls(F, 'lantan', -tw / 2, tz - tw / 2, tw / 2, tz + tw / 2, t0, t1, { fh: 4.25, bay: 2.6, tint, wash: 5.5, lit: 0.22, v0: 9 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) put('stone', boxGeo(1.5, 25.5, 1.5), F.m(sx * tw / 2, (t0 + t1) / 2, tz + sz * tw / 2), trim);
      put('stone', boxGeo(tw + 2.2, 0.9, tw + 2.2), F.m(0, t1 + 0.45, tz), trim);
      put('stone', boxGeo(tw + 0.6, 8.6, tw + 0.6), F.m(0, t1 + 5.2, tz), trim);
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2, dx = Math.sin(a) * (tw / 2 + 0.36), dz = Math.cos(a) * (tw / 2 + 0.36);
        clockFaces.push({ geometry: new THREE.CircleGeometry(3.5, 28), matrix: F.m(dx, t1 + 5.2, tz + dz, a) });
      }
      put('stone', boxGeo(tw + 1.8, 0.8, tw + 1.8), F.m(0, t1 + 9.9, tz), trim);
      put('stone', boxGeo(tw - 2.4, 4.2, tw - 2.4), F.m(0, t1 + 12.4, tz), trim);
      put('stone', boxGeo(tw - 5.2, 3.4, tw - 5.2), F.m(0, t1 + 16.2, tz), trim);
      put('roof', pyramid(tw - 5.6, 3), F.m(0, t1 + 19.4, tz), SLATE);
      put('stone', new THREE.CylinderGeometry(0.09, 0.2, 9, 6), F.m(0, t1 + 25, tz), TRIM);
      put('glow', new THREE.PlaneGeometry(2.8, 1.7), F.m(0, t1 + 28, tz + 1.5, Math.PI / 2), FLAG);
    } else if (ro === 'dome') {
      // the domed bank: raised centre, giant order of six columns, octagonal drum and dome
      const cw = 15, c1 = top + 7.4;
      walls(F, 'lantan', -cw, -d, cw, 0.9, top - 0.4, c1, { fh: 3.9, bay: 3.3, tint, wash: 5, lit: 0.3, v0: 7 });
      put('stone', boxGeo(cw * 2 + 1.6, 1.0, d + 2.6), F.m(0, c1 + 0.5, -d / 2 + 0.45), trim);
      colonnade(F, -10, 10, 6, BASE_Y + fh, fh * 3, 0.95, 2.1, trim);
      for (const sx of [-1, 1]) colonnade(F, sx * 30 - 4, sx * 30 + 4, 3, BASE_Y + fh, fh * 2, 0.6, 1.0, trim);
      const dz = -9.5, y0 = c1 + 1.0;
      put('stone', new THREE.CylinderGeometry(9.6, 10.2, 6.4, 8), F.m(0, y0 + 3.2, dz, Math.PI / 8), trim);
      for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; put('stone', new THREE.CylinderGeometry(0.5, 0.56, 5.4, 8), F.m(Math.sin(a) * 10.1, y0 + 3.1, dz + Math.cos(a) * 10.1), trim); }
      put('stone', new THREE.CylinderGeometry(10.9, 10.9, 0.8, 16), F.m(0, y0 + 6.8, dz), trim);
      put('stone', dome(9.4, 0.92), F.m(0, y0 + 7.2, dz), col(0.74, 0.72, 0.66));
      put('stone', new THREE.CylinderGeometry(1.5, 1.8, 3.2, 10), F.m(0, y0 + 17.2, dz), trim);
      put('stone', dome(1.7, 1.1), F.m(0, y0 + 18.8, dz), col(0.74, 0.72, 0.66));
      put('stone', new THREE.CylinderGeometry(0.08, 0.16, 5, 6), F.m(0, y0 + 23, dz), TRIM);
      for (const sx of [-1, 1]) { put('roof', boxGeo(10, 3, 8), F.m(sx * 26, top + 2, -d * 0.62), SLATE); flag(F, sx * 26, top + 1.2, -3); }
    }
    return F;
  }

  // ---------------------------------------------------------------- the row
  const cream = col(1.0, 0.95, 0.84), grey = col(0.84, 0.85, 0.84), buff = col(1.0, 0.86, 0.68), brick = col(1.0, 0.52, 0.40), pale = col(0.96, 0.95, 0.92);
  const ROW = [
    { gap: 34 },
    { w: 24, h: 22, roof: 'pediment', tint: cream, fh: 4.6 },
    { w: 28, h: 31, roof: 'corner', tint: grey, side: 1 },
    { w: 40, h: 27, roof: 'pediment', tint: buff, fh: 4.5, cols: 6 },
    { w: 20, h: 30, roof: 'attic', tint: cream },
    { w: 30, h: 28, roof: 'pediment', tint: grey, fh: 4.6 },
    { w: 34, h: 44, roof: 'boc', tint: col(0.90, 0.88, 0.82), fh: 4, bay: 2.9, d: 30 },
    { w: 38, h: 40, roof: 'peace', tint: col(0.84, 0.80, 0.72), fh: 4, bay: 2.8, d: 30 },
    { gap: 22, neon: true },
    { w: 30, h: 27, roof: 'cupolas', tint: brick, fh: 4.4, cap: 'hip', ts: 6, th: 4.5 },
    { w: 28, h: 27, roof: 'pediment', tint: cream, fh: 4.5 },
    { w: 24, h: 40, roof: 'cupolas', tint: grey, fh: 4.2 },
    { w: 22, h: 22, roof: 'pediment', tint: buff, fh: 5.2, colFloors: 2 },
    { w: 26, h: 22, roof: 'flat', tint: cream, fh: 5.2 },
    { w: 30, h: 32, roof: 'deco', tint: col(0.92, 0.90, 0.86), fh: 4.2 },
    { w: 44, h: 34, roof: 'clock', tint: col(0.90, 0.88, 0.84), fh: 4.25, d: 30, id: 'customs' },
    { w: 80, h: 28, roof: 'dome', tint: col(1.0, 0.97, 0.90), fh: 4.7, d: 32 },
    { gap: 16 },
    { w: 22, h: 18, roof: 'flat', tint: brick, fh: 4.5 },
    { w: 26, h: 25, roof: 'cupolas', tint: pale, fh: 4.4, cols: 4 },
    { w: 20, h: 20, roof: 'attic', tint: buff },
    { w: 26, h: 30, roof: 'flat', tint: grey, fh: 4.2 },
    { w: 30, h: 33, roof: 'corner', tint: col(0.86, 0.86, 0.84), side: -1 },
    { w: 34, h: 28, roof: 'cupolas', tint: cream, fh: 4.6, cap: 'hip', ts: 6.4, th: 7, cols: 6 },
    { w: 36, h: 36, roof: 'attic', tint: buff, fh: 4.3 },
  ];
  const ALLEY = 3;
  let acc = 0, anchor = 0;
  for (const b of ROW) { const w = b.gap || b.w; b.c = acc + w / 2; if (b.id === 'customs') anchor = b.c; acc += w + (b.gap ? 0 : ALLEY); }
  // the Custom House stands at the foot of 瀚口路, z = -125 on this map (OSM)
  const S0 = sOfZ(-125) - anchor, S1 = S0 + acc;
  for (const b of ROW) {
    const s = S0 + b.c;
    if (b.gap) {
      if (b.neon) {
        // a glimpse down the shopping street: signs receding between the two hotels
        const F = frame(s);
        for (let i = 0; i < 12; i++) put('glow', boxGeo(0.4, R(3, 8), R(3, 7)), F.m(i % 2 ? -8.6 : 8.6, 8 + R(0, 9), -12 - i * 14), pick([col(3, 0.5, 0.4), col(3, 1.9, 0.6), col(0.5, 2.0, 3), col(3, 0.7, 1.8), col(2.6, 2.6, 2.2)]));
      }
      continue;
    }
    house(s, b);
  }
  // the signal tower at the south end of the promenade
  {
    const F = frame(S1 + 16, 9);
    put('stone', new THREE.CylinderGeometry(3.0, 3.8, 5, 14), F.m(0, QUAY_Y + 2.5, 0), TRIM);
    put('stone', new THREE.CylinderGeometry(1.9, 2.3, 26, 14), F.m(0, QUAY_Y + 18, 0), col(0.86, 0.80, 0.70));
    put('stone', new THREE.CylinderGeometry(2.9, 2.2, 1.4, 14), F.m(0, QUAY_Y + 31.6, 0), TRIM);
    put('copper', new THREE.ConeGeometry(2.4, 3.4, 14), F.m(0, QUAY_Y + 34, 0), COPPER);
    put('stone', new THREE.CylinderGeometry(0.1, 0.16, 9, 6), F.m(0, QUAY_Y + 40, 0), TRIM);
  }

  // ---------------------------------------------------------------- the promenade on the flood wall
  {
    // south of z 540 the bank is the walkable 十八埠 waterfront (13c-puxi): the flood
    // wall stops there and the far ground only starts west of the map edge
    const A = [], B = [], T0 = [], T1 = [], Gd0 = [], Gd1 = [];
    for (let i = 0; i < N; i++) {
      const p0 = off(i, 0), p1 = off(i, PROM);
      if (i <= KCUT) {
        A.push([p0[0], -0.8, p0[1]]); B.push([p0[0], QUAY_Y, p0[1]]);
        T0.push([p0[0], QUAY_Y, p0[1]]); T1.push([p1[0], QUAY_Y, p1[1]]);
      }
      Gd0.push([i <= KCUT ? p1[0] + 1 : -1010, BASE_Y, p1[1]]); Gd1.push([-2500, BASE_Y, p1[1]]);
    }
    strip('matte', B, A, col(0.30, 0.29, 0.27));
    strip('matte', T1, T0, col(0.22, 0.21, 0.20));
    strip('matte', Gd1, Gd0, col(0.030, 0.032, 0.038));
    // 江滨东一路 between the flood wall and the row: ten lanes of dark asphalt
    {
      const R0 = [], R1 = [];
      for (let i = 0; i <= KCUT; i++) { const a = off(i, PROM + 6), b = off(i, SET - 7); R0.push([a[0], BASE_Y + 0.03, a[1]]); R1.push([b[0], BASE_Y + 0.03, b[1]]); }
      strip('matte', R1, R0, col(0.055, 0.058, 0.064));
      for (const d of [PROM + 6.4, SET - 7.4]) { const A = [], B = []; for (let i = 0; i <= KCUT; i++) { const a = off(i, d), b = off(i, d + 0.25); A.push([a[0], BASE_Y + 0.05, a[1]]); B.push([b[0], BASE_Y + 0.05, b[1]]); } strip('matte', B, A, col(0.5, 0.48, 0.44)); }
    }    const sA = Math.max(20, S0 - 120), sB = Math.min(S_MAX - 20, S1 + 120);
    // parapet and rail
    for (let s = sA; s < sB; s += 12) {
      const F = frame(s + 6, 0.5);
      put('stone', boxGeo(12.1, 0.9, 0.5), F.m(0, QUAY_Y + 0.45, 0), col(0.62, 0.58, 0.50));
      put('matte', boxGeo(12.1, 0.08, 0.1), F.m(0, QUAY_Y + 1.2, 0), col(0.12, 0.12, 0.13));
    }
    // the cast-iron lamps, the planes along the road, the road lights
    for (let s = sA; s < sB; s += 15) {
      const F = frame(s, 2.2);
      put('matte', new THREE.CylinderGeometry(0.09, 0.16, 4.6, 6), F.m(0, QUAY_Y + 2.3, 0), col(0.07, 0.08, 0.08));
      put('matte', boxGeo(1.5, 0.1, 0.1), F.m(0, QUAY_Y + 4.3, 0), col(0.07, 0.08, 0.08));
      for (const sx of [-0.7, 0, 0.7]) put('glow', new THREE.SphereGeometry(sx ? 0.26 : 0.32, 8, 6), F.m(sx, QUAY_Y + (sx ? 4.55 : 4.9), 0), col(5.5, 3.4, 1.5));
    }
    for (let s = sA + 6; s < sB; s += 13) {
      const F = frame(s + R(-2, 2), PROM - 2.4), hgt = R(5.5, 7.5);
      put('matte', new THREE.CylinderGeometry(0.16, 0.28, hgt, 6), F.m(0, QUAY_Y + hgt / 2, 0), col(0.20, 0.17, 0.13));
      for (let k = 0; k < 3; k++) {
        const g = new THREE.IcosahedronGeometry(R(2.0, 2.9), 1);
        put('matte', g, F.m(R(-1.4, 1.4), QUAY_Y + hgt + R(-0.6, 1.4), R(-1.2, 1.2), 0, 0, 0, 1, 0.8, 1), col(0.07 + R(0, 0.03), 0.13 + R(0, 0.05), 0.06));
      }
    }
    for (let s = sA; s < sB; s += 22) {
      const F = frame(s, PROM + 9);
      put('matte', new THREE.CylinderGeometry(0.1, 0.14, 9, 5), F.m(0, BASE_Y + 4.5, 0), col(0.07, 0.08, 0.08));
      put('glow', new THREE.SphereGeometry(0.34, 8, 6), F.m(0, BASE_Y + 9.1, 0.8), col(4.2, 2.9, 1.5));
    }
    // evening crowd along the rail
    const crowd = [];
    for (let i = 0; i < 46; i++) {
      const s = lerp(S0 + 40, S1 - 30, (i + R(0, 0.9)) / 46), p = at(s), ry = Math.atan2(p.nx, p.nz);
      const atRail = i % 3 !== 0, d = atRail ? R(1.3, 1.7) : R(3.5, PROM - 4);
      const pose = atRail ? pick(['lean', 'photo', 'photo', 'phone', 'stand', 'point']) : pick(['stride', 'stride', 'talk', 'stand']);
      crowd.push({ look: pose === 'photo' ? { hold: 'phone' } : {}, pose, x: p.x - p.nx * d, y: QUAY_Y, z: p.z - p.nz * d, ry: atRail ? ry + R(-0.3, 0.3) : ry + (i % 2 ? 1 : -1) * Math.PI / 2 + R(-0.3, 0.3) });
    }
    scene.add(G.people.crowd(crowd, 'lantan-promenade-people', 0));
  }

  // ---------------------------------------------------------------- Shenxi behind the row: OSM footprints
  const beacons = [];
  const hash = (x, z) => { const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453; return s - Math.floor(s); };
  const ringArea2 = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; } return a; };
  const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  const shrink = (pts, k) => { const c = centroid(pts); return pts.map((p) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]); };
  function footprint(pts, y0, y1, style, o = {}) {
    // the facade builder wants the ring in positive (x, z) shoelace order
    const ring = ringArea2(pts) > 0 ? pts : pts.slice().reverse();
    const P = style === 'glass' ? [1.7, 4.0] : style === 'panel' ? [3.0, 3.8] : [3.3, 3.4];
    const floors = Math.max(1, Math.round((y1 - y0) / P[1])), seed = o.seed ?? R(0.05, 0.95), v0 = o.v0 || 0;
    let u = RI(0, 20) * 12;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 0.8) continue;
      const bays = Math.max(1, Math.round(len / P[0]));
      FX[style].wall(a, c, y0, y1, u, u + bays, v0, v0 + floors, o.tint || WHITE, [seed, o.lit ?? 0.8, 0, o.led || 0], [len / bays, (y1 - y0) / floors, v0 + floors, o.wash || 0]);
      u += Math.ceil(bays / 12) * 12 + 12;
    }
    if (o.roof !== false) {
      const g = new THREE.ShapeGeometry(new THREE.Shape(ring.map((p) => new THREE.Vector2(p[0], -p[1]))));
      g.rotateX(-Math.PI / 2);
      put('roof', g, M4(0, y1 + 0.05, 0), ROOF);
    }
  }
  // the hand-made row owns the first line of blocks along 江滨东一路
  const rowBand = (x, z) => { if (z < -680 || z > 260) return false; const b = at(sOfZ(z)); return Math.hypot(x - b.x, z - b.z) < SET + 72; };
  const longEdge = (pts) => { let best = 0, ry = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], c = pts[(i + 1) % pts.length], l = Math.hypot(c[0] - a[0], c[1] - a[1]); if (l > best) { best = l; ry = Math.atan2(c[0] - a[0], c[1] - a[1]); } } return ry; };
  const CROWN = {
    // 莲冠中心 (199 m): a lit steel lotus on a square shaft
    '莲冠中心': (pts, h) => {
      const top = BASE_Y + h - 34, c = centroid(pts), F = frameAt(c[0], c[1], longEdge(pts));
      footprint(pts, BASE_Y, top, 'glass', { tint: col(1.0, 0.93, 0.82), lit: 0.95, led: 0.2 });
      footprint(shrink(pts, 0.62), top, top + 9, 'glass', { tint: col(1.0, 0.92, 0.8), lit: 1.1, v0: 40 });
      put('crown', new THREE.CylinderGeometry(7, 10, 4, 16), F.m(0, top + 11, 0), col(1.0, 0.86, 0.6));
      for (const [n, r, len, tilt, y] of [[12, 13.5, 17, 0.62, 16], [8, 7.5, 21, 0.3, 18]]) {
        for (let k = 0; k < n; k++) {
          const a = (k + (n === 8 ? 0.5 : 0)) / n * TAU, g = new THREE.SphereGeometry(1, 12, 10); g.scale(n === 8 ? 3.4 : 3.0, len / 2, 0.45);
          put('crown', g, F.m(Math.sin(a) * r, top + y, Math.cos(a) * r, a, -tilt), col(1.0, 0.84, 0.56));
        }
      }
      put('crown', new THREE.ConeGeometry(1.2, 8, 8), F.m(0, top + 30, 0), col(1.0, 0.9, 0.7));
      beacons.push({ geometry: new THREE.SphereGeometry(0.9, 8, 6), matrix: F.m(0, top + 34.5, 0) });
    },
    // 银杏中心 / 银杏广场 (320 m): the tallest tower in Shenxi, a glass crown that steps in twice
    '银杏中心 (写字楼)': (pts, h) => {
      const top = BASE_Y + h - 40, c = centroid(pts);
      footprint(pts, BASE_Y, top, 'glass', { tint: col(0.86, 0.92, 1.0), lit: 0.8, led: 0.4 });
      footprint(shrink(pts, 0.82), top, top + 14, 'glass', { tint: col(0.9, 0.96, 1.0), lit: 1.2, led: 0.8, v0: 60 });
      footprint(shrink(pts, 0.6), top + 14, top + 26, 'glass', { tint: col(0.9, 0.96, 1.0), lit: 1.3, led: 0.8, v0: 64 });
      const F = frameAt(c[0], c[1], longEdge(pts) + Math.PI / 4);
      put('crown', pyramid(Math.sqrt(Math.abs(ringArea2(pts)) / 2) * 0.55, 12), F.m(0, top + 32, 0), col(0.7, 0.85, 1.0));
      beacons.push({ geometry: new THREE.SphereGeometry(1, 8, 6), matrix: F.m(0, top + 40, 0) });
    },
    // 茂澜广场 (333 m): the crown carries two masts
    '茂澜广场': (pts, h) => {
      const top = BASE_Y + 246, c = centroid(pts), F = frameAt(c[0], c[1], longEdge(pts));
      footprint(pts, BASE_Y, top, 'glass', { tint: col(0.88, 0.9, 0.95), lit: 0.8, led: 0.6 });
      footprint(shrink(pts, 0.72), top, top + 18, 'glass', { tint: col(0.9, 0.92, 0.96), lit: 1.0, led: 0.6, v0: 62 });
      for (const sx of [-1, 1]) {
        put('crown', new THREE.CylinderGeometry(0.6, 1.6, h - 264, 8), F.m(sx * 9, BASE_Y + (h + 264) / 2, 0), col(0.8, 0.82, 0.86));
        beacons.push({ geometry: new THREE.SphereGeometry(0.9, 8, 6), matrix: F.m(sx * 9, BASE_Y + h + 1, 0) });
      }
    },
    // 晨星广场 (285 m): the top half turns 45 degrees and ends in a four-legged spire
    '晨星广场': (pts, h) => {
      const top = BASE_Y + 232, c = centroid(pts), side = Math.sqrt(Math.abs(ringArea2(pts)) / 2) * 0.7;
      footprint(pts, BASE_Y, top, 'glass', { tint: col(0.95, 0.92, 0.88), lit: 0.75, led: 0.4 });
      const F = frameAt(c[0], c[1], longEdge(pts) + Math.PI / 4);
      put('crown', pyramid(side, 34), F.m(0, top + 17, 0), col(0.6, 0.66, 0.74));
      put('crown', new THREE.CylinderGeometry(0.4, 1.2, h - 266, 8), F.m(0, BASE_Y + (h + 266) / 2, 0), col(0.8, 0.82, 0.86));
      beacons.push({ geometry: new THREE.SphereGeometry(0.9, 8, 6), matrix: F.m(0, BASE_Y + h + 1, 0) });
    },
  };
  for (const row of window.__SHENXI || []) {
    const h = row[0], name = row[1], pts = [];
    for (let i = 2; i + 1 < row.length; i += 2) pts.push([row[i], row[i + 1]]);
    const c = centroid(pts);
    if (rowBand(c[0], c[1]) || C.pointInWater(c[0], c[1])) continue;
    if (CROWN[name]) { CROWN[name](pts, h); continue; }
    const k = hash(c[0], c[1]), nearLantan = c[0] > -1800 && c[1] > -700 && c[1] < 500;
    const style = h >= 70 ? (k < 0.65 ? 'glass' : 'panel') : h >= 30 ? (k < 0.3 ? 'stone' : k < 0.75 ? 'panel' : 'glass') : (k < 0.6 ? 'stone' : 'panel');
    const tint = style === 'stone' ? col(1.0, 0.93 + k * 0.05, 0.82 + k * 0.08) : col(0.8 + k * 0.2, 0.84 + k * 0.14, 0.88 + k * 0.1);
    footprint(pts, BASE_Y, BASE_Y + h, style, { tint, lit: 0.55 + hash(c[1], c[0]) * 0.55, led: style !== 'stone' && h > 60 && k > 0.55 ? pick([0.2, 0.4, 0.6, 0.8]) : 0, wash: style === 'stone' && nearLantan ? 0.8 : 0 });
    if (h > 110) beacons.push({ geometry: new THREE.SphereGeometry(0.8, 8, 6), matrix: M4(c[0], BASE_Y + h + 1.5, c[1]) });
  }
  // ---------------------------------------------------------------- flush
  const std = (o) => { const m = new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o)); m.userData.surfaceProcedural = true; return m; };
  const MAT = {
    stone: std({ roughness: 0.82, emissive: 0xffb066, emissiveIntensity: 0.30 }),
    copper: std({ roughness: 0.55, metalness: 0.3, emissive: 0x4f9a76, emissiveIntensity: 0.20 }),
    crown: std({ roughness: 0.5, metalness: 0.3, emissive: 0xffc27a, emissiveIntensity: 0.55 }),
    roof: std({ roughness: 0.9 }),
    matte: std({ roughness: 0.9 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  };
  const NAME = { stone: 'lantan-stonework', copper: 'lantan-copper-roofs', crown: 'shenxi-tower-crowns', roof: 'lantan-roofs', matte: 'lantan-promenade', glow: 'lantan-lights' };
  const tag = (m, name) => { m.name = name; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); return m; };
  for (const k of Object.keys(L)) tag(new THREE.Mesh(mergeGeoms(L[k], { vertexColors: true }), MAT[k]), NAME[k]);
  for (const k of Object.keys(FX)) if (FX[k].count) tag(new THREE.Mesh(FX[k].build(), M.fx[k]), 'lantan-facades-' + k);
  tag(new THREE.Mesh(mergeGeoms(beacons), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.2, 0.15) })), 'shenxi-aviation-beacons');
  // the clock: one lit dial texture on all four faces
  {
    const c = makeCanvas(256, 256), x = c.getContext('2d');
    x.fillStyle = '#f6ecd0'; x.beginPath(); x.arc(128, 128, 126, 0, TAU); x.fill();
    x.strokeStyle = '#2a2620'; x.lineWidth = 7; x.beginPath(); x.arc(128, 128, 116, 0, TAU); x.stroke();
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU, r0 = i % 3 === 0 ? 78 : 90;
      x.lineWidth = i % 3 === 0 ? 9 : 4; x.beginPath(); x.moveTo(128 + Math.sin(a) * r0, 128 - Math.cos(a) * r0); x.lineTo(128 + Math.sin(a) * 106, 128 - Math.cos(a) * 106); x.stroke();
    }
    const hand = (a, len, w) => { x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(128, 128); x.lineTo(128 + Math.sin(a) * len, 128 - Math.cos(a) * len); x.stroke(); };
    hand((9 + 42 / 60) / 12 * TAU, 56, 11); hand(42 / 60 * TAU, 88, 7);
    const t = canvasTexture(c, true, 1, 1, 4);
    tag(new THREE.Mesh(mergeGeoms(clockFaces), new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.5, 1.3, 1.0) })), 'lantan-clock-faces');
  }

  C.lantanRow = { x: at(sOfZ(-125)).x, z: -125, s0: S0, s1: S1 };
})();
