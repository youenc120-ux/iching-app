// 內建解讀：不靠 AI、不需金鑰，依卦辭爻辭、動爻、八卦象義與所問之事，用規則組出一篇解讀。
// 原則是實話實說：辭是凶就說凶，是吉就說吉，不替壞消息找台階，也不把好消息說得含糊。
// 入口是 composeReading(entry, result, guide)，回傳 { tone, sections: [{ title, text }] }。

// ── 吉凶評等 ── 每一卦七個數字：卦辭、初爻、二爻、三爻、四爻、五爻、上爻。
// 5 大吉、4 吉、3 平（無明確吉凶，或吉凶附帶條件）、2 不利、1 凶。
// 這是逐句依辭意人工評定的，不是數字眼；覺得哪一句評得不對，直接改這裡的數字。
const RATINGS = [
  "5343352", "4243351", "3322431", "3342243", "4342244", "2433452", "4341334", "4442441", // 乾坤屯蒙需訟師比
  "3442342", "4341425", "5443352", "2432444", "4322443", "5344345", "4444443", "4142433", // 小畜履泰否同人大有謙豫
  "4424343", "4433243", "4452344", "3333433", "4333431", "3334333", "2113143", "4543331", // 隨蠱臨觀噬嗑賁剝復
  "3432342", "4234545", "4111434", "3341431", "3132331", "4351134", "4322332", "4132231", // 无妄大畜頤大過坎離咸恆
  "3232344", "4142432", "4344243", "2233331", "4343544", "3333343", "3232234", "4342344", // 遯大壯晉明夷家人睽蹇解
  "4333454", "5553451", "3232231", "2332142", "4342432", "5534442", "3131333", "3223345", // 損益夬姤萃升困井
  "4342443", "5343145", "3433232", "3322334", "4341344", "1332341", "4432441", "3241341", // 革鼎震艮漸歸妹豐旅
  "4342441", "4441323", "4433533", "3312442", "4342341", "3131231", "3333232", "2242443", // 巽兌渙節中孚小過既濟未濟
];
const EXTRA_RATING = 4; // 用九、用六

// part："judgment"、"extra" 或爻的索引 0–5
function ratingOf(hex, part) {
  if (part === "extra") return EXTRA_RATING;
  const row = RATINGS[hex.number - 1];
  return Number(part === "judgment" ? row[0] : row[part + 1]);
}

const LEVELS = {
  5: { label: "大吉", tier: "good", verdict: "這是很好的卦。辭意明確有利，不必自己嚇自己，該做的就去做。" },
  4: { label: "吉", tier: "good", verdict: "結果是好的。照正路走可以成，但成是因為你做對了事，不是因為卦好就能鬆手。" },
  3: { label: "平", tier: "neutral", verdict: "這一卦沒有給你保證。它不是好消息，也不是壞消息，結果看你接下來實際怎麼做。" },
  2: { label: "不利", tier: "caution", verdict: "這一卦不順。辭裡指出的問題是真的存在，不是你多心，照現在的做法走下去會吃虧。" },
  1: { label: "凶", tier: "bad", verdict: "這一卦是凶。照目前的方向硬做，結果會是壞的，這一點沒有模糊空間。" },
};

// ── 八卦象義 ── inner：在下卦，代表自己與內在；outer：在上卦，代表環境與對方
const TRIGRAM_TRAITS = {
  乾: { inner: "你自己很強勢、很有主見，主導慾也強", outer: "對方或環境比你強，主導權不在你手上", way: "可以主動，但你最大的風險是太硬、聽不進別人的話" },
  坤: { inner: "你處在配合、承受的位置，不是能主導的一方", outer: "外在環境不會阻擋你，但也不會替你出力", way: "不要搶著帶頭，跟著對的人、把分內的事做足" },
  震: { inner: "你很想馬上動起來，心裡坐不住", outer: "外在會有突然的變動或衝擊", way: "要動可以，但先確定不是一時衝動" },
  巽: { inner: "你姿態放得低，習慣順著別人", outer: "外在情況多變，不會一次到位", way: "只能慢慢滲透，急不來；也別順從到沒有立場" },
  坎: { inner: "你心裡有擔憂，或者已經陷在麻煩裡", outer: "前面確實有險，不是你想太多", way: "不要冒進，一步一步來，說到的事要做到" },
  離: { inner: "你其實看得很清楚，心裡也有答案", outer: "事情是攤開的，瞞不住也躲不掉", way: "照你看清楚的事實去做，不要自己騙自己" },
  艮: { inner: "你在觀望，還沒有真的要動", outer: "外面有東西擋著，現在推不動", way: "該停就停，硬推只是白費力氣" },
  兌: { inner: "你心情是愉快的，也樂於開口", outer: "表面氣氛和樂，容易聽到好聽的話", way: "好好溝通，但別把場面話當成承諾" },
};

// 爻位的一般意義（初爻到上爻）
const POSITION_MEANINGS = [
  "動在初爻：事情才剛開始，你的力量還不夠，現在出手太早。",
  "動在二爻：你已經有立足點，穩穩做就好，不需要冒險。",
  "動在三爻：這是最容易出事的位置，上不著天、下不著地，多數麻煩出在這裡。",
  "動在四爻：你剛進入新的階段，位置還沒坐穩，容易動輒得咎。",
  "動在五爻：這是全卦最有力的位置，事情到了最成熟的時候。",
  "動在上爻：事情已經到頭了，再往前就是過頭，該想的是怎麼收。",
];

// ── 所問之事的面向 ── 依問題中的關鍵字歸類
const TOPICS = [
  { key: "love", name: "感情", words: ["感情", "愛", "婚", "戀", "對象", "男友", "女友", "男朋友", "女朋友", "交往", "復合", "桃花", "曖昧", "分手", "老公", "老婆", "伴侶", "喜歡", "挽回", "告白", "追他", "追她", "前任", "回來", "回頭", "想我"] },
  { key: "career", name: "事業", words: ["工作", "事業", "職", "升遷", "面試", "創業", "老闆", "主管", "公司", "同事", "跳槽", "offer", "專案", "合作", "裁", "離職", "辭職", "轉職", "加薪", "錄取", "上班"] },
  { key: "money", name: "財運", words: ["錢", "財", "投資", "股", "基金", "買", "賣", "生意", "收入", "薪", "貸", "房", "賺", "虧"] },
  { key: "study", name: "學業", words: ["考", "學", "升學", "論文", "成績", "申請", "讀書", "課"] },
  { key: "health", name: "健康", words: ["病", "健康", "身體", "手術", "醫", "痛", "懷孕", "康復"] },
  { key: "travel", name: "出行", words: ["旅", "出國", "搬", "遷", "移民", "出差", "遠行"] },
];

// 每個面向依評等 1–5 的直話（索引 0 不用）
const TOPIC_ADVICE = {
  love: [null,
    "感情上：這件事現在不成。對方的狀態或你們之間的問題不是多努力就能扭轉的，繼續投入多半只是拖長痛苦，該考慮停損。",
    "感情上：目前不順，而且問題出在實際的地方，不是誤會。你越急著要結果，對方越退。先停止追問和試探。",
    "感情上：看不出會成，也看不出不會成。別把對方的客氣或一時的熱絡當成答案，看他實際做了什麼。",
    "感情上：有成的機會，值得你主動。但要用行動經營，不要以為卦好就會自己水到渠成。",
    "感情上：很有利。對方有心，時機也對，該表達、該定下來的就去做，不必再試探。",
  ],
  career: [null,
    "事業上：現在動是錯的。換工作、提案、攤牌，這些此刻做都會吃虧。先保住現有的位置，別主動製造變數。",
    "事業上：阻力是真的，你目前的條件或時機不夠。硬要推進會碰壁，先補足缺的東西再說。",
    "事業上：沒有明確的好壞。機會不會自己掉下來，也沒有人在擋你，成不成看你拿得出什麼實績。",
    "事業上：方向是對的，可以爭取。但成果要靠你把事情做到位，不是靠運氣。",
    "事業上：時機成熟，該爭取的就開口，該接的就接。這時候猶豫才是損失。",
  ],
  money: [null,
    "財務上：不要做。這筆錢投下去虧損的機率高，借貸、擴張、跟單都一樣。保住本金是現在唯一該做的事。",
    "財務上：風險比你以為的大。你看到的獲利機會多半有你沒看到的代價，先不要加碼。",
    "財務上：賺賠都有可能，這一卦不替你背書。只能用虧得起的錢，而且要先想好虧了怎麼辦。",
    "財務上：可行，照計畫做就好。但見好要收，貪多會把賺到的吐回去。",
    "財務上：有利，可以依計畫進行。前提仍是量力而為，卦好不代表可以押上全部身家。",
  ],
  study: [null,
    "學業上：照現在的狀態去考，結果不會好。方法或基礎有明顯的問題，要認真面對，而不是多熬幾個晚上。",
    "學業上：準備不夠，或者方向偏了。現在的自我感覺比實際程度好，去做題驗證一下。",
    "學業上：結果還沒定，完全看剩下的時間你怎麼用。沒有捷徑，也沒有注定失敗。",
    "學業上：努力會有回報，照計畫持續就好，不要臨時改來改去。",
    "學業上：很有利，準備到位就會有好結果。保持平常心，別自己亂了陣腳。",
  ],
  health: [null,
    "健康上：卦象很不好，不要拖。該檢查的馬上去檢查，該治療的不要自己判斷可以再等。",
    "健康上：有需要正視的問題。身體給的訊號不要當作沒事，盡快去看醫生。",
    "健康上：沒有明顯的好壞，關鍵在你自己的作息和節制，而這些你大概心裡有數。",
    "健康上：趨勢是好的，照醫囑和規律作息持續下去。",
    "健康上：趨勢很好，不需要過度擔心，維持現在的做法即可。",
  ],
  travel: [null,
    "出行或遷移：不要去，或至少不要現在去。這一趟出問題的機會高。",
    "出行或遷移：不順，會遇到阻礙或白跑。能延就延；非去不可的話，把時間和備案留足。",
    "出行或遷移：可去可不去，卦象沒有偏向。問你自己這一趟是不是真的必要。",
    "出行或遷移：可行，把細節安排好就可以動身。",
    "出行或遷移：很順，放心去。",
  ],
  general: [null,
    "這件事現在不該做。不是要你多加小心地做，是不做。等情勢真的變了再說。",
    "這件事照目前的做法不會順。先停下來，找出辭裡點出的那個問題，處理了再往前。",
    "這件事成敗未定。卦沒有站在你這邊，也沒有站在對面，別指望運氣補上你沒做的部分。",
    "這件事可以做，而且做得成。把該做的做到位，結果就會是好的。",
    "這件事很有利，放手去做。這時候過度猶豫才是真正的風險。",
  ],
};

// chosen：使用者自己點選的類別；沒選（auto）才用問題裡的關鍵字判斷
function detectTopic(question, chosen) {
  const general = { key: "general", name: "整體" };
  if (chosen === "general") return general;
  if (chosen && chosen !== "auto") return TOPICS.find((topic) => topic.key === chosen) || general;
  const text = (question || "").toLowerCase();
  return TOPICS.find((topic) => topic.words.some((word) => text.includes(word))) || general;
}

// ── 問法 ── 同一個卦，問「該不該」「會不會」「什麼時候」要的答案不一樣。
// 先看問題是哪一種問法，再用那種問法該有的句子直接回答。由上往下比對，先符合的為準。
const QUESTION_FORMS = [
  ["choice", /還是|或者|或是|哪一個|哪個|哪一家|哪間|哪邊|選哪/],
  ["timing", /什麼時候|何時|幾時|多久|哪一年|哪年|幾月|幾歲|多快|要等到/],
  ["how", /怎麼辦|怎麼做|該怎麼|要怎麼|如何(做|處理|面對|解決|應對|改善|挽回)/],
  ["decision", /該不該|要不要|應不應該|可不可以|適不適合|好不好|值不值得|能不能(去|做|買|接|換|投|信|嫁|娶|簽)|是否(該|要|應|適合|值得)|(該|應該|要|可以|適合|值得|建議).*嗎|^(該|要不|可以).*/],
  ["mind", /(他|她|對方|前任|前男友|前女友|老公|老婆|先生|太太|男友|女友|主管|老闆|客戶).*(喜歡|愛|想我|想念|在乎|在意|感覺|心裡|真心|怎麼看|怎麼想|有意思)|對我.*(有意思|有感覺|真心|認真)/],
  ["outcome", /會不會|能不能|能否|是否|有沒有機會|成不成|過不過|順不順|會.*嗎|能.*嗎|有.*嗎|可能.*嗎|順利嗎|成功嗎|有機會/],
  ["state", /怎麼樣|怎樣|如何|運勢|狀況|近況|發展|走向|前景|運氣/],
];
// 問的是不是壞事會不會發生。這種問題，卦好代表「不會發生」，答案要反過來講。
const BAD_OUTCOME = /失敗|分手|離婚|離開我|被裁|裁員|失業|虧|賠|落榜|沒上|落選|出事|生病|惡化|復發|被騙|吃虧|倒閉|輸|背叛|外遇|出軌|劈腿|危險|後悔|被拒|拒絕|分開|翻臉|破局|黃掉|泡湯|告吹|被告|坐牢|出意外|變心|不要我/;

function detectForm(question) {
  const text = (question || "").trim();
  if (!text) return { type: "none" };
  const hit = QUESTION_FORMS.find(([, pattern]) => pattern.test(text));
  const type = hit ? hit[0] : "open";
  return { type, bad: type === "outcome" && BAD_OUTCOME.test(text) };
}

// 各種問法在評等 1–5 時的直接回答（索引 0 不用）
const FORM_ANSWERS = {
  decision: [null,
    "不該。這件事現在去做，結果會是壞的。",
    "先不要。照現在的條件去做會吃虧，等辭裡指出的問題解決了再說。",
    "卦沒有給你明確的「該」或「不該」。這代表關鍵不在運氣，而在你自己的條件和準備夠不夠；如果你本來就在猶豫，先別急著定。",
    "可以做。卦象支持，但要照正當的方式來，把準備做足。",
    "該。卦象明確支持你去做這件事，現在就是時機。",
  ],
  outcome: [null,
    "不會。至少在目前這個局面下，你期待的結果不會出現。",
    "照目前的情況發展下去，不太會。除非有什麼條件改變。",
    "還不一定。現在兩種結果都有可能，卦沒有偏向任何一邊。",
    "會。機會站在你這邊，但要你把該做的做到。",
    "會，而且會很順。",
  ],
  // 問的是壞事會不會發生：卦越好，越不會
  outcomeBad: [null,
    "很可能會。卦象是凶，你擔心的情況正是它警告的方向。",
    "有這個風險。卦象不順，你擔心的事是可能發生的，要提早處理。",
    "不一定。卦沒有說會，也沒有說不會，要看接下來怎麼處理。",
    "應該不會。整體是順的，你擔心的情況不是主要的走向。",
    "不會。卦象很好，你擔心的事不太會發生。",
  ],
  mind: [null,
    "對方沒有那個意思。繼續猜他的心意只是消耗自己。",
    "對方現在的心思不在你身上，或者他有顧慮。你感覺到的冷淡是真的。",
    "對方的態度不明朗，很可能他自己也還沒想清楚。別替他腦補答案。",
    "對方對你有好感，態度是正面的。",
    "對方對你是有心的，而且是真誠的。",
  ],
  state: [null,
    "目前的狀況不好，正處在低點或危險的位置。",
    "目前的狀況不順，有實際的阻礙在。",
    "目前的狀況平平，沒有大好也沒有大壞。",
    "目前的狀況不錯，方向是對的。",
    "目前的狀況很好，正在往上走。",
  ],
  choice: [null,
    "這一卦是凶：你心裡偏向的那個選項有嚴重的問題。",
    "這一卦不順：你心裡偏向的那個選項有問題，先別選它。",
    "這一卦沒有偏向，看不出哪個比較好。",
    "這一卦是好的：照你心裡偏向的那個去選，問題不大。",
    "這一卦很好：照你心裡偏向的那個去選。",
  ],
};

// 回答之後接的那句建議，也要跟著問法走（評等 1–5，索引 0 不用）。
// 沒列在這裡的問法（該不該、怎麼辦、現況如何）才用各類事情的通用建議。
const FORM_FOLLOWUPS = {
  outcome: [null,
    "先做好它不會發生的準備，把力氣放到別的地方。",
    "如果你很在意這個結果，現在就要改變做法；等下去不會自己變好。",
    "與其等結果，不如想想你還能做什麼，讓它往好的方向偏。",
    "把你能掌握的部分做好，結果就會出來。",
    "接下來照原本的步調做就好，不用多想。",
  ],
  outcomeBad: [null,
    "把它當成會發生來準備，先想好退路和應對。",
    "不要抱著僥倖，針對你擔心的那一點先做準備。",
    "你擔心的事有一半取決於你接下來怎麼處理，現在補救還來得及。",
    "保持現在的做法，別因為擔心而做出多餘的動作。",
    "不用為這件事焦慮，把心力放回該做的事上。",
  ],
  mind: [null,
    "把注意力收回自己身上，別再為了他調整自己。",
    "把注意力收回自己身上，別再為了他調整自己。",
    "先看他的實際行動，不要從隻字片語裡找答案。",
    "可以主動一點，給他回應的機會。",
    "可以主動一點，給他回應的機會。",
  ],
  timing: [null,
    "與其等，不如先處理卦裡指出的阻礙，否則等到了也留不住。",
    "與其等，不如先處理卦裡指出的阻礙，否則等到了也留不住。",
    "不要算日子，照常過，該做的事繼續做。",
    "在這之前把自己準備好，機會來的時候才接得住。",
    "在這之前把自己準備好，機會來的時候才接得住。",
  ],
  choice: [null, "", "", "", "", ""],
};

// 依問法組出「直說」的第一句
function directAnswer(form, level, movingCount) {
  switch (form.type) {
    case "decision": return FORM_ANSWERS.decision[level] + "（卦回答的是「去做你問的這件事」好不好。）";
    case "outcome": return (form.bad ? FORM_ANSWERS.outcomeBad : FORM_ANSWERS.outcome)[level];
    case "mind": return `${FORM_ANSWERS.mind[level]}卦反映的是他現在的狀態，人的想法會變；想知道確切的答案，最準的還是直接問他。`;
    case "state": return FORM_ANSWERS.state[level];
    case "choice":
      return "一個卦只能回答一件事，沒辦法同時比較兩個選項。" + FORM_ANSWERS.choice[level]
        + "想比清楚的話，把兩個選項分開，各問一次「選這個會怎麼樣」。";
    case "timing": {
      const pace = movingCount === 0 ? "卦裡沒有動爻，表示短期內局面不會變，這件事不會很快發生。"
        : level >= 4 ? "卦裡有動爻，事情已經在動了，而且走向是順的，不用等太久。"
        : level === 3 ? "卦裡有動爻，事情已經在動了，但進展不快，中間可能有反覆。"
        : "卦裡有動爻，事情在動，但過程有阻礙，會比你預期的晚，也可能不成。";
      return `卦辭不會給出確切的日期，只看得出快慢和順逆。${pace}`;
    }
    case "how": return `你問的是該怎麼做，具體的做法在下面「該怎麼做」那一段。先說整體：${LEVELS[level].verdict}`;
    case "open": return `這個問法我分不出你要的是「會不會」「該不該」還是別的，所以先給卦象整體的答案：${LEVELS[level].verdict}下次把問題寫成「我該不該……」或「……會不會成」，答案會更對題。`;
    default: return LEVELS[level].verdict;
  }
}

// 取出 readingGuide 標示的重點辭句（原文、白話與評等）
function focusTexts(result, guide) {
  return guide.focus.map((f) => {
    const hex = result[f.hex];
    const where = f.hex === "primary" ? "本卦" : "變卦";
    const rating = ratingOf(hex, f.part);
    const condition = CONDITIONS[`${hex.number}-${f.part === "judgment" ? 0 : f.part + 1}`];
    if (f.part === "judgment") {
      return { main: f.main, rating, condition, label: `${where}${hex.name}卦卦辭`, text: hex.judgment, plain: hex.judgmentPlain };
    }
    if (f.part === "extra") {
      return { main: f.main, rating, label: hex.name === "乾" ? "用九" : "用六", text: hex.extra.text, plain: hex.extra.plain };
    }
    const line = hex.lines[f.part];
    return { main: f.main, rating, condition, label: `${where}${lineTitle(f.part, hex.bits[f.part] === 1)}`, text: line.text, plain: line.plain };
  });
}

function composeReading(entry, result, guide) {
  const { primary, changed, mutual, moving } = result;
  const focus = focusTexts(result, guide);
  const main = focus.find((f) => f.main) || focus[0];
  const others = focus.filter((f) => f !== main);

  // 總評等：為主的辭句算兩份，其餘各算一份
  const level = Math.round((main.rating * 2 + others.reduce((sum, f) => sum + f.rating, 0)) / (2 + others.length));
  const tone = LEVELS[level];
  const topic = detectTopic(entry.question, entry.topic);
  const sections = [];

  // 一、直說：先照問法直接回答，再補上這一類事情的說明
  const form = detectForm(entry.question);
  const asked = entry.question ? `你問：「${entry.question}」\n` : "";
  const followTable = FORM_FOLLOWUPS[form.bad ? "outcomeBad" : form.type];
  let follow = followTable ? followTable[level] : TOPIC_ADVICE[topic.key][level];
  // 問健康：卦再壞也不是診斷，後面接的話要把人導向就醫，而不是叫人放棄
  if (followTable && topic.key === "health") {
    follow = level <= 2 ? "卦象不樂觀，但卦不是診斷，也不能決定病情。現在最該做的是照醫師的建議積極處理，不要拖。"
      : `${follow}身體的事以醫師的診斷為準。`;
  }
  sections.push({ title: "直說", text: [`${asked}${directAnswer(form, level, moving.length)}`, follow].filter(Boolean).join("\n") });

  // 二、依據：結論是從哪一句辭來的
  let basis = `依據是${main.label}：「${main.text}」意思是：${main.plain}`;
  if (main.condition) basis += `\n這句辭的吉凶是有條件的：${main.condition}`;
  else if (main.rating === 3) basis += "\n這句辭本身沒有斷言吉或凶。不要只挑你想聽的那一半來讀。";
  for (const other of others) {
    basis += `\n另一句要一起看的是${other.label}：「${other.text}」意思是：${other.plain}`;
    if (other.condition) basis += `（有條件：${other.condition}）`;
    if (Math.abs(other.rating - main.rating) >= 2) basis += "這一句和上一句的方向不同，表示事情有好有壞，不是單純的一面。";
  }
  if (moving.length === 1) basis += `\n${POSITION_MEANINGS[moving[0]]}`;
  sections.push({ title: "依據", text: basis });

  // 三、處境：本卦與內外卦
  const note = HEX_NOTES[primary.number - 1];
  const up = TRIGRAMS[primary.upper];
  const low = TRIGRAMS[primary.lower];
  const picture = primary.upper === primary.lower
    ? `上下都是${primary.upper}（${up.nature}），同一種性質疊在一起，特徵會更極端`
    : `上卦${primary.upper}（${up.nature}），下卦${primary.lower}（${low.nature}）`;
  sections.push({
    title: "處境",
    text: `本卦「${primary.fullName}」講的是「${note[0]}」：${note[1]}`
      + `\n卦象是${picture}。卦辭的意思：${primary.judgmentPlain}`
      + `\n你這一邊：${TRIGRAM_TRAITS[primary.lower].inner}。對方或環境那一邊：${TRIGRAM_TRAITS[primary.upper].outer}。`,
  });

  // 四、走向：比較本卦與變卦的卦辭評等
  let trend;
  if (!changed) {
    trend = "六爻都沒有動，代表局面不會自己改變。現在是什麼樣子，接下來一段時間就是什麼樣子；想要不同的結果，得由你去改變做法。";
  } else {
    const before = ratingOf(primary, "judgment");
    const after = ratingOf(changed, "judgment");
    const direction = after > before ? "後面會比現在好。眼前的難處是過程，不是結局。"
      : after < before ? "後面會比現在差。現在覺得還過得去，不代表之後也過得去，要趁早準備。"
      : "前後的基調差不多，不要期待事情自己出現大轉折。";
    trend = moving.length === 6
      ? `六爻全動，局面會整個翻過來，由「${primary.name}」變成「${changed.fullName}」。`
      : `有${"一二三四五"[moving.length - 1]}個爻在動，事情正在變，最後會走到變卦「${changed.fullName}」。`;
    trend += `${changed.judgmentPlain}\n${direction}`;
  }
  if (entry.method === "meihua") {
    const t = tiYong(result);
    trend += `\n中間的過程看互卦「${mutual.fullName}」：${mutual.judgmentPlain}`
      + `\n體用：代表你的體卦是${t.ti}（${t.tiElement}），代表這件事的用卦是${t.yong}（${t.yongElement}），${t.relation}。${t.verdict}`;
  }
  sections.push({ title: "走向", text: trend });

  // 五、該怎麼做
  const ways = primary.upper === primary.lower
    ? TRIGRAM_TRAITS[primary.lower].way
    : `你自己這邊，${TRIGRAM_TRAITS[primary.lower].way}。面對外在，記得${TRIGRAM_TRAITS[primary.upper].outer}，別用一廂情願的方式應對`;
  let action = `${note[2]}\n${ways}。\n《象傳》給這一卦的要求是：「${primary.image}」`;
  if (topic.key === "health") action += "\n身體的事以醫師的診斷為準，占卜不能代替檢查。";
  sections.push({ title: "該怎麼做", text: action });

  // 問「該怎麼做」的人要的是做法，把那一段提到結論的後面
  if (form.type === "how") sections.splice(1, 0, sections.pop());
  return { tone, sections, form: form.type };
}

// 讓 Node 也能載入做測試；在瀏覽器裡這段不會執行
if (typeof module !== "undefined") {
  module.exports = { RATINGS, ratingOf, detectTopic, detectForm, directAnswer, composeReading };
}
