  // ------------------------------------------------------------- interact dispatch
  const BUY = {
    lobbyWater: [PRICE.water, 12, '自动售货机：冰水。体力 +12。', ''],
    lobbyCoffee: [PRICE.lobbyCoffee, 20, '大堂咖啡亭：热拿铁。体力 +20。', '咖啡师'],
    buyLatte: [PRICE.latte, 20, '咖啡师：今晚的豆子偏果酸，雨夜刚好。体力 +20。', '咖啡师', 'latte', '拿铁'],
    buyFlower: [PRICE.flower, 5, '买一束白色桔梗，用牛皮纸包好，还带着水汽。体力 +5。', '店主'],
    buyPostcard: [PRICE.postcard, 3, '买了一张「魔都中心」明信片，盖了今晚的邮戳。', '店主'],
    croissant: [PRICE.croissant, 10, '面包师：可颂趁热吃，黄油香。体力 +10。', '面包师', 'croissant', '可颂'],
    barDrink: [PRICE.barDrink, 18, '酒保：热的，带一点柑橘。体力 +18。', '酒保'],
    cafeOrder: [PRICE.cafeCoffee, 28, '拿好。靠窗那桌能看到澜滩。体力 +28。', '店员'],
    saloonOrder: [PRICE.saloon, 15, '沙龙吧台：一杯热饮。体力 +15。', '调酒师'],
    deckOrder: [PRICE.deck, 12, '甲板吧台：一杯热饮。体力 +12。', '船员'],
    wine: [PRICE.wine, 10, '摊主：热的，捧在手里暖。体力 +10。', '摊主', 'wine', '热红酒'],
    chestnut: [PRICE.chestnut, 10, '摊主：刚出锅的，小心烫。体力 +10。', '摊主', 'chestnut', '糖炒栗子'],
    skewer: [PRICE.skewer, 12, '摊主：辣的，配夜色刚好。体力 +12。', '摊主', 'skewer', '烤肉'],
    streetFood: [PRICE.cart, 18, '来一份热乎的。平台风大，趁热。体力 +18。', '摊主', 'cart', '平台小吃'],
  };
  function buy(kind) {
    const b = BUY[kind];
    if (!pay(b[0], b[4] || '消费')) return;
    S.stamina = Math.min(100, S.stamina + b[1]);
    S.warmth = Math.min(100, S.warmth + b[1] * 0.6);
    if (kind === 'cafeOrder') S.warmth = Math.min(100, S.warmth + 15);
    subtitle(b[2], b[3], 3.5);
    if (b[4]) stamp(b[4], b[5]);
    if (kind === 'barDrink' || kind === 'wine') S.drank = true;
    jobEvent('buy', kind);
    updateHUD();
  }
  function interact() {
    if (S.phase !== 'playing') return;
    if (S.mode === 'drone') { dronePhoto(); return; }
    const it = S.near;
    if (!it) return;
    if (it.kind === 'drone') { launchDrone(); return; }
    if (BUY[it.kind]) { buy(it.kind); return; }
    switch (it.kind) {
      case 'enterCar': enterCar(); break;
      case 'exitCar': exitCar(); break;
      case 'boardTaxi': boardTaxi(); break;
      case 'exitTaxi': exitTaxi(); break;
      case 'photo': takePhoto(it.spot); break;
      case 'photoHint': raiseCamera(); break;
      case 'aimExit': lowerCamera(); break;
      case 'ferryWait': subtitle('末班渡轮 23:30 已经开走了。夜宵 N1 00:10 在观澜大道站发车，或者用手机打车。', '渡口', 5); Audio.deny(); break;
      case 'boardFerry':
        if (!departureOpen('ferry')) { subtitle('检票口已经关了，末班船刚离岸。', '渡口', 4); Audio.deny(); break; }
        if (!pay(PRICE.ferry, '轮渡票')) break;
        startFerry(); break;
      case 'ferrySkip': skipFerry(); break;
      case 'leaveFerry': leaveFerry(); break;
      case 'sleepHome': sleepHome(); break;
      case 'homeKettle':
        S.warmth = Math.min(100, S.warmth + 20); S.stamina = Math.min(100, S.stamina + 6); Audio.chime();
        subtitle('水壶咔哒一声跳了。捧着一杯热水，手指慢慢暖回来。体温 +20。', '旁白', 4); updateHUD(); break;
      case 'homeWindow': Audio.ui(); subtitle('窗外是永安里的屋顶和晾衣竿，再远是江，对岸临江嘴的塔顶还亮着红灯。', '旁白', 5); break;
      case 'job': jobAct(it); break;
      case 'busWait': startBusWait(); break;
      case 'busCancel': cancelBusWait(); break;
      case 'busGone': openPhone('taxi'); break;
      case 'cruise':
        if (pay(PRICE.cruise, '夜航船票')) { stamp('cruise', '申江夜航'); enterCruise(); }
        break;
      case 'exitCruise': exitCruise(); break;
      case 'saloon': enterSaloon(); break;
      case 'saloonExit': exitSaloon(); break;
      case 'buskerListen': {
        S.buskerSong += 1;
        stamp('busker', '街头乐手');
        if (S.buskerSong % 3 === 1) { Audio.street(); subtitle(it.act === 'sax' ? '萨克斯把一段老旋律吹进江风里，围观的人都没走。' : '吉他弹的是首慢歌，琴盒里落了几枚硬币。', '街头乐手', 5); }
        else if (S.buskerSong % 3 === 2) { Audio.street2(); subtitle('换了一首快一点的，有人跟着打拍子。', '街头乐手', 5); }
        else if (pay(PRICE.busker, '打赏')) { S.stamina = Math.min(100, S.stamina + 3); subtitle('往琴盒里放了几枚硬币，乐手朝你点了点头。体力 +3。', '街头乐手', 4); }
        updateHUD(); break;
      }
      case 'photoTourist':
        Audio.shutter(); S.photoTouristDone = true; stamp('tourist', '帮游客拍照');
        subtitle('帮他们按了一张：背后的星珠和江面都在取景框里。', '游客', 4);
        jobEvent('tourist'); break;
      case 'bookRead': S.stamina = Math.min(100, S.stamina + 4); Audio.chime(); subtitle('翻到一页：“城市把夜色折成一条江。” 体力 +4。', '旁白', 5); updateHUD(); break;
      case 'recordListen': Audio.chime(); subtitle('唱针落下，是一张旧爵士；窗外的雨声刚好和贝斯叠在一起。', '店员', 5); break;
      case 'buyUmbrella':
        if (pay(PRICE.umbrella, '雨伞')) { S.umbrellaBought = true; S.stamina = Math.min(100, S.stamina + 4); subtitle('换了一把长柄透明伞，比折叠伞挡雨多了——淋雨降温更慢。', '店主', 4); updateHUD(); }
        break;
      case 'lobbyInfo': Audio.ui(); subtitle('楼层导览：L2 观景廊 · L1 大堂 · B1 地铁 · B2 车库 · B3 设备层。', '前厅', 6); break;
      case 'l2Panel': case 'l3Panel': {
        Audio.ui(); S.exhibits += 1;
        const texts = ['澜滩：52 栋石构建筑沿江排开，是临江嘴玻璃幕墙前最老的一层。', '过江：临江嘴这段江面没有桥，靠怀远东路、安民路、新晟路三条隧道和澜滩观光隧道；最近的南澜大桥（1991）在上游约 3 公里，东澜大桥（1993）在下游约 4.5 公里。', '临江嘴三件套：星珠 468m、魔都中心 632m、云阙 492m、金岳 421m。', '魔都之巅：632 m，118 层，观光厅电梯 55 秒直达。', '城市天际线：星珠 468 m、云阙 492 m、金岳 421 m，都在西边一条线上。'];
        const idx = it.kind === 'l2Panel' ? it.idx : 3 + it.idx;
        subtitle(texts[idx] || '', '展板', 6);
        stamp((it.kind === 'l2Panel' ? 'l2-' : 'l3-') + it.idx, '展板');
        updateHUD(); break;
      }
      case 'enterL2Scope': enterL2Scope(); break;
      case 'exitL2Scope': exitL2Scope(); break;
      case 'telescope': enterTelescope(); break;
      case 'exitTelescope': exitTelescope(); break;
      case 'sitBench': sitBench(); break;
      case 'standUp': standUp(); break;
      case 'sitCafe': sitCafeTerrace(); break;
      case 'standCafe': standCafeTerrace(); break;
      case 'enterSkywayB': enterSkyway(false); break;
      case 'enterSkywayR': enterSkyway(true); break;
      case 'exitSkyway': exitSkyway(); break;
      case 'enterBoardwalk': enterBoardwalk(); break;
      case 'exitBoardwalk': exitBoardwalk(); break;
      case 'enterRing': enterRing(); break;
      case 'exitRing': exitRing(); break;
      case 'taxiChoose': break;
      default:
        if (it.kind.startsWith('enter')) { enterRoom(it.kind.slice(5).toLowerCase()); }
        else if (it.kind.startsWith('exit')) { exitRoom(it.kind.slice(4).toLowerCase()); }
    }
  }

  // ------------------------------------------------------------- car / taxi
  function enterCar() {
    if (S.mode !== 'foot' || Math.hypot(S.car.x - S.player.x, S.car.z - S.player.z) > 4.6) return;
    if (S.car.broken) { Audio.deny(); toast('车坏了 · 今晚只能打车'); return; }
    if (S.licence <= 0) { Audio.deny(); toast('驾照已记满 12 分 · 不能再开车'); subtitle('分扣完了，车就别碰了。出租车和腿都还听你使唤。', '旁白', 4); return; }
    if (S.drank) { Audio.deny(); toast('喝过酒 · 今晚不能开车'); subtitle('刚喝了酒，车钥匙先收起来。打车、坐船、走路都行。', '旁白', 4); return; }
    S.mode = 'car'; S.car.occupied = true;
    S.near = null; show(el.prompt, false);
    S.camera.orbit = 0; Audio.door();
    subtitle('坐进车里。纯电，安静——雨刮器、暖风，夜游继续。', '旁白');
    syncActors();
  }
  function exitCar() {
    if (S.mode !== 'car') return;
    if (Math.abs(S.car.speed) > 1.2) { toast('先停稳再下车'); return; }
    if (S.car.tun && S.car.tunS < 1) { toast('隧道里不能下车 · 开出洞口再说'); return; }
    const side = new THREE.Vector3(Math.cos(S.car.yaw), 0, -Math.sin(S.car.yaw));
    let nx, nz;
    if (S.car.tun) {
      S.player.tun = S.car.tun;
      const tm = C.tunnelMove(S.player, S.car.x + side.x * 1.8, S.car.z + side.z * 1.8, 0.38, 2.0);
      nx = tm ? tm.x : S.car.x; nz = tm ? tm.z : S.car.z;
    } else { S.player.tun = null; [nx, nz] = moveCircle(S.car.x + side.x * 1.8, S.car.z + side.z * 1.8, 0, 0, 0.38); }
    S.player.x = nx; S.player.z = nz; S.player.y = A.groundY(nx, nz); S.player.yaw = S.car.yaw;
    S.mode = 'foot'; S.car.occupied = false;
    S.camera.yaw = S.car.yaw; S.camera.pitch = 0.17; Audio.door();
    syncActors(); detectInteraction();
  }
  const TAXI_NARR = {
    '亲水平台': ['师傅：这条滨江路晚上只让慢车，正好。', '师傅：前面就是亲水平台，看澜滩最好的角度。'],
    '环港广场': ['师傅：广场的玻璃穹顶，下雨天最舒服。'],
    '魔都中心大堂': ['师傅：前面那栋最高的就是魔都中心。'],
    '东晟路渡口': ['师傅：渡口末班 23:30，赶得上。'],
  };
  const TAXI_DESTS = [
    { x: -610, z: 108, name: '亲水平台' },
    { x: -590, z: 84, name: '环港广场' },
    { x: 168, z: 161, name: '魔都中心大堂' },
    { x: -80, z: 616, name: '东晟路渡口' },
  ];
  function chooseTaxiDest(i) {
    const nt = navTarget();
    const d = i === 4 ? (nt ? { x: nt.x, z: nt.z, name: nt.name } : null) : TAXI_DESTS[i];
    if (!d) { if (i === 4) toast('先在地图（M）上设一个导航目标'); key.five = false; return; }
    S.taxi.path = A.routeTo(S.taxi.x, S.taxi.z, d.x, d.z);
    S.taxi.pi = 0; S.taxi.state = 'toTarget'; S.taxi.dest = { pos: [d.x, d.z], name: d.name };
    S.taxi.narrT = 0; S.taxi.narr = 0;
    key.one = key.two = key.three = key.four = key.five = false;
    Audio.horn();
    subtitle(`师傅：${d.name}，坐稳。`, '司机', 4);
    updateHUD();
  }
  // no Pudong taxi comes through the tunnel for a three-minute walk: once the
  // ferry has left, the far bank is reached on foot only
  const acrossRiver = () => S.ferry.on || S.ferry.landed;
  function taxiRefusal() {
    if (S.ferry.on) return '在渡轮上，叫不了车 · 靠岸后走回永安里';
    if (S.ferry.landed) return '申西这边离家只有几百米，走回永安里 28 号就好';
    return '';
  }
  function callTaxi() {
    if (S.phase !== 'playing' || S.mode !== 'foot' || S.place) return;
    if (acrossRiver()) { toast(taxiRefusal(), 3); Audio.deny(); return; }
    if (Math.hypot(S.taxi.x - S.player.x, S.taxi.z - S.player.z) < 7) { toast('出租车就在旁边 · E 上车'); Audio.horn(); return; }
    // pick up at the kerb of the nearest drivable road, dispatched from a car
    // already cruising nearby rather than from wherever the taxi was left
    const T = S.taxi, px = S.player.x, pz = S.player.z;
    const kerb = A.kerbPoint(px, pz) || A.nodes[A.nearestNode(px, pz)];
    const plen = (p) => { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return l; };
    let path = A.routeTo(T.x, T.z, kerb.x, kerb.z), from = [T.x, T.z];
    if (plen(path) > 220) {
      // the route tree to the kerb is cached, so scoring a dozen candidates is cheap
      const cands = A.nodes.filter((n) => { const d = Math.hypot(n.x - kerb.x, n.z - kerb.z); return d > 60 && d < 140 && Math.hypot(n.x - px, n.z - pz) > 45; });
      let best = null, bs = 1e9;
      for (let i = 0; i < cands.length && i < 400; i += Math.max(1, Math.floor(cands.length / 24))) {
        const p = A.routeTo(cands[i].x, cands[i].z, kerb.x, kerb.z), l = plen(p), sc = Math.abs(l - 120);
        if (l > 40 && sc < bs) { bs = sc; best = p; }
      }
      if (best) { path = best; from = best[0]; }
    }
    T.x = from[0]; T.z = from[1];
    if (path.length > 1) T.yaw = Math.atan2(path[1][0] - path[0][0], path[1][1] - path[0][1]);
    T.speed = 6; T.path = path; T.pi = 0; T.state = 'toPlayer'; T.dest = null;
    T.callT = 0; T.stuckT = 0; T.kerb = [kerb.x, kerb.z];
    A.taxi.group.position.set(T.x, 0.02, T.z); A.taxi.group.rotation.y = T.yaw;
    const eta = Math.min(20, Math.max(8, Math.round(plen(path) / 11)));
    Audio.horn(); toast(`已叫车 · 约 ${eta} 秒到 · 在路边等`); subtitle('叫了辆车。司机说马上到，就在前面那条路上。', '旁白');
  }
  function boardTaxi() {
    if (S.mode !== 'foot') return;
    if (Math.hypot(S.taxi.x - S.player.x, S.taxi.z - S.player.z) > 5.2) return;
    S.mode = 'taxi';
    stamp('taxi', '出租车');
    S.taxi.state = 'choose'; S.taxi.speed = 0; S.taxi.path = null; S.taxi.pi = 0; S.taxi.dest = null;
    S.taxi.fare = PRICE.taxiFlag; S.taxi.km = 0;
    S.camera.orbit = 0.35;
    Audio.door(); Audio.horn();
    const nt = navTarget();
    subtitle('师傅：去哪儿？1 亲水平台 · 2 环港广场 · 3 魔都中心 · 4 渡口' + (nt ? ' · 5 ' + nt.name : '') + ' · 0 回酒店（结束今晚）', '司机', 9);
    S.near = { kind: 'taxiChoose' }; S.promptKey = nt ? '0-5' : '0-4'; S.promptText = '1 平台 · 2 广场 · 3 大堂 · 4 渡口' + (nt ? ' · 5 导航目标' : '') + ' · 0 回家'; S.promptKind = 'taxiChoose';
    syncActors();
    if (S.taxiHome) goHomeByTaxi();
  }
  function exitTaxi() {
    if (S.mode !== 'taxi') return;
    const side = new THREE.Vector3(Math.cos(S.taxi.yaw), 0, -Math.sin(S.taxi.yaw));
    const [nx, nz] = moveCircle(S.taxi.x + side.x * 2.0, S.taxi.z + side.z * 2.0, 0, 0, 0.38);
    S.player.x = nx; S.player.z = nz; S.player.y = A.groundY(nx, nz); S.player.yaw = S.taxi.yaw;
    S.mode = 'foot'; S.taxi.state = 'idle'; S.taxi.path = null; S.taxi.dest = null;
    S.camera.yaw = S.taxi.yaw; Audio.door();
    syncActors(); detectInteraction();
  }

  // ------------------------------------------------------------- interiors (table-driven)
  const ROOMS = {
    lobby:      { c: 'lobby',      ey: 0,         pitch: 0.12, exD: [0, -1.6], exYaw: Math.PI,      msg: ['魔都中心大堂。632 米的塔从头顶穿上去。', '小满'] },
    mall:       { c: 'mall',       ey: Math.PI,   pitch: 0.10, exD: [0, 2.0],  exYaw: 0,            msg: ['环港广场。雨被挡在玻璃穹顶外面。', '小满'] },
    bookshop:   { c: 'bookshop',   ey: Math.PI,   pitch: 0.06, exD: [0, 1.8],  exYaw: 0,            msg: ['环港书局。书架到顶，阅读桌还亮着灯。', '店员'] },
    bakery:     { c: 'bakery',     ey: -Math.PI / 2, pitch: 0.06, exD: [1.6, 0], exYaw: Math.PI / 2, msg: ['面包房。烤箱还热着，柜台里是刚出炉的可颂。', '面包师'] },
    records:    { c: 'records',    ey: Math.PI / 2, pitch: 0.06, exD: [-1.6, 0], exYaw: -Math.PI / 2, msg: ['唱片行。墙上全是黑胶，试听间还开着。', '店员'] },
    postcard:   { c: 'postcard',   ey: Math.PI,   pitch: 0.05, exD: [0, 1.8],  exYaw: 0,            msg: ['明信片铺。整墙的澜滩、星珠、魔都中心。', '店主'] },
    umbrella:   { c: 'umbrella',   ey: -Math.PI / 2, pitch: 0.05, exD: [1.6, 0], exYaw: Math.PI / 2, msg: ['雨具店。一墙撑开的伞，像一排彩色的蘑菇。', '店主'] },
    flower:     { c: 'flower',     ey: Math.PI / 2, pitch: 0.05, exD: [-1.6, 0], exYaw: -Math.PI / 2, msg: ['花店。满屋子的玫瑰和桔梗，冷柜里还亮着灯。', '店主'] },
    coffeeshop: { c: 'coffeeshop', ey: Math.PI,   pitch: 0.05, exD: [0, 1.8],  exYaw: 0,            msg: ['夜航咖啡。磨豆机还在转，黑板上写着今晚的豆子。', '咖啡师'] },
    home:       { c: 'puxiHome',   ey: 0,         pitch: -0.04, exD: [1.3, 0], exYaw: Math.PI / 2,  msg: ['四楼，402。钥匙在门口的鞋柜上转了两圈——到家了。', '旁白'] },
    ferryhall:  { c: 'ferryHall',  ey: -Math.PI / 2, pitch: 0.03, exD: [2.2, 0], exYaw: -Math.PI / 2, msg: ['候船厅。班次牌亮着，长椅上坐着等船的人。', '渡口'] },
    bar:        { c: 'bar',        ey: -Math.PI / 2, pitch: 0.04, exD: [1.6, 0], exYaw: Math.PI / 2, msg: ['夜航小馆。玻璃外的江在黑里发亮，吧台后有人在擦杯子。', '酒保'] },
    cafe:       { c: 'cafe',       ey: Math.PI,   pitch: 0.12, exD: [0, 1.6],  exYaw: 0,            msg: ['江畔咖啡。雨声被玻璃隔在外面。', '店员'] },
    l2:         { c: 'l2',         ey: 0,         pitch: -0.08, inPos: [168, 223.2], msg: ['L2 观景廊。脚下就是大堂，隔着玻璃是临江嘴的夜。', '小满'] },
    l3:         { c: 'l3',         ey: Math.PI,   pitch: -0.02, inPos: [168, 224.0], msg: ['L3。再上一层，澜滩和江都摊在脚下。', '小满'] },
  };
  function enterRoom(name) {
    const r = ROOMS[name];
    if (!r || S.phase !== 'playing' || S.mode !== 'foot') return;
    const c = C[r.c]; if (!c) return;
    if (name === 'l3' && S.place !== 'l2') return;
    if (name === 'l2' && S.place !== 'lobby') return;
    const ip = r.inPos || c.inside;
    S.player.x = ip[0]; S.player.z = ip[1]; S.player.y = c.y;
    boardDeck(deckAt(ip[0], ip[1], c.y, 0.3));
    S.player.yaw = r.ey; S.camera.yaw = r.ey; S.camera.pitch = r.pitch;
    arriveRoom(name);
  }
  function arriveRoom(name) {
    const r = ROOMS[name];
    S.place = name;
    S.near = null; show(el.prompt, false);
    Audio.ui();
    subtitle(r.msg[0], r.msg[1], 4);
    if (SHOP_ROOMS.includes(name) || name === 'bar' || name === 'cafe') stamp(name, '小店');
    if (name === 'l3') stamp('l3', 'L3 观景层');
    if (name === 'ferryhall') stamp('ferryhall', '候船厅');
    S.warmth = Math.min(100, S.warmth + 6);
    jobEvent('room', name);
    syncActors(); updateHUD();
  }
  // Rooms with an open doorway are also entered and left on foot: crossing the
  // threshold switches the place (and the indoor camera) without a teleport.
  const SHOP_ROOMS = ['bookshop', 'bakery', 'records', 'postcard', 'umbrella', 'flower', 'coffeeshop'];
  const WALK_IN = ['lobby', 'mall', 'cafe', 'bar', 'ferryhall'];
  const roomBox = (name) => C[ROOMS[name].c];
  const inBox = (c, m) => !!c && S.player.x > c.x0 + m && S.player.x < c.x1 - m && S.player.z > c.z0 + m && S.player.z < c.z1 - m;
  const TOWER_ROOMS = ['lobby', 'l2', 'l3'];
  function syncRoomByFoot() {
    if (S.view || S.mode !== 'foot') return;
    const cur = S.place;
    // the lobby escalator and galleries are decks that carry the room they belong to
    if (S.player.deck) {
      const r = S.player.deckRef && S.player.deckRef.room;
      if (r && r !== cur && TOWER_ROOMS.includes(cur)) {
        if (r === 'l2' && cur === 'lobby') arriveRoom('l2');
        else { S.place = r; jobEvent('room', r); detectInteraction(); syncActors(); updateHUD(); }
      }
      return;
    }
    if (cur && ROOMS[cur]) {
      if (cur === 'l2' || cur === 'l3') {
        if (inBox(C.lobby, 0)) { S.place = 'lobby'; detectInteraction(); syncActors(); updateHUD(); }
        return;
      }
      if (!inBox(roomBox(cur), -0.6)) {
        S.place = SHOP_ROOMS.includes(cur) && inBox(C.mall, 0) ? 'mall' : null;
        detectInteraction(); syncActors(); updateHUD();
      } else if (cur === 'mall') {
        for (const s of SHOP_ROOMS) if (inBox(roomBox(s), 0.3)) { arriveRoom(s); break; }
      }
      return;
    }
    if (cur) return;
    for (const n of WALK_IN) if (inBox(roomBox(n), 0.3)) { arriveRoom(n); return; }
  }
  function exitRoom(name) {
    const r = ROOMS[name];
    if (!r || S.place !== name) return;
    const c = C[r.c];
    S.place = name === 'l3' ? 'l2' : SHOP_ROOMS.includes(name) ? 'mall' : null;
    boardDeck(null);
    if (name === 'l3') {
      const l2 = C.l2;
      S.player.x = 168; S.player.z = 223.2; S.player.y = l2.y;
      boardDeck(deckAt(168, 223.2, l2.y, 0.3));
      S.player.yaw = Math.PI; S.camera.yaw = Math.PI;
    } else if (name === 'l2') {
      S.place = 'lobby';
      S.player.x = 180; S.player.z = 206.4; S.player.y = A.groundY(180, 206.4);
      S.player.yaw = Math.PI; S.camera.yaw = Math.PI; S.camera.pitch = 0.1;
    } else {
      S.player.x = c.door[0] + r.exD[0]; S.player.z = c.door[1] + r.exD[1];
      S.player.y = A.groundY(S.player.x, S.player.z);
      S.player.yaw = r.exYaw; S.camera.yaw = r.exYaw; S.camera.pitch = 0.12;
    }
    if (name === 'l2' && S.view === 'l2scope') S.view = null;
    detectInteraction(); syncActors(); updateHUD();
  }
  // named wrappers kept for __TEST and the ?debug query flags
  const enterLobby = () => enterRoom('lobby'), exitLobby = () => exitRoom('lobby');
  const enterMall = () => enterRoom('mall'), exitMall = () => exitRoom('mall');
  const enterBookshop = () => enterRoom('bookshop'), exitBookshop = () => exitRoom('bookshop');
  const enterBakery = () => enterRoom('bakery'), exitBakery = () => exitRoom('bakery');
  const enterRecords = () => enterRoom('records'), exitRecords = () => exitRoom('records');
  const enterPostcard = () => enterRoom('postcard'), exitPostcard = () => exitRoom('postcard');
  const enterUmbrella = () => enterRoom('umbrella'), exitUmbrella = () => exitRoom('umbrella');
  const enterFlower = () => enterRoom('flower'), exitFlower = () => exitRoom('flower');
  const enterCoffeeShop = () => enterRoom('coffeeshop'), exitCoffeeShop = () => exitRoom('coffeeshop');
  const enterFerryHall = () => enterRoom('ferryhall'), exitFerryHall = () => exitRoom('ferryhall');
  const enterBar = () => enterRoom('bar'), exitBar = () => exitRoom('bar');
  const enterCafe = () => enterRoom('cafe'), exitCafe = () => exitRoom('cafe');
  const enterL2 = () => enterRoom('l2'), exitL2 = () => exitRoom('l2');
  const enterL3 = () => enterRoom('l3'), exitL3 = () => exitRoom('l3');

  // ------------------------------------------------------------- decks: skyway / boardwalk / ring
  // These are walked like the street (see stepDeck); the functions below are
  // shortcuts for the test hooks and debug flags that drop you onto a deck.
  function dropOnDeck(x, z, y, yaw) {
    if (S.phase !== 'playing' || S.mode !== 'foot') return false;
    if (inRoom()) S.place = null;
    S.view = null;
    S.player.x = x; S.player.z = z; S.player.y = y;
    boardDeck(deckAt(x, z, y, 0.6));
    S.player.yaw = yaw; S.camera.yaw = yaw; S.camera.pitch = 0.03;
    S.near = null; show(el.prompt, false);
    Audio.ui(); syncDeckPlace(); detectInteraction(); syncActors(); updateHUD();
    return true;
  }
  function stepOffAt(foot, yaw) {
    S.player.x = foot[0]; S.player.z = foot[1];
    S.player.y = A.groundY(foot[0], foot[1]); boardDeck(null);
    S.player.yaw = yaw; S.camera.yaw = yaw;
    S.place = null;
    detectInteraction(); syncActors(); updateHUD();
  }
  const nearestFoot = (list) => { let best = list[0], bd = 1e9; for (const s of list) { const d = Math.hypot(s.foot[0] - S.player.x, s.foot[1] - S.player.z); if (d < bd) { bd = d; best = s; } } return best; };
  const yawFromTo = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]);
  function enterSkyway(fromRing) {
    const k = C.skyway; if (!k) return;
    const t = fromRing ? 0.9 : 0.1, x = k.ax + (k.bx - k.ax) * t, z = k.az + (k.bz - k.az) * t;
    dropOnDeck(x, z, k.y, fromRing ? Math.atan2(k.ax - k.bx, k.az - k.bz) : Math.atan2(k.bx - k.ax, k.bz - k.az));
  }
  function exitSkyway() {
    if (S.place !== 'skyway') return;
    const k = C.skyway;
    const t = ((S.player.x - k.ax) * (k.bx - k.ax) + (S.player.z - k.az) * (k.bz - k.az)) / (k.len * k.len || 1);
    if (t > 0.5) enterRing(); else stepOffAt(k.foot, yawFromTo(k.top, k.foot));
  }
  function enterBoardwalk() {
    const b = C.boardwalk; if (!b) return;
    dropOnDeck((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, b.y, -Math.PI / 2);
  }
  function exitBoardwalk() {
    if (S.place !== 'boardwalk') return;
    const s = nearestFoot(C.boardwalk.stairs);
    stepOffAt(s.foot, yawFromTo(s.top, s.foot));
  }
  function enterRing() {
    const r = C.ringBridge; if (!r) return;
    const a = Math.PI / 2;
    dropOnDeck(r.cx + Math.cos(a) * r.r, r.cz + Math.sin(a) * r.r, r.y, -Math.PI / 2);
  }
  function exitRing() {
    if (S.place !== 'ring') return;
    const s = nearestFoot(C.ringBridge.stairs);
    stepOffAt(s.foot, yawFromTo(s.top, s.foot));
  }
  // ------------------------------------------------------------- small views: scope / telescope / bench / terrace
  function enterL2Scope() {
    if (S.place !== 'l2') return;
    S.view = 'l2scope';
    stamp('l2scope', '观景镜');
    Audio.ui();
    subtitle('观景镜。对岸澜滩、江上的桥、临江嘴三件套都在一条线上。', '旁白', 4);
    updateHUD();
  }
  function exitL2Scope() { if (S.view === 'l2scope') { S.view = null; detectInteraction(); updateHUD(); } }
  function enterTelescope() {
    if (S.phase !== 'playing' || S.mode !== 'foot') return;
    if (!pay(PRICE.telescope, '望远镜')) return;
    S.view = 'telescope';
    stamp('telescope', '望远镜');
    const T = C.telescope;
    S.player.x = T.x; S.player.z = T.z; S.player.y = A.groundY(T.x, T.z);
    S.camera.yaw = T.yaw; S.camera.pitch = 0.04;
    S.near = null; show(el.prompt, false);
    Audio.ui();
    subtitle('望远镜。澜滩的钟楼、青穹饭店的绿顶。E 离开。', '旁白', 4);
  }
  function exitTelescope() {
    if (S.view !== 'telescope') return;
    S.view = null;
    S.player.x = C.telescope.x + 0.6; S.player.y = A.groundY(S.player.x, S.player.z);
    detectInteraction(); updateHUD();
  }
  function sitBench() {
    if (S.phase !== 'playing' || S.mode !== 'foot') return;
    S.view = 'sit';
    stamp('bench', '江边长椅');
    const B = C.riverBench;
    S.player.x = B.x; S.player.z = B.z; S.player.y = A.groundY(B.x, B.z);
    S.player.yaw = B.yaw; S.camera.yaw = B.yaw; S.camera.pitch = 0.1;
    S.near = null; show(el.prompt, false);
    Audio.ui();
    subtitle('坐下。雨落在江面上。', '旁白', 3);
  }
  function standUp() {
    if (S.view !== 'sit') return;
    S.view = null;
    S.player.x = C.riverBench.stand[0]; S.player.z = C.riverBench.stand[1];
    detectInteraction(); updateHUD();
  }
  function sitCafeTerrace() {
    if (S.phase !== 'playing' || S.mode !== 'foot' || !C.cafeTerrace) return;
    S.view = 'terrace';
    stamp('terrace', '露天座');
    S.player.x = C.cafeTerrace.seat[0]; S.player.z = C.cafeTerrace.seat[1]; S.player.y = C.cafeTerrace.y;
    S.player.yaw = Math.PI; S.camera.yaw = Math.PI; S.camera.pitch = 0.04;
    S.stamina = Math.min(100, S.stamina + 5);
    S.near = { kind: 'standCafe' }; S.promptKey = 'E'; S.promptText = '起身'; S.promptKind = 'standCafe';
    Audio.ui();
    subtitle('露天座。伞下有一圈热气，江风到这儿就软了。体力 +5。', '旁白', 4);
    updateHUD();
  }
  function standCafeTerrace() {
    if (S.view !== 'terrace') return;
    S.view = null;
    S.camera.pitch = 0.1;
    detectInteraction(); syncActors(); updateHUD();
  }

  // ------------------------------------------------------------- river cruise
  function enterCruise() {
    if (S.phase !== 'playing' || S.mode !== 'foot' || !C.cruise) return;
    const c = S.cruise, cr = C.cruise;
    c.active = true; c.t = 0; c.speed = 18; c.docked = true; c.yaw = Math.PI;
    c.boatX = cr.boat0[0]; c.boatZ = cr.boat0[1];
    S.mode = 'cruise';
    S.player.x = c.boatX; S.player.z = c.boatZ; S.player.y = 4.3; S.player.yaw = c.yaw;
    S.camera.yaw = c.yaw; S.camera.pitch = 0.16;
    cr.boat.position.set(c.boatX, 0, c.boatZ); cr.boat.rotation.y = c.yaw;
    S.near = null; show(el.prompt, false);
    Audio.ui(); Audio.horn();
    subtitle('申江邮船。澜滩—临江嘴夜航，E 下船。', '船员', 5);
    updateHUD();
  }
  function exitCruise() {
    if (S.mode !== 'cruise') return;
    const cr = C.cruise;
    S.mode = 'foot'; S.cruise.active = false; S.saloonInside = false;
    S.player.x = cr.pier[0] + 2; S.player.z = cr.pier[1]; S.player.y = 0.61;
    S.player.yaw = Math.PI; S.camera.yaw = Math.PI; S.camera.pitch = 0.17;
    Audio.ui();
    subtitle('回到码头。船还会再开一班。', '船员', 3);
    detectInteraction(); syncActors(); updateHUD();
  }
  function enterSaloon() {
    if (S.mode !== 'cruise' || !C.saloon) return;
    S.saloonInside = true; S.saloon.x = -4.2; S.saloon.z = -1.4;
    stamp('saloon', '邮船沙龙');
    S.camera.orbit = Math.PI / 2; S.camera.pitch = 0.02;
    Audio.ui();
    subtitle('邮船沙龙。吧台在后，窗外就是申江。', '船员', 5);
    updateHUD();
  }
  function exitSaloon() {
    if (!S.saloonInside) return;
    S.saloonInside = false;
    Audio.ui(); subtitle('回到甲板。', '船员', 3);
    updateHUD();
  }
  function updateCruise(dt) {
    const c = S.cruise, cr = C.cruise;
    c.t = (c.t + dt * c.speed / cr.length) % 1;
    const p = cr.route.getPointAt(c.t);
    const tan = cr.route.getTangentAt(c.t);
    c.boatX = p.x; c.boatZ = p.z; c.yaw = Math.atan2(tan.x, tan.z);
    cr.boat.position.set(p.x, 0, p.z); cr.boat.rotation.y = c.yaw;
    if (S.saloonInside) {
      const sp = (key.shift ? 3.8 : 2.2) * dt;
      let fx = 0, fz = 0;
      if (key.w || key.up) fz += 1; if (key.s || key.down) fz -= 1;
      if (key.a || key.left) fx -= 1; if (key.d || key.right) fx += 1;
      if (fx || fz) {
        const n = Math.hypot(fx, fz), ly = S.camera.orbit;
        const mx = Math.sin(ly) * fz + Math.cos(ly) * fx;
        const mz = Math.cos(ly) * fz - Math.sin(ly) * fx;
        S.saloon.x = clamp(S.saloon.x + mx / n * sp, C.saloon.x0, C.saloon.x1);
        S.saloon.z = clamp(S.saloon.z + mz / n * sp, C.saloon.z0, C.saloon.z1);
      }
      S.player.x = c.boatX; S.player.z = c.boatZ; S.player.y = 4.3;
      Audio.engineState(6, true);
      return;
    }
    const offZ = -1.2;
    S.player.x = p.x + Math.sin(c.yaw) * offZ;
    S.player.z = p.z + Math.cos(c.yaw) * offZ;
    S.player.y = 4.3; S.player.yaw = c.yaw;
    if (!mouseLooking()) S.camera.yaw = damp(S.camera.yaw, c.yaw, 1.2, dt);
    S.camera.pitch = clamp(S.camera.pitch, -0.05, 0.55);
    Audio.engineState(6, true);
  }

  // ------------------------------------------------------------- the last ferry: 东晟路 -> 十八埠
  // The boat runs its route while the walker stays free on the car deck: input
  // is turned into the boat's frame, the deck edges and parked e-bikes hold the
  // walker, and the boat's own turning carries the walker and the camera round.
  // a Huangpu crossing ferry makes about 9 knots
  const FERRY_V = 4.8;
  const RAMP_UP = C.ferryRide ? C.ferryRide.rampUp : 0.62;
  const smooth01 = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  function ferryToWorld(lx, lz) {
    const F = S.ferry, c = Math.cos(F.yaw), s = Math.sin(F.yaw);
    return [F.x + c * lx + s * lz, F.z - s * lx + c * lz];
  }
  function placeOnFerry() {
    const F = S.ferry, R = C.ferryRide, P = S.player, [x, z] = ferryToWorld(F.lx, F.lz);
    const onRamp = Math.max(0, F.lz - R.walk.z1) / 2.3;
    P.x = x; P.z = z; P.y = R.deckY + F.bob - Math.min(1, onRamp) * (R.deckY - 0.86);
  }
  function startFerry() {
    const R = C.ferryRide;
    if (!R || S.mode !== 'foot') return;
    const F = S.ferry;
    Object.assign(F, { on: true, phase: 'board', t: 0, s: 0, speed: 0, x: R.east.x, z: R.east.z, yaw: R.east.yaw, bob: 0, lx: 0, lz: -10.2, landed: false, skipT: -1 });
    S.place = null; boardDeck(null); S.firstPerson = false;
    if (S.taxi.state === 'toPlayer' || S.taxi.state === 'waiting') { S.taxi.state = 'idle'; S.taxi.path = null; S.taxiHome = false; toast('已取消叫车 · 坐渡轮过江', 2.5); }
    R.place(F.x, F.z, F.yaw, 0); R.setRamps(RAMP_UP, 0);
    placeOnFerry();
    S.player.yaw = F.yaw; S.camera.yaw = F.yaw; S.camera.pitch = 0.14;
    S.near = null; show(el.prompt, false);
    Audio.ui();
    subtitle(`${fmtClock(S.clock)}，检票登船。申渡 7 号，东晟路—十八埠。电瓶车一辆辆推上来，船尾的跳板正在收起。`, '渡口', 5.5);
    syncActors(); updateHUD();
  }
  function skipFerry() {
    const F = S.ferry;
    if (!F.on || F.phase !== 'sail' || F.skipT >= 0) return;
    F.skipT = 0; Audio.ui();
  }
  function rideFerry(dt) {
    const F = S.ferry, R = C.ferryRide, P = S.player;
    F.t += dt;
    if (F.phase === 'board') {
      R.setRamps(RAMP_UP, RAMP_UP * smooth01((F.t - 0.8) / 3));
      if (F.t > 4.2) { F.phase = 'sail'; F.t = 0; Audio.horn(); subtitle('汽笛一声，渡轮离开东晟路，船头朝西。对岸十八埠的红字在雨里亮着。', '旁白', 5); }
    } else if (F.phase === 'sail') {
      const left = R.length - F.s;
      const want = Math.min(FERRY_V, 0.3 + Math.sqrt(2 * 0.3 * Math.max(0, left - 0.4)));
      F.speed = F.speed < want ? Math.min(want, F.speed + 0.55 * dt) : want;
      F.s = Math.min(R.length, F.s + F.speed * dt);
      if (left < 0.4) { F.s = R.length; F.phase = 'dock'; F.t = 0; F.speed = 0; Audio.horn(); }
    } else if (F.phase === 'dock') {
      R.setRamps(RAMP_UP * (1 - smooth01(F.t / 2.6)), RAMP_UP);
      if (F.t > 2.8) { F.phase = 'docked'; F.t = 0; subtitle('靠岸了。船头的跳板放到趸船上——往前走就下船。', '船员', 4.5); }
    }
    // looking out over the rail: the crossing passes in a blink
    if (F.skipT >= 0) {
      F.skipT += dt;
      if (F.skipT >= 0.45 && F.phase === 'sail' && R.length - F.s > 75) { const jump = R.length - 75 - F.s; F.s += jump; F.speed = Math.min(F.speed, FERRY_V); S.clock += jump / FERRY_V * TIME_SCALE / 60; }
      veil.style.opacity = String(F.skipT < 0.45 ? F.skipT / 0.45 : Math.max(0, 1 - (F.skipT - 0.6) / 0.7));
      if (F.skipT > 1.3) { F.skipT = -2; veil.style.opacity = '0'; }
    }
    const u = clamp(F.s / R.length, 0, 1), p = R.route.getPointAt(u), tg = R.route.getTangentAt(u);
    const yaw = Math.atan2(tg.x, tg.z), dyaw = wrapAngle(yaw - F.yaw);
    F.x = p.x; F.z = p.z; F.yaw = yaw;
    F.bob = Math.sin(S.realTime * 0.9) * (F.phase === 'sail' ? 0.05 : 0.02);
    R.place(F.x, F.z, F.yaw, F.bob);
    if (F.phase === 'sail') R.boat.rotation.z = Math.sin(S.realTime * 0.7) * 0.012 * Math.min(1, F.speed / 4);
    R.wakeMat.opacity = damp(R.wakeMat.opacity, F.phase === 'sail' ? Math.min(0.9, F.speed / 4.2) : 0, 1.5, dt);
    R.flow(dt, F.speed);
    P.yaw += dyaw; S.camera.yaw += dyaw;
    // the walker, in the boat's frame
    let f = (key.w || key.up ? 1 : 0) - (key.s || key.down ? 1 : 0);
    let st = (key.d || key.right ? 1 : 0) - (key.a || key.left ? 1 : 0);
    if (touch.active) { f += -touch.fwd; st += touch.str; }
    if (S.ph.open) { f = 0; st = 0; }
    f = clamp(f, -1, 1); st = clamp(st, -1, 1);
    const mag = Math.hypot(f, st);
    if (mag > 0.05) {
      f /= mag; st /= mag;
      const cy = S.camera.yaw;
      const mx = Math.sin(cy) * f - Math.cos(cy) * st, mz = Math.cos(cy) * f + Math.sin(cy) * st;
      P.yaw += wrapAngle(Math.atan2(mx, mz) - P.yaw) * Math.min(1, dt * 9);
      const quick = key.shift && S.stamina > 2 && !S.aim.active;
      P.speed = damp(P.speed, S.aim.active ? 1.0 : quick ? 3.2 : 1.9, 7, dt);
      P.moving = true; P.sprint = false;
      const wx = mx * P.speed * dt, wz = mz * P.speed * dt, c = Math.cos(F.yaw), s = Math.sin(F.yaw);
      const dlx = c * wx - s * wz, dlz = s * wx + c * wz;
      const W = R.walk, zMax = F.phase === 'docked' ? W.zLand + 0.7 : W.z1;
      const free = (x, z) => x > W.x0 && x < W.x1 && z > W.z0 && z < zMax && !R.obstacles.some((o) => x > o.x0 - 0.3 && x < o.x1 + 0.3 && z > o.z0 - 0.3 && z < o.z1 + 0.3);
      if (free(F.lx + dlx, F.lz + dlz)) { F.lx += dlx; F.lz += dlz; }
      else if (free(F.lx + dlx, F.lz)) F.lx += dlx;
      else if (free(F.lx, F.lz + dlz)) F.lz += dlz;
      P.walkPhase += dt * 8;
      if (S.realTime - lastStep > 0.5) { Audio.step(); lastStep = S.realTime; }
    } else {
      P.speed = damp(P.speed, 0, 10, dt);
      P.moving = false; P.sprint = false;
      P.walkPhase = damp(P.walkPhase, Math.round(P.walkPhase / Math.PI) * Math.PI, 4, dt);
    }
    placeOnFerry();
    S.stamina = Math.min(100, S.stamina + dt * 6);
    animVisitor(dt);
    Audio.engineState(F.phase === 'sail' ? 5 : 1, true);
    if (F.phase === 'docked' && F.lz > R.walk.zLand + 0.4) leaveFerry(true);
  }
  // stepping off: either walked off the bow ramp (keep the spot) or led off by the crew
  function leaveFerry(walked) {
    const F = S.ferry, R = C.ferryRide, P = S.player;
    if (!F.on) return;
    F.on = false; F.landed = true; F.phase = 'moored'; F.speed = 0;
    if (walked) { const [x, z] = ferryToWorld(F.lx, F.lz); P.x = x; P.z = z; }
    else { P.x = R.landing.x; P.z = R.landing.z; P.yaw = R.landing.yaw; S.camera.yaw = R.landing.yaw; }
    [P.x, P.z] = moveCircle(P.x, P.z, 0, 0, 0.38);
    P.y = A.groundY(P.x, P.z); boardDeck(null);
    R.wakeMat.opacity = 0; R.boat.rotation.z = 0;
    Audio.ui(); Audio.engineState(0, false);
    subtitle('十八埠。走引桥上岸，过江滨东二路就是永安里——28 号在弄堂最里头，四楼 402。', '旁白', 6);
    detectInteraction(); syncActors(); updateHUD();
  }
  function sleepHome() {
    if (S.place !== 'home') return;
    endRun('ferry', `${fmtClock(S.clock)}，到家。湿外套挂上门背，小太阳拧开，窗外的雨还在下——今晚到此为止。`);
  }
