/* 18-bridges — the Shenjiang bridges, at their surveyed positions.
   The Linjiangzui reach of the river has no bridge at all: it is crossed by the
   怀远东路 / 安民路 / 新晟路 road tunnels, the Lantan sightseeing tunnel and the
   metro. The nearest bridge, 南澜, is 2.7 km upstream of the ferry pier; 东澜
   is 4.7 km downstream and 西澜 6 km upstream. They are therefore distant
   skyline objects, seen from the air, a rooftop or a long lens, never from
   the promenade. Centres, bearings and lengths are the OSM bridge outlines
   (man_made=bridge) in this map's projection; the river beyond the map
   follows the OSM centre line. */
(function () {
  const G = window.__G, THREE = G.THREE, scene = G.scene, C = G.CITY;
  const { lerp, mergeGeoms, makeCanvas, canvasTexture } = G.util;
  const X = new THREE.Vector3(1, 0, 0), ONE = new THREE.Vector3(1, 1, 1);
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const mark = (o, name) => { o.name = name; o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = false; return o; };

  // Lit steel and floodlit concrete carry through the night haze much further
  // than the unlit city does, so these materials fog at a fraction of the
  // scene density instead of vanishing at 2 km.
  function haze(mat, k) {
    mat.onBeforeCompile = (s) => {
      s.fragmentShader = s.fragmentShader.replace('#include <fog_fragment>', `
        #ifdef USE_FOG
          float hzD = fogDensity * ${k.toFixed(3)};
          gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, 1.0 - exp(-hzD * hzD * vFogDepth * vFogDepth));
        #endif`);
    };
    mat.customProgramCacheKey = () => 'far-haze-' + k;
    return mat;
  }
  const MAT = {
    warm: haze(new THREE.MeshStandardMaterial({ color: 0xb9b1a2, roughness: 0.82, emissive: 0x7a6548, emissiveIntensity: 0.6 }), 0.5),
    cool: haze(new THREE.MeshStandardMaterial({ color: 0xdfe5ea, roughness: 0.55, metalness: 0.2, emissive: 0x6f8296, emissiveIntensity: 0.7 }), 0.5),
    dark: haze(new THREE.MeshStandardMaterial({ color: 0x4b5057, roughness: 0.7, metalness: 0.25, emissive: 0x15181c, emissiveIntensity: 0.6 }), 0.55),
    cable: haze(new THREE.LineBasicMaterial({ color: new THREE.Color(1.0, 0.93, 0.8), transparent: true, opacity: 0.13, depthWrite: false }), 0.45),
    lamp: haze(new THREE.PointsMaterial({ color: new THREE.Color(2.4, 1.85, 1.1), size: 2.2, sizeAttenuation: false }), 0.35),
    beacon: haze(new THREE.PointsMaterial({ color: new THREE.Color(4.0, 0.3, 0.22), size: 3.2, sizeAttenuation: false }), 0.3),
  };

  // ---------------------------------------------------------------- river and plain beyond the map
  {
    // the city beyond the map: unlit ground carrying a tile of street lamps and lit windows
    const c = makeCanvas(1024, 1024), k = c.getContext('2d');
    k.fillStyle = '#000'; k.fillRect(0, 0, 1024, 1024);
    let seed = 20231; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const lamp = ['#ffc98a', '#ffd9a8', '#ffe9cf', '#dfe8ff'];
    for (let g = 0; g < 9; g++) {
      const o = 60 + g * 114 + (rnd() - 0.5) * 50, vertical = g % 2 === 0;
      for (let t = 0; t < 1024; t += 30 + rnd() * 10) {
        k.fillStyle = lamp[(rnd() * 2.2) | 0]; k.globalAlpha = 0.5 + rnd() * 0.5;
        const w = rnd() < 0.2 ? 3 : 2;
        if (vertical) k.fillRect(o, t, w, w); else k.fillRect(t, o, w, w);
      }
    }
    for (let i = 0; i < 520; i++) {
      const x = rnd() * 1024, y = rnd() * 1024, n = 1 + ((rnd() * 5) | 0);
      k.fillStyle = lamp[(rnd() * 4) | 0];
      for (let j = 0; j < n; j++) { k.globalAlpha = 0.2 + rnd() * 0.6; k.fillRect(x + (rnd() - 0.5) * 16, y + (rnd() - 0.5) * 16, 2, 2); }
    }
    k.globalAlpha = 1;
    const tex = canvasTexture(c, true, 30, 30, 8);
    const far = haze(new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 1, metalness: 0, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 1.5, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2000 }), 0.7);
    const g = new THREE.PlaneGeometry(24000, 24000); g.rotateX(-Math.PI / 2);
    // fade out before the far plane so the plain never ends in a hard line against the sky
    const fogOnly = far.onBeforeCompile;
    far.transparent = true; far.depthWrite = false;
    far.onBeforeCompile = (s) => {
      fogOnly(s);
      s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor.a *= 1.0 - smoothstep(5200.0, 7800.0, vFogDepth);');
    };
    far.customProgramCacheKey = () => 'land-far-fade';
    const m = mark(new THREE.Mesh(g, far), 'land-far'); m.position.set(800, -0.4, 1000); m.renderOrder = -10; scene.add(m);
  }
  // centre line and half width; each reach starts inside the OSM water polygon
  const REACH = {
    upstream: [[589, 2240, 182], [550, 2527, 185], [393, 2862, 188], [113, 3338, 186], [-147, 3781, 195], [-396, 4205, 200], [-640, 4570, 205], [-1139, 4899, 210], [-2200, 5160, 214], [-2628, 5304, 220], [-3277, 5648, 225], [-3652, 6124, 225], [-3725, 6421, 225]],
    downstream: [[800, -1297, 232], [1202, -1332, 235], [2522, -1345, 255], [3303, -1688, 275], [3732, -2016, 280], [3992, -2207, 280], [4598, -2718, 290], [5154, -3184, 300], [5682, -3700, 300]],
  };
  for (const key in REACH) {
    const pts = REACH[key], pos = [], nor = [], uv = [];
    const edge = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const nx = (b[1] - a[1]) / l, nz = -(b[0] - a[0]) / l;
      return [[p[0] + nx * p[2], p[1] + nz * p[2]], [p[0] - nx * p[2], p[1] - nz * p[2]]];
    });
    for (let i = 0; i < pts.length - 1; i++) {
      for (const q of [edge[i][0], edge[i][1], edge[i + 1][1], edge[i][0], edge[i + 1][1], edge[i + 1][0]]) { pos.push(q[0], 0, q[1]); nor.push(0, 1, 0); uv.push(q[0], -q[1]); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = mark(new THREE.Mesh(g, G.waterMat), 'shenjiang-' + key); m.position.y = 0.035; scene.add(m);
  }

  // ---------------------------------------------------------------- parts, in bridge-local space
  // local +x runs along the deck towards Shendong, y is up, z is across the deck
  function beam(list, a, b, width, depth, extra = 0) {
    const d = b.clone().sub(a), len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(X, d.normalize());
    list.push({ geometry: new THREE.BoxGeometry(len + extra, depth, width), matrix: new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, ONE) });
  }
  const block = (list, w, h, d, x, y, z) => list.push({ geometry: new THREE.BoxGeometry(w, h, d), matrix: new THREE.Matrix4().makeTranslation(x, y, z) });
  // stay cables of one pylon side: n pairs, the longest anchored highest
  function fan(P, px, dir, n, reach0, reach1, yTop0, yTop1, zTop, yDeck, zDeck) {
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1);
      for (const s of [-1, 1]) P.cables.push(px, lerp(yTop0, yTop1, f), s * zTop, px + dir * lerp(reach0, reach1, f), yDeck, s * zDeck);
    }
  }
  function deckLamps(P, x0, x1, y, hw) {
    const n = Math.round((x1 - x0) / 30);
    for (let i = 0; i <= n; i++) for (const s of [-1, 1]) P.lamps.push(lerp(x0, x1, i / n), y + 9.5, s * hw);
  }
  // viaduct from the end of the main bridge down to street level, on piers
  function approach(P, x0, y0, dir, len, width, bend) {
    const n = Math.ceil(len / 45); let p = V3(x0, y0, 0);
    for (let i = 1; i <= n; i++) {
      const t = i / n, s = t * t * (3 - 2 * t);
      const q = V3(x0 + dir * len * t, lerp(y0, 1.2, s), bend * t * t);
      beam(P.dark, p, q, width, 2.2, 0.6);
      if (q.y > 6) block(P.dark, 2.6, q.y, width * 0.5, q.x, q.y / 2 - 1, q.z);
      if (i % 2 === 0) for (const e of [-1, 1]) P.lamps.push(q.x, q.y + 10.5, q.z + e * (width / 2 - 0.5));
      p = q;
    }
  }

  C.bridges = [];
  function bridge(id, name, cx, cz, ax, az, build) {
    const l = Math.hypot(ax, az); ax /= l; az /= l;
    const g = new THREE.Group(); g.name = id + '-bridge'; g.position.set(cx, 0, cz); g.rotation.y = Math.atan2(-az, ax);
    const P = { warm: [], cool: [], dark: [], cables: [], lamps: [], beacons: [], g };
    const info = build(P) || {};
    for (const k of ['warm', 'cool', 'dark']) if (P[k].length) g.add(mark(new THREE.Mesh(mergeGeoms(P[k]), MAT[k]), `${id}-bridge-${k === 'dark' ? 'deck' : 'structure'}`));
    const buf = (arr) => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return b; };
    if (P.cables.length) g.add(mark(new THREE.LineSegments(buf(P.cables), MAT.cable), id + '-bridge-cables'));
    if (P.lamps.length) g.add(mark(new THREE.Points(buf(P.lamps), MAT.lamp), id + '-bridge-lamps'));
    if (P.beacons.length) g.add(mark(new THREE.Points(buf(P.beacons), MAT.beacon), id + '-bridge-beacons'));
    scene.add(g);
    C.bridges.push(Object.assign({ id, name, x: cx, z: cz, ax, az }, info));
  }

  // 南澜大桥 (1991): 423 m main span, 150 m H-shaped pylons, twin fan cable
  // planes, and the double-loop spiral approach on the Shenxi bank.
  bridge('nanlan', '南澜大桥', 136, 3338, 0.919, 0.394, (P) => {
    const E = 380, Y = 46, GIRDER = Y - 1.3;
    beam(P.dark, V3(-E, GIRDER, 0), V3(E, GIRDER, 0), 30.4, 2.6);
    deckLamps(P, -E, E, Y, 14.4);
    for (const px of [-211.5, 211.5]) {
      for (const s of [-1, 1]) {
        beam(P.warm, V3(px, 0, s * 20.5), V3(px, 44, s * 18.2), 5.2, 7.2);
        beam(P.warm, V3(px, 44, s * 18.2), V3(px, 106, s * 13.2), 4.6, 6.4, 1);
        beam(P.warm, V3(px, 106, s * 13.2), V3(px, 150, s * 13.2), 4.2, 5.6);
        P.beacons.push(px, 151.5, s * 13.2);
      }
      block(P.warm, 5.6, 4.6, 38, px, 39.5, 0);
      block(P.warm, 5.2, 7.0, 27, px, 105, 0);
      block(P.warm, 4.6, 3.2, 26, px, 147, 0);
      block(P.dark, 12, 8, 52, px, 2, 0);
      fan(P, px, -Math.sign(px), 22, 16, 205, 110, 146, 13.2, Y + 0.6, 14.6);
      fan(P, px, Math.sign(px), 22, 16, 166, 110, 146, 13.2, Y + 0.6, 14.6);
    }
    for (const px of [-E + 76, E - 76, -E, E]) block(P.dark, 3.2, GIRDER, 24, px, GIRDER / 2 - 1, 0);
    // the inscription on the upper crossbeam, facing the traffic coming on to the bridge
    const c = makeCanvas(512, 128), k = c.getContext('2d');
    k.fillStyle = '#a79f90'; k.fillRect(0, 0, 512, 128);
    k.fillStyle = '#c22a1e'; k.font = '900 96px "Kaiti SC","STKaiti","KaiTi","Songti SC",serif'; k.textAlign = 'center'; k.textBaseline = 'middle';
    k.fillText('南澜大桥', 256, 68);
    const tex = canvasTexture(c, true, 1, 1, 4);
    const sm = haze(new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.75, roughness: 0.8 }), 0.5);
    for (const s of [-1, 1]) {
      const sign = mark(new THREE.Mesh(new THREE.PlaneGeometry(24, 6), sm), 'nanlan-bridge-inscription');
      sign.position.set(s * (211.5 + 2.65), 105, 0); sign.rotation.y = s * Math.PI / 2; P.g.add(sign);
    }
    // Shenxi: the deck runs on 57 m, then winds down two full turns on the upstream
    // (north) side to 江滨南路 and 林家浜路
    const R0 = 112, xc = -E - 57, turns = 2, n = 96;
    let p = V3(xc, GIRDER, 0);
    beam(P.dark, V3(-E, GIRDER, 0), p, 22, 2.4);
    for (let i = 1; i <= n; i++) {
      const f = i / n, a = f * turns * Math.PI * 2;
      const q = V3(xc - R0 * Math.sin(a), lerp(GIRDER, 7, f), R0 * Math.cos(a) - R0);
      beam(P.dark, p, q, 13, 1.8, 1.4);
      if (i % 3 === 0) block(P.dark, 2.2, q.y, 5, q.x, q.y / 2 - 0.9, q.z);
      if (i % 2 === 0) P.lamps.push(xc - (R0 + 6.2) * Math.sin(a), q.y + 9, (R0 + 6.2) * Math.cos(a) - R0);
      p = q;
    }
    beam(P.dark, p, V3(p.x - 150, 1, p.z - 6), 13, 1.8);
    // Shendong: the long viaduct towards 申东南路
    approach(P, E, GIRDER, 1, 1000, 26, -78);
    return { span: 423, h: 150, deckY: Y };
  });

  // 东澜大桥 (1993): 602 m main span, 208 m diamond pylons whose legs meet above
  // the deck, so the two cable planes lean in to a single mast.
  bridge('donglan', '东澜大桥', 3992, -2187, 0.734, 0.679, (P) => {
    const E = 540, Y = 50, GIRDER = Y - 1.4;
    beam(P.dark, V3(-E, GIRDER, 0), V3(E, GIRDER, 0), 30.4, 2.8);
    deckLamps(P, -E, E, Y, 14.4);
    for (const px of [-301, 301]) {
      for (const s of [-1, 1]) {
        beam(P.warm, V3(px, 0, s * 12), V3(px, 46, s * 20.5), 5.4, 7.6);
        beam(P.warm, V3(px, 46, s * 20.5), V3(px, 154, s * 2.4), 4.8, 6.8, 1.2);
      }
      beam(P.warm, V3(px, 152, 0), V3(px, 208, 0), 7.2, 6.4);
      block(P.warm, 6.0, 5.0, 43, px, 42.5, 0);
      block(P.dark, 14, 8, 44, px, 2, 0);
      P.beacons.push(px, 209.5, 0);
      fan(P, px, -Math.sign(px), 32, 20, 292, 158, 204, 1.6, Y + 0.6, 14.6);
      fan(P, px, Math.sign(px), 32, 20, 236, 158, 204, 1.6, Y + 0.6, 14.6);
    }
    for (const px of [-E, -E + 99, E - 99, E]) block(P.dark, 3.4, GIRDER, 24, px, GIRDER / 2 - 1, 0);
    approach(P, -E, GIRDER, -1, 900, 26, -227);
    approach(P, E, GIRDER, 1, 1050, 26, -40);
    return { span: 602, h: 208, deckY: Y };
  });

  // 西澜大桥 (2003): 550 m steel box arch, crown 100 m above the river, the two
  // white ribs leaning in to each other; the deck hangs through them at 50 m.
  bridge('xilan', '西澜大桥', -2200, 5160, 0.322, 0.947, (P) => {
    const H = 275, Y = 50, GIRDER = Y - 1.4;
    const yArch = (x) => 100 - 94 * (x / H) * (x / H), zArch = (y) => lerp(25.5, 5.5, (y - 6) / 94);
    beam(P.dark, V3(-H - 100, GIRDER, 0), V3(H + 100, GIRDER, 0), 29, 2.8);
    deckLamps(P, -H - 100, H + 100, Y, 13.8);
    for (const s of [-1, 1]) {
      let p = null;
      for (let i = 0; i <= 44; i++) {
        const x = -H + 2 * H * i / 44, y = yArch(x), q = V3(x, y, s * zArch(y));
        if (p) beam(P.cool, p, q, 5, 7.6, 0.8);
        p = q;
      }
      for (const e of [-1, 1]) {
        let a = V3(e * H, 6, s * 25.5);
        for (let i = 1; i <= 8; i++) {
          const t = i / 8, b = V3(e * (H + 100 * t), 6 + 41 * (2 * t - t * t), s * lerp(25.5, 17.5, t));
          beam(P.cool, a, b, 4.6, 6.4, 0.6); a = b;
        }
      }
      for (let x = -189; x <= 189.1; x += 13.5) { const y = yArch(x); P.cables.push(x, y - 3.6, s * zArch(y), x, Y, s * 14.2); }
      for (const ax of [216, 232, 248, 264]) for (const e of [-1, 1]) {
        const y = yArch(ax), z = s * zArch(y);
        block(P.cool, 2.2, GIRDER - y, 2.2, e * ax, (GIRDER + y) / 2, z);
      }
    }
    for (const ax of [216, 232, 248, 264]) for (const e of [-1, 1]) block(P.cool, 2.6, 2.2, zArch(yArch(ax)) * 2 + 3, e * ax, GIRDER - 2.4, 0);
    for (let x = -180; x <= 180.1; x += 20) { const y = yArch(x), z = zArch(y); beam(P.cool, V3(x, y, -z), V3(x, y, z), 2.4, 2.4); }
    block(P.cool, 44, 1.2, 13, 0, 104.4, 0);
    for (const e of [-1, 1]) { block(P.dark, 18, 12, 66, e * H, 3, 0); block(P.dark, 6, GIRDER, 36, e * (H + 100), GIRDER / 2 - 1, 0); P.beacons.push(e * 40, 106, 0); }
    P.beacons.push(0, 106, 0);
    approach(P, -H - 100, GIRDER, -1, 950, 26, 35);
    approach(P, H + 100, GIRDER, 1, 850, 26, 0);
    return { span: 550, h: 100, deckY: Y };
  });
})();
