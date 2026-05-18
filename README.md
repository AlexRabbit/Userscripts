# Userscripts by [AlexRabbit](https://github.com/AlexRabbit)

Personal, audited userscripts tuned for **[AdGuard for Windows](https://adguard.com/kb/general/extensions/)** and Tampermonkey. One file per site or scope — no extra folders, no build step on your side.

Install in AdGuard: **Settings → Extensions → Add extension → paste a raw `.js` URL** from the table below (after you push this repo to GitHub).

---

## Scripts (A–Z by site)

| Site | Script | What it does | Install |
|------|--------|--------------|---------|
| All websites | **Global_Rabbit** | Restores right‑click, copy, cut, text selection, and drag where sites block them | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Global_Rabbit.js) |
| Instagram | **Instagram_Rabbit** | Download posts, stories, profile media; native video controls with remembered volume | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Instagram_Rabbit.js) |
| News & magazines (169 domains) | **Paywall_Rabbit** | DOM paywall bypass for major publishers (NYT, WaPo, Economist, etc.) | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Paywall_Rabbit.js) |
| Simpcity & forum threads | **Forum_Rabbit** | Bulk download images/videos from XenForo-style thread pages | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.js) |
| Telegram Web | **Telegram_Rabbit** | Hides sponsored UI; download viewer media (serial file saves, no ZIP) | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Telegram_Rabbit.js) |
| TikTok | **TikTok_Rabbit** | No‑watermark download via TikWM; **Save** button beside Favorites | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/TikTok_Rabbit.js) |

---

## AdGuard vs Tampermonkey

| Topic | Tip |
|-------|-----|
| **`@grant none`** | Used wherever possible (Global, Instagram, Telegram, TikTok) — most reliable in AdGuard |
| **`@require`** | **Forum_Rabbit** loads JSZip/Tippy from CDN; allow those domains in AdGuard or use Tampermonkey if downloads fail |
| **Paywalls** | **Paywall_Rabbit** is DOM-only (`@grant none`). It does not use browser `webRequest` cookie tricks; some hard paywalls may still need the official extension |
| **Updates** | Each script has `@updateURL` / `@downloadURL` pointing at this repo |

---

## TikTok private videos (optional)

In the browser console on tiktok.com:

```js
localStorage.setItem('tiktok_rabbit_sessionid', 'YOUR_SESSIONID');
```

Same idea as [Ez-TikTok-Downloader](https://github.com/AlexRabbit/Ez-TikTok-Downloader).

---

## Merged sources (per script)

Details and upstream authors are in the **Credits** block at the bottom of each `.js` file. This collection merges and modifies work from Greasy Fork, GitHub, and my own tools — not affiliated with Meta, Telegram, TikTok, or publishers.

---

## License

MIT for **AlexRabbit** headers and glue code. Upstream licenses (GPL, etc.) still apply to derived logic inside individual scripts where noted.
