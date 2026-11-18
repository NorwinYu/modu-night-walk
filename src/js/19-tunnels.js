/* 19-tunnels — the portals of the 新晟路 and 安民路 river-crossing road tunnels.
   The OSM tunnel ways stop where the covered box starts, so each portal sits
   at the end (inbound) or the start (outbound) of its way. Behind the portal
   the open ramp climbs back to grade over the last stretch of the way; the
   ground layers there are cut away and the trench is built in their place.
   Ahead of the portal the bore runs on under the bank. The crossing itself is
   off the map: the game hands a car from the inbound bore to the outbound one. */
(function () {
  const G = window.__G, THREE = G.THREE, scene = G.scene, C = G.CITY, M = G.M, TEX = G.TEX;
  const { clamp, makeCanvas, canvasTexture, mergeGeoms, boxGeo, M4 } = G.util;

  const D = 5.8;      // floor depth at the portal
  const H = 4.8;      // clear height of the bore (soffit at -1.0, a 1 m roof slab above)
  const WI = 4.5;     // wall inner face from the centre line
  const WT = 0.6;     // retaining wall thickness
  const W = WI + WT;
  const KB = 0.45;    // safety kerb width
  const PAR = 0.95;   // parapet height above grade
  const BORE = 80;    // modelled bore length
  const STEP = 2;

  const SPEC = [
    { id: 'xs-in', name: '新晟路隧道', at: [267, -505], end: 1, kind: 'in', pair: 'xs-out', en: 'XINSHENG RD TUNNEL', to: '申西 · 新晟路' },
    { id: 'xs-out', name: '新晟路隧道', at: [186, -506], end: 0, kind: 'out', pair: 'xs-in', en: 'XINSHENG RD TUNNEL' },
    { id: 'am-in', name: '安民路隧道', at: [373, 465], end: 1, kind: 'in', pair: 'am-out', en: 'ANMIN RD TUNNEL', to: '申西 · 澜滩' },
    { id: 'am-out', name: '安民路隧道', at: [376, 475], end: 0, kind: 'out', pair: 'am-in', en: 'ANMIN RD TUNNEL' },
  ];

  // ---------------------------------------------------------------- centre lines
  const hAt = (R, s) => { if (s >= R.L) return 0; if (s <= 0) return -D; const u = 1 - s / R.L; return -D * u * u * (3 - 2 * u); };
  const slopeAt = (R, s) => { if (s >= R.L || s <= 0) return 0; const u = 1 - s / R.L; return D * 6 * u * (1 - u) / R.L; };
  function makeRamp(sp) {
    const road = C.roads.find((q) => q.name === sp.name && Math.hypot((sp.end ? q.samp[q.samp.length - 1] : q.samp[0])[0] - sp.at[0], (sp.end ? q.samp[q.samp.length - 1] : q.samp[0])[1] - sp.at[1]) < 4);
    if (!road) return null;
    const src = sp.end ? road.samp.slice().reverse() : road.samp.slice();
    const cum = [0];
    for (let i = 1; i < src.length; i++) cum.push(cum[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
    const len = cum[cum.length - 1];
    const L = Math.min(118, len - 10);
    const ul = Math.hypot(src[1][0] - src[0][0], src[1][1] - src[0][1]);
    const ux = (src[1][0] - src[0][0]) / ul, uz = (src[1][1] - src[0][1]) / ul;
    const at = (s) => {
      if (s <= 0) return [src[0][0] + ux * s, src[0][1] + uz * s];
      let i = 0; while (i < cum.length - 2 && cum[i + 1] < s) i++;
      const f = (s - cum[i]) / ((cum[i + 1] - cum[i]) || 1);
      return [src[i][0] + (src[i + 1][0] - src[i][0]) * f, src[i][1] + (src[i + 1][1] - src[i][1]) * f];
    };
    const pts = [];
    for (let s = -BORE; s < L - 0.01; s += STEP) pts.push({ s });
    pts.push({ s: L });
    for (const p of pts) { const q = at(p.s); p.x = q[0]; p.z = q[1]; }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const l = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const p = pts[i]; p.tx = (b.x - a.x) / l; p.tz = (b.z - a.z) / l; p.nx = p.tz; p.nz = -p.tx;
    }
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const R = Object.assign({}, sp, { road, L, len, pts, bb: [x0 - 12, z0 - 12, x1 + 12, z1 + 12] });
    road.ramp = R;
    return R;
  }
  const RAMPS = SPEC.map(makeRamp).filter(Boolean);
  const byId = {}; for (const R of RAMPS) byId[R.id] = R;

  // frame at arc position s (pts are evenly spaced except the last)
  function frameAt(R, s) {
    const P = R.pts;
    let i = clamp(Math.floor((s + BORE) / STEP), 0, P.length - 2);
    while (i < P.length - 2 && P[i + 1].s < s) i++;
    const a = P[i], b = P[i + 1], f = clamp((s - a.s) / ((b.s - a.s) || 1), i === 0 ? -1e9 : 0, i === P.length - 2 ? 1e9 : 1);
    const tx = a.tx + (b.tx - a.tx) * f, tz = a.tz + (b.tz - a.tz) * f, l = Math.hypot(tx, tz) || 1;
    return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, tx: tx / l, tz: tz / l, nx: tz / l, nz: -tx / l };
  }
  function project(R, x, z) {
    const bb = R.bb;
    if (x < bb[0] || x > bb[2] || z < bb[1] || z > bb[3]) return null;
    const P = R.pts;
    let best = 1e18, bs = 0, bl = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
      // the end segments extend past the mouth so a mover leaving it is seen leaving
      const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, i === 0 ? -1e9 : 0, i === P.length - 2 ? 1e9 : 1);
      const px = a.x + dx * t, pz = a.z + dz * t, d2 = (x - px) ** 2 + (z - pz) ** 2;
      if (d2 < best) { best = d2; bs = a.s + (b.s - a.s) * t; bl = ((x - a.x) * dz - (z - a.z) * dx) / Math.sqrt(l2); }
    }
    return { s: bs, lat: bl };
  }
  // open trench floor under (x, z), or null
  C.trenchFloor = (x, z) => {
    for (const R of RAMPS) {
      const p = project(R, x, z);
      if (p && p.s >= 0 && p.s <= R.L && Math.abs(p.lat) < WI) return hAt(R, p.s) + 0.04;
    }
    return null;
  };
  // is (x, z) on the trench or its walls, cushions and headwall (plus a margin)?
  C.inTrench = (x, z, m = 0, except) => {
    for (const R of RAMPS) {
      if (R.road === except) continue;
      const p = project(R, x, z);
      if (!p || p.s < -1.2 - m || p.s > R.L + 2.6 + m || Math.abs(p.lat) > W + 0.9 + m) continue;
      // the carriageway through the mouth is open road
      if (p.s > R.L - 0.5 && Math.abs(p.lat) < WI - m) continue;
      return R;
    }
    return null;
  };
  // A mover in the trench or the bore: held between the walls, given the floor
  // height and slope. o.tun is the ramp it is in; it is entered only through
  // the mouth (the parapets keep everything else out) and left the same way.
  C.tunnelMove = (o, x, z, rad, sMin = -BORE + 3) => {
    let R = o.tun || null;
    if (!R) for (const q of RAMPS) { const p = project(q, x, z); if (p && p.s > 0 && p.s < q.L && Math.abs(p.lat) < W) { R = q; break; } }
    if (!R) { o.tunY = 0; o.tunSlope = 0; return null; }
    const p = project(R, x, z);
    // held until clear of the crash cushions: their colliders are boxes, and on a
    // diagonal ramp a box reaches further into the carriageway than the cushion does
    if (!p || p.s > R.L + 4.5 || Math.abs(p.lat) > W + 2) { o.tun = null; o.tunY = 0; o.tunSlope = 0; return null; }
    const s = Math.max(p.s, sMin), lim = WI - KB * 0.5 - rad, lat = clamp(p.lat, -lim, lim);
    const f = frameAt(R, s);
    o.tun = R; o.tunS = s; o.tunLat = lat; o.tunY = hAt(R, s); o.tunSlope = slopeAt(R, s); o.tunT = [f.tx, f.tz];
    return { x: f.x + f.nx * lat, z: f.z + f.nz * lat, hit: s !== p.s || lat !== p.lat, s };
  };
  C.tunnelPlace = (R, s, lat) => { const f = frameAt(R, s); return { x: f.x + f.nx * lat, z: f.z + f.nz * lat, yaw: Math.atan2(f.tx, f.tz), y: hAt(R, s) }; };
  // height and slope of a vehicle at distance d along a road (0 off the ramps)
  C.rampY = (road, d) => {
    const R = road.ramp; if (!R) return 0;
    return hAt(R, R.end ? R.len - d : d);
  };
  C.rampGrade = (road, d, dir) => {
    const R = road.ramp; if (!R) return 0;
    const s = R.end ? R.len - d : d, ds = (R.end ? -1 : 1) * dir;
    return slopeAt(R, s) * ds;           // rise per metre travelled
  };
  C.tunnels = { ramps: RAMPS, byId, hAt: (R, s) => hAt(R, s), project, D, H, WI, W, BORE };

  // ---------------------------------------------------------------- cut the ground layers
  {
    const quads = [];
    for (const R of RAMPS) {
      const P = R.pts.filter((p) => p.s >= -0.001);
      const Wc = W + 0.02;
      for (let i = 0; i < P.length - 1; i++) {
        const a = P[i], b = P[i + 1];
        const c = [[a.x + a.nx * Wc, a.z + a.nz * Wc], [b.x + b.nx * Wc, b.z + b.nz * Wc], [b.x - b.nx * Wc, b.z - b.nz * Wc], [a.x - a.nx * Wc, a.z - a.nz * Wc]];
        const cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4, cz = (c[0][1] + c[1][1] + c[2][1] + c[3][1]) / 4;
        const planes = [];
        for (let k = 0; k < 4; k++) {
          const p = c[k], q = c[(k + 1) % 4];
          let A = -(q[1] - p[1]), Cc = q[0] - p[0], E = -(A * p[0] + Cc * p[1]);
          if (A * cx + Cc * cz + E < 0) { A = -A; Cc = -Cc; E = -E; }
          const l = Math.hypot(A, Cc); planes.push([A / l, Cc / l, E / l]);
        }
        quads.push({ planes, x0: Math.min(...c.map((v) => v[0])), x1: Math.max(...c.map((v) => v[0])), z0: Math.min(...c.map((v) => v[1])), z1: Math.max(...c.map((v) => v[1])) });
      }
    }
    let X0 = 1e9, X1 = -1e9, Z0 = 1e9, Z1 = -1e9;
    for (const q of quads) { X0 = Math.min(X0, q.x0); X1 = Math.max(X1, q.x1); Z0 = Math.min(Z0, q.z0); Z1 = Math.max(Z1, q.z1); }
    const dist = (v, pl) => pl[0] * v.w[0] + pl[1] * v.w[2] + pl[2];
    const mix = (a, b, t) => ({ w: a.w.map((x, i) => x + (b.w[i] - x) * t), a: a.a.map((x, i) => x + (b.a[i] - x) * t) });
    function clipPoly(poly, pl, sign) {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        const dp = dist(p, pl) * sign, dq = dist(q, pl) * sign;
        if (dp >= 0) out.push(p);
        if ((dp >= 0) !== (dq >= 0)) out.push(mix(p, q, dp / (dp - dq)));
      }
      return out;
    }
    function subtract(poly, q) {
      let allIn = true;
      for (const pl of q.planes) {
        let any = false, allOut = true;
        for (const v of poly) { const d = dist(v, pl); if (d > 1e-6) allOut = false; if (d < 0) any = true; }
        if (allOut) return [poly];
        if (any) allIn = false;
      }
      if (allIn) return [];
      const out = [];
      let rest = poly;
      for (const pl of q.planes) {
        const o = clipPoly(rest, pl, -1);
        if (o.length >= 3) out.push(o);
        rest = clipPoly(rest, pl, 1);
        if (rest.length < 3) break;
      }
      return out;
    }
    const inside = (x, z, q, m) => q.planes.every((pl) => pl[0] * x + pl[1] * z + pl[2] > -m);
    const users = new Map();
    scene.traverse((o) => { if (o.isMesh && o.geometry) users.set(o.geometry, (users.get(o.geometry) || 0) + 1); });
    scene.updateMatrixWorld(true);
    const list = [];
    scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position && o.visible !== undefined) list.push(o); });
    const box = new THREE.Box3(), _m = new THREE.Matrix4(), _v = new THREE.Vector3();
    const report = { cut: [], dropped: [], hidden: [] };
    for (const o of list) {
      let g = o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      if (o.isInstancedMesh) {
        let n = 0;
        for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, _m); _m.premultiply(o.matrixWorld); _v.setFromMatrixPosition(_m);
          if (_v.y < 0.6 && _v.x > X0 && _v.x < X1 && _v.z > Z0 && _v.z < Z1 && quads.some((q) => inside(_v.x, _v.z, q, 0.3))) { o.setMatrixAt(i, _m.makeScale(0, 0, 0)); n++; }
        }
        if (n) { o.instanceMatrix.needsUpdate = true; report.hidden.push(o.name + ':' + n); }
        continue;
      }
      box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
      if (box.max.x < X0 || box.min.x > X1 || box.max.z < Z0 || box.min.z > Z1) continue;
      const pa = g.attributes.position;
      if (pa.isInterleavedBufferAttribute || Array.isArray(o.material) || g.morphAttributes.position) continue;
      if (/^sky/.test(o.name) || box.max.y - box.min.y > 400) continue;
      if (Object.values(g.attributes).some((a) => a.isInterleavedBufferAttribute)) continue;
      const names = Object.keys(g.attributes), attrs = names.map((n) => g.attributes[n]);
      const idx = g.index ? g.index.array : null, nTri = (idx ? idx.length : pa.count) / 3;
      const e = o.matrixWorld.elements;
      const vert = (vi) => {
        const a = [];
        for (const at of attrs) for (let k = 0; k < at.itemSize; k++) a.push(at.array[vi * at.itemSize + k]);
        const x = pa.array[vi * 3], y = pa.array[vi * 3 + 1], z = pa.array[vi * 3 + 2];
        return { w: [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]], a };
      };
      const out = []; let changed = false, nCut = 0, nDrop = 0;
      const emit = (vs) => { for (const v of vs) out.push(v.a); };
      for (let t = 0; t < nTri; t++) {
        const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
        const v0 = vert(i0), v1 = vert(i1), v2 = vert(i2);
        const tx0 = Math.min(v0.w[0], v1.w[0], v2.w[0]), tx1 = Math.max(v0.w[0], v1.w[0], v2.w[0]);
        const tz0 = Math.min(v0.w[2], v1.w[2], v2.w[2]), tz1 = Math.max(v0.w[2], v1.w[2], v2.w[2]);
        const hits = (tx1 < X0 || tx0 > X1 || tz1 < Z0 || tz0 > Z1) ? [] : quads.filter((q) => !(tx1 < q.x0 || tx0 > q.x1 || tz1 < q.z0 || tz0 > q.z1));
        if (!hits.length) { emit([v0, v1, v2]); continue; }
        const ground = Math.max(v0.w[1], v1.w[1], v2.w[1]) < 0.6 && Math.min(v0.w[1], v1.w[1], v2.w[1]) > -0.5;
        if (!ground) {
          const cx = (v0.w[0] + v1.w[0] + v2.w[0]) / 3, cz = (v0.w[2] + v1.w[2] + v2.w[2]) / 3;
          if (hits.some((q) => inside(cx, cz, q, 0.2))) { changed = true; nDrop++; } else emit([v0, v1, v2]);
          continue;
        }
        let polys = [[v0, v1, v2]];
        for (const q of hits) { polys = polys.flatMap((p) => subtract(p, q)); if (!polys.length) break; }
        if (polys.length === 1 && polys[0].length === 3 && polys[0][0] === v0 && polys[0][1] === v1 && polys[0][2] === v2) { emit([v0, v1, v2]); continue; }
        changed = true; nCut++;
        for (const p of polys) for (let k = 1; k < p.length - 1; k++) emit([p[0], p[k], p[k + 1]]);
      }
      if (!changed) continue;
      const ng = new THREE.BufferGeometry();
      let off = 0;
      attrs.forEach((at, j) => {
        const arr = new at.array.constructor(out.length * at.itemSize);
        for (let v = 0; v < out.length; v++) for (let k = 0; k < at.itemSize; k++) arr[v * at.itemSize + k] = out[v][off + k];
        ng.setAttribute(names[j], new THREE.BufferAttribute(arr, at.itemSize, at.normalized));
        off += at.itemSize;
      });
      ng.computeBoundingBox(); ng.computeBoundingSphere();
      if ((users.get(g) || 0) <= 1) g.dispose();
      o.geometry = ng;
      report.cut.push(o.name + ':' + nCut + (nDrop ? '/drop' + nDrop : ''));
    }
    C.tunnels.cutReport = report;
  }

  // ---------------------------------------------------------------- textures
  const CJK = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';
  function rng(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  const concTex = (() => {
    const c = makeCanvas(512, 512), k = c.getContext('2d'), r = rng(77);
    k.fillStyle = '#8e8d89'; k.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { const v = 120 + r() * 40 | 0; k.fillStyle = `rgba(${v},${v - 1},${v - 3},${0.25 + r() * 0.3})`; k.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2); }
    // rain streaks running down from the coping
    for (let i = 0; i < 26; i++) { const x = r() * 512, w = 2 + r() * 9, h = 60 + r() * 300; const gr = k.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(48,48,46,0.16)'); gr.addColorStop(1, 'rgba(48,48,46,0)'); k.fillStyle = gr; k.fillRect(x, 0, w, h); }
    k.fillStyle = 'rgba(30,30,28,0.55)';
    for (const x of [0, 256]) k.fillRect(x, 0, 3, 512);                 // panel joints every 3 m
    k.fillStyle = 'rgba(50,48,44,0.25)';
    for (const y of [0, 128, 256, 384]) k.fillRect(0, y, 512, 1);       // formwork lifts every 1.5 m
    k.fillStyle = 'rgba(35,33,30,0.7)';
    for (let x = 32; x < 512; x += 64) for (let y = 32; y < 512; y += 64) { k.beginPath(); k.arc(x, y, 2.2, 0, 7); k.fill(); }
    return canvasTexture(c, true, 1, 1, 8);
  })();
  const tileTex = (() => {
    // 2.4 m x 4.8 m of bore wall, floor at the bottom edge
    const c = makeCanvas(512, 1024), k = c.getContext('2d'), r = rng(19), PX = 1024 / H;
    const Y = (m) => 1024 - m * PX;
    k.fillStyle = '#3a3d43'; k.fillRect(0, 0, 512, 1024);
    k.fillStyle = 'rgba(0,0,0,0.35)';
    for (let x = 0; x < 512; x += 1.2 * PX) k.fillRect(x, 0, 2, Y(3.4));   // fireproof board joints
    for (let y = 0.27; y < 3.3; y += 0.15) {
      const band = y > 1.05 && y < 1.4;
      for (let x = 0; x < 512; x += 0.3 * PX) {
        const v = band ? [42, 93, 154] : [232, 230, 223];
        const j = (r() - 0.5) * 10;
        k.fillStyle = `rgb(${v[0] + j | 0},${v[1] + j | 0},${v[2] + j | 0})`;
        k.fillRect(x + 1, Y(y + 0.15) + 1, 0.3 * PX - 2, 0.15 * PX - 2);
      }
    }
    // grime: road spray darkens the bottom courses
    const gr = k.createLinearGradient(0, Y(1.0), 0, Y(0.27)); gr.addColorStop(0, 'rgba(60,55,48,0)'); gr.addColorStop(1, 'rgba(60,55,48,0.45)');
    k.fillStyle = gr; k.fillRect(0, Y(1.0), 512, Y(0.27) - Y(1.0));
    k.fillStyle = '#c9ccd0'; k.fillRect(0, Y(3.42), 512, 0.06 * PX);   // stainless trim
    return canvasTexture(c, true, 1, 1, 8);
  })();
  const chevTex = (() => {
    const c = makeCanvas(128, 128), k = c.getContext('2d');
    k.fillStyle = '#16171a'; k.fillRect(0, 0, 128, 128);
    k.fillStyle = '#e0b021';
    for (let i = -2; i < 4; i++) { k.beginPath(); k.moveTo(i * 64, 128); k.lineTo(i * 64 + 32, 128); k.lineTo(i * 64 + 160, 0); k.lineTo(i * 64 + 128, 0); k.fill(); }
    return canvasTexture(c, true, 1, 1, 4);
  })();
  function panelTex(w, h, draw) { const c = makeCanvas(w, h), k = c.getContext('2d'); draw(k, w, h); return canvasTexture(c, true, 1, 1, 8); }
  const nameTex = {};
  for (const sp of SPEC) if (!nameTex[sp.name]) nameTex[sp.name] = panelTex(1024, 192, (k, w, h) => {
    k.fillStyle = '#1d2229'; k.fillRect(0, 0, w, h);
    k.fillStyle = '#f4efe2'; k.textAlign = 'center'; k.textBaseline = 'middle';
    k.font = `600 100px ${CJK}`; k.fillText(sp.name.split('').join(' '), w / 2, h * 0.4);
    k.font = `500 34px ${CJK}`; k.fillStyle = '#b8c3cf'; k.fillText(sp.en.split('').join(' '), w / 2, h * 0.82);
  });
  const arrowTex = panelTex(128, 128, (k) => {
    k.fillStyle = '#060707'; k.fillRect(0, 0, 128, 128);
    k.fillStyle = '#39ff7a'; k.beginPath(); k.moveTo(64, 112); k.lineTo(24, 64); k.lineTo(48, 64); k.lineTo(48, 18); k.lineTo(80, 18); k.lineTo(80, 64); k.lineTo(104, 64); k.fill();
  });
  const limitTex = panelTex(256, 128, (k) => {
    for (const [cx, txt, f] of [[64, '4.5m', 40], [192, '60', 62]]) {
      k.fillStyle = '#fff'; k.beginPath(); k.arc(cx, 64, 60, 0, 7); k.fill();
      k.strokeStyle = '#d8281e'; k.lineWidth = 12; k.beginPath(); k.arc(cx, 64, 53, 0, 7); k.stroke();
      k.fillStyle = '#111'; k.font = `700 ${f}px ${CJK}`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText(txt, cx, 66);
    }
    k.fillStyle = '#111'; k.beginPath(); k.moveTo(64, 10); k.lineTo(56, 24); k.lineTo(72, 24); k.fill(); k.beginPath(); k.moveTo(64, 118); k.lineTo(56, 104); k.lineTo(72, 104); k.fill();
  });
  const exitTex = panelTex(256, 96, (k, w, h) => {
    k.fillStyle = '#0d8c4a'; k.fillRect(0, 0, w, h); k.strokeStyle = '#e8fff0'; k.lineWidth = 4; k.strokeRect(4, 4, w - 8, h - 8);
    k.fillStyle = '#f2fff6'; k.font = `600 36px ${CJK}`; k.textBaseline = 'middle'; k.fillText('紧急出口', 92, 36);
    k.font = `500 20px ${CJK}`; k.fillText('EMERGENCY EXIT  →', 92, 70);
    k.beginPath(); k.arc(46, 24, 9, 0, 7); k.fill(); k.fillRect(38, 36, 14, 26); k.fillRect(26, 44, 36, 7); k.fillRect(36, 60, 7, 26); k.fillRect(48, 60, 7, 26);
  });
  const fireTex = panelTex(128, 160, (k, w, h) => {
    k.fillStyle = '#b3201b'; k.fillRect(0, 0, w, h); k.fillStyle = '#d9d9d9'; k.fillRect(8, 8, w - 16, 44);
    k.fillStyle = '#b3201b'; k.font = `700 30px ${CJK}`; k.textAlign = 'center'; k.textBaseline = 'middle'; k.fillText('消 防', w / 2, 31);
    k.strokeStyle = 'rgba(0,0,0,0.35)'; k.lineWidth = 3; k.strokeRect(8, 60, w - 16, h - 70);
    k.fillStyle = '#fff'; k.font = `700 26px ${CJK}`; k.fillText('119', w / 2, 128);
  });
  const dirTex = {};
  for (const sp of SPEC) if (sp.to) dirTex[sp.id] = panelTex(512, 192, (k, w, h) => {
    k.fillStyle = '#1c4f9c'; k.fillRect(0, 0, w, h); k.strokeStyle = '#eef3ff'; k.lineWidth = 6; k.strokeRect(8, 8, w - 16, h - 16);
    k.fillStyle = '#fff'; k.textBaseline = 'middle'; k.font = `600 54px ${CJK}`; k.fillText(sp.name, 36, 66);
    k.font = `500 38px ${CJK}`; k.fillText('↓  ' + sp.to, 36, 138);
  });

  // ---------------------------------------------------------------- materials
  // Bore lighting is baked: vertex colour scales the emissive term as well as
  // the albedo, so the threshold zone, wall gradients and lamp pools read
  // without spending any of the scene's dynamic lights.
  function lit(o) {
    const m = new THREE.MeshStandardMaterial(o);
    m.vertexColors = true; m.userData.surfaceProcedural = true;
    m.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n  totalEmissiveRadiance *= vColor.rgb;\n#endif');
    };
    m.customProgramCacheKey = () => 'tunnel-lit';
    return m;
  }
  const A = TEX.asphalt;
  const MAT = {
    floorOpen: M.asphalt,
    floorBore: lit({ map: A.alb, roughnessMap: A.rgh, normalMap: A.nrm, normalScale: new THREE.Vector2(0.22, 0.22), emissiveMap: A.alb, emissive: 0xd8d2c6, emissiveIntensity: 0.32, roughness: 0.62, metalness: 0.05, envMapIntensity: 0.3 }),
    paint: lit({ color: 0xe6e2d6, roughness: 0.45, emissive: 0xe6e2d6, emissiveIntensity: 0.0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    paintBore: lit({ color: 0xe6e2d6, roughness: 0.45, emissive: 0xe6e2d6, emissiveIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    wall: lit({ map: concTex, color: 0xc4c3bf, roughness: 0.9, metalness: 0.0, emissiveMap: concTex, emissive: 0xe8eef4, emissiveIntensity: 0.07, side: THREE.DoubleSide }),
    tile: lit({ map: tileTex, emissiveMap: tileTex, emissive: 0xffffff, emissiveIntensity: 0.42, roughness: 0.22, metalness: 0.0, envMapIntensity: 1.1, side: THREE.DoubleSide }),
    soffit: lit({ color: 0x3c3f45, roughness: 0.85, emissive: 0x2a2d33, emissiveIntensity: 1.0, side: THREE.DoubleSide }),
    kerbChev: lit({ map: chevTex, emissiveMap: chevTex, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.6 }),
    kerb: lit({ map: concTex, color: 0xb5b0a6, roughness: 0.8, emissiveMap: concTex, emissive: 0xffffff, emissiveIntensity: 0.05 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8d949c, roughness: 0.42, metalness: 0.8, envMapIntensity: 1.2 }),
    alu: new THREE.MeshStandardMaterial({ color: 0x5b636d, roughness: 0.35, metalness: 0.7, envMapIntensity: 1.3 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xf2f4f6, emissive: 0xfff3e2, emissiveIntensity: 3.2, roughness: 0.3 }),
    led: new THREE.MeshStandardMaterial({ color: 0xdff2ff, emissive: 0xbfe6ff, emissiveIntensity: 3.6, roughness: 0.3 }),
    cushion: new THREE.MeshStandardMaterial({ map: chevTex, emissiveMap: chevTex, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.55 }),
    fan: new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.4, metalness: 0.75, envMapIntensity: 1.0, emissive: 0x30343a, emissiveIntensity: 1.0 }),
    fanIn: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.7, metalness: 0.3 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1, metalness: 0 }),
    grate: new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 0.5, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
  };
  for (const k in MAT) MAT[k].userData.surfaceProcedural = true;
  const signMat = (map, k = 1.6) => { const m = new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: k, roughness: 0.4 }); m.userData.surfaceProcedural = true; return m; };
  const poolMat = new THREE.MeshBasicMaterial({ map: TEX.lightPool, color: new THREE.Color(1.5, 1.46, 1.38), transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8 });

  // ---------------------------------------------------------------- geometry builder
  function Builder() { this.p = []; this.c = []; this.u = []; }
  Builder.prototype.quad = function (a, b, c, d, ua, ub, uc, ud, hint, ca, cb, cc, cd) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    let V = [[a, ua, ca], [b, ub, cb], [c, uc, cc], [d, ud, cd]];
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) V = [V[0], V[3], V[2], V[1]];
    for (const i of [0, 1, 2, 0, 2, 3]) { const [p, uv, col] = V[i]; this.p.push(p[0], p[1], p[2]); this.u.push(uv[0], uv[1]); const cl = col || [1, 1, 1]; this.c.push(cl[0], cl[1], cl[2]); }
  };
  Builder.prototype.mesh = function (mat, name) {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
    return put(new THREE.Mesh(g, mat), name);
  };
  function put(m, name) {
    m.name = name; m.userData.passable = true; m.userData.surfaceProcedural = true;
    m.receiveShadow = false; m.castShadow = false;
    scene.add(m); G.noReflect.push(m);
    return m;
  }
  const warm = (b) => [b, b * 0.975, b * 0.94];

  // ---------------------------------------------------------------- build each ramp + bore
  const B = { floorOpen: new Builder(), floorBore: new Builder(), paint: new Builder(), paintBore: new Builder(), wall: new Builder(), tile: new Builder(), soffit: new Builder(), kerbChev: new Builder(), kerb: new Builder(), grate: new Builder() };
  const parts = { steel: [], alu: [], lamp: [], led: [], cushion: [], fan: [], fanIn: [], dark: [], pools: [] };
  const signs = [];
  const P3 = (f, lat, y) => [f.x + f.nx * lat, y, f.z + f.nz * lat];
  const yawOf = (f) => Math.atan2(f.tx, f.tz);
  // brightness of the bore at arc s: the threshold zone near the portal is lit harder
  const boreB = (s) => (s > -36 ? 1.0 : 0.72) * (s > -2 ? 0.75 + 0.25 * clamp(-s / 2, 0, 1) : 1);

  for (const R of RAMPS) {
    const P = R.pts;
    // wall lamps along the open trench (only where it is deep enough to need them)
    const lampsS = [];
    for (let s = 6; s < R.L - 20; s += 16) if (hAt(R, s) < -2.6) lampsS.push(s);
    const openB = (s, y) => {
      let g = 0.55;
      for (const ls of lampsS) { const ly = hAt(R, ls) + 3.9, d2 = (s - ls) ** 2 + ((y - ly) * 1.4) ** 2; g += 0.9 * Math.exp(-d2 / 30); }
      // light spilling out of the portal
      g += 0.6 * Math.exp(-s / 6);
      return Math.min(1.3, g);
    };
    const floorLat = [-(WI - KB), -2.7, -1.35, 0, 1.35, 2.7, WI - KB];
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], bore = b.s <= 0.001;
      const fa = a, fb = b;
      const ha = hAt(R, a.s), hb = hAt(R, b.s);
      const ba = bore ? boreB(a.s) : openB(a.s, ha), bb = bore ? boreB(b.s) : openB(b.s, hb);
      // carriageway
      const FB = bore ? B.floorBore : B.floorOpen;
      for (let k = 0; k < floorLat.length - 1; k++) {
        const l0 = floorLat[k], l1 = floorLat[k + 1];
        const e0 = 1 - 0.18 * Math.abs(l0) / WI, e1 = 1 - 0.18 * Math.abs(l1) / WI;
        FB.quad(P3(fa, l0, ha + 0.02), P3(fa, l1, ha + 0.02), P3(fb, l1, hb + 0.02), P3(fb, l0, hb + 0.02),
          [a.s / 8, l0 / 8], [a.s / 8, l1 / 8], [b.s / 8, l1 / 8], [b.s / 8, l0 / 8], [0, 1, 0],
          warm(ba * e0), warm(ba * e1), warm(bb * e1), warm(bb * e0));
      }
      // edge lines, centre line: dashed on the open ramp, solid in the bore and the last 30 m before it
      const PB = bore ? B.paintBore : B.paint;
      const lines = [[-(WI - KB) + 0.25, 0.15], [(WI - KB) - 0.4, 0.15]];
      const dashed = a.s > 30 && (Math.floor(a.s / 2) % 3 === 0);
      if (!(a.s > 30) || dashed) lines.push([-0.075, 0.15]);
      for (const [l0, w] of lines) PB.quad(P3(fa, l0, ha + 0.035), P3(fa, l0 + w, ha + 0.035), P3(fb, l0 + w, hb + 0.035), P3(fb, l0, hb + 0.035), [0, 0], [1, 0], [1, 1], [0, 1], [0, 1, 0], warm(ba), warm(ba), warm(bb), warm(bb));
      for (const side of [-1, 1]) {
        const li = side * WI, lk = side * (WI - KB);
        // safety kerb: top + face
        const KBld = bore ? B.kerbChev : B.kerb;
        B.kerb.quad(P3(fa, lk, ha + 0.27), P3(fa, li, ha + 0.27), P3(fb, li, hb + 0.27), P3(fb, lk, hb + 0.27), [a.s / 6, 0], [a.s / 6, 0.08], [b.s / 6, 0.08], [b.s / 6, 0], [0, 1, 0], warm(ba * 0.9), warm(ba * 0.9), warm(bb * 0.9), warm(bb * 0.9));
        KBld.quad(P3(fa, lk, ha + 0.02), P3(fa, lk, ha + 0.27), P3(fb, lk, hb + 0.27), P3(fb, lk, hb + 0.02), [a.s, 0], [a.s, 0.25], [b.s, 0.25], [b.s, 0], [-side * a.nx, 0, -side * a.nz], warm(ba), warm(ba), warm(bb), warm(bb));
        if (!bore) {
          // drainage slot along the kerb
          B.grate.quad(P3(fa, lk - side * 0.3, ha + 0.03), P3(fa, lk, ha + 0.03), P3(fb, lk, hb + 0.03), P3(fb, lk - side * 0.3, hb + 0.03), [0, 0], [1, 0], [1, 1], [0, 1], [0, 1, 0]);
          // retaining wall inner face, split in lifts so the lamp pools are smooth
          const lifts = 6;
          for (let k = 0; k < lifts; k++) {
            const y0a = ha + 0.27 + (PAR - ha - 0.27) * k / lifts, y1a = ha + 0.27 + (PAR - ha - 0.27) * (k + 1) / lifts;
            const y0b = hb + 0.27 + (PAR - hb - 0.27) * k / lifts, y1b = hb + 0.27 + (PAR - hb - 0.27) * (k + 1) / lifts;
            B.wall.quad(P3(fa, li, y0a), P3(fa, li, y1a), P3(fb, li, y1b), P3(fb, li, y0b), [a.s / 6, y0a / 6], [a.s / 6, y1a / 6], [b.s / 6, y1b / 6], [b.s / 6, y0b / 6], [-side * a.nx, 0, -side * a.nz],
              warm(openB(a.s, y0a)), warm(openB(a.s, y1a)), warm(openB(b.s, y1b)), warm(openB(b.s, y0b)));
          }
          // coping and the parapet's outer face
          const lc0 = side * (WI - 0.08), lc1 = side * (W + 0.06), yc = PAR + 0.1;
          B.wall.quad(P3(fa, lc0, yc), P3(fa, lc1, yc), P3(fb, lc1, yc), P3(fb, lc0, yc), [a.s / 6, 0], [a.s / 6, 0.12], [b.s / 6, 0.12], [b.s / 6, 0], [0, 1, 0], warm(0.5), warm(0.5), warm(0.5), warm(0.5));
          B.wall.quad(P3(fa, lc0, PAR), P3(fa, lc0, yc), P3(fb, lc0, yc), P3(fb, lc0, PAR), [a.s / 6, 0], [a.s / 6, 0.02], [b.s / 6, 0.02], [b.s / 6, 0], [-side * a.nx, 0, -side * a.nz], warm(0.5), warm(0.5), warm(0.5), warm(0.5));
          B.wall.quad(P3(fa, lc1, 0), P3(fa, lc1, yc), P3(fb, lc1, yc), P3(fb, lc1, 0), [a.s / 6, 0], [a.s / 6, yc / 6], [b.s / 6, yc / 6], [b.s / 6, 0], [side * a.nx, 0, side * a.nz], warm(0.42), warm(0.42), warm(0.42), warm(0.42));
        } else {
          // bore wall: tiles below, fireproof boards above, the texture spans the full height
          const ys = [0.27, 1.0, 2.0, 3.0, 3.9, H];
          for (let k = 0; k < ys.length - 1; k++) {
            const y0 = ys[k], y1 = ys[k + 1], g0 = 0.8 + 0.2 * y0 / H, g1 = 0.8 + 0.2 * y1 / H;
            B.tile.quad(P3(fa, li, ha + y0), P3(fa, li, ha + y1), P3(fb, li, hb + y1), P3(fb, li, hb + y0), [a.s / 2.4, y0 / H], [a.s / 2.4, y1 / H], [b.s / 2.4, y1 / H], [b.s / 2.4, y0 / H], [-side * a.nx, 0, -side * a.nz],
              warm(ba * g0), warm(ba * g1), warm(bb * g1), warm(bb * g0));
          }
        }
      }
      if (bore) {
        // soffit, with a chamfer into each wall
        for (const side of [-1, 1]) B.soffit.quad(P3(fa, side * WI, ha + H - 0.45), P3(fa, side * (WI - 0.5), ha + H), P3(fb, side * (WI - 0.5), hb + H), P3(fb, side * WI, hb + H - 0.45), [0, 0], [1, 0], [1, 1], [0, 1], [-side * a.nx, -1, -side * a.nz], warm(ba * 0.8), warm(ba * 0.8), warm(bb * 0.8), warm(bb * 0.8));
        B.soffit.quad(P3(fa, -(WI - 0.5), ha + H), P3(fa, WI - 0.5, ha + H), P3(fb, WI - 0.5, hb + H), P3(fb, -(WI - 0.5), hb + H), [0, 0], [1, 0], [1, 1], [0, 1], [0, -1, 0], warm(ba * 0.6), warm(ba * 0.6), warm(bb * 0.6), warm(bb * 0.6));
      }
    }
    // transverse drain at the mouth and before the portal
    for (const s of [R.L - 3, 3]) {
      const f = frameAt(R, s), h = hAt(R, s) + 0.03, f2 = frameAt(R, s + 0.5), h2 = hAt(R, s + 0.5) + 0.03;
      B.grate.quad(P3(f, -(WI - KB), h), P3(f, WI - KB, h), P3(f2, WI - KB, h2), P3(f2, -(WI - KB), h2), [0, 0], [1, 0], [1, 1], [0, 1], [0, 1, 0]);
    }
    // ---- bore fittings
    for (let s = -2.2; s > -BORE + 2; s -= (s > -36 ? 1.5 : 3.0)) {
      const f = frameAt(R, s), h = hAt(R, s), yaw = yawOf(f);
      for (const side of [-1, 1]) {
        const p = P3(f, side * (WI - 0.62), h + H - 0.08);
        parts.lamp.push({ geometry: boxGeo(0.26, 0.09, 1.2), matrix: M4(p[0], p[1], p[2], yaw) });
        parts.alu.push({ geometry: boxGeo(0.34, 0.06, 1.3), matrix: M4(p[0], p[1] + 0.07, p[2], yaw) });
      }
    }
    for (let s = -1; s > -BORE + 1; s -= 6) {
      const f = frameAt(R, s), h = hAt(R, s), yaw = yawOf(f);
      for (const side of [-1, 1]) {
        const p = P3(f, side * (WI - 0.2), h + H - 0.9);
        parts.steel.push({ geometry: boxGeo(0.4, 0.1, 6.0), matrix: M4(p[0], p[1], p[2], yaw) });          // cable tray
        const q = P3(f, side * (WI - 0.05), h + 3.42);
        parts.steel.push({ geometry: boxGeo(0.08, 0.06, 6.0), matrix: M4(q[0], q[1], q[2], yaw) });         // trim rail
      }
    }
    for (const s of [-22, -62]) {
      const f = frameAt(R, s), h = hAt(R, s), yaw = yawOf(f);
      for (const lat of [-2.1, 2.1]) {
        const p = P3(f, lat, h + H - 0.85);
        parts.fan.push({ geometry: new THREE.CylinderGeometry(0.56, 0.56, 3.4, 28, 1, true), matrix: M4(p[0], p[1], p[2], yaw, Math.PI / 2) });
        parts.fan.push({ geometry: new THREE.CylinderGeometry(0.5, 0.5, 3.0, 28, 1, false), matrix: M4(p[0], p[1], p[2], yaw, Math.PI / 2) });
        for (const e of [-1.72, 1.72]) {
          const q = [p[0] + f.tx * e, p[1], p[2] + f.tz * e];
          parts.fanIn.push({ geometry: new THREE.CircleGeometry(0.5, 28), matrix: M4(q[0], q[1], q[2], yaw + (e > 0 ? 0 : Math.PI)) });
          parts.fan.push({ geometry: new THREE.TorusGeometry(0.56, 0.035, 8, 28), matrix: M4(q[0], q[1], q[2], yaw) });
        }
        for (const e of [-1, 1]) { const q = [p[0] + f.tx * e, p[1] + 0.6, p[2] + f.tz * e]; parts.steel.push({ geometry: boxGeo(0.08, 0.4, 0.08), matrix: M4(q[0], q[1], q[2], yaw) }); }
      }
    }
    for (const s of [-12, -52]) {
      const f = frameAt(R, s), h = hAt(R, s), yaw = yawOf(f);
      const p = P3(f, -(WI - 0.035), h + 2.55);
      signs.push({ map: exitTex, w: 0.95, h: 0.36, p, yaw: yaw + Math.PI / 2, k: 1.4 });
      const q = P3(f, WI - 0.04, h + 1.15);
      signs.push({ map: fireTex, w: 0.7, h: 0.88, p: q, yaw: yaw - Math.PI / 2, k: 0.55 });
      parts.alu.push({ geometry: boxGeo(0.06, 0.96, 0.78), matrix: M4(q[0] + f.nx * 0.045, q[1], q[2] + f.nz * 0.045, yaw) });
    }
    // dark end of the modelled bore
    {
      const f = frameAt(R, -BORE), h = hAt(R, -BORE);
      parts.dark.push({ geometry: new THREE.PlaneGeometry(2 * WI + 0.2, H + 0.4), matrix: M4(f.x, h + H / 2, f.z, yawOf(f)) });
    }
    // ---- open trench fittings
    for (const ls of lampsS) {
      const f = frameAt(R, ls), h = hAt(R, ls), yaw = yawOf(f);
      for (const side of [-1, 1]) {
        const p = P3(f, side * (WI - 0.16), h + 3.9);
        parts.lamp.push({ geometry: boxGeo(0.62, 0.12, 0.34), matrix: M4(p[0], p[1], p[2], yaw + Math.PI / 2) });
        parts.alu.push({ geometry: boxGeo(0.7, 0.16, 0.12), matrix: M4(p[0] + side * f.nx * 0.14, p[1] + 0.06, p[2] + side * f.nz * 0.14, yaw + Math.PI / 2) });
      }
      const g = new THREE.PlaneGeometry(8.6, 11); g.rotateX(-Math.PI / 2);
      parts.pools.push({ geometry: g, matrix: M4(f.x, h + 0.06, f.z, yaw) });
    }
    // railing on both parapets
    for (const side of [-1, 1]) {
      for (let s = 0.5; s < R.L; s += 2) {
        const f = frameAt(R, s), yaw = yawOf(f), p = P3(f, side * (W - 0.2), PAR + 0.1 + 0.32);
        parts.steel.push({ geometry: boxGeo(0.06, 0.64, 0.06), matrix: M4(p[0], p[1], p[2], yaw) });
      }
      for (let s = 0; s < R.L - 0.01; s += 2) {
        const s1 = Math.min(R.L, s + 2), fa = frameAt(R, s), fb = frameAt(R, s1);
        for (const y of [PAR + 0.72, PAR + 0.42]) {
          const a = P3(fa, side * (W - 0.2), y), b = P3(fb, side * (W - 0.2), y);
          const l = Math.hypot(b[0] - a[0], b[2] - a[2]);
          parts.steel.push({ geometry: boxGeo(0.05, y > PAR + 0.6 ? 0.07 : 0.04, l + 0.02), matrix: M4((a[0] + b[0]) / 2, y, (a[2] + b[2]) / 2, Math.atan2(b[0] - a[0], b[2] - a[2])) });
        }
      }
      // crash cushion where the wall ends at the mouth
      const f = frameAt(R, R.L), yaw = yawOf(f), c = P3(f, side * (WI + WT / 2 - 0.05), 0.45);
      parts.cushion.push({ geometry: boxGeo(0.8, 0.9, 2.4, 1, 1), matrix: M4(c[0] + f.tx * 1.2, c[1], c[2] + f.tz * 1.2, yaw) });
      parts.lamp.push({ geometry: boxGeo(0.12, 0.12, 0.04), matrix: M4(c[0] + f.tx * 2.42, 0.75, c[2] + f.tz * 2.42, yaw) });
    }
    // ---- the portal
    {
      const f = frameAt(R, 0), yaw = yawOf(f), h0 = hAt(R, 0), top = 2.4, soff = h0 + H;
      const at = (lat, y, s) => [f.x + f.nx * lat + f.tx * s, y, f.z + f.nz * lat + f.tz * s];
      const pw = W + 0.9 - WI;
      for (const side of [-1, 1]) {
        const c = at(side * (WI + pw / 2), (h0 + top) / 2, -0.55);
        B.wall.quad(at(side * WI, h0, 0), at(side * (W + 0.9), h0, 0), at(side * (W + 0.9), top, 0), at(side * WI, top, 0), [0, h0 / 6], [pw / 6, h0 / 6], [pw / 6, top / 6], [0, top / 6], [f.tx, 0, f.tz], warm(1.1), warm(1.1), warm(0.6), warm(0.6));
        parts.alu.push({ geometry: boxGeo(pw, top - h0, 1.1), matrix: M4(c[0], c[1], c[2], yaw) });
        // pier sides above grade and the headwall's back face
        B.wall.quad(at(side * (W + 0.9), 0, 0), at(side * (W + 0.9), 0, -1.1), at(side * (W + 0.9), top, -1.1), at(side * (W + 0.9), top, 0), [0, 0], [0.2, 0], [0.2, 0.4], [0, 0.4], [side * f.nx, 0, side * f.nz], warm(0.45), warm(0.45), warm(0.45), warm(0.45));
      }
      B.wall.quad(at(-WI, soff, 0), at(WI, soff, 0), at(WI, top, 0), at(-WI, top, 0), [0, soff / 6], [2 * WI / 6, soff / 6], [2 * WI / 6, top / 6], [0, top / 6], [f.tx, 0, f.tz], warm(1.0), warm(1.0), warm(0.62), warm(0.62));
      B.wall.quad(at(-(W + 0.9), 0, -1.1), at(W + 0.9, 0, -1.1), at(W + 0.9, top, -1.1), at(-(W + 0.9), top, -1.1), [0, 0], [2, 0], [2, 0.4], [0, 0.4], [-f.tx, 0, -f.tz], warm(0.45), warm(0.45), warm(0.45), warm(0.45));
      B.wall.quad(at(-(W + 0.9), top, 0), at(W + 0.9, top, 0), at(W + 0.9, top, -1.1), at(-(W + 0.9), top, -1.1), [0, 0], [2, 0], [2, 0.2], [0, 0.2], [0, 1, 0], warm(0.5), warm(0.5), warm(0.5), warm(0.5));
      // lintel soffit inside the opening
      B.soffit.quad(at(-WI, soff, 0), at(WI, soff, 0), at(WI, soff, -1.1), at(-WI, soff, -1.1), [0, 0], [1, 0], [1, 1], [0, 1], [0, -1, 0], warm(0.7), warm(0.7), warm(0.7), warm(0.7));
      // coping on the headwall, aluminium fascia, LED outline of the opening
      { const c = at(0, top + 0.08, -0.5); parts.alu.push({ geometry: boxGeo(2 * (W + 1.0), 0.16, 1.3), matrix: M4(c[0], c[1], c[2], yaw) }); }
      { const c = at(0, (soff + top) / 2 + 0.15, 0.06); parts.alu.push({ geometry: boxGeo(2 * WI + 0.6, top - soff - 0.4, 0.1), matrix: M4(c[0], c[1], c[2], yaw) }); }
      for (const side of [-1, 1]) {
        const c = at(side * (WI + 0.12), (h0 + 0.3 + soff) / 2, 0.08);
        parts.led.push({ geometry: boxGeo(0.07, soff - h0 - 0.3, 0.05), matrix: M4(c[0], c[1], c[2], yaw) });
        const fr = at(side * (WI + 0.12), (h0 + soff) / 2, 0.04);
        parts.alu.push({ geometry: boxGeo(0.24, soff - h0, 0.1), matrix: M4(fr[0], fr[1], fr[2], yaw) });
      }
      { const c = at(0, soff - 0.12, 0.08); parts.led.push({ geometry: boxGeo(2 * WI + 0.3, 0.07, 0.05), matrix: M4(c[0], c[1], c[2], yaw) }); }
      // name board on the fascia, facing the ramp
      signs.push({ map: nameTex[R.name], w: 7.0, h: 1.31, p: at(0, (soff + top) / 2 + 0.35, 0.12), yaw, k: 1.25 });
      // lane control signals, facing the traffic
      const face = R.kind === 'in' ? 0 : Math.PI, sOff = R.kind === 'in' ? -0.45 : -0.75;
      for (const lat of [-2.0, 2.0]) {
        const c = at(lat, soff - 0.5, sOff);
        parts.alu.push({ geometry: boxGeo(0.74, 0.74, 0.22), matrix: M4(c[0], c[1], c[2], yaw) });
        const fc = at(lat, soff - 0.5, sOff + (R.kind === 'in' ? 0.115 : -0.115));
        signs.push({ map: arrowTex, w: 0.62, h: 0.62, p: fc, yaw: yaw + face, k: 2.4 });
        const hg = at(lat, soff - 0.06, sOff);
        parts.steel.push({ geometry: boxGeo(0.06, 0.2, 0.06), matrix: M4(hg[0], hg[1], hg[2], yaw) });
      }
      // light falling out of the bore onto the ramp floor
      const g = new THREE.PlaneGeometry(2 * WI - 1, 9); g.rotateX(-Math.PI / 2);
      parts.pools.push({ geometry: g, matrix: M4(f.x + f.tx * 3.5, hAt(R, 3.5) + 0.07, f.z + f.tz * 3.5, yaw) });
    }
    // ---- height-limit gantry at the mouth of the inbound ramps
    if (R.kind === 'in') {
      const s = R.L - 9, f = frameAt(R, s), yaw = yawOf(f), h = hAt(R, s);
      const at = (lat, y) => [f.x + f.nx * lat, y, f.z + f.nz * lat];
      for (const side of [-1, 1]) { const c = at(side * (W - 0.25), (PAR + 6.3) / 2); parts.steel.push({ geometry: boxGeo(0.3, 6.3 - PAR, 0.3), matrix: M4(c[0], c[1], c[2], yaw) }); }
      { const c = at(0, 6.15); parts.steel.push({ geometry: boxGeo(2 * W, 0.34, 0.34), matrix: M4(c[0], c[1], c[2], yaw) }); }
      // the swinging bar at 4.5 m, hung on chains
      { const c = at(0, h + 4.6); parts.cushion.push({ geometry: boxGeo(2 * WI - 0.4, 0.22, 0.22, 1, 1), matrix: M4(c[0], c[1], c[2], yaw) }); }
      for (const lat of [-(WI - 0.6), WI - 0.6]) { const c = at(lat, (h + 4.7 + 6.0) / 2); parts.steel.push({ geometry: boxGeo(0.03, 6.0 - h - 4.7, 0.03), matrix: M4(c[0], c[1], c[2], yaw) }); }
      const back = R.kind === 'in' ? 1 : -1;
      signs.push({ map: dirTex[R.id], w: 4.2, h: 1.58, p: [f.x + f.tx * 0.2 * back, 7.3, f.z + f.tz * 0.2 * back], yaw: yaw, k: 1.2 });
      parts.steel.push({ geometry: boxGeo(4.3, 1.66, 0.08), matrix: M4(f.x - f.tx * 0.0, 7.3, f.z - f.tz * 0.0, yaw) });
      for (const lat of [-1.2, 1.2]) { const c = at(lat, 6.6); parts.steel.push({ geometry: boxGeo(0.08, 0.6, 0.08), matrix: M4(c[0], c[1], c[2], yaw) }); }
      const ls = at(-(W - 0.25), 4.2);
      signs.push({ map: limitTex, w: 1.6, h: 0.8, p: [ls[0] + f.tx * 0.2, ls[1], ls[2] + f.tz * 0.2], yaw, k: 1.0 });
    }
    // ---- colliders (surface only: inside, the walls are enforced by tunnelMove)
    const box = (cx, cz, hx, hz, y1) => C.add({ x0: cx - hx, x1: cx + hx, z0: cz - hz, z1: cz + hz, y0: 0, y1, kind: 'tunnel-wall', surf: true });
    for (const side of [-1, 1]) {
      for (let s = 0.35; s < R.L; s += 0.7) {
        const f = frameAt(R, s), c = P3(f, side * (WI + WT / 2), 0);
        box(c[0], c[2], Math.abs(f.tx) * 0.36 + Math.abs(f.nx) * WT / 2, Math.abs(f.tz) * 0.36 + Math.abs(f.nz) * WT / 2, 1.7);
      }
      for (let s = R.L + 0.3; s < R.L + 2.4; s += 0.6) {
        const f = frameAt(R, R.L), c = P3(f, side * (WI + WT / 2 - 0.05), 0), d = s - R.L;
        box(c[0] + f.tx * d, c[2] + f.tz * d, Math.abs(f.tx) * 0.32 + Math.abs(f.nx) * 0.4, Math.abs(f.tz) * 0.32 + Math.abs(f.nz) * 0.4, 0.9);
      }
    }
    {
      const f = frameAt(R, 0);
      for (let lat = -(W + 0.9) + 0.35; lat < W + 0.9; lat += 0.7) {
        const cx = f.x + f.nx * lat - f.tx * 0.55, cz = f.z + f.nz * lat - f.tz * 0.55;
        box(cx, cz, Math.abs(f.nx) * 0.36 + Math.abs(f.tx) * 0.55, Math.abs(f.nz) * 0.36 + Math.abs(f.tz) * 0.55, 2.4);
      }
    }
  }
  for (const k in B) B[k].mesh(MAT[k], 'tunnel-' + k);
  for (const k in parts) {
    if (!parts[k].length) continue;
    const m = put(new THREE.Mesh(mergeGeoms(parts[k]), k === 'pools' ? poolMat : MAT[k]), 'tunnel-' + k);
    if (k === 'pools') m.renderOrder = 2;
  }
  {
    const byMap = new Map();
    for (const s of signs) { const key = s.map.uuid + ':' + s.k; if (!byMap.has(key)) byMap.set(key, { map: s.map, k: s.k, list: [] }); byMap.get(key).list.push({ geometry: new THREE.PlaneGeometry(s.w, s.h), matrix: M4(s.p[0], s.p[1], s.p[2], s.yaw) }); }
    let i = 0;
    for (const v of byMap.values()) put(new THREE.Mesh(mergeGeoms(v.list), signMat(v.map, v.k)), 'tunnel-sign-' + (i++));
  }
})();
