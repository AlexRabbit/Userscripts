(function () {
    'use strict';

    const postIdPattern = /^\/p\/([^/]+)\//;
    const postUrlPattern = /instagram\.com\/p\/[\w-]+\//;
    const disableNewUrlFetchMethod = false;
    const hoverToFetchAndAttachLink = true;
    const postFilenameTemplate = '%id%-%datetime%-%medianame%';
    const storyFilenameTemplate = postFilenameTemplate;
    const datetimeTemplate = '%y%%m%%d%_%H%%M%%S%';

    const style = document.createElement('style');
    style.id = 'ar-ig-download-styles';
    style.textContent = `
        .ar-ig-actions{display:inline-flex;align-items:center;gap:6px;margin-left:6px;vertical-align:middle;position:relative;z-index:5;flex-shrink:0}
        .ar-ig-btn{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;padding:0;border:none;border-radius:8px;background:transparent;cursor:pointer;color:inherit;opacity:.9}
        .ar-ig-btn:hover{opacity:1;background:rgba(128,128,128,.15)}
        .ar-ig-btn svg{width:22px;height:22px;display:block;pointer-events:none}
        article video,article img[src],section video,section img[src]{pointer-events:auto!important}
        div._aagw,div[class*="_aagw"]{pointer-events:none!important}
    `;
    (document.head || document.documentElement).appendChild(style);

    document.addEventListener(
        'contextmenu',
        (e) => {
            const media = e.target.closest(
                'article video, article img, section video, section img, main video, main img'
            );
            if (media) e.stopImmediatePropagation();
        },
        true
    );

    const svgDownload = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zm0 9H5v2h14v-2z"/></svg>`;
    const svgOpen = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>`;

    let preUrl = '';

    function findActionHost(article) {
        if (!article) return null;
        const sections = article.querySelectorAll('section');
        for (let i = sections.length - 1; i >= 0; i--) {
            const sec = sections[i];
            const candidates = [
                sec.querySelector(':scope > div > div'),
                sec.querySelector(':scope > div'),
                sec,
            ];
            for (const row of candidates) {
                if (!row) continue;
                const buttons = row.querySelectorAll('[role="button"]');
                if (buttons.length >= 3) return row;
            }
        }
        const saveSvg = article.querySelector(
            'svg[aria-label="Save"], svg[aria-label="Guardar"], svg[aria-label="Enregistrer"]'
        );
        if (saveSvg) {
            return (
                saveSvg.closest('section > div > div') ||
                saveSvg.closest('motion.div')?.parentElement ||
                saveSvg.parentElement?.parentElement
            );
        }
        return null;
    }

    function findProfileHost() {
        const header = document.querySelector('header section');
        if (!header) return null;
        return (
            header.querySelector('div[class*="avatar"]')?.parentElement ||
            header.querySelector('img')?.closest('motion.div')?.parentElement ||
            header.querySelector('canvas')?.parentElement
        );
    }

    function createBtn(svg, className, title) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `ar-ig-btn ar-ig-${className}`;
        btn.title = title;
        btn.setAttribute('aria-label', title);
        btn.innerHTML = svg;
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            onClickHandler({ currentTarget: btn });
        });
        if (hoverToFetchAndAttachLink) {
            btn.addEventListener('mouseenter', () => onMouseInHandler({ currentTarget: btn }));
        }
        return btn;
    }

    function injectActions(host, kind) {
        if (!host || host.querySelector('.ar-ig-actions')) return;
        const bar = document.createElement('div');
        bar.className = 'ar-ig-actions';
        bar.dataset.arIgKind = kind;
        bar.appendChild(createBtn(svgOpen, 'open', 'Open media'));
        bar.appendChild(createBtn(svgDownload, 'download', 'Download'));
        host.appendChild(bar);
    }

    function scan() {
        const curUrl = location.href;
        if (preUrl !== curUrl) {
            document.querySelectorAll('.ar-ig-actions').forEach((el) => el.remove());
        }
        preUrl = curUrl;

        document.querySelectorAll('article').forEach((article) => {
            const host = findActionHost(article);
            if (host) injectActions(host, 'post');
        });

        if (location.pathname.includes('/stories/')) {
            const storyHost =
                document.querySelector('section [role="button"]')?.parentElement?.parentElement;
            if (storyHost && !document.querySelector('.ar-ig-actions')) {
                injectActions(storyHost, 'story');
            }
        }

        if (
            !document.querySelector('.ar-ig-actions') &&
            location.pathname.match(/^\/[^/]+\/?$/) &&
            !location.pathname.includes('/p/')
        ) {
            const ph = findProfileHost();
            if (ph) injectActions(ph, 'profile');
        }
    }

    const observer = new MutationObserver(() => scan());
    scan();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });

    function isPostPage() {
        return postUrlPattern.test(location.href);
    }

    function queryHas(root, selector, has) {
        const nodes = root.querySelectorAll(selector);
        for (const node of nodes) {
            if (node.querySelector(has)) return node;
        }
        return null;
    }

    function onClickHandler(e) {
        const target = e.currentTarget;
        if (location.pathname.includes('stories')) storyOnClicked(target);
        else if (target.closest('header')) profileOnClicked(target);
        else postOnClicked(target);
    }

    function onMouseInHandler(e) {
        const target = e.currentTarget;
        if (location.pathname.includes('stories')) storyOnMouseIn(target);
        else if (target.closest('header')) profileOnMouseIn(target);
        else postOnMouseIn(target);
    }

    async function profileOnMouseIn(target) {
        target.dataset.arMediaUrl = profileGetUrl();
    }

    function profileOnClicked(target) {
        const url = profileGetUrl();
        if (!url) return;
        if (target.classList.contains('ar-ig-download')) {
            const filename = document.querySelector('header h2,h1')?.textContent?.trim() || 'profile';
            downloadResource(url, filename);
        } else openResource(url);
    }

    function profileGetUrl() {
        const img = document.querySelector('header img[src]');
        return img?.getAttribute('src') || '';
    }

    async function postOnMouseIn(target) {
        const articleNode = postGetArticleNode(target);
        const { url } = await postGetUrl(target, articleNode);
        if (url) target.dataset.arMediaUrl = url;
    }

    async function postOnClicked(target) {
        try {
            const articleNode = postGetArticleNode(target);
            const { url, mediaIndex } = await postGetUrl(target, articleNode);
            if (!url) {
                console.warn('[Instagram_Rabbit] No media URL found');
                return;
            }
            if (target.classList.contains('ar-ig-download')) {
                let mediaName = url.split('?')[0].split('/').pop() || 'media';
                mediaName = mediaName.includes('.')
                    ? mediaName.substring(0, mediaName.lastIndexOf('.'))
                    : mediaName;
                const timeEl = articleNode.querySelector('time');
                const datetime = timeEl
                    ? new Date(timeEl.getAttribute('datetime'))
                    : new Date();
                let posterName = articleNode.querySelector('header a[href^="/"]');
                posterName = posterName
                    ? posterName.getAttribute('href').replace(/\//g, '')
                    : 'unknown';
                const postId = findPostId(articleNode) || 'post';
                const filename = filenameFormat(
                    postFilenameTemplate,
                    posterName,
                    datetime,
                    mediaName,
                    postId,
                    mediaIndex
                );
                downloadResource(url, filename);
            } else {
                openResource(url);
            }
        } catch (err) {
            console.error('[Instagram_Rabbit]', err);
        }
    }

    function postGetArticleNode(target) {
        let node = target;
        while (node && node.tagName !== 'ARTICLE' && node.tagName !== 'MAIN') {
            node = node.parentNode;
        }
        return node || document.querySelector('article') || document.body;
    }

    async function postGetUrl(target, articleNode) {
        let list = articleNode.querySelectorAll('li[style][class]');
        let url = null;
        let mediaIndex = 0;
        if (list.length === 0) {
            if (!disableNewUrlFetchMethod) url = await getUrlFromInfoApi(articleNode);
            if (!url) {
                const videoElem = articleNode.querySelector('video');
                if (videoElem) {
                    url = videoElem.getAttribute('src');
                    if (videoElem.getAttribute('videoURL')) {
                        url = videoElem.getAttribute('videoURL');
                    } else if (!url || url.includes('blob')) {
                        url = await fetchVideoURL(articleNode, videoElem);
                    }
                } else {
                    const img =
                        articleNode.querySelector('article img[src]') ||
                        articleNode.querySelector('img[srcset], img[src]');
                    url = img?.getAttribute('src') || img?.srcset?.split(' ')[0];
                }
            }
        } else {
            const postView = location.pathname.startsWith('/p/');
            const dotsElements = [...articleNode.querySelectorAll('motion.div._acnb, div._acnb')];
            mediaIndex = [...dotsElements].reduce(
                (result, element, index) => (element.classList.length >= 2 ? index : result),
                0
            );
            if (mediaIndex === null) mediaIndex = 0;
            if (!disableNewUrlFetchMethod) url = await getUrlFromInfoApi(articleNode, mediaIndex);
            if (!url) {
                const nth = postView ? 1 : 2;
                const listElements = [
                    ...articleNode.querySelectorAll(
                        `:scope > div > div:nth-child(${nth}) > div > div:nth-child(1) ul li[style*="translateX"]`
                    ),
                ];
                const listElementWidth = Math.max(
                    ...listElements.map((element) => element.clientWidth),
                    1
                );
                const positionsMap = listElements.reduce((result, element) => {
                    const m = element.style.transform.match(/-?(\d+)/);
                    const position = m ? Math.round(Number(m[1]) / listElementWidth) : 0;
                    return { ...result, [position]: element };
                }, {});
                const node = positionsMap[mediaIndex] || listElements[mediaIndex];
                if (node?.querySelector('video')) {
                    const videoElem = node.querySelector('video');
                    url = videoElem.getAttribute('src');
                    if (videoElem.getAttribute('videoURL')) {
                        url = videoElem.getAttribute('videoURL');
                    } else if (!url || url.includes('blob')) {
                        url = await fetchVideoURL(articleNode, videoElem);
                    }
                } else if (node?.querySelector('img')) {
                    url = node.querySelector('img').getAttribute('src');
                }
            }
        }
        return { url, mediaIndex };
    }

    let infoCache = {};
    let mediaIdCache = {};

    async function getUrlFromInfoApi(articleNode, mediaIdx = 0) {
        try {
            const appIdPattern = /"X-IG-App-ID":"([\d]+)"/;
            const mediaIdPattern =
                /instagram:\/\/media\?id=(\d+)|["' ]media_id["' ]:["' ](\d+)["' ]/;

            function findAppId() {
                const bodyScripts = document.querySelectorAll('body > script');
                for (const script of bodyScripts) {
                    const match = script.text.match(appIdPattern);
                    if (match) return match[1];
                }
                return null;
            }

            async function findMediaId() {
                function method1() {
                    const href = location.href;
                    const match = href.match(/www.instagram.com\/stories\/[^/]+\/(\d+)/);
                    if (!href.includes('highlights') && match) return match[1];
                    return null;
                }

                async function method3() {
                    const postId = await findPostId(articleNode);
                    if (!postId) return null;
                    if (!(postId in mediaIdCache)) {
                        const postUrl = `https://www.instagram.com/p/${postId}/`;
                        const resp = await fetch(postUrl);
                        const text = await resp.text();
                        const idMatch = text ? text.match(mediaIdPattern) : [];
                        let mediaId = null;
                        for (const part of idMatch) {
                            if (part) mediaId = part;
                        }
                        if (!mediaId) return null;
                        mediaIdCache[postId] = mediaId;
                    }
                    return mediaIdCache[postId];
                }

                function method2() {
                    const scriptJson = document.querySelectorAll('script[type="application/json"]');
                    for (const script of scriptJson) {
                        const match = script.text.match(/"pk":"(\d+)","id":"[\d_]+"/);
                        if (match) {
                            if (!location.href.includes('highlights')) return match[1];
                            const matchs = Array.from(
                                script.text.matchAll(/"pk":"(\d+)","id":"[\d_]+"/g),
                                (m) => m[1]
                            );
                            const matchIndex = findHighlightsIndex();
                            if (matchs.length > matchIndex) return matchs[matchIndex];
                        }
                    }
                    return null;
                }

                return method1() || (await method3()) || method2();
            }

            function getImgOrVideoUrl(item) {
                if (item.video_versions) return item.video_versions[0].url;
                return item.image_versions2.candidates[0].url;
            }

            const appId = findAppId();
            if (!appId) return null;
            const headers = {
                method: 'GET',
                headers: { Accept: '*/*', 'X-IG-App-ID': appId },
                credentials: 'include',
                mode: 'cors',
            };

            const mediaId = await findMediaId();
            if (!mediaId) return null;
            if (!(mediaId in infoCache)) {
                const apiUrl = `https://i.instagram.com/api/v1/media/${mediaId}/info/`;
                const resp = await fetch(apiUrl, headers);
                if (resp.status !== 200) return null;
                infoCache[mediaId] = await resp.json();
            }
            const infoJson = infoCache[mediaId];
            const item = infoJson.items[0];
            if (item.carousel_media) {
                return getImgOrVideoUrl(item.carousel_media[mediaIdx]);
            }
            return getImgOrVideoUrl(item);
        } catch (err) {
            console.error('[Instagram_Rabbit] getUrlFromInfoApi', err);
            return null;
        }
    }

    function findHighlightsIndex() {
        const current = document.querySelector('motion.div[style^="transform"], div[style^="transform"]');
        if (!current?.parentElement?.parentElement) return 0;
        const root = current.parentElement.parentElement;
        return Array.from(root.children).indexOf(current.parentElement);
    }

    function findPostId(articleNode) {
        for (const a of articleNode.querySelectorAll('a[href*="/p/"]')) {
            const match = a.getAttribute('href')?.match(postIdPattern);
            if (match) return match[1];
        }
        const m = location.pathname.match(postIdPattern);
        return m ? m[1] : null;
    }

    async function fetchVideoURL(articleNode, videoElem) {
        const poster = videoElem.getAttribute('poster');
        const timeNodes = articleNode.querySelectorAll('time');
        const posterUrl = timeNodes[timeNodes.length - 1]?.parentElement?.parentElement?.href;
        if (!poster || !posterUrl) return null;
        const posterMatch = poster.match(/\/([^/?]*)\?/);
        if (!posterMatch) return null;
        const postFileName = posterMatch[1];
        const resp = await fetch(posterUrl);
        const content = await resp.text();
        const pattern = new RegExp(
            `${postFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*?video_versions.*?url":("[^"]*")`,
            's'
        );
        const match = content.match(pattern);
        if (!match) return null;
        let videoUrl = JSON.parse(match[1]);
        videoUrl = videoUrl.replace(
            /^(?:https?:\/\/)?(?:[^@/\n]+@)?(?:www\.)?([^:/?\n]+)/g,
            'https://scontent.cdninstagram.com'
        );
        videoElem.setAttribute('videoURL', videoUrl);
        return videoUrl;
    }

    async function storyOnMouseIn(target) {
        const sectionNode = storyGetSectionNode(target);
        target.dataset.arMediaUrl = (await storyGetUrl(target, sectionNode)) || '';
    }

    async function storyOnClicked(target) {
        const sectionNode = storyGetSectionNode(target);
        const url = await storyGetUrl(target, sectionNode);
        if (!url) return;
        if (target.classList.contains('ar-ig-download')) {
            let mediaName = url.split('?')[0].split('/').pop() || 'story';
            mediaName = mediaName.includes('.')
                ? mediaName.substring(0, mediaName.lastIndexOf('.'))
                : mediaName;
            const datetime = new Date(sectionNode.querySelector('time')?.getAttribute('datetime') || Date.now());
            let posterName =
                sectionNode.querySelector('header a')?.getAttribute('href')?.replace(/\//g, '') ||
                'unknown';
            const filename = filenameFormat(storyFilenameTemplate, posterName, datetime, mediaName);
            downloadResource(url, filename);
        } else openResource(url);
    }

    function storyGetSectionNode(target) {
        let node = target;
        while (node && node.tagName !== 'SECTION') node = node.parentNode;
        return node;
    }

    async function storyGetUrl(target, sectionNode) {
        let url = !disableNewUrlFetchMethod ? await getUrlFromInfoApi(target) : null;
        if (!url) {
            if (sectionNode.querySelector('video > source')) {
                url = sectionNode.querySelector('video > source').getAttribute('src');
            } else if (sectionNode.querySelector('video')) {
                url = sectionNode.querySelector('video').getAttribute('src');
            } else if (sectionNode.querySelector('img[src]')) {
                const img = sectionNode.querySelector('img[src]');
                url = img.srcset?.split(/ \d+w/)[0]?.trim() || img.getAttribute('src');
            }
        }
        return url;
    }

    function filenameFormat(template, id, datetime, medianame, postId = String(Date.now()), mediaIndex = '0') {
        return template
            .replace(/%id%/g, id)
            .replace(/%datetime%/g, datetimeFormat(datetimeTemplate, datetime))
            .replace(/%medianame%/g, medianame)
            .replace(/%postId%/g, postId)
            .replace(/%mediaIndex%/g, mediaIndex);
    }

    function datetimeFormat(template, datetime) {
        return template
            .replace(/%y%/g, datetime.getFullYear())
            .replace(/%m%/g, fillZero(String(datetime.getMonth() + 1)))
            .replace(/%d%/g, fillZero(String(datetime.getDate())))
            .replace(/%H%/g, fillZero(String(datetime.getHours())))
            .replace(/%M%/g, fillZero(String(datetime.getMinutes())))
            .replace(/%S%/g, fillZero(String(datetime.getSeconds())));
    }

    function fillZero(str) {
        return str.length === 1 ? '0' + str : str;
    }

    function openResource(url) {
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    function forceDownload(blobUrl, filename, extension) {
        const a = document.createElement('a');
        a.download = `${filename}.${extension}`;
        a.href = blobUrl;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    function downloadResource(url, filename) {
        if (!url) return;
        if (url.startsWith('blob:')) {
            forceDownload(url, filename, 'mp4');
            return;
        }
        fetch(url, {
            headers: new Headers({
                'User-Agent': navigator.userAgent,
                Origin: location.origin,
            }),
            mode: 'cors',
            credentials: 'include',
        })
            .then((r) => r.blob())
            .then((blob) => {
                const extension = (blob.type.split('/').pop() || 'jpg').replace('jpeg', 'jpg');
                forceDownload(URL.createObjectURL(blob), filename, extension);
            })
            .catch((err) => console.error('[Instagram_Rabbit] download failed', err));
    }
})();
