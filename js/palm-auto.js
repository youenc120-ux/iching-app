// 手相自動判斷：全部在這台裝置上跑，照片不會傳出去。
// 1. 用 Google 公開的 MediaPipe 手部模型找出手腕與指根位置（第一次使用時從網路下載模型，約 17MB）。
// 2. 由指根與手腕的比例判斷手型、左右手。
// 3. 把照片的手掌部分對齊到示意圖的座標，找出比周圍暗的細長紋路（掌紋），
//    再看每一種線的畫法有多少比例落在紋路上，選最吻合的那一種。
// 掌紋判斷只是估計，結果會畫回照片上讓使用者確認、修改。

const PALM_AUTO_LIB = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
const PALM_AUTO_MODEL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const PALM_SCALE = 2; // 對齊後的影像是示意圖座標的兩倍大（400×520）
// 判斷掌紋的參數（用合成手掌測試調出來的）：找線時往旁邊看多遠（示意圖單位）、多暗才算是線（手掌上前幾 % 暗的地方）、
// 長線加分多少、整組線可以移動多遠、事業線與婚姻線吻合度低於多少就算「沒有」
const PALM_TUNE = { radius: 2, percentile: 0.92, mult: 2.2, lengthBonus: 0.15, shift: 6, step: 2, fateNone: 0.75, marriageNone: 0.8 };
// 示意圖上對應的三個點：手腕、食指根、小指根。
// 示意圖的線畫得比真實手掌高，用一張真實手掌照片校正後，指根對到示意圖 y≈96 時，主線位置才對得上。
const PALM_ANCHORS = [[100, 250], [131, 96], [54.5, 98]];
const PALM_OUTLINE = "M45 104 L155 104 Q161 140 159 170 Q157 206 147 226 Q133 247 100 247 Q66 247 54 225 Q42 197 42 152 Q42 122 45 104 Z";

let palmLandmarker = null;
async function palmLoadModel() {
  if (palmLandmarker) return palmLandmarker;
  const vision = await import(`${PALM_AUTO_LIB}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(`${PALM_AUTO_LIB}/wasm`);
  palmLandmarker = await vision.HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: PALM_AUTO_MODEL },
    runningMode: "IMAGE",
    numHands: 1,
  });
  return palmLandmarker;
}

// 解三點仿射：示意圖座標 → 照片座標，回傳 [a, b, c, d, e, f]（x' = a x + c y + e，y' = b x + d y + f）
function palmAffine(src, dst) {
  const [[x1, y1], [x2, y2], [x3, y3]] = src;
  const det = x1 * (y2 - y3) - x2 * (y1 - y3) + x3 * (y1 - y2);
  const solve = (v1, v2, v3) => [
    (v1 * (y2 - y3) - v2 * (y1 - y3) + v3 * (y1 - y2)) / det,
    (x1 * (v2 - v3) - x2 * (v1 - v3) + x3 * (v1 - v2)) / det,
    (x1 * (y2 * v3 - y3 * v2) - x2 * (y1 * v3 - y3 * v1) + x3 * (y1 * v2 - y2 * v1)) / det,
  ];
  const [a, c, e] = solve(dst[0][0], dst[1][0], dst[2][0]);
  const [b, d, f] = solve(dst[0][1], dst[1][1], dst[2][1]);
  return [a, b, c, d, e, f];
}
const palmApply = ([a, b, c, d, e, f], [x, y]) => [a * x + c * y + e, b * x + d * y + f];

// 把只有 M、L、Q 的路徑切成一串點（每隔約 2 個單位一點）
function palmSample(d) {
  const nums = d.match(/[MLQ]|-?[\d.]+/g);
  const points = [];
  let i = 0, cur = [0, 0];
  while (i < nums.length) {
    const cmd = nums[i++];
    if (cmd === "M") { cur = [+nums[i++], +nums[i++]]; points.push(cur); }
    else if (cmd === "L") {
      const end = [+nums[i++], +nums[i++]];
      const n = Math.max(2, Math.ceil(Math.hypot(end[0] - cur[0], end[1] - cur[1]) / 2));
      for (let k = 1; k <= n; k++) points.push([cur[0] + (end[0] - cur[0]) * k / n, cur[1] + (end[1] - cur[1]) * k / n]);
      cur = end;
    } else if (cmd === "Q") {
      const ctrl = [+nums[i++], +nums[i++]], end = [+nums[i++], +nums[i++]];
      const n = Math.max(4, Math.ceil((Math.hypot(ctrl[0] - cur[0], ctrl[1] - cur[1]) + Math.hypot(end[0] - ctrl[0], end[1] - ctrl[1])) / 2));
      for (let k = 1; k <= n; k++) {
        const t = k / n, u = 1 - t;
        points.push([u * u * cur[0] + 2 * u * t * ctrl[0] + t * t * end[0], u * u * cur[1] + 2 * u * t * ctrl[1] + t * t * end[1]]);
      }
      cur = end;
    }
  }
  return points;
}

// 方框模糊（水平、垂直各做一次）
function palmBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = sum / (2 * r + 1);
      sum += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (2 * r + 1);
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

// 主程式：傳入已載入的 <img>，回傳判斷結果；找不到手時丟出錯誤
async function palmAuto(img) {
  const landmarker = await palmLoadModel();
  const found = landmarker.detect(img);
  const lm = found.landmarks && found.landmarks[0];
  if (!lm) throw new Error("照片裡找不到手。請在光線充足的地方，手掌攤平朝向鏡頭、整隻手入鏡，再拍一次。");
  return palmAnalyze(img, lm);
}

// 有了手的 21 個關鍵點（0–1 的相對座標）之後的分析，獨立出來方便測試
function palmAnalyze(img, lm) {
  const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
  const P = (i) => [lm[i].x * W, lm[i].y * H];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  // 左右手：手掌朝鏡頭、手指朝上時，右手的食指在右邊
  const u = [P(5)[0] - P(17)[0], P(5)[1] - P(17)[1]], v = [P(9)[0] - P(0)[0], P(9)[1] - P(0)[1]];
  const hand = u[0] * v[1] - u[1] * v[0] < 0 ? "right" : "left";

  // 手型：手掌長寬比、中指長度對手掌長度
  const palmLen = dist(P(0), P(9));
  const palmWidth = dist(P(5), P(17)) * 1.3; // 指根關節在手掌邊緣內側，補回兩側的寬度
  const finger = dist(P(9), P(10)) + dist(P(10), P(11)) + dist(P(11), P(12));
  const longPalm = palmLen / palmWidth > 1.3;
  const longFingers = finger / palmLen > 0.9;
  const shape = longPalm ? (longFingers ? "water" : "fire") : (longFingers ? "air" : "earth");
  const shapeSure = Math.min(Math.abs(palmLen / palmWidth - 1.3) / 0.12, Math.abs(finger / palmLen - 0.9) / 0.1);

  // 對齊：把照片的手掌畫進示意圖座標的畫布
  const A = palmAffine(PALM_ANCHORS, [P(0), P(5), P(17)]);
  const [a, b, c, d, e, f] = A;
  const det = a * d - b * c;
  const inv = [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
  const w = 200 * PALM_SCALE, h = 260 * PALM_SCALE;
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const s = PALM_SCALE;
  ctx.setTransform(inv[0] * s, inv[1] * s, inv[2] * s, inv[3] * s, inv[4] * s, inv[5] * s);
  ctx.drawImage(img, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pixels = ctx.getImageData(0, 0, w, h).data;

  // 灰階（掌紋在綠、藍色版最明顯），再找「比附近暗」的地方
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.2 * pixels[i * 4] + 0.5 * pixels[i * 4 + 1] + 0.3 * pixels[i * 4 + 2];
  const bg = palmBlur(gray, w, h, 9);
  const ridge = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) ridge[i] = Math.max(0, bg[i] - gray[i]);

  // 只看手掌範圍（避開邊緣陰影）
  ctx.setTransform(s * 0.92, 0, 0, s * 0.92, w * 0.04, h * 0.04);
  const outline = new Path2D(PALM_OUTLINE);
  const inside = (x, y) => ctx.isPointInPath(outline, x, y);
  let sum = 0, count = 0;
  const palmValues = [];
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    if (!inside(x, y)) continue;
    const r = ridge[y * w + x];
    sum += r; count++; palmValues.push(r);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!count) throw new Error("手掌的範圍抓不到，請換一張手掌完整入鏡的照片。");
  const mean = sum / count + 0.5;
  palmValues.sort((x, y) => x - y);
  const hitLevel = Math.max(PALM_TUNE.mult * mean, palmValues[Math.floor(palmValues.length * PALM_TUNE.percentile)]);

  // 一條路徑上，有多少點附近找得到明顯的暗紋
  const R = Math.round(PALM_TUNE.radius * PALM_SCALE);
  // 每個人的線位置都和示意圖有點差距，所以讓整組線在附近小範圍移動，取最吻合的位置
  const measureAt = (paths, dx, dy) => {
    let hits = 0, total = 0, strength = 0, length = 0;
    for (const d of paths) {
      const pts = palmSample(d).map(([x, y]) => [x + dx, y + dy]);
      for (let k = 1; k < pts.length; k++) length += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      for (const [px, py] of pts) {
        const cx = Math.round(px * PALM_SCALE), cy = Math.round(py * PALM_SCALE);
        let best = 0;
        for (let y = Math.max(0, cy - R); y <= Math.min(h - 1, cy + R); y++)
          for (let x = Math.max(0, cx - R); x <= Math.min(w - 1, cx + R); x++) best = Math.max(best, ridge[y * w + x]);
        total++; strength += best / mean;
        if (best >= hitLevel) hits++;
      }
    }
    return { coverage: total ? hits / total : 0, strength: total ? strength / total : 0, length };
  };
  const measure = (paths, shift = PALM_TUNE.shift) => {
    let best = null;
    for (let dx = -shift; dx <= shift; dx += PALM_TUNE.step)
      for (let dy = -shift; dy <= shift; dy += PALM_TUNE.step) {
        const m = measureAt(paths, dx, dy);
        if (!best || m.coverage > best.coverage) best = m;
      }
    return best;
  };

  const picks = {}, sure = {};
  // noneBelow：最吻合的線也低於這個比例時，判斷為「沒有」
  const choose = (key, options, { shift = PALM_TUNE.shift, noneBelow = 0.4 } = {}) => {
    const drawn = options.filter((o) => o.paths.length && !o.dashed);
    const scored = drawn.map((o) => ({ o, m: measure(o.paths, shift) }));
    const maxLen = Math.max(...scored.map((x) => x.m.length));
    scored.forEach((x) => { x.score = x.m.coverage * (1 - PALM_TUNE.lengthBonus + PALM_TUNE.lengthBonus * x.m.length / maxLen); });
    scored.sort((p, q) => q.score - p.score);
    let best = scored[0];
    const empty = options.find((o) => !o.paths.length);
    if (empty && best.m.coverage < noneBelow) { picks[key] = empty.key; sure[key] = 1 - best.m.coverage / noneBelow; return; }
    // 線有但很淡：改選虛線（淺、鍊條）那一種
    const dashed = options.find((o) => o.dashed && o.paths.join() === best.o.paths.join());
    picks[key] = dashed && best.m.strength < 2.6 ? dashed.key : best.o.key;
    sure[key] = scored[1] ? (best.score - scored[1].score) / Math.max(best.score, 0.01) : 0.5;
  };
  for (const line of PALM_LINES) choose(line.key, line.options, line.key === "fate" ? { noneBelow: PALM_TUNE.fateNone } : {});
  // 婚姻線很短、又貼著感情線，只容許很小的位移，免得被感情線吸過去
  choose("marriage", PALM_MARRIAGE.options, { shift: 2, noneBelow: PALM_TUNE.marriageNone });

  // 特殊掌紋
  const marks = [];
  const markOf = (key) => PALM_MARKS.find((m) => m.key === key);
  // 斷掌和「平直的智慧線緊貼感情線」在照片上分不清，不自動判斷，請使用者自己看
  if (measure(markOf("sun").paths).coverage > 0.6) marks.push("sun");
  const density = palmValues.filter((x) => x >= hitLevel).length / palmValues.length;
  if (density > 0.2) marks.push("many");
  else if (density < 0.08) marks.push("few");

  return { hand, shape, shapeSure, picks, sure, marks, anchors: A };
}

// 把選好的線畫回照片上，讓使用者對照
function palmOverlay(img, result, lines) {
  const canvas = Object.assign(document.createElement("canvas"), { width: img.naturalWidth || img.width, height: img.naturalHeight || img.height, className: "palm-overlay" });
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const A = result.anchors;
  const scale = Math.hypot(A[0], A[1]);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const { paths, dashed } of lines) {
    for (const d of paths || []) {
      const pts = palmSample(d).map((p) => palmApply(A, p));
      ctx.setLineDash(dashed ? [8 * scale, 6 * scale] : []);
      ctx.strokeStyle = "rgba(13, 11, 30, 0.55)";
      ctx.lineWidth = 6 * scale;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.strokeStyle = "#f1d08a";
      ctx.lineWidth = 3 * scale;
      ctx.stroke();
    }
  }
  return canvas;
}

// 掌紋加強圖：把比周圍暗的細紋（掌紋）加深、其他地方淡掉，畫成米色紙上的深色線，方便對照
function palmEnhance(img, A) {
  const W0 = img.naturalWidth || img.width, H0 = img.naturalHeight || img.height;
  const corners = [[24, 70], [182, 70], [24, 258], [182, 258]].map((p) => palmApply(A, p));
  const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
  const x0 = Math.max(0, Math.min(...xs)), y0 = Math.max(0, Math.min(...ys));
  const x1 = Math.min(W0, Math.max(...xs)), y1 = Math.min(H0, Math.max(...ys));
  const scale = Math.min(1, 900 / Math.max(x1 - x0, y1 - y0));
  const w = Math.max(1, Math.round((x1 - x0) * scale)), h = Math.max(1, Math.round((y1 - y0) * scale));
  const canvas = Object.assign(document.createElement("canvas"), { width: w, height: h, className: "palm-overlay palm-enhanced" });
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) gray[i] = 0.2 * px[i * 4] + 0.5 * px[i * 4 + 1] + 0.3 * px[i * 4 + 2];
  const bg = palmBlur(gray, w, h, Math.max(4, Math.round(w / 80)));
  const diff = new Float32Array(w * h);
  const sample = [];
  for (let i = 0; i < w * h; i++) { diff[i] = Math.max(0, bg[i] - gray[i]); if (i % 7 === 0) sample.push(diff[i]); }
  sample.sort((a, b) => a - b);
  const top = sample[Math.floor(sample.length * 0.985)] || 1;
  for (let i = 0; i < w * h; i++) {
    const t = Math.min(1, diff[i] / top) ** 0.8;
    px[i * 4] = 244 - t * 214; px[i * 4 + 1] = 236 - t * 207; px[i * 4 + 2] = 223 - t * 203; px[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}
