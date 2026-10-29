// 手相：一步一頁選出自己手上每條線的樣子，最後組成解讀。
// 需要 palm-data.js；一步一頁的外框由 flow.js 處理。照片只在這台裝置上顯示，不會上傳。

const PALM_KEY = "palm-last";
// 自動判斷的把握要到這個程度才幫使用者選好；用真實照片測過，掌紋的把握通常不夠，多半會留給使用者自己選
const PALM_SURE = 0.3;
const palmEl = (tag, className, content) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (Array.isArray(content)) node.append(...content.filter(Boolean));
  else if (content != null) node.textContent = content;
  return node;
};

// ── 手掌示意圖 ──
// lines：[{ paths, dashed }]，用金色畫出；mirror 為 true 時畫左手
function palmSvg(lines, mirror, className = "palm-svg") {
  const ns = "http://www.w3.org/2000/svg";
  const make = (tag, attrs) => {
    const node = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };
  const svg = make("svg", { viewBox: "0 0 200 260", class: className, "aria-hidden": "true" });
  const g = make("g", mirror ? { transform: "translate(200 0) scale(-1 1)" } : {});
  const hand = make("g", { class: "palm-hand" });
  hand.append(
    make("rect", { x: 44, y: 50, width: 21, height: 66, rx: 10.5 }),
    make("rect", { x: 68, y: 26, width: 23, height: 90, rx: 11.5 }),
    make("rect", { x: 94, y: 16, width: 23, height: 100, rx: 11.5 }),
    make("rect", { x: 120, y: 30, width: 23, height: 86, rx: 11.5 }),
    make("rect", { x: 150, y: 126, width: 25, height: 80, rx: 12.5, transform: "rotate(-34 162 166)" }),
    make("path", { d: "M45 104 L155 104 Q161 140 159 170 Q157 206 147 226 Q133 247 100 247 Q66 247 54 225 Q42 197 42 152 Q42 122 45 104 Z" }),
  );
  g.append(hand);
  for (const line of lines) {
    for (const d of line.paths || []) g.append(make("path", { d, class: `palm-line${line.dashed ? " dashed" : ""}` }));
  }
  svg.append(g);
  return svg;
}

(() => {
  const state = { hand: "right", marks: new Set() };
  try {
    const saved = JSON.parse(localStorage.getItem(PALM_KEY));
    if (saved) Object.assign(state, saved, { marks: new Set(saved.marks || []) });
  } catch { /* 沒有上次的紀錄 */ }
  const mirror = () => state.hand === "left";
  const next = () => setTimeout(() => { const b = document.querySelector(".flow-next"); if (b && !b.hidden) b.click(); }, 260);
  const redraws = [];
  const syncs = []; // 自動判斷後把每個選項的選取狀態重新標一次

  // 一格選項：示意圖 + 名稱 + 怎麼認
  function optionGrid(group, options, { multi = false, auto = true } = {}) {
    const grid = palmEl("div", "palm-options");
    const buttons = options.map((option) => {
      const art = palmEl("span", "palm-art");
      const button = palmEl("button", "palm-option", [
        art,
        palmEl("b", null, option.label),
        option.look ? palmEl("small", null, option.look) : null,
      ]);
      button.type = "button";
      const draw = () => art.replaceChildren(palmSvg(option.paths ? [option] : [], mirror()));
      draw();
      redraws.push(draw);
      const selected = () => (multi ? state.marks.has(option.key) : state[group] === option.key);
      const sync = () => { button.classList.toggle("active", selected()); button.setAttribute("aria-pressed", String(selected())); };
      button.addEventListener("click", () => {
        if (multi) { state.marks.has(option.key) ? state.marks.delete(option.key) : state.marks.add(option.key); }
        else state[group] = option.key;
        buttons.forEach((b) => b.sync());
        if (!multi && auto) next();
      });
      button.sync = sync;
      syncs.push(sync);
      sync();
      return button;
    });
    grid.append(...buttons);
    return grid;
  }

  // ── 第一步：看哪一隻手，可以拍照對照 ──
  const stepHand = document.querySelector("#step-hand");
  const handChoice = palmEl("div", "choices palm-hand-choice");
  for (const [key, label] of [["right", "右手"], ["left", "左手"]]) {
    const b = palmEl("button", state.hand === key ? "active" : "", label);
    b.type = "button";
    syncs.push(() => b.classList.toggle("active", state.hand === key));
    b.addEventListener("click", () => {
      state.hand = key;
      handChoice.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
      redraws.forEach((draw) => draw());
    });
    handChoice.append(b);
  }
  const photoInput = Object.assign(palmEl("input"), { type: "file", accept: "image/*", id: "palm-photo-input" });
  photoInput.hidden = true;
  const photoButton = palmEl("label", "palm-photo-button", "拍一張或選一張手掌照片（可略過）");
  photoButton.htmlFor = "palm-photo-input";
  const preview = palmEl("img", "palm-preview");
  preview.alt = "你的手掌照片";
  preview.hidden = true;
  const floating = palmEl("button", "palm-float");
  floating.type = "button";
  floating.hidden = true;
  floating.setAttribute("aria-label", "放大或縮小手掌照片");
  const floatImg = palmEl("img");
  floatImg.alt = "";
  floating.append(floatImg);
  // 放大檢視：全螢幕、放大兩倍半，可以用手指拖著看手掌每個地方
  const viewer = palmEl("dialog", "palm-viewer");
  const viewerScroll = palmEl("div", "palm-viewer-scroll");
  const viewerImg = palmEl("img");
  viewerImg.alt = "放大的手掌照片";
  const viewerClose = palmEl("button", "palm-viewer-close", "關閉");
  viewerClose.type = "button";
  viewerClose.addEventListener("click", () => viewer.close());
  viewerScroll.append(viewerImg);
  viewer.append(viewerScroll, viewerClose);
  document.body.append(viewer);
  const openViewer = (src) => {
    viewerImg.src = src;
    viewer.showModal();
    requestAnimationFrame(() => {
      viewerScroll.scrollLeft = (viewerScroll.scrollWidth - viewerScroll.clientWidth) / 2;
      viewerScroll.scrollTop = (viewerScroll.scrollHeight - viewerScroll.clientHeight) * 0.6;
    });
  };
  floating.addEventListener("click", () => openViewer(floatImg.src));
  document.body.append(floating);
  photoInput.addEventListener("change", () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    preview.src = floatImg.src = url;
    preview.hidden = false;
    photoButton.textContent = "換一張照片";
    autoBox.hidden = false;
    autoResult.replaceChildren();
    autoStatus.textContent = "";
    if (overlay) { overlay.remove(); overlay = null; toggle.remove(); }
    // 一選好照片就先做掌紋加強圖（不需要下載模型）
    preview.addEventListener("load", () => {
      try { showEnhanced(null); } catch { /* 做不出來就看原圖 */ }
    }, { once: true });
  });

  // ── 自動判斷 ──
  const autoBox = palmEl("div", "palm-auto");
  autoBox.hidden = true;
  const autoButton = palmEl("button", "primary", "自動判斷左右手與手型");
  autoButton.type = "button";
  const autoStatus = palmEl("p", "hint palm-auto-status");
  const autoResult = palmEl("div", "palm-auto-result");
  let overlay = null;
  autoBox.append(
    palmEl("p", "hint", "會在這支手機上辨識手掌、量手型、比對掌紋。第一次使用要下載辨識模型（約 17MB，建議用 Wi-Fi），照片本身不會傳出去。上面已經把照片的掌紋加強了。按下面的按鈕，還會自動判斷左右手和手型，並把加強圖對準手掌。"),
    autoButton, autoStatus, autoResult,
  );
  // 把加強圖放在照片的位置，下面有「看原圖／看加強圖」切換
  const toggle = palmEl("button", "link palm-toggle", "看原圖");
  toggle.type = "button";
  toggle.addEventListener("click", () => {
    const showingEnhanced = !overlay.hidden;
    overlay.hidden = showingEnhanced;
    preview.hidden = !showingEnhanced;
    toggle.textContent = showingEnhanced ? "看加強圖" : "看原圖";
  });
  const showEnhanced = (anchors) => {
    if (overlay) overlay.remove();
    overlay = palmEnhance(preview, anchors);
    preview.hidden = true;
    preview.after(overlay);
    overlay.after(toggle);
    overlay.title = "點一下放大";
    overlay.addEventListener("click", () => openViewer(floatImg.src));
    toggle.textContent = "看原圖";
    floatImg.src = overlay.toDataURL("image/jpeg", 0.9);
  };
  autoButton.addEventListener("click", async () => {
    autoButton.disabled = true;
    autoResult.replaceChildren();
    autoStatus.textContent = "辨識中…第一次要先下載模型，請稍等。";
    try {
      if (!preview.complete) await new Promise((resolve) => preview.addEventListener("load", resolve, { once: true }));
      const found = await palmAuto(preview);
      // 左右手和手型靠指根比例，比較可靠；掌紋只在很有把握時才幫你選好
      state.hand = found.hand;
      state.shape = found.shape;
      const confident = Object.keys(found.picks).filter((key) => found.sure[key] >= PALM_SURE);
      for (const key of confident) state[key] = found.picks[key];
      syncs.forEach((sync) => sync());
      redraws.forEach((draw) => draw());
      showEnhanced(found.anchors);
      const label = (line, key) => line.options.find((o) => o.key === key).label;
      const row = (title, text) => palmEl("li", null, [palmEl("b", null, title), palmEl("span", null, text)]);
      const lineRows = [...PALM_LINES, PALM_MARRIAGE].map((line) => {
        const key = line.key || "marriage";
        return row(line.title, confident.includes(key) ? `${label(line, found.picks[key])}（已幫你選好）` : "請對照加強圖自己選");
      });
      const ready = ["shape", ...PALM_LINES.map((l) => l.key), "marriage"].every((key) => state[key]);
      const start = palmEl("button", "primary", "開始對照選線");
      start.type = "button";
      start.addEventListener("click", next);
      const view = palmEl("button", null, "直接看解讀");
      view.type = "button";
      view.hidden = !ready;
      view.addEventListener("click", () => go.click());
      autoResult.append(
        palmEl("ul", "palm-auto-list", [
          row("手", found.hand === "left" ? "左手" : "右手"),
          row("手型", PALM_HANDS.find((h) => h.key === found.shape).label + (found.shapeSure < 0.5 ? "（接近兩型之間，可再確認）" : "")),
          ...lineRows,
        ]),
        palmEl("div", "actions", [start, view]),
      );
      autoStatus.textContent = "上面是把你的掌紋加強後的樣子，深色的就是線。接下來每一步，右下角都會有這張圖，點一下可以放大，照著它選會比看原照片清楚。";
    } catch (err) {
      // 找不到手或模型載不下來時，照樣把照片的掌紋加強，左右手和手型請自己選
      const reason = err && err.message && /找不到|抓不到/.test(err.message) ? "這張照片沒能自動找到手的位置" : "這支手機沒能載入辨識模型（可能是網路或瀏覽器不支援）";
      try {
        showEnhanced(null);
        autoStatus.textContent = `${reason}，所以左右手和手型請自己選；不過已經把照片的掌紋加強了，深色的細線就是掌紋，接下來每一步右下角都有這張圖可以放大對照。`;
      } catch {
        autoStatus.textContent = `${reason}。可以照步驟自己選。`;
      }
    } finally {
      autoButton.disabled = false;
    }
  });
  stepHand.append(
    palmEl("p", "hint", "習慣上看慣用手（大多是右手）：慣用手代表你現在和後天的狀態，另一隻手是天生的底子。民間也有「男左女右」的看法，兩隻手都可以看。"),
    handChoice,
    palmEl("p", "hint palm-tip", "在光線充足的地方，手掌攤平、微微彎一下手指，線會比較清楚。照片只留在這支手機上，不會上傳。"),
    photoButton, photoInput, preview, autoBox,
  );

  // ── 手型 ──
  const stepShape = document.querySelector("#step-shape");
  const shapeGrid = palmEl("div", "palm-options palm-shapes");
  const shapeArt = { earth: [0.95, 0.62], air: [0.95, 0.95], fire: [1.25, 0.62], water: [1.25, 0.95] };
  for (const shape of PALM_HANDS) {
    const [palmH, fingerH] = shapeArt[shape.key];
    const ph = 64 * palmH, fh = 50 * fingerH;
    const svg = `<svg viewBox="0 0 120 150" class="palm-svg" aria-hidden="true"><g class="palm-hand">
      ${[0, 1, 2, 3].map((i) => `<rect x="${24 + i * 18.5}" y="${142 - ph - fh + (i === 0 || i === 3 ? 8 : 0)}" width="16" height="${fh + 8}" rx="8"/>`).join("")}
      <rect x="22" y="${142 - ph}" width="76" height="${ph}" rx="12"/></g></svg>`;
    const button = palmEl("button", "palm-option", [palmEl("span", "palm-art"), palmEl("b", null, shape.label), palmEl("small", null, shape.look)]);
    button.type = "button";
    button.querySelector(".palm-art").innerHTML = svg;
    button.addEventListener("click", () => {
      state.shape = shape.key;
      shapeGrid.querySelectorAll(".palm-option").forEach((b) => b.classList.toggle("active", b === button));
      next();
    });
    syncs.push(() => button.classList.toggle("active", state.shape === shape.key));
    button.classList.toggle("active", state.shape === shape.key);
    shapeGrid.append(button);
  }
  stepShape.append(palmEl("p", "hint", "量一下：手掌長度是手腕橫紋到中指根，寬度是四指根部那一排；手指長度用中指比手掌。"), shapeGrid);

  // ── 四條主線 ──
  for (const line of PALM_LINES) {
    document.querySelector(`#step-${line.key}`).append(palmEl("p", "hint", line.where), optionGrid(line.key, line.options));
  }
  document.querySelector("#step-marriage").append(palmEl("p", "hint", PALM_MARRIAGE.where), optionGrid("marriage", PALM_MARRIAGE.options));

  // ── 特殊掌紋（可複選）＋看結果 ──
  const stepMarks = document.querySelector("#step-marks");
  const go = palmEl("button", "primary palm-go", "看解讀");
  go.type = "button";
  const error = palmEl("p", "error");
  error.hidden = true;
  stepMarks.append(palmEl("p", "hint", "有的就點，可以複選；都沒有就直接看解讀。"), optionGrid("marks", PALM_MARKS, { multi: true }), error, go);
  go.addEventListener("click", () => {
    const missing = [["shape", "手型"], ...PALM_LINES.map((l) => [l.key, l.title]), ["marriage", "婚姻線"]].filter(([k]) => !state[k]);
    if (missing.length) {
      error.textContent = `還沒選：${missing.map(([, t]) => t).join("、")}。按「上一步」回去補。`;
      error.hidden = false;
      return;
    }
    error.hidden = true;
    try { localStorage.setItem(PALM_KEY, JSON.stringify({ ...state, marks: [...state.marks] })); } catch { /* 存不了就算了 */ }
    render();
  });

  // ── 解讀 ──
  const first = (text) => (text.match(/^[^。]*。/) || [text])[0];
  function render() {
    const shape = PALM_HANDS.find((h) => h.key === state.shape);
    const pick = (line) => line.options.find((o) => o.key === state[line.key]);
    const [life, head, heart, fate] = PALM_LINES.map(pick);
    const marriage = PALM_MARRIAGE.options.find((o) => o.key === state.marriage);
    const marks = PALM_MARKS.filter((m) => state.marks.has(m.key));
    const has = (key) => state.marks.has(key);

    const drawn = has("duan")
      ? [life, fate, ...marks.filter((m) => m.key !== "chuan")]
      : [life, head, heart, fate, marriage, ...marks.filter((m) => m.key !== "chuan")];

    const advice = [];
    if (head.key === "straight" && ["middle", "straight"].includes(heart.key)) advice.push("你的理性很強，在乎的人要記得說出口，不要只用做的。");
    if (head.key === "slope" && ["index", "chain"].includes(heart.key)) advice.push("感性加上想像力，容易把人或事想得太好；重大決定前先睡一晚再說。");
    if (["none", "broken"].includes(fate.key)) advice.push("你不適合被一條固定的路綁住，但每次轉換前先把下一步準備好，轉換才會往上。");
    if (["clear", "fromLife"].includes(fate.key)) advice.push("長期累積是你最大的本錢，別因為一時的機會分心。");
    if (["narrow", "faint", "short"].includes(life.key)) advice.push("作息是你運勢的地基：固定的睡眠和運動，比任何開運方法都有用。");
    if (has("duan")) advice.push("脾氣上來時先停三秒，你的話比你以為的重。");
    if (shape.key === "air" || head.key === "fork") advice.push("想法多是優點，但一次只推一件事到完成。");
    if (!advice.length) advice.push("手上的紋路會隨生活慢慢改變，一兩年後可以再看一次，對照自己的變化。");

    const part = (title, text) => palmEl("div", "reading-part", [palmEl("h5", null, title), palmEl("p", null, text)]);
    // 斷掌時智慧線和感情線合成一條，就用斷掌的說法取代兩條線
    const duan = PALM_MARKS.find((m) => m.key === "duan");
    const lead = has("duan") ? `${first(shape.text)}${first(duan.text)}` : `${first(shape.text)}${first(head.text)}${first(heart.text)}`;
    const summary = palmEl("section", "card palm-summary", [
      palmEl("h2", null, "你的手相"),
      palmEl("p", "meta", `${state.hand === "left" ? "左手" : "右手"}・${shape.label}・${has("duan") ? "斷掌" : `智慧線${head.label}・感情線${heart.label}`}`),
      palmEl("div", "palm-result-art", [palmSvg(drawn, mirror(), "palm-svg big")]),
    ]);
    const reading = palmEl("section", "card reading-card", [
      palmEl("h2", null, "解讀"),
      part("一句話", lead),
      part("具體建議", advice.slice(0, 3).join("\n")),
      part("個性", `${shape.text}\n${head.text}\n要留意：${shape.shadow}`),
      part("感情", [heart.text, shape.love, `婚姻線${marriage.label}：${marriage.text}`].join("\n")),
      part("事業與財運", [`事業線${fate.label}：${fate.text}`, shape.work, has("sun") ? PALM_MARKS.find((m) => m.key === "sun").text : null].filter(Boolean).join("\n")),
      part("精力與生活", `生命線${life.label}：${life.text}\n${PALM_LINES[0].note}`),
      marks.length ? part("特殊掌紋", marks.map((m) => `${m.label}：${m.text}`).join("\n")) : null,
    ].filter(Boolean));
    const basis = palmEl("section", "card", [
      palmEl("h2", null, "依據與限制"),
      palmEl("p", null, "線的名稱和看法整理自 Cheiro《Palmistry for All》（1916）、William G. Benham《The Laws of Scientific Hand Reading》（1900），四種手型是現代手相書常用的「土風火水」分法，斷掌、川字掌是台灣民間的說法。解讀文字是本站自己的整理。"),
      palmEl("p", null, "手相沒有科學證據能預測未來；掌紋也會隨年紀、工作和生活習慣改變。把它當成認識自己的一面鏡子，不要拿來決定健康、婚姻或錢的大事。"),
    ]);
    const root = document.querySelector("#result");
    root.replaceChildren(summary, reading, basis);
    root.hidden = false;
    floating.hidden = true;
    root.scrollIntoView({ block: "start" });
  }

  // 照片縮圖只在第二步以後的選擇步驟顯示（第一步已經有大張照片）
  const result = document.querySelector("#result");
  const syncFloat = () => { floating.hidden = !result.hidden || !stepHand.hidden || !preview.getAttribute("src"); };
  new MutationObserver(syncFloat).observe(result, { attributes: true, attributeFilter: ["hidden"] });
  new MutationObserver(syncFloat).observe(stepHand, { attributes: true, attributeFilter: ["hidden"] });
})();
