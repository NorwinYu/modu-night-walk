/* 15-cruise — the Shenjiang river cruise: a pontoon pier at the waterfront
   platform, a lit tour boat, and a slow loop between the Lantan waterfront and Linjiangzui. */
(function () {
  const G = window.__G, THREE = G.THREE, M = G.M, TEX = G.TEX, scene = G.scene, C = G.CITY;
  const U = G.util;
  const { R, pick, clamp, M4, boxGeo, mergeGeoms, makeCanvas, canvasTexture } = U;

  const PIER = [-650, 124];
  const BOAT0 = [-666, 128];

  // ---------------------------------------------------------------- pier
  {
    const stone = M.concrete.clone(); stone.color = new THREE.Color(0x7f7b72); stone.userData.surfaceProcedural = true;
    const deck = new THREE.Mesh(boxGeo(16, 0.5, 9, 4, 4), stone);
    deck.position.set(PIER[0], 0.35, PIER[1]); deck.name = 'cruise-pier'; deck.userData.passable = true; deck.userData.surfaceProcedural = true; scene.add(deck);
    for (const px of [-657, -643]) for (const pz of [120, 128]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 1.8, 32), M.darkMetal);
      pile.position.set(px, -0.4, pz); pile.userData.passable = true; pile.userData.surfaceProcedural = true; scene.add(pile);
    }
    // gangway from the platform edge
    const ramp = new THREE.Mesh(boxGeo(9, 0.18, 2.6, 3, 2), M.metal);
    ramp.position.set(-631, 0.5, 116.5); ramp.rotation.y = -0.5; ramp.rotation.z = 0.03;
    ramp.userData.passable = true; ramp.userData.surfaceProcedural = true; scene.add(ramp);
    // sign
    const c = makeCanvas(512, 160), ctx = c.getContext('2d');
    ctx.fillStyle = '#0a1d2a'; ctx.fillRect(0, 0, 512, 160); ctx.strokeStyle = '#cfe2e8'; ctx.lineWidth = 4; ctx.strokeRect(4, 4, 504, 152);
    ctx.fillStyle = '#f2f8fa'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 46px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'; ctx.fillText('申江邮船', 256, 54);
    ctx.font = '500 20px "SF Mono",monospace'; ctx.fillStyle = '#8fc4d8'; ctx.fillText('SHENJIANG RIVER CRUISE  ·  NIGHT LOOP', 256, 108);
    const st = canvasTexture(c, true, 1, 1, 4);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.44), new THREE.MeshStandardMaterial({ map: st, emissiveMap: st, emissive: 0xffffff, emissiveIntensity: 1.0, roughness: 0.5 }));
    sign.position.set(-649, 3.0, 118.4); sign.rotation.y = Math.PI; sign.userData.passable = true; sign.userData.surfaceProcedural = true; scene.add(sign);
    for (const sx of [-1.8, 1.8]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3.0, 32), M.metal);
      p.position.set(-649 + sx, 1.5, 118.4); p.userData.passable = true; p.userData.surfaceProcedural = true; scene.add(p);
    }
    // ticket booth + queue
    const booth = new THREE.Mesh(boxGeo(2.4, 2.4, 2.0, 3, 3), new THREE.MeshStandardMaterial({ color: 0x12242e, roughness: 0.4, metalness: 0.3, emissive: 0xffc46a, emissiveIntensity: 0.35 }));
    booth.position.set(-640, 1.6, 122); booth.userData.passable = true; booth.userData.surfaceProcedural = true; scene.add(booth);
    const lamps = [];
    for (const [lx, lz] of [[-658, 120], [-658, 128], [-642, 129]]) {
      lamps.push({ geometry: new THREE.SphereGeometry(0.14, 16, 12), matrix: M4(lx, 2.7, lz) });
      lamps.push({ geometry: new THREE.CylinderGeometry(0.045, 0.055, 2.6, 32), matrix: M4(lx, 1.3, lz) });
    }
    const cm = new THREE.Mesh(mergeGeoms(lamps), new THREE.MeshStandardMaterial({ color: 0x3a3f44, roughness: 0.5, metalness: 0.6 })); cm.userData.passable = true; cm.userData.surfaceProcedural = true; scene.add(cm);
    const bulbs = new THREE.Mesh(mergeGeoms(lamps.filter((_, i) => i % 2 === 0).map((l) => ({ geometry: l.geometry, matrix: l.matrix }))), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.0, 0.9) }));
    bulbs.userData.passable = true; bulbs.userData.surfaceProcedural = true; scene.add(bulbs);
    C.cruisePier = { x0: -660, x1: -636, z0: 114, z1: 132, y: 0.61 };
    const add = C.add;
    add({ x0: -660, x1: -636, z0: 114, z1: 115, y0: 0, y1: 1.1, kind: 'cruise-pier-rail' });
    add({ x0: -660, x1: -636, z0: 131, z1: 132, y0: 0, y1: 1.1, kind: 'cruise-pier-rail' });
  }

  // ---------------------------------------------------------------- boat
  const boat = new THREE.Group(); boat.name = 'shenjiang-cruise-boat';
  {
    const hullM = new THREE.MeshStandardMaterial({ color: 0x16242c, roughness: 0.42, metalness: 0.4 });
    const cabinM = new THREE.MeshStandardMaterial({ color: 0xc8d2d0, roughness: 0.4, metalness: 0.15 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x142833, roughness: 0.12, metalness: 0.55, emissive: 0xffb45a, emissiveIntensity: 0.5 });
    const seatM = new THREE.MeshStandardMaterial({ color: 0x2a3a42, roughness: 0.6 });
    const goldM = new THREE.MeshStandardMaterial({ color: 0xc8a45a, roughness: 0.4, metalness: 0.7 });
    const hull = new THREE.Mesh(boxGeo(19, 2.2, 6.6, 5, 4), hullM); hull.position.y = 1.0; boat.add(hull);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(3.3, 4.2, 32), hullM); bow.rotation.x = Math.PI / 2; bow.rotation.y = Math.PI / 4; bow.scale.set(1, 1, 1.0); bow.position.set(0, 1.0, 11.2); boat.add(bow);
    const cabin = new THREE.Mesh(boxGeo(12.5, 2.3, 5.2, 4, 3), cabinM); cabin.position.set(-0.8, 2.7, -0.2); boat.add(cabin);
    const win = new THREE.Mesh(boxGeo(11.8, 0.62, 5.3, 4, 1), glassM); win.position.set(-0.8, 2.75, -0.2); boat.add(win);
    const top = new THREE.Mesh(boxGeo(12.8, 0.28, 5.5, 4, 4), M.darkMetal); top.position.set(-0.8, 3.95, -0.2); boat.add(top);
    // upper deck, rails, seats, bar
    const deck = new THREE.Mesh(boxGeo(12.8, 0.16, 5.5, 4, 4), M.wood); deck.position.set(-0.8, 4.1, -0.2); boat.add(deck);
    const railP = [], railR = [];
    for (const sz of [-2.72, 2.72]) {
      railR.push({ geometry: boxGeo(12.4, 0.05, 0.05, 4, 1), matrix: M4(-0.8, 5.25, -0.2 + sz) });
      for (let i = 0; i < 8; i++) railP.push({ geometry: new THREE.CylinderGeometry(0.03, 0.03, 1.1, 32), matrix: M4(-6.6 + i * 1.7, 4.7, -0.2 + sz) });
    }
    railR.push({ geometry: boxGeo(0.05, 0.05, 5.4, 1, 1), matrix: M4(5.6, 5.25, -0.2) });
    const rr = new THREE.Mesh(mergeGeoms(railR), goldM); rr.userData.passable = true; rr.userData.surfaceProcedural = true; boat.add(rr);
    const rp = new THREE.Mesh(mergeGeoms(railP), goldM); rp.userData.passable = true; rp.userData.surfaceProcedural = true; boat.add(rp);
    for (let i = 0; i < 4; i++) {
      const seat = new THREE.Mesh(boxGeo(1.5, 0.45, 0.5, 2, 2), seatM); seat.position.set(-4.8 + i * 2.1, 4.42, 1.4); boat.add(seat);
      const back = new THREE.Mesh(boxGeo(1.5, 0.55, 0.12, 2, 2), seatM); back.position.set(-4.8 + i * 2.1, 4.7, 1.7); boat.add(back);
    }
    const bar = new THREE.Mesh(boxGeo(3.2, 1.0, 0.6, 2, 2), goldM); bar.position.set(-3.2, 4.7, -2.1); boat.add(bar);
    const canopy = new THREE.Mesh(boxGeo(6.0, 0.1, 4.4, 3, 3), new THREE.MeshStandardMaterial({ color: 0x1a2a33, roughness: 0.6 })); canopy.position.set(-3.0, 6.1, -0.2); boat.add(canopy);
    for (const sx of [-5.8, -0.2]) for (const sz of [-2.1, 1.7]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 32), goldM); p.position.set(sx, 5.1, sz); boat.add(p); }
    // wheelhouse
    const wh = new THREE.Mesh(boxGeo(2.6, 1.9, 2.4, 3, 3), cabinM); wh.position.set(5.2, 4.9, 0); boat.add(wh);
    const whw = new THREE.Mesh(boxGeo(2.4, 0.5, 2.45, 3, 1), glassM); whw.position.set(5.2, 5.15, 0); boat.add(whw);
    // nav lights + string bulbs
    const navR = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.2, 0.15) })); navR.position.set(-7.2, 4.3, 2.2); boat.add(navR);
    const navG = navR.clone(); navG.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 4, 1.2) }); navG.position.set(-7.2, 4.3, -2.6); boat.add(navG);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 3.6, 32), goldM); mast.position.set(5.2, 7.2, 0); boat.add(mast);
    const topLight = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 2.2) })); topLight.position.set(5.2, 9.0, 0); boat.add(topLight);
    const strings = [];
    for (let i = 0; i < 14; i++) strings.push({ geometry: new THREE.SphereGeometry(0.06, 12, 8), matrix: M4(-8 + i * 0.85, 5.8 + Math.sin(i * 0.7) * 0.1, 2.5) });
    const sm = new THREE.Mesh(mergeGeoms(strings), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.4, 1.0) })); sm.userData.passable = true; sm.userData.surfaceProcedural = true; boat.add(sm);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.0), new THREE.MeshStandardMaterial({ color: 0xb22222, roughness: 0.7, side: THREE.DoubleSide })); flag.position.set(5.2, 7.6, 0.9); boat.add(flag);
    // enterable saloon inside the hull: windows look straight out on the river
    {
      const woodM = M.wood;
      const innerM = new THREE.MeshStandardMaterial({ color: 0x1d262c, roughness: 0.7, metalness: 0.1 });
      const salFloor = new THREE.Mesh(boxGeo(17.2, 0.1, 5.7, 4, 4), woodM); salFloor.position.set(0, 0.2, 0); boat.add(salFloor);
      const salCeil = new THREE.Mesh(boxGeo(17.2, 0.08, 5.7, 4, 4), innerM); salCeil.position.set(0, 1.9, 0); boat.add(salCeil);
      const salGlass = new THREE.MeshStandardMaterial({ color: 0x8fb4c8, roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false });
      for (const sz of [-1, 1]) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(16.4, 0.72), salGlass);
        win.position.set(0, 1.45, sz * 2.86); win.rotation.y = sz > 0 ? Math.PI : 0; boat.add(win);
        const rail = new THREE.Mesh(boxGeo(16.6, 0.05, 0.06, 2, 1), goldM); rail.position.set(0, 1.06, sz * 2.86); boat.add(rail);
        for (let i = 0; i < 7; i++) {
          const mull = new THREE.Mesh(boxGeo(0.06, 0.78, 0.06, 2, 1), goldM);
          mull.position.set(-7.5 + i * 2.5, 1.45, sz * 2.86); boat.add(mull);
        }
      }
      for (const sx of [-8.6, 8.6]) {
        const bulk = new THREE.Mesh(boxGeo(0.1, 1.8, 5.7, 2, 2), innerM); bulk.position.set(sx, 1.0, 0); boat.add(bulk);
      }
      const bar = new THREE.Mesh(boxGeo(4.6, 0.95, 0.65, 3, 2), goldM); bar.position.set(-5.0, 0.72, -2.3); boat.add(bar);
      const barTop = new THREE.Mesh(boxGeo(4.8, 0.06, 0.75, 3, 1), woodM); barTop.position.set(-5.0, 1.22, -2.3); boat.add(barTop);
      for (let i = 0; i < 3; i++) {
        const tx = -1.6 + i * 3.2;
        const table = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 32), woodM); table.position.set(tx, 0.9, 0.2); boat.add(table);
        const tl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 32), M.darkMetal); tl.position.set(tx, 0.55, 0.2); boat.add(tl);
        for (const dz of [-0.95, 0.95]) {
          const seat = new THREE.Mesh(boxGeo(0.55, 0.6, 0.12, 2, 2), seatM); seat.position.set(tx, 0.55, 0.2 + dz); boat.add(seat);
        }
      }
      for (let i = 0; i < 4; i++) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.4, 2.3, 1.2) }));
        lamp.position.set(-6 + i * 4, 1.78, 0); boat.add(lamp);
      }
    }
    boat.traverse((o) => { if (o.isMesh) { o.userData.passable = true; o.userData.surfaceProcedural = true; o.userData.identity = [{ name: 'cruise-boat', extents: [5, 3, 10] }]; o.userData.parts = ['cruise-boat']; } });
    boat.position.set(BOAT0[0], 0, BOAT0[1]);
    boat.rotation.y = Math.PI;
    scene.add(boat);
  }

  // the loop between the Lantan waterfront and Linjiangzui
  const pts = [
    [-666, 128], [-700, 80], [-750, -20], [-810, -180], [-880, -360], [-950, -540], [-1010, -700], [-1060, -820],
    [-1000, -880], [-920, -760], [-850, -580], [-790, -400], [-740, -220], [-700, -80], [-676, 40], [-666, 128],
  ].map(([x, z]) => new THREE.Vector3(x, 0, z));
  const route = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.25);

  C.cruise = { pier: PIER, boat0: BOAT0, boat, route, length: route.getLength(), active: false, t: 0 };
  C.saloon = { doorLocal: [-6.4, 4.25, 0], x0: -7.6, x1: 7.6, z0: -2.3, z1: 2.3, eye: 1.5 };

  // a few waiting passengers on the pier
  {
    const poses = ['stand', 'phone', 'talk', 'photo'];
    const list = [];
    for (let i = 0; i < 4; i++) {
      const px = -653 + (i % 2) * 2.4, pz = 120 + Math.floor(i / 2) * 2.6;
      list.push({ look: { hold: poses[i] === 'phone' ? 'phone' : null, acc: poses[i] === 'photo' ? ['camera'] : undefined }, pose: poses[i], x: px, y: 0.61, z: pz, ry: Math.atan2(-666 - px, 128 - pz) + (i - 1.5) * 0.25 });
    }
    scene.add(G.people.crowd(list, 'cruise-queue-people'));
  }
})();
