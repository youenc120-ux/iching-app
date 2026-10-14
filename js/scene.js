// 卦的畫面：每一卦由上下兩個單卦組成，《象傳》也是用這兩個意象來說一卦（例如「山上有雷，小過」）。
// 這裡把八個單卦各畫成一個圖案（天、地、雷、風、水、火、山、澤），下卦畫在地面，上卦畫在天空，疊成一卦的畫面。
// 文字的畫面與解釋在 scenes-1.js、scenes-2.js。

const SCENE_W = 320, SCENE_H = 200, HORIZON = 112;

function scenePath(d, cls) { return `<path class="${cls}" d="${d}"/>`; }

// 一串起伏的波紋，給水和湖用
function sceneWaves(y, from, to, amp, cls) {
  let d = `M${from} ${y}`;
  for (let x = from; x < to; x += 40) d += ` q10 ${-amp} 20 0 t20 0`;
  return scenePath(d, cls);
}

function sceneCloud(cx, cy, s) {
  return `<g class="sc-cloud">${[[-26, 6, 15], [-6, -6, 20], [18, 2, 16], [34, 9, 11]]
    .map(([x, y, r]) => `<circle cx="${cx + x * s}" cy="${cy + y * s}" r="${r * s}"/>`).join("")}
    <rect x="${cx - 40 * s}" y="${cy + 6 * s}" width="${84 * s}" height="${14 * s}" rx="${7 * s}"/></g>`;
}

function sceneSun(cx, cy, r, rays) {
  let out = `<circle class="sc-sun" cx="${cx}" cy="${cy}" r="${r}"/>`;
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI * 2 * i) / rays;
    const x1 = cx + Math.cos(a) * (r + 7), y1 = cy + Math.sin(a) * (r + 7);
    const x2 = cx + Math.cos(a) * (r + 17), y2 = cy + Math.sin(a) * (r + 17);
    out += `<line class="sc-ray" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }
  return `<g class="sc-sun-group">${out}</g>`;
}

function sceneMountains(base, peak) {
  const pts = [[0, base], [48, peak + 30], [92, base - 22], [152, peak], [212, base - 28], [262, peak + 20], [320, base]];
  const d = `M${pts.map((p) => p.join(" ")).join(" L")} Z`;
  // 山頂的積雪線
  const snow = `M${152 - 16} ${peak + 18} L152 ${peak} L${152 + 16} ${peak + 18}`;
  return scenePath(d, "sc-mountain") + scenePath(snow, "sc-line");
}

function sceneTree(x, base, h) {
  return `<g class="sc-tree" style="transform-origin:${x}px ${base}px">`
    + `<line class="sc-line" x1="${x}" y1="${base}" x2="${x}" y2="${base - h}"/>`
    + scenePath(`M${x - h * 0.32} ${base - h * 0.35} L${x} ${base - h * 1.05} L${x + h * 0.32} ${base - h * 0.35} Z`, "sc-leaf")
    + scenePath(`M${x - h * 0.4} ${base - h * 0.05} L${x} ${base - h * 0.7} L${x + h * 0.4} ${base - h * 0.05} Z`, "sc-leaf")
    + "</g>";
}

function sceneFlame(x, base, h) {
  const d = `M${x} ${base} C${x - h * 0.42} ${base - h * 0.3} ${x - h * 0.12} ${base - h * 0.7} ${x} ${base - h}`
    + ` C${x + h * 0.12} ${base - h * 0.7} ${x + h * 0.42} ${base - h * 0.3} ${x} ${base} Z`;
  return `<g class="sc-flame" style="transform-origin:${x}px ${base}px">${scenePath(d, "sc-fire")}</g>`;
}

function sceneBolt(x, y1, y2) {
  const h = y2 - y1;
  return `<polyline class="sc-bolt" points="${x},${y1} ${x - 12},${y1 + h * 0.45} ${x + 6},${y1 + h * 0.5} ${x - 8},${y2}"/>`;
}

// 八個單卦的圖案；top 為 true 表示它是上卦，畫在天空
const SCENE_MOTIFS = {
  乾(top) {
    return top
      ? [70, 52, 34].map((r, i) => scenePath(`M${160 - r * 3} ${100 - i * 4} Q160 ${100 - r * 2.2} ${160 + r * 3} ${100 - i * 4}`, "sc-sky-arc")).join("")
        + sceneSun(250, 36, 13, 8)
      : `<circle class="sc-glow" cx="160" cy="${SCENE_H}" r="62"/>` + sceneSun(160, SCENE_H - 6, 26, 10);
  },
  坤(top) {
    return top
      ? scenePath("M0 0 H320 V58 Q240 74 160 62 T0 66 Z", "sc-earth")
        + scenePath("M0 22 Q160 34 320 20", "sc-line") + scenePath("M0 42 Q160 54 320 40", "sc-line")
      : `<rect class="sc-earth" x="0" y="${HORIZON}" width="${SCENE_W}" height="${SCENE_H - HORIZON}"/>`
        + [-120, -60, 0, 60, 120].map((dx) => `<line class="sc-line" x1="${160 + dx * 0.3}" y1="${HORIZON}" x2="${160 + dx * 1.6}" y2="${SCENE_H}"/>`).join("");
  },
  震(top) {
    return top
      ? sceneCloud(118, 26, 0.9) + `<g class="sc-flash">${sceneBolt(132, 46, 104)}${sceneBolt(196, 30, 80)}</g>` + sceneCloud(205, 18, 0.7)
      : `<rect class="sc-ground" x="0" y="${HORIZON}" width="${SCENE_W}" height="${SCENE_H - HORIZON}"/>`
        + `<g class="sc-flash">${sceneBolt(166, 122, 192)}</g>`
        + [96, 224].map((x) => scenePath(`M${x} 190 Q${x - 2} 172 ${x + 8} 162 M${x} 182 Q${x - 10} 174 ${x - 14} 168`, "sc-sprout")).join("");
  },
  巽(top) {
    return top
      ? `<g class="sc-wind">${scenePath("M20 34 C80 14 130 54 190 34 S262 18 290 36 q12 10 0 18 q-10 4 -12 -6", "sc-gust")
        + scenePath("M50 66 C110 48 160 82 220 64 S280 58 300 70", "sc-gust")
        + scenePath("M10 92 C60 78 100 102 150 90", "sc-gust")}</g>`
      : `<rect class="sc-ground" x="0" y="${HORIZON}" width="${SCENE_W}" height="${SCENE_H - HORIZON}"/>`
        + sceneTree(92, 190, 58) + sceneTree(160, 192, 72) + sceneTree(230, 190, 54);
  },
  坎(top) {
    let rain = "";
    for (let x = 84; x <= 236; x += 19) rain += `<line class="sc-rain" x1="${x}" y1="${54 + (x % 3) * 4}" x2="${x - 6}" y2="${78 + (x % 3) * 4}"/>`;
    return top
      ? sceneCloud(130, 26, 1.05) + sceneCloud(208, 32, 0.85) + `<g class="sc-rain-group">${rain}</g>`
      : `<rect class="sc-water" x="0" y="${HORIZON + 8}" width="${SCENE_W}" height="${SCENE_H - HORIZON}"/>`
        + `<g class="sc-wave-group">${[134, 156, 178].map((y, i) => sceneWaves(y, -20 + i * 10, 340, 7, "sc-wave")).join("")}</g>`;
  },
  離(top) {
    return top
      ? `<circle class="sc-glow" cx="160" cy="54" r="46"/>` + sceneSun(160, 54, 24, 12)
      : `<rect class="sc-ground" x="0" y="${HORIZON}" width="${SCENE_W}" height="${SCENE_H - HORIZON}"/>`
        + `<circle class="sc-glow" cx="160" cy="188" r="44"/>`
        + sceneFlame(136, 192, 46) + sceneFlame(184, 192, 40) + sceneFlame(160, 194, 64);
  },
  艮(top) {
    return top ? sceneMountains(HORIZON + 6, 22) : sceneMountains(SCENE_H, HORIZON + 2);
  },
  兌(top) {
    return top
      ? `<ellipse class="sc-lake" cx="160" cy="78" rx="96" ry="18"/>` + sceneWaves(78, 92, 220, 4, "sc-wave")
      : `<rect class="sc-ground" x="0" y="${HORIZON}" width="${SCENE_W}" height="${SCENE_H - HORIZON}"/>`
        + `<ellipse class="sc-lake" cx="160" cy="160" rx="118" ry="26"/>`
        + sceneWaves(156, 70, 230, 4, "sc-wave") + sceneWaves(168, 110, 210, 3, "sc-wave");
  },
};

// 《象傳》的第一句就是這一卦的畫面，例如「山上有雷」
function sceneCaption(hex) {
  return hex.image.split(/[，。；]/)[0];
}

function sceneSvg(hex) {
  const sky = `<rect class="sc-sky" width="${SCENE_W}" height="${SCENE_H}"/>`;
  const horizon = `<line class="sc-horizon" x1="0" y1="${HORIZON}" x2="${SCENE_W}" y2="${HORIZON}"/>`;
  return `<svg class="scene-art" viewBox="0 0 ${SCENE_W} ${SCENE_H}" role="img" aria-label="${hex.fullName}：${sceneCaption(hex)}">`
    + sky + horizon + SCENE_MOTIFS[hex.lower](false) + SCENE_MOTIFS[hex.upper](true) + "</svg>";
}

function sceneFigure(hex) {
  const figure = document.createElement("figure");
  figure.className = "scene-figure";
  figure.innerHTML = sceneSvg(hex);
  const caption = document.createElement("figcaption");
  caption.textContent = `${hex.fullName}・${sceneCaption(hex)}`;
  figure.append(caption);
  return figure;
}

// ── 占卜結果裡的「卦的畫面」──
// 整卦的畫面 → 這次重點那一爻的畫面 → 依所問的類別解釋（有變卦時加上變卦的走向）
function sceneSection(entry, result, guide) {
  const { primary, changed } = result;
  const topic = detectTopic(entry.question, entry.topic);
  const main = guide.focus.find((f) => f.main) || guide.focus[0];
  const parts = [["整卦的畫面", SCENES[primary.number].picture]];

  if (typeof main.part === "number") {
    const hex = result[main.hex];
    const where = main.hex === "primary" ? "本卦" : "變卦";
    parts.push([`重點爻的畫面（${where}${hex.name}卦${lineTitle(main.part, hex.bits[main.part] === 1)}）`,
      `「${hex.lines[main.part].text}」\n${SCENES[hex.number].lines[main.part]}`]);
  }

  if (topic.key !== "general") {
    let text = SCENES[primary.number].topics[topic.key];
    if (changed) text += `\n之後的走向看變卦「${changed.fullName}」：${SCENES[changed.number].topics[topic.key]}`;
    parts.push([`放到「${topic.name}」上`, text]);
  } else {
    parts.push(["放到你問的事上", "看不出你問的是哪一類事，所以這裡只描述畫面。在問題下方選「感情」「事業」等類別，會給那一類的解釋。"]);
  }

  return el("div", "scene", [
    el("h4", null, "卦的畫面"),
    el("div", "scene-body", [
      sceneFigure(primary),
      el("div", "scene-text", parts.map(([title, text]) => el("div", "scene-part", [el("h5", null, title), el("p", null, text)]))),
    ]),
    el("p", "hint", "畫面取自卦爻辭與《象傳》本身的意象；象意和各類別的解釋是依傳統註解整理的詮釋，不是原文。"),
  ]);
}
