// 西洋占星本命盤：計算太陽、月亮與八大行星（含冥王星）的黃道位置、上升與天頂、整宮制宮位、主要相位。
// 行星位置用 Paul Schlyter 整理的軌道要素法，誤差約在 1 到 2 角分（月亮約 2 角分、冥王星較大），足以判斷星座與宮位。
// 需要 birth.js。

const SIGNS = ["牡羊", "金牛", "雙子", "巨蟹", "獅子", "處女", "天秤", "天蠍", "射手", "摩羯", "水瓶", "雙魚"];
// 後面加上 U+FE0E，要求瀏覽器用文字字形顯示，而不是彩色表情符號
const SIGN_GLYPHS = [..."♈♉♊♋♌♍♎♏♐♑♒♓"].map((glyph) => glyph + "︎");
const SIGN_ELEMENTS = ["火", "土", "風", "水"]; // 依序循環
const SIGN_MODES = ["開創", "固定", "變動"];
const DEG = Math.PI / 180;
const norm360 = (x) => ((x % 360) + 360) % 360;
const sin = (x) => Math.sin(x * DEG);
const cos = (x) => Math.cos(x * DEG);
const atan2 = (y, x) => Math.atan2(y, x) / DEG;

// 軌道要素：[升交點 N, 傾角 i, 近日點幅角 w, 半長軸 a, 離心率 e, 平近點角 M]，每項為 [起始值, 每日變化]
const ORBITS = {
  水星: [[48.3313, 3.24587e-5], [7.0047, 5.0e-8], [29.1241, 1.01444e-5], [0.387098, 0], [0.205635, 5.59e-10], [168.6562, 4.0923344368]],
  金星: [[76.6799, 2.4659e-5], [3.3946, 2.75e-8], [54.891, 1.38374e-5], [0.72333, 0], [0.006773, -1.302e-9], [48.0052, 1.6021302244]],
  火星: [[49.5574, 2.11081e-5], [1.8497, -1.78e-8], [286.5016, 2.92961e-5], [1.523688, 0], [0.093405, 2.516e-9], [18.6021, 0.5240207766]],
  木星: [[100.4542, 2.76854e-5], [1.303, -1.557e-7], [273.8777, 1.64505e-5], [5.20256, 0], [0.048498, 4.469e-9], [19.895, 0.0830853001]],
  土星: [[113.6634, 2.3898e-5], [2.4886, -1.081e-7], [339.3939, 2.97661e-5], [9.55475, 0], [0.055546, -9.499e-9], [316.967, 0.0334442282]],
  天王星: [[74.0005, 1.3978e-5], [0.7733, 1.9e-8], [96.6612, 3.0565e-5], [19.18171, -1.55e-8], [0.047318, 7.45e-9], [142.5905, 0.011725806]],
  海王星: [[131.7806, 3.0173e-5], [1.77, -2.55e-7], [272.8461, -6.027e-6], [30.05826, 3.313e-8], [0.008606, 2.15e-9], [260.2471, 0.005995147]],
};
const MOON_ORBIT = [[125.1228, -0.0529538083], [5.1454, 0], [318.0634, 0.1643573223], [60.2666, 0], [0.0549, 0], [115.3654, 13.0649929509]];

const elementsAt = (orbit, d) => orbit.map(([base, rate]) => base + rate * d);

// 解克卜勒方程，回傳軌道平面上的距離 r 與真近點角 v
function kepler(a, e, M) {
  let E = M + (e / DEG) * sin(M) * (1 + e * cos(M));
  for (let i = 0; i < 8; i++) E -= (E - (e / DEG) * sin(E) - M) / (1 - e * cos(E));
  const x = a * (cos(E) - e);
  const y = a * Math.sqrt(1 - e * e) * sin(E);
  return { r: Math.hypot(x, y), v: atan2(y, x) };
}

// 由軌道要素算日心（月亮為地心）黃道直角座標
function orbitPosition(orbit, d) {
  const [N, i, w, a, e, M] = elementsAt(orbit, d);
  const { r, v } = kepler(a, e, norm360(M));
  return {
    x: r * (cos(N) * cos(v + w) - sin(N) * sin(v + w) * cos(i)),
    y: r * (sin(N) * cos(v + w) + cos(N) * sin(v + w) * cos(i)),
    z: r * sin(v + w) * sin(i),
    M: norm360(M),
  };
}

// 回傳各星體的地心黃經（度）。d 為 1999-12-31 0 時 UT 起算的日數。
function planetLongitudes(d) {
  const result = {};

  // 太陽
  const sunW = 282.9404 + 4.70935e-5 * d;
  const sunE = 0.016709 - 1.151e-9 * d;
  const sunM = norm360(356.047 + 0.9856002585 * d);
  const sun = kepler(1, sunE, sunM);
  const sunLon = norm360(sun.v + sunW);
  const xs = sun.r * cos(sunLon);
  const ys = sun.r * sin(sunLon);
  result.太陽 = sunLon;

  // 月亮（加上主要攝動項）
  const [moonN, , moonW, , , moonMraw] = elementsAt(MOON_ORBIT, d);
  const moon = orbitPosition(MOON_ORBIT, d);
  const Mm = norm360(moonMraw);
  const Ls = norm360(sunM + sunW);
  const Lm = norm360(Mm + moonW + moonN);
  const D = Lm - Ls;
  const F = Lm - moonN;
  result.月亮 = norm360(atan2(moon.y, moon.x)
    - 1.274 * sin(Mm - 2 * D) + 0.658 * sin(2 * D) - 0.186 * sin(sunM)
    - 0.059 * sin(2 * Mm - 2 * D) - 0.057 * sin(Mm - 2 * D + sunM) + 0.053 * sin(Mm + 2 * D)
    + 0.046 * sin(2 * D - sunM) + 0.041 * sin(Mm - sunM) - 0.035 * sin(D) - 0.031 * sin(Mm + sunM)
    - 0.015 * sin(2 * F - 2 * D) + 0.011 * sin(Mm - 4 * D));
  result.北交點 = norm360(moonN);

  // 行星：日心座標加上太陽的地心座標
  const Mj = norm360(elementsAt(ORBITS.木星, d)[5]);
  const Msat = norm360(elementsAt(ORBITS.土星, d)[5]);
  const Mu = norm360(elementsAt(ORBITS.天王星, d)[5]);
  for (const [name, orbit] of Object.entries(ORBITS)) {
    const p = orbitPosition(orbit, d);
    let lon = atan2(p.y, p.x);
    const r = Math.hypot(p.x, p.y);
    // 木星、土星、天王星互相牽引的攝動修正
    if (name === "木星") {
      lon += -0.332 * sin(2 * Mj - 5 * Msat - 67.6) - 0.056 * sin(2 * Mj - 2 * Msat + 21) + 0.042 * sin(3 * Mj - 5 * Msat + 21)
        - 0.036 * sin(Mj - 2 * Msat) + 0.022 * cos(Mj - Msat) + 0.023 * sin(2 * Mj - 3 * Msat + 52) - 0.016 * sin(Mj - 5 * Msat - 69);
    } else if (name === "土星") {
      lon += 0.812 * sin(2 * Mj - 5 * Msat - 67.6) - 0.229 * cos(2 * Mj - 4 * Msat - 2) + 0.119 * sin(Mj - 2 * Msat - 3)
        + 0.046 * sin(2 * Mj - 6 * Msat - 69) + 0.014 * sin(Mj - 3 * Msat + 32);
    } else if (name === "天王星") {
      lon += 0.04 * sin(Msat - 2 * Mu + 6) + 0.035 * sin(Msat - 3 * Mu + 33) - 0.015 * sin(Mj - Mu + 20);
    }
    result[name] = norm360(atan2(r * sin(lon) + ys, r * cos(lon) + xs));
  }

  // 冥王星：數值擬合公式（約適用於 1800–2100 年）
  const S = 50.03 + 0.033459652 * d;
  const P = 238.95 + 0.003968789 * d;
  const plutoLon = 238.9508 + 0.00400703 * d
    - 19.799 * sin(P) + 19.848 * cos(P) + 0.897 * sin(2 * P) - 4.956 * cos(2 * P)
    + 0.61 * sin(3 * P) + 1.211 * cos(3 * P) - 0.341 * sin(4 * P) - 0.19 * cos(4 * P)
    + 0.128 * sin(5 * P) - 0.034 * cos(5 * P) - 0.038 * sin(6 * P) + 0.031 * cos(6 * P)
    + 0.02 * sin(S - P) - 0.01 * cos(S - P);
  const plutoLat = -3.9082 - 5.453 * sin(P) - 14.975 * cos(P) + 3.527 * sin(2 * P) + 1.673 * cos(2 * P)
    - 1.051 * sin(3 * P) + 0.328 * cos(3 * P) + 0.179 * sin(4 * P) - 0.292 * cos(4 * P)
    + 0.019 * sin(5 * P) + 0.1 * cos(5 * P) - 0.031 * sin(6 * P) - 0.026 * cos(6 * P) + 0.011 * cos(S - P);
  const plutoR = 40.72 + 6.68 * sin(P) + 6.9 * cos(P) - 1.18 * sin(2 * P) - 0.03 * cos(2 * P) + 0.15 * sin(3 * P) - 0.14 * cos(3 * P);
  result.冥王星 = norm360(atan2(plutoR * sin(plutoLon) * cos(plutoLat) + ys, plutoR * cos(plutoLon) * cos(plutoLat) + xs));

  return result;
}

const PLANET_ORDER = ["太陽", "月亮", "水星", "金星", "火星", "木星", "土星", "天王星", "海王星", "冥王星"];
const PLANET_GLYPHS = { 太陽: "☉", 月亮: "☽", 水星: "☿", 金星: "♀", 火星: "♂", 木星: "♃", 土星: "♄", 天王星: "♅", 海王星: "♆", 冥王星: "♇", 北交點: "☊", 上升: "ASC", 天頂: "MC" };
const ASPECTS = [["合相", 0, 8, "融合"], ["六分相", 60, 4, "和諧"], ["四分相", 90, 6, "緊張"], ["三分相", 120, 6, "和諧"], ["對分相", 180, 8, "緊張"]];

// Placidus 宮位制：把每個黃道點在地平線上、下的弧各分成三等份。
// 回傳十二個宮頭的黃經（第 1 宮到第 12 宮）；緯度太高算不出來時回傳 null。
function placidusCusps(ramc, ecl, latitude, asc, mc) {
  const tanLat = Math.tan(latitude * DEG);
  const toLongitude = (ra) => norm360(atan2(sin(ra), cos(ra) * cos(ecl)));
  // 反覆逼近：某個赤經的黃道點，它的半弧的幾分之幾剛好落在那個赤經上
  const solve = (start, fraction, above) => {
    let ra = start;
    for (let i = 0; i < 16; i++) {
      const declination = Math.atan(sin(ra) * Math.tan(ecl * DEG));
      const x = -tanLat * Math.tan(declination);
      if (Math.abs(x) > 1) return null;
      const diurnal = Math.acos(x) / DEG; // 地平線以上的半弧
      ra = above ? ramc + fraction * diurnal : ramc + 180 - fraction * (180 - diurnal);
    }
    return toLongitude(ra);
  };
  const c11 = solve(ramc + 30, 1 / 3, true);
  const c12 = solve(ramc + 60, 2 / 3, true);
  const c2 = solve(ramc + 120, 2 / 3, false);
  const c3 = solve(ramc + 150, 1 / 3, false);
  if ([c11, c12, c2, c3].includes(null)) return null;
  const opposite = (lon) => norm360(lon + 180);
  return [asc, c2, c3, opposite(mc), opposite(c11), opposite(c12), opposite(asc), opposite(c2), opposite(c3), mc, c11, c12];
}

// 某個黃經落在第幾宮
function houseOf(lon, cusps) {
  for (let i = 0; i < 12; i++) {
    const width = norm360(cusps[(i + 1) % 12] - cusps[i]);
    if (norm360(lon - cusps[i]) < width) return i + 1;
  }
  return 1;
}

function astroChart(birth) {
  const instant = birthInstant(birth);
  const d = instant / 86400000 + 2440587.5 - 2451543.5;
  const longitudes = planetLongitudes(d);
  const later = planetLongitudes(d + 0.02);

  // 上升與天頂：由當地恆星時、黃赤交角與緯度求得
  const ecl = 23.4393 - 3.563e-7 * d;
  const sunMean = norm360(356.047 + 0.9856002585 * d + 282.9404 + 4.70935e-5 * d);
  const utHours = ((instant / 3600000) % 24 + 24) % 24;
  const lst = norm360(sunMean + 180 + utHours * 15 + birth.longitude);
  const mc = norm360(atan2(sin(lst), cos(lst) * cos(ecl)));
  let asc = norm360(atan2(cos(lst), -(sin(lst) * cos(ecl) + Math.tan(birth.latitude * DEG) * sin(ecl))));
  if (norm360(asc - mc) > 180) asc = norm360(asc + 180); // 上升一定在天頂之後的東半邊

  const ascSign = Math.floor(asc / 30);
  // 宮位制：預設整宮制（上升所在的星座整個算第一宮）；選 Placidus 而且算得出來才用它
  const cusps = birth.houses === "placidus" ? placidusCusps(lst, ecl, birth.latitude, asc, mc) : null;
  const place = (name, lon, extra = {}) => ({
    name, lon, sign: Math.floor(lon / 30), degree: lon % 30,
    house: cusps ? houseOf(lon, cusps) : ((Math.floor(lon / 30) - ascSign + 12) % 12) + 1,
    ...extra,
  });
  const planets = PLANET_ORDER.map((name) => {
    const motion = ((later[name] - longitudes[name] + 540) % 360) - 180;
    return place(name, longitudes[name], { retrograde: motion < 0 });
  });
  const points = [place("上升", asc), place("天頂", mc), place("北交點", longitudes.北交點)];

  const aspects = [];
  const bodies = [...planets, points[0], points[1]];
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      if (i >= planets.length) continue; // 上升與天頂之間不算相位
      const angle = Math.abs(((bodies[i].lon - bodies[j].lon + 540) % 360) - 180);
      for (const [name, exact, orb, nature] of ASPECTS) {
        const limit = bodies[i].name === "太陽" || bodies[i].name === "月亮" ? orb : orb - 1;
        if (Math.abs(angle - exact) <= limit) aspects.push({ a: bodies[i].name, b: bodies[j].name, name, nature, orb: Math.abs(angle - exact) });
      }
    }
  }
  aspects.sort((x, y) => x.orb - y.orb);

  return { planets, points, asc, mc, ascSign, aspects, cusps, lst, ecl };
}

// ── 解說文字 ──
const SIGN_TRAITS = [
  "直接、衝動、行動力強，想到就做，不喜歡等。缺點是沒耐心、容易開頭熱後面涼。",
  "穩定、務實、重視安全感與實際享受，慢熱但持久。缺點是固執、抗拒改變。",
  "好奇、機靈、善於溝通，需要不斷有新資訊。缺點是分心、善變、不夠深入。",
  "敏感、顧家、保護慾強，情感記憶深。缺點是情緒化、退縮、放不下過去。",
  "自信、熱情、需要被看見，天生有舞台感。缺點是好面子、自我中心。",
  "細心、講究、善於分析與服務，要求完美。缺點是挑剔、焦慮、對自己太嚴苛。",
  "重視和諧、公平與關係，有審美眼光。缺點是優柔寡斷、怕衝突而委屈求全。",
  "強烈、深沉、洞察力強，愛恨分明。缺點是多疑、佔有慾強、不輕易原諒。",
  "樂觀、愛自由、追求意義與遠方，直話直說。缺點是粗心、承諾感不足。",
  "踏實、有野心、能吃苦，重視成就與責任。缺點是壓抑、嚴肅、過度以結果衡量一切。",
  "獨立、理性、想法前衛，重視朋友與理想。缺點是疏離、固執己見、不近人情。",
  "感性、富同情心、想像力豐富，界線模糊。缺點是逃避、容易受騙或自我犧牲。",
];
const ROLE_TEXTS = {
  太陽: "太陽代表你的核心自我與人生要活出的樣子",
  月亮: "月亮代表你的情緒、內在需求與私底下的樣子",
  上升: "上升代表你給人的第一印象，以及你面對世界的方式",
  水星: "水星代表思考與溝通的方式",
  金星: "金星代表你怎麼愛人、喜歡什麼、重視什麼",
  火星: "火星代表你的行動力、慾望與發脾氣的方式",
  木星: "木星代表你的信念與容易得到幸運的地方",
  土星: "土星代表你的壓力、責任與必須下苦功的地方",
};
const HOUSE_TEXTS = [
  "自我與外在形象", "金錢與個人價值", "溝通、學習與手足", "家庭與內心根基", "戀愛、創作與子女", "工作、日常與健康",
  "伴侶與一對一的關係", "親密、共有資源與轉化", "遠行、信念與高等學問", "事業與社會地位", "朋友、社群與理想", "潛意識、獨處與隱藏的事",
];
const PLANET_KEYWORDS = {
  太陽: "自我與意志", 月亮: "情緒與安全感", 水星: "思考與表達", 金星: "愛與價值", 火星: "行動與衝勁",
  木星: "擴張與幸運", 土星: "限制與責任", 天王星: "變革與獨立", 海王星: "夢想與迷惘", 冥王星: "掌控與蛻變",
  上升: "外在形象", 天頂: "事業方向",
};

const formatPosition = (body) => `${SIGNS[body.sign]} ${Math.floor(body.degree)}°${String(Math.floor((body.degree % 1) * 60)).padStart(2, "0")}′`;

// 畫星盤：外圈十二星座，內圈行星；上升點固定在左邊
function drawWheel(chart) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 400 400");
  svg.setAttribute("class", "wheel");
  const add = (tag, attrs, text) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text) node.textContent = text;
    svg.append(node);
    return node;
  };
  // 黃經轉成畫面座標：上升在左（180 度方向），逆時針增加
  const point = (lon, radius) => {
    const angle = (180 + (lon - chart.asc)) * DEG;
    return [200 + radius * Math.cos(angle), 200 - radius * Math.sin(angle)];
  };
  add("circle", { cx: 200, cy: 200, r: 190, class: "wheel-ring" });
  add("circle", { cx: 200, cy: 200, r: 155, class: "wheel-ring" });
  add("circle", { cx: 200, cy: 200, r: 60, class: "wheel-ring" });
  for (let sign = 0; sign < 12; sign++) {
    const [x1, y1] = point(sign * 30, 155);
    const [x2, y2] = point(sign * 30, 190);
    add("line", { x1, y1, x2, y2, class: "wheel-line" });
    const [tx, ty] = point(sign * 30 + 15, 172);
    add("text", { x: tx, y: ty, class: `wheel-sign s${sign % 4}` }, SIGN_GLYPHS[sign]);
    if (!chart.cusps) {
      // 整宮制：每個星座就是一宮
      const [hx, hy] = point(sign * 30 + 15, 75);
      add("text", { x: hx, y: hy, class: "wheel-house" }, String(((sign - chart.ascSign + 12) % 12) + 1));
      const [l1x, l1y] = point(sign * 30, 60);
      add("line", { x1: l1x, y1: l1y, x2: x1, y2: y1, class: "wheel-line faint" });
    }
  }
  if (chart.cusps) {
    // Placidus：宮頭不在星座交界，各宮大小不一
    chart.cusps.forEach((cusp, i) => {
      const [x1, y1] = point(cusp, 60);
      const [x2, y2] = point(cusp, 155);
      add("line", { x1, y1, x2, y2, class: "wheel-line faint" });
      const middle = cusp + norm360(chart.cusps[(i + 1) % 12] - cusp) / 2;
      const [hx, hy] = point(middle, 75);
      add("text", { x: hx, y: hy, class: "wheel-house" }, String(i + 1));
    });
  }
  // 相位線
  const lonOf = Object.fromEntries([...chart.planets, ...chart.points].map((b) => [b.name, b.lon]));
  for (const aspect of chart.aspects.filter((a) => a.name !== "合相" && a.b !== "上升" && a.b !== "天頂")) {
    const [x1, y1] = point(lonOf[aspect.a], 60);
    const [x2, y2] = point(lonOf[aspect.b], 60);
    add("line", { x1, y1, x2, y2, class: `wheel-aspect ${aspect.nature === "緊張" ? "hard" : "soft"}` });
  }
  // 行星：位置太近的往內錯開
  const sorted = [...chart.planets].sort((a, b) => a.lon - b.lon);
  let lastLon = -99;
  let level = 0;
  for (const body of sorted) {
    level = body.lon - lastLon < 9 ? (level + 1) % 3 : 0;
    lastLon = body.lon;
    const [x, y] = point(body.lon, 136 - level * 22);
    const [mx, my] = point(body.lon, 155);
    add("circle", { cx: mx, cy: my, r: 2, class: "wheel-dot" });
    add("text", { x, y, class: "wheel-planet" }, PLANET_GLYPHS[body.name]);
  }
  for (const [name, lon] of [["ASC", chart.asc], ["MC", chart.mc]]) {
    const [x1, y1] = point(lon, 60);
    const [x2, y2] = point(lon, 190);
    add("line", { x1, y1, x2, y2, class: "wheel-axis" });
    const [tx, ty] = point(lon, 198);
    add("text", { x: Math.min(Math.max(tx, 16), 384), y: Math.min(Math.max(ty, 10), 392), class: "wheel-axis-label" }, name);
  }
  return svg;
}

// ── 行運：現在天上的行星和本命盤形成的相位 ──
const TRANSIT_TEXTS = {
  火星: "這幾週衝勁變強，也容易急躁、起衝突",
  木星: "這段時間有擴展的機會，容易樂觀，也容易做過頭",
  土星: "這段時間要面對責任與考驗，進展慢，但做紮實的會留下來",
  天王星: "這一兩年有突如其來的變動，想打破原本的模式",
  海王星: "這一兩年界線變模糊，容易理想化，也容易迷惘或看錯",
  冥王星: "這幾年有深層的轉變，舊的東西被迫結束、重新開始",
};

function transitAspects(chart, date = new Date()) {
  const now = planetLongitudes(date.getTime() / 86400000 + 2440587.5 - 2451543.5);
  const natal = [...chart.planets.slice(0, 5), chart.points[0], chart.points[1]];
  const found = [];
  for (const transit of Object.keys(TRANSIT_TEXTS)) {
    for (const body of natal) {
      const angle = Math.abs(((now[transit] - body.lon + 540) % 360) - 180);
      for (const [name, exact, , nature] of ASPECTS) {
        if (Math.abs(angle - exact) <= 2) found.push({ transit, natal: body.name, name, nature, orb: Math.abs(angle - exact) });
      }
    }
  }
  return { now, aspects: found.sort((a, b) => a.orb - b.orb) };
}

// 存成圖片：三大要素與行星位置
function astroPoster(birth, chart) {
  const { canvas, ctx, colors } = createPoster("astro", "本命星盤");
  const byName = (name) => [...chart.planets, ...chart.points].find((b) => b.name === name);
  ctx.fillStyle = colors.ink;
  ctx.font = `700 52px ${POSTER_SERIF}`;
  ctx.fillText(birth.name || "星盤", 540, 210);
  ctx.fillStyle = colors.muted;
  ctx.font = `28px ${POSTER_SANS}`;
  ctx.fillText(`${birthLabel(birth)}　${birth.place === "custom" ? "" : birth.place}`, 540, 262);
  ["太陽", "月亮", "上升"].forEach((name, i) => {
    const x = 96 + i * 304;
    posterPanel(ctx, colors, x, 310, 280, 250);
    ctx.textAlign = "center";
    ctx.fillStyle = colors.muted;
    ctx.font = `28px ${POSTER_SANS}`;
    ctx.fillText(name, x + 140, 366);
    ctx.fillStyle = colors.accent;
    ctx.font = `700 76px ${POSTER_SERIF}`;
    ctx.fillText(SIGNS[byName(name).sign], x + 140, 466);
    ctx.fillStyle = colors.ink;
    ctx.font = `28px ${POSTER_SANS}`;
    ctx.fillText(`${Math.floor(byName(name).degree)}°`, x + 140, 520);
  });
  ctx.font = `32px ${POSTER_SANS}`;
  chart.planets.slice(2).forEach((body, i) => {
    const x = 130 + (i % 2) * 440, y = 650 + Math.floor(i / 2) * 64;
    ctx.textAlign = "left";
    ctx.fillStyle = colors.muted;
    ctx.fillText(body.name, x, y);
    ctx.fillStyle = colors.ink;
    ctx.fillText(`${SIGNS[body.sign]} ${Math.floor(body.degree)}°　${body.house} 宮`, x + 130, y);
  });
  ctx.fillStyle = colors.muted;
  ctx.font = `28px ${POSTER_SANS}`;
  posterWrap(ctx, `太陽${SIGNS[byName("太陽").sign]}：${SIGN_TRAITS[byName("太陽").sign]}`, 130, 950, 820, 46, 5);
  return canvas;
}

const HOUSE_KEY = "iching-houses";

function renderAstro(input) {
  let system = "whole";
  try { system = localStorage.getItem(HOUSE_KEY) || "whole"; } catch { /* 用預設 */ }
  const birth = { ...input, houses: system };
  const chart = astroChart(birth);
  const root = document.querySelector("#result");
  root.replaceChildren();

  const systemSelect = el("select", null, [["whole", "整宮制"], ["placidus", "Placidus 制"]].map(([value, text]) => Object.assign(el("option", null, text), { value })));
  systemSelect.value = system;
  systemSelect.addEventListener("change", () => {
    try { localStorage.setItem(HOUSE_KEY, systemSelect.value); } catch { /* 存不了就只在這次生效 */ }
    renderAstro(input);
  });
  const systemNote = system === "placidus" && !chart.cusps ? "這個緯度算不出 Placidus 宮位，已改用整宮制。" : "";

  const rows = [...chart.planets, ...chart.points].map((body) => el("div", "astro-row", [
    el("span", "astro-glyph", PLANET_GLYPHS[body.name]),
    el("span", null, body.name + (body.retrograde ? "（逆行）" : "")),
    el("span", null, [el("span", `s${body.sign % 4}`, SIGN_GLYPHS[body.sign]), ` ${formatPosition(body)}`]),
    el("span", "astro-house", body.name === "上升" || body.name === "天頂" ? "" : `第 ${body.house} 宮`),
  ]));
  root.append(el("section", "card", [
    el("h2", null, `${birth.name || ""}的本命盤`),
    el("p", "meta", `${birthLabel(birth)}（UTC${birth.zone >= 0 ? "+" : ""}${birth.zone}${birth.dst ? "，夏令時間" : ""}）· ${birth.place === "custom" ? "自訂地點" : birth.place} ${birth.latitude}°, ${birth.longitude}°`),
    el("label", "field inline", [el("span", null, "宮位制"), systemSelect]),
    systemNote ? el("p", "hint", systemNote) : null,
    drawWheel(chart),
    el("div", "astro-table", rows),
    el("div", "actions summary-actions", [posterButton(() => astroPoster(birth, chart), `觀象-星盤-${birth.name || "本命盤"}.png`)]),
  ]));

  const reading = el("section", "card reading-card");
  reading.append(el("h2", null, "解讀"));
  const part = (title, text) => reading.append(el("div", "reading-part", [el("h5", null, title), el("p", null, text)]));
  const byName = (name) => [...chart.planets, ...chart.points].find((b) => b.name === name);

  part("三大要素", ["太陽", "月亮", "上升"].map((name) => {
    const body = byName(name);
    return `${name}${SIGNS[body.sign]}：${ROLE_TEXTS[name]}。${SIGN_TRAITS[body.sign]}`;
  }).join("\n"));

  const sun = byName("太陽"), moon = byName("月亮"), asc = byName("上升");
  const sameElement = (a, b) => a.sign % 4 === b.sign % 4;
  let tension = "";
  if (sameElement(sun, moon)) tension = "太陽與月亮同屬一種元素，你想要的和你需要的方向一致，內在比較不打架。";
  else if (Math.abs(sun.sign - moon.sign) % 3 === 0) tension = "太陽與月亮的星座彼此相剋（同一種模式、不同元素），你理智上想走的路和情緒上需要的東西常常互相拉扯。";
  else tension = "太陽與月亮的性質不同，外在的追求和內在的需求要各自照顧，不能只顧一邊。";
  if (asc.sign !== sun.sign) tension += `別人第一眼看到的是${SIGNS[asc.sign]}的你，熟了之後才會看到${SIGNS[sun.sign]}的那一面。`;
  part("內外是否一致", tension);

  part("個人行星", ["水星", "金星", "火星", "木星", "土星"].map((name) => {
    const body = byName(name);
    return `${name}${SIGNS[body.sign]}，在第 ${body.house} 宮${body.retrograde ? "，逆行" : ""}：${ROLE_TEXTS[name]}，表現在「${HOUSE_TEXTS[body.house - 1]}」的領域。${SIGN_TRAITS[body.sign].split("缺點")[0]}`;
  }).join("\n"));

  // 元素與模式的分布
  const elementCount = [0, 0, 0, 0], modeCount = [0, 0, 0];
  for (const body of [...chart.planets.slice(0, 7), asc]) { elementCount[body.sign % 4]++; modeCount[body.sign % 3]++; }
  const elementNotes = { 火: ["行動力與熱情充足，但容易衝過頭", "缺乏衝勁與自信，需要別人推一把"], 土: ["務實、能落地，但容易太保守", "不夠踏實，想法多而難以落實"], 風: ["善於思考溝通，但容易想多做少", "不擅長抽離來看事情，容易鑽進情緒裡"], 水: ["情感豐富、直覺強，但容易被情緒淹沒", "不太能體會別人的感受，或不習慣表達情感"] };
  const balance = SIGN_ELEMENTS.map((element, i) => `${element}象 ${elementCount[i]}`).join("、") + "；"
    + SIGN_MODES.map((mode, i) => `${mode} ${modeCount[i]}`).join("、") + "。\n"
    + SIGN_ELEMENTS.map((element, i) => (elementCount[i] >= 4 ? `${element}象偏多：${elementNotes[element][0]}。` : elementCount[i] === 0 ? `沒有${element}象：${elementNotes[element][1]}。` : "")).filter(Boolean).join("\n");
  part("元素分布（太陽到土星加上升）", balance.trim());

  const top = chart.aspects.slice(0, 8);
  part("主要相位", top.length ? top.map((a) => {
    const meaning = a.nature === "和諧" ? "兩者順暢配合，是天生的資源" : a.nature === "緊張" ? "兩者互相衝突，是壓力也是推動你成長的地方" : "兩者綁在一起運作，力量集中，好壞一起放大";
    return `${a.a}${a.name}${a.b}（誤差 ${a.orb.toFixed(1)}°）：${PLANET_KEYWORDS[a.a]}與${PLANET_KEYWORDS[a.b]}，${meaning}。`;
  }).join("\n") : "沒有在容許度內的主要相位。");

  const transits = transitAspects(chart);
  part("目前的行運", transits.aspects.length
    ? transits.aspects.slice(0, 6).map((t) => `行運${t.transit}${t.name}本命${t.natal}（誤差 ${t.orb.toFixed(1)}°）：${TRANSIT_TEXTS[t.transit]}，作用在你的${PLANET_KEYWORDS[t.natal]}上，`
      + (t.nature === "和諧" ? "過程相對順。" : t.nature === "緊張" ? "過程有壓力和摩擦。" : "影響最直接。")).join("\n")
    : "目前火星到冥王星沒有和你的太陽、月亮、水星、金星、火星、上升、天頂形成 2 度以內的主要相位，這陣子沒有特別強的外在推力。");

  reading.append(el("p", "hint", "宮位預設採整宮制（上升所在的星座整個算第一宮），可在上方改成 Placidus 制，兩者行星落的宮位可能差一宮。行星位置的誤差約 1 到 2 角分，冥王星略大；星體剛好在星座交界、或出生時間不準時，星座與上升可能有出入。解說是把星座、宮位、相位的一般意義組合起來，沒有論整體格局。"));
  root.append(reading);
  root.hidden = false;
}

if (typeof document !== "undefined" && document.querySelector("#birth-form") && document.documentElement.dataset.theme === "astro") {
  birthForm(document.querySelector("#birth-form"), { button: "排星盤" }, renderAstro);
}
