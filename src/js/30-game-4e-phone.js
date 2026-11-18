  // ------------------------------------------------------------- the phone
  // Messages, commissions, map, taxi, album, wallet, journal and timetable live
  // here. The night does not stop while you look at it: the player stands still,
  // the clock keeps going. Driving locks it; the drone borrows it as a remote.
  const PH = { root: $('phone'), screen: $('ph-screen'), time: $('ph-time'), batt: $('ph-batt'), chip: $('phone-chip'), badge: $('phone-badge'), chipBatt: $('phone-batt'), notif: $('notif'), notifUntil: 0, notifTarget: null, mapT: 0 };
  const BANK_PLACES = { cafe: '江畔咖啡', lobby: '魔都中心大堂', bar: '夜航小馆', ferryhall: '候船厅', mall: '环港广场' };
  const CABLE_PLACES = { cafe: 1, lobby: 1, bar: 1, ferryhall: 1 };
  const APPS = [
    { id: 'msgs', name: '消息', glyph: '讯', color: '#3ddc84' },
    { id: 'jobs', name: '委托', glyph: '托', color: '#ff9f43' },
    { id: 'map', name: '地图', glyph: '图', color: '#2fb8ff' },
    { id: 'taxi', name: '打车', glyph: '车', color: '#ffc93c' },
    { id: 'album', name: '相册', glyph: '影', color: '#ff5fa2' },
    { id: 'wallet', name: '钱包', glyph: '¥', color: '#25c07a' },
    { id: 'journal', name: '手账', glyph: '章', color: '#9d7bff' },
    { id: 'times', name: '时刻', glyph: '时', color: '#5b8cff' },
    { id: 'help', name: '帮助', glyph: '?', color: '#7d8799' },
    { id: 'settings', name: '设置', glyph: '设', color: '#566074' },
  ];
  const APP_NAME = Object.fromEntries(APPS.map((a) => [a.id, a.name]));
  const unreadTotal = () => Object.values(S.unread).reduce((a, n) => a + n, 0);
  const offeredCount = () => JOB_DEFS.filter((d) => jobState(d.id) === 'offered').length;
  const surge = () => (S.storm ? 1.5 : 1);
  const fare = (x, z) => { const p = subject(), km = Math.hypot(x - p.x, z - p.z) * 1.35 / 1000; return Math.round((PRICE.taxiFlag + Math.max(0, km - PRICE.taxiFreeKm) * PRICE.taxiPerKm) * surge()); };
  const homeFare = () => Math.round(HOME_FARE * surge());
  const phoneLocked = () => S.mode === 'car' && Math.abs(S.car.speed) > 0.6;

  function notify(c, text, target) {
    if (S.ph.dead || S.phase !== 'playing') { if (S.ph.open) renderPhone(); return; }
    if (S.ph.open) { renderPhone(); Audio.beep(); return; }
    $('nf-ic').textContent = c.glyph; $('nf-ic').style.background = c.color;
    setText($('nf-title'), c.name); setText($('nf-text'), text.length > 46 ? text.slice(0, 45) + '…' : text);
    setText($('nf-t'), fmtClock(S.clock));
    PH.notifTarget = target; PH.notifUntil = S.realTime + 4.6;
    show(PH.notif, true); PH.notif.classList.remove('in'); void PH.notif.offsetWidth; PH.notif.classList.add('in');
    Audio.focus();
  }
  function openPhone(app, sub) {
    if (S.phase !== 'playing') return;
    if (S.mode === 'drone') { toast('手机正当无人机遥控器用 · V 收回无人机'); return; }
    if (S.aim.active) lowerCamera();
    if (S.waitBus && !S.ph.open) { /* checking the phone at the stop is fine */ }
    S.ph.open = true;
    if (app) { S.ph.app = app; S.ph.sub = sub || null; }
    if (S.ph.app === 'thread' && S.ph.sub) S.unread[S.ph.sub] = 0;
    show(PH.root, true); document.body.classList.add('phone-on');
    show(PH.notif, false);
    Audio.ui(); renderPhone();
  }
  function closePhone(silent) {
    if (!S.ph.open) return;
    S.ph.open = false;
    show(PH.root, false); document.body.classList.remove('phone-on');
    if (!silent) Audio.ui();
  }
  const togglePhone = (app) => { if (S.ph.open && (!app || S.ph.app === app)) closePhone(); else openPhone(app || null); };
  function phoneGo(app, sub) {
    S.ph.app = app; S.ph.sub = sub || null;
    if (app === 'thread' && sub) S.unread[sub] = 0;
    Audio.ui(); renderPhone();
  }
  function phoneBack() {
    if (S.ph.app === 'thread') phoneGo('msgs');
    else if (S.ph.app !== 'home') phoneGo('home');
    else closePhone();
  }

  // ---- rendering
  const H = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const appHead = (title, right) => `<div class="pa-head"><button data-act="back" aria-label="返回">‹</button><b>${title}</b><span>${right || ''}</span></div>`;
  const dist = (x, z) => { const p = subject(), d = Math.hypot(x - p.x, z - p.z); return d > 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'; };
  function renderPhone() {
    if (!S.ph.open) return;
    S.ph.renderT = S.realTime;
    let html;
    if (S.ph.dead) html = `<div class="pa-dead"><i></i><b>手机没电了</b><p>${CABLE_PLACES[S.place] ? '店员借了根充电线给你，正在充电……' : '进江畔咖啡、魔都中心大堂、夜航小馆或候船厅，可以找店员借线充电。'}</p><span>${Math.round(S.ph.batt)}%</span></div>`;
    else if (phoneLocked()) {
      const t = targetPoint();
      html = `<div class="pa-lock"><b>${fmtClock(S.clock)}</b><span>驾驶中 · 手机已锁定</span><div class="pa-lockcard"><i>语音导航</i><p>${H(t.text || t.name)}</p><em>${t.phone ? '' : dist(t.x, t.z)}</em></div><small>停稳车（或下车）后再用手机。</small></div>`;
    } else html = (APP_RENDER[S.ph.app] || APP_RENDER.home)();
    PH.screen.innerHTML = html;
    PH.screen.dataset.app = S.ph.app;
    if (S.ph.app === 'map' && !S.ph.dead && !phoneLocked()) drawPhoneMap();
    const th = PH.screen.querySelector('.pa-thread'); if (th) th.scrollTop = th.scrollHeight;
  }
  const APP_RENDER = {
    home() {
      const dep = nextDeparture(), t = jobTarget();
      const badges = { msgs: unreadTotal(), jobs: offeredCount() };
      return `<div class="pa-home">
        <div class="pa-widget"><div class="pw-time">${fmtClock(S.clock)}</div><div class="pw-wx">${S.storm ? '暴雨 · 11°C' : '小雨 · 12°C'} · 魔都申东</div>
          <div class="pw-row"><i>下一班</i><b>${H(dep.label)}</b></div>
          <div class="pw-row"><i>追踪中</i><b>${t ? H(JOB[S.track].title) : '—'}</b></div></div>
        <div class="pa-grid">${APPS.map((a) => `<button data-act="app:${a.id}" class="pa-app"><i style="background:${a.color}">${a.glyph}</i><span>${a.name}</span>${badges[a.id] ? `<em>${badges[a.id]}</em>` : ''}</button>`).join('')}</div>
        <div class="pa-dock"><span>${TOUCH ? '‹ 返回 · ✕ 收起' : 'Tab 收起 · Backspace 返回'}</span></div>
      </div>`;
    },
    msgs() {
      const ids = Object.keys(S.msgs).sort((a, b) => (S.msgs[b].length && S.msgs[a].length ? (S.msgs[b][S.msgs[b].length - 1].t > S.msgs[a][S.msgs[a].length - 1].t ? 1 : -1) : 0));
      return appHead('消息', `${unreadTotal() || ''}`) + `<div class="pa-list">${ids.length ? ids.map((id) => {
        const c = CONTACTS[id], last = S.msgs[id][S.msgs[id].length - 1];
        return `<button class="pa-row" data-act="thread:${id}"><i class="av" style="background:${c.color}">${c.glyph}</i><div><b>${c.name}</b><span>${H(last.text.slice(0, 30))}${last.text.length > 30 ? '…' : ''}</span></div><small>${last.t}${S.unread[id] ? `<em>${S.unread[id]}</em>` : ''}</small></button>`;
      }).join('') : '<p class="pa-empty">还没有消息。</p>'}</div>`;
    },
    thread() {
      const id = S.ph.sub, c = CONTACTS[id], th = S.msgs[id] || [];
      if (!c) { S.ph.app = 'msgs'; return APP_RENDER.msgs(); }
      return appHead(c.name, c.sub) + `<div class="pa-thread">${th.map((m) => {
        let card = '';
        if (m.job) {
          const d = JOB[m.job], st = jobState(m.job);
          const act = st === 'offered' ? `<div class="pa-acts"><button class="pri" data-act="accept:${m.job}">接受</button><button data-act="decline:${m.job}">婉拒</button></div>`
            : `<div class="pa-st st-${st}">${{ active: S.track === m.job ? '进行中 · 追踪' : '进行中', done: '已完成', expired: '已错过', declined: '已婉拒' }[st] || ''}</div>`;
          card = `<div class="pa-offer"><b>${d.title}</b><span>${d.reward}</span>${act}</div>`;
        }
        return `<div class="bub ${m.who}"><p>${H(m.text)}</p>${card}<small>${m.t}</small></div>`;
      }).join('')}</div>`;
    },
    jobs() {
      const sec = (label, ids) => ids.length ? `<h5>${label}</h5>` + ids.map((id) => jobCard(id)).join('') : '';
      const by = (s) => JOB_DEFS.filter((d) => jobState(d.id) === s).map((d) => d.id);
      const all = sec('进行中', by('active')) + sec('待回复', by('offered')) + sec('已完成', by('done')) + sec('已错过 / 婉拒', [...by('expired'), ...by('declined')]);
      return appHead('委托', `${jobsDone()}/${JOB_DEFS.length} · 声望 ${S.rep}`) + `<div class="pa-list pad">${all || '<p class="pa-empty">还没有委托。消息里会有人找你帮忙。</p>'}<p class="pa-note">委托随时间陆续发来。错过的委托不会让你失败，只是少一份报酬。</p></div>`;
    },
    map() {
      const quick = [['东晟路渡口', ferryDoor().x, ferryDoor().z], ['观澜大道站', BUS_STOP.x, BUS_STOP.z], ['环港广场', C.mall.door[0], C.mall.door[1]], ['魔都中心大堂', C.lobby.door[0], C.lobby.door[1]], ['星珠环', C.ringBridge.cx, C.ringBridge.cz]];
      const nt = navTarget();
      return appHead('地图', nt ? '导航中' : '') + `<div class="pa-map"><canvas id="ph-map" width="560" height="520"></canvas>
        <div class="pa-acts"><button class="pri" data-act="bigmap">全屏地图 · M</button>${S.track && jobTarget() && !jobTarget().phone ? '<button data-act="navjob">导航到委托</button>' : ''}${nt ? '<button data-act="navclear">结束导航</button>' : ''}</div>
        ${nt ? `<div class="pa-navnow"><i style="background:${nt.color}"></i><b>${H(nt.name)}</b><span>${dist(nt.x, nt.z)}</span></div>` : ''}
        <h5>常去</h5>${quick.map(([n, x, z]) => `<button class="pa-row slim" data-act="nav:${x.toFixed(1)},${z.toFixed(1)},${n}"><b>${n}</b><small>${dist(x, z)}</small></button>`).join('')}
        ${NAV.pins.length ? '<h5>我的标记</h5>' + NAV.pins.map((p) => `<button class="pa-row slim" data-act="nav:${p.x},${p.z},${p.name}"><i class="dot" style="background:${p.color}"></i><b>${H(p.name)}</b><small>${dist(p.x, p.z)}</small></button>`).join('') : ''}</div>`;
    },
    taxi() {
      const T = S.taxi, inTaxi = S.mode === 'taxi';
      let status;
      if (inTaxi && T.state === 'choose') status = '<div class="pa-card"><b>已上车</b><span>选个目的地：</span></div>';
      else if (inTaxi && T.dest) status = `<div class="pa-card"><b>前往 ${H(T.dest.name)}</b><span>计价 ¥${(T.fare || PRICE.taxiFlag).toFixed(1)} · ${(T.km || 0).toFixed(2)} km</span></div>`;
      else if (T.state === 'toPlayer') status = `<div class="pa-card"><b>司机正在赶来</b><span>还有 ${dist(T.x, T.z)} · 车牌 魔B·T2096</span></div>`;
      else if (T.state === 'waiting' && Math.hypot(T.x - S.player.x, T.z - S.player.z) < 12) status = '<div class="pa-card ok"><b>车到了</b><span>走到车边按 E 上车</span></div>';
      else if (acrossRiver()) status = `<div class="pa-card"><b>附近没有可接单的车</b><span>${taxiRefusal()}</span></div>`;
      else status = `<div class="pa-card"><b>${S.place ? '先走到街上再叫车' : '在当前位置叫车'}</b><span>起步 ¥${PRICE.taxiFlag}（含 ${PRICE.taxiFreeKm} km）· ¥${PRICE.taxiPerKm}/km${S.storm ? ' · 暴雨加价 ×1.5' : ''}</span>${!S.place && !inTaxi ? '<div class="pa-acts"><button class="pri" data-act="taxicall">叫车</button></div>' : ''}</div>`;
      const dests = [...TAXI_DESTS.map((d, i) => ({ i, name: d.name, x: d.x, z: d.z }))];
      const nt = navTarget(); if (nt) dests.push({ i: 4, name: '导航目标 · ' + nt.name, x: nt.x, z: nt.z });
      const list = inTaxi && T.state === 'choose' ? dests.map((d) => `<button class="pa-row slim" data-act="taxidest:${d.i}"><b>${H(d.name)}</b><small>约 ¥${fare(d.x, d.z)} · ${dist(d.x, d.z)}</small></button>`).join('') : '';
      return appHead('打车', S.storm ? '暴雨 ×1.5' : '') + `<div class="pa-list pad">${status}${list}
        ${acrossRiver() ? '' : `<h5>回家</h5><div class="pa-card home"><b>回酒店 · 申西</b><span>一口价约 ¥${homeFare()} · 上车即结束今晚（结局：打车回家）</span><div class="pa-acts"><button class="pri" data-act="taxihome">${inTaxi ? '改去酒店' : '叫车回家'}</button></div></div>`}
        <p class="pa-note">${acrossRiver() ? '过了江就叫不到申东的车了。十八埠到永安里步行只要几分钟。' : '也可以不用手机，在路边按 T 扬招。渡轮和 N1 更便宜，结局加分也更高。'}</p></div>`;
    },
    album() {
      const j = jobState('postcards');
      const pay = Math.round(S.photos.reduce((a, id) => a + (S.shots[id] || 0) * 0.6, 0));
      const slots = PHOTO_IDS.map((id) => {
        const s = spotById(id), sc = S.shots[id];
        return `<div class="pa-ph ${sc ? 'got' : ''}" data-kind="${s.kind}"><i>${sc ? photoGrade(sc) : '?'}</i><b>${s.name}</b><span>${sc ? sc + ' 分' : '未拍'}</span></div>`;
      }).join('');
      const send = j === 'active' && S.photos.length ? `<div class="pa-acts"><button class="pri" data-act="sendcards">发给老周 · ${S.photos.length} 张 · 约 ¥${pay}</button></div>${S.photos.length < 5 ? '<p class="pa-note warn">发出去就结单了，没拍的不再收。</p>' : ''}`
        : j === 'done' ? '<p class="pa-note ok">已发给老周。</p>' : '';
      return appHead('相册', `${S.photos.length}/5`) + `<div class="pa-list pad"><h5>明信片</h5><div class="pa-phgrid">${slots}</div>${send}
        <h5>其他</h5><div class="pa-row static"><b>航拍</b><small>${S.aerialPhotos} 张</small></div><div class="pa-row static"><b>帮游客拍的合影</b><small>${S.photoTouristDone ? '1 张' : '—'}</small></div>
        <p class="pa-note">照片分数看：取景里地标占比、居中、距离、水平、有没有被挡。灯光秀期间拍的会更好看。</p></div>`;
    },
    wallet() {
      const can = BANK_PLACES[S.place] && !S.ph.bank;
      return appHead('钱包', '') + `<div class="pa-list pad"><div class="pa-bal"><i>余额</i><b>¥${Math.floor(S.wallet)}</b><span>今晚收入 ¥${Math.round(S.earned)} · 支出 ¥${Math.round(S.spent)}</span></div>
        <div class="pa-card"><b>共享充电宝 · ¥4</b><span>${S.ph.bank > 0 ? `充电中 · 剩余 ${Math.round(S.ph.bank)}%` : can ? `${BANK_PLACES[S.place]}有柜机，扫码就能借` : '江畔咖啡、魔都中心大堂、夜航小馆、候船厅、环港广场有柜机'}</span>${can ? '<div class="pa-acts"><button class="pri" data-act="bank">扫码借一个</button></div>' : ''}</div>
        ${S.fines ? `<div class="pa-card warn"><b>交通罚款 ¥${S.fines}</b><span>驾照剩 ${S.licence} 分 · ${S.violations.map((v) => FINE[v.kind][2] + ' ' + v.t).join('、')}</span></div>` : ''}
        <h5>账单</h5>${S.ledger.length ? S.ledger.slice(0, 40).map((l) => `<div class="pa-row static"><b>${H(l.what)}</b><small class="${l.amt > 0 ? 'in' : ''}">${l.amt > 0 ? '+' : '−'}¥${Math.abs(l.amt).toFixed(l.amt % 1 ? 1 : 0)} · ${l.t}</small></div>`).join('') : '<p class="pa-empty">还没有消费。</p>'}</div>`;
    },
    journal() {
      const rows = Object.entries(STAMPS).map(([cat, [label, ids]]) => {
        const n = ids.filter((id) => S.stamps[resolveStampId(cat, id)]).length;
        return `<h5>${label} <small>${n}/${ids.length}</small></h5><div class="pa-chips">${ids.map((id) => `<i class="${S.stamps[resolveStampId(cat, id)] ? 'on' : ''}">${cat === 'photo' ? spotById(id).name : stampName(id)}</i>`).join('')}</div>`;
      }).join('');
      return appHead('手账', `${stampCount()}/${STAMP_TOTAL}`) + `<div class="pa-list pad">${rows}<p class="pa-note">每个章结算 +10 分。去过、吃过、看过、听过都算。</p></div>`;
    },
    times() {
      const st = (open, gone) => open ? `<em class="ok">${gone}</em>` : '<em class="off">已开走</em>';
      const rows = [
        ['末班渡轮', '23:30 · 东晟路渡口 · ¥2', st(departureOpen('ferry'), timed() ? `还有 ${minsTo(CLOCK_LAST)} 分` : '不停班'), 'ferry'],
        ['夜宵 N1', '00:10 · 观澜大道站 · ¥2', st(departureOpen('bus'), timed() ? `还有 ${minsTo(CLOCK_BUS)} 分` : '不停班'), 'bus'],
        acrossRiver() ? ['出租车', '已在申西 · 步行回家即可', '<em class="off">不需要</em>', 'taxi'] : ['出租车', `随叫随到 · 回酒店约 ¥${homeFare()}`, '<em class="ok">可用</em>', 'taxi'],
      ];
      const ev = [['23:34–23:50', '短时强降雨 · 体温下降加快 · 打车 ×1.5', S.clock >= CLOCK_START + 34 && S.clock < CLOCK_START + 50], ['23:52–00:02', '临江嘴灯光秀 · 明信片更出彩', S.lightShow], ['01:00', '夜深了 · 还在外面就算滞留', false]];
      return appHead('时刻', fmtClock(S.clock)) + `<div class="pa-list pad"><h5>回家的方式</h5>${rows.map(([a, b, c]) => `<div class="pa-row static tall"><div><b>${a}</b><span>${b}</span></div>${c}</div>`).join('')}
        <h5>今晚</h5>${ev.map(([t, d, on]) => `<div class="pa-row static tall ${on ? 'live' : ''}"><div><b>${t}</b><span>${d}</span></div>${on ? '<em class="ok">进行中</em>' : ''}</div>`).join('')}
        <p class="pa-note">结局加分：渡轮 +300 · N1 +180 · 打车 +90 · 滞留 0。</p></div>`;
    },
  };
  function jobCard(id) {
    const d = JOB[id], st = jobState(id), steps = d.steps();
    const t = st === 'active' ? d.target() : null;
    const acts = st === 'offered' ? `<button class="pri" data-act="accept:${id}">接受</button><button data-act="decline:${id}">婉拒</button>`
      : st === 'active' ? `${S.track === id ? '<span class="trk">● 追踪中</span>' : `<button class="pri" data-act="track:${id}">追踪</button>`}${t && !t.phone ? `<button data-act="navjobid:${id}">导航</button>` : ''}${t && t.phone ? `<button data-act="app:${t.phone}">打开${APP_NAME[t.phone]}</button>` : ''}<button data-act="decline:${id}">放弃</button>` : '';
    return `<div class="pa-job st-${st} ${S.track === id ? 'tracked' : ''}"><div class="pj-h"><i class="av" style="background:${CONTACTS[d.from].color}">${CONTACTS[d.from].glyph}</i><div><b>${d.title}</b><span>${CONTACTS[d.from].name} · ${d.reward}</span></div></div>
      ${st === 'active' || st === 'done' ? `<ul>${steps.map((s) => `<li class="${s.done ? 'ok' : ''}">${s.done ? '✓' : '○'} ${H(s.t)}</li>`).join('')}</ul>` : ''}
      ${t ? `<p class="pj-now">${H(t.text || t.name)}${t.phone ? '' : ' · ' + dist(t.x, t.z)}</p>` : ''}
      ${acts ? `<div class="pa-acts">${acts}</div>` : ''}</div>`;
  }
  function drawPhoneMap() {
    const cv = $('ph-map'); if (!cv) return;
    drawMap(cv, 0.62, true);
  }

  // ---- input
  PH.screen.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const [a, arg] = b.dataset.act.split(/:(.*)/s);
    e.stopPropagation();
    switch (a) {
      case 'app':
        if (arg === 'help') { closePhone(true); openManual(); return; }
        if (arg === 'settings') { closePhone(true); pauseGame(); openSettings('paused'); return; }
        phoneGo(arg); return;
      case 'back': phoneBack(); return;
      case 'thread': phoneGo('thread', arg); return;
      case 'accept': acceptJob(arg); renderPhone(); return;
      case 'decline': declineJob(arg); renderPhone(); return;
      case 'track': trackJob(arg); renderPhone(); return;
      case 'navjobid': trackJob(arg); { const t = JOB[arg].target(); if (t && !t.phone) setNavTarget({ x: t.x, z: t.z, name: t.name, color: '#ff9f43' }); } renderPhone(); return;
      case 'navjob': { const t = jobTarget(); if (t && !t.phone) setNavTarget({ x: t.x, z: t.z, name: t.name, color: '#ff9f43' }); renderPhone(); return; }
      case 'navclear': setNavTarget(null); renderPhone(); return;
      case 'nav': { const [x, z, ...n] = arg.split(','); setNavTarget({ x: +x, z: +z, name: n.join(','), color: '#6fe6ff' }); renderPhone(); return; }
      case 'bigmap': closePhone(true); openMap(); return;
      case 'taxicall': callTaxi(); renderPhone(); return;
      case 'taxidest': chooseTaxiDest(+arg); renderPhone(); return;
      case 'taxihome': if (S.mode === 'taxi') goHomeByTaxi(); else if (acrossRiver()) { toast(taxiRefusal(), 3); return; } else { if (S.place) { toast('先走到街上再叫车'); return; } S.taxiHome = true; callTaxi(); toast(`已叫车回家 · 一口价约 ¥${homeFare()} · 车到后 E 上车`, 3); renderPhone(); } return;
      case 'sendcards': sendPostcards(); renderPhone(); return;
      case 'bank': if (BANK_PLACES[S.place] && !S.ph.bank && pay(4, '共享充电宝')) { S.ph.bank = 60; toast('借到充电宝 · 边走边充'); renderPhone(); } return;
    }
  });
  $('ph-back').addEventListener('click', () => phoneBack());
  $('ph-home').addEventListener('click', () => { if (S.ph.app === 'home') closePhone(); else phoneGo('home'); });
  $('ph-close').addEventListener('click', () => closePhone());
  if (PH.chip) PH.chip.addEventListener('click', () => { Audio.init(); togglePhone(); });
  PH.notif.addEventListener('click', () => { const t = PH.notifTarget; show(PH.notif, false); if (t) openPhone(t.app, t.sub); });
  function goHomeByTaxi() {
    const f = homeFare();
    if (!pay(f, '打车回家')) { subtitle(`钱包只剩 ¥${Math.floor(S.wallet)}，不够回酒店的车费（约 ¥${f}）。`, '司机', 5); return; }
    S.taxiHome = false;
    endRun('taxi', `${fmtClock(S.clock)}，坐上回酒店的出租车，车费 ¥${f}。后座很暖，雨刷一下一下地刮。`);
  }

  // ---- per-frame: battery, banner, chip
  function tickPhone(dt) {
    const ph = S.ph;
    if (S.phase === 'playing') {
      let drain = 0.011 + (ph.open ? 0.06 : 0) + (NAV.target ? 0.015 : 0) + (S.mode === 'drone' ? 0.04 : 0);
      if (ph.bank > 0 && ph.batt < 100) { const c = Math.min(ph.bank, 0.25 * dt); ph.bank -= c; ph.batt += c / 0.6; drain *= 0.2; if (ph.bank <= 0.01) { ph.bank = 0; toast('充电宝没电了'); } }
      if (ph.dead && CABLE_PLACES[S.place]) ph.batt += 0.4 * dt;
      ph.batt = clamp(ph.batt - drain * dt, 0, 100);
      if (!ph.dead && ph.batt <= 0) {
        ph.dead = true; setNavTarget(null);
        toast('手机没电关机了 · 进咖啡店/大堂/小馆/候船厅借线充电', 4); Audio.deny();
        document.body.classList.add('phone-dead');
        if (ph.open) renderPhone();
      } else if (ph.dead && ph.batt >= 3) {
        ph.dead = false; document.body.classList.remove('phone-dead');
        toast(`手机开机了 · ${unreadTotal()} 条未读`); if (ph.open) renderPhone();
      }
      if (!ph.dead && ph.batt < 20 && ph.lowWarned < 1) { ph.lowWarned = 1; notify({ name: '电量', glyph: '电', color: '#ff4d5e' }, '电量低于 20%。附近的咖啡店、大堂、小馆都能借共享充电宝（钱包 App）。', { app: 'wallet' }); }
      if (!ph.dead && ph.batt < 8 && ph.lowWarned < 2) { ph.lowWarned = 2; toast('电量 8% · 快没电了', 3); Audio.beep(); }
      if (ph.open && S.realTime - ph.renderT > (S.ph.app === 'map' ? 0.25 : 1)) {
        // re-rendering a list under the pointer would eat clicks; the map redraws its canvas only
        if (S.ph.app === 'map' && !ph.dead && !phoneLocked()) { drawPhoneMap(); ph.renderT = S.realTime; }
        else if (!PH.root.matches(':hover') || S.ph.app === 'home') renderPhone();
        else ph.renderT = S.realTime;
      }
    }
    if (PH.notifUntil && S.realTime > PH.notifUntil) { PH.notifUntil = 0; show(PH.notif, false); }
    const n = unreadTotal() + offeredCount();
    if (PH.badge) { show(PH.badge, n > 0 && !ph.dead); setText(PH.badge, String(n)); }
    setText(PH.chipBatt, ph.dead ? '没电' : Math.round(ph.batt) + '%');
    if (PH.chip) PH.chip.classList.toggle('low', ph.batt < 20);
    if (ph.open) {
      setText(PH.time, fmtClock(S.clock));
      PH.batt.querySelector('i').style.width = Math.max(4, ph.batt) + '%';
      setText(PH.batt.querySelector('em'), String(Math.round(ph.batt)));
      PH.batt.classList.toggle('low', ph.batt < 20); PH.batt.classList.toggle('chg', ph.bank > 0 || (ph.dead && !!CABLE_PLACES[S.place]));
    }
  }
