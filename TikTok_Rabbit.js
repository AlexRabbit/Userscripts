// ==UserScript==
// @name         TikTok_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.0.0
// @description  One-click TikTok download (no watermark) via TikWM — video, slideshow, cache, private videos. Port of Ez-TikTok-Downloader.
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://www.tiktok.com/*
// @match        https://tiktok.com/*
// @match        https://m.tiktok.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=tiktok.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_addStyle
// @connect      tikwm.com
// @connect      www.tikwm.com
// @connect      *.tiktokcdn.com
// @connect      *.tiktokv.com
// @connect      *
// @run-at       document-idle
// @license      Unlicense
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/TikTok_Rabbit.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/TikTok_Rabbit.js
// @supportURL   https://github.com/AlexRabbit/Userscripts/issues
// ==/UserScript==

(function () {
    'use strict';

    if (typeof globalThis.GM_getValue !== 'function') {
        const PREFIX = 'AR_GM_';
        globalThis.GM_getValue = (k, d) => {
            try {
                const r = localStorage.getItem(PREFIX + k);
                return r === null ? d : JSON.parse(r);
            } catch {
                return d;
            }
        };
        globalThis.GM_setValue = (k, v) => {
            try {
                localStorage.setItem(PREFIX + k, JSON.stringify(v));
            } catch {}
        };
        globalThis.GM_deleteValue = (k) => {
            try {
                localStorage.removeItem(PREFIX + k);
            } catch {}
        };
    }

    const SUBMIT_URL = 'https://tikwm.com/api/video/task/submit';
    const RESULT_BASE = 'https://tikwm.com/api/video/task/result?task_id=';
    const POLL_INTERVAL_MS = 1000;
    const POLL_ATTEMPTS = 60;
    const REQUEST_TIMEOUT = 25000;
    const BATCH_DELAY_MS = 2000;
    const CACHE_KEY = 'tt_link_cache';

    const TIKWM_HEADERS = {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:141.0) Gecko/20100101 Firefox/141.0',
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: 'https://tikwm.com',
        Referer: 'https://tikwm.com/',
        'x-requested-with': 'XMLHttpRequest',
    };

    const DL_ICON =
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>';

    GM_addStyle(`
        .ar-tt-action{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-width:48px;cursor:pointer;-webkit-tap-highlight-color:transparent}
        .ar-tt-action-btn{width:48px;height:48px;border-radius:50%;border:none;background:rgba(255,255,255,.12);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;transition:background .15s,transform .1s}
        .ar-tt-action-btn:hover{background:rgba(255,255,255,.22)}
        .ar-tt-action-btn:active{transform:scale(.94)}
        .ar-tt-action-btn.is-busy{opacity:.55;pointer-events:none}
        .ar-tt-action-btn svg{width:22px;height:22px}
        .ar-tt-action-label{color:#fff;font-size:12px;font-weight:600;line-height:1.2;font-family:TikTokFont,Arial,sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.4)}
        .ar-tt-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483646;background:rgba(37,37,37,.94);color:#fff;padding:10px 18px;border-radius:8px;font:600 14px/1.3 TikTokFont,Arial,sans-serif;box-shadow:0 4px 24px rgba(0,0,0,.45);pointer-events:none;opacity:0;transition:opacity .2s}
        .ar-tt-toast.show{opacity:1}
    `);

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function toast(msg, ms = 2800) {
        let el = document.getElementById('ar-tt-toast');
        if (!el) {
            el = document.createElement('motion.div');
            el.id = 'ar-tt-toast';
            el.className = 'ar-tt-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(el._t);
        el._t = setTimeout(() => el.classList.remove('show'), ms);
    }

    function gmRequest(opts) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: opts.method || 'GET',
                url: opts.url,
                headers: opts.headers,
                data: opts.data,
                timeout: REQUEST_TIMEOUT,
                onload: (r) => resolve(r),
                onerror: reject,
                ontimeout: reject,
            });
        });
    }

    function getSessionId() {
        let s = GM_getValue('sessionId', '') || '';
        s = String(s).trim();
        if (s.toLowerCase().startsWith('sessionid=')) s = s.slice(10).trim();
        if (s) return s;
        const m = document.cookie.match(/(?:^|;\s*)sessionid=([^;]+)/i);
        return m ? m[1] : '';
    }

    function tikwmHeaders() {
        const h = { ...TIKWM_HEADERS };
        const sid = getSessionId();
        if (sid) {
            h.Referer = `https://www.tikwm.com/originalDownloader.html?cookie=sessionid=$sid}`;
            h['x-proxy-cookie'] = `sessionid=$sid}`;
        }
        return h;
    }

    function loadCache() {
        return GM_getValue(CACHE_KEY, {}) || {};
    }

    function saveCacheEntry(videoId, entry) {
        const cache = loadCache();
        cache[videoId] = entry;
        GM_setValue(CACHE_KEY, cache);
    }

    function sanitizeFilename(name) {
        return String(name || 'unknown')
            .replace(/[<>:"/\\|?*]/g, '_')
            .trim() || 'unknown';
    }

    function normalizeUrl(url) {
        let u = String(url || '').trim();
        if (u.includes('#')) u = u.split('#')[0];
        if (u.includes('?')) u = u.split('?')[0];
        u = u.replace(/\/+$/, '');
        if (u.startsWith('http://')) u = 'https://' + u.slice(7);
        return u;
    }

    function extractUsername(url) {
        const m = url.match(/tiktok\.com\/@([\w.-]+)/i);
        return m ? m[1] : null;
    }

    function extractMediaId(url) {
        const m = url.match(/\/(?:video|photo)\/(\d+)/);
        return m ? m[1] : null;
    }

    function contentTypeFromUrl(url) {
        const u = url.toLowerCase();
        if (u.includes('/story')) return 'story';
        if (u.includes('highlight')) return 'highlight';
        if (u.includes('/photo/')) return 'photo';
        return 'video';
    }

    function urlCandidates(tiktokUrl) {
        const normalized = normalizeUrl(tiktokUrl);
        const videoId = extractMediaId(normalized);
        const list = [normalized];
        if (videoId) {
            for (const u of [
                videoId,
                `https://www.tiktok.com/video/${videoId}`,
                `https://www.tiktok.com/@tiktok/video/${videoId}`,
                `https://m.tiktok.com/v/${videoId}.html`,
                `https://www.tiktok.com/@/video/${videoId}`,
            ]) {
                if (!list.includes(u)) list.push(u);
            }
        }
        return list;
    }

    function buildDateStr(createTime) {
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
        const y = String(n.getUTCFullYear()).slice(-2);
        const m = String(n.getUTCMonth() + 1).padStart(2, '0');
        const day = String(n.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function buildFilename(entry, ext = '.mp4') {
        const username = sanitizeFilename(entry.username || 'unknown');
        const dateStr = buildDateStr(entry.create_time);
        let profileUid = entry.profile_uid || 'unknown';
        if (typeof profileUid === 'number') profileUid = String(profileUid);
        const videoId = entry.video_id || 'unknown';
        const sub = entry.content_type && entry.content_type !== 'video' ? `${entry.content_type}_` : '';
        return `${sub}${username} - ${dateStr} - ${profileUid} - ${videoId}${ext}`;
    }

    async function resolveShortUrl(url) {
        if (!/https?:\/\/(vt|vm)\.tiktok\.com\//i.test(url)) return url;
        try {
            const r = await gmRequest({
                method: 'GET',
                url,
                headers: { 'User-Agent': TIKWM_HEADERS['User-Agent'] },
            });
            const final = r.finalUrl || r.responseURL || url;
            if (final && /tiktok\.com/i.test(final)) return final;
        } catch {}
        return url;
    }

    function parseSigiVideoUrl() {
        const el = document.getElementById('SIGI_STATE');
        if (!el?.textContent) return null;
        try {
            const state = JSON.parse(el.textContent);
            const items = state.ItemModule || {};
            for (const id of Object.keys(items)) {
                const item = items[id];
                if (!item?.video && !item?.imagePost) continue;
                let author =
                    item.author ||
                    (state.UserModule && item.authorId && state.UserModule[item.authorId]?.uniqueId);
                if (!author && item.author) author = item.author;
                const uid =
                    (typeof author === 'string' ? author : author?.uniqueId) ||
                    extractUsername(location.href) ||
                    'user';
                const path = item.imagePost ? 'photo' : 'video';
                return `https://www.tiktok.com/@${uid}/${path}/${id}`;
            }
        } catch {}
        return null;
    }

    async function getCurrentVideoUrl() {
        let url = location.href;
        if (/\/(video|photo)\/\d+/.test(location.pathname)) {
            return normalizeUrl(url);
        }
        const link = document.querySelector(
            'a[href*="/video/"], a[href*="/photo/"]'
        );
        if (link?.href && /tiktok\.com/.test(link.href)) {
            return normalizeUrl(link.href);
        }
        const sigi = parseSigiVideoUrl();
        if (sigi) return sigi;
        const canonical = document.querySelector('link[rel="canonical"]')?.href;
        if (canonical && /tiktok\.com/.test(canonical) && /\/(video|photo)\//.test(canonical)) {
            return normalizeUrl(canonical);
        }
        return normalizeUrl(url);
    }

    async function submitTikwmTask(tiktokUrl) {
        const candidates = urlCandidates(tiktokUrl);
        const usernameFromUrl = extractUsername(tiktokUrl) || 'unknown';
        const videoIdFromUrl = extractMediaId(tiktokUrl);
        const headers = tikwmHeaders();

        for (const candidate of candidates) {
            let submitJson;
            try {
                const r = await gmRequest({
                    method: 'POST',
                    url: SUBMIT_URL,
                    headers,
                    data: `web=1&url=${encodeURIComponent(candidate)}`,
                });
                submitJson = JSON.parse(r.responseText);
            } catch {
                continue;
            }
            const code = submitJson?.code;
            const taskId = submitJson?.data?.task_id;
            if (code !== 0 || !taskId) continue;

            for (let i = 0; i < POLL_ATTEMPTS; i++) {
                await sleep(POLL_INTERVAL_MS);
                let pollJson;
                try {
                    const pr = await gmRequest({
                        method: 'GET',
                        url: RESULT_BASE + encodeURIComponent(taskId),
                        headers,
                    });
                    pollJson = JSON.parse(pr.responseText);
                } catch {
                    continue;
                }
                if (pollJson?.code !== 0 || !pollJson?.data) continue;
                const data = pollJson.data;
                if (data.status === 3) break;
                if (data.status !== 2) continue;

                const detail = data.detail || {};
                let playUrl = detail.play_url || detail.url || detail.play;
                const images = detail.images || data.images || [];
                const author = detail.author || data.author || {};
                let username = (
                    author.unique_id ||
                    author.nickname ||
                    usernameFromUrl ||
                    ''
                ).trim();
                username = sanitizeFilename(username || usernameFromUrl);
                let vid = detail.video_id || data.video_id || videoIdFromUrl || 'unknown';
                if (typeof vid === 'number') vid = String(vid);
                const createTime =
                    detail.create_time || detail.createTime || data.create_time;
                let profileUid = author.id || author.uid || author.uniqueId;
                profileUid = profileUid != null ? String(profileUid) : 'unknown';

                if (playUrl || (Array.isArray(images) && images.length)) {
                    return {
                        play_url: playUrl,
                        username,
                        video_id: vid,
                        images: Array.isArray(images) ? images : [],
                        create_time: createTime,
                        profile_uid: profileUid,
                    };
                }
            }
        }
        return null;
    }

    function triggerDownload(url, filename) {
        return new Promise((resolve, reject) => {
            GM_download({
                url,
                name: filename,
                headers: {
                    Referer: 'https://www.tiktok.com/',
                    Origin: 'https://www.tiktok.com',
                    'User-Agent': TIKWM_HEADERS['User-Agent'],
                },
                onload: () => resolve(true),
                onerror: (e) => reject(e),
                ontimeout: () => reject(new Error('timeout')),
            });
        });
    }

    async function downloadEntry(entry) {
        const contentType = entry.content_type || 'video';
        let playUrl = entry.play_url;
        const images = entry.images || [];

        if (images.length && (!playUrl || contentType === 'photo')) {
            const base = buildFilename(entry, '').replace(/\.$/, '') || entry.video_id;
            let ok = 0;
            for (let i = 0; i < images.length; i++) {
                let imgUrl = images[i];
                if (imgUrl && typeof imgUrl === 'object') {
                    imgUrl = imgUrl.url || imgUrl.image_url || '';
                }
                if (!imgUrl) continue;
                if (String(imgUrl).startsWith('//')) imgUrl = 'https:' + imgUrl;
                let ext = '.jpg';
                const pathPart = String(imgUrl).split('?')[0];
                if (/\.(jpe?g|png|webp)$/i.test(pathPart)) {
                    ext = '.' + pathPart.split('.').pop().toLowerCase();
                }
                const fname = `${base}_img_${i + 1}${ext}`;
                try {
                    await triggerDownload(imgUrl, fname);
                    ok++;
                    if (i < images.length - 1) await sleep(400);
                } catch {
                    toast(`Image ${i + 1} failed`);
                }
            }
            if (ok) toast(`Saved ${ok} image(s)`);
            return ok > 0;
        }

        if (!playUrl) return false;
        if (String(playUrl).startsWith('//')) playUrl = 'https:' + playUrl;
        const fname = buildFilename(entry, '.mp4');
        await triggerDownload(playUrl, fname);
        toast('Video saved');
        return true;
    }

    async function processUrl(rawUrl, useCache = true) {
        let url = await resolveShortUrl(rawUrl.trim());
        if (!/tiktok\.com|douyin\.com/i.test(url)) {
            toast('Not a TikTok URL');
            return false;
        }
        url = normalizeUrl(url);
        const videoId = extractMediaId(url) || 'unknown';
        const contentType = contentTypeFromUrl(url);
        const usernameFromUrl = sanitizeFilename(extractUsername(url) || 'unknown');

        if (useCache) {
            const cache = loadCache();
            const cached = cache[videoId];
            if (
                cached &&
                (cached.play_url || (cached.images && cached.images.length))
            ) {
                const ent = {
                    ...cached,
                    video_id: videoId,
                    username: cached.username || usernameFromUrl,
                    content_type: cached.content_type || contentType,
                };
                toast('Using cache…');
                return downloadEntry(ent);
            }
        }

        toast('Extracting via TikWM…');
        const result = await submitTikwmTask(url);
        if (!result) {
            if (contentType === 'photo') {
                toast('Photo failed — set Session ID in menu for private posts');
            } else {
                toast('Extraction failed');
            }
            try {
                GM_notification({
                    title: 'TikTok_Rabbit',
                    text: 'Open tikwm.com manually?',
                    onclick: () => window.open('https://tikwm.com/', '_blank'),
                });
            } catch {}
            return false;
        }

        const entry = {
            username: result.username || usernameFromUrl,
            play_url: result.play_url,
            video_id: result.video_id || videoId,
            images: result.images || [],
            create_time: result.create_time,
            profile_uid: result.profile_uid || 'unknown',
            content_type: contentType,
        };
        saveCacheEntry(videoId, entry);
        return downloadEntry(entry);
    }

    async function runDownload(btn) {
        if (btn?.classList.contains('is-busy')) return;
        btn?.classList.add('is-busy');
        try {
            const url = await getCurrentVideoUrl();
            await processUrl(url, true);
        } catch (e) {
            console.error('[TikTok_Rabbit]', e);
            toast('Download error');
        } finally {
            btn?.classList.remove('is-busy');
        }
    }

    function findCollectAnchor() {
        const selectors = [
            '[data-e2e="browse-collect-icon"]',
            '[data-e2e="video-player-collect"]',
            '[data-e2e="collect-icon"]',
            'button[aria-label*="Favorite" i]',
            'button[aria-label*="Bookmarks" i]',
            'button[aria-label*="Save" i]',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                return el.closest('button') || el.closest('[role="button"]') || el;
            }
        }
        return null;
    }

    function findActionColumn(anchor) {
        return (
            anchor?.closest('[class*="ActionItem"]') ||
            anchor?.closest('[class*="action-item"]') ||
            anchor?.parentElement?.parentElement
        );
    }

    function buildDownloadAction() {
        const wrap = document.createElement('motion.div');
        wrap.className = 'ar-tt-action';
        wrap.setAttribute('data-ar-tiktok-download', '1');

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ar-tt-action-btn';
        btn.setAttribute('aria-label', 'Download video');
        btn.innerHTML = DL_ICON;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            runDownload(btn);
        });

        const label = document.createElement('span');
        label.className = 'ar-tt-action-label';
        label.textContent = 'Save';

        wrap.appendChild(btn);
        wrap.appendChild(label);
        return wrap;
    }

    function injectDownloadButtons() {
        const collect = findCollectAnchor();
        if (!collect) return;
        const collectCol = findActionColumn(collect);
        if (!collectCol?.parentElement) return;
        const bar = collectCol.parentElement;
        if (bar.querySelector('[data-ar-tiktok-download]')) return;

        const dl = buildDownloadAction();
        if (collectCol.nextSibling) {
            bar.insertBefore(dl, collectCol.nextSibling);
        } else {
            bar.appendChild(dl);
        }
    }

    function observeUi() {
        injectDownloadButtons();
        const obs = new MutationObserver(() => injectDownloadButtons());
        obs.observe(document.body, { childList: true, subtree: true });
    }

    function registerMenus() {
        GM_registerMenuCommand('TikTok_Rabbit: Set Session ID (private videos)', () => {
            const cur = getSessionId();
            const v = prompt(
                'TikTok sessionid cookie value (empty = use page cookie only):',
                cur
            );
            if (v !== null) GM_setValue('sessionId', v.trim());
        });
        GM_registerMenuCommand('TikTok_Rabbit: Clear link cache', () => {
            GM_deleteValue(CACHE_KEY);
            toast('Cache cleared');
        });
        GM_registerMenuCommand('TikTok_Rabbit: Download from URL…', async () => {
            const u = prompt('Paste TikTok URL:');
            if (u) await processUrl(u, true);
        });
        GM_registerMenuCommand('TikTok_Rabbit: Batch URLs (one per line)…', async () => {
            const text = prompt('Paste URLs, one per line:');
            if (!text) return;
            const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
            for (let i = 0; i < lines.length; i++) {
                if (i > 0) await sleep(BATCH_DELAY_MS);
                await processUrl(lines[i], true);
            }
            toast('Batch done');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            observeUi();
            registerMenus();
        });
    } else {
        observeUi();
        registerMenus();
    }
})();
