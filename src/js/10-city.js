/* 10-city — Linjiangzui rebuilt from OpenStreetMap geometry.
   Building footprints, road centrelines, the Shenjiang shoreline, parks and the
   ferry terminal come from © OpenStreetMap contributors (ODbL), bundled offline.
   Coordinates: metres, +x east, +z south; local origin; real-world coordinates are not published. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, TEX = G.TEX, scene = G.scene;
  const OSM = window.__OSM;
  const U = G.util;
  const { R, RI, pick, clamp, lerp, smoothstep, M4, boxGeo, roundedBox, mergeGeoms, addMerged, makeCanvas, canvasTexture } = U;
  const C = (G.city = {
    roads: [], colliders: [], buildings: [], landmarks: {}, spots: [], props: [],
    bounds: { x0: -870, z0: -1000, x1: 800, z1: 700, playerRadius: 0.9 },
    graph: null, start: [0, 150], carStart: [8, 150], taxiStart: [12, 160], ferry: [-85, 620],
    osm: true,
  });
  const BOUNDS = C.bounds;
  const add = (o) => { C.colliders.push(o); return o; };
  C.add = add;
  // open a walkable hole in the solid colliders (a doorway, a lobby inside a tower):
  // every box of a matching kind that overlaps the rect is replaced by the parts outside it
  C.carve = (x0, x1, z0, z1, kinds) => {
    const keep = [];
    for (const c of C.colliders) {
      const hit = c.x0 < x1 && c.x1 > x0 && c.z0 < z1 && c.z1 > z0 && (!kinds || kinds.test(c.kind || ''));
      if (!hit) { keep.push(c); continue; }
      const part = (o) => { const p = Object.assign({}, c, o); if (p.x1 - p.x0 > 0.02 && p.z1 - p.z0 > 0.02) keep.push(p); };
      part({ x1: x0 });
      part({ x0: x1 });
      part({ x0: Math.max(c.x0, x0), x1: Math.min(c.x1, x1), z1: z0 });
      part({ x0: Math.max(c.x0, x0), x1: Math.min(c.x1, x1), z0: z1 });
    }
    C.colliders.length = 0;
    for (const c of keep) C.colliders.push(c);
  };
  // Hand-built sites that replace or bridge the OSM fabric. They are declared
  // here so the OSM passes (buildings, shoreline, trees, lamps) leave them clear.
  const SITE = (C.site = {
    ring: { cx: -321, cz: -309, r: 52, w: 7, y: 7.4, stairs: [57, 171, 216, 264, 330], run: 13.8, sky: 96, skyR: 98 },
    wharf: { x0: -636, x1: -598, z0: 82, z1: 124, y: 0.67 },
    mall: { x0: -618, x1: -562, z0: 49, z1: 81, cut: -626.3 },
    // west bank 十八埠: the ferry gangway leaves the west bank here (13c-puxi builds it),
    // and the Yong'an lane block closes the map corner with its own walls
    puxiGap: { x: -738.1, z: 618.0, r: 1.95 },
    // 东晟路渡口: the access bridge from the quay onto the ferry pier crosses the seawall here
    dsGap: { x0: -60, x1: -45, z0: 617.6, z1: 622.4 },
    puxiLane: { x0: -870, x1: -808, z0: 651, z1: 700 },
  });
  const inGap = (x, z) => Math.hypot(x - SITE.puxiGap.x, z - SITE.puxiGap.z) < SITE.puxiGap.r || (x > SITE.dsGap.x0 && x < SITE.dsGap.x1 && z > SITE.dsGap.z0 && z < SITE.dsGap.z1);
  const inWharf = (x, z, pad = 0.2) => (x > SITE.wharf.x0 - pad && x < SITE.wharf.x1 + pad && z > SITE.wharf.z0 - pad && z < SITE.wharf.z1 + pad) || inGap(x, z);
  function keepOut(x, z, pad = 0) {
    const w = SITE.wharf, m = SITE.mall, g = SITE.ring;
    if (x > w.x0 - 1 - pad && x < w.x1 + 2.6 + pad && z > w.z0 - 2.6 - pad && z < w.z1 + 1 + pad) return true;
    if (x > m.x0 - 3 - pad && x < m.x1 + 3 + pad && z > m.z0 - 3 - pad && z < m.z1 + 7 + pad) return true;
    if (x > -62 - pad && x < -40 + pad && z > 615 - pad && z < 625 + pad) return true;   // 东晟路渡口 bridge landing
    const dx = x - g.cx, dz = z - g.cz, d = Math.hypot(dx, dz);
    if (d > g.r - g.w / 2 - 2.5 - pad && d < g.r + g.w / 2 + 2.5 + pad) return true;
    if (d > g.r && d < g.skyR + g.run + 4 + pad) {
      const ang = Math.atan2(dz, dx);
      for (const deg of g.stairs.concat([g.sky])) {
        let da = ang - deg * Math.PI / 180;
        da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
        if (da > 1.2) continue;
        const sky = deg === g.sky;
        if (Math.sin(da) * d < (sky ? 4.5 : 3.5) + pad && Math.cos(da) * d < (sky ? g.skyR : g.r + g.w / 2) + g.run + 4 + pad) return true;
      }
    }
    return false;
  }
  C.keepOut = keepOut;
  // ---- ribbon / wall geometry accumulator
  class GB {
    constructor() { this.pos = []; this.nor = []; this.uv = []; this.col = []; }
    quad(a, b, c, d, uvs, color, normal) {
      const P = this.pos, N = this.nor, T = this.uv, K = this.col;
      const cols = Array.isArray(color) ? color : [color, color, color, color];
      const order = [0, 3, 1, 1, 3, 2];
      for (const k of order) {
        const p = [a, b, c, d][k];
        P.push(p[0], p[1], p[2]);
        N.push(normal[0], normal[1], normal[2]);
        T.push(uvs[k][0], uvs[k][1]);
        const cc = cols[k] || cols[0];
        K.push(cc.r, cc.g, cc.b);
      }
    }
    build(useColor = true) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
      if (useColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      g.computeBoundingSphere(); g.computeBoundingBox();
      return g;
    }
  }

  const IN = (x, z, pad = 0) => x > BOUNDS.x0 - pad && x < BOUNDS.x1 + pad && z > BOUNDS.z0 - pad && z < BOUNDS.z1 + pad;

  // ------------------------------------------------------------- OSM parse
  function parsePoly(flat) { const p = []; for (let i = 0; i < flat.length; i += 2) p.push([flat[i], flat[i + 1]]); return p; }
  const WATER = (OSM.w || []).map(parsePoly).filter((p) => p.length > 4);
  const PARKS = (OSM.p || []).map(parsePoly);
  C.parks = PARKS;
  const FOOT = (OSM.f || []).map(parsePoly).filter((p) => p.length > 1);
  const B = [];
  for (const a of OSM.b) {
    const mat = a[a.length - 1], typ = a[a.length - 2], name = a[a.length - 3], skip = a[a.length - 4], h = a[a.length - 5];
    const pts = parsePoly(a.slice(0, a.length - 5));
    if (pts.length < 3) continue;
    let ax = 0, az = 0, x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of pts) { ax += p[0]; az += p[1]; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    const cx = ax / pts.length, cz = az / pts.length;
    // the two riverside blocks give way to the hand-built Harbour Plaza (13b-riverside)
    if (cx > SITE.mall.x0 - 2 && cx < SITE.mall.x1 + 2 && cz > SITE.mall.z0 - 2 && cz < SITE.mall.z1 + 2) continue;
    let area = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
    B.push({ pts, h, skip, name, typ, mat, cx, cz, x0, z0, x1, z1, area: Math.abs(area) / 2, ccw: area > 0 });
  }
  C.waterPolys = WATER;
  C.osmBuildings = B.length;
  function pointInWater(x, z) {
    for (const poly of WATER) {
      let inside = false;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
      }
      if (inside) return true;
    }
    return false;
  }
  C.pointInWater = pointInWater;

  // ------------------------------------------------------------- ground + river
  const groundMat = new THREE.MeshStandardMaterial({
    map: TEX.paving.alb, roughnessMap: TEX.paving.rgh, normalMap: TEX.paving.nrm,
    normalScale: new THREE.Vector2(0.35, 0.35), color: 0xe0dcd4, roughness: 0.9, metalness: 0.02, envMapIntensity: 0.8,
  });
  groundMat.userData.surfaceProcedural = true;
  G.groundMat = groundMat;
  {
    const g = boxGeo(2600, 6, 2400, 12, 12);
    const land = new THREE.Mesh(g, groundMat);
    land.position.set(0, -3, 0); land.receiveShadow = true;
    land.name = 'land-base'; land.userData.passable = true; land.userData.surfaceProcedural = true;
    scene.add(land);
    // the mirrored camera sits below the water; from there the slab's underside would cover the whole reflection
    G.noReflect.push(land);
  }

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x02060a, roughness: 0.09, metalness: 0.55, envMapIntensity: 1.2,
    normalMap: TEX.waterN, normalScale: new THREE.Vector2(0.5, 0.5), side: THREE.DoubleSide,
    // the land slab runs under the river 3.5 cm down; at a kilometre that is below depth precision
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -8,
  });
  waterMat.userData.surfaceProcedural = true;
  waterMat.onBeforeCompile = (shader) => {
    shader.uniforms.tRefl = G.reflUniforms.tRefl;
    shader.uniforms.uReflOn = G.reflUniforms.uOn;
    shader.uniforms.uReflScreen = G.reflUniforms.uScreen;
    shader.uniforms.uReflTime = G.reflUniforms.uTime;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nuniform sampler2D tRefl;\nuniform float uReflOn;\nuniform vec2 uReflScreen;\nuniform float uReflTime;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', `
      if (uReflOn > 0.5) {
        vec2 suv = gl_FragCoord.xy / uReflScreen;
        vec2 rip = vec2(sin(suv.y*190.0+uReflTime*0.6)+sin(suv.y*47.0-uReflTime*0.3), cos(suv.x*130.0-uReflTime*0.4)) * 0.0011;
        vec3 refl = vec3(0.0);
        float wsum = 0.0;
        // wind-roughened water smears each light into a vertical streak: short
        // taps, weighted toward the source, plus a sharp tap so the streaks keep a core
        vec2 wob = vec2(sin(suv.y*310.0+uReflTime*1.3)*0.0016 + sin(suv.y*83.0-uReflTime*0.7)*0.0022, 0.0);
        for (int i = 0; i < 16; i++) {
          float f = float(i) / 15.0;
          float o = f * f * 0.07;
          float w = 1.0 - 0.8 * f;
          refl += texture2D(tRefl, suv + rip + wob * (0.4 + f) + vec2(sin(suv.y*70.0+float(i)*1.7)*0.0025, o)).rgb * w;
          wsum += w;
        }
        refl /= wsum;
        vec3 core = texture2D(tRefl, suv + rip * 0.6 + wob).rgb;
        refl = mix(refl, max(refl, core), 0.55);
        // bright sources survive the darkening, the diffuse sky glow does not
        float lum = dot(refl, vec3(0.2126, 0.7152, 0.0722));
        refl *= mix(0.55, 1.25, smoothstep(0.18, 0.7, lum));
        float ndv = clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, refl, clamp(0.3 + fres * 0.6, 0.0, 0.9));
        #ifdef USE_FOG
          // the mirrored sky is added after the fog pass, so haze it here
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, (1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth)) * 0.7);
        #endif
      }
      #include <dithering_fragment>`);
  };
  waterMat.customProgramCacheKey = () => 'linjiangzui-water-osm-3';
  G.waterMat = waterMat;
  {
    const shape = new THREE.Shape();
    WATER.forEach((poly, wi) => {
      if (wi === 0) shape.moveTo(poly[0][0], -poly[0][1]); else shape.lineTo(poly[0][0], -poly[0][1]);
      for (let i = 1; i < poly.length; i++) shape.lineTo(poly[i][0], -poly[i][1]);
      shape.closePath();
    });
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    const water = new THREE.Mesh(g, waterMat);
    water.position.y = 0.035; water.receiveShadow = false;
    water.name = 'shenjiang-river'; water.userData.passable = true; water.userData.surfaceProcedural = true;
    scene.add(water);
    C.water = water;
  }

  // ------------------------------------------------------------- shoreline: wall, promenade, railing
  const bankWallList = [], promGB = new GB(), railList = [], buoyList = [];
  const bankEdges = [];
  for (const poly of WATER) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
      if (!IN(mx, mz, 40)) continue;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 0.05) continue;
      // normal on the land side: test both sides for water
      let nx = (b[1] - a[1]) / len, nz = -(b[0] - a[0]) / len;
      let landSign = 1;
      if (pointInWater(mx + nx * 3, mz + nz * 3) && !pointInWater(mx - nx * 3, mz - nz * 3)) landSign = -1;
      const e = { a, b, len, nx, nz, mx, mz, landSign, runs: [] };
      // The wall follows the bank in short pieces: one box round a long diagonal
      // edge would wall off the whole quay. It stops where the wharf deck takes over.
      const steps = Math.max(1, Math.ceil(len / 0.9));
      let run = null;
      for (let k = 0; k < steps; k++) {
        const f0 = k / steps, f1 = (k + 1) / steps;
        const px0 = lerp(a[0], b[0], f0), pz0 = lerp(a[1], b[1], f0), px1 = lerp(a[0], b[0], f1), pz1 = lerp(a[1], b[1], f1);
        if (inWharf((px0 + px1) / 2, (pz0 + pz1) / 2)) { run = null; continue; }
        if (!run) { run = [f0, f1]; e.runs.push(run); } else run[1] = f1;
        if (Math.max(px0, px1) > BOUNDS.x0 - 6) add({ x0: Math.min(px0, px1) - 0.3, x1: Math.max(px0, px1) + 0.3, z0: Math.min(pz0, pz1) - 0.3, z1: Math.max(pz0, pz1) + 0.3, y0: 0, y1: 1.2, kind: 'seawall' });
      }
      bankEdges.push(e);
      const ry = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (const [f0, f1] of e.runs) bankWallList.push({ geometry: boxGeo((f1 - f0) * len + 0.35, 0.74, 0.7, 4, 4), matrix: M4(lerp(a[0], b[0], (f0 + f1) / 2), 0.37, lerp(a[1], b[1], (f0 + f1) / 2), ry) });
    }
  }
  // promenade ribbon on the land side of the wall
  const promQuads = [];
  for (const e of bankEdges) {
    if (e.len < 1.2) continue;
    const s = e.landSign;
    const inner1 = 0.5, inner2 = 6.5;
    for (const [f0, f1] of e.runs) {
      const pa = [lerp(e.a[0], e.b[0], f0), lerp(e.a[1], e.b[1], f0)], pb = [lerp(e.a[0], e.b[0], f1), lerp(e.a[1], e.b[1], f1)];
      const ax = pa[0] + e.nx * s * inner1, az = pa[1] + e.nz * s * inner1;
      const bx = pb[0] + e.nx * s * inner1, bz = pb[1] + e.nz * s * inner1;
      const cx = pb[0] + e.nx * s * inner2, cz = pb[1] + e.nz * s * inner2;
      const dx = pa[0] + e.nx * s * inner2, dz = pa[1] + e.nz * s * inner2;
      if (pointInWater((ax + cx) / 2, (az + cz) / 2)) continue;
      promQuads.push({ geometry: new THREE.PlaneGeometry(1, 1), matrix: M4((ax + bx + cx + dx) / 4, 0.165, (az + bz + cz + dz) / 4), custom: [ax, az, bx, bz, cx, cz, dx, dz] });
    }
  }
  // custom promenade geometry (world-space UVs)
  if (promQuads.length) {
    const pos = [], nor = [], uv = [];
    for (const q of promQuads) {
      const [ax, az, bx, bz, cx, cz, dx, dz] = q.custom;
      const verts = [[ax, az], [bx, bz], [cx, cz], [dx, dz]];
      const order = [0, 3, 1, 1, 3, 2];
      for (const k of order) {
        const v = verts[k]; pos.push(v[0], 0.165, v[1]); nor.push(0, 1, 0); uv.push(v[0] / 6, v[1] / 6);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const prom = new THREE.Mesh(g, M.promenade);
    prom.name = 'riverside-promenade'; prom.userData.passable = true; prom.receiveShadow = true;
    scene.add(prom);
  }
  const quayMat = new THREE.MeshStandardMaterial({ color: 0x77736c, roughness: 0.78, metalness: 0.04, envMapIntensity: 1.1 });
  quayMat.userData.surfaceProcedural = true;
  const bankWall = new THREE.Mesh(mergeGeoms(bankWallList), quayMat);
  bankWall.name = 'shenjiang-seawall'; bankWall.userData.passable = true; bankWall.userData.surfaceProcedural = true; bankWall.receiveShadow = true;
  scene.add(bankWall);
  // railing posts + rails along the bank
  for (const e of bankEdges) {
    if (e.len <= 1.2) continue;
    const ry = -Math.atan2(e.b[1] - e.a[1], e.b[0] - e.a[0]);
    for (const [f0, f1] of e.runs) {
      const L = (f1 - f0) * e.len, fm = (f0 + f1) / 2;
      const cx = lerp(e.a[0], e.b[0], fm), cz = lerp(e.a[1], e.b[1], fm);
      railList.push({ geometry: boxGeo(L, 0.07, 0.09, 4, 1), matrix: M4(cx, 1.26, cz, ry) });
      railList.push({ geometry: boxGeo(L, 0.04, 0.04, 4, 1), matrix: M4(cx, 1.0, cz, ry) });
      const n = Math.max(1, Math.floor(L / 2.4));
      for (let k = 0; k <= n; k++) {
        const f = lerp(f0, f1, k / n);
        railList.push({ geometry: boxGeo(0.06, 0.52, 0.06, 1, 1), matrix: M4(lerp(e.a[0], e.b[0], f), 1.0, lerp(e.a[1], e.b[1], f), ry) });
      }
    }
  }
  const railMat = M.metal.clone(); railMat.vertexColors = true;
  addMerged('quay-railing', railList, railMat, { vertexColors: true, passable: true, colliderSource: 'railing', proc: true });
  // a continuous warm string of lights along the Shenjiang bank, read from the far side
  {
    const wl = [];
    for (const e of bankEdges) {
      const k = Math.max(1, Math.floor(e.len / 6.5));
      for (let i = 0; i < k; i++) {
        const f = (i + 0.5) / k;
        const x = lerp(e.a[0], e.b[0], f) + e.nx * e.landSign * 0.45;
        const z = lerp(e.a[1], e.b[1], f) + e.nz * e.landSign * 0.45;
        if (inWharf(x, z, 0.6)) continue;
        wl.push({ geometry: new THREE.SphereGeometry(0.12, 8, 6), matrix: M4(x, 0.9, z), color: new THREE.Color(4.2, 2.4, 1.1) });
      }
    }
    if (wl.length) {
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff });
      const cm = new THREE.Mesh(mergeGeoms(wl, { vertexColors: true }), mat);
      cm.name = 'riverfront-light-string'; cm.userData.passable = true; cm.userData.surfaceProcedural = true; scene.add(cm);
    }
  }


  // ------------------------------------------------------------- boundary
  // Where the map edge crosses the river it is a floating boom; where it
  // crosses land it is a lit construction hoarding. Every collider on the
  // edge has something you can see standing on it.
  const boomMat = new THREE.MeshStandardMaterial({ color: 0x9a2a24, roughness: 0.55, metalness: 0.1, emissive: 0x3a0806, emissiveIntensity: 0.6 });
  boomMat.userData.surfaceProcedural = true;
  function warnTex(t1, t2, bg, fg) {
    const c = makeCanvas(512, 256), ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = fg; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 246);
    ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 56px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'; ctx.fillText(t1, 256, 104);
    ctx.font = '600 24px "SF Mono",monospace'; ctx.fillText(t2, 256, 166);
    return canvasTexture(c, true, 1, 1, 4);
  }
  // hoarding panels: pale grey-green sheets with seams, a printed band and a skirt
  const hoardTex = (() => {
    const c = makeCanvas(256, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#7f8f88'; ctx.fillRect(0, 0, 256, 128);
    ctx.fillStyle = '#2f6b5a'; ctx.fillRect(0, 40, 256, 34);
    ctx.fillStyle = '#e8efe9'; ctx.font = '700 20px "PingFang SC","Hiragino Sans GB",sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('城市更新 · 施工中', 22, 58);
    ctx.fillStyle = '#3a3f42'; ctx.fillRect(0, 112, 256, 16);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; for (let x = 0; x < 256; x += 64) ctx.fillRect(x, 0, 2, 128);
    return canvasTexture(c, true, 1, 1, 4);
  })();
  const hoardMat = new THREE.MeshStandardMaterial({ map: hoardTex, roughness: 0.75, metalness: 0.1 });
  hoardMat.userData.surfaceProcedural = true;
  const signTex = warnTex('施工围挡', 'CONSTRUCTION · NO ENTRY', '#1a1a1c', '#e8b923');
  const closedTex = warnTex('道路封闭', 'ROAD CLOSED · 请绕行', '#a8231b', '#ffffff');
  const B0 = BOUNDS, edgeRuns = [];
  const bBuoys = [], bBooms = [], bHoard = [], bTape = [], bLamps = [], bSigns = [], bPosts = [];
  for (const [ax, az, bx, bz] of [[B0.x0, B0.z0, B0.x1, B0.z0], [B0.x1, B0.z0, B0.x1, B0.z1], [B0.x1, B0.z1, B0.x0, B0.z1], [B0.x0, B0.z1, B0.x0, B0.z0]]) {
    const len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 4), alongX = az === bz;
    const inX = alongX ? 0 : (ax === B0.x0 ? 1 : -1), inZ = alongX ? (az === B0.z0 ? 1 : -1) : 0;
    const runs = [];
    const PL = SITE.puxiLane;
    for (let k = 0; k < n; k++) {
      const f0 = k / n, f1 = (k + 1) / n, mx = lerp(ax, bx, (f0 + f1) / 2), mz = lerp(az, bz, (f0 + f1) / 2);
      const wet = pointInWater(mx, mz) ? 1 : (mx >= PL.x0 - 1 && mx <= PL.x1 && mz >= PL.z0 && mz <= PL.z1 + 1) ? 2 : 0;
      const last = runs[runs.length - 1];
      if (last && last.wet === wet) last.f1 = f1; else runs.push({ wet, f0, f1 });
    }
    for (const r of runs) {
      if (r.wet === 2) continue;   // the lane houses' own back walls stand on this stretch
      const x0 = lerp(ax, bx, r.f0), z0 = lerp(az, bz, r.f0), x1 = lerp(ax, bx, r.f1), z1 = lerp(az, bz, r.f1);
      const L = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ry = alongX ? 0 : Math.PI / 2;
      // on the river: a floating boom with lit buoys (it also closes the edge for anything that floats)
      if (r.wet) {
        add({ x0: Math.min(x0, x1) - 0.6, x1: Math.max(x0, x1) + 0.6, z0: Math.min(z0, z1) - 0.6, z1: Math.max(z0, z1) + 0.6, y0: 0, y1: 1.0, kind: 'boundary-boom' });
        const boom = new THREE.CylinderGeometry(0.32, 0.32, L, 12, 1); boom.rotateZ(Math.PI / 2);
        bBooms.push({ geometry: boom, matrix: M4(cx, 0.22, cz, ry) });
        const nb = Math.max(1, Math.round(L / 12));
        for (let k = 0; k <= nb; k++) {
          const bx2 = lerp(x0, x1, k / nb), bz2 = lerp(z0, z1, k / nb);
          bBuoys.push({ geometry: new THREE.CylinderGeometry(0.42, 0.55, 1.1, 14, 1), matrix: M4(bx2, 0.45, bz2) });
          bLamps.push({ geometry: new THREE.SphereGeometry(0.1, 10, 8), matrix: M4(bx2, 1.08, bz2) });
        }
        continue;
      }
      add({ x0: Math.min(x0, x1) - 0.6, x1: Math.max(x0, x1) + 0.6, z0: Math.min(z0, z1) - 0.6, z1: Math.max(z0, z1) + 0.6, y0: 0, y1: 3.3, kind: 'hoarding' });
      {
        edgeRuns.push({ alongX, v: alongX ? az : ax, a0: Math.min(alongX ? x0 : z0, alongX ? x1 : z1), a1: Math.max(alongX ? x0 : z0, alongX ? x1 : z1), inX, inZ });
        const panels = Math.max(1, Math.round(L / 2));
        const g = boxGeo(L, 3.2, 0.25, 1, 1);
        const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * panels / (L / 1));
        bHoard.push({ geometry: g, matrix: M4(cx, 1.6, cz, ry) });
        bTape.push({ geometry: boxGeo(L, 0.12, 0.3, 1, 1), matrix: M4(cx, 3.26, cz, ry) });
        const lamps = Math.max(1, Math.floor(L / 10));
        for (let k = 0; k <= lamps; k++) bLamps.push({ geometry: new THREE.SphereGeometry(0.11, 12, 8), matrix: M4(lerp(x0, x1, k / lamps) + inX * 0.2, 3.42, lerp(z0, z1, k / lamps) + inZ * 0.2) });
        for (let s = 30; s < L - 10; s += 90) {
          const f = s / L, sx = lerp(x0, x1, f) + inX * 0.16, sz = lerp(z0, z1, f) + inZ * 0.16;
          bSigns.push({ geometry: new THREE.PlaneGeometry(2.6, 1.3), matrix: M4(sx, 1.9, sz, Math.atan2(inX, inZ)) });
        }
      }
    }
  }
  C.boundaryRuns = edgeRuns;
  const tapeMat = new THREE.MeshStandardMaterial({ color: 0xe8b923, roughness: 0.6, emissive: 0x3a2a00, emissiveIntensity: 0.6 });
  const boundaryMesh = (name, list, mat) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeoms(list), mat); m.name = name; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); };
  boundaryMesh('river-boundary-boom', bBooms, boomMat);
  boundaryMesh('river-boundary-buoys', bBuoys, boomMat);
  boundaryMesh('construction-hoarding', bHoard, hoardMat);
  boundaryMesh('hoarding-tape', bTape, tapeMat);
  boundaryMesh('hoarding-lamps', bLamps, new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 0.35, 0.2) }));
  {
    const sm = new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.5, side: THREE.DoubleSide });
    sm.userData.surfaceProcedural = true;
    boundaryMesh('boundary-signs', bSigns, sm);
  }
  G.closedTex = closedTex;

  // ------------------------------------------------------------- road network (OSM)
  const ROADS = [];
  for (const a of OSM.r) {
    const n = a.length - 4;
    const width = a[n], name = a[n + 1], hw = a[n + 2], oneway = a[n + 3];
    const pts0 = parsePoly(a.slice(0, n));
    if (pts0.length < 2) continue;
    // the riverside service lane bends round the Harbour Plaza corner
    if (hw === 'service') for (const p of pts0) {
      if (p[0] - p[1] > -612) continue;
      const k = smoothstep(70, 28, Math.hypot(p[0] + 571, p[1] - 56)) * 4.8 * Math.SQRT1_2;
      p[0] += k; p[1] -= k;
    }
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (const p of pts0) { if (p[0] < minx) minx = p[0]; if (p[0] > maxx) maxx = p[0]; if (p[1] < minz) minz = p[1]; if (p[1] > maxz) maxz = p[1]; }
    if (!IN((minx + maxx) / 2, (minz + maxz) / 2, 420)) continue;
    // resample every 6 m so ribbons and lane paint stay smooth
    const pts = [];
    for (let i = 0; i < pts0.length - 1; i++) {
      const p = pts0[i], q = pts0[i + 1];
      const seg = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const k = Math.max(1, Math.ceil(seg / 6));
      for (let j = 0; j < k; j++) pts.push([lerp(p[0], q[0], j / k), lerp(p[1], q[1], j / k)]);
    }
    pts.push(pts0[pts0.length - 1]);
    const r = { id: 'r' + ROADS.length, name, hw, width, half: width / 2, samp: pts, oneway, closed: false };
    ROADS.push(r);
  }
  C.roads = ROADS;
  // roads that run into a land edge end at a line of water-filled barriers
  {
    const bars = [], stripes = [], signs = [], legs = [];
    for (const r of ROADS) {
      const s = r.samp;
      for (let i = 0; i < s.length - 1; i++) {
        const p = s[i], q = s[i + 1];
        for (const e of C.boundaryRuns) {
          const pv = e.alongX ? p[1] : p[0], qv = e.alongX ? q[1] : q[0];
          if ((pv - e.v) * (qv - e.v) > 0 || pv === qv) continue;
          const f = (e.v - pv) / (qv - pv), cross = e.alongX ? lerp(p[0], q[0], f) : lerp(p[1], q[1], f);
          if (cross < e.a0 || cross > e.a1) continue;
          const half = r.half + 0.6, cxw = e.alongX ? cross : e.v + e.inX * 3.2, czw = e.alongX ? e.v + e.inZ * 3.2 : cross;
          const n = Math.ceil(half * 2 / 1.6), ry = e.alongX ? 0 : Math.PI / 2;
          for (let k = 0; k < n; k++) {
            const t = -half + (k + 0.5) * (half * 2 / n), bx = e.alongX ? cxw + t : cxw, bz = e.alongX ? czw : czw + t;
            bars.push({ geometry: roundedBox(1.45, 0.82, 0.5, 0.08, 2), matrix: M4(bx, 0.41, bz, ry), color: k % 2 ? 0xf2f2ee : 0xc8261c });
            stripes.push({ geometry: boxGeo(1.46, 0.07, 0.51, 1, 1), matrix: M4(bx, 0.62, bz, ry) });
          }
          add({ x0: Math.min(cxw - (e.alongX ? half : 0.4), cxw + (e.alongX ? half : 0.4)), x1: Math.max(cxw - (e.alongX ? half : 0.4), cxw + (e.alongX ? half : 0.4)), z0: Math.min(czw - (e.alongX ? 0.4 : half), czw + (e.alongX ? 0.4 : half)), z1: Math.max(czw - (e.alongX ? 0.4 : half), czw + (e.alongX ? 0.4 : half)), y0: 0, y1: 0.82, kind: 'road-closed' });
          const sx = cxw + e.inX * 1.2, sz = czw + e.inZ * 1.2;
          signs.push({ geometry: new THREE.PlaneGeometry(1.8, 0.9), matrix: M4(sx, 1.35, sz, Math.atan2(e.inX, e.inZ)) });
          legs.push({ geometry: boxGeo(0.06, 1.0, 0.06, 1, 1), matrix: M4(sx - (e.alongX ? 0.8 : 0), 0.5, sz - (e.alongX ? 0 : 0.8)) });
          legs.push({ geometry: boxGeo(0.06, 1.0, 0.06, 1, 1), matrix: M4(sx + (e.alongX ? 0.8 : 0), 0.5, sz + (e.alongX ? 0 : 0.8)) });
        }
      }
    }
    if (bars.length) {
      const bm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.02 });
      addMerged('road-closed-barriers', bars, bm, { vertexColors: true, passable: true, colliderSource: 'road-closed', proc: true });
      addMerged('road-closed-reflectors', stripes, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.5) }), { passable: true, proc: true });
      const sm = new THREE.MeshStandardMaterial({ map: G.closedTex, emissiveMap: G.closedTex, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.5, side: THREE.DoubleSide });
      addMerged('road-closed-signs', signs, sm, { passable: true, proc: true });
      addMerged('road-closed-sign-legs', legs, M.metal, { passable: true, proc: true });
    }
  }  const NAME = (nm) => ROADS.filter((r) => r.name === nm);
  const biggest = (arr) => arr.reduce((a, b) => (!a || b.samp.length > a.samp.length ? b : a), null);
  C.named = {
    ring: biggest(NAME('临江嘴环路')) || biggest(NAME('临江嘴环岛')),
    millennium: biggest(NAME('千禧大道')),
    guanlan: biggest(NAME('观澜大道')),
    dongsheng: biggest(NAME('东晟路')),
    yinlan: biggest(NAME('银澜中路')),
    huaxi: biggest(NAME('花溪石桥路')),
    fuchuan: biggest(NAME('富川路')),
    shendong: biggest(NAME('申东南路')),
  };

  // road-space mask for intersection tests; only the widest 30 ways get a bit
  const MASK = { cell: 3, x0: BOUNDS.x0 - 30, z0: BOUNDS.z0 - 30, nx: Math.ceil((BOUNDS.x1 - BOUNDS.x0 + 60) / 3), nz: Math.ceil((BOUNDS.z1 - BOUNDS.z0 + 60) / 3), data: null };
  MASK.data = new Uint32Array(MASK.nx * MASK.nz);
  const bitRoads = ROADS.slice().sort((a, b) => b.width - a.width).slice(0, 30);
  bitRoads.forEach((r, i) => { r.bit = 1 << i; });
  function distSeg(px, pz, ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    let t = l2 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = clamp(t, 0, 1);
    return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
  }
  for (const r of bitRoads) {
    const s = r.samp, rad = r.half + 0.7;
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i], b = s[i + 1];
      const ix0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - rad - MASK.x0) / MASK.cell));
      const ix1 = Math.min(MASK.nx - 1, Math.ceil((Math.max(a[0], b[0]) + rad - MASK.x0) / MASK.cell));
      const iz0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - rad - MASK.z0) / MASK.cell));
      const iz1 = Math.min(MASK.nz - 1, Math.ceil((Math.max(a[1], b[1]) + rad - MASK.z0) / MASK.cell));
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        const cx = MASK.x0 + (ix + 0.5) * MASK.cell, cz = MASK.z0 + (iz + 0.5) * MASK.cell;
        if (distSeg(cx, cz, a[0], a[1], b[0], b[1]) <= rad) MASK.data[iz * MASK.nx + ix] |= r.bit;
      }
    }
  }
  function maskAt(x, z) { const ix = Math.floor((x - MASK.x0) / MASK.cell), iz = Math.floor((z - MASK.z0) / MASK.cell); if (ix < 0 || iz < 0 || ix >= MASK.nx || iz >= MASK.nz) return 0; return MASK.data[iz * MASK.nx + ix]; }
  C.maskAt = maskAt;
  const isCross = (x, z, r) => (maskAt(x, z) & ~(r.bit || 0)) !== 0;

  // ------------------------------------------------------------- road surfaces
  const asphaltGB = new GB(), walkGB = new GB(), curbGB = new GB(), whiteGB = new GB(), yellowGB = new GB();
  const white = new THREE.Color(0xd9d6ca), yellow = new THREE.Color(0xd0a144), grey = new THREE.Color(0x8a8a88);
  function addRibbon(builder, pts, off1, off2, y, tileU, tileV, color, skip) {
    const n = pts.length, normals = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
      let tx = p1[0] - p0[0], tz = p1[1] - p0[1];
      const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      normals.push([tz, -tx]);
    }
    let along = 0;
    for (let i = 0; i < n - 1; i++) {
      const p = pts[i], q = pts[i + 1], np = normals[i], nq = normals[i + 1];
      const a = [p[0] + np[0] * off1, y, p[1] + np[1] * off1];
      const b = [p[0] + np[0] * off2, y, p[1] + np[1] * off2];
      const c = [q[0] + nq[0] * off2, y, q[1] + nq[1] * off2];
      const d = [q[0] + nq[0] * off1, y, q[1] + nq[1] * off1];
      const mx = (a[0] + c[0]) / 2, mz = (a[2] + c[2]) / 2;
      const seg = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (skip && skip(mx, mz)) { along += seg; continue; }
      const u0 = along / tileU, u1 = (along + seg) / tileU;
      along += seg;
      builder.quad(a, b, c, d, [[u0, off1 / tileV], [u0, off2 / tileV], [u1, off2 / tileV], [u1, off1 / tileV]], color, [0, 1, 0]);
    }
  }
  function addWall(builder, a, b, y0, y1, tile, color, outward) {
    const p = [a[0], y0, a[1]], q = [b[0], y0, b[1]], r = [b[0], y1, b[1]], s = [a[0], y1, a[1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), u = len / tile;
    builder.quad(p, q, r, s, [[0, 0], [u, 0], [u, 1], [0, 1]], color, [outward[0], 0, outward[1]]);
  }
  for (const r of ROADS) {
    const s = r.samp;
    addRibbon(asphaltGB, s, -r.half, r.half, 0.02, 8, 8, grey);
    const sw = clamp(r.width * 0.22, 2.2, 6.5);
    for (const side of [-1, 1]) {
      addRibbon(walkGB, s, side * (r.half + 0.02), side * (r.half + sw), 0.16, 6, 6, new THREE.Color(0x8e8a83),
        (x, z) => isCross(x, z, r));
    }
    if (r.width >= 9) {
      addRibbon(whiteGB, s, -r.half + 0.45, -r.half + 0.62, 0.045, 8, 8, white, (x, z) => isCross(x, z, r));
      addRibbon(whiteGB, s, r.half - 0.62, r.half - 0.45, 0.045, 8, 8, white, (x, z) => isCross(x, z, r));
    }
    if (r.width >= 12) {
      addRibbon(yellowGB, s, -0.32, -0.16, 0.046, 8, 8, yellow, (x, z) => isCross(x, z, r));
      addRibbon(yellowGB, s, 0.16, 0.32, 0.046, 8, 8, yellow, (x, z) => isCross(x, z, r));
    }
  }
  // paved footpaths from OSM (promenades, plazas, park paths)
  for (const f of FOOT) {
    if (f.length < 2) continue;
    // only near the playable area, and only short enough to be a path not a boundary
    addRibbon(walkGB, f, -1.4, 1.4, 0.17, 4, 4, new THREE.Color(0x8f8b84));
  }
  // ================================================================ ROAD DETAIL
  // kerbs, gutters, lane dashes, crossings, arrows, bus lanes, puddles,
  // manholes, drains, tactile paving, signals, street-name signs, scooters.
  const gutterGB = new GB(), tactGB = new GB();
  const whiteY = 0.05;
  for (const r of ROADS) {
    if (!IN(r.samp[0][0], r.samp[0][1], 120) && !IN(r.samp[r.samp.length - 1][0], r.samp[r.samp.length - 1][1], 120)) continue;
    const s2 = r.samp, n2 = s2.length;
    for (const side of [-1, 1]) {
      const off = side * r.half;
      // gutter ribbon
      addRibbon(gutterGB, s2, side * (r.half - 0.45), off, 0.028, 6, 6, new THREE.Color(0x2f3133), (x, z) => isCross(x, z, r));
      // tactile strip just inside the kerb
      if (r.width >= 12) addRibbon(tactGB, s2, side * (r.half + 0.12), side * (r.half + 0.52), 0.166, 1.2, 1.2, new THREE.Color(0xffffff), (x, z) => isCross(x, z, r));
      for (let i = 0; i < n2 - 1; i++) {
        const a = s2[i], c = s2[i + 1];
        let tx = c[0] - a[0], tz = c[1] - a[1];
        const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        const nx = tz, nz = -tx;
        const pa = [a[0] + nx * off, a[1] + nz * off], pb = [c[0] + nx * off, c[1] + nz * off];
        if (isCross((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, r)) continue;
        addWall(curbGB, pa, pb, 0.02, 0.16, 4, new THREE.Color(0x8f8a80), [nx * side, nz * side]);
        addWall(curbGB, [pa[0] + nx * side * 0.22, pa[1] + nz * side * 0.22], [pb[0] + nx * side * 0.22, pb[1] + nz * side * 0.22], 0.16, 0.168, 4, new THREE.Color(0x9a958a), [0, 1]);
      }
    }
    // lane dashes
    if (r.width >= 9 && IN(r.samp[0][0], r.samp[0][1], 80)) {
      const lanes = Math.max(2, Math.round(r.width / 3.55));
      const laneW = r.width / lanes;
      for (let k = 1; k < lanes; k++) {
        const o = -r.half + k * laneW;
        if (Math.abs(o) < 0.9) continue;
        let along = 0;
        for (let i = 0; i < n2 - 1; i++) {
          const a = s2[i], c = s2[i + 1];
          const seg = Math.hypot(c[0] - a[0], c[1] - a[1]);
          let t = 0;
          while (t < seg) {
            const f0 = t / seg, f1 = Math.min(1, (t + 4.0) / seg);
            const u0 = along + t, u1 = along + t + 4.0;
            if (u0 % 9 < 4.0) {
              let tx = c[0] - a[0], tz = c[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
              const nx = tz, nz = -tx;
              const ax = lerp(a[0], c[0], f0) + nx * o, az = lerp(a[1], c[1], f0) + nz * o;
              const bx = lerp(a[0], c[0], f1) + nx * o, bz = lerp(a[1], c[1], f1) + nz * o;
              if (!isCross((ax + bx) / 2, (az + bz) / 2, r)) {
                const w = 0.14;
                whiteGB.quad([ax - nx * w, whiteY, az - nz * w], [ax + nx * w, whiteY, az + nz * w], [bx + nx * w, whiteY, bz + nz * w], [bx - nx * w, whiteY, bz - nz * w], [[0, 0], [0, 1], [1, 1], [1, 0]], new THREE.Color(0xe6e2d6), [0, 1, 0]);
              }
            }
            t += 9;
          }
          along += seg;
        }
      }
    }
  }
  // curbs/gutters/tactile meshes
  const curbMat2 = M.curb.clone(); curbMat2.vertexColors = true; curbMat2.side = THREE.DoubleSide;
  {
    const m = new THREE.Mesh(curbGB.build(true), curbMat2);
    m.name = 'osm-kerbs'; m.userData.passable = true; m.receiveShadow = true; m.userData.surfaceProcedural = true; scene.add(m);
  }
  const gutterMat = new THREE.MeshStandardMaterial({ color: 0x2c2e30, roughness: 0.55, metalness: 0.08, envMapIntensity: 1.4 });
  gutterMat.userData.surfaceProcedural = true;
  {
    const m = new THREE.Mesh(gutterGB.build(false), gutterMat);
    m.name = 'osm-gutters'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m);
  }
  {
    const c = makeCanvas(64, 64), ctx = c.getContext('2d');
    ctx.fillStyle = '#b28a24'; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#d9ae3a';
    for (let y = 4; y < 64; y += 12) for (let x = 4; x < 64; x += 12) ctx.fillRect(x, y, 5, 5);
    ctx.fillStyle = 'rgba(60,40,0,.25)'; for (let y = 0; y < 64; y += 12) ctx.fillRect(0, y, 64, 1);
    const tt = canvasTexture(c, true, 1, 1, 4);
    const tm = new THREE.MeshStandardMaterial({ map: tt, color: 0x8a6b24, roughness: 0.6, metalness: 0.02, emissive: 0x140e00, emissiveIntensity: 0.25 });
    tm.userData.surfaceProcedural = true;
    const m = new THREE.Mesh(tactGB.build(false), tm);
    m.name = 'osm-tactile-paving'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m);
  }

  // --- major intersections: crossings, stop lines, arrows, signals, signs
  const major = ROADS.filter((r) => r.width >= 13 && IN(r.samp[0][0], r.samp[0][1], 90));
  const crossings = [];
  for (let i = 0; i < major.length; i++) for (let j = i + 1; j < major.length; j++) {
    const A = major[i], B = major[j];
    let best = null;
    for (let ai = 0; ai < A.samp.length; ai += 2) for (let bi = 0; bi < B.samp.length; bi += 2) {
      const d = Math.hypot(A.samp[ai][0] - B.samp[bi][0], A.samp[ai][1] - B.samp[bi][1]);
      if (d < 7 && (!best || d < best.d)) best = { d, ai, bi };
    }
    if (!best) continue;
    const cx = (A.samp[best.ai][0] + B.samp[best.bi][0]) / 2, cz = (A.samp[best.ai][1] + B.samp[best.bi][1]) / 2;
    if (!IN(cx, cz, 20) || crossings.some((c) => Math.hypot(c.x - cx, c.z - cz) < 26)) continue;
    const ai2 = Math.min(A.samp.length - 2, best.ai), bi2 = Math.min(B.samp.length - 2, best.bi);
    let adx = A.samp[ai2 + 1][0] - A.samp[ai2][0], adz = A.samp[ai2 + 1][1] - A.samp[ai2][1];
    let bdx = B.samp[bi2 + 1][0] - B.samp[bi2][0], bdz = B.samp[bi2 + 1][1] - B.samp[bi2][1];
    const al = Math.hypot(adx, adz) || 1, bl = Math.hypot(bdx, bdz) || 1;
    adx /= al; adz /= al; bdx /= bl; bdz /= bl;
    crossings.push({ x: cx, z: cz, A, B, adx, adz, bdx, bdz });
  }
  crossings.sort((p, q) => Math.hypot(p.x - C.start[0], p.z - C.start[1]) - Math.hypot(q.x - C.start[0], q.z - C.start[1]));
  const chosen = crossings.slice(0, 12);
  const arrowPlanes = [], busTextPlanes = [], signalPoles = [], signalHeads = [], roadSigns = [];
  const roadNames = ['千禧大道', '临江嘴环路', '观澜大道', '银澜中路', '东晟路', '申东南路', '花溪石桥路', '富川路'];
  const roadNameCell = (nm) => { const i = roadNames.indexOf(nm); return i >= 0 ? i : 0; };
  const lampPts = [];               // every signal lamp, drawn as one instanced mesh
  const rightOf = (hx, hz) => [-hz, hx];
  C.signals = [];
  function addStopAndZebra(sig, R, O, dx, dz) {
    const nx = dz, nz = -dx;
    const dist = O.half + 2.6;
    for (let k = 0; k < 6; k++) {
      const off = dist + k * 1.15;
      const px = sig.x + dx * off, pz = sig.z + dz * off;
      const ax = px - nx * (R.half - 0.45), az = pz - nz * (R.half - 0.45);
      const bx = px + nx * (R.half - 0.45), bz = pz + nz * (R.half - 0.45);
      const w = 0.28;
      whiteGB.quad([ax - dx * w, whiteY, az - dz * w], [ax + dx * w, whiteY, az + dz * w], [bx + dx * w, whiteY, bz + dz * w], [bx - dx * w, whiteY, bz - dz * w], [[0, 0], [0, 1], [1, 1], [1, 0]], new THREE.Color(0xe9e5d8), [0, 1, 0]);
    }
    const so = dist + 8.2;
    const sx = sig.x + dx * so, sz = sig.z + dz * so;
    whiteGB.quad([sx - nx * (R.half - 0.4) - dx * 0.25, whiteY, sz - nz * (R.half - 0.4) - dz * 0.25], [sx - nx * (R.half - 0.4) + dx * 0.25, whiteY, sz - nz * (R.half - 0.4) + dz * 0.25], [sx + nx * (R.half - 0.4) + dx * 0.25, whiteY, sz + nz * (R.half - 0.4) + dz * 0.25], [sx + nx * (R.half - 0.4) - dx * 0.25, whiteY, sz + nz * (R.half - 0.4) - dz * 0.25], [[0, 0], [0, 1], [1, 1], [1, 0]], new THREE.Color(0xe9e5d8), [0, 1, 0]);
    for (const lo of [-R.half * 0.34, R.half * 0.34]) {
      const px2 = sig.x + dx * (dist + 11) + nx * lo, pz2 = sig.z + dz * (dist + 11) + nz * lo;
      arrowPlanes.push({ geometry: new THREE.PlaneGeometry(1.15, 3.1), matrix: M4(px2, 0.052, pz2, Math.atan2(dx, dz), -Math.PI / 2) });
    }
    return { sx, sz };
  }
  function addSignalPole(sig, R, dx, dz, axis, stopX, stopZ) {
    const hx = -dx, hz = -dz;               // traffic on this approach heads for the centre
    const [rx, rz] = rightOf(hx, hz);
    const px = stopX + rx * (R.half + 1.5), pz = stopZ + rz * (R.half + 1.5);
    const ap = { hx, hz, axis, stopX, stopZ, lamps: null, pole: null, ped: null };
    if (!IN(px, pz, 4)) { sig.approaches.push(ap); return; }
    const headRy = Math.atan2(dx, dz);      // signal face looks back at the drivers
    signalPoles.push({ geometry: new THREE.CylinderGeometry(0.1, 0.14, 6.0, 32), matrix: M4(px, 3.0, pz) });
    signalPoles.push({ geometry: boxGeo(0.09, 0.09, 2.3, 1, 1), matrix: M4(px - dx * 1.05, 5.92, pz - dz * 1.05, headRy) });
    signalHeads.push({ geometry: boxGeo(0.38, 1.05, 0.22, 1, 1), matrix: M4(px - dx * 2.0, 5.35, pz - dz * 2.0, headRy) });
    const lx = px - dx * 1.87, lz = pz - dz * 1.87;
    ap.lamps = { r: lampPts.length, y: lampPts.length + 1, g: lampPts.length + 2 };
    lampPts.push({ x: lx, y: 5.68, z: lz, s: 1 }, { x: lx, y: 5.35, z: lz, s: 1 }, { x: lx, y: 5.02, z: lz, s: 1 });
    ap.pole = { x: px, z: pz, ry: headRy };
    add({ x0: px - 0.22, x1: px + 0.22, z0: pz - 0.22, z1: pz + 0.22, y0: 0, y1: 3, kind: 'signal' });
    // pedestrian lamps mounted on the same pole, facing the zebra
    const nx = dz, nz = -dx;
    signalHeads.push({ geometry: boxGeo(0.24, 0.52, 0.2, 1, 1), matrix: M4(px, 2.95, pz, Math.atan2(nx, nz)) });
    ap.ped = { x: px, z: pz, dx: nx, dz: nz, roadAxis: axis, lamps: { w: lampPts.length, d: lampPts.length + 1 }, state: 'dont' };
    lampPts.push({ x: px + nx * 0.13, y: 3.08, z: pz + nz * 0.13, s: 0.72 }, { x: px + nx * 0.13, y: 2.84, z: pz + nz * 0.13, s: 0.72 });
    sig.peds.push(ap.ped);
    sig.approaches.push(ap);
  }
  for (let ci = 0; ci < chosen.length; ci++) {
    const c = chosen[ci];
    const sig = { id: 'sig' + ci, x: c.x, z: c.z, axes: [{ dx: c.adx, dz: c.adz }, { dx: c.bdx, dz: c.bdz }], approaches: [], peds: [], cycle: 44 + (ci % 3) * 4, offset: (ci * 7.31) % 40, s0: null, s1: null };
    const s1 = addStopAndZebra(sig, c.A, c.B, c.adx, c.adz); addSignalPole(sig, c.A, c.adx, c.adz, 0, s1.sx, s1.sz);
    const s2 = addStopAndZebra(sig, c.A, c.B, -c.adx, -c.adz); addSignalPole(sig, c.A, -c.adx, -c.adz, 0, s2.sx, s2.sz);
    const s3 = addStopAndZebra(sig, c.B, c.A, c.bdx, c.bdz); addSignalPole(sig, c.B, c.bdx, c.bdz, 1, s3.sx, s3.sz);
    const s4 = addStopAndZebra(sig, c.B, c.A, -c.bdx, -c.bdz); addSignalPole(sig, c.B, -c.bdx, -c.bdz, 1, s4.sx, s4.sz);
    const pa = sig.approaches[0], pb = sig.approaches[2];
    if (pa && pa.pole) roadSigns.push({ geometry: new THREE.PlaneGeometry(2.1, 0.52), matrix: M4(pa.pole.x, 3.65, pa.pole.z, pa.pole.ry + Math.PI / 2), cell: roadNameCell(c.A.name) });
    if (pb && pb.pole) roadSigns.push({ geometry: new THREE.PlaneGeometry(2.1, 0.52), matrix: M4(pb.pole.x, 3.65, pb.pole.z, pb.pole.ry + Math.PI / 2), cell: roadNameCell(c.B.name) });
    C.signals.push(sig);
  }
  // a signalised mid-block zebra near the opening
  {
    let best = null;
    for (const r of ROADS) {
      if (r.width < 9) continue;
      for (let i = 1; i < r.samp.length - 1; i++) {
        const d = Math.hypot(r.samp[i][0] - C.start[0], r.samp[i][1] - C.start[1]);
        if (!best || d < best.d) best = { d, r, i };
      }
    }
    if (best) {
      const R = best.r, p0 = R.samp[best.i], p1 = R.samp[Math.min(R.samp.length - 1, best.i + 1)];
      let tx = p1[0] - p0[0], tz = p1[1] - p0[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const nx = tz, nz = -tx;
      for (const sgn of [1, -1]) {
        const cx = p0[0] + tx * sgn * 14, cz = p0[1] + tz * sgn * 14;
        if (!IN(cx, cz) || isCross(cx, cz, R)) continue;
        for (let k = 0; k < 7; k++) {
          const off = (k - 3) * 1.05;
          const px = cx + tx * off, pz = cz + tz * off;
          const ax = px - nx * (R.half - 0.5), az = pz - nz * (R.half - 0.5);
          const bx = px + nx * (R.half - 0.5), bz = pz + nz * (R.half - 0.5);
          const w = 0.32;
          whiteGB.quad([ax - tx * w, whiteY, az - tz * w], [ax + tx * w, whiteY, az + tz * w], [bx + tx * w, whiteY, bz + tz * w], [bx - tx * w, whiteY, bz - tz * w], [[0, 0], [0, 1], [1, 1], [1, 0]], new THREE.Color(0xe9e5d8), [0, 1, 0]);
        }
        const sig = { id: 'mid' + C.signals.length, x: cx, z: cz, axes: [{ dx: tx, dz: tz }], approaches: [], peds: [], cycle: 50, offset: 17, middle: true, s0: null, s1: null };
        for (const hd of [1, -1]) {
          const hx = tx * hd, hz = tz * hd;
          const stopX = cx - hx * 7.5, stopZ = cz - hz * 7.5;
          whiteGB.quad([stopX - nx * (R.half - 0.45) - hx * 0.24, whiteY, stopZ - nz * (R.half - 0.45) - hz * 0.24], [stopX - nx * (R.half - 0.45) + hx * 0.24, whiteY, stopZ - nz * (R.half - 0.45) + hz * 0.24], [stopX + nx * (R.half - 0.45) + hx * 0.24, whiteY, stopZ + nz * (R.half - 0.45) + hz * 0.24], [stopX + nx * (R.half - 0.45) - hx * 0.24, whiteY, stopZ + nz * (R.half - 0.45) - hz * 0.24], [[0, 0], [0, 1], [1, 1], [1, 0]], new THREE.Color(0xe9e5d8), [0, 1, 0]);
          for (const lo of [-R.half * 0.35, R.half * 0.35]) {
            const apx = stopX - hx * 3.5 + nx * lo, apz = stopZ - hz * 3.5 + nz * lo;
            arrowPlanes.push({ geometry: new THREE.PlaneGeometry(1.15, 3.1), matrix: M4(apx, 0.052, apz, Math.atan2(hx, hz), -Math.PI / 2) });
          }
          const [rx, rz] = rightOf(hx, hz);
          const px = stopX + rx * (R.half + 1.4), pz = stopZ + rz * (R.half + 1.4);
          const ap = { hx, hz, axis: 0, stopX, stopZ, lamps: null, pole: null, ped: null };
          if (IN(px, pz, 4)) {
            const headRy = Math.atan2(-hx, -hz);
            signalPoles.push({ geometry: new THREE.CylinderGeometry(0.09, 0.12, 5.6, 32), matrix: M4(px, 2.8, pz) });
            signalHeads.push({ geometry: boxGeo(0.34, 0.92, 0.3, 1, 1), matrix: M4(px, 5.2, pz, headRy) });
            ap.lamps = { r: lampPts.length, y: lampPts.length + 1, g: lampPts.length + 2 };
            lampPts.push({ x: px - hx * 0.16, y: 5.42, z: pz - hz * 0.16, s: 1 }, { x: px - hx * 0.16, y: 5.2, z: pz - hz * 0.16, s: 1 }, { x: px - hx * 0.16, y: 4.98, z: pz - hz * 0.16, s: 1 });
            ap.pole = { x: px, z: pz, ry: headRy };
            add({ x0: px - 0.2, x1: px + 0.2, z0: pz - 0.2, z1: pz + 0.2, y0: 0, y1: 3, kind: 'signal' });
            signalHeads.push({ geometry: boxGeo(0.24, 0.52, 0.2, 1, 1), matrix: M4(px, 2.85, pz, Math.atan2(nx, nz)) });
            ap.ped = { x: px, z: pz, dx: nx, dz: nz, roadAxis: 0, lamps: { w: lampPts.length, d: lampPts.length + 1 }, state: 'dont' };
            lampPts.push({ x: px + nx * 0.13, y: 2.98, z: pz + nz * 0.13, s: 0.72 }, { x: px + nx * 0.13, y: 2.74, z: pz + nz * 0.13, s: 0.72 });
            sig.peds.push(ap.ped);
          }
          sig.approaches.push(ap);
        }
        const ap0 = sig.approaches.find((a) => a.pole);
        if (ap0) roadSigns.push({ geometry: new THREE.PlaneGeometry(1.7, 0.45), matrix: M4(ap0.pole.x, 2.75, ap0.pole.z, ap0.pole.ry + Math.PI / 2), cell: roadNameCell(R.name) });
        C.signals.push(sig);
      }
    }
  }
  // arrow decal texture
  {
    const c = makeCanvas(128, 256), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 256);
    ctx.fillStyle = 'rgba(238,234,220,.92)';
    ctx.fillRect(52, 92, 24, 140);
    ctx.beginPath(); ctx.moveTo(64, 16); ctx.lineTo(112, 104); ctx.lineTo(80, 104); ctx.lineTo(80, 130); ctx.lineTo(48, 130); ctx.lineTo(48, 104); ctx.lineTo(16, 104); ctx.closePath(); ctx.fill();
    const at = canvasTexture(c, true, 1, 1, 4);
    const am = new THREE.MeshStandardMaterial({ map: at, transparent: true, alphaTest: 0.2, roughness: 0.45, metalness: 0.0, color: 0xffffff, emissive: 0x2a281f, emissiveIntensity: 0.4, depthWrite: false });
    am.userData.surfaceProcedural = true;
    const amesh = new THREE.Mesh(mergeGeoms(arrowPlanes), am);
    amesh.name = 'road-direction-arrows'; amesh.userData.passable = true; amesh.renderOrder = 2; scene.add(amesh);
  }
  // signals + signs
  const poleMetal = M.darkMetal.clone();
  const poles2 = new THREE.Mesh(mergeGeoms(signalPoles), poleMetal); poles2.name = 'traffic-signal-poles'; poles2.userData.passable = true; poles2.userData.surfaceProcedural = true; scene.add(poles2);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x17191b, roughness: 0.5, metalness: 0.4 });
  headMat.userData.surfaceProcedural = true;
  const heads2 = new THREE.Mesh(mergeGeoms(signalHeads), headMat); heads2.name = 'traffic-signal-heads'; heads2.userData.passable = true; heads2.userData.surfaceProcedural = true; scene.add(heads2);
  const sigLamps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), Math.max(1, lampPts.length));
  for (let i = 0; i < lampPts.length; i++) {
    sigLamps.setMatrixAt(i, M4(lampPts[i].x, lampPts[i].y, lampPts[i].z, 0, 0, 0, lampPts[i].s, lampPts[i].s, lampPts[i].s));
    sigLamps.setColorAt(i, new THREE.Color(0.06, 0.065, 0.075));
  }
  sigLamps.name = 'traffic-signal-lamps'; sigLamps.userData.passable = true; sigLamps.userData.surfaceProcedural = true; sigLamps.frustumCulled = false;
  scene.add(sigLamps);
  {
    const OFF = new THREE.Color(0.06, 0.065, 0.075);
    const ON = { red: new THREE.Color(2.6, 0.16, 0.1), yellow: new THREE.Color(2.2, 1.25, 0.12), green: new THREE.Color(0.12, 2.1, 0.55), walk: new THREE.Color(0.15, 2.0, 0.7), dont: new THREE.Color(2.3, 0.22, 0.12) };
    // per axis: green, 3 s yellow, then red; 1.5 s all-red between the two axes
    const axisState = (sig, axis, t) => {
      const T = sig.cycle, half = T / 2;
      const ph = (((t + sig.offset) % T) + T) % T;
      const local = axis === 0 ? ph : (((ph - half) % T) + T) % T;
      return local < half - 4.5 ? 'green' : local < half - 1.5 ? 'yellow' : 'red';
    };
    C.updateSignals = (t) => {
      for (const sig of C.signals) {
        const st0 = axisState(sig, 0, t);
        const st1 = sig.axes.length > 1 ? axisState(sig, 1, t) : (st0 === 'green' ? 'red' : 'green');
        sig.s0 = st0; sig.s1 = st1;
        for (const ap of sig.approaches) {
          const st = ap.axis === 0 ? st0 : st1;
          ap.state = st;
          if (!ap.lamps) continue;
          sigLamps.setColorAt(ap.lamps.r, st === 'red' ? ON.red : OFF);
          sigLamps.setColorAt(ap.lamps.y, st === 'yellow' ? ON.yellow : OFF);
          sigLamps.setColorAt(ap.lamps.g, st === 'green' ? ON.green : OFF);
          if (ap.ped) {
            const walk = sig.middle ? st === 'red' : (ap.axis === 0 ? st1 : st0) === 'green';
            ap.ped.state = walk ? 'walk' : 'dont';
            sigLamps.setColorAt(ap.ped.lamps.w, walk ? ON.walk : OFF);
            sigLamps.setColorAt(ap.ped.lamps.d, walk ? OFF : ON.dont);
          }
        }
      }
      if (sigLamps.instanceColor) sigLamps.instanceColor.needsUpdate = true;
    };
    // the signal a vehicle at (x,z) heading (dirx,dirz) is driving up to
    C.signalAt = (x, z, dirx, dirz, range = 60) => {
      const l = Math.hypot(dirx, dirz) || 1; dirx /= l; dirz /= l;
      let best = null;
      for (const sig of C.signals) {
        if (Math.abs(sig.x - x) > range + 40 || Math.abs(sig.z - z) > range + 40) continue;
        for (const ap of sig.approaches) {
          const dx = ap.stopX - x, dz = ap.stopZ - z;
          const along = dx * dirx + dz * dirz;
          if (along < -1 || along > range) continue;
          if (Math.abs(dx * dirz - dz * dirx) > 9) continue;
          if (ap.hx * dirx + ap.hz * dirz < 0.6) continue;
          if (!best || along < best.dist) best = { id: sig.id + ':' + sig.approaches.indexOf(ap), state: ap.state || 'red', dist: along, stopX: ap.stopX, stopZ: ap.stopZ };
        }
      }
      return best;
    };
    C.pedSignalAt = (x, z) => {
      let best = null, bd = 1e9;
      for (const sig of C.signals) for (const ped of sig.peds) {
        const d = Math.hypot(ped.x - x, ped.z - z);
        if (d < 25 && d < bd) { bd = d; best = ped; }
      }
      return best ? { state: best.state, x: best.x, z: best.z } : null;
    };
    C.updateSignals(0);
  }  // street name atlas 4x2
  {
    const W2 = 1024, H2 = 256, c = makeCanvas(W2, H2), ctx = c.getContext('2d');
    ctx.fillStyle = '#0d1420'; ctx.fillRect(0, 0, W2, H2);
    for (let i = 0; i < 8; i++) {
      const cx = (i % 4) * 256, cy = Math.floor(i / 4) * 128;
      ctx.fillStyle = '#16324d'; ctx.fillRect(cx + 4, cy + 4, 248, 120);
      ctx.strokeStyle = '#c9d6e2'; ctx.lineWidth = 3; ctx.strokeRect(cx + 8, cy + 8, 240, 112);
      ctx.fillStyle = '#f2f7fb'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 44px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
      ctx.fillText(roadNames[i], cx + 128, cy + 56);
      ctx.font = '500 16px "SF Mono",monospace'; ctx.fillStyle = '#9fc6e8';
      ctx.fillText('LINJIANGZUI', cx + 128, cy + 94);
    }
    const st = canvasTexture(c, true, 1, 1, 8);
    const sm = new THREE.MeshStandardMaterial({ map: st, roughness: 0.5, metalness: 0.1, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 0.35 });
    sm.userData.surfaceProcedural = true;
    for (const rs of roadSigns) {
      const g = rs.geometry; const uv = g.attributes.uv; const cell = rs.cell;
      const cx = cell % 4, cy = Math.floor(cell / 4);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (cx + uv.getX(i)) / 4, 1 - (cy + 1 - uv.getY(i)) / 2);
      rs.geometry = g;
    }
    const signs = new THREE.Mesh(mergeGeoms(roadSigns), sm); signs.name = 'street-name-signs'; signs.userData.passable = true; signs.userData.surfaceProcedural = true; scene.add(signs);
  }
  // bus lanes on the widest streets + road text
  {
    const busGB = new GB();
    for (const r of ROADS) {
      if (r.width < 22 || !IN(r.samp[0][0], r.samp[0][1], 120)) continue;
      addRibbon(busGB, r.samp, r.half - 3.6, r.half - 1.0, 0.032, 6, 6, new THREE.Color(0x5a211b), (x, z) => isCross(x, z, r));
      let along = 0;
      for (let i = 0; i < r.samp.length - 1; i++) {
        const a = r.samp[i], c = r.samp[i + 1];
        const seg = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (seg > 0) {
          const bx = (a[0] + c[0]) / 2 + (r.half - 2.3) * ((c[1] - a[1]) / seg) * -1, bz = (a[1] + c[1]) / 2 + (r.half - 2.3) * ((c[0] - a[0]) / seg);
          if (along % 58 < seg && !isCross(bx, bz, r)) busTextPlanes.push({ geometry: new THREE.PlaneGeometry(6.4, 1.5), matrix: M4(bx, 0.055, bz, Math.atan2(c[0] - a[0], c[1] - a[1]), -Math.PI / 2) });
        }
        along += seg;
      }
    }
    const bm = new THREE.MeshStandardMaterial({ color: 0x52201b, roughness: 0.55, metalness: 0.05, envMapIntensity: 1.2 });
    bm.userData.surfaceProcedural = true;
    const bMesh = new THREE.Mesh(busGB.build(false), bm); bMesh.name = 'bus-lane-red'; bMesh.userData.passable = true; bMesh.userData.surfaceProcedural = true; bMesh.renderOrder = 1; scene.add(bMesh);
    const c = makeCanvas(512, 128), ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(245,240,225,.9)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 48px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.fillText('公交专用', 256, 42);
    ctx.font = '600 24px "SF Mono",monospace'; ctx.fillText('BUS ONLY', 256, 92);
    const bt = canvasTexture(c, true, 1, 1, 4);
    const btm = new THREE.MeshStandardMaterial({ map: bt, transparent: true, alphaTest: 0.1, roughness: 0.5, emissive: 0x2a241c, emissiveIntensity: 0.35, depthWrite: false });
    btm.userData.surfaceProcedural = true;
    if (busTextPlanes.length) {
      const btMesh = new THREE.Mesh(mergeGeoms(busTextPlanes), btm); btMesh.name = 'bus-lane-text'; btMesh.userData.passable = true; btMesh.renderOrder = 2; scene.add(btMesh);
    }
  }
  // puddles (reflective clones of the wet asphalt)
  {
    const pud = M.asphalt.clone();
    pud.color = new THREE.Color(0x0b1014); pud.roughness = 0.05; pud.metalness = 0.45;
    pud.normalMap = TEX.waterN; pud.normalScale = new THREE.Vector2(1.1, 1.1);
    pud.customProgramCacheKey = () => 'linjiangzui-puddle-1';
    pud.userData.surfaceProcedural = true;
    const list = [];
    for (let i = 0; i < 42; i++) {
      const r = pick(ROADS);
      if (r.width < 8 || !IN(r.samp[0][0], r.samp[0][1], 80)) continue;
      const p = r.samp[Math.floor(R(0, r.samp.length - 1))];
      const side = R(0, 1) < 0.5 ? -1 : 1;
      const x = p[0] + side * R(0.8, Math.max(1.2, r.half - 1.2)), z = p[1] + R(-1, 1);
      if (isCross(x, z, r)) continue;
      const g = new THREE.CircleGeometry(1, 24);
      g.rotateX(-Math.PI / 2);
      list.push({ geometry: g, matrix: M4(x, 0.046, z, R(0, 6.28), 0, 0, R(1.2, 4.2), 1, R(0.7, 2.4)) });
    }
    if (list.length) {
      const pm = new THREE.Mesh(mergeGeoms(list), pud); pm.name = 'road-puddles'; pm.userData.passable = true; pm.userData.surfaceProcedural = true; pm.renderOrder = 1; scene.add(pm);
    }
  }
  // manholes, drains, utility covers
  {
    const mh = [], dr = [];
    for (let i = 0; i < 46; i++) {
      const r = pick(ROADS);
      if (!IN(r.samp[0][0], r.samp[0][1], 100)) continue;
      const p = r.samp[Math.floor(R(0, r.samp.length - 1))];
      const side = R(0, 1) < 0.5 ? -1 : 1;
      const x = p[0] + side * R(0, r.half * 0.6), z = p[1] + R(-1.4, 1.4);
      if (isCross(x, z, r)) continue;
      mh.push({ geometry: new THREE.CylinderGeometry(0.34, 0.34, 0.025, 32), matrix: M4(x, 0.052, z) });
    }
    for (let i = 0; i < 40; i++) {
      const r = pick(ROADS);
      if (r.width < 9 || !IN(r.samp[0][0], r.samp[0][1], 100)) continue;
      const p = r.samp[Math.floor(R(0, r.samp.length - 1))];
      const side = R(0, 1) < 0.5 ? -1 : 1;
      const x = p[0] + side * (r.half - 0.15), z = p[1] + R(-1, 1);
      dr.push({ geometry: boxGeo(0.55, 0.02, 0.8, 1, 1), matrix: M4(x, 0.042, z, R(-0.02, 0.02)) });
    }
    const mm = new THREE.MeshStandardMaterial({ color: 0x16181a, roughness: 0.55, metalness: 0.55, envMapIntensity: 1.1 }); mm.userData.surfaceProcedural = true;
    if (mh.length) { const m = new THREE.Mesh(mergeGeoms(mh), mm); m.name = 'road-manholes'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); }
    if (dr.length) { const m = new THREE.Mesh(mergeGeoms(dr), mm); m.name = 'gutter-drains'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); }
  }
  // parked e-bikes along these roads are built in 13c-puxi with the shared e-bike model


  const markMat = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xffffff, emissive: new THREE.Color(0x2a281f), emissiveIntensity: 0.7, roughness: 0.42, metalness: 0.0, envMapIntensity: 1.8 });
  markMat.userData.surfaceProcedural = true;
  const asphaltMesh = new THREE.Mesh(asphaltGB.build(false), M.asphalt);
  asphaltMesh.name = 'osm-road-asphalt'; asphaltMesh.userData.passable = true; asphaltMesh.userData.surfaceProcedural = true; asphaltMesh.receiveShadow = true;
  scene.add(asphaltMesh);
  const walkMesh = new THREE.Mesh(walkGB.build(false), M.sidewalk);
  walkMesh.name = 'osm-sidewalks-and-paths'; walkMesh.userData.passable = true; walkMesh.receiveShadow = true;
  scene.add(walkMesh);
  const whiteMesh = new THREE.Mesh(whiteGB.build(true), markMat);
  whiteMesh.name = 'road-markings-white'; whiteMesh.userData.passable = true; whiteMesh.renderOrder = 1; scene.add(whiteMesh);
  const yellowMesh = new THREE.Mesh(yellowGB.build(true), markMat);
  yellowMesh.name = 'road-markings-yellow'; yellowMesh.userData.passable = true; yellowMesh.renderOrder = 1; scene.add(yellowMesh);

  // sodium spill along the named streets
  const glowList = [];
  for (const r of ROADS) {
    if (r.width < 9 || !r.name) continue;
    const s = r.samp;
    let acc = 0;
    for (let i = 0; i < s.length - 1; i++) {
      const p = s[i], q = s[i + 1];
      const seg = Math.hypot(q[0] - p[0], q[1] - p[1]);
      for (let t = 0; t < seg; t += 18) {
        const f = t / seg;
        const x = lerp(p[0], q[0], f), z = lerp(p[1], q[1], f);
        if (!IN(x, z, 20)) continue;
        const w = r.width + 6;
        glowList.push({ geometry: new THREE.PlaneGeometry(w, w * 0.65), matrix: M4(x, 0.055, z, 0, -Math.PI / 2) });
      }
      acc += seg;
    }
    void acc;
  }
  const glowMat = new THREE.MeshBasicMaterial({ map: TEX.glow, color: new THREE.Color(1.55, 1.0, 0.62), transparent: true, opacity: 0.10, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const roadGlow = new THREE.Mesh(mergeGeoms(glowList), glowMat);
  roadGlow.name = 'road-light-spill'; roadGlow.userData.passable = true; roadGlow.renderOrder = 2; scene.add(roadGlow);
  G.noReflect.push(roadGlow);

  // ------------------------------------------------------------- buildings from OSM
  // Walls go to the procedural facade shader (01-facade): uv = (bay, storey),
  // so windows, rooms and architectural lighting are resolved per pixel.
  const FX = { glass: new G.FacadeGB(), panel: new G.FacadeGB(), stone: new G.FacadeGB(), lantan: new G.FacadeGB() };
  const STYLE_P = {
    glass: { fh: 4.0, bay: 1.6, gh: 5.4 },
    panel: { fh: 3.8, bay: 3.0, gh: 5.0 },
    stone: { fh: 3.05, bay: 3.3, gh: 3.4 },
    lantan: { fh: 4.4, bay: 3.4, gh: 5.2 },
  };
  const SHOP_BAY = 3.1;
  const signList = [], beaconList = [], crownList = [], awningList = [], balconyList = [], balRailList = [], acList = [], canopyList = [], mechList = [], shopGlowList = [];
  const buildingBoxes = [];
  const TINT = (style) => style === 'glass' ? new THREE.Color(0.80 + R(0, 0.20), 0.88 + R(0, 0.12), 0.94 + R(0, 0.08))
    : style === 'lantan' ? new THREE.Color(1.0, 0.95, 0.88)
    : style === 'panel' ? new THREE.Color(0.82 + R(0, 0.18), 0.84 + R(0, 0.16), 0.86 + R(0, 0.14))
    : new THREE.Color(0.82 + R(0, 0.24), 0.78 + R(0, 0.22), 0.72 + R(0, 0.24));
  const LED_COL = (k) => (k < 0.3 ? [1, 0.66, 0.28] : k < 0.5 ? [0.25, 0.8, 1] : k < 0.7 ? [0.95, 0.97, 1] : [1, 0.3, 0.75]);
  // roofs, parapet tops and inner faces: free triangles with the winding fixed from the wanted normal
  const RB = { pos: [], nor: [], uv: [], col: [] };
  function rbTri(a, b, c, n, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const flip = (uy * vz - uz * vy) * n[0] + (uz * vx - ux * vz) * n[1] + (ux * vy - uy * vx) * n[2] < 0;
    for (const p of flip ? [a, c, b] : [a, b, c]) {
      RB.pos.push(p[0], p[1], p[2]); RB.nor.push(n[0], n[1], n[2]);
      RB.uv.push((p[0] + p[1] * 0.5) / 6, (p[2] + p[1] * 0.5) / 6); RB.col.push(col.r, col.g, col.b);
    }
  }
  const rbQuad = (a, b, c, d, n, col) => { rbTri(a, b, c, n, col); rbTri(a, c, d, n, col); };
  function cleanPoly(poly) {
    const out = [];
    for (const p of poly) { const q = out[out.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.05) out.push(p); }
    while (out.length > 2 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < 0.05) out.pop();
    return out;
  }
  function polyAreaAbs(poly) {
    let s = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p[0] * q[1] - q[0] * p[1]; }
    return Math.abs(s) / 2;
  }
  function centroid(poly) { let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; } return [x / poly.length, z / poly.length]; }
  function insetPoly(poly, k) {
    const [cx, cz] = centroid(poly);
    return poly.map((p) => [cx + (p[0] - cx) * k, cz + (p[1] - cz) * k]);
  }
  function inPoly(x, z, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j];
      if ((a[1] > z) !== (b[1] > z) && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  const ROOF_COL = new THREE.Color(0.30, 0.31, 0.33), COPING_COL = new THREE.Color(0.52, 0.52, 0.50), PARAPET_IN = new THREE.Color(0.24, 0.25, 0.26);
  function roofCap(poly, y) {
    let tris = [];
    try { tris = THREE.ShapeUtils.triangulateShape(poly.map((p) => new THREE.Vector2(p[0], -p[1])), []); } catch (e) { tris = []; }
    for (const t of tris) rbTri([poly[t[0]][0], y, poly[t[0]][1]], [poly[t[1]][0], y, poly[t[1]][1]], [poly[t[2]][0], y, poly[t[2]][1]], [0, 1, 0], ROOF_COL);
  }
  // one closed ring of wall quads; kindOf(i) picks the ground-floor treatment of edge i
  function wallRing(gb, poly, y0, y1, v0, v1, ch, tint, seed, litK, kindOf, led, topV, wash, bayOf) {
    const m = poly.length;
    let uOff = RI(0, 30) * 12;
    for (let i = 0; i < m; i++) {
      const a = poly[i], c = poly[(i + 1) % m];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 0.2) continue;
      let kind = kindOf(i);
      const bayW = bayOf(kind);
      if (len < bayW * 0.55) kind = 3;
      const bays = Math.max(1, Math.round(len / bayW));
      gb.wall(a, c, y0, y1, uOff, uOff + bays, v0, v1, tint, [seed, litK, kind, led], [len / bays, ch, topV, wash]);
      uOff += Math.ceil(bays / 12) * 12 + 12;
    }
  }
  function parapet(gb, poly, y, tint, seed, led, topV, wash) {
    const ph = 1.05;
    wallRing(gb, poly, y, y + ph, topV, topV + 1, ph, tint, seed, 0, () => 3, led, topV, wash, () => 3);
    const k = clamp(1 - 0.7 / Math.sqrt(Math.max(4, polyAreaAbs(poly))), 0.9, 0.992);
    const inner = insetPoly(poly, k);
    const m = poly.length;
    for (let i = 0; i < m; i++) {
      const ao = poly[i], co = poly[(i + 1) % m], ai = inner[i], ci = inner[(i + 1) % m];
      const len = Math.hypot(co[0] - ao[0], co[1] - ao[1]);
      if (len < 0.2) continue;
      const nx = (co[1] - ao[1]) / len, nz = -(co[0] - ao[0]) / len;
      rbQuad([ao[0], y + ph, ao[1]], [co[0], y + ph, co[1]], [ci[0], y + ph, ci[1]], [ai[0], y + ph, ai[1]], [0, 1, 0], COPING_COL);
      rbQuad([ai[0], y, ai[1]], [ci[0], y, ci[1]], [ci[0], y + ph, ci[1]], [ai[0], y + ph, ai[1]], [-nx, 0, -nz], PARAPET_IN);
    }
  }
  // plant on the roof: lift overrun, chillers with fans, a water tank, mast and beacon
  function rooftop(poly, y, area, residential, ry) {
    const core = insetPoly(poly, 0.55);
    const [cx, cz] = centroid(poly);
    const s = clamp(Math.sqrt(area) * 0.2, 2.2, 9);
    const hasCore = inPoly(cx, cz, core);
    if (hasCore) {
      mechList.push({ geometry: boxGeo(s, 3.1, s * 0.7, 3, 3), matrix: M4(cx, y + 1.55, cz, ry), color: new THREE.Color(0.36, 0.36, 0.37) });
      mechList.push({ geometry: boxGeo(s + 0.3, 0.16, s * 0.7 + 0.3, 3, 3), matrix: M4(cx, y + 3.18, cz, ry), color: new THREE.Color(0.25, 0.26, 0.27) });
    }
    const want = clamp(Math.floor(area / 170), 1, 5);
    let made = 0;
    const span = Math.sqrt(area) * 0.42;
    for (let k = 0; k < want * 5 && made < want; k++) {
      const px = cx + R(-span, span), pz = cz + R(-span, span);
      if (!inPoly(px, pz, core) || (hasCore && Math.hypot(px - cx, pz - cz) < s * 0.95 + 1.6)) continue;
      if (residential && made === 0) {
        mechList.push({ geometry: new THREE.CylinderGeometry(1.15, 1.15, 2.0, 20), matrix: M4(px, y + 1.5, pz), color: new THREE.Color(0.50, 0.52, 0.54) });
        mechList.push({ geometry: boxGeo(2.0, 0.5, 2.0, 2, 2), matrix: M4(px, y + 0.25, pz, ry), color: new THREE.Color(0.22, 0.23, 0.24) });
      } else {
        mechList.push({ geometry: boxGeo(2.7, 1.5, 1.5, 2, 2), matrix: M4(px, y + 0.85, pz, ry), color: new THREE.Color(0.46, 0.47, 0.48) });
        const c = Math.cos(ry), sn = Math.sin(ry);
        for (const o of [-0.65, 0.65]) mechList.push({ geometry: new THREE.CylinderGeometry(0.5, 0.5, 0.14, 20), matrix: M4(px + c * o, y + 1.66, pz - sn * o), color: new THREE.Color(0.12, 0.13, 0.14) });
      }
      made++;
    }
    if (y > 110) {
      mechList.push({ geometry: new THREE.CylinderGeometry(0.14, 0.32, 12, 12), matrix: M4(cx, y + 9.2, cz), color: new THREE.Color(0.2, 0.21, 0.23) });
      beaconList.push({ geometry: new THREE.SphereGeometry(0.5, 20, 14), matrix: M4(cx, y + 15.6, cz) });
    }
  }
  // collision: the footprint itself, sliced into strips, instead of its bounding box
  function footprintColliders(b, pts, h, kind = 'osm-building') {
    const w = b.x1 - b.x0, d = b.z1 - b.z0;
    if (b.area > w * d * 0.985 || Math.max(w, d) < 5) { add({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1, y0: 0, y1: h, kind }); return; }
    const prev = new Map();
    const alongX = w >= d;
    const L = alongX ? w : d, s0 = alongX ? b.x0 : b.z0;
    // narrow strips: on a slanted or curved wall a strip sticks out past the
    // visible facade by up to its width times the slope, which reads as an air wall
    const nS = clamp(Math.ceil(L / 1.2), 2, 220), sw = L / nS;
    const A = alongX ? 0 : 1, O = alongX ? 1 : 0;
    for (let s = 0; s < nS; s++) {
      const lo = s0 + s * sw, hi = lo + sw;
      let iv = [];
      for (const f of [0.2, 0.5, 0.8]) {
        const q = lo + sw * f, xs = [];
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], r = pts[(i + 1) % pts.length];
          if ((p[A] > q) !== (r[A] > q)) xs.push(p[O] + ((q - p[A]) / (r[A] - p[A])) * (r[O] - p[O]));
        }
        xs.sort((m, k) => m - k);
        for (let i = 0; i + 1 < xs.length; i += 2) iv.push([xs[i], xs[i + 1]]);
      }
      iv.sort((m, k) => m[0] - k[0]);
      const merged = [];
      for (const v of iv) { const last = merged[merged.length - 1]; if (last && v[0] <= last[1] + 0.6) last[1] = Math.max(last[1], v[1]); else merged.push([v[0], v[1]]); }
      const now = new Map();
      for (const v of merged) {
        if (v[1] - v[0] < 0.4) continue;
        // a strip that repeats its neighbour's extent just lengthens that neighbour
        const key = Math.round(v[0] * 2) + ':' + Math.round(v[1] * 2);
        const old = prev.get(key);
        if (old) { if (alongX) old.x1 = hi; else old.z1 = hi; now.set(key, old); continue; }
        now.set(key, add(alongX ? { x0: lo, x1: hi, z0: v[0], z1: v[1], y0: 0, y1: h, kind } : { x0: v[0], x1: v[1], z0: lo, z1: hi, y0: 0, y1: h, kind }));
      }
      prev.clear(); for (const [k, o] of now) prev.set(k, o);
    }
  }
  C.addFootprint = (pts, h, kind) => {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    footprintColliders({ x0, x1, z0, z1, area: polyAreaAbs(pts) }, pts, h, kind);
  };
  for (const b of B) {
    if (b.skip || b.h < 3.2 || b.area < 38) continue;
    if (Math.hypot(b.cx + 85, b.cz - 620) < 58) continue; // keep the ferry approach clear
    if (b.x0 < -12 && b.x1 > -230 && b.z0 < 712 && b.z1 > 528) continue; // ferry forecourt corridor (wide)
    if (!IN(b.cx, b.cz, 320)) continue;
    if (pointInWater(b.cx, b.cz)) continue;
    if (b.h < 6 && b.area < 80) continue; // sheds
    const mat = (b.mat || '').toLowerCase(), typ = (b.typ || '').toLowerCase();
    const residential = /residential|apartments|dormitory|house/.test(typ);
    const retail = /office|commercial|retail|hotel|skyscraper|mixed/.test(typ);
    let style;
    // Shendong is post-1990 city: tile and curtain wall, only the odd older block reads as masonry
    if (mat.includes('glass') || mat.includes('mirror') || b.h > 95) style = 'glass';
    else if (residential) style = R() < 0.3 ? 'stone' : 'panel';
    else if (retail) style = R() < 0.55 ? 'glass' : 'panel';
    else style = R() < 0.72 ? 'panel' : 'stone';
    const P = STYLE_P[style], gb = FX[style];
    const pts = cleanPoly(b.ccw ? b.pts : b.pts.slice().reverse());
    const n = pts.length;
    if (n < 3) continue;
    const seed = R(0.05, 0.95), tint = TINT(style);
    const litK = R(0.7, 1.3) * (style === 'glass' && b.h > 120 ? 1.15 : 1);
    const hubD = Math.hypot(b.cx, b.cz - 150);
    const led = style !== 'stone' && style !== 'lantan' && b.h > 38 && R() < 0.5 ? pick([0.2, 0.2, 0.4, 0.6, 0.6, 0.8]) : 0;
    const wash = style === 'lantan' ? R(0.75, 1.1) : (retail && b.h < 60 && R() < 0.35 ? 0.3 : 0);
    // storeys: a ground floor, then one to three tiers that step back on towers
    const gH = Math.min(P.gh, b.h * 0.6);
    const tierDef = b.h > 150 ? [[1, 0.58], [0.84, 0.86], [0.66, 1]] : b.h > 62 ? [[1, 0.68], [0.86, 1]] : [[1, 1]];
    const tiers = [];
    let y = gH, vBase = 1;
    for (const [k, f] of tierDef) {
      const y1 = Math.max(y + 2.4, b.h * f);
      const floors = Math.max(1, Math.round((y1 - y) / P.fh));
      tiers.push({ poly: k === 1 ? pts : insetPoly(pts, k), y0: y, y1, v0: vBase, floors, ch: (y1 - y) / floors });
      vBase += floors; y = y1;
    }
    const topV = vBase, H = y;
    // edges, and which of them face a street
    const edges = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i], c = pts[(i + 1) % n];
      const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
      if (len < 0.2) continue;
      const nx = (c[1] - a[1]) / len, nz = -(c[0] - a[0]) / len;
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      edges.push({ i, a, c, len, nx, nz, mx, mz, ry: Math.atan2(nx, nz), street: maskAt(mx + nx * 5, mz + nz * 5) !== 0 });
    }
    if (!edges.length) continue;
    const byLen = edges.slice().sort((p, q) => q.len - p.len);
    const streetEdges = byLen.filter((e) => e.street && e.len > 5);
    const hub0 = hubD < 120;
    const frontage = streetEdges.length ? streetEdges : (hub0 ? byLen.filter((e) => e.len > 5).slice(0, 2) : []);
    const gk = new Map();
    let lobbyEdge = null;
    if (style !== 'lantan' && frontage.length) {
      const rest = frontage.slice();
      if ((style === 'glass' || style === 'panel') && b.h > 30) { lobbyEdge = rest.shift(); gk.set(lobbyEdge.i, 2); }
      if (retail || b.h < 26 || hub0) for (const e of rest.slice(0, retail || hub0 ? 3 : 1)) gk.set(e.i, 1);
    }
    wallRing(gb, pts, 0, gH, 0, 1, gH, tint, seed, litK, (i) => gk.get(i) || 0, led, topV, wash, (k) => (k === 1 || k === 2 ? SHOP_BAY : P.bay));
    for (const t of tiers) {
      wallRing(gb, t.poly, t.y0, t.y1, t.v0, t.v0 + t.floors, t.ch, tint, seed, litK, () => 0, led, topV, wash, () => P.bay);
      roofCap(t.poly, t.y1);
      parapet(gb, t.poly, t.y1, tint, seed, led, topV, wash);
    }
    const top = tiers[tiers.length - 1];
    const ryLong = -Math.atan2(byLen[0].c[1] - byLen[0].a[1], byLen[0].c[0] - byLen[0].a[0]);
    if (H > 12 && (hubD < 560 || H > 60)) rooftop(top.poly, H, polyAreaAbs(top.poly), residential, ryLong);
    if (led) {
      const lc = LED_COL(led), cc = new THREE.Color(lc[0] * 2.4, lc[1] * 2.4, lc[2] * 2.4);
      const m = top.poly.length;
      for (let i = 0; i < m; i++) {
        const a = top.poly[i], c = top.poly[(i + 1) % m];
        const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
        if (len < 4) continue;
        crownList.push({ geometry: boxGeo(len, 0.2, 0.2, 4, 1), matrix: M4((a[0] + c[0]) / 2, H + 1.16, (a[1] + c[1]) / 2, -Math.atan2(c[1] - a[1], c[0] - a[0])), color: cc });
      }
    }
    // ground-floor life: canopies, awnings, signs, light on the pavement
    if (lobbyEdge) {
      const e = lobbyEdge;
      canopyList.push({ geometry: boxGeo(Math.min(9, e.len * 0.4), 0.22, 2.8, 4, 2), matrix: M4(e.mx + e.nx * 1.45, gH - 1.0, e.mz + e.nz * 1.45, e.ry) });
      shopGlowList.push({ geometry: new THREE.PlaneGeometry(Math.min(14, e.len * 0.6), 6), matrix: M4(e.mx + e.nx * 2.8, 0.06, e.mz + e.nz * 2.8, e.ry, -Math.PI / 2) });
      if (b.h > 50 && R() < 0.5) {
        const sw = Math.min(9, e.len * 0.3), sh = sw * 0.5;
        signList.push(G.atlasQuad(e.mx + e.nx * 0.2, gH + 5 + sh, e.mz + e.nz * 0.2, sw, sh, RI(0, 15), e.ry));
      }
    }
    for (const e of edges) {
      if (gk.get(e.i) !== 1) continue;
      shopGlowList.push({ geometry: new THREE.PlaneGeometry(e.len * 1.02, 5.5), matrix: M4(e.mx + e.nx * 2.5, 0.06, e.mz + e.nz * 2.5, e.ry, -Math.PI / 2) });
      if (R() < 0.55) {
        const sw = Math.min(6, e.len * 0.35), sh = sw * 0.4;
        signList.push(G.atlasQuad(e.mx + e.nx * 0.2, gH + 0.5 + sh / 2, e.mz + e.nz * 0.2, sw, sh, RI(0, 15), e.ry));
      }
      if (b.h < 30 && R() < 0.6) {
        awningList.push({ geometry: boxGeo(e.len * 0.96, 0.1, 1.1, 4, 1), matrix: M4(e.mx + e.nx * 0.6, gH * 0.72, e.mz + e.nz * 0.6, e.ry, 0.16), color: new THREE.Color().setHSL(pick([0.01, 0.38, 0.6, 0.09]), 0.5, 0.2) });
      }
    }
    // residential relief: continuous balconies on the two long sides, AC units on the others
    if (residential && H > 9 && H < 120 && hubD < 300) {
      const t0 = tiers[0];
      const fl = Math.min(t0.floors, 18);
      const bal = byLen.filter((e) => e.len > 7).slice(0, 2);
      for (const e of bal) {
        for (let fi = 1; fi < fl; fi++) {
          const by = t0.y0 + fi * t0.ch;
          balconyList.push({ geometry: boxGeo(e.len * 0.9, 0.14, 1.2, 4, 2), matrix: M4(e.mx + e.nx * 0.6, by, e.mz + e.nz * 0.6, e.ry), color: new THREE.Color(0.55, 0.53, 0.50) });
          balRailList.push({ geometry: boxGeo(e.len * 0.9, 0.95, 0.05, 4, 2), matrix: M4(e.mx + e.nx * 1.17, by + 0.55, e.mz + e.nz * 1.17, e.ry), color: new THREE.Color(0.20, 0.22, 0.24) });
        }
      }
      if (hubD < 230) for (const e of byLen.filter((q) => q.len > 5 && !bal.includes(q)).slice(0, 2)) {
        const bays = Math.max(1, Math.round(e.len / P.bay));
        for (let fi = 0; fi < Math.min(fl, 12); fi++) for (let j = 0; j < bays; j++) {
          if (R() > 0.35) continue;
          const f = (j + 0.5) / bays + 0.3 / bays;
          acList.push({ geometry: boxGeo(0.8, 0.55, 0.3, 2, 1), matrix: M4(lerp(e.a[0], e.c[0], f) + e.nx * 0.2, t0.y0 + fi * t0.ch + 0.5, lerp(e.a[1], e.c[1], f) + e.nz * 0.2, e.ry), color: new THREE.Color(0.62, 0.62, 0.60) });
        }
      }
    }
    buildingBoxes.push({ x: b.cx, z: b.cz, w: b.x1 - b.x0, d: b.z1 - b.z0, h: H, style, poly: pts });
    if (IN(b.cx, b.cz, 30) && H > 4) footprintColliders(b, pts, H);
  }
  for (const style of Object.keys(FX)) {
    if (!FX[style].count) continue;
    const mesh = new THREE.Mesh(FX[style].build(), M.fx[style]);
    mesh.name = `osm-facades-${style}`; mesh.userData.passable = true; mesh.userData.colliderSource = 'osm-footprints'; mesh.userData.surfaceProcedural = true;
    mesh.receiveShadow = true; scene.add(mesh);
  }
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(RB.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(RB.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(RB.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(RB.col, 3));
    g.computeBoundingSphere(); g.computeBoundingBox();
    const roofMat = M.roof.clone(); roofMat.vertexColors = true;
    const roofs = new THREE.Mesh(g, roofMat);
    roofs.name = 'osm-roofs'; roofs.userData.passable = true; roofs.userData.colliderSource = 'osm-footprints'; roofs.userData.surfaceProcedural = true;
    roofs.receiveShadow = true; scene.add(roofs);
  }
  {
    const plantMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.35, vertexColors: true, envMapIntensity: 1.0 });
    plantMat.userData.surfaceProcedural = true;
    addMerged('osm-roof-plant', mechList, plantMat, { vertexColors: true, passable: true, colliderSource: 'osm-footprints', proc: true });
    addMerged('osm-ac-units', acList, plantMat, { vertexColors: true, passable: true, colliderSource: 'ac-units', proc: true });
    const slabMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.03, vertexColors: true, envMapIntensity: 0.8 });
    slabMat.userData.surfaceProcedural = true;
    addMerged('osm-balconies', balconyList, slabMat, { vertexColors: true, passable: true, colliderSource: 'balconies', proc: true });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.7, vertexColors: true, envMapIntensity: 1.3 });
    railMat.userData.surfaceProcedural = true;
    addMerged('osm-balcony-rails', balRailList, railMat, { vertexColors: true, passable: true, colliderSource: 'balconies', proc: true });
    const awningMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7, metalness: 0.05, vertexColors: true, envMapIntensity: 1.0 });
    awningMat.userData.surfaceProcedural = true;
    addMerged('osm-awnings', awningList, awningMat, { vertexColors: true, passable: true, colliderSource: 'awnings', proc: true });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.4, metalness: 0.6 });
    canopyMat.userData.surfaceProcedural = true;
    addMerged('osm-canopies', canopyList, canopyMat, { passable: true, colliderSource: 'canopies', proc: true });
  }
  addMerged('osm-signs', signList, M.sign, { passable: true, colliderSource: 'osm-signs' });
  if (shopGlowList.length) {
    const sg = new THREE.MeshBasicMaterial({ map: TEX.glow, color: new THREE.Color(1.4, 0.85, 0.45), transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false });
    const sgm = new THREE.Mesh(mergeGeoms(shopGlowList), sg);
    sgm.name = 'shop-light-spill'; sgm.userData.passable = true; sgm.renderOrder = 2; scene.add(sgm);
  }
  if (crownList.length) {
    const crown = new THREE.Mesh(mergeGeoms(crownList, { vertexColors: true }), new THREE.MeshBasicMaterial({ vertexColors: true, color: 0xffffff }));
    crown.name = 'osm-roofline-lights'; crown.userData.passable = true; crown.userData.surfaceProcedural = true; scene.add(crown);
  }
  if (beaconList.length) {
    const beacons = new THREE.Mesh(mergeGeoms(beaconList), new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 0.22, 0.12) }));
    beacons.name = 'osm-aviation-beacons'; beacons.userData.passable = true; beacons.userData.surfaceProcedural = true; scene.add(beacons);
  }
  C.buildings = buildingBoxes;
  C.buildingCount = buildingBoxes.length;
  buildingBoxes.forEach((b) => { b.x0 = b.x - b.w / 2; b.x1 = b.x + b.w / 2; b.z0 = b.z - b.d / 2; b.z1 = b.z + b.d / 2; });

  // rain puddles on the near streets (dark, reflective)
  {
    const puddles = [];
    const seeds = [[4, 145], [-3, 156], [10, 138], [-8, 130], [2, 120], [-14, 142], [16, 152], [-20, 120], [8, 112], [-6, 104]];
    for (const [px, pz] of seeds) {
      const rx = R(0.8, 2.4), rz = R(0.5, 1.6);
      puddles.push({ geometry: new THREE.CircleGeometry(1, 24), matrix: M4(px, 0.045, pz, R(0, Math.PI), -Math.PI / 2, 0) });
      puddles[puddles.length - 1].geometry.scale(rx, rz, 1);
    }
    const pm = new THREE.Mesh(mergeGeoms(puddles), new THREE.MeshStandardMaterial({ color: 0x0c1116, roughness: 0.08, metalness: 0.9, transparent: true, opacity: 0.75, envMapIntensity: 2.2 }));
    pm.name = 'rain-puddles'; pm.userData.passable = true; pm.userData.surfaceProcedural = true; scene.add(pm);
  }

  // near-building kerbside bollards + planters along the OSM frontages
  {
    const bollards = [], planterBoxes = [], shrubs = [];
    for (const e of bankEdges) {
      if (e.len < 24) continue;
      const step = 7;
      const n = Math.min(8, Math.floor(e.len / step));
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n;
        const bx = lerp(e.a[0], e.b[0], f) + e.nx * e.landSign * 1.2;
        const bz = lerp(e.a[1], e.b[1], f) + e.nz * e.landSign * 1.2;
        if (pointInWater(bx, bz) || keepOut(bx, bz)) continue;
        bollards.push({ geometry: new THREE.CylinderGeometry(0.07, 0.09, 0.75, 32), matrix: M4(bx, 0.55, bz) });
        if (i % 4 === 0) {
          planterBoxes.push({ geometry: boxGeo(1.2, 0.55, 0.6, 2, 2), matrix: M4(bx, 0.45, bz) });
          shrubs.push({ geometry: new THREE.SphereGeometry(0.5, 10, 7), matrix: M4(bx, 0.92, bz, R(0, 6.28), 0, 0, 1.15, 0.62, 0.55) });
        }
      }
    }
    if (bollards.length) { const m = new THREE.Mesh(mergeGeoms(bollards), M.metal); m.name = 'kerb-bollards'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); }
    if (planterBoxes.length) { const m = new THREE.Mesh(mergeGeoms(planterBoxes), new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.8 })); m.name = 'kerb-planters'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); }
    if (shrubs.length) { const m = new THREE.Mesh(mergeGeoms(shrubs), new THREE.MeshStandardMaterial({ color: 0x4f7a3c, roughness: 0.95 })); m.name = 'kerb-shrubs'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); }
  }

  // ------------------------------------------------------------- street furniture along OSM roads
  const poleList = [], lampList = [], poolList = [], benchList = [], binList = [], bollardList = [], treeTrunk = [], treeLeaf = [], treePit = [];
  function streetLamp(x, z, ry) {
    if (keepOut(x, z)) return;
    const baseY = 0.17;
    poleList.push({ geometry: new THREE.CylinderGeometry(0.12, 0.19, 9.2, 24), matrix: M4(x, baseY + 4.6, z) });
    poleList.push({ geometry: new THREE.CylinderGeometry(0.07, 0.07, 2.4, 32), matrix: M4(x + Math.sin(ry) * 1.0, baseY + 9.1, z + Math.cos(ry) * 1.0, ry, 0, Math.PI / 2) });
    lampList.push({ geometry: new THREE.BoxGeometry(0.75, 0.18, 0.32), matrix: M4(x + Math.sin(ry) * 2.1, baseY + 8.95, z + Math.cos(ry) * 2.1, ry) });
    lampList.push({ geometry: new THREE.SphereGeometry(0.22, 24, 16), matrix: M4(x + Math.sin(ry) * 2.1, baseY + 8.8, z + Math.cos(ry) * 2.1) });
    poolList.push({ geometry: new THREE.PlaneGeometry(15, 15), matrix: M4(x + Math.sin(ry) * 2.1, 0.07, z + Math.cos(ry) * 2.1, 0, -Math.PI / 2) });
    add({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, y0: 0, y1: 3, kind: 'lamp' });
  }
  function sampleAlong(pts, step, fn) {
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let t = 0;
      while (t < seg) {
        const f = t / seg;
        fn(lerp(a[0], b[0], f), lerp(a[1], b[1], f), Math.atan2(b[0] - a[0], b[1] - a[1]));
        t += step;
      }
      acc += seg;
    }
    return acc;
  }
  const lampRoads = ROADS.filter((r) => r.name && r.width >= 9).slice(0, 60);
  let lampCount = 0;
  for (const r of lampRoads) {
    sampleAlong(r.samp, 54, (x, z, ang) => {
      if (lampCount++ > 150) return;
      if (!IN(x, z, 10)) return;
      const side = lampCount % 2 ? 1 : -1;
      streetLamp(x + Math.cos(ang) * side * (r.half + 1.8), z - Math.sin(ang) * side * (r.half + 1.8), ang - side * Math.PI / 2);
    });
  }
  // river promenade lamps
  for (const e of bankEdges) {
    if (e.len < 8) continue;
    const k = Math.floor(e.len / 30);
    for (let i = 0; i < k; i++) {
      const f = (i + 0.5) / k;
      const x = lerp(e.a[0], e.b[0], f) + e.nx * e.landSign * 2.6;
      const z = lerp(e.a[1], e.b[1], f) + e.nz * e.landSign * 2.6;
      if (pointInWater(x, z)) continue;
      streetLamp(x, z, Math.atan2(-e.nx * e.landSign, -e.nz * e.landSign));
    }
  }
  // a real streetlight at the opening: the player's car and umbrella must read
  streetLamp(5, 146, 0);
  const poleMat = M.darkMetal.clone();
  const poles = new THREE.Mesh(mergeGeoms(poleList), poleMat);
  poles.name = 'streetlight-poles'; poles.userData.passable = true; poles.userData.surfaceProcedural = true; poles.castShadow = true; scene.add(poles);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xffd2a0, emissiveIntensity: 2.8, roughness: 0.35 });
  lampMat.userData.surfaceProcedural = true;
  const lamps = new THREE.Mesh(mergeGeoms(lampList), lampMat);
  lamps.name = 'streetlight-heads'; lamps.userData.passable = true; lamps.userData.surfaceProcedural = true; scene.add(lamps);
  const poolMat = new THREE.MeshBasicMaterial({ map: TEX.lightPool, color: new THREE.Color(2.1, 1.35, 0.82), transparent: true, opacity: 0.34, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const pools = new THREE.Mesh(mergeGeoms(poolList), poolMat);
  pools.name = 'streetlight-pools'; pools.userData.passable = true; pools.renderOrder = 2; scene.add(pools);
  G.noReflect.push(pools);
  // three real street lights near the ferry start
  const fixtureMat = new THREE.MeshStandardMaterial({ color: 0xfff0d8, emissive: 0xffd6a0, emissiveIntensity: 5.0 });
  {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 16), fixtureMat);
    bulb.position.set(5, 8.8, 148.1); bulb.name = 'start-street-lamp'; bulb.userData.passable = true; scene.add(bulb);
    const L = new THREE.PointLight(0xffc98a, 80, 46, 2); L.position.set(5, 8.7, 148.1); scene.add(L);
  }
  const startBank = bankEdges.filter((e) => Math.hypot(e.mx - C.start[0], e.mz - C.start[1]) < 120).slice(0, 3);
  startBank.forEach((e, i) => {
    const x = e.mx + e.nx * e.landSign * 2.6, z = e.mz + e.nz * e.landSign * 2.6;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), fixtureMat);
    bulb.position.set(x, 8.8, z); bulb.name = 'lit-lamp-fixture-' + i; bulb.userData.passable = true; scene.add(bulb);
    const L = new THREE.PointLight(0xffbb78, 34, 32, 2);
    L.position.set(x, 8.7, z); scene.add(L);
  });
  // benches + bins + bollards on the promenade
  for (const e of bankEdges) {
    if (e.len < 10) continue;
    const k = Math.floor(e.len / 18);
    for (let i = 0; i < k; i++) {
      const f = (i + 0.35) / k;
      const x = lerp(e.a[0], e.b[0], f) + e.nx * e.landSign * 2.2;
      const z = lerp(e.a[1], e.b[1], f) + e.nz * e.landSign * 2.2;
      if (pointInWater(x, z) || keepOut(x, z)) continue;
      const ry = Math.atan2(-e.nx * e.landSign, -e.nz * e.landSign);
      benchList.push({ geometry: boxGeo(2.4, 0.12, 0.55, 2, 1), matrix: M4(x, 0.55, z, ry) });
      benchList.push({ geometry: boxGeo(2.4, 0.55, 0.08, 2, 1), matrix: M4(x - Math.sin(ry) * 0.26, 0.82, z - Math.cos(ry) * 0.26, ry) });
      benchList.push({ geometry: boxGeo(0.1, 0.45, 0.5, 1, 1), matrix: M4(x + Math.cos(ry) * 1.1, 0.28, z - Math.sin(ry) * 1.1, ry) });
      benchList.push({ geometry: boxGeo(0.1, 0.45, 0.5, 1, 1), matrix: M4(x - Math.cos(ry) * 1.1, 0.28, z + Math.sin(ry) * 1.1, ry) });
      if (i % 3 === 0) binList.push({ geometry: new THREE.CylinderGeometry(0.28, 0.24, 0.8, 32), matrix: M4(x + Math.cos(ry) * 1.8, 0.55, z - Math.sin(ry) * 1.8) });
    }
  }
  const benchMat = M.wood.clone(); benchMat.vertexColors = true;
  addMerged('promenade-benches', benchList, benchMat, { vertexColors: true, passable: true, colliderSource: 'benches' });
  const binMat = M.metal.clone(); binMat.vertexColors = true;
  addMerged('litter-bins', binList, binMat, { vertexColors: true, passable: true, colliderSource: 'bins' });

  // trees in the OSM parks and along the waterfront
  // London planes: mottled pale trunk, a few rising limbs, a broad canopy of leaf cards.
  // Cards are single-sided pairs sharing outward normals, so the crown shades as one volume.
  const _tv = new THREE.Vector3(), UP3 = new THREE.Vector3(0, 1, 0), ONE3 = new THREE.Vector3(1, 1, 1);
  function leafCard(cx, cy, cz, px, py, pz, size, col) {
    const g = new THREE.PlaneGeometry(size, size);
    g.applyMatrix4(M4(px, py, pz, R(0, Math.PI * 2), R(-0.7, 0.7), R(-0.5, 0.5)));
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { _tv.set(p.getX(i) - cx, p.getY(i) - cy + 1.2, p.getZ(i) - cz).normalize(); n.setXYZ(i, _tv.x, _tv.y, _tv.z); }
    const back = g.clone(); back.setIndex(Array.from(g.index.array).reverse());
    treeLeaf.push({ geometry: g, color: col }, { geometry: back, color: col });
  }
  function tree(x, z, s = 1) {
    if (keepOut(x, z, 1.5)) return;
    const bark = new THREE.Color(0.50 + R(0, 0.08), 0.47 + R(0, 0.06), 0.40);
    const th = 3.3 * s;
    treeTrunk.push({ geometry: new THREE.CylinderGeometry(0.17 * s, 0.30 * s, th, 10), matrix: M4(x, th / 2 + 0.15, z, R(0, 6.28), R(-0.05, 0.05), 0), color: bark });
    treeTrunk.push({ geometry: new THREE.CylinderGeometry(0.30 * s, 0.44 * s, 0.4, 10), matrix: M4(x, 0.32, z), color: bark });
    const a0 = R(0, Math.PI * 2);
    for (let k = 0; k < 4; k++) {
      const a = a0 + k / 4 * Math.PI * 2 + R(-0.3, 0.3), tilt = R(0.45, 0.85), len = R(2.6, 3.6) * s;
      const dir = new THREE.Vector3(Math.sin(a) * Math.sin(tilt), Math.cos(tilt), Math.cos(a) * Math.sin(tilt));
      const mid = new THREE.Vector3(x, th, z).addScaledVector(dir, len / 2);
      treeTrunk.push({ geometry: new THREE.CylinderGeometry(0.05 * s, 0.13 * s, len, 6), matrix: new THREE.Matrix4().compose(mid, new THREE.Quaternion().setFromUnitVectors(UP3, dir), ONE3), color: bark });
    }
    treePit.push({ geometry: new THREE.PlaneGeometry(1.6, 1.6), matrix: M4(x, 0.2, z, 0, -Math.PI / 2) });
    const cy = th + 3.0 * s, rx = 2.9 * s, ry = 2.3 * s;
    for (let k = 0; k < 22; k++) {
      const u = R(-0.55, 1), ang = R(0, Math.PI * 2), rr = Math.sqrt(1 - u * u) * R(0.55, 1);
      const shade = 0.5 + 0.5 * (u * 0.5 + 0.5), warm = R(0, 1);
      leafCard(x, cy - 1, z, x + Math.cos(ang) * rr * rx, cy + u * ry, z + Math.sin(ang) * rr * rx, R(2.6, 3.6) * s,
        new THREE.Color(shade * (0.9 + warm * 0.55), shade * (1.0 + warm * 0.1), shade * (0.8 - warm * 0.35)));
    }
    add({ x0: x - 0.45, x1: x + 0.45, z0: z - 0.45, z1: z + 0.45, y0: 0, y1: 3, kind: 'tree' });
  }
  let treeN = 0;
  PARKS.forEach((poly) => {
    if (treeN > 110) return;
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (const p of poly) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
    if (!IN((minx + maxx) / 2, (minz + maxz) / 2, 60)) return;
    const tries = 6 + Math.floor(R(0, 6));
    for (let i = 0; i < tries && treeN < 120; i++) {
      const x = R(minx, maxx), z = R(minz, maxz);
      if (!IN(x, z) || pointInWater(x, z)) continue;
      let inside = false;
      for (let j = 0; j < poly.length; j++) { const a = poly[j], b = poly[(j + 1) % poly.length]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; }
      if (!inside) continue;
      tree(x, z, 0.85 + R(0, 0.35)); treeN++;
    }
  });
  for (const e of bankEdges) {
    if (e.len < 12) continue;
    const k = Math.floor(e.len / 24);
    for (let i = 0; i < k && treeN < 150; i++) {
      const f = (i + 0.6) / k;
      const x = lerp(e.a[0], e.b[0], f) + e.nx * e.landSign * 4.2;
      const z = lerp(e.a[1], e.b[1], f) + e.nz * e.landSign * 4.2;
      if (pointInWater(x, z)) continue;
      tree(x, z, 0.9 + R(0, 0.25)); treeN++;
    }
  }
  // ---- 星珠滨江绿地: lawns, box hedges, tree rows and garden lights on the empty
  // riverside band north-west of the Pearl (between the promenade and the first road)
  {
    const PX0 = -880, PX1 = -300, PZ0 = -870, PZ1 = -370;
    const nearColl = C.colliders.filter((c) => c.x1 > PX0 - 40 && c.x0 < PX1 + 40 && c.z1 > PZ0 - 40 && c.z0 < PZ1 + 40);
    const nearRoads = ROADS.filter((r) => r.samp.some((p) => p[0] > PX0 - 60 && p[0] < PX1 + 60 && p[1] > PZ0 - 60 && p[1] < PZ1 + 60));
    const free = (x, z) => {
      if (!IN(x, z, -4) || pointInWater(x, z) || keepOut(x, z, 1)) return false;
      for (const c of nearColl) if (x > c.x0 - 1.2 && x < c.x1 + 1.2 && z > c.z0 - 1.2 && z < c.z1 + 1.2) return false;
      for (const r of nearRoads) {
        const pad = r.half + (r.width < 8 ? 0.8 : 2.2), s = r.samp;
        for (let i = 0; i + 1 < s.length; i++) {
          if (Math.abs(s[i][0] - x) > 80 || Math.abs(s[i][1] - z) > 80) continue;
          if (distSeg(x, z, s[i][0], s[i][1], s[i + 1][0], s[i + 1][1]) < pad) return false;
        }
      }
      return true;
    };
    // the bank as chains of samples 1.5 m apart, each with a smoothed landward normal
    const chains = [];
    let cur = null, last = null;
    for (const e of bankEdges) {
      if (e.len < 0.05 || e.mx < PX0 || e.mx > PX1 || e.mz < PZ0 || e.mz > PZ1) { cur = null; continue; }
      for (const [f0, f1] of e.runs) {
        const L = (f1 - f0) * e.len;
        for (let t = 0; t < L; t += 1.5) {
          const f = f0 + t / e.len, x = lerp(e.a[0], e.b[0], f), z = lerp(e.a[1], e.b[1], f);
          if (!cur || !last || Math.hypot(x - last[0], z - last[1]) > 3.5) { cur = []; chains.push(cur); }
          else if (Math.hypot(x - last[0], z - last[1]) < 1.2) continue;
          cur.push({ x, z, nx: e.nx * e.landSign, nz: e.nz * e.landSign });
          last = [x, z];
        }
      }
    }
    const lawnPos = [], lawnCol = [], lawnUv = [], kerbs = [], hedgeGeo = [], hedges = [], blooms = [], bollards = [], heads = [];
    const kerbAt = (a, b, da, db, y, w, h, out = kerbs) => {
      const ax = a.x + a.nx * da, az = a.z + a.nz * da, bx = b.x + b.nx * db, bz = b.z + b.nz * db, l = Math.hypot(bx - ax, bz - az);
      if (l < 0.05) return;
      out.push({ geometry: boxGeo(l + 0.06, h, w, 1, 1), matrix: M4((ax + bx) / 2, y, (az + bz) / 2, -Math.atan2(bz - az, bx - ax)) });
    };
    const D0 = 8.2;
    let treeK = 0, parkTrees = 0, gateN = 0;
    const gates = [];
    for (const ch of chains) {
      if (ch.length < 8) continue;
      for (let i = 0; i < ch.length; i++) {
        let nx = 0, nz = 0;
        for (let k = Math.max(0, i - 3); k <= Math.min(ch.length - 1, i + 3); k++) { nx += ch[k].nx; nz += ch[k].nz; }
        const l = Math.hypot(nx, nz) || 1; ch[i].sx = nx / l; ch[i].sz = nz / l;
      }
      for (const p of ch) { p.nx = p.sx; p.nz = p.sz; }
      // how deep the lawn can run inland at each sample
      let arc = 0;
      for (let i = 0; i < ch.length; i++) {
        const p = ch[i];
        if (i) arc += Math.hypot(p.x - ch[i - 1].x, p.z - ch[i - 1].z);
        p.arc = arc;
        let d = D0;
        if (!free(p.x + p.nx * d, p.z + p.nz * d)) { p.d = 0; continue; }
        while (d < 34 && free(p.x + p.nx * (d + 1), p.z + p.nz * (d + 1))) d += 1;
        p.d = d - 1.2;
      }
      // smooth the far edge, then cut 4 m paths through the lawn every ~46 m
      for (let i = 0; i < ch.length; i++) {
        let m = ch[i].d;
        for (let k = Math.max(0, i - 2); k <= Math.min(ch.length - 1, i + 2); k++) m = Math.min(m, ch[k].d + Math.abs(k - i) * 1.2);
        ch[i].dd = m - D0 < 3.5 ? 0 : m;
        const g = (ch[i].arc + 23) % 46;
        if (g < 4) { ch[i].dd = 0; if (g < 1.5 && ch[i].d > D0 + 4) gates.push(ch[i]); }
      }
      for (let i = 0; i + 1 < ch.length; i++) {
        const a = ch[i], b = ch[i + 1];
        if (!a.dd || !b.dd) continue;
        const q = [[a.x + a.nx * D0, a.z + a.nz * D0], [b.x + b.nx * D0, b.z + b.nz * D0], [b.x + b.nx * b.dd, b.z + b.nz * b.dd], [a.x + a.nx * a.dd, a.z + a.nz * a.dd]];
        const up = (q[1][0] - q[0][0]) * (q[3][1] - q[0][1]) - (q[1][1] - q[0][1]) * (q[3][0] - q[0][0]) > 0;
        for (const k of up ? [0, 3, 1, 1, 3, 2] : [0, 1, 3, 1, 2, 3]) {
          const v = q[k], n = Math.sin(v[0] * 0.11) * Math.cos(v[1] * 0.093) * 0.5 + Math.sin(v[0] * 0.031 + v[1] * 0.027) * 0.5;
          lawnPos.push(v[0], 0.22, v[1]); lawnUv.push(v[0] / 3, v[1] / 3);
          lawnCol.push(0.82 + n * 0.12, 0.9 + n * 0.08, 0.78 + n * 0.06);
        }
        // granite edging on both long sides, box hedge behind the river-side edging
        kerbAt(a, b, D0 - 0.1, D0 - 0.1, 0.17, 0.22, 0.3);
        kerbAt(a, b, a.dd + 0.1, b.dd + 0.1, 0.17, 0.22, 0.3);
        kerbAt(a, b, D0 + 0.75, D0 + 0.75, 0.6, 1.0, 0.8, hedgeGeo);
        { const hx0 = (a.x + b.x) / 2 + (a.nx + b.nx) / 2 * (D0 + 0.75), hz0 = (a.z + b.z) / 2 + (a.nz + b.nz) / 2 * (D0 + 0.75); hedgeGeo.push({ geometry: new THREE.SphereGeometry(0.62, 8, 5), matrix: M4(hx0 + R(-0.2, 0.2), 1.0, hz0 + R(-0.2, 0.2), R(0, 6.28), 0, 0, 1.5, 0.32, 0.85) }); }
        const hx = (a.x + b.x) / 2 + (a.nx + b.nx) / 2 * (D0 + 0.75), hz = (a.z + b.z) / 2 + (a.nz + b.nz) / 2 * (D0 + 0.75);
        hedges.push([hx, hz]);
        add({ x0: hx - 0.55, x1: hx + 0.55, z0: hz - 0.55, z1: hz + 0.55, y0: 0, y1: 1.0, kind: 'hedge' });
        // flower beds along the hedge foot (azalea and seasonal bedding)
        if (i % 3 === 0 && a.dd - D0 > 6) {
          const t = R(0.2, 0.8), d = D0 + 1.8 + R(0, 0.6), x = lerp(a.x, b.x, t) + a.nx * d, z = lerp(a.z, b.z, t) + a.nz * d;
          const col = pick([[0.85, 0.28, 0.42], [0.92, 0.6, 0.7], [0.95, 0.85, 0.82], [0.7, 0.2, 0.3]]);
          blooms.push({ geometry: new THREE.SphereGeometry(0.3, 8, 5), matrix: M4(x, 0.3, z, R(0, 6.28), 0, 0, 1.2, 0.5, 0.9), color: new THREE.Color(col[0], col[1], col[2]) });
        }
        // two staggered rows of planes inside the lawn
        if (++treeK % 9 === 0 && a.dd - D0 > 7) {
          const rows = a.dd - D0 > 15 ? [D0 + 4.5, a.dd - 4] : [(D0 + a.dd) / 2];
          rows.forEach((d, r) => { const s = r ? 0.5 : 0; const x = lerp(a.x, b.x, s) + a.nx * d + (r ? a.nz * 6 : 0), z = lerp(a.z, b.z, s) + a.nz * d - (r ? a.nx * 6 : 0); if (free(x, z)) { tree(x, z, 0.95 + R(0, 0.3)); parkTrees++; } });
        }
      }
    }
    // knee-high garden lights at the lawn openings, facing the paths
    for (const p of gates) {
      for (const side of [-1, 1]) {
        const x = p.x + p.nx * (D0 + 0.6) + p.nz * side * 2.4, z = p.z + p.nz * (D0 + 0.6) - p.nx * side * 2.4;
        bollards.push({ geometry: new THREE.CylinderGeometry(0.09, 0.11, 0.85, 10), matrix: M4(x, 0.6, z) });
        heads.push({ geometry: new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10), matrix: M4(x, 0.98, z) });
        bollards.push({ geometry: new THREE.CylinderGeometry(0.13, 0.13, 0.04, 10), matrix: M4(x, 1.06, z) });
        add({ x0: x - 0.15, x1: x + 0.15, z0: z - 0.15, z1: z + 0.15, y0: 0, y1: 1.1, kind: 'bollard-light' });
      }
      gateN++;
    }
    let lawnTex = null;
    if (lawnPos.length) {
      const cv = makeCanvas(256, 256), cx = cv.getContext('2d');
      cx.fillStyle = '#5f8040'; cx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 5200; i++) {
        const x = R(0, 256), y = R(0, 256), h = R(2, 6), g = RI(70, 120);
        cx.strokeStyle = `rgba(${RI(60, 110)},${g + 30},${RI(40, 70)},${R(0.35, 0.8).toFixed(2)})`; cx.lineWidth = R(0.6, 1.4);
        cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + R(-1.5, 1.5), y - h); cx.stroke();
      }
      lawnTex = canvasTexture(cv, true, 1, 1, 8);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(lawnPos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(lawnPos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(lawnUv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(lawnCol, 3));
      g.computeBoundingSphere(); g.computeBoundingBox();
      const lawn = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: lawnTex, vertexColors: true, color: 0x9aa08a, emissive: 0x1a2414, emissiveIntensity: 0.35, roughness: 0.9, metalness: 0, envMapIntensity: 0.5 }));
      lawn.name = 'pearl-riverside-lawns'; lawn.userData.passable = true; lawn.receiveShadow = true; scene.add(lawn);
    }
    addMerged('pearl-riverside-edging', kerbs, M.concrete, { passable: true, proc: true });
    addMerged('pearl-riverside-hedges', hedgeGeo, new THREE.MeshStandardMaterial({ map: lawnTex, color: 0x6c7a58, emissive: 0x121c0e, emissiveIntensity: 0.4, roughness: 0.95, envMapIntensity: 0.5 }), { passable: true, colliderSource: 'hedge' });
    addMerged('pearl-riverside-blooms', blooms, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), { vertexColors: true, passable: true });
    addMerged('pearl-riverside-bollards', bollards, M.darkMetal, { passable: true, colliderSource: 'bollard-light', proc: true });
    addMerged('pearl-riverside-bollard-lamps', heads, new THREE.MeshStandardMaterial({ color: 0x2a2620, emissive: 0xffd8a8, emissiveIntensity: 2.4, roughness: 0.4 }), { passable: true, proc: true });
    // the park's name stone at the opening nearest the Pearl
    const g0 = gates.slice().sort((a, b) => Math.hypot(a.x + 390, a.z + 430) - Math.hypot(b.x + 390, b.z + 430))[0];
    if (g0) {
      const x = g0.x + g0.nx * (D0 + 3.2) + g0.nz * 4.6, z = g0.z + g0.nz * (D0 + 3.2) - g0.nx * 4.6, ry = Math.atan2(-g0.nz, g0.nx);
      const cv = makeCanvas(512, 160), c2 = cv.getContext('2d');
      c2.fillStyle = '#8c8578'; c2.fillRect(0, 0, 512, 160);
      for (let i = 0; i < 900; i++) { c2.fillStyle = `rgba(${RI(60, 160)},${RI(60, 150)},${RI(55, 140)},0.25)`; c2.fillRect(R(0, 512), R(0, 160), R(1, 4), R(1, 3)); }
      c2.fillStyle = '#2b1e14'; c2.font = 'bold 76px "Songti SC","STSong","SimSun",serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle';
      c2.fillText('星珠滨江绿地', 256, 68);
      c2.font = '24px sans-serif'; c2.fillText('PEARL RIVERSIDE GREEN', 256, 130);
      const stone = new THREE.Mesh(roundedBox(3.2, 1.1, 0.7, 0.12, 2), new THREE.MeshStandardMaterial({ map: canvasTexture(cv), roughness: 0.75 }));
      stone.position.set(x, 0.75, z); stone.rotation.y = ry; stone.name = 'pearl-riverside-name-stone'; stone.userData.passable = true; scene.add(stone);
      add({ x0: x - 1.7, x1: x + 1.7, z0: z - 1.7, z1: z + 1.7, y0: 0, y1: 1.3, kind: 'name-stone' });
    }
    C.pearlPark = { chains: chains.length, trees: parkTrees, hedges: hedges.length, gates: gateN };
  }
  // street trees on the pavements of the named roads, clear of carriageways, walls, lamps and doors
  {
    const KEEP_CLEAR = [[6, 150], [8.5, 149.4], [27, 158], [-390, -430], [120, 260], [305, 29], [150, 90], [-617, 99], [-85, 620], [168, 163], [-590, 81.4], [-616, 107], [-622, 89]];
    const blocked = (x, z) => {
      if (!IN(x, z, -6) || pointInWater(x, z)) return true;
      for (const p of KEEP_CLEAR) if (Math.hypot(x - p[0], z - p[1]) < 10) return true;
      for (const c of C.colliders) if (x > c.x0 - 2.2 && x < c.x1 + 2.2 && z > c.z0 - 2.2 && z < c.z1 + 2.2) return true;
      for (const r of ROADS) {
        const pad = r.half + 1.1;
        for (let i = 0; i + 1 < r.samp.length; i++) {
          const a = r.samp[i], b = r.samp[i + 1];
          if (Math.abs(a[0] - x) > 60 || Math.abs(a[1] - z) > 60) continue;
          if (distSeg(x, z, a[0], a[1], b[0], b[1]) < pad) return true;
        }
      }
      return false;
    };
    let streetTrees = 0;
    for (const r of lampRoads) {
      let k = 0;
      sampleAlong(r.samp, 15, (x, z, ang) => {
        k++;
        for (const side of [1, -1]) {
          if (streetTrees >= 260) return;
          const tx = x + Math.cos(ang) * side * (r.half + 2.5), tz = z - Math.sin(ang) * side * (r.half + 2.5);
          if (blocked(tx, tz)) continue;
          tree(tx, tz, 0.95 + R(0, 0.3)); streetTrees++;
        }
      });
    }
  }
  const trunkMat = M.wood.clone(); trunkMat.vertexColors = true; trunkMat.color.set(0xffffff);
  addMerged('tree-trunks', treeTrunk, trunkMat, { vertexColors: true, passable: true, colliderSource: 'trees' });
  const leafMatA = M.foliageA.clone(); leafMatA.side = THREE.FrontSide; leafMatA.vertexColors = true; leafMatA.color.set(0xc4d0aa); leafMatA.emissive = new THREE.Color(0x4a5a30); leafMatA.emissiveIntensity = 0.22; leafMatA.envMapIntensity = 1.0;
  const leavesA = new THREE.Mesh(mergeGeoms(treeLeaf, { vertexColors: true }), leafMatA);
  leavesA.name = 'street-tree-canopies'; leavesA.userData.passable = true; leavesA.castShadow = true; scene.add(leavesA);
  const pitMat = M.darkMetal.clone(); pitMat.vertexColors = true;
  addMerged('tree-pits', treePit, pitMat, { vertexColors: true, passable: true, colliderSource: 'tree-pits', proc: true });

  // ------------------------------------------------------------- ferry terminal at Dongsheng
  {
    // The pier stands on piles out in the river; a bridge crosses the seawall
    // gap (SITE.dsGap) from the quay and ramps down onto the promenade.
    const DECK_Y = 0.47, LAND_Y = 0.17, BZ0 = 617.5, BZ1 = 622.5, BX0 = -59.2, BX1 = -44;
    const bankX = (z) => { let lo = -75, hi = -35; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (pointInWater(m, z)) lo = m; else hi = m; } return hi; };
    const bankTab = []; for (let z = BZ0; z <= BZ1 + 1e-6; z += 0.25) bankTab.push(bankX(z));
    const bankAtZ = (z) => { const u = clamp((z - BZ0) / 0.25, 0, bankTab.length - 1), i = Math.min(bankTab.length - 2, Math.floor(u)); return lerp(bankTab[i], bankTab[i + 1], u - i); };
    C.ferryBridge = { x0: BX0, x1: BX1, z0: BZ0, z1: BZ1 };
    C.ferryBridgeY = (x, z) => {
      if (x < BX0 || x > BX1 || z < BZ0 || z > BZ1) return null;
      const d = x - bankAtZ(z);
      return d < 0.8 ? DECK_Y : d < 3.8 ? lerp(DECK_Y, LAND_Y, (d - 0.8) / 3) : null;
    };
    C.mapDecks = C.mapDecks || [];
    C.mapDecks.push([[-88, 613.5], [-59, 613.5], [-59, 626.5], [-88, 626.5]], [[BX0, BZ0], [bankAtZ(BZ0) + 3.8, BZ0], [bankAtZ(BZ1) + 3.8, BZ1], [BX0, BZ1]]);
    {
      const stoneB = M.concrete.clone(); stoneB.color = new THREE.Color(0x8a857b); stoneB.userData.surfaceProcedural = true;
      const g = new THREE.PlaneGeometry(BX1 - BX0, BZ1 - BZ0, 60, 20); g.rotateX(-Math.PI / 2); g.translate((BX0 + BX1) / 2, 0, (BZ0 + BZ1) / 2);
      const p = g.attributes.position;
      // past the ramp foot the sheet tucks under the promenade instead of fighting it
      for (let i = 0; i < p.count; i++) { const y = C.ferryBridgeY(p.getX(i), p.getZ(i)); p.setY(i, y === null ? 0.1 : y); }
      g.computeVertexNormals();
      const parts = [{ geometry: g, matrix: new THREE.Matrix4() }];
      const beam = [], piles = [], rails = [];
      for (const z of [BZ0, BZ1]) { const e = bankAtZ(z), L = e - BX0 + 0.6; beam.push({ geometry: boxGeo(L, 0.42, 0.22, 3, 1), matrix: M4(BX0 + L / 2, DECK_Y - 0.22, z) }); }
      for (const x of [-86, -80.5, -75, -69.5, -64, -60]) for (const z of [614.2, 617.4, 622.6, 625.8]) piles.push({ geometry: new THREE.CylinderGeometry(0.17, 0.21, 2.2, 16), matrix: M4(x, -0.8, z) });
      for (const z of [BZ0 + 0.3, BZ1 - 0.3]) for (let x = -57.5; x < bankAtZ(z) - 0.6; x += 2.5) piles.push({ geometry: new THREE.CylinderGeometry(0.15, 0.19, 2.2, 16), matrix: M4(x, -0.8, z) });
      // railings: posts every <= 2 m, a handrail and a mid rail, and a collider strip under each run
      const railRun = (ax, az, bx, bz, kind) => {
        const L = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax), n = Math.max(1, Math.ceil(L / 2));
        for (const [h, t] of [[1.08, 0.06], [0.58, 0.035]]) rails.push({ geometry: boxGeo(L, t, t, 2, 1), matrix: M4((ax + bx) / 2, DECK_Y + h, (az + bz) / 2, ry) });
        for (let k = 0; k <= n; k++) rails.push({ geometry: boxGeo(0.06, 1.1, 0.06, 1, 1), matrix: M4(lerp(ax, bx, k / n), DECK_Y + 0.55, lerp(az, bz, k / n)) });
        add({ x0: Math.min(ax, bx) - 0.2, x1: Math.max(ax, bx) + 0.2, z0: Math.min(az, bz) - 0.2, z1: Math.max(az, bz) + 0.2, y0: 0, y1: DECK_Y + 1.1, kind });
      };
      railRun(-87.9, 613.75, -59.25, 613.75, 'pier-rail'); railRun(-87.9, 626.25, -59.25, 626.25, 'pier-rail');
      railRun(-59.25, 613.75, -59.25, BZ0, 'pier-rail'); railRun(-59.25, BZ1, -59.25, 626.25, 'pier-rail');
      railRun(-87.9, 613.75, -87.9, 615, 'pier-rail'); railRun(-87.9, 624, -87.9, 626.25, 'pier-rail');
      for (const z of [BZ0 + 0.12, BZ1 - 0.12]) railRun(-59.25, z, bankAtZ(z) + 0.35, z, 'bridge-rail');
      const deckM = new THREE.Mesh(mergeGeoms(parts), stoneB); deckM.name = 'ferry-bridge'; deckM.receiveShadow = true;
      const beamM = new THREE.Mesh(mergeGeoms(beam.concat(piles)), M.darkMetal); beamM.name = 'ferry-bridge-piles';
      const railM = new THREE.Mesh(mergeGeoms(rails), M.metal); railM.name = 'ferry-pier-railing'; railM.castShadow = true;
      for (const m of [deckM, beamM, railM]) { m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); }
      // gate pillars where the bridge leaves the seawall, each with a lamp on top
      const gate = [];
      for (const z of [BZ0 - 0.15, BZ1 + 0.15]) { const x = bankAtZ(z) + 0.1; gate.push({ geometry: boxGeo(0.5, 1.5, 0.5, 1, 1), matrix: M4(x, 0.75, z) }); add({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3, y0: 0, y1: 1.5, kind: 'ferry-gate' }); }
      const gm = new THREE.Mesh(mergeGeoms(gate), M.concrete); gm.name = 'ferry-gate-pillars'; gm.userData.passable = true; gm.userData.surfaceProcedural = true; scene.add(gm);
      for (const z of [BZ0 - 0.15, BZ1 + 0.15]) { const bl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), fixtureMat); bl.position.set(bankAtZ(z) + 0.1, 1.66, z); bl.name = 'ferry-gate-lamp'; bl.userData.passable = true; scene.add(bl); }
    }
    const fl = new THREE.PointLight(0xffc98c, 40, 34, 2); fl.position.set(-66, 3.9, 620); scene.add(fl);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), fixtureMat); bulb.position.copy(fl.position); bulb.name = 'ferry-canopy-lamp'; bulb.userData.passable = true; scene.add(bulb);    // 东晟路渡口 forecourt, pier, signage and queue
    {
      const stone = M.concrete.clone(); stone.color = new THREE.Color(0x8a857b); stone.userData.surfaceProcedural = true;
      const deck = new THREE.Mesh(boxGeo(29.2, 0.5, 13, 5, 4), stone); deck.position.set(-73.6, 0.22, 620); deck.userData.passable = true; deck.userData.surfaceProcedural = true; deck.name = 'ferry-pier'; scene.add(deck);
      const canopy = new THREE.Mesh(boxGeo(12, 0.25, 9, 3, 3), M.darkMetal); canopy.position.set(-64, 4.2, 620); canopy.userData.passable = true; canopy.userData.surfaceProcedural = true; scene.add(canopy);
      for (const px of [-69, -59]) for (const pz of [616, 624]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 4.2, 32), M.darkMetal); post.position.set(px, 2.1, pz); post.userData.passable = true; post.userData.surfaceProcedural = true; scene.add(post);
      }
      const c = makeCanvas(512, 160), ctx = c.getContext('2d');
      ctx.fillStyle = '#0b2634'; ctx.fillRect(0, 0, 512, 160); ctx.strokeStyle = '#c9d8e0'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 152);
      ctx.fillStyle = '#eef6f8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '700 48px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'; ctx.fillText('东晟路渡口', 256, 54);
      ctx.font = '500 22px "SF Mono",monospace'; ctx.fillStyle = '#8fb4c9'; ctx.fillText('DONGSHENG FERRY  ·  LAST FERRY', 256, 108);
      const st = canvasTexture(c, true, 1, 1, 4);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.3), new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.5 }));
      sign.position.set(-64, 4.9, 615.6); sign.rotation.y = Math.PI; sign.userData.passable = true; sign.userData.surfaceProcedural = true; sign.name = 'dongsheng-ferry-sign'; scene.add(sign);
      // queue rails and waiting people
      const q = [];
      for (let i = 0; i < 3; i++) { q.push({ geometry: boxGeo(6, 0.07, 0.07, 2, 1), matrix: M4(-68 + i * 2.6, 1.0, 618) }); q.push({ geometry: boxGeo(6, 0.07, 0.07, 2, 1), matrix: M4(-68 + i * 2.6, 1.0, 622) }); }
      for (const x of [-68, -65.4, -62.8, -60.2]) for (const z of [617.6, 622.4]) q.push({ geometry: new THREE.CylinderGeometry(0.035, 0.035, 1.0, 32), matrix: M4(x, 0.5, z) });
      const qm = new THREE.Mesh(mergeGeoms(q), M.metal); qm.name = 'ferry-queue-rails'; qm.userData.passable = true; qm.userData.surfaceProcedural = true; scene.add(qm);
      {
        const poses = ['stand', 'phone', 'talk', 'stand', 'hold'];
        const list = [];
        for (let i = 0; i < 5; i++) list.push({ look: { hold: poses[i] === 'hold' ? 'umbrella' : poses[i] === 'phone' ? 'phone' : null }, pose: poses[i], x: -67.6 + (i % 3) * 2.2 + R(-0.2, 0.2), y: 0.47, z: 619.1 + Math.floor(i / 3) * 1.9, ry: -Math.PI / 2 + R(-0.3, 0.3) });
        const wm = G.people.crowd(list, 'ferry-queue-people'); scene.add(wm);
      }
      // enclosed ferry waiting hall on the pier
      {
        const hx0 = -88, hx1 = -78, hz0 = 615, hz1 = 624, hy = 0.47;
        const hall = new THREE.Group(); hall.name = 'ferry-waiting-hall';
        const wallM = new THREE.MeshStandardMaterial({ color: 0x3a4038, roughness: 0.7 });
        const floorM = new THREE.MeshStandardMaterial({ color: 0x6a645a, roughness: 0.6 });
        const woodM = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.55 });
        const f = new THREE.Mesh(boxGeo(hx1 - hx0, 0.12, hz1 - hz0, 3, 3), floorM); f.position.set(-83, hy - 0.06, 619.5); hall.add(f);
        const c2 = new THREE.Mesh(boxGeo(hx1 - hx0, 0.1, hz1 - hz0, 3, 3), wallM); c2.position.set(-83, hy + 3.2, 619.5); hall.add(c2);
        const wN = new THREE.Mesh(boxGeo(hx1 - hx0, 3.2, 0.2, 3, 3), wallM); wN.position.set(-83, hy + 1.6, hz0); hall.add(wN);
        const wS = new THREE.Mesh(boxGeo(hx1 - hx0, 3.2, 0.2, 3, 3), wallM); wS.position.set(-83, hy + 1.6, hz1); hall.add(wS);
        const wW = new THREE.Mesh(boxGeo(0.2, 3.2, hz1 - hz0, 3, 3), wallM); wW.position.set(hx0, hy + 1.6, 619.5); hall.add(wW);
        // east wall either side of the 2.2 m glass door
        for (const [za, zb] of [[hz0, 618.4], [620.6, hz1]]) { const sw = new THREE.Mesh(boxGeo(0.2, 3.2, zb - za, 3, 3), wallM); sw.position.set(hx1, hy + 1.6, (za + zb) / 2); hall.add(sw); }
        const dg = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), new THREE.MeshStandardMaterial({ color: 0x9fc4d2, transparent: true, opacity: 0.14, roughness: 0.1 })); dg.position.set(hx1 - 0.02, hy + 1.3, 619.5); dg.rotation.y = Math.PI / 2; hall.add(dg);
        // waiting benches
        for (let i = 0; i < 3; i++) {
          const seat = new THREE.Mesh(boxGeo(1.8, 0.1, 0.55, 3, 2), woodM); seat.position.set(-85.6 + i * 2.4, hy + 0.55, 617.2); hall.add(seat);
          const back = new THREE.Mesh(boxGeo(1.8, 0.55, 0.1, 3, 2), woodM); back.position.set(-85.6 + i * 2.4, hy + 0.82, 616.95); hall.add(back);
          for (const lx of [-0.75, 0.75]) { const leg = new THREE.Mesh(boxGeo(0.08, 0.55, 0.4, 1, 1), M.darkMetal); leg.position.set(-85.6 + i * 2.4 + lx, hy + 0.27, 617.2); hall.add(leg); }
        }
        // departure board
        const bc = makeCanvas(512, 256), bx = bc.getContext('2d');
        bx.fillStyle = '#0a1216'; bx.fillRect(0, 0, 512, 256); bx.strokeStyle = '#6fd8ff'; bx.lineWidth = 3; bx.strokeRect(4, 4, 504, 248);
        bx.fillStyle = '#9fe8ff'; bx.textAlign = 'center'; bx.font = '700 34px "PingFang SC",sans-serif'; bx.fillText('东晟路渡口', 256, 50);
        bx.fillStyle = '#6fd8ff'; bx.font = '500 15px monospace'; bx.fillText('DONGSHENG FERRY · DEPARTURES', 256, 78);
        bx.textAlign = 'left'; bx.font = '500 19px monospace'; bx.fillStyle = '#e8f4f8';
        [['16:10', '十八埠'], ['16:40', '金澜东路'], ['17:10', '十八埠'], ['17:40', '金澜东路']].forEach((row, i) => { bx.fillText(row[0], 60, 120 + i * 32); bx.fillText(row[1], 200, 120 + i * 32); bx.fillStyle = '#6a8a96'; bx.fillText('正点', 380, 120 + i * 32); bx.fillStyle = '#e8f4f8'; });
        const btex = canvasTexture(bc, true, 1, 1, 4);
        const board = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshBasicMaterial({ map: btex, color: new THREE.Color(1.5, 1.8, 2.0) }));
        board.position.set(-87.85, hy + 2.2, 619.5); board.rotation.y = Math.PI / 2; hall.add(board);
        // gate posts, vending, sign and people
        for (const sz of [-0.6, 0.6]) { const gp = new THREE.Mesh(boxGeo(0.2, 1.2, 0.2, 2, 2), M.darkMetal); gp.position.set(-79.2, hy + 0.6, 619.5 + sz); hall.add(gp); }
        const vend = new THREE.Mesh(boxGeo(0.7, 1.8, 0.6, 2, 2), M.darkMetal); vend.position.set(-87.5, hy + 0.9, 615.9); hall.add(vend);
        const vg = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.1), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.0, 1.4) })); vg.position.set(-87.1, hy + 1.0, 615.95); vg.rotation.y = Math.PI / 2; hall.add(vg);
        const sc = makeCanvas(512, 128), sx2 = sc.getContext('2d');
        sx2.fillStyle = '#0a1216'; sx2.fillRect(0, 0, 512, 128); sx2.strokeStyle = '#9fe8ff'; sx2.lineWidth = 4; sx2.strokeRect(4, 4, 504, 120);
        sx2.fillStyle = '#e8f6f8'; sx2.textAlign = 'center'; sx2.font = '700 46px "PingFang SC",sans-serif'; sx2.fillText('候船厅', 256, 58);
        sx2.fillStyle = '#9fe8ff'; sx2.font = '500 18px monospace'; sx2.fillText('WAITING HALL', 256, 98);
        const stex = canvasTexture(sc, true, 1, 1, 4);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.7), new THREE.MeshBasicMaterial({ map: stex, color: new THREE.Color(1.3, 1.6, 1.8) }));
        sign.position.set(-83, hy + 2.8, 623.85); sign.rotation.y = Math.PI; hall.add(sign);
        hall.add(G.people.crowd([
          { look: {}, pose: 'sit', x: -85.9, y: hy + 0.11, z: 617.3, ry: 0 },
          { look: { acc: ['tote'] }, pose: 'sit', x: -83.0, y: hy + 0.11, z: 617.3, ry: 0.2 },
          { look: { acc: ['backpack'] }, pose: 'stand', x: -84.6, y: hy, z: 620.6, ry: -Math.PI / 2 },
        ], 'ferry-hall-people'));
        hall.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; } });
        scene.add(hall);
        C.ferryHall = { x0: hx0, x1: hx1, z0: hz0, z1: hz1, y: hy, door: [hx1, 619.5], inside: [-80.6, 619.5] };
        add({ x0: hx0, x1: hx1, z0: hz0 - 0.2, z1: hz0, y0: 0, y1: hy + 3.2, kind: 'ferry-hall-wall' });
        add({ x0: hx0, x1: hx1, z0: hz1, z1: hz1 + 0.2, y0: 0, y1: hy + 3.2, kind: 'ferry-hall-wall' });
        add({ x0: hx0 - 0.2, x1: hx0, z0: hz0, z1: hz1, y0: 0, y1: hy + 3.2, kind: 'ferry-hall-wall' });
        add({ x0: hx1 - 0.1, x1: hx1 + 0.1, z0: hz0, z1: 618.4, y0: 0, y1: hy + 3.2, kind: 'ferry-hall-wall' });
        add({ x0: hx1 - 0.1, x1: hx1 + 0.1, z0: 620.6, z1: hz1, y0: 0, y1: hy + 3.2, kind: 'ferry-hall-wall' });
      }

      // walkable pier region + access
      C.ferryPier = { x0: -88, x1: -59, z0: 613.5, z1: 626.5, y: 0.47 };
    }

  }

  // ------------------------------------------------------------- Millennium Ave median + 千禧之光
  {
    const med = new GB(), hedge = new GB();
    for (const r of ROADS) {
      if (!(r.name || '').includes('千禧大道') || r.width < 18) continue;
      addRibbon(med, r.samp, -2.2, 2.2, 0.44, 4, 4, new THREE.Color(0x6b655a), (x, z) => isCross(x, z, r));
      addRibbon(hedge, r.samp, -1.8, 1.8, 0.85, 2, 2, new THREE.Color(0x17301f), (x, z) => isCross(x, z, r));
    }
    if (med.pos.length) {
      const mm = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.8 }); mm.userData.surfaceProcedural = true;
      const m = new THREE.Mesh(med.build(true), mm); m.name = 'millennium-median'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m);
    }
    if (hedge.pos.length) {
      const m = new THREE.Mesh(hedge.build(true), new THREE.MeshStandardMaterial({ color: 0x1c3a26, roughness: 0.9 })); m.name = 'millennium-hedges'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m);
    }
    const sx = -26, sz = 138;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.45, 32, 96), new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.35, metalness: 0.85, envMapIntensity: 1.6 }));
    ring.rotation.y = 0.5; ring.position.set(sx, 8.4, sz); ring.userData.passable = true; ring.userData.surfaceProcedural = true; ring.name = 'millennium-light-ring'; scene.add(ring);
    const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.55, 16, 32), new THREE.MeshStandardMaterial({ color: 0x6f552f, roughness: 0.4, metalness: 0.8 }));
    spike.position.set(sx, 4.5, sz); spike.rotation.z = 0.35; spike.userData.passable = true; spike.userData.surfaceProcedural = true; scene.add(spike);
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6.2, 0.8, 32), M.curb); plinth.position.set(sx, 0.4, sz); plinth.userData.passable = true; plinth.userData.surfaceProcedural = true; scene.add(plinth);
    // two crossed boxes follow the round plinth closely enough not to read as a wall
    add({ x0: sx - 6.0, x1: sx + 6.0, z0: sz - 2.6, z1: sz + 2.6, y0: 0, y1: 2, kind: 'sculpture' });
    add({ x0: sx - 2.6, x1: sx + 2.6, z0: sz - 6.0, z1: sz + 6.0, y0: 0, y1: 2, kind: 'sculpture' });
    add({ x0: sx - 4.6, x1: sx + 4.6, z0: sz - 4.6, z1: sz + 4.6, y0: 0, y1: 2, kind: 'sculpture' });
  }



  // ------------------------------------------------------------- small street props at the opening
  // Shanghai kerbside furniture: sorted-waste wheelie bins, stainless bollards,
  // a chalk sandwich board outside the café, hydrants. Every prop is checked
  // against the carriageways so nothing sits in a lane.
  {
    const hyd = [], steel = [], bins = [], boardF = [], boardFace = [];
    const CARS = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'secondary_link', 'tertiary_link', 'residential', 'unclassified', 'primary_link', 'trunk_link', 'service']);
    const offRoad = (x, z, pad = 0.6) => !C.roads.some((r) => r.samp && r.half > 0 && CARS.has(r.hw) && r.samp.some((p, i) => {
      const q = r.samp[i + 1]; if (!q) return false;
      const ux = q[0] - p[0], uz = q[1] - p[1], L2 = ux * ux + uz * uz || 1, t = clamp(((x - p[0]) * ux + (z - p[1]) * uz) / L2, 0, 1);
      return Math.hypot(x - p[0] - ux * t, z - p[1] - uz * t) < r.half + pad;
    }));
    for (const [hx, hz] of [[-2.2, 154], [3.2, 170]]) {
      if (!offRoad(hx, hz)) continue;
      hyd.push({ geometry: new THREE.CylinderGeometry(0.13, 0.16, 0.64, 24), matrix: M4(hx, 0.49, hz) });
      hyd.push({ geometry: new THREE.CylinderGeometry(0.2, 0.2, 0.06, 24), matrix: M4(hx, 0.2, hz) });
      hyd.push({ geometry: new THREE.SphereGeometry(0.135, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), matrix: M4(hx, 0.81, hz) });
      for (const a of [0, Math.PI]) hyd.push({ geometry: new THREE.CylinderGeometry(0.05, 0.05, 0.12, 12), matrix: M4(hx + Math.cos(a) * 0.17, 0.6, hz + Math.sin(a) * 0.17, 0, 0, Math.PI / 2) });
      add({ x0: hx - 0.2, x1: hx + 0.2, z0: hz - 0.2, z1: hz + 0.2, y0: 0, y1: 0.9, kind: 'hydrant' });
    }
    // stainless bollards where the old meters stood: a ring of reflective tape near the top
    for (let i = 0; i < 5; i++) {
      const bx = -3.4 + i * 1.5, bz = 151.5; if (!offRoad(bx, bz, 0.3)) continue;
      steel.push({ geometry: new THREE.CylinderGeometry(0.075, 0.085, 0.8, 24), matrix: M4(bx, 0.57, bz), color: new THREE.Color(0xc8ccd0) });
      steel.push({ geometry: new THREE.SphereGeometry(0.075, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), matrix: M4(bx, 0.97, bz), color: new THREE.Color(0xc8ccd0) });
      steel.push({ geometry: new THREE.CylinderGeometry(0.079, 0.079, 0.06, 24), matrix: M4(bx, 0.86, bz), color: new THREE.Color(2.2, 0.5, 0.25) });
      steel.push({ geometry: new THREE.CylinderGeometry(0.13, 0.13, 0.02, 24), matrix: M4(bx, 0.18, bz), color: new THREE.Color(0x8a8e92) });
      add({ x0: bx - 0.12, x1: bx + 0.12, z0: bz - 0.12, z1: bz + 0.12, y0: 0, y1: 1.0, kind: 'bollard' });
    }
    // 240 L wheelie bins in the city's four sorting colours, lids, handles, wheels, a white label band
    const SORT = [[0x2a2b2d, 0xe8e8e8], [0x6a4428, 0xe8e8e8], [0x1f5fa8, 0xe8e8e8], [0xb8322a, 0xe8e8e8]];
    for (const [bx, bz, ry] of [[-1.5, 147, 0.1], [4.8, 154, -0.2], [-6.2, 163, 0.25]]) {
      if (!offRoad(bx, bz)) continue;
      for (let k = 0; k < 2; k++) {
        const [body, band] = SORT[(k + Math.round(bx)) & 3], c = new THREE.Color(body);
        const ox = bx + Math.cos(ry) * (k - 0.5) * 0.68, oz = bz - Math.sin(ry) * (k - 0.5) * 0.68;
        const P = (g, x, y, z, col, rx = 0, rz = 0) => bins.push({ geometry: g, matrix: M4(ox, 0, oz, ry).multiply(M4(x, y, z, 0, rx, rz)), color: col });
        P(new THREE.CylinderGeometry(0.36, 0.3, 0.94, 4, 1).rotateY(Math.PI / 4), 0, 0.6, 0, c);
        P(boxGeo(0.6, 0.05, 0.62, 1, 1), 0, 1.09, 0.02, c.clone().multiplyScalar(0.8));
        P(boxGeo(0.54, 0.08, 0.06, 1, 1), 0, 1.04, -0.33, c.clone().multiplyScalar(0.7));
        P(boxGeo(0.52, 0.11, 0.01, 1, 1), 0, 0.88, 0.345, new THREE.Color(band), -0.06);
        P(new THREE.CylinderGeometry(0.018, 0.018, 0.48, 8), 0, 1.0, -0.38, new THREE.Color(0x2a2a2a), 0, Math.PI / 2);
        for (const s of [-1, 1]) P(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), s * 0.26, 0.1, -0.24, new THREE.Color(0x111214), 0, Math.PI / 2);
      }
      add({ x0: bx - 0.75, x1: bx + 0.75, z0: bz - 0.45, z1: bz + 0.45, y0: 0, y1: 1.1, kind: 'bins' });
    }
    // sandwich board: a wooden A-frame with a chalk menu on each face
    const bc = makeCanvas(256, 384), bx2 = bc.getContext('2d');
    bx2.fillStyle = '#1d2422'; bx2.fillRect(0, 0, 256, 384);
    for (let i = 0; i < 900; i++) { bx2.fillStyle = `rgba(255,255,255,${(Math.random() * 0.035).toFixed(3)})`; bx2.fillRect(Math.random() * 256, Math.random() * 384, 3, 2); }
    bx2.textAlign = 'center'; bx2.fillStyle = '#f2ecd8'; bx2.font = '700 40px "PingFang SC","Hiragino Sans GB",sans-serif'; bx2.fillText('今日特调', 128, 70);
    bx2.strokeStyle = '#e8c870'; bx2.lineWidth = 2; bx2.beginPath(); bx2.moveTo(40, 92); bx2.lineTo(216, 92); bx2.stroke();
    bx2.font = '500 26px "PingFang SC","Hiragino Sans GB",sans-serif';
    [['热红酒', '18'], ['桂花拿铁', '26'], ['手冲 · 云南', '32'], ['可颂', '12']].forEach(([n, p], i) => { bx2.textAlign = 'left'; bx2.fillStyle = '#efe8d4'; bx2.fillText(n, 30, 146 + i * 46); bx2.textAlign = 'right'; bx2.fillStyle = '#ffd27a'; bx2.fillText('¥' + p, 228, 146 + i * 46); });
    bx2.textAlign = 'center'; bx2.fillStyle = '#9fd8c8'; bx2.font = '500 22px "PingFang SC",sans-serif'; bx2.fillText('雨天 · 第二杯半价', 128, 350);
    const btex = canvasTexture(bc, true, 1, 1, 4);
    for (const [ax, az, ry] of [[1.2, 158, 0.35], [-8.5, 142, -0.4]]) {
      if (!offRoad(ax, az)) continue;
      for (const s of [-1, 1]) {
        const base = M4(ax, 0.17, az, ry).multiply(M4(0, 0, s * 0.2, 0, -s * 0.2));
        const at = (x, y, z, rx = 0) => base.clone().multiply(M4(x, y, z, 0, rx));
        for (const x of [-0.3, 0.3]) boardF.push({ geometry: boxGeo(0.04, 1.0, 0.035, 1, 1), matrix: at(x, 0.5, 0) });
        for (const y of [0.16, 0.96]) boardF.push({ geometry: boxGeo(0.64, 0.05, 0.035, 1, 1), matrix: at(0, y, 0) });
        const g = new THREE.PlaneGeometry(0.56, 0.76); if (s < 0) g.rotateY(Math.PI);
        boardFace.push({ geometry: g, matrix: at(0, 0.56, s * 0.02) });
      }
      add({ x0: ax - 0.4, x1: ax + 0.4, z0: az - 0.4, z1: az + 0.4, y0: 0, y1: 1.1, kind: 'a-board' });
    }
    const put = (list, mat, name) => { if (!list.length) return; const m = new THREE.Mesh(mergeGeoms(list, { vertexColors: list.some((i) => i.color) }), mat); m.name = name; m.castShadow = true; m.receiveShadow = true; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m); };
    const hm = new THREE.MeshStandardMaterial({ color: 0xb03a28, roughness: 0.42, metalness: 0.25 }); hm.userData.surfaceProcedural = true;
    put(hyd, hm, 'fire-hydrants');
    const stm = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.22, metalness: 0.85, envMapIntensity: 1.6 }); stm.userData.surfaceProcedural = true;
    put(steel, stm, 'kerb-bollards');
    const bim = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.48, metalness: 0.0, envMapIntensity: 1.2 }); bim.userData.surfaceProcedural = true;
    put(bins, bim, 'sorting-bins');
    const wm = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.6 }); wm.userData.surfaceProcedural = true;
    put(boardF, wm, 'a-frame-board-frames');
    const fm = new THREE.MeshStandardMaterial({ map: btex, roughness: 0.85, emissiveMap: btex, emissive: 0xffffff, emissiveIntensity: 0.18 }); fm.userData.surfaceProcedural = true;
    put(boardFace, fm, 'a-frame-board-menus');
  }

  // ------------------------------------------------------------- opening bus shelter
  {
    const g = new THREE.Group();
    const roof = new THREE.Mesh(boxGeo(5.2, 0.16, 2.6, 3, 2), M.darkMetal); roof.position.y = 2.7; g.add(roof);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.2), new THREE.MeshStandardMaterial({ color: 0x9fc4d2, roughness: 0.15, metalness: 0.4, transparent: true, opacity: 0.35 })); glass.position.set(0, 1.4, -1.2); g.add(glass);
    for (const sx of [-2.4, 2.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.7, 32), M.metal); p.position.set(sx, 1.35, 0); g.add(p); }
    const bench = new THREE.Mesh(boxGeo(3.4, 0.1, 0.5, 2, 1), M.wood); bench.position.set(0, 0.55, -0.9); g.add(bench);
    const c = makeCanvas(256, 128), ctx = c.getContext('2d'); ctx.fillStyle = '#0d1a24'; ctx.fillRect(0, 0, 256, 128); ctx.fillStyle = '#e8c46a'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '700 38px "PingFang SC",sans-serif'; ctx.fillText('环港广场', 128, 46); ctx.font = '500 18px monospace'; ctx.fillStyle = '#9fc4d2'; ctx.fillText('BUS  ·  HUAN’GANG', 128, 86);
    const bt = canvasTexture(c, true, 1, 1, 4);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.65), new THREE.MeshStandardMaterial({ map: bt, emissiveMap: bt, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.5 }));
    board.position.set(0, 2.1, -1.24); g.add(board);
    g.position.set(-7.5, 0.17, 158); g.rotation.y = Math.PI; g.userData.passable = true; g.userData.surfaceProcedural = true; g.name = 'bus-shelter';
    g.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; } });
    scene.add(g);
    add({ x0: -10.2, x1: -4.8, z0: 156.6, z1: 159.4, y0: 0, y1: 2.9, kind: 'bus-shelter' });
    // waiting commuters at the shelter
    scene.add(G.people.crowd([
      { look: { acc: ['tote'] }, pose: 'sit', x: -8.3, y: 0.28, z: 158.85, ry: Math.PI },
      { look: {}, pose: 'sit', x: -6.6, y: 0.28, z: 158.85, ry: Math.PI - 0.2 },
      { look: { hold: 'phone' }, pose: 'phone', x: -9.5, y: 0.17, z: 157.5, ry: Math.PI + 0.5 },
      { look: { acc: ['backpack'] }, pose: 'stand', x: -5.4, y: 0.17, z: 157.6, ry: Math.PI - 0.4 },
    ], 'bus-stop-people'));

  }

  // ------------------------------------------------------------- photo spots + start  // ------------------------------------------------------------- photo spots + start
  function isOpen(x, z, pad = 1.5) {
    if (!IN(x, z, -2)) return false;
    if (pointInWater(x, z)) return false;
    for (const b of buildingBoxes) {
      if (x > b.x0 - pad && x < b.x1 + pad && z > b.z0 - pad && z < b.z1 + pad) return false;
    }
    return true;
  }
  C.isOpen = isOpen;
  function findOpen(x, z, rad = 30) {
    if (isOpen(x, z)) return [x, z];
    for (let r = 4; r <= rad; r += 4) {
      for (let a = 0; a < 16; a++) {
        const t = a / 16 * Math.PI * 2;
        const nx = x + Math.cos(t) * r, nz = z + Math.sin(t) * r;
        if (isOpen(nx, nz)) return [nx, nz];
      }
    }
    return [x, z];
  }
  C.spots = [
    { id: 'pearl', name: '星珠塔', en: 'STAR PEARL', kind: 'pearl', pos: [-390, -430], target: [-412, 190, -494], radius: 30, maxDist: 200, score: 0 },
    { id: 'modu', name: '魔都中心', en: 'MODU TOWER', kind: 'tower', pos: [120, 260], target: [168, 300, 209], radius: 30, maxDist: 200, score: 0 },
    { id: 'yunque', name: '云阙金融中心', en: 'YUNQUE', kind: 'bottle', pos: [310, 40], target: [337, 270, 103], radius: 30, maxDist: 190, score: 0 },
    { id: 'jinyue', name: '金岳大厦', en: 'JINYUE', kind: 'gold', pos: [150, 90], target: [183, 210, 28], radius: 30, maxDist: 180, score: 0 },
    { id: 'lantan', name: '澜滩对望', en: 'LANTAN WATERFRONT', kind: 'lantan', pos: [-630, 104], target: [-1150, 40, 100], radius: 40, maxDist: 800, score: 0, fixed: true },
    { id: 'ferry', name: '东晟路渡口', en: 'DONGSHENG FERRY', kind: 'ferry', pos: [C.ferry[0], C.ferry[1]], radius: 26, target: null, score: 0 },
  ];
  C.spots.forEach((s) => {
    if (s.id === 'ferry' || s.fixed) return;
    const [x, z] = findOpen(s.pos[0], s.pos[1], 34);
    s.pos = [x, z];
  });
  function nearestRoadPoint(x, z) {
    let best = null, bd = 1e9;
    for (const r of ROADS) {
      for (const p of r.samp) {
        const d = (p[0] - x) ** 2 + (p[1] - z) ** 2;
        if (d < bd) { bd = d; best = p; }
      }
    }
    return best ? [best[0], best[1]] : [x, z];
  }
  function nearestRoadInfo(x, z) {
    let best = null, bd = 1e9;
    for (const r of ROADS) {
      for (let i = 0; i < r.samp.length - 1; i++) {
        const a = r.samp[i], b = r.samp[i + 1];
        const d = Math.hypot((a[0] + b[0]) / 2 - x, (a[1] + b[1]) / 2 - z);
        if (d < bd) { bd = d; best = { x: (a[0] + b[0]) / 2, z: (a[1] + b[1]) / 2, tx: b[0] - a[0], tz: b[1] - a[1], w: r.width }; }
      }
    }
    if (!best) return { x, z, yaw: Math.PI, nx: 0, nz: 1 };
    const l = Math.hypot(best.tx, best.tz) || 1;
    const tx = best.tx / l, tz = best.tz / l;
    return { x: best.x, z: best.z, tx, tz, yaw: Math.atan2(tx, tz), nx: tz, nz: -tx, w: best.w };
  }
  const st = findOpen(C.start[0], C.start[1], 30); C.start = st;
  const ci = nearestRoadInfo(C.carStart[0], C.carStart[1]);
  C.carStart = findOpen(ci.x + ci.nx * Math.max(3.8, ci.w * 0.5 - 1.1), ci.z + ci.nz * Math.max(3.8, ci.w * 0.5 - 1.1), 14);
  C.carYaw = ci.yaw + Math.PI;
  const ti = nearestRoadInfo(C.taxiStart[0], C.taxiStart[1]);
  C.taxiStart = findOpen(ti.x - ti.nx * Math.max(3.8, ti.w * 0.5 - 1.1), ti.z - ti.nz * Math.max(3.8, ti.w * 0.5 - 1.1), 14);
  C.taxiYaw = ti.yaw;
  const sideX = Math.cos(C.carYaw), sideZ = -Math.sin(C.carYaw);
  C.start = findOpen(C.carStart[0] + sideX * 2.2, C.carStart[1] + sideZ * 2.2, 10);
  // a zebra crossing directly ahead of the opening, on the car's road
  {
    const ci2 = nearestRoadInfo(C.carStart[0], C.carStart[1]);
    const fx = Math.sin(C.carYaw), fz = Math.cos(C.carYaw);
    const wHalf = clamp((ci2.w || 10) * 0.5 - 0.55, 3.4, 11);
    const cx0 = C.start[0] + fx * 16, cz0 = C.start[1] + fz * 16;
    const bars = [];
    for (let k = 0; k < 7; k++) {
      const bx = cx0 + fx * (k - 3) * 0.95, bz = cz0 + fz * (k - 3) * 0.95;
      bars.push({ geometry: boxGeo(wHalf * 2, 0.018, 0.52, 3, 1), matrix: M4(bx, 0.055, bz, C.carYaw) });
    }
    const sx = cx0 - fx * 8.5, sz = cz0 - fz * 8.5;
    bars.push({ geometry: boxGeo(wHalf * 2, 0.018, 0.4, 3, 1), matrix: M4(sx, 0.055, sz, C.carYaw) });
    const wm = new THREE.MeshStandardMaterial({ color: 0xe9e5d8, roughness: 0.42, metalness: 0.02, emissive: 0x1b1811, emissiveIntensity: 0.55 });
    wm.userData.surfaceProcedural = true;
    const m = new THREE.Mesh(mergeGeoms(bars), wm);
    m.name = 'start-zebra-crossing'; m.userData.passable = true; m.userData.surfaceProcedural = true; scene.add(m);
  }



  G.CITY = C;

  // ------------------------------------------------------------- rain
  const rainCount = 2000;
  const rainGeo = new THREE.BufferGeometry();
  const rp = new Float32Array(rainCount * 2 * 3), rs = new Float32Array(rainCount * 2);
  for (let i = 0; i < rainCount; i++) {
    const x = R(-60, 60), z = R(-60, 60), y = R(0, 40);
    rp[i * 6] = x; rp[i * 6 + 1] = y; rp[i * 6 + 2] = z;
    rp[i * 6 + 3] = x + 0.12; rp[i * 6 + 4] = y - 0.55; rp[i * 6 + 5] = z + 0.06;
    rs[i * 2] = R(0, 1); rs[i * 2 + 1] = R(0, 1);
  }
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  rainGeo.setAttribute('aSeed', new THREE.BufferAttribute(rs, 1));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.13 } },
    vertexShader: `attribute float aSeed; varying float vA; uniform float uTime;
      void main(){ vec3 p = position; float fall = mod(p.y - uTime*(22.0+aSeed*8.0), 40.0); p.y = fall;
        p.x += sin(uTime*0.7+aSeed*6.28)*0.4; vec4 mv = modelViewMatrix * vec4(p,1.0);
        vA = smoothstep(0.0, 3.0, -mv.z) * (0.35 + aSeed*0.65); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; uniform float uOpacity; void main(){ gl_FragColor = vec4(0.62,0.74,0.88, vA*uOpacity); }`,
  });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false; rain.name = 'rain'; rain.userData.passable = true; rain.userData.surfaceProcedural = true;
  scene.add(rain); G.rain = rain; G.rainMat = rainMat; G.noReflect.push(rain);

  // ------------------------------------------------------------- doorways for the taxi: a compact graph
  {
    const nodes = [], edges = [];
    const graphRoads = ROADS.filter((r) => r.width >= 7 && IN(r.samp[0][0], r.samp[0][1], 200)).slice(0, 260);
    for (const r of graphRoads) {
      let acc = 0;
      const ids = [];
      for (let i = 0; i < r.samp.length; i++) {
        const p = r.samp[i];
        if (i === 0 || acc > 26) {
          ids.push(nodes.length);
          nodes.push({ x: p[0], z: p[1], road: r.id });
          acc = 0;
        }
        if (i < r.samp.length - 1) acc += Math.hypot(r.samp[i + 1][0] - p[0], r.samp[i + 1][1] - p[1]);
      }
      for (let i = 0; i < ids.length - 1; i++) edges.push([ids[i], ids[i + 1], Math.hypot(nodes[ids[i]].x - nodes[ids[i + 1]].x, nodes[ids[i]].z - nodes[ids[i + 1]].z)]);
    }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].road === nodes[j].road) continue;
      const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z);
      if (d < 11) edges.push([i, j, d]);
    }
    C.graph = { nodes, edges };
  }
  G.__READY_HOOKS = G.__READY_HOOKS || [];
})();
