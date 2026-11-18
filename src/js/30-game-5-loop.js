  // ------------------------------------------------------------- simulation
  function update(dt) {
    S.realTime += dt;
    if (S.phase === 'playing' && !S.overlay) {
      S.time += dt;
      // waiting at the stop fast-forwards: whatever is left of the wait passes in ~8 s
      S.clock += dt * (S.waitBus ? Math.max(TIME_SCALE / 60, (S.waitBus.at - S.waitBus.from) / 8) : TIME_SCALE / 60);
      tickNight(dt);
      if (S.phase !== 'playing') { tickPhone(dt); return; }
      if (S.mode === 'foot') updateFoot(dt);
      else if (S.mode === 'car') updateCar(dt);
      else if (S.mode === 'drone') updateDrone(dt);
      else if (S.mode === 'cruise') updateCruise(dt);
      else updateTaxi(dt);
      // a called taxi drives to the kerb while the player walks, drives or flies
      if (S.mode !== 'taxi' && S.taxi.state === 'toPlayer') updateTaxi(dt);
      if (S.mode !== 'car') { A.car.headlights[0].intensity = 0; A.car.headlights[1].intensity = 0; }
      // body heat: the rain takes it, interiors and vehicles give it back
      const underDeck = S.ferry.on && Math.abs(S.ferry.lz) < 11;
      const sheltered = inRoom() || S.saloonInside || S.mode === 'car' || S.mode === 'taxi' || S.mode === 'cruise' || underDeck;
      if (sheltered) {
        S.warmth = Math.min(100, S.warmth + dt * 7);
        if (S.mode === 'taxi') S.stamina = Math.min(100, S.stamina + dt * 12);
      } else {
        const umb = S.umbrellaBought ? 0.35 : S.umbrella ? 0.55 : 1;
        S.warmth = Math.max(0, S.warmth - dt * 0.5 * umb * (S.storm ? 1.8 : 1));
      }
      if (S.warmth < 25 && S.coldWarned < 1) { S.coldWarned = 1; subtitle('手都冻僵了。进店暖和一下，或者买杯热的——体温太低走不动路。', '旁白', 5); }
      if (S.warmth >= 40) S.coldWarned = 0;
      if (S.aim.active) updateAim(dt);
      if (mouseLocked && (S.ph.open || S.overlay)) releaseMouse();
      updateCamera(dt);
      detectInteraction();
      updateNav();
      updateHUD();
      updateDoorMarks();
    } else if (S.phase !== 'playing') {
      if (mouseLocked) releaseMouse();
      updateCameraMenu(dt);
      if (S.phase === 'menu') el.subtitles.classList.remove('show');
    }
    // world animation
    if (C.updateSignals) C.updateSignals(SHOT ? 0 : S.realTime);
    const ctxInfo = {
      t: S.realTime, mode: S.mode,
      car: { x: S.car.x, z: S.car.z, yaw: S.car.yaw, speed: S.car.speed },
      taxi: { x: S.taxi.x, z: S.taxi.z, yaw: S.taxi.yaw, speed: S.taxi.speed },
      player: { x: S.player.x, z: S.player.z },
    };
    A.updateTraffic(dt, S.player.x, S.player.z, ctxInfo);
    A.updatePeds(dt, ctxInfo);
    const active = nextSpot();
    A.updateBeacons(S.realTime, active.id, S.photos);
    if (C.updateRiver) C.updateRiver(dt);
    if (G.ledScreens) {
      const show_ = S.lightShow && S.phase === 'playing';
      for (const l of G.ledScreens) {
        l.tex.offset.y = (l.tex.offset.y + dt * lightShowSpeed()) % 1;
        const m = l.mesh.material;
        if (show_) { m.emissiveIntensity = l.base * (1.3 + 0.5 * Math.sin(S.realTime * 2.4)); m.emissive.setHSL((S.realTime * 0.07) % 1, 0.7, 0.62); l.lit = true; }
        else if (l.lit) { m.emissiveIntensity = l.base; m.emissive.setRGB(1, 1, 1); l.lit = false; }
      }
    }
    tickPhone(dt);
    if (S.mode !== 'car') {
      A.lightRig.position.set(S.car.x, S.car.tun ? S.car.tunY : 0, S.car.z); A.lightRig.rotation.y = S.car.yaw; A.lightRig.visible = false;
    }
    const p = subject();
    G.moon.position.set(p.x + MOON.x * 160, MOON.y * 160, p.z + MOON.z * 160);
    G.moon.target.position.set(p.x, 0, p.z);
    G.moon.target.updateMatrixWorld();
    if (G.rain) {
      G.rain.position.set(camera.position.x, 0, camera.position.z);
      // no rain in a bore, or under a roof (the particles ignore ceilings)
      const inBore = (S.mode === 'car' && S.car.tun && S.car.tunS < -7) || (S.mode === 'foot' && inRoom()) || S.saloonInside || (S.ferry.on && Math.abs(S.ferry.lz) < 10 && S.camera.pitch < 0.5);
      if (G.rain.visible !== (SET.rain && !inBore)) G.rain.visible = SET.rain && !inBore;
      G.rainMat.uniforms.uTime.value = S.realTime;
    }
    if (S.realTime - lastHud > 0.08) { lastHud = S.realTime; if (S.phase === 'playing') updateHUD(); }
    if (S.realTime - lastMap > 0.16) { lastMap = S.realTime; if (!S.overlay) drawMap(); }
    if (MAPUI.open) drawBigMap();
    syncActors();
  }

  const MOON = new THREE.Vector3(-0.32, 0.44, -0.84).normalize();
  const HERO = { pos: new THREE.Vector3(-500, 35, 1100), target: new THREE.Vector3(60, 160, 100) };
  function updateCameraMenu(dt) {
    if (CAMQ) return;
    if (S.phase !== 'menu') return;
    const t = SHOT ? 0 : S.realTime;
    const ox = Math.sin(t * 0.06) * 5, oz = Math.cos(t * 0.05) * 3;
    camera.position.set(HERO.pos.x + ox, HERO.pos.y + Math.sin(t * 0.04) * 1.2, HERO.pos.z + oz);
    const tgt = HERO.target.clone();
    tgt.x += Math.sin(t * 0.03) * 3;
    camera.lookAt(tgt);
    camera.fov = damp(camera.fov, FOVQ || 52, 3, dt); camera.updateProjectionMatrix();
    S.camera.yaw = Math.atan2(tgt.x - camera.position.x, tgt.z - camera.position.z);
  }

  // ------------------------------------------------------------- render loop
  let frames = 0, last = performance.now(), fpsSm = 0, lastSt = null, slowT = 0;
  const PEARL_Q = Q.get('pearl') !== null ? (parseInt(Q.get('pearl'), 10) || 0) : -1;
  function loop(now) {
    const dt = clamp((now - last) / 1000, 0.0001, 0.05); last = now;
    if (!SHOT) {
      update(dt);
    } else if (S.phase === 'menu' && !CAMQ) {
      updateCameraMenu(0);
    }
    G.setTime(SHOT ? 0 : S.realTime);
    if (G.pearlFx) S.pearlProg = G.pearlFx(PEARL_Q >= 0 ? PEARL_Q * 22 + 6 + (SHOT ? 0 : S.realTime % 10) : S.realTime, S.lightShow && S.phase === 'playing');
    renderer.toneMappingExposure = (S.mode === 'drone' && S.drone.view === 'fpv') ? 1.28 : 1.0;
    const st = S.overlay && lastSt && frames % 20 ? lastSt : (lastSt = G.renderPost(dt));
    const fps = 1 / Math.max(dt, 1e-3);
    fpsSm = fpsSm ? fpsSm * 0.9 + fps * 0.1 : fps;
    if (!SHOT && TOUCH && S.phase === 'playing' && !S.overlay && !S.ph.open) {
      slowT = fpsSm < 26 ? slowT + dt : Math.max(0, slowT - dt * 0.5);
      const order = ['ultra', 'high', 'medium', 'low'], qi = order.indexOf(SET.quality);
      if (slowT > 5 && qi >= 0 && qi < order.length - 1) {
        slowT = 0; setters.quality(order[qi + 1]); saveAll();
        toast(`帧率偏低 · 画质已自动降到「${({ high: '高', medium: '中', low: '低' })[order[qi + 1]]}」`, 3);
      }
    }
    S.stats = { calls: st.calls, triangles: st.tris, fps: Math.round(fpsSm), lights: LIGHT_COUNT };
    window.__STATS = S.stats;
    window.__CAM_POS = { x: camera.position.x, z: camera.position.z };
    frames++;
    if (frames === 2) { window.__READY = true; window.__BOOT = G.t; el.boot.classList.add('gone'); }
    if (SHOT) setTimeout(() => requestAnimationFrame(loop), 120);
    else requestAnimationFrame(loop);
  }
  let LIGHT_COUNT = 0;
  scene.traverse((o) => { if (o.isLight) LIGHT_COUNT++; });

  if (CAMQ && CAMQ.length >= 6) {
    camera.position.set(CAMQ[0], CAMQ[1], CAMQ[2]);
    camera.lookAt(CAMQ[3], CAMQ[4], CAMQ[5]);
    camera.fov = FOVQ || 52; camera.updateProjectionMatrix();
  } else if (SHOT) {
    camera.position.copy(HERO.pos); camera.lookAt(HERO.target); camera.fov = FOVQ || 52; camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------- page contract
  function stateSnapshot() {
    const inRange = S.near ? (S.near.spot ? S.near.spot.id : S.near.kind) : null;
    return {
      phase: S.phase, mode: S.mode, health: Math.round(S.stamina), stamina: Math.round(S.stamina),
      warmth: Math.round(S.warmth), wallet: Math.floor(S.wallet), licence: S.licence, fines: S.fines,
      clock: fmtClock(S.clock), runMode: SET.runMode, place: S.place, view: S.view,
      inRange, progress: S.photos.length, failed: S.phase === 'lost', cause: S.lastCause,
      objective: objectiveText(), photos: S.photos.slice(), shots: S.shots, stamps: stampCount(),
      score: Math.round(S.photoScore), x: +S.player.x.toFixed(1), z: +S.player.z.toFixed(1),
      carSpeed: +(S.car.speed || 0).toFixed(2), carX: +S.car.x.toFixed(1), carZ: +S.car.z.toFixed(1), carYaw: +(S.car.yaw || 0).toFixed(3), carHp: Math.round(S.car.hp), carBattery: Math.round(S.car.battery),
      carTunnel: S.car.tun ? S.car.tun.id + ':' + S.car.tunS.toFixed(1) + ':' + S.car.tunLat.toFixed(2) : null, carY: +(S.car.tun ? S.car.tunY : 0).toFixed(2), crossing: !!S.crossing, playerY: +(S.player.y || 0).toFixed(2), playerTunnel: S.player.tun ? S.player.tun.id + ':' + S.player.tunS.toFixed(1) : null,
      taxiState: S.taxi.state, near: S.near ? S.near.kind : null,
      cruiseActive: S.cruise.active, cruiseT: +S.cruise.t.toFixed(3), droneActive: S.drone.active, droneView: S.drone.view, droneAlt: +S.drone.y.toFixed(1), droneBattery: Math.round(S.drone.battery), droneRange: +S.drone.range.toFixed(1), aerialPhotos: S.aerialPhotos,
      phone: { open: S.ph.open, app: S.ph.app, sub: S.ph.sub, batt: Math.round(S.ph.batt), dead: S.ph.dead, unread: unreadTotal() },
      jobs: Object.fromEntries(Object.entries(S.jobs).map(([k, v]) => [k, v.state])), track: S.track, rep: S.rep, jobsDone: jobsDone(),
      ending: S.ending, grade: S.grade, total: Math.round(S.score), departure: nextDeparture().label, waitBus: !!S.waitBus, storm: !!S.storm, lightShow: S.lightShow, carry: Object.keys(S.carry).filter((k) => S.carry[k]),
    };
  }
  function goto(x, z) {
    if (!isFinite(x) || !isFinite(z)) return stateSnapshot();
    S.mode = 'foot'; S.place = null; S.view = null; S.ferry.on = false;
    if (S.aim.active) lowerCamera();
    S.player.x = x; S.player.z = z; S.player.y = A.groundY(x, z); S.player.deck = false; S.player.deckRef = null;
    S.camera.yaw = Math.atan2(nextSpot().pos[0] - x, nextSpot().pos[1] - z);
    detectInteraction(); syncActors(); updateCamera(0.016);
    return stateSnapshot();
  }
  // Aim the real camera at a spot the way a player would, then let the
  // real scoring code judge the frame. Used by selftest and ?photo=.
  function aimAtSpot(spot) {
    const lm = landmarkOf(spot);
    camera.position.set(S.player.x, S.player.y + 1.62, S.player.z);
    camera.fov = 50; camera.updateProjectionMatrix();
    camera.lookAt(lm.x, lm.y * 0.72, lm.z);
    const cy = Math.atan2(lm.x - S.player.x, lm.z - S.player.z);
    S.camera.yaw = cy;
    S.camera.pitch = Math.atan2(lm.y * 0.72 - 1.62, Math.hypot(lm.x - S.player.x, lm.z - S.player.z));
    camera.updateMatrixWorld();
  }
  // Plays the real rules end to end: postcards sent to 老周, then each way the
  // night can end (ferry, N1, taxi, stranded at 01:00), then a clean restart.
  function selftest() {
    const steps = [], mode0 = SET.runMode;
    SET.runMode = 'ferry';
    resetGame(); startRun();
    for (const id of PHOTO_IDS) {
      const spot = spotById(id);
      goto(spot.pos[0], spot.pos[1]);
      aimAtSpot(spot);
      takePhoto(spot);
      steps.push(id + ':' + (S.shots[id] || 0));
    }
    sendPostcards();
    const paid = S.earned;
    goto(C.ferryHall.door[0] + 1.5, C.ferryHall.door[1]);
    enterRoom('ferryhall');
    S.player.x = -79.2; S.player.z = 619.5;
    detectInteraction();
    const gate = S.near && S.near.kind;
    interact();
    // the crossing: board, look out over the rail (fast-forward), come alongside, walk off, up to 402
    const crossing = [S.ferry.phase];
    for (let i = 0; i < 160 && S.ferry.phase === 'board'; i++) update(0.05);
    detectInteraction(); const skipK = S.near && S.near.kind; interact();
    for (let i = 0; i < 2400 && S.ferry.on && S.ferry.phase !== 'docked'; i++) update(0.05);
    crossing.push(S.ferry.phase);
    detectInteraction(); const offK = S.near && S.near.kind; interact();
    const landed = S.ferry.landed && !S.ferry.on;
    const h = C.puxiHome;
    goto(h.door[0] + 1.3, h.door[1]); detectInteraction(); const homeK = S.near && S.near.kind; interact();
    const inHome = S.place === 'home';
    S.player.x = -859.9; S.player.z = 683.6; detectInteraction(); const bedK = S.near && S.near.kind; interact();
    const win = S.phase === 'won' && S.ending === 'ferry';
    const ferry = { gate, skip: skipK, off: offK, landed, home: homeK, inHome, bed: bedK, crossing, ending: S.ending, total: Math.round(S.score), grade: S.grade, postcardsPaid: Math.round(paid), jobs: jobsDone() };
    // N1: past the last ferry, wait at the stop until 00:10
    resetGame(); startRun();
    S.clock = CLOCK_LAST + 2;
    goto(BUS_STOP.x, BUS_STOP.z); detectInteraction();
    const busPrompt = S.near && S.near.kind;
    interact();
    for (let i = 0; i < 700 && S.phase === 'playing'; i++) update(0.02);
    const bus = { prompt: busPrompt, ending: S.ending, clock: fmtClock(S.clock) };
    // taxi home from the phone
    resetGame(); startRun();
    S.mode = 'taxi'; goHomeByTaxi();
    const taxi = { ending: S.ending, wallet: Math.floor(S.wallet) };
    // stranded
    resetGame(); startRun();
    S.clock = CLOCK_END - 0.01;
    for (let i = 0; i < 40 && S.phase === 'playing'; i++) update(0.05);
    const fail = S.phase === 'lost' && S.ending === 'stranded';
    const cause = S.lastCause;
    resetGame(); startRun();
    const restart = S.phase === 'playing' && S.photos.length === 0 && S.stamina === 100 && S.wallet === WALLET_START && S.licence === 12 && !S.ending && jobsDone() === 0;
    SET.runMode = mode0;
    resetGame(); setPhase('menu');
    return { win, fail, restart, cause, steps: ['win', 'loss', 'restart'], photos: 5, detail: steps, ferry, bus, taxi, busOk: bus.ending === 'bus', taxiOk: taxi.ending === 'taxi' };
  }
  window.__TEST = (action, arg) => {
    switch (action) {
      case 'start': startRun(); return stateSnapshot();
      case 'pause': pauseGame(); return stateSnapshot();
      case 'resume': resumeGame(); return stateSnapshot();
      case 'openSettings': openSettings(S.phase === 'menu' ? 'menu' : 'paused'); return stateSnapshot();
      case 'closeSettings': closeSettings(); return stateSnapshot();
      case 'save': saveAll(); return stateSnapshot();
      case 'state': return stateSnapshot();
      case 'drone': launchDrone(); return stateSnapshot();
      case 'droneReturn': returnDrone(); return stateSnapshot();
      case 'dronePhoto': dronePhoto(); return stateSnapshot();
      case 'boat': enterCruise(); return stateSnapshot();
      case 'boatExit': exitCruise(); return stateSnapshot();
      case 'saloon': enterSaloon(); return stateSnapshot();
      case 'saloonExit': exitSaloon(); return stateSnapshot();
      case 'cafe': enterCafe(); return stateSnapshot();
      case 'cafeExit': exitCafe(); return stateSnapshot();
      case 'telescope': enterTelescope(); return stateSnapshot();
      case 'sit': sitBench(); return stateSnapshot();
      case 'mall': enterMall(); return stateSnapshot();
      case 'mallExit': exitMall(); return stateSnapshot();
      case 'bookshop': enterBookshop(); return stateSnapshot();
      case 'bakery': enterBakery(); return stateSnapshot();
      case 'records': enterRecords(); return stateSnapshot();
      case 'postcard': enterPostcard(); return stateSnapshot();
      case 'umbrella': enterUmbrella(); return stateSnapshot();
      case 'flower': enterFlower(); return stateSnapshot();
      case 'coffeeshop': enterCoffeeShop(); return stateSnapshot();
      case 'l2': enterL2(); return stateSnapshot();
      case 'l3': enterL3(); return stateSnapshot();
      case 'l3Exit': exitL3(); return stateSnapshot();
      case 'bar': enterBar(); return stateSnapshot();
      case 'ring': enterRing(); return stateSnapshot();
      case 'boardwalk': enterBoardwalk(); return stateSnapshot();
      case 'skyway': enterSkyway(false); return stateSnapshot();
      case 'ferryhall': enterFerryHall(); return stateSnapshot();
      case 'ferryhallExit': exitFerryHall(); return stateSnapshot();
      case 'skywayExit': exitSkyway(); return stateSnapshot();
      case 'boardwalkExit': exitBoardwalk(); return stateSnapshot();
      case 'ringExit': exitRing(); return stateSnapshot();
      case 'barExit': exitBar(); return stateSnapshot();
      case 'enterL2Scope': enterL2Scope(); return stateSnapshot();
      case 'exitL2Scope': exitL2Scope(); return stateSnapshot();
      case 'l2Exit': exitL2(); return stateSnapshot();
      case 'coffeeshopExit': exitCoffeeShop(); return stateSnapshot();
      case 'flowerExit': exitFlower(); return stateSnapshot();
      case 'umbrellaExit': exitUmbrella(); return stateSnapshot();
      case 'postcardExit': exitPostcard(); return stateSnapshot();
      case 'recordsExit': exitRecords(); return stateSnapshot();
      case 'bakeryExit': exitBakery(); return stateSnapshot();
      case 'bookshopExit': exitBookshop(); return stateSnapshot();
      case 'lobby': enterLobby(); return stateSnapshot();
      case 'lobbyExit': exitLobby(); return stateSnapshot();
      case 'streetFood': buy('streetFood'); return stateSnapshot();
      case 'aim': raiseCamera(); return stateSnapshot();
      case 'aimExit': lowerCamera(); return stateSnapshot();
      case 'journal': toggleJournal(); return stateSnapshot();
      case 'map': openMap(arg ? { focus: arg } : undefined); return { overlay: S.overlay, pois: (POIS || []).length, pins: NAV.pins.length };
      case 'manual': openManual(arg); return { overlay: S.overlay, tab: MN.tab, chars: $('mn-body').textContent.length };
      case 'overlayClose': closeOverlay(); return stateSnapshot();
      case 'pin': { const p = addPin(arg[0], arg[1]); navToPin(p); return { pin: p, target: NAV.target }; }
      case 'nav': { const r = navRoute(); return { target: NAV.target, pins: NAV.pins.length, route: r ? r.length : 0, len: r ? Math.round(routeLength(r)) : 0, beacon: navBeacon.g.visible }; }
      case 'goto': if (Array.isArray(arg)) goto(arg[0], arg[1]); return stateSnapshot();
      case 'interact': detectInteraction(); interact(); return stateSnapshot();
      case 'step': update(+(arg || 0.1)); return stateSnapshot();
      case 'ferry': {
        enterFerryHall(); startFerry();
        if (arg !== undefined) { const F = S.ferry; F.phase = 'sail'; F.t = 0; F.s = arg === 'end' ? C.ferryRide.length - 0.5 : clamp(+arg || 0, 0, C.ferryRide.length - 0.5); F.speed = 4.6; C.ferryRide.setRamps(C.ferryRide.rampUp, C.ferryRide.rampUp); }
        return { phase: S.ferry.phase, s: S.ferry.s };
      }
      case 'walkTo': {
        // walk with the real controls toward x,z until there, stuck (3 s without progress) or out of time
        const [tx, tz, secs = 60, run] = arg;
        let t = 0, best = 1e9, stall = 0;
        key.shift = !!run;
        while (t < secs && S.phase === 'playing') {
          const d = Math.hypot(tx - S.player.x, tz - S.player.z);
          if (d < 0.6) break;
          if (d < best - 0.05) { best = d; stall = 0; } else if ((stall += 0.05) > 3) break;
          S.camera.yaw = Math.atan2(tx - S.player.x, tz - S.player.z); key.w = true;
          update(0.05); t += 0.05;
        }
        key.w = false; key.shift = false;
        return { x: +S.player.x.toFixed(2), z: +S.player.z.toFixed(2), y: +S.player.y.toFixed(2), d: +Math.hypot(tx - S.player.x, tz - S.player.z).toFixed(2), t: +t.toFixed(1), ferry: S.ferry.phase, on: S.ferry.on, landed: S.ferry.landed, place: S.place, near: S.near && S.near.kind };
      }
      case 'visual': return { beacons: A.beacons.map((b) => ({ id: b.spot.id, on: b.group.visible, visible: b.group.visible, score: b.spot.score || 0 })) };
      case 'photo': { const s = spotById(arg || (S.near && S.near.spot && S.near.spot.id)); if (s) { goto(s.pos[0], s.pos[1]); aimAtSpot(s); takePhoto(s); } return stateSnapshot(); }
      case 'drive': {
        const [thr, st, secs] = Array.isArray(arg) ? arg : [1, 0, 2];
        S.mode = 'car';
        key.w = thr > 0; key.s = thr < 0; key.a = st < 0; key.d = st > 0;
        for (let i = 0; i < (secs || 2) * 60; i++) updateCar(1 / 60);
        key.w = key.a = key.d = key.s = false;
        syncActors();
        return stateSnapshot();
      }
      case 'callTaxi': callTaxi(); return stateSnapshot();
      case 'hurt': loseRun('测试 · 手动结束'); return stateSnapshot();
      case 'phone': openPhone(arg || null); return stateSnapshot();
      case 'phoneClose': closePhone(); return stateSnapshot();
      case 'phoneAct': { const b = PH.screen.querySelector(`[data-act="${arg}"]`); if (b) b.click(); return Object.assign(stateSnapshot(), { clicked: !!b }); }
      case 'phoneText': return { app: S.ph.app, text: PH.screen.textContent.replace(/\s+/g, ' ').trim(), acts: [...PH.screen.querySelectorAll('[data-act]')].map((b) => b.dataset.act) };
      case 'accept': acceptJob(arg); return stateSnapshot();
      case 'clock': S.clock = CLOCK_START + (+arg || 0); return stateSnapshot();
      case 'ending': endRun(arg || 'ferry'); return stateSnapshot();
      case 'carry': S.carry[arg] = arg === 'coffee' ? { t: S.clock, fav: true } : true; return stateSnapshot();
      case 'reset': resetGame(); setPhase('menu'); return stateSnapshot();
      case 'selftest': return selftest();
      case 'plan': return {
        key: 'E', farPoint: [S.player.x + 40, S.player.z + 40],
        targets: PHOTO_IDS.map((id) => ({ id, pos: spotById(id).pos })), required: 5,
      };
      default: return stateSnapshot();
    }
  };
  window.__GAME = { state: S, actions: { start: startRun, pause: pauseGame, resume: resumeGame, reset: resetGame, interact }, reset: resetGame };
  window.__DRONE = { state: S.drone, launch: launchDrone, recover: returnDrone, photo: dronePhoto, view: toggleDroneView };
  window.__CRUISE = { state: S.cruise, enter: enterCruise, exit: exitCruise, saloon: enterSaloon, saloonExit: exitSaloon, inside: () => S.saloonInside };
  window.__CAFE = { inside: () => S.place === 'cafe', enter: enterCafe, exit: exitCafe, order: () => buy('cafeOrder') };
  window.__MALL = { inside: () => S.place === 'mall', enter: enterMall, exit: exitMall };
  window.__LOBBY = { inside: () => S.place === 'lobby', enter: enterLobby, exit: exitLobby };
  const _cy0 = C.carYaw || Math.PI;
  const _right = [Math.cos(_cy0), -Math.sin(_cy0)];
  const _fwd = [Math.sin(_cy0), Math.cos(_cy0)];
  const _close = [
    C.carStart[0] + _right[0] * 2.8 - _fwd[0] * 7.2, 1.45, C.carStart[1] + _right[1] * 2.8 - _fwd[1] * 7.2,
    C.carStart[0], 0.9, C.carStart[1],
  ];
  window.__PRODUCT = {
    title: { name: '魔都夜行 MODU NIGHT WALK', start: '#title', hud: '#hud', hudHiddenOnTitle: true },
    screens: ['menu', 'playing', 'paused', 'settings', 'lost', 'won'],
    ui: { start: '#title', hud: '#hud', pause: '#pause', settings: '#settings', end: '#end', touch: '#touch', prompt: '#prompt', phone: '#phone' },
    settings: ['sensitivity', 'volume', 'fov', 'invertY', 'quality', 'rain'],
    persistence: ['nightwalk.best', 'nightwalk.settings', 'nightwalk.endings', 'nightwalk.grade', 'nightwalk.pins'],
    input: { keyboard: true, mouse: true, touch: true },
    content: {
      objectives: [{ id: 'commissions', title: '今夜委托', steps: JOB_DEFS.length }, { id: 'postcards', title: '五张城市明信片', steps: 5 }, { id: 'home', title: '回家：渡轮 / N1 / 出租车', steps: 3 }, { id: 'journal', title: '城市手账', steps: STAMP_TOTAL }],
      roles: ['pedestrian', 'driver', 'photographer', 'courier', 'taxi-passenger', 'ferry-passenger', 'bus-passenger'],
      tools: ['phone', 'messages', 'camera-viewfinder', 'map', 'taxi-app', 'drone', 'river-cruise', 'rental-car', 'wallet', 'journal', 'timetable'],
      beats: ['intro', 'messages', 'commissions', 'last-ferry', 'storm', 'light-show', 'night-bus', 'ending'],
      endings: Object.keys(ENDINGS),
    },
    hud: ['objective', 'compass', 'health', 'prompt', 'subtitles', 'clock', 'wallet', 'phone', 'drone'],
    audio: { events: 16, mute: true },
    perf: { maxCalls: 2400, maxTris: 2450000, maxLights: 12 },
    cameras: [
      { name: 'hero', cam: [-860, 22, 240, -150, 170, -60] },
      { name: 'close', cam: _close },
    ],
    test: { start: 'start', pause: 'pause', resume: 'resume', settings: 'openSettings', save: 'save' },
  };
  window.__READY = false;
  window.__AUDIT = [];

  // ------------------------------------------------------------- events
  const keyMap = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Space: 'space', ShiftLeft: 'shift', ShiftRight: 'shift', Digit0: 'zero', Digit1: 'one', Digit2: 'two', Digit3: 'three', Digit4: 'four', Digit5: 'five' };
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      if (S.phase === 'playing' && !S.overlay) { Audio.init(); togglePhone(); }
      return;
    }
    if (S.ph.open && !S.overlay) {
      if (e.code === 'Escape') { closePhone(); return; }
      if (e.code === 'Backspace') { e.preventDefault(); phoneBack(); return; }
    }
    if (S.overlay) {
      if (e.code === 'Escape' || (e.code === 'KeyM' && S.overlay === 'map') || (e.code === 'KeyH' && S.overlay === 'manual')) { closeOverlay(); e.preventDefault(); return; }
      if (e.code === 'KeyH' && S.overlay === 'map') { closeOverlay(true); openManual(); return; }
      if (e.code === 'KeyM' && S.overlay === 'manual' && S.phase === 'playing') { closeOverlay(true); openMap(); return; }
      if (S.overlay === 'map' && (e.code === 'Equal' || e.code === 'NumpadAdd')) zoomAt(MAPUI.w / 2, MAPUI.h / 2, 1.4);
      if (S.overlay === 'map' && (e.code === 'Minus' || e.code === 'NumpadSubtract')) zoomAt(MAPUI.w / 2, MAPUI.h / 2, 1 / 1.4);
      return;
    }
    if (e.code === 'KeyH' && (S.phase === 'playing' || S.phase === 'menu' || S.phase === 'paused')) { if (S.phase === 'paused') resumeGame(); toggleManual(); return; }
    if (e.code === 'KeyM' && (S.phase === 'playing' || S.phase === 'paused') && S.mode !== 'drone') { if (S.phase === 'paused') resumeGame(); if (S.ph.open) closePhone(true); toggleMap(); return; }
    if (keyMap[e.code]) { key[keyMap[e.code]] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); }
    if (e.code === 'Enter' && S.phase === 'menu') { Audio.init(); startRun(); }
    if (e.code === 'KeyV' && S.phase === 'playing') { if (S.mode === 'drone') returnDrone(); else if (S.mode === 'foot' && !inRoom() && !S.ferry.on) launchDrone(); }
    if (S.mode === 'drone') {
      if (e.code === 'KeyC') { toggleDroneView(); return; }
      if (e.code === 'KeyR') { returnDrone(); return; }
      if (e.code === 'KeyE') { dronePhoto(); return; }
      if (e.code === 'KeyF' || e.code === 'KeyT') return;
    }
    if (e.code === 'KeyQ' && S.phase === 'playing') { if (S.aim.active) lowerCamera(); else raiseCamera(); }
    if (e.code === 'KeyJ' && S.phase === 'playing') toggleJournal();
    if (e.code === 'KeyE') { if (S.phase === 'playing') interact(); }
    if (e.code === 'KeyF') {
      if (S.phase === 'playing') {
        if (S.mode === 'foot' && S.near && S.near.kind === 'enterCar') enterCar();
        else if (S.mode === 'car') exitCar();
      }
    }
    if (e.code === 'KeyT') { if (S.phase === 'playing') callTaxi(); }
    if (e.code === 'Escape') {
      // the Esc that released the pointer lock has already paused
      if (performance.now() - unlockAt < 400) return;
      if (S.aim.active) { lowerCamera(); return; }

      if (S.phase === 'playing') pauseGame(); else if (S.phase === 'paused') resumeGame(); else if (S.phase === 'settings') closeSettings();
    }
    if (e.code === 'KeyN') { const muted = SET.volume > 0; SET.volume = muted ? 0 : 0.7; Audio.setVolume(SET.volume); syncSettingsUI(); toast(muted ? '静音' : '声音开启'); saveAll(); }
    if (e.code === 'KeyR' && (S.phase === 'lost' || S.phase === 'won')) restartRun();
    if (e.code === 'KeyP' && S.phase === 'playing') pauseGame();
    if (e.code === 'KeyO' && S.phase === 'playing' && S.mode === 'foot' && !inRoom()) { S.firstPerson = !S.firstPerson; toast(S.firstPerson ? '第一人称 · O 切回' : '第三人称'); }
  });
  window.addEventListener('keyup', (e) => { if (keyMap[e.code]) key[keyMap[e.code]] = false; });

  const canvas = $('c');
  // Desktop: a click on the view locks the pointer and the camera follows the
  // mouse from then on (Esc releases it and pauses). Touch and the setting
  // switched off fall back to click-and-drag.
  let lockQuiet = false, unlockAt = -1e9, lockHinted = false;
  const lockWanted = () => SET.mouseLock !== false && !isTouch && !!canvas.requestPointerLock;
  function releaseMouse() { if (document.pointerLockElement === canvas) { lockQuiet = true; document.exitPointerLock(); } }
  document.addEventListener('pointerlockchange', () => {
    mouseLocked = document.pointerLockElement === canvas;
    document.body.classList.toggle('mouse-locked', mouseLocked);
    if (mouseLocked) { dragging = false; canvas.style.cursor = ''; if (!lockHinted) { lockHinted = true; toast('视角跟随鼠标 · Esc 释放鼠标'); } return; }
    unlockAt = performance.now();
    if (!lockQuiet && S.phase === 'playing' && !S.ph.open && !S.overlay) { if (S.aim.active) lowerCamera(); else pauseGame(); }
    lockQuiet = false;
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (S.phase !== 'playing') return;
    Audio.init();
    if (mouseLocked) {
      // locked: the left button is the shutter
      if (e.button === 0) { if (S.mode === 'drone') dronePhoto(); else if (S.aim.active && S.near && S.near.kind === 'photo') interact(); }
      return;
    }
    if (e.pointerType === 'mouse' && lockWanted() && !S.ph.open && !S.overlay) {
      try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) {}
    }
    dragging = true; lastPX = e.clientX; lastPY = e.clientY; pointerId = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (S.phase !== 'playing') return;
    if (!mouseLocked && e.pointerId !== pointerId) return;
    let dx, dy;
    if (mouseLocked) { dx = e.movementX || 0; dy = e.movementY || 0; lastMouseT = S.realTime; }
    else {
      if (!dragging) return;
      dx = e.clientX - lastPX; dy = e.clientY - lastPY;
      lastPX = e.clientX; lastPY = e.clientY;
    }
    const sens = 0.0034 * SET.sensitivity;
    const inv = SET.invertY ? -1 : 1;
    if (S.mode === 'drone') {
      S.camera.yaw += dx * sens;
      S.camera.pitch = clamp(S.camera.pitch + dy * 0.0022 * inv, -0.35, 1.05);
    } else if (S.mode === 'foot' || S.mode === 'cruise') {
      S.camera.yaw += dx * sens;
      S.camera.pitch = clamp(S.camera.pitch + dy * 0.0022 * inv, -0.6, 1.3);
      if (S.mode === 'cruise' && S.saloonInside) S.camera.orbit = S.camera.yaw;
    } else {
      S.camera.orbit = clamp(S.camera.orbit + dx * sens, -1.6, 1.6);
      S.camera.pitch = clamp(S.camera.pitch + dy * 0.0018 * inv, 0.05, 0.6);
    }
  });
  const endDrag = (e) => { if (e && e.pointerId !== pointerId) return; dragging = false; canvas.style.cursor = ''; };
  // the minimap opens the big map (the only way in on a touch screen)
  el.map.addEventListener('click', () => { if (S.phase === 'playing' && S.mode !== 'drone' && !S.overlay) { if (S.ph.open) closePhone(true); toggleMap(); } });
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (e) => {
    if (S.phase !== 'playing') return;
    if (S.aim.active) { S.aim.fov = clamp(S.aim.fov + Math.sign(e.deltaY) * 3, 26, 62); e.preventDefault(); return; }
    if (S.mode === 'car' || S.mode === 'taxi') S.camera.dist = clamp((S.camera.dist || 6.2) + Math.sign(e.deltaY) * 0.4, 4, 10);
  }, { passive: false });

  // touch
  const isTouch = (navigator.maxTouchPoints > 0) || matchMedia('(pointer: coarse)').matches || innerWidth < 900;
  if (isTouch) document.body.classList.add('touch-on');
  const stickZone = $('stick-zone'), knob = $('stick-knob');
  let stickId = null, stickCX = 0, stickCY = 0;
  function stickStart(e) {
    stickId = e.pointerId; const r = stickZone.getBoundingClientRect(); stickCX = r.left + r.width / 2; stickCY = r.top + r.height / 2;
    touch.active = true; stickMove(e); e.preventDefault();
  }
  function stickMove(e) {
    if (e.pointerId !== stickId) return;
    const dx = clamp((e.clientX - stickCX) / 46, -1, 1), dy = clamp((e.clientY - stickCY) / 46, -1, 1);
    touch.str = dx; touch.fwd = dy;
    knob.style.transform = `translate(${dx * 38}px,${dy * 38}px)`;
    e.preventDefault();
  }
  function stickEnd(e) { if (e.pointerId !== stickId) return; stickId = null; touch.active = false; touch.str = 0; touch.fwd = 0; knob.style.transform = ''; }
  stickZone.addEventListener('pointerdown', stickStart);
  stickZone.addEventListener('pointermove', stickMove);
  stickZone.addEventListener('pointerup', stickEnd);
  stickZone.addEventListener('pointercancel', stickEnd);
  $('tb-nitro').addEventListener('pointerdown', (e) => { key.shift = true; e.preventDefault(); });
  $('tb-nitro').addEventListener('pointerup', () => { key.shift = false; });
  // on foot the brake button is the camera (there is no Q on a touch screen)
  $('tb-brake').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (S.mode === 'foot' && S.phase === 'playing') { if (S.aim.active) lowerCamera(); else raiseCamera(); return; }
    key.space = true;
  });
  $('tb-brake').addEventListener('pointerup', () => { key.space = false; });
  $('tb-act').addEventListener('click', () => { if (S.mode === 'drone') dronePhoto(); else if (S.mode === 'foot' && S.near && S.near.kind === 'drone') launchDrone(); else interact(); });
  $('tb-pause').addEventListener('click', () => { if (S.phase === 'playing') pauseGame(); else if (S.phase === 'paused') resumeGame(); });
  const tbDrone = $('tb-drone');
  if (tbDrone) tbDrone.addEventListener('click', () => { if (S.mode === 'drone') returnDrone(); else if (S.mode === 'foot' && !inRoom()) launchDrone(); });
  el.prompt.addEventListener('click', () => { if (!isTouch) return; if (S.near && S.near.kind === 'drone') launchDrone(); else interact(); });
  if (el.droneChip) el.droneChip.addEventListener('click', () => { Audio.init(); if (S.phase === 'playing' && S.mode === 'foot' && !inRoom()) launchDrone(); });
  const dtUp = $('dt-up'), dtDown = $('dt-down');
  if (dtUp) {
    dtUp.addEventListener('pointerdown', (e) => { key.space = true; e.preventDefault(); });
    dtUp.addEventListener('pointerup', () => { key.space = false; });
    dtUp.addEventListener('pointercancel', () => { key.space = false; });
    dtDown.addEventListener('pointerdown', (e) => { key.shift = true; e.preventDefault(); });
    dtDown.addEventListener('pointerup', () => { key.shift = false; });
    dtDown.addEventListener('pointercancel', () => { key.shift = false; });
    $('dt-view').addEventListener('click', () => toggleDroneView());
    $('dt-shot').addEventListener('click', () => dronePhoto());
    $('dt-return').addEventListener('click', () => returnDrone());
  }

  window.addEventListener('resize', () => { G.resize(); });
  window.addEventListener('blur', () => { for (const k of Object.keys(key)) key[k] = false; });

  // ------------------------------------------------------------- boot / debug query flags
  const DEBUG_FLAGS = ['play', 'car', 'drive', 'cruise', 'photo', 'drone', 'boat', 'saloon', 'cafe', 'mall', 'bookshop', 'bakery', 'records', 'postcard', 'umbrella', 'flower', 'coffeeshop', 'lobby', 'l2', 'l2scope', 'bar', 'taxi', 'ring', 'boardwalk', 'skyway', 'ferryhall', 'l3', 'clock', 'phone', 'end', 'ferry', 'puxi', 'home'];
  if (DEBUG_FLAGS.some((f) => Q.get(f))) {
    startRun();
    if (Q.get('tunnel')) setTimeout(() => {
      // tunnel=<ramp id>:<arc from the portal>, e.g. xs-in:60 (negative = inside the bore)
      const [id, sv] = Q.get('tunnel').split(':'), R = C.tunnels && C.tunnels.byId[id];
      if (!R) return;
      const s = isFinite(+sv) ? +sv : 60, p = C.tunnelPlace(R, s, R.kind === 'in' ? 2 : -2);
      S.car.x = p.x; S.car.z = p.z; S.car.yaw = R.kind === 'in' ? p.yaw + Math.PI : p.yaw;
      S.car.tun = s < R.L ? R : null; C.tunnelMove(S.car, p.x, p.z, 1.05);
      S.player.x = p.x; S.player.z = p.z; enterCar();
      if (Q.get('drive') !== '1') { S.car.speed = 0; }
    }, 90);
    if (Q.get('at')) setTimeout(() => {
      // at=x,z[,yaw]: put the walker there, camera behind
      const [x, z, yw] = Q.get('at').split(',').map(Number);
      goto(x, z); if (isFinite(yw)) { S.player.yaw = yw; S.camera.yaw = yw; }
      detectInteraction(); syncActors();
    }, 120);
    if (Q.get('car') === '1' || Q.get('drive') === '1') setTimeout(() => { enterCar(); }, 80);
    if (Q.get('drive') === '1') setTimeout(() => { key.w = true; }, 260);
    if (Q.get('turn') === '1') setTimeout(() => { key.w = true; key.d = true; }, 260);
    if (Q.get('cruise') === '1') setTimeout(() => { enterCar(); __TEST('drive', [1, 0, 2]); }, 260);
    if (Q.get('photo')) setTimeout(() => { const sp = spotById(Q.get('photo')); if (sp) { goto(sp.pos[0], sp.pos[1]); setTimeout(() => { aimAtSpot(sp); takePhoto(sp); }, 120); } }, 200);
    if (Q.get('boat') === '1') setTimeout(() => { enterCruise(); }, 260);
    if (Q.get('saloon') === '1') setTimeout(() => { enterCruise(); setTimeout(() => enterSaloon(), 120); }, 40);
    if (Q.get('cafe') === '1') setTimeout(() => { enterCafe(); }, 260);
    if (Q.get('mall') === '1') setTimeout(() => { enterMall(); }, 260);
    if (Q.get('bookshop') === '1') setTimeout(() => { enterMall(); setTimeout(() => enterBookshop(), 120); }, 40);
    if (Q.get('bakery') === '1') setTimeout(() => { enterMall(); setTimeout(() => enterBakery(), 120); }, 40);
    if (Q.get('records') === '1') setTimeout(() => { enterMall(); setTimeout(() => enterRecords(), 120); }, 40);
    if (Q.get('postcard') === '1') setTimeout(() => { enterMall(); setTimeout(() => enterPostcard(), 120); }, 40);
    if (Q.get('umbrella') === '1') setTimeout(() => { enterMall(); setTimeout(() => enterUmbrella(), 120); }, 40);
    if (Q.get('flower') === '1') setTimeout(() => { enterMall(); setTimeout(() => enterFlower(), 120); }, 40);
    if (Q.get('coffeeshop') === '1') setTimeout(() => { enterMall(); setTimeout(() => enterCoffeeShop(), 120); }, 40);
    if (Q.get('l2') === '1') setTimeout(() => { enterLobby(); setTimeout(() => enterL2(), 120); }, 40);
    if (Q.get('l2scope') === '1') setTimeout(() => { enterLobby(); setTimeout(() => { enterL2(); setTimeout(() => enterL2Scope(), 120); }, 120); }, 40);
    if (Q.get('l3') === '1') setTimeout(() => { enterLobby(); setTimeout(() => { enterL2(); setTimeout(() => enterL3(), 160); }, 120); }, 40);
    if (Q.get('bar') === '1') setTimeout(() => { enterBar(); }, 40);
    if (Q.get('taxi') === '1') setTimeout(() => { S.player.x = C.taxiStart[0] + 2; S.player.z = C.taxiStart[1] + 1; S.player.y = A.groundY(S.player.x, S.player.z); boardTaxi(); }, 60);
    if (Q.get('ring') === '1') setTimeout(() => { S.player.x = C.ringBridge.cx + Math.cos(Math.PI / 2) * (C.ringBridge.r1 + 1.6); S.player.z = C.ringBridge.cz + Math.sin(Math.PI / 2) * (C.ringBridge.r1 + 1.6); S.player.y = A.groundY(S.player.x, S.player.z); enterRing(); }, 60);
    if (Q.get('boardwalk') === '1') setTimeout(() => { S.player.x = -630.0; S.player.z = 100.2; S.player.y = A.groundY(S.player.x, S.player.z); enterBoardwalk(); }, 60);
    if (Q.get('skyway') === '1') setTimeout(() => { enterSkyway(false); }, 60);
    if (Q.get('ferryhall') === '1') setTimeout(() => { enterFerryHall(); }, 60);
    // ferry=1 boarding, ferry=<metres> under way, ferry=end alongside at 十八埠; puxi=1 ashore there; home=1 in 402
    const moorWest = () => { const R = C.ferryRide; R.place(R.west.x, R.west.z, R.west.yaw, 0); R.setRamps(0, R.rampUp); };
    if (Q.get('ferry')) setTimeout(() => {
      enterFerryHall(); startFerry();
      const v = Q.get('ferry'), F = S.ferry;
      if (v !== '1') { F.phase = 'sail'; F.t = 0; F.s = v === 'end' ? C.ferryRide.length - 0.5 : clamp(+v || 0, 0, C.ferryRide.length - 1); F.speed = 4.6; C.ferryRide.setRamps(C.ferryRide.rampUp, C.ferryRide.rampUp); rideFerry(0.001); }
    }, 80);
    if (Q.get('puxi') === '1' || Q.get('home') === '1') setTimeout(() => {
      enterFerryHall(); startFerry(); moorWest(); leaveFerry();
      if (Q.get('home') === '1') { const h = C.puxiHome; goto(h.door[0] + 1.3, h.door[1]); enterRoom('home'); }
    }, 80);
    if (Q.get('lobby') === '1') setTimeout(() => { enterLobby(); }, 260);
    if (Q.get('pin')) setTimeout(() => { const [x, z] = Q.get('pin').split(',').map(Number); if (isFinite(x) && isFinite(z)) navToPin(addPin(x, z)); }, 200);
    if (Q.get('map')) setTimeout(() => { const m = Q.get('map'); openMap(m !== '1' && m !== 'fit' ? { focus: m } : undefined); if (m === 'fit') $('bm-fit').click(); }, 300);
    if (Q.get('manual')) setTimeout(() => { openManual(Q.get('manual') !== '1' ? Q.get('manual') : undefined); }, 300);
    if (Q.get('clock')) { const [h, m] = Q.get('clock').split(':').map(Number); if (isFinite(h) && isFinite(m)) S.clock = (h < 12 ? h + 24 : h) * 60 + m; }
    if (Q.get('phone')) setTimeout(() => { const [a, s] = Q.get('phone').split(':'); openPhone(a, s); }, 400);
    if (Q.get('end')) setTimeout(() => { endRun(Q.get('end')); }, 400);
    if (Q.get('drone') === '1') setTimeout(() => {
      launchDrone();
      const d = S.drone;
      d.x = C.start[0] - 24; d.z = C.start[1] + 165; d.y = 78; d.home = [C.start[0], C.start[1]];
      d.yaw = Math.atan2(150 - d.x, 205 - d.z); S.camera.yaw = d.yaw; S.camera.pitch = 0.20;
      A.drone.group.position.set(d.x, d.y, d.z);
    }, 280);
  } else setPhase('menu');
  updateCameraMenu(0);
  el.best.textContent = BEST ? `${BEST} 分` : '—';
  requestAnimationFrame(loop);
})();
