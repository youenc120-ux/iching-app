// 我的命盤總覽：一個人一頁，把八字、紫微、星盤、生命靈數、犯太歲的重點整理在一起，重點先說。
// 需要 birth.js、bazi.js、ziwei-texts.js、ziwei.js、astro-texts.js、astro.js、numerology.js、almanac.js、taisui.js、poster.js。

function profileOf(person) {
  const birth = resolveBirth(person);
  const bazi = baziChart(birth);
  const ziwei = ziweiChart(birth);
  const astro = astroChart({ ...birth, houses: "whole" });
  const num = numerologyChart(person.year, person.month, person.day);
  const now = new Date();
  const lon = solarLongitudeAt(now.getTime());
  const year = now.getFullYear() - (now.getMonth() < 2 && lon >= 270 && lon < 315 ? 1 : 0);
  const info = tsPersonInfo(person);
  const ts = taisuiReading(info.yearBranch, year, info);

  const first = (text) => (text.match(/^[^。]*。/) || [text])[0];
  const palace = (name) => ziwei.palaces.find((p) => p.name === name);
  const starsOf = (p) => (p.major.length ? p.major : ziwei.palaces[(p.branch + 6) % 12].major);
  const palaceLine = (name) => {
    const p = palace(name);
    const stars = starsOf(p);
    if (!stars.length) return "這個宮位沒有主星，受環境影響大。";
    return stars.map((s) => `${s.name}（${STAR_BRIEF[s.name]}）：${(name === "命宮" ? STAR_TEXTS[s.name] : STAR_IN_PALACE[s.name]?.[name]) || `帶來${STAR_BRIEF[s.name]}的色彩。`}`).join("\n");
  };
  const body = (name) => [...astro.planets, ...astro.points].find((b) => b.name === name);
  const sign = (name) => SIGNS[body(name).sign];
  const planetText = (name) => PLANET_SIGN_TEXTS[name]?.[body(name).sign] || SIGN_TRAITS[body(name).sign];
  const numText = NUM_TEXTS[num.life];
  const lifeStars = starsOf(palace("命宮")).map((s) => s.name).join("、") || "空宮";
  const monthGod = bazi.pillars[1].hidden[0].god;

  const summary = [
    `${STEMS[bazi.dayStem]}${bazi.me}日主（${bazi.strength}）`,
    `紫微命宮 ${lifeStars}`,
    `太陽${sign("太陽")}・月亮${sign("月亮")}・上升${sign("上升")}`,
    `主命數 ${num.life}（${numText.title}）`,
  ];
  const oneLine = `${first(DAY_MASTERS[bazi.dayStem])}${first(numText.core)}`;

  const sections = [
    { title: "個性", parts: [
      ["八字日主", `你的日主是${STEMS[bazi.dayStem]}${bazi.me}。${DAY_MASTERS[bazi.dayStem]}`],
      ["紫微命宮", palaceLine("命宮")],
      ["星盤三要素", `太陽${sign("太陽")}：${ROLE_TEXTS.太陽}。${planetText("太陽")}\n月亮${sign("月亮")}：${ROLE_TEXTS.月亮}。${planetText("月亮")}\n上升${sign("上升")}：${ROLE_TEXTS.上升}。${planetText("上升")}`],
      ["生命靈數", `主命數 ${num.life}・${numText.title}：${numText.core}\n優點：${numText.good}\n課題：${numText.lesson}`],
    ] },
    { title: "感情", parts: [
      ["紫微夫妻宮", palaceLine("夫妻")],
      ["金星", `金星${sign("金星")}：${planetText("金星")}`],
    ] },
    { title: "事業與財運", parts: [
      ["八字格局", `${bazi.pattern}：${(TEN_GOD_TEXTS[monthGod] || "").split("：")[1] || ""}${bazi.favorable.length ? `\n喜用五行是${bazi.favorable.join("、")}，行到這些五行的年份比較順。` : ""}`],
      ["紫微官祿宮", palaceLine("官祿")],
      ["紫微財帛宮", palaceLine("財帛")],
    ] },
    { title: `${year} 今年`, parts: [
      ["犯太歲・車關", `${ts.relations.length ? ts.relations.map((x) => `${x}太歲`).join("、") : "不犯太歲"}，流年星${ts.star}。${ts.starInfo.text}${ts.road.length ? `\n${ts.road.map((r) => r.text).join("\n")}` : ""}`],
      ["生命靈數流年", `流年數 ${num.yearNum}：${YEAR_TEXTS[num.yearNum][0]}。${YEAR_TEXTS[num.yearNum][1]}`],
      ["比較順的月份", ts.months.filter((m) => m.grade === "good").map((m) => m.name).join("、") || "今年沒有特別突出的好月，平穩走就好。"],
      ["要小心的月份", ts.months.filter((m) => m.grade === "bad" || m.car).map((m) => `${m.name}（${m.notes.filter((n) => n.tone === "bad").map((n) => n.tag).join("、") || "交通"}）`).join("、") || "沒有特別要小心的月份。"],
    ] },
  ];
  return { person, birth, bazi, ziwei, astro, num, ts, year, summary, oneLine, sections };
}

function profilePoster(p) {
  const { canvas, ctx, colors } = createPoster("bazi", `${p.person.name}的命盤總覽`);
  ctx.textAlign = "left";
  let y = 190;
  posterPanel(ctx, colors, 90, y - 50, 900, 300);
  ctx.fillStyle = colors.accent;
  ctx.font = `700 38px ${POSTER_SERIF}`;
  y = posterWrap(ctx, p.summary.slice(0, 2).join("　"), 130, y + 10, 820, 56, 2);
  y = posterWrap(ctx, p.summary.slice(2).join("　"), 130, y, 820, 56, 2);
  ctx.fillStyle = colors.ink;
  ctx.font = `30px ${POSTER_SANS}`;
  y = posterWrap(ctx, p.oneLine, 130, y + 20, 820, 46, 3) + 50;
  for (const section of p.sections.slice(0, 3)) {
    ctx.fillStyle = colors.accent;
    ctx.font = `700 32px ${POSTER_SERIF}`;
    ctx.fillText(section.title, 110, y);
    ctx.fillStyle = colors.ink;
    ctx.font = `26px ${POSTER_SANS}`;
    y = posterWrap(ctx, section.parts.map(([, text]) => text.split("\n")[0]).join(" "), 110, y + 46, 860, 40, 4) + 34;
    if (y > 1180) break;
  }
  return canvas;
}

(() => {
  const root = document.querySelector("#profile-app");
  if (!root) return;
  const people = loadPeople();
  const out = document.querySelector("#result");
  if (!people.length) {
    root.append(el("p", null, "還沒有儲存任何人。先到八字、紫微或星盤頁填一次出生資料，這裡就會出現完整的命盤總覽。"),
      Object.assign(el("a", "link", "去填出生資料 ›"), { href: "bazi.html" }));
    return;
  }
  const chips = el("div", "person-chips");
  root.append(el("p", "hint", "選一個人："), chips);
  const buttons = people.map((p) => {
    const b = el("button", "person-chip", p.name);
    b.type = "button";
    b.addEventListener("click", () => {
      buttons.forEach((x) => x.classList.toggle("active", x === b));
      render(p);
    });
    chips.append(b);
    return b;
  });

  function render(person) {
    let p;
    try { p = profileOf(person); } catch (err) {
      out.replaceChildren(el("section", "card", [el("p", null, "這個人的出生資料不完整，算不出命盤。請到八字頁修改資料。")]));
      out.hidden = false;
      return;
    }
    const head = el("section", "card profile-head", [
      el("p", "meta", `${p.person.year}/${p.person.month}/${p.person.day} ${String(p.person.hour).padStart(2, "0")}:${String(p.person.minute).padStart(2, "0")}・${p.person.gender === "female" ? "女" : "男"}`),
      el("h2", null, `${p.person.name}的命盤總覽`),
      el("div", "profile-tags", p.summary.map((s) => el("span", "tone good", s))),
      el("p", "profile-line", p.oneLine),
      el("div", "actions", [posterButton(() => profilePoster(p), `觀象-命盤總覽-${p.person.name}.png`)]),
    ]);
    const cards = p.sections.map((section) => el("section", "card reading-card no-fold", [
      el("h2", null, section.title),
      ...section.parts.map(([title, text]) => el("div", "reading-part", [el("h5", null, title), el("p", null, text)])),
    ]));
    const links = el("section", "card", [
      el("h2", null, "看完整的盤"),
      el("div", "profile-links", [["bazi.html", "八字"], ["ziwei.html", "紫微斗數"], ["astro.html", "星盤"], ["numerology.html", "生命靈數"], ["taisui.html", "犯太歲・每月運勢"], ["compat.html", "和別人合盤"]].map(([href, text]) => Object.assign(el("a", "ask-route", [el("b", null, text)]), { href }))),
      el("p", "hint", "這頁是各種方法的重點整理，每種方法的依據寫在「依據與來源」。不同方法看的角度不同，說法偶爾會不一樣，那正好是你個性裡不同的面向。"),
    ]);
    out.replaceChildren(head, ...cards, links);
    out.hidden = false;
  }
  buttons[0].click();
})();
