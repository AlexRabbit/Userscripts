# 🐰 Userscripts by [AlexRabbit](https://github.com/AlexRabbit)

One **`.js` file per site** — no build step, no `node_modules`, no folders. Tuned for **[AdGuard for Windows](https://adguard.com/kb/general/extensions/)** first; works in Tampermonkey too.

> You host the canonical copies on GitHub and PR manually — this folder is your working copy before push.

---

## ⚡ Install (AdGuard)

1. Open **AdGuard → Settings → Extensions**
2. **Add extension** → paste a **raw** install URL from the table below  
   (after `main` on GitHub has the files: `https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/…`)

AdGuard is pickier than Tampermonkey: prefer scripts with **`@grant none`** and no exotic APIs.

---

## 📋 Scripts (A → Z by site)

| Site | Script | What it does | Install |
|------|--------|--------------|---------|
| **All websites** | **Global_Rabbit** | Right‑click, copy, cut, select, drag — restored where sites block them | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Global_Rabbit.js) |
| **Instagram** | **Instagram_Rabbit** | Ultimate video controls (seek, speed, PiP, keyboard), downloads (posts/stories), overlay unlock | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Instagram_Rabbit.js) |
| **News & magazines** (169 domains) | **Paywall_Rabbit** | DOM paywall bypass (NYT, WaPo, Economist, Bloomberg, …) | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Paywall_Rabbit.js) |
| **Simpcity & XenForo threads** | **Forum_Rabbit** | Bulk download images/videos from forum threads | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.js) |
| **Telegram Web** | **Telegram_Rabbit** | Hide sponsored UI; download viewer media (serial saves) | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Telegram_Rabbit.js) |
| **TikTok** | **TikTok_Rabbit** | No‑watermark download via TikWM; **Save** button next to Favorites | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/TikTok_Rabbit.js) |

---

## 🛠 AdGuard vs Tampermonkey

| Topic | Tip |
|-------|-----|
| **`@grant none`** | Global, Instagram, Telegram, TikTok, Paywall — best compatibility |
| **`@require` (Forum only)** | Loads JSZip/Tippy from CDN; allow those hosts in AdGuard or use Tampermonkey if bulk ZIP fails |
| **Paywalls** | DOM-only — no cookie/`webRequest` tricks; hardest sites may still need the official bypass extension |
| **Updates** | Each script ships `@updateURL` / `@downloadURL` pointing at this repo |

---

## 🔐 TikTok private / friends-only

In the browser console on `tiktok.com`:

```js
localStorage.setItem('tiktok_rabbit_sessionid', 'YOUR_SESSIONID');
```

Same idea as [Ez-TikTok-Downloader](https://github.com/AlexRabbit/Ez-TikTok-Downloader). Clear the key to stop sending it.

---

## 📦 What was merged (one file per site)

| Output | Sources merged |
|--------|----------------|
| **Instagram_Rabbit** | Ultimate Video Controls, Download Button, standard controls, Fix Post Right Click |
| **Global_Rabbit** | Unlock Website Limit + your Global_Rabbit pattern |
| **Telegram_Rabbit** | Ads remover + media downloader forks |
| **Paywall_Rabbit** | bypass-paywalls-tampermonkey |
| **Forum_Rabbit** | ForumPostDownloader |
| **TikTok_Rabbit** | Ez-TikTok-Downloader (TikWM) + Greasy Fork button placement |

Upstream authors are credited at the **bottom of each `.js` file**. Logic is modified and maintained by AlexRabbit — not affiliated with Meta, Telegram, TikTok, or publishers.

---

## 📄 License

MIT for AlexRabbit headers and glue. Upstream licenses (GPL, AGPL, etc.) still apply to derived portions where noted in script credits.
