// 六十四卦總覽頁：列出每一卦的原文、白話與吉凶評等，方便翻閱和校對。

function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (Array.isArray(content)) node.append(...content.filter(Boolean));
  else if (content != null) node.textContent = content;
  return node;
}

// 評等標籤（大吉、吉、平、不利、凶）
function toneBadge(rating) {
  const level = LEVELS[rating];
  return el("span", `tone ${level.tier}`, level.label);
}

function textRow(title, text, plain, rating) {
  const head = el("div", "row-head", [el("h4", null, title), rating ? toneBadge(rating) : null]);
  const row = el("div", "text", [head, el("p", "classic", text)]);
  if (plain) row.append(el("p", "plain", plain));
  return row;
}

// 吉凶有條件的辭句，在下面補上條件說明
function withCondition(row, hex, position) {
  const condition = CONDITIONS[`${hex.number}-${position}`];
  if (condition) row.append(el("p", "condition", `有條件：${condition}`));
  return row;
}

// 卦的畫面，以及放到各類問事上的解釋（收合起來，需要時再展開）
function sceneBlock(hex) {
  const scene = SCENES[hex.number];
  const topics = el("details", "scene-topics", [
    el("summary", null, "各類問事的解釋"),
    ...TOPICS.map((topic) => el("p", null, `【${topic.name}】${scene.topics[topic.key]}`)),
  ]);
  return el("div", "scene-body", [sceneFigure(hex), el("div", "scene-text", [el("p", null, scene.picture), topics])]);
}

function hexCard(hex) {
  const bars = hex.bits.map((bit) => {
    const bar = el("span", `bar ${bit ? "yang" : "yin"}`);
    bar.append(el("i"), el("i"));
    return bar;
  });
  const up = TRIGRAMS[hex.upper];
  const low = TRIGRAMS[hex.lower];
  const card = el("section", "card texts hex-card");
  card.id = `hex-${hex.number}`;
  card.append(
    el("div", "hex-card-head", [
      el("div", "lines", bars.reverse()),
      el("div", null, [
        el("h3", null, `${hex.number}　${hex.fullName}`),
        el("p", "meta", `上${hex.upper}${up.symbol}（${up.nature}）　下${hex.lower}${low.symbol}（${low.nature}）`),
      ]),
    ]),
    el("p", "hex-note", `${HEX_NOTES[hex.number - 1][0]}：${HEX_NOTES[hex.number - 1][1]}${HEX_NOTES[hex.number - 1][2]}`),
    sceneBlock(hex),
    withCondition(textRow("卦辭", `${hex.name}：${hex.judgment}`, hex.judgmentPlain, ratingOf(hex, "judgment")), hex, 0),
    textRow("象曰", hex.image)
  );
  hex.lines.forEach((line, i) => {
    const row = withCondition(textRow(lineTitle(i, hex.bits[i] === 1), line.text, line.plain, ratingOf(hex, i)), hex, i + 1);
    row.append(el("p", "scene-line", `畫面：${SCENES[hex.number].lines[i]}`));
    card.append(row);
  });
  if (hex.extra) {
    card.append(textRow(hex.name === "乾" ? "用九" : "用六", hex.extra.text, hex.extra.plain, ratingOf(hex, "extra")));
  }
  return card;
}

const grid = document.querySelector("#grid");
const list = document.querySelector("#list");

grid.append(...HEXAGRAMS.map((hex) => {
  const link = el("a", "hex-chip", [el("span", "chip-symbol", hex.symbol), el("span", null, hex.name)]);
  link.href = `#hex-${hex.number}`;
  link.title = `第 ${hex.number} 卦 ${hex.fullName}`;
  link.dataset.number = hex.number;
  return link;
}));
list.append(...HEXAGRAMS.map(hexCard));

// 搜尋：卦名、全名或卦序符合的才顯示
document.querySelector("#search").addEventListener("input", (event) => {
  const keyword = event.target.value.trim();
  HEXAGRAMS.forEach((hex) => {
    const hit = !keyword || hex.fullName.includes(keyword) || String(hex.number) === keyword;
    document.querySelector(`#hex-${hex.number}`).hidden = !hit;
    grid.querySelector(`[data-number="${hex.number}"]`).hidden = !hit;
  });
});
