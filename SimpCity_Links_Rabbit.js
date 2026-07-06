// ==UserScript==
// @name         SimpCity_Links_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.1.0
// @description  Export thread links to .txt + JDownloader .dlc (incremental, turbo resolver, progress UI).
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://simpcity.cr/threads/*
// @connect      simpcity.cr
// @connect      turbo.cr
// @connect      turbocdn.st
// @connect      service.jdownloader.org
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/SimpCity_Links_Rabbit.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/SimpCity_Links_Rabbit.js
// @supportURL   https://github.com/AlexRabbit/Userscripts/issues
// @require      https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js
// ==/UserScript==

(function () {
    'use strict';

    if (!/\/threads\//i.test(location.pathname)) return;

    const BASE = 'https://simpcity.cr';
    const URL_RE = /https?://[^\s<>"'\])]+/gi;
    const TURBO_RE = /https?:\/\/(?:[\w-]+\.)?turbo\.cr\/(?:embed|v|d)\/([^\s/?#]+)/i;
    const JD_ENCRYPT = 'http://service.jdownloader.org/dlcrypt/service.php?jd=1&srcType=plain&data=';
    const STATE_KEY = 'sclr_thread_state';

    function threadSlug(url) {
        const m = String(url || location.pathname).match(/\/threads\/([^/?#]+)/);
        return m ? m[1] : 'thread';
    }

    function normalizeThreadUrl(url) {
        const u = new URL(url || location.href);
        let path = u.pathname.replace(/\/page-\d+\/?$/, '').replace(/\/$/, '');
        if (!path.endsWith('/')) path += '/';
        return BASE + path;
    }

    function shouldSkip(url) {
        if (!url || url.startsWith('#') || /^javascript:/i.test(url)) return true;
        if (url.startsWith('/') || url.startsWith('mailto:')) return true;
        if (/coomer/i.test(url)) return true;
        try {
            const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
            if (host.includes('simpcity')) return true;
            if (host.endsWith('.cuckcapital.cr') || host === 'cuckcapital.cr') return true;
            if (host === 'turbostats.xyz') return true;
        } catch (_) {
            return true;
        }
        return false;
    }

    function cleanUrl(url) {
        return url.trim().replace(/[.,;:!?)\"']+$/, '');
    }

    function decodeRedirect(href) {
        try {
            const u = new URL(href, BASE);
            if (!u.pathname.includes('/redirect/')) return null;
            const to = u.searchParams.get('to');
            if (!to) return null;
            return atob(to);
        } catch (_) {
            return null;
        }
    }

    function extractLinksFromBody(body) {
        const found = [];
        const seen = new Set();
        const add = (raw) => {
            const url = cleanUrl(raw);
            if (shouldSkip(url) || seen.has(url)) return;
            seen.add(url);
            found.push(url);
        };

        body.querySelectorAll('a[href]').forEach((a) => {
            const href = decodeURIComponent(a.getAttribute('href') || '');
            const decoded = decodeRedirect(href);
            if (decoded) add(decoded);
            else if (/^https?:\/\//i.test(href)) add(href);
        });

        body.querySelectorAll('iframe[src], embed[src], video[src], source[src]').forEach((el) => {
            const src = el.getAttribute('src') || el.getAttribute('data-src');
            if (src) add(new URL(src, BASE).href);
        });

        body.querySelectorAll('[data-url], [data-href], [data-link]').forEach((el) => {
            ['data-url', 'data-href', 'data-link'].forEach((attr) => {
                const v = el.getAttribute(attr) || '';
                if (/^https?:\/\//i.test(v)) add(v);
            });
        });

        const text = body.innerText || '';
        let m;
        URL_RE.lastIndex = 0;
        while ((m = URL_RE.exec(text)) !== null) add(m[0]);

        return found;
    }

    function getMaxPage(doc) {
        let max = 1;
        doc.querySelectorAll('.pageNav-page a, a.pageNavSimple-el--last').forEach((a) => {
            const match = (a.getAttribute('href') || '').match(/\/page-(\d+)/);
            if (match) max = Math.max(max, parseInt(match[1], 10));
        });
        return max;
    }

    function fetchPage(url) {
        return fetch(url, { credentials: 'include' }).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
            return r.text();
        });
    }

    function parsePageLinks(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const links = [];
        const posts = [];
        doc.querySelectorAll('article.message--post').forEach((post) => {
            const postId = post.getAttribute('data-content') || post.id || '';
            if (postId) posts.push(postId);
            const body = post.querySelector('article.message-body');
            if (body) links.push(...extractLinksFromBody(body));
        });
        return { links, posts, maxPage: getMaxPage(doc) };
    }

    function loadState() {
        try {
            return JSON.parse(localStorage.getItem(STATE_KEY) || '{}');
        } catch (_) {
            return {};
        }
    }

    function saveState(state) {
        localStorage.setItem(STATE_KEY, JSON.stringify(state));
    }

    function progressBar(step, total, labels) {
        if (total < 1) total = 1;
        step = Math.min(Math.max(step, 1), total);
        let dots;
        if (total === 1) {
            dots = '◉';
        } else {
            const parts = [];
            for (let i = 0; i < total; i++) {
                if (i + 1 < step) parts.push('●');
                else if (i + 1 === step) parts.push('◉');
                else parts.push('○');
                if (i < total - 1) parts.push('────');
            }
            dots = parts.join('');
        }
        const lines = [`${step}/${total}`, dots, ''];
        labels.forEach((label, i) => {
            if (i + 1 < step) lines.push(`🗹 ${label}`);
            else if (i + 1 === step) {
                const nxt = labels[i + 1] || 'Finish';
                lines.push(`↪ ${label}↳ ${nxt}`);
            } else lines.push(`○ ${label}`);
        });
        return lines.join('\n');
    }

    let progressEl;

    function setProgress(step, labels, extra = '') {
        if (!progressEl) return;
        progressEl.style.display = 'block';
        progressEl.textContent = progressBar(step, labels.length, labels) + (extra ? `\n\n${extra}` : '');
    }

    function gmGet(url, headers = {}) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                headers,
                onload(resp) {
                    resolve({ ok: resp.status === 200, status: resp.status, text: resp.responseText });
                },
                onerror: () => reject(new Error(`Request failed: ${url}`)),
            });
        });
    }

    async function resolveTurboUrl(url) {
        const m = url.match(TURBO_RE);
        if (!m) return url;
        const id = m[1];
        const embedUrl = `https://turbo.cr/embed/${id}`;
        try {
            const r = await gmGet(`https://turbo.cr/api/sign?v=${encodeURIComponent(id)}`, {
                Referer: embedUrl,
                Accept: 'application/json',
            });
            if (r.ok) {
                const j = JSON.parse(r.text);
                if (j.success && j.url) return j.url;
            }
        } catch (_) {}
        return `https://turbo.cr/d/${id}`;
    }

    async function resolveTurboLinks(links, onProgress) {
        const out = links.slice();
        const indices = links.map((u, i) => (TURBO_RE.test(u) ? i : -1)).filter((i) => i >= 0);
        for (let n = 0; n < indices.length; n++) {
            const i = indices[n];
            out[i] = await resolveTurboUrl(links[i]);
            if (onProgress) onProgress(n + 1, indices.length);
            await sleep(300);
        }
        return out;
    }

    async function scrapeAllPages(incremental, labels) {
        const slug = threadSlug(location.href);
        const state = loadState();
        const threadState = state[slug] || {};
        const knownLinks = incremental ? new Set(threadState.links || []) : new Set();
        const knownPosts = incremental ? new Set(threadState.posts || []) : new Set();
        const lastPage = incremental ? (threadState.max_page || 0) : 0;

        const threadBase = normalizeThreadUrl(location.href);
        const firstHtml = document.documentElement.outerHTML;
        const first = parsePageLinks(firstHtml);
        const maxPage = first.maxPage;
        const startPage = incremental && lastPage ? Math.max(1, lastPage) : 1;

        const all = [...knownLinks];
        const seen = new Set(all);
        const newPosts = [];

        const ingest = (links, posts, pageNum) => {
            posts.forEach((p) => {
                if (!knownPosts.has(p)) newPosts.push(p);
            });
            links.forEach((url) => {
                if (!seen.has(url)) {
                    seen.add(url);
                    all.push(url);
                }
            });
            setProgress(1, labels, `Page ${pageNum}/${maxPage} — ${all.length} links`);
        };

        if (startPage <= 1) {
            const filtered = first.links;
            ingest(filtered, first.posts.filter((p) => !knownPosts.has(p)), 1);
        }

        for (let page = Math.max(2, startPage); page <= maxPage; page++) {
            setProgress(1, labels, `Fetching page ${page}/${maxPage}…`);
            const html = await fetchPage(`${threadBase}page-${page}`);
            const parsed = parsePageLinks(html);
            ingest(parsed.links, parsed.posts.filter((p) => !knownPosts.has(p)), page);
            await sleep(400);
        }

        state[slug] = {
            links: all,
            posts: [...new Set([...(threadState.posts || []), ...newPosts])],
            max_page: maxPage,
            updated: new Date().toISOString(),
        };
        saveState(state);
        return all;
    }

    function sleep(ms) {
        return new Promise((r) => setTimeout(r, ms));
    }

    function b64Text(value) {
        return btoa(unescape(encodeURIComponent(value)));
    }

    function buildDlcXml(links, packageName) {
        const files = links
            .map((url) => `<file><url>${b64Text(url)}</url><filename></filename><size></size></file>`)
            .join('');
        return (
            '<?xml version="1.0" encoding="UTF-8"?>' +
            '<dlc><header><generator>' +
            `<app>${b64Text('JDownloader')}</app>` +
            `<version>${b64Text('43307')}</version>` +
            `<url>${b64Text('http://jdownloader.org')}</url>` +
            '</generator><tribute/>' +
            `<dlcxmlversion>${b64Text('20_02_2008')}</dlcxmlversion>` +
            '</header><content>' +
            `<package category="${b64Text('various')}" comment="${b64Text('')}" name="${b64Text(packageName)}">` +
            files +
            '</package></content></dlc>'
        );
    }

    function randomRcp() {
        const arr = new Uint8Array(8);
        crypto.getRandomValues(arr);
        return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
    }

    function getJdRc(rcp) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: JD_ENCRYPT + encodeURIComponent(rcp),
                onload(resp) {
                    const m = resp.responseText.match(/<rc>([\s\S]*?)<\/rc>/);
                    if (m) resolve(m[1].trim());
                    else reject(new Error('JDownloader DLC service failed'));
                },
                onerror: () => reject(new Error('Could not reach JDownloader DLC service')),
            });
        });
    }

    async function createDlc(links, packageName) {
        const xml = buildDlcXml(links, packageName);
        const payload = b64Text(xml);
        const rcp = randomRcp();
        const rc = await getJdRc(rcp);
        const key = CryptoJS.enc.Utf8.parse(rcp);
        const encrypted = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(payload), key, {
            iv: key,
            padding: CryptoJS.pad.ZeroPadding,
        });
        return encrypted.ciphertext.toString(CryptoJS.enc.Base64) + rc;
    }

    function downloadText(filename, content, mime) {
        const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        if (typeof GM_download === 'function') {
            GM_download({ url, name: filename, saveAs: false, onload: () => URL.revokeObjectURL(url) });
            return;
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function toast(msg) {
        const t = document.createElement('div');
        Object.assign(t.style, {
            position: 'fixed',
            bottom: '70px',
            right: '20px',
            background: 'rgba(0,0,0,0.9)',
            color: '#3aff9d',
            padding: '10px 14px',
            borderRadius: '6px',
            zIndex: '2147483647',
            fontFamily: 'system-ui, sans-serif',
            fontSize: '13px',
            maxWidth: '360px',
            whiteSpace: 'pre-wrap',
        });
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 4000);
    }

    async function exportLinks(fullScrape) {
        const btn = document.getElementById('sclr-export-btn');
        const fullBtn = document.getElementById('sclr-export-full-btn');
        if (btn) btn.disabled = true;
        if (fullBtn) fullBtn.disabled = true;

        const labels = ['Scan pages', 'Resolve turbo', 'Build DLC', 'Download files'];
        try {
            setProgress(1, labels);
            const links = await scrapeAllPages(!fullScrape, labels);
            if (!links.length) {
                toast('No external links found.');
                return;
            }

            setProgress(2, labels);
            const resolved = await resolveTurboLinks(links, (n, t) =>
                setProgress(2, labels, `Turbo ${n}/${t}`)
            );

            const slug = threadSlug(location.href);
            setProgress(3, labels);
            const dlc = await createDlc(resolved, slug);

            setProgress(4, labels);
            const txt = resolved.join('\n') + '\n';
            downloadText(`${slug}.txt`, txt);
            downloadText(`${slug}.dlc`, dlc, 'application/octet-stream');

            toast(`Exported ${resolved.length} links\n${slug}.txt + ${slug}.dlc`);
            setProgress(4, labels, `Done — ${resolved.length} links`);
        } catch (err) {
            console.error('[SimpCity_Links_Rabbit]', err);
            toast(`Error: ${err.message || err}`);
        } finally {
            if (btn) btn.disabled = false;
            if (fullBtn) fullBtn.disabled = false;
        }
    }

    function injectUI() {
        if (document.getElementById('sclr-export-btn')) return;

        const wrap = document.createElement('div');
        Object.assign(wrap.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '2147483646',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '6px',
            fontFamily: 'system-ui, sans-serif',
        });

        progressEl = document.createElement('div');
        Object.assign(progressEl.style, {
            background: 'rgba(0,0,0,0.88)',
            color: '#ccc',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            display: 'none',
            maxWidth: '320px',
            border: '1px solid #553982',
        });

        const btnRow = document.createElement('div');
        Object.assign(btnRow.style, { display: 'flex', gap: '8px' });

        const btnStyle = {
            background: 'linear-gradient(135deg, #553982, #7b52b8)',
            color: '#fff',
            border: 'none',
            padding: '10px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: '600',
            boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        };

        const btn = document.createElement('button');
        btn.id = 'sclr-export-btn';
        btn.textContent = 'Export (+new)';
        Object.assign(btn.style, btnStyle);
        btn.addEventListener('click', () => exportLinks(false));

        const fullBtn = document.createElement('button');
        fullBtn.id = 'sclr-export-full-btn';
        fullBtn.textContent = 'Full export';
        Object.assign(fullBtn.style, { ...btnStyle, background: 'linear-gradient(135deg, #333, #555)' });
        fullBtn.addEventListener('click', () => exportLinks(true));

        btnRow.appendChild(btn);
        btnRow.appendChild(fullBtn);
        wrap.appendChild(progressEl);
        wrap.appendChild(btnRow);
        document.body.appendChild(wrap);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectUI, { once: true });
    } else {
        injectUI();
    }
})();
