  // ------------------------------------------------------------- photos (real framing)
  // The photo is scored from the actual viewfinder: NDC coverage of the
  // landmark, distance, tilt and occlusion — no scripted "aim assist".
  const _v = new THREE.Vector3();
  function landmarkOf(spot) {
    const L = spot.id !== 'lantan' && (C.landmarks || {})[spot.lm || spot.id];
    if (L) return { x: L.x, y: (L.h || 60) * 0.5, z: L.z, r: Math.max(18, (L.h || 60) * 0.09), h: L.h || 60 };
    if (spot.id === 'lantan') return { x: spot.target[0], y: 30, z: spot.target[2], r: 170, h: 60 };
    return { x: spot.target[0], y: spot.target[1], z: spot.target[2], r: 40, h: 80 };
  }
  function photoEval(spot, cam, fov) {
    const lm = landmarkOf(spot);
    const p = subject();
    const dx = lm.x - p.x, dz = lm.z - p.z;
    const dist = Math.hypot(dx, dz);
    cam.updateMatrixWorld();
    // project 12 sample points over the landmark envelope
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const a = (i % 4) / 4 * TAU, ring = i < 4 ? 0 : i < 8 ? 0.55 : 1;
      const y = lm.y + (i < 4 ? 0 : i < 8 ? lm.h * 0.28 : -lm.h * 0.28);
      pts.push([lm.x + Math.cos(a) * lm.r * ring, y, lm.z + Math.sin(a) * lm.r * ring]);
    }
    let inX = 0, inY = 0, nIn = 0, minX = 9, maxX = -9, minY = 9, maxY = -9, behind = 0;
    for (const q of pts) {
      _v.set(q[0], q[1], q[2]).project(cam);
      if (_v.z > 1) { behind++; continue; }
      minX = Math.min(minX, _v.x); maxX = Math.max(maxX, _v.x);
      minY = Math.min(minY, _v.y); maxY = Math.max(maxY, _v.y);
      if (Math.abs(_v.x) < 1 && Math.abs(_v.y) < 1) { inX += _v.x; inY += _v.y; nIn++; }
    }
    const visible = nIn >= 6 && behind <= 3;
    const spanX = Math.min(2, maxX - minX), spanY = Math.min(2, maxY - minY);
    const cover = clamp((spanX * spanY) / 1.15, 0, 1);                 // how much of the frame it fills
    const cx = nIn ? inX / nIn : 9, cy = nIn ? inY / nIn : 9;
    const centered = nIn ? clamp(1 - Math.hypot(cx, cy) / 0.85, 0, 1) : 0;
    const distS = clamp(1 - Math.max(0, dist - spot.radius) / (spot.maxDist || 200), 0, 1);
    const level = clamp(1 - Math.abs(cam.rotation.z || 0) / 0.16, 0, 1); // horizon tilt
    const eyeY = cam.position.y;
    const blocked = sightBlocked(p.x, eyeY, p.z, lm.x, lm.y * 0.55, lm.z, lm.x, lm.z, lm.r * 0.9);
    return { visible, cover, centered, distS, level, blocked, dist, zoom: clamp((70 - fov) / 45, 0, 1) };
  }
  function photoScore(ev) {
    if (!ev.visible) return 0;
    let s = 40 + ev.cover * 26 + ev.centered * 16 + ev.distS * 10 + ev.level * 6 + ev.zoom * 4;
    if (ev.blocked) s *= 0.45;
    return Math.round(clamp(s, 5, 100));
  }
  function photoGrade(score) { return score >= 88 ? 'S' : score >= 72 ? 'A' : score >= 55 ? 'B' : score >= 38 ? 'C' : 'D'; }
  function nearestPhotoSpot() {
    const p = subject();
    let best = null, bd = 1e9;
    for (const s of C.spots) {
      if (s.id === 'ferry' || S.photos.includes(s.id)) continue;
      const d = Math.hypot(s.pos[0] - p.x, s.pos[1] - p.z);
      if (d < s.radius * 1.6 && d < bd) { bd = d; best = s; }
    }
    return best;
  }
  function ferryDist() { const p = subject(); return Math.hypot(C.ferry[0] - p.x, C.ferry[1] - p.z); }
  function takePhoto(spot) {
    if (!spot || S.photos.includes(spot.id)) return;
    const ev = photoEval(spot, camera, camera.fov);
    if (!ev.visible) { Audio.deny(); toast('取景框里没有' + spot.name + ' · 换个角度'); return; }
    const show_ = S.lightShow;
    const score = Math.min(100, photoScore(ev) + (show_ ? 8 : 0));
    S.photos.push(spot.id);
    S.shots[spot.id] = score;
    S.photoScore += score;
    spot.score = score;
    stamp('photo-' + spot.id, spot.name);
    flashPhoto(); Audio.shutter();
    setTimeout(() => {
      el.pcArt.setAttribute('data-kind', spot.kind);
      el.pcArtName.textContent = spot.en || spot.name;
      el.pcName.textContent = `${spot.name} · ${photoGrade(score)} 级`;
      el.pcScore.textContent = '+' + score;
      if (el.pcStamp) el.pcStamp.innerHTML = fmtClock(S.clock).replace(':', '<br>');
      show(el.postcard, true);
      S.postcardUntil = S.realTime + 3.4;
    }, 120);
    Audio.chime();
    if (S.photos.length >= 5) {
      subtitle(isActive('postcards') ? '五张齐了。打开手机「相册」，发给老周。' : '五张都拍到了。', '旁白', 5);
      toast('五张明信片 · Tab 打开手机「相册」发给老周', 3.2);
    } else {
      subtitle(`${show_ ? '灯光秀正亮，' : ''}${photoGrade(score)} 级。还差 ${5 - S.photos.length} 张，离你最近的是${nextSpot().name}。`, '旁白', 4);
      toast(`明信片 ${S.photos.length} / 5 · +${score}${show_ ? '（灯光秀 +8）' : ''}`);
    }
    if (S.aim.active) lowerCamera();
  }
  // ------------------------------------------------------------- viewfinder
  function raiseCamera() {
    if (S.phase !== 'playing' || S.mode !== 'foot' || inRoom()) return;
    S.aim.active = true; S.aim.fov = 50; S.aim.result = null;
    document.body.classList.add('aim-on');
    show(el.viewfinder, true);
    Audio.focus();
  }
  function lowerCamera() {
    S.aim.active = false;
    document.body.classList.remove('aim-on');
    show(el.viewfinder, false);
    camera.fov = baseFov(); camera.updateProjectionMatrix();
  }
  function updateAim(dt) {
    if (!S.aim.active) return;
    S.aim.fov = clamp(S.aim.fov, 26, 62);
    camera.fov = damp(camera.fov, S.aim.fov, 8, dt);
    camera.updateProjectionMatrix();
    if (S.realTime - S.aim.lastEval < 0.1) return;
    S.aim.lastEval = S.realTime;
    let best = null, bs = 0;
    for (const s of C.spots) {
      if (s.id === 'ferry') continue;
      const ev = photoEval(s, camera, S.aim.fov);
      const sc = photoScore(ev);
      if (ev.visible && sc > bs) { bs = sc; best = { s, ev }; }
    }
    S.aim.result = best ? { spot: best.s, score: bs, ev: best.ev } : null;
    if (S.aim.result) {
      const r = S.aim.result;
      setText(el.vfLabel, `${r.spot.name} · ${r.score} 分 · ${photoGrade(r.score)} 级`);
      const warn = [];
      if (r.ev.blocked) warn.push('有遮挡');
      if (r.ev.cover < 0.35) warn.push('太远/未放大');
      if (r.ev.centered < 0.4) warn.push('偏离中心');
      if (r.ev.level < 0.5) warn.push('水平倾斜');
      setText(el.vfInfo, warn.length ? warn.join(' · ') : '构图良好 · E 拍摄');
      el.vfLabel.classList.toggle('ok', !warn.length);
    } else {
      setText(el.vfLabel, '寻找取景目标…');
      setText(el.vfInfo, '把地标放进框内 · 滚轮变焦');
      el.vfLabel.classList.remove('ok');
    }
  }

  // ------------------------------------------------------------- actors sync
  const indoorNow = () => inRoom() || S.saloonInside || S.mode === 'car' || S.mode === 'taxi';
  function syncActors() {
    A.car.group.position.set(S.car.x, (S.car.tun ? S.car.tunY : 0) + 0.02, S.car.z);
    A.car.group.rotation.y = S.car.yaw;
    A.taxi.group.position.set(S.taxi.x, 0.02, S.taxi.z);
    A.taxi.group.rotation.y = S.taxi.yaw;
    A.visitor.group.visible = !S.firstPerson && !indoorNow() && S.view !== 'telescope';
    A.visitor.group.position.set(S.player.x, S.player.y, S.player.z);
    A.visitor.group.rotation.y = S.player.yaw;
    A.lightRig.position.set(S.car.x, S.car.tun ? S.car.tunY : 0, S.car.z);
    A.lightRig.rotation.y = S.car.yaw;
    A.lightRig.visible = S.mode === 'car';
  }

  // ------------------------------------------------------------- update: foot
  // ------------------------------------------------------------- walkable decks
  // Everything above the street that you can walk on (stairs, the Pearl ring,
  // the skyway, the riverside boardwalk, the lobby galleries) is listed in
  // C.decks. A walker on a deck ignores the street colliders below it and is
  // held in by the deck edges; stairs that reach the ground hand over to it.
  const DECKS = C.decks || [];
  const DECK_PLACES = { ring: '星珠环', skyway: '空中连廊', boardwalk: '滨江步道' };
  const inRoom = () => !!S.place && !DECK_PLACES[S.place];
  function deckH(d, x, z) {
    if (d.type === 'ring') { const r = Math.hypot(x - d.cx, z - d.cz); return r >= d.r0 && r <= d.r1 ? d.y : null; }
    if (d.type === 'rect') return x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1 ? d.y : null;
    const ux = d.bx - d.ax, uz = d.bz - d.az, L2 = ux * ux + uz * uz;
    const t = ((x - d.ax) * ux + (z - d.az) * uz) / L2;
    if (t < 0 || t > 1) return null;
    if (Math.abs((x - d.ax) * uz - (z - d.az) * ux) / Math.sqrt(L2) > d.hw) return null;
    return d.ya + (d.yb - d.ya) * t;
  }
  function deckAt(x, z, y, tol) {
    let best = null, bd = tol;
    for (const d of DECKS) {
      const h = deckH(d, x, z);
      if (h !== null && Math.abs(h - y) <= bd) { bd = Math.abs(h - y); best = { d, h }; }
    }
    return best;
  }
  function boardDeck(hit) {
    const P = S.player;
    P.deck = !!hit; P.deckRef = hit ? hit.d : null;
    if (hit) P.y = hit.h;
  }
  // a walker on a deck: slide along the edges, step off only where the floor below is level with the deck
  function stepDeck(dx, dz) {
    const P = S.player, n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
    for (let k = 0; k < n; k++) {
      let moved = false;
      for (const [sx, sz] of [[dx / n, dz / n], [dx / n, 0], [0, dz / n]]) {
        if (!sx && !sz) continue;
        const nx = P.x + sx, nz = P.z + sz, hit = deckAt(nx, nz, P.y, 0.42);
        if (hit) { P.x = nx; P.z = nz; P.y = hit.h; P.deckRef = hit.d; moved = true; break; }
        const gy = A.groundY(nx, nz);
        if (Math.abs(gy - P.y) < 0.42 && !insideAny(nx, nz, 0.38)) { P.x = nx; P.z = nz; P.y = gy; P.deck = false; P.deckRef = null; return; }
      }
      if (!moved) return;
    }
  }
  // the named decks count as places for the journal and the HUD, rooms keep theirs
  function syncDeckPlace() {
    if (inRoom()) return;
    const d = S.player.deck ? S.player.deckRef : null;
    const np = (d && d.place) || null;
    if (np === S.place) return;
    S.place = np;
    if (np && stamp(np, DECK_PLACES[np])) {
      const line = { ring: '星珠环。脚下是临江嘴环岛的车流，四周是临江嘴的夜。', skyway: '空中连廊。一头接星珠环，一头落在明澜广场门前。', boardwalk: '滨江上层步道。脚下是亲水平台，风从江面吹上来。' }[np];
      subtitle(line, '旁白', 5);
    }
    updateHUD();
  }
  function updateFoot(dt) {
    if (S.ferry.on) { rideFerry(dt); return; }
    const P = S.player;
    // aiming slows you to a careful walk
    let f = (key.w || key.up ? 1 : 0) - (key.s || key.down ? 1 : 0);
    let st = (key.d || key.right ? 1 : 0) - (key.a || key.left ? 1 : 0);
    if (touch.active) { f += -touch.fwd; st += touch.str; }
    // looking at the phone: you stop where you stand, the night goes on
    if (S.ph.open) { f = 0; st = 0; }
    f = clamp(f, -1, 1); st = clamp(st, -1, 1);
    const mag = Math.hypot(f, st);
    if (mag > 0.05 && S.waitBus) cancelBusWait();
    const cold = S.warmth < 25;
    const sprint = key.shift && S.stamina > 2 && mag > 0.1 && !S.aim.active && !cold;
    if (mag > 0.05) {
      f /= mag; st /= mag;
      const cy = S.camera.yaw;
      const mx = Math.sin(cy) * f - Math.cos(cy) * st;
      const mz = Math.cos(cy) * f + Math.sin(cy) * st;
      const targetYaw = Math.atan2(mx, mz);
      P.yaw += wrapAngle(targetYaw - P.yaw) * Math.min(1, dt * 9);
      const sp = S.aim.active ? 1.1 : sprint ? 5.2 : cold ? 1.7 : 2.15;
      P.speed = damp(P.speed, sp, 7, dt);
      P.moving = true; P.sprint = sprint;
      if (P.deck) stepDeck(mx * P.speed * dt, mz * P.speed * dt);
      else {
        C.deepMover = !!P.tun;
        const [nx, nz] = moveCircle(P.x, P.z, mx * P.speed * dt, mz * P.speed * dt, 0.38);
        C.deepMover = false;
        P.x = nx; P.z = nz;
        const tm = C.tunnelMove ? C.tunnelMove(P, nx, nz, 0.38, 2.0) : null;
        if (tm) {
          P.x = tm.x; P.z = tm.z;
          if (tm.s <= 2.01 && S.realTime - (P.tunWarn || -9) > 4) { P.tunWarn = S.realTime; toast('行人禁止进入隧道'); }
        }
        const hit = deckAt(nx, nz, P.y, 0.42);
        if (hit) boardDeck(hit);
      }
      P.walkPhase += dt * (sprint ? 13 : 8);
      if (S.realTime - lastStep > (sprint ? 0.28 : 0.5)) { Audio.step(); lastStep = S.realTime; }
    } else {
      P.speed = damp(P.speed, 0, 10, dt);
      P.moving = false; P.sprint = false;
      P.walkPhase = damp(P.walkPhase, Math.round(P.walkPhase / Math.PI) * Math.PI, 4, dt);
    }
    if (!P.deck) P.y = clamp(damp(P.y, A.groundY(P.x, P.z), 12, dt), -7, 40);
    syncDeckPlace();
    syncRoomByFoot();
    if (sprint) S.stamina = Math.max(0, S.stamina - dt * 13);
    else S.stamina = Math.min(100, S.stamina + dt * (mag > 0.1 ? 3 : 8));
    animVisitor(dt);
    if (A.car.spotlights) { A.car.spotlights[0].intensity = 0; A.car.spotlights[1].intensity = 0; }
    Audio.engineState(0, false);
  }
  function animVisitor(dt) {
    const P = S.player;
    if (A.animateVisitor) {
      A.animateVisitor({ moving: P.moving, sprint: P.sprint, phase: P.walkPhase, t: S.realTime, dt, pose: S.view === 'sit' || S.view === 'terrace' ? 'sit' : 'walk', umbrella: S.umbrella, aim: S.aim.active });
      return;
    }
    const swing = P.moving ? Math.sin(P.walkPhase) * (P.sprint ? 0.62 : 0.44) : 0;
    const V = A.visitor;
    V.legs[0].hip.rotation.x = swing; V.legs[1].hip.rotation.x = -swing;
    V.legs[0].knee.rotation.x = Math.max(0, -swing) * 1.15 + 0.05;
    V.legs[1].knee.rotation.x = Math.max(0, swing) * 1.15 + 0.05;
    V.arms[0].shoulder.rotation.x = -swing * 0.62;
    V.arms[1].shoulder.rotation.x = swing * 0.18;
    V.arms[0].elbow.rotation.x = -0.22 - Math.max(0, swing) * 0.28;
    V.arms[1].elbow.rotation.x = -0.42;
    V.hips.position.y = 0.94 + (P.moving ? Math.abs(Math.sin(P.walkPhase * 2)) * 0.022 : Math.sin(S.realTime * 1.5) * 0.004);
    V.group.position.set(P.x, P.y, P.z);
    V.group.rotation.y = P.yaw;
  }

  // ------------------------------------------------------------- update: car
  // ---- the river crossing: inbound bore -> fade -> outbound bore of the same tunnel
  const veil = (() => { const d = document.createElement('div'); d.id = 'tunnel-veil'; d.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:40'; document.body.appendChild(d); return d; })();
  function tickCrossing(dt) {
    const X = S.crossing, c = S.car;
    X.t += dt;
    if (!X.done && X.t >= 0.55) {
      X.done = true;
      const p = C.tunnelPlace(X.to, -30, -2.0);
      c.x = p.x; c.z = p.z; c.yaw = p.yaw; c.slip = 0; c.steer = 0; c.speed = Math.max(c.speed, 11);
      c.tun = X.to; C.tunnelMove(c, c.x, c.z, 1.05);
      S.camera.followYaw = c.yaw; S.camera.orbit = 0;
      S.clock += 7; c.battery = Math.max(0, c.battery - 2.5);
      subtitle(`${X.from.name}：下穿申江，在申西那头的出口掉了个头，又从江底钻回来。来回七分钟。`, '旁白', 5.5);
    }
    veil.style.opacity = String(X.t < 0.55 ? X.t / 0.55 : X.t < 1.25 ? 1 : Math.max(0, 1 - (X.t - 1.25) / 0.7));
    if (X.t > 2.0) { S.crossing = null; veil.style.opacity = '0'; }
  }
  function updateCar(dt) {
    const c = S.car;
    if (S.crossing) tickCrossing(dt);
    const thr = key.w || key.up ? 1 : 0;
    const brk = key.s || key.down ? 1 : 0;
    const steer = (key.a || key.left ? 1 : 0) - (key.d || key.right ? 1 : 0);
    const hand = key.space;
    const lowBatt = c.battery <= 12;
    const maxSpeed = lowBatt ? 20 : 46;                       // an EV, no "nitro"
    c.throttle = damp(c.throttle || 0, thr, 9, dt);
    c.brake = damp(c.brake || 0, brk, 12, dt);
    if (c.throttle > 0.01) c.speed += (lowBatt ? 5 : 12.5) * c.throttle * dt;
    if (c.brake > 0.01) c.speed -= (c.speed > 0.4 ? 24 : 7.5) * c.brake * dt;
    if (thr === 0 && brk === 0) c.speed -= Math.sign(c.speed) * 2.6 * dt;
    if (hand) c.speed -= Math.sign(c.speed) * 8 * dt;
    c.speed = clamp(c.speed, -9, maxSpeed);
    c.battery = Math.max(0, c.battery - Math.abs(c.speed) * dt * 0.012);
    const steerLimit = 0.55 * (1 - Math.min(1, Math.abs(c.speed) / 54) * 0.78);
    c.steer = damp(c.steer, steer * steerLimit, 12, dt);
    let yawRate = 0;
    if (Math.abs(c.speed) > 0.15) yawRate = (c.speed / 2.72) * Math.tan(c.steer) * (hand ? 1.55 : 1);
    const maxYaw = clamp(1.75 - Math.abs(c.speed) * 0.026, 0.55, 1.75) * (hand ? 1.25 : 1);
    yawRate = clamp(yawRate, -maxYaw, maxYaw);
    c.yaw += yawRate * dt;
    c.slip = damp(c.slip || 0, -yawRate * Math.min(1, Math.abs(c.speed) / 22) * (hand ? 0.32 : 0.06), 5, dt);
    const travelYaw = c.yaw + (c.slip || 0);
    const fx = Math.sin(travelYaw), fz = Math.cos(travelYaw);
    const stepX = fx * c.speed * dt, stepZ = fz * c.speed * dt;
    C.deepMover = !!c.tun;
    let [nx, nz] = moveCircle(c.x, c.z, stepX, stepZ, 1.05);
    C.deepMover = false;
    const moved = Math.hypot(nx - c.x, nz - c.z), wanted = Math.hypot(stepX, stepZ);
    if (wanted > 0.02 && moved < wanted * 0.55 && Math.abs(c.speed) > 3) {
      const sev = Math.min(1, Math.abs(c.speed) / 20);
      c.speed *= 0.25;
      c.hp = Math.max(0, c.hp - 3 - sev * 10);
      S.camera.shake = Math.min(0.5, S.camera.shake + 0.18 + sev * 0.1);
      Audio.bump(0.1 + sev * 0.1);
      fine('crash');
      if (c.hp <= 0 && !c.broken) { c.broken = true; subtitle('车动不了了。双闪打上，今晚它就在这儿过夜——你打车吧。', '旁白', 5); }
    }
    // tunnel trench and bore: the walls hold the car, the floor sets its height
    const tm = C.tunnelMove ? C.tunnelMove(c, nx, nz, 1.05) : null;
    if (tm) {
      nx = tm.x; nz = tm.z;
      // a car scraping the wall is turned along it
      if (tm.hit && c.tun) {
        const ty = Math.atan2(c.tunT[0], c.tunT[1]), along = Math.sin(c.yaw) * c.tunT[0] + Math.cos(c.yaw) * c.tunT[1];
        c.yaw += wrapAngle((along >= 0 ? ty : ty + Math.PI) - c.yaw) * Math.min(1, dt * 2.5);
      }
      if (tm.hit && Math.abs(c.speed) > 5) {
        c.speed *= 0.97; S.camera.shake = Math.min(0.3, S.camera.shake + 0.03);
        if (S.realTime - (c.scrapeT || -9) > 0.7) { c.scrapeT = S.realTime; Audio.bump(0.05); }
      }
    }
    c.x = nx; c.z = nz;
    c.spin += c.speed * dt / 0.34;
    const along = c.tun ? Math.sin(c.yaw) * c.tunT[0] + Math.cos(c.yaw) * c.tunT[1] : 0;
    const grade = c.tun ? -Math.atan(c.tunSlope * along) : 0;
    A.car.group.position.set(c.x, (c.tun ? c.tunY : 0) + 0.02, c.z);
    A.car.group.rotation.order = 'YXZ';
    A.car.group.rotation.y = c.yaw;
    A.car.group.rotation.z = damp(A.car.group.rotation.z, -c.steer * Math.min(1, Math.abs(c.speed) / 18) * 0.09, 5, dt);
    A.car.group.rotation.x = damp(A.car.group.rotation.x, clamp(-c.speed * 0.0009, -0.035, 0.035) + grade, 6, dt);
    if (c.tun && c.tun.kind === 'in' && c.tunS < -34 && !S.crossing && C.tunnels.byId[c.tun.pair]) S.crossing = { t: 0, from: c.tun, to: C.tunnels.byId[c.tun.pair], done: false };
    for (const w of A.car.wheels) {
      w.spin.rotation.x = c.spin;
      if (w.front) w.pivot.rotation.y = c.steer;
    }
    if (A.car.spotlights) { A.car.spotlights[0].intensity = 150; A.car.spotlights[1].intensity = 150; }
    Audio.engineState(c.speed, true);
    // --- traffic law: red lights, speeding, pedestrians, contact ---
    if (C.signalAt) {
      // ran the light = the stop line we were driving up to on red is now behind us
      const sig = c.speed > 0.5 ? C.signalAt(c.x, c.z, Math.sin(c.yaw), Math.cos(c.yaw), 40) : null;
      if (c.sig && (!sig || sig.id !== c.sig.id) && c.sig.state === 'red' && c.sig.dist < 3 && c.speed > 2) {
        const past = (c.sig.stopX - c.x) * Math.sin(c.yaw) + (c.sig.stopZ - c.z) * Math.cos(c.yaw);
        if (past < 0) fine('red');
      }
      c.sig = sig;
    }
    c.overT = Math.abs(c.speed) > SPEED_LIMIT * 1.2 ? c.overT + dt : 0;
    if (c.overT > 4) { c.overT = 0; fine('speed'); }
    if (Math.abs(c.speed) > 2 && A.vehicleNear) {
      const v = A.vehicleNear(c.x, c.z, 2.4);
      if (v && Math.abs(c.speed) > 4) { Audio.bump(); S.camera.shake = 0.2; c.speed *= 0.82; c.hp = Math.max(0, c.hp - 4); fine('crash'); }
    }
    if (Math.abs(c.speed) > 1.5 && A.pedNear) {
      const pd = A.pedNear(c.x, c.z, 1.6);
      if (pd) {
        Audio.bump(0.2); S.camera.shake = 0.3; c.speed *= 0.5;
        fine('ped');
        if (A.scarePed) A.scarePed(pd.index, c.x, c.z);
      } else if (Math.abs(c.speed) > 8 && A.scarePed) {
        const near = A.pedNear(c.x, c.z, 4.5);
        if (near) A.scarePed(near.index, c.x, c.z);
      }
    }
  }

  // ------------------------------------------------------------- update: taxi
  function updateTaxi(dt) {
    const t = S.taxi;
    if (t.state === 'choose') {
      t.speed = 0;
      if (key.zero) { key.zero = false; goHomeByTaxi(); return; }
      const dig = [[key.one, 0], [key.two, 1], [key.three, 2], [key.four, 3], [key.five, 4]];
      for (const [k, i] of dig) if (k) { chooseTaxiDest(i); return; }
      return;
    }
    if (t.state === 'idle' || t.state === 'waiting' || !t.path || t.pi >= t.path.length) {
      t.speed = damp(t.speed, 0, 5, dt);
      return;
    }
    const target = t.path[t.pi];
    const dx = target[0] - t.x, dz = target[1] - t.z;
    const d = Math.hypot(dx, dz);
    if (d < 4.5) { t.pi++; if (t.pi >= t.path.length) { if (t.state === 'toPlayer') taxiAtKerb(); else arriveTaxi(); return; } }
    const want = Math.atan2(dx, dz);
    t.yaw += wrapAngle(want - t.yaw) * Math.min(1, dt * 3.2);
    const maxS = t.state === 'toTarget' ? 10.5 : 12.5;
    t.speed = damp(t.speed, maxS, 2.2, dt);
    const fx = Math.sin(t.yaw), fz = Math.cos(t.yaw);
    let [nx, nz] = moveCircle(t.x, t.z, fx * t.speed * dt, fz * t.speed * dt, 1.0);
    if (Math.hypot(nx - t.x, nz - t.z) < t.speed * dt * 0.4) t.speed *= 0.4;
    // wedged on a corner: hop to the node it was heading for (the driver backs out and goes round)
    t.wedgeT = t.speed < 1.5 ? (t.wedgeT || 0) + dt : 0;
    if (t.wedgeT > 3 && t.state === 'toTarget') { t.wedgeT = 0; nx = target[0]; nz = target[1]; t.speed = 4; }
    t.km += Math.hypot(nx - t.x, nz - t.z) / 1000;
    t.x = nx; t.z = nz;
    A.taxi.group.position.set(t.x, 0.02, t.z);
    A.taxi.group.rotation.y = t.yaw;
    if (S.mode === 'taxi') { S.player.x = t.x; S.player.z = t.z; S.player.yaw = t.yaw; }
    if (t.state === 'toTarget' && t.dest) {
      t.narrT += dt;
      t.fare = PRICE.taxiFlag + Math.max(0, t.km - PRICE.taxiFreeKm) * PRICE.taxiPerKm;
      const narr = TAXI_NARR[t.dest.name] || [];
      if (t.narrT > 5.5 && t.narr < narr.length) { subtitle(narr[t.narr], '司机', 4); t.narr++; t.narrT = 0; }
      const dd = Math.hypot(t.dest.pos[0] - t.x, t.dest.pos[1] - t.z);
      if (dd < 9) arriveTaxi();
    }
    if (t.state === 'toPlayer') {
      const dd = Math.hypot(S.player.x - t.x, S.player.z - t.z);
      t.callT = (t.callT || 0) + dt;
      t.stuckT = t.speed < 2 ? (t.stuckT || 0) + dt : 0;
      // a taxi wedged against something, or simply taking too long, pulls up at the kerb anyway
      if (dd > 6.5 && (t.stuckT > 2.5 || t.callT > 22) && t.kerb) {
        const k = t.kerb, ex = t.path[t.path.length - 1], pv = t.path[Math.max(0, t.path.length - 2)];
        t.x = k[0]; t.z = k[1]; t.yaw = Math.atan2(ex[0] - pv[0], ex[1] - pv[1]) || t.yaw;
        A.taxi.group.position.set(t.x, 0.02, t.z); A.taxi.group.rotation.y = t.yaw;
        t.pi = t.path.length;
      }
      if (dd < 6.5 || t.pi >= t.path.length) taxiAtKerb();
    }
  }
  function taxiAtKerb() {
    const t = S.taxi;
    t.state = 'waiting'; t.speed = 0;
    const dd = Math.hypot(S.player.x - t.x, S.player.z - t.z);
    Audio.horn();
    toast(dd < 6.5 ? '出租车到了 · E 上车' : `出租车在路边等你 · ${Math.round(dd)} 米 · 走过去按 E 上车`);
  }
  function arriveTaxi() {
    const t = S.taxi;
    t.state = 'waiting'; t.speed = 0;
    if (S.mode === 'taxi') {
      const due = Math.round(t.fare);
      if (pay(due, '车费')) subtitle(`到了，${t.dest.name}。打表 ¥${due}，慢走。`, '司机', 4);
      else subtitle(`到了。打表 ¥${due}……先记账上，下车按 E。`, '司机', 4);
      t.fare = 0; t.km = 0;
    }
  }

  // ------------------------------------------------------------- drone
  function toggleDroneView() {
    const d = S.drone; if (!d.active) return;
    d.view = d.view === 'fpv' ? 'chase' : 'fpv';
    Audio.ui(); updateHUD();
  }
  function launchDrone() {
    if (S.phase !== 'playing' || S.mode !== 'foot' || inRoom() || S.ferry.on) return;
    const d = S.drone;
    d.active = true; d.returning = false; d.view = 'fpv'; d.low = false;
    d.x = S.player.x + Math.cos(S.camera.yaw) * 0.55; d.z = S.player.z - Math.sin(S.camera.yaw) * 0.55;
    d.y = S.player.y + 1.0; d.yaw = S.camera.yaw; d.vx = d.vy = d.vz = 0; d.speed = 0; d.spin = 0;
    d.home = [S.player.x, S.player.z]; d.range = 0;
    S.mode = 'drone'; S.camera.pitch = 0.12;
    A.drone.group.visible = true; A.drone.group.position.set(d.x, d.y, d.z); A.drone.group.rotation.set(0, d.yaw, 0);
    document.body.classList.add('drone-on');
    show(el.droneHud, true); show(el.droneTouch, document.body.classList.contains('touch-on')); show(el.hudBottom, false);
    S.near = null; show(el.prompt, false);
    if (A.car.spotlights) for (const sp of A.car.spotlights) sp.intensity = 0;
    Audio.drone(true, 0.4); Audio.ui();
    subtitle('无人机起飞。WASD 飞，空格/Shift 升降，C 换视角，E 拍照，V 返航。', '旁白', 5);
  }
  function returnDrone() { if (S.drone.active) { S.drone.returning = true; toast('无人机返航'); Audio.ui(); } }
  function finishDrone() {
    const d = S.drone;
    d.active = false; d.returning = false; d.view = 'fpv'; d.low = false;
    d.x = d.home[0]; d.z = d.home[1]; d.y = 0.17; d.vx = d.vy = d.vz = 0; d.speed = 0; d.range = 0;
    S.mode = 'foot';
    S.player.x = d.home[0]; S.player.z = d.home[1];
    if (!S.player.deck) S.player.y = A.groundY(S.player.x, S.player.z);
    S.camera.yaw = d.yaw; S.camera.pitch = 0.17;
    A.drone.group.position.set(d.x, d.y, d.z); A.drone.group.rotation.set(0, d.yaw, 0);
    document.body.classList.remove('drone-on');
    show(el.droneHud, false); show(el.droneTouch, false); show(el.hudBottom, true);
    Audio.drone(false, 0); Audio.ui();
    detectInteraction(); syncActors(); updateHUD();
  }
  function dronePhoto() {
    const d = S.drone;
    if (!d.active || S.realTime - (d.lastPhoto || 0) < 0.7) return;
    d.lastPhoto = S.realTime;
    S.aerialPhotos++;
    stamp('aerial', '航拍');
    Audio.shutter(); flashPhoto();
    el.pcArt.setAttribute('data-kind', 'aerial');
    el.pcArtName.textContent = 'LINJIANGZUI FROM ABOVE';
    el.pcName.textContent = '空中 · 临江嘴';
    show(el.postcard, true);
    S.postcardUntil = S.realTime + 3.4;
    el.pcScore.textContent = '+20';
    toast('航拍 +1（结算每张 20 分，最多计 3 张）');
    jobEvent('dronePhoto');
  }
  function updateDrone(dt) {
    const d = S.drone;
    const cy = S.camera.yaw;
    const fx = Math.sin(cy), fz = Math.cos(cy), rx = -Math.cos(cy), rz = Math.sin(cy);
    let f = 0, st = 0;
    if (key.w || key.up) f += 1;
    if (key.s || key.down) f -= 1;
    if (key.d || key.right) st += 1;
    if (key.a || key.left) st -= 1;
    if (touch.active) { f -= touch.fwd; st += touch.str; }
    const up = (key.space ? 1 : 0) - (key.shift ? 1 : 0);
    if (!d.returning) {
      const ax = (fx * f + rx * st) * 7.0, az = (fz * f + rz * st) * 7.0;
      d.vx = damp(d.vx, ax, 2.6, dt); d.vz = damp(d.vz, az, 2.6, dt); d.vy = damp(d.vy, up * 3.4, 3.2, dt);
      const sp = Math.hypot(d.vx, d.vz);
      if (sp > 11) { d.vx *= 11 / sp; d.vz *= 11 / sp; }
      d.yaw = damp(d.yaw, cy, 5, dt);
    } else {
      const dx = d.home[0] - d.x, dz = d.home[1] - d.z, dist = Math.hypot(dx, dz);
      const sp = dist > 2.5 ? Math.min(14, 4 + dist * 0.04) : 2.0;
      d.vx = damp(d.vx, (dx / (dist + 0.01)) * sp, 3, dt); d.vz = damp(d.vz, (dz / (dist + 0.01)) * sp, 3, dt);
      const ty = dist > 3 ? Math.min(30, d.y) : 0.5;
      d.vy = damp(d.vy, (ty - d.y) * 0.9, 2.4, dt);
      d.yaw = damp(d.yaw, Math.atan2(d.vx, d.vz), 4, dt);
    }
    d.x += d.vx * dt; d.z += d.vz * dt; d.y = clamp(d.y + d.vy * dt, 0.55, 120);
    d.speed = Math.hypot(d.vx, d.vz);
    d.range = Math.hypot(d.x - d.home[0], d.z - d.home[1]);
    d.battery = Math.max(0, d.battery - dt * 0.55);
    d.low = d.battery < 22;
    d.signal = clamp(1 - d.range / 520, 0.15, 1);
    if (d.range > 520) {
      const dx = d.home[0] - d.x, dz = d.home[1] - d.z, l = Math.hypot(dx, dz) || 1;
      d.x += (dx / l) * dt * 6; d.z += (dz / l) * dt * 6;
    }
    if ((d.battery <= 0 || d.range > 560) && !d.returning) returnDrone();
    if (d.y < 95) {
      const gx = Math.floor(d.x / GRID), gz = Math.floor(d.z / GRID);
      for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
        const arr = gridMap.get((gx + ox) + ',' + (gz + oz));
        if (!arr) continue;
        for (const ci of arr) {
          const c = COLL[ci];
          if (c.y1 === undefined) continue;
          if (d.y > c.y1 + 0.6) continue;
          if (within(c, d.x, d.z, 0.4)) {
            const dx1 = d.x - (c.x0 - 0.4), dx2 = (c.x1 + 0.4) - d.x, dz1 = d.z - (c.z0 - 0.4), dz2 = (c.z1 + 0.4) - d.z;
            const m = Math.min(dx1, dx2, dz1, dz2);
            if (m === dx1) d.x = c.x0 - 0.4; else if (m === dx2) d.x = c.x1 + 0.4; else if (m === dz1) d.z = c.z0 - 0.4; else d.z = c.z1 + 0.4;
            d.vx *= 0.15; d.vz *= 0.15;
            S.camera.shake = Math.min(0.3, S.camera.shake + 0.08);
          }
        }
      }
    }
    if (d.returning && Math.hypot(d.home[0] - d.x, d.home[1] - d.z) < 1.3 && d.y < 0.8) { finishDrone(); return; }
    A.drone.group.position.set(d.x, d.y, d.z);
    A.drone.group.rotation.y = d.yaw;
    A.drone.group.rotation.x = damp(A.drone.group.rotation.x, clamp(-f * 0.07, -0.18, 0.18), 4, dt);
    A.drone.group.rotation.z = damp(A.drone.group.rotation.z, clamp(st * 0.07, -0.18, 0.18), 4, dt);
    d.spin += dt * (30 + (key.space ? 8 : 0));
    for (const r of A.drone.rotors) r.group.rotation.y = d.spin * (r.dir > 0 ? 1 : -1);
    A.drone.gimbal.rotation.x = clamp(S.camera.pitch, -0.3, 0.9);
    A.drone.strobe.visible = Math.sin(S.realTime * 14) > 0.2;
    Audio.drone(true, 0.3 + Math.min(0.4, d.speed / 12));
  }
