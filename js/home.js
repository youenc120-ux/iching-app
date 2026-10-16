// 首頁：今日干支與農曆、今日一卦、已儲存的人的今日運勢。
// 需要 divination.js、lunar-data.js、reading.js、najia.js、birth.js、bazi.js。

(() => {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth() + 1, day = now.getDate();

  // 今日干支與農曆
  const gz = ganzhiDate(now);
  const lunar = lunarOf(year, month, day);
  const lunarDay = lunar.day <= 10 ? `初${"一二三四五六七八九十"[lunar.day - 1]}`
    : lunar.day < 20 ? `十${"一二三四五六七八九"[lunar.day - 11]}`
    : lunar.day === 20 ? "二十" : lunar.day < 30 ? `廿${"一二三四五六七八九"[lunar.day - 21]}` : "三十";
  const lunarMonth = `${lunar.leap ? "閏" : ""}${["正", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"][lunar.month - 1]}月`;
  document.querySelector("#today-date").textContent = `${year} 年 ${month} 月 ${day} 日 · 農曆${lunarMonth}${lunarDay}`;
  document.querySelector("#today-ganzhi").textContent = `${gz.year}年 ${gz.month}月 ${gz.day}日`;

  // 今日一卦：用日期算出固定的一卦一爻，同一天每個人看到的都一樣
  let seed = year * 10000 + month * 100 + day;
  seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0;
  seed = Math.imul(seed ^ (seed >>> 13), 3266489917) >>> 0;
  seed = (seed ^ (seed >>> 16)) >>> 0;
  const hex = HEXAGRAMS[seed % 64];
  const lineIndex = Math.floor(seed / 64) % 6;
  const line = hex.lines[lineIndex];
  const level = LEVELS[ratingOf(hex, lineIndex)];
  const bars = hex.bits.map((bit, i) => {
    const bar = el("span", `bar ${bit ? "yang" : "yin"}${i === lineIndex ? " moving" : ""}`);
    bar.append(el("i"), el("i"));
    return bar;
  }).reverse();
  document.querySelector("#today-hex").append(
    el("div", "daily-figure", [el("div", "lines", bars)]),
    el("div", "daily-text", [
      el("div", "row-head", [el("h3", null, `${hex.symbol} ${hex.fullName}`), el("span", `tone ${level.tier}`, level.label)]),
      el("p", "classic", `${lineTitle(lineIndex, hex.bits[lineIndex] === 1)}：${line.text}`),
      el("p", "plain", line.plain),
      el("p", "hint", `${HEX_NOTES[hex.number - 1][0]}：${HEX_NOTES[hex.number - 1][2]}`),
    ])
  );

  // 今天：農民曆的重點（宜忌、沖煞、吉時、接下來的節氣或節日）
  const today = almanacDay(year, month, day);
  const nextT = today.term ? null : nextTerm(year, month, day);
  const chips = (words, cls) => el("div", `yiji ${cls}`, words.slice(0, 5).map((w) => el("span", null, w)));
  document.querySelector("#today-card").append(
    el("div", "today-head", [
      el("div", "today-day", String(day)),
      el("div", null, [
        el("p", "today-solar", `${year} 年 ${month} 月　星期${WEEKDAYS[today.weekday]}`),
        el("p", "today-lunar", `農曆${LUNAR_MONTHS[today.lunar.month - 1]}月${lunarDayName(today.lunar.day)}　${today.gz.day}日`),
        el("p", "today-tags", [...today.festivals, today.term ? `今日${today.term}` : null, nextT ? `${nextT.days} 天後${nextT.name}` : null].filter(Boolean).join("　")),
      ]),
    ]),
    el("div", "yiji-row", [
      el("div", null, [el("h4", "yi", "宜"), chips(today.jianchu.yi, "yi")]),
      el("div", null, [el("h4", "ji", "忌"), chips(today.jianchu.ji, "ji")]),
    ]),
    el("p", "today-facts", `${today.jianchu.name}日・${today.god}${today.yellow ? "（黃道）" : "（黑道）"}　沖${today.clashAnimal}　煞${today.sha}　吉時：${today.hours.filter((h) => h.good).map((h) => h.branch).join("、")}`),
    (() => { const a = el("a", "link", "看完整農民曆 ›"); a.href = "almanac.html"; return a; })(),
  );

  // 今日塔羅：今天在塔羅頁抽過就顯示，沒有就提示去抽
  const tarotBox = document.querySelector("#today-tarot");
  let drawn = null;
  try { drawn = (JSON.parse(localStorage.getItem("tarot-daily")) || {})[`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`]; } catch { /* 沒有紀錄 */ }
  const go = el("a", "link", drawn ? "到塔羅頁看完整解讀 ›" : "去抽今天的牌 ›");
  go.href = "tarot.html";
  if (drawn && TAROT[drawn.card]) {
    const card = TAROT[drawn.card];
    const side = drawn.reversed ? card.rev : card.up;
    const img = el("img", drawn.reversed ? "reversed" : "");
    img.src = `images/${drawn.deck === "classic" ? "tarot" : "tarot-ink"}/${card.img}.jpg`;
    img.alt = card.name;
    tarotBox.append(el("h2", null, "今日塔羅"), el("div", "today-tarot-body", [
      el("div", "today-tarot-card", [img]),
      el("div", null, [el("h3", null, `${card.name}${drawn.reversed ? "（逆位）" : ""}`), el("p", "tarot-keywords", side.keywords), el("p", null, side.general), go]),
    ]));
  } else {
    tarotBox.append(el("h2", null, "今日塔羅"), el("div", "today-tarot-body", [
      el("div", "today-tarot-card empty", [el("div", "card-back")]),
      el("div", null, [el("p", null, "今天還沒抽牌。一天一張，看看今天的能量。"), go]),
    ]));
  }

  // 已儲存的人的今日運勢
  const people = loadPeople();
  const box = document.querySelector("#today-people");
  if (!people.length) {
    box.append(el("p", "hint", "到八字、紫微斗數或星盤頁填一次出生資料，這裡就會出現你個人的今日提示。"));
  } else {
    for (const person of people.slice(0, 6)) {
      try {
        const daily = baziDaily(baziChart(resolveBirth(person)), now);
        const clash = personalNote(today, personPillars(person));
        box.append(el("div", "reading-part", [
          el("h5", null, `${person.name} · ${daily.god}日`),
          el("p", null, daily.text),
          clash && clash.tone !== "neutral" ? el("p", `personal-note ${clash.tone}`, clash.text) : null,
        ]));
      } catch {
        // 這個人的資料算不出來就略過
      }
    }
    box.append(el("p", "hint", "個人提示依八字推算：今天的日干對你的日主是哪一種十神。只是一天的大致傾向。"));
  }
})();
