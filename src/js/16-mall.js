/* 16-mall — the enterable 环港广场 atrium, now a compact 32x20 court:
   skylight, escalator, a ring of lit storefronts, kiosk, sculpture, shoppers. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, scene = G.scene, C = G.CITY;
  const U = G.util;
  const { pick, M4, boxGeo, mergeGeoms, makeCanvas, canvasTexture } = U;
  const X0 = -606, X1 = -574, Z0 = 60, Z1 = 80, Y = 0.17;   // level with the forecourt: the doors open straight in
  const room = new THREE.Group(); room.name = 'huangang-atrium';
  const wallM = new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 0.7 });
  const floorM = new THREE.MeshStandardMaterial({ color: 0x7a7268, roughness: 0.45, metalness: 0.05 });
  const woodM = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.55 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x9fc4d2, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.09 });
  const warmM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 1.8, 0.95) });
  const shopWarm = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.3, 1.5, 0.82) });

  const floor = new THREE.Mesh(boxGeo(X1 - X0, 0.2, Z1 - Z0, 4, 4), floorM); floor.position.set(-590, Y - 0.1, 70); room.add(floor);
  const roof = new THREE.Mesh(boxGeo(X1 - X0, 0.25, Z1 - Z0, 4, 4), wallM); roof.position.set(-590, Y + 9.5, 70); room.add(roof);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), glassM); sky.rotation.x = Math.PI / 2; sky.position.set(-590, Y + 9.35, 70); room.add(sky);
  const skylightFrame = [];
  for (let i = 0; i < 5; i++) skylightFrame.push({ geometry: boxGeo(20, 0.08, 0.1, 2, 1), matrix: M4(-590, Y + 9.33, 64 + i * 3) });
  for (let i = 0; i < 5; i++) skylightFrame.push({ geometry: boxGeo(0.1, 0.08, 12, 1, 1), matrix: M4(-600 + i * 5, Y + 9.33, 70) });
  const skf = new THREE.Mesh(mergeGeoms(skylightFrame), M.darkMetal); room.add(skf);
  // walls: north/west/east, south split around the entrance
  const wN = new THREE.Mesh(boxGeo(X1 - X0, 9.5, 0.3, 4, 4), wallM); wN.position.set(-590, Y + 4.75, Z0); room.add(wN);
  const wW = new THREE.Mesh(boxGeo(0.3, 9.5, Z1 - Z0, 3, 4), wallM); wW.position.set(X0, Y + 4.75, 70); room.add(wW);
  const wE = new THREE.Mesh(boxGeo(0.3, 9.5, Z1 - Z0, 3, 4), wallM); wE.position.set(X1, Y + 4.75, 70); room.add(wE);
  for (const dx of [-10, 10]) { const wS = new THREE.Mesh(boxGeo(10, 9.5, 0.3, 3, 4), wallM); wS.position.set(-590 + dx, Y + 4.75, Z1); room.add(wS); }
  // inner doorway: wall returns, steel jambs and lintel, glass leaves slid open
  for (const sx of [-1, 1]) {
    const ret = new THREE.Mesh(boxGeo(3.2, 9.5, 0.3, 2, 4), wallM); ret.position.set(-590 + sx * 3.4, Y + 4.75, Z1); room.add(ret);
    const jamb = new THREE.Mesh(boxGeo(0.22, 4.4, 0.4, 1, 3), M.darkMetal); jamb.position.set(-590 + sx * 1.9, Y + 2.2, Z1 + 0.05); room.add(jamb);
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 4.0), glassM); leaf.position.set(-590 + sx * 2.75, Y + 2.05, Z1 + 0.32); room.add(leaf);
  }
  const lintel = new THREE.Mesh(boxGeo(4.0, 5.1, 0.32, 2, 2), wallM); lintel.position.set(-590, Y + 4.4 + 2.55, Z1); room.add(lintel);
  const head = new THREE.Mesh(boxGeo(4.0, 0.25, 0.42, 2, 1), M.darkMetal); head.position.set(-590, Y + 4.4, Z1 + 0.05); room.add(head);

  // storefronts: helper creates glass + warm interior + sign
  function shop(x, z, w, name, col, ry = 0) {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(boxGeo(w, 3.8, 0.35, 3, 3), M.darkMetal); g.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.5, 3.3), glassM); glass.position.set(0, 0, 0.22); g.add(glass);
    const inner = new THREE.Mesh(boxGeo(w - 0.6, 3.2, 2.2, 3, 3), shopWarm); inner.position.set(0, -0.1, 1.15); g.add(inner);
    for (let q = 0; q < 3; q++) { const dl = new THREE.Mesh(boxGeo(0.25, 0.04, 0.2, 1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.4) })); dl.position.set(-(w - 1.6) / 2 + q * (w - 1.6) / 2, 1.45, 0.5); g.add(dl); }
    for (let i = 0; i < 3; i++) {
      const shelf = new THREE.Mesh(boxGeo(w - 1.0, 0.12, 0.6, 2, 2), woodM); shelf.position.set(0, -1.0 + i * 0.9, 0.7); g.add(shelf);
      for (let j = 0; j < 4; j++) {
        const prod = new THREE.Mesh(boxGeo(0.24, 0.3, 0.28, 1, 1), new THREE.MeshStandardMaterial({ color: pick([0xd8d0c0, 0xb45a3a, 0x3a6a8a, 0x6a8a4a, 0xd8b45a]), roughness: 0.7 }));
        prod.position.set(-(w - 1.6) / 2 + j * 0.5, -0.82 + i * 0.9, 0.72); g.add(prod);
      }
      const strip = new THREE.Mesh(boxGeo(w - 1.2, 0.06, 0.08, 2, 1), warmM); strip.position.set(0, 0.2 + i * 0.9, 0.55); g.add(strip);
    }
    const c = makeCanvas(512, 128), ctx = c.getContext('2d');
    ctx.fillStyle = '#12100e'; ctx.fillRect(0, 0, 512, 128);
    ctx.fillStyle = '#' + new THREE.Color(col).getHexString(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 46px "PingFang SC",sans-serif'; ctx.fillText(name, 256, 46);
    ctx.font = '500 18px monospace'; ctx.fillStyle = '#e0d6c6'; ctx.fillText('HUANGANG PLAZA · L1', 256, 92);
    const st = canvasTexture(c, true, 1, 1, 4);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, 1.5), new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.5 }));
    sign.position.set(0, 2.6, 0.24); g.add(sign);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.4, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(col) })); glow.position.set(0, 1.9, 0.25); g.add(glow);
    g.position.set(x, Y + 2.0, z); g.rotation.y = ry; room.add(g);
  }
  shop(-600, Z0 + 0.35, 7.0, '环港书局', 0xffb45a);
  shop(-590, Z0 + 0.35, 5.6, '夜航咖啡', 0x6fd8ff);
  shop(-580.5, Z0 + 0.35, 5.0, '明信片铺', 0xff7a9a);
  shop(X0 + 0.45, 66.5, 5.4, '雨具店', 0x8fe3a0, Math.PI / 2);
  shop(X0 + 0.45, 74.5, 5.4, '面包房', 0xffb45a, Math.PI / 2);
  shop(X1 - 0.45, 66.5, 5.4, '唱片行', 0x6fd8ff, -Math.PI / 2);
  shop(X1 - 0.45, 74.5, 5.4, '花店', 0xff7a9a, -Math.PI / 2);

  // mezzanine storefronts along the balcony
  {
    const shops2 = [[-598, '唱片行', 0x6fd8ff], [-586, '花店', 0xff7a9a], [-578, '书店', 0xffb45a]];
    for (const [mx, name, col] of shops2) {
      const frame = new THREE.Mesh(boxGeo(6.4, 2.6, 0.3, 3, 3), M.darkMetal); frame.position.set(mx, Y + 6.4, 64.2); room.add(frame);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 2.2), glassM); glass.position.set(mx, Y + 6.4, 64.4); room.add(glass);
      const glow = new THREE.Mesh(boxGeo(5.4, 1.8, 0.1, 3, 2), shopWarm); glow.position.set(mx, Y + 6.4, 64.9); room.add(glow);
      const c = makeCanvas(256, 64), ctx = c.getContext('2d');
      ctx.fillStyle = '#12100e'; ctx.fillRect(0, 0, 256, 64); ctx.fillStyle = '#' + new THREE.Color(col).getHexString(); ctx.textAlign = 'center'; ctx.font = '700 26px "PingFang SC",sans-serif'; ctx.fillText(name, 128, 40);
      const tx = canvasTexture(c, true, 1, 1, 4);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }));
      sign.position.set(mx, Y + 7.9, 64.35); room.add(sign);
    }
  }
  // escalator + 2nd balcony
  const ramp = new THREE.Mesh(boxGeo(2.6, 0.22, 14, 3, 4), new THREE.MeshStandardMaterial({ color: 0x3a4048, roughness: 0.5, metalness: 0.4 }));
  ramp.position.set(-600.5, Y + 2.8, 70); ramp.rotation.x = -0.42; room.add(ramp);
  const rampRail = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 8; i++) rampRail.push({ geometry: new THREE.CylinderGeometry(0.04, 0.04, 0.9, 32), matrix: M4(-600.5 + sx * 1.35, Y + 3.4 + i * 0.52, 63.5 + i * 1.85) });
  for (const sx of [-1, 1]) rampRail.push({ geometry: boxGeo(0.07, 0.07, 14.4, 2, 2), matrix: M4(-600.5 + sx * 1.35, Y + 3.3, 70, 0, 0, 0) });
  const rrm = new THREE.Mesh(mergeGeoms(rampRail), M.metal); rrm.rotation.x = -0.42; rrm.position.set(0, 0, 0); room.add(rrm);
  const balcony = new THREE.Mesh(boxGeo(24, 0.3, 4.5, 4, 3), new THREE.MeshStandardMaterial({ color: 0x4a423a, roughness: 0.6 })); balcony.position.set(-590, Y + 5.6, Z0 + 3.4); room.add(balcony);
  const balRail = [];
  for (let i = 0; i < 12; i++) balRail.push({ geometry: new THREE.CylinderGeometry(0.035, 0.035, 0.9, 32), matrix: M4(-602 + i * 2.1, Y + 6.2, Z0 + 5.6) });
  balRail.push({ geometry: boxGeo(24, 0.06, 0.06, 3, 1), matrix: M4(-590, Y + 6.7, Z0 + 5.6) });
  const brm = new THREE.Mesh(mergeGeoms(balRail), M.metal); room.add(brm);

  // centre sculpture
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.13, 32, 64), new THREE.MeshStandardMaterial({ color: 0xc8a45a, roughness: 0.3, metalness: 0.85, emissive: 0xffb45a, emissiveIntensity: 0.35 }));
  ring.position.set(-590, Y + 3.4, 71); ring.rotation.y = 0.5; room.add(ring);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.4, 4.6, 32), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.4, metalness: 0.6 })); core.position.set(-590, Y + 2.3, 71); room.add(core);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.35, 32), M.curb); plinth.position.set(-590, Y + 0.18, 71); room.add(plinth);

  // kiosk, benches, plants, shoppers
  const kiosk = new THREE.Mesh(boxGeo(2.4, 1.0, 1.0, 3, 2), woodM); kiosk.position.set(-577, Y + 0.5, 76); room.add(kiosk);
  const kioskTop = new THREE.Mesh(boxGeo(2.6, 0.08, 1.2, 3, 1), M.metal); kioskTop.position.set(-577, Y + 1.04, 76); room.add(kioskTop);
  for (const [bx, bz, ry] of [[-600, 76, 0.3], [-578, 64, -0.3], [-596, 62, 0.2]]) {
    const b = new THREE.Mesh(boxGeo(1.8, 0.12, 0.5, 2, 2), woodM); b.position.set(bx, Y + 0.62, bz); b.rotation.y = ry; room.add(b);
    const bb = new THREE.Mesh(boxGeo(1.8, 0.45, 0.1, 2, 2), woodM); bb.position.set(bx - Math.sin(ry) * 0.22, Y + 0.86, bz - Math.cos(ry) * 0.22); bb.rotation.y = ry; room.add(bb);
  }
  for (const [px, pz] of [[X0 + 1.0, Z1 - 1.0], [X1 - 1.0, Z1 - 1.0], [X0 + 1.0, Z0 + 1.4], [X1 - 1.0, Z0 + 1.4]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.7, 32), M.curb); pot.position.set(px, Y + 0.35, pz); room.add(pot);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 14), new THREE.MeshStandardMaterial({ color: 0x1d3a26, roughness: 0.9 })); leaf.position.set(px, Y + 1.2, pz); leaf.scale.set(1, 1.15, 1); room.add(leaf);
  }
  const person = (px, pz, col, pose = 'stand', ry = 0, o = {}) => {
    const g = G.people.crowd([{ look: Object.assign({ topColor: col }, o), pose, x: 0, y: 0, z: 0, ry }], 'indoor-person');
    g.position.set(px, Y, pz); return g;
  };
  room.add(person(-577, 77.4, 0x3a2a22));
  room.add(person(-599, 66, 0x2f3a44));
  room.add(person(-581, 69, 0x4a3a30));
  room.add(person(-596, 78, 0x3a4030));
  room.add(person(-584, 63, 0x443a44));

  // pendants + one real light
  for (const [lx, lz] of [[-596, 67], [-584, 67], [-596, 74], [-584, 74]]) {
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.28, 32, 1, true), M.darkMetal); shade.position.set(lx, Y + 6.6, lz); room.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), warmM); bulb.position.set(lx, Y + 6.44, lz); room.add(bulb);
  }
  const pl = new THREE.PointLight(0xffc890, 34, 17, 2); pl.position.set(-590, Y + 6.2, 70); room.add(pl);
  const fixture = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), warmM); fixture.position.copy(pl.position); room.add(fixture);

  // entrance sign
  const ec = makeCanvas(512, 128), ex = ec.getContext('2d');
  ex.fillStyle = '#14110e'; ex.fillRect(0, 0, 512, 128); ex.strokeStyle = '#caa66a'; ex.lineWidth = 4; ex.strokeRect(4, 4, 504, 120);
  ex.fillStyle = '#f0e2c6'; ex.textAlign = 'center'; ex.font = '700 44px "PingFang SC",sans-serif'; ex.fillText('环港广场', 256, 56); ex.font = '500 18px monospace'; ex.fillStyle = '#c9b183'; ex.fillText('HUANGANG PLAZA · ATRIUM', 256, 96);
  const et = canvasTexture(ec, true, 1, 1, 4);
  const esign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshStandardMaterial({ map: et, emissiveMap: et, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.5 }));
  esign.position.set(-590, Y + 5.0, Z1 + 0.28); room.add(esign);

  room.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
  scene.add(room);

  C.mall = { x0: X0, x1: X1, z0: Z0, z1: Z1, y: Y, door: [-590, Z1 + 1.4], inside: [-590, Z1 - 4.2] };
  const add = C.add;
  add({ x0: X0, x1: X1, z0: Z0 - 0.15, z1: Z0, y0: 0, y1: 9.5, kind: 'mall-wall' });
  add({ x0: X0, x1: -591.8, z0: Z1 - 0.15, z1: Z1 + 0.2, y0: 0, y1: 9.5, kind: 'mall-wall' });
  add({ x0: -588.2, x1: X1, z0: Z1 - 0.15, z1: Z1 + 0.2, y0: 0, y1: 9.5, kind: 'mall-wall' });
  add({ x0: X0, x1: X0 + 0.3, z0: Z0, z1: Z1, y0: 0, y1: 9.5, kind: 'mall-wall' });
  add({ x0: X1 - 0.3, x1: X1, z0: Z0, z1: Z1, y0: 0, y1: 9.5, kind: 'mall-wall' });

  // enterable 夜航咖啡 inside the north-wall storefront
  {
    const cs = new THREE.Group(); cs.name = 'harbour-coffee';
    const cx0 = -593, cx1 = -587, cz0 = 51.5, cz1 = 60;
    const cFloor = new THREE.Mesh(boxGeo(cx1 - cx0, 0.14, cz1 - cz0, 3, 3), new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.6 })); cFloor.position.set(-590, Y - 0.07, 55.75); cs.add(cFloor);
    const cCeil = new THREE.Mesh(boxGeo(cx1 - cx0, 0.12, cz1 - cz0, 3, 3), wallM); cCeil.position.set(-590, Y + 3.1, 55.75); cs.add(cCeil);
    const cN = new THREE.Mesh(boxGeo(cx1 - cx0, 3.1, 0.2, 3, 3), wallM); cN.position.set(-590, Y + 1.55, cz0); cs.add(cN);
    const cS = new THREE.Mesh(boxGeo(cx1 - cx0, 3.1, 0.2, 3, 3), wallM); cS.position.set(-590, Y + 1.55, cz1); cs.add(cS);
    const cW = new THREE.Mesh(boxGeo(0.2, 3.1, cz1 - cz0, 3, 3), wallM); cW.position.set(cx0, Y + 1.55, 55.75); cs.add(cW);
    const cE2 = new THREE.Mesh(boxGeo(0.2, 3.1, cz1 - cz0, 3, 3), wallM); cE2.position.set(cx1, Y + 1.55, 55.75); cs.add(cE2);
    const cGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.5), glassM); cGlass.position.set(-590, Y + 1.25, cz0 + 0.12); cs.add(cGlass);
    // bar along the north wall: counter, espresso machine, grinder, cups, pastry case
    const bar = new THREE.Mesh(boxGeo(5.0, 1.0, 0.7, 3, 2), woodM); bar.position.set(-590, Y + 0.5, cz0 + 0.75); cs.add(bar);
    const barTop = new THREE.Mesh(boxGeo(5.2, 0.06, 0.8, 3, 1), new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.4 })); barTop.position.set(-590, Y + 1.03, cz0 + 0.75); cs.add(barTop);
    const machine = new THREE.Mesh(boxGeo(0.7, 0.6, 0.45, 2, 2), M.metal); machine.position.set(-591.2, Y + 1.33, cz0 + 0.7); cs.add(machine);
    const grinder = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 32), M.darkMetal); grinder.position.set(-590.0, Y + 1.32, cz0 + 0.7); cs.add(grinder);
    for (let i = 0; i < 4; i++) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.09, 32), new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.5 })); cup.position.set(-589.2 + i * 0.14, Y + 1.11, cz0 + 0.66); cs.add(cup); }
    const pastry = new THREE.Mesh(boxGeo(0.9, 0.4, 0.5, 2, 2), glassM); pastry.position.set(-587.9, Y + 1.28, cz0 + 0.75); cs.add(pastry);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.9), warmM); board.position.set(-590, Y + 2.2, cz0 + 0.13); cs.add(board);
    // two small round tables + stools
    for (const [tx2, tz2] of [[-591.6, 56.4], [-588.4, 56.4]]) {
      const table = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32), woodM); table.position.set(tx2, Y + 0.78, tz2); cs.add(table);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.76, 32), M.darkMetal); leg.position.set(tx2, Y + 0.4, tz2); cs.add(leg);
      for (const [sx2, sz2] of [[tx2 - 0.6, tz2], [tx2 + 0.6, tz2]]) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.45, 32), M.darkMetal); st.position.set(sx2, Y + 0.24, sz2); cs.add(st);
      }
    }
    for (let i = 0; i < 3; i++) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.08, 32, 16), warmM); lamp.position.set(-591.8 + i * 1.8, Y + 2.6, 54.6); cs.add(lamp);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 32), M.darkMetal); cord.position.set(-591.8 + i * 1.8, Y + 2.87, 54.6); cs.add(cord);
    }
    const cMenu = makeCanvas(512, 128), mctx = cMenu.getContext('2d');
    mctx.fillStyle = '#120e0a'; mctx.fillRect(0, 0, 512, 128); mctx.strokeStyle = '#6fd8ff'; mctx.lineWidth = 4; mctx.strokeRect(4, 4, 504, 120);
    mctx.fillStyle = '#e8f6ff'; mctx.textAlign = 'center'; mctx.font = '700 46px "PingFang SC",sans-serif'; mctx.fillText('夜航咖啡', 256, 56);
    mctx.fillStyle = '#6fd8ff'; mctx.font = '500 18px monospace'; mctx.fillText('NIGHT SHIFT COFFEE', 256, 98);
    const mtex2 = canvasTexture(cMenu, true, 1, 1, 4);
    const mneon = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({ map: mtex2, color: new THREE.Color(1.2, 1.7, 2.0) }));
    mneon.position.set(-590, Y + 2.75, cz0 + 0.13); cs.add(mneon);
    cs.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
    scene.add(cs);
    C.coffeeshop = { x0: cx0, x1: cx1, z0: cz0, z1: cz1, y: Y, door: [-590, cz1], inside: [-590, 56.4] };
    add({ x0: cx0, x1: cx1, z0: cz0 - 0.2, z1: cz0, y0: 0, y1: Y + 3.1, kind: 'coffee-wall' });
    add({ x0: cx0, x1: cx1, z0: cz1, z1: cz1 + 0.2, y0: 0, y1: Y + 3.1, kind: 'coffee-wall' });
    add({ x0: cx0 - 0.2, x1: cx0, z0: cz0, z1: cz1, y0: 0, y1: Y + 3.1, kind: 'coffee-wall' });
    add({ x0: cx1, x1: cx1 + 0.2, z0: cz0, z1: cz1, y0: 0, y1: Y + 3.1, kind: 'coffee-wall' });
  }

  // enterable 花店 behind the east-wall storefront
  {
    const fs = new THREE.Group(); fs.name = 'harbour-flowers';
    const fx0 = -574, fx1 = -564, fz0 = 72, fz1 = 78;
    const fFloor = new THREE.Mesh(boxGeo(fx1 - fx0, 0.14, fz1 - fz0, 3, 3), new THREE.MeshStandardMaterial({ color: 0x6a6a62, roughness: 0.6 })); fFloor.position.set(-569, Y - 0.07, 75); fs.add(fFloor);
    const fCeil = new THREE.Mesh(boxGeo(fx1 - fx0, 0.12, fz1 - fz0, 3, 3), wallM); fCeil.position.set(-569, Y + 3.1, 75); fs.add(fCeil);
    const fN = new THREE.Mesh(boxGeo(fx1 - fx0, 3.1, 0.2, 3, 3), wallM); fN.position.set(-569, Y + 1.55, fz0); fs.add(fN);
    const fS = new THREE.Mesh(boxGeo(fx1 - fx0, 3.1, 0.2, 3, 3), wallM); fS.position.set(-569, Y + 1.55, fz1); fs.add(fS);
    const fE = new THREE.Mesh(boxGeo(0.2, 3.1, fz1 - fz0, 3, 3), wallM); fE.position.set(fx1, Y + 1.55, 75); fs.add(fE);
    for (const sz of [-1.9, 1.9]) { const sw = new THREE.Mesh(boxGeo(0.2, 3.1, 1.0, 3, 3), wallM); sw.position.set(fx0, Y + 1.55, 75 + sz); fs.add(sw); }
    const fDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.5), glassM); fDoor.position.set(fx0 + 0.02, Y + 1.25, 75); fDoor.rotation.y = Math.PI / 2; fs.add(fDoor);
    // flower buckets along the east + south walls, roses as clustered spheres
    const buckets = [], stems = [], blooms = [];
    const bloomCols = [0xd84a5a, 0xe89ab0, 0xe0c04a, 0xf0e8e0, 0xa45ac8, 0xe87a3a];
    for (let i = 0; i < 7; i++) {
      const bx = fx1 - 0.55, bz = fz0 + 0.85 + i * 0.82;
      buckets.push({ geometry: new THREE.CylinderGeometry(0.13, 0.11, 0.46, 32), matrix: M4(bx, Y + 0.23, bz) });
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * Math.PI * 2;
        blooms.push({ geometry: new THREE.SphereGeometry(0.075, 16, 12), matrix: M4(bx + Math.cos(a) * 0.1, Y + 0.6 + (k % 2) * 0.05, bz + Math.sin(a) * 0.1), color: new THREE.Color(pick(bloomCols)) });
        stems.push({ geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.4, 16), matrix: M4(bx + Math.cos(a) * 0.1, Y + 0.4, bz + Math.sin(a) * 0.1) });
      }
    }
    for (let i = 0; i < 4; i++) {
      const bz = fz1 - 0.6, bx = fx1 - 1.4 - i * 1.1;
      buckets.push({ geometry: new THREE.CylinderGeometry(0.12, 0.1, 0.42, 32), matrix: M4(bx, Y + 0.21, bz) });
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * Math.PI * 2;
        blooms.push({ geometry: new THREE.SphereGeometry(0.07, 16, 12), matrix: M4(bx + Math.cos(a) * 0.09, Y + 0.56, bz + Math.sin(a) * 0.09), color: new THREE.Color(pick(bloomCols)) });
        stems.push({ geometry: new THREE.CylinderGeometry(0.006, 0.006, 0.38, 16), matrix: M4(bx + Math.cos(a) * 0.09, Y + 0.37, bz + Math.sin(a) * 0.09) });
      }
    }
    fs.add(new THREE.Mesh(mergeGeoms(buckets), M.metal));
    fs.add(new THREE.Mesh(mergeGeoms(stems), new THREE.MeshStandardMaterial({ color: 0x2a4a2a, roughness: 0.8 })));
    const fl = new THREE.Mesh(mergeGeoms(blooms, { vertexColors: true }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })); fl.castShadow = false; fs.add(fl);
    // wrapping counter + cooler cabinet + hanging plant + neon + lamps
    const fc = new THREE.Mesh(boxGeo(2.2, 0.95, 0.8, 3, 2), woodM); fc.position.set(-568.6, Y + 0.48, 72.8); fs.add(fc);
    const fcTop = new THREE.Mesh(boxGeo(2.3, 0.05, 0.9, 3, 1), new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.5 })); fcTop.position.set(-568.6, Y + 0.98, 72.8); fs.add(fcTop);
    const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.6, 32), new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.8 })); paper.position.set(-569.2, Y + 1.2, 72.9); paper.rotation.z = 0.25; fs.add(paper);
    const cooler = new THREE.Mesh(boxGeo(1.4, 2.0, 0.6, 3, 3), M.darkMetal); cooler.position.set(-566.2, Y + 1.0, 77.3); fs.add(cooler);
    const coolerGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.6), glassM); coolerGlass.position.set(-566.2, Y + 1.1, 76.99); coolerGlass.rotation.y = Math.PI; fs.add(coolerGlass);
    const plant = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16), new THREE.MeshStandardMaterial({ color: 0x2a5a34, roughness: 0.9 })); plant.position.set(-570.5, Y + 2.2, 77.2); plant.scale.set(1, 0.8, 1); fs.add(plant);
    const fc2 = makeCanvas(512, 128), fctx = fc2.getContext('2d');
    fctx.fillStyle = '#140d12'; fctx.fillRect(0, 0, 512, 128); fctx.strokeStyle = '#ff7a9a'; fctx.lineWidth = 4; fctx.strokeRect(4, 4, 504, 120);
    fctx.fillStyle = '#ffe8ee'; fctx.textAlign = 'center'; fctx.font = '700 46px "PingFang SC",sans-serif'; fctx.fillText('花店', 256, 56);
    fctx.fillStyle = '#ff7a9a'; fctx.font = '500 18px monospace'; fctx.fillText('HARBOUR FLOWERS · 24H', 256, 98);
    const ftex = canvasTexture(fc2, true, 1, 1, 4);
    const fneon = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({ map: ftex, color: new THREE.Color(1.8, 1.3, 1.5) }));
    fneon.position.set(-569, Y + 2.55, fz0 + 0.12); fs.add(fneon);
    for (const [lx7, lz7] of [[-567.4, 73.4], [-567.4, 76.4], [-570.6, 73.4]]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.095, 32, 16), warmM); lamp.position.set(lx7, Y + 2.9, lz7); fs.add(lamp);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.32, 32), M.darkMetal); cord.position.set(lx7, Y + 3.04, lz7); fs.add(cord);
    }
    fs.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
    scene.add(fs);
    C.flower = { x0: fx0, x1: fx1, z0: fz0, z1: fz1, y: Y, door: [-574, 75], inside: [-569.2, 75] };
    add({ x0: fx0, x1: fx1, z0: fz0 - 0.2, z1: fz0, y0: 0, y1: Y + 3.1, kind: 'flower-wall' });
    add({ x0: fx0, x1: fx1, z0: fz1, z1: fz1 + 0.2, y0: 0, y1: Y + 3.1, kind: 'flower-wall' });
    add({ x0: fx1, x1: fx1 + 0.2, z0: fz0, z1: fz1, y0: 0, y1: Y + 3.1, kind: 'flower-wall' });
  }

  // enterable 雨具店 behind the west-wall storefront
  {
    const us = new THREE.Group(); us.name = 'harbour-umbrellas';
    const ux0 = -616, ux1 = -606, uz0 = 63.5, uz1 = 69.5;
    const uFloor = new THREE.Mesh(boxGeo(ux1 - ux0, 0.14, uz1 - uz0, 3, 3), new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 0.6 })); uFloor.position.set(-611, Y - 0.07, 66.5); us.add(uFloor);
    const uCeil = new THREE.Mesh(boxGeo(ux1 - ux0, 0.12, uz1 - uz0, 3, 3), wallM); uCeil.position.set(-611, Y + 3.2, 66.5); us.add(uCeil);
    const uN = new THREE.Mesh(boxGeo(ux1 - ux0, 3.2, 0.2, 3, 3), wallM); uN.position.set(-611, Y + 1.6, uz0); us.add(uN);
    const uS = new THREE.Mesh(boxGeo(ux1 - ux0, 3.2, 0.2, 3, 3), wallM); uS.position.set(-611, Y + 1.6, uz1); us.add(uS);
    const uW = new THREE.Mesh(boxGeo(0.2, 3.2, uz1 - uz0, 3, 3), wallM); uW.position.set(ux0, Y + 1.6, 66.5); us.add(uW);
    for (const sz of [-2.0, 2.0]) { const sw = new THREE.Mesh(boxGeo(0.2, 3.2, 1.0, 3, 3), wallM); sw.position.set(ux1, Y + 1.6, 66.5 + sz); us.add(sw); }
    const uDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), glassM); uDoor.position.set(ux1 - 0.02, Y + 1.3, 66.5); uDoor.rotation.y = Math.PI / 2; us.add(uDoor);
    // wall of open umbrellas (coloured canopies + shafts), plus a floor stand
    const ucol = [0xc84a5a, 0x4a7ac8, 0xd8b44a, 0x4a9a6a, 0x8a5ac8, 0xd87a3a];
    const canopies = [], shafts = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      const ux = ux0 + 0.9 + i * 1.35, uy = Y + 1.35 + j * 0.6;
      canopies.push({ geometry: new THREE.ConeGeometry(0.3, 0.34, 32), matrix: M4(ux, uy, uz0 + 0.42), color: new THREE.Color(pick(ucol)) });
      shafts.push({ geometry: new THREE.CylinderGeometry(0.018, 0.018, 0.9, 32), matrix: M4(ux, uy - 0.52, uz0 + 0.42) });
    }
    for (let k = 0; k < 7; k++) {
      const ang = k / 7 * Math.PI * 2;
      canopies.push({ geometry: new THREE.ConeGeometry(0.34, 0.38, 32), matrix: M4(-612.6 + Math.cos(ang) * 0.55, Y + 1.3, 68.3 + Math.sin(ang) * 0.55), color: new THREE.Color(pick(ucol)) });
      shafts.push({ geometry: new THREE.CylinderGeometry(0.02, 0.02, 1.05, 32), matrix: M4(-612.6 + Math.cos(ang) * 0.55, Y + 0.7, 68.3 + Math.sin(ang) * 0.55) });
    }
    us.add(new THREE.Mesh(mergeGeoms(shafts), M.darkMetal));
    const um = new THREE.Mesh(mergeGeoms(canopies, { vertexColors: true }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide })); um.castShadow = false; us.add(um);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.5, 32), M.darkMetal); stand.position.set(-612.6, Y + 0.25, 68.3); us.add(stand);
    // boots rack + counter + umbrella sign + lamps
    for (let i = 0; i < 4; i++) {
      const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.42, 32), new THREE.MeshStandardMaterial({ color: pick([0x2a2a2a, 0x6a5a3a, 0x3a4a5a, 0x7a3a3a]), roughness: 0.6 }));
      boot.position.set(ux0 + 0.65, Y + 0.33, 64.4 + i * 0.32); us.add(boot);
    }
    const ucounter = new THREE.Mesh(boxGeo(1.0, 0.95, 3.0, 3, 2), woodM); ucounter.position.set(-607.2, Y + 0.48, 65.2); us.add(ucounter);
    const till = new THREE.Mesh(boxGeo(0.45, 0.28, 0.35, 2, 2), M.darkMetal); till.position.set(-607.2, Y + 1.1, 64.6); us.add(till);
    const uc = makeCanvas(512, 128), uctx = uc.getContext('2d');
    uctx.fillStyle = '#0d1218'; uctx.fillRect(0, 0, 512, 128); uctx.strokeStyle = '#8fe3a0'; uctx.lineWidth = 4; uctx.strokeRect(4, 4, 504, 120);
    uctx.fillStyle = '#e8fff0'; uctx.textAlign = 'center'; uctx.font = '700 46px "PingFang SC",sans-serif'; uctx.fillText('雨具店', 256, 56);
    uctx.fillStyle = '#8fe3a0'; uctx.font = '500 18px monospace'; uctx.fillText('RAIN GEAR · SINCE 2001', 256, 98);
    const utex = canvasTexture(uc, true, 1, 1, 4);
    const uneon = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({ map: utex, color: new THREE.Color(1.3, 1.8, 1.4) }));
    uneon.position.set(-611, Y + 2.65, uz0 + 0.12); us.add(uneon);
    for (const [lx6, lz6] of [[-614, 65.2], [-611, 65.2], [-608, 65.2]]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 16), warmM); lamp.position.set(lx6, Y + 2.95, lz6); us.add(lamp);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 32), M.darkMetal); cord.position.set(lx6, Y + 3.12, lz6); us.add(cord);
    }
    us.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
    scene.add(us);
    C.umbrella = { x0: ux0, x1: ux1, z0: uz0, z1: uz1, y: Y, door: [-606, 66.5], inside: [-611.2, 66.5] };
    add({ x0: ux0, x1: ux1, z0: uz0 - 0.2, z1: uz0, y0: 0, y1: Y + 3.2, kind: 'umbrella-wall' });
    add({ x0: ux0, x1: ux1, z0: uz1, z1: uz1 + 0.2, y0: 0, y1: Y + 3.2, kind: 'umbrella-wall' });
    add({ x0: ux0 - 0.2, x1: ux0, z0: uz0, z1: uz1, y0: 0, y1: Y + 3.2, kind: 'umbrella-wall' });
  }

  // enterable 明信片铺 behind the north-wall storefront
  {
    const ps = new THREE.Group(); ps.name = 'harbour-postcards';
    const px0 = -583, px1 = -578, pz0 = 51.5, pz1 = 60;
    const pFloor = new THREE.Mesh(boxGeo(px1 - px0, 0.14, pz1 - pz0, 3, 3), woodM); pFloor.position.set(-580.5, Y - 0.07, 55.75); ps.add(pFloor);
    const pCeil = new THREE.Mesh(boxGeo(px1 - px0, 0.12, pz1 - pz0, 3, 3), wallM); pCeil.position.set(-580.5, Y + 3.3, 55.75); ps.add(pCeil);
    const pN = new THREE.Mesh(boxGeo(px1 - px0, 3.3, 0.2, 3, 3), wallM); pN.position.set(-580.5, Y + 1.65, pz0); ps.add(pN);
    for (const sx of [-1.7, 1.7]) { const sw = new THREE.Mesh(boxGeo(1.6, 3.3, 0.2, 3, 3), wallM); sw.position.set(-580.5 + sx, Y + 1.65, pz1); ps.add(sw); }
    const pW = new THREE.Mesh(boxGeo(0.2, 3.3, pz1 - pz0, 3, 3), wallM); pW.position.set(px0, Y + 1.65, 55.75); ps.add(pW);
    const pE = new THREE.Mesh(boxGeo(0.2, 3.3, pz1 - pz0, 3, 3), wallM); pE.position.set(px1, Y + 1.65, 55.75); ps.add(pE);
    const pDoor = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), glassM); pDoor.position.set(-580.5, Y + 1.3, pz1 - 0.02); ps.add(pDoor);
    // postcard racks: coloured cards + three big featured covers
    const cardBoards = [], cards = [];
    const cardCols = [0xd8b46a, 0x6fa8d8, 0xd87a6a, 0x8fb8a0, 0xc8a0d8, 0xe0d0b0];
    for (const sy of [Y + 1.0, Y + 1.55, Y + 2.1]) cardBoards.push({ geometry: boxGeo(4.4, 0.05, 0.36, 2, 1), matrix: M4(-580.5, sy, pz0 + 0.32) });
    for (let i = 0; i < 10; i++) for (const sy of [Y + 1.0, Y + 1.55, Y + 2.1]) {
      cards.push({ geometry: boxGeo(0.34, 0.26, 0.02, 1, 1), matrix: M4(-582.4 + i * 0.42, sy + 0.17, pz0 + 0.38), color: new THREE.Color(pick(cardCols)) });
    }
    ps.add(new THREE.Mesh(mergeGeoms(cardBoards), woodM));
    const cm2 = new THREE.Mesh(mergeGeoms(cards, { vertexColors: true }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })); cm2.castShadow = false; ps.add(cm2);
    const feat = [['澜滩', 0xc98a44, 'LANTAN WATERFRONT'], ['星珠', 0x6fa8d8, 'STAR PEARL'], ['魔都中心', 0x8fa8c8, 'MODU TOWER']];
    feat.forEach(([nm, col, en], i) => {
      const cc = makeCanvas(256, 320), cx3 = cc.getContext('2d');
      cx3.fillStyle = '#141018'; cx3.fillRect(0, 0, 256, 320);
      const grad = cx3.createLinearGradient(0, 40, 0, 220); grad.addColorStop(0, '#' + col.toString(16).padStart(6, '0')); grad.addColorStop(1, '#1a1620');
      cx3.fillStyle = grad; cx3.fillRect(16, 16, 224, 200);
      cx3.fillStyle = '#0e0c12'; cx3.fillRect(16, 150, 224, 66);
      cx3.fillStyle = '#f2e6c8'; cx3.textAlign = 'center'; cx3.font = '700 34px "PingFang SC",sans-serif'; cx3.fillText(nm, 128, 268);
      cx3.fillStyle = '#b8a888'; cx3.font = '500 13px monospace'; cx3.fillText(en, 128, 292);
      const ct = canvasTexture(cc, true, 1, 1, 4);
      const card2 = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.6 }));
      card2.position.set(-582.2 + i * 0.8, Y + 2.55, pz0 + 0.39); ps.add(card2);
    });
    // writing desk + pen stand + stamp box
    const desk = new THREE.Mesh(boxGeo(2.6, 0.85, 1.1, 3, 2), woodM); desk.position.set(-580.5, Y + 0.42, 56.9); ps.add(desk);
    const dTop = new THREE.Mesh(boxGeo(2.7, 0.05, 1.2, 3, 1), new THREE.MeshStandardMaterial({ color: 0xcfc0a4, roughness: 0.5 })); dTop.position.set(-580.5, Y + 0.87, 56.9); ps.add(dTop);
    for (let i = 0; i < 3; i++) { const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 32), M.darkMetal); pen.position.set(-581.1 + i * 0.1, Y + 0.96, 56.7); ps.add(pen); }
    const stamp = new THREE.Mesh(boxGeo(0.22, 0.06, 0.16, 2, 2), new THREE.MeshStandardMaterial({ color: 0x9a3a3a, roughness: 0.6 })); stamp.position.set(-579.8, Y + 0.93, 56.7); ps.add(stamp);
    const till = new THREE.Mesh(boxGeo(0.5, 0.3, 0.4, 2, 2), M.darkMetal); till.position.set(-579.4, Y + 1.05, 55.4); ps.add(till);
    for (const [lx5, lz5] of [[-581.8, 54], [-579.2, 54], [-581.8, 58]]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 16), warmM); lamp.position.set(lx5, Y + 3.0, lz5); ps.add(lamp);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.45, 32), M.darkMetal); cord.position.set(lx5, Y + 3.22, lz5); ps.add(cord);
    }
    ps.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
    scene.add(ps);
    C.postcard = { x0: px0, x1: px1, z0: pz0, z1: pz1, y: Y, door: [-580.5, pz1], inside: [-580.5, 56.2] };
    add({ x0: px0, x1: px1, z0: pz0 - 0.2, z1: pz0, y0: 0, y1: Y + 3.3, kind: 'postcard-wall' });
    add({ x0: px0, x1: px1, z0: pz1, z1: pz1 + 0.2, y0: 0, y1: Y + 3.3, kind: 'postcard-wall' });
    add({ x0: px0, x1: px0 + 0.2, z0: pz0, z1: pz1, y0: 0, y1: Y + 3.3, kind: 'postcard-wall' });
    add({ x0: px1 - 0.2, x1: px1, z0: pz0, z1: pz1, y0: 0, y1: Y + 3.3, kind: 'postcard-wall' });
  }

  // enterable 唱片行 behind the east-wall storefront
  {
    const rs = new THREE.Group(); rs.name = 'harbour-records';
    const rx0 = -574, rx1 = -564, rz0 = 63.5, rz1 = 70.5;
    const rFloor = new THREE.Mesh(boxGeo(rx1 - rx0, 0.14, rz1 - rz0, 3, 3), new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.65 })); rFloor.position.set(-569, Y - 0.07, 67); rs.add(rFloor);
    const rCeil = new THREE.Mesh(boxGeo(rx1 - rx0, 0.12, rz1 - rz0, 3, 3), wallM); rCeil.position.set(-569, Y + 3.6, 67); rs.add(rCeil);
    const rN = new THREE.Mesh(boxGeo(rx1 - rx0, 3.6, 0.2, 3, 3), wallM); rN.position.set(-569, Y + 1.8, rz0); rs.add(rN);
    const rS = new THREE.Mesh(boxGeo(rx1 - rx0, 3.6, 0.2, 3, 3), wallM); rS.position.set(-569, Y + 1.8, rz1); rs.add(rS);
    const rE = new THREE.Mesh(boxGeo(0.2, 3.6, rz1 - rz0, 3, 3), wallM); rE.position.set(rx1, Y + 1.8, 67); rs.add(rE);
    for (const sz of [-2.8, 2.8]) { const sw = new THREE.Mesh(boxGeo(0.2, 3.6, 1.4, 3, 3), wallM); sw.position.set(rx0, Y + 1.8, 67 + sz); rs.add(sw); }
    const rDoor = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.7), glassM); rDoor.position.set(rx0 + 0.02, Y + 1.4, 67); rDoor.rotation.y = Math.PI / 2; rs.add(rDoor);
    // vinyl racks: east wall + north wall, shelves of album covers
    const rackBoards = [], albums = [];
    for (const sy of [Y + 0.9, Y + 1.5, Y + 2.1]) rackBoards.push({ geometry: boxGeo(0.5, 0.05, 5.8, 2, 1), matrix: M4(rx1 - 0.32, sy, 67) });
    for (let i = 0; i < 4; i++) rackBoards.push({ geometry: boxGeo(0.5, 3.0, 0.06, 1, 2), matrix: M4(rx1 - 0.32, Y + 1.5, 64.2 + i * 1.85) });
    for (const sy of [Y + 0.9, Y + 1.5, Y + 2.1]) rackBoards.push({ geometry: boxGeo(5.4, 0.05, 0.5, 2, 1), matrix: M4(-569, sy, rz0 + 0.32) });
    const albumCols = [0xd84a3a, 0x3a7ad8, 0xe0b04a, 0x4aa86a, 0xa45ad8, 0xd85a9a, 0xe8e0d0, 0x2a3a4a];
    for (let i = 0; i < 16; i++) for (const sy of [Y + 0.9, Y + 1.5, Y + 2.1]) {
      albums.push({ geometry: boxGeo(0.34, 0.34, 0.03, 1, 1), matrix: M4(rx1 - 0.58, sy + 0.2, 64.4 + i * 0.33), color: new THREE.Color(pick(albumCols)) });
    }
    for (let i = 0; i < 14; i++) for (const sy of [Y + 0.9, Y + 1.5, Y + 2.1]) {
      albums.push({ geometry: boxGeo(0.03, 0.34, 0.34, 1, 1), matrix: M4(-571.9 + i * 0.34, sy + 0.2, rz0 + 0.58), color: new THREE.Color(pick(albumCols)) });
    }
    rs.add(new THREE.Mesh(mergeGeoms(rackBoards), woodM));
    const am = new THREE.Mesh(mergeGeoms(albums, { vertexColors: true }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })); am.castShadow = false; rs.add(am);
    // listening booth: glass corner + headphones + stool
    const boothGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.4), glassM); boothGlass.position.set(rx1 - 1.2, Y + 1.2, rz1 - 1.2); boothGlass.rotation.y = 0; rs.add(boothGlass);
    const hp = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 32, 32, Math.PI), M.darkMetal); hp.position.set(rx1 - 1.2, Y + 1.55, rz1 - 1.1); rs.add(hp);
    const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 32), woodM); stool.position.set(rx1 - 1.2, Y + 0.55, rz1 - 1.7); rs.add(stool);
    const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 32), M.darkMetal); sl.position.set(rx1 - 1.2, Y + 0.3, rz1 - 1.7); rs.add(sl);
    // counter + turntable + neon sign + posters
    const rc = new THREE.Mesh(boxGeo(1.8, 1.0, 0.8, 3, 2), woodM); rc.position.set(-566.2, Y + 0.5, rz0 + 1.3); rs.add(rc);
    const tt = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32), new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.4 })); tt.position.set(-566.2, Y + 1.06, rz0 + 1.3); rs.add(tt);
    const arm = new THREE.Mesh(boxGeo(0.05, 0.04, 0.4, 1, 1), M.darkMetal); arm.position.set(-565.9, Y + 1.12, rz0 + 1.15); arm.rotation.y = 0.6; rs.add(arm);
    const nc = makeCanvas(512, 128), nctx = nc.getContext('2d');
    nctx.fillStyle = '#0b0f14'; nctx.fillRect(0, 0, 512, 128); nctx.strokeStyle = '#6fd8ff'; nctx.lineWidth = 4; nctx.strokeRect(4, 4, 504, 120);
    nctx.fillStyle = '#e8f6ff'; nctx.textAlign = 'center'; nctx.font = '700 46px "PingFang SC",sans-serif'; nctx.fillText('唱片行', 256, 56);
    nctx.fillStyle = '#6fd8ff'; nctx.font = '500 18px monospace'; nctx.fillText('HARBOUR RECORDS · VINYL', 256, 98);
    const ntex = canvasTexture(nc, true, 1, 1, 4);
    const neon = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: ntex, color: new THREE.Color(1.6, 1.8, 2.0) }));
    neon.position.set(-569, Y + 2.9, rz0 + 0.12); rs.add(neon);
    const posters = [[-570.2, 0xc84a6a, 'NIGHT'], [-567.8, 0x4a8ac8, 'RIVER']];
    for (const [px4, col4, nm] of posters) {
      const pc = makeCanvas(256, 360), px = pc.getContext('2d');
      px.fillStyle = '#111'; px.fillRect(0, 0, 256, 360); px.fillStyle = '#' + col4.toString(16).padStart(6, '0'); px.fillRect(16, 16, 224, 200);
      px.fillStyle = '#f0ead8'; px.textAlign = 'center'; px.font = '700 44px "PingFang SC",sans-serif'; px.fillText(nm, 128, 280); px.font = '400 16px monospace'; px.fillStyle = '#b0a890'; px.fillText('LP · 33 ⅓', 128, 314);
      const pt = canvasTexture(pc, true, 1, 1, 4);
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.12), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.7 })); pm.position.set(px4, Y + 1.7, rz1 - 0.11); pm.rotation.y = Math.PI; rs.add(pm);
    }
    for (const [lx4, lz4] of [[-571.5, 65], [-566.5, 65], [-571.5, 69], [-566.5, 69]]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.8, 3.2) })); lamp.position.set(lx4, Y + 3.2, lz4); rs.add(lamp);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 32), M.darkMetal); cord.position.set(lx4, Y + 3.46, lz4); rs.add(cord);
    }
    rs.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
    scene.add(rs);
    C.records = { x0: rx0, x1: rx1, z0: rz0, z1: rz1, y: Y, door: [-574, 67], inside: [-569.2, 67] };
    add({ x0: rx0, x1: rx1, z0: rz0 - 0.2, z1: rz0, y0: 0, y1: Y + 3.6, kind: 'records-wall' });
    add({ x0: rx0, x1: rx1, z0: rz1, z1: rz1 + 0.2, y0: 0, y1: Y + 3.6, kind: 'records-wall' });
    add({ x0: rx1, x1: rx1 + 0.2, z0: rz0, z1: rz1, y0: 0, y1: Y + 3.6, kind: 'records-wall' });
  }

  // enterable 面包房 behind the west-wall storefront
  {
    const bk = new THREE.Group(); bk.name = 'harbour-bakery';
    const gx0 = -616, gx1 = -606, gz0 = 71, gz1 = 78;
    const gFloor = new THREE.Mesh(boxGeo(gx1 - gx0, 0.14, gz1 - gz0, 3, 3), new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.7 })); gFloor.position.set(-611, Y - 0.07, 74.5); bk.add(gFloor);
    const gCeil = new THREE.Mesh(boxGeo(gx1 - gx0, 0.12, gz1 - gz0, 3, 3), wallM); gCeil.position.set(-611, Y + 3.7, 74.5); bk.add(gCeil);
    const gN = new THREE.Mesh(boxGeo(gx1 - gx0, 3.7, 0.2, 3, 3), wallM); gN.position.set(-611, Y + 1.85, gz0); bk.add(gN);
    const gS = new THREE.Mesh(boxGeo(gx1 - gx0, 3.7, 0.2, 3, 3), wallM); gS.position.set(-611, Y + 1.85, gz1); bk.add(gS);
    const gW = new THREE.Mesh(boxGeo(0.2, 3.7, gz1 - gz0, 3, 3), wallM); gW.position.set(gx0, Y + 1.85, 74.5); bk.add(gW);
    for (const sz of [-3.1, 3.1]) { const sw = new THREE.Mesh(boxGeo(0.2, 3.7, 1.6, 3, 3), wallM); sw.position.set(gx1, Y + 1.85, 74.5 + sz); bk.add(sw); }
    const gGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.8), glassM); gGlass.position.set(gx1 - 0.02, Y + 1.45, 74.5); gGlass.rotation.y = Math.PI / 2; bk.add(gGlass);
    // display counter + bread trays
    const counter = new THREE.Mesh(boxGeo(1.1, 1.0, 5.6, 3, 2), woodM); counter.position.set(-610.4, Y + 0.5, 74.5); bk.add(counter);
    const cTop = new THREE.Mesh(boxGeo(1.2, 0.06, 5.8, 3, 1), new THREE.MeshStandardMaterial({ color: 0xcfc4b0, roughness: 0.5 })); cTop.position.set(-610.4, Y + 1.03, 74.5); bk.add(cTop);
    const loaves = [];
    const loafCols = [0xc98a44, 0xd8a95c, 0xb9762f, 0xe0b06a];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      loaves.push({ geometry: new THREE.SphereGeometry(0.16, 16, 10), matrix: new THREE.Matrix4().makeScale(1.4, 0.75, 1).premultiply(M4(-610.4 + (j - 1) * 0.28, Y + 1.16, 72.4 + i * 1.35)), color: new THREE.Color(pick(loafCols)) });
    }
    const lm = new THREE.Mesh(mergeGeoms(loaves, { vertexColors: true }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); lm.castShadow = false; bk.add(lm);
    // west wall shelves with bread + the oven glow
    const shelves = [], breads = [];
    for (const sy of [Y + 1.1, Y + 1.7, Y + 2.3]) shelves.push({ geometry: boxGeo(0.5, 0.05, 5.4, 2, 1), matrix: M4(gx0 + 0.32, sy, 74.5) });
    for (let i = 0; i < 12; i++) for (const sy of [Y + 1.1, Y + 1.7, Y + 2.3]) {
      breads.push({ geometry: new THREE.SphereGeometry(0.13, 12, 8), matrix: new THREE.Matrix4().makeScale(1.3, 0.7, 1).premultiply(M4(gx0 + 0.42, sy + 0.14, 72.1 + i * 0.44)), color: new THREE.Color(pick(loafCols)) });
    }
    bk.add(new THREE.Mesh(mergeGeoms(shelves), woodM));
    const bm2 = new THREE.Mesh(mergeGeoms(breads, { vertexColors: true }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })); bm2.castShadow = false; bk.add(bm2);
    const oven = new THREE.Mesh(boxGeo(1.2, 1.6, 1.8, 3, 3), M.darkMetal); oven.position.set(gx0 + 0.8, Y + 0.8, 71.9); bk.add(oven);
    const ovenGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.5, 0.6) })); ovenGlow.position.set(gx0 + 1.42, Y + 0.9, 71.9); ovenGlow.rotation.y = Math.PI / 2; bk.add(ovenGlow);
    // chalkboard specials + pendants
    const cb = makeCanvas(256, 192), cx2 = cb.getContext('2d');
    cx2.fillStyle = '#1c2018'; cx2.fillRect(0, 0, 256, 192); cx2.strokeStyle = '#c9b183'; cx2.lineWidth = 5; cx2.strokeRect(6, 6, 244, 180);
    cx2.fillStyle = '#efe6d2'; cx2.textAlign = 'left'; cx2.font = '700 26px "PingFang SC",sans-serif'; cx2.fillText('今日出炉', 22, 48);
    cx2.font = '400 17px "PingFang SC",sans-serif'; ['黄油可颂  ¥12', '海盐法棍  ¥15', '桂花吐司  ¥18', '热豆浆    ¥8'].forEach((t, i) => cx2.fillText(t, 22, 88 + i * 26));
    const ctex = canvasTexture(cb, true, 1, 1, 4);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.5), new THREE.MeshStandardMaterial({ map: ctex, emissiveMap: ctex, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.8 }));
    board.position.set(-609.8, Y + 2.5, gz1 - 0.12); board.rotation.y = Math.PI; bk.add(board);
    for (const [lx3, lz3] of [[-612.6, 73.2], [-612.6, 75.8], [-609.6, 73.2], [-609.6, 75.8]]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), warmM); lamp.position.set(lx3, Y + 3.2, lz3); bk.add(lamp);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 32), M.darkMetal); cord.position.set(lx3, Y + 3.47, lz3); bk.add(cord);
    }
    bk.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
    scene.add(bk);
    C.bakery = { x0: gx0, x1: gx1, z0: gz0, z1: gz1, y: Y, door: [-606, 74.5], inside: [-608.6, 74.5] };
    add({ x0: gx0, x1: gx1, z0: gz0 - 0.2, z1: gz0, y0: 0, y1: Y + 3.7, kind: 'bakery-wall' });
    add({ x0: gx0, x1: gx1, z0: gz1, z1: gz1 + 0.2, y0: 0, y1: Y + 3.7, kind: 'bakery-wall' });
    add({ x0: gx0 - 0.2, x1: gx0, z0: gz0, z1: gz1, y0: 0, y1: Y + 3.7, kind: 'bakery-wall' });
  }

  // enterable 环港书局 behind the north-wall storefront
  {
    const bs = new THREE.Group(); bs.name = 'harbour-bookshop';
    const bx0 = -604, bx1 = -596, bz0 = 51, bz1 = 60;
    const bFloor = new THREE.Mesh(boxGeo(bx1 - bx0, 0.14, bz1 - bz0, 3, 3), woodM); bFloor.position.set(-600, Y - 0.07, 55.5); bs.add(bFloor);
    const bCeil = new THREE.Mesh(boxGeo(bx1 - bx0, 0.12, bz1 - bz0, 3, 3), wallM); bCeil.position.set(-600, Y + 3.9, 55.5); bs.add(bCeil);
    const wN = new THREE.Mesh(boxGeo(bx1 - bx0, 3.9, 0.2, 3, 3), wallM); wN.position.set(-600, Y + 1.95, bz0); bs.add(wN);
    const wW = new THREE.Mesh(boxGeo(0.2, 3.9, bz1 - bz0, 3, 3), wallM); wW.position.set(bx0, Y + 1.95, 55.5); bs.add(wW);
    const wE = new THREE.Mesh(boxGeo(0.2, 3.9, bz1 - bz0, 3, 3), wallM); wE.position.set(bx1, Y + 1.95, 55.5); bs.add(wE);
    for (const sx of [-3.1, 3.1]) { const sw = new THREE.Mesh(boxGeo(1.8, 3.9, 0.2, 3, 3), wallM); sw.position.set(-600 + sx, Y + 1.95, bz1); bs.add(sw); }
    const dGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.9), glassM); dGlass.position.set(-600, Y + 1.5, bz1 - 0.02); bs.add(dGlass);
    // shelf boards + coloured book spines (merged, vertex colours)
    const spineCols = [0xc65a3a, 0x3a6a8c, 0xd8b46a, 0x5a8a5a, 0x8a5a8a, 0xb8b0a0, 0x7a3a3a, 0x2f4f6a];
    const spines = [], boards = [];
    for (const by of [Y + 0.95, Y + 1.55, Y + 2.15]) boards.push({ geometry: boxGeo(5.9, 0.05, 0.42, 2, 1), matrix: M4(-600, by, bz0 + 0.34) });
    for (let i = 0; i < 15; i++) for (const by of [Y + 0.95, Y + 1.55, Y + 2.15]) {
      spines.push({ geometry: boxGeo(0.11, 0.28, 0.2, 1, 1), matrix: M4(-603.1 + i * 0.43, by + 0.17, bz0 + 0.42), color: new THREE.Color(pick(spineCols)) });
    }
    for (const bz of [Y + 0.95, Y + 1.55]) boards.push({ geometry: boxGeo(0.42, 0.05, 7.4, 1, 2), matrix: M4(bx0 + 0.34, bz, 55.5) });
    for (let i = 0; i < 16; i++) for (const by of [Y + 0.95, Y + 1.55]) {
      spines.push({ geometry: boxGeo(0.2, 0.28, 0.11, 1, 1), matrix: M4(bx0 + 0.42, by + 0.17, 52.2 + i * 0.42), color: new THREE.Color(pick(spineCols)) });
    }
    const bm = new THREE.Mesh(mergeGeoms(boards), woodM); bm.castShadow = false; bs.add(bm);
    const sm = new THREE.Mesh(mergeGeoms(spines, { vertexColors: true }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })); sm.castShadow = false; bs.add(sm);
    // reading table + chairs
    const tbl = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.06, 32), woodM); tbl.position.set(-600, Y + 0.82, 54.9); bs.add(tbl);
    const tleg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.8, 32), M.darkMetal); tleg.position.set(-600, Y + 0.4, 54.9); bs.add(tleg);
    for (const [cx, cz] of [[-600.95, 54.9], [-599.05, 54.9], [-600, 53.95]]) {
      const seat = new THREE.Mesh(boxGeo(0.5, 0.07, 0.5, 2, 2), woodM); seat.position.set(cx, Y + 0.5, cz); bs.add(seat);
      const back = new THREE.Mesh(boxGeo(0.5, 0.5, 0.07, 2, 2), woodM); back.position.set(cx + (cz > 54.9 ? 0 : 0), Y + 0.76, cz + 0.24); bs.add(back);
      for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 32), M.darkMetal); l.position.set(cx + lx, Y + 0.25, cz + lz); bs.add(l);
      }
    }
    // cashier desk + lamp, pendants, carpet, sign
    const desk = new THREE.Mesh(boxGeo(1.9, 1.0, 0.7, 3, 2), woodM); desk.position.set(-597.4, Y + 0.5, 55.2); bs.add(desk);
    const deskTop = new THREE.Mesh(boxGeo(2.0, 0.06, 0.8, 3, 1), M.stone || woodM); deskTop.position.set(-597.4, Y + 1.03, 55.2); bs.add(deskTop);
    for (const [lx2, lz2] of [[-601.5, 53.2], [-598.5, 53.2], [-601.5, 57.6], [-598.5, 57.6]]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), warmM); lamp.position.set(lx2, Y + 3.35, lz2); bs.add(lamp);
      const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.55, 32), M.darkMetal); cord.position.set(lx2, Y + 3.65, lz2); bs.add(cord);
    }
    const bc = makeCanvas(512, 128), bxc = bc.getContext('2d');
    bxc.fillStyle = '#1a1410'; bxc.fillRect(0, 0, 512, 128); bxc.strokeStyle = '#c9a96a'; bxc.lineWidth = 4; bxc.strokeRect(4, 4, 504, 120);
    bxc.fillStyle = '#f2e4c6'; bxc.textAlign = 'center'; bxc.font = '700 46px "PingFang SC",sans-serif'; bxc.fillText('环港书局', 256, 58);
    bxc.fillStyle = '#c9b183'; bxc.font = '500 18px monospace'; bxc.fillText('HUANGANG BOOKS · EST. 1998', 256, 98);
    const btex = canvasTexture(bc, true, 1, 1, 4);
    const bsign = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshStandardMaterial({ map: btex, emissiveMap: btex, emissive: 0xffffff, emissiveIntensity: 0.95, roughness: 0.5 }));
    bsign.position.set(-600, Y + 3.25, bz0 + 0.12); bs.add(bsign);
    bs.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
    scene.add(bs);
    C.bookshop = { x0: bx0, x1: bx1, z0: bz0, z1: bz1, y: Y, door: [-600, bz1], inside: [-600, 55.4] };
    add({ x0: bx0, x1: bx1, z0: bz0 - 0.2, z1: bz0, y0: 0, y1: Y + 3.9, kind: 'bookshop-wall' });
    add({ x0: bx0 - 0.2, x1: bx0, z0: bz0, z1: bz1, y0: 0, y1: Y + 3.9, kind: 'bookshop-wall' });
    add({ x0: bx1, x1: bx1 + 0.2, z0: bz0, z1: bz1, y0: 0, y1: Y + 3.9, kind: 'bookshop-wall' });
  }
})();
