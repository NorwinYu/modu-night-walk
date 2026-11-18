/* 11-people — one human figure shared by the avatar, pedestrians, vendors and
   crowds. A figure is a set of lofted segments in joint-local frames; it can be
   baked into one posed geometry (static crowds), built as a jointed rig
   (avatar, named NPCs) or driven as instanced body parts (street pedestrians).
   Figures face +Z; the left side is +X. Rotations about X: negative swings a
   limb forward, positive backward. */
(function () {
  const G = window.__G, THREE = G.THREE, U = G.util;
  const { mergeGeoms, M4, roundedBox, boxGeo, R, pick } = U;
  const TAU = Math.PI * 2;
  const HIP = 0.92, SHOULDER = 1.415, NECK = 1.52, THIGH = 0.42, UPPER = 0.29;

  function loft(rings, seg, capBottom = true, capTop = true) {
    if (rings[0][0] > rings[rings.length - 1][0]) rings = rings.slice().reverse();
    const pos = [], idx = [];
    for (const [y, rx, rz, ox = 0, oz = 0] of rings) {
      for (let i = 0; i < seg; i++) { const a = i / seg * TAU; pos.push(ox + Math.sin(a) * rx, y, oz + Math.cos(a) * rz); }
    }
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < seg; i++) {
      const a = k * seg + i, b = k * seg + (i + 1) % seg, c = a + seg, d = b + seg;
      idx.push(a, b, c, b, d, c);
    }
    if (capBottom) {
      const r = rings[0], ci = pos.length / 3; pos.push(r[3] || 0, r[0], r[4] || 0);
      for (let i = 0; i < seg; i++) idx.push(ci, (i + 1) % seg, i);
    }
    if (capTop) {
      const k = rings.length - 1, r = rings[k], ci = pos.length / 3; pos.push(r[3] || 0, r[0], r[4] || 0);
      for (let i = 0; i < seg; i++) idx.push(ci, k * seg + i, k * seg + (i + 1) % seg);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }

  const SKIN = [0xe6bd9f, 0xd9ab8a, 0xc99878, 0xecc8ad, 0xb98a68];
  const HAIR = [0x15110e, 0x1f1711, 0x2b1e16, 0x3a2a1c, 0x56504c, 0x6b4a2c];
  const TOPS = [0x23262b, 0x2f3a4c, 0x55606a, 0x7a2e2e, 0xb9b3a6, 0x39503f, 0x8a6a3e, 0xd8d4c8, 0x3a5a86, 0xb5533a, 0x6a5a7a, 0x9aa7b2, 0xc9a24a, 0x24413a];
  const BOTTOMS = [0x1c1f25, 0x262b36, 0x2f3d55, 0x3b3a38, 0x55504a, 0x6f6a5e, 0x1f2a3c];
  const SHOES = [0x15161a, 0x2a2420, 0xd8d6d0, 0x4a3a2c, 0x8a2f2a];

  function look(o = {}) {
    const sex = o.sex || (Math.random() < 0.5 ? 'f' : 'm');
    const f = sex === 'f';
    const top = o.top || pick(f ? ['jacket', 'coat', 'tee', 'dress', 'hoodie', 'shirt'] : ['jacket', 'tee', 'hoodie', 'shirt', 'coat', 'suit']);
    const L = {
      sex, top,
      height: o.height || (f ? R(1.56, 1.70) : R(1.66, 1.84)),
      build: o.build || R(0.94, 1.08),
      skin: o.skin ?? pick(SKIN), hair: o.hair ?? pick(HAIR),
      hairStyle: o.hairStyle || pick(f ? ['long', 'bob', 'pony', 'bun', 'long', 'beanie'] : ['short', 'short', 'short', 'cap', 'beanie']),
      topColor: o.topColor ?? (top === 'suit' ? pick([0x1b1e24, 0x262a36, 0x3a3a3e]) : pick(TOPS)),
      bottom: o.bottom || (top === 'dress' ? 'legs' : pick(f ? ['pants', 'pants', 'skirt', 'jeans'] : ['pants', 'jeans', 'jeans', 'shorts'])),
      bottomColor: o.bottomColor ?? pick(BOTTOMS),
      shoeColor: o.shoeColor ?? pick(SHOES),
      sleeves: o.sleeves || (top === 'tee' ? 'short' : 'long'),
      capColor: o.capColor ?? pick([0x1c1e22, 0x7a2e2e, 0x2f4a6a, 0xc8c2b4, 0x3a4a3a]),
      acc: o.acc || (Math.random() < 0.35 ? [pick(['backpack', 'tote', 'tote', 'scarf', 'glasses'])] : []),
      accColor: o.accColor ?? pick([0x1a1c20, 0x4a3524, 0x7a3030, 0x2c3c50, 0xb8a888]),
      face: o.face !== false,
      hold: o.hold || null, holdColor: o.holdColor ?? pick([0x1a1d22, 0x7a2430, 0x23405c, 0xc9b98a, 0x2d4a3a]),
    };
    return L;
  }

  /* Segments in joint-local frames. tint: paint the top (and bottoms) pure white
     so an instanced mesh can colour them per person. */
  function parts(o, lod = 1, tint = false) {
    const S = lod > 0 ? 12 : 8;
    const f = o.sex === 'f';
    const sw = f ? 0.166 : 0.19;
    const WH = new THREE.Color(1, 1, 1);
    const top = tint ? WH : new THREE.Color(o.topColor), bot = tint ? WH : new THREE.Color(o.bottomColor);
    const skin = new THREE.Color(o.skin), hair = new THREE.Color(o.hair), shoe = new THREE.Color(o.shoeColor);
    const accC = new THREE.Color(o.accColor), dark = new THREE.Color(0x121316);
    const P = { torso: [], head: [], armU: [], armF: [], thigh: [], shin: [], hand: [], sw };
    const put = (arr, geometry, color, matrix) => arr.push({ geometry, color, matrix: matrix || new THREE.Matrix4() });
    const T = (rings, dy) => rings.map((r) => [r[0] - dy, r[1], r[2], r[3] || 0, r[4] || 0]);
    const bulk = o.top === 'jacket' || o.top === 'hoodie' || o.top === 'coat' || o.top === 'suit' ? 0.012 : 0;
    const legSkin = o.bottom === 'skirt' || o.bottom === 'legs';

    // pelvis and torso
    if (!legSkin) put(P.torso, loft(T([[0.835, 0.09, 0.085], [0.88, 0.150, 0.108], [0.95, 0.166, 0.118], [1.03, 0.156, 0.110]], HIP), S, true, false), bot);
    const chest = f
      ? [[1.06, 0.128, 0.094], [1.19, 0.142, 0.104], [1.29, 0.160, 0.118, 0, 0.008], [1.385, 0.166, 0.102], [1.445, 0.126, 0.086], [1.478, 0.066, 0.062]]
      : [[1.07, 0.152, 0.106], [1.19, 0.166, 0.112], [1.30, 0.188, 0.122, 0, 0.004], [1.395, 0.196, 0.112], [1.452, 0.150, 0.092], [1.485, 0.072, 0.068]];
    let hem;
    if (o.top === 'coat') hem = [[0.50, 0.215, 0.165], [0.70, 0.200, 0.150], [0.90, 0.186, 0.134], [0.99, f ? 0.160 : 0.172, 0.122]];
    else if (o.top === 'dress') hem = [[0.50, 0.235, 0.205], [0.72, 0.200, 0.165], [0.92, 0.172, 0.126], [1.0, 0.150, 0.108]];
    else if (bulk) hem = [[0.855, 0.186, 0.134], [0.93, 0.184, 0.132], [1.0, f ? 0.160 : 0.172, 0.120]];
    else hem = [[0.925, 0.170, 0.122], [0.99, f ? 0.150 : 0.166, 0.116]];
    const upper = hem.concat(chest.map((r) => [r[0], r[1] + bulk, r[2] + bulk, 0, r[4] || 0]));
    put(P.torso, loft(T(upper, HIP), S, true, true), top);
    if (o.bottom === 'skirt') put(P.torso, loft(T([[0.56, 0.215, 0.185], [0.80, 0.180, 0.140], [0.98, 0.158, 0.112]], HIP), S, true, false), bot);
    put(P.torso, loft(T([[1.455, 0.052, 0.052], [1.545, 0.046, 0.048]], HIP), S, false, false), skin);
    if (o.top === 'hoodie' && lod > 0) put(P.torso, loft(T([[1.40, 0.10, 0.045, 0, -0.105], [1.47, 0.12, 0.06, 0, -0.10], [1.53, 0.09, 0.04, 0, -0.085]], HIP), S), top);
    if (o.top === 'suit' && lod > 0) {
      put(P.torso, boxGeo(0.085, 0.24, 0.012), new THREE.Color(0xe8e6e0), M4(0, 1.33 - HIP, 0.126 + bulk, 0, -0.08));
      put(P.torso, boxGeo(0.034, 0.21, 0.012), new THREE.Color(0x7a2430), M4(0, 1.32 - HIP, 0.133 + bulk, 0, -0.08));
    }

    // head (pivot at the skull base)
    put(P.head, loft(T([[1.512, 0.040, 0.046, 0, 0.012], [1.535, 0.064, 0.072, 0, 0.010], [1.575, 0.080, 0.090, 0, 0.006], [1.625, 0.088, 0.098], [1.675, 0.087, 0.097], [1.715, 0.072, 0.082], [1.742, 0.040, 0.046]], NECK), S + 2), skin);
    if (lod > 0) {
      put(P.head, boxGeo(0.022, 0.042, 0.03), skin, M4(0, 1.606 - NECK, 0.098, 0, -0.25));
      for (const sx of [-1, 1]) put(P.head, boxGeo(0.014, 0.042, 0.026), skin, M4(sx * 0.089, 1.622 - NECK, 0.0));
      if (o.face) {
        for (const sx of [-1, 1]) {
          put(P.head, new THREE.SphereGeometry(0.0115, 8, 6), new THREE.Color(0x17120f), M4(sx * 0.034, 1.636 - NECK, 0.0885, 0, 0, 0, 1.15, 0.8, 0.5));
          put(P.head, boxGeo(0.036, 0.007, 0.012), hair, M4(sx * 0.034, 1.659 - NECK, 0.0905, 0, 0, sx * -0.08));
        }
        put(P.head, boxGeo(0.036, 0.008, 0.01), new THREE.Color(o.skin).multiplyScalar(0.62), M4(0, 1.567 - NECK, 0.0835));
      }
    }
    const hs = o.hairStyle;
    const dome = (sc, col, rx, dy = 0) => put(P.head, new THREE.SphereGeometry(1, S + 2, 6, 0, TAU, 0, Math.PI * 0.53), col, M4(0, 1.648 + dy - NECK, -0.006, 0, rx, 0, 0.094 * sc, 0.108 * sc, 0.104 * sc));
    // scalp: a shell over the skull whose front edge is the hairline
    const scalp = () => put(P.head, loft(T([[1.548, 0.062, 0.045, 0, -0.058], [1.60, 0.094, 0.074, 0, -0.036], [1.655, 0.098, 0.090, 0, -0.018], [1.70, 0.092, 0.096, 0, -0.004], [1.737, 0.074, 0.080, 0, -0.004], [1.760, 0.040, 0.044, 0, -0.004]], NECK), S + 2), hair);
    if (hs === 'cap') {
      scalp(); dome(1.07, new THREE.Color(o.capColor), -0.1, 0.006);
      put(P.head, roundedBox(0.15, 0.014, 0.11, 0.006, 1), new THREE.Color(o.capColor), M4(0, 1.674 - NECK, 0.135, 0, 0.14));
    } else if (hs === 'beanie') {
      scalp(); dome(1.10, new THREE.Color(o.capColor), -0.2, 0.008);
    } else if (hs === 'helmet') {
      dome(1.16, new THREE.Color(o.capColor), -0.12, 0.004);
      put(P.head, boxGeo(0.17, 0.05, 0.02), dark, M4(0, 1.655 - NECK, 0.105, 0, 0.1));
    } else {
      scalp();
      if (hs === 'long' || hs === 'bob') {
        const low = hs === 'long' ? 1.33 : 1.47;
        put(P.head, loft(T([[low, 0.075, 0.035, 0, -0.075], [1.46, 0.098, 0.052, 0, -0.066], [1.56, 0.105, 0.080, 0, -0.04], [1.66, 0.102, 0.088, 0, -0.03], [1.71, 0.07, 0.06, 0, -0.03]], NECK), S), hair);
      } else if (hs === 'pony') {
        put(P.head, loft([[0, 0.034, 0.034], [-0.10, 0.03, 0.03], [-0.27, 0.012, 0.012]], 8), hair, M4(0, 1.70 - NECK, -0.092, 0, 0.55));
      } else if (hs === 'bun') {
        put(P.head, new THREE.SphereGeometry(0.046, 10, 8), hair, M4(0, 1.765 - NECK, -0.05));
      }
    }
    if (o.acc.includes('glasses') && lod > 0) put(P.head, boxGeo(0.158, 0.026, 0.012), dark, M4(0, 1.637 - NECK, 0.094));

    // arms (pivot at the shoulder / elbow)
    const ar = 0.004 + bulk * 0.7;
    if (o.sleeves === 'short') {
      put(P.armU, loft([[0.035, 0.03, 0.03], [0, 0.054, 0.054], [-0.06, 0.052, 0.054], [-0.13, 0.050, 0.052]], S, false, true), top);
      put(P.armU, loft([[-0.11, 0.041, 0.043], [-0.29, 0.037, 0.039]], S, false, false), skin);
      put(P.armF, loft([[0.01, 0.038, 0.040], [-0.10, 0.036, 0.037], [-0.25, 0.027, 0.029]], S, false, true), skin);
    } else {
      put(P.armU, loft([[0.035, 0.03, 0.03], [0, 0.050 + ar, 0.052 + ar], [-0.12, 0.046 + ar, 0.048 + ar], [-0.29, 0.040 + ar, 0.042 + ar]], S, true, true), top);
      put(P.armF, loft([[0.012, 0.041 + ar, 0.043 + ar], [-0.10, 0.038 + ar, 0.039 + ar], [-0.25, 0.030 + ar, 0.032 + ar]], S, true, true), top);
    }
    put(P.armF, loft([[-0.240, 0.016, 0.024], [-0.285, 0.019, 0.040], [-0.330, 0.017, 0.034], [-0.356, 0.010, 0.016]], 8), skin);

    // legs (pivot at the hip / knee)
    const lc = legSkin ? (o.bottom === 'legs' && Math.random() < 0.5 ? new THREE.Color(0x1a1b20) : skin) : bot;
    const wide = !legSkin && o.bottom !== 'shorts' ? 0.008 : 0;
    if (o.bottom === 'shorts') {
      put(P.thigh, loft([[0.02, 0.07, 0.075], [-0.04, 0.090, 0.094], [-0.20, 0.082, 0.086]], S, true, true), bot);
      put(P.thigh, loft([[-0.18, 0.068, 0.072], [-0.42, 0.054, 0.056]], S, false, true), skin);
    } else {
      put(P.thigh, loft([[0.02, 0.07, 0.075], [-0.04, 0.086 + wide, 0.090 + wide], [-0.22, 0.072 + wide, 0.076 + wide], [-0.42, 0.057 + wide, 0.059 + wide]], S, true, true), lc);
    }
    const sc = o.bottom === 'shorts' ? skin : lc;
    put(P.shin, loft([[0.012, 0.057 + wide, 0.059 + wide], [-0.10, 0.054 + wide, 0.058 + wide, 0, -0.006], [-0.34, 0.040 + wide * 1.6, 0.042 + wide * 1.6], [-0.418, 0.038 + wide * 1.8, 0.040 + wide * 1.8]], S, true, true), sc);
    put(P.shin, roundedBox(0.094, 0.078, 0.25, 0.032, 2), shoe, M4(0, -0.454, 0.05));

    // things worn on the torso
    if (o.acc.includes('backpack')) {
      put(P.torso, roundedBox(0.27, 0.37, 0.14, 0.05, 2), accC, M4(0, 1.22 - HIP, -0.175 - bulk));
      for (const sx of [-1, 1]) put(P.torso, boxGeo(0.036, 0.30, 0.012), accC, M4(sx * 0.095, 1.31 - HIP, 0.124 + bulk, 0, -0.1));
    }
    if (o.acc.includes('tote')) {
      put(P.torso, roundedBox(0.075, 0.27, 0.31, 0.02, 1), accC, M4(-sw - 0.085, 0.98 - HIP, -0.01));
      put(P.torso, boxGeo(0.014, 0.44, 0.03), accC, M4(-sw - 0.045, 1.27 - HIP, -0.01, 0, 0, 0.06));
    }
    if (o.acc.includes('scarf')) put(P.torso, new THREE.TorusGeometry(0.072, 0.034, 8, 14), accC, M4(0, 1.475 - HIP, 0.004, 0, Math.PI / 2));
    if (o.acc.includes('camera')) {
      put(P.torso, roundedBox(0.13, 0.085, 0.06, 0.012, 1), dark, M4(0, 1.19 - HIP, 0.15 + bulk));
      put(P.torso, new THREE.CylinderGeometry(0.034, 0.036, 0.075, 14), dark, M4(0, 1.19 - HIP, 0.21 + bulk, 0, Math.PI / 2));
      for (const sx of [-1, 1]) put(P.torso, boxGeo(0.014, 0.33, 0.008), dark, M4(sx * 0.062, 1.335 - HIP, 0.132 + bulk, 0, -0.16, sx * 0.1));
    }
    if (o.acc.includes('apron')) put(P.torso, boxGeo(0.30, 0.62, 0.012), new THREE.Color(0xd9cdb4), M4(0, 1.02 - HIP, 0.132 + bulk));
    if (o.acc.includes('hivis')) put(P.torso, loft(T([[1.0, 0.176, 0.126], [1.2, 0.182, 0.128], [1.4, 0.2, 0.12]], HIP).map((r) => [r[0], r[1] + bulk, r[2] + bulk]), S, false, false), new THREE.Color(0xd7e03a));

    // things held in the right hand (forearm frame, +Z is up when the forearm points forward)
    const hc = new THREE.Color(o.holdColor);
    if (o.hold === 'umbrella') {
      put(P.hand, new THREE.CylinderGeometry(0.008, 0.008, 0.98, 8), dark, M4(0, -0.305, 0.40, 0, Math.PI / 2));
      put(P.hand, new THREE.CylinderGeometry(0.014, 0.014, 0.11, 8), dark, M4(0, -0.305, -0.07, 0, Math.PI / 2));
      const cg = new THREE.ConeGeometry(0.56, 0.2, 8, 2, true);
      put(P.hand, cg, hc, M4(0, -0.305, 0.82, 0, Math.PI / 2));
      const ci = new THREE.ConeGeometry(0.555, 0.195, 8, 1, true); ci.scale(-1, 1, 1);
      { const ix = ci.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = t; } ci.computeVertexNormals(); }
      put(P.hand, ci, new THREE.Color(o.holdColor).multiplyScalar(0.45), M4(0, -0.305, 0.815, 0, Math.PI / 2));
      put(P.hand, new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6), dark, M4(0, -0.305, 0.95, 0, Math.PI / 2));
    } else if (o.hold === 'phone') {
      put(P.hand, boxGeo(0.072, 0.012, 0.15), dark, M4(0.0, -0.325, 0.03));
      put(P.hand, boxGeo(0.062, 0.004, 0.13), new THREE.Color(1.6, 1.9, 2.4), M4(0.0, -0.317, 0.03));
    } else if (o.hold === 'cup') {
      put(P.hand, new THREE.CylinderGeometry(0.036, 0.028, 0.11, 12), new THREE.Color(0xe8e2d4), M4(0, -0.31, 0.05, 0, Math.PI / 2));
    } else if (o.hold === 'bag') {
      put(P.hand, roundedBox(0.10, 0.27, 0.24, 0.02, 1), hc, M4(0, -0.56, 0));
      put(P.hand, boxGeo(0.01, 0.12, 0.14), hc, M4(0, -0.39, 0));
    } else if (o.hold === 'tray') {
      put(P.hand, boxGeo(0.34, 0.03, 0.22), hc, M4(0.16, -0.33, 0.03));
    }
    return P;
  }

  const POSES = {
    stand: { aL: [0.04, 0.07], aR: [0.04, -0.07], eL: -0.12, eR: -0.12 },
    phone: { aL: [0.04, 0.07], eL: -0.1, aR: [-0.42, -0.10], eR: -1.85, headRx: 0.32 },
    photo: { aL: [-1.05, 0.22], aR: [-1.05, -0.22], eL: -1.25, eR: -1.25, headRx: -0.04 },
    lean: { lean: 0.36, aL: [-0.95, 0.16], aR: [-0.95, -0.16], eL: -0.85, eR: -0.85, headRx: -0.2, dz: -0.12 },
    sit: { dy: -0.42, lL: -1.5, lR: -1.5, kL: 1.5, kR: 1.5, aL: [-0.45, 0.06], aR: [-0.45, -0.06], eL: -0.95, eR: -0.95 },
    talk: { aL: [0.05, 0.07], eL: -0.2, aR: [-0.35, -0.16], eR: -1.35, headRy: 0.2 },
    wave: { aL: [0.04, 0.07], eL: -0.1, aR: [0, -2.45], eR: -0.5 },
    hold: { aL: [0.04, 0.07], eL: -0.1, aR: [-0.12, -0.05], eR: -1.52 },
    carry: { aL: [-0.38, 0.05], aR: [-0.38, -0.05], eL: -1.2, eR: -1.2 },
    point: { aL: [0.04, 0.07], eL: -0.1, aR: [-1.35, -0.1], eR: -0.1 },
    stride: { lL: -0.42, lR: 0.36, kL: 0.12, kR: 0.5, aL: [0.34, 0.07], aR: [-0.36, -0.07], eL: -0.25, eR: -0.45 },
    ride: { dy: -0.2, lL: -1.15, lR: -1.15, kL: 1.25, kR: 1.25, aL: [-0.9, 0.12], aR: [-0.9, -0.12], eL: -0.5, eR: -0.5, lean: 0.12 },
  };
  const poseOf = (p) => (typeof p === 'string' ? POSES[p] || POSES.stand : (p || POSES.stand));

  // world matrices for every segment of a posed figure
  const mRx = (a) => new THREE.Matrix4().makeRotationX(a), mRy = (a) => new THREE.Matrix4().makeRotationY(a), mRz = (a) => new THREE.Matrix4().makeRotationZ(a);
  const mT = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
  function frames(o, pose, sw) {
    const p = poseOf(pose);
    const s = o.height / 1.75;
    const root = new THREE.Matrix4().makeScale(s * o.build, s, s * o.build);
    const hips = root.clone().multiply(mT(0, HIP + (p.dy || 0), p.dz || 0));
    const torso = hips.clone().multiply(mRx(p.lean || 0));
    const head = torso.clone().multiply(mT(0, NECK - HIP, 0)).multiply(mRy(p.headRy || 0)).multiply(mRx(p.headRx || 0));
    const F = { torso, head, armU: [], armF: [], thigh: [], shin: [] };
    for (const [k, sx] of [['L', 1], ['R', -1]]) {
      const a = p['a' + k] || [0, sx * 0.07];
      const u = torso.clone().multiply(mT(sx * sw, SHOULDER - HIP, 0)).multiply(mRz(a[1])).multiply(mRx(a[0]));
      F.armU.push(u); F.armF.push(u.clone().multiply(mT(0, -UPPER, 0)).multiply(mRx(p['e' + k] || 0)));
      const t = hips.clone().multiply(mT(sx * 0.088, 0, 0)).multiply(mRx(p['l' + k] || 0));
      F.thigh.push(t); F.shin.push(t.clone().multiply(mT(0, -THIGH, 0)).multiply(mRx(p['k' + k] || 0)));
    }
    return F;
  }

  // one posed figure as a list of {geometry, matrix, color}; at: optional placement matrix
  function bakeItems(o, pose, at, lod = 1) {
    o = o.sex && o.height ? o : look(o);
    const P = parts(o, lod), F = frames(o, pose, P.sw), out = [];
    const add = (items, m) => { for (const it of items) out.push({ geometry: it.geometry, color: it.color, matrix: (at ? at.clone().multiply(m) : m.clone()).multiply(it.matrix) }); };
    add(P.torso, F.torso); add(P.head, F.head);
    for (let k = 0; k < 2; k++) { add(P.armU, F.armU[k]); add(P.armF, F.armF[k]); add(P.thigh, F.thigh[k]); add(P.shin, F.shin[k]); }
    add(P.hand, F.armF[1]);
    return out;
  }

  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.82, metalness: 0.0, envMapIntensity: 0.6 });
  material.userData.surfaceProcedural = true;

  function figure(o, pose, lod = 1) { return mergeGeoms(bakeItems(o, pose, null, lod), { vertexColors: true }); }

  // list: [{ look, pose, x, y, z, ry }] -> one mesh
  function crowd(list, name, lod = 1) {
    const items = [];
    for (const c of list) items.push(...bakeItems(c.look || {}, c.pose, M4(c.x, c.y || 0, c.z, c.ry || 0), lod));
    const m = new THREE.Mesh(mergeGeoms(items, { vertexColors: true }), material);
    m.name = name || 'people'; m.castShadow = true; m.userData.passable = true; m.userData.surfaceProcedural = true;
    return m;
  }

  // jointed figure: group.userData.j = { hips, torso, head, armL, armR, foreL, foreR, legL, legR, shinL, shinR }
  function make(o, pose) {
    o = look(o);
    const P = parts(o, 1);
    const s = o.height / 1.75;
    const root = new THREE.Group(); root.name = 'person';
    const body = new THREE.Group(); body.scale.set(s * o.build, s, s * o.build); root.add(body);
    const mesh = (items) => { const m = new THREE.Mesh(mergeGeoms(items, { vertexColors: true }), material); m.castShadow = true; m.userData.passable = true; m.userData.surfaceProcedural = true; m.userData.identity = [{ name: 'figure', extents: [0.5, 1.75, 0.3] }]; m.userData.parts = ['figure']; return m; };
    const grp = (parent, x, y, z, items) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); if (items && items.length) g.add(mesh(items)); return g; };
    const hips = grp(body, 0, HIP, 0);
    const torso = grp(hips, 0, 0, 0, P.torso);
    const head = grp(torso, 0, NECK - HIP, 0, P.head);
    const j = { hips, torso, head };
    for (const [k, sx] of [['L', 1], ['R', -1]]) {
      const u = grp(torso, sx * P.sw, SHOULDER - HIP, 0, P.armU);
      const fo = grp(u, 0, -UPPER, 0, P.armF);
      if (k === 'R' && P.hand.length) { j.held = mesh(P.hand); fo.add(j.held); }
      const t = grp(hips, sx * 0.088, 0, 0, P.thigh);
      const sh = grp(t, 0, -THIGH, 0, P.shin);
      j['arm' + k] = u; j['fore' + k] = fo; j['leg' + k] = t; j['shin' + k] = sh;
    }
    root.userData.j = j; root.userData.look = o; root.userData.eye = 1.64 * s;
    setPose(root, pose || (o.hold === 'umbrella' ? 'hold' : 'stand'));
    return root;
  }
  function setPose(rig, pose) {
    const p = poseOf(pose), j = rig.userData.j;
    j.hips.position.y = HIP + (p.dy || 0); j.hips.position.z = p.dz || 0;
    j.torso.rotation.set(p.lean || 0, 0, 0);
    j.head.rotation.set(p.headRx || 0, p.headRy || 0, 0);
    for (const [k, sx] of [['L', 1], ['R', -1]]) {
      const a = p['a' + k] || [0, sx * 0.07];
      j['arm' + k].rotation.set(a[0], 0, a[1]); j['fore' + k].rotation.set(p['e' + k] || 0, 0, 0);
      j['leg' + k].rotation.set(p['l' + k] || 0, 0, 0); j['shin' + k].rotation.set(p['k' + k] || 0, 0, 0);
    }
    rig.userData.pose = p;
  }
  // gait: ph in radians, amp 0 (standing) .. 1 (brisk walk) .. 1.6 (run). keepR: leave the right arm in its pose (carrying something)
  function walk(rig, ph, amp, keep = 0) {
    const keepR = keep === true || keep >= 1, keepL = keep === 2;
    const j = rig.userData.j, p = rig.userData.pose || POSES.stand;
    const a = Math.min(amp, 1.7), s = Math.sin(ph), c = Math.cos(ph);
    const hipA = 0.46 * a, run = Math.max(0, a - 1);
    j.legL.rotation.x = hipA * s - 0.06 * a; j.legR.rotation.x = -hipA * s - 0.06 * a;
    j.shinL.rotation.x = a * (0.10 + (0.75 + 0.5 * run) * Math.max(0, -c)); j.shinR.rotation.x = a * (0.10 + (0.75 + 0.5 * run) * Math.max(0, c));
    j.hips.position.y = HIP + (p.dy || 0) - 0.012 * a + 0.022 * a * Math.abs(c);
    j.torso.rotation.x = (p.lean || 0) + 0.035 * a + 0.12 * run;
    j.torso.rotation.y = 0.07 * a * s;
    const aL = p.aL || [0, 0.07], aR = p.aR || [0, -0.07];
    if (!keepL) { j.armL.rotation.x = aL[0] * (1 - Math.min(1, a)) - 0.40 * a * s; j.foreL.rotation.x = (p.eL || 0) * (1 - Math.min(1, a)) - a * (0.22 + 0.25 * Math.max(0, -s) + 0.9 * run); }
    else { j.armL.rotation.x = aL[0]; j.foreL.rotation.x = p.eL || 0; }
    if (!keepR) { j.armR.rotation.x = aR[0] * (1 - Math.min(1, a)) + 0.40 * a * s; j.foreR.rotation.x = (p.eR || 0) * (1 - Math.min(1, a)) - a * (0.22 + 0.25 * Math.max(0, s) + 0.9 * run); }
    else { j.armR.rotation.x = aR[0]; j.foreR.rotation.x = p.eR || 0; }
  }

  /* Street pedestrians: every body part is one InstancedMesh; white vertices take
     the per-person colour, everything else keeps its own. */
  const instMat = material.clone();
  instMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      vColor = color;
      #ifdef USE_INSTANCING_COLOR
        if (min(color.r, min(color.g, color.b)) > 0.995) vColor = instanceColor;
      #endif`);
  };
  instMat.customProgramCacheKey = () => 'people-inst-1';
  instMat.userData.surfaceProcedural = true;
  const blobTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,0.62)'); g.addColorStop(0.55, 'rgba(0,0,0,0.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, color: 0x000000, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  blobMat.userData.surfaceProcedural = true;
  const VARIANTS = [
    { sex: 'm', top: 'jacket', hairStyle: 'short', bottom: 'pants', acc: [] },
    { sex: 'm', top: 'hoodie', hairStyle: 'cap', bottom: 'jeans', acc: ['backpack'] },
    { sex: 'm', top: 'coat', hairStyle: 'short', bottom: 'pants', acc: ['glasses'] },
    { sex: 'f', top: 'coat', hairStyle: 'long', bottom: 'pants', acc: ['tote'] },
    { sex: 'f', top: 'jacket', hairStyle: 'bob', bottom: 'jeans', acc: [] },
    { sex: 'f', top: 'hoodie', hairStyle: 'pony', bottom: 'pants', acc: ['backpack'] },
  ];
  class Instanced {
    constructor(name) { this.name = name || 'pedestrians'; this.people = []; this.meshes = []; }
    add(o = {}) {
      const v = o.variant ?? Math.floor(Math.random() * VARIANTS.length);
      const f = VARIANTS[v].sex === 'f';
      const p = { v, slot: 0, s: (o.height || (f ? R(1.56, 1.70) : R(1.66, 1.84))) / 1.75, b: R(0.94, 1.08), top: new THREE.Color(o.topColor ?? pick(TOPS)), bot: new THREE.Color(o.bottomColor ?? pick(BOTTOMS)), umb: !!o.umbrella, uslot: -1, umbColor: new THREE.Color(o.umbrellaColor ?? pick([0x1a1d22, 0x7a2430, 0x23405c, 0xc9b98a, 0x2d4a3a, 0x9aa3ab, 0xb86a2a])) };
      this.people.push(p); return this.people.length - 1;
    }
    build(parent) {
      const n = this.people.length;
      const counts = VARIANTS.map(() => 0);
      for (const p of this.people) p.slot = counts[p.v]++;
      const mk = (items, count, nm) => {
        const m = new THREE.InstancedMesh(mergeGeoms(items, { vertexColors: true }), instMat, Math.max(1, count));
        m.name = this.name + '-' + nm; m.frustumCulled = false; m.castShadow = true; m.userData.passable = true; m.userData.surfaceProcedural = true;
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        parent.add(m); this.meshes.push(m); return m;
      };
      this.body = []; this.sw = [];
      let limb = null;
      VARIANTS.forEach((v, i) => {
        const L = look(Object.assign({ skin: SKIN[i % SKIN.length], hair: HAIR[i % 4], face: false, shoeColor: SHOES[i % 3], accColor: [0x1a1c20, 0x2c3c50, 0x4a3524][i % 3], capColor: [0x1c1e22, 0x7a2e2e][i % 2], sleeves: 'long' }, v));
        const P = parts(L, 0, true);
        const items = P.torso.concat(P.head.map((it) => ({ geometry: it.geometry, color: it.color, matrix: mT(0, NECK - HIP, 0).multiply(it.matrix) })));
        this.body.push(mk(items, counts[i], 'body' + i)); this.sw.push(P.sw);
        if (!limb) limb = P;
      });
      this.armU = mk(limb.armU, n * 2, 'arm'); this.armF = mk(limb.armF, n * 2, 'forearm');
      this.thigh = mk(limb.thigh, n * 2, 'thigh'); this.shin = mk(limb.shin, n * 2, 'shin');
      let nu = 0; for (const p of this.people) if (p.umb) p.uslot = nu++;
      this.umb = mk(parts(look({ hold: 'umbrella', holdColor: 0xffffff, sex: 'm', acc: [] }), 0, true).hand, nu, 'umbrella');
      {
        const sg = new THREE.PlaneGeometry(1, 1); sg.rotateX(-Math.PI / 2);
        this.shadow = new THREE.InstancedMesh(sg, blobMat, Math.max(1, n));
        this.shadow.name = this.name + '-contact'; this.shadow.frustumCulled = false; this.shadow.userData.passable = true; this.shadow.userData.surfaceProcedural = true; this.shadow.renderOrder = 3;
        this.shadow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); parent.add(this.shadow); this.meshes.push(this.shadow);
      }
      const zero = new THREE.Matrix4().makeScale(0, 0, 0);
      this.people.forEach((p, i) => {
        this.body[p.v].setColorAt(p.slot, p.top); this.body[p.v].setMatrixAt(p.slot, zero); this.shadow.setMatrixAt(i, zero);
        if (p.umb) { this.umb.setColorAt(p.uslot, p.umbColor); this.umb.setMatrixAt(p.uslot, zero); }
        for (let k = 0; k < 2; k++) {
          this.armU.setColorAt(i * 2 + k, p.top); this.armF.setColorAt(i * 2 + k, p.top);
          this.thigh.setColorAt(i * 2 + k, p.bot); this.shin.setColorAt(i * 2 + k, p.bot);
          for (const m of [this.armU, this.armF, this.thigh, this.shin]) m.setMatrixAt(i * 2 + k, zero);
        }
      });
      for (const m of this.meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
      this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
      this._root = new THREE.Matrix4(); this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._c = new THREE.Matrix4();
      this._zero = zero; this._up = new THREE.Vector3(0, 1, 0);
      return this;
    }
    hide(i) {
      const p = this.people[i]; if (p.hidden) return; p.hidden = true;
      this.body[p.v].setMatrixAt(p.slot, this._zero); this.shadow.setMatrixAt(i, this._zero);
      if (p.umb) this.umb.setMatrixAt(p.uslot, this._zero);
      for (let k = 0; k < 2; k++) for (const m of [this.armU, this.armF, this.thigh, this.shin]) m.setMatrixAt(i * 2 + k, this._zero);
    }
    // amp: 0 standing .. 1 walking .. 1.6 running
    set(i, x, y, z, yaw, ph, amp) {
      const p = this.people[i]; p.hidden = false;
      const a = Math.min(amp, 1.7), s = Math.sin(ph), c = Math.cos(ph), run = Math.max(0, a - 1);
      const root = this._root, A = this._a, B = this._b, C = this._c;
      root.compose(this._v.set(x, y + (0.022 * Math.abs(c) - 0.012) * a * p.s, z), this._q.setFromAxisAngle(this._up, yaw), this._s.set(p.s * p.b, p.s, p.s * p.b));
      A.makeRotationX(0.035 * a + 0.12 * run).setPosition(0, HIP, 0); B.multiplyMatrices(root, A);
      this.body[p.v].setMatrixAt(p.slot, B);
      A.makeScale(0.95, 1, 0.75 + 0.35 * a).setPosition(x, y + 0.025, z); this.shadow.setMatrixAt(i, A);
      const sw = this.sw[p.v], hipA = 0.46 * a;
      for (let k = 0; k < 2; k++) {
        const sx = k ? -1 : 1, sg = k ? -s : s, cg = k ? c : -c;
        A.makeRotationX(hipA * sg - 0.06 * a).setPosition(sx * 0.088, HIP, 0); B.multiplyMatrices(root, A);
        this.thigh.setMatrixAt(i * 2 + k, B);
        A.makeRotationX(a * (0.10 + (0.75 + 0.5 * run) * Math.max(0, cg))).setPosition(0, -THIGH, 0); C.multiplyMatrices(B, A);
        this.shin.setMatrixAt(i * 2 + k, C);
        const carry = k === 1 && p.umb;
        A.makeRotationX(carry ? -0.12 : 0.03 - 0.40 * a * sg).setPosition(sx * sw, SHOULDER, 0); B.multiplyMatrices(root, A);
        A.makeRotationZ(sx * 0.07); B.multiply(A);
        this.armU.setMatrixAt(i * 2 + k, B);
        A.makeRotationX(carry ? -1.52 : -0.10 - a * (0.22 + 0.25 * Math.max(0, -sg) + 0.9 * run)).setPosition(0, -UPPER, 0); C.multiplyMatrices(B, A);
        this.armF.setMatrixAt(i * 2 + k, C);
        if (carry) this.umb.setMatrixAt(p.uslot, C);
      }
    }
    commit() { for (const m of this.meshes) m.instanceMatrix.needsUpdate = true; }
  }

  G.people = { look, parts, figure, bakeItems, crowd, make, setPose, walk, Instanced, material, blobMat, POSES, SKIN, HAIR, TOPS, BOTTOMS, DIM: { HIP, SHOULDER, NECK, THIGH, UPPER }, loft };
})();
