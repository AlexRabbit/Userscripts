// ==UserScript==
// @name         TikTok_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.0.0
// @description  Download TikTok videos without watermark via TikWM (Ez-TikTok-Downloader flow). Button beside Favorites.
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://www.tiktok.com/*
// @match        https://m.tiktok.com/*
// @match        https://vt.tiktok.com/*
// @match        https://vm.tiktok.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/TikTok_Rabbit.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/TikTok_Rabbit.js
// @supportURL   https://github.com/AlexRabbit/Userscripts/issues
// ==/UserScript==

(function () {
    'use strict';

    const SUBMIT_URL = 'https://tikwm.com/api/video/task/submit';
    const RESULT_BASE = 'https://tikwm.com/api/video/task/result?task_id=';
    const POLL_MS = 1000;
    const POLL_MAX = 60;
    const SESSION_KEY = 'tiktok_rabbit_sessionid';
    const CACHE_KEY = 'tiktok_rabbit_cache';

    const TIKWM_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: 'https://tikwm.com',
        Referer: 'https://tikwm.com/',
        'x-requested-with': 'XMLHttpRequest',
    };

    const BTN_CLASS = 'tiktok-rabbit-dl';
    const BTN_SVG = `<svg viewBox="0 0 24 24" width="1.25em" height="1.25em" fill="currentColor" aria-hidden="true"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`;

    const style = document.createElement('style');
    style.textContent = `
.${BTN_CLASS}{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
cursor:pointer;background:transparent;border:0;color:inherit;padding:0;min-width:48px;font:inherit}
.${BTN_CLASS}:disabled{opacity:.45;cursor:wait}
.${BTN_CLASS} span{font-size:12px;line-height:1.2;font-weight:600}
#tiktok-rabbit-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;
padding:10px 18px;border-radius:8px;background:rgba(0,0,0,.82);color:#fff;font:14px/1.4 system-ui,sans-serif;
pointer-events:none;max-width:90vw;text-align:center}`;
    document.head.appendChild(style);

    let toastTimer;
    function toast(msg) {
        let el = document.getElementById('tiktok-rabbit-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'tiktok-rabbit-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.remove(), 5000);
    }

    function sanitize(name) {
        return String(name).replace(/[<>:"/\\|?*]/g, '_').trim() || 'unknown';
    }

    function normalizeUrl(url) {
        let u = url.trim();
        if (u.includes('#')) u = u.split('#')[0];
        if (u.includes('?')) u = u.split('?')[0];
        return u.replace(/\/$/, '');
    }

    function extractId(url) {
        const m = url.match(/\/(?:video|photo)\/(\d+)/);
        return m ? m[1] : null;
    }

    function extractUser(url) {
        const m = url.match(/tiktok\.com\/@([\w.-]+)/i);
        return m ? m[1] : 'unknown';
    }

    function urlCandidates(url) {
        const n = normalizeUrl(url);
        const id = extractId(n);
        const list = [n];
        if (id) {
            [
                `https://www.tiktok.com/video/${id}`,
                `https://www.tiktok.com/@tiktok/video/${id}`,
                `https://m.tiktok.com/v/${id}.html`,
            ].forEach((c) => {
                if (!list.includes(c)) list.push(c);
            });
        }
        return list;
    }

    async function resolveShort(url) {
        if (!/https?:\/\/(vt|vm)\.tiktok\.com\//i.test(url)) return url;
        try {
            const r = await fetch(url, { redirect: 'follow' });
            if (r.url && r.url.includes('tiktok.com')) return r.url;
        } catch {}
        return url;
    }

    function apiHeaders() {
        const h = { ...TIKWM_HEADERS };
        const sid = localStorage.getItem(SESSION_KEY);
        if (sid) {
            h.Referer = `https://www.tikwm.com/originalDownloader.html?cookie=sessionid=${sid}`;
            h['x-proxy-cookie'] = `sessionid=${sid}`;
        }
        return h;
    }

    function loadCache() {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        } catch {
            return {};
        }
    }

    function saveCacheEntry(id, entry) {
        const c = loadCache();
        c[id] = entry;
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(c));
        } catch {}
    }

    async function submitTikwm(tiktokUrl) {
        const headers = apiHeaders();
        for (const candidate of urlCandidates(tiktokUrl)) {
            try {
                const res = await fetch(SUBMIT_URL, {
                    method: 'POST',
                    headers,
                    body: `web=1&url=${encodeURIComponent(candidate)}`,
                });
                const j = await res.json();
                const taskId = j?.data?.task_id;
                if (j?.code !== 0 || !taskId) continue;

                for (let i = 0; i < POLL_MAX; i++) {
                    await new Promise((r) => setTimeout(r, POLL_MS));
                    const poll = await fetch(RESULT_BASE + taskId, { headers });
                    const j2 = await poll.json();
                    if (j2?.code !== 0 || !j2.data) continue;
                    const data = j2.data;
                    if (data.status === 3) break;
                    if (data.status !== 2) continue;
                    const detail = data.detail || {};
                    const playUrl = detail.play_url || detail.url || detail.play;
                    const images = detail.images || data.images || [];
                    const author = detail.author || data.author || {};
                    const username = sanitize(
                        author.unique_id || author.nickname || extractUser(tiktokUrl)
                    );
                    let vid = detail.video_id || data.video_id || extractId(tiktokUrl) || 'unknown';
                    if (typeof vid === 'number') vid = String(vid);
                    const createTime = detail.create_time || detail.createTime || data.create_time;
                    const profileUid = String(author.id || author.uid || author.uniqueId || 'unknown');
                    if (playUrl || (images && images.length)) {
                        return { play_url: playUrl, username, video_id: vid, images, create_time: createTime, profile_uid: profileUid };
                    }
                }
            } catch {}
        }
        return null;
    }

    function buildFilename(entry, ext) {
        const username = sanitize(entry.username || 'unknown');
        let dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '-');
        if (entry.create_time) {
            try {
                dateStr = new Date(entry.create_time * 1000).toISOString().slice(2, 10);
            } catch {}
        }
        const uid = sanitize(entry.profile_uid || 'unknown');
        const vid = sanitize(entry.video_id || 'unknown');
        return `${username} - ${dateStr} - ${uid} - ${vid}${ext}`;
    }

    async function downloadBlob(url, filename) {
        const res = await fetch(url, {
            headers: { Referer: 'https://www.tiktok.com/', Origin: 'https://www.tiktok.com' },
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
    }

    async function downloadEntry(entry) {
        if (entry.images && entry.images.length && (!entry.play_url || /\/photo\//.test(location.href))) {
            const base = buildFilename(entry, '');
            for (let i = 0; i < entry.images.length; i++) {
                const item = entry.images[i];
                const imgUrl = typeof item === 'string' ? item : item.url || item.image_url;
                if (!imgUrl) continue;
                let ext = '.jpg';
                const m = imgUrl.split('?')[0].match(/\.(\w+)$/);
                if (m && ['jpg', 'jpeg', 'png', 'webp'].includes(m[1].toLowerCase())) ext = '.' + m[1].toLowerCase();
                await downloadBlob(imgUrl.startsWith('//') ? 'https:' + imgUrl : imgUrl, `${base}_img_${i + 1}${ext}`);
                await new Promise((r) => setTimeout(r, 400));
            }
            return;
        }
        let play = entry.play_url;
        if (!play) throw new Error('No video URL');
        if (play.startsWith('//')) play = 'https:' + play;
        await downloadBlob(play, buildFilename(entry, '.mp4'));
    }

    async function runDownload(tiktokUrl, btn) {
        btn.disabled = true;
        toast('TikTok_Rabbit: resolving…');
        try {
            let url = await resolveShort(tiktokUrl);
            url = normalizeUrl(url);
            const vid = extractId(url);
            const cache = loadCache();
            let entry = vid && cache[vid] ? { ...cache[vid] } : null;
            if (!entry || (!entry.play_url && !(entry.images && entry.images.length))) {
                toast('TikTok_Rabbit: fetching via TikWM…');
                entry = await submitTikwm(url);
                if (!entry) throw new Error('TikWM could not resolve this video');
                if (vid) saveCacheEntry(vid, entry);
            } else {
                toast('TikTok_Rabbit: using cached link');
            }
            toast('TikTok_Rabbit: downloading…');
            await downloadEntry(entry);
            toast('TikTok_Rabbit: download started');
        } catch (e) {
            console.error('[TikTok_Rabbit]', e);
            toast('TikTok_Rabbit: ' + (e.message || 'failed'));
        } finally {
            btn.disabled = false;
        }
    }

    function getVideoUrl() {
        const href = location.href;
        if (/\/(video|photo)\/\d+/.test(href)) return href;
        const active =
            document.querySelector('[data-e2e="browse-video"] a[href*="/video/"]') ||
            document.querySelector('div[class*="DivVideoContainer"] a[href*="/video/"]') ||
            document.querySelector('a[href*="/video/"]');
        if (active?.href) return active.href;
        const canon = document.querySelector('link[rel="canonical"]');
        if (canon?.href && canon.href.includes('/video/')) return canon.href;
        return href;
    }

    function findActionBar() {
        const collect =
            document.querySelector('[data-e2e="browse-collect"]')?.closest('[data-e2e="video-action-item"]') ||
            document.querySelector('[data-e2e="video-action-item"]:has([data-e2e="browse-collect"])') ||
            document.querySelector('button[aria-label*="Favorite" i]')?.closest('[data-e2e="video-action-item"]') ||
            document.querySelector('button[aria-label*="Bookmark" i]')?.closest('[data-e2e="video-action-item"]');
        if (collect?.parentElement) return collect.parentElement;
        return (
            document.querySelector('[data-e2e="video-action-bar"]') ||
            document.querySelector('[data-e2e="browse-video-action-bar"]') ||
            document.querySelector('section[class*="ActionBar"]')
        );
    }

    function makeButton() {
        const wrap = document.createElement('div');
        wrap.setAttribute('data-e2e', 'video-action-item');
        wrap.className = BTN_CLASS + '-wrap';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = BTN_CLASS;
        btn.setAttribute('aria-label', 'Download (TikTok_Rabbit)');
        btn.innerHTML = BTN_SVG + '<span>Save</span>';
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            runDownload(getVideoUrl(), btn);
        };
        wrap.appendChild(btn);
        return wrap;
    }

    function injectButton() {
        if (document.querySelector('.' + BTN_CLASS)) return;
        const bar = findActionBar();
        if (!bar) return;
        const collect =
            bar.querySelector('[data-e2e="browse-collect"]')?.closest('[data-e2e="video-action-item"]') ||
            bar.querySelector('[data-e2e="video-action-item"]');
        const btn = makeButton();
        if (collect?.nextSibling) collect.parentNode.insertBefore(btn, collect.nextSibling);
        else if (collect) collect.after(btn);
        else bar.appendChild(btn);
    }

    const obs = new MutationObserver(() => injectButton());
    const start = () => {
        injectButton();
        if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
    setInterval(injectButton, 1500);
})();

/*
Credits — modified by AlexRabbit (https://github.com/AlexRabbit)
  - AlexRabbit — Ez-TikTok-Downloader (TikWM task API, naming, cache)
  - Greasy Fork #577695 — TikTok UI placement inspiration
  - Greasy Fork #576654 — TikTok direct video inspiration
*/
