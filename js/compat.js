// 合盤：選兩個已儲存的人，用八字（日干、日支、生肖、五行互補）和星盤（太陽、月亮、金星、火星、上升的相位）看兩人的互動。
// 需要 bazi.js、astro.js、birth.js、poster.js。

const SIX_HARMONY = [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]]; // 地支六合：子丑、寅亥、卯戌、辰酉、巳申、午未
const ZODIAC = "鼠牛虎兔龍蛇馬羊猴雞狗豬";

// 兩個地支的關係：六合、三合、六沖，或沒有
function branchRelation(a, b) {
  if (SIX_HARMONY.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) return "六合";
  if (a !== b && a % 4 === b % 4) return "三合";
  if ((a + 6) % 12 === b) return "六沖";
  return "";
}

// 八字合盤：回傳 { score, items: [{ title, text, delta }] }
function compatBazi(a, b) {
  const items = [];
  const add = (title, text, delta) => items.push({ title, text, delta });
  const A = a.birth.name, B = b.birth.name;

  // 日干：代表兩個人本身
  const sa = a.chart.dayStem, sb = b.chart.dayStem;
  const ea = STEM_ELEMENTS[sa], eb = STEM_ELEMENTS[sb];
  const label = `${A}是${STEMS[sa]}${ea}，${B}是${STEMS[sb]}${eb}`;
  if (Math.abs(sa - sb) === 5) add("日干相合", `${label}，兩個日干正好是天干五合。這是八字合盤裡最強的吸引力，彼此天生有默契、容易被對方吸引。`, 20);
  else if (ea === eb) add("日干同類", `${label}，五行相同。像朋友和同伴，想法接近、容易互相理解，但也容易互不相讓，兩個人都想當主導的那個。`, 8);
  else if (GENERATES[ea] === eb) add("日干相生", `${label}，${ea}生${eb}：${A}是付出、照顧的一方，${B}是被滋養的一方。關係順，但要留意${A}會不會付出到覺得累。`, 12);
  else if (GENERATES[eb] === ea) add("日干相生", `${label}，${eb}生${ea}：${B}是付出、照顧的一方，${A}是被滋養的一方。關係順，但要留意${B}會不會付出到覺得累。`, 12);
  else if (controls(ea, eb)) add("日干相剋", `${label}，${ea}剋${eb}：${A}會想管${B}、對${B}有要求，${B}會感到壓力。處得好是一個帶一個，處不好就是控制與反抗。`, -8);
  else add("日干相剋", `${label}，${eb}剋${ea}：${B}會想管${A}、對${A}有要求，${A}會感到壓力。處得好是一個帶一個，處不好就是控制與反抗。`, -8);

  // 日支：夫妻宮，代表親密相處的方式
  const da = a.chart.pillars[2].branch, db = b.chart.pillars[2].branch;
  const day = branchRelation(da, db);
  const dayLabel = `日支${BRANCHES[da]}與${BRANCHES[db]}`;
  if (day === "六合") add("日支六合", `${dayLabel}六合。日支是夫妻宮，兩人的夫妻宮相合，生活在一起很合拍，是長久相處的好條件。`, 20);
  else if (day === "三合") add("日支三合", `${dayLabel}同屬一個三合局。生活步調和價值觀接近，相處起來不費力。`, 12);
  else if (day === "六沖") add("日支六沖", `${dayLabel}六沖。夫妻宮對沖，生活習慣和想要的東西正好相反，住在一起摩擦多、聚少離多。不是不能在一起，但需要比別人多很多的磨合。`, -18);
  else if (da === db) add("日支相同", `兩人日支都是${BRANCHES[da]}。內在的需求很像，能懂對方，但缺點也一樣，容易一起陷進同一種情緒。`, 4);
  else add("日支", `${dayLabel}沒有明顯的合或沖，相處上沒有特別的助力，也沒有特別的衝突。`, 0);

  // 年支：生肖，代表家庭背景與長輩那一層
  const ya = a.chart.pillars[0].branch, yb = b.chart.pillars[0].branch;
  const year = branchRelation(ya, yb);
  const zodiac = `${A}屬${ZODIAC[ya]}，${B}屬${ZODIAC[yb]}`;
  if (year === "六合" || year === "三合") add("生肖相合", `${zodiac}，${year}。兩邊的家庭背景和觀念比較接得上，長輩那一關相對好過。`, 8);
  else if (year === "六沖") add("生肖相沖", `${zodiac}，六沖。兩邊的家庭背景或成長環境差異大，容易在家人、習俗這類事情上起衝突。`, -8);

  // 五行互補：對方最旺的五行是不是自己需要的
  const strongest = (chart) => Object.entries(chart.weights).sort((x, y) => y[1] - x[1])[0][0];
  for (const [me, other, meName, otherName] of [[a, b, A, B], [b, a, B, A]]) {
    const element = strongest(other.chart);
    if (me.chart.favorable.includes(element)) add("五行互補", `${otherName}的八字裡${element}最旺，正好是${meName}喜用的五行。和${otherName}在一起，對${meName}是加分的。`, 10);
    else if (me.chart.favorable.length) add("五行不補", `${otherName}的八字裡${element}最旺，不是${meName}喜用的五行。${otherName}帶給${meName}的多半是消耗或壓力，而不是補助。`, -5);
  }

  const score = Math.max(15, Math.min(98, 60 + items.reduce((sum, item) => sum + item.delta, 0)));
  return { score, items };
}

// 星盤合盤：看兩人幾個關鍵星體之間的相位
const SYNASTRY_PAIRS = [
  ["太陽", "月亮", 3, "一個人的本性對上另一個人的情感需求，這是感情合盤最重要的一組"],
  ["月亮", "太陽", 3, "一個人的情感需求對上另一個人的本性，這是感情合盤最重要的一組"],
  ["金星", "火星", 3, "愛的方式對上慾望與行動，決定兩人之間的吸引力"],
  ["火星", "金星", 3, "慾望與行動對上愛的方式，決定兩人之間的吸引力"],
  ["月亮", "月亮", 2, "兩人的情緒節奏與生活習慣"],
  ["太陽", "太陽", 2, "兩人的人生方向與自我"],
  ["金星", "金星", 1, "兩人的喜好與價值觀"],
  ["上升", "太陽", 1, "第一印象與相處的自在程度"],
  ["太陽", "上升", 1, "第一印象與相處的自在程度"],
  ["上升", "月亮", 1, "在對方面前能不能放鬆"],
  ["月亮", "上升", 1, "在對方面前能不能放鬆"],
];

function compatAstro(a, b) {
  const find = (chart, name) => [...chart.planets, ...chart.points].find((body) => body.name === name);
  const items = [];
  let total = 0;
  for (const [nameA, nameB, weight, meaning] of SYNASTRY_PAIRS) {
    const bodyA = find(a.astro, nameA), bodyB = find(b.astro, nameB);
    const angle = Math.abs(((bodyA.lon - bodyB.lon + 540) % 360) - 180);
    for (const [aspect, exact, , nature] of ASPECTS) {
      const orb = Math.abs(angle - exact);
      if (orb > 6) continue;
      const delta = (nature === "和諧" ? 5 : nature === "融合" ? 6 : aspect === "對分相" ? 1 : -4) * weight;
      const feel = nature === "和諧" ? "配合順暢，不用刻意經營就合得來"
        : nature === "融合" ? "強烈地綁在一起，感受很深，好壞都被放大"
        : aspect === "對分相" ? "互相吸引又互相拉扯，像照鏡子，對方有你缺的東西"
        : "容易卡住、起摩擦，各有各的做法，需要磨合";
      total += delta;
      items.push({ title: `${a.birth.name}的${nameA}${aspect}${b.birth.name}的${nameB}`, text: `${meaning}：${feel}。（誤差 ${orb.toFixed(1)}°）`, delta, weight });
    }
  }
  // 太陽星座的元素：同元素或相生的元素比較合拍
  const sunA = find(a.astro, "太陽").sign, sunB = find(b.astro, "太陽").sign;
  const elementA = sunA % 4, elementB = sunB % 4;
  const friendly = elementA === elementB || (elementA + elementB) % 2 === 0; // 火與風、土與水相合
  items.push({
    title: `太陽${SIGNS[sunA]}與太陽${SIGNS[sunB]}`,
    text: friendly ? `${SIGN_ELEMENTS[elementA]}象與${SIGN_ELEMENTS[elementB]}象合拍，基本個性處得來。` : `${SIGN_ELEMENTS[elementA]}象與${SIGN_ELEMENTS[elementB]}象性質不同，看事情的角度和節奏差很多，要多花力氣理解對方。`,
    delta: friendly ? 6 : -4, weight: 0,
  });
  total += friendly ? 6 : -4;
  items.sort((x, y) => y.weight - x.weight || Math.abs(y.delta) - Math.abs(x.delta));
  // 相位多的時候加分會累積得很快，所以打六折，免得動不動就接近滿分
  return { score: Math.round(Math.max(15, Math.min(98, 58 + total * 0.6))), items };
}

function compatVerdict(score) {
  if (score >= 85) return "非常合。先天條件很好，相處起來順，該珍惜。但再合的盤也需要經營，不是放著就會好。";
  if (score >= 72) return "合得來。有明顯的吸引力和默契，也有幾個需要磨合的地方，整體是加分的關係。";
  if (score >= 58) return "普通。有合的地方也有不合的地方，能不能走下去看兩個人願意為對方調整多少。";
  if (score >= 45) return "偏不合。先天的摩擦點多於助力，相處會比別人辛苦，需要很清楚自己為什麼要在一起。";
  return "不合。命盤上的衝突很明顯，在一起會互相消耗。這不代表不可能，但要有心理準備，這段關係會很費力。";
}

function compatPoster(a, b, overall, bazi, astro) {
  const { canvas, ctx, colors } = createPoster("compat", "合盤");
  ctx.fillStyle = colors.ink;
  ctx.font = `700 56px ${POSTER_SERIF}`;
  ctx.fillText(`${a.birth.name} × ${b.birth.name}`, 540, 230);
  ctx.fillStyle = colors.accent;
  ctx.font = `700 190px ${POSTER_SERIF}`;
  ctx.fillText(String(overall), 540, 470);
  ctx.fillStyle = colors.muted;
  ctx.font = `30px ${POSTER_SANS}`;
  ctx.fillText(`八字 ${bazi.score} 分　星盤 ${astro.score} 分`, 540, 540);
  posterPanel(ctx, colors, 96, 600, 888, 600);
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink;
  ctx.font = `34px ${POSTER_SANS}`;
  let y = posterWrap(ctx, compatVerdict(overall), 136, 670, 808, 54, 4);
  ctx.font = `28px ${POSTER_SANS}`;
  ctx.fillStyle = colors.muted;
  for (const item of [...bazi.items.slice(0, 3), ...astro.items.slice(0, 3)]) {
    if (y > 1150) break;
    y = posterWrap(ctx, `${item.delta >= 0 ? "＋" : "－"} ${item.title}`, 136, y + 14, 808, 44, 1);
  }
  return canvas;
}

function renderCompat() {
  const root = document.querySelector("#result");
  const people = loadPeople();
  const selects = [document.querySelector("#person-a"), document.querySelector("#person-b")];
  const previous = selects.map((select) => select.value);
  selects.forEach((select, i) => {
    select.replaceChildren(...people.map((person) => Object.assign(el("option", null, person.name), { value: person.id })));
    select.value = people.some((p) => p.id === previous[i]) ? previous[i] : (people[i] || people[0] || {}).id || "";
  });
  root.replaceChildren();
  if (people.length < 2) {
    root.append(el("section", "card", [el("p", null, "合盤需要兩個人的出生資料。請在下方「新增或修改人物」各存一筆，再回到上面選擇。")]));
    root.hidden = false;
    return;
  }
  const [a, b] = selects.map((select) => {
    const birth = resolveBirth(people.find((person) => person.id === select.value));
    return { birth, chart: baziChart(birth), astro: astroChart(birth) };
  });
  if (a.birth.id === b.birth.id) {
    root.append(el("section", "card", [el("p", null, "請選兩個不同的人。")]));
    root.hidden = false;
    return;
  }

  const bazi = compatBazi(a, b);
  const astro = compatAstro(a, b);
  const ziwei = compatZiwei(a, b);
  const overall = Math.round((bazi.score + astro.score + ziwei.score) / 3);
  const tier = overall >= 72 ? "good" : overall >= 58 ? "neutral" : overall >= 45 ? "caution" : "bad";

  root.append(el("section", "card", [
    el("div", "compat-score", [
      el("div", "compat-number", String(overall)),
      el("div", null, [
        el("h2", null, `${a.birth.name} × ${b.birth.name}`),
        el("p", "meta", `八字 ${bazi.score} 分 · 紫微 ${ziwei.score} 分 · 星盤 ${astro.score} 分`),
        el("span", `tone ${tier}`, overall >= 85 ? "非常合" : overall >= 72 ? "合得來" : overall >= 58 ? "普通" : overall >= 45 ? "偏不合" : "不合"),
      ]),
    ]),
    el("div", "guide", [el("h4", null, "直說"), el("p", null, compatVerdict(overall))]),
    el("div", "actions summary-actions", [posterButton(() => compatPoster(a, b, overall, bazi, astro), `觀象-合盤-${a.birth.name}-${b.birth.name}.png`)]),
  ]));

  const section = (title, result) => el("section", "card reading-card", [
    el("h2", null, `${title}（${result.score} 分）`),
    ...result.items.map((item) => el("div", "reading-part", [
      el("h5", item.delta > 0 ? "plus" : item.delta < 0 ? "minus" : "", `${item.delta > 0 ? "＋" : item.delta < 0 ? "－" : "・"} ${item.title}`),
      el("p", null, item.text),
    ])),
  ]);
  root.append(section("八字合盤", bazi), section("紫微合盤", ziwei), section("星盤合盤", astro));
  root.append(el("p", "hint", "分數只是把上面列出的加分項和扣分項加總，方便一眼比較，不是精密的量測。八字只看了日干、日支、年支與五行；紫微只看了夫妻宮與命宮的對照、生年化祿化忌的位置；星盤只看了太陽、月亮、金星、火星、上升之間的相位。兩個人合不合，最終還是看實際相處。"));
  root.hidden = false;
}

// 紫微合盤：一個人的夫妻宮描述他會被什麼樣的人吸引；對方的命宮主星若正好是這些星，就是「心中理想的對象」。
// 另外看生年化祿、化忌的星是不是在對方的命宮：祿是天生的好感與付出，忌是執著、虧欠與糾纏。
function compatZiwei(a, b) {
  const items = [];
  const add = (title, text, delta) => items.push({ title, text, delta });
  const charts = [a, b].map((p) => ziweiChart(p.birth));
  const majorsOf = (chart, name) => {
    const palace = chart.palaces.find((p) => p.name === name);
    return (palace.major.length ? palace.major : chart.palaces[mod12(palace.branch + 6)].major).map((s) => s.name);
  };
  [[0, 1], [1, 0]].forEach(([x, y]) => {
    const X = [a, b][x].birth.name, Y = [a, b][y].birth.name;
    const spouse = majorsOf(charts[x], "夫妻"), life = majorsOf(charts[y], "命宮");
    const common = spouse.filter((s) => life.includes(s));
    const want = spouse.map((s) => STAR_IN_PALACE[s]?.夫妻).filter(Boolean)[0] || "";
    if (common.length) add(`${Y}符合${X}的夫妻宮`, `${X}的夫妻宮是${spouse.join("、")}，${Y}的命宮主星正好有${common.join("、")}。也就是說，${Y}本人很像${X}命中會被吸引、會遇到的那種對象。${want}`, 15);
    else add(`${X}的夫妻宮`, `${X}的夫妻宮是${spouse.join("、") || "空宮"}（${want}）；${Y}的命宮是${life.join("、") || "空宮"}，不是${X}夫妻宮描述的典型對象，相處上需要多一點磨合。`, -3);
    const lifePalace = charts[y].palaces.find((p) => p.name === "命宮");
    const lifeStars = [...lifePalace.major, ...lifePalace.minor].map((s) => s.name);
    for (const t of charts[x].transforms.filter(Boolean)) {
      if (!lifeStars.includes(t.star)) continue;
      if (t.type === "祿") add(`${X}的化祿星在${Y}的命宮`, `${X}生年化祿的${t.star}，正好坐在${Y}的命宮：${X}對${Y}有天生的好感，願意付出，和${Y}在一起覺得有收穫。`, 10);
      if (t.type === "忌") add(`${X}的化忌星在${Y}的命宮`, `${X}生年化忌的${t.star}，正好坐在${Y}的命宮：${X}對${Y}有放不下的執著，可能是很深的緣分，也可能是虧欠與糾纏，吵架時特別容易鑽牛角尖。`, -8);
    }
  });
  const total = items.reduce((s, i) => s + i.delta, 0);
  return { score: Math.max(20, Math.min(98, 60 + total)), items };
}

if (typeof document !== "undefined" && document.querySelector("#person-a")) {
  document.querySelector("#person-a").addEventListener("change", renderCompat);
  document.querySelector("#person-b").addEventListener("change", renderCompat);
  birthForm(document.querySelector("#birth-form"), { button: "儲存這個人", auto: false, onDelete: renderCompat }, renderCompat);
  renderCompat();
}
