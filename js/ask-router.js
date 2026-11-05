// 首頁「想問什麼？」：一個輸入框問所有事。依問題的字眼建議該用哪一種方法，並把問題帶過去（網址 ?q=…）。
// 規則都是關鍵字，寫在下面，不用 AI。

const ASK_EVENTS = [
  [/搬家|入厝|入宅|搬到|搬進/, "入宅", "搬家"], [/結婚|嫁娶|娶|出嫁|婚禮/, "嫁娶", "結婚"], [/訂婚|提親|文定/, "訂盟", "訂婚"],
  [/開幕|開市|開店|開業|開工/, "開市", "開業"], [/簽約|買賣|交易|買房|買車|過戶/, "交易", "簽約交易"], [/出遠門|旅行|出國|出發|旅遊/, "出行", "出門旅行"],
  [/動土|裝修|裝潢|修繕/, "動土", "動土裝修"], [/上任|到職|報到|上班第一天/, "上任", "到職"], [/手術|開刀|看醫生|就醫/, "求醫", "就醫手術"],
  [/拜拜|祈福|安太歲|點燈/, "祈福", "拜拜祈福"], [/入學|考試|開學/, "入學", "入學考試"],
];
const ASK_WHEN = /哪天|哪一天|哪幾天|日子|什麼時候|幾號|擇日|吉日|好日|哪個時間|時辰/;

function askRoutes(question) {
  const q = question.trim();
  const enc = encodeURIComponent(q);
  const routes = [];
  const event = ASK_EVENTS.find(([re]) => re.test(q));
  if (event && ASK_WHEN.test(q)) routes.push({ href: `almanac.html?event=${event[1]}#pick-card`, title: `挑${event[2]}的好日子`, why: "你問的是「哪天」，用農民曆擇日幫你挑，會避開沖到你的日子。" });
  if (/太歲|車關|血光|流年|安太歲|本命年/.test(q)) routes.push({ href: "taisui.html", title: "犯太歲・車關", why: "看今年犯不犯太歲、要不要防車關、哪幾個月要小心。" });
  if (/合不合|配不配|適不適合在一起|合盤|速配|八字合/.test(q)) routes.push({ href: "compat.html", title: "合盤", why: "用兩個人的八字、紫微、星盤看合不合、卡在哪裡。" });
  if (/名字|改名|取名|姓名/.test(q)) routes.push({ href: "name.html", title: "姓名學", why: "算名字的筆劃、五格三才，也能比較幾個名字。" });
  if (/手相|掌紋|手掌/.test(q)) routes.push({ href: "palm.html", title: "手相", why: "對照自己的手掌看四條主線。" });
  if (/個性|命盤|我是怎樣|天生|命格|一生/.test(q)) routes.push({ href: "profile.html", title: "我的命盤總覽", why: "八字、紫微、星盤、生命靈數、犯太歲一頁看完。" });

  // 一般的問題：卜卦、求籤、塔羅都能問，依主題排順序
  const love = /感情|喜歡|愛|復合|曖昧|對象|男友|女友|老公|老婆|另一半|桃花|分手|他|她/.test(q);
  const work = /工作|事業|換工作|面試|升遷|創業|生意|投資|錢|財|考試|升學/.test(q);
  const life = /家人|健康|平安|身體|家運|長輩|官司|運勢/.test(q);
  const asks = [
    { key: "iching", href: `iching.html?q=${enc}`, title: "易經卜卦", why: "分析最完整：先給結論，再說處境、走向和具體建議。" },
    { key: "qian", href: `qian.html?q=${enc}`, title: "求媽祖靈籤", why: "擲筊請示後抽籤，有籤詩、白話和傳統籤解。" },
    { key: "tarot", href: `tarot.html?q=${enc}`, title: "塔羅", why: "像聊天一樣，抽完還能追問「多久」「他怎麼想」。" },
  ];
  const order = love ? ["tarot", "iching", "qian"] : life ? ["qian", "iching", "tarot"] : work ? ["iching", "tarot", "qian"] : ["iching", "qian", "tarot"];
  asks.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  if (event && !ASK_WHEN.test(q)) asks.push({ href: `almanac.html?event=${event[1]}#pick-card`, title: `${event[2]}要挑日子`, why: "決定要做之後，可以用農民曆挑個好日子。" });
  return [...routes, ...asks];
}

(() => {
  const form = document.querySelector("#ask-any");
  if (!form) return;
  const input = form.querySelector("input");
  const out = document.querySelector("#ask-any-out");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const q = input.value.trim();
    if (!q) { input.focus(); return; }
    const routes = askRoutes(q);
    out.replaceChildren(
      el("p", "hint", "建議這樣問（第一個最適合，點了問題會自動帶過去）："),
      ...routes.map((r, i) => {
        const a = el("a", `ask-route${i === 0 ? " best" : ""}`, [el("b", null, r.title), el("small", null, r.why)]);
        a.href = r.href;
        return a;
      }),
    );
  });
})();
