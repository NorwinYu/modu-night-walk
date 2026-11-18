/* 14-cafe — an enterable riverfront cafe beside the platform: glass front,
   counter, tables, warm pendants, a barista and a view of the Lantan waterfront. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, TEX = G.TEX, scene = G.scene, C = G.CITY;
  const U = G.util;
  const { R, pick, clamp, M4, boxGeo, mergeGeoms, makeCanvas, canvasTexture } = U;
  const X0 = -604, X1 = -592, Z0 = 70, Z1 = 80;
  const Y = 0.67;
  const room = new THREE.Group(); room.name = 'riverfront-cafe';

  const wallM = new THREE.MeshStandardMaterial({ color: 0x2c2622, roughness: 0.72 });
  const floorM = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.62 });
  const woodM = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.55 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x8fb8c8, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.24 });
  const warmM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.9) });
  const counterM = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.45, metalness: 0.1 });

  const floor = new THREE.Mesh(boxGeo(X1 - X0, 0.2, Z1 - Z0, 3, 3), floorM); floor.position.set((X0 + X1) / 2, Y - 0.1, (Z0 + Z1) / 2); room.add(floor);
  const ceil = new THREE.Mesh(boxGeo(X1 - X0, 0.15, Z1 - Z0, 3, 3), wallM); ceil.position.set((X0 + X1) / 2, Y + 3.5, (Z0 + Z1) / 2); room.add(ceil);
  // walls (south is glass + door)
  const wN = new THREE.Mesh(boxGeo(X1 - X0, 3.5, 0.2, 3, 3), wallM); wN.position.set((X0 + X1) / 2, Y + 1.75, Z0); room.add(wN);
  const wW = new THREE.Mesh(boxGeo(0.2, 3.5, Z1 - Z0, 3, 3), wallM); wW.position.set(X0, Y + 1.75, (Z0 + Z1) / 2); room.add(wW);
  const wE = new THREE.Mesh(boxGeo(0.2, 3.5, Z1 - Z0, 3, 3), wallM); wE.position.set(X1, Y + 1.75, (Z0 + Z1) / 2); room.add(wE);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(X1 - X0 - 2.4, 2.9), glassM); glass.position.set((X0 + X1) / 2 - 1.2, Y + 1.7, Z1); room.add(glass);
  const glassFrame = new THREE.Mesh(boxGeo(X1 - X0, 0.1, 0.12, 3, 1), M.darkMetal); glassFrame.position.set((X0 + X1) / 2, Y + 3.15, Z1); room.add(glassFrame);
  const doorFrame = new THREE.Mesh(boxGeo(1.5, 2.9, 0.12, 2, 2), M.darkMetal); doorFrame.position.set(-596, Y + 1.45, Z1 - 0.01); room.add(doorFrame);
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 2.7), glassM); doorGlass.position.set(-596, Y + 1.4, Z1 + 0.01); room.add(doorGlass);
  // counter + espresso
  const counter = new THREE.Mesh(boxGeo(5.4, 1.0, 0.7, 3, 2), counterM); counter.position.set(-598, Y + 0.5, Z0 + 1.0); room.add(counter);
  const top = new THREE.Mesh(boxGeo(5.6, 0.08, 0.8, 3, 1), woodM); top.position.set(-598, Y + 1.04, Z0 + 1.0); room.add(top);
  const machine = new THREE.Mesh(boxGeo(0.7, 0.55, 0.45, 2, 2), M.metal); machine.position.set(-599.2, Y + 1.35, Z0 + 1.0); room.add(machine);
  const menuC = makeCanvas(512, 256), mc = menuC.getContext('2d');
  mc.fillStyle = '#14110e'; mc.fillRect(0, 0, 512, 256); mc.strokeStyle = '#caa66a'; mc.lineWidth = 5; mc.strokeRect(5, 5, 502, 246);
  mc.fillStyle = '#f0e2c6'; mc.textAlign = 'center'; mc.font = '700 40px "PingFang SC",sans-serif'; mc.fillText('咖啡 · COFFEE', 256, 60);
  mc.font = '500 24px "PingFang SC",sans-serif'; mc.fillStyle = '#d9c39a'; mc.fillText('美式 / 拿铁 / 热巧克力', 256, 120); mc.fillText('雨夜限定 · 姜茶', 256, 164);
  const menuT = canvasTexture(menuC, true, 1, 1, 4);
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshStandardMaterial({ map: menuT, emissiveMap: menuT, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.6 }));
  menu.position.set(-598, Y + 2.2, Z0 + 0.12); room.add(menu);
  // tables, chairs, pendant lamps
  for (const tx of [-600.6, -594.8]) for (const tz of [Z0 + 4.0, Z0 + 6.4]) {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.06, 32), woodM); table.position.set(tx, Y + 0.75, tz); room.add(table);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 32), M.darkMetal); leg.position.set(tx, Y + 0.38, tz); room.add(leg);
    for (const [cx, cz] of [[tx - 0.85, tz], [tx + 0.85, tz]]) {
      const seat = new THREE.Mesh(boxGeo(0.5, 0.08, 0.5, 2, 2), woodM); seat.position.set(cx, Y + 0.46, cz); room.add(seat);
      const back = new THREE.Mesh(boxGeo(0.5, 0.55, 0.08, 2, 2), woodM); back.position.set(cx + (cx < tx ? -0.22 : 0.22), Y + 0.74, cz); room.add(back);
      for (const lx of [-0.18, 0.18]) for (const lz of [-0.18, 0.18]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 32), M.darkMetal); l.position.set(cx + lx, Y + 0.23, cz + lz); room.add(l); }
    }
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.3, 32, 1, true), M.darkMetal); shade.position.set(tx, Y + 2.55, tz); room.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), warmM); bulb.position.set(tx, Y + 2.35, tz); room.add(bulb);
  }
  // barista + two customers
  const person = (px, pz, col, pose = 'stand', ry = 0, o = {}) => {
    const g = G.people.crowd([{ look: Object.assign({ topColor: col }, o), pose, x: 0, y: 0, z: 0, ry }], 'indoor-person');
    g.position.set(px, Y, pz); return g;
  };
  room.add(person(-598, Z0 + 1.7, 0x3a2a22));
  room.add(person(-600.6, Z0 + 4.0, 0x2f3a44));
  room.add(person(-594.8, Z0 + 6.4, 0x4a3a30));
  // plants
  for (const [px, pz] of [[X0 + 0.6, Z1 - 0.8], [X1 - 0.6, Z0 + 0.8]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.24, 0.5, 32), M.curb); pot.position.set(px, Y + 0.25, pz); room.add(pot);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 14), new THREE.MeshStandardMaterial({ color: 0x1d3a26, roughness: 0.9 })); leaf.position.set(px, Y + 0.95, pz); leaf.scale.set(1, 1.3, 1); room.add(leaf);
  }
  // sign outside
  const sc = makeCanvas(512, 128), sx = sc.getContext('2d');
  sx.fillStyle = '#14110e'; sx.fillRect(0, 0, 512, 128); sx.strokeStyle = '#caa66a'; sx.lineWidth = 4; sx.strokeRect(4, 4, 504, 120);
  sx.fillStyle = '#f0e2c6'; sx.textAlign = 'center'; sx.font = '700 46px "PingFang SC",sans-serif'; sx.fillText('江畔咖啡', 256, 60); sx.font = '500 20px monospace'; sx.fillStyle = '#c9b183'; sx.fillText('RIVERSIDE CAFE · OPEN', 256, 98);
  const sT = canvasTexture(sc, true, 1, 1, 4);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshStandardMaterial({ map: sT, emissiveMap: sT, emissive: 0xffffff, emissiveIntensity: 0.7, roughness: 0.5 }));
  sign.position.set(-596, Y + 3.3, Z1 + 0.05); room.add(sign);
  // one real pendant light + fixture
  const pl = new THREE.PointLight(0xffb877, 28, 12, 2); pl.position.set(-597, Y + 2.15, Z0 + 4.6); room.add(pl);
  const fixture = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), warmM); fixture.position.copy(pl.position); room.add(fixture);
  room.position.set(-20, 0, 26);
  room.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
  scene.add(room);

  C.cafe = { x0: X0 - 20, x1: X1 - 20, z0: Z0 + 26, z1: Z1 + 26, y: Y, door: [-616, Z1 + 27.2], inside: [-616, Z0 + 31.4], counter: [-618, Z0 + 27.8] };
  // outdoor terrace: three round tables, chairs and heated umbrellas
  {
    const terr = new THREE.Group(); terr.name = 'cafe-terrace';
    const tableM = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.55 });
    const chairM = new THREE.MeshStandardMaterial({ color: 0x2a2e32, roughness: 0.6, metalness: 0.2 });
    const canvasM = new THREE.MeshStandardMaterial({ color: 0x8a2f2a, roughness: 0.75, side: THREE.DoubleSide });
    const spots = [[-621.0, 108.8], [-616.4, 109.4], [-611.8, 108.9]];
    spots.forEach(([tx, tz], i) => {
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 32), tableM); top.position.set(tx, Y + 0.78, tz); terr.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.76, 32), chairM); leg.position.set(tx, Y + 0.39, tz); terr.add(leg);
      for (const [cx, cz] of [[tx - 0.62, tz], [tx + 0.62, tz]]) {
        const seat = new THREE.Mesh(boxGeo(0.4, 0.06, 0.4, 2, 2), chairM); seat.position.set(cx, Y + 0.45, cz); terr.add(seat);
        const back = new THREE.Mesh(boxGeo(0.4, 0.42, 0.05, 2, 2), chairM); back.position.set(cx, Y + 0.68, cz - 0.19); terr.add(back);
        for (const [lx, lz] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 32), chairM); l.position.set(cx + lx, Y + 0.22, cz + lz); terr.add(l); }
      }
      // heated umbrella
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 2.4, 32), chairM); pole.position.set(tx, Y + 1.2, tz); terr.add(pole);
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.5, 32, 1, true), canvasM); canopy.position.set(tx, Y + 2.55, tz); terr.add(canopy);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.9, 1.0) })); bulb.position.set(tx, Y + 2.22, tz); terr.add(bulb);
      if (i === 1) { const panelG = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.7, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a1a16, roughness: 0.7, side: THREE.DoubleSide })); panelG.position.set(tx, Y + 1.7, tz); terr.add(panelG); }
    });
    terr.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; } });
    scene.add(terr);
    C.cafeTerrace = { x: -616.4, z: 109.4, y: Y, seat: [-616.4, 110.0] };
  }

  // the room is modelled at (X0..X1, Z0..Z1) and shifted onto the wharf like C.cafe
  const add = C.add, ox = C.cafe.x0 - X0, oz = C.cafe.z0 - Z0, wall = (x0, x1, z0, z1) => add({ x0: x0 + ox, x1: x1 + ox, z0: z0 + oz, z1: z1 + oz, y0: 0, y1: 3.5, kind: 'cafe-wall' });
  wall(X0, X1, Z0, Z0 + 0.2);
  wall(X0, X0 + 0.2, Z0, Z1);
  wall(X1 - 0.2, X1, Z0, Z1);
  // glass front either side of the door at x = -596
  wall(X0, -597, Z1 - 0.1, Z1 + 0.1);
  wall(-595, X1, Z1 - 0.1, Z1 + 0.1);
})();
