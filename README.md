# AlexRabbit Userscripts

Personal, curated userscripts — **one script per site** (or site family), tuned to work reliably in **[AdGuard for Windows](https://adguard.com/kb/general/extensions/)** and Tampermonkey.

Naming: **`Site_Rabbit`** (e.g. `Instagram_Rabbit`) — easy to spot in AdGuard’s extension list.

Repo: [github.com/AlexRabbit/Userscripts](https://github.com/AlexRabbit/Userscripts)

---

## Quick install (AdGuard Desktop)

1. Open **AdGuard** → **Settings** → **Extensions**.
2. Enable **Userscript** support if it is not already on.
3. Click **Add userscript** → **Install from URL** (paste a raw `.js` link from the table below).
4. Confirm the script is **enabled** and applies to the right site.

**Tip:** If a script works in Tampermonkey but not AdGuard, disable duplicate scripts on the same site and use `GM_getValue` (underscore), not `GM.getValue`.

---

## Scripts (A → Z by site)

| Site the script works on | Name | What it does | Install |
| --- | --- | --- | --- |
| **All websites** | **Global_Rabbit** | Restores right-click, copy, cut, text selection, and drag on sites that block them. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Global_Rabbit.js) |
| **Facebook** (`facebook.com`, Reels) | **Facebook_Rabbit** | Custom Reels player: seek bar, volume, speed, PiP, fullscreen, keyboard shortcuts. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Facebook_Rabbit.js) |
| **Forums** (XenForo / SimpCity-style threads) | **Forum_Rabbit** | Download images and videos from forum threads (bulk / zip). | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.js) |
| **Instagram** | **Instagram_Rabbit** | Video controls + download buttons + removes copy blockers. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Instagram_Rabbit.js) |
| **News & magazines** (NYT, WSJ, Economist, …) | **News_Rabbit** | Bypasses paywalls on 160+ news domains. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/News_Rabbit.js) |
| **Telegram Web** (A / K / Z) | **Telegram_Rabbit** | Hides sponsored messages + download restricted channel media. | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Telegram_Rabbit.js) |

---

## Repo layout

```
Global_Rabbit.js       # all sites — unlock copy / right-click
Facebook_Rabbit.js     # facebook.com Reels
Forum_Rabbit.js        # forum threads
Instagram_Rabbit.js    # instagram.com
News_Rabbit.js         # news / paywall sites
Telegram_Rabbit.js     # web.telegram.org / webk / webz
lib/adguard-bootstrap.js
```

---

## Credits

Curated and packaged by **[AlexRabbit](https://github.com/AlexRabbit)**. See each script header for upstream authors and licenses.

**Issues:** [github.com/AlexRabbit/Userscripts/issues](https://github.com/AlexRabbit/Userscripts/issues)
