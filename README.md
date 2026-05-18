# 🐰 Userscripts

Tuned for **[AdGuard for Windows](https://adguard.com/kb/general/extensions/)** first; works in Tampermonkey too.

---

## ⚡ Install (AdGuard)

1. Open **AdGuard → Settings → Extensions**
2. **Add extension** → paste a **raw** install URL from the table below  

AdGuard is pickier than Tampermonkey: prefer scripts with **`@grant none`** and no exotic APIs.

---

## 📋 Scripts

| Site | Script | What it does | Install |
|------|--------|--------------|---------|
| **All websites** | **Global_Rabbit** | Right‑click restored where blocked; contextmenu only (does not break buttons) | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Global_Rabbit.js) |
| **Instagram** | **Instagram_Rabbit** | Ultimate video controls (seek, speed, PiP, keyboard), downloads (posts/stories), overlay unlock | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Instagram_Rabbit.js) |
| **News & magazines** (169 domains) | **Paywall_Rabbit** | DOM paywall bypass (NYT, WaPo, Economist, Bloomberg, …) | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Paywall_Rabbit.js) |
| **simpcity.cr** | **Forum_Rabbit** | Media assistant, redirect, thumbs, bulk download, thread SIMP grid UI | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.js) |
| **Telegram Web** | **Telegram_Rabbit** | Hide sponsored UI; download viewer media (serial saves) | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Telegram_Rabbit.js) |
| **TikTok** | **TikTok_Rabbit** | No‑watermark download via TikWM; **download** button beside bookmark (FYP + video) | [Install](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/TikTok_Rabbit.js) |

---
 

## 🔐 TikTok private / friends-only

In the browser console on `tiktok.com`:

```js
localStorage.setItem('tiktok_rabbit_sessionid', 'YOUR_SESSIONID');
```

Same idea as [Ez-TikTok-Downloader](https://github.com/AlexRabbit/Ez-TikTok-Downloader). Clear the key to stop sending it.

---
 

Upstream authors are credited at the **bottom of each `.js` file**. Logic is modified and maintained by AlexRabbit — not affiliated with Meta, Telegram, TikTok, or publishers.

---
 
