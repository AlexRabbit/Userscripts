// ==UserScript==
// @name         Forum_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      3.0.1
// @description  Simpcity.cr threads: scan images/videos/links, full-screen gallery, bulk download, URL export. Auto-redirect external links.
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://simpcity.cr/*
// @grant        GM_download
// @connect      *
// @run-at       document-idle
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.js
// @supportURL   https://github.com/AlexRabbit/Userscripts/issues
// ==/UserScript==

(function () {
    'use strict';

    if (/^https:\/\/simpcity\.cr\/redirect\//i.test(location.href)) {
        const encodedUrl = new URLSearchParams(location.search).get('to');
        if (encodedUrl) {
            try {
                const decodedUrl = atob(encodedUrl);
                if (decodedUrl.startsWith('http://') || decodedUrl.startsWith('https://')) {
                    location.replace(decodedUrl);
                    return;
                }
            } catch {}
        }
    }

    const LS_IMG = 'forum_rabbit_imageUrls';
    const LS_VID = 'forum_rabbit_videoUrls';
    const LS_LNK = 'forum_rabbit_linkUrls';

    const loadArr = (key, legacy) => {
        try {
            const raw = localStorage.getItem(key) || localStorage.getItem(legacy) || '[]';
            return JSON.parse(raw);
        } catch {
            return [];
        }
    };

    const imageSet = new Set(loadArr(LS_IMG, 'sgify_imageUrls'));
    const videoSet = new Set(loadArr(LS_VID, 'sgify_videoUrls'));
    const linkSet = new Set(loadArr(LS_LNK, 'sgify_linkUrls'));

    let notificationTimeout;
    const selectedIndices = new Set();
    let lastSelectedIndex = null;
    let fetchIntervalId;
    let uiOpen = false;

    function persist() {
        localStorage.setItem(LS_IMG, JSON.stringify([...imageSet]));
        localStorage.setItem(LS_VID, JSON.stringify([...videoSet]));
        localStorage.setItem(LS_LNK, JSON.stringify([...linkSet]));
    }

    function isImageUrl(url) {
        return /\.(jpe?g|png|gif)$/i.test(url);
    }

    function showNotification(msg) {
        const existing = document.getElementById('forum-rabbit-noti');
        if (existing) existing.remove();
        const n = document.createElement('div');
        n.id = 'forum-rabbit-noti';
        Object.assign(n.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'rgba(0,0,0,0.85)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: '6px',
            zIndex: '2147483647',
            transition: 'opacity .5s',
            fontFamily: 'system-ui, Arial, sans-serif',
            fontSize: '14px',
            pointerEvents: 'none',
        });
        n.textContent = msg;
        document.body.appendChild(n);
        clearTimeout(notificationTimeout);
        notificationTimeout = setTimeout(() => {
            n.style.opacity = '0';
            setTimeout(() => n.remove(), 500);
        }, 2200);
    }

    const origFetch = window.fetch;
    window.fetch = function (input, init) {
        const url = typeof input === 'string' ? input : input?.url;
        if (url && url.includes('.m3u8') && !videoSet.has(url)) {
            videoSet.add(url);
            persist();
            notifyCounts();
        }
        return origFetch.apply(this, arguments);
    };

    const origXHROpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (m, u) {
        this._forumRabbitUrl = u;
        return origXHROpen.apply(this, arguments);
    };

    const origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function () {
        const u = this._forumRabbitUrl;
        if (u && u.includes('.m3u8') && !videoSet.has(u)) {
            videoSet.add(u);
            persist();
            notifyCounts();
        }
        return origXHRSend.apply(this, arguments);
    };

    function processImage(url) {
        if (!url || !isImageUrl(url) || imageSet.has(url)) return;
        imageSet.add(url);
        persist();
        notifyCounts();
    }

    function processLink(url) {
        if (!url || linkSet.has(url)) return;
        linkSet.add(url);
        persist();
        notifyCounts();
    }

    function processVideo(url) {
        if (!url || videoSet.has(url)) return;
        videoSet.add(url);
        persist();
        notifyCounts();
    }

    function shouldSkip(img) {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        return (
            (w === 16 && h === 16) ||
            (w === 32 && h === 32) ||
            (w === 64 && h === 64) ||
            (w === 192 && h === 192) ||
            (w === 300 && h === 300) ||
            (w === 320 && h === 320) ||
            (w === 329 && h === 329) ||
            (w === 1200 && h === 1200)
        );
    }

    function scanPage() {
        document
            .querySelectorAll('.message-content, .messageContent, .message-body, .bbWrapper')
            .forEach((content) => {
                content.querySelectorAll('img.bbImage').forEach((img) => {
                    const url = img.dataset.url || img.getAttribute('data-src') || img.src;
                    if (!url || !img.complete || img.closest('.message-avatar')) return;
                    if (shouldSkip(img)) return;
                    processImage(url);
                });

                content.querySelectorAll('img:not(.bbImage)').forEach((img) => {
                    const url = img.getAttribute('data-url') || img.getAttribute('data-src') || img.src;
                    if (!url || !img.complete) return;
                    if (shouldSkip(img)) return;
                    processImage(url);
                });

                content.querySelectorAll('source[src]').forEach((srcEl) => {
                    const url = srcEl.src;
                    if (url && /\.(mp4|webm|ogg)$/i.test(url)) processVideo(url);
                });

                content
                    .querySelectorAll(
                        'video[data-test-id="play-video"][src], video[data-testid="play-video"][src]'
                    )
                    .forEach((video) => {
                        const url = video.src;
                        if (url && /\.(mp4|webm|ogg)$/i.test(url)) processVideo(url);
                    });

                content.querySelectorAll('a.link.link--external[href]').forEach((a) => {
                    processLink(a.href);
                });
            });
    }

    function notifyCounts() {
        const i = imageSet.size;
        const v = videoSet.size;
        const l = linkSet.size;
        const text = uiOpen
            ? `${i} images, ${v} videos, ${l} links`
            : `${i} images, ${v} videos, ${l} links, ${new Set([...imageSet, ...videoSet, ...linkSet]).size} URLs`;
        if (uiOpen) updateCounters();
        else showNotification(text);
    }

    function getThreadID() {
        return location.pathname.split('/threads/')[1]?.replace(/\//g, '') || 'thread';
    }

    function makeBarButton(txt, bg) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = txt;
        Object.assign(b.style, {
            marginLeft: '8px',
            padding: '6px 12px',
            background: bg,
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontFamily: 'system-ui, Arial, sans-serif',
        });
        return b;
    }

    function openUI() {
        if (uiOpen) return;
        uiOpen = true;
        clearInterval(fetchIntervalId);
        scanPage();

        document.body.innerHTML = '';
        document.body.style.margin = '0';

        const bar = document.createElement('div');
        Object.assign(bar.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            background: '#111',
            color: '#eee',
            padding: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: '9999',
            fontFamily: 'system-ui, Arial, sans-serif',
            boxSizing: 'border-box',
            gap: '12px',
            flexWrap: 'wrap',
        });

        const title = document.createElement('div');
        title.textContent = getThreadID();
        title.style.fontSize = '18px';
        title.style.fontWeight = '600';
        bar.appendChild(title);

        const midContainer = document.createElement('div');
        midContainer.style.display = 'flex';
        midContainer.style.alignItems = 'center';
        midContainer.style.gap = '12px';

        const fnameInput = document.createElement('input');
        fnameInput.id = 'forum-rabbit-fname';
        fnameInput.type = 'text';
        fnameInput.placeholder = 'Base filename';
        fnameInput.value = getThreadID().replace(/[^\w.-]+/g, '_');
        Object.assign(fnameInput.style, {
            padding: '5px 8px',
            fontSize: '14px',
            borderRadius: '4px',
            border: '1px solid #555',
            background: '#222',
            color: '#fff',
            width: '180px',
        });
        midContainer.appendChild(fnameInput);

        const counter = document.createElement('div');
        counter.id = 'forum-rabbit-counter';
        counter.style.fontSize = '14px';
        midContainer.appendChild(counter);
        bar.appendChild(midContainer);

        const btns = document.createElement('div');
        const actions = [
            ['Back', '#444', () => location.reload()],
            ['Download All', '#28a745', downloadAll],
            ['Download Selected', '#218838', downloadSelected],
            ['Get Video Commands', '#17a2b8', showVideoCommands],
            ['Show URLs', '#6c757d', toggleUrlBox],
            ['Download All Links', '#20c997', downloadLinks],
        ];
        actions.forEach(([txt, bg, fn]) => {
            const b = makeBarButton(txt, bg);
            b.onclick = fn;
            btns.appendChild(b);
        });
        bar.appendChild(btns);
        document.body.appendChild(bar);

        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))',
            gap: '8px',
            padding: '88px 8px 8px',
        });

        Array.from(imageSet).forEach((src, idx) => {
            const wrap = document.createElement('div');
            wrap.dataset.idx = String(idx);
            Object.assign(wrap.style, { position: 'relative', cursor: 'pointer' });
            const img = document.createElement('img');
            img.src = src;
            img.style.width = '100%';
            img.loading = 'lazy';
            img.onload = () => {
                const badge = document.createElement('div');
                badge.textContent = `${img.naturalWidth}×${img.naturalHeight}`;
                Object.assign(badge.style, {
                    position: 'absolute',
                    top: '4px',
                    left: '4px',
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    padding: '2px 6px',
                    fontSize: '10px',
                    borderRadius: '3px',
                });
                wrap.appendChild(badge);
            };
            wrap.appendChild(img);
            wrap.onclick = (e) => {
                const i = +wrap.dataset.idx;
                if (e.shiftKey && lastSelectedIndex != null) {
                    const [s, e2] = [lastSelectedIndex, i].sort((a, b) => a - b);
                    for (let j = s; j <= e2; j++) selectedIndices.add(j);
                } else {
                    selectedIndices.has(i) ? selectedIndices.delete(i) : selectedIndices.add(i);
                    lastSelectedIndex = i;
                }
                updateSelection();
            };
            grid.appendChild(wrap);
        });

        Array.from(videoSet).forEach((src) => {
            const wrap = document.createElement('div');
            Object.assign(wrap.style, { position: 'relative' });
            const video = document.createElement('video');
            video.src = src;
            video.controls = true;
            video.style.width = '100%';
            wrap.appendChild(video);
            const badge = document.createElement('div');
            badge.textContent = 'VID';
            Object.assign(badge.style, {
                position: 'absolute',
                top: '4px',
                left: '4px',
                background: 'rgba(40,167,69,0.9)',
                color: '#fff',
                padding: '2px 6px',
                fontSize: '10px',
                borderRadius: '3px',
            });
            wrap.appendChild(badge);
            grid.appendChild(wrap);
        });

        document.body.appendChild(grid);

        const urlBox = document.createElement('textarea');
        urlBox.id = 'forum-rabbit-url-box';
        urlBox.readOnly = true;
        Object.assign(urlBox.style, {
            position: 'fixed',
            bottom: '20px',
            left: '20px',
            width: 'calc(100% - 40px)',
            height: '150px',
            display: 'none',
            background: 'rgba(0,0,0,0.92)',
            color: '#0f0',
            padding: '8px',
            border: '1px solid #0f0',
            zIndex: '9998',
            fontFamily: 'monospace',
            fontSize: '12px',
            boxSizing: 'border-box',
        });
        document.body.appendChild(urlBox);
        updateCounters();
    }

    function toggleUrlBox() {
        updateCounters();
        const box = document.getElementById('forum-rabbit-url-box');
        if (!box) return;
        box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }

    function updateCounters() {
        const counter = document.getElementById('forum-rabbit-counter');
        if (counter) {
            counter.textContent = `${imageSet.size} images, ${videoSet.size} videos, ${linkSet.size} links`;
        }
        const box = document.getElementById('forum-rabbit-url-box');
        if (!box) return;
        const lines = [];
        if (videoSet.size) {
            lines.push('Video URLs:');
            videoSet.forEach((u) => lines.push(u));
        }
        const filteredLinks = [...linkSet].filter(
            (u) => !u.includes('jpg5.su/img/') && !isImageUrl(u)
        );
        if (filteredLinks.length) {
            if (videoSet.size) lines.push('');
            lines.push('External URLs:');
            filteredLinks.forEach((u) => lines.push(u));
        }
        box.value = lines.join('\n');
    }

    function updateSelection() {
        document.querySelectorAll('[data-idx]').forEach((wrap) => {
            const i = +wrap.dataset.idx;
            wrap.style.outline = selectedIndices.has(i) ? '4px solid #28a745' : 'none';
        });
    }

    function getBaseName() {
        const input = document.getElementById('forum-rabbit-fname');
        const raw = input?.value || getThreadID();
        return raw.replace(/\s+/g, '_').replace(/[^\w.-]+/g, '_') || 'thread';
    }

    function gmDownload(url, name) {
        if (typeof GM_download === 'function') {
            GM_download({
                url,
                name,
                saveAs: false,
                onerror: () => console.error('[Forum_Rabbit] download failed:', url),
            });
            return;
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function downloadAll() {
        const base = getBaseName();
        let imgIndex = 1;
        imageSet.forEach((src) => {
            const extMatch = src.match(/\.(jpe?g|png|gif)(?:\?|$)/i);
            const ext = extMatch ? extMatch[1] : 'jpg';
            gmDownload(src, `${base}_img_${imgIndex}.${ext}`);
            imgIndex++;
        });
        let vidIndex = 1;
        videoSet.forEach((src) => {
            const extMatch = src.match(/\.(mp4|webm|ogg)(?:\?|$)/i);
            const ext = extMatch ? extMatch[1] : 'mp4';
            gmDownload(src, `${base}_vid_${vidIndex}.${ext}`);
            vidIndex++;
        });
        showNotification('Downloading all images and videos…');
    }

    function downloadSelected() {
        const base = getBaseName();
        const indices = Array.from(selectedIndices).sort((a, b) => a - b);
        if (!indices.length) {
            showNotification('No images selected');
            return;
        }
        indices.forEach((i, idx) => {
            const src = [...imageSet][i];
            if (!src) return;
            const extMatch = src.match(/\.(jpe?g|png|gif)(?:\?|$)/i);
            const ext = extMatch ? extMatch[1] : 'jpg';
            gmDownload(src, `${base}_sel_${idx + 1}.${ext}`);
        });
        showNotification('Downloading selected images…');
    }

    function showVideoCommands() {
        if (!videoSet.size) {
            showNotification('No video URLs');
            return;
        }
        const base = prompt('Base filename for videos:');
        if (!base) return;
        const cmds = [...videoSet]
            .map((u, i) => {
                const extMatch = u.match(/\.(mp4|webm|ogg)(?:\?|$)/i);
                const ext = extMatch ? extMatch[1] : 'mp4';
                return `yt-dlp "${u}" -o "${base}_${i + 1}.${ext}"`;
            })
            .join('\n\n');
        const box = document.createElement('textarea');
        box.value = cmds;
        Object.assign(box.style, {
            position: 'fixed',
            top: '20%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '60%',
            height: '40%',
            padding: '12px',
            fontSize: '12px',
            background: '#111',
            color: '#fff',
            border: '1px solid #444',
            zIndex: '10000',
            fontFamily: 'monospace',
        });
        document.body.appendChild(box);
        box.select();
        try {
            document.execCommand('copy');
            showNotification('Video commands copied');
        } catch {
            showNotification('Select and copy commands manually');
        }
    }

    function downloadLinks() {
        const base = getBaseName();
        const lines = [];
        if (videoSet.size) {
            lines.push('Video URLs:');
            videoSet.forEach((u) => lines.push(u));
        }
        const filteredLinks = [...linkSet].filter(
            (u) => !u.includes('jpg5.su/img/') && !isImageUrl(u)
        );
        if (filteredLinks.length) {
            if (videoSet.size) lines.push('');
            lines.push('External URLs:');
            filteredLinks.forEach((u) => lines.push(u));
        }
        if (!lines.length) {
            showNotification('No URLs to export');
            return;
        }
        const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${base}_urls.txt`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        showNotification('URL list downloaded');
    }

    function clearAll() {
        imageSet.clear();
        videoSet.clear();
        linkSet.clear();
        selectedIndices.clear();
        lastSelectedIndex = null;
        persist();
        notifyCounts();
        showNotification('Cleared all collected URLs');
    }

    function mountFloatingButtons() {
        if (document.getElementById('forum-rabbit-gallery-btn')) return;

        const wrap = document.createElement('div');
        wrap.id = 'forum-rabbit-float-wrap';
        Object.assign(wrap.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: '2147483646',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
        });

        const gallery = document.createElement('button');
        gallery.id = 'forum-rabbit-gallery-btn';
        gallery.type = 'button';
        gallery.textContent = 'SIMP';
        Object.assign(gallery.style, {
            padding: '10px 16px',
            background: '#28a745',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'system-ui, Arial, sans-serif',
            fontSize: '14px',
            fontWeight: '600',
            boxShadow: '0 2px 10px rgba(0,0,0,.35)',
        });
        gallery.onclick = openUI;

        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.textContent = 'Clear All';
        Object.assign(clearBtn.style, {
            padding: '8px 14px',
            background: '#dc3545',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontFamily: 'system-ui, Arial, sans-serif',
            fontSize: '13px',
            boxShadow: '0 2px 10px rgba(0,0,0,.35)',
        });
        clearBtn.onclick = clearAll;

        wrap.append(gallery, clearBtn);
        document.body.appendChild(wrap);
    }

    function startScanning() {
        clearInterval(fetchIntervalId);
        scanPage();
        fetchIntervalId = setInterval(scanPage, 500);
        const obs = new MutationObserver(() => scanPage());
        if (document.body) obs.observe(document.body, { childList: true, subtree: true });
    }

    startScanning();
    mountFloatingButtons();
    notifyCounts();
})();

/*
Credits — modified by AlexRabbit (https://github.com/AlexRabbit)
  - Cassidy — UI for Threads on SimpCity (Auto-Download + Link Export)
  - Angry Toenail — SimpCity Auto Redirect (Greasy Fork 566259)
  - SkyCloudDev ForumPostDownloader — replaced in v3 (bulk host resolver); use Gallery for thread media
*/
