// ==UserScript==
// @name         Telegram_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.0.1
// @description  Telegram Web: hide ads, download photos/videos/audio from viewer (serial saves, no ZIP).
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://web.telegram.org/*
// @match        https://webk.telegram.org/*
// @match        https://webz.telegram.org/*
// @grant        none
// @run-at       document-end
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Telegram_Rabbit.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Telegram_Rabbit.js
// @supportURL   https://github.com/AlexRabbit/Userscripts/issues
// ==/UserScript==
(function () {
    'use strict';
    const css = "motion-restricted\:hidden,div[class*='sponsored' i]:not([data-floating='1']),div.yMkfzjus[data-is-panel-open='true'],a[data-sponsored='true']{display:none!important}";
    const s = document.createElement('style');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
})();



(function () {
  const logger = {
    info: (message, fileName = null) => {
      console.log(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
    error: (message, fileName = null) => {
      console.error(
        `[Tel Download] ${fileName ? `${fileName}: ` : ""}${message}`
      );
    },
  };
  const DOWNLOAD_ICON = "";
  const FORWARD_ICON = "";
  const contentRangeRegex = /^bytes (\d+)-(\d+)\/(\d+)$/;
  const REFRESH_DELAY = 500;
  const hashCode = (s) => {
    var h = 0,
      l = s.length,
      i = 0;
    if (l > 0) {
      while (i < l) {
        h = ((h << 5) - h + s.charCodeAt(i++)) | 0;
      }
    }
    return h >>> 0;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const MONTH_MAP = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const formatMessageDate = (raw, now = new Date()) => {
    if (!raw) return "";
    const s = raw
      .toLowerCase()
      .replace(/ /g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const timeMatch = s.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!timeMatch) return "";
    let hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const second =
      typeof timeMatch[3] === "string" ? parseInt(timeMatch[3], 10) : null;
    const meridiem = timeMatch[4];
    if (meridiem === "pm" && hour < 12) hour += 12;
    else if (meridiem === "am" && hour === 12) hour = 0;

    let year = now.getFullYear();
    let month = null;
    let day = null;

    const relativeDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    if (/\btoday\b/.test(s)) {
      month = relativeDate.getMonth() + 1;
      day = relativeDate.getDate();
    } else if (/\byesterday\b/.test(s)) {
      relativeDate.setDate(relativeDate.getDate() - 1);
      year = relativeDate.getFullYear();
      month = relativeDate.getMonth() + 1;
      day = relativeDate.getDate();
    } else {
      const dateMatch = s.match(
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:,\s*(\d{4}))?/
      );
      if (!dateMatch) return "";
      month = MONTH_MAP[dateMatch[1].slice(0, 3)];
      day = parseInt(dateMatch[2], 10);
      if (dateMatch[3]) year = parseInt(dateMatch[3], 10);
    }

    if (
      year < 1970 || year > 9999 ||
      month < 1 || month > 12 ||
      day < 1 || day > 31 ||
      hour < 0 || hour > 23 ||
      minute < 0 || minute > 59 ||
      (second !== null && (second < 0 || second > 59))
    ) {
      return "";
    }
    const pad = (n) => String(n).padStart(2, "0");
    const base = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}-${pad(minute)}`;
    return second === null ? base : `${base}-${pad(second)}`;
  };

  const sanitizePathSegment = (s) => {
    if (!s) return "unknown";
    const cleaned = String(s)
      .replace(/[\x00-\x1f\x7f]/g, "")
      .replace(/[\/\\:*?"<>|]/g, "_")
      .replace(/^\.+/, "_")
      .replace(/[\s.]+$/, "")
      .trim();
    return cleaned.substring(0, 80) || "unknown";
  };

  const getCurrentChat = () => {
    const candidates = [
      "#MiddleColumn .ChatInfo .info .title",
      "#MiddleColumn .ChatInfo .info > .title",
      "#MiddleHeader .ChatInfo .title",
      ".chat.tabs-tab.active .topbar .chat-info .peer-title",
      ".chat .topbar .chat-info .peer-title",
      ".topbar .chat-info .peer-title",
    ];
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      const text = el?.textContent?.trim();
      if (text) return text;
    }
    return "";
  };

  const getActiveMediaA = () => {
    const slide = document.querySelector(
      "#MediaViewer .MediaViewerSlide--active"
    );
    if (!slide) return null;
    const v = slide.querySelector(".VideoPlayer video");
    if (v && v.currentSrc) return { url: v.currentSrc, type: "video" };
    const img = slide.querySelector(".MediaViewerContent img");
    if (img && img.src) return { url: img.src, type: "image" };
    return null;
  };

  const getActiveMediaK = () => {
    const aspecter =
      document.querySelector(
        ".media-viewer-whole .media-viewer-mover.active .media-viewer-aspecter"
      ) ||
      document.querySelector(".media-viewer-whole .media-viewer-aspecter");
    if (!aspecter) return null;
    const v = aspecter.querySelector("video");
    if (v && v.src) return { url: v.src, type: "video" };
    const t = aspecter.querySelector("img.thumbnail");
    if (t && t.src) return { url: t.src, type: "image" };
    return null;
  };

  const enqueueActive = (getter) => {
    const m = getter();
    if (m) DownloadQueue.enqueue(m.url, m.type, getCurrentSender());
  };

  const getCurrentSender = () => {
    const chatName = getCurrentChat();

    const activeHead = document.querySelector(
      "#MediaViewer .media-viewer-head .Transition_slide-active"
    );
    if (activeHead) {
      const avatar = activeHead.querySelector(
        ".SenderInfo .Avatar[data-peer-id]"
      );
      if (avatar) {
        const rawDate =
          activeHead
            .querySelector(".SenderInfo .meta .date")
            ?.textContent?.trim()
            ?.replace(/ /g, " ") || "";
        return {
          peerId: avatar.getAttribute("data-peer-id"),
          senderName:
            activeHead
              .querySelector(".SenderInfo .meta .title")
              ?.textContent?.trim() || "",
          date: formatMessageDate(rawDate) || sanitizePathSegment(rawDate),
          chatName,
        };
      }
    }

    const activeTopbar =
      document.querySelector(
        ".media-viewer-whole .media-viewer-topbar.media-viewer-appear"
      ) ||
      document.querySelector(".media-viewer-whole .media-viewer-topbar");
    if (activeTopbar) {
      const author = activeTopbar.querySelector(
        ".media-viewer-author [data-peer-id]"
      );
      if (author) {
        const nameEl = activeTopbar.querySelector(".peer-title") || author;
        const rawDate =
          activeTopbar
            .querySelector(".media-viewer-date")
            ?.textContent?.trim()
            ?.replace(/\s+/g, " ") || "";
        return {
          peerId: author.getAttribute("data-peer-id"),
          senderName: nameEl.textContent?.trim() || "",
          date: formatMessageDate(rawDate) || sanitizePathSegment(rawDate),
          chatName,
        };
      }
    }

    const storyA = document.querySelector("#StoryViewer [data-peer-id]");
    if (storyA) {
      const peerId = storyA.getAttribute("data-peer-id");
      const title =
        document.querySelector("#StoryViewer .title")?.textContent?.trim() ||
        document
          .querySelector("#StoryViewer .peer-title")
          ?.textContent?.trim() ||
        "";
      return { peerId, senderName: title, date: "", chatName };
    }
    const storyK = document.querySelector("#stories-viewer [data-peer-id]");
    if (storyK) {
      const peerId = storyK.getAttribute("data-peer-id");
      const title =
        document
          .querySelector("#stories-viewer .peer-title")
          ?.textContent?.trim() || "";
      return { peerId, senderName: title, date: "", chatName };
    }

    return null;
  };

  const _hostWindow =
    typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

  const supportsFileSystemAccess =
    "showSaveFilePicker" in _hostWindow &&
    (() => {
      try {
        return _hostWindow.self === _hostWindow.top;
      } catch {
        return false;
      }
    })();

  const createProgressBar = (videoId, fileName) => {
    const isDarkMode =
      document.querySelector("html").classList.contains("night") ||
      document.querySelector("html").classList.contains("theme-dark");
    const container = document.getElementById(
      "tel-downloader-progress-bar-container"
    );
    const innerContainer = document.createElement("div");
    innerContainer.id = "tel-downloader-progress-" + videoId;
    innerContainer.style.width = "20rem";
    innerContainer.style.marginTop = "0.4rem";
    innerContainer.style.padding = "0.6rem";
    innerContainer.style.backgroundColor = isDarkMode
      ? "rgba(0,0,0,0.3)"
      : "rgba(0,0,0,0.6)";

    const flexContainer = document.createElement("div");
    flexContainer.style.display = "flex";
    flexContainer.style.justifyContent = "space-between";

    const title = document.createElement("p");
    title.className = "filename";
    title.style.margin = 0;
    title.style.color = "white";
    title.innerText = fileName || "";

    const closeButton = document.createElement("div");
    closeButton.style.cursor = "pointer";
    closeButton.style.fontSize = "1.2rem";
    closeButton.style.color = isDarkMode ? "#8a8a8a" : "white";
    closeButton.innerHTML = "&times;";
    closeButton.onclick = function () {
      container.removeChild(innerContainer);
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
    counter.style.zIndex = 5;
    counter.style.left = "50%";
    counter.style.top = "50%";
    counter.style.transform = "translate(-50%, -50%)";
    counter.style.margin = 0;
    counter.style.color = "black";
    const progress = document.createElement("div");
    progress.style.position = "absolute";
    progress.style.height = "100%";
    progress.style.width = "0%";
    progress.style.backgroundColor = "#6093B5";

    progressBar.appendChild(counter);
    progressBar.appendChild(progress);
    flexContainer.appendChild(title);
    flexContainer.appendChild(closeButton);
    innerContainer.appendChild(flexContainer);
    innerContainer.appendChild(progressBar);
    container.appendChild(innerContainer);
  };

  const updateProgress = (videoId, fileName, progress) => {
    const innerContainer = document.getElementById(
      "tel-downloader-progress-" + videoId
    );
    if (!innerContainer) return;
    innerContainer.querySelector("p.filename").innerText = fileName;
    const progressBar = innerContainer.querySelector("div.progress");
    progressBar.querySelector("p").innerText = progress + "%";
    progressBar.querySelector("div").style.width = progress + "%";
  };

  const dismissProgress = (node, delayMs) => {
    setTimeout(() => {
      if (node && node.parentNode) node.parentNode.removeChild(node);
    }, delayMs);
  };

  const completeProgress = (videoId) => {
    const node = document.getElementById("tel-downloader-progress-" + videoId);
    if (!node) return;
    const progressBar = node.querySelector("div.progress");
    progressBar.querySelector("p").innerText = "Completed";
    progressBar.querySelector("div").style.backgroundColor = "#B6C649";
    progressBar.querySelector("div").style.width = "100%";
    dismissProgress(node, 1000);
  };

  const AbortProgress = (videoId) => {
    const node = document.getElementById("tel-downloader-progress-" + videoId);
    if (!node) return;
    const progressBar = node.querySelector("div.progress");
    progressBar.querySelector("p").innerText = "Aborted";
    progressBar.querySelector("div").style.backgroundColor = "#D16666";
    progressBar.querySelector("div").style.width = "100%";
    dismissProgress(node, 3000);
  };

  const tel_download_video = (url, options = {}) => {
    const { saveImmediately = true } = options;

    return new Promise((resolve, reject) => {
      let _blobs = [];
      let _next_offset = 0;
      let _total_size = null;
      let _file_extension = "mp4";

      const videoId =
        (Math.random() + 1).toString(36).substring(2, 10) +
        "_" +
        Date.now().toString();
      let fileName = hashCode(url).toString(36) + "." + _file_extension;

      try {
        const metadata = JSON.parse(
          decodeURIComponent(url.split("/")[url.split("/").length - 1])
        );
        if (metadata.fileName) {
          fileName = metadata.fileName;
        }
      } catch (e) {
      }
      logger.info(`URL: ${url}`, fileName);

      const fetchNextPart = (_writable) => {
        fetch(url, {
          method: "GET",
          headers: {
            Range: `bytes=${_next_offset}-`,
          },
          "User-Agent":
            "User-Agent Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/117.0",
        })
          .then((res) => {
            if (![200, 206].includes(res.status)) {
              throw new Error(
                "Non 200/206 response was received: " + res.status
              );
            }
            const mime = res.headers.get("Content-Type").split(";")[0];
            if (!mime.startsWith("video/")) {
              throw new Error("Get non video response with MIME type " + mime);
            }
            _file_extension = mime.split("/")[1];
            fileName =
              fileName.substring(0, fileName.indexOf(".") + 1) +
              _file_extension;

            const match = res.headers
              .get("Content-Range")
              .match(contentRangeRegex);

            const startOffset = parseInt(match[1]);
            const endOffset = parseInt(match[2]);
            const totalSize = parseInt(match[3]);

            if (startOffset !== _next_offset) {
              logger.error("Gap detected between responses.", fileName);
              logger.info("Last offset: " + _next_offset, fileName);
              logger.info("New start offset " + match[1], fileName);
              throw "Gap detected between responses.";
            }
            if (_total_size && totalSize !== _total_size) {
              logger.error("Total size differs", fileName);
              throw "Total size differs";
            }

            _next_offset = endOffset + 1;
            _total_size = totalSize;

            logger.info(
              `Get response: ${res.headers.get(
                "Content-Length"
              )} bytes data from ${res.headers.get("Content-Range")}`,
              fileName
            );
            logger.info(
              `Progress: ${((_next_offset * 100) / _total_size).toFixed(0)}%`,
              fileName
            );
            updateProgress(
              videoId,
              fileName,
              ((_next_offset * 100) / _total_size).toFixed(0)
            );
            return res.blob();
          })
          .then((resBlob) => {
            if (_writable !== null) {
              _writable.write(resBlob).then(() => {});
            } else {
              _blobs.push(resBlob);
            }
          })
          .then(() => {
            if (!_total_size) {
              throw new Error("_total_size is NULL");
            }

            if (_next_offset < _total_size) {
              fetchNextPart(_writable);
            } else {
              if (_writable !== null) {
                _writable.close().then(() => {
                  logger.info("Download finished", fileName);
                  completeProgress(videoId);
                  resolve({ blob: null, fileName });
                });
              } else {
                completeProgress(videoId);
                const blob = new Blob(_blobs, { type: "video/" + _file_extension });
                if (saveImmediately) {
                  saveBlob(blob, fileName);
                }
                resolve({ blob, fileName });
              }
            }
          })
          .catch((reason) => {
            logger.error(reason, fileName);
            AbortProgress(videoId);
            reject(reason);
          });
      };

      if (saveImmediately && supportsFileSystemAccess) {
        _hostWindow
          .showSaveFilePicker({
            suggestedName: fileName,
          })
          .then((handle) => {
            handle
              .createWritable()
              .then((writable) => {
                fetchNextPart(writable);
                createProgressBar(videoId, fileName);
              })
              .catch((err) => {
                console.error(err.name, err.message);
                reject(err);
              });
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              console.error(err.name, err.message);
            }
            reject(err);
          });
      } else {
        fetchNextPart(null);
        createProgressBar(videoId, fileName);
      }
    });
  };

  const tel_download_audio = (url, options = {}) => {
    const { saveImmediately = true } = options;

    return new Promise((resolve, reject) => {
      let _blobs = [];
      let _next_offset = 0;
      let _total_size = null;
      const fileName = hashCode(url).toString(36) + ".ogg";

      const fetchNextPart = (_writable) => {
        fetch(url, {
          method: "GET",
          headers: {
            Range: `bytes=${_next_offset}-`,
          },
        })
          .then((res) => {
            if (res.status !== 206 && res.status !== 200) {
              logger.error(
                "Non 200/206 response was received: " + res.status,
                fileName
              );
              throw new Error("Non 200/206 response: " + res.status);
            }

            const mime = res.headers.get("Content-Type").split(";")[0];
            if (!mime.startsWith("audio/")) {
              logger.error(
                "Get non audio response with MIME type " + mime,
                fileName
              );
              throw "Get non audio response with MIME type " + mime;
            }

            try {
              const match = res.headers
                .get("Content-Range")
                .match(contentRangeRegex);

              const startOffset = parseInt(match[1]);
              const endOffset = parseInt(match[2]);
              const totalSize = parseInt(match[3]);

              if (startOffset !== _next_offset) {
                logger.error("Gap detected between responses.");
                logger.info("Last offset: " + _next_offset);
                logger.info("New start offset " + match[1]);
                throw "Gap detected between responses.";
              }
              if (_total_size && totalSize !== _total_size) {
                logger.error("Total size differs");
                throw "Total size differs";
              }

              _next_offset = endOffset + 1;
              _total_size = totalSize;
            } finally {
              logger.info(
                `Get response: ${res.headers.get(
                  "Content-Length"
                )} bytes data from ${res.headers.get("Content-Range")}`
              );
              return res.blob();
            }
          })
          .then((resBlob) => {
            if (_writable !== null) {
              _writable.write(resBlob).then(() => {});
            } else {
              _blobs.push(resBlob);
            }
          })
          .then(() => {
            if (_next_offset < _total_size) {
              fetchNextPart(_writable);
            } else {
              if (_writable !== null) {
                _writable.close().then(() => {
                  logger.info("Download finished", fileName);
                  resolve({ blob: null, fileName });
                });
              } else {
                const blob = new Blob(_blobs, { type: "audio/ogg" });
                if (saveImmediately) {
                  saveBlob(blob, fileName);
                }
                resolve({ blob, fileName });
              }
            }
          })
          .catch((reason) => {
            logger.error(reason, fileName);
            reject(reason);
          });
      };

      if (saveImmediately && supportsFileSystemAccess) {
        _hostWindow
          .showSaveFilePicker({
            suggestedName: fileName,
          })
          .then((handle) => {
            handle
              .createWritable()
              .then((writable) => {
                fetchNextPart(writable);
              })
              .catch((err) => {
                console.error(err.name, err.message);
                reject(err);
              });
          })
          .catch((err) => {
            if (err.name !== "AbortError") {
              console.error(err.name, err.message);
            }
            reject(err);
          });
      } else {
        fetchNextPart(null);
      }
    });
  };

  const tel_download_image = (imageUrl, options = {}) => {
    const { saveImmediately = true } = options;
    const fileName =
      (Math.random() + 1).toString(36).substring(2, 10) + ".jpeg"; // assume jpeg

    if (saveImmediately) {
      const a = document.createElement("a");
      document.body.appendChild(a);
      a.href = imageUrl;
      a.download = fileName;
      a.click();
      document.body.removeChild(a);

      logger.info("Download triggered", fileName);
      return Promise.resolve({ blob: null, fileName });
    }

    return fetch(imageUrl)
      .then((res) => {
        if (!res.ok) throw new Error("Image fetch failed: " + res.status);
        return res.blob();
      })
      .then((blob) => {
        const type = blob.type || "image/jpeg";
        const ext = (type.split("/")[1] || "jpeg").split("+")[0];
        const finalName = fileName.replace(/\.jpeg$/, "." + ext);
        return { blob, fileName: finalName };
      });
  };

  const saveBlob = (blob, fileName) => {
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.href = blobUrl;
    a.download = fileName;
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
    logger.info("Download triggered", fileName);
  };

  const QueueUI = (() => {
    let panel = null;
    let listEl = null;
    let titleEl = null;
    let summaryEl = null;
    let progressBarEl = null;
    let progressTextEl = null;
    let actionsEl = null;
    let toastEl = null;
    let toastTimer = null;

    function ensurePanel() {
      if (panel) return panel;
      const isDarkMode =
        document.querySelector("html").classList.contains("night") ||
        document.querySelector("html").classList.contains("theme-dark");

      panel = document.createElement("div");
      panel.id = "tel-download-queue-panel";
      Object.assign(panel.style, {
        width: "22rem",
        marginTop: "0.4rem",
        padding: "0.6rem",
        backgroundColor: isDarkMode
          ? "rgba(0,0,0,0.65)"
          : "rgba(20,20,20,0.85)",
        color: "white",
        borderRadius: "0.5rem",
        fontFamily: "sans-serif",
        fontSize: "0.85rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
      });

      const header = document.createElement("div");
      Object.assign(header.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "0.4rem",
      });

      titleEl = document.createElement("span");
      titleEl.innerText = "📥 Queue (0/0)";
      titleEl.style.fontWeight = "bold";

      const closeBtn = document.createElement("span");
      closeBtn.innerHTML = "&times;";
      Object.assign(closeBtn.style, {
        cursor: "pointer",
        fontSize: "1.2rem",
        padding: "0 0.3rem",
      });
      closeBtn.onclick = () => hide();

      header.appendChild(titleEl);
      header.appendChild(closeBtn);

      const progressWrap = document.createElement("div");
      Object.assign(progressWrap.style, {
        position: "relative",
        width: "100%",
        height: "1.2rem",
        backgroundColor: "#444",
        borderRadius: "0.6rem",
        overflow: "hidden",
        marginBottom: "0.4rem",
      });
      progressBarEl = document.createElement("div");
      Object.assign(progressBarEl.style, {
        width: "0%",
        height: "100%",
        backgroundColor: "#6093B5",
        transition: "width 0.2s",
      });
      progressTextEl = document.createElement("span");
      Object.assign(progressTextEl.style, {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        color: "white",
        fontSize: "0.75rem",
      });
      progressTextEl.innerText = "0%";
      progressWrap.appendChild(progressBarEl);
      progressWrap.appendChild(progressTextEl);

      summaryEl = document.createElement("div");
      Object.assign(summaryEl.style, {
        fontSize: "0.75rem",
        opacity: "0.85",
        marginBottom: "0.4rem",
      });

      listEl = document.createElement("div");
      Object.assign(listEl.style, {
        maxHeight: "180px",
        overflowY: "auto",
        borderTop: "1px solid rgba(255,255,255,0.15)",
        borderBottom: "1px solid rgba(255,255,255,0.15)",
        padding: "0.3rem 0",
        marginBottom: "0.4rem",
      });

      actionsEl = document.createElement("div");
      Object.assign(actionsEl.style, {
        display: "flex",
        gap: "0.4rem",
        justifyContent: "flex-end",
      });

      toastEl = document.createElement("div");
      Object.assign(toastEl.style, {
        marginTop: "0.4rem",
        fontSize: "0.75rem",
        color: "#FFD479",
        minHeight: "1rem",
      });

      panel.appendChild(header);
      panel.appendChild(progressWrap);
      panel.appendChild(summaryEl);
      panel.appendChild(listEl);
      panel.appendChild(actionsEl);
      panel.appendChild(toastEl);

      const container = document.getElementById(
        "tel-downloader-progress-bar-container"
      );
      container.appendChild(panel);
      return panel;
    }

    function makeButton(label, onClick) {
      const btn = document.createElement("button");
      btn.innerText = label;
      Object.assign(btn.style, {
        cursor: "pointer",
        padding: "0.3rem 0.7rem",
        borderRadius: "0.3rem",
        border: "1px solid rgba(255,255,255,0.3)",
        background: "rgba(255,255,255,0.1)",
        color: "white",
        fontSize: "0.8rem",
      });
      btn.onclick = onClick;
      return btn;
    }

    function statusIcon(status) {
      switch (status) {
        case "done":
          return "✅";
        case "downloading":
          return "⏳";
        case "failed":
          return "❌";
        case "pending":
        default:
          return "⏸";
      }
    }

    function update() {
      if (!panel) ensurePanel();
      const queue = DownloadQueue.getQueue();
      const total = queue.length;
      const doneCount = queue.filter((q) => q.status === "done").length;
      const failedCount = queue.filter((q) => q.status === "failed").length;
      const pendingCount = queue.filter((q) => q.status === "pending").length;
      const finished = doneCount + failedCount;
      const current = queue.find((q) => q.status === "downloading");
      const running = DownloadQueue.isRunning();

      if (running) {
        titleEl.innerText = `📥 Downloading (${doneCount}/${total})`;
        progressBarEl.style.backgroundColor = "#6093B5";
        const percent =
          total === 0 ? 0 : Math.floor((finished / total) * 100);
        progressBarEl.style.width = percent + "%";
        progressTextEl.innerText = percent + "%";
        summaryEl.innerText = current
          ? `Now: ${current.fileName || current.url.substring(0, 40)}`
          : "Waiting...";
      } else {
        titleEl.innerText = `📥 Pending (${pendingCount})`;
        progressBarEl.style.backgroundColor = "#6093B5";
        progressBarEl.style.width = "0%";
        progressTextEl.innerText = "0%";
        summaryEl.innerText =
          pendingCount > 0
            ? `${pendingCount} item(s) collected — press Start to begin`
            : "Empty — click a download button to collect media";
      }

      listEl.innerHTML = "";
      queue.forEach((item, index) => {
        const row = document.createElement("div");
        Object.assign(row.style, {
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.15rem 0",
          fontSize: "0.78rem",
        });

        const label = document.createElement("span");
        Object.assign(label.style, {
          flex: "1",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        });
        const sender =
          item.meta && item.meta.senderName
            ? `[${item.meta.senderName}] `
            : "";
        label.innerText = `${statusIcon(item.status)} ${sender}${
          item.fileName || item.url
        }`;
        if (item.status === "downloading") label.style.color = "#FFD479";
        if (item.status === "failed") label.style.color = "#D16666";
        if (item.status === "done") label.style.color = "#B6C649";
        row.appendChild(label);

        if (!running && item.status === "pending") {
          const removeBtn = document.createElement("span");
          removeBtn.innerText = "✕";
          Object.assign(removeBtn.style, {
            cursor: "pointer",
            color: "#aaa",
            padding: "0 0.3rem",
            fontSize: "0.85rem",
          });
          removeBtn.title = "Remove from queue";
          removeBtn.onclick = () => DownloadQueue.removeAt(index);
          row.appendChild(removeBtn);
        }

        listEl.appendChild(row);
      });

      actionsEl.innerHTML = "";
      if (running) {
        if (DownloadQueue.isPaused()) {
          actionsEl.appendChild(
            makeButton("Resume", () => DownloadQueue.resume())
          );
        } else {
          actionsEl.appendChild(
            makeButton("Pause", () => DownloadQueue.pause())
          );
        }
        actionsEl.appendChild(makeButton("Cancel", () => DownloadQueue.cancel()));
      } else if (pendingCount > 0) {
        const startBtn = makeButton(`Start (${pendingCount})`, () =>
          DownloadQueue.startManual()
        );
        startBtn.style.background = "#6093B5";
        startBtn.style.borderColor = "#6093B5";
        actionsEl.appendChild(startBtn);
        actionsEl.appendChild(
          makeButton("Clear", () => DownloadQueue.clear())
        );
      }
    }

    function showToast(msg) {
      ensurePanel();
      toastEl.innerText = msg;
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        if (toastEl) toastEl.innerText = "";
      }, 3000);
    }

    function showPackaging() {
      ensurePanel();
      summaryEl.innerText = "📦 Packaging...";
      progressBarEl.style.width = "0%";
      progressTextEl.innerText = "0%";
    }

    function updatePackProgress(percent) {
      if (!progressBarEl) return;
      const p = Math.floor(percent);
      progressBarEl.style.width = p + "%";
      progressTextEl.innerText = p + "%";
    }

    function showComplete(succeeded, failed, failedList, zipBlob, zipName) {
      ensurePanel();
      titleEl.innerText = "✅ Done";
      summaryEl.innerText = `${succeeded} succeeded, ${failed} failed`;
      progressBarEl.style.width = "100%";
      progressBarEl.style.backgroundColor = "#B6C649";
      progressTextEl.innerText = "100%";

      actionsEl.innerHTML = "";
      if (failedList && failedList.length > 0) {
        actionsEl.appendChild(
          makeButton("Copy failed URLs", () => {
            const text = failedList.map((i) => i.url).join("\n");
            navigator.clipboard?.writeText(text);
            showToast("Copied to clipboard");
          })
        );
      }
      actionsEl.appendChild(makeButton("Close", hide));
    }

    function showCancelled() {
      ensurePanel();
      titleEl.innerText = "⛔ Cancelled";
      summaryEl.innerText = "Download cancelled.";
      actionsEl.innerHTML = "";
      actionsEl.appendChild(makeButton("Close", hide));
    }

    function hide() {
      if (panel && panel.parentNode) {
        panel.parentNode.removeChild(panel);
      }
      panel = null;
      listEl = null;
      titleEl = null;
      summaryEl = null;
      progressBarEl = null;
      progressTextEl = null;
      actionsEl = null;
      toastEl = null;
    }

    return {
      update,
      showToast,
      showPackaging,
      updatePackProgress,
      showComplete,
      showCancelled,
      hide,
    };
  })();

  const triggerBlobDownload = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const DownloadQueue = (() => {
    const queue = [];
    let currentIndex = 0;
    let running = false;
    let paused = false;
    let cancelled = false;
    let succeeded = 0;
    let failed = 0;
    const failedList = [];

    const RETRY_LIMIT = 2;
    const DELAY_BETWEEN = 300;

    function reset() {
      queue.length = 0;
      currentIndex = 0;
      running = false;
      paused = false;
      cancelled = false;
      succeeded = 0;
      failed = 0;
      failedList.length = 0;
    }

    function enqueue(url, type, meta) {
      if (!url) return;
      if (!running && (succeeded > 0 || failed > 0)) {
        reset();
      }
      if (queue.some((item) => item.url === url)) {
        QueueUI.showToast("Already queued — duplicate URL skipped");
        return;
      }
      queue.push({
        url,
        type,
        meta: meta || null,
        status: "pending",
        blob: null,
        fileName: null,
      });
      QueueUI.update();
    }

    function startManual() {
      if (running) return;
      if (!queue.some((q) => q.status === "pending")) {
        QueueUI.showToast("Queue is empty");
        return;
      }
      start();
    }

    function removeAt(index) {
      if (running) return;
      if (index < 0 || index >= queue.length) return;
      queue.splice(index, 1);
      QueueUI.update();
    }

    function clear() {
      if (running) return;
      reset();
      QueueUI.hide();
    }

    async function start() {
      running = true;
      paused = false;
      cancelled = false;

      while (currentIndex < queue.length) {
        if (cancelled) break;
        while (paused && !cancelled) await sleep(200);
        if (cancelled) break;

        const item = queue[currentIndex];
        item.status = "downloading";
        QueueUI.update();

        let success = false;
        for (let retry = 0; retry <= RETRY_LIMIT; retry++) {
          if (cancelled) break;
          try {
            const result = await downloadOne(item);
            item.blob = result.blob;
            item.fileName = result.fileName || item.fileName;
            item.status = "done";
            succeeded++;
            success = true;
            break;
          } catch (err) {
            logger.error(`Download failed (attempt ${retry + 1}): ${err}`);
            if (retry < RETRY_LIMIT) {
              QueueUI.showToast(
                `Retry ${retry + 1}/${RETRY_LIMIT}: ${
                  item.fileName || item.url.substring(0, 30)
                }`
              );
              await sleep(500);
            }
          }
        }

        if (!success && !cancelled) {
          item.status = "failed";
          failed++;
          failedList.push(item);
        }

        QueueUI.update();
        currentIndex++;
        if (currentIndex < queue.length) await sleep(DELAY_BETWEEN);
      }

      running = false;

      if (cancelled) {
        QueueUI.showCancelled();
        return;
      }

      await finalize();
    }

    async function downloadOne(item) {
      if (item.type === "video" || item.type === "gif") {
        return await tel_download_video(item.url, { saveImmediately: false });
      } else if (item.type === "audio") {
        return await tel_download_audio(item.url, { saveImmediately: false });
      } else {
        return await tel_download_image(item.url, { saveImmediately: false });
      }
    }

    async function finalize() {
      const completed = queue.filter((q) => q.status === "done" && q.blob);
      if (completed.length === 0) {
        QueueUI.showComplete(succeeded, failed, failedList, null, null);
        return;
      }
      const usedNames = new Map();
      for (const item of completed) {
        let baseName = item.fileName || "file_" + hashCode(item.url);
        if (usedNames.has(baseName)) {
          const count = usedNames.get(baseName) + 1;
          usedNames.set(baseName, count);
          const dot = baseName.lastIndexOf(".");
          baseName =
            dot > 0
              ? `${baseName.slice(0, dot)}_${count}${baseName.slice(dot)}`
              : `${baseName}_${count}`;
        } else {
          usedNames.set(baseName, 1);
        }
        saveBlob(item.blob, baseName);
        await sleep(400);
      }
      QueueUI.showComplete(succeeded, failed, failedList, null, null);
    }

    function pause() {
      paused = true;
      QueueUI.update();
    }
    function resume() {
      paused = false;
      QueueUI.update();
    }
    function cancel() {
      cancelled = true;
      paused = false;
    }

    return {
      enqueue,
      startManual,
      removeAt,
      clear,
      pause,
      resume,
      cancel,
      isRunning: () => running,
      isPaused: () => paused,
      getQueue: () => queue,
    };
  })();

  logger.info("Initialized");


  setInterval(() => {
    const storiesContainer = document.getElementById("StoryViewer");
    if (storiesContainer) {
      const createDownloadButton = () => {
        const downloadIcon = document.createElement("i");
        downloadIcon.className = "icon icon-download";
        const downloadButton = document.createElement("button");
        downloadButton.className =
          "Button TkphaPyQ tiny translucent-white round tel-download";
        downloadButton.appendChild(downloadIcon);
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        downloadButton.onclick = () => {
          const video = storiesContainer.querySelector("video");
          const videoSrc =
            video?.src ||
            video?.currentSrc ||
            video?.querySelector("source")?.src;
          if (videoSrc) {
            DownloadQueue.enqueue(videoSrc, "video", getCurrentSender());
          } else {
            const images = storiesContainer.querySelectorAll("img.PVZ8TOWS");
            if (images.length > 0) {
              const imageSrc = images[images.length - 1]?.src;
              if (imageSrc) DownloadQueue.enqueue(imageSrc, "image", getCurrentSender());
            }
          }
        };
        return downloadButton;
      };

      const storyHeader =
        storiesContainer.querySelector(".GrsJNw3y") ||
        storiesContainer.querySelector(".DropdownMenu")?.parentNode;
      if (storyHeader && !storyHeader.querySelector(".tel-download")) {
        storyHeader.insertBefore(
          createDownloadButton(),
          storyHeader.querySelector("button")
        );
      }
    }

    const mediaContainer = document.querySelector(
      "#MediaViewer .MediaViewerSlide--active"
    );
    const mediaViewerActions = document.querySelector(
      "#MediaViewer .MediaViewerActions"
    );
    if (!mediaContainer || !mediaViewerActions) return;

    const videoPlayer = mediaContainer.querySelector(
      ".MediaViewerContent > .VideoPlayer"
    );
    const img = mediaContainer.querySelector(".MediaViewerContent > div > img");
    const downloadIcon = document.createElement("i");
    downloadIcon.className = "icon icon-download";
    const downloadButton = document.createElement("button");
    downloadButton.className =
      "Button smaller translucent-white round tel-download";
    downloadButton.setAttribute("type", "button");
    downloadButton.setAttribute("title", "Download");
    downloadButton.setAttribute("aria-label", "Download");
    if (videoPlayer) {
      const videoUrl = videoPlayer.querySelector("video").currentSrc;
      downloadButton.setAttribute("data-tel-download-url", videoUrl);
      downloadButton.appendChild(downloadIcon);
      downloadButton.onclick = () => {
        enqueueActive(getActiveMediaA);
      };

      const controls = videoPlayer.querySelector(".VideoPlayerControls");
      if (controls) {
        const buttons = controls.querySelector(".buttons");
        if (!buttons.querySelector("button.tel-download")) {
          const spacer = buttons.querySelector(".spacer");
          spacer.after(downloadButton);
        }
      }

      if (mediaViewerActions.querySelector("button.tel-download")) {
        const telDownloadButton = mediaViewerActions.querySelector(
          "button.tel-download"
        );
        if (
          mediaViewerActions.querySelectorAll('button[title="Download"]')
            .length > 1
        ) {
          mediaViewerActions.querySelector("button.tel-download").remove();
        } else if (
          telDownloadButton.getAttribute("data-tel-download-url") !== videoUrl
        ) {
          telDownloadButton.onclick = () => {
            enqueueActive(getActiveMediaA);
          };
          telDownloadButton.setAttribute("data-tel-download-url", videoUrl);
        }
      } else if (
        !mediaViewerActions.querySelector('button[title="Download"]')
      ) {
        mediaViewerActions.prepend(downloadButton);
      }
    } else if (img && img.src) {
      downloadButton.setAttribute("data-tel-download-url", img.src);
      downloadButton.appendChild(downloadIcon);
      downloadButton.onclick = () => {
        enqueueActive(getActiveMediaA);
      };

      if (mediaViewerActions.querySelector("button.tel-download")) {
        const telDownloadButton = mediaViewerActions.querySelector(
          "button.tel-download"
        );
        if (
          mediaViewerActions.querySelectorAll('button[title="Download"]')
            .length > 1
        ) {
          mediaViewerActions.querySelector("button.tel-download").remove();
        } else if (
          telDownloadButton.getAttribute("data-tel-download-url") !== img.src
        ) {
          telDownloadButton.onclick = () => {
            enqueueActive(getActiveMediaA);
          };
          telDownloadButton.setAttribute("data-tel-download-url", img.src);
        }
      } else if (
        !mediaViewerActions.querySelector('button[title="Download"]')
      ) {
        mediaViewerActions.prepend(downloadButton);
      }
    }
  }, REFRESH_DELAY);

  setInterval(() => {
    /* Voice Message or Circle Video */
    const pinnedAudio = document.body.querySelector(".pinned-audio");
    let dataMid;
    let downloadButtonPinnedAudio =
      document.body.querySelector("._tel_download_button_pinned_container") ||
      document.createElement("button");
    if (pinnedAudio) {
      dataMid = pinnedAudio.getAttribute("data-mid");
      downloadButtonPinnedAudio.className =
        "btn-icon tgico-download _tel_download_button_pinned_container";
      downloadButtonPinnedAudio.innerHTML = `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`;
    }
    const audioElements = document.body.querySelectorAll("audio-element");
    audioElements.forEach((audioElement) => {
      const bubble = audioElement.closest(".bubble");
      if (
        !bubble ||
        bubble.querySelector("._tel_download_button_pinned_container")
      ) {
        return;
      }
      if (
        dataMid &&
        downloadButtonPinnedAudio.getAttribute("data-mid") !== dataMid &&
        audioElement.getAttribute("data-mid") === dataMid
      ) {
        const link = audioElement.audio && audioElement.audio.getAttribute("src");
        const isAudio =
          audioElement.audio && audioElement.audio instanceof HTMLAudioElement;
        downloadButtonPinnedAudio.onclick = (e) => {
          e.stopPropagation();
          DownloadQueue.enqueue(link, isAudio ? "audio" : "video", getCurrentSender());
        };
        downloadButtonPinnedAudio.setAttribute("data-mid", dataMid);
        if (link) {
          pinnedAudio
            .querySelector(".pinned-container-wrapper-utils")
            .appendChild(downloadButtonPinnedAudio);
        }
      }
    });

    const storiesContainer = document.getElementById("stories-viewer");
    if (storiesContainer) {
      const createDownloadButton = () => {
        const downloadButton = document.createElement("button");
        downloadButton.className = "btn-icon rp tel-download";
        downloadButton.innerHTML = `<span class="tgico">${DOWNLOAD_ICON}</span><div class="c-ripple"></div>`;
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        downloadButton.onclick = () => {
          const video = storiesContainer.querySelector("video.media-video");
          const videoSrc =
            video?.src ||
            video?.currentSrc ||
            video?.querySelector("source")?.src;
          if (videoSrc) {
            DownloadQueue.enqueue(videoSrc, "video", getCurrentSender());
          } else {
            const imageSrc =
              storiesContainer.querySelector("img.media-photo")?.src;
            if (imageSrc) DownloadQueue.enqueue(imageSrc, "image", getCurrentSender());
          }
        };
        return downloadButton;
      };

      const storyHeader = storiesContainer.querySelector(
        "[class^='_ViewerStoryHeaderRight']"
      );
      if (storyHeader && !storyHeader.querySelector(".tel-download")) {
        storyHeader.prepend(createDownloadButton());
      }

      const storyFooter = storiesContainer.querySelector(
        "[class^='_ViewerStoryFooterRight']"
      );
      if (storyFooter && !storyFooter.querySelector(".tel-download")) {
        storyFooter.prepend(createDownloadButton());
      }
    }

    const mediaContainer = document.querySelector(".media-viewer-whole");
    if (!mediaContainer) return;
    const mediaAspecter = mediaContainer.querySelector(
      ".media-viewer-movers .media-viewer-aspecter"
    );
    const mediaButtons = mediaContainer.querySelector(
      ".media-viewer-topbar .media-viewer-buttons"
    );
    if (!mediaAspecter || !mediaButtons) return;

    const hiddenButtons = mediaButtons.querySelectorAll("button.btn-icon.hide");
    for (const btn of hiddenButtons) {
      if (btn.textContent === FORWARD_ICON) {
        btn.classList.remove("hide");
        btn.classList.add("tgico-forward");
      }
    }

    const existingDownloadBtn = mediaButtons.querySelector(
      "button.btn-icon.tgico-download:not(.tel-download):not(.tel-download-wired)"
    );
    if (existingDownloadBtn) {
      existingDownloadBtn.classList.add("tel-download-wired");
      existingDownloadBtn.addEventListener(
        "click",
        (e) => {
          const m = getActiveMediaK();
          if (m) {
            e.stopImmediatePropagation();
            e.preventDefault();
            DownloadQueue.enqueue(m.url, m.type, getCurrentSender());
          }
        },
        true // capture phase: run before Telegram's own handler
      );
    }

    if (mediaAspecter.querySelector(".ckin__player")) {
      const controls = mediaAspecter.querySelector(
        ".default__controls.ckin__controls"
      );
      if (controls && !controls.querySelector(".tel-download")) {
        const brControls = controls.querySelector(
          ".bottom-controls .right-controls"
        );
        const downloadButton = document.createElement("button");
        downloadButton.className =
          "btn-icon default__button tgico-download tel-download";
        downloadButton.innerHTML = `<span class="tgico">${DOWNLOAD_ICON}</span>`;
        downloadButton.setAttribute("type", "button");
        downloadButton.setAttribute("title", "Download");
        downloadButton.setAttribute("aria-label", "Download");
        downloadButton.onclick = () => enqueueActive(getActiveMediaK);
        brControls.prepend(downloadButton);
      }
    } else if (
      mediaAspecter.querySelector("video") &&
      !mediaButtons.querySelector("button.btn-icon.tgico-download")
    ) {
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.innerHTML = `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`;
      downloadButton.setAttribute("type", "button");
      downloadButton.setAttribute("title", "Download");
      downloadButton.setAttribute("aria-label", "Download");
      downloadButton.onclick = () => enqueueActive(getActiveMediaK);
      mediaButtons.prepend(downloadButton);
    } else if (!mediaButtons.querySelector("button.btn-icon.tgico-download")) {
      if (
        !mediaAspecter.querySelector("img.thumbnail") ||
        !mediaAspecter.querySelector("img.thumbnail").src
      ) {
        return;
      }
      const downloadButton = document.createElement("button");
      downloadButton.className = "btn-icon tgico-download tel-download";
      downloadButton.innerHTML = `<span class="tgico button-icon">${DOWNLOAD_ICON}</span>`;
      downloadButton.setAttribute("type", "button");
      downloadButton.setAttribute("title", "Download");
      downloadButton.setAttribute("aria-label", "Download");
      downloadButton.onclick = () => enqueueActive(getActiveMediaK);
      mediaButtons.prepend(downloadButton);
    }
  }, REFRESH_DELAY);

  (function setupProgressBar() {
    const body = document.querySelector("body");
    const container = document.createElement("div");
    container.id = "tel-downloader-progress-bar-container";
    container.style.position = "fixed";
    container.style.bottom = 0;
    container.style.right = 0;
    container.style.zIndex = 9999;
    body.appendChild(container);
  })();

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "KeyD") return;
      if (!e.altKey || !e.shiftKey) return;
      if (e.ctrlKey || e.metaKey) return;
      const t = e.target;
      const tag = t && t.tagName ? t.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || (t && t.isContentEditable)) {
        return;
      }
      const m = getActiveMediaA() || getActiveMediaK();
      if (!m) return;
      e.preventDefault();
      e.stopPropagation();
      DownloadQueue.enqueue(m.url, m.type, getCurrentSender());
    },
    true
  );

  logger.info("Completed script setup. Shortcut: Alt+Shift+D");
})();


/*
Credits — modified by AlexRabbit (https://github.com/AlexRabbit)
  - wuniversales — Telegram Web Ads Remover
  - Nestor Qin — Telegram Media Downloader
  - WZzhaoyi — Telegram Media Downloader (queue fork)
*/
