/* 14b-bar — 夜航小馆, a small riverside bar between the cafe and the platform.
   Enterable first-person room: bar counter, stools, bottle wall, neon, river window. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, scene = G.scene, C = G.CITY;
  const U = G.util;
  const { M4, boxGeo, mergeGeoms, pick, makeCanvas, canvasTexture } = U;
  const X0 = -632, X1 = -622, Z0 = 84, Z1 = 94, Y = 0.67;
  const bar = new THREE.Group(); bar.name = 'night-shift-bar';

  const wallM = new THREE.MeshStandardMaterial({ color: 0x2a2420, roughness: 0.75 });
  const floorM = new THREE.MeshStandardMaterial({ color: 0x4a3a2c, roughness: 0.55 });
  const woodM = new THREE.MeshStandardMaterial({ color: 0x6a4a30, roughness: 0.5 });
  const darkM = new THREE.MeshStandardMaterial({ color: 0x1a1c20, roughness: 0.45, metalness: 0.3 });
  const glassM = new THREE.MeshStandardMaterial({ color: 0x9fc4d2, roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.12 });
  const warmM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 1.9, 1.0) });

  const floor = new THREE.Mesh(boxGeo(X1 - X0, 0.16, Z1 - Z0, 3, 3), floorM); floor.position.set(-627, Y - 0.08, 89); bar.add(floor);
  const ceil = new THREE.Mesh(boxGeo(X1 - X0, 0.12, Z1 - Z0, 3, 3), wallM); ceil.position.set(-627, Y + 3.5, 89); bar.add(ceil);
  const wN = new THREE.Mesh(boxGeo(X1 - X0, 3.5, 0.2, 3, 3), wallM); wN.position.set(-627, Y + 1.75, Z0); bar.add(wN);
  const wS = new THREE.Mesh(boxGeo(X1 - X0, 3.5, 0.2, 3, 3), wallM); wS.position.set(-627, Y + 1.75, Z1); bar.add(wS);
  const wW = new THREE.Mesh(new THREE.PlaneGeometry(Z1 - Z0 - 1.6, 2.6), glassM); wW.position.set(X0 + 0.02, Y + 1.55, 89); wW.rotation.y = Math.PI / 2; bar.add(wW);
  const wWf = new THREE.Mesh(boxGeo(0.16, 3.5, Z1 - Z0, 3, 3), wallM); wWf.position.set(X0, Y + 1.75, 89); bar.add(wWf);
  for (const sz of [-2.8, 2.8]) { const sw = new THREE.Mesh(boxGeo(0.2, 3.5, 1.5, 3, 3), wallM); sw.position.set(X1, Y + 1.75, 89 + sz); bar.add(sw); }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 2.7), glassM); door.position.set(X1 - 0.02, Y + 1.35, 89); door.rotation.y = Math.PI / 2; bar.add(door);

  // L counter + stools
  const counter = new THREE.Mesh(boxGeo(5.6, 1.05, 0.8, 3, 2), woodM); counter.position.set(-627.6, Y + 0.52, 87.3); bar.add(counter);
  const cTop = new THREE.Mesh(boxGeo(5.8, 0.07, 0.95, 3, 1), new THREE.MeshStandardMaterial({ color: 0x2a241e, roughness: 0.35 })); cTop.position.set(-627.6, Y + 1.08, 87.3); bar.add(cTop);
  for (let i = 0; i < 5; i++) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.55, 32), darkM); st.position.set(-629.6 + i * 1.0, Y + 0.28, 88.3); bar.add(st);
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 32), woodM); seat.position.set(-629.6 + i * 1.0, Y + 0.58, 88.3); bar.add(seat);
  }
  // back bar: shelves + bottles + glasses + a tap
  const shelves = [];
  for (const sy of [Y + 1.5, Y + 2.0, Y + 2.5]) shelves.push({ geometry: boxGeo(5.2, 0.05, 0.4, 3, 1), matrix: M4(-627.6, sy, Z0 + 0.35) });
  bar.add(new THREE.Mesh(mergeGeoms(shelves), woodM));
  const bottleCols = [0x6a8a3a, 0x8a3a2a, 0xc8a24a, 0x3a5a8a, 0x8a5a2a, 0xd8d0b8];
  const bottles = [];
  for (let i = 0; i < 18; i++) for (const sy of [Y + 1.5, Y + 2.0, Y + 2.5]) {
    bottles.push({ geometry: new THREE.CylinderGeometry(0.045, 0.05, 0.3, 32), matrix: M4(-630.0 + i * 0.29, sy + 0.18, Z0 + 0.35), color: new THREE.Color(pick(bottleCols)) });
  }
  const bm = new THREE.Mesh(mergeGeoms(bottles, { vertexColors: true }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.2 })); bm.castShadow = false; bar.add(bm);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 32), M.metal); tap.position.set(-626.0, Y + 1.35, Z0 + 0.75); bar.add(tap);
  const tapH = new THREE.Mesh(boxGeo(0.3, 0.08, 0.08, 2, 1), M.metal); tapH.position.set(-626.0, Y + 1.62, Z0 + 0.85); bar.add(tapH);
  // two small tables + chairs along the window
  for (const [tx, tz] of [[-629.4, 91.8], [-625.6, 92.4]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 32), woodM); t.position.set(tx, Y + 0.85, tz); bar.add(t);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.82, 32), darkM); leg.position.set(tx, Y + 0.43, tz); bar.add(leg);
    for (const [cx2, cz2] of [[tx - 0.62, tz], [tx + 0.62, tz]]) {
      const seat = new THREE.Mesh(boxGeo(0.42, 0.06, 0.42, 2, 2), woodM); seat.position.set(cx2, Y + 0.48, cz2); bar.add(seat);
      const back = new THREE.Mesh(boxGeo(0.42, 0.45, 0.06, 2, 2), woodM); back.position.set(cx2, Y + 0.72, cz2 + 0.2); bar.add(back);
    }
  }
  // neon + pendant lights + glasses on the counter
  const nc = makeCanvas(512, 128), nctx = nc.getContext('2d');
  nctx.fillStyle = '#0b0d12'; nctx.fillRect(0, 0, 512, 128); nctx.strokeStyle = '#ffb45a'; nctx.lineWidth = 4; nctx.strokeRect(4, 4, 504, 120);
  nctx.fillStyle = '#ffe8c8'; nctx.textAlign = 'center'; nctx.font = '700 52px "PingFang SC",sans-serif'; nctx.fillText('夜航小馆', 256, 60);
  nctx.fillStyle = '#ffb45a'; nctx.font = '500 18px monospace'; nctx.fillText('NIGHT SHIFT BAR · OPEN LATE', 256, 100);
  const ntex = canvasTexture(nc, true, 1, 1, 4);
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), new THREE.MeshBasicMaterial({ map: ntex, color: new THREE.Color(1.6, 1.2, 1.0) }));
  neon.position.set(-627.6, Y + 2.95, Z0 + 0.13); bar.add(neon);
  for (let i = 0; i < 3; i++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 32, 16), warmM); lamp.position.set(-629.4 + i * 1.8, Y + 2.7, 88.9); bar.add(lamp);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 32), darkM); cord.position.set(-629.4 + i * 1.8, Y + 3.1, 88.9); bar.add(cord);
  }
  for (let i = 0; i < 6; i++) {
    const g2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.14, 32), new THREE.MeshStandardMaterial({ color: 0xd8d0c0, roughness: 0.3, metalness: 0.1 }));
    g2.position.set(-629.8 + i * 0.75, Y + 1.18, 87.3); bar.add(g2);
  }
  bar.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = true; } });
  scene.add(bar);

  C.bar = { x0: X0, x1: X1, z0: Z0, z1: Z1, y: Y, door: [X1, 89], inside: [-627.5, 89.0] };
  const add = C.add;
  add({ x0: X0, x1: X1, z0: Z0 - 0.2, z1: Z0, y0: 0, y1: Y + 3.5, kind: 'bar-wall' });
  add({ x0: X0, x1: X1, z0: Z1, z1: Z1 + 0.2, y0: 0, y1: Y + 3.5, kind: 'bar-wall' });
  add({ x0: X0 - 0.2, x1: X0, z0: Z0, z1: Z1, y0: 0, y1: Y + 3.5, kind: 'bar-wall' });
  add({ x0: X1, x1: X1 + 0.2, z0: Z0, z1: Z1, y0: 0, y1: Y + 3.5, kind: 'bar-wall' });
  C.carve(X1 - 0.05, X1 + 0.25, 88.05, 89.95, /^bar-wall$/);   // the glass door
})();
