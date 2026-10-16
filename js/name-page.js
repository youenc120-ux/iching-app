// 姓名學頁面：輸入姓名 → 每個字的康熙筆劃（可手動修正）→ 五格、八十一數理、三才 → 綜合評分；可比較多個名字。

const $ = (selector) => document.querySelector(selector);
function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (Array.isArray(content)) node.append(...content.filter(Boolean));
  else if (content != null) node.textContent = content;
  return node;
}

const overrides = {};
const compared = [];
const LEVEL_WORDS = { 5: "很好", 4: "好", 3: "普通", 2: "偏弱", 1: "不理想" };
const TIER = { 大吉: "good", 吉: "good", 半吉: "neutral", 凶: "caution", 大凶: "bad" };

function analyse() {
  const raw = $("#fullname").value.trim();
  if (!raw) return;
  // 有空格時，空格前是姓、空格後是名
  const parts = raw.split(/s+/);
  const split = parts.length === 2 ? parts : null;
  render(nameReading(raw.replace(/s/g, ""), overrides, split), raw.replace(/s/g, ""));
}

function strokeEditor(reading) {
  return el("div", "stroke-chars", reading.chars.map((ch, i) => {
    const input = el("input");
    input.type = "number";
    input.min = 1;
    input.max = 40;
    input.value = reading.strokes ? reading.strokes[i] ?? "" : (overrides[ch] ?? NAME_STROKES[ch] ?? "");
    input.setAttribute("aria-label", `${ch}的筆劃`);
    input.addEventListener("change", () => {
      const n = Number(input.value);
      if (n >= 1 && n <= 40) { overrides[ch] = n; analyse(); }
    });
    return el("label", `stroke-char${i < reading.surname.length ? " surname" : ""}`, [el("span", "stroke-glyph", ch), input, el("small", null, "劃")]);
  }));
}

function render(reading, label) {
  const root = $("#result");
  root.hidden = false;
  if (!reading) { root.replaceChildren(el("section", "card", [el("p", null, "請輸入完整的姓名（姓加名）。")])); return; }
  if (reading.unknown.length) {
    root.replaceChildren(el("section", "card", [
      el("p", null, `查不到「${reading.unknown.join("、")}」的筆劃（可能是罕用字或簡體字）。請在下面手動填入康熙筆劃。`),
      strokeEditor(reading),
    ]));
    return;
  }
  const verdict = el("div", "name-verdict", [
    el("span", `tone ${TIER[reading.level >= 4 ? "吉" : reading.level === 3 ? "半吉" : "凶"]}`, `綜合 ${LEVEL_WORDS[reading.level]}`),
    el("p", null, reading.level >= 4 ? "主要的人格、總格都在吉數，整體是好名字。"
      : reading.level === 3 ? "有好有壞，沒有大問題，也不算特別好。"
      : "重要的格局落在凶數，依姓名學的看法不理想；但名字只是參考，不必因此改名。"),
  ]);
  const grids = el("div", "grids", reading.entries.map((e) => el("div", `grid-cell g-${e.name}`, [
    el("div", "grid-head", [el("b", null, e.name), el("small", null, e.role[0])]),
    el("div", "grid-n", String(e.n)),
    el("span", `tone ${TIER[e.fortune[0]]}`, e.fortune[0]),
    el("p", "grid-meaning", e.fortune[1]),
    el("small", "grid-el", `五行屬${e.element}`),
  ])));
  const roles = el("dl", "grid-roles", reading.entries.flatMap((e) => [el("dt", null, `${e.name}（${e.role[0]}）`), el("dd", null, e.role[1])]));
  const [t, r, d] = reading.talents.elements;
  const talentCard = el("div", "reading-part", [
    el("h5", null, `三才配置：${t}・${r}・${d}（${reading.talents.verdict}）`),
    el("p", null, reading.talents.text.join("\n")),
  ]);
  const card = el("section", "card name-card", [
    el("h2", null, label),
    strokeEditor(reading),
    el("p", "hint", "數字是康熙筆劃，可以直接修改（例如家裡習慣的算法不同）。"),
    verdict,
    grids,
    el("div", "reading", [talentCard, el("div", "reading-part", [el("h5", null, "五格各管什麼"), roles])]),
    el("div", "actions", [
      (() => { const b = el("button", null, "加入比較"); b.type = "button"; b.addEventListener("click", () => addCompare(reading, label)); return b; })(),
      posterButton(() => namePoster(reading, label), `觀象-姓名-${label}.png`),
    ]),
  ]);
  root.replaceChildren(card);
}

function addCompare(reading, label) {
  if (compared.some((c) => c.label === label)) return;
  compared.push({ label, reading });
  renderCompare();
}

function renderCompare() {
  const box = $("#compare");
  if (!compared.length) { box.replaceChildren(); return; }
  const head = ["名字", "人格", "地格", "外格", "總格", "三才", "綜合"];
  const rows = compared.map(({ label, reading }) => [label, ...["人格", "地格", "外格", "總格"].map((n) => {
    const e = reading.entries.find((x) => x.name === n);
    return `${e.n} ${e.fortune[0]}`;
  }), reading.talents.verdict, LEVEL_WORDS[reading.level]]);
  const table = el("table", "compare-table", [
    el("thead", null, [el("tr", null, head.map((h) => el("th", null, h)))]),
    el("tbody", null, rows.map((r) => el("tr", null, r.map((c) => el("td", null, c))))),
  ]);
  const clear = el("button", "link", "清除比較");
  clear.type = "button";
  clear.addEventListener("click", () => { compared.length = 0; renderCompare(); });
  box.replaceChildren(el("h4", null, "名字比較"), el("div", "table-scroll", [table]), clear);
}

function namePoster(reading, label) {
  const { canvas, ctx, colors } = createPoster("name", "姓名學");
  ctx.textAlign = "center";
  ctx.fillStyle = colors.ink;
  ctx.font = `700 120px ${POSTER_SERIF}`;
  ctx.fillText(label, 540, 300);
  ctx.font = `32px ${POSTER_SANS}`;
  ctx.fillStyle = colors.muted;
  ctx.fillText(reading.strokes.map((n, i) => `${reading.chars[i]}${n}`).join("　"), 540, 370);
  reading.entries.forEach((e, i) => {
    const x = 160 + i * 190, y = 470;
    posterPanel(ctx, colors, x - 80, y, 160, 260);
    ctx.fillStyle = colors.muted; ctx.font = `28px ${POSTER_SANS}`; ctx.fillText(e.name, x, y + 50);
    ctx.fillStyle = colors.ink; ctx.font = `700 72px ${POSTER_SERIF}`; ctx.fillText(String(e.n), x, y + 140);
    ctx.fillStyle = colors.accent; ctx.font = `700 34px ${POSTER_SANS}`; ctx.fillText(e.fortune[0], x, y + 200);
  });
  ctx.fillStyle = colors.ink;
  ctx.font = `34px ${POSTER_SANS}`;
  ctx.fillText(`三才 ${reading.talents.elements.join("・")}（${reading.talents.verdict}）　綜合 ${LEVEL_WORDS[reading.level]}`, 540, 830);
  ctx.textAlign = "left";
  ctx.font = `30px ${POSTER_SANS}`;
  posterWrap(ctx, reading.talents.text.join(""), 110, 910, 860, 46, 6);
  return canvas;
}

$("#go").addEventListener("click", analyse);
$("#fullname").addEventListener("keydown", (e) => { if (e.key === "Enter") analyse(); });
