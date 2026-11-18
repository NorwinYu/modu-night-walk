  // ------------------------------------------------------------- the night: commissions, timetable, events
  // Contacts message the player through the phone; each commission is a small
  // errand built on places that already exist in the city. Nothing here can fail
  // the run: a missed deadline only closes that one errand.
  const CONTACTS = {
    xiaoman: { name: '小满', sub: '朋友 · 在魔都中心 L3 加班', color: '#ff8a3d', glyph: '满' },
    zhou: { name: '老周', sub: '明信片铺 · 环港广场', color: '#ffd86b', glyph: '周' },
    mei: { name: '阿梅', sub: '花店 · 环港广场', color: '#ff6fae', glyph: '梅' },
    ken: { name: '阿 Ken', sub: '唱片行 · 环港广场', color: '#b490ff', glyph: 'K' },
    yexing: { name: '夜行互助', sub: '附近求助 · 同城', color: '#48f0a2', glyph: '助' },
    city: { name: '夜行电台', sub: '天气 · 出行 · 广播', color: '#6fe6ff', glyph: '夜' },
  };
  const BUS_STOP = { x: -7.5, z: 155.2, name: '观澜大道站' };
  const HOME_FARE = 46;                   // flat estimate to the hotel in 申西
  const ELDER = C.riverBench ? [C.riverBench.stand[0] + 0.6, C.riverBench.stand[1] - 2.8] : [-626, 96.7];
  const COFFEE_HOT = 15;                  // game minutes a latte stays hot
  const ferryDoor = () => C.ferryHall ? { x: C.ferryHall.door[0] + 1.5, z: C.ferryHall.door[1] } : { x: C.ferry[0], z: C.ferry[1] };
  const inMall = () => !!S.place && S.place !== 'lobby' && S.place !== 'l2' && S.place !== 'l3' && S.place !== 'ferryhall' && S.place !== 'bar' && S.place !== 'cafe';
  const shopTarget = (ck, name) => (S.place === 'mall' || inMall()) && C[ck] ? { x: C[ck].door[0], z: C[ck].door[1], name } : { x: C.mall.door[0], z: C.mall.door[1], name: '环港广场 · ' + name };
  const jobState = (id) => (S.jobs[id] ? S.jobs[id].state : 'none');
  const isActive = (id) => jobState(id) === 'active';
  const isDone = (id) => jobState(id) === 'done';
  const coffeeMin = () => S.carry.coffee ? S.clock - S.carry.coffee.t : 0;
  const coffeeTemp = () => coffeeMin() <= COFFEE_HOT ? `还热着 · ${Math.max(0, Math.ceil(COFFEE_HOT - coffeeMin()))} 分钟` : '已经凉了';
  const minsTo = (t) => Math.max(0, Math.ceil(t - S.clock));

  const JOB_DEFS = [
    {
      id: 'postcards', from: 'zhou', at: 0, auto: true, title: '五张城市明信片', pts: 120, rep: 2,
      reward: '按照片质量付款 · 每张约 ¥25–60',
      offer: '今晚雨景难得。帮我拍五张：星珠塔、魔都中心、云阙、金岳，再加一张滨江看澜滩。顺序随你，拍好在手机「相册」里直接发我，按片子好坏付钱。',
      steps: () => [...PHOTO_IDS.map((id) => ({ t: '拍 ' + spotById(id).name, done: S.photos.includes(id) })), { t: '在手机「相册」里发给老周', done: isDone('postcards') }],
      target: () => {
        if (S.photos.length >= 5) return { phone: 'album', name: '老周', text: '打开手机「相册」· 把明信片发给老周' };
        const s = nextSpot();
        return { x: s.pos[0], z: s.pos[1], name: s.name, text: `明信片 ${S.photos.length}/5 · 去${s.name}取景`, spot: s };
      },
    },
    {
      id: 'coffee', from: 'xiaoman', at: 3, title: '给小满带一杯热拿铁', pts: 80, rep: 1,
      reward: '¥30 转账 · 夜航咖啡的再 +1 声望',
      offer: '我还在魔都中心 L3 改稿……能帮我带杯热拿铁吗？环港广场的夜航咖啡最好，大堂咖啡亭也行。凉了就不香了。',
      steps: () => [{ t: '买一杯拿铁（夜航咖啡 / 大堂咖啡亭）', done: !!S.carry.coffee || isDone('coffee') }, { t: '趁热送到魔都中心 L3（大堂 → L2 → L3）', done: isDone('coffee') }],
      target: () => {
        if (!S.carry.coffee) return Object.assign(shopTarget('coffeeshop', '夜航咖啡'), { text: '买一杯拿铁 · 夜航咖啡或魔都中心大堂' });
        const up = S.place === 'lobby' || S.place === 'l2';
        return { x: up ? 180 : C.lobby.door[0], z: up ? 206 : C.lobby.door[1], name: up ? '扶梯' : '魔都中心大堂', text: `拿铁送到 L3 · ${coffeeTemp()}` };
      },
    },
    {
      id: 'flowers', from: 'mei', at: 7, title: '把桔梗送到候船厅', pts: 90, rep: 1, pay: 60, deadline: 23 * 60 + 29,
      reward: '¥60 · 23:29 前送到',
      offer: '有位客人坐末班渡轮走，在东晟路渡口候船厅等一束白桔梗。我这走不开，能帮忙送一下吗？船 23:30 开。',
      steps: () => [{ t: '到环港广场花店取花', done: !!S.carry.flowers || isDone('flowers') }, { t: '23:29 前送进东晟路渡口候船厅', done: isDone('flowers') }],
      target: () => S.carry.flowers ? Object.assign(ferryDoor(), { name: '东晟路渡口候船厅', text: `桔梗送到候船厅 · 还剩 ${minsTo(23 * 60 + 29)} 分钟` })
        : Object.assign(shopTarget('flower', '花店'), { text: '去环港广场花店取花' }),
    },
    {
      id: 'vinyl', from: 'ken', at: 12, title: '黑胶唱片送到夜航小馆', pts: 80, rep: 1, pay: 50,
      reward: '¥50 · 老陈请一杯热茶',
      offer: '夜航小馆的老陈订了张夜航三重奏的《雨河》黑胶，今晚就想放。你要是在滨江，帮我捎过去？唱片在我店里柜台上。',
      steps: () => [{ t: '到环港广场唱片行取唱片', done: !!S.carry.vinyl || isDone('vinyl') }, { t: '交给夜航小馆吧台的老陈', done: isDone('vinyl') }],
      target: () => S.carry.vinyl ? { x: C.bar.door[0], z: C.bar.door[1], name: '夜航小馆', text: '把黑胶交给夜航小馆的老陈' }
        : Object.assign(shopTarget('records', '唱片行'), { text: '去环港广场唱片行取唱片' }),
    },
    {
      id: 'tourist', from: 'yexing', at: 16, title: '帮游客拍张合影', pts: 60, rep: 1, pay: 10,
      reward: '¥10 小费 · +1 声望',
      offer: '【附近求助】滨江亲水平台有两位游客想要一张和星珠塔的合影，谁方便帮个忙？',
      skip: () => S.photoTouristDone,
      steps: () => [{ t: '到滨江亲水平台找到游客，按 E 帮他们拍', done: isDone('tourist') }],
      target: () => ({ x: C.photoTourist[0], z: C.photoTourist[1], name: '亲水平台的游客', text: '帮亲水平台的游客拍合影' }),
    },
    {
      id: 'aerial', from: 'xiaoman', at: 22, title: '航拍星珠环', pts: 90, rep: 1, pay: 80,
      reward: '¥80 稿费',
      offer: '杂志临时要一张星珠环的俯拍，你不是带了无人机吗？飞到环岛上空 20 米以上拍一张，稿费 ¥80。',
      steps: () => [{ t: '在星珠环附近放飞无人机（V）', done: (S.mode === 'drone' && ringDist(S.drone) < 160) || isDone('aerial') }, { t: '星珠环上空 20 m 以上按 E 拍摄', done: isDone('aerial') }],
      target: () => ({ x: C.ringBridge.cx, z: C.ringBridge.cz, name: '星珠环', text: S.mode === 'drone' ? `飞到星珠环上空 20 m 以上 · 现在 ${Math.round(S.drone.y)} m` : '去星珠环 · 放飞无人机航拍' }),
    },
    {
      id: 'umbrella', from: 'yexing', at: 35, title: '给江边的老人送把伞', pts: 90, rep: 2, pay: 0, deadline: 24 * 60 + 8,
      reward: '+2 声望 · 00:08 前',
      offer: '【附近求助 · 暴雨】滨江长椅边有位老人没带伞，在等家里人来接。谁能送把伞过去？',
      steps: () => [{ t: '准备一把伞（自己的折叠伞，或雨具店买一把）', done: S.umbrella || S.umbrellaBought || isDone('umbrella') }, { t: '把伞交给滨江长椅边的老人', done: isDone('umbrella') }],
      target: () => ({ x: ELDER[0], z: ELDER[1], name: '没带伞的老人', text: `给滨江长椅边的老人送伞 · 还剩 ${minsTo(24 * 60 + 8)} 分钟` }),
    },
  ];
  const JOB = Object.fromEntries(JOB_DEFS.map((d) => [d.id, d]));
  const ringDist = (p) => C.ringBridge ? Math.hypot(p.x - C.ringBridge.cx, p.z - C.ringBridge.cz) : 1e9;

  // ---- elder NPC, only around while the storm errand is open
  const elderGroup = new THREE.Group(); elderGroup.name = 'elder-npc'; elderGroup.visible = false;
  if (G.people) {
    const gy = A.groundY(ELDER[0], ELDER[1]);
    const lk = G.people.look({ sex: 'm', height: 1.66, top: 'coat', topColor: 0x4b4136, bottomColor: 0x2b2b30, hair: 0x8a8580, hairStyle: 'short', acc: [] });
    const wet = G.people.crowd([{ look: lk, pose: 'stand', x: ELDER[0], y: gy, z: ELDER[1], ry: Math.PI / 2 }], 'elder-wet');
    const dry = G.people.crowd([{ look: Object.assign({}, lk, { hold: 'umbrella', holdColor: 0x23405c }), pose: 'hold', x: ELDER[0], y: gy, z: ELDER[1], ry: Math.PI / 2 }], 'elder-dry');
    dry.visible = false;
    elderGroup.add(wet, dry); elderGroup.userData.wet = wet; elderGroup.userData.dry = dry;
    scene.add(elderGroup);
  }
  function syncElder() {
    const st = jobState('umbrella');
    elderGroup.visible = (st === 'offered' || st === 'active' || (st === 'done' && S.clock < 24 * 60 + 12));
    if (elderGroup.userData.wet) { elderGroup.userData.wet.visible = st !== 'done'; elderGroup.userData.dry.visible = st === 'done'; }
  }

  // ---- messages
  function msg(from, text, opts) {
    const th = S.msgs[from] || (S.msgs[from] = []);
    th.push(Object.assign({ who: 'them', text, t: fmtClock(S.clock) }, opts || {}));
    if (!(S.ph.open && S.ph.app === 'thread' && S.ph.sub === from)) S.unread[from] = (S.unread[from] || 0) + 1;
    notify(CONTACTS[from], text, { app: 'thread', sub: from });
  }
  const myMsg = (to, text) => { (S.msgs[to] || (S.msgs[to] = [])).push({ who: 'me', text, t: fmtClock(S.clock) }); };

  // ---- commission lifecycle
  function offerJob(id) {
    const d = JOB[id];
    if (S.jobs[id] || (d.skip && d.skip())) return;
    S.jobs[id] = { state: d.auto ? 'active' : 'offered', at: S.clock };
    msg(d.from, d.offer, { job: id });
    if (d.auto) { myMsg(d.from, '好，我去拍。'); if (!S.track) S.track = id; }
    syncElder();
  }
  function acceptJob(id) {
    const j = S.jobs[id]; if (!j || j.state !== 'offered') return;
    j.state = 'active';
    myMsg(JOB[id].from, ['好，交给我。', '没问题，这就去。', '收到，我顺路。'][JOB_DEFS.indexOf(JOB[id]) % 3]);
    S.track = id; setNavTarget(null);
    Audio.beep(); toast('已接受 · ' + JOB[id].title);
    syncElder();
  }
  function declineJob(id) {
    const j = S.jobs[id]; if (!j || (j.state !== 'offered' && j.state !== 'active')) return;
    j.state = 'declined';
    myMsg(JOB[id].from, '抱歉，今晚顾不上了。');
    if (S.track === id) S.track = nextTracked();
    Audio.ui(); syncElder();
  }
  function completeJob(id, pay, thanks, extraRep = 0, ptsScale = 1) {
    const j = S.jobs[id], d = JOB[id];
    if (!j || j.state === 'done') return;
    j.state = 'done'; j.doneAt = S.clock; j.pts = Math.round(d.pts * ptsScale);
    S.rep += d.rep + extraRep;
    if (pay) earn(pay, d.title);
    msg(d.from, thanks + (pay ? ` [转账 ¥${Math.round(pay)}]` : ''));
    toast(`委托完成 · ${d.title}${pay ? ' · +¥' + Math.round(pay) : ''} · 声望 +${d.rep + extraRep}`, 3.2);
    Audio.chime();
    if (S.track === id) S.track = nextTracked();
    syncElder(); updateHUD();
  }
  function expireJob(id, text) {
    const j = S.jobs[id]; if (!j || j.state === 'done' || j.state === 'expired' || j.state === 'declined') return;
    j.state = 'expired';
    msg(JOB[id].from, text);
    if (S.track === id) S.track = nextTracked();
    syncElder();
  }
  const nextTracked = () => { const d = JOB_DEFS.find((x) => isActive(x.id)); return d ? d.id : null; };
  const jobsDone = () => JOB_DEFS.filter((d) => isDone(d.id)).length;
  const jobsPoints = () => JOB_DEFS.reduce((a, d) => a + (isDone(d.id) ? (S.jobs[d.id].pts || d.pts) : 0), 0);
  function trackJob(id) { if (!isActive(id)) return; S.track = id; setNavTarget(null); Audio.focus(); updateHUD(); }

  // what the HUD points at: the tracked commission, else the way home
  function jobTarget() {
    if (!S.track || !isActive(S.track)) { S.track = nextTracked(); if (!S.track) return null; }
    const t = JOB[S.track].target();
    if (!t) return null;
    if (t.phone) { const p = subject(); return Object.assign({ x: p.x, z: p.z }, t); }
    return t;
  }
  function nextDeparture() {
    const fd = ferryDoor();
    if (S.ferry.on) return { id: 'onboard', label: '渡轮过江中 · 十八埠靠岸', short: '渡轮 · 过江中', x: C.puxi.landing.x, z: C.puxi.landing.z, name: '十八埠渡口' };
    if (S.ferry.landed) { const h = C.puxiHome.door; return { id: 'home', label: '已过江 · 永安里 28 号', short: '申西 · 回家', x: h[0], z: h[1], name: '永安里 28 号' }; }
    if (!timed()) return { id: 'free', label: '班次不停 · 随时回家', short: '自由漫步', x: fd.x, z: fd.z, name: '东晟路渡口' };
    if (S.clock < CLOCK_LAST) return { id: 'ferry', label: `末班渡轮 23:30 · 还有 ${minsTo(CLOCK_LAST)} 分`, short: `渡轮 23:30 · ${minsTo(CLOCK_LAST)} 分`, x: fd.x, z: fd.z, name: '东晟路渡口' };
    if (S.clock < CLOCK_BUS) return { id: 'bus', label: `夜宵 N1 00:10 · 还有 ${minsTo(CLOCK_BUS)} 分`, short: `N1 00:10 · ${minsTo(CLOCK_BUS)} 分`, x: BUS_STOP.x, z: BUS_STOP.z, name: BUS_STOP.name };
    return { id: 'taxi', label: `只能打车了 · 01:00 前`, short: `打车 · 01:00 前 ${minsTo(CLOCK_END)} 分`, name: '打车回家' };
  }
  function homeTarget() {
    const d = nextDeparture(), p = subject();
    if (d.id === 'onboard') return { x: d.x, z: d.z, name: d.name, text: '渡轮过江中 · 到十八埠下船' };
    if (d.id === 'home') return S.place === 'home' ? { x: C.puxiHome.bed[0], z: C.puxiHome.bed[1], name: '床', text: '到家了 · 去床边躺下' } : { x: d.x, z: d.z, name: d.name, text: '回家 · 永安里 28 号 402' };
    if (d.id === 'taxi') return { x: p.x, z: p.z, phone: 'taxi', name: '打车回家', text: '打开手机「打车」· 回家' };
    if (d.id === 'bus') return { x: d.x, z: d.z, name: d.name, text: `回家 · 观澜大道站坐 N1（${minsTo(CLOCK_BUS)} 分）` };
    if (d.id === 'free') return { x: d.x, z: d.z, name: d.name, text: '没有委托了 · 想回家就去渡口或打车' };
    return { x: d.x, z: d.z, name: d.name, text: `回家 · 末班渡轮 23:30（${minsTo(CLOCK_LAST)} 分）` };
  }
  const departureOpen = (id) => !timed() || (id === 'ferry' ? S.clock < CLOCK_LAST : id === 'bus' ? S.clock < CLOCK_BUS : S.clock < CLOCK_END);

  // ---- hooks from the rest of the game
  function jobEvent(kind, data) {
    if (S.phase !== 'playing') return;
    if (kind === 'buy' && (data === 'buyLatte' || data === 'lobbyCoffee')) {
      S.carry.coffee = { t: S.clock, fav: data === 'buyLatte' };
      if (isActive('coffee')) toast(`拿铁到手 · ${COFFEE_HOT} 分钟内送到 L3`, 3);
    }
    if (kind === 'room' && data === 'l3' && S.carry.coffee && isActive('coffee')) {
      const hot = coffeeMin() <= COFFEE_HOT, fav = S.carry.coffee.fav;
      S.carry.coffee = null;
      subtitle(hot ? '小满从屏幕后面探出头：“还烫手！你最好了。”' : '小满喝了一口：“有点凉了……不过谢谢你跑这一趟。”', '旁白', 5);
      completeJob('coffee', hot ? 30 : 15, hot ? (fav ? '是夜航的！今晚靠它续命了。' : '热的！谢谢你～') : '凉了一点点，没关系，心意收到。', hot && fav ? 1 : 0, hot ? 1 : 0.6);
    }
    if (kind === 'room' && data === 'ferryhall' && S.carry.flowers && isActive('flowers')) {
      S.carry.flowers = false;
      subtitle('长椅上一位穿风衣的女士站起来接过花：“刚好赶上，谢谢你。”', '客人', 5);
      completeJob('flowers', JOB.flowers.pay, '客人说花很漂亮，谢谢你！');
    }
    if (kind === 'tourist') {
      if (isActive('tourist') || jobState('tourist') === 'offered') { if (jobState('tourist') === 'offered') S.jobs.tourist.state = 'active'; completeJob('tourist', JOB.tourist.pay, '游客发来感谢：照片拍得真好！'); }
    }
    if (kind === 'dronePhoto') {
      const d = S.drone;
      if (isActive('aerial') && ringDist(d) < 95 && d.y >= 20) completeJob('aerial', JOB.aerial.pay, '这张俯拍太好用了，稿费转你。');
      else if (isActive('aerial') && ringDist(d) < 95) toast(`再飞高一点 · 现在 ${Math.round(d.y)} m，要 20 m 以上`, 2.6);
    }
    updateHUD();
  }
  function sendPostcards() {
    if (!isActive('postcards') || !S.photos.length) return;
    const n = S.photos.length;
    const pay = S.photos.reduce((a, id) => a + (S.shots[id] || 0) * 0.6, 0);
    myMsg('zhou', `[图片 ×${n}] 今晚的${n === 5 ? '五张' : n + ' 张'}，你看看。`);
    completeJob('postcards', pay, n === 5 ? '五张都齐了，这光线绝了！按片子付你。' : `先收下这 ${n} 张，也很好。`, n === 5 ? 0 : -1, n / 5);
  }

  // job-specific E prompts; called from detectInteraction before the generic ones
  function jobNear() {
    const P = S.place;
    if (P === 'flower' && isActive('flowers') && !S.carry.flowers && near2(-568.6, 72.8, 2.2)) { setNear('job', 'E', '取阿梅包好的白桔梗', { job: 'flowers', act: 'pick' }); return true; }
    if (P === 'records' && isActive('vinyl') && !S.carry.vinyl && near2(-566.2, 64.8, 2.4)) { setNear('job', 'E', '取阿 Ken 留在柜台的黑胶', { job: 'vinyl', act: 'pick' }); return true; }
    if (P === 'bar' && isActive('vinyl') && S.carry.vinyl && near2(-627.6, 87.3, 2.4)) { setNear('job', 'E', '把黑胶交给老陈', { job: 'vinyl', act: 'drop' }); return true; }
    if (!P && !S.player.deck && !S.aim.active) {
      const st = jobState('umbrella');
      if ((st === 'offered' || st === 'active') && near2(ELDER[0], ELDER[1], 2.6)) {
        if (S.umbrellaBought) setNear('job', 'E', '把买的长柄伞送给老人', { job: 'umbrella', act: 'long' });
        else if (S.umbrella) setNear('job', 'E', '把自己的折叠伞给老人（之后你会淋雨）', { job: 'umbrella', act: 'fold' });
        else setNear('job', 'E', '老人没带伞 · 你手上也没伞', { job: 'umbrella', act: 'none' });
        return true;
      }
      if (near2(BUS_STOP.x, BUS_STOP.z, 3.4)) {
        if (S.waitBus) setNear('busCancel', 'E', '不等了');
        else if (departureOpen('bus')) setNear('busWait', 'E', timed() ? `在站台等 N1 · 00:10 到站（还有 ${minsTo(CLOCK_BUS)} 分）` : '在站台等 N1 · 夜宵线');
        else setNear('busGone', 'E', 'N1 已经开走了 · 用手机打车');
        return true;
      }
    }
    return false;
  }
  function jobAct(it) {
    if (it.job === 'flowers' && it.act === 'pick') { S.carry.flowers = true; Audio.chime(); subtitle('阿梅留了字条：“送到候船厅，穿风衣的那位。”花束上还有水珠。', '花店', 5); }
    else if (it.job === 'vinyl' && it.act === 'pick') { S.carry.vinyl = true; Audio.chime(); subtitle('牛皮纸袋里是夜航三重奏《雨河》，袋子上写着“老陈收”。', '唱片行', 5); }
    else if (it.job === 'vinyl' && it.act === 'drop') {
      S.carry.vinyl = false; S.stamina = Math.min(100, S.stamina + 10); S.warmth = Math.min(100, S.warmth + 8);
      subtitle('老陈把唱片放上唱机，给你倒了杯热茶：“这杯算我的。”体力 +10。', '老陈', 5);
      completeJob('vinyl', JOB.vinyl.pay, '老陈说唱片收到了，钱我转你。');
    } else if (it.job === 'umbrella') {
      if (it.act === 'none') { Audio.deny(); subtitle('你手上没伞。环港广场的雨具店有长柄伞，或者……把自己的给他？', '旁白', 5); return; }
      if (S.jobs.umbrella.state === 'offered') S.jobs.umbrella.state = 'active';
      if (it.act === 'long') S.umbrellaBought = false; else S.umbrella = false;
      subtitle('老人接过伞，连声道谢：“我孙子马上就到。年轻人你自己也别淋着。”', '老人', 5);
      completeJob('umbrella', 0, '老人家已经被家人接到了，大家都在夸你。', it.act === 'fold' ? 1 : 0);
    }
    updateHUD();
  }
  function startBusWait() {
    if (!departureOpen('bus')) return;
    S.waitBus = { from: S.clock, at: timed() ? CLOCK_BUS : S.clock + 3 };
    S.player.speed = 0;
    Audio.ui(); toast('在站台等车 · 时间流逝变快 · 移动就不等了', 3);
    subtitle('站台的电子屏：N1 夜宵线 · 开往申西 · ' + (timed() ? '00:10' : '即将') + ' 到站。', '站台', 5);
  }
  function cancelBusWait(quiet) { if (!S.waitBus) return; S.waitBus = false; if (!quiet) toast('不等了'); }

  // ---- timeline
  const NIGHT_EVENTS = [
    { at: 0.2, id: 'wx', fn: () => msg('city', '【天气】今夜小雨 12°C，23:34 起有短时强降雨。末班渡轮 23:30（东晟路渡口），夜宵 N1 00:10（观澜大道站），打车随时。') },
    { at: 20, id: 'ferry10', timed: true, fn: () => msg('city', '【东晟路渡口】末班渡轮 23:30 开航，请提前进候船厅检票。') },
    { at: 30.5, id: 'ferryGone', timed: true, fn: () => msg('city', '【东晟路渡口】末班渡轮已离岸。夜宵 N1 00:10 在观澜大道站发车。') },
    { at: 34, id: 'storm', fn: () => { S.storm = 1; msg('city', '【暴雨预警】未来 15 分钟强降雨，体温掉得快，尽量进室内。网约车高峰加价 ×1.5。'); } },
    { at: 50, id: 'stormEnd', fn: () => { S.storm = 0; msg('city', '【天气】强降雨减弱，转小雨。'); } },
    { at: 52, id: 'show', fn: () => { S.lightShow = true; msg('city', '【灯光秀】23:52–00:02 临江嘴楼宇灯光秀。这时候拍的明信片更出彩。'); } },
    { at: 60, id: 'midnight', fn: () => msg('xiaoman', timed() ? '零点了。你还在外面吗？N1 是 00:10，别错过。' : '零点了，雨小了点。') },
    { at: 62, id: 'showEnd', fn: () => { S.lightShow = false; } },
    { at: 65, id: 'bus5', timed: true, fn: () => msg('city', '【公交】夜宵 N1 还有 5 分钟到观澜大道站。') },
    { at: 70.5, id: 'busGone', timed: true, fn: () => msg('city', '【公交】夜宵 N1 已发车。现在只能打车回家了。') },
    { at: 105, id: 'late', timed: true, fn: () => msg('xiaoman', '快一点了！再不走就真回不去了，叫个车吧。') },
  ];
  function jobsStart() {
    S.fired = {};
    for (const d of JOB_DEFS) if (d.at === 0) offerJob(d.id);
    syncElder();
  }
  function tickNight(dt) {
    const m = S.clock - CLOCK_START;
    for (const e of NIGHT_EVENTS) if (!S.fired[e.id] && m >= e.at && (!e.timed || timed())) { S.fired[e.id] = 1; e.fn(); }
    for (const d of JOB_DEFS) if (!S.jobs[d.id] && m >= d.at) offerJob(d.id);
    for (const d of JOB_DEFS) if (d.deadline && S.clock > d.deadline) {
      if (d.id === 'flowers') expireJob('flowers', '客人已经上船了……没关系，花你留着吧，今晚辛苦。');
      if (d.id === 'umbrella') expireJob('umbrella', '老人家的孙子到了，已经接走啦。');
    }
    // the storm and the light show are felt in the world, not just read about
    if (G.rainMat) G.rainMat.uniforms.uOpacity.value = damp(G.rainMat.uniforms.uOpacity.value, S.storm ? 0.25 : 0.13, 1.2, dt);
    if (S.waitBus) {
      if (S.clock >= S.waitBus.at) { if (S.wallet >= 2) pay(2, '夜宵 N1'); endRun('bus', `${fmtClock(S.clock)}，N1 进站。刷了 ¥2，坐在最后一排，车窗上全是雨。`); return; }
    }
    if (timed() && S.clock >= CLOCK_END && !S.ferry.on && !S.ferry.landed) { endRun('stranded'); return; }
  }
  const lightShowSpeed = () => (S.lightShow ? 0.09 : 0.012);
