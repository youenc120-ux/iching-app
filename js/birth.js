// 八字、紫微斗數、星盤共用：出生資料表單、儲存，以及農曆換算。
// 出生資料只存在這台裝置瀏覽器的 localStorage，不會傳到任何地方。

const BIRTH_KEY = "iching-birth";

// 出生地：[名稱, 緯度, 經度（東經為正）, 時區（UTC 幾小時）]
// 同一個縣市內的差距對星盤影響很小（上升大約差零點幾度），所以每個縣市取一個代表點。
const PLACE_GROUPS = [
  ["台灣", [
    ["基隆", 25.13, 121.74, 8], ["台北", 25.03, 121.56, 8], ["新北", 25.01, 121.46, 8], ["桃園", 24.99, 121.31, 8],
    ["新竹", 24.81, 120.97, 8], ["苗栗", 24.56, 120.82, 8], ["台中", 24.15, 120.67, 8], ["彰化", 24.08, 120.54, 8],
    ["南投", 23.91, 120.68, 8], ["雲林", 23.71, 120.54, 8], ["嘉義", 23.48, 120.45, 8], ["台南", 22.99, 120.21, 8],
    ["高雄", 22.63, 120.30, 8], ["屏東", 22.67, 120.49, 8], ["宜蘭", 24.76, 121.75, 8], ["花蓮", 23.98, 121.60, 8],
    ["台東", 22.76, 121.14, 8], ["澎湖", 23.57, 119.58, 8], ["金門", 24.43, 118.32, 8], ["馬祖", 26.16, 119.95, 8],
  ]],
  ["港澳與中國", [
    ["香港", 22.32, 114.17, 8], ["澳門", 22.20, 113.54, 8], ["北京", 39.90, 116.40, 8], ["上海", 31.23, 121.47, 8],
    ["廣州", 23.13, 113.26, 8], ["深圳", 22.54, 114.06, 8], ["廈門", 24.48, 118.09, 8], ["成都", 30.57, 104.07, 8],
  ]],
  ["其他地區", [
    ["新加坡", 1.35, 103.82, 8], ["吉隆坡", 3.14, 101.69, 8], ["東京", 35.68, 139.69, 9], ["首爾", 37.57, 126.98, 9],
    ["倫敦", 51.51, -0.13, 0], ["紐約", 40.71, -74.01, -5], ["洛杉磯", 34.05, -118.24, -8],
    ["溫哥華", 49.28, -123.12, -8], ["雪梨", -33.87, 151.21, 10],
  ]],
];
const PLACES = PLACE_GROUPS.flatMap(([, places]) => places);
function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (Array.isArray(content)) node.append(...content.filter(Boolean));
  else if (content != null) node.textContent = content;
  return node;
}

function loadBirth() {
  try {
    return JSON.parse(localStorage.getItem(BIRTH_KEY)) || null;
  } catch {
    return null;
  }
}

function saveBirth(birth) {
  try {
    localStorage.setItem(BIRTH_KEY, JSON.stringify(birth));
  } catch {
    // 存不了就只在這次使用
  }
}

// 出生的絕對時刻（毫秒時間戳）：鐘面時間減去時區
function birthInstant(birth) {
  return Date.UTC(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute) - birth.zone * 3600000;
}

// 農曆換算 lunarOf() 在 divination.js。

// 把表單畫到 container 裡。options.place 為 true 時多出出生地欄位（星盤用）。
// 按下按鈕時呼叫 onSubmit(birth)；若先前存過資料，會自動帶入並立刻排一次。
function birthForm(container, options, onSubmit) {
  const saved = loadBirth() || {};
  const field = (labelText, input) => el("label", "field", [el("span", null, labelText), input]);
  const input = (type, value, extra = {}) => Object.assign(el("input"), { type, value: value ?? "", ...extra });

  const date = input("date", saved.year ? `${saved.year}-${String(saved.month).padStart(2, "0")}-${String(saved.day).padStart(2, "0")}` : "", { min: "1900-01-01", max: "2100-12-31" });
  const time = input("time", saved.year ? `${String(saved.hour).padStart(2, "0")}:${String(saved.minute).padStart(2, "0")}` : "12:00");
  const gender = el("select", null, [["male", "男"], ["female", "女"]].map(([value, text]) => Object.assign(el("option", null, text), { value })));
  gender.value = saved.gender || "male";

  const place = el("select", null, [
    ...PLACE_GROUPS.map(([label, places]) => Object.assign(
      el("optgroup", null, places.map(([name]) => Object.assign(el("option", null, name), { value: name }))), { label })),
    Object.assign(el("option", null, "自訂經緯度"), { value: "custom" }),
  ]);
  place.value = saved.place || "台北";
  const latitude = input("number", saved.latitude ?? 25.03, { step: "0.01", min: "-66", max: "66" });
  const longitude = input("number", saved.longitude ?? 121.56, { step: "0.01", min: "-180", max: "180" });
  const zone = input("number", saved.zone ?? 8, { step: "0.5", min: "-12", max: "14" });
  const custom = el("div", "fields", [field("緯度（北緯為正）", latitude), field("經度（東經為正）", longitude), field("時區（UTC＋幾小時）", zone)]);
  const syncPlace = () => {
    const preset = PLACES.find(([name]) => name === place.value);
    custom.hidden = Boolean(preset);
    if (preset) [latitude.value, longitude.value, zone.value] = [preset[1], preset[2], preset[3]];
  };
  place.addEventListener("change", syncPlace);
  syncPlace();

  const error = el("p", "error");
  error.hidden = true;
  const button = el("button", "primary", options.button || "排盤");
  button.type = "button";

  const submit = () => {
    error.hidden = true;
    try {
      const [year, month, day] = date.value.split("-").map(Number);
      const [hour, minute] = time.value.split(":").map(Number);
      if (!year || !month || !day) throw new Error("請填出生日期。");
      if (!Number.isFinite(hour)) throw new Error("請填出生時間。不知道確切時間的話，時辰會不準，可先填 12:00 參考。");
      const birth = {
        year, month, day, hour, minute: minute || 0, gender: gender.value,
        place: place.value, latitude: Number(latitude.value), longitude: Number(longitude.value), zone: Number(zone.value),
      };
      if (![birth.latitude, birth.longitude, birth.zone].every(Number.isFinite)) throw new Error("請填完整的經緯度與時區。");
      saveBirth(birth);
      onSubmit(birth);
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  };
  button.addEventListener("click", submit);

  container.append(...[
    el("div", "fields", [field("出生日期（國曆）", date), field("出生時間", time), field("性別", gender), options.place ? field("出生地", place) : null]),
    options.place ? custom : null,
    el("p", "hint", "請填當地的鐘面時間。台灣在 1945–1979 年間有些年份實施過夏令時間，那段期間夏天出生的人要先減一小時。資料只存在這台裝置上。" + (options.place ? "出生地不在清單上的話，選最近的城市或「自訂經緯度」。" : "")),
    error,
    el("div", "actions", [button]),
  ].filter(Boolean));
  if (saved.year) submit();
}
