// 八字（四柱推命）：排四柱、十神、藏干、五行分布、日主強弱、格局、神煞、大運與流年。
// 需要 divination.js（STEMS、BRANCHES）、najia.js（ganzhiAt、nearestJie、GENERATES、controls）、birth.js、poster.js。

const STEM_ELEMENTS = "木木火火土土金金水水"; // 甲乙丙丁戊己庚辛壬癸
// 地支藏干：本氣、中氣、餘氣
const HIDDEN_STEMS = {
  子: "癸", 丑: "己癸辛", 寅: "甲丙戊", 卯: "乙", 辰: "戊乙癸", 巳: "丙庚戊",
  午: "丁己", 未: "己丁乙", 申: "庚壬戊", 酉: "辛", 戌: "戊辛丁", 亥: "壬甲",
};
const HIDDEN_WEIGHTS = [1, 0.5, 0.3];
const ELEMENT_ORDER = "木火土金水";

// 十神：以日干為「我」，看五行生剋與陰陽是否相同
function tenGod(dayStem, otherStem) {
  const me = STEM_ELEMENTS[dayStem];
  const other = STEM_ELEMENTS[otherStem];
  const same = dayStem % 2 === otherStem % 2;
  if (other === me) return same ? "比肩" : "劫財";
  if (GENERATES[me] === other) return same ? "食神" : "傷官";
  if (controls(me, other)) return same ? "偏財" : "正財";
  if (controls(other, me)) return same ? "七殺" : "正官";
  return same ? "偏印" : "正印";
}

const DAY_MASTERS = [
  "甲木像大樹，直、硬、有主見，認定的方向不輕易彎。優點是可靠、有擔當，缺點是固執、不懂轉彎，被逼急了寧折不屈。",
  "乙木像藤蔓花草，柔軟、懂得借力，適應力強。優點是圓融、有韌性，缺點是依賴心重、容易看人臉色。",
  "丙火像太陽，熱情、直接、藏不住心事。優點是大方、有感染力，缺點是急躁、好面子，熱度來得快也退得快。",
  "丁火像燭火，細膩、敏感、有洞察力。優點是體貼、專注，缺點是多慮、情緒起伏，外表溫和內心其實很執著。",
  "戊土像高山厚土，穩重、守信、反應慢。優點是可靠、能扛事，缺點是保守、遲鈍，不喜歡變動。",
  "己土像田園之土，包容、務實、心思細。優點是有耐心、會照顧人，缺點是想太多、容易委屈自己又記在心裡。",
  "庚金像刀劍礦石，剛硬、果斷、講義氣。優點是有魄力、執行力強，缺點是衝動、說話傷人，不服輸。",
  "辛金像珠玉首飾，精緻、自尊心強、重視質感。優點是敏銳、有品味，缺點是挑剔、玻璃心，受不了被看輕。",
  "壬水像江河大海，聰明、靈活、不受拘束。優點是有謀略、適應力強，缺點是善變、任性，做事容易半途而廢。",
  "癸水像雨露，溫和、內斂、想像力豐富。優點是細心、有耐力，缺點是多疑、被動，心事重卻不說出口。",
];

const TEN_GOD_TEXTS = {
  比肩: "比肩重：自我意識強，凡事靠自己，不喜歡求人，也不容易聽勸。和朋友、同輩緣分深，但錢財容易被分走。",
  劫財: "劫財重：好勝、敢衝、講義氣，花錢大方。容易因為朋友或一時衝動破財，感情上也常有競爭者。",
  食神: "食神重：隨和、懂享受、有口福和才藝。做事不愛爭，人緣好，但容易安於現狀、缺乏企圖心。",
  傷官: "傷官重：聰明、有才華、表達力強，也因此看不慣規矩和上司。容易恃才傲物、說話得罪人。",
  偏財: "偏財重：對錢敏感、出手大方、交際手腕好，適合做生意或靠人脈。錢來得快去得也快，感情上異性緣多。",
  正財: "正財重：務實、節儉、重視穩定收入，靠一分耕耘一分收穫。缺點是計較、保守，不敢冒險。",
  七殺: "七殺重：壓力大、責任重，但也因此有魄力和決斷。個性強硬、不服輸，人生起伏大，容易與人起衝突。",
  正官: "正官重：守規矩、有責任感、重名聲，適合在體制內發展。缺點是拘謹、怕犯錯，被框架綁住。",
  偏印: "偏印重：想法獨特、學東西快，但興趣雜而不專。內心孤獨、多疑，不容易相信人。",
  正印: "正印重：有貴人和長輩照顧，愛學習、心地善良。缺點是依賴、想得多做得少，行動力不足。",
};

// 每天的日干對日主是哪個十神，當天的提示
const DAILY_TEXTS = {
  比肩: "今天適合靠自己把事情做完，也容易遇到和你想法一樣的人。別太堅持己見，和人合作時讓一步。",
  劫財: "今天容易衝動花錢或被人拉去花錢，借貸、合夥、打賭都先不要。把力氣用在運動和執行上。",
  食神: "今天心情放鬆、胃口好，適合創作、聚餐、做喜歡的事。重要的硬仗不要排在今天。",
  傷官: "今天腦筋快、話也多，適合發想和表達。但說話容易太直，對長官和長輩收斂一點。",
  偏財: "今天人際和機會都活絡，適合談生意、見客戶、社交。有意外之財的機會，也有意外開銷。",
  正財: "今天適合處理錢和實務：對帳、採買、把該做的工作做完。踏實做就有回報。",
  七殺: "今天壓力大、事情急，容易遇到強勢的人或突發狀況。沉住氣處理，不要正面硬碰。",
  正官: "今天適合處理正事、面對主管或公家機關，照規矩來就順。不適合投機取巧。",
  偏印: "今天適合獨處、研究、想事情，靈感不錯。但容易想太多、懶得動，約好的事別放鴿子。",
  正印: "今天有人幫、有人照顧，適合學習、請教、休養。事情可以慢一點，不用急著出手。",
};

const ELEMENT_NOTES = {
  木: ["木過旺：主觀強、固執，容易鑽牛角尖。", "缺木：缺乏規劃和衝勁，容易猶豫、沒有主見。"],
  火: ["火過旺：急躁、衝動，做事三分鐘熱度。", "缺火：缺乏熱情和表現慾，容易顯得冷淡、不夠積極。"],
  土: ["土過旺：保守、固執，不願改變。", "缺土：缺乏穩定感，承諾和信用上容易出問題。"],
  金: ["金過旺：剛硬、好爭，容易得罪人。", "缺金：缺乏決斷力，該斷不斷、拖泥帶水。"],
  水: ["水過旺：想太多、善變，缺乏定性。", "缺水：缺乏彈性和機變，做事容易死板。"],
};

// ── 神煞 ── 只取最常用的幾個。地支用序號：子 0 … 亥 11
const NOBLE = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [6, 2], [3, 5], [3, 5]]; // 天乙貴人，依日干
const WENCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3]; // 文昌，依日干
const BLADE = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 }; // 羊刃，只論陽干
// 依年支或日支的三合局（申子辰、巳酉丑、寅午戌、亥卯未，即地支序號除以 4 的餘數）
const PEACH = [9, 6, 3, 0]; // 桃花（咸池）
const HORSE_STAR = [2, 11, 8, 5]; // 驛馬
const CANOPY = [4, 1, 10, 7]; // 華蓋
const STAR_NOTES = {
  天乙貴人: "遇事容易有人出手相助，逢凶化吉。",
  文昌: "聰明、好學、文筆與考運佳。",
  桃花: "有魅力、人緣與異性緣好；也容易有感情糾葛。",
  驛馬: "一生多奔波變動，適合外出發展、常出差或搬遷。",
  華蓋: "有才藝、悟性高，但性格孤高，喜歡獨處或接觸宗教玄學。",
  羊刃: "個性剛烈、敢拼，容易有刀傷、意外或衝突，需要制衡。",
};

function baziStars(pillars, dayStem) {
  const names = pillars.map((p) => p.name);
  const branches = pillars.map((p) => p.branch);
  const stars = [];
  const add = (name, targets, skip = -1) => {
    const where = branches.map((b, i) => (targets.includes(b) && i !== skip ? names[i] : null)).filter(Boolean);
    if (where.length) stars.push({ name, where: [...new Set(where)], note: STAR_NOTES[name] });
  };
  add("天乙貴人", NOBLE[dayStem]);
  add("文昌", [WENCHANG[dayStem]]);
  if (BLADE[dayStem] !== undefined) add("羊刃", [BLADE[dayStem]]);
  // 桃花、驛馬、華蓋：以年支和日支各查一次，查到的那一柱不能是自己
  for (const [name, table] of [["桃花", PEACH], ["驛馬", HORSE_STAR], ["華蓋", CANOPY]]) {
    const where = new Set();
    for (const base of [0, 2]) {
      const target = table[branches[base] % 4];
      branches.forEach((b, i) => { if (b === target && i !== base) where.add(names[i]); });
    }
    if (where.size) stars.push({ name, where: [...where], note: STAR_NOTES[name] });
  }
  return stars;
}

function baziChart(birth) {
  const instant = birthInstant(birth);
  const clock = birth.clock || birth;
  const gz = ganzhiAt(clock.year, clock.month, clock.day, clock.hour, instant, true);
  const dayStem = gz.dayStem;
  const pillars = [
    { name: "年柱", stem: gz.yearIndex % 10, branch: gz.yearIndex % 12 },
    { name: "月柱", stem: gz.monthIndex[0], branch: gz.monthIndex[1] },
    { name: "日柱", stem: dayStem, branch: gz.dayIndex % 12 },
    { name: "時柱", stem: gz.hourIndex[0], branch: gz.hourIndex[1] },
  ].map((pillar, i) => ({
    ...pillar,
    stemGod: i === 2 ? "日主" : tenGod(dayStem, pillar.stem),
    hidden: [...HIDDEN_STEMS[BRANCHES[pillar.branch]]].map((stem) => {
      const index = STEMS.indexOf(stem);
      return { stem: index, god: tenGod(dayStem, index) };
    }),
  }));

  // 五行分布：天干各算 1，藏干依本氣、中氣、餘氣遞減；月支是月令，加重 1.5 倍
  const weights = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const gods = {};
  pillars.forEach((pillar, i) => {
    weights[STEM_ELEMENTS[pillar.stem]] += 1;
    if (i !== 2) gods[pillar.stemGod] = (gods[pillar.stemGod] || 0) + 1;
    pillar.hidden.forEach((hidden, k) => {
      const weight = HIDDEN_WEIGHTS[k] * (i === 1 ? 1.5 : 1);
      weights[STEM_ELEMENTS[hidden.stem]] += weight;
      gods[hidden.god] = (gods[hidden.god] || 0) + weight;
    });
  });
  const total = Object.values(weights).reduce((a, b) => a + b, 0);

  // 日主強弱：同我（比劫）與生我（印）的比重
  const me = STEM_ELEMENTS[dayStem];
  const mother = ELEMENT_ORDER[(ELEMENT_ORDER.indexOf(me) + 4) % 5];
  const support = (weights[me] + weights[mother]) / total;
  const monthMain = STEM_ELEMENTS[pillars[1].hidden[0].stem];
  const inSeason = monthMain === me || monthMain === mother;
  const strength = support >= 0.55 || (support >= 0.48 && inSeason) ? "偏強" : support <= 0.38 || (support <= 0.45 && !inSeason) ? "偏弱" : "中和";
  const child = GENERATES[me];
  const wealth = GENERATES[child];
  const officer = GENERATES[wealth];
  const favorable = strength === "偏強" ? [child, wealth, officer] : strength === "偏弱" ? [mother, me] : [];

  // 格局：取月令本氣對日主的十神；本氣是比劫時稱建祿格或羊刃格
  const monthGod = pillars[1].hidden[0].god;
  const pattern = monthGod === "比肩" ? "建祿格" : monthGod === "劫財" ? (dayStem % 2 === 0 ? "羊刃格" : "月劫格") : `${monthGod}格`;

  // 大運：陽年男、陰年女順排，反之逆排；出生到最近一個節的天數，三天折一年
  const forward = (gz.yearIndex % 2 === 0) === (birth.gender === "male");
  const days = Math.abs(nearestJie(instant, forward) - instant) / 86400000;
  const startAge = days / 3;
  const monthSexagenary = (6 * pillars[1].stem - 5 * pillars[1].branch + 600) % 60;
  const luck = Array.from({ length: 8 }, (_, i) => {
    const index = (monthSexagenary + (forward ? i + 1 : -(i + 1)) + 600) % 60;
    const age = startAge + i * 10;
    return { stem: index % 10, branch: index % 12, age, year: Math.floor(birth.year + age), god: tenGod(dayStem, index % 10) };
  });

  return {
    gz, pillars, dayStem, me, weights, total, gods, support, inSeason, strength, favorable, pattern,
    stars: baziStars(pillars, dayStem), forward, startAge, luck,
  };
}

// 某一天對這張命盤的提示（首頁的今日運勢用）
function baziDaily(chart, date = new Date()) {
  const day = ganzhiDate(date);
  const god = tenGod(chart.dayStem, day.dayStem);
  const element = STEM_ELEMENTS[day.dayStem];
  const lean = chart.favorable.length ? (chart.favorable.includes(element) ? "今天的日干是你的喜用五行，整體偏順。" : "今天的日干不是你的喜用五行，凡事保守一點。") : "";
  return { day: day.day, god, text: `${DAILY_TEXTS[god]}${lean}` };
}

// ── 畫面 ──
const pairText = (stem, branch) => STEMS[stem] + BRANCHES[branch];

function baziPoster(birth, chart) {
  const { canvas, ctx, colors } = createPoster("bazi", "八字命盤");
  ctx.fillStyle = colors.ink;
  ctx.font = `700 52px ${POSTER_SERIF}`;
  ctx.fillText(birth.name || "命盤", 540, 210);
  ctx.fillStyle = colors.muted;
  ctx.font = `28px ${POSTER_SANS}`;
  ctx.fillText(`${birthLabel(birth)}　${birth.gender === "male" ? "男" : "女"}命　${chart.pattern}`, 540, 262);

  [...chart.pillars].reverse().forEach((pillar, i) => {
    const x = 96 + i * 228;
    posterPanel(ctx, colors, x, 310, 204, 440);
    ctx.fillStyle = colors.muted;
    ctx.font = `26px ${POSTER_SANS}`;
    ctx.fillText(pillar.name, x + 102, 362);
    ctx.fillStyle = colors.accent;
    ctx.fillText(pillar.stemGod, x + 102, 404);
    ctx.font = `700 124px ${POSTER_SERIF}`;
    ctx.fillStyle = POSTER_ELEMENT_COLORS[STEM_ELEMENTS[pillar.stem]];
    ctx.fillText(STEMS[pillar.stem], x + 102, 540);
    ctx.fillStyle = POSTER_ELEMENT_COLORS[BRANCH_ELEMENTS[pillar.branch]];
    ctx.fillText(BRANCHES[pillar.branch], x + 102, 690);
  });

  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink;
  ctx.font = `34px ${POSTER_SANS}`;
  let y = posterWrap(ctx, `日主${STEMS[chart.dayStem]}${chart.me}，${chart.strength}`
    + (chart.favorable.length ? `，喜用${chart.favorable.join("、")}。` : "，五行大致平衡。"), 110, 840, 860, 54, 2);
  ctx.font = `30px ${POSTER_SANS}`;
  ctx.fillStyle = colors.muted;
  posterWrap(ctx, DAY_MASTERS[chart.dayStem], 110, y + 20, 860, 50, 6);
  return canvas;
}

function renderBazi(birth) {
  const chart = baziChart(birth);
  const root = document.querySelector("#result");
  root.replaceChildren();

  // 四柱表（由左到右排時日月年）
  const table = el("div", "pillars");
  for (const pillar of [...chart.pillars].reverse()) {
    table.append(el("div", `pillar${pillar.name === "日柱" ? " self" : ""}`, [
      el("div", "pillar-name", pillar.name),
      el("div", "pillar-god", pillar.stemGod),
      el("div", `pillar-char e-${STEM_ELEMENTS[pillar.stem]}`, STEMS[pillar.stem]),
      el("div", `pillar-char e-${BRANCH_ELEMENTS[pillar.branch]}`, BRANCHES[pillar.branch]),
      el("div", "pillar-hidden", pillar.hidden.map((h) => el("span", null, `${STEMS[h.stem]} ${h.god}`))),
    ]));
  }

  const bars = el("div", "element-bars", [...ELEMENT_ORDER].map((element) => {
    const share = chart.weights[element] / chart.total;
    const fill = el("i");
    fill.style.width = `${Math.round(share * 100)}%`;
    return el("div", `element-bar e-${element}${element === chart.me ? " self" : ""}`, [
      el("span", null, element), el("div", "track", [fill]), el("span", null, `${Math.round(share * 100)}%`),
    ]);
  }));

  const note = dstNote(birth);
  root.append(el("section", "card", [
    el("h2", null, `${birth.name}的四柱`),
    el("p", "meta", `${birthLabel(birth)} · ${birth.gender === "male" ? "男" : "女"}命 · ${chart.pattern} · 旬空 ${chart.gz.empty.join("")}`),
    note ? el("p", "hint", note) : null,
    table,
    el("h3", null, "五行分布"),
    bars,
    el("div", "actions summary-actions", [posterButton(() => baziPoster(birth, chart), `觀象-八字-${birth.name}.png`)]),
  ]));

  // 解讀
  const reading = el("section", "card reading-card");
  reading.append(el("h2", null, "解讀"));
  const part = (title, text) => reading.append(el("div", "reading-part", [el("h5", null, title), el("p", null, text)]));

  part("日主", `你的日主是${STEMS[chart.dayStem]}${chart.me}。${DAY_MASTERS[chart.dayStem]}`);

  const supportText = `同類與生扶日主的五行佔 ${Math.round(chart.support * 100)}%，${chart.inSeason ? "出生的月份對日主有利（得令）" : "出生的月份對日主不利（失令）"}。`;
  const strengthText = {
    偏強: "日主偏強：你本身的能量夠，問題不在於撐不撐得住，而在於有沒有地方發揮。太強而無處洩，會變成固執、自以為是。",
    偏弱: "日主偏弱：你要扛的東西（財、事業、壓力）比你本身的能量大，容易覺得累、撐不住，需要靠學習、貴人、同伴來補。",
    中和: "日主中和：五行大致平衡，沒有明顯的偏枯。這是比較平穩的格局，好壞主要看大運走到哪裡。",
  }[chart.strength];
  const favorText = chart.favorable.length
    ? `\n喜用的五行是${chart.favorable.join("、")}：行到這些五行的大運流年比較順，可以多親近屬於它們的顏色、方位、行業；反過來的五行當旺時要保守。`
    : "";
  part("強弱與喜用", `${supportText}\n${strengthText}${favorText}`);

  const monthGod = chart.pillars[1].hidden[0].god;
  part("格局", `月令本氣是${STEMS[chart.pillars[1].hidden[0].stem]}，對日主為${monthGod}，取為「${chart.pattern}」。`
    + `月令是八字裡力量最大的位置，它代表你的人生主軸：${(TEN_GOD_TEXTS[monthGod] || "").split("：")[1] || ""}`);

  const ranked = Object.entries(chart.gods).sort((a, b) => b[1] - a[1]);
  part("性格與際遇", ranked.slice(0, 2).map(([god]) => TEN_GOD_TEXTS[god]).join("\n"));

  if (chart.stars.length) {
    part("神煞", chart.stars.map((star) => `${star.name}（在${star.where.join("、")}）：${star.note}`).join("\n"));
  }

  const elementLines = [];
  for (const element of ELEMENT_ORDER) {
    const share = chart.weights[element] / chart.total;
    if (share >= 0.35) elementLines.push(ELEMENT_NOTES[element][0]);
    if (share <= 0.04) elementLines.push(ELEMENT_NOTES[element][1]);
  }
  if (elementLines.length) part("五行偏枯", elementLines.join("\n"));

  root.append(reading);

  // 大運與流年
  const now = new Date();
  const age = now.getFullYear() - birth.year;
  const luckRow = el("div", "luck-row", chart.luck.map((luck) => {
    const current = now.getFullYear() >= luck.year && now.getFullYear() < luck.year + 10;
    return el("div", `luck${current ? " current" : ""}`, [
      el("div", "luck-age", `${Math.floor(luck.age)} 歲起`),
      el("div", "pillar-char small", pairText(luck.stem, luck.branch)),
      el("div", "luck-god", luck.god),
      el("div", "luck-year", `${luck.year}`),
    ]);
  }));
  // 往後五年的流年
  // 還沒過立春的話，今年的干支仍是去年的
  const calendarIndex = (((now.getFullYear() - 4) % 60) + 60) % 60;
  const firstYear = ganzhiDate(now).yearIndex === calendarIndex ? now.getFullYear() : now.getFullYear() - 1;
  const years = Array.from({ length: 5 }, (_, i) => {
    const year = firstYear + i;
    const index = (((year - 4) % 60) + 60) % 60;
    const element = STEM_ELEMENTS[index % 10];
    const lean = chart.favorable.length ? (chart.favorable.includes(element) ? "順" : "守") : "平";
    return el("div", `luck${i === 0 ? " current" : ""}`, [
      el("div", "luck-age", `${year}`),
      el("div", "pillar-char small", pairText(index % 10, index % 12)),
      el("div", "luck-god", tenGod(chart.dayStem, index % 10)),
      el("div", "luck-year", lean),
    ]);
  });
  // 今年的流月：以「節」為界，寅月（立春）到丑月（小寒），月干由年干推出（五虎遁）
  const MONTH_GOD_TEXTS = {
    比肩: "同輩、競爭多，凡事想自己來", 劫財: "花費與人情開銷大，防衝動破財", 食神: "心情放鬆，適合創作、享受與休息", 傷官: "表現慾強，容易說錯話、與上司起摩擦",
    偏財: "機會與偏財多，交際應酬也多", 正財: "適合踏實工作、存錢、處理實務", 七殺: "壓力與挑戰大，要果斷、防衝突", 正官: "責任、規範與升遷機會，宜守規矩",
    偏印: "想法多、適合進修與獨處，防想太多", 正印: "有貴人與長輩幫忙，適合學習、休養",
  };
  const yearIdx = (((firstYear - 4) % 60) + 60) % 60;
  let jie = nearestJie(Date.UTC(firstYear, 0, 20), true); // 立春
  const months = Array.from({ length: 12 }, (_, k) => {
    const start = new Date(jie + 8 * 3600000);
    jie = nearestJie(jie + 5 * 86400000, true);
    const stem = ((yearIdx % 5) * 2 + 2 + k) % 10, branch = (k + 2) % 12;
    const god = tenGod(chart.dayStem, stem);
    const element = STEM_ELEMENTS[stem];
    const lean = chart.favorable.length ? (chart.favorable.includes(element) ? "順" : "守") : "平";
    const clash = (branch + 6) % 12 === chart.pillars[2].branch;
    const isNow = now >= start && now < new Date(jie + 8 * 3600000);
    return el("div", `month-luck${isNow ? " current" : ""}`, [
      el("div", "luck-age", `${start.getUTCMonth() + 1}/${start.getUTCDate()} 起`),
      el("div", "pillar-char small", pairText(stem, branch)),
      el("div", "luck-god", `${god}・${lean}`),
      el("p", "month-text", MONTH_GOD_TEXTS[god] + (clash ? "；月支沖日支，生活與感情容易變動" : "") + "。"),
    ]);
  });
  const startYears = Math.floor(chart.startAge);
  const startMonths = Math.round((chart.startAge - startYears) * 12);
  const today = baziDaily(chart, now);
  root.append(el("section", "card", [
    el("h2", null, "大運與流年"),
    el("p", "meta", `${chart.forward ? "順" : "逆"}行，約 ${startYears} 歲 ${startMonths} 個月起運，每十年換一運。你現在約 ${age} 歲。`),
    luckRow,
    el("h3", null, "往後五年"),
    el("div", "luck-row five", years),
    el("p", "hint", "「順」表示流年天干是你的喜用五行，「守」表示不是，「平」表示命局平衡、沒有明顯偏向。"),
    el("h3", null, `${firstYear} 流月`),
    el("div", "month-row", months),
    el("p", "hint", "每個月以節氣交接的那天開始（例如立春、驚蟄），不是農曆初一；十神是月干對你日主的關係。"),
    el("div", "guide", [el("h4", null, `今天（${today.day}日，${today.god}）`), el("p", null, today.text)]),
    el("p", "hint", "這裡的強弱與喜用是用五行比重估算的簡易判斷，格局只取月令本氣，神煞只列最常用的幾個；沒有細論調候、通根透干與刑沖合害。年、月以節氣為界；晚上 11 點後出生，日柱算隔天。"),
  ]));
  root.hidden = false;
}

if (typeof document !== "undefined" && document.querySelector("#birth-form") && document.documentElement.dataset.theme === "bazi") {
  birthForm(document.querySelector("#birth-form"), { button: "排八字" }, renderBazi);
}
