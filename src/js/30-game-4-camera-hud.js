  // ------------------------------------------------------------- camera
  // One rule everywhere: pitch is honoured (the old interior cams ignored it).
  function eyeCam(floorY, eyeH, fov, dt, pitchRange) {
    const cy = S.camera.yaw;
    const cp = clamp(S.camera.pitch, pitchRange ? pitchRange[0] : -1.2, pitchRange ? pitchRange[1] : 1.2);
    const y = floorY + eyeH;
    camera.position.set(S.player.x, y, S.player.z);
    camera.lookAt(
      S.player.x + Math.sin(cy) * Math.cos(cp) * 8,
      y + Math.sin(cp) * 8,
      S.player.z + Math.cos(cy) * Math.cos(cp) * 8);
    camera.fov = damp(camera.fov, fov, 8, dt);
    camera.updateProjectionMatrix();
  }
  function updateCamera(dt) {
    if (S.mode === 'cruise') {
      const c = S.cruise;
      if (S.saloonInside) {
        const eye = new THREE.Vector3(S.saloon.x, C.saloon.eye, S.saloon.z);
        const cp = clamp(S.camera.pitch, -0.9, 0.9);
        const tgt = new THREE.Vector3(
          S.saloon.x + Math.sin(S.camera.orbit) * Math.cos(cp) * 4,
          C.saloon.eye + Math.sin(cp) * 3.0,
          S.saloon.z + Math.cos(S.camera.orbit) * Math.cos(cp) * 4);
        C.cruise.boat.updateMatrixWorld();
        C.cruise.boat.localToWorld(eye); C.cruise.boat.localToWorld(tgt);
        camera.position.copy(eye); camera.lookAt(tgt);
        camera.fov = damp(camera.fov, 72, 6, dt); camera.updateProjectionMatrix();
        return;
      }
      const cy = c.yaw + S.camera.orbit;
      const cp = clamp(S.camera.pitch, -0.05, 0.5);
      const dist = 3.6;
      camera.position.x = damp(camera.position.x, S.player.x - Math.sin(cy) * dist, 6, dt);
      camera.position.y = damp(camera.position.y, 4.4 + 1.55 + dist * Math.sin(cp), 6, dt);
      camera.position.z = damp(camera.position.z, S.player.z - Math.cos(cy) * dist, 6, dt);
      camera.lookAt(S.player.x + Math.sin(cy) * 6, 4.9, S.player.z + Math.cos(cy) * 6);
      camera.fov = damp(camera.fov, 68, 5, dt); camera.updateProjectionMatrix();
      return;
    }
    if (S.mode === 'drone') {
      const d = S.drone;
      const cy = S.camera.yaw, cp = clamp(S.camera.pitch, -0.35, 1.05);
      if (d.view === 'chase') {
        camera.position.set(d.x - Math.sin(cy) * 4.2, d.y + 1.8, d.z - Math.cos(cy) * 4.2);
        camera.lookAt(d.x, d.y + 0.2, d.z);
        camera.fov = damp(camera.fov, 62, 6, dt);
      } else {
        const fx = Math.sin(cy), fz = Math.cos(cy);
        camera.position.set(d.x + fx * 0.34, d.y + 0.04, d.z + fz * 0.34);
        camera.lookAt(d.x + fx * 10, d.y + 0.04 - Math.sin(cp) * 10, d.z + fz * 10);
        camera.fov = damp(camera.fov, 74, 6, dt);
      }
      camera.updateProjectionMatrix();
      return;
    }
    if (S.view === 'telescope') {
      const cx = C.telescope.eye[0], cz = C.telescope.eye[2], cy2 = C.telescope.eye[1];
      camera.position.x = damp(camera.position.x, cx, 12, dt);
      camera.position.y = damp(camera.position.y, cy2, 12, dt);
      camera.position.z = damp(camera.position.z, cz, 12, dt);
      const cy = S.camera.yaw, cp = clamp(S.camera.pitch, -0.3, 0.6);
      camera.lookAt(cx + Math.sin(cy) * Math.cos(cp) * 50, cy2 + Math.sin(cp) * 50, cz + Math.cos(cy) * Math.cos(cp) * 50);
      camera.fov = damp(camera.fov, 17, 8, dt);
      camera.updateProjectionMatrix();
      return;
    }
    if (S.view === 'l2scope') {
      const s2 = C.l2scope || [174.5, 222.6];
      camera.position.set(s2[0], C.l2.y + 1.42, s2[1]);
      const cy = S.camera.yaw, cp = clamp(S.camera.pitch, -0.4, 0.4);
      camera.lookAt(s2[0] + Math.sin(cy) * Math.cos(cp) * 60, C.l2.y + 1.42 + Math.sin(cp) * 60, s2[1] + Math.cos(cy) * Math.cos(cp) * 60);
      camera.fov = damp(camera.fov, 20, 8, dt);
      camera.updateProjectionMatrix();
      return;
    }
    if (S.view === 'sit') {
      const cy = S.camera.yaw, cp = clamp(S.camera.pitch, -0.5, 0.8);
      camera.position.x = damp(camera.position.x, S.player.x + Math.sin(cy) * 0.4, 8, dt);
      camera.position.y = damp(camera.position.y, C.platform.y + 1.15, 8, dt);
      camera.position.z = damp(camera.position.z, S.player.z + Math.cos(cy) * 0.4, 8, dt);
      camera.lookAt(S.player.x + Math.sin(cy) * Math.cos(cp) * 20, C.platform.y + 1.15 + Math.sin(cp) * 20, S.player.z + Math.cos(cy) * Math.cos(cp) * 20);
      camera.fov = damp(camera.fov, 62, 6, dt);
      camera.updateProjectionMatrix();
      return;
    }
    if (S.view === 'terrace') {
      const cy = S.camera.yaw, cp = clamp(S.camera.pitch, -0.5, 0.8);
      camera.position.set(S.player.x, C.cafeTerrace.y + 1.2, S.player.z + 0.35);
      camera.lookAt(S.player.x + Math.sin(cy) * Math.cos(cp) * 6, C.cafeTerrace.y + 1.2 + Math.sin(cp) * 6, S.player.z + Math.cos(cy) * Math.cos(cp) * 6);
      camera.fov = damp(camera.fov, 70, 8, dt); camera.updateProjectionMatrix();
      return;
    }
    // interiors are first-person with free pitch (up included: you can look at towers)
    if (S.place) {
      const r = ROOMS[S.place];
      const c = r && C[r.c];
      if (c) { eyeCam(c.y, 1.6, S.place === 'l2' || S.place === 'l3' ? 76 : 74, dt, [-1.2, 1.2]); return; }
    }
    if (S.aim.active && S.mode === 'foot') {
      const cy = S.camera.yaw;
      const cp = clamp(S.camera.pitch, -0.5, 1.25);
      const y = S.player.y + 1.58;
      camera.position.set(S.player.x, y, S.player.z);
      camera.lookAt(S.player.x + Math.sin(cy) * Math.cos(cp) * 10, y + Math.sin(cp) * 10, S.player.z + Math.cos(cy) * Math.cos(cp) * 10);
      camera.updateProjectionMatrix();   // fov handled by updateAim
      return;
    }
    if (S.firstPerson && S.mode === 'foot') {
      eyeCam(S.player.y, 1.62, 72, dt, [-0.6, 1.3]);
      return;
    }
    // third-person: chase the car / taxi, or orbit the walker
    let px, pz, py, yaw, dist, pitch;
    if (S.mode === 'car') {
      px = S.car.x; pz = S.car.z; py = 1.1 + (S.car.tun ? S.car.tunY : 0); yaw = S.car.yaw;
      dist = (S.camera.dist || 6.2) + Math.min(2.2, Math.abs(S.car.speed) * 0.045);
      pitch = 0.19 + Math.min(0.08, Math.abs(S.car.speed) * 0.0015);
    } else if (S.mode === 'taxi') {
      px = S.taxi.x; pz = S.taxi.z; py = 1.15; yaw = S.taxi.yaw;
      dist = S.camera.dist || 6.4; pitch = 0.2;
    } else {
      px = S.player.x; pz = S.player.z; py = 1.35 + (S.player.tun ? S.player.y - 0.04 : Math.max(0, S.player.y - 0.17));
      yaw = S.camera.yaw; dist = S.camera.dist || 3.9; pitch = S.camera.pitch;
    }
    if (S.mode !== 'foot' && !mouseLooking()) S.camera.orbit = damp(S.camera.orbit, 0, 1.4, dt);
    const cp2 = Math.cos(pitch), sp2 = Math.sin(pitch);
    if (S.mode !== 'foot') S.camera.followYaw = damp(S.camera.followYaw === undefined ? yaw : S.camera.followYaw, yaw, 5.5, dt);
    const camYaw = S.mode === 'foot' ? yaw : (S.camera.followYaw + S.camera.orbit);
    if (S.mode !== 'foot') S.camera.yaw = camYaw;
    let cx = px - Math.sin(camYaw) * dist * cp2;
    let cz = pz - Math.cos(camYaw) * dist * cp2;
    let cyy = py + dist * sp2 + 0.5;
    const target = new THREE.Vector3(px, py + 0.4, pz);
    const tunO = S.mode === 'car' ? S.car : S.mode === 'foot' ? S.player : null;
    C.deepMover = !!(tunO && tunO.tun);
    const [okx, okz] = moveCircle(cx, cz, 0, 0, 0.32);
    if (Math.hypot(okx - cx, okz - cz) > 0.01) {
      for (let k = 0; k < 8; k++) {
        const f = 1 - k / 8;
        const sx = lerp(px, cx, f), sz = lerp(pz, cz, f);
        const [ax, az] = moveCircle(sx, sz, 0, 0, 0.3);
        if (Math.hypot(ax - sx, az - sz) < 0.01) { cx = sx; cz = sz; break; }
      }
    }
    C.deepMover = false;
    // in a trench or a bore the camera stays between the walls and under the soffit
    if (tunO && tunO.tun) {
      const T = C.tunnels, R = tunO.tun, p = T.project(R, cx, cz);
      if (p && p.s < R.L) {
        const lim = T.WI - 0.35, s = Math.max(p.s, -T.BORE + 1), q = C.tunnelPlace(R, s, clamp(p.lat, -lim, lim));
        cx = q.x; cz = q.z;
        cyy = Math.max(cyy, T.hAt(R, s) + 0.6);
        if (tunO.tunS < 2 || s < 0.5) cyy = Math.min(cyy, -T.D + T.H - 0.35);
      }
    }
    // on the ferry the camera stays aboard: inside the bulwarks, clear of the side
    // saloons, and under the upper deck while it is over the car deck
    if (S.ferry.on) {
      const F = S.ferry, R = C.ferryRide, c = Math.cos(F.yaw), s = Math.sin(F.yaw);
      const dx = cx - F.x, dz = cz - F.z;
      let lx = c * dx - s * dz, lz = s * dx + c * dz;
      lz = clamp(lz, -14.3, F.phase === 'docked' ? 17.5 : 14.3);
      const covered = Math.abs(lz) < 11.3;
      lx = clamp(lx, covered ? -2.5 : -4.5, covered ? 2.5 : 4.5);
      if (covered) cyy = Math.min(cyy, R.deckY + F.bob + 2.05);
      cx = F.x + c * lx + s * lz; cz = F.z - s * lx + c * lz;
    }
    if (S.camera.shake > 0.002) {
      const sh = S.camera.shake;
      cx += (Math.random() - 0.5) * sh; cyy += (Math.random() - 0.5) * sh * 0.5; cz += (Math.random() - 0.5) * sh;
      S.camera.shake = damp(S.camera.shake, 0, 5, dt);
    }
    if (S.mode === 'foot') {
      camera.position.x = damp(camera.position.x, cx, 14, dt);
      camera.position.y = damp(camera.position.y, cyy, 14, dt);
      camera.position.z = damp(camera.position.z, cz, 14, dt);
    } else camera.position.set(cx, cyy, cz);
    camera.lookAt(target.x, target.y, target.z);
    const speedFov = S.mode === 'car' ? Math.min(9, Math.abs(S.car.speed) * 0.16) : 0;
    camera.fov = clamp(damp(camera.fov, baseFov() + speedFov, 4, dt), 35, 100);
    camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------- entrance markers
  // Doors are small at street scale and dark at night: a door within reach of the
  // walker gets a floating label (name + distance) and a warm pool of light on the
  // ground, so the way in reads from across a plaza.
  const OUT_DOORS = [['ferryHall', '候船厅'], ['bar', '夜航小馆'], ['lobby', '魔都中心大堂'], ['mall', '环港广场'], ['cafe', '江畔咖啡'], ['puxiHome', '永安里 28 号 · 家']];
  const doorY = (c) => c.doorY !== undefined ? c.doorY : (c.y || 0.17);
  const MALL_DOORS = [['coffeeshop', '夜航咖啡'], ['flower', '花店'], ['umbrella', '雨具店'], ['postcard', '明信片铺'], ['records', '唱片行'], ['bakery', '面包房'], ['bookshop', '环港书局']];
  const doorLayer = document.createElement('div'); doorLayer.id = 'door-marks'; document.body.appendChild(doorLayer);
  const doorEls = [];
  {
    const list = [];
    for (const [k] of OUT_DOORS) {
      const c = C[k]; if (!c) continue;
      const g = new THREE.PlaneGeometry(5.5, 5.5); g.rotateX(-Math.PI / 2); g.translate(c.door[0], doorY(c) + 0.06, c.door[1]);
      list.push(g);
    }
    if (list.length) {
      const m = new THREE.Mesh(U.mergeGeoms(list.map((geometry) => ({ geometry, matrix: new THREE.Matrix4() }))), new THREE.MeshBasicMaterial({ map: G.TEX.lightPool, color: new THREE.Color(1.9, 1.3, 0.75), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.name = 'entrance-light-pools'; m.userData.passable = true; m.renderOrder = 2; scene.add(m);
      if (G.noReflect) G.noReflect.push(m);
    }
  }
  const _dv = new THREE.Vector3();
  function updateDoorMarks() {
    const show = S.phase === 'playing' && S.mode === 'foot' && !S.ph.open && !S.aim.active && !S.view && !S.ferry.on;
    let n = 0;
    if (show) {
      const P = S.place, list = [];
      if (!P || !inRoom()) for (const [k, name] of OUT_DOORS) { const c = C[k]; if (c) list.push([c.door[0], c.door[1], doorY(c) + 2.7, '入口 · ' + name]); }
      else if (P === 'mall') {
        for (const [k, name] of MALL_DOORS) { const c = C[k]; if (c) list.push([c.door[0], c.door[1], (c.y || 0.17) + 2.5, name]); }
        if (C.mall) list.push([C.mall.door[0], C.mall.door[1], C.mall.y + 2.6, '出口']);
      } else {
        const r = ROOMS[P], c = r && C[r.c];
        if (c && c.door && P !== 'l2' && P !== 'l3') { const d = P === 'lobby' || P === 'home' ? c.inner : c.door; list.push([d[0], d[1], (c.y || 0.17) + 2.4, P === 'home' ? '下楼' : '出口']); }
      }
      const W = innerWidth, H = innerHeight;
      for (const [x, z, y, label] of list) {
        const d = Math.hypot(x - S.player.x, z - S.player.z);
        if (d < 2.6 || d > (inRoom() ? 30 : 55)) continue;
        _dv.set(x, y, z).project(camera);
        if (_dv.z > 1 || Math.abs(_dv.x) > 1.05 || Math.abs(_dv.y) > 1.05) continue;
        if (!inRoom() && d > 8 && sightBlocked(camera.position.x, camera.position.y, camera.position.z, x, y, z, x, z, 4)) continue;
        let e = doorEls[n];
        if (!e) { e = document.createElement('div'); e.className = 'door-mark'; e.innerHTML = '<span></span><i></i>'; doorLayer.appendChild(e); doorEls.push(e); }
        const t = label + ' · ' + Math.round(d) + 'm';
        if (e._t !== t) { e._t = t; e.firstChild.textContent = t; }
        e.style.transform = `translate(${((_dv.x + 1) / 2 * W).toFixed(1)}px, ${((1 - _dv.y) / 2 * H).toFixed(1)}px) translate(-50%, -100%)`;
        e.style.opacity = String(Math.min(1, (d - 2.6) / 2.5) * (d > 40 ? Math.max(0.35, 1 - (d - 40) / 20) : 1));
        e.style.display = '';
        n++;
      }
    }
    for (let i = n; i < doorEls.length; i++) doorEls[i].style.display = 'none';
  }
  // ------------------------------------------------------------- interaction detection
  function setNear(kind, key, text, extra) {
    S.near = Object.assign({ kind }, extra || {});
    S.promptKey = key; S.promptText = text; S.promptKind = kind;
  }
  const near2 = (x, z, r) => Math.hypot(x - S.player.x, z - S.player.z) < r;
  function detectInteraction() {
    S.near = null; S.promptKey = ''; S.promptText = ''; S.promptKind = '';
    if (S.phase !== 'playing') return;
    if (S.mode === 'drone') return;
    if (S.mode === 'cruise') {
      if (S.saloonInside) {
        if (Math.hypot(-5.0 - S.saloon.x, -2.3 - S.saloon.z) < 2.1) { setNear('saloonOrder', 'E', `点一杯 · 沙龙吧台 ¥${PRICE.saloon}`); return; }
        setNear('saloonExit', 'E', '出舱 · 回甲板'); return;
      }
      if (C.saloon) {
        const door = new THREE.Vector3(C.saloon.doorLocal[0], C.saloon.doorLocal[1], C.saloon.doorLocal[2]);
        C.cruise.boat.updateMatrixWorld();
        C.cruise.boat.localToWorld(door);
        if (Math.hypot(S.player.x - door.x, S.player.z - door.z) < 3.4) { setNear('saloon', 'E', '进入船舱 · 邮船沙龙'); return; }
        const barW = new THREE.Vector3(-3.2, 4.7, -2.1);
        C.cruise.boat.localToWorld(barW);
        if (Math.hypot(S.player.x - barW.x, S.player.z - barW.z) < 2.2) { setNear('deckOrder', 'E', `点一杯 · 甲板吧台 ¥${PRICE.deck}`); return; }
      }
      setNear('exitCruise', 'E', '下船 · 回到码头'); return;
    }
    if (S.mode === 'taxi') {
      if (S.taxi.state !== 'choose') setNear('exitTaxi', 'E', '下车');
      return;
    }
    if (S.mode === 'car') { setNear('exitCar', 'F', '下车'); return; }
    if (S.ferry.on && !S.aim.active) {
      const F = S.ferry;
      if (F.phase === 'sail' && C.ferryRide.length - F.s > 90 && F.skipT < 0) setNear('ferrySkip', 'E', '靠着栏杆看江 · 快进到对岸');
      else if (F.phase === 'docked') setNear('leaveFerry', 'E', '下船 · 十八埠');
      return;
    }
    // --- foot ---
    if (S.view === 'telescope') { setNear('exitTelescope', 'E', '离开望远镜'); return; }
    if (S.view === 'sit') { setNear('standUp', 'E', '起身'); return; }
    if (S.view === 'terrace') { setNear('standCafe', 'E', '起身'); return; }
    if (S.view === 'l2scope') { setNear('exitL2Scope', 'E', '离开观景镜'); return; }
    const P = S.place;
    if (jobNear()) return;
    if (P === 'ferryhall') {
      const dGate = Math.hypot(-79.2 - S.player.x, 619.5 - S.player.z);
      const dDoor = C.ferryHall ? Math.hypot(C.ferryHall.door[0] - S.player.x, C.ferryHall.door[1] - S.player.z) : 1e9;
      if (dGate < 2.0 && dGate <= dDoor) {
        if (departureOpen('ferry')) setNear('boardFerry', 'E', `检票登船 · 过江回家 · 渡轮 ¥${PRICE.ferry}`);
        else setNear('ferryWait', 'E', '末班渡轮已开走 · 看看手机「时刻」');
        return;
      }
      if (C.ferryHall && near2(C.ferryHall.door[0], C.ferryHall.door[1], 2.2)) { setNear('exitFerryHall', 'E', '出门 · 回码头'); return; }
      return;
    }
    if (P === 'home') {
      const h = C.puxiHome;
      if (near2(h.bed[0], h.bed[1], 1.5)) { setNear('sleepHome', 'E', '躺下 · 今晚到此为止'); return; }
      if (near2(h.kettle[0], h.kettle[1], 1.1)) { setNear('homeKettle', 'E', '烧壶热水'); return; }
      if (near2(h.window[0], h.window[1], 1.0)) { setNear('homeWindow', 'E', '看看窗外'); return; }
      if (near2(h.inner[0], h.inner[1], 1.3)) { setNear('exitHome', 'E', '下楼 · 回弄堂'); return; }
      return;
    }
    if (P === 'bar') {
      if (near2(-627.6, 87.3, 2.2)) { setNear('barDrink', 'E', `来一杯 · ¥${PRICE.barDrink}`); return; }
      if (C.bar && near2(C.bar.door[0], C.bar.door[1], 2.2)) { setNear('exitBar', 'E', '出门 · 回滨江'); return; }
      return;
    }
    if (P === 'l3') {
      const panels = [[160, '魔都之巅'], [176, '城市天际线']];
      for (let i = 0; i < panels.length; i++) {
        if (near2(panels[i][0], 226.2, 2.2)) { setNear('l3Panel', 'E', '看展板 · ' + panels[i][1], { idx: i }); return; }
      }
      setNear('exitL3', 'E', '回 L2'); return;
    }
    if (P === 'l2') {
      if (near2(184, 223.2, 2.4)) { setNear('enterL3', 'E', '上 L3 观景层'); return; }
      const panels = [[158, '澜滩天际线'], [168, '申江上的桥'], [178, '临江嘴三件套']];
      for (let i = 0; i < panels.length; i++) {
        if (near2(panels[i][0], 226.0, 2.2)) { setNear('l2Panel', 'E', '看展板 · ' + panels[i][1], { idx: i, name: panels[i][1] }); return; }
      }
      if (C.l2scope && near2(C.l2scope[0], C.l2scope[1], 2.2)) { setNear('enterL2Scope', 'E', '用观景镜看江'); return; }
      if (near2(152.4, 223.2, 2.4)) { setNear('exitL2', 'E', '下楼 · 回大堂'); return; }
      return;
    }
    if (P === 'lobby') {
      if (near2(180, 206.4, 3.2)) { setNear('enterL2', 'E', '上 L2 观景廊'); return; }
      if (C.lobby && near2(C.lobby.inner[0], C.lobby.inner[1], 2.6)) { setNear('exitLobby', 'E', '离开大堂'); return; }
      const props = [
        [158, 198, 2.2, 'lobbyWater', `买瓶水 · ¥${PRICE.water}`],
        [178, 198, 2.2, 'lobbyWater', `买瓶水 · ¥${PRICE.water}`],
        [166, 218, 2.3, 'lobbyInfo', '看楼层导览'],
        [177, 214, 2.6, 'lobbyCoffee', `买杯咖啡 · ¥${PRICE.lobbyCoffee}`],
      ];
      for (const [px, pz, r, kind, text] of props) if (near2(px, pz, r)) { setNear(kind, 'E', text); return; }
      return;
    }
    if (P === 'mall') {
      if (C.mall && near2(C.mall.door[0], C.mall.door[1], 2.4)) { setNear('exitMall', 'E', '离开环港广场'); return; }
      const shops = [['coffeeshop', 'enterCoffeeShop', '进入夜航咖啡'], ['flower', 'enterFlower', '进入花店'], ['umbrella', 'enterUmbrella', '进入雨具店'], ['postcard', 'enterPostcard', '进入明信片铺'], ['records', 'enterRecords', '进入唱片行'], ['bakery', 'enterBakery', '进入面包房'], ['bookshop', 'enterBookshop', '进入环港书局']];
      for (const [ck, kind, text] of shops) {
        const c = C[ck];
        if (c && near2(c.door[0], c.door[1], 2.6)) { setNear(kind, 'E', text); return; }
      }
      return;
    }
    const SHOP_POINTS = {
      coffeeshop: [-590, 52.4, 2.2, 'buyLatte', `买一杯拿铁 · ¥${PRICE.latte}`],
      flower: [-568.6, 72.8, 2.0, 'buyFlower', `买一束花 · ¥${PRICE.flower}`],
      umbrella: [-607.2, 65.2, 2.2, 'buyUmbrella', S.umbrellaBought ? `再买一把伞 · ¥${PRICE.umbrella}` : `买一把伞 · ¥${PRICE.umbrella}`],
      postcard: [-580.5, 56.9, 2.0, 'buyPostcard', `买一张明信片 · ¥${PRICE.postcard}`],
      records: [-566.2, 64.8, 2.2, 'recordListen', '试听一张 · 唱机柜台'],
      bakery: [-610.4, 74.5, 2.2, 'croissant', `买一个可颂 · ¥${PRICE.croissant}`],
      bookshop: [-600, 54.9, 2.0, 'bookRead', '翻一本书 · 阅读桌'],
    };
    if (SHOP_POINTS[P]) {
      const [px, pz, r, kind, text] = SHOP_POINTS[P];
      const c = C[ROOMS[P].c];
      const dDoor = c ? Math.hypot(c.door[0] - S.player.x, c.door[1] - S.player.z) : 1e9;
      if (near2(px, pz, r) && Math.hypot(px - S.player.x, pz - S.player.z) <= dDoor) { setNear(kind, 'E', text); return; }
      if (c && near2(c.door[0], c.door[1], 2.2)) { setNear('exit' + P[0].toUpperCase() + P.slice(1), 'E', '出门 · 回环港广场'); return; }
      return;
    }
    if (P === 'cafe') {
      const c = C.cafe;
      if (c && near2(c.counter[0], c.counter[1], 2.6)) { setNear('cafeOrder', 'E', `点一杯热咖啡 · ¥${PRICE.cafeCoffee}`); return; }
      if (c && near2(c.door[0], c.door[1], 2.2)) { setNear('exitCafe', 'E', '离开咖啡店'); return; }
      return;
    }
    // --- outside ---
    // up on a deck the street below is out of reach; the camera still works
    const aloft = S.player.deck && S.player.y > A.groundY(S.player.x, S.player.z) + 1.5;
    if (!aloft) {
    if (C.stalls) {
      for (const st of C.stalls) {
        if (near2(st.x, st.z, 2.4)) {
          const label = { wine: `买一杯热红酒 · ¥${PRICE.wine}`, chestnut: `买一包糖炒栗子 · ¥${PRICE.chestnut}`, skewer: `买两串烤肉 · ¥${PRICE.skewer}` }[st.kind];
          setNear(st.kind, 'E', label); return;
        }
      }
    }
    if (C.buskers) {
      for (const b of C.buskers) if (near2(b.x, b.z, 2.6)) { setNear('buskerListen', 'E', '听一首 · 街头乐手', { act: b.kind }); return; }
    }
    if (C.photoTourist && near2(C.photoTourist[0], C.photoTourist[1], 2.8)) {
      setNear('photoTourist', 'E', S.photoTouristDone ? '再帮他们拍一张' : '帮游客拍一张'); return;
    }
    if (C.foodCart && near2(C.foodCart.x, C.foodCart.z, 2.8)) { setNear('streetFood', 'E', `买份小吃 · ¥${PRICE.cart}`); return; }
    if (C.ferryHall && near2(C.ferryHall.door[0], C.ferryHall.door[1], 2.8)) { setNear('enterFerryHall', 'E', '进入候船厅'); return; }
    if (C.bar && near2(C.bar.door[0], C.bar.door[1], 3.0)) { setNear('enterBar', 'E', '进入夜航小馆'); return; }
    if (C.lobby && near2(C.lobby.door[0], C.lobby.door[1], 4.0)) { setNear('enterLobby', 'E', '进入魔都中心大堂'); return; }
    if (C.mall && near2(C.mall.door[0], C.mall.door[1], 3.4)) { setNear('enterMall', 'E', '进入环港广场'); return; }
    if (C.cafe && near2(C.cafe.door[0], C.cafe.door[1], 3.2)) { setNear('enterCafe', 'E', '进入江畔咖啡'); return; }
    if (C.cafeTerrace && near2(C.cafeTerrace.x, C.cafeTerrace.z, 2.4)) { setNear('sitCafe', 'E', '坐一会 · 露天座'); return; }
    if (C.telescope && near2(C.telescope.x, C.telescope.z, 2.0)) { setNear('telescope', 'E', `看澜滩 · 望远镜 ¥${PRICE.telescope}`); return; }
    if (C.riverBench && near2(C.riverBench.stand[0], C.riverBench.stand[1], 1.8)) { setNear('sitBench', 'E', '坐下 · 看江'); return; }
    if (C.cruise && near2(C.cruise.pier[0], C.cruise.pier[1], 10)) { setNear('cruise', 'E', `登船 · 申江夜航 ¥${PRICE.cruise}`); return; }
    if (C.puxiHome && near2(C.puxiHome.door[0], C.puxiHome.door[1], 2.4)) { setNear('enterHome', 'E', '进楼 · 上四楼 402 · 到家'); return; }
    }
    // camera / photos
    if (S.aim.active) {
      if (S.aim.result && !S.photos.includes(S.aim.result.spot.id)) {
        setNear('photo', 'E', `拍摄 ${S.aim.result.spot.name}`, { spot: S.aim.result.spot }); return;
      }
      setNear('aimExit', 'Q', '收起相机'); return;
    }
    const spot = nearestPhotoSpot();
    if (spot) { setNear('photoHint', 'Q', `按 Q 举起相机 · 拍摄${spot.name}`, { spot }); return; }
    const dTaxi = aloft ? 1e9 : Math.hypot(S.taxi.x - S.player.x, S.taxi.z - S.player.z);
    if (dTaxi < 5.2 && S.taxi.state !== 'toTarget') { setNear('boardTaxi', 'E', '搭车 · 出租车'); return; }
    const dCar = aloft ? 1e9 : Math.hypot(S.car.x - S.player.x, S.car.z - S.player.z);
    if (dCar < 4.6) { setNear('enterCar', 'F', S.car.broken ? '车坏了 · 发动不了' : '上车 · 自驾'); return; }
    if (ferryDist() < 26 && C.ferryHall && !near2(C.ferryHall.door[0], C.ferryHall.door[1], 2.8)) {
      setNear('enterFerryHall', 'E', departureOpen('ferry') ? '去候船厅检票 · 末班渡轮 23:30' : '进入候船厅 · 末班渡轮已开走');
      return;
    }
    // the drone hint comes last: it never overrides a real interaction
    if (!S.near) setNear('drone', 'V', '放飞无人机');
  }

  // ------------------------------------------------------------- HUD
  const tbBrake = $('tb-brake'), tbNitro = $('tb-nitro');
  function updateHUD() {
    const droneOn = S.mode === 'drone';
    document.body.classList.toggle('drone-on', droneOn);
    document.body.classList.toggle('mode-foot', S.mode === 'foot');
    show(el.droneHud, droneOn);
    show(el.droneTouch, droneOn && document.body.classList.contains('touch-on'));
    show(el.hudBottom, !droneOn);
    show(el.droneChip, !droneOn && S.mode === 'foot' && S.phase === 'playing' && !S.place);
    if (droneOn) {
      const d = S.drone;
      setText(el.dhMode, d.view === 'chase' ? 'CHASE' : 'FPV');
      setText(el.dhBatt, Math.round(d.battery) + '%');
      setText(el.dhAlt, d.y.toFixed(1) + ' m');
      setText(el.dhDist, Math.round(d.range) + ' m');
      setText(el.dhSpd, d.speed.toFixed(1));
      const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      setText(el.dhHdg, dirs[Math.round((((d.yaw * 180 / Math.PI) % 360 + 360) % 360) / 45) % 8]);
      const bars = Math.max(1, Math.ceil(d.signal * 4));
      setText(el.dhSignal, '▮'.repeat(bars) + '▯'.repeat(4 - bars));
      el.dhAlert.classList.toggle('hidden', !(d.low || d.returning));
      setText(el.dhAlert, d.returning ? 'RETURN TO HOME · 自动返航' : 'LOW BATTERY · 低电量');
    }
    const t = targetPoint();
    const dist = distToTarget();
    const tr = S.track && isActive(S.track) ? JOB[S.track] : null;
    const homeward = S.ferry.on || S.ferry.landed;
    setText(el.objEyebrow, homeward ? '回家 · GOING HOME' : tr ? `委托 · ${CONTACTS[tr.from].name}` : S.waitBus ? '候车 · N1' : '回家 · GOING HOME');
    setText(el.objective, objectiveText());
    setText(el.distance, t.phone ? 'Tab · 手机' : dist > 1000 ? (dist / 1000).toFixed(1) + ' km' : Math.round(dist) + ' m');
    let dots = '';
    if (tr && !homeward) for (const s of tr.steps()) dots += s.done ? '●' : '○';
    else dots = nextDeparture().short;
    setText(el.dots, dots);
    setText(el.stamp, `委托 ${jobsDone()} / ${JOB_DEFS.length}`);
    // clock: the real time of night, and the next way home
    const dep = nextDeparture();
    const left = dep.id === 'ferry' ? CLOCK_LAST - S.clock : dep.id === 'bus' ? CLOCK_BUS - S.clock : dep.id === 'taxi' ? CLOCK_END - S.clock : 99;
    setText(el.timer, fmtClock(S.clock));
    el.timer.classList.toggle('warn', left < 8 && left >= 3);
    el.timer.classList.toggle('crit', left < 3);
    setText(el.timerLabel, dep.short);
    setText(el.clockEyebrow, S.storm ? '暴雨 · STORM' : S.lightShow ? '灯光秀 · LIGHT SHOW' : timed() ? '今夜 · 小雨' : '自由漫步 · FREE ROAM');
    // speed & gear
    let sp = 0, gear = 'N', vname = S.ferry.landed ? '步行 · 永安里' : '步行 · 观澜大道', rpm = 0;
    if (S.ferry.on) {
      sp = S.ferry.speed * 3.6; gear = S.ferry.phase === 'sail' ? 'D' : 'N'; vname = '申渡 7 号 · 东晟路—十八埠'; rpm = S.ferry.speed / 4.8 * 60;
    } else if (S.mode === 'cruise') {
      sp = S.cruise.speed * 3.6; gear = 'D'; vname = '申江邮船 · 澜滩航线'; rpm = 35;
    } else if (S.mode === 'car') {
      sp = Math.abs(S.car.speed) * 3.6;
      gear = S.car.speed < -0.4 ? 'R' : S.car.speed < 0.4 ? 'N' : String(Math.min(6, 1 + Math.floor(Math.abs(S.car.speed) / 7.4)));
      vname = '魔A·D1725 · 纯电自驾';
      const band = Math.abs(S.car.speed) % 7.4;
      rpm = Math.min(100, (0.22 + 0.78 * band / 7.4) * 100);
    } else if (S.mode === 'taxi') {
      sp = Math.abs(S.taxi.speed) * 3.6; gear = 'D';
      vname = '出租车 · ¥' + (S.taxi.fare || 0).toFixed(1);
      rpm = Math.min(100, Math.abs(S.taxi.speed) / 12 * 100);
    } else {
      sp = S.player.speed * 3.6; gear = S.player.moving ? 'W' : 'N';
      rpm = Math.min(100, S.player.speed / 5.2 * 100);
    }
    if (TOUCH) { setText(tbBrake, S.mode === 'foot' ? (S.aim.active ? '收相机' : '相机') : '刹车'); setText(tbNitro, S.mode === 'foot' ? '跑' : '加速'); }
    setText(el.speed, Math.round(sp));
    setText(el.gear, gear);
    setText(el.vehicle, vname);
    el.rpm.style.width = rpm + '%';
    // bars: stamina/warmth on foot, car condition/battery in the car
    const inCar = S.mode === 'car';
    setText(el.bar1Label, inCar ? '车况' : '体力');
    setText(el.bar2Label, inCar ? '电量' : '体温');
    const b1 = inCar ? S.car.hp : S.stamina, b2 = inCar ? S.car.battery : S.warmth;
    el.bar1.style.width = clamp(b1, 0, 100) + '%';
    setText(el.bar1Num, Math.round(b1));
    el.bar2.style.width = clamp(b2, 0, 100) + '%';
    setText(el.bar2Num, Math.round(b2));
    setText(el.wallet, '¥' + Math.floor(S.wallet));
    setText(el.licence, inCar || S.licence < 12 ? '驾照 ' + S.licence : '声望 ' + S.rep);
    setText(el.stampTotal, `手账 ${stampCount()}/${STAMP_TOTAL}`);
    // prompt
    if (S.promptText) {
      show(el.prompt, true);
      setText(el.promptKey, TOUCH ? '点' : S.promptKey);
      setText(el.promptText, touchText(S.promptText));
    } else show(el.prompt, false);
    // transient UI
    if (S.realTime > S.sub.until) el.subtitles.classList.remove('show');
    if (S.realTime > S.toastUntil) show(el.toast, false);
    if (S.postcardUntil && S.realTime > S.postcardUntil) { show(el.postcard, false); S.postcardUntil = 0; }
    // head-up compass: the arrow is relative to where the camera faces
    const p = subject();
    const camDir = Math.atan2(Math.sin(S.camera.yaw), -Math.cos(S.camera.yaw)); // screen angle of view dir
    const nt = navTarget(), ct = nt || t;
    const tgtDir = Math.atan2(ct.x - p.x, -(ct.z - p.z));
    el.compassArrow.style.transform = `rotate(${wrapAngle(tgtDir - camDir)}rad)`;
    el.compassArrow.style.visibility = !nt && t.phone ? 'hidden' : '';
    const camDeg = Math.atan2(Math.sin(S.camera.yaw), -Math.cos(S.camera.yaw)) * 180 / Math.PI;
    const card = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'][Math.round(((camDeg % 360) + 360) % 360 / 45) % 8];
    const cd = nt ? Math.hypot(nt.x - p.x, nt.z - p.z) : dist;
    el.compassArrow.style.color = nt ? nt.color : '';
    setText(el.compassText, !nt && t.phone ? `朝${card} · ${t.name} · Tab 手机` : `朝${card} · ${nt ? '导航 ' : ''}${ct.name} ${cd > 1000 ? (cd / 1000).toFixed(1) + ' km' : Math.round(cd) + ' m'}`);
  }

  // ------------------------------------------------------------- minimap
  // the round HUD minimap, and (square=true) the phone's map app
  function drawMap(cv, scale, square) {
    const c = cv || el.map, ctx = c.getContext('2d');
    const W = c.width, H = c.height, cx = W / 2, cy = H / 2, sc = scale || 0.52;
    const reach = Math.max(W, H) / 2 / sc + 30;
    const p = subject();
    const px = p.x, pz = p.z;
    const tx = (x) => cx + (x - px) * sc, tz = (z) => cy + (z - pz) * sc;
    ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.beginPath(); if (square) ctx.rect(0, 0, W, H); else ctx.arc(cx, cy, W / 2 - 3, 0, TAU); ctx.clip();
    ctx.fillStyle = '#12161c'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#071018';
    for (const poly of (C.waterPolys || [])) {
      ctx.beginPath();
      poly.forEach((q, i) => { if (i === 0) ctx.moveTo(tx(q[0]), tz(q[1])); else ctx.lineTo(tx(q[0]), tz(q[1])); });
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#2c333c';
    for (const poly of (C.mapDecks || [])) { ctx.beginPath(); poly.forEach((q, i) => { if (i === 0) ctx.moveTo(tx(q[0]), tz(q[1])); else ctx.lineTo(tx(q[0]), tz(q[1])); }); ctx.closePath(); ctx.fill(); }
    for (const r of C.roads) {
      ctx.strokeStyle = r.major ? '#3a4048' : '#2a3038';
      ctx.lineWidth = Math.max(1.2, (r.width || 6) * sc * 0.9); ctx.lineCap = 'round';
      ctx.beginPath();
      r.samp.forEach((q, i) => { if (i === 0) ctx.moveTo(tx(q[0]), tz(q[1])); else ctx.lineTo(tx(q[0]), tz(q[1])); });
      if (r.closed) ctx.closePath();
      ctx.stroke();
    }
    // true footprints when the city provides them
    for (const b of C.buildings) {
      if (Math.abs(b.x - px) > reach || Math.abs(b.z - pz) > reach) continue;
      ctx.fillStyle = 'rgba(120,140,165,.13)';
      if (b.poly && b.poly.length > 2) {
        ctx.beginPath();
        b.poly.forEach((q, i) => { if (i === 0) ctx.moveTo(tx(q[0]), tz(q[1])); else ctx.lineTo(tx(q[0]), tz(q[1])); });
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillRect(tx(b.x - b.w / 2), tz(b.z - b.d / 2), b.w * sc, b.d * sc);
      }
    }
    for (const s of C.spots) {
      if (s.id === 'ferry') continue;
      const done = S.photos.includes(s.id);
      ctx.beginPath(); ctx.arc(tx(s.pos[0]), tz(s.pos[1]), done ? 3 : 4.5, 0, TAU);
      ctx.fillStyle = done ? '#48f0a2' : '#ffb35c'; ctx.fill();
      if (!done) { ctx.strokeStyle = 'rgba(255,179,92,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx(s.pos[0]), tz(s.pos[1]), 8 + Math.sin(S.realTime * 3) * 2, 0, TAU); ctx.stroke(); }
    }
    ctx.fillStyle = '#9fffe0'; ctx.beginPath(); ctx.arc(tx(C.ferry[0]), tz(C.ferry[1]), 5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#5b8cff'; ctx.fillRect(tx(BUS_STOP.x) - 4, tz(BUS_STOP.z) - 4, 8, 8);
    if (square) {
      ctx.font = `600 ${Math.round(W / 26)}px ${MAP_FONT}`; ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,12,.85)';
      for (const [n, x, z, col] of [['渡口 23:30', C.ferry[0], C.ferry[1], '#9fffe0'], ['N1 00:10', BUS_STOP.x, BUS_STOP.z, '#8fb0ff']]) {
        ctx.strokeText(n, tx(x) + 8, tz(z) + 5); ctx.fillStyle = col; ctx.fillText(n, tx(x) + 8, tz(z) + 5);
      }
    }
    ctx.fillStyle = '#ffd86b'; ctx.fillRect(tx(S.taxi.x) - 3, tz(S.taxi.z) - 3, 6, 6);
    if (S.mode !== 'car') { ctx.fillStyle = '#8fd8ff'; ctx.fillRect(tx(S.car.x) - 3, tz(S.car.z) - 3, 6, 6); }
    // the arrow shows where the CAMERA faces (head-up convention)
    const yaw = S.camera.yaw;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(-yaw + Math.PI);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5.5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5.5, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
    const t = targetPoint();
    if (!t.phone) {
      const dx = (t.x - px) * sc, dz = (t.z - pz) * sc;
      const l = Math.hypot(dx, dz), lim = Math.min(W, H) / 2 - 16;
      const mx = l > lim ? cx + dx / l * lim : cx + dx;
      const mz = l > lim ? cy + dz / l * lim : cy + dz;
      ctx.strokeStyle = '#ffb35c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, mz, 9, 0, TAU); ctx.stroke();
    }
    drawNavMini(ctx, tx, tz, W, H, sc);
    ctx.restore();
    ctx.fillStyle = 'rgba(220,235,255,.55)'; ctx.font = '600 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('N', cx, 15);
  }

  // ------------------------------------------------------------- journal
  function updateJournal() {
    if (!el.journalBody) return;
    const rows = [];
    for (const [cat, [label, ids]] of Object.entries(STAMPS)) {
      const n = ids.filter((id) => S.stamps[resolveStampId(cat, id)]).length;
      rows.push(`<div class="j-cat"><b>${label}</b><span>${n} / ${ids.length}</span></div>`);
      const names = ids.filter((id) => S.stamps[resolveStampId(cat, id)]).map((id) => `<i>${stampName(id)}</i>`).join('');
      if (names) rows.push(`<div class="j-items">${names}</div>`);
    }
    el.journalBody.innerHTML = rows.join('');
  }
  function resolveStampId(cat, id) { return cat === 'photo' ? 'photo-' + id : id; }
  function stampName(id) {
    const names = {
      pearl: '星珠塔', modu: '魔都中心', yunque: '云阙金融中心', jinyue: '金岳大厦', lantan: '澜滩对望',
      bookshop: '环港书局', bakery: '面包房', records: '唱片行', postcard: '明信片铺', umbrella: '雨具店', flower: '花店', coffeeshop: '夜航咖啡', bar: '夜航小馆', cafe: '江畔咖啡',
      telescope: '望远镜', bench: '江边长椅', terrace: '露天座', ring: '星珠环', skyway: '空中连廊', boardwalk: '滨江步道', l2scope: '观景镜', l3: 'L3 观景层', cruise: '申江夜航', saloon: '邮船沙龙', aerial: '航拍',
      wine: '热红酒', chestnut: '糖炒栗子', skewer: '烤肉', cart: '平台小吃', croissant: '可颂', latte: '拿铁',
      'l2-0': '澜滩展板', 'l2-1': '桥展板', 'l2-2': '三件套展板', 'l3-0': '魔都之巅展板', 'l3-1': '天际线展板',
      busker: '街头乐手', tourist: '帮游客拍照', taxi: '出租车', ferryhall: '候船厅',
    };
    return names[id] || id;
  }
  function toggleJournal() {
    if (S.phase !== 'playing') return;
    togglePhone('journal');
  }
