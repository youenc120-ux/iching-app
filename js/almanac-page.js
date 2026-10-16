// 農民曆頁面：當日詳情、個人沖合、月曆、擇日。計算在 almanac.js。

const $ = (selector) => document.querySelector(selector);

const isoOf = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

let current = (() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() }; })();
let monthView = { y: current.y, m: current.m };
let personId = null;

function people() {
  try { return loadPeople(); } catch { return []; }
}
function selectedPerson() {
  const p = people().find((x) => x.id === personId);
  try { return p ? personPillars(p) : null; } catch { return null; }
}

function shift(days) {
  const t = new Date(Date.UTC(current.y, current.m - 1, current.d + days));
  setDay(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

function setDay(y, m, d) {
  current = { y, m, d };
  if (monthView.y !== y || monthView.m !== m) monthView = { y, m };
  render();
}

function chipList(words, cls) {
  return el("div", `yiji ${cls}`, words.map((w) => el("span", null, w)));
}

function renderDay() {
  const a = almanacDay(current.y, current.m, current.d);
  $("#date").value = isoOf(a.y, a.m, a.d);
  const lunarText = `${a.gz.year[0]}${a.gz.year[1]}年（${a.yearAnimal}）${a.lunar.leap ? "閏" : ""}${LUNAR_MONTHS[a.lunar.month - 1]}月${lunarDayName(a.lunar.day)}`;
  const next = a.term ? null : nextTerm(a.y, a.m, a.d);
  const tags = [...a.festivals.map((f) => el("span", "tag fest", f)), a.term ? el("span", "tag term", `今日${a.term}`) : null,
    next ? el("span", "tag", `${next.days} 天後${next.name}（${next.date}）`) : null];
  const hours = el("div", "hours", a.hours.map((h) => el("div", `hour${h.good ? " good" : ""}${h.broken ? " broken" : ""}`, [
    el("b", null, `${h.branch}時`), el("span", null, h.range), el("span", "hour-god", h.good ? "吉" : h.broken ? "日破" : YELLOW_PATH.has(h.god) ? "平" : "凶"), el("small", null, `沖${h.clash}`),
  ])));
  const body = el("div", "day-body", [
    el("div", "day-big", [
      el("div", "solar", [el("span", "solar-day", String(a.d)), el("span", null, `${a.y} 年 ${a.m} 月　星期${WEEKDAYS[a.weekday]}`)]),
      el("div", "lunar", [el("span", "lunar-date", `農曆${LUNAR_MONTHS[a.lunar.month - 1]}月${lunarDayName(a.lunar.day)}`), el("span", null, lunarText)]),
    ]),
    el("div", "tags", tags),
    el("dl", "facts", [
      el("dt", null, "干支"), el("dd", null, `${a.gz.year}年　${a.gz.month}月　${a.gz.day}日`),
      el("dt", null, "建除"), el("dd", null, `${a.jianchu.name}日：${a.jianchu.note}`),
      el("dt", null, "值神"), el("dd", a.yellow ? "good-text" : "", `${a.god}（${a.yellow ? "黃道吉日" : "黑道日"}）`),
      el("dt", null, "沖煞"), el("dd", null, `沖${a.clashAnimal}（${a.clashPillar}）　煞${a.sha}`),
      el("dt", null, "彭祖百忌"), el("dd", null, a.pengzu.join("；")),
    ]),
    el("div", "yiji-row", [el("div", null, [el("h4", "yi", "宜"), chipList(a.jianchu.yi, "yi")]), el("div", null, [el("h4", "ji", "忌"), chipList(a.jianchu.ji, "ji")])]),
    el("h4", "hours-title", "時辰吉凶"),
    hours,
  ]);
  $("#day-body").replaceChildren(body);
  return a;
}

function renderPersonal(a) {
  const list = people();
  if (personId && !list.some((p) => p.id === personId)) personId = null;
  if (!personId && list.length) personId = (typeof currentPerson === "function" && currentPerson()?.id) || list[0].id;
  $("#people").replaceChildren(...list.map((p) => {
    const b = el("button", p.id === personId ? "active" : "", p.name || "未命名");
    b.type = "button";
    b.addEventListener("click", () => { personId = p.id; render(); });
    return b;
  }));
  const note = list.length ? personalNote(a, selectedPerson()) : null;
  const box = $("#personal-note");
  box.className = `personal-note ${note ? note.tone : ""}`;
  box.replaceChildren(note ? note.text : "", ...(list.length ? [] : [
    "在八字、紫微或星盤頁存過生日的人，會出現在這裡，看今天有沒有沖到你。",
    el("a", null, "去輸入生日"),
  ]));
  const link = box.querySelector("a");
  if (link) { link.href = "bazi.html"; link.style.marginLeft = "6px"; }
}

function renderMonth() {
  const { y, m } = monthView;
  $("#month-title").textContent = `${y} 年 ${m} 月`;
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = new Date();
  const cells = ["日", "一", "二", "三", "四", "五", "六"].map((w) => el("span", "cal-week", w));
  for (let i = 0; i < first; i++) cells.push(el("span"));
  for (let d = 1; d <= days; d++) {
    const a = almanacDay(y, m, d);
    const isToday = today.getFullYear() === y && today.getMonth() + 1 === m && today.getDate() === d;
    const label = a.festivals[0] || a.term || (a.lunar.day === 1 ? `${LUNAR_MONTHS[a.lunar.month - 1]}月` : lunarDayName(a.lunar.day));
    const cell = el("button", `mday${a.yellow ? " yellow" : ""}${isToday ? " today" : ""}${current.y === y && current.m === m && current.d === d ? " selected" : ""}${a.festivals.length || a.term ? " special" : ""}`, [
      el("span", "mday-n", String(d)), el("span", "mday-l", label), el("span", "mday-j", a.jianchu.name),
    ]);
    cell.type = "button";
    cell.addEventListener("click", () => { setDay(y, m, d); $("#day").scrollIntoView({ behavior: "smooth", block: "start" }); });
    cells.push(cell);
  }
  $("#month-grid").replaceChildren(...cells);
}

function renderPickForm() {
  if (!$("#pick-event").options.length) {
    $("#pick-event").append(...EVENTS.map(([key, label]) => { const o = el("option", null, label); o.value = key; return o; }));
  }
  const sel = $("#pick-person");
  const keep = sel.value;
  sel.replaceChildren(el("option", null, "不指定"), ...people().map((p) => { const o = el("option", null, p.name || "未命名"); o.value = p.id; return o; }));
  sel.firstChild.value = "";
  sel.value = keep && people().some((p) => p.id === keep) ? keep : (personId || "");
}

function runPick() {
  const event = $("#pick-event").value;
  const range = Number($("#pick-range").value);
  const pid = $("#pick-person").value;
  const p = pid ? people().find((x) => x.id === pid) : null;
  const person = p ? personPillars(p) : null;
  const results = pickDays(event, new Date(), range, person);
  const label = EVENTS.find((e) => e[0] === event)[1];
  const list = $("#pick-list");
  if (!results.length) {
    list.replaceChildren(el("li", "hint", `未來 ${range} 天內找不到適合「${label}」的日子，試著把範圍拉長。`));
    return;
  }
  list.replaceChildren(...results.map(({ day, score, reasons }) => {
    const stars = score >= 7 ? "★★★" : score >= 5 ? "★★" : "★";
    const b = el("button", "pick-item", [
      el("span", "pick-date", `${day.m}/${day.d}（${WEEKDAYS[day.weekday]}）`),
      el("span", "pick-stars", stars),
      el("span", "pick-lunar", `農曆${LUNAR_MONTHS[day.lunar.month - 1]}月${lunarDayName(day.lunar.day)}　${day.gz.day}日　${day.jianchu.name}日`),
      el("span", "pick-why", reasons.join("、")),
      el("span", "pick-hours", `吉時：${day.hours.filter((h) => h.good).map((h) => h.branch).join("、")}`),
    ]);
    b.type = "button";
    b.addEventListener("click", () => { setDay(day.y, day.m, day.d); $("#day").scrollIntoView({ behavior: "smooth", block: "start" }); });
    return el("li", null, [b]);
  }));
}

function render() {
  const a = renderDay();
  renderPersonal(a);
  renderMonth();
  renderPickForm();
}

$("#prev-day").addEventListener("click", () => shift(-1));
$("#next-day").addEventListener("click", () => shift(1));
$("#today").addEventListener("click", () => { const t = new Date(); setDay(t.getFullYear(), t.getMonth() + 1, t.getDate()); });
$("#date").addEventListener("change", (e) => {
  const [y, m, d] = e.target.value.split("-").map(Number);
  if (y >= 1900 && y <= 2100) setDay(y, m, d);
});
$("#month-prev").addEventListener("click", () => { const t = new Date(Date.UTC(monthView.y, monthView.m - 2, 1)); monthView = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 }; renderMonth(); });
$("#month-next").addEventListener("click", () => { const t = new Date(Date.UTC(monthView.y, monthView.m, 1)); monthView = { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 }; renderMonth(); });
$("#pick-go").addEventListener("click", runPick);
render();
