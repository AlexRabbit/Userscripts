// ==UserScript==
// @name         Telegram_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.0.0
// @description  Remove sponsored ads and download images, videos, and voice messages from Telegram Web (A/K/Z). AdGuard-friendly (@grant none).
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://web.telegram.org/*
// @match        https://webk.telegram.org/*
// @match        https://webz.telegram.org/*
// @icon         https://icons.duckduckgo.com/ip2/telegram.org.ico
// @grant        none
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Telegram_Rabbit.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Telegram_Rabbit.js
// @supportURL   https://github.com/AlexRabbit/Userscripts/issues
// ==/UserScript==
(function () {
    'use strict';
    const css = "motion.div[class*='sponsored' i]:not([data-floating='1']),div[class*='sponsored' i]:not([data-floating='1']),motion.div.yMkfzjus[data-is-panel-open='true'],div.yMkfzjus[data-is-panel-open='true'],a[data-sponsored='true']{display:none!important;visibility:hidden!important;height:0!important;overflow:hidden!important;}";
    const style = document.createElement('style');
    style.id = 'ar-telegram-ads-remover';
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
})();

(function () {
  'use strict';

  
  /*!
  * Copyright (c) 2026 - 2026, Nestor Qin, Andrew. All rights reserved.
  *
  * Permission is hereby granted, free of charge, to any person obtaining a copy
  * of this software and associated documentation files (the "Software"), to deal
  * in the Software without restriction, including without limitation the rights
  * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  * copies of the Software, and to permit persons to whom the Software is
  * furnished to do so, subject to the following conditions:
  *
  * The above copyright notice and this permission notice shall be included in
  * all copies or substantial portions of the Software.
  *
  * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  *
  * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  * SOFTWARE.
  *
  * The code is adapted from an open-source project. 
  * The code structure has been optimized and bugs have been fixed. 
  * Copyright belongs to the original author.
  * https://github.com/Neet-Nestor/Telegram-Media-Downloader
  */


  const CONFIG = {
    downloadIcon: "",
    forwardIcon: "",
    refreshDelay: 500,
    maxActiveDownloads: 2,
    contentRangeRegex: /^bytes (\d+)-(\d+)\/(\d+)$/,
    startFlag: "__TELEGRAM_MEDIA_DOWNLOADER_STARTED__",
    progressContainerId: "tel-downloader-progress-bar-container",
    progressCardPrefix: "tel-downloader-progress-"
  };

  const logger = {
    info: () => {
    },
    error: (...args) => console.error("[Tel Download]", ...args)
  };

  const utils = {
    hashCode(text) {
      let hash = 0;
      for (let i = 0; i < text.length; i += 1) {
        hash = (hash << 5) - hash + text.charCodeAt(i) | 0;
      }
      return hash >>> 0;
    },
    randomId() {
      return `${Math.random().toString(36).slice(2)}_${Date.now()}`;
    },
    triggerBlobDownload(blob, fileName) {
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    },
    parseMediaFileName(url, fallbackFileName) {
      try {
        const encoded = url.split("/").at(-1);
        const metadata = JSON.parse(decodeURIComponent(encoded));
        return metadata.fileName || fallbackFileName;
      } catch {
        return fallbackFileName;
      }
    },
    canUseFileSystemApi() {
      try {
        return "showSaveFilePicker" in unsafeWindow && unsafeWindow.self === unsafeWindow.top;
      } catch {
        return false;
      }
    }
  };

  class DownloadService {
    constructor(progress) {
      this.progress = progress;
    }
    downloadImage(url) {
      const fileName = `${Math.random().toString(36).slice(2, 10)}.jpeg`;
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.href = url;
      a.download = fileName;
      a.click();
      document.body.removeChild(a);
    }
    downloadAudio(url) {
      const fileName = `${utils.hashCode(url).toString(36)}.ogg`;
      const context = { nextOffset: 0, totalSize: null, chunks: [] };
      this.downloadStream({
        url,
        mimePrefix: "audio/",
        fileName,
        fallbackType: "audio/ogg",
        context
      });
    }
    downloadVideo(url, taskId = utils.randomId()) {
      const context = {
        nextOffset: 0,
        totalSize: null,
        chunks: [],
        extension: "mp4",
        fileName: utils.parseMediaFileName(
          url,
          `${utils.hashCode(url).toString(36)}.mp4`
        )
      };
      this.progress.ensure(taskId, context.fileName);
      const onChunkMeta = ({ mime, percent }) => {
        context.extension = mime.split("/")[1] || context.extension;
        context.fileName = `${context.fileName.split(".")[0]}.${context.extension}`;
        this.progress.update(taskId, context.fileName, percent, url);
      };
      this.downloadStream({
        url,
        mimePrefix: "video/",
        fileName: context.fileName,
        fallbackType: "video/mp4",
        context,
        onChunkMeta,
        onQueueCheck: (resumeFn) => {
          const card = this.progress.getCard(taskId);
          if (card?.classList.contains("queued")) {
            card.resume = resumeFn;
            return true;
          }
          return false;
        },
        onCompleted: () => this.progress.complete(taskId),
        onFailed: () => this.progress.abort(taskId)
      });
    }
    downloadStream({
      url,
      mimePrefix,
      fileName,
      fallbackType,
      context,
      onChunkMeta,
      onQueueCheck,
      onCompleted,
      onFailed
    }) {
      const readNext = (writer) => {
        fetch(url, {
          method: "GET",
          headers: { Range: `bytes=${context.nextOffset}-` }
        }).then((res) => {
          if (![200, 206].includes(res.status)) {
            throw new Error(`Unexpected response: ${res.status}`);
          }
          const mime = (res.headers.get("Content-Type") || "").split(";")[0];
          if (!mime.startsWith(mimePrefix)) {
            throw new Error(`Unexpected MIME: ${mime}`);
          }
          const range = res.headers.get("Content-Range");
          const match = range && range.match(CONFIG.contentRangeRegex);
          if (!match)
            throw new Error("Invalid Content-Range header");
          const start = Number.parseInt(match[1], 10);
          const end = Number.parseInt(match[2], 10);
          const total = Number.parseInt(match[3], 10);
          if (start !== context.nextOffset)
            throw new Error("Chunk offset mismatch");
          if (context.totalSize && total !== context.totalSize) {
            throw new Error("File size changed");
          }
          context.nextOffset = end + 1;
          context.totalSize = total;
          const percent = Math.round(context.nextOffset * 100 / context.totalSize);
          if (typeof onChunkMeta === "function") {
            onChunkMeta({ mime, percent });
          }
          return res.blob();
        }).then((blob) => writer ? writer.write(blob) : context.chunks.push(blob)).then(() => {
          if (!context.totalSize)
            throw new Error("Missing total size");
          if (context.nextOffset < context.totalSize) {
            if (typeof onQueueCheck === "function" && onQueueCheck(() => readNext(writer))) {
              return;
            }
            readNext(writer);
            return;
          }
          const finalName = context.fileName || fileName;
          const finalType = mimePrefix === "video/" ? `video/${context.extension || "mp4"}` : fallbackType;
          if (writer) {
            writer.close();
          } else {
            utils.triggerBlobDownload(
              new Blob(context.chunks, { type: finalType }),
              finalName
            );
          }
          if (typeof onCompleted === "function")
            onCompleted();
        }).catch((error) => {
          logger.error("Download failed:", error);
          if (typeof onFailed === "function")
            onFailed();
        });
      };
      if (utils.canUseFileSystemApi()) {
        unsafeWindow.showSaveFilePicker({ suggestedName: fileName }).then((handle) => handle.createWritable()).then((writer) => readNext(writer)).catch((err) => {
          if (err?.name !== "AbortError")
            logger.error("Save picker failed:", err);
        });
        return;
      }
      readNext(null);
    }
  }

  class ProgressManager {
    constructor(onRetry) {
      this.onRetry = onRetry;
    }
    setupContainer() {
      if (this.getContainer())
        return;
      const container = document.createElement("div");
      container.id = CONFIG.progressContainerId;
      container.style.position = "fixed";
      container.style.bottom = "100px";
      container.style.top = "56px";
      container.style.overflow = "auto";
      container.style.right = "0";
      container.style.zIndex = location.pathname.startsWith("/k/") ? "4" : "1600";
      document.body.appendChild(container);
    }
    getContainer() {
      return document.getElementById(CONFIG.progressContainerId);
    }
    getCard(taskId) {
      return document.getElementById(`${CONFIG.progressCardPrefix}${taskId}`);
    }
    getActiveCount() {
      const container = this.getContainer();
      if (!container)
        return 0;
      return Array.from(
        container.querySelectorAll(
          ".tel-downloader-progress:not(.queued):not(.aborted):not(.completed)"
        )
      ).length;
    }
    ensure(taskId, fileName) {
      const container = this.getContainer();
      if (!container)
        return null;
      let card = this.getCard(taskId);
      if (!card) {
        card = this.createCard(taskId, fileName);
        container.appendChild(card);
      }
      this.setQueued(taskId, this.getActiveCount() > CONFIG.maxActiveDownloads);
      return card;
    }
    createCard(taskId, fileName) {
      const isDarkMode = document.documentElement.classList.contains("night") || document.documentElement.classList.contains("theme-dark");
      const card = document.createElement("div");
      card.id = `${CONFIG.progressCardPrefix}${taskId}`;
      card.className = "tel-downloader-progress";
      card.setAttribute("videoId", taskId);
      card.style.width = "20rem";
      card.style.marginTop = "0.4rem";
      card.style.padding = "0.6rem";
      card.style.backgroundColor = isDarkMode ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.6)";
      const top = document.createElement("div");
      top.style.display = "flex";
      top.style.justifyContent = "space-between";
      const title = document.createElement("p");
      title.className = "filename";
      title.style.margin = "0";
      title.style.color = "white";
      title.innerText = fileName;
      const closeButton = document.createElement("div");
      closeButton.style.cursor = "pointer";
      closeButton.style.fontSize = "1.2rem";
      closeButton.style.color = isDarkMode ? "#8a8a8a" : "white";
      closeButton.style.position = "absolute";
      closeButton.style.right = "4px";
      closeButton.innerHTML = "&times;";
      closeButton.onclick = () => {
        card.remove();
        this.resumeNext();
      };
      const progressBar = document.createElement("div");
      progressBar.className = "progress";
      progressBar.style.backgroundColor = "#e2e2e2";
      progressBar.style.position = "relative";
      progressBar.style.width = "100%";
      progressBar.style.height = "1.6rem";
      progressBar.style.borderRadius = "2rem";
      progressBar.style.overflow = "hidden";
      const counter = document.createElement("p");
      counter.style.position = "absolute";
      counter.style.zIndex = "5";
      counter.style.left = "50%";
      counter.style.top = "50%";
      counter.style.transform = "translate(-50%, -50%)";
      counter.style.margin = "0";
      counter.style.color = "black";
      const progress = document.createElement("div");
      progress.style.position = "absolute";
      progress.style.height = "100%";
      progress.style.width = "0%";
      progress.style.backgroundColor = "#6093B5";
      progressBar.append(counter, progress);
      top.append(title, closeButton);
      card.append(top, progressBar);
      return card;
    }
    setQueued(taskId, queued) {
      const card = this.getCard(taskId);
      if (!card)
        return;
      card.classList.toggle("queued", queued);
      const progress = card.querySelector(".progress div");
      if (!progress)
        return;
      progress.style.backgroundColor = queued ? "lightgray" : "#6093B5";
      progress.style.width = queued ? "100%" : "0%";
    }
    update(taskId, fileName, percent, mediaUrl) {
      const card = this.getCard(taskId);
      if (!card)
        return;
      const title = card.querySelector("p.filename");
      const progressBar = card.querySelector("div.progress");
      if (!title || !progressBar)
        return;
      title.innerText = fileName;
      progressBar.querySelector("p").innerText = `${percent}%`;
      progressBar.querySelector("div").style.width = `${percent}%`;
      progressBar.setAttribute("data-tel-media-url", mediaUrl);
    }
    complete(taskId) {
      const card = this.getCard(taskId);
      if (!card)
        return;
      card.classList.add("completed");
      const text = card.querySelector(".progress p");
      const bar = card.querySelector(".progress div");
      if (text)
        text.innerText = "Completed";
      if (bar) {
        bar.style.backgroundColor = "#B6C649";
        bar.style.width = "100%";
      }
      window.setTimeout(() => card.remove(), 1e4);
      this.resumeNext();
    }
    abort(taskId) {
      const card = this.getCard(taskId);
      if (!card)
        return;
      card.classList.add("aborted");
      const progress = card.querySelector(".progress");
      if (!progress)
        return;
      const text = progress.querySelector("p");
      const bar = progress.querySelector("div");
      if (text)
        text.innerText = "Aborted";
      if (bar) {
        bar.style.backgroundColor = "#D16666";
        bar.style.width = "100%";
      }
      const retryLink = document.createElement("a");
      retryLink.innerText = "retry";
      retryLink.style.marginLeft = "5px";
      retryLink.href = "javascript:void(0);";
      retryLink.onclick = () => this.retry(taskId);
      text?.appendChild(retryLink);
      window.setTimeout(() => this.retry(taskId), 3e4);
      this.resumeNext();
    }
    retry(taskId) {
      const card = this.getCard(taskId);
      if (!card || !card.classList.contains("aborted"))
        return;
      card.classList.remove("aborted");
      const bar = card.querySelector("div.progress div");
      if (bar)
        bar.style.backgroundColor = "#6093B5";
      const url = card.querySelector("div.progress")?.getAttribute("data-tel-media-url");
      if (url)
        this.onRetry(url, taskId);
    }
    resumeNext() {
      const container = this.getContainer();
      if (!container)
        return;
      if (this.getActiveCount() >= CONFIG.maxActiveDownloads)
        return;
      const next = container.querySelector(".tel-downloader-progress.queued");
      if (!next || typeof next.resume !== "function")
        return;
      const taskId = next.getAttribute("videoId");
      this.setQueued(taskId, false);
      next.resume();
      delete next.resume;
    }
  }

  class TelegramUiMount {
    constructor(downloadService) {
      this.downloadService = downloadService;
    }
    tick() {
      this.mountWebZ();
      this.mountWebK();
    }
    mountWebZ() {
      this.mountWebZStories();
      this.mountWebZMediaViewer();
    }
    mountWebK() {
      this.mountWebKStories();
      this.mountWebKMediaViewer();
      this.mountPinnedAudio();
    }
    mountWebZStories() {
      const stories = document.getElementById("StoryViewer");
      if (!stories)
        return;
      const header = stories.querySelector(".GrsJNw3y") || stories.querySelector(".DropdownMenu")?.parentNode;
      if (!header || header.querySelector(".tel-download"))
        return;
      const btn = document.createElement("button");
      btn.className = "Button TkphaPyQ tiny translucent-white round tel-download";
      btn.innerHTML = '<i class="icon icon-download"></i>';
      btn.type = "button";
      btn.title = "Download";
      btn.ariaLabel = "Download";
      btn.onclick = () => {
        const video = stories.querySelector("video");
        const videoSrc = video?.src || video?.currentSrc || video?.querySelector("source")?.src;
        if (videoSrc) {
          this.downloadService.downloadVideo(videoSrc);
          return;
        }
        const images = Array.from(stories.querySelectorAll("img.PVZ8TOWS"));
        const imageSrc = images[images.length - 1]?.src;
        if (imageSrc)
          this.downloadService.downloadImage(imageSrc);
      };
      header.insertBefore(btn, header.querySelector("button"));
    }
    mountWebZMediaViewer() {
      const container = document.querySelector("#MediaViewer .MediaViewerSlide--active");
      const actions = document.querySelector("#MediaViewer .MediaViewerActions");
      if (!container || !actions)
        return;
      const ensureActionButton = (url, onClick) => {
        const nativeDownloadButtons = Array.from(
          actions.querySelectorAll('button[title="Download"]')
        );
        let button = actions.querySelector("button.tel-download");
        if (nativeDownloadButtons.length > 1) {
          button?.remove();
          return;
        }
        if (button) {
          if (button.getAttribute("data-tel-download-url") !== url) {
            button.setAttribute("data-tel-download-url", url);
            button.onclick = onClick;
          }
          return;
        }
        if (nativeDownloadButtons.length > 0)
          return;
        button = document.createElement("button");
        button.className = "Button smaller translucent-white round tel-download";
        button.type = "button";
        button.title = "Download";
        button.ariaLabel = "Download";
        button.innerHTML = '<i class="icon icon-download"></i>';
        button.setAttribute("data-tel-download-url", url);
        button.onclick = onClick;
        actions.prepend(button);
      };
      const videoPlayer = container.querySelector(".MediaViewerContent > .VideoPlayer");
      if (videoPlayer) {
        const videoElement = videoPlayer.querySelector("video");
        const videoUrl = videoElement?.currentSrc;
        if (!videoUrl)
          return;
        ensureActionButton(
          videoUrl,
          () => this.downloadService.downloadVideo(videoElement.currentSrc)
        );
        const controls = videoPlayer.querySelector(".VideoPlayerControls .buttons");
        if (controls && !controls.querySelector("button.tel-download")) {
          const btn = document.createElement("button");
          btn.className = "Button smaller translucent-white round tel-download";
          btn.type = "button";
          btn.title = "Download";
          btn.ariaLabel = "Download";
          btn.innerHTML = '<i class="icon icon-download"></i>';
          btn.onclick = () => this.downloadService.downloadVideo(videoElement.currentSrc);
          controls.querySelector(".spacer")?.after(btn);
        }
        return;
      }
      const image = container.querySelector(".MediaViewerContent > div > img");
      if (image?.src) {
        ensureActionButton(
          image.src,
          () => this.downloadService.downloadImage(image.src)
        );
      }
    }
    mountWebKStories() {
      const stories = document.getElementById("stories-viewer");
      if (!stories)
        return;
      const createBtn = () => {
        const btn = document.createElement("button");
        btn.className = "btn-icon rp tel-download";
        btn.innerHTML = `<span class="tgico">${CONFIG.downloadIcon}</span><div class="c-ripple"></div>`;
        btn.type = "button";
        btn.title = "Download";
        btn.ariaLabel = "Download";
        btn.onclick = () => {
          const video = stories.querySelector("video.media-video");
          const videoSrc = video?.src || video?.currentSrc || video?.querySelector("source")?.src;
          if (videoSrc) {
            this.downloadService.downloadVideo(videoSrc);
            return;
          }
          const imageSrc = stories.querySelector("img.media-photo")?.src;
          if (imageSrc)
            this.downloadService.downloadImage(imageSrc);
        };
        return btn;
      };
      const header = stories.querySelector("[class^='_ViewerStoryHeaderRight']");
      const footer = stories.querySelector("[class^='_ViewerStoryFooterRight']");
      if (header && !header.querySelector(".tel-download"))
        header.prepend(createBtn());
      if (footer && !footer.querySelector(".tel-download"))
        footer.prepend(createBtn());
    }
    mountWebKMediaViewer() {
      const mediaContainer = document.querySelector(".media-viewer-whole");
      if (!mediaContainer)
        return;
      const aspecter = mediaContainer.querySelector(
        ".media-viewer-movers .media-viewer-aspecter"
      );
      const buttons = mediaContainer.querySelector(
        ".media-viewer-topbar .media-viewer-buttons"
      );
      if (!aspecter || !buttons)
        return;
      let officialDownload = null;
      Array.from(buttons.querySelectorAll("button.btn-icon.hide")).forEach((btn) => {
        btn.classList.remove("hide");
        if (btn.textContent === CONFIG.forwardIcon)
          btn.classList.add("tgico-forward");
        if (btn.textContent === CONFIG.downloadIcon) {
          btn.classList.add("tgico-download");
          officialDownload = () => btn.click();
        }
      });
      const createKButton = (className = "btn-icon tgico-download tel-download") => {
        const btn = document.createElement("button");
        btn.className = className;
        btn.innerHTML = `<span class="tgico button-icon">${CONFIG.downloadIcon}</span>`;
        btn.type = "button";
        btn.title = "Download";
        btn.ariaLabel = "Download";
        return btn;
      };
      if (aspecter.querySelector(".ckin__player")) {
        const controls = aspecter.querySelector(
          ".default__controls.ckin__controls .bottom-controls .right-controls"
        );
        if (controls && !controls.querySelector(".tel-download")) {
          const button = createKButton("btn-icon default__button tgico-download tel-download");
          button.onclick = officialDownload || (() => this.downloadService.downloadVideo(aspecter.querySelector("video")?.src || ""));
          controls.prepend(button);
        }
        return;
      }
      if (aspecter.querySelector("video") && !buttons.querySelector("button.btn-icon.tgico-download")) {
        const button = createKButton();
        button.onclick = officialDownload || (() => this.downloadService.downloadVideo(aspecter.querySelector("video")?.src || ""));
        buttons.prepend(button);
        return;
      }
      const image = aspecter.querySelector("img.thumbnail");
      if (image?.src && !buttons.querySelector("button.btn-icon.tgico-download")) {
        const button = createKButton();
        button.onclick = officialDownload || (() => this.downloadService.downloadImage(image.src));
        buttons.prepend(button);
      }
    }
    mountPinnedAudio() {
      const pinnedAudio = document.querySelector(".pinned-audio");
      if (!pinnedAudio)
        return;
      const dataMid = pinnedAudio.getAttribute("data-mid");
      if (!dataMid)
        return;
      const button = document.querySelector("._tel_download_button_pinned_container") || document.createElement("button");
      button.className = "btn-icon tgico-download _tel_download_button_pinned_container";
      button.innerHTML = `<span class="tgico button-icon">${CONFIG.downloadIcon}</span>`;
      Array.from(document.querySelectorAll("audio-element")).forEach((voice) => {
        if (voice.getAttribute("data-mid") !== dataMid)
          return;
        const link = voice.audio?.getAttribute("src");
        if (!link)
          return;
        button.onclick = (e) => {
          e.stopPropagation();
          this.downloadService.downloadAudio(link);
        };
        if (button.getAttribute("data-mid") !== dataMid) {
          button.setAttribute("data-mid", dataMid);
          pinnedAudio.querySelector(".pinned-container-wrapper-utils")?.appendChild(button);
        }
      });
    }
  }

  class TelegramDownloaderApp {
    constructor() {
      this.downloadService = null;
      this.progress = new ProgressManager(
        (url, taskId) => this.downloadService.downloadVideo(url, taskId)
      );
      this.downloadService = new DownloadService(this.progress);
      this.ui = new TelegramUiMount(this.downloadService);
      this.timer = null;
    }
    start() {
      if (window[CONFIG.startFlag])
        return;
      window[CONFIG.startFlag] = true;
      window.onerror = (message) => {
        logger.error("UNCAUGHT ERROR:", message);
        return false;
      };
      this.progress.setupContainer();
      this.ui.tick();
      this.timer = window.setInterval(() => this.ui.tick(), CONFIG.refreshDelay);
    }
    stop() {
      if (this.timer) {
        window.clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  const bootstrap = () => {
    try {
      const app = new TelegramDownloaderApp();
      app.start();
      window.__TELEGRAM_MEDIA_DOWNLOADER_APP__ = app;
    } catch (error) {
      console.error("[Tel Download] bootstrap failed:", error);
    }
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }

}());


