// ==UserScript==
// @name         TikTok_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.2.0
// @description  No-watermark TikTok download via TikWM; download button beside bookmark on FYP and video pages.
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://www.tiktok.com/*
// @match        https://m.tiktok.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @connect      tikwm.com
// @connect      www.tikwm.com
// @connect      tiktok.com
// @connect      *
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
    const QUICK_API = 'https://www.tikwm.com/api/';
    const CACHE_KEY = 'tiktok_rabbit_cache';
    const SESSION_KEY = 'tiktok_rabbit_sessionid';
    const POLL_MS = 1000;
    const POLL_MAX = 60;
    const MARK = 'tiktok-rabbit-dl';

    const API_HEADERS = {
        'User-Agent': navigator.userAgent,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Origin: 'https://tikwm.com',
        Referer: 'https://tikwm.com/',
        'x-requested-with': 'XMLHttpRequest',
    };

    const COLLECT_SELECTORS = [
        '[data-e2e="browse-collect"]',
        '[data-e2e="video-collect"]',
        '[data-e2e="browse-collection"]',
        '[data-e2e="video-collection"]',
        '[data-e2e="browse-favorite"]',
        '[data-e2e="video-favorite"]',
    ];

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const gmRequest = (opts) =>
        new Promise((resolve, reject) => {
            const gm =
                typeof GM_xmlhttpRequest === 'function'
                    ? GM_xmlhttpRequest
                    : typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function'
                      ? GM.xmlHttpRequest
                      : null;
            if (gm) {
                gm({
                    method: opts.method || 'GET',
                    url: opts.url,
                    headers: opts.headers || {},
                    data: opts.data,
                    responseType: opts.responseType,
                    onload: (r) => resolve(r),
                    onerror: (e) => reject(e),
                    ontimeout: () => reject(new Error('timeout')),
                });
                return;
            }
            const init = { method: opts.method || 'GET', headers: opts.headers || {} };
            if (opts.data) init.body = opts.data;
            fetch(opts.url, init)
                .then(async (res) => {
                    const buf =
                        opts.responseType === 'arraybuffer' ? await res.arrayBuffer() : await res.text();
                    resolve({
                        status: res.status,
                        responseText: typeof buf === 'string' ? buf : undefined,
                        response: buf,
                    });
                })
                .catch(reject);
        });

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
        if (u.startsWith('/')) u = 'https://www.tiktok.com' + u;
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
                return `${String(d.getUTCFullYear()).slice(-2)}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
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

    const parseUniversalInText = (text) => {
        try {
            const data = JSON.parse(text);
            const scope = data?.__DEFAULT_SCOPE__ || {};
            for (const key of Object.keys(scope)) {
                const item =
                    scope[key]?.itemInfo?.itemStruct ||
                    scope[key]?.itemStruct ||
                    scope[key]?.videoDetail?.itemInfo?.itemStruct;
                if (!item?.id) continue;
                const user = item.author?.uniqueId || item.author?.unique_id || 'user';
                const kind = item.imagePost || /photo/.test(location.pathname) ? 'photo' : 'video';
                return normalizeUrl(`https://www.tiktok.com/@${user}/${kind}/${item.id}`);
            }
        } catch {}
        return null;
    };

    const parseUniversalData = () => {
        const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
        if (el?.textContent) return parseUniversalInText(el.textContent);
        return null;
    };

    const resolveVideoUrl = (root) => {
        const scope =
            root?.closest?.('[data-e2e="recommend-list-item-container"]') ||
            root?.closest?.('[data-e2e="search-card-video-container"]') ||
            root?.closest?.('[data-e2e="user-post-item"]') ||
            root?.closest?.('[data-e2e="browse-video"]') ||
            root?.closest?.('[data-e2e="video-detail"]') ||
            root?.closest?.('article') ||
            root?.closest?.('section') ||
            root ||
            document;

        const link = scope.querySelector?.('a[href*="/video/"], a[href*="/photo/"]');
        if (link) {
            const href = link.href || link.getAttribute('href') || '';
            if (href) return normalizeUrl(href);
        }

        if (scope === document || !root) {
            const canonical = document.querySelector('link[rel="canonical"]')?.href;
            if (canonical && /\/(video|photo)\/\d+/.test(canonical)) return normalizeUrl(canonical);
            if (/\/(video|photo)\/\d+/.test(location.href)) return normalizeUrl(location.href);
            return parseUniversalData();
        }

        const vid = scope.querySelector?.('video');
        if (vid) {
            const near = vid.closest('motion-button, div')?.parentElement;
            const a = near?.querySelector?.('a[href*="/video/"], a[href*="/photo/"]');
            if (a?.href) return normalizeUrl(a.href);
        }

        return null;
    };

    const parseTikwmEntry = (j, usernameFromUrl, videoIdFromUrl) => {
        const data = j?.data;
        if (!data) return null;
        if (data.play || data.hdplay || data.wmplay) {
            return {
                play_url: data.hdplay || data.play || data.wmplay,
                images: data.images || [],
                username: sanitize(data.author?.unique_id || data.author?.uniqueId || usernameFromUrl),
                video_id: String(data.id || videoIdFromUrl || 'unknown'),
                create_time: data.create_time,
                profile_uid: data.author?.id != null ? String(data.author.id) : 'unknown',
            };
        }
        const detail = data.detail || data;
        const playUrl = detail.play_url || detail.url || detail.play || detail.hdplay;
        const images = detail.images || data.images || [];
        const author = detail.author || data.author || {};
        if (!playUrl && !(images && images.length)) return null;
        let vid = detail.video_id || data.video_id || videoIdFromUrl || 'unknown';
        if (typeof vid === 'number') vid = String(vid);
        return {
            play_url: playUrl,
            images: Array.isArray(images) ? images : [],
            username: sanitize(author.unique_id || author.nickname || usernameFromUrl),
            video_id: vid,
            create_time: detail.create_time ?? detail.createTime ?? data.create_time,
            profile_uid:
                author.id != null ? String(author.id) : author.uid != null ? String(author.uid) : 'unknown',
        };
    };

    const submitTikwmQuick = async (tiktokUrl) => {
        const headers = apiHeaders();
        for (const candidate of urlCandidates(tiktokUrl)) {
            try {
                const url = `${QUICK_API}?url=${encodeURIComponent(candidate)}&hd=1`;
                const r = await gmRequest({ method: 'GET', url, headers });
                if (r.status !== 200) continue;
                const j = JSON.parse(r.responseText);
                if (j?.code !== 0) continue;
                const entry = parseTikwmEntry(j, extractUsername(tiktokUrl), extractMediaId(tiktokUrl));
                if (entry) return entry;
            } catch (e) {
                console.debug('[TikTok_Rabbit] quick api', e);
            }
        }
        return null;
    };

    const submitTikwmTask = async (tiktokUrl) => {
        const usernameFromUrl = extractUsername(tiktokUrl) || 'unknown';
        const videoIdFromUrl = extractMediaId(tiktokUrl);
        const headers = apiHeaders();

        for (const candidate of urlCandidates(tiktokUrl)) {
            try {
                const body = `web=1&url=${encodeURIComponent(candidate)}`;
                const r = await gmRequest({ method: 'POST', url: SUBMIT_URL, headers, data: body });
                if (r.status !== 200) continue;
                const j = JSON.parse(r.responseText);
                const taskId = j?.data?.task_id;
                if (j?.code !== 0 || !taskId) continue;

                for (let i = 0; i < POLL_MAX; i++) {
                    await sleep(POLL_MS);
                    const poll = await gmRequest({
                        method: 'GET',
                        url: RESULT_BASE + taskId,
                        headers,
                    });
                    if (poll.status !== 200) continue;
                    const j2 = JSON.parse(poll.responseText);
                    if (j2?.code !== 0 || !j2?.data) continue;
                    const data = j2.data;
                    if (data.status === 3) break;
                    if (data.status !== 2) continue;
                    const entry = parseTikwmEntry(
                        { data: { ...data, detail: data.detail || data } },
                        usernameFromUrl,
                        videoIdFromUrl
                    );
                    if (entry) return entry;
                }
            } catch (e) {
                console.debug('[TikTok_Rabbit] task api', e);
            }
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
        let result = await submitTikwmQuick(url);
        if (!result) result = await submitTikwmTask(url);
        if (!result) return null;
        cache[videoId] = result;
        saveCache(cache);
        return result;
    };

    const saveBlob = (blob, filename) => {
        const blobUrl = URL.createObjectURL(blob);
        if (typeof GM_download === 'function') {
            GM_download({
                url: blobUrl,
                name: filename,
                onload: () => URL.revokeObjectURL(blobUrl),
                onerror: () => URL.revokeObjectURL(blobUrl),
            });
            return;
        }
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 8000);
    };

    const triggerDownload = async (url, filename) => {
        const r = await gmRequest({
            method: 'GET',
            url: url.startsWith('//') ? 'https:' + url : url,
            headers: { Referer: 'https://www.tiktok.com/', Origin: 'https://www.tiktok.com' },
            responseType: 'arraybuffer',
        });
        if (r.status !== 200) throw new Error('HTTP ' + r.status);
        const blob = new Blob([r.response], { type: 'video/mp4' });
        saveBlob(blob, filename);
    };

    const downloadEntry = async (entry, pageUrl) => {
        const images = entry.images || [];
        const playUrl = entry.play_url;
        const isPhoto = /\/photo\//.test(pageUrl);

        if (images.length && (!playUrl || isPhoto)) {
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
        await triggerDownload(playUrl, buildFilename(entry, '.mp4'));
        return true;
    };

    let busy = false;

    const toast = (msg, err) => {
        const box = document.createElement('div');
        box.textContent = msg;
        Object.assign(box.style, {
            position: 'fixed',
            top: '72px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: '2147483647',
            background: err ? '#b00020' : '#fe2c55',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontWeight: '600',
            fontSize: '14px',
            fontFamily: 'system-ui,sans-serif',
            boxShadow: '0 4px 16px rgba(0,0,0,.35)',
            pointerEvents: 'none',
        });
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 2800);
    };

    const runDownload = async (contextRoot) => {
        if (busy) return;
        busy = true;
        toast('Preparing download…');
        try {
            const pageUrl = resolveVideoUrl(contextRoot);
            if (!pageUrl || !extractMediaId(pageUrl)) {
                toast('Video URL not found for this item', true);
                return;
            }
            const entry = await fetchEntry(pageUrl);
            if (!entry) {
                toast('TikWM failed — check console or set session ID', true);
                return;
            }
            await downloadEntry(entry, pageUrl);
            toast('Download started');
        } catch (e) {
            console.error('[TikTok_Rabbit]', e);
            toast('Download failed — see console', true);
        } finally {
            busy = false;
        }
    };

    const downloadSvg = () => {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('width', '1em');
        svg.setAttribute('height', '1em');
        svg.setAttribute('fill', 'currentColor');
        const p = document.createElementNS(ns, 'path');
        p.setAttribute(
            'd',
            'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z'
        );
        svg.appendChild(p);
        return svg;
    };

    const getCollectButton = (el) => el.closest('button') || (el.tagName === 'BUTTON' ? el : null);

    const isBookmarkButton = (btn) => {
        if (!btn || btn.tagName !== 'BUTTON') return false;
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (
            label.includes('favorite') ||
            label.includes('favourite') ||
            label.includes('bookmark') ||
            label.includes('save video') ||
            label.includes('add to favorites')
        ) {
            return true;
        }
        const e2e =
            btn.getAttribute('data-e2e') ||
            btn.closest('[data-e2e]')?.getAttribute('data-e2e') ||
            '';
        return /collect|favorite/i.test(e2e);
    };

    const getActionItem = (collectBtn) => {
        let item = collectBtn.parentElement;
        for (let i = 0; i < 8 && item; i++) {
            const parent = item.parentElement;
            if (!parent) break;
            const peers = [...parent.children].filter(
                (c) => c.querySelector?.('button') || c.tagName === 'BUTTON'
            );
            if (peers.length >= 2) return item;
            item = parent;
        }
        return collectBtn.parentElement || collectBtn;
    };

    const findCollectButtons = () => {
        const found = new Set();
        for (const sel of COLLECT_SELECTORS) {
            document.querySelectorAll(sel).forEach((el) => {
                const btn = getCollectButton(el);
                if (btn) found.add(btn);
            });
        }
        document.querySelectorAll('button').forEach((btn) => {
            if (isBookmarkButton(btn)) found.add(btn);
        });
        return [...found];
    };

    const injectBesideBookmark = (collectBtn) => {
        const actionItem = getActionItem(collectBtn);
        if (!actionItem?.parentElement) return;
        if (actionItem.nextElementSibling?.getAttribute('data-tiktok-rabbit-dl')) return;
        if (actionItem.getAttribute('data-tiktok-rabbit-dl')) return;

        const wrap = actionItem.cloneNode(true);
        wrap.setAttribute('data-tiktok-rabbit-dl', '1');

        const countEl = wrap.querySelector('strong, [data-e2e*="count"]');
        if (countEl) countEl.textContent = '';

        const btn = wrap.querySelector('button') || wrap;
        if (btn.tagName === 'BUTTON' || btn.getAttribute('role') === 'button') {
            btn.setAttribute('aria-label', 'Download video (TikTok_Rabbit)');
            btn.setAttribute('title', 'Download without watermark');
            btn.replaceChildren(downloadSvg());
            btn.style.pointerEvents = 'auto';
            btn.addEventListener(
                'click',
                (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    runDownload(actionItem);
                },
                true
            );
        }

        actionItem.insertAdjacentElement('afterend', wrap);
    };

    const injectAll = () => {
        findCollectButtons().forEach(injectBesideBookmark);
    };

    const style = document.createElement('style');
    style.textContent = `
        [data-${MARK}="1"] button { cursor: pointer !important; }
        [data-${MARK}="1"] svg { color: #fff; }
    `;
    document.head.appendChild(style);

    injectAll();
    const obs = new MutationObserver(() => injectAll());
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(injectAll, 1500);
})();

/*
Credits — modified by AlexRabbit (https://github.com/AlexRabbit)
  - AlexRabbit — Ez-TikTok-Downloader (TikWM flow, filenames, cache)
  - Greasy Fork 577695 — collect-button placement & video URL detection
  - TikWM — https://www.tikwm.com API
*/
