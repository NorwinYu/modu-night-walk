/* 30-game — the tourist loop. Four files (30-game-1..4) share ONE closure: the
   build concatenates them in name order, so this file opens the IIFE and
   30-game-4-loop.js closes it. No crime, no weapons: the city is the game. */
(function () {
  const G = window.__G, THREE = G.THREE;
  const Q = new URLSearchParams(location.search);
  const SHOT = Q.get('shot') === '1';
  const CAMQ = Q.get('cam') ? Q.get('cam').split(',').map(Number) : null;
  const FOVQ = Q.get('fov') ? +Q.get('fov') : null;
  const camera = G.camera, renderer = G.renderer, scene = G.scene, C = G.CITY, A = G.actors, U = G.util;
  const { clamp, lerp, damp, wrapAngle } = U;
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------- settings
  // phones and tablets start one quality step down and drop further on their own if the frame rate sags
  const TOUCH = (navigator.maxTouchPoints > 0) || matchMedia('(pointer: coarse)').matches;
  const DEFAULTS = { sensitivity: 1, volume: 0.7, fov: 68, invertY: false, quality: TOUCH ? 'medium' : 'high', rain: true, runMode: 'ferry', mouseLock: true };
  let SET = { ...DEFAULTS };
  try { const raw = localStorage.getItem('nightwalk.settings'); if (raw) SET = { ...SET, ...JSON.parse(raw) }; } catch (e) {}
  if (Q.get('mode') === 'free' || Q.get('mode') === 'ferry') SET.runMode = Q.get('mode');
  let BEST = 0;
  try { BEST = +(localStorage.getItem('nightwalk.best') || 0) || 0; } catch (e) {}
  const baseFov = () => (SHOT ? (FOVQ || 52) : SET.fov);
  if (G.setQuality) G.setQuality(SET.quality);
  G.rain.visible = SET.rain;

  // ------------------------------------------------------------- rules of the night
  const PHOTO_IDS = ['pearl', 'modu', 'yunque', 'jinyue', 'lantan'];
  const CLOCK_START = 23 * 60;          // 23:00, minutes since midnight
  const CLOCK_LAST = 23 * 60 + 30;      // last ferry 23:30
  const CLOCK_BUS = 24 * 60 + 10;       // N1 night bus 00:10
  const CLOCK_END = 25 * 60;            // 01:00 — whoever is still out is stranded
  const TIME_SCALE = 3;                 // game seconds per real second -> 23:00-01:00 is 40 real minutes
  const WALLET_START = 300;
  const PRICE = {
    taxiFlag: 18, taxiPerKm: 3.5, taxiFreeKm: 3, cruise: 120, ferry: 2, telescope: 2,
    water: 3, lobbyCoffee: 28, latte: 22, flower: 28, umbrella: 35, postcard: 5, croissant: 12,
    barDrink: 25, cafeCoffee: 26, wine: 18, chestnut: 15, skewer: 20, cart: 12, saloon: 38, deck: 30, busker: 5,
  };
  const SPEED_LIMIT = 60 / 3.6;         // urban limit, m/s
  const FINE = { red: [200, 6, '闯红灯'], speed: [200, 3, '超速 20% 以上'], ped: [100, 3, '未礼让行人'], crash: [0, 1, '剐蹭事故'] };

  // ------------------------------------------------------------- state
  const runDefaults = () => ({
    mode: 'foot', time: 0, clock: CLOCK_START,
    photos: [], shots: {}, photoScore: 0, score: 0, grade: '', breakdown: null,
    health: 100, stamina: 100, warmth: 100, wallet: WALLET_START, spent: 0,
    licence: 12, fines: 0, violations: [], stamps: {},
    place: null, view: null, firstPerson: false, umbrella: true, umbrellaBought: false,
    photoPose: null, lastCause: '', near: null, promptKey: '', promptText: '', promptKind: '',
    aerialPhotos: 0, buskerSong: 0, photoTouristDone: false, exhibits: 0, coldWarned: 0, hurryWarned: 0,
    ringAngle: Math.PI / 2, ringR: 22, skyT: 0.5, skySide: 0,
    rep: 0, jobs: {}, track: null, msgs: {}, unread: {}, ledger: [], carry: {}, drank: false,
    waitBus: false, ending: '', fired: {}, storm: 0, lightShow: false, earned: 0, taxiHome: false,
    ph: { open: false, app: 'home', sub: null, batt: 64, bank: 0, dead: false, lowWarned: 0, renderT: 0 },
    ferry: { on: false, phase: '', t: 0, s: 0, speed: 0, yaw: 0, bob: 0, lx: 0, lz: 0, landed: false },
  });
  const S = {
    phase: 'menu', realTime: 0, ...runDefaults(),
    player: { x: C.start[0], z: C.start[1], y: 0.16, yaw: C.carYaw || Math.PI, speed: 0, walkPhase: 0, moving: false, sprint: false, deck: false, deckRef: null },
    car: { x: C.carStart[0], z: C.carStart[1], yaw: C.carYaw || Math.PI, speed: 0, steer: 0, spin: 0, battery: 100, hp: 100, broken: false, occupied: false, throttle: 0, brake: 0, slip: 0, overT: 0, sig: null, sigD: 0, cool: {} },
    taxi: { x: C.taxiStart[0], z: C.taxiStart[1], yaw: C.taxiYaw !== undefined ? C.taxiYaw : Math.PI, speed: 0, state: 'idle', path: null, pi: 0, dest: null, fare: 0, km: 0, narr: 0, narrT: 0 },
    camera: { yaw: C.carYaw || Math.PI, pitch: 0.17, orbit: 0, shake: 0, dist: 3.9, followYaw: undefined },
    aim: { active: false, fov: 50, result: null, lastEval: 0, assist: null },
    sub: { text: '', speaker: '', until: 0 }, toastUntil: 0, postcardUntil: 0, settingsFrom: 'menu', introDone: false,
    cruise: { active: false, t: 0, speed: 18, boatX: 0, boatZ: 0, yaw: Math.PI, docked: true, wait: 0, laps: 0 },
    saloonInside: false, saloon: { x: 0, z: 0 },
    drone: { active: false, x: C.start[0], y: 0.17, z: C.start[1], yaw: C.carYaw || Math.PI, vx: 0, vy: 0, vz: 0, speed: 0, battery: 100, view: 'fpv', home: [C.start[0], C.start[1]], range: 0, returning: false, spin: 0, signal: 1, low: false, lastPhoto: 0 },
    stats: { calls: 0, triangles: 0, fps: 0, lights: 0 },
  };
  G.state = S;
  const key = { w: false, a: false, s: false, d: false, up: false, down: false, left: false, right: false, space: false, shift: false, zero: false, one: false, two: false, three: false, four: false, five: false, six: false };
  const touch = { fwd: 0, str: 0, active: false };
  let dragging = false, lastPX = 0, lastPY = 0, pointerId = null;
  // pointer lock: the view follows the mouse without a button held; a locked
  // mouse that has gone still lets the chase cameras swing back behind the car
  let mouseLocked = false, lastMouseT = -9;
  const mouseLooking = () => dragging || (mouseLocked && S.realTime - lastMouseT < 1.2);
  let lastHud = 0, lastMap = 0, lastStep = 0;

  // who the "subject" is right now (the thing the map, objective and moon follow)
  function subject() {
    if (S.mode === 'car') return S.car;
    if (S.mode === 'taxi') return S.taxi;
    if (S.mode === 'drone') return S.drone;
    return S.player;
  }

  // ------------------------------------------------------------- collision
  // Colliders are axis-aligned boxes; the mover is that box grown by r (the
  // collide gate checks exactly this), so a mover is never inside a grown box.
  const COLL = C.colliders;
  const GRID = 26;
  const gridMap = new Map();
  function buildGrid() {
    gridMap.clear();
    for (let i = 0; i < COLL.length; i++) {
      const c = COLL[i];
      const x0 = Math.floor((c.x0 - 2) / GRID), x1 = Math.floor((c.x1 + 2) / GRID);
      const z0 = Math.floor((c.z0 - 2) / GRID), z1 = Math.floor((c.z1 + 2) / GRID);
      for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
        const k = gx + ',' + gz;
        let arr = gridMap.get(k); if (!arr) { arr = []; gridMap.set(k, arr); }
        arr.push(i);
      }
    }
  }
  buildGrid();
  const _near = [];
  function nearColliders(x, z, r) {
    _near.length = 0;
    const x0 = Math.floor((x - r) / GRID), x1 = Math.floor((x + r) / GRID);
    const z0 = Math.floor((z - r) / GRID), z1 = Math.floor((z + r) / GRID);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
      const arr = gridMap.get(gx + ',' + gz);
      if (arr) for (const i of arr) if (!_near.includes(i)) _near.push(i);
    }
    return _near;
  }
  // C.deepMover: the mover is down in a tunnel trench, where the surface-level
  // parapets and headwalls are above its head and the trench holds it instead
  const solid = (c) => !(c.y0 !== undefined && (c.y1 < 0.05 || c.y0 > 1.8)) && !(c.surf && C.deepMover);
  const within = (c, x, z, r) => x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r;
  function insideAny(x, z, r) {
    for (const i of nearColliders(x, z, r + 0.5)) { const c = COLL[i]; if (solid(c) && within(c, x, z, r)) return c; }
    return null;
  }
  // A mover that starts inside something (spawn, teleport) leaves by the nearest face.
  function pushOut(x, z, r) {
    for (let it = 0; it < 6; it++) {
      const c = insideAny(x, z, r);
      if (!c) break;
      const dl = x - (c.x0 - r), dr = (c.x1 + r) - x, du = z - (c.z0 - r), dd = (c.z1 + r) - z;
      const m = Math.min(dl, dr, du, dd);
      if (m === dl) x = c.x0 - r; else if (m === dr) x = c.x1 + r; else if (m === du) z = c.z0 - r; else z = c.z1 + r;
    }
    return [x, z];
  }
  function stepCircle(x, z, dx, dz, r) {
    let nx = x + dx;
    if (dx !== 0) {
      const list = nearColliders(nx, z, r + 0.5).slice();
      for (const i of list) { const c = COLL[i]; if (solid(c) && within(c, nx, z, r)) nx = dx > 0 ? Math.min(nx, c.x0 - r) : Math.max(nx, c.x1 + r); }
      if (insideAny(nx, z, r)) nx = x;
    }
    let nz = z + dz;
    if (dz !== 0) {
      const list = nearColliders(nx, nz, r + 0.5).slice();
      for (const i of list) { const c = COLL[i]; if (solid(c) && within(c, nx, nz, r)) nz = dz > 0 ? Math.min(nz, c.z0 - r) : Math.max(nz, c.z1 + r); }
      if (insideAny(nx, nz, r)) nz = z;
    }
    return [nx, nz];
  }
  function moveCircle(x, z, dx, dz, r) {
    const B = C.bounds;
    if (insideAny(x, z, r)) [x, z] = pushOut(x, z, r);
    const n = Math.min(10, Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / Math.max(0.2, r * 0.8))));
    const sx = dx / n, sz = dz / n;
    for (let k = 0; k < n; k++) {
      const p = stepCircle(x, z, sx, sz, r);
      x = clamp(p[0], B.x0 + r, B.x1 - r); z = clamp(p[1], B.z0 + r, B.z1 - r);
    }
    return [clamp(x, B.x0 + r, B.x1 - r), clamp(z, B.z0 + r, B.z1 - r)];
  }
  // Is the straight sight line from a to b blocked by a building? Marches the
  // collider grid in plan and compares the ray height with each box top.
  function sightBlocked(ax, ay, az, bx, by, bz, skipX, skipZ, skipR) {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    const n = Math.min(400, Math.ceil(len / 3));
    for (let k = 1; k < n; k++) {
      const f = k / n, x = ax + dx * f, z = az + dz * f, y = ay + (by - ay) * f;
      if (skipR && Math.hypot(x - skipX, z - skipZ) < skipR) continue;
      const arr = gridMap.get(Math.floor(x / GRID) + ',' + Math.floor(z / GRID));
      if (!arr) continue;
      for (const i of arr) {
        const c = COLL[i];
        if (c.y1 === undefined || c.y1 < 3) continue;
        if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y < c.y1 && y > (c.y0 || 0)) return true;
      }
    }
    return false;
  }
  window.__TESTMOVE = (x, z, dx, dz) => moveCircle(x, z, dx, dz, C.bounds.playerRadius);
  window.__MOVE = moveCircle;
  window.__SCENE = scene;
  window.__COLLIDERS = C.colliders;
  window.__BOUNDS = C.bounds;
  window.__CAM_POS = { x: camera.position.x, z: camera.position.z };

  // ------------------------------------------------------------- audio
  const Audio = (() => {
    let ctx = null, master = null, engine = null, engineGain = null, started = false;
    let droneOsc = null, droneOsc2 = null, droneGain = null, noiseBuf = null;
    function makeNoise(sec = 2) {
      const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return b;
    }
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = SET.volume; master.connect(ctx.destination);
        noiseBuf = makeNoise(2);
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;       // rain bed
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
        const rainGain = ctx.createGain(); rainGain.gain.value = 0.10;
        src.connect(lp); lp.connect(rainGain); rainGain.connect(master); src.start();
        const hum = ctx.createOscillator(); hum.type = 'sine'; hum.frequency.value = 48;   // city hum
        const hg = ctx.createGain(); hg.gain.value = 0.012; hum.connect(hg); hg.connect(master); hum.start();
        engine = ctx.createOscillator(); engine.type = 'triangle'; engine.frequency.value = 55; // EV motor whine
        const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 900;
        engineGain = ctx.createGain(); engineGain.gain.value = 0;
        engine.connect(ef); ef.connect(engineGain); engineGain.connect(master); engine.start();
        droneOsc = ctx.createOscillator(); droneOsc.type = 'sawtooth'; droneOsc.frequency.value = 72;
        droneOsc2 = ctx.createOscillator(); droneOsc2.type = 'triangle'; droneOsc2.frequency.value = 144;
        const df = ctx.createBiquadFilter(); df.type = 'lowpass'; df.frequency.value = 520;
        droneGain = ctx.createGain(); droneGain.gain.value = 0;
        droneOsc.connect(df); droneOsc2.connect(df); df.connect(droneGain); droneGain.connect(master); droneOsc.start(); droneOsc2.start();
        started = true;
      } catch (e) { started = false; }
    }
    function setVolume(v) { if (master) master.gain.value = v; }
    function drone(on, level = 0.3) {
      if (!started || !droneGain) return;
      const t = ctx.currentTime;
      droneGain.gain.setTargetAtTime(on ? 0.006 + level * 0.016 : 0, t, 0.18);
      droneOsc.frequency.setTargetAtTime(on ? 68 + level * 36 : 68, t, 0.18);
      droneOsc2.frequency.setTargetAtTime(on ? 136 + level * 72 : 136, t, 0.18);
    }
    function burst(dur = 0.12, freq = 1800, gain = 0.12, type = 'highpass') {
      if (!started) return;
      const src = ctx.createBufferSource(); src.buffer = noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = ctx.createGain(); g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(master); src.start(); src.stop(ctx.currentTime + dur + 0.02);
    }
    function tone(freq = 440, dur = 0.2, gain = 0.1, type = 'sine', when = 0) {
      if (!started) return;
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq;
      const g = ctx.createGain(); const t = ctx.currentTime + when;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.03);
    }
    function chord(freqs, dur = 0.5, gain = 0.05) { freqs.forEach((f, i) => tone(f, dur, gain, 'sine', i * 0.09)); }
    function engineState(speed, on) {
      if (!started) return;
      const target = on ? 0.012 + Math.min(0.035, Math.abs(speed) * 0.0011) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
      engine.frequency.setTargetAtTime(70 + Math.abs(speed) * 14, ctx.currentTime, 0.1);
    }
    return {
      init, setVolume, engineState, drone,
      shutter() { burst(0.05, 2600, 0.18, 'highpass'); tone(1400, 0.04, 0.06, 'square'); setTimeout(() => burst(0.07, 900, 0.12, 'highpass'), 55); },
      focus() { tone(2100, 0.05, 0.03, 'sine'); tone(2100, 0.05, 0.03, 'sine', 0.09); },
      step() { burst(0.05, 380, 0.05, 'lowpass'); },
      chime() { chord([523, 659, 784, 1046], 0.7, 0.05); },
      horn() { tone(392, 0.35, 0.06, 'square'); tone(494, 0.35, 0.05, 'square', 0.02); },
      ferry() { tone(92, 1.6, 0.10, 'sine'); tone(138, 1.4, 0.05, 'sine', 0.1); },
      ui() { tone(880, 0.08, 0.04, 'square'); },
      coin() { tone(1320, 0.07, 0.05, 'triangle'); tone(1760, 0.12, 0.05, 'triangle', 0.07); },
      deny() { tone(196, 0.16, 0.06, 'square'); tone(165, 0.2, 0.06, 'square', 0.12); },
      ticket() { tone(1480, 0.09, 0.07, 'square'); tone(1109, 0.09, 0.07, 'square', 0.12); tone(1480, 0.09, 0.07, 'square', 0.24); },
      win() { chord([523, 659, 784, 1046, 1318], 1.0, 0.06); },
      lose() { tone(220, 0.5, 0.07, 'sine'); tone(164, 0.7, 0.06, 'sine', 0.3); tone(110, 1.2, 0.05, 'sine', 0.7); },
      bump(g = 0.14) { burst(0.14, 180, g, 'lowpass'); },
      door() { tone(180, 0.09, 0.06, 'square'); burst(0.05, 700, 0.05); },
      beep() { tone(1180, 0.07, 0.05, 'square'); },
      street() { [392, 494, 587, 494, 523, 659, 587, 392].forEach((f, i) => tone(f, 0.26, 0.045, 'triangle', i * 0.19)); },
      street2() { [440, 523, 659, 587, 523, 440, 494, 523].forEach((f, i) => tone(f, 0.22, 0.045, 'triangle', i * 0.16)); },
    };
  })();

  // ------------------------------------------------------------- DOM helpers
  const el = {
    title: $('title'), hud: $('hud'), pause: $('pause'), settings: $('settings'), end: $('end'), touch: $('touch'),
    objective: $('objective'), objEyebrow: $('obj-eyebrow'), distance: $('objective-distance'), dots: $('beat-dots'), timer: $('timer'), stamp: $('stamp-count'),
    clockEyebrow: $('clock-eyebrow'), timerLabel: $('timer-label'),
    speed: $('speed'), gear: $('gear'), rpm: $('rpm-fill'), vehicle: $('vehicle-name'),
    bar1: $('health-fill'), bar1Num: $('health-num'), bar1Label: $('bar1-label'),
    bar2: $('nitro-fill'), bar2Num: $('nitro-num'), bar2Label: $('bar2-label'),
    wallet: $('wallet'), licence: $('licence'), carHp: $('car-hp'), stampTotal: $('stamp-total'),
    prompt: $('prompt'), promptText: $('prompt-text'), promptKey: $('prompt').querySelector('b'),
    subtitles: $('subtitles'), speaker: $('subtitle-speaker'), subtext: $('subtitle-text'),
    postcard: $('postcard'), pcArt: $('pc-art'), pcName: $('postcard-name'), pcScore: $('postcard-score'), pcArtName: $('pc-art-name'), pcStamp: $('pc-stamp'),
    toast: $('toast'), warning: $('bust-warning'), compassArrow: $('compass-arrow'), compassText: $('compass-text'),
    map: $('minimap'), best: $('best-time'), boot: $('boot'),
    pauseObjective: $('pause-objective'), pauseTime: $('pause-time'), pauseBody: $('pause-health'), pauseWallet: $('pause-heat'),
    endTitle: $('end-title'), endCause: $('end-cause'), endKicker: $('end-kicker'), endTime: $('end-time'), endPhotos: $('end-health'), endScore: $('end-heat'), endBest: $('end-best'), endGrade: $('end-grade'), endBreak: $('end-breakdown'),
    droneHud: $('drone-hud'), droneTouch: $('drone-touch'), hudBottom: $('hud-bottom'), droneChip: $('drone-chip'),
    dhMode: $('dh-mode'), dhBatt: $('dh-batt'), dhAlt: $('dh-alt'), dhDist: $('dh-dist'), dhSpd: $('dh-spd'), dhHdg: $('dh-hdg'), dhSignal: $('dh-signal'), dhAlert: $('dh-alert'),
    viewfinder: $('viewfinder'), vfLabel: $('vf-label'), vfInfo: $('vf-info'), vfBox: $('vf-box'),
    modeBtn: $('mode-btn'), modeDesc: $('mode-desc'),
  };
  const flash = document.createElement('div');
  flash.id = 'flash';
  flash.style.cssText = 'position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:30;transition:opacity .45s ease-out';
  $('app').appendChild(flash);

  function show(node, on) { if (!node) return; node.classList.toggle('hidden', !on); }
  function setText(node, t) { if (node && node.textContent !== t) node.textContent = t; }
  function setPhase(p) {
    if (S.overlay) closeOverlay(true);
    S.phase = p; document.body.dataset.phase = p;
    show(el.title, p === 'menu');
    show(el.hud, p !== 'menu');
    show(el.pause, p === 'paused');
    show(el.settings, p === 'settings');
    show(el.end, p === 'lost' || p === 'won');
    if (p !== 'playing') { show(el.viewfinder, false); if (S.ph && S.ph.open) closePhone(true); show(PH.notif, false); }
  }
  // keyboard wording in messages, said the touch way on a touch screen
  const TOUCH_WORDS = [[/按 ?Tab ?(看看|打开)?/g, '点「手机」$1'], [/Tab 打开手机/g, '点「手机」打开'], [/按 Q 举起相机/g, '点「相机」举起相机'], [/^放飞无人机$/, '点「无人机」放飞'], [/按 E/g, '点 E'], [/(走过去|车边|下车)按 E/g, '$1点 E'], [/按 T 扬招/g, '用手机打车'], [/（V）/g, '（「无人机」键）'], [/ · E 上车/g, ' · 点 E 上车']];
  const touchText = (t) => (TOUCH ? TOUCH_WORDS.reduce((s, [a, b]) => s.replace(a, b), String(t)) : t);
  function subtitle(text, speaker = '旁白', dur = 4.2) {
    text = touchText(text);
    S.sub.text = text; S.sub.speaker = speaker; S.sub.until = S.realTime + dur;
    el.speaker.textContent = speaker; el.subtext.textContent = text; el.subtitles.classList.add('show');
  }
  function toast(text, dur = 2.2) { text = touchText(text); el.toast.textContent = text; show(el.toast, true); S.toastUntil = S.realTime + dur; }
  function flashPhoto(color) {
    flash.style.background = color || '#fff';
    flash.style.transition = 'none'; flash.style.opacity = '0.92';
    requestAnimationFrame(() => { flash.style.transition = 'opacity .5s ease-out'; flash.style.opacity = '0'; });
  }

  // ------------------------------------------------------------- persistence
  function saveAll() {
    BEST = Math.max(BEST, Math.round(S.score));
    try {
      localStorage.setItem('nightwalk.best', String(BEST));
      localStorage.setItem('nightwalk.settings', JSON.stringify(SET));
      localStorage.setItem('nightwalk.endings', JSON.stringify(ENDS_SEEN));
      localStorage.setItem('nightwalk.grade', BEST_GRADE);
    } catch (e) {}
    savePins();
    syncTitleStats();
  }
  function syncTitleStats() {
    setText(el.best, BEST ? `${BEST} 分` : '—');
    setText($('best-grade'), BEST_GRADE || '—');
    setText($('ends-seen'), `${ENDS_SEEN.length} / 4`);
  }

  // ------------------------------------------------------------- clock + money + journal
  const fmt = (s) => { s = Math.max(0, s); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
  const fmtClock = (min) => { const m = ((Math.floor(min) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const timed = () => SET.runMode === 'ferry';
  function pay(amount, what) {
    if (S.wallet + 1e-6 < amount) { Audio.deny(); toast(`余额不足 · ${what} ¥${amount} · 钱包 ¥${Math.floor(S.wallet)}`); return false; }
    S.wallet -= amount; S.spent += amount;
    if (amount > 0) { Audio.coin(); S.ledger.unshift({ t: fmtClock(S.clock), what, amt: -amount }); }
    return true;
  }
  function earn(amount, what) {
    amount = Math.round(amount);
    if (amount <= 0) return;
    S.wallet += amount; S.earned += amount;
    S.ledger.unshift({ t: fmtClock(S.clock), what, amt: amount });
    Audio.coin();
  }
  const STAMPS = {
    photo: ['明信片', PHOTO_IDS],
    shop: ['小店', ['bookshop', 'bakery', 'records', 'postcard', 'umbrella', 'flower', 'coffeeshop', 'bar', 'cafe']],
    sight: ['风景', ['telescope', 'bench', 'terrace', 'ring', 'skyway', 'boardwalk', 'l2scope', 'l3', 'cruise', 'saloon', 'aerial']],
    food: ['小吃', ['wine', 'chestnut', 'skewer', 'cart', 'croissant', 'latte']],
    panel: ['展板', ['l2-0', 'l2-1', 'l2-2', 'l3-0', 'l3-1']],
    people: ['相遇', ['busker', 'tourist', 'taxi', 'ferryhall']],
  };
  const STAMP_TOTAL = Object.values(STAMPS).reduce((n, v) => n + v[1].length, 0);
  function stamp(id, label) {
    if (S.stamps[id]) return false;
    S.stamps[id] = Math.round(S.time);
    if (label) toast(`手账 +1 · ${label}`);
    return true;
  }
  const stampCount = () => Object.keys(S.stamps).length;
  function fine(kind) {
    const [yuan, pts, name] = FINE[kind];
    if ((S.car.cool[kind] || 0) > S.realTime) return;
    S.car.cool[kind] = S.realTime + (kind === 'speed' ? 25 : 6);
    S.fines += yuan; S.licence = Math.max(0, S.licence - pts);
    S.violations.push({ kind, t: fmtClock(S.clock) });
    Audio.ticket(); flashPhoto('#dfe8ff');
    toast(yuan ? `电子警察 · ${name} · 记 ${pts} 分 · 罚款 ¥${yuan}` : `${name} · 记 ${pts} 分`, 3.2);
    if (S.licence <= 0) subtitle('驾照 12 分扣完了。今晚不能再开车——靠边停下，改走路或者打车。', '交警', 6);
  }

  // ------------------------------------------------------------- objective helpers
  const spotById = (id) => C.spots.find((s) => s.id === id);
  // the closest postcard still missing; photos can be taken in any order
  function nextSpot() {
    const p = subject();
    let best = null, bd = 1e9;
    for (const id of PHOTO_IDS) {
      if (S.photos.includes(id)) continue;
      const s = spotById(id), d = Math.hypot(s.pos[0] - p.x, s.pos[1] - p.z);
      if (d < bd) { bd = d; best = s; }
    }
    return best || spotById('ferry');
  }
  function targetPoint() { return (S.ferry.on || S.ferry.landed ? null : jobTarget()) || homeTarget(); }
  const allPhotos = () => S.photos.length >= 5;
  function objectiveText() { const t = targetPoint(); return t.text || t.name; }
  function distToTarget() { const t = targetPoint(), p = subject(); return Math.hypot(t.x - p.x, t.z - p.z); }

  // ------------------------------------------------------------- run control
  function resetGame() {
    Object.assign(S, runDefaults());
    const yaw0 = C.carYaw || Math.PI;
    Object.assign(S.player, { x: C.start[0], z: C.start[1], y: A.groundY(C.start[0], C.start[1]), yaw: yaw0, speed: 0, walkPhase: 0, moving: false, sprint: false, deck: false, deckRef: null });
    Object.assign(S.camera, { yaw: yaw0, pitch: 0.17, orbit: 0, shake: 0, dist: 3.9, followYaw: undefined });
    Object.assign(S.car, { x: C.carStart[0], z: C.carStart[1], yaw: yaw0, speed: 0, steer: 0, spin: 0, battery: 100, hp: 100, broken: false, occupied: false, throttle: 0, brake: 0, slip: 0, overT: 0, sig: null, sigD: 0, cool: {} });
    Object.assign(S.taxi, { x: C.taxiStart[0], z: C.taxiStart[1], yaw: C.taxiYaw !== undefined ? C.taxiYaw : Math.PI, speed: 0, state: 'idle', path: null, pi: 0, dest: null, fare: 0, km: 0, narr: 0, narrT: 0 });
    Object.assign(S.aim, { active: false, fov: 50, result: null, lastEval: 0, assist: null });
    Object.assign(S.cruise, { active: false, t: 0, docked: true, wait: 0, laps: 0, yaw: Math.PI });
    S.saloonInside = false;
    if (C.ferryRide) { const R = C.ferryRide; R.place(R.east.x, R.east.z, R.east.yaw, 0); R.setRamps(R.rampUp, 0); R.wakeMat.opacity = 0; R.flow(0, 0); }
    if (C.cruise) { C.cruise.boat.position.set(C.cruise.boat0[0], 0, C.cruise.boat0[1]); C.cruise.boat.rotation.y = Math.PI; }
    const dd = S.drone;
    Object.assign(dd, { active: false, x: S.player.x + Math.cos(yaw0) * 0.95, y: 0.17, z: S.player.z - Math.sin(yaw0) * 0.95, yaw: yaw0, vx: 0, vy: 0, vz: 0, speed: 0, battery: 100, view: 'fpv', home: [S.player.x, S.player.z], range: 0, returning: false, spin: 0, low: false, signal: 1, lastPhoto: 0 });
    A.drone.group.position.set(dd.x, dd.y, dd.z); A.drone.group.rotation.set(0, dd.yaw, 0); A.drone.group.visible = true;
    A.car.group.visible = true; A.car.group.rotation.set(0, yaw0, 0); A.taxi.group.visible = true;
    for (const s of C.spots) s.score = 0;
    for (const k of Object.keys(key)) key[k] = false;
    camera.fov = baseFov(); camera.updateProjectionMatrix();
    show(el.end, false); show(el.postcard, false); show(el.warning, false); show(el.viewfinder, false);
    show(PH.root, false); show(PH.notif, false); PH.notifUntil = 0;
    document.body.classList.remove('phone-on', 'phone-dead');
    if (G.rainMat) G.rainMat.uniforms.uOpacity.value = 0.13;
    syncElder();
    S.postcardUntil = 0; S.toastUntil = 0; show(el.toast, false);
    Audio.engineState(0, false); Audio.drone(false, 0);
    document.body.classList.remove('drone-on', 'aim-on');
    show(el.droneHud, false); show(el.droneTouch, false); show(el.hudBottom, true); show(el.droneChip, false);
    syncActors();
  }
  function startRun() {
    resetGame();
    setPhase('playing');
    Audio.init(); Audio.setVolume(SET.volume);
    jobsStart();
    subtitle(timed()
      ? (TOUCH ? '23:00，下着雨。手机震了好几下——点「手机」看看消息。左下摇杆走路，拖动屏幕环视。今晚怎么回家都行：渡轮 23:30，N1 夜宵 00:10，或者打车。' : '23:00，下着雨。手机震了好几下——按 Tab 看看消息。今晚怎么回家都行：渡轮 23:30，N1 夜宵 00:10，或者打车。')
      : '自由漫步：时间照走，班次不停。按 Tab 打开手机看看今晚有什么事。', '旁白', 8);
    S.introDone = true;
    saveAll(); updateHUD();
  }
  function menu() { resetGame(); setPhase('menu'); syncModeUI(); syncTitleStats(); }
  function pauseGame() {
    if (S.phase !== 'playing') return;
    if (S.aim.active) lowerCamera();
    setPhase('paused');
    setText(el.pauseObjective, objectiveText());
    setText(el.pauseTime, `${fmtClock(S.clock)} · ${nextDeparture().label}`);
    setText(el.pauseBody, `体力 ${Math.round(S.stamina)} · 体温 ${Math.round(S.warmth)} · 手机 ${Math.round(S.ph.batt)}%`);
    setText(el.pauseWallet, `¥${Math.floor(S.wallet)} · 声望 ${S.rep} · 委托 ${jobsDone()}/${JOB_DEFS.length}`);
    Audio.engineState(0, false);
  }
  function resumeGame() {
    if (S.phase !== 'paused' && S.phase !== 'settings') return;
    setPhase('playing'); Audio.init();
  }
  function openSettings(from) {
    S.settingsFrom = from || (S.phase === 'menu' ? 'menu' : 'paused');
    setPhase('settings'); syncSettingsUI();
  }
  function closeSettings() { setPhase(S.settingsFrom === 'menu' ? 'menu' : 'paused'); Audio.ui(); }
  function restartRun() { startRun(); }
  // Every way the night can end is graded; only being stranded at 01:00 counts as the "lost" screen.
  const ENDINGS = {
    ferry: { win: true, bonus: 300, kicker: 'ENDING · 末班渡轮', title: '到家了。', foot: '渡轮把你放在十八埠。穿过永安里，爬上四楼，402 的灯还是出门时留的那盏。' },
    bus: { win: true, bonus: 180, kicker: 'ENDING · 夜宵 N1', title: '坐上了 N1。', foot: '车窗上全是雨，司机把暖风开大了一点。' },
    taxi: { win: true, bonus: 90, kicker: 'ENDING · 打车回家', title: '打车回家。', foot: '后座很暖，计价器一格一格地跳。' },
    stranded: { win: false, bonus: 0, kicker: 'ENDING · 雨夜滞留', title: '一点了，还在外面。', foot: '你在便利店坐到雨停。下次早点看时刻表。' },
  };
  let ENDS_SEEN = [], BEST_GRADE = '';
  try { ENDS_SEEN = JSON.parse(localStorage.getItem('nightwalk.endings') || '[]') || []; BEST_GRADE = localStorage.getItem('nightwalk.grade') || ''; } catch (e) {}
  const GRADE_RANK = { S: 4, A: 3, B: 2, C: 1, '': 0 };
  function computeScore(ending) {
    const E = ENDINGS[ending] || ENDINGS.stranded;
    const b = {
      '明信片': Math.round(S.photoScore),
      '委托': jobsPoints(),
      '声望': S.rep * 25,
      '城市手账': stampCount() * 10,
      '航拍': Math.min(3, S.aerialPhotos) * 20,
      '结局': E.bonus,
      '钱包结余': Math.round(S.wallet * 0.2),
      '交通罚款': -Math.round(S.fines * 0.5),
      '车损': -Math.round((100 - S.car.hp) * 0.5),
    };
    const total = Math.max(0, Object.values(b).reduce((a, v) => a + v, 0));
    const grade = total >= 1300 ? 'S' : total >= 1000 ? 'A' : total >= 700 ? 'B' : 'C';
    return { b, total, grade };
  }
  function endRun(ending, cause) {
    if (S.phase === 'lost' || S.phase === 'won') return;
    if (S.aim.active) lowerCamera();
    if (S.ph.open) closePhone(true);
    const E = ENDINGS[ending] || ENDINGS.stranded;
    const r = computeScore(ending);
    S.ending = ending; S.score = r.total; S.grade = r.grade; S.breakdown = r.b; S.lastCause = cause || E.title;
    S.waitBus = false;
    if (!ENDS_SEEN.includes(ending)) ENDS_SEEN.push(ending);
    if (GRADE_RANK[r.grade] > GRADE_RANK[BEST_GRADE]) BEST_GRADE = r.grade;
    setPhase(E.win ? 'won' : 'lost');
    setText(el.endTitle, E.title);
    setText(el.endKicker, E.kicker);
    setText(el.endCause, cause || E.foot);
    setText(el.endTime, fmtClock(S.clock));
    setText(el.endPhotos, `委托 ${jobsDone()} / ${JOB_DEFS.length} · 明信片 ${S.photos.length} / 5`);
    setText(el.endScore, `${r.total} 分`);
    setText(el.endGrade, r.grade);
    if (el.endBreak) el.endBreak.textContent = Object.entries(r.b).filter(([, v]) => v !== 0).map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${v}`).join(' · ');
    setText($('end-foot'), `已见结局 ${ENDS_SEEN.length} / 4 · 渡轮 · N1 · 打车 · 滞留`);
    el.end.classList.remove('end-win', 'end-lose');
    el.end.classList.add(E.win ? 'end-win' : 'end-lose');
    if (E.win) { Audio.win(); if (ending === 'ferry') Audio.ferry(); } else Audio.lose();
    Audio.engineState(0, false); Audio.drone(false, 0);
    saveAll();
    setText(el.endBest, BEST ? `${BEST} 分 · ${BEST_GRADE || '—'}` : '—');
  }
  const loseRun = (cause) => endRun('stranded', cause);

  // ------------------------------------------------------------- settings UI
  const setters = {
    sens: (v) => { SET.sensitivity = +v; $('set-sens-v').textContent = (+v).toFixed(2); },
    vol: (v) => { SET.volume = +v; $('set-vol-v').textContent = Math.round(v * 100) + '%'; Audio.setVolume(+v); },
    fov: (v) => { SET.fov = +v; $('set-fov-v').textContent = Math.round(v) + '°'; },
    quality: (v) => { SET.quality = v; $('set-quality-v').textContent = v.toUpperCase(); G.setQuality(v); },
    invert: (v) => { SET.invertY = !!v; $('set-invert-v').textContent = v ? '开' : '关'; },
    mlock: (v) => { SET.mouseLock = !!v; $('set-mlock-v').textContent = v ? '开' : '关'; },
    rain: (v) => { SET.rain = !!v; $('set-rain-v').textContent = v ? '开' : '关'; G.rain.visible = !!v; },
  };
  function syncSettingsUI() {
    $('set-sens').value = SET.sensitivity; $('set-sens-v').textContent = (+SET.sensitivity).toFixed(2);
    $('set-vol').value = SET.volume; $('set-vol-v').textContent = Math.round(SET.volume * 100) + '%';
    $('set-fov').value = SET.fov; $('set-fov-v').textContent = Math.round(SET.fov) + '°';
    $('set-quality').value = SET.quality; $('set-quality-v').textContent = SET.quality.toUpperCase();
    $('set-invert').checked = !!SET.invertY; $('set-invert-v').textContent = SET.invertY ? '开' : '关';
    $('set-mlock').checked = SET.mouseLock !== false; $('set-mlock-v').textContent = SET.mouseLock !== false ? '开' : '关';
    $('set-rain').checked = !!SET.rain; $('set-rain-v').textContent = SET.rain ? '开' : '关';
  }
  function syncModeUI() {
    setText(el.modeBtn, timed() ? '模式：今夜 23:00–01:00' : '模式：自由漫步');
    setText(el.modeDesc, timed()
      ? '委托、拍照、闲逛随你安排。赶上哪班车决定结局，每种结局都评级；01:00 还没走就算滞留。'
      : '时间照走，但渡轮和 N1 不停班、不会滞留。适合慢慢逛，同样评级。');
  }
  $('set-sens').addEventListener('input', (e) => { setters.sens(e.target.value); saveAll(); });
  $('set-vol').addEventListener('input', (e) => { setters.vol(e.target.value); saveAll(); });
  $('set-fov').addEventListener('input', (e) => { setters.fov(e.target.value); saveAll(); });
  $('set-quality').addEventListener('change', (e) => { setters.quality(e.target.value); saveAll(); });
  $('set-invert').addEventListener('change', (e) => { setters.invert(e.target.checked); saveAll(); });
  $('set-mlock').addEventListener('change', (e) => { setters.mlock(e.target.checked); saveAll(); });
  $('set-rain').addEventListener('change', (e) => { setters.rain(e.target.checked); saveAll(); });

  // ------------------------------------------------------------- shell buttons
  $('start-btn').addEventListener('click', () => { Audio.init(); Audio.ui(); startRun(); });
  $('settings-btn').addEventListener('click', () => openSettings('menu'));
  $('settings-close-btn').addEventListener('click', closeSettings);
  $('settings-menu-btn').addEventListener('click', () => { saveAll(); menu(); });
  $('resume-btn').addEventListener('click', resumeGame);
  $('pause-settings-btn').addEventListener('click', () => openSettings('paused'));
  $('restart-btn').addEventListener('click', restartRun);
  $('menu-btn').addEventListener('click', menu);
  $('end-restart-btn').addEventListener('click', restartRun);
  $('end-menu-btn').addEventListener('click', menu);
  if (el.modeBtn) el.modeBtn.addEventListener('click', () => { SET.runMode = timed() ? 'free' : 'ferry'; Audio.init(); Audio.ui(); syncModeUI(); saveAll(); });
  syncModeUI();
