---
name: 觀象
description: Phone-first divination and almanac app in a night-sky and gold style.
colors:
  night: "#0d0b1e"
  night-solid: "#1b1638"
  glass: "rgba(255, 255, 255, 0.065)"
  glass-2: "rgba(255, 255, 255, 0.08)"
  hairline: "rgba(255, 255, 255, 0.13)"
  starlight: "#efeaff"
  lavender-muted: "#b4acd8"
  gold: "#f1d08a"
  gold-deep: "#c9954a"
  gold-wash: "rgba(241, 208, 138, 0.15)"
  on-gold: "#2a1b05"
  lilac: "#c3a6ff"
  rose: "#ff8fa3"
typography:
  display-numeral:
    fontFamily: "Noto Serif TC, serif"
    fontSize: "4.4rem"
    fontWeight: 700
    lineHeight: 0.9
  headline:
    fontFamily: "Noto Serif TC, serif"
    fontSize: "1.55rem"
    fontWeight: 700
  classical:
    fontFamily: "LXGW WenKai TC, Kaiti TC, serif"
    fontSize: "1.16rem"
    lineHeight: 1.7
  body:
    fontFamily: "Noto Sans TC, PingFang TC, Microsoft JhengHei, sans-serif"
    fontSize: "16px"
    lineHeight: 1.8
rounded:
  control: "14px"
  card: "22px"
  pill: "999px"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  card:
    backgroundColor: "{colors.glass}"
    rounded: "{rounded.card}"
    padding: "22px"
  tone-good:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.on-gold}"
    rounded: "{rounded.pill}"
  tone-bad:
    backgroundColor: "{colors.gold-wash}"
    textColor: "{colors.rose}"
    rounded: "{rounded.pill}"
---

# Design System: 觀象

The user picked this direction (「A 星夜金」) out of three mockups made with the ui-ux-pro-max skill.

## Overview

**Creative North Star: "Gold Under the Night Sky"**

The ground is a deep night sky: #0d0b1e under soft purple and blue glows that stay fixed while the page scrolls. Cards are semi-transparent frosted glass with 1px pale borders and 22px corners. Gold is saved for what matters: 吉 and 宜, the selected item, the primary button and the moving line in a hexagram. Bad things (凶, 忌, a clash) are rose. The site is always dark and does not switch to a light mode.

## Colors
- Text is starlight #efeaff; secondary text is lavender #b4acd8.
- Gold #f1d08a is used for text. Filled gold elements use a gradient from #f6dc9c to #c9954a, with dark brown text #2a1b05.
- Each method colours only its page-header badge and its badge in the home index, using `--hue`:
  - 求籤 coral
  - 塔羅 periwinkle
  - 八字 mint
  - 紫微 violet
  - 星盤 sky blue
  - 生命靈數 teal
  - 姓名學 apricot
  - 合盤 pink

## Typography
- Headings and numerals: Noto Serif TC.
- Prose: Noto Sans TC.
- Quoted classical text: LXGW WenKai TC (楷書).

## Layout
- Content column 760px. Top bar: gold 觀象 wordmark plus a horizontally scrolling pill menu of all 13 pages (current page = gold pill, centred on load). No bottom tab bar (the user asked for the top menu).
- Home: greeting, today card, then swipeable rails (scroll-snap) of large cover cards that use the ink paintings and tarot art (問一件事 = big 4:5 cards; 看命盤 and 日子與查閱 = small 3:4 cards), personal 今日運勢, and a rail with 今日一卦 / 今日塔羅. On ≥900px rails become even grids.
- One step per screen: [data-flow] containers (卜卦, 求籤) show one .flow-step at a time with a progress bar, 「第 n 步，共 3 步」, 上一步／下一步; choosing a category auto-advances. When #result appears the steps hide and 「再問一件事」 returns to step 1 (js/flow.js).
- Conclusion first: in #result only the first card and the 解讀 card stay open; other cards fold behind their heading. Inside a reading, the first two parts and any 「建議」 part stay open; the rest fold. The 卜卦 直說 text is split at its 【小標】 into separate parts.
- 命盤 pages: saved people appear as chips at the top of the birth-data card; once a chart is drawn the form folds away (「修改資料」 reopens it, 「＋ 新增」 starts a new person).

## Do's and Don'ts
- Do keep gold for good, selected and primary states only.
- Do use rose for bad states, never red.
- Don't put light backgrounds behind sections. The tarot cards, the oracle slip and the ink paintings are the only light objects.
- Don't use emoji as icons. The tab icons are drawn SVG.
