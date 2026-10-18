---
name: 觀象
description: Phone-first divination and almanac app; every verdict arrives as a seal impression.
colors:
  seal-vermilion: "#b02a1d"
  seal-vermilion-night: "#c23a27"
  vermilion-text-night: "#ee7259"
  vermilion-wash: "#f6e3de"
  stone-paper: "#eceeec"
  sheet-white: "#ffffff"
  sheet-tint: "#f3f5f3"
  hairline: "#dadedb"
  ink: "#1b1a18"
  ink-muted: "#5f6462"
  ochre: "#94621a"
  amber: "#a5650f"
  night-ground: "#121110"
  night-sheet: "#1b1a18"
  hue-qian-rouge: "#962140"
  hue-tarot-indigo: "#2d4a72"
  hue-bazi-malachite: "#2c6a51"
  hue-ziwei-purple: "#563c88"
  hue-astro-azurite: "#215f96"
  hue-numero-teal: "#1d6b65"
  hue-name-sienna: "#84491b"
  hue-compat-rouge: "#a8355c"
typography:
  seal:
    fontFamily: "Noto Serif TC, Songti TC, PMingLiU, serif"
    fontWeight: 900
    lineHeight: 1
  display-numeral:
    fontFamily: "Noto Serif TC, Songti TC, serif"
    fontSize: "4.6rem"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Noto Serif TC, Songti TC, serif"
    fontSize: "1.55rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.06em"
  title:
    fontFamily: "Noto Serif TC, Songti TC, serif"
    fontSize: "1.2rem"
    fontWeight: 700
    lineHeight: 1.4
  classical:
    fontFamily: "LXGW WenKai TC, Kaiti TC, BiauKai, serif"
    fontSize: "1.16rem"
    lineHeight: 1.7
  body:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.8
  label:
    fontFamily: "PingFang TC, Noto Sans TC, Microsoft JhengHei, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 700
    letterSpacing: "0.14em"
rounded:
  seal: "3px"
  chip: "4px"
  control: "8px"
  sheet: "10px"
  drawer: "16px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "14px"
  lg: "22px"
  gutter: "16px"
components:
  button-primary:
    backgroundColor: "{colors.seal-vermilion}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-secondary:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  choice-active:
    backgroundColor: "{colors.seal-vermilion}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.seal}"
    padding: "6px 13px"
  tone-good:
    backgroundColor: "{colors.seal-vermilion}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.seal}"
    padding: "1px 8px"
  tone-bad:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stone-paper}"
    rounded: "{rounded.seal}"
    padding: "1px 8px"
  sheet:
    backgroundColor: "{colors.sheet-white}"
    rounded: "{rounded.sheet}"
    padding: "22px"
  input:
    backgroundColor: "{colors.sheet-tint}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "46px"
  topbar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.sheet-white}"
    height: "52px"
  tabbar:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.ink-muted}"
    height: "60px"
---

# Design System: 觀象

## Overview

**Creative North Star: "The Seal on the Paper"**

觀象 is a seal-carving studio: a sheet of cool rice paper, a box of cinnabar paste, a stick of ink. A reading is not finished until it is stamped. Every decided thing (吉 or 凶, 宜 or 忌, the page you are on, the option you picked) appears as a carved square seal, and nothing else on the page is allowed to look like one.

The surface is quiet and phone-dense: white sheets on a stone-grey ground, hairline rules, an ink-black top bar and a white bottom tab bar. Colour is spent on meaning, never on atmosphere. There are no starfields, glows, gradients or per-page dark skins. Each method keeps its identity through one mineral pigment, used only on that page's header seal.

**Key Characteristics:**
- Vermilion means good, favourable, selected or "do this"; solid ink means bad or "avoid". This follows the two-colour logic of the printed almanac.
- Square seals with 3px corners and a thin inner white keyline, set in Noto Serif TC Black.
- Classical text (卦辭, 爻辭, 籤詩) is set in 楷書 (LXGW WenKai TC). Modern prose uses the system sans; headings use Song serif.
- One authored motion, 落印: a seal stamps in.
- Phone first. The bottom tabs are 今日, 卜卦, 求籤, 塔羅 and 全部; at 1100px and wider the grouped navigation moves into the top bar.

## Colors

The palette has three working colours: paper, ink and cinnabar. Section pigments appear only on seals.

### Primary
- **Seal Vermilion** (#b02a1d; at night the seal block is #c23a27 and vermilion text is #ee7259) carries the following:
  - 吉 and 宜
  - the selected state
  - the current tab
  - the primary button
  - the moving line in a hexagram
  - links

### Neutral
- **Stone Paper** (#eceeec): the page ground. It is cool and slightly green-grey, never cream.
- **Sheet White** (#ffffff) and **Sheet Tint** (#f3f5f3): sheets and their insets.
- **Hairline** (#dadedb): every divider and border.
- **Ink** (#1b1a18): text, the top bar, and 凶 and 忌 seals.
- **Ink Muted** (#5f6462): secondary text.

### Section pigments
Each pigment is used only as a page seal or an index-row seal, never as a background field or text colour:
- 求籤: rouge #962140
- 塔羅: indigo #2d4a72
- 八字: malachite #2c6a51
- 紫微: purple #563c88
- 星盤: azurite #215f96
- 生命靈數: teal #1d6b65
- 姓名學: sienna #84491b
- 合盤: rouge #a8355c
- 六十四卦 and 依據: ink #3a3733

**The Two Inks Rule.** Good is vermilion and bad is ink, everywhere. Green never means "good", and red never means "bad".

**The Pigment Rule.** A section pigment appears only inside a seal. It never tints the page, a card or the text.

## Typography

**Seal and display:** Noto Serif TC, weight 900. **Headings:** Noto Serif TC 700. **Classical:** LXGW WenKai TC. **Body:** the platform's Chinese sans (PingFang TC or Microsoft JhengHei).

Hierarchy comes from scale contrast:
- The day numeral is 4.6rem, set beside 0.84rem metadata.
- Page titles are 1.55rem and section titles 1.2rem.
- Labels are 0.78rem with wide tracking.
- Body text is 16px with 1.8 line height, for long Chinese readings on a phone.

**The Classical Hand Rule.** Any quotation of a source text is set in 楷書. Plain-language explanation is never set in 楷書.

## Layout

- The content column is 760px wide with 16px side gutters.
- Sheets stack with 14px gaps.
- The home page reads in this order:
  1. Today sheet
  2. Primary actions, a 2×2 grid on phones and 4 across on wider screens
  3. 今日運勢 for each saved person
  4. 今日一卦 and 今日塔羅
  5. The grouped index (問事, 日子, 命盤, 查閱)
- Below 1100px a fixed tab bar sits at the bottom, 60px plus the safe area. 全部 opens a bottom sheet (a native `popover`) that lists every page in groups.
- At 1100px and wider the tab bar is hidden and the same grouped list sits inline in the top bar.

## Elevation & Depth

The system is flat paper. Sheets use a 1px hairline and a barely visible 1px shadow. Floating things use a single lift shadow: the tarot composer, the dialog and the bottom sheet. Coloured glows are never used.

## Shapes

- 3px: seals, tone stamps, choice chips and steps.
- 4px: chips and tags.
- 8px: controls.
- 10px: sheets.
- 16px: the top corners of the bottom sheet.

Pills are not used, except for hexagram-line and five-element bar ends.

## Components

- **Seal** (`.seal`):
  - 1.9em square, set in Noto Serif TC Black.
  - Background is `var(--hue)`, falling back to vermilion; text is white.
  - Inner keyline: `inset 0 0 0 2px hue, inset 0 0 0 3px rgba(255,255,255,.5)`.
- **Tone stamp** (`.tone`):
  - good: vermilion block.
  - bad: ink block.
  - neutral: muted outline.
  - caution: amber outline.
  - It stamps in when a verdict appears.
- **Buttons:**
  - primary: a solid vermilion block.
  - secondary: a white sheet with a hairline border.
  - Pressing scales the button to 0.97.
- **Choices:** the selected option becomes a vermilion seal.
- **Segmented tabs:** a tinted track, with the active segment as a white sheet and vermilion text.
- **Tab bar:** icons are drawn SVG, 24px with a 1.6 stroke. The current tab's icon sits inside a vermilion seal.
- **Index row:** pigment seal, serif name, one-line description and a chevron. Rows are grouped in one sheet per group.
- **Person row** (今日運勢): every row has the same fixed contents: name, the day's 十神 in vermilion, the advice, and an optional ink or vermilion note.

**The 落印 Rule.** The only authored entrance is `stamp`:
- It runs for 0.5s with `cubic-bezier(0.16, 1, 0.3, 1)`.
- It scales from 1.32 to 1, rotates from −7° to 0 and clears a 3px blur.
- It applies to page seals, the current tab, 宜 and 忌, verdict tones and score seals.
- With reduced motion, the seal is already stamped.

## Do's and Don'ts

- Do stamp every verdict as a seal; let plain prose carry the explanation.
- Do keep the ground cool stone-grey; if it drifts toward cream, it is wrong.
- Do set quoted source text in 楷書.
- Don't give a page its own background colour or dark skin; pigments live only in seals.
- Don't use green for good or red for bad.
- Don't add glows, gradient text, coloured side stripes or kicker labels above headings.
- Don't use emoji or Unicode glyphs as icons; draw SVG at the tab-bar stroke weight.
