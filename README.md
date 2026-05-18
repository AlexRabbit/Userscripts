If this helped you, consider starring the repo ⭐


# AlexRabbit Userscripts

Personal, curated userscripts — **one script per site** (or site family), tuned to work reliably in **[AdGuard for Windows](https://adguard.com/kb/general/extensions/)** and Tampermonkey.
 

---

## Quick install (AdGuard Desktop)

1. Open **AdGuard** → **Settings** → **Extensions**.
2. Enable **Userscript** support if it is not already on.
3. Click **Add userscript** → **Install from URL** (paste a raw `.js` link from the table below).

**Tip:** If a script works in Tampermonkey but not AdGuard, disable duplicate scripts on the same site and use `GM_getValue` (underscore), not `GM.getValue`.

**Forums + AdGuard:** Install [Forum_Rabbit.user.js](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.user.js) (small loader, ~2 KB). The full script is fetched from GitHub when you open a thread. Tampermonkey can use the full [Forum_Rabbit.js](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.js) instead.

---

## Scripts (A → Z by site)

| Site the script works on | Name | What it does | Install |
| --- | --- | --- | --- |
| **All websites** | **Global_Rabbit** | Restores right-click, copy, cut, text selection, and drag on sites that block them. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Global_Rabbit.js) |
| **Facebook** (`facebook.com`, Reels) | **Facebook_Rabbit** | Custom Reels player: seek bar, volume, speed, PiP, fullscreen, keyboard shortcuts. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Facebook_Rabbit.js) |
| **Forums** (XenForo / SimpCity-style threads) | **Forum_Rabbit** | Download images and videos from forum threads (bulk / zip). | [Install (AdGuard)](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.user.js) · [Full file](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.js) |
| **Instagram** | **Instagram_Rabbit** | Video controls + download buttons + removes copy blockers. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Instagram_Rabbit.js) |
| **News & magazines** (NYT, WSJ, Economist, …) | **News_Rabbit** | Bypasses paywalls on 160+ news domains. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/News_Rabbit.js) |
| **Telegram Web** (A / K / Z) | **Telegram_Rabbit** | Hides sponsored messages + download restricted channel media. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Telegram_Rabbit.js) |
| **TikTok** | **TikTok_Rabbit** | Download button next to Bookmark (For You, video pages, carousel). TikWM, no watermark, slideshow + cache + batch. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/TikTok_Rabbit.js) |

Install **Global_Rabbit** too if you want right-click / copy on sites that block it (works together with Instagram_Rabbit).
 

---
 
**Issues:** [github.com/AlexRabbit/Userscripts/issues](https://github.com/AlexRabbit/Userscripts/issues)
