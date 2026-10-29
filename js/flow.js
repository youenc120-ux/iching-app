// 一步一頁與精簡結果，所有頁面共用。
// 1. [data-flow] 裡的每個 .flow-step 一次只顯示一個，上方有步驟數，下方有「上一步／下一步」。
//    #result 出現時收起步驟、只看結果，按「再問一件事」回到第一步。
// 2. #result 裡除了第一張與解讀以外的卡片先收合，點標題才展開；解讀只先展開前兩段。

(() => {
  // ── 一步一頁 ──
  const flow = document.querySelector("[data-flow]");
  const result = document.querySelector("#result");
  if (flow) {
    const steps = [...flow.querySelectorAll(":scope > .flow-step")];
    let index = 0;
    const count = Object.assign(document.createElement("span"), { className: "flow-count" });
    const title = Object.assign(document.createElement("h2"), { className: "flow-title" });
    const bar = Object.assign(document.createElement("div"), { className: "flow-bar" });
    const fill = document.createElement("i");
    bar.append(fill);
    const head = Object.assign(document.createElement("div"), { className: "flow-head" });
    head.append(count, title);
    flow.prepend(bar, head);

    const back = Object.assign(document.createElement("button"), { type: "button", className: "flow-back", textContent: "上一步" });
    const next = Object.assign(document.createElement("button"), { type: "button", className: "primary flow-next", textContent: "下一步" });
    const nav = Object.assign(document.createElement("div"), { className: "flow-nav" });
    nav.append(back, next);
    flow.append(nav);

    const show = (i, focus) => {
      index = Math.max(0, Math.min(steps.length - 1, i));
      steps.forEach((step, n) => { step.hidden = n !== index; });
      count.textContent = `第 ${index + 1} 步，共 ${steps.length} 步`;
      title.textContent = steps[index].dataset.title || "";
      fill.style.width = `${((index + 1) / steps.length) * 100}%`;
      back.hidden = index === 0;
      next.hidden = index === steps.length - 1;
      if (focus) {
        const field = steps[index].querySelector("input[type=text], input:not([type])");
        if (field && matchMedia("(pointer: fine)").matches) field.focus();
        flow.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    };
    back.addEventListener("click", () => show(index - 1, true));
    next.addEventListener("click", () => show(index + 1, true));
    // 在問題欄按 Enter 直接到下一步
    flow.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && event.target.matches("input[type=text]") && index < steps.length - 1) {
        event.preventDefault();
        show(index + 1, true);
      }
    });
    // 選好類別就自動往下一步
    flow.addEventListener("click", (event) => {
      if (event.target.closest(".flow-step[data-auto-next] .choices button")) setTimeout(() => show(index + 1, true), 220);
    });
    show(0, false);

    // 結果出現時只看結果
    if (result) {
      const again = Object.assign(document.createElement("button"), { type: "button", className: "flow-again", textContent: flow.dataset.again || "再問一件事" });
      result.before(again);
      const sync = () => {
        const done = !result.hidden;
        flow.hidden = done;
        again.hidden = !done;
      };
      again.addEventListener("click", () => {
        result.hidden = true;
        const question = flow.querySelector("#question");
        if (question) question.value = "";
        if (typeof resetRitual === "function") resetRitual();
        show(0, true);
      });
      new MutationObserver(sync).observe(result, { attributes: true, attributeFilter: ["hidden"] });
      sync();
    }
  }

  // ── 結果精簡：次要的卡片與段落先收起來 ──
  const makeToggle = (box, handle, open) => {
    if (!handle || box.classList.contains("foldable")) return;
    box.classList.add("foldable");
    box.classList.toggle("folded", !open);
    handle.classList.add("fold-handle");
    handle.setAttribute("role", "button");
    handle.tabIndex = 0;
    handle.setAttribute("aria-expanded", String(open));
    const toggle = () => {
      const folded = box.classList.toggle("folded");
      handle.setAttribute("aria-expanded", String(!folded));
    };
    handle.addEventListener("click", toggle);
    handle.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
    });
  };
  const fold = () => {
    if (!result) return;
    [...result.querySelectorAll(":scope > .card")].forEach((card, i) => {
      if (i === 0 || card.classList.contains("reading-card") || card.classList.contains("foldable")) return;
      makeToggle(card, card.querySelector(":scope > h2, :scope > .history-head h2, :scope > div > h2"), false);
    });
    result.querySelectorAll(".reading, .reading-card").forEach((box) => {
      box.querySelectorAll(".reading-part").forEach((part, i) => {
        const handle = part.querySelector(":scope > h5");
        // 結論和「具體建議」一直打開，其餘先收起來
        if (i >= 2 && handle && !/建議/.test(handle.textContent)) makeToggle(part, handle, false);
      });
    });
  };
  if (result) {
    new MutationObserver(fold).observe(result, { childList: true, subtree: true });
    fold(); // 有些頁面在這支程式載入前就已經畫好結果
  }
})();
