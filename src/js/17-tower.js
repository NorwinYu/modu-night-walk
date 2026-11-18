/* 17-tower — the Modu Tower ground lobby, enterable from the Linjiangzui
   plaza: a tall stone hall, security desk, elevator bank and a winter garden. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, scene = G.scene, C = G.CITY;
  const U = G.util;
  const { pick, M4, boxGeo, mergeGeoms, makeCanvas, canvasTexture } = U;
  const X0 = 150, X1 = 186, Z0 = 191, Z1 = 227, Y = 0.17;
  const ESC = { za: 206.4, zb: 220.9, yb: 8.5 };
  const room = new THREE.Group(); room.name = 'modu-tower-lobby';
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x8a8276, roughness: 0.55, metalness: 0.05 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.45, metalness: 0.3 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x9fc4d2, roughness: 0.06, metalness: 0.4, transparent: true, opacity: 0.14 });
  const warmM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.8, 1.0) });
  const leafM = new THREE.MeshStandardMaterial({ color: 0x3a6a3e, roughness: 0.8 });
  const whiteM = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 1.9) });

  // polished granite floor (1.2 m tiles) and honed travertine wall panels (1.2 x 0.6 m, staggered)
  const floorTex = (() => {
    const c = makeCanvas(512, 512), x = c.getContext('2d'), T = 128;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const v = 58 + ((i * 7 + j * 3) % 5) * 4;
      x.fillStyle = `rgb(${v},${v + 1},${v + 3})`; x.fillRect(i * T, j * T, T, T);
      for (let k = 0; k < 90; k++) { const g = v + (Math.random() * 40 - 14); x.fillStyle = `rgba(${g},${g},${g + 4},0.5)`; x.fillRect(i * T + Math.random() * T, j * T + Math.random() * T, 1 + Math.random() * 3, 1 + Math.random() * 2); }
    }
    x.strokeStyle = 'rgba(20,20,22,0.9)'; x.lineWidth = 2;
    for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * T, 0); x.lineTo(i * T, 512); x.stroke(); x.beginPath(); x.moveTo(0, i * T); x.lineTo(512, i * T); x.stroke(); }
    return canvasTexture(c, true, 1, 1, 8);
  })();
  const wallTex = (() => {
    const c = makeCanvas(512, 512), x = c.getContext('2d'), PW = 256, PH2 = 128;
    for (let j = 0; j < 4; j++) for (let i = -1; i < 2; i++) {
      const ox = i * PW + (j % 2) * PW / 2, v = 196 + ((i + j * 3 + 9) % 4) * 6;
      x.fillStyle = `rgb(${v - 8},${v - 13},${v - 22})`; x.fillRect(ox, j * PH2, PW, PH2);
      for (let k = 0; k < 6; k++) { x.strokeStyle = `rgba(150,128,100,${0.12 + Math.random() * 0.12})`; x.lineWidth = 1 + Math.random() * 2; const yy = j * PH2 + Math.random() * PH2; x.beginPath(); x.moveTo(ox, yy); x.lineTo(ox + PW, yy + Math.random() * 10 - 5); x.stroke(); }
      x.strokeStyle = 'rgba(90,76,60,0.85)'; x.lineWidth = 2; x.strokeRect(ox + 1, j * PH2 + 1, PW - 2, PH2 - 2);
    }
    return canvasTexture(c, true, 1, 1, 8);
  })();
  const floorM = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.18, metalness: 0.1 });
  const wallStoneM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.6, metalness: 0.0 });
  const ceilM = new THREE.MeshStandardMaterial({ color: 0xcfcbc2, roughness: 0.85 });
  const floor = new THREE.Mesh(boxGeo(X1 - X0, 0.2, Z1 - Z0, 4.8, 4.8), floorM); floor.position.set(168, Y - 0.1, 209); room.add(floor);
  const ceil = new THREE.Mesh(boxGeo(X1 - X0, 0.2, Z1 - Z0, 4, 4), ceilM); ceil.position.set(168, Y + 14, 209); room.add(ceil);
  {
    // linear light slots across the ceiling
    const slots = [];
    for (let z = Z0 + 3; z < Z1 - 1; z += 4) slots.push({ geometry: boxGeo(X1 - X0 - 4, 0.04, 0.22, 4, 1), matrix: M4(168, Y + 13.88, z) });
    room.add(new THREE.Mesh(mergeGeoms(slots), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.45, 1.35) })));
  }
  for (const [sx, sz] of [[150, 191], [186, 191], [150, 227], [186, 227]]) {
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.8, 14, 32), stoneM); col.position.set(sx, Y + 7, sz); room.add(col);
  }
  // glass curtain walls on 3 sides
  for (const [cx, cz, ry] of [[168, 227, 0], [150, 209, Math.PI / 2], [186, 209, -Math.PI / 2]]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(36, 13), glassM); wall.position.set(cx, Y + 6.5, cz); wall.rotation.y = ry; room.add(wall);
    const frame = new THREE.Mesh(boxGeo(36, 0.18, 0.18, 3, 1), darkM); frame.position.set(cx, Y + 13, cz); frame.rotation.y = ry; room.add(frame);
  }
  // entrance: a stone portal through the tower's base, a lit passage under the podium, then the lobby doors
  const TE = C.towerEntry || { x0: 165, x1: 171, skinZ: Z0 - 4, podiumZ: Z0 - 2, lobbyZ: Z0, h: 5.4, holeX0: 164, holeX1: 172 };
  const PZ = TE.skinZ, PH = 4.9;
  {
    const parts = [], lights = [];
    const B = (w, h, d, x, y, z) => parts.push({ geometry: boxGeo(w, h, d, 2, 2), matrix: M4(x, y, z) });
    const jw0 = TE.x0 - Math.min(TE.holeX0, TE.x0 - 0.6) + 0.5, jw1 = Math.max(TE.holeX1, TE.x1 + 0.6) - TE.x1 + 0.5;
    B(jw0, TE.h + 0.6, TE.podiumZ - PZ + 1.4, TE.x0 - jw0 / 2, Y + (TE.h + 0.6) / 2, (PZ + TE.podiumZ) / 2 - 0.2);
    B(jw1, TE.h + 0.6, TE.podiumZ - PZ + 1.4, TE.x1 + jw1 / 2, Y + (TE.h + 0.6) / 2, (PZ + TE.podiumZ) / 2 - 0.2);
    B(TE.x1 - TE.x0 + jw0 + jw1, TE.h + 0.9 - PH, 2.2, (TE.x0 + TE.x1) / 2 + (jw1 - jw0) / 2, Y + (PH + TE.h + 0.9) / 2, PZ + 0.3);
    // passage: floor, ceiling, stone lining above the shopfronts, lobby wall around the doors
    B(TE.x1 - TE.x0, 0.12, Z0 - PZ + 1.2, 168, Y - 0.05, (PZ + Z0) / 2 - 0.6);
    B(TE.x1 - TE.x0 + 0.4, 0.3, Z0 - PZ + 1.0, 168, Y + PH + 0.15, (PZ + Z0) / 2 - 0.5);
    for (let z = PZ + 1.5; z < Z0 - 0.5; z += 3.2) for (const dx of [-1.6, 1.6]) lights.push({ geometry: boxGeo(0.9, 0.04, 0.5, 1, 1), matrix: M4(168 + dx, Y + PH - 0.02, z) });
    room.add(new THREE.Mesh(mergeGeoms(parts), stoneM));
    // the lobby's south wall, with the door opening left in it
    const sw = [];
    const SW = (x0, x1, y0, y1) => sw.push({ geometry: boxGeo(x1 - x0, y1 - y0, 0.4, 4.8, 4.8), matrix: M4((x0 + x1) / 2, Y + (y0 + y1) / 2, Z0 + 0.2) });
    SW(X0, 165.15, 0, 14); SW(170.85, X1, 0, 14); SW(165.15, 170.85, 3.85, 14);
    room.add(new THREE.Mesh(mergeGeoms(sw), wallStoneM));
    room.add(new THREE.Mesh(mergeGeoms(lights), whiteM));
    // door jambs, a slim head and the glass leaves slid back
    for (const sx of [-1, 1]) {
      const jamb = new THREE.Mesh(boxGeo(0.25, 3.6, 0.5, 1, 2), darkM); jamb.position.set(168 + sx * 2.85, Y + 1.8, Z0 - 0.05); room.add(jamb);
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.3), glassM); leaf.position.set(168 + sx * 2.0, Y + 1.65, Z0 - 0.36); leaf.rotation.y = Math.PI; room.add(leaf);
    }
    const head = new THREE.Mesh(boxGeo(6, 0.3, 0.5, 2, 1), darkM); head.position.set(168, Y + 3.7, Z0 - 0.05); room.add(head);
  }
  // projecting entrance canopy + downlights + posts + sign, out in front of the portal
  {
    const can = new THREE.Mesh(boxGeo(10, 0.28, 5.6, 4, 3), darkM); can.position.set(168, Y + 6.35, PZ - 2.6); room.add(can);
    const edge = new THREE.Mesh(boxGeo(10.2, 0.12, 0.14, 3, 1), new THREE.MeshStandardMaterial({ color: 0x8a8276, metalness: 0.4, roughness: 0.4 })); edge.position.set(168, Y + 6.18, PZ - 5.34); room.add(edge);
    for (let i = 0; i < 5; i++) { const dl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 16), whiteM); dl.position.set(165 + i * 1.5, Y + 6.16, PZ - 3.4); room.add(dl); }
    for (const sx of [163.4, 172.6]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 6.2, 32), darkM); post.position.set(sx, Y + 3.1, PZ - 5.0); room.add(post); }
    // planters flanking the doors
    for (const sx of [161.6, 174.4]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 0.9, 32), stoneM); pot.position.set(sx, Y + 0.45, PZ - 2.0); room.add(pot);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.8, 32, 16), new THREE.MeshStandardMaterial({ color: 0x22402a, roughness: 0.9 })); bush.position.set(sx, Y + 1.4, PZ - 2.0); bush.scale.set(1, 0.85, 1); room.add(bush);
    }
    // nameplate above the canopy
    const nc = makeCanvas(512, 128), nx2 = nc.getContext('2d');
    nx2.fillStyle = '#10161c'; nx2.fillRect(0, 0, 512, 128); nx2.strokeStyle = '#c9b183'; nx2.lineWidth = 4; nx2.strokeRect(4, 4, 504, 120);
    nx2.fillStyle = '#f2e6c8'; nx2.textAlign = 'center'; nx2.font = '700 44px "PingFang SC",sans-serif'; nx2.fillText('魔都中心', 256, 56);
    nx2.fillStyle = '#c9b183'; nx2.font = '500 17px monospace'; nx2.fillText('MODU TOWER · LINJIANGZUI', 256, 96);
    const ntex = canvasTexture(nc, true, 1, 1, 4);
    const name = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 1.3), new THREE.MeshStandardMaterial({ map: ntex, emissiveMap: ntex, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }));
    name.position.set(168, Y + 7.35, PZ - 5.36); name.rotation.y = Math.PI; room.add(name);
  }
  // security turnstiles + brand wall + floor inlay
  {
    const gates = [];
    for (let i = 0; i < 4; i++) {
      gates.push({ geometry: boxGeo(0.18, 1.3, 1.6, 1, 1), matrix: M4(160 + i * 3.2, Y + 0.65, 202) });
      gates.push({ geometry: boxGeo(1.5, 0.06, 0.06, 1, 1), matrix: M4(160 + i * 3.2, Y + 1.32, 202) });
    }
    const gm = new THREE.Mesh(mergeGeoms(gates), darkM); gm.userData.passable = true; gm.userData.surfaceProcedural = true; scene.add(gm);
  }
  {
    const logoC = makeCanvas(512, 160), lc = logoC.getContext('2d');
    lc.fillStyle = '#12161a'; lc.fillRect(0, 0, 512, 160);
    lc.fillStyle = '#e8e2d4'; lc.textAlign = 'center'; lc.font = '700 46px "PingFang SC",sans-serif'; lc.fillText('魔都中心', 256, 62);
    lc.font = '500 19px monospace'; lc.fillStyle = '#a9b8bd'; lc.fillText('MODU TOWER · 632 M', 256, 108);
    const lt = canvasTexture(logoC, true, 1, 1, 4);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.8), new THREE.MeshStandardMaterial({ map: lt, emissiveMap: lt, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 }));
    wall.position.set(168, Y + 4.3, Z0 - 0.35); wall.scale.set(0.6, 0.38, 1); wall.rotation.y = Math.PI; room.add(wall);
  }
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.06, 32, 64), stoneM); ring.rotation.x = Math.PI / 2; ring.position.set(168, Y + 0.02, 212); room.add(ring);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.05, 32, 48), darkM); inner.rotation.x = Math.PI / 2; inner.position.set(168, Y + 0.03, 212); room.add(inner);
  }
  // security desk + elevator bank
  const desk = new THREE.Mesh(boxGeo(8, 1.1, 1.4, 3, 2), darkM); desk.position.set(168, Y + 0.55, 205); room.add(desk);
  const deskTop = new THREE.Mesh(boxGeo(8.4, 0.08, 1.6, 3, 1), stoneM); deskTop.position.set(168, Y + 1.13, 205); room.add(deskTop);
  for (let i = 0; i < 6; i++) {
    const dir = new THREE.Mesh(boxGeo(1.6, 3.2, 0.12, 2, 2), darkM); dir.position.set(154 + i * 5.6, Y + 1.6, 225.8); room.add(dir);
    const glow = new THREE.Mesh(boxGeo(1.2, 0.16, 0.02, 1, 1), whiteM); glow.position.set(154 + i * 5.6, Y + 3.25, 225.7); room.add(glow);
  }
  // winter garden / planter + bench
  for (let i = 0; i < 4; i++) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.9, 0.8, 32), stoneM); pot.position.set(156 + i * 8, Y + 0.4, 220); room.add(pot);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 14), leafM); leaf.position.set(156 + i * 8, Y + 2.2, 220); leaf.scale.set(1, 1.3, 1); room.add(leaf);
  }
  for (const bx of [158, 178]) { const b = new THREE.Mesh(boxGeo(3.4, 0.14, 0.7, 2, 2), stoneM); b.position.set(bx, Y + 0.55, 212); room.add(b); }
  // people
  const person = (px, pz, col, pose = 'stand', ry = 0, o = {}) => {
    const g = G.people.crowd([{ look: Object.assign({ topColor: col }, o), pose, x: 0, y: 0, z: 0, ry }], 'indoor-person');
    g.position.set(px, Y, pz); return g;
  };
  room.add(person(166, 204, 0x2a3038));
  room.add(person(170, 206, 0x4a3a30));
  room.add(person(162, 214, 0x2f3a44));
  room.add(person(176, 216, 0x3a2f2f));
  // elevator indicators + floor directory
  {
    for (let i = 0; i < 6; i++) {
      const ind = new THREE.Mesh(boxGeo(0.5, 0.1, 0.03, 1, 1), whiteM); ind.position.set(154 + i * 5.6, Y + 3.7, 225.7); room.add(ind);
      const num = new THREE.Mesh(boxGeo(0.24, 0.24, 0.03, 1, 1), whiteM); num.position.set(154 + i * 5.6, Y + 3.45, 225.7); room.add(num);
    }
    const dirC = makeCanvas(256, 384), dc = dirC.getContext('2d');
    dc.fillStyle = '#11161a'; dc.fillRect(0, 0, 256, 384); dc.strokeStyle = '#8a9aa0'; dc.lineWidth = 3; dc.strokeRect(6, 6, 244, 372);
    dc.fillStyle = '#e8e2d4'; dc.textAlign = 'center'; dc.font = '700 30px "PingFang SC",sans-serif'; dc.fillText('楼层', 128, 48);
    dc.font = '500 18px monospace'; dc.fillStyle = '#b9c4c8';
    ['L2 · 商业', 'L1 · 大堂', 'B1 · 地铁', 'B2 · 车库', 'B3 · 设备'].forEach((t, i) => dc.fillText(t, 128, 108 + i * 44));
    const dt = canvasTexture(dirC, true, 1, 1, 4);
    const dir = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.95), new THREE.MeshStandardMaterial({ map: dt, emissiveMap: dt, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.6 }));
    dir.position.set(151.4, Y + 3.2, 216); dir.rotation.y = Math.PI / 2; room.add(dir);
  }
  // coffee kiosk + mezzanine shop + concierge guards
  {
    const kiosk = new THREE.Mesh(boxGeo(3.2, 1.0, 1.2, 3, 2), darkM); kiosk.position.set(177, Y + 0.5, 214); room.add(kiosk);
    const kTop = new THREE.Mesh(boxGeo(3.4, 0.08, 1.4, 3, 1), stoneM); kTop.position.set(177, Y + 1.04, 214); room.add(kTop);
    const kGlow = new THREE.Mesh(boxGeo(2.6, 0.12, 0.04, 2, 1), warmM); kGlow.position.set(177, Y + 1.6, 213.3); room.add(kGlow);
    const shop = new THREE.Mesh(boxGeo(6, 3.2, 0.3, 3, 3), darkM); shop.position.set(180, Y + 7, 192.6); room.add(shop);
    const shopGlass = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 2.6), glassM); shopGlass.position.set(180, Y + 7, 192.9); room.add(shopGlass);
    const shelf = new THREE.Mesh(boxGeo(5.2, 0.1, 0.5, 3, 1), stoneM); shelf.position.set(180, Y + 6.2, 192.9); room.add(shelf);
    const guard1 = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, 0.9, 32), new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.7 })); guard1.position.set(165, Y + 0.55, 203.4); room.add(guard1);
    const guard2 = guard1.clone(); guard2.position.set(171, Y + 0.55, 203.6); room.add(guard2);
    const cap1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), new THREE.MeshStandardMaterial({ color: 0xc09474, roughness: 0.7 })); cap1.position.set(165, Y + 1.1, 203.4); room.add(cap1);
    const cap2 = cap1.clone(); cap2.position.set(171, Y + 1.1, 203.6); room.add(cap2);
  }
  // mezzanine escalator + reception + newsstand
  {
    // escalator from the lobby floor up to the L2 gallery (30 degrees, walkable)
    {
      const EX = 180, ZA = ESC.za, ZB = ESC.zb, YB = ESC.yb, run = ZB - ZA, rise = YB - Y, L = Math.hypot(run, rise), a = Math.atan2(rise, run);
      const steelM = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.28, metalness: 0.85 });
      const stepM = new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.45, metalness: 0.7 });
      const n = Math.round(rise / 0.2), sr = rise / n, st = run / n, steps = [];
      for (let i = 0; i < n; i++) {
        steps.push({ geometry: boxGeo(1.0, sr + 0.25, st, 1, 1), matrix: M4(EX, Y + (i + 1) * sr - (sr + 0.25) / 2, ZA + (i + 0.5) * st) });
        steps.push({ geometry: boxGeo(1.0, 0.012, 0.03, 1, 1), matrix: M4(EX, Y + (i + 1) * sr + 0.006, ZA + i * st + 0.03) });
      }
      room.add(new THREE.Mesh(mergeGeoms(steps), stepM));
      const g = new THREE.Group(); g.position.set(EX, (Y + YB) / 2, (ZA + ZB) / 2); g.rotation.x = -a;
      const truss = new THREE.Mesh(boxGeo(1.7, 0.95, L + 0.6, 1, 1), steelM); truss.position.y = -0.62; g.add(truss);
      for (const sx of [-1, 1]) {
        const skirt = new THREE.Mesh(boxGeo(0.08, 0.32, L + 0.6, 1, 1), steelM); skirt.position.set(sx * 0.6, 0.02, 0); g.add(skirt);
        const gl = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.2, 0.86), glassM); gl.rotation.y = Math.PI / 2; gl.position.set(sx * 0.62, 0.62, 0); g.add(gl);
        const hr = new THREE.Mesh(boxGeo(0.09, 0.07, L + 0.9, 1, 1), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.5 })); hr.position.set(sx * 0.62, 1.06, 0); g.add(hr);
        const strip = new THREE.Mesh(boxGeo(0.02, 0.02, L, 1, 1), whiteM); strip.position.set(sx * 0.57, 0.19, 0); g.add(strip);
      }
      room.add(g);
      for (const [z, y] of [[ZA - 0.9, Y], [ZB + 0.2, YB]]) {
        const plate = new THREE.Mesh(boxGeo(1.7, 0.04, 1.6, 1, 1), steelM); plate.position.set(EX, y + 0.01, z); room.add(plate);
        for (const sx of [-1, 1]) { const nb = new THREE.Mesh(boxGeo(0.12, 1.0, 1.0, 1, 1), steelM); nb.position.set(EX + sx * 0.62, y + 0.5, z + (y === Y ? 0.2 : -0.1)); room.add(nb); }
      }
    }
    const mezz = new THREE.Mesh(boxGeo(14, 0.3, 8, 3, 3), stoneM); mezz.position.set(180, Y + 5.4, 194); room.add(mezz);
    const back = new THREE.Mesh(boxGeo(9, 3.0, 0.2, 3, 3), stoneM); back.position.set(172, Y + 1.7, 194.5); room.add(back);
    const desk = new THREE.Mesh(boxGeo(9.2, 1.0, 0.8, 3, 2), darkM); desk.position.set(172, Y + 0.5, 195.5); room.add(desk);
    const dt = new THREE.Mesh(boxGeo(9.4, 0.08, 0.9, 3, 1), stoneM); dt.position.set(172, Y + 1.04, 195.5); room.add(dt);
    const ns = new THREE.Mesh(boxGeo(2.6, 2.0, 1.6, 3, 3), darkM); ns.position.set(160, Y + 1.0, 197); room.add(ns);
    const nsTop = new THREE.Mesh(boxGeo(2.8, 0.08, 1.8, 3, 1), stoneM); nsTop.position.set(160, Y + 2.04, 197); room.add(nsTop);
    const nGlow = new THREE.Mesh(boxGeo(2.2, 0.1, 0.03, 1, 1), warmM); nGlow.position.set(160, Y + 1.8, 196.2); room.add(nGlow);
  }
  // lounge seating + art wall
  {
    for (const [sx, sz] of [[158, 196], [178, 196], [164, 216]]) {
      const base = new THREE.Mesh(boxGeo(3.2, 0.5, 1.2, 3, 2), darkM); base.position.set(sx, Y + 0.35, sz); room.add(base);
      const back = new THREE.Mesh(boxGeo(3.2, 0.7, 0.2, 3, 2), darkM); back.position.set(sx, Y + 0.75, sz - 0.5); room.add(back);
      const top = new THREE.Mesh(boxGeo(3.0, 0.18, 1.0, 3, 2), stoneM); top.position.set(sx, Y + 0.62, sz); room.add(top);
    }
    // suspended art: a bronze ring on the north wall
    const art = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.12, 32, 64), new THREE.MeshStandardMaterial({ color: 0xc8a45a, roughness: 0.35, metalness: 0.8 }));
    art.position.set(152.2, Y + 6.5, 205); art.rotation.y = Math.PI / 2; room.add(art);
    const artPlate = new THREE.Mesh(boxGeo(0.1, 4.6, 5.0, 1, 1), darkM); artPlate.position.set(151.8, Y + 6.5, 205); room.add(artPlate);
    // bench + low table near the winter garden
    const tbl = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.1, 32), stoneM); tbl.position.set(168, Y + 0.6, 218); room.add(tbl);
    const tleg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.6, 32), darkM); tleg.position.set(168, Y + 0.3, 218); room.add(tleg);
  }
  // vending machines, info kiosk and lobby plants
  {
    for (const [vx, vz, col] of [[158, 198, 0xd84a3a], [178, 198, 0x3a6ad8]]) {
      const v = new THREE.Mesh(boxGeo(1.0, 2.0, 0.8, 2, 3), darkM); v.position.set(vx, Y + 1.0, vz); room.add(v);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), new THREE.MeshBasicMaterial({ color: new THREE.Color(col) })); face.position.set(vx, Y + 1.05, vz - 0.42); face.rotation.y = Math.PI; room.add(face);
      const glow = new THREE.Mesh(boxGeo(0.9, 0.06, 0.04, 1, 1), warmM); glow.position.set(vx, Y + 1.95, vz - 0.43); room.add(glow);
    }
    const kiosk = new THREE.Mesh(boxGeo(1.4, 2.2, 0.5, 2, 3), darkM); kiosk.position.set(166, Y + 1.1, 218); room.add(kiosk);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.8, 2.0) })); screen.position.set(166, Y + 1.35, 217.73); room.add(screen);
    for (const [px, pz] of [[154, 200], [182, 200], [154, 216], [182, 216]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 0.8, 32), stoneM); pot.position.set(px, Y + 0.4, pz); room.add(pot);
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.85, 20, 12), leafM); leaf.position.set(px, Y + 1.3, pz); leaf.scale.set(1, 1.2, 1); room.add(leaf);
    }
  }
  // ceiling lights + one point light with fixture
  for (const [lx, lz] of [[158, 200], [178, 200], [158, 218], [178, 218]]) {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.08, 32), whiteM); disc.position.set(lx, Y + 13.4, lz); room.add(disc);
  }
  const pl = new THREE.PointLight(0xfff0dc, 34, 30, 2); pl.position.set(168, Y + 11, 209); room.add(pl);
  const fixture = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), warmM); fixture.position.copy(pl.position); room.add(fixture);
  // sign
  const sc = makeCanvas(512, 128), sx = sc.getContext('2d');
  sx.fillStyle = '#101418'; sx.fillRect(0, 0, 512, 128); sx.fillStyle = '#e8e2d4'; sx.textAlign = 'center'; sx.font = '700 42px "PingFang SC",sans-serif'; sx.fillText('魔都中心 · 大堂', 256, 56); sx.font = '500 18px monospace'; sx.fillStyle = '#b9c4c8'; sx.fillText('MODU TOWER · LOBBY', 256, 96);
  const st = canvasTexture(sc, true, 1, 1, 4);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }));
  sign.position.set(168, Y + 5.4, Z1 - 0.3); sign.rotation.y = Math.PI; room.add(sign);
  room.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
  scene.add(room);
  C.lobby = { x0: X0, x1: X1, z0: Z0, z1: Z1, y: Y, door: [168, PZ - 1.4], inner: [168, Z0 + 1.2], inside: [168, Z0 + 6] };

  // L2 observation balcony over the lobby's south side
  {
    const bz = 223.3, by = 8.5, l2 = new THREE.Group(); l2.name = 'lobby-l2-gallery';
    const slab = new THREE.Mesh(boxGeo(34, 0.3, 5.6, 4, 3), stoneM); slab.position.set(168, by - 0.15, bz); l2.add(slab);
    const posts = [];
    for (const [ra, rb] of [[151.5, 179.0], [181.0, 184.5]]) {
      const railGlass = new THREE.Mesh(new THREE.PlaneGeometry(rb - ra, 1.05), glassM); railGlass.position.set((ra + rb) / 2, by + 0.55, bz - 2.85); l2.add(railGlass);
      const railTop = new THREE.Mesh(boxGeo(rb - ra, 0.06, 0.08, 3, 1), darkM); railTop.position.set((ra + rb) / 2, by + 1.08, bz - 2.85); l2.add(railTop);
    }
    for (let i = 0; i < 15; i++) { const px3 = 151.6 + i * 2.34; if (px3 < 178.9 || px3 > 181.1) posts.push({ geometry: boxGeo(0.05, 1.05, 0.05, 1, 1), matrix: M4(px3, by + 0.55, bz - 2.85) }); }
    l2.add(new THREE.Mesh(mergeGeoms(posts), darkM));
    // three exhibit panels + a bench + planters + downlights
    const ex = [['澜滩天际线', 'LANTAN SKYLINE'], ['申江上的桥', 'BRIDGES OVER THE SHENJIANG'], ['临江嘴三件套', 'THE LINJIANGZUI THREE']];
    ex.forEach(([nm, en], i) => {
      const pc = makeCanvas(384, 480), px = pc.getContext('2d');
      px.fillStyle = '#14161a'; px.fillRect(0, 0, 384, 480);
      const gr = px.createLinearGradient(0, 30, 0, 320); gr.addColorStop(0, ['#3a5a7a', '#2a4a5a', '#5a4a3a'][i]); gr.addColorStop(1, '#12141a');
      px.fillStyle = gr; px.fillRect(24, 24, 336, 300);
      px.fillStyle = '#0e1014'; px.fillRect(24, 230, 336, 94);
      for (let k = 0; k < 12; k++) { px.fillStyle = 'rgba(255,210,140,' + (0.2 + (k % 4) * 0.15) + ')'; px.fillRect(36 + k * 26, 250 - (k % 5) * 18, 14, 10 + (k % 3) * 8); }
      px.fillStyle = '#f2e6c8'; px.textAlign = 'center'; px.font = '700 30px "PingFang SC",sans-serif'; px.fillText(nm, 192, 380);
      px.fillStyle = '#b8a888'; px.font = '500 14px monospace'; px.fillText(en, 192, 410);
      px.fillStyle = '#6a6a66'; px.font = '400 12px monospace'; px.fillText('L2 · OBSERVATION GALLERY', 192, 446);
      const pt = canvasTexture(pc, true, 1, 1, 4);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 2.6), new THREE.MeshStandardMaterial({ map: pt, emissiveMap: pt, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.7 }));
      panel.position.set(158 + i * 10, by + 1.5, 226.75); panel.rotation.y = Math.PI; l2.add(panel);
      const frame = new THREE.Mesh(boxGeo(2.24, 2.74, 0.06, 2, 2), darkM); frame.position.set(158 + i * 10, by + 1.5, 226.78); l2.add(frame);
    });
    const bench = new THREE.Mesh(boxGeo(3.2, 0.1, 0.5, 3, 1), darkM); bench.position.set(170, by + 0.45, 225.0); l2.add(bench);
    for (const bx of [168.5, 171.5]) { const bl = new THREE.Mesh(boxGeo(0.08, 0.45, 0.4, 1, 1), darkM); bl.position.set(bx, by + 0.22, 225.0); l2.add(bl); }
    for (const [px2, pz2] of [[152.5, 225.6], [183.5, 225.6]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.3, 0.6, 32), stoneM); pot.position.set(px2, by + 0.3, pz2); l2.add(pot);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), new THREE.MeshStandardMaterial({ color: 0x22402a, roughness: 0.9 })); bush.position.set(px2, by + 0.9, pz2); bush.scale.set(1, 0.9, 1); l2.add(bush);
    }
    for (let i = 0; i < 6; i++) { const dl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 32, 16), whiteM); dl.position.set(154 + i * 5.8, by + 2.6, 223.3); l2.add(dl); }
    l2.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; } });
    scene.add(l2);
    C.l2 = { x0: 151.6, x1: 184.4, z0: 220.9, z1: 225.4, y: by };
    C.decks.push({ id: 'l2', room: 'l2', type: 'rect', x0: 151.9, x1: 184.1, z0: 221.0, z1: 225.0, y: by });
    C.decks.push({ id: 'lobby-escalator', room: 'lobby', type: 'ramp', ax: 180, az: ESC.za - 0.3, bx: 180, bz: ESC.zb + 0.3, hw: 0.45, ya: Y, yb: by });

    // L3 upper gallery, just under the lobby's glass line
    {
      const l3y = 12.0, l3 = new THREE.Group(); l3.name = 'lobby-l3-gallery';
      const slab3 = new THREE.Mesh(boxGeo(34, 0.3, 4.4, 4, 3), stoneM); slab3.position.set(168, l3y - 0.15, 224.2); l3.add(slab3);
      const g3 = new THREE.Mesh(new THREE.PlaneGeometry(33, 1.0), glassM); g3.position.set(168, l3y + 0.55, 226.35); l3.add(g3);
      const top3 = new THREE.Mesh(boxGeo(33.4, 0.06, 0.08, 3, 1), darkM); top3.position.set(168, l3y + 1.06, 226.35); l3.add(top3);
      const posts3 = [];
      for (let i = 0; i < 15; i++) posts3.push({ geometry: boxGeo(0.05, 1.0, 0.05, 1, 1), matrix: M4(151.6 + i * 2.34, l3y + 0.55, 226.35) });
      l3.add(new THREE.Mesh(mergeGeoms(posts3), darkM));
      for (let i = 0; i < 7; i++) { const dl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 32, 16), whiteM); dl.position.set(154 + i * 4.6, l3y + 2.3, 224.2); l3.add(dl); }
      const bench3 = new THREE.Mesh(boxGeo(3.0, 0.1, 0.5, 3, 1), darkM); bench3.position.set(170, l3y + 0.45, 223.0); l3.add(bench3);
      for (const bx of [168.6, 171.4]) { const bl = new THREE.Mesh(boxGeo(0.08, 0.45, 0.4, 1, 1), darkM); bl.position.set(bx, l3y + 0.22, 223.0); l3.add(bl); }
      l3.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; } });
      scene.add(l3);
      C.l3 = { x0: 151.6, x1: 184.4, z0: 222.2, z1: 225.9, y: l3y };
      C.decks.push({ id: 'l3', room: 'l3', type: 'rect', x0: 151.9, x1: 184.1, z0: 222.5, z1: 225.9, y: l3y });
      // two info panels at the L3 rail
      const panels3 = [['魔都之巅', 'MODU PEAK', '632 m · 118 层 · 观光厅在 118 层，电梯 55 秒直达。'], ['城市天际线', 'THE SKYLINE', '从 L3 往西：星珠 468 m、云阙 492 m、金岳 421 m。']];
      panels3.forEach(([nm, en, line], i) => {
        const pc = makeCanvas(384, 480), px = pc.getContext('2d');
        px.fillStyle = '#14161a'; px.fillRect(0, 0, 384, 480);
        px.fillStyle = i === 0 ? '#3a4a5a' : '#2a3a2e'; px.fillRect(24, 24, 336, 250);
        px.fillStyle = '#0e1014'; px.fillRect(24, 200, 336, 74);
        for (let k = 0; k < 10; k++) { px.fillStyle = 'rgba(255,210,140,' + (0.2 + (k % 3) * 0.2) + ')'; px.fillRect(40 + k * 30, 208 - (k % 4) * 12, 12, 12 + (k % 3) * 10); }
        px.fillStyle = '#f2e6c8'; px.textAlign = 'center'; px.font = '700 30px "PingFang SC",sans-serif'; px.fillText(nm, 192, 330);
        px.fillStyle = '#b8a888'; px.font = '500 13px monospace'; px.fillText(en, 192, 356);
        px.fillStyle = '#9a9a92'; px.font = '400 12px "PingFang SC",sans-serif';
        const words = line.split('，'); words.forEach((w, wi) => px.fillText(w, 192, 388 + wi * 20));
        const pt = canvasTexture(pc, true, 1, 1, 4);
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.5), new THREE.MeshStandardMaterial({ map: pt, emissiveMap: pt, emissive: 0xffffff, emissiveIntensity: 0.22, roughness: 0.7 }));
        panel.position.set(160 + i * 16, l3y + 1.45, 226.7); panel.rotation.y = Math.PI; l3.add(panel);
      });
    }
    // spotting scope at the rail
    {
      const sx = 174.5, sz2 = 222.6;
      for (let i = 0; i < 3; i++) {
        const a = i / 3 * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.05, 32), M.darkMetal);
        leg.position.set(sx + Math.cos(a) * 0.26, by + 0.52, sz2 + Math.sin(a) * 0.26); leg.rotation.z = Math.cos(a) * 0.2; leg.rotation.x = -Math.sin(a) * 0.2; l2.add(leg);
      }
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 32), new THREE.MeshStandardMaterial({ color: 0x2a2e34, metalness: 0.6, roughness: 0.35 })); tube.position.set(sx, by + 1.25, sz2); tube.rotation.z = Math.PI / 2; tube.rotation.x = 0.18; l2.add(tube);
      const eyep = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 32), M.darkMetal); eyep.position.set(sx - 0.32, by + 1.27, sz2); eyep.rotation.z = Math.PI / 2; l2.add(eyep);
      l2.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; } });
      C.l2scope = [sx, sz2];
    }
  }
  const add = C.add;
  add({ x0: X0, x1: X1, z0: Z0, z1: Z0 + 0.4, y0: 0, y1: 14, kind: 'lobby-wall' });
  add({ x0: X0, x1: X1, z0: Z1 - 0.4, z1: Z1, y0: 0, y1: 14, kind: 'lobby-wall' });
  add({ x0: X0, x1: X0 + 0.4, z0: Z0, z1: Z1, y0: 0, y1: 14, kind: 'lobby-wall' });
  add({ x0: X1 - 0.4, x1: X1, z0: Z0, z1: Z1, y0: 0, y1: 14, kind: 'lobby-wall' });
  // the lobby sits inside the tower's footprint: open the hall and the passage out of the tower and podium boxes
  C.carve(X0 + 0.4, X1 - 0.4, Z0 + 0.4, Z1 - 0.4, /^modu-(tower|podium)$/);
  C.carve(TE.x0, TE.x1, PZ - 1.0, Z0 + 0.45, /^modu-(tower|podium)$|^lobby-wall$/);
  C.carve(165.15, 170.85, Z0 - 0.5, Z0 + 0.45, /^lobby-wall$/);
  // only where the truss hangs below head height; further up you can walk underneath it
  add({ x0: 179.2, x1: 180.8, z0: ESC.za + 1.1, z1: ESC.za + (1.75 + 1.3) / (ESC.yb - Y) * (ESC.zb - ESC.za), y0: 0, y1: 1.9, kind: 'lobby-escalator' });
  add({ x0: TE.x0 - 0.35, x1: TE.x0, z0: PZ - 0.6, z1: Z0, y0: 0, y1: 6, kind: 'lobby-wall' });
  add({ x0: TE.x1, x1: TE.x1 + 0.35, z0: PZ - 0.6, z1: Z0, y0: 0, y1: 6, kind: 'lobby-wall' });
  add({ x0: TE.x0, x1: 165.15, z0: Z0 - 0.5, z1: Z0 + 0.4, y0: 0, y1: 6, kind: 'lobby-wall' });
  add({ x0: 170.85, x1: TE.x1, z0: Z0 - 0.5, z1: Z0 + 0.4, y0: 0, y1: 6, kind: 'lobby-wall' });
})();
