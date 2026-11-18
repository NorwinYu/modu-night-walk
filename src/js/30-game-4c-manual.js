  // ------------------------------------------------------------- handbook (H)
  // Built from the live rules (prices, stamps, fines, scoring) each time it
  // opens, so what it says is what the game does, and the stamp list shows
  // what this run has already collected.
  const STAMP_HOW = {
    'photo-pearl': ['spot-pearl', '星珠塔机位取景拍照'], 'photo-modu': ['spot-modu', '魔都中心机位取景拍照'], 'photo-yunque': ['spot-yunque', '云阙金融中心机位取景拍照'],
    'photo-jinyue': ['spot-jinyue', '金岳大厦机位取景拍照'], 'photo-lantan': ['spot-lantan', '滨江亲水平台拍对岸澜滩'],
    bookshop: ['mall', '走进环港广场里的环港书局'], bakery: ['mall', '走进面包房'], records: ['mall', '走进唱片行'], postcard: ['mall', '走进明信片铺'],
    umbrella: ['mall', '走进雨具店'], flower: ['mall', '走进花店'], coffeeshop: ['mall', '走进夜航咖啡'], bar: ['bar', '走进滨江的夜航小馆'], cafe: ['cafe', '走进江畔咖啡'],
    telescope: ['telescope', `用投币望远镜（¥${PRICE.telescope}）`], bench: ['bench', '在江边长椅坐下'], terrace: ['terrace', '在咖啡露天座坐下'],
    ring: ['ring', '走上星珠环天桥'], skyway: ['skyway', '走上空中连廊'], boardwalk: ['boardwalk', '走上滨江木栈道'],
    l2scope: ['lobby', '魔都中心 L2 观景镜'], l3: ['lobby', '从 L2 再上 L3 观景层'], cruise: ['cruise', `买船票登上申江夜航（¥${PRICE.cruise}）`], saloon: ['cruise', '游船上进船舱的邮船沙龙'],
    aerial: [null, '放飞无人机（V）后按 E 航拍一张'],
    wine: ['stalls', `小摊买热红酒（¥${PRICE.wine}）`], chestnut: ['stalls', `小摊买糖炒栗子（¥${PRICE.chestnut}）`], skewer: ['stalls', `小摊买烤肉（¥${PRICE.skewer}）`],
    cart: ['cart', `平台小吃车买一份（¥${PRICE.cart}）`], croissant: ['mall', `面包房买可颂（¥${PRICE.croissant}）`], latte: ['mall', `夜航咖啡买拿铁（¥${PRICE.latte}）`],
    'l2-0': ['lobby', 'L2 展板「澜滩天际线」'], 'l2-1': ['lobby', 'L2 展板「申江上的桥」'], 'l2-2': ['lobby', 'L2 展板「临江嘴三件套」'],
    'l3-0': ['lobby', 'L3 展板「魔都之巅」'], 'l3-1': ['lobby', 'L3 展板「城市天际线」'],
    busker: ['busker-0', '听街头乐手演奏一首'], tourist: ['tourist', '帮游客拍一张合影'], taxi: ['taxi', '坐一次出租车'], ferryhall: ['ferryhall', '走进东晟路渡口候船厅'],
  };
  const mapLink = (poi, text) => poi ? `<button class="mn-link" data-poi="${poi}">${text || '在地图上看'} ›</button>` : '';
  const kbd = (k) => `<kbd>${k}</kbd>`;
  function manualChapters() {
    const owned = (id) => !!S.stamps[id];
    const stampRows = Object.entries(STAMPS).map(([cat, [label, ids]]) => {
      const n = ids.filter((id) => owned(resolveStampId(cat, id))).length;
      return `<h4>${label} <small>${n} / ${ids.length}</small></h4><table class="mn-t mn-stamps"><tbody>` + ids.map((id) => {
        const sid = resolveStampId(cat, id), how = STAMP_HOW[sid] || [null, ''];
        return `<tr class="${owned(sid) ? 'got' : ''}"><td class="mn-ck">${owned(sid) ? '✓' : '○'}</td><td><b>${cat === 'photo' ? (spotById(id) || {}).name || id : stampName(id)}</b></td><td>${how[1]}</td><td>${mapLink(how[0], '地图')}</td></tr>`;
      }).join('') + '</tbody></table>';
    }).join('');
    const fineRows = Object.values(FINE).map(([y, p, n]) => `<tr><td>${n}</td><td>${p} 分</td><td>${y ? '¥' + y : '—'}</td></tr>`).join('');
    const price = (k) => '¥' + PRICE[k];
    const jobRows = JOB_DEFS.map((d) => `<tr class="${isDone(d.id) ? 'got' : ''}"><td class="mn-ck">${isDone(d.id) ? '✓' : '○'}</td><td><b>${d.title}</b><br><small>${CONTACTS[d.from].name} · ${d.at ? fmtClock(CLOCK_START + d.at) + ' 左右发来' : '开场就有'}</small></td><td>${d.reward}</td><td>+${d.pts}</td></tr>`).join('');
    return [
      { id: 'start', title: '快速上手', html: `
        <p class="mn-lead">23:00，小雨，申东临江嘴。你有一台相机、一部 64% 电量的手机、¥${WALLET_START} 零钱。这一夜没有失败，只有不同的回家方式。</p>
        <ol class="mn-steps">
          <li><b>看手机。</b>按 ${kbd('Tab')}（或点右下角「手机」）打开。消息里会陆续有人找你帮忙，在「委托」里接受或婉拒。看手机时人会停下，但时间照走。</li>
          <li><b>跟着指引走。</b>左上角是正在追踪的委托，罗盘、小地图和城市里的光柱都指向它。按 ${kbd('M')} 看大地图，手机「地图」能一键导航。</li>
          <li><b>零点前后回家。</b>末班渡轮 23:30（东晟路渡口）、夜宵 N1 00:10（观澜大道站），或者随时打车。01:00 还在外面就算滞留。</li>
        </ol>
        <p>委托之外，城市里还有 ${STAMP_TOTAL} 个「城市手账」章：小店、小吃、天桥、游船、无人机航拍、街头乐手……每个都加分。</p>
        <div class="mn-tip">开局在魔都中心脚下，身边停着一辆纯电车（${kbd('F')} 上车），观澜大道站就在马路对面。</div>` },
      { id: 'keys', title: '操作', html: `
        <table class="mn-t mn-keys"><tbody>
          <tr><td>${kbd('W')}${kbd('A')}${kbd('S')}${kbd('D')} / 方向键</td><td>走路 · 开车 · 驾驶无人机</td></tr>
          <tr><td>${kbd('Tab')}</td><td>打开 / 收起手机；${kbd('Backspace')} 返回上一页，${kbd('Esc')} 收起</td></tr>
          <tr><td>${kbd('Shift')}</td><td>步行时奔跑（耗体力）；无人机下降</td></tr>
          <tr><td>${kbd('Space')}</td><td>开车时手刹；无人机上升</td></tr>
          <tr><td>鼠标</td><td>点一下画面锁定鼠标，之后视角直接跟着鼠标转；锁定时左键是快门；Esc 释放鼠标并暂停。设置里可关掉锁定，改回按住拖动。开车时滚轮调镜头距离</td></tr>
          <tr><td>触屏</td><td>左下摇杆走路 / 开车，拖动屏幕其余地方环视；E 交互，「相机」举起相机，点小地图开大地图，「手机」打开手机</td></tr>
          <tr><td>${kbd('Q')}</td><td>举起 / 收起相机（取景框里滚轮变焦）</td></tr>
          <tr><td>${kbd('E')}</td><td>互动：拍摄、进门、买东西、取送物品、坐下、等车、检票</td></tr>
          <tr><td>${kbd('F')}</td><td>上车 / 下车（车要先停稳）</td></tr>
          <tr><td>${kbd('T')}</td><td>路边扬招出租车；上车后 ${kbd('1')}–${kbd('5')} 选目的地，${kbd('0')} 回酒店（结束今晚）</td></tr>
          <tr><td>${kbd('V')}</td><td>放飞 / 召回无人机；飞行中 ${kbd('C')} 切视角、${kbd('E')} 航拍、${kbd('R')} 返航</td></tr>
          <tr><td>${kbd('M')}</td><td>大地图：拖动平移、滚轮缩放、单击放标记并导航、右键删标记</td></tr>
          <tr><td>${kbd('J')}</td><td>手机「手账」</td></tr>
          <tr><td>${kbd('H')}</td><td>游戏手册（本页）</td></tr>
          <tr><td>${kbd('O')}</td><td>步行时切换第一 / 第三人称</td></tr>
          <tr><td>${kbd('N')}</td><td>静音 / 取消静音</td></tr>
          <tr><td>${kbd('P')} / ${kbd('Esc')}</td><td>暂停（Esc 也会先关掉相机、手机、地图、手册）</td></tr>
        </tbody></table>
        <p>触屏：左下摇杆移动，右侧空白处拖动环视，${kbd('E')} 按钮互动，点「手机」打开手机，点小地图打开大地图。</p>` },
      { id: 'goal', title: '今夜：委托与回家', html: `
        <h4>时间</h4>
        <p>23:00 开始，游戏里 1 分钟 ≈ 现实 20 秒，到 01:00 大约 40 分钟。暂停、大地图、手册会让时间停下；<b>看手机不会</b>。</p>
        <h4>委托 <small>${jobsDone()} / ${JOB_DEFS.length}</small></h4>
        <p>委托按时间陆续发到手机里。接不接、先做哪个都随你；错过或婉拒不会失败，只是少一份报酬和声望。</p>
        <table class="mn-t"><thead><tr><th></th><th>委托</th><th>报酬</th><th>分</th></tr></thead><tbody>${jobRows}</tbody></table>
        <h4>回家的四种结局</h4>
        <table class="mn-t"><thead><tr><th>结局</th><th>怎么触发</th><th>结局分</th></tr></thead><tbody>
          <tr><td><b>末班渡轮</b></td><td>23:30 前进东晟路渡口候船厅，在闸机按 ${kbd('E')} 检票（${price('ferry')}）${mapLink('ferryhall')}</td><td>+300</td></tr>
          <tr><td><b>夜宵 N1</b></td><td>00:10 前到观澜大道站，按 ${kbd('E')} 等车（等车时时间快进，一走动就不等了）</td><td>+180</td></tr>
          <tr><td><b>打车回家</b></td><td>手机「打车」叫车回酒店，或扬招上车后按 ${kbd('0')}。一口价约 ¥${HOME_FARE}，暴雨时 ×1.5</td><td>+90</td></tr>
          <tr><td><b>雨夜滞留</b></td><td>01:00 还在外面</td><td>0</td></tr>
        </tbody></table>
        <p>每种结局都会结算评级。自由漫步模式（标题页切换）下班次不停、不会滞留。</p>
        <h4>今晚会发生的事</h4>
        <ul><li><b>23:34–23:50 短时强降雨</b>：雨更密，体温掉得快将近一倍，打车加价 ×1.5。</li>
        <li><b>23:52–00:02 临江嘴灯光秀</b>：楼宇媒体墙换色，星珠塔灯效加快轮换，这时拍的明信片每张 +8。</li>
<li><b>星珠塔灯效</b>：平时每 20 多秒换一种（经典粉 · 冰蓝 · 香槟金 · 彩虹环 · 上升波 · 星光），球体、光环、塔身泛光和照在广场上的灯一起变。</li></ul>` },
      { id: 'phone', title: '手机', html: `
        <ul><li><b>消息</b>：朋友、店主、互助群和「夜行电台」会发消息。带委托卡片的消息可以直接接受 / 婉拒。</li>
        <li><b>委托</b>：进行中、待回复、已完成一览；可切换追踪、一键导航或放弃。</li>
        <li><b>地图</b>：实时小地图、常去地点一键导航、你的标记；「全屏地图」即 ${kbd('M')}。</li>
        <li><b>打车</b>：在街上叫车；坐上车后在这里选目的地；「叫车回家」直接结束今晚（结局：打车回家）。</li>
        <li><b>相册</b>：五张明信片和航拍。明信片委托在这里「发给老周」结单，按片子好坏付钱（发出后不能补拍）。</li>
        <li><b>钱包</b>：余额、账单、罚款，以及共享充电宝（¥4）。</li>
        <li><b>手账 · 时刻 · 帮助 · 设置</b>：手账章、今晚班次和事件、本手册、设置。</li></ul>
        <h4>电量</h4>
        <p>开局 64%。待机缓慢耗电，亮屏、导航、无人机（手机当遥控器）耗得更快。低于 20% 会提醒。没电后收不到通知、不能导航，进江畔咖啡、魔都中心大堂、夜航小馆或候船厅可以借线充电；这些地方和环港广场也能借充电宝边走边充。</p>
        <h4>驾驶时</h4>
        <p>车在行驶中手机锁屏，只显示语音导航；停稳或下车后才能操作。放飞无人机时手机作遥控器用，不能打开。</p>` },
      { id: 'move', title: '出行方式', html: `
        <h4>步行</h4><p>${kbd('Shift')} 奔跑耗体力，停下或慢走会回复。体温太低（低于 25）跑不动。</p>
        <h4>自驾（纯电）</h4>
        <ul><li>开局停在魔都中心旁，走近按 ${kbd('F')}。电量随里程下降，低于 12% 限速降到约 72 km/h。</li>
        <li>撞墙撞车会掉车况，车况归零车就趴窝。<b>喝过酒（热红酒、小馆的酒）当晚不能开车。</b></li>
        <li>城市限速 60 km/h，路口有红绿灯和电子警察：</li></ul>
        <table class="mn-t"><thead><tr><th>违章</th><th>记分</th><th>罚款</th></tr></thead><tbody>${fineRows}</tbody></table>
        <p>驾照 12 分扣完当晚不能再开车。罚款在结算时扣分。</p>
        <h4>出租车</h4><p>按 ${kbd('T')} 扬招或用手机叫车，车到后 ${kbd('E')} 上车：${kbd('1')} 亲水平台 · ${kbd('2')} 环港广场 · ${kbd('3')} 魔都中心大堂 · ${kbd('4')} 东晟路渡口 · ${kbd('5')} 导航目标 · ${kbd('0')} 回酒店。起步 ${price('taxiFlag')}（含 ${PRICE.taxiFreeKm} km），之后 ¥${PRICE.taxiPerKm}/km，坐车时体力和体温都会回升。坐上渡轮后就叫不到申东的车了，十八埠下船步行回家。</p>
        <h4>无人机</h4><p>步行时按 ${kbd('V')} 放飞。电量约 3 分钟，信号范围 520 m，超出或没电会自动返航。按 ${kbd('E')} 航拍，每张结算 +20 分（最多计 3 张）；「航拍星珠环」委托要在环岛上空 20 m 以上拍。</p>
        <h4>申江夜航</h4><p>滨江码头买票（${price('cruise')}）登船沿江一圈。甲板吧台 ${price('deck')}，船舱邮船沙龙 ${price('saloon')}。${mapLink('cruise')}</p>` },
      { id: 'body', title: '体力 · 体温 · 钱包', html: `
        <ul><li><b>体力</b>：奔跑消耗，休息、吃喝、坐车回复。</li>
        <li><b>体温</b>：雨里持续下降；折叠伞让它降得慢一半，雨具店的长柄伞更好（下降 35%）。把伞送给老人后你就得淋雨了。进室内、上车、上船会回升。</li>
        <li><b>钱包</b>：开局 ¥${WALLET_START}，委托报酬直接转进来。余额的 20% 计入结算分。</li></ul>
        <h4>价目表</h4>
        <table class="mn-t"><tbody>
          <tr><td>咖啡</td><td>江畔咖啡 ${price('cafeCoffee')} · 夜航咖啡拿铁 ${price('latte')} · 大堂咖啡 ${price('lobbyCoffee')}</td></tr>
          <tr><td>小吃</td><td>热红酒 ${price('wine')} · 糖炒栗子 ${price('chestnut')} · 烤肉 ${price('skewer')} · 小吃车 ${price('cart')} · 可颂 ${price('croissant')}</td></tr>
          <tr><td>饮品</td><td>夜航小馆 ${price('barDrink')} · 售货机水 ${price('water')} · 甲板吧台 ${price('deck')} · 邮船沙龙 ${price('saloon')}</td></tr>
          <tr><td>小店</td><td>雨伞 ${price('umbrella')} · 花束 ${price('flower')} · 明信片 ${price('postcard')}</td></tr>
          <tr><td>出行</td><td>渡轮 ${price('ferry')} · N1 ¥2 · 游船 ${price('cruise')} · 望远镜 ${price('telescope')} · 出租车起步 ${price('taxiFlag')} · 回酒店约 ¥${HOME_FARE}</td></tr>
          <tr><td>其他</td><td>街头乐手打赏 ${price('busker')} · 共享充电宝 ¥4</td></tr>
        </tbody></table>` },
      { id: 'journal', title: `城市手账 ${stampCount()}/${STAMP_TOTAL}`, html: `
        <p>每盖一个章结算 +10 分。打勾的是这一局已经盖过的。点「地图」直接在大地图上看位置。</p>${stampRows}` },
      { id: 'places', title: '地点指南', html: `
        <h4>室内（可以直接走进去）</h4>
        <ul><li><b>魔都中心大堂</b>：632 m 塔底大堂，售货机、咖啡亭、楼层导览；扶梯上 L2 观景廊（展板 ×3、观景镜），再上 L3（展板 ×2，小满在这里加班）。${mapLink('lobby')}</li>
        <li><b>环港广场</b>：滨江玻璃穹顶商场，7 家小店都能进：书局、面包房、唱片行（阿 Ken）、明信片铺（老周）、雨具店、花店（阿梅）、夜航咖啡。${mapLink('mall')}</li>
        <li><b>江畔咖啡</b>、<b>夜航小馆</b>：滨江边两家能坐下暖身的店，小馆吧台是老陈。${mapLink('cafe')} ${mapLink('bar')}</li>
        <li><b>东晟路渡口候船厅</b>：末班渡轮在这里检票。${mapLink('ferryhall')}</li></ul>
        <h4>车站</h4>
        <p><b>观澜大道站</b>：魔都中心门口的公交站，夜宵 N1 00:10 从这里开往申西。</p>
        <h4>高处与水边</h4>
        <ul><li><b>星珠环</b>：环岛上空的环形天桥，从 5 处楼梯上去；<b>空中连廊</b>从千禧大道接过来。${mapLink('ring')}</li>
        <li><b>滨江亲水平台</b>：木栈道、望远镜、长椅、露天座、小摊、小吃车、两位街头乐手、想合影的游客都在这一带，也是拍澜滩的机位。${mapLink('spot-lantan')}</li>
        <li><b>申江夜航码头</b>：坐船看两岸。${mapLink('cruise')}</li></ul>
        <h4>天际线</h4>
        <p>星珠塔 468 m、魔都中心 632 m、云阙金融中心 492 m、金岳大厦 421 m 之外，还有臻金中心双塔、晨曦国际大楼（西侧弧形媒体墙）和明澜广场。对岸是澜滩的石构建筑群。这一段江上没有桥，过江靠隧道和渡轮；南澜、东澜大桥在远处，从 L3 或无人机上能看到。</p>` },
      { id: 'map', title: '地图与标记', html: `
        <ul><li>按 ${kbd('M')} 或点击小地图打开大地图，打开时游戏时间暂停。手机「地图」是不暂停的实时版。</li>
        <li><b>拖动</b>平移，<b>滚轮 / 双指</b>缩放，右侧工具栏可放大、缩小、回到自己、看全图。</li>
        <li><b>单击空白处</b>放一个标记并立即导航；<b>单击地点或标记</b>弹出详情，可「导航到这里」「在这里放标记」「删除」。<b>右键</b>标记直接删除。</li>
        <li>标记最多 12 个，自动保存在本机。左侧图例可以按类别显示 / 隐藏。</li>
        <li>设了导航后：罗盘指向导航目标，地图上出现沿路的虚线路线，城市里立起一道同色光柱；走到 9 m 内自动完成。没有导航时，罗盘指向正在追踪的委托或回家的车站。</li></ul>` },
      { id: 'score', title: '结算与评级', html: `
        <table class="mn-t"><thead><tr><th>项目</th><th>分数</th></tr></thead><tbody>
          <tr><td>明信片</td><td>已拍各张得分之和（每张 5–100）</td></tr>
          <tr><td>委托</td><td>每个完成的委托 60–120（按完成质量，比如拿铁是否还热）</td></tr>
          <tr><td>声望</td><td>每点 +25（委托、送伞、帮忙都会加）</td></tr>
          <tr><td>城市手账</td><td>每个章 +10（共 ${STAMP_TOTAL} 个）</td></tr>
          <tr><td>航拍</td><td>每张 +20，最多 3 张</td></tr>
          <tr><td>结局</td><td>渡轮 +300 · N1 +180 · 打车 +90 · 滞留 0</td></tr>
          <tr><td>钱包结余</td><td>余额 × 0.2</td></tr>
          <tr><td>交通罚款 · 车损</td><td>− 罚款额 × 0.5 · − 损失车况 × 0.5</td></tr>
        </tbody></table>
        <p>评级：<b>S</b> ≥ 1300 · <b>A</b> ≥ 1000 · <b>B</b> ≥ 700 · 其余 <b>C</b>。最高分、最佳评级和见过的结局保存在本机。</p>` },
      { id: 'tips', title: '小贴士', html: `
        <ul><li>先排顺序：花要 23:29 前送到候船厅，正好顺路赶末班渡轮；赶不上就改坐 N1。</li>
        <li>拿铁 15 分钟内送到才算热。夜航咖啡离魔都中心有点远，打车或开车更稳。</li>
        <li>拍照前看取景框下方提示，「构图良好」变绿再按 ${kbd('E')}。高楼要退远一点、往上抬镜头再拉近。灯光秀期间拍更划算。</li>
        <li>暴雨前进店避一避，或者先买把长柄伞。</li>
        <li>手机电量是真的会用完的，导航别一直开着。</li>
        <li>开车别贪快：一次闯红灯罚 ¥200 记 6 分。喝了酒就别碰车。</li></ul>` },
      { id: 'about', title: '关于与许可', html: `
        <p class="mn-lead"><b>《魔都夜行》是 Three.js / WebGL 与 OpenStreetMap 数据处理的技术研究演示，不是商业游戏产品，也不发行。</b>本仓库只公开源码；没有官方 Release、安装包或下载站，不提供运营、充值、广告、联机或在线服务，不收集个人信息。公开源码不等于授权发行或运营。</p>
        <h4>虚构声明</h4>
        <p>城市、建筑、店铺、银行、酒店、媒体账号、人物与委托均为虚构或改写，与真实个人、企业、机构、品牌无关联、赞助或背书关系。地图几何来自 OpenStreetMap，地名与建筑名已改写；少量真实地理特征仍可能被识别。</p>
        <h4>许可</h4>
        <ul>
          <li>原创代码、文案与程序化生成资产：<b>PolyForm Noncommercial 1.0.0</b>（仅限非商业）。</li>
          <li>地图数据：<b>© OpenStreetMap contributors，ODbL 1.0</b>（可商用，但必须署名并以 ODbL 共享衍生数据库）。<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener">许可全文</a></li>
          <li>Three.js r169：<b>MIT</b>。</li>
        </ul>
        <p>本项目属于<b>源码公开（source-available）</b>，不是 OSI 定义的开源项目。完整许可见仓库根目录的 <code>LICENSE</code>、<code>DATA-LICENSE.md</code>、<code>THIRD-PARTY-NOTICES.md</code>。</p>
        <h4>合规与安全</h4>
        <ul>
          <li>本作不是地图服务，不用于导航、测绘或安全关键用途；OSM 数据可能有误。</li>
          <li>驾驶违法会被扣分罚款，酒后不能开车；无人机为虚构玩法，现实中请遵守禁飞/限飞规定。</li>
          <li>在中国境内公开发布或运营含地图/游戏内容，可能涉及地图审核、游戏审批/备案与未成年人保护要求；本项目未申请任何审核。</li>
        </ul>
        <p>完整免责声明见仓库 <code>DISCLAIMER.md</code>。地图数据版权页：<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">openstreetmap.org/copyright</a></p>` },
    ];
  }  const MN = { tab: 'start' };
  function renderManual() {
    const ch = manualChapters();
    if (!ch.some((c) => c.id === MN.tab)) MN.tab = ch[0].id;
    $('mn-nav').innerHTML = '<div class="mn-brand"><span>HANDBOOK · 游戏手册</span><b>魔都夜行</b></div>' + ch.map((c) => `<button data-tab="${c.id}" class="${c.id === MN.tab ? 'on' : ''}">${c.title}</button>`).join('');
    const cur = ch.find((c) => c.id === MN.tab);
    $('mn-body').innerHTML = `<h2>${cur.title}</h2>` + cur.html;
    const on = $('mn-nav').querySelector('button.on'), nav = $('mn-nav');
    if (on && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = on.offsetLeft - (nav.clientWidth - on.offsetWidth) / 2;
    $('mn-body').scrollTop = 0;
  }
  function openManual(tab) {
    if (tab) MN.tab = tab;
    openOverlay('manual');
    show($('manual'), true);
    renderManual();
  }
  const toggleManual = () => { if (S.overlay === 'manual') closeOverlay(); else openManual(); };
  $('mn-nav').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; MN.tab = b.dataset.tab; Audio.ui(); renderManual(); });
  $('mn-body').addEventListener('click', (e) => {
    const b = e.target.closest('[data-poi]'); if (!b) return;
    if (S.phase !== 'playing') { toast('开始夜游后才能打开地图'); return; }
    closeOverlay(true); openMap({ focus: b.dataset.poi });
  });
  $('mn-close').addEventListener('click', () => closeOverlay());
  $('manual').addEventListener('click', (e) => { if (e.target.id === 'manual') closeOverlay(); });
  $('manual-btn').addEventListener('click', () => { Audio.init(); openManual(); });
  $('pause-map-btn').addEventListener('click', () => { resumeGame(); openMap(); });
  $('pause-manual-btn').addEventListener('click', () => { resumeGame(); openManual(); });
