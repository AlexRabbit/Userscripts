// ==UserScript==
// @name         TikTok_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.0.0
// @description  No-watermark TikTok download via TikWM; Save button beside Favorites. AdGuard-ready.
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://www.tiktok.com/*
// @match        https://m.tiktok.com/*
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
    const CACHE_KEY = 'tiktok_rabbit_cache';
    const SESSION_KEY = 'tiktok_rabbit_sessionid';
    const POLL_MS = 1000;
    const POLL_MAX = 60;
    const BTN_ID = 'tiktok-rabbit-save-btn';

    const API_HEADERS = {
        'User-Agent': navigator.userAgent,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: 'https://tikwm.com',
        Referer: 'https://tikwm.com/',
        'x-requested-with': 'XMLHttpRequest',
    };

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const sanitize = (s) =>
        String(s || 'unknown')
            .replace(/[<>:"/\\|?*]/g, '_')
            .trim()
            .slice(0, 120) || 'unknown';

    const loadCache = () => {
        try {
            return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
        } catch {
            return {};
        }
    };

    const saveCache = (cache) => {
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch {}
    };

    const getSessionId = () => {
        try {
            let v = (localStorage.getItem(SESSION_KEY) || '').trim();
            if (!v) return null;
            if (v.toLowerCase().startsWith('sessionid=')) v = v.slice(10).trim();
            return v || null;
        } catch {
            return null;
        }
    };

    const apiHeaders = () => {
        const h = { ...API_HEADERS };
        const sid = getSessionId();
        if (sid) {
            h.Referer = `https://www.tikwm.com/originalDownloader.html?cookie=sessionid=${sid}`;
            h['x-proxy-cookie'] = `sessionid=${sid}`;
        }
        return h;
    };

    const normalizeUrl = (url) => {
        let u = (url || location.href).trim();
        if (u.includes('#')) u = u.split('#')[0];
        if (u.includes('?')) u = u.split('?')[0];
        u = u.replace(/\/+$/, '');
        if (u.startsWith('http://')) u = 'https://' + u.slice(7);
        return u;
    };

    const extractMediaId = (url) => {
        const m = url.match(/\/(?:video|photo)\/(\d+)/);
        return m ? m[1] : null;
    };

    const extractUsername = (url) => {
        const m = url.match(/tiktok\.com\/@([\w.-]+)/i);
        return m ? m[1] : null;
    };

    const urlCandidates = (tiktokUrl) => {
        const normalized = normalizeUrl(tiktokUrl);
        const id = extractMediaId(normalized);
        const list = [normalized];
        if (id) {
            for (const u of [
                id,
                `https://www.tiktok.com/video/${id}`,
                `https://www.tiktok.com/@tiktok/video/${id}`,
                `https://m.tiktok.com/v/${id}.html`,
                `https://www.tiktok.com/@/video/${id}`,
            ]) {
                if (!list.includes(u)) list.push(u);
            }
        }
        return list;
    };

    const buildDateStr = (createTime) => {
        if (createTime != null) {
            try {
                const d = new Date(Number(createTime) * 1000);
                const y = String(d.getUTCFullYear()).slice(-2);
                const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                const day = String(d.getUTCDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            } catch {}
        }
        const n = new Date();
        return `${String(n.getUTCFullYear()).slice(-2)}-${String(n.getUTCMonth() + 1).padStart(2, '0')}-${String(n.getUTCDate()).padStart(2, '0')}`;
    };

    const buildFilename = (entry, ext) => {
        const username = sanitize(entry.username);
        const dateStr = buildDateStr(entry.create_time);
        const profileUid = sanitize(entry.profile_uid || 'unknown');
        const videoId = sanitize(entry.video_id || 'unknown');
        return `${username} - ${dateStr} - ${profileUid} - ${videoId}${ext}`;
    };

    const resolvePageUrl = () => {
        const canonical = document.querySelector('link[rel="canonical"]')?.href;
        if (canonical && /tiktok\.com/.test(canonical) && /\/(video|photo)\//.test(canonical)) {
            return canonical;
        }
        const href = location.href;
        if (/\/(video|photo)\/\d+/.test(href)) return href;
        const share = document.querySelector('[data-e2e="browse-share"]')?.closest('section');
        const video = document.querySelector('video');
        if (video) {
            const a = document.querySelector('a[href*="/video/"]');
            if (a?.href) return a.href;
        }
        return href;
    };

    const submitTikwm = async (tiktokUrl) => {
        const usernameFromUrl = extractUsername(tiktokUrl) || 'unknown';
        const videoIdFromUrl = extractMediaId(tiktokUrl);
        const headers = apiHeaders();

        for (const candidate of urlCandidates(tiktokUrl)) {
            try {
                const body = `web=1&url=${encodeURIComponent(candidate)}`;
                const r = await fetch(SUBMIT_URL, { method: 'POST', headers, body });
                const j = await r.json();
                const taskId = j?.data?.task_id;
                if (j?.code !== 0 || !taskId) continue;

                for (let i = 0; i < POLL_MAX; i++) {
                    await sleep(POLL_MS);
                    const poll = await fetch(RESULT_BASE + taskId, { headers });
                    const j2 = await poll.json();
                    if (j2?.code !== 0 || !j2?.data) continue;
                    const data = j2.data;
                    if (data.status === 3) break;
                    if (data.status !== 2) continue;

                    const detail = data.detail || {};
                    const playUrl = detail.play_url || detail.url || detail.play;
                    const images = detail.images || data.images || [];
                    const author = detail.author || data.author || {};
                    const username = sanitize(
                        author.unique_id || author.nickname || usernameFromUrl
                    );
                    let vid = detail.video_id || data.video_id || videoIdFromUrl || 'unknown';
                    if (typeof vid === 'number') vid = String(vid);
                    const createTime = detail.create_time ?? detail.createTime ?? data.create_time;
                    const profileUid =
                        author.id != null
                            ? String(author.id)
                            : author.uid != null
                              ? String(author.uid)
                              : 'unknown';

                    if (playUrl || (Array.isArray(images) && images.length)) {
                        return {
                            play_url: playUrl,
                            images: Array.isArray(images) ? images : [],
                            username,
                            video_id: vid,
                            create_time: createTime,
                            profile_uid: profileUid,
                        };
                    }
                }
            } catch {}
        }
        return null;
    };

    const fetchEntry = async (url) => {
        const cache = loadCache();
        const videoId = extractMediaId(url) || 'unknown';
        const cached = cache[videoId];
        if (cached && (cached.play_url || (cached.images && cached.images.length))) {
            return { ...cached, video_id: cached.video_id || videoId };
        }
        const result = await submitTikwm(url);
        if (!result) return null;
        cache[videoId] = result;
        saveCache(cache);
        return result;
    };

    const triggerDownload = async (url, filename) => {
        const h = {
            ...API_HEADERS,
            Referer: 'https://www.tiktok.com/',
            Origin: 'https://www.tiktok.com',
        };
        const res = await fetch(url, { headers: h });
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    };

    const downloadEntry = async (entry) => {
        const images = entry.images || [];
        const playUrl = entry.play_url;

        if (images.length && (!playUrl || /\/photo\//.test(location.pathname))) {
            const base = buildFilename(entry, '');
            let ok = 0;
            for (let i = 0; i < images.length; i++) {
                const item = images[i];
                const imgUrl =
                    typeof item === 'string' ? item : item?.url || item?.image_url || '';
                if (!imgUrl) continue;
                let ext = '.jpg';
                const pathPart = imgUrl.split('?')[0];
                if (pathPart.includes('.')) {
                    const e = '.' + pathPart.split('.').pop().toLowerCase();
                    if (['.jpg', '.jpeg', '.png', '.webp'].includes(e)) ext = e;
                }
                await triggerDownload(imgUrl, `${base}_img_${i + 1}${ext}`);
                ok++;
            }
            return ok > 0;
        }

        if (!playUrl) return false;
        let url = playUrl;
        if (url.startsWith('//')) url = 'https:' + url;
        await triggerDownload(url, buildFilename(entry, '.mp4'));
        return true;
    };

    let busy = false;

    const onSaveClick = async (btn) => {
        if (busy) return;
        busy = true;
        const prev = btn.textContent;
        btn.textContent = '…';
        btn.disabled = true;
        try {
            const pageUrl = resolvePageUrl();
            if (!/\/(video|photo)\/\d+/.test(pageUrl) && !extractMediaId(pageUrl)) {
                alert('Open a TikTok video or photo post first.');
                return;
            }
            const entry = await fetchEntry(pageUrl);
            if (!entry) {
                alert('Could not get download link. Try again or set session ID for private posts.');
                return;
            }
            await downloadEntry(entry);
        } catch (e) {
            console.error('[TikTok_Rabbit]', e);
            alert('Download failed. See console for details.');
        } finally {
            btn.textContent = prev;
            btn.disabled = false;
            busy = false;
        }
    };

    const makeButton = () => {
        const btn = document.createElement('button');
        btn.id = BTN_ID;
        btn.type = 'button';
        btn.title = 'Save without watermark (TikTok_Rabbit)';
        btn.setAttribute('aria-label', 'Save video');
        btn.textContent = 'Save';
        Object.assign(btn.style, {
            marginLeft: '8px',
            padding: '0 12px',
            height: '32px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '14px',
            fontFamily: 'inherit',
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            flexShrink: '0',
        });
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onSaveClick(btn);
        });
        return btn;
    };

    const findAnchor = () => {
        const selectors = [
            '[data-e2e="browse-favorite"]',
            '[data-e2e="undefined-favorite"]',
            'button[aria-label*="Favorite" i]',
            'button[aria-label*="Bookmark" i]',
            'button[aria-label*="Favorit" i]',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    };

    const injectButton = () => {
        if (document.getElementById(BTN_ID)) return;
        const anchor = findAnchor();
        if (!anchor) return;
        const parent = anchor.parentElement;
        if (!parent) return;
        const btn = makeButton();
        if (anchor.nextSibling) parent.insertBefore(btn, anchor.nextSibling);
        else parent.appendChild(btn);
    };

    injectButton();
    const obs = new MutationObserver(() => injectButton());
    obs.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();

/*
Credits — modified by AlexRabbit (https://github.com/AlexRabbit)
  - AlexRabbit — Ez-TikTok-Downloader (TikWM flow, filenames, cache)
  - Greasy Fork 577695 / 576654 — UI placement inspiration for Save button
  - TikWM — https://www.tikwm.com API
*/
