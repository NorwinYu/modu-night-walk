/* 20-actors — the visitor, the rental car, the taxi, traffic, pedestrians,
   and the postcard beacons. Everything is authored from primitives. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, TEX = G.TEX, scene = G.scene, C = G.CITY;
  const U = G.util;
  const { R, RI, pick, clamp, lerp, M4, boxGeo, roundedBox, mergeGeoms, makeCanvas, canvasTexture } = U;
  const A = (G.actors = {});

  // ------------------------------------------------------------- text textures
  function textTexture(lines, opts = {}) {
    const w = opts.w || 512, h = opts.h || 128;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = opts.bg || '#111'; ctx.fillRect(0, 0, w, h);
    if (opts.border) { ctx.strokeStyle = opts.border; ctx.lineWidth = 6; ctx.strokeRect(3, 3, w - 6, h - 6); }
    ctx.fillStyle = opts.fg || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const fs = opts.size || Math.floor(h * 0.42);
    ctx.font = `${opts.weight || 700} ${fs}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`;
    lines.forEach((ln, i) => ctx.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fs * 1.15));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }
  function plateMesh(text, w = 0.46, h = 0.12) {
    const tex = textTexture([text], { w: 512, h: 128, bg: '#dfe7e4', fg: '#12201c', border: '#1a2a26', size: 78 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.12 }));
    m.userData.surfaceProcedural = true;
    return m;
  }

  // ------------------------------------------------------------- prop materials
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.92, metalness: 0.02 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.3, metalness: 0.9, envMapIntensity: 1.6 });
  const glassCar = new THREE.MeshPhysicalMaterial({ color: 0x0a1218, roughness: 0.08, metalness: 0.4, clearcoat: 1.0, clearcoatRoughness: 0.06, envMapIntensity: 2.2, transparent: true, opacity: 0.82 });
  const darkTrim = new THREE.MeshStandardMaterial({ color: 0x181b1f, roughness: 0.55, metalness: 0.35 });
  const lampWhite = new THREE.MeshStandardMaterial({ color: 0xfff4dd, emissive: 0xfff0cf, emissiveIntensity: 4.2, roughness: 0.25 });
  const lampRed = new THREE.MeshStandardMaterial({ color: 0xff4a4a, emissive: 0xff1f2e, emissiveIntensity: 3.2, roughness: 0.3 });
  const lampAmber = new THREE.MeshStandardMaterial({ color: 0xffc46b, emissive: 0xffa23a, emissiveIntensity: 3.4, roughness: 0.3 });
  [rubber, rimMat, glassCar, darkTrim, lampWhite, lampRed, lampAmber].forEach((m) => { m.userData.surfaceProcedural = true; });

  function bodyMat(color) {
    const m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.24, metalness: 0.55, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.9 });
    m.userData.surfaceProcedural = true;
    return m;
  }

  // ------------------------------------------------------------- car builder
  function carBodyGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-1.98, 0.3);
    s.lineTo(1.96, 0.3);
    s.lineTo(2.04, 0.52);
    s.lineTo(1.98, 0.8);
    s.lineTo(1.34, 0.9);
    s.lineTo(0.74, 1.45);
    s.lineTo(-0.52, 1.5);
    s.lineTo(-1.46, 0.94);
    s.lineTo(-1.96, 0.82);
    s.lineTo(-2.02, 0.52);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.62, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.055, bevelSegments: 2, steps: 1, curveSegments: 12 });
    g.translate(0, 0, -0.81);
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }
  const CAR_BODY_GEO = carBodyGeometry();

  // ------------------------------------------------------------- wheel + rim
  function makeRimTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0a0b0d'; ctx.fillRect(0, 0, 256, 256);
    ctx.translate(128, 128);
    // tyre sidewall ring
    ctx.strokeStyle = '#1b1c1f'; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(0, 0, 112, 0, Math.PI * 2); ctx.stroke();
    // alloy rim
    const g = ctx.createRadialGradient(-30, -30, 10, 0, 0, 92);
    g.addColorStop(0, '#c8ced4'); g.addColorStop(0.55, '#8a929a'); g.addColorStop(1, '#4b5258');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 88, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#202326'; ctx.beginPath(); ctx.arc(0, 0, 74, 0, Math.PI * 2); ctx.fill();
    // five twin spokes
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.rotate(i / 5 * Math.PI * 2);
      for (const off of [-0.09, 0.09]) {
        ctx.save(); ctx.rotate(off);
        ctx.fillStyle = '#b9c0c6'; ctx.beginPath();
        ctx.moveTo(-9, -30); ctx.lineTo(9, -30); ctx.lineTo(14, -74); ctx.lineTo(-14, -74); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }
    ctx.fillStyle = '#8f979e'; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16181b'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    // brake disc glimpsed behind the spokes
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#aeb5ba'; ctx.beginPath(); ctx.arc(0, 0, 66, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  const RIM_TEX = makeRimTexture();
  const carPaintMat = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.22, metalness: 0.62, clearcoat: 1.0, clearcoatRoughness: 0.09, envMapIntensity: 2.0 });
  const carGlassMat = new THREE.MeshPhysicalMaterial({ color: 0x060b10, roughness: 0.04, metalness: 0.45, clearcoat: 1.0, clearcoatRoughness: 0.03, envMapIntensity: 2.6, transparent: true, opacity: 0.86 });
  const carTrimMat = new THREE.MeshStandardMaterial({ color: 0x0d0f12, roughness: 0.5, metalness: 0.35 });
  const carChromeMat = new THREE.MeshStandardMaterial({ color: 0xb9c2ca, roughness: 0.16, metalness: 0.95, envMapIntensity: 2.0 });
  const carLensMat = new THREE.MeshStandardMaterial({ color: 0xfff6e8, emissive: 0xfff3da, emissiveIntensity: 6.0, roughness: 0.15 });
  const carRedMat = new THREE.MeshStandardMaterial({ color: 0xff3a3a, emissive: 0xff1020, emissiveIntensity: 4.0, roughness: 0.25 });
  const carAmberMat = new THREE.MeshStandardMaterial({ color: 0xffb43a, emissive: 0xff8a18, emissiveIntensity: 3.0, roughness: 0.3 });
  [carGlassMat, carTrimMat, carChromeMat, carLensMat, carRedMat, carAmberMat].forEach((m) => { m.userData.surfaceProcedural = true; });

  function loftGeo(sections, N = 22, p = 0.62) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j < sections.length; j++) {
      const [z, w, y0, y1] = sections[j];
      const cy = (y0 + y1) / 2, hy = (y1 - y0) / 2;
      for (let i = 0; i <= N; i++) {
        const a = i / N * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        const sx = c >= 0 ? 1 : -1, sy = sn >= 0 ? 1 : -1;
        pos.push(w * sx * Math.pow(Math.abs(c), p), cy + hy * sy * Math.pow(Math.abs(sn), p), z);
        uv.push(i / N, j / (sections.length - 1));
      }
    }
    for (let j = 0; j < sections.length - 1; j++) for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
    // end caps
    const caps = [0, sections.length - 1];
    for (const j of caps) {
      const [z, w, y0, y1] = sections[j];
      const base = pos.length / 3;
      pos.push(0, (y0 + y1) / 2, z); uv.push(0.5, 0.5);
      for (let i = 0; i < N; i++) idx.push(base, j * (N + 1) + i, j * (N + 1) + i + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }

  function wheel(radius = 0.34, width = 0.26) {
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 32), rubber);
    tire.rotation.z = Math.PI / 2; spin.add(tire);
    const side = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.82, 0.06, 32, 32), new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.88 }));
    side.rotation.y = Math.PI / 2; side.position.x = width * 0.42; spin.add(side);
    const side2 = side.clone(); side2.position.x = -width * 0.42; spin.add(side2);
    const faceX = width * 0.51;
    const rimMat2 = new THREE.MeshStandardMaterial({ map: RIM_TEX, roughness: 0.4, metalness: 0.25, envMapIntensity: 1.4 });
    const spokeMat = new THREE.MeshStandardMaterial({ color: 0xcdd4da, roughness: 0.25, metalness: 0.55, envMapIntensity: 1.4 });
    for (const dir of [1, -1]) {
      const rimFace = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.64, 32), rimMat2);
      rimFace.rotation.y = dir * Math.PI / 2; rimFace.position.x = dir * faceX; spin.add(rimFace);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.6, 0.018, 32, 32), carChromeMat);
      ring.rotation.y = Math.PI / 2; ring.position.x = dir * (faceX + 0.002); spin.add(ring);
      for (let k = 0; k < 5; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.018, radius * 0.9, 0.032), spokeMat);
        spoke.position.x = dir * (faceX + 0.004); spoke.rotation.x = k / 5 * Math.PI * 2; spin.add(spoke);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.022, 32), carChromeMat);
      cap.rotation.z = Math.PI / 2; cap.position.x = dir * (faceX + 0.012); spin.add(cap);
    }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, 0.02, 32), new THREE.MeshStandardMaterial({ color: 0x8d949a, roughness: 0.35, metalness: 0.9 }));
    disc.rotation.z = Math.PI / 2; disc.position.x = -0.02; spin.add(disc);
    spin.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = true; } });
    return spin;
  }

  // ------------------------------------------------------------- car builder
  function buildCar(opts = {}) {
    const taxi = !!opts.taxi;
    const bodyColor = opts.color ?? (taxi ? 0x1fae9c : 0x2b4557);
    const paint = carPaintMat(bodyColor);
    const group = new THREE.Group();
    group.name = opts.name || (taxi ? 'city-taxi' : 'rental-car');

    const lower = loftGeo([
      [2.04, 0.54, 0.34, 0.64], [1.96, 0.82, 0.30, 0.82], [1.72, 0.90, 0.27, 0.92],
      [1.22, 0.92, 0.25, 0.96], [0.62, 0.94, 0.25, 0.99], [-0.55, 0.94, 0.25, 1.01],
      [-1.32, 0.90, 0.25, 0.99], [-1.78, 0.83, 0.28, 0.92], [-1.98, 0.64, 0.32, 0.80],
      [-2.05, 0.52, 0.36, 0.70],
    ]);
    const body = new THREE.Mesh(lower, paint);
    body.castShadow = true; body.receiveShadow = true; body.name = 'car-body';
    body.userData.identity = [{ name: 'body', extents: [1.85, 1.0, 4.1] }, { name: 'doors', extents: [0.9, 0.7, 1.8] }];
    body.userData.parts = ['body', 'doors'];
    group.add(body);
    // cabin greenhouse (glass shell)
    const cabinSec = [
      [0.88, 0.68, 0.94, 1.02], [0.55, 0.74, 0.94, 1.30], [0.18, 0.76, 0.94, 1.46],
      [-0.55, 0.77, 0.94, 1.49], [-1.02, 0.73, 0.94, 1.44], [-1.36, 0.66, 0.94, 1.22], [-1.52, 0.58, 0.94, 1.04],
    ];
    const cabin = new THREE.Mesh(loftGeo(cabinSec), carGlassMat);
    cabin.name = 'car-greenhouse'; cabin.userData.identity = [{ name: 'windows', extents: [1.5, 0.55, 2.4] }]; cabin.userData.parts = ['windows'];
    group.add(cabin);
    // Painted roof as a thin lens hugging the greenhouse crown; its edge sits at the
    // glass surface height for 0.82·w (superellipse p=0.62), so it never overhangs.
    const crown = (k, lift) => cabinSec.slice(1, 6).map(([z, w, , y1]) => [z, w * k, y1 - 0.10 + lift, y1 + 0.012 + lift]);
    const roof = new THREE.Mesh(loftGeo(crown(0.82, 0)), paint);
    roof.name = 'car-roof'; group.add(roof);
    const glassRoof = new THREE.Mesh(loftGeo(crown(0.5, 0.004).slice(1, 4)), carGlassMat); group.add(glassRoof);
    for (const sx of [-1, 1]) {      const belt = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, 2.28), carChromeMat);
      belt.position.set(sx * 0.80, 0.985, -0.3); group.add(belt);
      const sill = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 2.45), carTrimMat);
      sill.position.set(sx * 0.95, 0.29, -0.05); group.add(sill);
    }
    // wheel arches + wells
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.055, 32, 28, Math.PI), carTrimMat);
      arch.position.set(sx * 0.955, 0.35, sz * 1.33); arch.rotation.y = Math.PI / 2; arch.rotation.z = Math.PI; group.add(arch);
      const well = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 0.78), carTrimMat);
      well.position.set(sx * 0.80, 0.44, sz * 1.33); group.add(well);
    }
    // front fascia, grille, DRL and projectors
    const fascia = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.22, 0.06), carTrimMat); fascia.position.set(0, 0.55, 2.06); group.add(fascia);
    const intake = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.11, 0.03), carTrimMat); intake.position.set(0, 0.42, 2.075); group.add(intake);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.12, 0.03), new THREE.MeshStandardMaterial({ color: 0x14171a, roughness: 0.4, metalness: 0.6 })); grille.position.set(0, 0.62, 2.07); group.add(grille);
    const drl = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.022, 0.02), carLensMat); drl.position.set(0, 0.75, 2.085); group.add(drl);
    const headlightHousings = [];
    for (const sx of [-1, 1]) {
      const housing = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.07), carTrimMat);
      housing.position.set(sx * 0.56, 0.71, 2.06); group.add(housing);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.035, 32), carLensMat);
      lens.rotation.x = Math.PI / 2; lens.position.set(sx * 0.56, 0.71, 2.095); group.add(lens);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.038, 24, 16), carLensMat); inner.position.set(sx * 0.64, 0.71, 2.08); group.add(inner);
      headlightHousings.push(lens);
      const fog = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.02), carLensMat); fog.position.set(sx * 0.7, 0.43, 2.075); group.add(fog);
    }
    // rear light bar + bumpers
    const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.045, 0.02), carRedMat); tailBar.position.set(0, 0.83, -2.075); group.add(tailBar);
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.03), carRedMat); tailL.position.set(-0.6, 0.77, -2.07); group.add(tailL);
    const tailR = tailL.clone(); tailR.position.x = 0.6; group.add(tailR);
    const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.08), carTrimMat); rearBumper.position.set(0, 0.4, -2.06); group.add(rearBumper);
    const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 0.1), carTrimMat); diffuser.position.set(0, 0.29, -2.055); group.add(diffuser);
    // mirrors, handles, seams, plate
    for (const sx of [-1, 1]) {
      const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.04), carTrimMat); mirrorArm.position.set(sx * 0.92, 1.0, 0.55); group.add(mirrorArm);
      const pod = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.09, 0.11), paint); pod.position.set(sx * 0.96, 1.02, 0.53); group.add(pod);
      const turn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.07), carAmberMat); turn.position.set(sx * 1.045, 1.02, 0.53); group.add(turn);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.028, 0.16), carChromeMat); handle.position.set(sx * 0.952, 0.9, 0.08); group.add(handle);
      for (const sz of [0.72, -0.62]) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.55, 0.012), carTrimMat);
        seam.position.set(sx * 0.948, 0.58, sz); group.add(seam);
      }
    }
    const plate = plateMesh('魔A·N1GHT'); plate.position.set(0, 0.45, 2.11); group.add(plate);
    const rearPlate = plateMesh('魔A·N1GHT'); rearPlate.position.set(0, 0.46, -2.11); rearPlate.rotation.y = Math.PI; group.add(rearPlate);
    for (const [pz, pw] of [[1.42, 1.55], [-1.7, 1.5]]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.006, 0.012), carTrimMat);
      seam.position.set(0, 0.955, pz); group.add(seam);
    }
    // shark fin
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.13, 32), paint); fin.position.set(0, 1.57, -1.1); fin.rotation.x = -0.3; group.add(fin);
    // interior
    const dash = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.13, 0.3), carTrimMat); dash.position.set(0, 1.0, 0.52); group.add(dash);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.13), new THREE.MeshStandardMaterial({ color: 0x1a6f86, emissive: 0x2fa8c8, emissiveIntensity: 1.8, roughness: 0.3 }));
    screen.position.set(0, 1.12, 0.38); screen.rotation.x = -0.1; screen.rotation.y = Math.PI; group.add(screen);
    for (const sx of [-1, 1]) {
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.45), carTrimMat); seat.position.set(sx * 0.34, 1.08, -0.12); group.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.12), carTrimMat); back.position.set(sx * 0.34, 1.23, -0.32); back.rotation.x = -0.12; group.add(back);
    }
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.02, 32, 32), carTrimMat); wheelRim.position.set(-0.34, 1.1, 0.42); wheelRim.rotation.x = -1.1; group.add(wheelRim);
    // wheels
    const wheels = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx * 0.86, 0.34, sz * 1.33);
      const spin = wheel(0.34, 0.26); pivot.add(spin);
      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.12), new THREE.MeshStandardMaterial({ color: 0x9a2a24, roughness: 0.5 })); caliper.position.set(sx * 0.02, 0.16, 0); pivot.add(caliper);
      group.add(pivot);
      wheels.push({ pivot, spin, front: sz > 0 });
    }
    // taxi livery
    if (taxi) {
      const signTex = textTexture(['TAXI'], { w: 256, h: 96, bg: '#0d1414', fg: '#ffd86b', border: '#ffd05a', size: 52 });
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.24), new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 1.8, roughness: 0.4 }));
      sign.position.set(0, 1.67, -0.1); group.add(sign);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.09, 3.4), new THREE.MeshStandardMaterial({ color: 0xece7d6, roughness: 0.4, metalness: 0.2 }));
      for (const sx of [-1, 1]) { const st = stripe.clone(); st.position.set(sx * 0.94, 0.66, -0.1); group.add(st); }
      const decalTex = textTexture(['夜航'], { w: 256, h: 256, bg: '#1fae9c', fg: '#f4f0df', size: 92 });
      for (const sx of [-1, 1]) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), new THREE.MeshStandardMaterial({ map: decalTex, roughness: 0.5, transparent: true }));
        d.position.set(sx * 0.945, 0.82, -0.45); d.rotation.y = sx * Math.PI / 2; group.add(d);
      }
    }
    group.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = o.castShadow || false; if (!o.userData.identity) { o.userData.identity = [{ name: 'car-part', extents: [0.35, 0.35, 0.35] }]; o.userData.parts = ['car-part']; } } });
    body.castShadow = true;
    return { group, wheels, body, headlights: headlightHousings.slice(0, 2), taillights: [tailL, tailR] };
  }

  // ------------------------------------------------------------- photo drone
  function buildDrone() {
    const g = new THREE.Group(); g.name = 'photo-drone';
    const carbon = new THREE.MeshStandardMaterial({ color: 0x14171b, roughness: 0.38, metalness: 0.55, envMapIntensity: 1.3 });
    const shell = new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.42, metalness: 0.35, envMapIntensity: 1.4 });
    const alu = new THREE.MeshStandardMaterial({ color: 0x9aa1a8, roughness: 0.28, metalness: 0.9, envMapIntensity: 1.6 });
    const prop = new THREE.MeshStandardMaterial({ color: 0x22262b, roughness: 0.55, metalness: 0.2 });
    const lensM = new THREE.MeshStandardMaterial({ color: 0x0a1520, roughness: 0.12, metalness: 0.65, emissive: 0x1b4a6a, emissiveIntensity: 0.9 });
    const redL = new THREE.MeshBasicMaterial({ color: new THREE.Color(4.5, 0.25, 0.18) });
    const grnL = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 4.5, 1.4) });
    const whiteL = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 3.8, 4.0) });
    [carbon, shell, alu, prop, lensM].forEach((m) => { m.userData.surfaceProcedural = true; });

    const body = new THREE.Mesh(boxGeo(0.38, 0.1, 0.28, 4, 2), carbon); body.position.y = 0.2; g.add(body);
    const top = new THREE.Mesh(boxGeo(0.28, 0.055, 0.2, 3, 2), shell); top.position.y = 0.275; g.add(top);
    const stripe = new THREE.Mesh(boxGeo(0.24, 0.008, 0.035, 1, 1), alu); stripe.position.set(0, 0.303, 0.02); g.add(stripe);
    // battery bay
    const batt = new THREE.Mesh(boxGeo(0.18, 0.07, 0.13, 2, 2), new THREE.MeshStandardMaterial({ color: 0x252a30, roughness: 0.5, metalness: 0.3 })); batt.position.set(0, 0.16, -0.1); g.add(batt);
    // gimbal + lens (points forward +z)
    const gimbal = new THREE.Group(); gimbal.position.set(0, 0.14, 0.2); g.add(gimbal);
    const gb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), shell); gimbal.add(gb);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.045, 32), lensM); lens.rotation.x = Math.PI / 2; lens.position.z = 0.075; gimbal.add(lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.007, 32, 32), alu); ring.rotation.x = Math.PI / 2; ring.position.z = 0.085; gimbal.add(ring);
    // four arms, motors and rotors
    const rotors = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const ax = sx * 0.25, az = sz * 0.19;
      const arm = new THREE.Mesh(boxGeo(0.34, 0.026, 0.045, 2, 1), carbon);
      arm.position.set(sx * 0.14, 0.205, sz * 0.11); arm.rotation.y = Math.atan2(sx * 0.2, sz * 0.16); g.add(arm);
      const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.055, 32), alu); motor.position.set(ax, 0.23, az); g.add(motor);
      const rotor = new THREE.Group(); rotor.position.set(ax, 0.268, az); g.add(rotor);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.018, 32), alu); rotor.add(hub);
      for (let k = 0; k < 2; k++) {
        const blade = new THREE.Mesh(boxGeo(0.30, 0.006, 0.028, 2, 1), prop);
        blade.position.set(k === 0 ? 0.14 : -0.14, 0, 0); blade.rotation.y = k === 0 ? 0 : Math.PI; rotor.add(blade);
      }
      const tipL = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 12), sz > 0 ? grnL : redL);
      tipL.position.set(ax, 0.23, az + (sz > 0 ? 0.07 : -0.07)); g.add(tipL);
      rotors.push({ group: rotor, dir: sx * sz });
    }
    // landing skids
    for (const sx of [-1, 1]) {
      const skid = new THREE.Mesh(boxGeo(0.03, 0.15, 0.34, 2, 2), carbon); skid.position.set(sx * 0.12, 0.075, 0); g.add(skid);
      const foot = new THREE.Mesh(boxGeo(0.05, 0.025, 0.38, 2, 2), prop); foot.position.set(sx * 0.12, 0.012, 0); g.add(foot);
    }
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), whiteL); strobe.position.set(0, 0.315, -0.09); g.add(strobe);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.12, 32), alu); ant.position.set(-0.15, 0.34, -0.07); g.add(ant);
    const id = [{ name: 'drone-body', extents: [0.38, 0.12, 0.28] }, { name: 'rotors', extents: [0.62, 0.04, 0.5] }, { name: 'gimbal', extents: [0.12, 0.12, 0.16] }];
    g.userData.identity = id;
    g.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.userData.identity = id; o.userData.parts = ['drone-body', 'rotors', 'gimbal']; o.castShadow = true; } });
    return { group: g, rotors, gimbal, strobe };
  }
  const drone = buildDrone();
  A.drone = drone;
  drone.group.position.set(C.start[0] + Math.cos(C.carYaw || Math.PI) * 0.95, 0.17, C.start[1] - Math.sin(C.carYaw || Math.PI) * 0.95);
  drone.group.rotation.y = C.carYaw || Math.PI;
  scene.add(drone.group);
  // landing pad with a lit H
  {
    const pad = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.9, 32), new THREE.MeshStandardMaterial({ color: 0x151a1e, roughness: 0.6, metalness: 0.2 }));
    disc.rotation.x = -Math.PI / 2; pad.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.025, 32, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.6, 2.1) }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.012; pad.add(ring);
    const c = makeCanvas(128, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#0b1216'; ctx.fillRect(0, 0, 128, 128); ctx.strokeStyle = '#5fd8ff'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, 112, 112);
    ctx.fillStyle = '#dff6ff'; ctx.font = '700 64px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('H', 64, 66);
    const ht = canvasTexture(c, true, 1, 1, 4);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshBasicMaterial({ map: ht }));
    h.rotation.x = -Math.PI / 2; h.position.y = 0.016; pad.add(h);
    pad.position.set(drone.group.position.x, 0.181, drone.group.position.z);
    pad.userData.passable = true; pad.userData.surfaceProcedural = true; pad.name = 'drone-pad';
    pad.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; } });
    scene.add(pad); A.drone.pad = pad;
  }


  // player car + taxi
  const car = buildCar({ color: 0x8c9ba8, name: 'rental-car' });
  car.group.position.set(C.carStart[0], 0.02, C.carStart[1]);
  car.group.rotation.y = C.carYaw || Math.PI;
  scene.add(car.group);
  A.car = car;

  const taxi = buildCar({ taxi: true, color: 0x1fae9c, name: 'city-taxi' });
  taxi.group.position.set(C.taxiStart[0], 0.02, C.taxiStart[1]);
  taxi.group.rotation.y = C.taxiYaw || Math.PI;
  scene.add(taxi.group);
  A.taxi = taxi;

  // car headlights: two spotlights anchored to the lamp meshes
  const headlights = [];
  for (const [i, sx] of [[0, -0.55], [1, 0.55]]) {
    const L = new THREE.SpotLight(0xfff0d2, 120, 58, 0.52, 0.55, 2);
    L.position.set(sx, 0.71, 2.03);
    L.target.position.set(sx, 0.15, 24);
    car.group.add(L); car.group.add(L.target);
    headlights.push(L);
  }
  A.headlights = headlights;
  car.spotlights = headlights;

  // headlight pools on the wet road (additive, independent of body roll)
  const lightRig = new THREE.Group();
  lightRig.name = 'car-light-rig';
  const poolMat = new THREE.MeshBasicMaterial({ map: TEX.lightPool, color: new THREE.Color(2.2, 1.55, 0.95), transparent: true, opacity: 0.46, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  for (const sx of [-0.55, 0.55]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(8, 20), poolMat);
    p.rotation.x = -Math.PI / 2; p.position.set(sx, 0.055, 9.5); p.renderOrder = 3;
    lightRig.add(p);
  }
  scene.add(lightRig);
  A.lightRig = lightRig;
  G.noReflect.push(lightRig);

  // ------------------------------------------------------------- visitor
  const PPL = G.people;
  const visitorRig = PPL.make({
    sex: 'm', height: 1.78, build: 1.0, top: 'coat', topColor: 0x8a6a3c, bottom: 'jeans', bottomColor: 0x273343,
    hairStyle: 'short', hair: 0x1f1711, skin: 0xd9ab8a, shoeColor: 0x2a2420, acc: ['camera', 'scarf'], accColor: 0x7a3030,
    hold: 'umbrella', holdColor: 0x1b2a36,
  }, 'hold');
  visitorRig.name = 'visitor';
  visitorRig.position.set(C.start[0], 0.16, C.start[1]);
  visitorRig.rotation.y = 2.61;
  scene.add(visitorRig);
  const visitor = { group: visitorRig, rig: visitorRig, j: visitorRig.userData.j, umbrella: visitorRig.userData.j.held };
  A.visitor = visitor;
  {
    let amp = 0, poseNow = 'hold';
    // st: { moving, sprint, phase, t, dt, pose: 'walk'|'sit', umbrella, aim }
    A.animateVisitor = (st) => {
      const j = visitor.j;
      const want = st.pose === 'sit' ? 'sit' : st.aim ? 'photo' : (st.umbrella ? 'hold' : 'stand');
      if (want !== poseNow) { PPL.setPose(visitorRig, want); poseNow = want; }
      if (j.held) j.held.visible = want === 'hold';
      if (want === 'sit') { amp = 0; return; }
      amp = U.damp(amp, st.moving ? (st.sprint ? 1.55 : 1) : 0, 9, st.dt || 0.016);
      PPL.walk(visitorRig, st.phase || 0, amp, want === 'photo' ? 2 : want === 'hold' ? 1 : 0);
      if (amp < 0.05) { j.torso.rotation.x += Math.sin((st.t || 0) * 1.4) * 0.008; j.head.rotation.y = Math.sin((st.t || 0) * 0.37) * 0.12; }
      else j.head.rotation.y = 0;
    };
  }

  // ------------------------------------------------------------- road helpers
  const BOUNDS = C.bounds;
  const IN = (x, z, pad = 0) => x > BOUNDS.x0 - pad && x < BOUNDS.x1 + pad && z > BOUNDS.z0 - pad && z < BOUNDS.z1 + pad;
  const cumOf = (r) => {
    if (!r.cum) { const c = [0]; for (let i = 1; i < r.samp.length; i++) c.push(c[i - 1] + Math.hypot(r.samp[i][0] - r.samp[i - 1][0], r.samp[i][1] - r.samp[i - 1][1])); r.cum = c; r.len = c[c.length - 1]; }
    return r.cum;
  };
  const _at = { x: 0, z: 0, tx: 0, tz: 1, i: 0 };
  function roadAt(r, d, hint = 0) {
    const c = cumOf(r), n = c.length;
    d = clamp(d, 0, r.len);
    let i = clamp(hint | 0, 0, n - 2);
    while (i < n - 2 && c[i + 1] < d) i++;
    while (i > 0 && c[i] > d) i--;
    const a = r.samp[i], b = r.samp[i + 1], seg = (c[i + 1] - c[i]) || 1, f = (d - c[i]) / seg;
    _at.x = a[0] + (b[0] - a[0]) * f; _at.z = a[1] + (b[1] - a[1]) * f; _at.tx = (b[0] - a[0]) / seg; _at.tz = (b[1] - a[1]) / seg; _at.i = i;
    return _at;
  }
  // ground-level obstacles in a coarse grid (buildings, kiosks, walls — not posts)
  const obGrid = new Map(), OBC = 24;
  for (const c of C.colliders) {
    if ((c.y0 || 0) > 1.2) continue;
    if (c.x1 - c.x0 < 1.0 && c.z1 - c.z0 < 1.0) continue;
    // filed under every cell within 2 m, so a query near a cell edge still sees it
    for (let gx = Math.floor((c.x0 - 2) / OBC); gx <= Math.floor((c.x1 + 2) / OBC); gx++) for (let gz = Math.floor((c.z0 - 2) / OBC); gz <= Math.floor((c.z1 + 2) / OBC); gz++) {
      const k = gx * 4096 + gz; let l = obGrid.get(k); if (!l) obGrid.set(k, (l = [])); l.push(c);
    }
  }
  function blocked(x, z, rad = 0.4) {
    const l = obGrid.get(Math.floor(x / OBC) * 4096 + Math.floor(z / OBC));
    if (!l) return false;
    for (const c of l) if (x > c.x0 - rad && x < c.x1 + rad && z > c.z0 - rad && z < c.z1 + rad) return true;
    return false;
  }
  A.blocked = blocked;
  // every road sample in a grid: "is another road close to this point?"
  const rdGrid = new Map(), RDC = 20;
  for (const r of C.roads) for (const p of r.samp) {
    const k = Math.floor(p[0] / RDC) * 4096 + Math.floor(p[1] / RDC); let l = rdGrid.get(k); if (!l) rdGrid.set(k, (l = [])); l.push([p[0], p[1], r]);
  }
  function otherRoadNear(x, z, r, dist) {
    const gx = Math.floor(x / RDC), gz = Math.floor(z / RDC);
    for (let ax = gx - 1; ax <= gx + 1; ax++) for (let az = gz - 1; az <= gz + 1; az++) {
      const l = rdGrid.get(ax * 4096 + az); if (!l) continue;
      for (const q of l) if (q[2] !== r && Math.hypot(q[0] - x, q[1] - z) < dist + q[2].half) return true;
    }
    return false;
  }
  const DRIVE = new Set(['primary', 'secondary', 'tertiary', 'trunk', 'secondary_link', 'tertiary_link', 'residential', 'unclassified']);
  const TR = C.roads.filter((r) => DRIVE.has(r.hw) && r.samp.length > 4 && (cumOf(r), r.len > 50));
  const hot = [C.start, ...C.spots.map((s) => s.pos)];
  const hotDist = (x, z) => { let d = 1e9; for (const h of hot) d = Math.min(d, Math.hypot(h[0] - x, h[1] - z)); return d; };

  // ------------------------------------------------------------- vehicles: sedan, SUV, taxi, van, bus
  const PAINT = new THREE.Color(1, 1, 1), GLASS = new THREE.Color(0x0a1016), TYRE = new THREE.Color(0x0e0f11), RIMC = new THREE.Color(0x8d949a), BLACK = new THREE.Color(0x15171a), CHROME = new THREE.Color(0xb4bcc4);
  const HEAD = new THREE.Color(7.0, 6.4, 5.2), TAIL = new THREE.Color(4.2, 0.22, 0.2), AMBER = new THREE.Color(3.0, 1.6, 0.3), WARM = new THREE.Color(1.5, 1.2, 0.8), PLATE = new THREE.Color(0x2a4f9a);
  const wheelItems = (x, y, z, r, w) => {
    const m = M4(x, y, z, 0, 0, Math.PI / 2);
    return [
      { geometry: new THREE.CylinderGeometry(r, r, w, 22), matrix: m, color: TYRE },
      { geometry: new THREE.CylinderGeometry(r * 0.64, r * 0.64, w + 0.016, 18), matrix: m, color: RIMC },
      { geometry: new THREE.CylinderGeometry(r * 0.3, r * 0.3, w + 0.03, 10), matrix: m, color: BLACK },
      { geometry: new THREE.TorusGeometry(r * 0.66, 0.02, 6, 20), matrix: M4(x + Math.sign(x) * (w / 2 + 0.004), y, z, Math.PI / 2), color: CHROME },
    ];
  };
  function vehicleParts(type) {
    const paint = [], trim = [], lamp = [];
    const P_ = (g, m, c = PAINT) => paint.push({ geometry: g, matrix: m || new THREE.Matrix4(), color: c });
    const T_ = (g, m, c = BLACK) => trim.push({ geometry: g, matrix: m || new THREE.Matrix4(), color: c });
    const L_ = (g, m, c) => lamp.push({ geometry: g, matrix: m || new THREE.Matrix4(), color: c });
    let len = 4.1, wid = 1.86, hl = 0.72, nose = 2.0, tail = -2.02;
    if (type === 'sedan' || type === 'taxi') {
      P_(loftGeo([[2.04, 0.54, 0.34, 0.64], [1.96, 0.82, 0.30, 0.82], [1.72, 0.90, 0.27, 0.92], [1.22, 0.92, 0.25, 0.96], [0.62, 0.94, 0.25, 0.99], [-0.55, 0.94, 0.25, 1.01], [-1.32, 0.90, 0.25, 0.99], [-1.78, 0.83, 0.28, 0.92], [-1.98, 0.64, 0.32, 0.80], [-2.05, 0.52, 0.36, 0.70]], 20));
      T_(loftGeo([[0.88, 0.68, 0.94, 1.02], [0.55, 0.74, 0.94, 1.30], [0.18, 0.76, 0.94, 1.46], [-0.55, 0.77, 0.94, 1.49], [-1.02, 0.73, 0.94, 1.44], [-1.36, 0.66, 0.94, 1.22], [-1.52, 0.58, 0.94, 1.04]], 18), null, GLASS);
      P_(roundedBox(1.30, 0.06, 1.42, 0.025, 1), M4(0, 1.5, -0.38));
      for (const sx of [-1, 1]) for (const [pz, ph, rx] of [[0.56, 0.5, -0.5], [-0.18, 0.54, 0], [-1.22, 0.36, 0.55]]) P_(boxGeo(0.05, ph, 0.09), M4(sx * 0.745, 0.98 + ph / 2 - 0.02, pz, 0, rx, sx * -0.12));
      for (const sx of [-1, 1]) for (const sz of [1.3, -1.3]) trim.push(...wheelItems(sx * 0.82, 0.33, sz, 0.33, 0.24));
      for (const sx of [-1, 1]) T_(roundedBox(0.2, 0.11, 0.09, 0.03, 1), M4(sx * 1.0, 1.0, 0.62));
      T_(boxGeo(1.0, 0.13, 0.05), M4(0, 0.46, 2.035)); T_(boxGeo(1.7, 0.1, 3.4), M4(0, 0.27, 0), BLACK);
      if (type === 'taxi') { L_(roundedBox(0.52, 0.15, 0.2, 0.04, 1), M4(0, 1.6, -0.3), AMBER); T_(boxGeo(1.9, 0.1, 2.6), M4(0, 0.62, -0.1), new THREE.Color(0xd8dadc)); }
    } else if (type === 'suv') {
      len = 4.35; wid = 1.94; hl = 0.84; nose = 2.08; tail = -2.16;
      P_(loftGeo([[2.1, 0.58, 0.42, 0.80], [2.0, 0.88, 0.37, 1.0], [1.62, 0.95, 0.33, 1.10], [0.9, 0.97, 0.31, 1.14], [-1.3, 0.97, 0.31, 1.16], [-1.96, 0.93, 0.33, 1.12], [-2.13, 0.80, 0.38, 1.02], [-2.2, 0.62, 0.44, 0.92]], 20, 0.5));
      T_(loftGeo([[0.98, 0.70, 1.08, 1.16], [0.62, 0.79, 1.08, 1.48], [0.22, 0.81, 1.08, 1.68], [-1.2, 0.81, 1.08, 1.72], [-1.86, 0.77, 1.08, 1.64], [-2.08, 0.68, 1.08, 1.22]], 18, 0.5), null, GLASS);
      P_(roundedBox(1.4, 0.06, 2.3, 0.025, 1), M4(0, 1.73, -0.78));
      for (const sx of [-1, 1]) for (const [pz, ph, rx] of [[0.6, 0.62, -0.5], [-0.3, 0.66, 0], [-1.1, 0.66, 0], [-1.92, 0.56, 0.3]]) P_(boxGeo(0.05, ph, 0.1), M4(sx * 0.79, 1.1 + ph / 2 - 0.02, pz, 0, rx, sx * -0.1));
      for (const sx of [-1, 1]) for (const sz of [1.36, -1.36]) trim.push(...wheelItems(sx * 0.85, 0.37, sz, 0.37, 0.26));
      for (const sx of [-1, 1]) { T_(roundedBox(0.22, 0.13, 0.1, 0.03, 1), M4(sx * 1.04, 1.14, 0.66)); T_(boxGeo(0.04, 0.04, 2.0), M4(sx * 0.6, 1.79, -0.8), CHROME); }
      T_(boxGeo(1.2, 0.26, 0.05), M4(0, 0.6, 2.1)); T_(boxGeo(1.84, 0.14, 3.7), M4(0, 0.33, 0), BLACK);
    } else if (type === 'van') {
      len = 5.0; wid = 1.94; hl = 0.82; nose = 2.44; tail = -2.54;
      P_(loftGeo([[2.45, 0.62, 0.46, 0.96], [2.38, 0.88, 0.38, 1.16], [2.06, 0.94, 0.34, 1.46], [1.55, 0.95, 0.32, 1.98], [1.0, 0.95, 0.32, 2.05], [-2.3, 0.95, 0.32, 2.05], [-2.5, 0.9, 0.36, 1.98], [-2.55, 0.7, 0.5, 1.8]], 20, 0.3));
      T_(boxGeo(1.62, 0.78, 0.04), M4(0, 1.62, 1.83, 0, -0.76), GLASS);
      for (const sx of [-1, 1]) { T_(boxGeo(0.04, 0.54, 0.95), M4(sx * 0.932, 1.6, 0.98), GLASS); T_(boxGeo(0.04, 0.5, 2.3), M4(sx * 0.932, 1.62, -0.95), GLASS); T_(roundedBox(0.2, 0.2, 0.1, 0.03, 1), M4(sx * 1.06, 1.42, 1.5)); }
      T_(boxGeo(1.4, 0.5, 0.04), M4(0, 1.62, -2.55), GLASS);
      for (const sx of [-1, 1]) for (const sz of [1.55, -1.5]) trim.push(...wheelItems(sx * 0.84, 0.36, sz, 0.36, 0.25));
      T_(boxGeo(1.3, 0.22, 0.05), M4(0, 0.62, 2.45)); T_(boxGeo(1.84, 0.12, 4.2), M4(0, 0.32, 0), BLACK);
    } else {
      len = 11.9; wid = 2.55; hl = 0.9; nose = 5.96; tail = -5.96;
      P_(roundedBox(2.55, 0.98, 11.9, 0.14, 2), M4(0, 0.85, 0));
      P_(roundedBox(2.55, 1.96, 11.9, 0.16, 2), M4(0, 2.2, 0), new THREE.Color(0xdfe3e6));
      P_(roundedBox(2.1, 0.22, 4.2, 0.08, 1), M4(0, 3.26, -1.6), new THREE.Color(0xc9cdd0));
      for (const sx of [-1, 1]) {
        T_(boxGeo(0.05, 1.02, 10.6), M4(sx * 1.262, 2.12, -0.2), GLASS);
        L_(boxGeo(0.04, 0.86, 10.4), M4(sx * 1.246, 2.14, -0.2), WARM);
        for (let i = 0; i < 8; i++) T_(boxGeo(0.07, 1.04, 0.09), M4(sx * 1.275, 2.12, -5.3 + i * 1.46), BLACK);
        T_(roundedBox(0.16, 0.3, 0.12, 0.03, 1), M4(sx * 1.42, 2.5, 5.75));
        for (const sz of [3.9, -3.3]) trim.push(...wheelItems(sx * 1.13, 0.5, sz, 0.5, 0.3));
      }
      for (const dz of [4.5, -0.9]) T_(boxGeo(0.06, 2.1, 1.25), M4(-1.27, 1.5, dz), GLASS);
      T_(boxGeo(2.3, 1.42, 0.05), M4(0, 2.0, 5.955), GLASS); T_(boxGeo(2.2, 0.9, 0.05), M4(0, 2.25, -5.955), GLASS);
      L_(boxGeo(1.5, 0.26, 0.05), M4(0, 2.92, 5.965), AMBER);
      T_(boxGeo(2.4, 0.16, 11.4), M4(0, 0.38, 0), BLACK); T_(boxGeo(2.3, 0.3, 0.06), M4(0, 0.62, 5.96));
    }
    const lw = type === 'bus' ? 0.95 : wid * 0.33;
    for (const sx of [-1, 1]) {
      L_(roundedBox(type === 'bus' ? 0.3 : 0.36, 0.1, 0.06, 0.02, 1), M4(sx * lw, hl, nose - 0.03), HEAD);
      L_(roundedBox(type === 'bus' ? 0.22 : 0.4, type === 'van' || type === 'bus' ? 0.34 : 0.08, 0.06, 0.02, 1), M4(sx * (lw + 0.04), type === 'van' ? 1.2 : type === 'bus' ? 1.1 : hl + 0.1, tail + 0.03), TAIL);
    }
    if (type === 'sedan' || type === 'taxi' || type === 'suv') L_(boxGeo(wid * 0.56, 0.025, 0.04), M4(0, hl + 0.11, tail + 0.03), new THREE.Color(1.6, 0.1, 0.1));
    T_(boxGeo(0.44, 0.13, 0.02), M4(0, type === 'bus' ? 0.7 : 0.5, nose + 0.03), PLATE); T_(boxGeo(0.44, 0.13, 0.02), M4(0, type === 'bus' ? 0.7 : hl - 0.14, tail - 0.02), PLATE);
    return { paint: mergeGeoms(paint, { vertexColors: true }), trim: mergeGeoms(trim, { vertexColors: true }), lamp: mergeGeoms(lamp, { vertexColors: true }), len, wid };
  }
  // paint: white vertices take the per-vehicle colour, anything else keeps its own
  const vPaintMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.26, metalness: 0.55, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 1.7 });
  vPaintMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `
      vColor = color;
      #ifdef USE_INSTANCING_COLOR
        if (min(color.r, min(color.g, color.b)) > 0.995) vColor = instanceColor;
      #endif`);
  };
  vPaintMat.customProgramCacheKey = () => 'vehicle-paint-1';
  const vTrimMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.3, metalness: 0.55, envMapIntensity: 1.6 });
  const vLampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true });
  [vPaintMat, vTrimMat, vLampMat].forEach((m) => { m.userData.surfaceProcedural = true; });

  // --- kerbside parking: short rows of parallel-parked cars on side streets
  const parkedSlots = [];
  {
    const PARK = new Set(['residential', 'unclassified', 'tertiary', 'service']);
    const keep = [C.start, C.carStart, C.taxiStart, ...C.spots.map((s) => s.pos)];
    for (const r of C.roads) {
      if (!PARK.has(r.hw) || r.samp.length < 6 || parkedSlots.length >= 76) continue;
      cumOf(r);
      if (r.len < 60) continue;
      const mid = r.samp[r.samp.length >> 1];
      if (hotDist(mid[0], mid[1]) > 330) continue;
      let run = 0, gap = RI(1, 4), side = 1, any = false;
      for (let d = 14; d < r.len - 14 && parkedSlots.length < 76; d += 5.7) {
        if (run <= 0) { if (--gap > 0) continue; run = RI(2, 6); gap = RI(3, 9); side = r.oneway ? 1 : (R(0, 1) < 0.5 ? 1 : -1); }
        run--;
        const p = roadAt(r, d);
        const off = (r.half - 1.05) * side;
        const x = p.x - p.tz * off, z = p.z + p.tx * off;
        if (!IN(x, z, -6) || C.pointInWater(x, z) || blocked(x, z, 1.3) || otherRoadNear(p.x, p.z, r, 9) || (C.inTrench && C.inTrench(x, z, 1.5))) continue;
        if (keep.some((k) => Math.hypot(k[0] - x, k[1] - z) < 9)) continue;
        parkedSlots.push({ x, z, ry: Math.atan2(p.tx, p.tz) + (side > 0 ? 0 : Math.PI) + R(-0.03, 0.03), type: pick(['sedan', 'sedan', 'sedan', 'suv', 'suv', 'van']) });
        any = true;
      }
      if (any) r.parkR = true;
    }
  }
  // a lane that would run over a tunnel trench is not driven
  function laneClear(r, off) {
    if (!C.inTrench) return true;
    const s = r.samp, n = s.length;
    for (let i = 0; i < n; i++) {
      const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
      for (const sg of r.oneway ? [1] : [1, -1]) if (C.inTrench(s[i][0] - tz * off * sg, s[i][1] + tx * off * sg, 1.3, r)) return false;
    }
    return true;
  }
  function lanesOf(r) {
    if (r.lanes) return r.lanes;
    if (r.ramp) return (r.lanes = [-2.0, 2.0]);
    const out = [];
    const med = (r.name || '').includes('千禧大道') && r.width >= 18;
    if (r.oneway) {
      const lo = -r.half + 0.5, hi = r.half - 0.5 - (r.parkR ? 2.2 : 0);
      const nl = Math.max(1, Math.min(4, Math.floor((hi - lo) / 3.3))), lw = (hi - lo) / nl;
      for (let k = 0; k < nl; k++) { const o = lo + lw * (k + 0.5); if (med && Math.abs(o) < 3.5) continue; out.push(o); }
    } else {
      const lo = 0.35, hi = r.half - 0.5 - (r.parkR ? 2.2 : 0);
      const nl = Math.max(1, Math.min(3, Math.floor((hi - lo) / 3.2))), lw = (hi - lo) / nl;
      for (let k = 0; k < nl; k++) out.push(lo + lw * (k + 0.5));
    }
    if (!out.length) out.push(r.oneway ? 0 : r.half * 0.5);
    const clear = out.filter((o) => laneClear(r, o));
    if (!clear.length) r.trenchClosed = true;
    return (r.lanes = clear.length ? clear : out);
  }

  // --- the fleet
  const traffic = [];
  const carPalette = [0xd8d5cc, 0x1b1e24, 0x8b9298, 0x2b4a6a, 0x7a2a2a, 0xc8c2b0, 0x394a3a, 0x5c636b, 0xe9e9e6, 0x23324a, 0x6a1f24, 0x9a9488];
  const taxiPalette = [0x1fae9c, 0xd8a52a, 0x2a5fa8, 0xe8e6e0, 0x1fae9c];
  const busPalette = [0x2a5fa8, 0x2f8a55, 0xb8452f];
  const fleetPlan = [['sedan', 12], ['suv', 5], ['taxi', 6], ['van', 3], ['bus', 3]];
  const VT = {};
  const TYPES = ['sedan', 'suv', 'taxi', 'van', 'bus'];
  const nParked = (t) => parkedSlots.filter((s) => s.type === t).length;
  for (const t of TYPES) {
    const parts = vehicleParts(t);
    const n = (fleetPlan.find((f) => f[0] === t) || [t, 0])[1] + nParked(t);
    const mk = (g, mat, nm) => {
      const m = new THREE.InstancedMesh(g, mat, Math.max(1, n));
      m.name = 'vehicles-' + t + '-' + nm; m.frustumCulled = false; m.castShadow = nm === 'paint'; m.userData.passable = true; m.userData.surfaceProcedural = true;
      m.userData.identity = [{ name: t, extents: [parts.wid, 1.4, parts.len] }]; m.userData.parts = [t];
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(m); return m;
    };
    VT[t] = { paint: mk(parts.paint, vPaintMat, 'paint'), trim: mk(parts.trim, vTrimMat, 'trim'), lamp: mk(parts.lamp, vLampMat, 'lamp'), len: parts.len, wid: parts.wid, next: 0 };
  }
  const nAll = fleetPlan.reduce((n, f) => n + f[1], 0) + parkedSlots.length;
  // contact shadow under every vehicle, light pool ahead of every moving one
  const vShadow = (() => {
    const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2);
    const m = new THREE.InstancedMesh(g, PPL.blobMat, nAll);
    m.name = 'vehicle-contact'; m.frustumCulled = false; m.userData.passable = true; m.userData.surfaceProcedural = true; m.renderOrder = 3; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m); return m;
  })();
  const vPool = (() => {
    const g = new THREE.BufferGeometry();
    const pos = [], col = [], idx = [];
    const rows = [[2.0, 0.9, 0.0], [3.4, 1.3, 0.34], [6.5, 2.1, 0.2], [12.0, 3.0, 0.0]];
    rows.forEach(([z, w, a], i) => {
      for (const [sx, k] of [[-1, 0], [0, 1], [1, 0]]) { pos.push(sx * w, 0.05, z); const v = a * (0.35 + 0.65 * k); col.push(v * 1.0, v * 0.92, v * 0.74); }
      if (i) { const b = i * 3; idx.push(b - 3, b, b - 2, b, b + 1, b - 2, b - 2, b + 1, b - 1, b + 1, b + 2, b - 1); }
    });
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    mat.userData.surfaceProcedural = true;
    const m = new THREE.InstancedMesh(g, mat, fleetPlan.reduce((n, f) => n + f[1], 0));
    m.name = 'vehicle-headlight-pools'; m.frustumCulled = false; m.userData.passable = true; m.userData.surfaceProcedural = true; m.renderOrder = 4; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(m); G.noReflect && G.noReflect.push(m); return m;
  })();
  const _m4 = new THREE.Matrix4(), _m4b = new THREE.Matrix4(), _zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const _m4p = new THREE.Matrix4();
  function placeVehicle(vt, slot, gi, x, z, yaw, lit, y = 0, pitch = 0) {
    _m4.makeRotationY(yaw);
    if (pitch) _m4.multiply(_m4p.makeRotationX(pitch));
    _m4.setPosition(x, y + 0.02, z);
    vt.paint.setMatrixAt(slot, _m4); vt.trim.setMatrixAt(slot, _m4); vt.lamp.setMatrixAt(slot, lit ? _m4 : _zero);
    _m4b.makeScale(vt.wid * 1.5, 1, vt.len * 1.22).premultiply(_m4); _m4b.elements[13] = y + 0.05;
    vShadow.setMatrixAt(gi, _m4b);
  }
  let gIndex = 0;
  for (const s of parkedSlots) {
    const vt = VT[s.type], slot = vt.next++;
    placeVehicle(vt, slot, gIndex++, s.x, s.z, s.ry, false);
    vt.paint.setColorAt(slot, new THREE.Color(pick(carPalette)));
  }
  A.parked = { body: VT.sedan.paint, glass: VT.sedan.trim, slots: parkedSlots };

  // junction table: where can a vehicle go from the end of a road
  const endLinks = new Map();
  function linksAt(r, atEnd) {
    const key = r.id + (atEnd ? ':1' : ':0');
    let l = endLinks.get(key);
    if (l) return l;
    l = [];
    const e = atEnd ? r.samp[r.samp.length - 1] : r.samp[0];
    for (const q of TR) {
      if (q === r) continue;
      let bi = -1, bd = 11;
      for (let i = 0; i < q.samp.length; i++) { const d = Math.hypot(q.samp[i][0] - e[0], q.samp[i][1] - e[1]); if (d < bd) { bd = d; bi = i; } }
      if (bi >= 0) l.push({ q, i: bi });
    }
    endLinks.set(key, l);
    return l;
  }
  const spawnRoads = TR.filter((r) => { const m = r.samp[r.samp.length >> 1]; return IN(m[0], m[1], -30) && r.len > 90 && (lanesOf(r), !r.trenchClosed); });
  const busRoads = spawnRoads.filter((r) => r.hw === 'primary' || r.hw === 'secondary');
  function spawn(v, px, pz, minDist, maxDist = 1e9) {
    for (let tries = 0; tries < 60; tries++) {
      const r = pick(v.type === 'bus' && busRoads.length ? busRoads : spawnRoads);
      const d = R(12, r.len - 12), dir = r.oneway ? 1 : (R(0, 1) < 0.5 ? 1 : -1);
      const p = roadAt(r, d);
      const dpl = Math.hypot(p.x - px, p.z - pz);
      if (!IN(p.x, p.z, -10) || dpl < minDist || dpl > maxDist) continue;
      const lanes = lanesOf(r), k = v.type === 'bus' ? lanes.length - 1 : RI(0, lanes.length - 1), off = lanes[k];
      const fx = p.tx * dir, fz = p.tz * dir, x = p.x - fz * off, z = p.z + fx * off;
      if (traffic.some((o) => o !== v && Math.hypot(o.x - x, o.z - z) < 16)) continue;
      Object.assign(v, { road: r, d, dir, seg: p.i, laneK: k, off, x, z, hx: fx, hz: fz, v: v.v0 * 0.8, stuck: 0 });
      return true;
    }
    return false;
  }
  for (const [type, n] of fleetPlan) for (let i = 0; i < n; i++) {
    const vt = VT[type];
    const v = { type, kind: type, vt, slot: vt.next++, gi: gIndex++, pi: traffic.length, len: vt.len, wid: vt.wid, v0: type === 'bus' ? R(8, 9.5) : type === 'van' ? R(8.5, 10.5) : R(9.5, 13.5), x: 0, z: 0, hx: 0, hz: 1, v: 0, stuck: 0, road: null };
    vt.paint.setColorAt(v.slot, new THREE.Color(type === 'taxi' ? taxiPalette[i % taxiPalette.length] : type === 'bus' ? busPalette[i % busPalette.length] : type === 'van' ? pick([0xe6e6e2, 0xd0d2d4, 0x2b3038, 0xe6e6e2]) : pick(carPalette)));
    traffic.push(v);
    if (!spawn(v, C.start[0], C.start[1], 30, 380)) spawn(v, 1e6, 1e6, 0);
  }
  for (const t of TYPES) if (VT[t].paint.instanceColor) VT[t].paint.instanceColor.needsUpdate = true;
  A.traffic = traffic;

  function nextRoad(v) {
    const r = v.road, links = linksAt(r, v.dir > 0);
    const opts = [];
    for (const { q, i } of links) {
      cumOf(q);
      if ((lanesOf(q), q.trenchClosed)) continue;
      for (const dir of q.oneway ? [1] : [1, -1]) {
        if (dir > 0 ? i > q.samp.length - 4 : i < 3) continue;
        const a = q.samp[i], b = q.samp[i + dir];
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, hx = (b[0] - a[0]) / l, hz = (b[1] - a[1]) / l;
        const dot = hx * v.hx + hz * v.hz;
        if (dot < -0.3) continue;
        opts.push({ q, i, dir, w: 0.3 + dot + (q.hw === 'primary' || q.hw === 'secondary' ? 0.4 : 0) });
      }
    }
    if (!opts.length) return false;
    let tot = 0; for (const o of opts) tot += o.w;
    let pickW = R(0, tot), o = opts[0];
    for (const c of opts) { pickW -= c.w; if (pickW <= 0) { o = c; break; } }
    const lanes = lanesOf(o.q);
    v.road = o.q; v.dir = o.dir; v.d = o.q.cum[o.i]; v.seg = o.i;
    v.laneK = v.type === 'bus' ? lanes.length - 1 : Math.min(v.laneK, lanes.length - 1); v.off = lanes[v.laneK];
    return true;
  }

  // ------------------------------------------------------------- shared bikes
  {
    const fr = [], wh = [];
    const tube = (x0, y0, z0, x1, y1, z1, r, list = fr, color) => {
      const d = new THREE.Vector3(x1 - x0, y1 - y0, z1 - z0), l = d.length();
      const m = new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()), new THREE.Vector3(1, 1, 1));
      list.push({ geometry: new THREE.CylinderGeometry(r, r, l, 8), matrix: m, color });
    };
    tube(0, 0.33, -0.52, 0, 0.82, -0.2, 0.022); tube(0, 0.82, -0.2, 0, 0.3, 0.02, 0.026); tube(0, 0.3, 0.02, 0, 0.33, -0.52, 0.016);
    tube(0, 0.3, 0.02, 0, 0.74, 0.42, 0.03); tube(0, 0.82, -0.2, 0, 0.78, 0.4, 0.022); tube(0, 0.92, 0.38, 0, 0.33, 0.56, 0.02);
    tube(0, 0.82, -0.2, 0, 0.94, -0.24, 0.016); tube(-0.26, 1.0, 0.36, 0.26, 1.0, 0.36, 0.014); tube(0, 0.92, 0.38, 0, 1.0, 0.36, 0.016);
    fr.push({ geometry: roundedBox(0.16, 0.05, 0.26, 0.02, 1), matrix: M4(0, 0.96, -0.26), color: BLACK });
    fr.push({ geometry: boxGeo(0.3, 0.2, 0.22), matrix: M4(0, 0.86, 0.6), color: new THREE.Color(0x2a2c30) });
    fr.push({ geometry: boxGeo(0.07, 0.02, 0.5), matrix: M4(0, 0.7, -0.52, 0, 0.08), color: PAINT });
    fr.push({ geometry: boxGeo(0.12, 0.09, 0.06), matrix: M4(0, 0.66, -0.82), color: new THREE.Color(0.6, 0.05, 0.05) });
    for (const z of [0.56, -0.52]) {
      wh.push({ geometry: new THREE.TorusGeometry(0.31, 0.026, 8, 28), matrix: M4(0, 0.33, z, Math.PI / 2), color: TYRE });
      wh.push({ geometry: new THREE.TorusGeometry(0.285, 0.008, 6, 28), matrix: M4(0, 0.33, z, Math.PI / 2), color: RIMC });
      for (let k = 0; k < 6; k++) wh.push({ geometry: boxGeo(0.006, 0.56, 0.006), matrix: M4(0, 0.33, z, 0, k * Math.PI / 6), color: RIMC });
      wh.push({ geometry: new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), matrix: M4(0, 0.33, z, 0, 0, Math.PI / 2), color: RIMC });
    }
    const bikeSlots = [];
    const bikeRows = [[-9, 160, 7, 1], [-616, 118, 6, 0], [-66, 606, 6, 1], [-6, 150, 5, -1], [12, 140, 5, 1], [14, 137, 4, -1]];
    // racks that OSM puts on a carriageway slide back onto the pavement, or are dropped
    const laneDist = (x, z) => { let d = 1e9; for (const r of C.roads) { if (!r.samp || !(r.half > 0) || !DRIVE.has(r.hw)) continue; for (let i = 0; i + 1 < r.samp.length; i++) { const p = r.samp[i], q = r.samp[i + 1], ux = q[0] - p[0], uz = q[1] - p[1], L2 = ux * ux + uz * uz || 1, t = clamp(((x - p[0]) * ux + (z - p[1]) * uz) / L2, 0, 1); d = Math.min(d, Math.hypot(x - p[0] - ux * t, z - p[1] - uz * t) - r.half); } } return d; };
    const hitCol = (x, z) => C.colliders.some((c) => x > c.x0 - 0.5 && x < c.x1 + 0.5 && z > c.z0 - 0.7 && z < c.z1 + 0.7);
    const rowOk = (bx, bz, count) => { for (let i = 0; i < count; i++) { const x = bx + i * 0.62; if (laneDist(x, bz) < 1.2 || C.pointInWater(x, bz) || hitCol(x, bz)) return false; } return true; };
    const shifts = []; for (let dx = -10; dx <= 10; dx += 1) for (let dz = -10; dz <= 10; dz += 1) shifts.push([dx, dz]); shifts.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    for (let [bx, bz, count, dir] of bikeRows) {
      if (!rowOk(bx, bz, count)) { const f = shifts.find(([dx, dz]) => rowOk(bx + dx, bz + dz, count) && !bikeSlots.some((s) => Math.abs(s.z - bz - dz) < 1.2 && s.x > bx + dx - 1 && s.x < bx + dx + count * 0.62 + 0.4)); if (!f) continue; bx += f[0]; bz += f[1]; }
      for (let i = 0; i < count; i++) bikeSlots.push({ x: bx + i * 0.62, z: bz + dir * (i % 2) * 0.12, ry: 0.15 + dir * 0.08 + R(-0.06, 0.06), col: pick([0xe0b53a, 0x2f7fc4, 0x3aa68a]) });
    }
    const mBike = new THREE.InstancedMesh(mergeGeoms(fr, { vertexColors: true }), vPaintMat, bikeSlots.length);
    const mBW = new THREE.InstancedMesh(mergeGeoms(wh, { vertexColors: true }), vTrimMat, bikeSlots.length);
    const d2 = new THREE.Object3D();
    bikeSlots.forEach((b, i) => {
      d2.position.set(b.x, 0.18, b.z); d2.rotation.set(0, b.ry, 0.08); d2.updateMatrix();
      mBike.setMatrixAt(i, d2.matrix); mBW.setMatrixAt(i, d2.matrix); mBike.setColorAt(i, new THREE.Color(b.col));
    });
    [mBike, mBW].forEach((m) => { m.userData.passable = true; m.userData.surfaceProcedural = true; m.name = 'shared-bikes'; m.userData.identity = [{ name: 'bike', extents: [0.6, 1.05, 1.4] }]; m.userData.parts = ['bike']; scene.add(m); });
    A.bikes = mBike;
  }

  // ------------------------------------------------------------- pedestrians
  const PED_N = 110;
  const pedRuns = [];
  // a walking line, resampled every metre and split wherever it would clip a wall,
  // the water or a tunnel trench (pedestrians keep within 0.7 m of the line)
  const runClear = (x, z) => IN(x, z, -5) && !C.pointInWater(x, z) && !blocked(x, z, 1.05) && !(C.inTrench && C.inTrench(x, z, 0.8));
  function addRun(raw, w = 1, fixed = 0) {
    let cur = [];
    const flush = () => { if (cur.length > 1) addRun1(cur, w, fixed); cur = []; };
    for (let i = 0; i < raw.length; i++) {
      const a = raw[i], b = raw[i + 1];
      const n = b ? Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]))) : 1;
      for (let k = 0; k < n; k++) {
        const t = k / n, x = b ? a[0] + (b[0] - a[0]) * t : a[0], z = b ? a[1] + (b[1] - a[1]) * t : a[1];
        if (!runClear(x, z)) { flush(); continue; }
        if (k === 0 || k === n - 1 || !b) cur.push([x, z]);
      }
    }
    flush();
  }
  function addRun1(pts, w, fixed) {
    const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const run = { samp: pts, cum, len: cum[cum.length - 1], w, fixed };
    if (run.len > 12) pedRuns.push(run);
  }
  {
    // pavements: the strip beside the carriageway, cut wherever it meets a wall, water or the map edge
    const WALK = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified']);
    for (const r of C.roads) {
      if (!WALK.has(r.hw) || r.samp.length < 6) continue;
      for (const side of r.oneway ? [1] : [1, -1]) {
        const off = (r.half + 2.5) * side;
        let cur = [];
        const flush = () => { if (cur.length > 3) { const m = cur[cur.length >> 1]; if (hotDist(m[0], m[1]) < 300) addRun(cur, 1); } cur = []; };
        for (let i = 0; i < r.samp.length; i++) {
          const a = r.samp[Math.max(0, i - 1)], b = r.samp[Math.min(r.samp.length - 1, i + 1)];
          const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, tx = (b[0] - a[0]) / l, tz = (b[1] - a[1]) / l;
          const x = r.samp[i][0] - tz * off, z = r.samp[i][1] + tx * off;
          if (!runClear(x, z)) flush(); else cur.push([x, z]);
        }
        flush();
      }
    }
    addRun([[-64, 470], [-70, 520], [-74, 570], [-72, 606]], 1, 8);
    addRun([[-40, 545], [-55, 585], [-62, 610], [-70, 618]], 1, 8);
    addRun([[-600, 100], [-606, 106.5], [-613, 110], [-622, 110.5]], 1, 5);
    addRun([[-545, 20], [-560, 45], [-575, 75], [-592, 90], [-598, 100]], 1, 8);
  }
  const pedI = new PPL.Instanced('pedestrians');
  const peds = [];
  const free = pedRuns.filter((r) => !r.fixed);
  for (const r of pedRuns) { const m = r.samp[r.samp.length >> 1]; r.mx = m[0]; r.mz = m[1]; }
  {
    let tot = 0; for (const r of free) tot += r.len;
    const pickRun = () => { let t = R(0, tot); for (const r of free) { t -= r.len; if (t <= 0) return r; } return free[free.length - 1] || pedRuns[0]; };
    const mkPed = (run) => {
      pedI.add({ umbrella: R(0, 1) < 0.3 });
      peds.push({ run, d: R(0, run.len), dir: R(0, 1) < 0.5 ? 1 : -1, v: R(1.05, 1.6), lat: R(-0.6, 0.6), avoid: 0, phase: R(0, 6.28), x: 0, z: 0, yaw: 0, scare: 0, idle: R(0, 1) < 0.1 ? R(3, 14) : 0, amp: 1, seg: 0, fresh: true });
    };
    for (const r of pedRuns) for (let i = 0; i < r.fixed && peds.length < PED_N; i++) mkPed(r);
    while (peds.length < PED_N && free.length) mkPed(pickRun());
  }
  // street pedestrians stay with the player: anyone left far behind re-enters on a pavement nearby
  function regroup(px, pz, budget, minD) {
    let cand = null;
    for (let i = 0; i < peds.length && budget > 0; i++) {
      const p = peds[i];
      if (p.run.fixed || (p.x - px) ** 2 + (p.z - pz) ** 2 < 215 * 215) continue;
      if (!cand) { cand = free.filter((r) => { const d = Math.hypot(r.mx - px, r.mz - pz); return d >= minD && d < 180; }); if (!cand.length) return; }
      const run = pick(cand);
      p.run = run; p.d = R(0, run.len); p.seg = 0; p.fresh = true; p.scare = 0;
      const q = roadAt(run, p.d); p.x = q.x; p.z = q.z;
      budget--;
    }
  }
  A.regroupPeds = regroup;
  pedI.build(scene);
  for (const m of pedI.meshes) { m.userData.identity = [{ name: 'figure', extents: [0.5, 1.7, 0.3] }]; m.userData.parts = ['figure']; }
  A.peds = peds; A.pedMeshes = pedI.meshes;
  function updatePeds(dt, ctx) {
    const px = ctx ? ctx.player.x : 1e9, pz = ctx ? ctx.player.z : 1e9;
    const fast = ctx && ctx.mode === 'car' && Math.abs(ctx.car.speed) > 6;
    if (ctx && dt > 0) regroup(px, pz, 2, 50);
    for (let i = 0; i < peds.length; i++) {
      const p = peds[i], run = p.run;
      let speed = 0;
      if (p.scare > 0) { p.scare -= dt; speed = 3.7; p.idle = 0; }
      else if (p.idle > 0) p.idle -= dt;
      else { speed = p.v; if (dt > 0 && Math.random() < dt * 0.012) p.idle = R(2, 9); }
      p.d += speed * p.dir * dt;
      if (p.d >= run.len) { p.d = run.len; p.dir = -1; } else if (p.d <= 0) { p.d = 0; p.dir = 1; }
      const q = roadAt(run, p.d, p.seg); p.seg = q.i;
      const hx = q.tx * p.dir, hz = q.tz * p.dir;
      // step aside for the player, bolt from a fast car
      const dx = px - p.x, dz = pz - p.z, dp = dx * dx + dz * dz;
      let want = 0;
      if (dp < 3.2 && !p.fresh) want = (dx * hz - dz * hx) > 0 ? -0.8 : 0.8;
      if (fast && dp < 42 && p.scare <= 0) { p.scare = 2.0; p.dir = (dx * hx + dz * hz) > 0 ? -p.dir : p.dir; }
      p.avoid = U.damp(p.avoid, want, 5, dt || 1);
      let lat = p.lat + p.avoid;
      p.x = q.x - hz * lat * p.dir; p.z = q.z + hx * lat * p.dir;
      // the line itself is clear of walls; a sidestep that would put them in one is undone
      if (lat && blocked(p.x, p.z, 0.3)) { lat = 0; p.avoid = -p.lat; p.x = q.x; p.z = q.z; }
      const yawT = Math.atan2(hx, hz);
      p.yaw = p.fresh ? yawT : p.yaw + U.wrapAngle(yawT - p.yaw) * Math.min(1, dt * 7);
      p.fresh = false;
      p.amp = U.damp(p.amp, speed > 3 ? 1.6 : speed > 0 ? clamp(speed / 1.35, 0.75, 1.15) : 0, 8, dt || 1);
      p.phase += speed * dt * 4.5;
      pedI.set(i, p.x, A.groundY ? A.groundY(p.x, p.z) : 0.17, p.z, p.yaw, p.phase, p.amp);
    }
    pedI.commit();
  }
  A.updatePeds = updatePeds;
  A.pedNear = (x, z, r) => {
    let best = null, bd = r * r;
    for (let i = 0; i < peds.length; i++) { const d = (peds[i].x - x) ** 2 + (peds[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best === null ? null : { index: best, x: peds[best].x, z: peds[best].z, dist: Math.sqrt(bd) };
  };
  A.scarePed = (i, x, z) => {
    const p = peds[i]; if (!p || p.scare > 0.5) return;
    const q = roadAt(p.run, p.d, p.seg);
    p.scare = 2.4; p.dir = ((x - p.x) * q.tx + (z - p.z) * q.tz) > 0 ? -1 : 1;
  };

  // ------------------------------------------------------------- route graph (taxi + minimap)
  const nodes = [], adj = [];
  {
    for (const r of C.roads) {
      if (!DRIVE.has(r.hw) || r.ramp) continue;
      const pts = r.samp, stride = 4;
      let prev = -1;
      for (let i = 0; i < pts.length; i += stride) {
        const k = Math.min(i, pts.length - 1);
        nodes.push({ x: pts[k][0], z: pts[k][1], road: r.id }); adj.push([]);
        const id = nodes.length - 1;
        if (prev >= 0) { const d = Math.hypot(nodes[id].x - nodes[prev].x, nodes[id].z - nodes[prev].z); adj[id].push([prev, d]); adj[prev].push([id, d]); }
        prev = id;
      }
      const last = pts[pts.length - 1];
      if (prev >= 0 && Math.hypot(nodes[prev].x - last[0], nodes[prev].z - last[1]) > 3) {
        nodes.push({ x: last[0], z: last[1], road: r.id }); adj.push([]);
        const id = nodes.length - 1, d = Math.hypot(nodes[id].x - nodes[prev].x, nodes[id].z - nodes[prev].z);
        adj[id].push([prev, d]); adj[prev].push([id, d]);
      }
    }
    // junctions: nodes of different roads that sit on top of each other
    const grid = new Map(), GC = 16;
    nodes.forEach((n, i) => { const k = Math.floor(n.x / GC) * 4096 + Math.floor(n.z / GC); let l = grid.get(k); if (!l) grid.set(k, (l = [])); l.push(i); });
    nodes.forEach((n, i) => {
      const gx = Math.floor(n.x / GC), gz = Math.floor(n.z / GC);
      for (let ax = gx - 1; ax <= gx + 1; ax++) for (let az = gz - 1; az <= gz + 1; az++) {
        const l = grid.get(ax * 4096 + az); if (!l) continue;
        for (const j of l) { if (j <= i || nodes[j].road === n.road) continue; const d = Math.hypot(nodes[j].x - n.x, nodes[j].z - n.z); if (d < 14) { adj[i].push([j, d + 2]); adj[j].push([i, d + 2]); } }
      }
    });
  }
  function nearestNode(x, z) {
    let best = -1, bd = 1e18;
    for (let i = 0; i < nodes.length; i++) { const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2; if (d < bd) { bd = d; best = i; } }
    return best;
  }
  let lastTree = null;
  function dijkstra(src) {
    if (lastTree && lastTree.src === src) return lastTree;
    const n = nodes.length, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
    const heap = [[0, src]]; dist[src] = 0;
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
      return top;
    };
    while (heap.length) {
      const [d, u] = pop();
      if (d > dist[u]) continue;
      for (const [v, w] of adj[u]) if (d + w < dist[v]) { dist[v] = d + w; prev[v] = u; push([dist[v], v]); }
    }
    return (lastTree = { src, dist, prev });
  }
  A.routeTo = (fromX, fromZ, toX, toZ) => {
    const s = nearestNode(fromX, fromZ), t = nearestNode(toX, toZ);
    if (s < 0 || t < 0) return [[toX, toZ]];
    const { dist, prev } = dijkstra(t);
    if (!isFinite(dist[s])) return [[toX, toZ]];
    const path = [];
    for (let u = s, guard = 0; u >= 0 && guard < 4000; u = prev[u], guard++) { path.push([nodes[u].x, nodes[u].z]); if (u === t) break; }
    path.push([toX, toZ]);
    return path;
  };
  A.nearestNode = nearestNode;
  A.nodes = nodes;
  // nearest point on any drivable road segment: { x, z, a, b } (a, b = edge node ids)
  A.kerbPoint = (x, z) => {
    let best = null, bd = 1e18;
    for (let a = 0; a < nodes.length; a++) {
      const na = nodes[a];
      if (Math.abs(na.x - x) > 200 || Math.abs(na.z - z) > 200) continue;
      for (const [b] of adj[a]) {
        if (b < a || nodes[b].road !== na.road) continue;
        const nb = nodes[b], dx = nb.x - na.x, dz = nb.z - na.z, l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - na.x) * dx + (z - na.z) * dz) / l2));
        const px = na.x + dx * t, pz = na.z + dz * t, d = (px - x) ** 2 + (pz - z) ** 2;
        if (d < bd) { bd = d; best = { x: px, z: pz, a, b }; }
      }
    }
    return best;
  };
  // ------------------------------------------------------------- photo beacons
  const beacons = [];
  const beaconMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(2.2, 1.3, 0.45) }, uTime: { value: 0 }, uOn: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uTime; uniform float uOn;
      void main(){
        float fade = smoothstep(0.0, 0.35, vUv.y) * (1.0 - smoothstep(0.55, 1.0, vUv.y));
        float band = 0.55 + 0.45*sin(vUv.y*40.0 - uTime*2.2);
        float edge = pow(abs(sin(vUv.x*3.14159)), 1.4);
        gl_FragColor = vec4(uColor * fade * band * edge * 0.55 * uOn, fade * 0.55 * uOn);
      }`,
  });
  const beaconGeo = new THREE.CylinderGeometry(1.5, 2.8, 24, 32, 1, true);
  const ringGeo = new THREE.RingGeometry(3.6, 4.5, 64);
  for (const spot of C.spots) {
    const g = new THREE.Group();
    g.name = 'postcard-beacon-' + spot.id;
    const beam = new THREE.Mesh(beaconGeo, beaconMat.clone());
    beam.material.uniforms.uColor.value = spot.id === 'ferry' ? new THREE.Color(1.2, 2.2, 1.5) : new THREE.Color(2.2, 1.3, 0.45);
    beam.position.y = 12; beam.userData.passable = true; beam.userData.identity = [{ name: 'beam', extents: [4, 24, 4] }]; beam.userData.parts = ['beam'];
    g.add(beam);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: spot.id === 'ferry' ? new THREE.Color(1.6, 2.6, 1.8) : new THREE.Color(2.4, 1.5, 0.5), transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; ring.name = 'beacon-ring'; ring.userData.passable = true;
    g.add(ring);
    const icon = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), new THREE.MeshBasicMaterial({ color: spot.id === 'ferry' ? new THREE.Color(1.8, 3.2, 2.2) : new THREE.Color(3.2, 2.0, 0.7) }));
    icon.position.y = 21; icon.name = 'beacon-icon'; icon.userData.passable = true; icon.userData.surfaceProcedural = true;
    g.add(icon);
    g.position.set(spot.pos[0], 0, spot.pos[1]);
    g.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; } });
    scene.add(g);
    beacons.push({ spot, group: g, beam, ring, icon, on: true });
  }
  A.beacons = beacons;

  // ------------------------------------------------------------- misc animated props
  let lastCtx = null;
  A.updateBeacons = (t, activeId, visited) => {
    const aiming = !!(G.state && G.state.aim && G.state.aim.active);
    for (const b of beacons) {
      const isTarget = b.spot.id === activeId;
      const vis = !visited || !visited.includes(b.spot.id) || b.spot.id === 'ferry';
      b.group.visible = vis;
      // standing in the spot or framing a shot: the marker gets out of the picture
      const inside = lastCtx ? Math.hypot(lastCtx.player.x - b.spot.pos[0], lastCtx.player.z - b.spot.pos[1]) < 7 : false;
      const show = aiming || inside ? 0 : 1;
      b.fade = U.damp(b.fade === undefined ? 1 : b.fade, show, 6, 0.016);
      b.beam.visible = b.fade > 0.02; b.icon.visible = b.fade > 0.5;
      b.ring.material.opacity = 0.7 * (aiming ? b.fade : Math.max(0.25, b.fade));
      b.icon.rotation.y = t * 1.1;
      b.icon.position.y = 21 + Math.sin(t * 1.8 + b.spot.pos[0]) * 0.5;
      b.beam.material.uniforms.uTime.value = t;
      b.beam.material.uniforms.uOn.value = (isTarget ? 1.0 : 0.35) * b.fade;
      b.ring.scale.setScalar(isTarget ? 1 + Math.sin(t * 2.2) * 0.06 : 1);
    }
  };

  const _obs = [];
  A.updateTraffic = (dt, playerX, playerZ, ctx) => {
    lastCtx = ctx || { player: { x: playerX, z: playerZ }, mode: 'foot', car: { x: 1e9, z: 1e9, yaw: 0, speed: 0 }, taxi: { x: 1e9, z: 1e9, yaw: 0, speed: 0 } };
    _obs.length = 0;
    _obs.push([lastCtx.car.x, lastCtx.car.z, 2.3], [lastCtx.taxi.x, lastCtx.taxi.z, 2.3]);
    if (lastCtx.mode !== 'car' && lastCtx.mode !== 'taxi') _obs.push([playerX, playerZ, 0.5]);
    for (const v of traffic) {
      // gap to whatever is ahead in this lane
      let gap = 1e9, waitSig = false;
      for (const o of traffic) {
        if (o === v) continue;
        const dx = o.x - v.x, dz = o.z - v.z, ah = dx * v.hx + dz * v.hz;
        if (ah <= 0 || ah > 42) continue;
        if (Math.abs(dx * v.hz - dz * v.hx) > (v.wid + o.wid) / 2 + 0.4) continue;
        if (o.hx * v.hx + o.hz * v.hz < 0.2) continue;
        gap = Math.min(gap, ah - (v.len + o.len) / 2);
      }
      for (const o of _obs) {
        const dx = o[0] - v.x, dz = o[1] - v.z, ah = dx * v.hx + dz * v.hz;
        if (ah <= 0 || ah > 30) continue;
        if (Math.abs(dx * v.hz - dz * v.hx) > v.wid / 2 + 1.0) continue;
        gap = Math.min(gap, ah - v.len / 2 - o[2]);
      }
      for (const p of peds) {
        const dx = p.x - v.x, dz = p.z - v.z;
        if (dx > 16 || dx < -16 || dz > 16 || dz < -16) continue;
        const ah = dx * v.hx + dz * v.hz;
        if (ah <= 0 || Math.abs(dx * v.hz - dz * v.hx) > v.wid / 2 + 0.7) continue;
        gap = Math.min(gap, ah - v.len / 2 - 0.6);
      }
      if (C.signalAt) {
        const sg = C.signalAt(v.x, v.z, v.hx, v.hz, 46);
        if (sg && sg.dist > v.len / 2 - 1 && (sg.state === 'red' || (sg.state === 'yellow' && sg.dist > 10 + v.len / 2))) { gap = Math.min(gap, sg.dist - v.len / 2 - 0.8); waitSig = true; }
      }
      const vdes = Math.min(v.v0, Math.max(0, (gap - 1.8) * 0.85));
      v.v = Math.max(0, v.v + clamp((vdes - v.v) * 2.4, -9, 2.1) * dt);
      v.d += v.v * v.dir * dt;
      v.stuck = v.v < 0.25 && !waitSig ? v.stuck + dt : 0;
      let snap = dt === 0;
      const r = v.road;
      const far = Math.hypot(v.x - playerX, v.z - playerZ);
      // inbound tunnel ramps carry on into the bore and leave the map there
      const bore = r.ramp && r.ramp.kind === 'in' && v.dir > 0;
      if (bore && v.d >= r.len - 0.5) { if (v.d > r.len + 55) { spawn(v, playerX, playerZ, 140, 380); snap = true; } }
      else if ((v.dir > 0 && v.d >= r.len - 0.5) || (v.dir < 0 && v.d <= 0.5)) { if (!nextRoad(v)) { spawn(v, playerX, playerZ, 140, 380); snap = true; } }
      else if ((v.stuck > 18 && far > 60) || far > 440) { if (spawn(v, playerX, playerZ, 140, 380)) snap = true; }
      if (!snap) {
        const q = roadAt(v.road, v.d, v.seg); v.seg = q.i;
        const over = v.road.ramp && v.road.ramp.kind === 'in' && v.dir > 0 ? Math.max(0, v.d - v.road.len) : 0;
        const fx = q.tx * v.dir, fz = q.tz * v.dir, tx = q.x + q.tx * over - fz * v.off, tz = q.z + q.tz * over + fx * v.off;
        if (Math.abs(tx - v.x) + Math.abs(tz - v.z) > 40) { v.x = tx; v.z = tz; v.hx = fx; v.hz = fz; }
        else {
          const k = 1 - Math.exp(-dt * 5), kh = 1 - Math.exp(-dt * 3.2);
          v.x += (tx - v.x) * k; v.z += (tz - v.z) * k;
          v.hx += (fx - v.hx) * kh; v.hz += (fz - v.hz) * kh;
          const l = Math.hypot(v.hx, v.hz) || 1; v.hx /= l; v.hz /= l;
        }
      }
      const yaw = Math.atan2(v.hx, v.hz);
      const vy = v.road.ramp ? C.rampY(v.road, v.d) : 0, vp = v.road.ramp ? -Math.atan(C.rampGrade(v.road, v.d, v.dir)) : 0;
      v.y = vy;
      placeVehicle(v.vt, v.slot, v.gi, v.x, v.z, yaw, true, vy, vp);
      _m4.makeRotationY(yaw).setPosition(v.x, vy + 0.02, v.z); vPool.setMatrixAt(v.pi, _m4);
    }
    for (const t of TYPES) { VT[t].paint.instanceMatrix.needsUpdate = true; VT[t].trim.instanceMatrix.needsUpdate = true; VT[t].lamp.instanceMatrix.needsUpdate = true; }
    vShadow.instanceMatrix.needsUpdate = true; vPool.instanceMatrix.needsUpdate = true;
  };
  // nearest moving vehicle whose body is within r of (x,z)
  A.vehicleNear = (x, z, r) => {
    for (let i = 0; i < traffic.length; i++) {
      const v = traffic[i], dx = x - v.x, dz = z - v.z;
      const lz = dx * v.hx + dz * v.hz, lx = dx * v.hz - dz * v.hx;
      if (Math.abs(lz) < v.len / 2 + r * 0.5 && Math.abs(lx) < v.wid / 2 + r * 0.5) return { index: i, x: v.x, z: v.z, kind: v.type, speed: v.v, hx: v.hx, hz: v.hz };
    }
    return null;
  };
  A.groundY = (x, z) => {
    const t = C.trenchFloor ? C.trenchFloor(x, z) : null; if (t !== null) return t;
    const fb = C.ferryBridgeY ? C.ferryBridgeY(x, z) : null; if (fb !== null) return fb;
    const h = C.groundHook ? C.groundHook(x, z) : null; return h === null ? groundBase(x, z) : h;
  };
  const groundBase = (x, z) => (C.bar && x > C.bar.x0 && x < C.bar.x1 && z > C.bar.z0 && z < C.bar.z1 ? C.bar.y : (C.coffeeshop && x > C.coffeeshop.x0 && x < C.coffeeshop.x1 && z > C.coffeeshop.z0 && z < C.coffeeshop.z1 ? C.coffeeshop.y : (C.flower && x > C.flower.x0 && x < C.flower.x1 && z > C.flower.z0 && z < C.flower.z1 ? C.flower.y : (C.umbrella && x > C.umbrella.x0 && x < C.umbrella.x1 && z > C.umbrella.z0 && z < C.umbrella.z1 ? C.umbrella.y : (C.postcard && x > C.postcard.x0 && x < C.postcard.x1 && z > C.postcard.z0 && z < C.postcard.z1 ? C.postcard.y : (C.records && x > C.records.x0 && x < C.records.x1 && z > C.records.z0 && z < C.records.z1 ? C.records.y : (C.bakery && x > C.bakery.x0 && x < C.bakery.x1 && z > C.bakery.z0 && z < C.bakery.z1 ? C.bakery.y : (C.bookshop && x > C.bookshop.x0 && x < C.bookshop.x1 && z > C.bookshop.z0 && z < C.bookshop.z1 ? C.bookshop.y : (C.mall && x > C.mall.x0 && x < C.mall.x1 && z > C.mall.z0 && z < C.mall.z1 ? C.mall.y : (C.cafe && x > C.cafe.x0 && x < C.cafe.x1 && z > C.cafe.z0 && z < C.cafe.z1 ? C.cafe.y : (C.platform && x > C.platform.x0 && x < C.platform.x1 && z > C.platform.z0 && z < C.platform.z1 ? C.platform.y : (C.ferryPier && x > C.ferryPier.x0 && x < C.ferryPier.x1 && z > C.ferryPier.z0 && z < C.ferryPier.z1 ? C.ferryPier.y : (C.maskAt && C.maskAt(x, z) ? 0.04 : 0.17)))))))))))));
  A.textTexture = textTexture;
  A.updateTraffic(0, C.start[0], C.start[1]);
  for (const p of peds) { const q = roadAt(p.run, p.d); p.x = q.x; p.z = q.z; }
  regroup(C.start[0], C.start[1], 1e9, 0);
  updatePeds(0, null);
})();
