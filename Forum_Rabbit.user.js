// ==UserScript==
// @name         Forum_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      3.18.1
// @description  Download images and videos from forum threads. AdGuard installer loads core automatically.
// @icon         https://www.google.com/s2/favicons?sz=64&domain=xenforo.com
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.user.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.user.js
// @match        https://simpcity.cr/threads/*
// @match        https://simpcity.is/threads/*
// @match        https://simpcity.cz/threads/*
// @match        https://simpcity.hk/threads/*
// @match        https://simpcity.rs/threads/*
// @match        https://simpcity.ax/threads/*
// @require      https://unpkg.com/@popperjs/core@2.11.8/dist/umd/popper.min.js
// @require      https://unpkg.com/tippy.js@6.3.7/dist/tippy-bundle.umd.min.js
// @require      https://unpkg.com/file-saver@2.0.4/dist/FileSaver.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js
// @require      https://cdn.jsdelivr.net/gh/geraintluff/sha256@gh-pages/sha256.min.js
// @connect      *
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_openInTab
// ==/UserScript==

(function () {
    'use strict';
    if (globalThis.__FORUM_RABBIT_LOADED__) return;

    const CORE_URLS = [
        'https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Forum_Rabbit.core.js',
    ];

    function runCore(source) {
        try {
            globalThis.__FORUM_RABBIT_LOADED__ = true;
            eval(source);
        } catch (err) {
            console.error('[Forum_Rabbit] failed to start:', err);
        }
    }

    function loadFromUrl(index) {
        if (index >= CORE_URLS.length) {
            console.error('[Forum_Rabbit] could not download core script');
            return;
        }
        GM_xmlhttpRequest({
            method: 'GET',
            url: CORE_URLS[index],
            onload(res) {
                if (res.status === 200 && res.responseText) {
                    runCore(res.responseText);
                    return;
                }
                loadFromUrl(index + 1);
            },
            onerror() {
                loadFromUrl(index + 1);
            },
        });
    }

    loadFromUrl(0);
})();
