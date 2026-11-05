// 犯太歲、流年星與車關（民俗說法）。
// 需要 divination.js（STEMS、BRANCHES）、najia.js（ganzhiAt、solarLongitudeAt）、birth.js、almanac.js（ZODIAC_ANIMALS）。
//
// 規則：
// ・犯太歲：生肖地支和流年地支的關係。同支為值太歲，相沖為沖太歲（歲破），另有刑、害、破。
// ・流年十二星（歲前十二神）：從流年地支起太歲，依地支順序往後排
//   太歲、太陽、喪門、太陰、五鬼、死符、歲破、龍德、白虎、福德、天狗、病符。
//   例：2026 丙午年，屬馬為太歲、屬羊太陽、屬猴喪門……屬鼠歲破、屬虎白虎、屬龍天狗。
// ・車關：民間把白虎、天狗（血光、意外）和沖太歲年視為要注意交通的年份；
//   有完整出生資料時，再看八字的驛馬（奔波、出行）和羊刃（血光、開刀）是否被流年、流月沖到。

const TS_STARS = ["太歲", "太陽", "喪門", "太陰", "五鬼", "死符", "歲破", "龍德", "白虎", "福德", "天狗", "病符"];
// 有些流派把第五位（五鬼／官符）和第九位（白虎）的生肖對調，頁面上會註明
const TS_STAR_TEXT = {
  太歲: { tone: "caution", text: "本命年，太歲當頭。變動、壓力和責任都比較多，容易覺得卡卡的；適合守成、把基礎打穩，不適合衝太快。" },
  太陽: { tone: "good", text: "吉星。男性貴人、長輩或上司的助力多，事業上容易被看見，適合爭取表現。" },
  喪門: { tone: "bad", text: "主孝服、探病和低落的心情。今年少去喪事、醫院這類場合湊熱鬧，多關心家中長輩的身體。" },
  太陰: { tone: "good", text: "吉星。女性貴人多，人緣和桃花不錯；做事宜柔不宜硬。" },
  五鬼: { tone: "bad", text: "主小人、口舌是非、文書糾紛和小破財。說話留餘地，合約、借錢、作保都要多看一眼。" },
  死符: { tone: "caution", text: "主小病痛和莫名的低潮，也有破財（小耗）的說法。注意身體保養，大筆花費多想一下。" },
  歲破: { tone: "bad", text: "就是沖太歲，又叫大耗。變動最大的一年：搬家、換工作、感情或家庭的變化，也比較容易破財。" },
  龍德: { tone: "good", text: "吉星。逢凶化吉，貴人多，做事比較順；適合推動計畫、求人幫忙。" },
  白虎: { tone: "bad", text: "主血光、意外、開刀和是非。民間說犯白虎要注意車關：開車騎車放慢，運動、爬高、用刀具都小心。" },
  福德: { tone: "good", text: "吉星。福氣、財運和心情都不錯，努力容易有回報。" },
  天狗: { tone: "bad", text: "主血光、破財、小人，也有車禍、破相的說法（這個位置也叫弔客）。交通與人身安全要特別留意。" },
  病符: { tone: "caution", text: "主小病和慢性的身體問題，也容易被小事拖累。定期檢查、作息規律最重要。" },
};

// 地支之間的刑、沖、害、破（0＝子…11＝亥）
const TS_CLASH = (a, b) => (a + 6) % 12 === b;
const TS_HARM_PAIRS = [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]];
const TS_BREAK_PAIRS = [[0, 9], [3, 6], [4, 1], [7, 10], [2, 11], [5, 8]];
const tsPair = (pairs, a, b) => pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
// 刑：子卯相刑；寅巳申、丑戌未三刑；辰午酉亥自刑
function tsPunish(a, b) {
  if ((a === 0 && b === 3) || (a === 3 && b === 0)) return true;
  const groups = [[2, 5, 8], [1, 10, 7]];
  if (groups.some((g) => a !== b && g.includes(a) && g.includes(b))) return true;
  return a === b && [4, 6, 9, 11].includes(a);
}

const TS_RELATION_TEXT = {
  值: "值太歲（本命年）：今年就是你的生肖年，民間說「太歲當頭坐，無喜恐有禍」，變動和壓力都比較大。",
  沖: "沖太歲（正沖）：和流年正面相沖，是犯太歲裡影響最大的一種，主變動、搬遷、破財、人際或感情的起伏。",
  偏沖: "偏沖太歲：生肖和太歲在十二地支裡成九十度（台灣民間的算法，例如午年的兔和雞），影響比正沖輕，主是非、變動和人際摩擦。",
  刑: "刑太歲：主是非、官司文書、身體小傷和自己跟自己過不去的煩惱。",
  害: "害太歲：主小人暗中扯後腿、人際誤會，做事容易被拖延。",
  破: "破太歲：主破財、計畫被打亂、合作破局，比沖、刑輕一些。",
};

function tsRelations(born, year) {
  const list = [];
  if (born === year) list.push("值");
  if (TS_CLASH(born, year)) list.push("沖");
  if ((born - year + 12) % 12 === 3 || (born - year + 12) % 12 === 9) list.push("偏沖");
  if (tsPunish(born, year)) list.push("刑");
  if (tsPair(TS_HARM_PAIRS, born, year)) list.push("害");
  if (tsPair(TS_BREAK_PAIRS, born, year)) list.push("破");
  return list;
}

// 八字的驛馬（依年支或日支三合局）與羊刃（依日干，只論陽干）
const TS_HORSE = [2, 11, 8, 5]; // 申子辰→寅、巳酉丑→亥、寅午戌→申、亥卯未→巳，以地支 %4 查
const TS_BLADE = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 }; // 甲卯、丙午、戊午、庚酉、壬子

// 某個農曆年（year 為該年正月初一所在的西元年）的每個月：月份名稱、月建地支、國曆起訖；閏月也列出來
function tsLunarMonths(year) {
  const start = lunarYearInfo(year).start;
  const months = [];
  for (let k = 0; k < 400; k++) {
    const d = new Date(Date.UTC(year, 0, 1 + start + k));
    const l = lunarOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (l.year !== year) break;
    const last = months[months.length - 1];
    if (!last || last.month !== l.month || last.leap !== l.leap) months.push({ month: l.month, leap: l.leap, branch: (l.month + 1) % 12, start: d, end: d });
    else last.end = d;
  }
  return months.map((m) => ({ ...m, name: `${m.leap ? "閏" : ""}${TS_LUNAR_NAMES[m.month - 1]}月` }));
}
const TS_LUNAR_NAMES = ["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];

const tsDate = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

// ── 流年神煞（《三命通會》等書的通行查法）──
// 依生肖（出生年支）查：紅鸞、天喜、咸池、劫煞、災煞；依日干查（要有完整出生資料）：文昌、天乙貴人
const TS_RED = (born) => (3 - born + 12) % 12; // 紅鸞：子見卯、丑見寅、寅見丑……逆行；天喜在紅鸞對面
const TS_PEACH = [9, 6, 3, 0]; // 咸池：申子辰見酉、巳酉丑見午、寅午戌見卯、亥卯未見子（以地支 %4 查）
const TS_ROB = [5, 2, 11, 8]; // 劫煞：申子辰見巳、巳酉丑見寅、寅午戌見亥、亥卯未見申
const TS_DISASTER = [6, 3, 0, 9]; // 災煞：申子辰見午、巳酉丑見卯、寅午戌見子、亥卯未見酉
const TS_WENCHANG = [5, 6, 8, 9, 8, 9, 11, 0, 2, 3]; // 文昌，依日干
const TS_NOBLE = [[1, 7], [0, 8], [11, 9], [11, 9], [1, 7], [0, 8], [1, 7], [6, 2], [3, 5], [3, 5]]; // 天乙貴人，依日干
const TS_HARMONY = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]]; // 六合

// branch 是流年或流月的地支；回傳碰到的神煞 [{ name, tone, text, road }]
function tsShensha(branch, born, person) {
  const list = [];
  if (branch === TS_RED(born)) list.push({ name: "紅鸞", tone: "good", text: "紅鸞星動：桃花、喜事（交往、訂婚、結婚）的機會多。" });
  if (branch === (TS_RED(born) + 6) % 12) list.push({ name: "天喜", tone: "good", text: "天喜：喜事、好消息、添丁，心情比較開朗。" });
  if (branch === TS_PEACH[born % 4]) list.push({ name: "咸池", tone: "caution", text: "咸池（桃花）：人緣和異性緣旺；有伴的人留意分寸，別讓曖昧變麻煩。" });
  if (branch === TS_ROB[born % 4]) list.push({ name: "劫煞", tone: "bad", road: "mid", text: "劫煞：破財、被搶先、意外；錢財往來與人身安全多留意。" });
  if (branch === TS_DISASTER[born % 4]) list.push({ name: "災煞", tone: "bad", road: "high", text: "災煞：血光、災病、意外，交通與健康都要小心。" });
  if (person) {
    if (branch === TS_WENCHANG[person.dayStem]) list.push({ name: "文昌", tone: "good", text: "文昌：讀書、考試、證照、寫作都順，適合進修。" });
    if (TS_NOBLE[person.dayStem].includes(branch)) list.push({ name: "天乙貴人", tone: "good", text: "天乙貴人：遇到難處有人幫，適合求人、談合作。" });
  }
  return list;
}

// 主程式：born 為生肖地支；person 有完整八字時傳 { dayStem, dayBranch, yearBranch }
function taisuiReading(born, year, person) {
  const yearIndex = (((year - 4) % 60) + 60) % 60;
  const yb = yearIndex % 12;
  const relations = tsRelations(born, yb);
  const star = TS_STARS[(born - yb + 12) % 12];
  const starInfo = TS_STAR_TEXT[star];
  const shensha = tsShensha(yb, born, person);

  // 車關與血光
  const road = [];
  if (star === "白虎" || star === "天狗") road.push({ level: "high", text: `流年${star}入命：民間最常說要防車關、血光的就是這顆星。` });
  if (relations.includes("沖")) road.push({ level: "mid", text: "沖太歲：出門、搬遷、出差的變動多，交通相關的事要多一分小心。" });
  if (relations.includes("值")) road.push({ level: "mid", text: "本命年（值太歲）：民間習慣提醒本命年的人注意交通與意外，像車子臨時故障、行程被打亂這類事也比較多。" });
  if (star === "喪門") road.push({ level: "low", text: "喪門星：主要是孝服和心情，不是車關；但出入醫院、喪事場合多時，記得照顧好自己。" });
  for (const s of shensha) if (s.road) road.push({ level: s.road, text: `流年逢${s.text}` });

  let horses = [], blade = null;
  if (person) {
    horses = [...new Set([TS_HORSE[person.yearBranch % 4], TS_HORSE[person.dayBranch % 4]])];
    for (const h of horses) {
      if (yb === h) road.push({ level: "mid", text: `流年走到你八字的驛馬（${BRANCHES[h]}）：今年出門、出差、搬動多，人在路上的時間變長，交通安全自然要多注意。` });
      if (TS_CLASH(h, yb)) road.push({ level: "high", text: `流年沖到你八字的驛馬（${BRANCHES[h]}）：民間說「馬逢沖，防車禍」，今年開車騎車要特別小心。` });
    }
    blade = TS_BLADE[person.dayStem] ?? null;
    if (blade != null) {
      if (yb === blade) road.push({ level: "high", text: `流年走到你八字的羊刃（${BRANCHES[blade]}）：主血光、開刀、意外，用刀用火、運動和交通都要小心。` });
      if (TS_CLASH(blade, yb)) road.push({ level: "high", text: `流年沖到你八字的羊刃（${BRANCHES[blade]}）：民間說「羊刃逢沖」最容易有血光意外。` });
    }
  }
  const level = road.some((r) => r.level === "high") ? "high" : road.some((r) => r.level === "mid") ? "mid" : road.length ? "low" : "none";

  // 每個月：流月地支和生肖的關係、流月神煞、八字驛馬羊刃
  // 每個月：用農曆月，月建（正月寅、二月卯……十一月子、十二月丑；閏月同前一個月）和生肖的沖刑害破、六合三合，
  // 加上流月神煞與八字驛馬、羊刃。廟宇農民曆的生肖每月運勢也是這樣看（例如屬虎七月「本命逢沖」、四月「命刑」）。
  const months = tsLunarMonths(year).map((m) => {
    const notes = [];
    let score = 0, car = false;
    const add = (tone, tag, text, points, isCar) => { notes.push({ tone, tag, text }); score += points; if (isCar) car = true; };
    if (born === m.branch) add("caution", "本命月", "本命月：月份和你的生肖同一個地支，事情容易反覆、心情起伏，凡事求穩。", -1);
    if (TS_CLASH(born, m.branch)) add("bad", "本命逢沖", `本命逢沖：這個月和你的生肖（${ZODIAC_ANIMALS[born]}）相沖，變動多、容易跟人起衝突，出門開車騎車要特別小心，重要的決定能延就延。`, -2, true);
    if (tsPunish(born, m.branch) && born !== m.branch) add("caution", "刑", "刑：容易有是非、文書糾紛或小傷，說話做事多留一步，簽東西看清楚。", -1);
    if (tsPair(TS_HARM_PAIRS, born, m.branch)) add("caution", "害", "害：人際容易誤會、被人扯後腿，合作的事要先講清楚。", -1);
    if (tsPair(TS_BREAK_PAIRS, born, m.branch)) add("caution", "破", "破：計畫容易被打亂、多出意外開銷，錢包看緊一點。", -1);
    if (tsPair(TS_HARMONY, born, m.branch)) add("good", "六合", "六合：人和、貴人多，適合談事情、約會、簽約、求人幫忙。", 2);
    if (born !== m.branch && born % 4 === m.branch % 4) add("good", "三合", "三合：氣場順，做事有人幫，適合推進計畫。", 1);
    for (const sh of tsShensha(m.branch, born, person)) add(sh.tone, sh.name, sh.text, sh.tone === "good" ? 1 : sh.tone === "bad" ? -2 : 0, !!sh.road);
    for (const h of horses) if (TS_CLASH(h, m.branch)) add("bad", "驛馬逢沖", `驛馬逢沖（${BRANCHES[h]}）：出門奔波多，民間說「馬逢沖，防車禍」，交通要特別小心。`, -2, true);
    if (blade != null && m.branch === blade) add("bad", "羊刃", "羊刃當令：用刀用火、運動、交通都要小心，防血光意外。", -2, true);
    const grade = score >= 2 ? "good" : score <= -2 ? "bad" : "neutral";
    const tip = grade === "good" ? "比較順的月份，重要的事可以排在這個月。" : grade === "bad" ? "這個月保守一點，大事往後延，多照顧自己。" : notes.length ? "整體平穩，照上面的提醒注意就好。" : "沒有特別的沖合，平穩的一個月，照自己的步調走。";
    return { ...m, notes, score, grade, car, tip };
  });

  return {
    year, yearGz: STEMS[yearIndex % 10] + BRANCHES[yb], yearAnimal: ZODIAC_ANIMALS[yb], yearBranch: yb, born, animal: ZODIAC_ANIMALS[born],
    relations, star, starInfo, shensha, road, level, months,
  };
}

// 一整年十二生肖的總表
function taisuiTable(year) {
  return Array.from({ length: 12 }, (_, born) => {
    const r = taisuiReading(born, year, null);
    return { born, animal: r.animal, relations: r.relations, star: r.star, tone: r.starInfo.tone, road: r.level };
  });
}

// 生肖要以立春還是農曆過年為界（使用者可切換，記在這台裝置上）
const TS_BOUNDARY_KEY = "taisui-boundary";
const tsBoundary = () => { try { return localStorage.getItem(TS_BOUNDARY_KEY) === "lunar" ? "lunar" : "lichun"; } catch { return "lichun"; } };

// 已儲存的人 → { name, yearBranch（生肖）, dayBranch, dayStem }
function tsPersonInfo(p, boundary = tsBoundary()) {
  const birth = resolveBirth(p);
  const gz = ganzhiAt(birth.clock.year, birth.clock.month, birth.clock.day, birth.clock.hour, birthInstant(birth), true);
  let yearBranch = BRANCHES.indexOf(gz.year[1]);
  if (boundary === "lunar") {
    const lunarYear = lunarOf(birth.clock.year, birth.clock.month, birth.clock.day).year;
    yearBranch = (((lunarYear - 4) % 12) + 12) % 12;
  }
  return { name: p.name, yearBranch, dayBranch: BRANCHES.indexOf(gz.day[1]), dayStem: gz.dayStem };
}

// 這一年的安太歲（正月初一到元宵）與謝太歲（農曆十二月廿四送神前）日期，並挑幾個適合祈福的日子
function tsTemple(year, person) {
  const start = lunarYearInfo(year).start;
  const day = (offset) => new Date(Date.UTC(year, 0, 1 + offset));
  const newYear = day(start), lantern = day(start + 14);
  let thanks = null;
  for (let k = 320; k < 400 && !thanks; k++) {
    const d = day(start + k);
    const l = lunarOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (l.month === 12 && l.day === 24 && !l.leap) thanks = d;
  }
  const picks = pickDays("祈福", new Date(newYear.getUTCFullYear(), newYear.getUTCMonth(), newYear.getUTCDate()), 15, person).slice(0, 3);
  return { newYear, lantern, thanks, picks };
}

// ── 頁面 ──
(() => {
  const root = document.querySelector("#ts-app");
  if (!root) return;
  const now = new Date();
  // 立春前還算前一年
  const thisYear = now.getFullYear() - (now.getMonth() < 2 && solarLongitudeAt(now.getTime()) >= 270 && solarLongitudeAt(now.getTime()) < 315 ? 1 : 0);
  const state = { year: thisYear, born: null, person: null, personId: null };

  const people = loadPeople();
  const pick = root.querySelector("#ts-pick");
  const yearTabs = root.querySelector("#ts-years");
  const out = document.querySelector("#result");
  const table = document.querySelector("#ts-table");
  const family = document.querySelector("#ts-family");

  // 年份：今年、明年
  for (const y of [thisYear, thisYear + 1]) {
    const yi = (((y - 4) % 60) + 60) % 60;
    const b = el("button", `tab${y === state.year ? " active" : ""}`, `${y} ${STEMS[yi % 10]}${BRANCHES[yi % 12]}${ZODIAC_ANIMALS[yi % 12]}年`);
    b.type = "button";
    b.addEventListener("click", () => {
      state.year = y;
      yearTabs.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      render();
    });
    yearTabs.append(b);
  }

  // 生肖分界
  const boundaryBox = el("div", "choices ts-boundary");
  for (const [key, label] of [["lichun", "以立春為界"], ["lunar", "以農曆過年為界"]]) {
    const b = el("button", tsBoundary() === key ? "active" : "", label);
    b.type = "button";
    b.addEventListener("click", () => {
      try { localStorage.setItem(TS_BOUNDARY_KEY, key); } catch { /* 存不了就只用這次 */ }
      boundaryBox.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      buildPeople();
      if (state.personId) {
        const p = people.find((x) => x.id === state.personId);
        if (p) { state.person = tsPersonInfo(p); state.born = state.person.yearBranch; }
      }
      render();
    });
    boundaryBox.append(b);
  }

  // 選人或選生肖
  const chips = [];
  const peopleRow = el("div", "person-chips");
  const choose = (born, person, id) => {
    state.born = born;
    state.person = person;
    state.personId = id;
    syncChips();
    render();
  };
  const syncChips = () => chips.forEach((c) => c.classList.toggle("active", c.dataset.id ? c.dataset.id === state.personId : !state.personId && Number(c.dataset.born) === state.born));
  function buildPeople() {
    chips.splice(0, chips.length, ...chips.filter((c) => !c.dataset.id));
    peopleRow.replaceChildren();
    for (const p of people) {
      try {
        const info = tsPersonInfo(p);
        const b = el("button", "person-chip", `${p.name}（${ZODIAC_ANIMALS[info.yearBranch]}）`);
        b.type = "button";
        b.dataset.id = p.id;
        b.addEventListener("click", () => choose(info.yearBranch, info, p.id));
        chips.push(b);
        peopleRow.append(b);
      } catch { /* 資料不完整就略過 */ }
    }
    syncChips();
  }
  if (people.length) pick.append(el("p", "hint", "選一個已儲存的人（會一併看八字的驛馬、羊刃、文昌、貴人），或直接選生肖。"), peopleRow);
  const grid = el("div", "ts-animals");
  ZODIAC_ANIMALS.split("").forEach((animal, born) => {
    const b = el("button", "ts-animal", animal);
    b.type = "button";
    b.dataset.born = born;
    b.setAttribute("aria-label", `屬${animal}`);
    b.addEventListener("click", () => choose(born, null, null));
    chips.push(b);
    grid.append(b);
  });
  pick.append(grid, el("p", "hint ts-boundary-hint", "生肖的分界：八字以立春為界，很多廟宇以農曆過年為界。一月、二月初出生的人兩種算法可能差一年，選跟你去的廟一樣的就好。"), boundaryBox);
  buildPeople();

  const levelText = { high: ["要特別注意", "bad"], mid: ["需要留意", "caution"], low: ["小心一點就好", "neutral"], none: ["沒有特別的車關", "good"] };
  const md = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

  function render() {
    renderTable();
    renderFamily();
    if (state.born == null) { out.hidden = true; return; }
    const r = taisuiReading(state.born, state.year, state.person);
    const who = state.person ? `${state.person.name}・屬${r.animal}` : `屬${r.animal}`;
    const verdict = r.relations.length ? r.relations.map((x) => `${x}太歲`).join("、") : "沒有犯太歲";
    const [roadLabel, roadTone] = levelText[r.level];

    const summary = el("section", "card ts-summary", [
      el("p", "meta", `${r.year} ${r.yearGz}年（${r.yearAnimal}年）・${who}`),
      el("h2", null, verdict),
      el("div", "ts-badges", [
        el("span", `tone ${r.relations.length ? (r.relations.includes("沖") || r.relations.includes("值") ? "bad" : "caution") : "good"}`, r.relations.length ? "犯太歲" : "不犯太歲"),
        el("span", `tone ${r.starInfo.tone}`, `流年星：${r.star}`),
        el("span", `tone ${roadTone}`, `車關：${roadLabel}`),
        ...r.shensha.map((s) => el("span", `tone ${s.tone}`, s.name)),
      ]),
    ]);

    const reading = el("section", "card reading-card no-fold", [
      el("h2", null, "解讀"),
      el("div", "reading-part", [el("h5", null, "一句話"), el("p", null, oneLine(r))]),
      el("div", "reading-part", [el("h5", null, "具體建議"), el("p", null, advice(r).join("\n"))]),
      r.relations.length ? el("div", "reading-part", [el("h5", null, "犯太歲"), el("p", null, r.relations.map((x) => TS_RELATION_TEXT[x]).join("\n"))]) : null,
      el("div", "reading-part", [el("h5", null, `流年星：${r.star}`), el("p", null, r.starInfo.text + (r.star === "白虎" || r.star === "五鬼"
        ? `\n注意：有些命理師把白虎和五鬼的位置對調排，所以今年屬${ZODIAC_ANIMALS[(r.born + (r.star === "白虎" ? -4 : 4) + 12) % 12]}的人也可能被說成逢${r.star}。本站採最常見的排法（歲前十二神從太歲順排）。` : ""))]),
      el("div", "reading-part", [el("h5", null, "流年神煞"), el("p", null, r.shensha.length ? r.shensha.map((s) => s.text).join("\n") : `今年沒有碰到紅鸞、天喜、咸池、劫煞、災煞${state.person ? "、文昌、天乙貴人" : ""}。`)]),
      el("div", "reading-part", [el("h5", null, "車關與血光"), el("p", null, r.road.length ? r.road.map((x) => x.text).join("\n") : "今年的流年星、太歲關係和神煞都沒有指向車關。照常注意交通安全就好。")]),
      !state.person ? el("p", "hint", "只選生肖時看的是生肖流年。選已儲存的人（到八字頁填過出生資料的人），還會加看八字的驛馬、羊刃、文昌、天乙貴人，車關和每月運勢會更完整。") : null,
    ]);

    const months = el("section", "card ts-months-card no-fold", [
      el("h2", null, "每個月的運勢"),
      el("p", "hint", "照農曆月份看（初一到月底），旁邊是對應的國曆日期。和廟宇農民曆的生肖每月運勢一樣，看的是當月月建和你生肖的沖、刑、害、破、六合、三合，再加上當月碰到的神煞。"),
      el("div", "ts-months", r.months.map((m) => {
        const current = now >= m.start && now < new Date(m.end.getTime() + 86400000);
        return el("div", `ts-month ${m.grade}${current ? " now" : ""}`, [
          el("div", "ts-month-head", [
            el("b", null, m.name),
            el("small", "ts-month-branch", `${BRANCHES[m.branch]}月`),
            current ? el("span", "tone good", "本月") : null,
            el("small", null, `國曆 ${md(m.start)}～${md(m.end)}`),
            el("span", `tone ${m.grade === "good" ? "good" : m.grade === "bad" ? "bad" : "neutral"}`, m.grade === "good" ? "順" : m.grade === "bad" ? "要注意" : "平"),
            m.car ? el("span", "tone bad ts-car", "交通小心") : null,
          ]),
          m.notes.length ? el("ul", "ts-month-notes", m.notes.map((n) => el("li", `ts-note-${n.tone}`, n.text))) : null,
          el("p", "ts-month-tip", m.tip),
        ]);
      })),
    ]);

    const t = tsTemple(state.year, state.person ? { yearBranch: state.person.yearBranch, dayBranch: state.person.dayBranch } : { yearBranch: state.born, dayBranch: -1 });
    const temple = el("section", "card no-fold", [
      el("h2", null, r.relations.length ? "安太歲" : "安太歲（今年不一定需要）"),
      el("p", null, `安太歲：多在農曆過年後到元宵，${r.year} 年是國曆 ${md(t.newYear)}（正月初一）到 ${md(t.lantern)}（元宵）。很多廟宇過年前就開放登記，也有人整年隨時去安。`),
      t.picks.length ? el("p", null, `這段期間適合祈福、又不沖你的日子：${t.picks.map((p) => `${p.day.m}/${p.day.d}（${p.reasons.slice(0, 2).join("、") || "平穩"}）`).join("；")}。`) : null,
      t.thanks ? el("p", null, `謝太歲：年底送神（農曆十二月廿四）前回廟裡謝太歲，${r.year} 這個農曆年的送神日是國曆 ${t.thanks.getUTCFullYear()}/${md(t.thanks)}。`) : null,
      el("p", "hint", r.relations.length ? "安太歲是民間習俗，求的是心安；重點還是這一年做事收斂、大決定多想一下。" : "今年沒有犯太歲，安不安都可以；想求平安的人也常點光明燈。"),
    ]);

    const basis = el("section", "card", [
      el("h2", null, "依據與限制"),
      el("p", null, "犯太歲用的是地支的值、正沖、偏沖、刑、害、破；流年星是傳統的「歲前十二神」；紅鸞、天喜、咸池、劫煞、災煞依生肖查，文昌、天乙貴人依八字日干查，驛馬、羊刃是八字神煞，查法都是《三命通會》等命書的通行說法。各家廟宇與命理師的說法不完全一樣。"),
      el("p", null, "這些都是民俗說法，沒有證據顯示犯太歲或車關會讓意外發生。真正降低車禍風險的是：不疲勞駕駛、不滑手機、保持車距、注意天候與路況。安太歲、捐血這些做法求的是心安，可以做，但不要因此放鬆真正的安全習慣。"),
    ]);

    out.replaceChildren(summary, reading, months, temple, basis);
    out.hidden = false;
  }

  function oneLine(r) {
    const parts = [];
    parts.push(r.relations.length ? `今年你${r.relations.map((x) => `${x}太歲`).join("又")}` : "今年你沒有犯太歲");
    parts.push(`流年星是${r.star}（${r.starInfo.tone === "good" ? "吉星" : r.starInfo.tone === "bad" ? "凶星" : "要留意的星"}）`);
    const good = r.shensha.filter((s) => s.tone === "good").map((s) => s.name);
    if (good.length) parts.push(`還有${good.join("、")}幫忙`);
    const carMonths = r.months.filter((m) => m.car).length;
    parts.push(r.level === "high" ? "車關要特別注意" : r.level === "mid" ? "交通安全需要留意" : carMonths ? `整年沒有明顯的車關，但有 ${carMonths} 個月要多注意交通` : "沒有明顯的車關");
    return `${parts.join("，")}。`;
  }

  function advice(r) {
    const list = [];
    if (r.relations.length) list.push("犯太歲的年份，民間習慣在農曆新年後到元宵前到廟裡「安太歲」（點太歲燈）；重點是讓自己心安、做事收斂，大決定多想一下。");
    if (r.relations.includes("沖")) list.push("沖太歲變動大：搬家、換工作、投資這類大事，盡量選自己能掌握的時機，不要被情勢逼著倉促決定。");
    if (r.level === "high" || r.level === "mid") list.push("交通：開車不疲勞、不滑手機、多留車距；騎車戴好安全帽；長途出門前檢查車況。民間會用「捐血」化血光，就算不信，捐血本身也是好事。");
    if (["喪門", "死符", "病符"].includes(r.star)) list.push("今年多照顧身體和家中長輩，該做的健康檢查不要拖。");
    if (r.star === "五鬼" || r.shensha.some((s) => s.name === "劫煞")) list.push("今年防小人和破財：重要的事留書面紀錄，不借錢、不作保。");
    if (r.shensha.some((s) => s.name === "紅鸞" || s.name === "天喜")) list.push("今年感情和喜事的機會多，單身的人可以多參加活動；有伴的人適合談下一步。");
    const best = r.months.filter((m) => m.grade === "good").map((m) => `${BRANCHES[m.branch]}月`);
    if (best.length) list.push(`比較順的月份：${best.join("、")}，重要的事可以排在這幾個月。`);
    if (r.starInfo.tone === "good" && !r.relations.length) list.push(`今年有${r.star}吉星，是可以主動爭取機會的一年。`);
    return list.length ? list : ["今年太歲和流年星都平順，照自己的步調走就好。"];
  }

  // 全家一次看
  function renderFamily() {
    if (!family) return;
    const rows = people.map((p) => {
      try {
        const info = tsPersonInfo(p);
        const r = taisuiReading(info.yearBranch, state.year, info);
        return { p, info, r };
      } catch { return null; }
    }).filter(Boolean);
    family.closest("section").hidden = !rows.length;
    family.replaceChildren(...rows.map(({ p, info, r }) => {
      const row = el("button", `ts-family-row${state.personId === p.id ? " current" : ""}`, [
        el("b", null, p.name),
        el("small", null, `屬${r.animal}・${r.star}`),
        el("span", `tone ${r.relations.length ? "bad" : "good"}`, r.relations.length ? r.relations.map((x) => `${x}太歲`).join("、") : "不犯太歲"),
        r.level === "high" || r.level === "mid" ? el("span", `tone ${r.level === "high" ? "bad" : "caution"}`, "防車關") : null,
        r.relations.length ? el("span", "tone neutral", "建議安太歲") : null,
      ]);
      row.type = "button";
      row.addEventListener("click", () => {
        choose(info.yearBranch, info, p.id);
        out.scrollIntoView({ block: "start", behavior: "smooth" });
      });
      return row;
    }));
  }

  function renderTable() {
    const rows = taisuiTable(state.year);
    const yi = (((state.year - 4) % 60) + 60) % 60;
    document.querySelector("#ts-table-title").textContent = `${state.year} ${STEMS[yi % 10]}${BRANCHES[yi % 12]}年十二生肖一覽`;
    table.replaceChildren(
      el("div", "ts-row ts-head", [el("span", null, "生肖"), el("span", null, "犯太歲"), el("span", null, "流年星"), el("span", null, "車關")]),
      ...rows.map((row) => el("div", `ts-row${row.born === state.born ? " current" : ""}`, [
        el("span", "ts-cell-animal", row.animal),
        el("span", null, row.relations.length ? row.relations.map((x) => `${x}太歲`).join("、") : "—"),
        el("span", `ts-star ${row.tone}`, row.star),
        el("span", null, row.road === "high" ? "要注意" : row.road === "mid" ? "留意" : "—"),
      ])),
    );
  }

  // 有存人的話，先幫你選第一位
  const firstPerson = chips.find((c) => c.dataset.id);
  if (firstPerson) firstPerson.click();
  else render();
})();
