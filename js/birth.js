// 八字、紫微斗數、星盤、合盤共用：出生資料表單、多人儲存、時區與夏令時間換算、城市搜尋。
// 所有出生資料只存在這台裝置瀏覽器的 localStorage。只有按「搜尋城市」時，會把輸入的城市名稱送到 Open-Meteo 查經緯度。

const PEOPLE_KEY = "iching-people";
const CURRENT_KEY = "iching-person";
const LEGACY_BIRTH_KEY = "iching-birth"; // 舊版只存一個人，第一次載入時搬過來

// 出生地：[名稱, 緯度, 經度（東經為正）, 標準時區（UTC 幾小時）, 時區名稱]
// 同一個縣市內的差距對星盤影響很小（上升大約差零點幾度），所以每個縣市取一個代表點。
const PLACE_GROUPS = [
  ["台灣", [
    ["基隆", 25.13, 121.74], ["台北", 25.03, 121.56], ["新北", 25.01, 121.46], ["桃園", 24.99, 121.31],
    ["新竹", 24.81, 120.97], ["苗栗", 24.56, 120.82], ["台中", 24.15, 120.67], ["彰化", 24.08, 120.54],
    ["南投", 23.91, 120.68], ["雲林", 23.71, 120.54], ["嘉義", 23.48, 120.45], ["台南", 22.99, 120.21],
    ["高雄", 22.63, 120.30], ["屏東", 22.67, 120.49], ["宜蘭", 24.76, 121.75], ["花蓮", 23.98, 121.60],
    ["台東", 22.76, 121.14], ["澎湖", 23.57, 119.58], ["金門", 24.43, 118.32], ["馬祖", 26.16, 119.95],
  ].map((place) => [...place, 8, "Asia/Taipei"])],
  ["港澳與中國", [
    ["香港", 22.32, 114.17, 8, "Asia/Hong_Kong"], ["澳門", 22.20, 113.54, 8, "Asia/Macau"],
    ["北京", 39.90, 116.40, 8, "Asia/Shanghai"], ["上海", 31.23, 121.47, 8, "Asia/Shanghai"],
    ["廣州", 23.13, 113.26, 8, "Asia/Shanghai"], ["深圳", 22.54, 114.06, 8, "Asia/Shanghai"],
    ["廈門", 24.48, 118.09, 8, "Asia/Shanghai"], ["成都", 30.57, 104.07, 8, "Asia/Shanghai"],
  ]],
  ["其他地區", [
    ["新加坡", 1.35, 103.82, 8, "Asia/Singapore"], ["吉隆坡", 3.14, 101.69, 8, "Asia/Kuala_Lumpur"],
    ["東京", 35.68, 139.69, 9, "Asia/Tokyo"], ["首爾", 37.57, 126.98, 9, "Asia/Seoul"],
    ["倫敦", 51.51, -0.13, 0, "Europe/London"], ["紐約", 40.71, -74.01, -5, "America/New_York"],
    ["洛杉磯", 34.05, -118.24, -8, "America/Los_Angeles"], ["溫哥華", 49.28, -123.12, -8, "America/Vancouver"],
    ["雪梨", -33.87, 151.21, 10, "Australia/Sydney"],
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

// ── 儲存多個人 ──
function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 存不了就只在這次使用
  }
}

function loadPeople() {
  let people = readJson(PEOPLE_KEY, null);
  if (!Array.isArray(people)) {
    const legacy = readJson(LEGACY_BIRTH_KEY, null);
    people = legacy && legacy.year ? [{ ...legacy, id: "p1", name: "我" }] : [];
    if (people.length) writeJson(PEOPLE_KEY, people);
  }
  return people.filter((person) => person && person.id && person.year);
}

function currentPerson() {
  const people = loadPeople();
  return people.find((person) => person.id === readJson(CURRENT_KEY, null)) || people[0] || null;
}

function savePerson(person) {
  const people = loadPeople();
  const index = people.findIndex((p) => p.id === person.id);
  if (index >= 0) people[index] = person;
  else people.push(person);
  writeJson(PEOPLE_KEY, people);
  writeJson(CURRENT_KEY, person.id);
}

function deletePerson(id) {
  writeJson(PEOPLE_KEY, loadPeople().filter((person) => person.id !== id));
}

// ── 時區 ──
// 某個時區在「當地鐘面時間」那一刻，比世界時快幾小時（含夏令時間）。靠瀏覽器內建的時區資料庫。
function zoneOffset(tz, y, m, d, hour, minute) {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric",
  });
  const read = (instant) => {
    const parts = format.formatToParts(new Date(instant));
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return (Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute")) - instant) / 3600000;
  };
  const clock = Date.UTC(y, m - 1, d, hour, minute);
  return read(clock - read(clock) * 3600000);
}

// 補上計算需要的欄位：
//   zone  出生當時實際的時差（星盤用，含夏令時間）
//   dst   出生當時的鐘比標準時間快了幾小時（0 表示沒有）
//   clock 換回標準時間後的年月日時分（八字、紫微用）
function resolveBirth(person) {
  const birth = { ...person };
  let standard = Number(birth.zone);
  let actual = standard;
  if (birth.tz) {
    try {
      actual = zoneOffset(birth.tz, birth.year, birth.month, birth.day, birth.hour, birth.minute);
      // 標準時間取一月與七月中時差較小的那個（南北半球的夏令時間季節相反）
      standard = Math.min(zoneOffset(birth.tz, birth.year, 1, 1, 12, 0), zoneOffset(birth.tz, birth.year, 7, 1, 12, 0));
    } catch {
      actual = standard; // 瀏覽器不認得這個時區，就用表上的標準時差
    }
  }
  birth.zone = actual;
  birth.dst = Math.round((actual - standard) * 60) / 60;
  const shifted = new Date(Date.UTC(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute) - birth.dst * 3600000);
  birth.clock = {
    year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(),
  };
  return birth;
}

// 出生的絕對時刻（毫秒時間戳）：鐘面時間減去當時的時差
function birthInstant(birth) {
  return Date.UTC(birth.year, birth.month - 1, birth.day, birth.hour, birth.minute) - birth.zone * 3600000;
}

const pad2 = (n) => String(n).padStart(2, "0");
const birthLabel = (birth) => `${birth.year}/${birth.month}/${birth.day} ${pad2(birth.hour)}:${pad2(birth.minute)}`;
const dstNote = (birth) => (birth.dst
  ? `出生時當地的鐘比標準時間快 ${birth.dst} 小時（夏令時間），已自動換回標準時間 ${pad2(birth.clock.hour)}:${pad2(birth.clock.minute)} 來排盤。`
  : "");

// ── 城市搜尋（Open-Meteo 的免費地名查詢）──
async function searchPlaces(keyword) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=6&language=zh&format=json&name=${encodeURIComponent(keyword)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("查詢失敗");
  const data = await response.json();
  return (data.results || []).filter((r) => r.timezone).map((r) => ({
    name: r.name, detail: [r.admin1, r.country].filter(Boolean).join("，"),
    latitude: Math.round(r.latitude * 100) / 100, longitude: Math.round(r.longitude * 100) / 100, tz: r.timezone,
  }));
}

// ── 表單 ──
// 把表單畫到 container 裡，按下按鈕時儲存這個人並呼叫 onSubmit(birth)。
// 若先前存過資料，會自動帶入目前選的人並立刻排一次（options.auto 為 false 時不自動排）。
function birthForm(container, options, onSubmit) {
  const field = (labelText, input) => el("label", "field", [el("span", null, labelText), input]);
  const input = (type, extra = {}) => Object.assign(el("input"), { type, ...extra });
  const option = (value, text) => Object.assign(el("option", null, text), { value });

  const who = el("select");
  const name = input("text", { maxLength: 12, placeholder: "例如：我、媽媽、小明" });
  const date = input("date", { min: "1900-01-01", max: "2100-12-31" });
  const time = input("time", { value: "12:00" });
  const gender = el("select", null, [option("male", "男"), option("female", "女")]);
  const place = el("select");
  const latitude = input("number", { step: "0.01", min: "-66", max: "66" });
  const longitude = input("number", { step: "0.01", min: "-180", max: "180" });
  const zone = input("number", { step: "0.5", min: "-12", max: "14" });
  const custom = el("div", "fields", [field("緯度（北緯為正）", latitude), field("經度（東經為正）", longitude), field("時區（UTC＋幾小時）", zone)]);
  const searchInput = input("search", { placeholder: "清單裡沒有？輸入城市名稱搜尋" });
  const searchButton = Object.assign(el("button", null, "搜尋"), { type: "button" });
  const searchResults = el("div", "search-results");
  const error = el("p", "error");
  const submitButton = Object.assign(el("button", "primary", options.button || "排盤"), { type: "button" });
  const deleteButton = Object.assign(el("button", "link", "刪除這個人"), { type: "button" });
  error.hidden = true;

  let editingId = null;
  let found = null; // 搜尋選到的地點
  // 頂端一排人名：點一下就換人；存過的人不用再看整張表單
  const chips = el("div", "person-chips");
  const body = el("div", "birth-body");
  const setFolded = (value) => container.classList.toggle("folded", value);

  function fillPlaces() {
    place.replaceChildren(...[
      ...PLACE_GROUPS.map(([label, places]) => Object.assign(el("optgroup", null, places.map(([n]) => option(n, n))), { label })),
      found ? option("found", `${found.name}（搜尋結果）`) : null,
      option("custom", "自訂經緯度"),
    ].filter(Boolean));
  }

  function syncPlace() {
    custom.hidden = place.value !== "custom";
  }

  function fillPeople() {
    const people = loadPeople();
    who.replaceChildren(...people.map((person) => option(person.id, person.name)), option("", "＋ 新增一個人"));
    who.value = editingId || "";
    deleteButton.hidden = !editingId;
    const chip = (text, className, onClick) => {
      const button = Object.assign(el("button", `person-chip${className ? " " + className : ""}`, text), { type: "button" });
      button.addEventListener("click", onClick);
      return button;
    };
    chips.replaceChildren(
      ...people.map((person) => chip(person.name, person.id === editingId ? "active" : "", () => {
        load(person);
        submit();
      })),
      chip("＋ 新增", "add", () => { load(null); setFolded(false); name.focus(); }),
      editingId ? chip(container.classList.contains("folded") ? "修改資料" : "收起", "edit", () => {
        setFolded(!container.classList.contains("folded"));
        fillPeople();
      }) : null,
    );
    chips.hidden = !people.length;
  }

  // 把某個人的資料放進欄位；person 為 null 表示清空準備新增
  function load(person) {
    editingId = person ? person.id : null;
    name.value = person ? person.name : "";
    date.value = person ? `${person.year}-${pad2(person.month)}-${pad2(person.day)}` : "";
    time.value = person ? `${pad2(person.hour)}:${pad2(person.minute)}` : "12:00";
    gender.value = person ? person.gender : "male";
    const preset = person && PLACES.find(([n]) => n === person.place);
    found = person && !preset && person.tz ? { name: person.place, latitude: person.latitude, longitude: person.longitude, tz: person.tz } : null;
    fillPlaces();
    place.value = !person ? "台北" : preset ? person.place : found ? "found" : "custom";
    latitude.value = person ? person.latitude : 25.03;
    longitude.value = person ? person.longitude : 121.56;
    zone.value = person ? person.zone : 8;
    syncPlace();
    fillPeople();
  }

  function read() {
    const [year, month, day] = date.value.split("-").map(Number);
    const [hour, minute] = time.value.split(":").map(Number);
    if (!year || !month || !day) throw new Error("請填出生日期。");
    if (!Number.isFinite(hour)) throw new Error("請填出生時間。不知道確切時間的話，時辰會不準，可先填 12:00 參考。");
    const person = { id: editingId || `p${Date.now()}`, name: name.value.trim(), year, month, day, hour, minute: minute || 0, gender: gender.value };
    const preset = PLACES.find(([n]) => n === place.value);
    if (preset) Object.assign(person, { place: preset[0], latitude: preset[1], longitude: preset[2], zone: preset[3], tz: preset[4] });
    else if (place.value === "found" && found) Object.assign(person, { place: found.name, latitude: found.latitude, longitude: found.longitude, zone: 0, tz: found.tz });
    else Object.assign(person, { place: "custom", latitude: Number(latitude.value), longitude: Number(longitude.value), zone: Number(zone.value), tz: "" });
    if (![person.latitude, person.longitude, person.zone].every(Number.isFinite)) throw new Error("請填完整的經緯度與時區。");
    if (!person.name) person.name = loadPeople().length ? `${year} 年生` : "我";
    return person;
  }

  function submit() {
    error.hidden = true;
    try {
      const person = read();
      savePerson(person);
      editingId = person.id;
      name.value = person.name;
      setFolded(true);
      fillPeople();
      onSubmit(resolveBirth(person));
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    }
  }

  async function search() {
    const keyword = searchInput.value.trim();
    if (!keyword) return;
    searchResults.replaceChildren(el("p", "hint", "搜尋中…"));
    try {
      const results = await searchPlaces(keyword);
      if (!results.length) { searchResults.replaceChildren(el("p", "hint", "找不到這個地名，換個寫法試試，或改用「自訂經緯度」。")); return; }
      searchResults.replaceChildren(...results.map((result) => {
        const button = Object.assign(el("button", null, `${result.name}　${result.detail}`), { type: "button" });
        button.addEventListener("click", () => {
          found = result;
          fillPlaces();
          place.value = "found";
          syncPlace();
          searchResults.replaceChildren(el("p", "hint", `已選擇 ${result.name}（${result.latitude}°, ${result.longitude}°，${result.tz}）。`));
        });
        return button;
      }));
    } catch {
      searchResults.replaceChildren(el("p", "hint", "現在連不上地名查詢服務，請改用清單或「自訂經緯度」。"));
    }
  }

  who.addEventListener("change", () => {
    const person = loadPeople().find((p) => p.id === who.value) || null;
    load(person);
    if (person) submit();
  });
  place.addEventListener("change", syncPlace);
  submitButton.addEventListener("click", submit);
  searchButton.addEventListener("click", search);
  searchInput.addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); search(); } });
  deleteButton.addEventListener("click", () => {
    if (!deleteButton.dataset.armed) {
      deleteButton.dataset.armed = "1";
      deleteButton.textContent = "再按一次確定刪除";
      setTimeout(() => { delete deleteButton.dataset.armed; deleteButton.textContent = "刪除這個人"; }, 4000);
      return;
    }
    delete deleteButton.dataset.armed;
    deleteButton.textContent = "刪除這個人";
    deletePerson(editingId);
    load(null);
    if (options.onDelete) options.onDelete();
  });

  container.append(chips, body);
  body.append(
    el("div", "fields", [field("名字或稱呼", name)]),
    el("div", "fields", [field("出生日期（國曆）", date), field("出生時間", time), field("性別", gender), field("出生地", place)]),
    custom,
    el("div", "search-row", [searchInput, searchButton]),
    searchResults,
    el("p", "hint", "請填出生當地的鐘面時間，夏令時間會依出生地自動判斷。資料只存在這台裝置上。"),
    error,
    el("div", "actions", [submitButton, deleteButton])
  );

  const start = currentPerson();
  load(start);
  if (start && options.auto !== false) submit();
}
