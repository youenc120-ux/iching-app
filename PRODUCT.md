# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
The owner, their family and friends. They open it on a phone, casually: on the commute, before bed, or when something is on their mind and they want to ask about it. Many open it daily to check today's fortune (today's almanac, hexagram, tarot card and personal outlook). Occasionally a result is shared with someone else as an image.

## Product Purpose
觀象 is a personal divination and fate-reading app in Traditional Chinese (Taiwan usage). It lets someone ask a question and get a direct, honest, specific answer, or look up their own chart, with the reasoning and sources visible. Success is a reading that answers the question actually asked, plainly, and a daily page worth opening every morning.

## Positioning
Many methods in one place, all computed on the device: I Ching casting (coins, yarrow, plum blossom) with Na Jia, Mazu 60-jiazi temple oracle with moon blocks, chat-style tarot, BaZi, Zi Wei Dou Shu, Western natal chart, compatibility, farmer's almanac with date selection, life-path numerology and name analysis. Readings are rule-based (no AI), blunt rather than flattering, and every method states its sources and limits on 依據與來源.

## Operating Context
Mostly a phone browser, also installable as a PWA (offline-capable via a service worker). Birth data for several people, reading history and daily draws live only in the browser's localStorage. Results can be saved as poster images for sharing. Readings are long-form Chinese text read on a small screen.

## Capabilities and Constraints
- No-build static site: plain HTML/CSS/JS with classic script tags, published on GitHub Pages (`youenc120-ux/iching-app`). Must stay dependency-free; only Google Fonts may be loaded.
- 13 pages: 首頁（今日）, 農民曆, 卜卦, 求籤, 塔羅, 六十四卦, 八字, 紫微斗數, 星盤, 生命靈數, 姓名學, 合盤, 依據與來源.
- Readings are rule-based, never AI; nothing is uploaded.
- Content (classical texts, poems, meanings, interpretations) and all functions must be preserved through any visual change.

## Brand Commitments
- Name: 觀象. Language: Traditional Chinese (Taiwan).
- Voice: honest and direct (實話實說), concrete advice, no sugar-coating; limits and sources stated plainly.
- The owner has said the whole visual style may be replaced; per-method colour themes, the 64 ink-wash hexagram paintings and the ink-wash tarot deck are not binding.

## Evidence on Hand
- 64 ink-wash hexagram paintings (`images/hex/`), 78-card ink-wash tarot deck (`images/tarot-ink/`), 1909 Rider–Waite scans (`images/tarot/`).
- Classical source texts and cross-checked data (I Ching, 60 temple oracle poems, Kangxi stroke table) documented on about.html.
- No testimonials, user counts or press exist; none may be invented.

## Product Principles
1. Answer the question that was asked, plainly; never flatter.
2. Every reading shows where it comes from and what it cannot know.
3. Phone first: a quick daily glance and a one-handed question must both feel effortless.
4. Everything stays on the device.
