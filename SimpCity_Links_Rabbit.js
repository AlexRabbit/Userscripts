// ==UserScript==
// @name         SimpCity_Links_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.0.1
// @description  Export all external thread links to .txt and JDownloader .dlc (all pages, spoilers, embeds).
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://simpcity.cr/threads/*
// @connect      simpcity.cr
// @connect      service.jdownloader.org
// @grant        GM_xmlhttpRequest
// @grant        GM_download
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
    const URL_RE = /https?:\/\/[^\s<>"'\])]+/gi;
    const JD_ENCRYPT = 'http://service.jdownloader.org/dlcrypt/service.php?jd=1&srcType=plain&data=';

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
        doc.querySelectorAll('article.message--post').forEach((post) => {
            const body = post.querySelector('article.message-body');
            if (body) links.push(...extractLinksFromBody(body));
        });
        return { links, maxPage: getMaxPage(doc) };
    }

    async function scrapeAllPages() {
        const threadBase = normalizeThreadUrl(location.href);
        const firstHtml = document.documentElement.outerHTML;
        const first = parsePageLinks(firstHtml);
        const maxPage = first.maxPage;

        const seen = new Set();
        const all = [];
        const pushUnique = (list) => {
            list.forEach((url) => {
                if (!seen.has(url)) {
                    seen.add(url);
                    all.push(url);
                }
            });
        };

        pushUnique(first.links);

        for (let page = 2; page <= maxPage; page++) {
            setStatus(`Fetching page ${page}/${maxPage}…`);
            const html = await fetchPage(`${threadBase}page-${page}`);
            pushUnique(parsePageLinks(html).links);
            await sleep(400);
        }

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
            .map(
                (url) =>
                    `<file><url>${b64Text(url)}</url><filename></filename><size></size></file>`
            )
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

    let statusEl;

    function setStatus(msg) {
        if (statusEl) statusEl.textContent = msg;
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
        });
        t.textContent = msg;
        document.body.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }

    async function exportLinks() {
        const btn = document.getElementById('sclr-export-btn');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Working…';
        }
        try {
            setStatus('Scanning pages…');
            const links = await scrapeAllPages();
            if (!links.length) {
                toast('No external links found.');
                return;
            }
            const slug = threadSlug(location.href);
            setStatus('Building DLC…');
            const dlc = await createDlc(links, slug);
            const txt = links.join('\n') + '\n';
            downloadText(`${slug}.txt`, txt);
            downloadText(`${slug}.dlc`, dlc, 'application/octet-stream');
            toast(`Exported ${links.length} links → ${slug}.txt + ${slug}.dlc`);
            setStatus(`Done — ${links.length} links`);
        } catch (err) {
            console.error('[SimpCity_Links_Rabbit]', err);
            toast(`Error: ${err.message || err}`);
            setStatus('Error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Export Links + DLC';
            }
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

        statusEl = document.createElement('div');
        Object.assign(statusEl.style, {
            background: 'rgba(0,0,0,0.75)',
            color: '#aaa',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            display: 'none',
        });

        const btn = document.createElement('button');
        btn.id = 'sclr-export-btn';
        btn.textContent = 'Export Links + DLC';
        Object.assign(btn.style, {
            background: 'linear-gradient(135deg, #553982, #7b52b8)',
            color: '#fff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 4px 14px rgba(0,0,0,0.45)',
        });
        btn.addEventListener('click', exportLinks);
        btn.addEventListener('mouseenter', () => { statusEl.style.display = 'block'; });
        btn.addEventListener('mouseleave', () => {
            if (!btn.disabled) statusEl.style.display = 'none';
        });

        wrap.appendChild(statusEl);
        wrap.appendChild(btn);
        document.body.appendChild(wrap);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectUI, { once: true });
    } else {
        injectUI();
    }
})();
