// 生命靈數頁面：輸入生日或選存過的人，畫出主命數、九宮格、流年與流月。

const $ = (selector) => document.querySelector(selector);

function savedPeople() {
  try { return loadPeople(); } catch { return []; }
}

function renderNumerology(y, m, d, name) {
  const c = numerologyChart(y, m, d);
  const t = NUM_TEXTS[c.life];
  const root = $("#result");
  root.hidden = false;

  const grid = el("div", "num-grid", GRID_ROWS.flat().map((n) => {
    const count = c.counts[n];
    return el("div", `num-cell${count ? " on" : ""}${count >= 3 ? " strong" : ""}`, [
      el("span", "num-digit", String(n)), count ? el("span", "num-count", count > 1 ? `×${count}` : "") : null,
    ]);
  }));
  // 連線畫在九宮格上（SVG）
  const pos = {}; GRID_ROWS.forEach((row, r) => row.forEach((n, col) => { pos[n] = [col * 100 + 50, r * 100 + 50]; }));
  const svg = `<svg class="num-lines" viewBox="0 0 300 300" aria-hidden="true">${c.lines.map(([nums]) => {
    const [a, , b] = nums; return `<line x1="${pos[a][0]}" y1="${pos[a][1]}" x2="${pos[b][0]}" y2="${pos[b][1]}"/>`;
  }).join("")}</svg>`;
  const gridWrap = el("div", "num-grid-wrap");
  gridWrap.innerHTML = svg;
  gridWrap.append(grid);

  const part = (title, body) => el("div", "reading-part", [el("h5", null, title), typeof body === "string" ? el("p", null, body) : body]);
  const card = el("section", "card num-card", [
    el("p", "meta", `${y}/${m}/${d}${name ? `　${name}` : ""}`),
    el("div", "num-hero", [
      el("div", "num-big", String(c.life)),
      el("div", null, [el("h2", null, `主命數 ${c.life}・${t.title}`), el("p", "hint", `${c.digits.split("").join("＋")}＝${c.total}${c.steps.slice(1).map((s) => `→${s}`).join("")}　天賦數 ${c.talent}`)]),
    ]),
    el("div", "reading", [
      part("個性", t.core),
      part("優點", t.good),
      part("課題", t.lesson),
      part("感情", t.love),
      part("工作", t.work),
      c.masters.length ? part("卓越數", c.masters.map((x) => MASTER_TEXTS[x]).join("\n")) : null,
    ]),
  ]);

  const lineText = c.lines.length ? c.lines.map(([nums, label, text]) => `${nums.join("-")} ${label}：${text}`).join("\n") : "九宮格裡沒有連成線，天賦比較分散，需要靠後天專心培養一兩項。";
  const extra = [
    c.missing.length ? c.missing.map((n) => MISSING_TEXTS[n]).join("\n") : "九個數字都有，沒有明顯的空缺。",
    c.strong.length ? `\n${c.strong.map((n) => `數字 ${n} 出現 ${c.counts[n]} 次：${NUM_TEXTS[n].title}的特質特別強，優點和缺點都會被放大（${NUM_TEXTS[n].lesson.split("；")[0]}）。`).join("\n")}` : "",
  ].join("");
  const gridCard = el("section", "card", [
    el("h2", null, "九宮格"),
    el("p", "hint", "把生日、天賦數、主命數的每個數字放進九宮格；連成一線代表那方面的天賦。"),
    gridWrap,
    el("div", "reading", [part("連線", lineText), part("空缺與過多", extra)]),
  ]);

  const [yt, yd] = YEAR_TEXTS[c.yearNum];
  const thisMonth = new Date().getMonth();
  const months = el("div", "num-months", c.months.map((n, i) => el("div", `num-month${i === thisMonth ? " now" : ""}`, [
    el("b", null, `${i + 1}月`), el("span", "num-month-n", String(n)), el("small", null, YEAR_TEXTS[n][0]),
  ])));
  const yearCard = el("section", "card", [
    el("h2", null, `${c.year} 流年數 ${c.yearNum}・${yt}`),
    el("p", null, yd),
    el("p", "hint", `算法：生日的月與日（${m}＋${d}）加上今年 ${c.year} 的各位數，化簡到 1–9。流年以國曆年計。`),
    el("h4", null, "流月"),
    months,
  ]);

  const poster = posterButton(() => numPoster(y, m, d, name, c), `觀象-生命靈數-${c.life}.png`);
  root.replaceChildren(card, gridCard, yearCard, el("div", "actions", [poster]));
  root.scrollIntoView({ behavior: "smooth", block: "start" });
}

function numPoster(y, m, d, name, c) {
  const { canvas, ctx, colors } = createPoster("numero", "生命靈數");
  const t = NUM_TEXTS[c.life];
  ctx.textAlign = "center";
  ctx.fillStyle = colors.muted;
  ctx.font = `30px ${POSTER_SANS}`;
  ctx.fillText(`${name ? name + "　" : ""}${y}/${m}/${d}`, 540, 210);
  ctx.fillStyle = colors.accent;
  ctx.font = `700 260px ${POSTER_SERIF}`;
  ctx.fillText(String(c.life), 540, 500);
  ctx.fillStyle = colors.ink;
  ctx.font = `700 54px ${POSTER_SERIF}`;
  ctx.fillText(t.title, 540, 590);
  ctx.font = `32px ${POSTER_SANS}`;
  ctx.textAlign = "left";
  let yy = posterWrap(ctx, t.core, 120, 680, 840, 50, 3);
  yy = posterWrap(ctx, `優點：${t.good}`, 120, yy + 40, 840, 50, 2);
  yy = posterWrap(ctx, `課題：${t.lesson}`, 120, yy + 40, 840, 50, 3);
  ctx.fillStyle = colors.accent;
  posterWrap(ctx, `${c.year} 流年 ${c.yearNum}：${YEAR_TEXTS[c.yearNum][0]}`, 120, yy + 50, 840, 50, 1);
  return canvas;
}

function choose(y, m, d, name) {
  $("#birthday").value = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  renderNumerology(y, m, d, name);
}

$("#birthday").addEventListener("change", (e) => {
  const [y, m, d] = e.target.value.split("-").map(Number);
  if (y >= 1900 && y <= 2100 && m && d) renderNumerology(y, m, d, "");
});
$("#people").append(...savedPeople().map((p) => {
  const b = el("button", null, p.name || "未命名");
  b.type = "button";
  b.addEventListener("click", () => {
    $("#people").querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    choose(p.year, p.month, p.day, p.name);
  });
  return b;
}));
const first = savedPeople()[0];
if (first) { $("#people").firstChild.classList.add("active"); choose(first.year, first.month, first.day, first.name); }
