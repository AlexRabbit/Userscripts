// ==UserScript==
// @name         Instagram_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.0.4
// @description  Download posts, stories, highlights; native video controls with saved volume. AdGuard-ready.
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://www.instagram.com/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Instagram_Rabbit.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Instagram_Rabbit.js
// @supportURL   https://github.com/AlexRabbit/Userscripts/issues
// ==/UserScript==

(function () {
    'use strict';

    const VOL_KEY = 'ig_rabbit_volume';
    const volDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'volume');
    const mutedDesc = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'muted');
    const nativeAppend = Node.prototype.appendChild;
    const nativeInsertBefore = Node.prototype.insertBefore;
    const nativeReplaceChild = Node.prototype.replaceChild;
    const wired = new WeakSet();

    const getVolume = () => {
        try {
            const raw = localStorage.getItem(VOL_KEY);
            if (raw === null) return 0;
            const v = parseFloat(raw);
            return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
        } catch {
            return 0;
        }
    };

    const setVolume = (v) => {
        try {
            localStorage.setItem(VOL_KEY, String(Math.min(1, Math.max(0, v))));
        } catch {}
    };

    Object.defineProperty(HTMLMediaElement.prototype, 'volume', {
        get: volDesc.get,
        set() {
            return true;
        },
    });

    Object.defineProperty(HTMLMediaElement.prototype, 'muted', {
        get: mutedDesc.get,
        set() {
            return true;
        },
    });

    const wireVideo = (node) => {
        if (!node || node.tagName !== 'VIDEO') return;

        node.setAttribute('controls', true);

        if (wired.has(node)) {
            volDesc.set.call(node, getVolume());
            return;
        }
        wired.add(node);

        volDesc.set.call(node, getVolume());
        node.addEventListener('pause', (ev) => ev.stopImmediatePropagation(), true);
        node.addEventListener('play', () => volDesc.set.call(node, getVolume()), true);
        node.addEventListener('volumechange', () => setVolume(node.volume), true);
    };

    const patchTree = (root) => {
        if (!root || root.nodeType !== 1) return;
        if (root.tagName === 'VIDEO') wireVideo(root);
        root.querySelectorAll?.('video').forEach(wireVideo);
    };

    Node.prototype.appendChild = function (node) {
        const result = nativeAppend.call(this, node);
        wireVideo(node);
        patchTree(node);
        return result;
    };

    Node.prototype.insertBefore = function (node, ref) {
        const result = nativeInsertBefore.call(this, node, ref);
        wireVideo(node);
        patchTree(node);
        return result;
    };

    Node.prototype.replaceChild = function (node, old) {
        const result = nativeReplaceChild.call(this, node, old);
        wireVideo(node);
        patchTree(node);
        return result;
    };

    (document.head || document.documentElement).insertAdjacentHTML(
        'beforeend',
        `<style id="ig-rabbit-vc-style">
        video::-webkit-media-controls {
            display: block !important;
        }
        [data-instancekey]:has([d^="M1.5 13"]) {
            display: none !important;
        }
    </style>`
    );

    const lateScan = () => patchTree(document.documentElement);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', lateScan, { once: true });
    } else {
        lateScan();
    }
})();

(function () {
    'use strict';

    const disableNewUrlFetchMethod = false;
    const prefetchAndAttachLink = false; // prefetch and add link into the button elements
    const hoverToFetchAndAttachLink = true;  // fetch and add link when hover the button
    const replaceJpegWithJpg = false;
    const postFilenameTemplate = '%id%-%datetime%-%medianame%';
    const storyFilenameTemplate = postFilenameTemplate;
    const datetimeTemplate = '%y%%m%%d%_%H%%M%%S%';

    const postIdPattern = /^\/p\/([^/]+)\//;
    const postUrlPattern = /instagram\.com\/p\/[\w-]+\//;

    var svgDownloadBtn = `<svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" height="24" width="24"
     viewBox="0 0 477.867 477.867" style="fill:%color;" xml:space="preserve">
    <g>
        <path d="M443.733,307.2c-9.426,0-17.067,7.641-17.067,17.067v102.4c0,9.426-7.641,17.067-17.067,17.067H68.267
            c-9.426,0-17.067-7.641-17.067-17.067v-102.4c0-9.426-7.641-17.067-17.067-17.067s-17.067,7.641-17.067,17.067v102.4
            c0,28.277,22.923,51.2,51.2,51.2H409.6c28.277,0,51.2-22.923,51.2-51.2v-102.4C460.8,314.841,453.159,307.2,443.733,307.2z"/>
    </g>
    <g>
        <path d="M335.947,295.134c-6.614-6.387-17.099-6.387-23.712,0L256,351.334V17.067C256,7.641,248.359,0,238.933,0
            s-17.067,7.641-17.067,17.067v334.268l-56.201-56.201c-6.78-6.548-17.584-6.36-24.132,0.419c-6.388,6.614-6.388,17.099,0,23.713
            l85.333,85.333c6.657,6.673,17.463,6.687,24.136,0.031c0.01-0.01,0.02-0.02,0.031-0.031l85.333-85.333
            C342.915,312.486,342.727,301.682,335.947,295.134z"/>
    </g>
</svg>`;

    var svgNewtabBtn = `<svg id="Capa_1" style="fill:%color;" viewBox="0 0 482.239 482.239" xmlns="http://www.w3.org/2000/svg" height="24" width="24">
    <path d="m465.016 0h-344.456c-9.52 0-17.223 7.703-17.223 17.223v86.114h-86.114c-9.52 0-17.223 7.703-17.223 17.223v344.456c0 9.52 7.703 17.223 17.223 17.223h344.456c9.52 0 17.223-7.703 17.223-17.223v-86.114h86.114c9.52 0 17.223-7.703 17.223-17.223v-344.456c0-9.52-7.703-17.223-17.223-17.223zm-120.56 447.793h-310.01v-310.01h310.011v310.01zm103.337-103.337h-68.891v-223.896c0-9.52-7.703-17.223-17.223-17.223h-223.896v-68.891h310.011v310.01z"/>
</svg>`;

    var preUrl = "";

    function boot() {
    document.addEventListener('keydown', keyDownHandler);

    function keyDownHandler(event) {
        if (window.location.href === 'https://www.instagram.com/') return;

        const mockEventTemplate = {
            stopPropagation: function () { },
            preventDefault: function () { }
        };

        if (event.altKey && (event.code === 'KeyK' || event.key == 'k')) {
            let buttons = document.getElementsByClassName('download-btn');
            if (buttons.length > 0) {
                let mockEvent = { ...mockEventTemplate };
                mockEvent.currentTarget = buttons[buttons.length - 1];
                if (prefetchAndAttachLink || hoverToFetchAndAttachLink) onMouseInHandler(mockEvent);
                onClickHandler(mockEvent);
            }
        }
        if (event.altKey && (event.code === 'KeyI' || event.key == 'i')) {
            let buttons = document.getElementsByClassName('newtab-btn');
            if (buttons.length > 0) {
                let mockEvent = { ...mockEventTemplate };
                mockEvent.currentTarget = buttons[buttons.length - 1];
                if (prefetchAndAttachLink || hoverToFetchAndAttachLink) onMouseInHandler(mockEvent);
                onClickHandler(mockEvent);
            }
        }

        if (event.altKey && (event.code === 'KeyL' || event.key == 'l')) {
            let buttons = document.getElementsByClassName('_9zm2');
            if (buttons.length > 0) {
                buttons[0].click();
            }
        }

        if (event.altKey && (event.code === 'KeyJ' || event.key == 'j')) {
            let buttons = document.getElementsByClassName('_9zm0');
            if (buttons.length > 0) {
                buttons[0].click();
            }
        }
    }

    function isPostPage() {
        return Boolean(window.location.href.match(postUrlPattern));
    }

    function queryHas(root, selector, has) {
        let nodes = root.querySelectorAll(selector);
        for (let i = 0; i < nodes.length; ++i) {
            let currentNode = nodes[i];
            if (currentNode.querySelector(has)) {
                return currentNode;
            }
        }
        return null;
    }

    var checkExistTimer = setInterval(function () {
        const curUrl = window.location.href;
        const savePostSelector = 'article *:not(li)>*>*>*>div:not([class])>div[role="button"]:not([style]):not([tabindex="-1"])';
        const storySelector = 'section > *:not(main) header div>svg:not([aria-label=""])';
        const profileSelector = 'header section svg circle';
        const playSvgPathSelector = 'path[d="M5.888 22.5a3.46 3.46 0 0 1-1.721-.46l-.003-.002a3.451 3.451 0 0 1-1.72-2.982V4.943a3.445 3.445 0 0 1 5.163-2.987l12.226 7.059a3.444 3.444 0 0 1-.001 5.967l-12.22 7.056a3.462 3.462 0 0 1-1.724.462Z"]';
        const pauseSvgPathSelector = 'path[d="M15 1c-3.3 0-6 1.3-6 3v40c0 1.7 2.7 3 6 3s6-1.3 6-3V4c0-1.7-2.7-3-6-3zm18 0c-3.3 0-6 1.3-6 3v40c0 1.7 2.7 3 6 3s6-1.3 6-3V4c0-1.7-2.7-3-6-3z"]';

        let rgb = getComputedStyle(document.body).backgroundColor.match(/[.?\d]+/g);
        let iconColor = (rgb[0] * 0.299 + rgb[1] * 0.587 + rgb[2] * 0.114) <= 150 ? 'white' : 'black'

        if (preUrl !== curUrl) {
            while (document.getElementsByClassName('custom-btn').length !== 0) {
                document.getElementsByClassName('custom-btn')[0].remove();
            }
        }

        let articleList = document.querySelectorAll('article');
        for (let i = 0; i < articleList.length; i++) {
            let buttonAnchor = (Array.from(articleList[i].querySelectorAll(savePostSelector))).pop();
            if (buttonAnchor && articleList[i].getElementsByClassName('custom-btn').length === 0) {
                addCustomBtn(buttonAnchor, iconColor, append2Post);
            }
        }

        if (isPostPage()) {
            let savebtn = queryHas(document, 'div[role="button"] > div[role="button"]:not([style])', 'polygon[points="20 21 12 13.44 4 21 4 3 20 3 20 21"]') || queryHas(document, 'div[role="button"] > div[role="button"]:not([style])', 'path[d="M20 22a.999.999 0 0 1-.687-.273L12 14.815l-7.313 6.912A1 1 0 0 1 3 21V3a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1Z"]');
            if (document.getElementsByClassName('custom-btn').length === 0) {
                if (savebtn.parentNode.querySelector('svg')) {
                    addCustomBtn(savebtn.parentNode.querySelector('svg'), iconColor, append2IndependentPost);
                }
            }
        }

        if (document.getElementsByClassName('custom-btn').length === 0 && !curUrl.includes("stor")) {
            if (document.querySelector(profileSelector)) {
                addCustomBtn(document.querySelector(profileSelector), iconColor, append2Header);
            }
        }

        if (document.getElementsByClassName('custom-btn').length === 0) {
            let playPauseSvg = queryHas(document, 'svg', playSvgPathSelector) || queryHas(document, 'svg', pauseSvgPathSelector);
            if (playPauseSvg) {
                let buttonDiv = playPauseSvg.parentNode;
                addCustomBtn(buttonDiv, 'white', append2Story);
            }
        }

        preUrl = curUrl;
    }, 500);

    function append2Post(node, btn) {
        node.append(btn);
    }

    function append2IndependentPost(node, btn) {
        node.parentNode.parentNode.append(btn);
    }

    function append2Header(node, btn) {
        node.parentNode.parentNode.parentNode.appendChild(btn, node.parentNode.parentNode);
    }

    function append2Story(node, btn) {
        node.parentNode.parentNode.parentNode.append(btn);
    }

    function addCustomBtn(node, iconColor, appendNode) {
        let newtabBtn = createCustomBtn(svgNewtabBtn, iconColor, 'newtab-btn', '16px');
        appendNode(node, newtabBtn);

        let downloadBtn = createCustomBtn(svgDownloadBtn, iconColor, 'download-btn', '14px');
        appendNode(node, downloadBtn);

        if (prefetchAndAttachLink) {
            onMouseInHandler({ currentTarget: newtabBtn });
            onMouseInHandler({ currentTarget: downloadBtn });
        }
    }

    function createCustomBtn(svg, iconColor, className, marginLeft) {
        let newBtn = document.createElement('a');
        newBtn.innerHTML = svg.replace('%color', iconColor);
        newBtn.setAttribute('class', 'custom-btn ' + className);
        newBtn.setAttribute('target', '_blank');
        newBtn.setAttribute('style', 'cursor: pointer;margin-left: ' + marginLeft + ';margin-top: 8px;z-index: 999;');
        newBtn.onclick = onClickHandler;
        if (hoverToFetchAndAttachLink) newBtn.onmouseenter = onMouseInHandler;
        if (className.includes('newtab')) {
            newBtn.setAttribute('title', 'Open in new tab');
        } else {
            newBtn.setAttribute('title', 'Download');
        }
        return newBtn;
    }

    function onClickHandler(e) {
        let target = e.currentTarget;
        e.stopPropagation();
        e.preventDefault();
        if (window.location.pathname.includes('stories')) {
            storyOnClicked(target);
        } else if (document.querySelector('header') && document.querySelector('header').contains(target)) {
            profileOnClicked(target);
        } else {
            postOnClicked(target);
        }
    }

    function onMouseInHandler(e) {
        let target = e.currentTarget;
        if (!prefetchAndAttachLink && !hoverToFetchAndAttachLink) return;
        if (window.location.pathname.includes('stories')) {
            storyOnMouseIn(target);
        } else if (document.querySelector('header') && document.querySelector('header').contains(target)) {
            profileOnMouseIn(target);
        } else {
            postOnMouseIn(target);
        }
    }

    function profileOnMouseIn(target) {
        let url = profileGetUrl(target);
        target.setAttribute('href', url);
    }

    function profileOnClicked(target) {
        let url = profileGetUrl(target);

        if (url.length > 0) {
            if (target.getAttribute('class').includes('download-btn')) {
                const filename = document.querySelector('header h2').textContent;
                downloadResource(url, filename);
            } else {
                openResource(url);
            }
        }
    }

    function profileGetUrl(target) {
        let img = document.querySelector('header img');
        let url = img.getAttribute('src');
        return url;
    }

    async function postOnMouseIn(target) {
        let articleNode = postGetArticleNode(target);
        let { url } = await postGetUrl(target, articleNode);
        target.setAttribute('href', url);
    }

    async function postOnClicked(target) {
        try {
            let articleNode = postGetArticleNode(target);
            let { url, mediaIndex } = await postGetUrl(target, articleNode);

            if (url.length > 0) {
                if (target.getAttribute('class').includes('download-btn')) {
                    let mediaName = url
                        .split('?')[0]
                        .split('\\')
                        .pop()
                        .split('/')
                        .pop();
                    mediaName = mediaName.substring(0, mediaName.lastIndexOf('.'));
                    let datetime = new Date(articleNode.querySelector('time').getAttribute('datetime'));
                    let posterName = articleNode.querySelector('header a') || findPostName(articleNode);
                    posterName = posterName.getAttribute('href').replace(/\//g, '');
                    let postId = findPostId(articleNode);
                    let filename = filenameFormat(postFilenameTemplate, posterName, datetime, mediaName, postId, mediaIndex);
                    downloadResource(url, filename);
                } else {
                    openResource(url);
                }
            }
        } catch (e) {
            console.log(`Uncatched in postOnClicked(): ${e}\n${e.stack}`);
            return null;
        }
    }

    function postGetArticleNode(target) {
        let articleNode = target;
        while (articleNode && articleNode.tagName !== 'ARTICLE' && articleNode.tagName !== 'MAIN') {
            articleNode = articleNode.parentNode;
        }
        return articleNode;
    }

    async function postGetUrl(target, articleNode) {
        let list = articleNode.querySelectorAll('li[style][class]');
        let url = null;
        let mediaIndex = 0;
        if (list.length === 0) {
            if (!disableNewUrlFetchMethod) url = await getUrlFromInfoApi(articleNode);
            if (url === null) {
                let videoElem = articleNode.querySelector('video');
                if (videoElem) {
                    url = videoElem.getAttribute('src');
                    if (videoElem.hasAttribute('videoURL')) {
                        url = videoElem.getAttribute('videoURL');
                    } else if (url === null || url.includes('blob')) {
                        url = await fetchVideoURL(articleNode, videoElem);
                    }
                } else if (articleNode.querySelector('article  div[role] div > img')) {
                    url = articleNode.querySelector('article  div[role] div > img').getAttribute('src');
                } else {
                    console.log('Err: not find media at handle post single');
                }
            }
        } else {
            const postView = location.pathname.startsWith('/p/');
            let dotsElements = [...articleNode.querySelectorAll(`div._acnb`)];
            mediaIndex = [...dotsElements].reduce((result, element, index) => (element.classList.length === 2 ? index : result), null);
            if (mediaIndex === null) throw 'Cannot find the media index';

            if (!disableNewUrlFetchMethod) url = await getUrlFromInfoApi(articleNode, mediaIndex);
            if (url === null) {
                const listElements = [...articleNode.querySelectorAll(`:scope > div > div:nth-child(${postView ? 1 : 2}) > div > div:nth-child(1) ul li[style*="translateX"]`)];
                const listElementWidth = Math.max(...listElements.map(element => element.clientWidth));

                const positionsMap = listElements.reduce((result, element) => {
                    const position = Math.round(Number(element.style.transform.match(/-?(\d+)/)[1]) / listElementWidth);
                    return { ...result, [position]: element };
                }, {});

                const node = positionsMap[mediaIndex];
                if (node.querySelector('video')) {
                    let videoElem = node.querySelector('video');
                    url = videoElem.getAttribute('src');
                    if (videoElem.hasAttribute('videoURL')) {
                        url = videoElem.getAttribute('videoURL');
                    } else if (url === null || url.includes('blob')) {
                        url = await fetchVideoURL(articleNode, videoElem);
                    }
                } else if (node.querySelector('img')) {
                    url = node.querySelector('img').getAttribute('src');
                }
            }
        }
        return { url, mediaIndex };
    }

    function findHighlightsIndex() {
        let currentDivProgressbarDiv = document.querySelector('div[style^="transform"]').parentElement;
        let progressbarRootDiv = currentDivProgressbarDiv.parentElement;
        let progressbarDivs = progressbarRootDiv.children;
        return Array.from(progressbarDivs).indexOf(currentDivProgressbarDiv);
    }

    let infoCache = {}; // key: media id, value: info json
    let mediaIdCache = {}; // key: post id, value: media id
    async function getUrlFromInfoApi(articleNode, mediaIdx = 0) {
        try {
            const appIdPattern = /"X-IG-App-ID":"([\d]+)"/;
            const mediaIdPattern = /instagram:\/\/media\?id=(\d+)|["' ]media_id["' ]:["' ](\d+)["' ]/;
            function findAppId() {
                let bodyScripts = document.querySelectorAll("body > script");
                for (let i = 0; i < bodyScripts.length; ++i) {
                    let match = bodyScripts[i].text.match(appIdPattern);
                    if (match) return match[1];
                }
                console.log("Cannot find app id");
                return null;
            }

            async function findMediaId() {
                function method1() {
                    let href = window.location.href;
                    let match = href.match(/www.instagram.com\/stories\/[^\/]+\/(\d+)/);
                    if (!href.includes('highlights') && match) return match[1];
                }

                async function method3() {
                    let postId = await findPostId(articleNode);
                    if (!postId) {
                        return null;
                    }

                    if (!(postId in mediaIdCache)) {
                        let postUrl = `https://www.instagram.com/p/${postId}/`;
                        let resp = await fetch(postUrl);
                        let text = await resp.text();
                        let idMatch = text ? text.match(mediaIdPattern) : [];
                        let mediaId = null;
                        for (let i = 0; i < idMatch.length; ++i) {
                            if (idMatch[i]) mediaId = idMatch[i];
                        }
                        if (!mediaId) return null;
                        mediaIdCache[postId] = mediaId;
                    }
                    return mediaIdCache[postId];
                }

                function method2() {
                    let scriptJson = document.querySelectorAll('script[type="application/json"]');
                    for (let i = 0; i < scriptJson.length; i++) {
                        let match = scriptJson[i].text.match(/"pk":"(\d+)","id":"[\d_]+"/);
                        if (match) {
                            if (!window.location.href.includes('highlights')) {
                                return match[1];
                            }
                            let matchs = Array.from(scriptJson[i].text.matchAll(/"pk":"(\d+)","id":"[\d_]+"/g), match => match[1]);
                            const matchIndex = findHighlightsIndex();
                            if (matchs.length > matchIndex) {
                                return matchs[matchIndex];
                            }
                        }
                    }
                }

                return method1() || await method3() || method2();
            }

            function getImgOrVedioUrl(item) {
                if ("video_versions" in item) {
                    return item.video_versions[0].url;
                } else {
                    return item.image_versions2.candidates[0].url;
                }
            }

            let appId = findAppId();
            if (!appId) return null;
            let headers = {
                method: 'GET',
                headers: {
                    Accept: '*/*',
                    'X-IG-App-ID': appId
                },
                credentials: 'include',
                mode: 'cors'
            };

            let mediaId = await findMediaId();
            if (!mediaId) {
                console.log("Cannot find media id");
                return null;
            }
            if (!(mediaId in infoCache)) {
                let url = 'https://i.instagram.com/api/v1/media/' + mediaId + '/info/';
                let resp = await fetch(url, headers);
                if (resp.status !== 200) {
                    console.log(`Fetch info API failed with status code: ${resp.status}`);
                    return null;
                }
                let respJson = await resp.json();
                infoCache[mediaId] = respJson;
            }
            let infoJson = infoCache[mediaId];
            if ('carousel_media' in infoJson.items[0]) {
                return getImgOrVedioUrl(infoJson.items[0].carousel_media[mediaIdx]);
            } else {
                return getImgOrVedioUrl(infoJson.items[0]);
            }
        } catch (e) {
            console.log(`Uncatched in getUrlFromInfoApi(): ${e}\n${e.stack}`);
            return null;
        }
    }

    function findPostName(articleNode) {
        let imgNoCanvas = articleNode.querySelector('article section + * a[href^="/"][href$="/"]');
        if (imgNoCanvas) {
            return imgNoCanvas;
        }

        let imgAlt = articleNode.querySelector('canvas ~ * img');
        if (imgAlt) {
            imgAlt = imgAlt.getAttribute('alt');
            let links = articleNode.querySelectorAll('a');
            for (let i = 0; i < links.length; i++) {
                const posterName = links[i].getAttribute('href').replace(/\//g, '');
                if (imgAlt.includes(posterName)) {
                    return links[i];
                }
            }
        } else {
            const el = document.querySelector('h2[dir]');
            return el.innerText;
        }
    }

    function findPostId(articleNode) {
        let aNodes = articleNode.querySelectorAll('a');
        for (let i = 0; i < aNodes.length; ++i) {
            let link = aNodes[i].getAttribute('href');
            if (link) {
                let match = link.match(postIdPattern);
                if (match) return match[1];
            }
        }
        return null;
    }

    async function fetchVideoURL(articleNode, videoElem) {
        let poster = videoElem.getAttribute('poster');
        let timeNodes = articleNode.querySelectorAll('time');
        // special thanks 孙年忠 (https://greasyfork.org/en/scripts/406535-instagram-download-button/discussions/120159)
        let posterUrl = timeNodes[timeNodes.length - 1].parentNode.parentNode.href;
        const posterPattern = /\/([^\/?]*)\?/;
        let posterMatch = poster.match(posterPattern);
        let postFileName = posterMatch[1];
        let resp = await fetch(posterUrl);
        let content = await resp.text();
        // special thanks to 孙年忠 for the pattern (https://greasyfork.org/zh-TW/scripts/406535-instagram-download-button/discussions/116675)
        const pattern = new RegExp(`${postFileName}.*?video_versions.*?url":("[^"]*")`, 's');
        let match = content.match(pattern);
        let videoUrl = JSON.parse(match[1]);
        videoUrl = videoUrl.replace(/^(?:https?:\/\/)?(?:[^@\/\n]+@)?(?:www\.)?([^:\/?\n]+)/g, 'https://scontent.cdninstagram.com');
        videoElem.setAttribute('videoURL', videoUrl);
        return videoUrl;
    }

    async function storyOnMouseIn(target) {
        let sectionNode = storyGetSectionNode(target);
        let url = await storyGetUrl(target, sectionNode);
        target.setAttribute('href', url);
    }

    async function storyOnClicked(target) {
        let sectionNode = storyGetSectionNode(target);
        let url = await storyGetUrl(target, sectionNode);
        const posterUrlPat = /\/stories\/(.*)\/.*\//
        if (target.getAttribute('class').includes('download-btn')) {
            let mediaName = url.split('?')[0].split('\\').pop().split('/').pop();
            mediaName = mediaName.substring(0, mediaName.lastIndexOf('.'));
            let datetime = new Date(sectionNode.querySelector('time').getAttribute('datetime'));
            let posterName = "unkown";
            const posterNameHeader = sectionNode.querySelector('header a');
            if (posterNameHeader) {
                posterName = posterNameHeader.getAttribute('href').replace(/\//g, '');
            }

            if (posterName === "unkown") {
                const match = window.location.pathname.match(posterUrlPat);
                if (match) {
                    posterName = match[1];
                }
            }
            let filename = filenameFormat(storyFilenameTemplate, posterName, datetime, mediaName);
            downloadResource(url, filename);
        } else {
            openResource(url);
        }
    }

    function storyGetSectionNode(target) {
        let sectionNode = target;
        while (sectionNode && sectionNode.tagName !== 'SECTION') {
            sectionNode = sectionNode.parentNode;
        }
        return sectionNode;
    }

    async function storyGetUrl(target, sectionNode) {
        let url = null;
        if (!disableNewUrlFetchMethod) url = await getUrlFromInfoApi(target);

        if (!url) {
            if (sectionNode.querySelector('video > source')) {
                url = sectionNode.querySelector('video > source').getAttribute('src');
            } else if (sectionNode.querySelector('img[decoding="sync"]')) {
                let img = sectionNode.querySelector('img[decoding="sync"]');
                url = img.srcset.split(/ \d+w/g)[0].trim(); // extract first src from srcset attr. of img
                if (url.length > 0) {
                    return url;
                }
                url = sectionNode.querySelector('img[decoding="sync"]').getAttribute('src');
            } else if (sectionNode.querySelector('video')) {
                url = sectionNode.querySelector('video').getAttribute('src');
            }
        }
        return url;
    }

    function filenameFormat(template, id, datetime, medianame, postId = +new Date(), mediaIndex = '0') {
        let filename = template;
        filename = filename.replace(/%id%/g, id);
        filename = filename.replace(/%datetime%/g, datetimeFormat(datetimeTemplate, datetime));
        filename = filename.replace(/%medianame%/g, medianame);
        filename = filename.replace(/%postId%/g, postId);
        filename = filename.replace(/%mediaIndex%/g, mediaIndex);
        return filename;
    }

    function datetimeFormat(template, datetime) {
        let datetimeStr = template;
        datetimeStr = datetimeStr.replace(/%y%/g, datetime.getFullYear());
        datetimeStr = datetimeStr.replace(/%m%/g, fillZero((datetime.getMonth() + 1).toString()));
        datetimeStr = datetimeStr.replace(/%d%/g, fillZero(datetime.getDate().toString()));
        datetimeStr = datetimeStr.replace(/%H%/g, fillZero(datetime.getHours().toString()));
        datetimeStr = datetimeStr.replace(/%M%/g, fillZero(datetime.getMinutes().toString()));
        datetimeStr = datetimeStr.replace(/%S%/g, fillZero(datetime.getSeconds().toString()));
        return datetimeStr;
    }

    function fillZero(str) {
        if (str.length === 1) {
            return '0' + str;
        }
        return str;
    }

    function openResource(url) {
        var a = document.createElement('a');
        a.href = url;
        a.setAttribute('target', '_blank');
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function forceDownload(blob, filename, extension) {
        // ref: https://stackoverflow.com/questions/49474775/chrome-65-blocks-cross-origin-a-download-client-side-workaround-to-force-down
        var a = document.createElement('a');
        if (replaceJpegWithJpg) extension = extension.replace('jpeg', 'jpg');
        a.download = filename + '.' + extension;
        a.href = blob;
        // For Firefox https://stackoverflow.com/a/32226068
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function downloadResource(url, filename) {
        if (url.startsWith('blob:')) {
            forceDownload(url, filename, 'mp4');
            return;
        }
        console.log(`Dowloading ${url}`);
        // ref: https://stackoverflow.com/questions/49474775/chrome-65-blocks-cross-origin-a-download-client-side-workaround-to-force-down
        if (!filename) {
            filename = url
                .split('\\')
                .pop()
                .split('/')
                .pop();
        }
        fetch(url, {
            headers: new Headers({
                'User-Agent': window.navigator.userAgent,
                Origin: location.origin,
            }),
            mode: 'cors',
        })
            .then(response => response.blob())
            .then(blob => {
                const extension = blob.type.split('/').pop();
                let blobUrl = window.URL.createObjectURL(blob);
                forceDownload(blobUrl, filename, extension);
            })
            .catch(e => console.error(e));
    }

    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();


/*
Credits — modified by AlexRabbit (https://github.com/AlexRabbit)
  - ZhiYu (y252328) — Instagram Download Button
  - hdyzen — Instagram standard video controls
  - Piknockyou — Ultimate Video Controls (not bundled)
  - snkoarashi — IG Helper (inspiration; not bundled)
*/
