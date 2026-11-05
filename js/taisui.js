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
  沖: "沖太歲：和流年正面相沖，是犯太歲裡影響最大的一種，主變動、搬遷、破財、人際或感情的起伏。",
  刑: "刑太歲：主是非、官司文書、身體小傷和自己跟自己過不去的煩惱。",
  害: "害太歲：主小人暗中扯後腿、人際誤會，做事容易被拖延。",
  破: "破太歲：主破財、計畫被打亂、合作破局，比沖、刑輕一些。",
};

function tsRelations(born, year) {
  const list = [];
  if (born === year) list.push("值");
  if (TS_CLASH(born, year)) list.push("沖");
  if (tsPunish(born, year)) list.push("刑");
  if (tsPair(TS_HARM_PAIRS, born, year)) list.push("害");
  if (tsPair(TS_BREAK_PAIRS, born, year)) list.push("破");
  return list;
}

// 八字的驛馬（依年支或日支三合局）與羊刃（依日干，只論陽干）
const TS_HORSE = [2, 11, 8, 5]; // 申子辰→寅、巳酉丑→亥、寅午戌→申、亥卯未→巳，以地支 %4 查
const TS_BLADE = { 0: 3, 2: 6, 4: 6, 6: 9, 8: 0 }; // 甲卯、丙午、戊午、庚酉、壬子

// 某一年（立春到下一個立春）的十二個節氣月：每個月的地支與國曆起訖
function tsMonths(year) {
  const starts = [];
  let prev = null;
  for (let day = 0; day < 400; day++) {
    const noon = Date.UTC(year, 0, 20, 4) + day * 86400000; // 從一月二十日（台灣中午）起逐日找節氣交界
    const branch = (Math.floor(((solarLongitudeAt(noon) + 45) % 360) / 30) + 2) % 12;
    if (prev !== null && branch !== prev) starts.push({ branch, start: noon });
    prev = branch;
  }
  const first = starts.findIndex((m) => m.branch === 2); // 立春起寅月
  const list = starts.slice(first, first + 13);
  return list.slice(0, 12).map((m, i) => ({ branch: m.branch, start: new Date(m.start), end: new Date(list[i + 1].start - 86400000) }));
}

const tsDate = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

// 主程式：born 為生肖地支；person 有完整八字時傳 { dayStem, dayBranch, yearBranch }
function taisuiReading(born, year, person) {
  const yearIndex = (((year - 4) % 60) + 60) % 60;
  const yb = yearIndex % 12;
  const relations = tsRelations(born, yb);
  const star = TS_STARS[(born - yb + 12) % 12];
  const starInfo = TS_STAR_TEXT[star];

  // 車關與血光
  const road = [];
  if (star === "白虎" || star === "天狗") road.push({ level: "high", text: `流年${star}入命：民間最常說要防車關、血光的就是這顆星。` });
  if (relations.includes("沖")) road.push({ level: "mid", text: "沖太歲：出門、搬遷、出差的變動多，交通相關的事要多一分小心。" });
  if (star === "喪門") road.push({ level: "low", text: "喪門星：主要是孝服和心情，不是車關；但出入醫院、喪事場合多時，記得照顧好自己。" });

  const months = tsMonths(year);
  const watch = new Map();
  const flag = (branch, why) => {
    const m = months.find((x) => x.branch === branch);
    if (!m) return;
    if (!watch.has(branch)) watch.set(branch, { ...m, why: [] });
    watch.get(branch).why.push(why);
  };
  flag((born + 6) % 12, `這個月沖你的生肖（${ZODIAC_ANIMALS[born]}）`);

  if (person) {
    const horses = [...new Set([TS_HORSE[person.yearBranch % 4], TS_HORSE[person.dayBranch % 4]])];
    for (const h of horses) {
      if (yb === h) road.push({ level: "mid", text: `流年走到你八字的驛馬（${BRANCHES[h]}）：今年出門、出差、搬動多，人在路上的時間變長，交通安全自然要多注意。` });
      if (TS_CLASH(h, yb)) road.push({ level: "high", text: `流年沖到你八字的驛馬（${BRANCHES[h]}）：民間說「馬逢沖，防車禍」，今年開車騎車要特別小心。` });
      flag((h + 6) % 12, `沖到你的驛馬（${BRANCHES[h]}），民間說馬逢沖要防車禍`);
    }
    const blade = TS_BLADE[person.dayStem];
    if (blade != null) {
      if (yb === blade) road.push({ level: "high", text: `流年走到你八字的羊刃（${BRANCHES[blade]}）：主血光、開刀、意外，用刀用火、運動和交通都要小心。` });
      if (TS_CLASH(blade, yb)) road.push({ level: "high", text: `流年沖到你八字的羊刃（${BRANCHES[blade]}）：民間說「羊刃逢沖」最容易有血光意外。` });
      flag(blade, `羊刃（${BRANCHES[blade]}）當令的月份，主血光、意外`);
    }
  }
  const level = road.some((r) => r.level === "high") ? "high" : road.some((r) => r.level === "mid") ? "mid" : road.length ? "low" : "none";

  return {
    year, yearGz: STEMS[yearIndex % 10] + BRANCHES[yb], yearAnimal: ZODIAC_ANIMALS[yb], born, animal: ZODIAC_ANIMALS[born],
    relations, star, starInfo, road, level,
    months: [...watch.values()].sort((a, b) => a.start - b.start),
    allMonths: months,
  };
}

// 一整年十二生肖的總表
function taisuiTable(year) {
  return Array.from({ length: 12 }, (_, born) => {
    const r = taisuiReading(born, year, null);
    return { born, animal: r.animal, relations: r.relations, star: r.star, tone: r.starInfo.tone, road: r.level };
  });
}

// ── 頁面 ──
(() => {
  const root = document.querySelector("#ts-app");
  if (!root) return;
  const now = new Date();
  // 立春前還算前一年
  const thisYear = now.getFullYear() - (now.getMonth() < 2 && solarLongitudeAt(now.getTime()) >= 270 && solarLongitudeAt(now.getTime()) < 315 ? 1 : 0);
  const state = { year: thisYear, born: null, person: null };

  const people = loadPeople();
  const personInfo = (p) => {
    const birth = resolveBirth(p);
    const gz = ganzhiAt(birth.clock.year, birth.clock.month, birth.clock.day, birth.clock.hour, birthInstant(birth), true);
    return { name: p.name, yearBranch: BRANCHES.indexOf(gz.year[1]), dayBranch: BRANCHES.indexOf(gz.day[1]), dayStem: gz.dayStem };
  };

  const pick = root.querySelector("#ts-pick");
  const yearTabs = root.querySelector("#ts-years");
  const out = document.querySelector("#result");
  const table = document.querySelector("#ts-table");

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

  // 選人或選生肖
  const chips = [];
  const choose = (born, person, button) => {
    state.born = born;
    state.person = person;
    chips.forEach((c) => c.classList.toggle("active", c === button));
    render();
  };
  if (people.length) {
    pick.append(el("p", "hint", "選一個已儲存的人（會一併看八字的驛馬、羊刃），或直接選生肖。"));
    const row = el("div", "person-chips");
    for (const p of people) {
      try {
        const info = personInfo(p);
        const b = el("button", "person-chip", `${p.name}（${ZODIAC_ANIMALS[info.yearBranch]}）`);
        b.type = "button";
        b.addEventListener("click", () => choose(info.yearBranch, info, b));
        chips.push(b);
        row.append(b);
      } catch { /* 資料不完整就略過 */ }
    }
    pick.append(row);
  }
  const grid = el("div", "ts-animals");
  ZODIAC_ANIMALS.split("").forEach((animal, born) => {
    const b = el("button", "ts-animal", animal);
    b.type = "button";
    b.setAttribute("aria-label", `屬${animal}`);
    b.addEventListener("click", () => choose(born, null, b));
    chips.push(b);
    grid.append(b);
  });
  // 有存人的話，先幫你選第一位
  setTimeout(() => { if (state.born == null && chips[0] && people.length) chips[0].click(); });
  pick.append(grid, el("p", "hint", "生肖以立春為界（八字的算法）：一月或二月初出生、還沒過立春的人，算前一年的生肖。民間有些廟以農曆過年為界，兩者在這段期間會差一年。"));

  const levelText = { high: ["要特別注意", "bad"], mid: ["需要留意", "caution"], low: ["小心一點就好", "neutral"], none: ["沒有特別的車關", "good"] };

  function render() {
    renderTable();
    if (state.born == null) { out.hidden = true; return; }
    const r = taisuiReading(state.born, state.year, state.person);
    const who = state.person ? `${state.person.name}・屬${r.animal}` : `屬${r.animal}`;
    const verdict = r.relations.length ? `${r.relations.map((x) => `${x}太歲`).join("、")}` : "沒有犯太歲";
    const [roadLabel, roadTone] = levelText[r.level];

    const summary = el("section", "card ts-summary", [
      el("p", "meta", `${r.year} ${r.yearGz}年（${r.yearAnimal}年）・${who}`),
      el("h2", null, verdict),
      el("div", "ts-badges", [
        el("span", `tone ${r.relations.length ? (r.relations.includes("沖") || r.relations.includes("值") ? "bad" : "caution") : "good"}`, r.relations.length ? "犯太歲" : "不犯太歲"),
        el("span", `tone ${r.starInfo.tone}`, `流年星：${r.star}`),
        el("span", `tone ${roadTone}`, `車關：${roadLabel}`),
      ]),
    ]);

    const reading = el("section", "card reading-card no-fold", [
      el("h2", null, "解讀"),
      el("div", "reading-part", [el("h5", null, "一句話"), el("p", null, oneLine(r))]),
      el("div", "reading-part", [el("h5", null, "具體建議"), el("p", null, advice(r).join("\n"))]),
      r.relations.length ? el("div", "reading-part", [el("h5", null, "犯太歲"), el("p", null, r.relations.map((x) => TS_RELATION_TEXT[x]).join("\n"))]) : null,
      el("div", "reading-part", [el("h5", null, `流年星：${r.star}`), el("p", null, r.starInfo.text)]),
      el("div", "reading-part", [el("h5", null, "車關與血光"), el("p", null, r.road.length ? r.road.map((x) => x.text).join("\n") : "今年的流年星和太歲關係都沒有指向車關。照常注意交通安全就好。")]),
      el("div", "reading-part", [el("h5", null, "要留意的月份"), el("p", null, r.months.length
        ? r.months.map((m) => `${BRANCHES[m.branch]}月（約 ${tsDate(m.start)}～${tsDate(m.end)}）：${m.why.join("；")}`).join("\n")
        : "沒有特別要留意的月份。")]),
      !state.person ? el("p", "hint", "只選生肖時看的是民俗的生肖流年。選已儲存的人（到八字頁填過出生資料的人），還會加看八字的驛馬、羊刃，車關的判斷會更完整。") : null,
    ]);

    const basis = el("section", "card", [
      el("h2", null, "依據與限制"),
      el("p", null, "犯太歲用的是地支的刑、沖、害、破；流年星是傳統的「歲前十二神」，從流年地支起太歲，依序排太陽、喪門、太陰、五鬼、死符、歲破、龍德、白虎、福德、天狗、病符。驛馬、羊刃是八字神煞。各家廟宇與命理師的說法不完全一樣，有的還會加上其他神煞。"),
      el("p", null, "這些都是民俗說法，沒有證據顯示犯太歲或車關會讓意外發生。真正降低車禍風險的是：不疲勞駕駛、不滑手機、保持車距、注意天候與路況。安太歲、捐血這些做法求的是心安，可以做，但不要因此放鬆真正的安全習慣。"),
    ]);

    out.replaceChildren(summary, reading, basis);
    out.hidden = false;
  }

  function oneLine(r) {
    const parts = [];
    parts.push(r.relations.length ? `今年你${r.relations.map((x) => `${x}太歲`).join("又")}` : "今年你沒有犯太歲");
    parts.push(`流年星是${r.star}（${r.starInfo.tone === "good" ? "吉星" : r.starInfo.tone === "bad" ? "凶星" : "要留意的星"}）`);
    parts.push(r.level === "high" ? "車關要特別注意" : r.level === "mid" ? "交通安全需要留意" : r.months.some((m) => m.why.some((w) => /驛馬|羊刃/.test(w))) ? "整年沒有明顯的車關，但有幾個月要多注意交通" : "沒有明顯的車關");
    return `${parts.join("，")}。`;
  }

  function advice(r) {
    const list = [];
    if (r.relations.length) list.push("犯太歲的年份，民間習慣在農曆新年後到元宵前，到廟裡「安太歲」（點太歲燈）；重點是讓自己心安、做事收斂，大決定多想一下。");
    if (r.relations.includes("沖")) list.push("沖太歲變動大：搬家、換工作、投資這類大事，盡量選自己能掌握的時機，不要被情勢逼著倉促決定。");
    if (r.level === "high" || r.level === "mid") list.push("交通：開車不疲勞、不滑手機、多留車距；騎車戴好安全帽；長途出門前檢查車況。民間會用「捐血」化血光，就算不信，捐血本身也是好事。");
    if (["喪門", "死符", "病符"].includes(r.star)) list.push("今年多照顧身體和家中長輩，該做的健康檢查不要拖。");
    if (r.star === "五鬼") list.push("今年防小人和口舌：重要的事留書面紀錄，不借錢、不作保。");
    if (r.starInfo.tone === "good" && !r.relations.length) list.push(`今年有${r.star}吉星，是可以主動爭取機會的一年。`);
    return list.length ? list : ["今年太歲和流年星都平順，照自己的步調走就好。"];
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

  render();
})();
