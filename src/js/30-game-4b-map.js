  // ------------------------------------------------------------- city map, pins and navigation
  // M opens a full-screen map drawn from the same OSM data as the city. A click
  // drops a pin; the active pin (or any place picked on the map) becomes the
  // navigation target that the compass, the minimap, a light column in the
  // world and the taxi all follow.
  const MAP_EXT = { x0: -1040, x1: 900, z0: -1080, z1: 780 };
  const PIN_COLORS = ['#ff3fbe', '#6fe6ff', '#48f0a2', '#ffd86b', '#b490ff', '#ff8a3d'];
  const MAX_PINS = 12;
  const MAP_FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif';
  const NAV = { pins: [], seq: 1, target: null, route: null, routeFrom: null, routeT: -9, routeKey: '' };
  try {
    const raw = JSON.parse(localStorage.getItem('nightwalk.pins') || 'null');
    if (raw && Array.isArray(raw.pins)) {
      NAV.pins = raw.pins.filter((p) => isFinite(p.x) && isFinite(p.z)).slice(0, MAX_PINS);
      NAV.seq = Math.max(raw.seq || 1, NAV.pins.length + 1);
    }
  } catch (e) {}
  function savePins() { try { localStorage.setItem('nightwalk.pins', JSON.stringify({ pins: NAV.pins, seq: NAV.seq })); } catch (e) {} }

  const POI_CATS = {
    photo:  { label: '明信片机位', color: '#ffb35c', glyph: '摄' },
    ferry:  { label: '渡口',       color: '#48f0a2', glyph: '渡' },
    indoor: { label: '室内 · 小店', color: '#6fe6ff', glyph: '店' },
    sight:  { label: '风景 · 观景', color: '#b490ff', glyph: '景' },
    food:   { label: '小吃 · 热饮', color: '#ff8a3d', glyph: '食' },
    people: { label: '街头相遇',   color: '#ff6fd0', glyph: '人' },
    ride:   { label: '载具',       color: '#ffd86b', glyph: '车' },
  };
  const LANDMARK_NAMES = { pearl: '星珠塔', modu: '魔都中心', yunque: '云阙金融中心', jinyue: '金岳大厦', zhenjin: '臻金中心', dawnlight: '晨曦国际大楼', minglan: '明澜广场' };
  const mapFilter = {};
  for (const k in POI_CATS) mapFilter[k] = true;
  mapFilter.pins = true;

  let POIS = null;
  function buildPois() {
    const L = [];
    const add = (id, cat, name, x, z, desc, stamps) => { if (isFinite(x) && isFinite(z)) L.push({ id, cat, name, x, z, desc, stamps: stamps || [] }); };
    for (const s of C.spots) {
      if (s.id === 'ferry') continue;
      add('spot-' + s.id, 'photo', s.name + ' · 机位', s.pos[0], s.pos[1], `站到光柱里，Q 举起相机，把${s.name}放进取景框（滚轮变焦），E 拍摄。`, ['photo-' + s.id]);
    }
    if (C.ferryHall) add('ferryhall', 'ferry', '东晟路渡口 · 候船厅', C.ferryHall.door[0], C.ferryHall.door[1], `末班渡轮 23:30。集齐五张明信片后进厅，在闸机处检票登船（¥${PRICE.ferry}）。`, ['ferryhall']);
    if (C.lobby) add('lobby', 'indoor', '魔都中心大堂', C.lobby.door[0], C.lobby.door[1], `售货机冰水 ¥${PRICE.water}、咖啡亭 ¥${PRICE.lobbyCoffee}、楼层导览。扶梯上 L2 观景廊（3 块展板、观景镜），再上 L3（2 块展板）。`, ['l2scope', 'l3', 'l2-0', 'l2-1', 'l2-2', 'l3-0', 'l3-1']);
    if (C.mall) add('mall', 'indoor', '环港广场', C.mall.door[0], C.mall.door[1], '玻璃穹顶下的 7 家小店：环港书局、面包房、唱片行、明信片铺、雨具店、花店、夜航咖啡。每走进一家盖一个章。', ['bookshop', 'bakery', 'records', 'postcard', 'umbrella', 'flower', 'coffeeshop', 'croissant', 'latte']);
    if (C.cafe) add('cafe', 'indoor', '江畔咖啡', C.cafe.door[0], C.cafe.door[1], `热咖啡 ¥${PRICE.cafeCoffee}：体力 +28，体温回得最快。门口有露天座。`, ['cafe']);
    if (C.bar) add('bar', 'indoor', '夜航小馆', C.bar.door[0], C.bar.door[1], `吧台热饮 ¥${PRICE.barDrink}，体力 +18。窗外就是江。`, ['bar']);
    if (C.telescope) add('telescope', 'sight', '投币望远镜', C.telescope.x, C.telescope.z, `¥${PRICE.telescope}，拉近看对岸的澜滩。`, ['telescope']);
    if (C.riverBench) add('bench', 'sight', '江边长椅', C.riverBench.stand[0], C.riverBench.stand[1], '坐下看一会儿江，歇口气。', ['bench']);
    if (C.cafeTerrace) add('terrace', 'sight', '咖啡露天座', C.cafeTerrace.x, C.cafeTerrace.z, '江畔咖啡门口的座位，坐一会儿。', ['terrace']);
    if (C.ringBridge) add('ring', 'sight', '星珠环 · 环形天桥', C.ringBridge.cx, C.ringBridge.cz, '临江嘴环岛上空的环形人行天桥，5 处楼梯可上；走上去即盖章。', ['ring']);
    if (C.skyway) add('skyway', 'sight', '空中连廊', C.skyway.foot[0], C.skyway.foot[1], '从千禧大道一侧上楼梯，一路走到星珠环。', ['skyway']);
    if (C.boardwalk) add('boardwalk', 'sight', '滨江木栈道', (C.boardwalk.x0 + C.boardwalk.x1) / 2, (C.boardwalk.z0 + C.boardwalk.z1) / 2, '亲水平台边的木栈道，看澜滩最近的地方。', ['boardwalk']);
    if (C.cruise) add('cruise', 'sight', '申江夜航码头', C.cruise.pier[0], C.cruise.pier[1], `船票 ¥${PRICE.cruise}，沿江一圈；甲板吧台 ¥${PRICE.deck}，船舱里有邮船沙龙 ¥${PRICE.saloon}。`, ['cruise', 'saloon']);
    if (C.stalls && C.stalls.length) {
      const x = C.stalls.reduce((a, s) => a + s.x, 0) / C.stalls.length, z = C.stalls.reduce((a, s) => a + s.z, 0) / C.stalls.length;
      add('stalls', 'food', '雨夜小摊', x, z, `热红酒 ¥${PRICE.wine} · 糖炒栗子 ¥${PRICE.chestnut} · 烤肉 ¥${PRICE.skewer}，都能暖身子。`, ['wine', 'chestnut', 'skewer']);
    }
    if (C.foodCart) add('cart', 'food', '平台小吃车', C.foodCart.x, C.foodCart.z, `一份 ¥${PRICE.cart}，体力 +18。`, ['cart']);
    (C.buskers || []).forEach((b, i) => add('busker-' + i, 'people', b.kind === 'sax' ? '萨克斯乐手' : '吉他乐手', b.x, b.z, `听歌免费，每第三首可以打赏 ¥${PRICE.busker}（体力 +3）。`, ['busker']));
    if (C.photoTourist) add('tourist', 'people', '想合影的游客', C.photoTourist[0], C.photoTourist[1], '走过去按 E，帮他们拍一张。', ['tourist']);
    POIS = L;
    return L;
  }
  const poiById = (id) => (POIS || buildPois()).find((p) => p.id === id) || ridePois().find((p) => p.id === id) || null;
  function ridePois() {
    const out = [];
    if (S.mode !== 'car') out.push({ id: 'car', cat: 'ride', name: S.car.broken ? '你的车（已损坏）' : '你的车 · 纯电', x: S.car.x, z: S.car.z, desc: '走近按 F 上车。限速 60 km/h，闯红灯、超速、不让行人会扣分罚款。', stamps: [] });
    if (S.mode !== 'taxi' && !acrossRiver()) out.push({ id: 'taxi', cat: 'ride', name: '出租车', x: S.taxi.x, z: S.taxi.z, desc: `按 T 叫车，E 上车，数字键选目的地。起步 ¥${PRICE.taxiFlag}（含 ${PRICE.taxiFreeKm} km），之后 ¥${PRICE.taxiPerKm}/km。`, stamps: ['taxi'] });
    return out;
  }
  const poiDone = (p) => p.stamps.length > 0 && p.stamps.every((s) => S.stamps[s]);

  // ---- navigation target
  function setNavTarget(t) {
    NAV.target = t ? { x: t.x, z: t.z, name: t.name, ref: t.ref || null, color: t.color || '#6fe6ff' } : null;
    NAV.route = null; NAV.routeKey = ''; NAV.routeT = -9;
    if (t) Audio.focus();
    if (MAPUI.open) renderSide();
  }
  function navTarget() { return NAV.target; }
  function addPin(x, z) {
    if (NAV.pins.length >= MAX_PINS) NAV.pins.shift();
    const n = NAV.seq++;
    const pin = { id: 'pin' + n, n, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, name: '标记 ' + n, color: PIN_COLORS[(n - 1) % PIN_COLORS.length] };
    NAV.pins.push(pin); savePins();
    return pin;
  }
  function removePin(id) {
    NAV.pins = NAV.pins.filter((p) => p.id !== id);
    if (NAV.target && NAV.target.ref === id) setNavTarget(null);
    savePins();
  }
  const navToPin = (p) => setNavTarget({ x: p.x, z: p.z, name: p.name, ref: p.id, color: p.color });
  const navToPoi = (p) => setNavTarget({ x: p.x, z: p.z, name: p.name, ref: p.id, color: POI_CATS[p.cat].color });
  function navRoute() {
    const t = NAV.target; if (!t || !A.routeTo) return null;
    const p = subject();
    const moved = !NAV.routeFrom || Math.hypot(p.x - NAV.routeFrom[0], p.z - NAV.routeFrom[1]) > 18;
    if (NAV.route && !moved && S.realTime - NAV.routeT < 4) return NAV.route;
    let path;
    if (Math.hypot(t.x - p.x, t.z - p.z) < 90) path = [[t.x, t.z]];
    else path = A.routeTo(p.x, p.z, t.x, t.z);
    NAV.route = [[p.x, p.z]].concat(path);
    NAV.routeFrom = [p.x, p.z]; NAV.routeT = S.realTime;
    return NAV.route;
  }
  function routeLength(r) { let l = 0; for (let i = 1; i < r.length; i++) l += Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]); return l; }

  // ---- the light column over the target, so it can be found without the HUD
  const navBeacon = (() => {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uColor: { value: new THREE.Color(0.5, 1.9, 2.4) }, uTime: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uTime;
        void main(){
          float fade = smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.4, 1.0, vUv.y));
          float band = 0.6 + 0.4 * sin(vUv.y * 60.0 - uTime * 3.0);
          float edge = pow(abs(sin(vUv.x * 3.14159)), 1.6);
          gl_FragColor = vec4(uColor * fade * band * edge * 0.5, fade * 0.5);
        }`,
    });
    const g = new THREE.Group(); g.name = 'nav-beacon';
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 70, 20, 1, true), mat);
    beam.position.y = 35; g.add(beam);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.2, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.2, 2.6), transparent: true, opacity: 0.75, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.1; g.add(ring);
    g.traverse((o) => { o.userData.passable = true; o.userData.surfaceProcedural = true; o.castShadow = false; o.receiveShadow = false; });
    g.visible = false; scene.add(g);
    return { g, beam, ring, mat };
  })();
  function updateNav() {
    const t = NAV.target;
    const p = subject();
    const d = t ? Math.hypot(t.x - p.x, t.z - p.z) : 1e9;
    navBeacon.g.visible = !!t && S.phase === 'playing' && !S.aim.active && d > 6 && !inRoom();
    if (t) {
      navBeacon.g.position.set(t.x, A.groundY ? A.groundY(t.x, t.z) : 0, t.z);
      navBeacon.mat.uniforms.uTime.value = S.realTime;
      navBeacon.mat.uniforms.uColor.value.set(t.color || '#6fe6ff').multiplyScalar(2.4);
      navBeacon.ring.scale.setScalar(1 + Math.sin(S.realTime * 2.4) * 0.08);
      if (S.phase === 'playing' && S.mode !== 'drone' && d < 9) {
        toast('已到达 · ' + t.name); Audio.chime();
        setNavTarget(null);
      }
    }
  }

  // ---- minimap layer (called from drawMap inside its clip)
  function drawNavMini(ctx, tx, tz, W, H, sc) {
    if (mapFilter.pins) for (const p of NAV.pins) {
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(tx(p.x), tz(p.z), 3.4, 0, TAU); ctx.fill();
    }
    const t = NAV.target; if (!t) return;
    const r = navRoute();
    if (r && r.length > 1) {
      ctx.save();
      ctx.strokeStyle = t.color || '#6fe6ff'; ctx.globalAlpha = 0.85; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash([7, 5]); ctx.lineDashOffset = -S.realTime * 18;
      ctx.beginPath(); r.forEach((q, i) => { if (i === 0) ctx.moveTo(tx(q[0]), tz(q[1])); else ctx.lineTo(tx(q[0]), tz(q[1])); }); ctx.stroke();
      ctx.restore();
    }
    const cx = W / 2, cy = H / 2;
    let mx = tx(t.x), mz = tz(t.z);
    const dx = mx - cx, dz = mz - cy, l = Math.hypot(dx, dz), lim = W / 2 - 14;
    if (l > lim) { mx = cx + dx / l * lim; mz = cy + dz / l * lim; }
    ctx.fillStyle = t.color || '#6fe6ff'; ctx.strokeStyle = '#05080c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(mx, mz); ctx.arc(mx, mz - 9, 6, Math.PI * 0.8, Math.PI * 2.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  // ------------------------------------------------------------- full-screen map UI
  const MAPUI = {
    open: false, root: $('bigmap'), cv: $('bm-canvas'), base: document.createElement('canvas'),
    view: { cx: 0, cz: 0, s: 0.5 }, dirty: true, hover: null, sel: null, w: 0, h: 0, dpr: 1,
    drag: null, pts: new Map(), pinch: null, roadLabels: null, landLabels: null,
  };
  const mapWorld = (sx, sy) => [(sx - MAPUI.w / 2) / MAPUI.view.s + MAPUI.view.cx, (sy - MAPUI.h / 2) / MAPUI.view.s + MAPUI.view.cz];
  const mapX = (x) => (x - MAPUI.view.cx) * MAPUI.view.s + MAPUI.w / 2;
  const mapZ = (z) => (z - MAPUI.view.cz) * MAPUI.view.s + MAPUI.h / 2;
  const fitScale = () => Math.min(MAPUI.w / (MAP_EXT.x1 - MAP_EXT.x0), MAPUI.h / (MAP_EXT.z1 - MAP_EXT.z0));
  function clampView() {
    const v = MAPUI.view;
    v.s = clamp(v.s, fitScale() * 0.8, 7);
    v.cx = clamp(v.cx, MAP_EXT.x0, MAP_EXT.x1); v.cz = clamp(v.cz, MAP_EXT.z0, MAP_EXT.z1);
    MAPUI.dirty = true;
  }
  function zoomAt(sx, sy, k) {
    const [wx, wz] = mapWorld(sx, sy);
    MAPUI.view.s *= k; clampView();
    MAPUI.view.cx = wx - (sx - MAPUI.w / 2) / MAPUI.view.s;
    MAPUI.view.cz = wz - (sy - MAPUI.h / 2) / MAPUI.view.s;
    clampView();
  }
  function mapResize() {
    const r = MAPUI.cv.getBoundingClientRect();
    MAPUI.dpr = Math.min(2, window.devicePixelRatio || 1);
    MAPUI.w = Math.max(1, r.width); MAPUI.h = Math.max(1, r.height);
    for (const c of [MAPUI.cv, MAPUI.base]) { c.width = Math.round(MAPUI.w * MAPUI.dpr); c.height = Math.round(MAPUI.h * MAPUI.dpr); }
    MAPUI.dirty = true;
  }
  function polyPath(ctx, pts) {
    ctx.moveTo(mapX(pts[0][0]), mapZ(pts[0][1]));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(mapX(pts[i][0]), mapZ(pts[i][1]));
    ctx.closePath();
  }
  const ROAD_STYLE = {
    trunk: ['#5b4a36', '#8a6c45', 1], primary: ['#4d4436', '#7a6446', 1], secondary: ['#3c4250', '#5d6678', 1],
    secondary_link: ['#3c4250', '#566073', 0.9], tertiary: ['#343a46', '#4c5566', 0.9], tertiary_link: ['#343a46', '#4a5263', 0.8],
    residential: ['#2c323c', '#3b4350', 0.8], unclassified: ['#2c323c', '#3b4350', 0.8], service: ['#272d36', '#343b47', 0.7], pedestrian: ['#2b2a33', '#4a4155', 0.7],
  };
  function buildLabels() {
    const byName = new Map();
    for (const r of C.roads) {
      if (!r.name || !r.samp || r.samp.length < 2) continue;
      const cur = byName.get(r.name);
      if (!cur || r.len > cur.len) byName.set(r.name, r);
    }
    MAPUI.roadLabels = [];
    for (const [name, r] of byName) {
      const m = Math.floor(r.samp.length / 2), a = r.samp[Math.max(0, m - 1)], b = r.samp[Math.min(r.samp.length - 1, m + 1)];
      let ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI;
      MAPUI.roadLabels.push({ name, x: r.samp[m][0], z: r.samp[m][1], ang, len: r.len || 0, major: !!r.major });
    }
    MAPUI.roadLabels.sort((p, q) => q.len - p.len);
    MAPUI.landLabels = [];
    for (const k in LANDMARK_NAMES) { const L = (C.landmarks || {})[k]; if (L && isFinite(L.x)) MAPUI.landLabels.push({ name: LANDMARK_NAMES[k], x: L.x, z: L.z, h: L.h || 0 }); }
  }
  function drawBase() {
    const ctx = MAPUI.base.getContext('2d'), s = MAPUI.view.s;
    ctx.setTransform(MAPUI.dpr, 0, 0, MAPUI.dpr, 0, 0);
    ctx.fillStyle = '#10141b'; ctx.fillRect(0, 0, MAPUI.w, MAPUI.h);
    // land beyond the playable area is shaded
    const B = C.bounds;
    ctx.fillStyle = '#151b24'; ctx.fillRect(mapX(B.x0), mapZ(B.z0), (B.x1 - B.x0) * s, (B.z1 - B.z0) * s);
    ctx.fillStyle = '#12261d';
    for (const poly of (C.parks || [])) { if (poly.length < 3) continue; ctx.beginPath(); polyPath(ctx, poly); ctx.fill(); }
    ctx.fillStyle = '#071723'; ctx.strokeStyle = '#1d4560'; ctx.lineWidth = 1.2;
    for (const poly of (C.waterPolys || [])) { ctx.beginPath(); polyPath(ctx, poly); ctx.fill(); ctx.stroke(); }
    // the far bank, outline only
    ctx.fillStyle = '#1b212b';
    for (const row of window.__SHENXI || []) {
      ctx.beginPath();
      for (let i = 2; i + 1 < row.length; i += 2) { const x = mapX(row[i]), y = mapZ(row[i + 1]); if (i === 2) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.closePath(); ctx.fill();
    }
    // piers, pontoons and gangways out over the water
    ctx.fillStyle = '#2a3340';
    for (const poly of (C.mapDecks || [])) { ctx.beginPath(); polyPath(ctx, poly); ctx.fill(); }
    // roads: casing pass, then fill pass
    for (let pass = 0; pass < 2; pass++) {
      for (const r of C.roads) {
        const st = ROAD_STYLE[r.hw] || ROAD_STYLE.residential;
        const w = Math.max(pass ? 1 : 2, (r.width || 6) * s * st[2] + (pass ? 0 : 1.6));
        ctx.strokeStyle = pass ? st[1] : '#0b0e13'; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        if (r.hw === 'pedestrian' && pass) ctx.setLineDash([Math.max(2, 3 * s), Math.max(2, 2 * s)]); else ctx.setLineDash([]);
        ctx.beginPath();
        r.samp.forEach((q, i) => { if (i === 0) ctx.moveTo(mapX(q[0]), mapZ(q[1])); else ctx.lineTo(mapX(q[0]), mapZ(q[1])); });
        if (r.closed) ctx.closePath();
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    // footprints, brighter as they get taller
    for (const b of C.buildings) {
      const h = b.h || 10;
      ctx.fillStyle = h > 300 ? '#5a6a8c' : h > 150 ? '#46536e' : h > 60 ? '#36405a' : h > 25 ? '#2b3345' : '#242a37';
      ctx.beginPath();
      if (b.poly && b.poly.length > 2) polyPath(ctx, b.poly);
      else ctx.rect(mapX(b.x - b.w / 2), mapZ(b.z - b.d / 2), b.w * s, b.d * s);
      ctx.fill();
      if (s > 1.2) { ctx.strokeStyle = 'rgba(160,185,230,.16)'; ctx.lineWidth = 1; ctx.stroke(); }
    }
    // the playable edge
    ctx.strokeStyle = 'rgba(255,179,92,.22)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
    ctx.strokeRect(mapX(B.x0), mapZ(B.z0), (B.x1 - B.x0) * s, (B.z1 - B.z0) * s); ctx.setLineDash([]);
    // labels
    if (!MAPUI.roadLabels) buildLabels();
    const boxes = [];
    const free = (x0, y0, x1, y1) => { for (const b of boxes) if (x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) return false; boxes.push([x0, y0, x1, y1]); return true; };
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const area = (txt, x, z, size, color, spacing) => {
      ctx.font = `600 ${size}px ${MAP_FONT}`;
      const sx = mapX(x), sy = mapZ(z), w = ctx.measureText(txt).width + (spacing || 0) * txt.length;
      if (!free(sx - w / 2, sy - size / 2, sx + w / 2, sy + size / 2)) return;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,12,.85)'; ctx.fillStyle = color;
      ctx.strokeText(txt, sx, sy); ctx.fillText(txt, sx, sy);
    };
    for (const L of MAPUI.landLabels) area(L.name, L.x, L.z, s > 1 ? 13 : 11, '#e8eefc');
    for (const [t, x, z] of MAP_AREAS) area(t, x, z, s > 0.9 ? 15 : 12, 'rgba(150,190,230,.55)', 4);
    if (s > 0.45) {
      for (const L of MAPUI.roadLabels) {
        if (L.len < 120 && s < 1.2) continue;
        ctx.font = `500 ${s > 1.6 ? 11 : 10}px ${MAP_FONT}`;
        const w = ctx.measureText(L.name).width;
        if (L.len * s < w + 30) continue;
        const sx = mapX(L.x), sy = mapZ(L.z);
        if (sx < -50 || sy < -50 || sx > MAPUI.w + 50 || sy > MAPUI.h + 50) continue;
        const hw = Math.abs(Math.cos(L.ang)) * w / 2 + 6, hh = Math.abs(Math.sin(L.ang)) * w / 2 + 6;
        if (!free(sx - hw, sy - hh, sx + hw, sy + hh)) continue;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(L.ang);
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(6,9,13,.9)'; ctx.fillStyle = '#a9b4c8';
        ctx.strokeText(L.name, 0, 0); ctx.fillText(L.name, 0, 0); ctx.restore();
      }
    }
    MAPUI.dirty = false;
  }
  // district and river names, placed on open ground / open water of the OSM data
  const MAP_AREAS = [['申江 · SHENJIANG', -760, 330], ['申 江', -170, 760], ['申 江', -560, -640], ['临江嘴', 60, -120], ['申 东', 520, 180], ['申西 · 澜滩', -960, -160]];

  function visiblePois() {
    const out = [];
    for (const p of (POIS || buildPois()).concat(ridePois())) if (mapFilter[p.cat]) out.push(p);
    return out;
  }
  // Nearby icons merge into one bubble until the map is zoomed in far enough.
  function clusterPois(list) {
    const cl = [], R = 15;
    for (const p of list) {
      const sx = mapX(p.x), sy = mapZ(p.z);
      let c = null;
      for (const q of cl) if (Math.hypot(q.sx - sx, q.sy - sy) < R) { c = q; break; }
      if (c) { c.items.push(p); c.sx = (c.sx * (c.items.length - 1) + sx) / c.items.length; c.sy = (c.sy * (c.items.length - 1) + sy) / c.items.length; }
      else cl.push({ sx, sy, items: [p] });
    }
    return cl;
  }
  function drawGlyph(ctx, x, y, r, color, glyph, dim) {
    ctx.globalAlpha = dim ? 0.55 : 1;
    ctx.fillStyle = '#070a0f'; ctx.beginPath(); ctx.arc(x, y, r + 2, 0, TAU); ctx.fill();
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0b0f15'; ctx.font = `700 ${Math.round(r * 1.15)}px ${MAP_FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, x, y + 0.5);
    if (dim) { ctx.fillStyle = '#48f0a2'; ctx.beginPath(); ctx.arc(x + r * 0.8, y - r * 0.8, 4, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
  }
  function drawPinShape(ctx, x, y, color, label, active) {
    ctx.save();
    if (active) { ctx.strokeStyle = color; ctx.globalAlpha = 0.5 + Math.sin(S.realTime * 4) * 0.25; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 13 + Math.sin(S.realTime * 3) * 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
    ctx.fillStyle = color; ctx.strokeStyle = '#05080c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x - 4, y - 7, x - 9, y - 11, x - 9, y - 17); ctx.arc(x, y - 17, 9, Math.PI, 0); ctx.bezierCurveTo(x + 9, y - 11, x + 4, y - 7, x, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#05080c'; ctx.font = '700 10px ' + 'ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - 17);
    ctx.restore();
  }
  function drawBigMap() {
    if (!MAPUI.open) return;
    if (MAPUI.dirty) drawBase();
    const ctx = MAPUI.cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(MAPUI.base, 0, 0);
    ctx.setTransform(MAPUI.dpr, 0, 0, MAPUI.dpr, 0, 0);
    const t = NAV.target;
    if (t) {
      const r = navRoute();
      if (r && r.length > 1) {
        ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(5,8,12,.8)'; ctx.lineWidth = 7;
        ctx.beginPath(); r.forEach((q, i) => { if (i === 0) ctx.moveTo(mapX(q[0]), mapZ(q[1])); else ctx.lineTo(mapX(q[0]), mapZ(q[1])); }); ctx.stroke();
        ctx.strokeStyle = t.color || '#6fe6ff'; ctx.lineWidth = 3.5; ctx.setLineDash([10, 7]); ctx.lineDashOffset = -S.realTime * 30; ctx.stroke();
        ctx.restore();
      }
    }
    // places
    MAPUI.clusters = clusterPois(visiblePois());
    for (const c of MAPUI.clusters) {
      if (c.items.length === 1) {
        const p = c.items[0], cat = POI_CATS[p.cat];
        const hot = MAPUI.hover && MAPUI.hover.item === p;
        drawGlyph(ctx, c.sx, c.sy, hot ? 10 : 8, cat.color, cat.glyph, poiDone(p));
        if (MAPUI.view.s > 1.5 || hot) {
          ctx.font = `600 11px ${MAP_FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(5,8,12,.9)'; ctx.fillStyle = '#eef3fb';
          ctx.strokeText(p.name, c.sx + 13, c.sy); ctx.fillText(p.name, c.sx + 13, c.sy);
        }
      } else {
        const hot = MAPUI.hover && MAPUI.hover.cluster === c;
        ctx.fillStyle = '#070a0f'; ctx.beginPath(); ctx.arc(c.sx, c.sy, 13, 0, TAU); ctx.fill();
        const cats = [...new Set(c.items.map((p) => p.cat))];
        cats.forEach((k, i) => { ctx.strokeStyle = POI_CATS[k].color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.sx, c.sy, 11, -Math.PI / 2 + i / cats.length * TAU, -Math.PI / 2 + (i + 1) / cats.length * TAU); ctx.stroke(); });
        ctx.fillStyle = hot ? '#fff' : '#dfe7f4'; ctx.font = '700 11px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(c.items.length), c.sx, c.sy + 0.5);
      }
    }
    if (mapFilter.pins) for (const p of NAV.pins) drawPinShape(ctx, mapX(p.x), mapZ(p.z), p.color, String(p.n), !!(t && t.ref === p.id));
    if (t && !(NAV.pins.some((p) => p.id === t.ref))) {
      ctx.strokeStyle = t.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(mapX(t.x), mapZ(t.z), 14 + Math.sin(S.realTime * 3) * 2, 0, TAU); ctx.stroke();
    }
    // you
    const p = subject(), px = mapX(p.x), py = mapZ(p.z);
    ctx.save(); ctx.translate(px, py); ctx.rotate(-S.camera.yaw + Math.PI);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 46);
    g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 46, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#05080c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7.5, 8); ctx.lineTo(0, 4); ctx.lineTo(-7.5, 8); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
    // north and scale
    ctx.fillStyle = 'rgba(220,235,255,.7)'; ctx.font = '700 12px ui-monospace,Menlo,monospace'; ctx.textAlign = 'center';
    ctx.fillText('N ↑', MAPUI.w - 34, MAPUI.h - 64);
    const nice = [20, 50, 100, 200, 250, 500, 1000];
    let m = nice[0]; for (const n of nice) if (n * MAPUI.view.s <= 140) m = n;
    const bar = $('bm-scale');
    if (bar) { bar.querySelector('i').style.width = Math.round(m * MAPUI.view.s) + 'px'; bar.querySelector('span').textContent = m >= 1000 ? m / 1000 + ' km' : m + ' m'; }
  }
  // ---- picking
  function mapPick(sx, sy) {
    if (mapFilter.pins) for (let i = NAV.pins.length - 1; i >= 0; i--) { const p = NAV.pins[i]; if (Math.hypot(mapX(p.x) - sx, mapZ(p.z) - 17 - sy) < 11 || Math.hypot(mapX(p.x) - sx, mapZ(p.z) - sy) < 6) return { pin: p }; }
    for (const c of MAPUI.clusters || []) {
      if (Math.hypot(c.sx - sx, c.sy - sy) < (c.items.length > 1 ? 14 : 11)) return c.items.length > 1 ? { cluster: c } : { item: c.items[0] };
    }
    return null;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmtDist = (d) => d > 1000 ? (d / 1000).toFixed(2) + ' km' : Math.round(d) + ' m';
  function distFromMe(x, z) { const p = subject(); return Math.hypot(x - p.x, z - p.z); }
  function showPop(sel, sx, sy) {
    MAPUI.sel = sel;
    const pop = $('bm-pop'); if (!sel) { show(pop, false); return; }
    let html = '';
    if (sel.pin) {
      const p = sel.pin, on = NAV.target && NAV.target.ref === p.id;
      html = `<b style="color:${p.color}">${esc(p.name)}</b><span>${fmtDist(distFromMe(p.x, p.z))} · 坐标 ${Math.round(p.x)}, ${Math.round(p.z)}</span>
        <div class="bm-acts">${on ? '<button data-a="unnav">取消导航</button>' : '<button data-a="nav" class="pri">导航到这里</button>'}<button data-a="del">删除标记</button></div>`;
    } else if (sel.item) {
      const p = sel.item, cat = POI_CATS[p.cat], on = NAV.target && NAV.target.ref === p.id;
      const st = p.stamps.length ? `<em>${p.stamps.filter((s) => S.stamps[s]).length} / ${p.stamps.length} 手账</em>` : '';
      html = `<b style="color:${cat.color}">${esc(p.name)}</b><span>${cat.label} · ${fmtDist(distFromMe(p.x, p.z))} ${st}</span><p>${esc(p.desc)}</p>
        <div class="bm-acts">${on ? '<button data-a="unnav">取消导航</button>' : '<button data-a="nav" class="pri">导航到这里</button>'}<button data-a="pinhere">在这里放标记</button></div>`;
    } else if (sel.cluster) {
      html = `<b>此处 ${sel.cluster.items.length} 个地点</b><div class="bm-list">${sel.cluster.items.map((p, i) => `<button data-a="pick" data-i="${i}"><i style="background:${POI_CATS[p.cat].color}"></i>${esc(p.name)}${poiDone(p) ? ' ✓' : ''}</button>`).join('')}</div>
        <div class="bm-acts"><button data-a="zoom" class="pri">放大这里</button></div>`;
    }
    pop.innerHTML = html; show(pop, true);
    const W = MAPUI.w, H = MAPUI.h, pw = Math.min(280, W - 20);
    pop.style.left = clamp(sx + 16, 10, W - pw - 10) + 'px';
    pop.style.top = clamp(sy - 20, 60, H - pop.offsetHeight - 10) + 'px';
  }
  $('bm-pop').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const a = b.dataset.a, sel = MAPUI.sel; if (!sel) return;
    Audio.ui();
    if (a === 'nav') { if (sel.pin) navToPin(sel.pin); else if (sel.item) navToPoi(sel.item); toast('已设置导航 · 跟着光柱和虚线走'); }
    else if (a === 'unnav') setNavTarget(null);
    else if (a === 'del' && sel.pin) { removePin(sel.pin.id); showPop(null); renderSide(); return; }
    else if (a === 'pinhere' && sel.item) { const p = addPin(sel.item.x, sel.item.z); p.name = sel.item.name; savePins(); navToPin(p); showPop({ pin: p }, mapX(p.x), mapZ(p.z)); renderSide(); return; }
    else if (a === 'pick') { const it = sel.cluster.items[+b.dataset.i]; showPop({ item: it }, mapX(it.x), mapZ(it.z)); return; }
    else if (a === 'zoom') { const c = sel.cluster; const [wx, wz] = mapWorld(c.sx, c.sy); MAPUI.view.cx = wx; MAPUI.view.cz = wz; MAPUI.view.s = Math.max(MAPUI.view.s * 2.6, 2.2); clampView(); showPop(null); return; }
    const s = MAPUI.sel; if (s) showPop(s, s.pin ? mapX(s.pin.x) : s.item ? mapX(s.item.x) : s.cluster.sx, s.pin ? mapZ(s.pin.z) : s.item ? mapZ(s.item.z) : s.cluster.sy);
    renderSide();
  });
  // ---- side panel
  function renderSide() {
    if (!MAPUI.open) return;
    const t = NAV.target, nav = $('bm-nav');
    if (t) {
      const r = navRoute(), d = r ? routeLength(r) : distFromMe(t.x, t.z);
      const walk = Math.max(1, Math.round(d / 1.5 / 60)), drive = Math.max(1, Math.round(d / 9 / 60));
      nav.innerHTML = `<div class="bm-navt"><i style="background:${t.color}"></i><b>${esc(t.name)}</b></div><span>沿路约 ${fmtDist(d)} · 步行约 ${walk} 分钟 · 开车约 ${drive} 分钟</span><button data-a="unnav" class="bm-mini">取消导航</button>`;
    } else nav.innerHTML = '<span>点地图上的地点或空白处设置导航。导航目标会显示在罗盘、小地图和城市里的光柱上；坐出租车时按 5 直达。</span>';
    $('bm-legend').innerHTML = Object.entries(POI_CATS).map(([k, c]) => `<button data-f="${k}" class="${mapFilter[k] ? 'on' : ''}"><i style="background:${c.color}">${c.glyph}</i>${c.label}</button>`).join('')
      + `<button data-f="pins" class="${mapFilter.pins ? 'on' : ''}"><i style="background:#ff3fbe">⚑</i>我的标记</button>`;
    $('bm-pins').innerHTML = NAV.pins.length ? NAV.pins.map((p) => `<div class="bm-row${t && t.ref === p.id ? ' act' : ''}" data-pin="${p.id}"><i style="background:${p.color}">${p.n}</i><b>${esc(p.name)}</b><span>${fmtDist(distFromMe(p.x, p.z))}</span><button data-a="go">导航</button><button data-a="del">✕</button></div>`).join('')
      : '<span class="bm-empty">还没有标记。单击地图空白处放一个（最多 12 个，会保存在本机）。</span>';
    const all = POIS || buildPois();
    const order = Object.keys(POI_CATS);
    $('bm-places').innerHTML = order.map((k) => {
      const items = (k === 'ride' ? ridePois() : all.filter((p) => p.cat === k));
      if (!items.length) return '';
      return `<div class="bm-cat" style="color:${POI_CATS[k].color}">${POI_CATS[k].label}</div>` + items.map((p) => `<div class="bm-row" data-poi="${p.id}"><i style="background:${POI_CATS[k].color}">${POI_CATS[k].glyph}</i><b>${esc(p.name)}${poiDone(p) ? ' <em>✓</em>' : ''}</b><span>${fmtDist(distFromMe(p.x, p.z))}</span></div>`).join('');
    }).join('');
  }
  $('bm-side').addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]');
    if (f) { mapFilter[f.dataset.f] = !mapFilter[f.dataset.f]; Audio.ui(); renderSide(); return; }
    const b = e.target.closest('button');
    if (b && b.dataset.a === 'unnav') { setNavTarget(null); return; }
    const pr = e.target.closest('[data-pin]');
    if (pr) {
      const p = NAV.pins.find((q) => q.id === pr.dataset.pin); if (!p) return;
      if (b && b.dataset.a === 'del') { removePin(p.id); renderSide(); showPop(null); return; }
      if (b && b.dataset.a === 'go') { navToPin(p); Audio.ui(); }
      focusMap(p.x, p.z); showPop({ pin: p }, mapX(p.x), mapZ(p.z)); return;
    }
    const pp = e.target.closest('[data-poi]');
    if (pp) { const p = poiById(pp.dataset.poi); if (p) { focusMap(p.x, p.z); showPop({ item: p }, mapX(p.x), mapZ(p.z)); } }
  });
  $('bm-clear').addEventListener('click', () => {
    if (!NAV.pins.length) return;
    if (NAV.target && NAV.pins.some((p) => p.id === NAV.target.ref)) setNavTarget(null);
    NAV.pins = []; savePins(); showPop(null); renderSide(); Audio.ui();
  });
  function focusMap(x, z, s) {
    MAPUI.view.cx = x; MAPUI.view.cz = z; if (s) MAPUI.view.s = s; else MAPUI.view.s = Math.max(MAPUI.view.s, 1.6);
    clampView(); drawBigMap();
  }
  // ---- pointer input: drag to pan, wheel / pinch to zoom, click to pick or drop a pin
  const cvs = MAPUI.cv;
  cvs.addEventListener('pointerdown', (e) => {
    MAPUI.pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    try { cvs.setPointerCapture(e.pointerId); } catch (err) {}
    if (MAPUI.pts.size === 2) {
      const [a, b] = [...MAPUI.pts.values()];
      MAPUI.pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: MAPUI.view.s };
      MAPUI.drag = null;
    } else MAPUI.drag = { x: e.offsetX, y: e.offsetY, cx: MAPUI.view.cx, cz: MAPUI.view.cz, moved: 0, button: e.button };
  });
  cvs.addEventListener('pointermove', (e) => {
    if (MAPUI.pts.has(e.pointerId)) MAPUI.pts.set(e.pointerId, [e.offsetX, e.offsetY]);
    if (MAPUI.pinch && MAPUI.pts.size === 2) {
      const [a, b] = [...MAPUI.pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const k = (MAPUI.pinch.s * d / Math.max(10, MAPUI.pinch.d)) / MAPUI.view.s;
      zoomAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, k);
      return;
    }
    const D = MAPUI.drag;
    if (D) {
      const dx = e.offsetX - D.x, dy = e.offsetY - D.y;
      D.moved = Math.max(D.moved, Math.hypot(dx, dy));
      if (D.moved > 4) { MAPUI.view.cx = D.cx - dx / MAPUI.view.s; MAPUI.view.cz = D.cz - dy / MAPUI.view.s; clampView(); cvs.style.cursor = 'grabbing'; showPop(null); }
      return;
    }
    const h = mapPick(e.offsetX, e.offsetY);
    MAPUI.hover = h;
    cvs.style.cursor = h ? 'pointer' : 'crosshair';
    const tip = $('bm-tip');
    if (h && (h.item || h.pin)) {
      const it = h.item || h.pin;
      tip.textContent = `${it.name} · ${fmtDist(distFromMe(it.x, it.z))}`;
      tip.style.left = (e.offsetX + 14) + 'px'; tip.style.top = (e.offsetY - 30) + 'px'; show(tip, true);
    } else show(tip, false);
  });
  const endPtr = (e) => {
    MAPUI.pts.delete(e.pointerId);
    if (MAPUI.pts.size < 2) MAPUI.pinch = null;
    const D = MAPUI.drag; MAPUI.drag = null; cvs.style.cursor = 'crosshair';
    if (!D || D.moved > 4 || e.type === 'pointercancel') return;
    const sx = e.offsetX, sy = e.offsetY, hit = mapPick(sx, sy);
    if (D.button === 2) {
      if (hit && hit.pin) { removePin(hit.pin.id); showPop(null); renderSide(); Audio.ui(); }
      return;
    }
    if (hit) { Audio.ui(); showPop(hit, sx, sy); return; }
    if (MAPUI.sel) { showPop(null); return; }
    const [wx, wz] = mapWorld(sx, sy);
    const B = C.bounds;
    if (wx < B.x0 || wx > B.x1 || wz < B.z0 || wz > B.z1) { toast('那里在可游玩范围外'); Audio.deny(); return; }
    const p = addPin(wx, wz);
    if (C.pointInWater && C.pointInWater(wx, wz)) p.name += '（江面）';
    savePins(); navToPin(p); Audio.beep();
    showPop({ pin: p }, mapX(p.x), mapZ(p.z)); renderSide();
  };
  cvs.addEventListener('pointerup', endPtr);
  cvs.addEventListener('pointercancel', endPtr);
  cvs.addEventListener('contextmenu', (e) => e.preventDefault());
  cvs.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, e.deltaY > 0 ? 1 / 1.18 : 1.18); showPop(null); }, { passive: false });
  $('bm-zin').addEventListener('click', () => { zoomAt(MAPUI.w / 2, MAPUI.h / 2, 1.4); Audio.ui(); });
  $('bm-zout').addEventListener('click', () => { zoomAt(MAPUI.w / 2, MAPUI.h / 2, 1 / 1.4); Audio.ui(); });
  $('bm-me').addEventListener('click', () => { const p = subject(); focusMap(p.x, p.z, Math.max(MAPUI.view.s, 1.8)); Audio.ui(); });
  $('bm-fit').addEventListener('click', () => { MAPUI.view.cx = (MAP_EXT.x0 + MAP_EXT.x1) / 2; MAPUI.view.cz = (MAP_EXT.z0 + MAP_EXT.z1) / 2; MAPUI.view.s = fitScale(); clampView(); Audio.ui(); });
  $('bm-close').addEventListener('click', () => closeOverlay());
  $('bm-manual').addEventListener('click', () => { closeOverlay(); openManual(); });
  window.addEventListener('resize', () => { if (MAPUI.open) { mapResize(); drawBigMap(); } });

  // ------------------------------------------------------------- overlays (map, manual) freeze the night
  function openOverlay(name) {
    if (S.overlay === name) return;
    if (S.overlay) closeOverlay(true);
    if (S.aim.active) lowerCamera();
    if (S.ph.open) closePhone(true);
    for (const k of Object.keys(key)) key[k] = false;
    S.overlay = name;
    Audio.ui(); Audio.engineState(0, false);
  }
  function closeOverlay(silent) {
    const was = S.overlay; if (!was) return;
    S.overlay = null;
    if (was === 'map') { MAPUI.open = false; show(MAPUI.root, false); showPop(null); show($('bm-tip'), false); }
    if (was === 'manual') show($('manual'), false);
    for (const k of Object.keys(key)) key[k] = false;
    if (!silent) Audio.ui();
  }
  function openMap(opts) {
    if (S.phase !== 'playing') return;
    openOverlay('map');
    MAPUI.open = true; show(MAPUI.root, true);
    mapResize();
    const p = subject();
    if (opts && opts.focus) {
      const it = poiById(opts.focus);
      if (it) { MAPUI.view.cx = it.x; MAPUI.view.cz = it.z; MAPUI.view.s = Math.max(fitScale(), 1.7); clampView(); drawBigMap(); showPop({ item: it }, mapX(it.x), mapZ(it.z)); }
    } else if (!MAPUI.opened) { MAPUI.view.cx = p.x; MAPUI.view.cz = p.z; MAPUI.view.s = Math.max(fitScale(), 0.55); }
    MAPUI.opened = true;
    clampView(); renderSide(); drawBigMap();
  }
  const toggleMap = () => { if (S.overlay === 'map') closeOverlay(); else openMap(); };
  if (el.map) { el.map.style.pointerEvents = 'auto'; el.map.style.cursor = 'pointer'; el.map.title = '打开地图 (M)'; el.map.addEventListener('click', () => openMap()); }
