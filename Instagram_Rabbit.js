// ==UserScript==
// @name         Instagram_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      1.0.0
// @description  Ultimate video controls, media download buttons, and interaction unlock for Instagram. One script, all features. AdGuard-friendly.
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        https://www.instagram.com/*
// @match        https://instagram.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @grant        GM_getValue
// @grant        GM_setValue
// @run-at       document-start
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Instagram_Rabbit.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Instagram_Rabbit.js
// @supportURL   https://github.com/AlexRabbit/Userscripts/issues
// ==/UserScript==

(function () {
    'use strict';
    if (typeof globalThis.GM_getValue === 'function') return;

    const PREFIX = 'AR_GM_';

    globalThis.GM_getValue = function (key, defaultValue) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            if (raw === null) return defaultValue;
            return JSON.parse(raw);
        } catch {
            return defaultValue;
        }
    };

    globalThis.GM_setValue = function (key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
        } catch {

        }
    };

    globalThis.GM_deleteValue = function (key) {
        try {
            localStorage.removeItem(PREFIX + key);
        } catch {

        }
    };
})();

(() => {

	const CONFIG = {
		DEFAULT_VOLUME: 0.5,
		DEFAULT_SPEED: 1,
		DEFAULT_MUTED: true,
		SPEEDS: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4],
		LONG_PRESS_SPEED: 2,
		LONG_PRESS_DELAY: 200,
		SEEK_TIME: 5,
		FRAME_TIME: 1 / 30,

		UI_HIDE_DELAY: 1500,
		UI_HIDE_WHEN_PAUSED: true,
		MIN_PANEL_WIDTH_FOR_INLINE: 400,
		WHEEL_VOLUME_STEP: 0.05,
		WHEEL_SPEED_STEP: 1,
		WHEEL_SEEK_STEP: 2,
		MIN_VIDEO_WIDTH: 100,
		MIN_VIDEO_HEIGHT: 100,

		POLL_INTERVAL: 500,

		ZERO_RECT_RETRIES: 8,
		ZERO_RECT_RETRY_DELAY: 400,
	};

	const ICONS = {
		play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`,
		pause: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`,
		volumeHigh: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`,
		volumeMuted: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
		fullscreen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>`,
		exitFullscreen: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>`,
		pip: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`,
	};

	const PLATFORM_ID = "ig";

	function isFacebookInjectionAllowed() {
		if (PLATFORM_ID !== "fb") return true;
		return /^\/reels?(\/|$)/i.test(location.pathname);
	}

	const PLATFORM = {
		id: PLATFORM_ID,
		name: PLATFORM_ID === "fb" ? "Facebook" : "Instagram",
		classPrefix: PLATFORM_ID === "fb" ? "fbu" : "igu",
		storagePrefix: PLATFORM_ID === "fb" ? "fb_" : "",
		styleId: PLATFORM_ID === "fb" ? "fb-ultimate-styles" : "ig-ultimate-styles",
		accentColor: PLATFORM_ID === "fb" ? "#1877f2" : "#0095f6",
		accentGradient:
			PLATFORM_ID === "fb"
				? "linear-gradient(90deg, #1877f2, #42b0ff)"
				: "linear-gradient(90deg, #0095f6, #00d4ff)",

		findVideoWrapper(video) {
			if (PLATFORM_ID === "fb") {
				return PLATFORM._findFacebookWrapper(video);
			} else {
				return PLATFORM._findInstagramWrapper(video);
			}
		},

		_findFacebookWrapper(video) {

			const videoIdDiv = video.closest("[data-video-id]");
			if (videoIdDiv) {
				return videoIdDiv;
			}

			const instanceDiv = video.closest("div[data-instancekey]");
			if (instanceDiv && instanceDiv.parentElement) {
				return instanceDiv.parentElement;
			}

			const groupDiv = video.closest('[role="group"][aria-label*="ideo"]');
			if (groupDiv && groupDiv.parentElement) {
				return groupDiv.parentElement;
			}

			let candidate = video.parentElement;
			for (let depth = 0; depth < 10 && candidate; depth++) {
				const hasOverlay = candidate.querySelector(
					'[aria-label="Play"], [aria-label="Pause"], [aria-label="Mute"], [aria-label="Unmute"]',
				);
				if (hasOverlay) {
					const rect = candidate.getBoundingClientRect();
					if (
						rect.width >= CONFIG.MIN_VIDEO_WIDTH &&
						rect.height >= CONFIG.MIN_VIDEO_HEIGHT
					) {
						return candidate;
					}
				}
				candidate = candidate.parentElement;
			}

			let el = video.parentElement;
			for (let depth = 0; depth < 15 && el; depth++) {
				const st = getComputedStyle(el);
				const rect = el.getBoundingClientRect();
				if (
					rect.width >= CONFIG.MIN_VIDEO_WIDTH &&
					rect.height >= CONFIG.MIN_VIDEO_HEIGHT &&
					rect.width < window.innerWidth * 0.95 &&
					rect.height < window.innerHeight * 1.1 &&
					(st.position !== "static" ||
						st.overflow === "hidden" ||
						st.overflow === "clip")
				) {
					return el;
				}
				el = el.parentElement;
			}

			return video.parentElement;
		},

		_findInstagramWrapper(video) {
			let el = video.parentElement;
			for (let depth = 0; depth < 15 && el; depth++) {
				if (el.querySelector(':scope > div[data-instancekey]')) {
					return el;
				}
				el = el.parentElement;
			}
			return video.parentElement;
		},

		getNativeControlHidingCSS() {
			if (PLATFORM_ID === "fb") {
				return `
                /* Hide only FB's native progress/seek slider — our timeline replaces it.
                   We intentionally do NOT hide the play/pause/mute buttons because:
                   1. Our panel's z-index already puts our controls on top.
                   2. Hiding them caused native buttons to become invisible on hover
                      whenever ui-visible was set, which is most of the time. */
                .$this.classPrefix}-wrapper div[role="progressbar"],
                .$this.classPrefix}-wrapper div[role="slider"][aria-label*="ideo"] {
                    opacity: 0 !important;
                    pointer-events: none !important;
                }
                `;
			} else {
				return `
                /* Hide Instagram's native controls overlay */
                .$this.classPrefix}-wrapper > div[data-instancekey] > div:first-child {
                    z-index: 1 !important;
                }

                /* Instagram native button containers - position above our controls */
                .$this.classPrefix}-wrapper div:has(> button[aria-label="Toggle audio"]),
                .$this.classPrefix}-wrapper div:has(> button[aria-label*="audio"]) {
                    position: absolute !important;
                    bottom: calc(var(--$this.classPrefix}-panel-height, 36px) + 8px) !important;
                    top: auto !important;
                    right: 8px !important;
                    left: auto !important;
                    z-index: 2147483646 !important;
                    opacity: 0 !important;
                    transition: opacity 0.2s ease, bottom 0.15s ease !important;
                    pointer-events: none !important;
                }

                .$this.classPrefix}-wrapper.ui-visible div:has(> button[aria-label="Toggle audio"]),
                .$this.classPrefix}-wrapper.ui-visible div:has(> button[aria-label*="audio"]) {
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }

                .$this.classPrefix}-wrapper div:has(> button svg[aria-label="Tags"]),
                .$this.classPrefix}-wrapper div:has(> button svg[aria-label*="Tags"]) {
                    position: absolute !important;
                    bottom: calc(var(--$this.classPrefix}-panel-height, 36px) + 8px) !important;
                    top: auto !important;
                    left: 8px !important;
                    right: auto !important;
                    z-index: 2147483646 !important;
                    opacity: 0 !important;
                    transition: opacity 0.2s ease, bottom 0.15s ease !important;
                    pointer-events: none !important;
                }

                .$this.classPrefix}-wrapper.ui-visible div:has(> button svg[aria-label="Tags"]),
                .$this.classPrefix}-wrapper.ui-visible div:has(> button svg[aria-label*="Tags"]) {
                    opacity: 1 !important;
                    pointer-events: auto !important;
                }
                `;
			}
		},
	};

	const State = {
		data: null,
		listeners: new Set(),

		init() {
			let autoUnmute = false;
			let volume = CONFIG.DEFAULT_VOLUME;
			let speed = CONFIG.DEFAULT_SPEED;

			const prefix = PLATFORM.storagePrefix;

			try {
				if (typeof GM_getValue === "function") {
					autoUnmute = GM_getValue(`$prefix}autoUnmute`, false);
					const savedVolume = GM_getValue(`$prefix}volume`, null);
					if (savedVolume !== null && !Number.isNaN(savedVolume)) {
						volume = Utils.clamp(parseFloat(savedVolume), 0, 1);
					}
					const savedSpeed = GM_getValue(`$prefix}speed`, null);
					if (
						savedSpeed !== null &&
						!Number.isNaN(savedSpeed) &&
						CONFIG.SPEEDS.includes(parseFloat(savedSpeed))
					) {
						speed = parseFloat(savedSpeed);
					}
				}
			} catch (e) {
				console.warn(
					`[$PLATFORM.classPrefix.toUpperCase()}] GM_getValue not available:`,
					e,
				);
			}

			this.data = {
				volume: volume,
				speed: speed,
				muted: autoUnmute ? false : CONFIG.DEFAULT_MUTED,
				autoUnmute: autoUnmute,
			};
			return this;
		},

		get(key) {
			return this.data[key];
		},

		set(key, value) {
			this.data[key] = value;
			if (key === "volume" || key === "speed") {
				try {
					if (typeof GM_setValue === "function") {
						GM_setValue(`$PLATFORM.storagePrefix}$key}`, value);
					}
				} catch (_e) {}
			}
			this.notify();
		},

		setAutoUnmute(value) {
			this.data.autoUnmute = value;
			try {
				if (typeof GM_setValue === "function") {
					GM_setValue(`$PLATFORM.storagePrefix}autoUnmute`, value);
				}
			} catch (_e) {}
			if (value) {
				this.data.muted = false;
				this.applyToAll();
			}
			this.notify();
		},

		subscribe(callback) {
			this.listeners.add(callback);
			return () => this.listeners.delete(callback);
		},

		notify() {
			for (const cb of this.listeners) cb(this.data);
		},

		applyToVideo(video) {
			if (!video) return;
			video.volume = this.data.volume;
			video.playbackRate = this.data.speed;
			if (this.data.autoUnmute) {
				video.muted = false;
			} else {
				video.muted = this.data.muted;
			}
		},

		applyToAll() {
			for (const v of document.querySelectorAll("video")) this.applyToVideo(v);
		},
	};

	const AudioEngine = {
		init() {
			const observer = new MutationObserver((mutations) => {
				mutations.forEach((m) => {
					m.addedNodes.forEach((node) => {
						if (node.nodeName === "VIDEO") {
							this.setupVideo(node);
						} else if (node.querySelectorAll) {
							for (const v of node.querySelectorAll("video"))
								this.setupVideo(v);
						}
					});
				});
			});

			observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
			});
			for (const v of document.querySelectorAll("video")) this.setupVideo(v);
		},

		setupVideo(video) {
			if (video._fbAudioEngineSetup) return;
			video._fbAudioEngineSetup = true;

			video._userMuteIntent = null;
			video._autoUnmuteApplied = false;
			video._volumeSetupComplete = false;
			video._speedSetupComplete = false;

			video.volume = State.get("volume");
			video.playbackRate = State.get("speed");

			const reapply = () => {
				if (!video._volumeSetupComplete) video.volume = State.get("volume");
				if (!video._speedSetupComplete) video.playbackRate = State.get("speed");
			};
			setTimeout(reapply, 100);
			setTimeout(reapply, 500);
			setTimeout(() => {
				video._volumeSetupComplete = true;
				video._speedSetupComplete = true;
			}, 600);

			if (State.get("autoUnmute")) {
				video.muted = false;
				const applyAutoUnmute = () => {
					if (State.get("autoUnmute") && video._userMuteIntent === null) {
						video.muted = false;
					}
				};
				setTimeout(applyAutoUnmute, 100);
				setTimeout(applyAutoUnmute, 500);
				setTimeout(() => {
					video._autoUnmuteApplied = true;
				}, 600);
			} else {
				video._autoUnmuteApplied = true;
			}

			video.addEventListener("volumechange", () => {
				if (video._volumeSetupComplete) {
					State.data.volume = video.volume;
				}
				State.notify();
			});

			video.addEventListener("ratechange", () => {
				const speed = video.playbackRate;
				if (video._speedSetupComplete && Number.isFinite(speed) && speed > 0) {
					State.data.speed = speed;
				}
				State.notify();
			});
		},
	};

	const Utils = {
		formatTime(seconds) {
			if (!seconds || Number.isNaN(seconds)) return "0:00";
			const hrs = Math.floor(seconds / 3600);
			const mins = Math.floor((seconds % 3600) / 60);
			const secs = Math.floor(seconds % 60);
			if (hrs > 0) {
				return `$hrs}:$mins.toString().padStart(2, "0")}:$secs.toString().padStart(2, "0")}`;
			}
			return `$mins}:$secs.toString().padStart(2, "0")}`;
		},

		debounce(fn, delay) {
			let timeout;
			return (...args) => {
				clearTimeout(timeout);
				timeout = setTimeout(() => fn(...args), delay);
			};
		},

		clamp(value, min, max) {
			return Math.max(min, Math.min(max, value));
		},

		getClosestVideo() {
			let closest = null;
			let minDistance = Infinity;
			const centerX = window.innerWidth / 2;
			const centerY = window.innerHeight / 2;

			document.querySelectorAll("video").forEach((video) => {
				const rect = video.getBoundingClientRect();
				if (rect.width < 50 || rect.height < 50) return;

				const vidCenterX = rect.left + rect.width / 2;
				const vidCenterY = rect.top + rect.height / 2;
				const distance = Math.hypot(centerX - vidCenterX, centerY - vidCenterY);

				if (distance < minDistance) {
					minDistance = distance;
					closest = video;
				}
			});

			return closest;
		},

		isInputFocused() {
			const active = document.activeElement;
			return (
				active &&
				(active.tagName === "INPUT" ||
					active.tagName === "TEXTAREA" ||
					active.isContentEditable ||
					active.contentEditable === "true" ||
					active.getAttribute("role") === "textbox")
			);
		},

		findVideoWrapper(video) {
			return PLATFORM.findVideoWrapper(video);
		},
	};

	const Styles = {
		inject() {
			if (document.getElementById(PLATFORM.styleId)) return;

			const p = PLATFORM.classPrefix;
			const css = document.createElement("style");
			css.id = PLATFORM.styleId;
			css.textContent = `
                /* Main Control Panel */
                .$p}-panel {
                    --$p}-btn-size: 36px;
                    --$p}-glow: 0 0 8px $PLATFORM.accentColor}80, 0 0 16px $PLATFORM.accentColor}40;
                    --$p}-glow-subtle: 0 0 6px $PLATFORM.accentColor}60;
                    position: absolute !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100% !important;
                    background: linear-gradient(transparent 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.9) 100%) !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    opacity: 0 !important;
                    visibility: hidden !important;
                    transition: opacity 0.2s ease, visibility 0s linear 0.2s !important;
                    z-index: 2147483647 !important;
                    pointer-events: none !important;
                    box-sizing: border-box !important;
                    isolation: isolate !important;
                }

                .$p}-wrapper.ui-visible .$p}-panel {
                    opacity: 1 !important;
                    visibility: visible !important;
                    transition: opacity 0.2s ease, visibility 0s linear 0s !important;
                    pointer-events: auto !important;
                }

                .$p}-wrapper.ui-visible .$p}-panel,
                .$p}-wrapper.ui-visible .$p}-panel * {
                    pointer-events: auto !important;
                }

                .$p}-controls {
                    display: flex;
                    align-items: center;
                    gap: 0;
                    min-height: var(--$p}-btn-size);
                    padding: 0;
                    margin: 0 !important;
                }

                .$p}-btn {
                    all: unset;
                    width: var(--$p}-btn-size);
                    height: var(--$p}-btn-size);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    color: white;
                    border-radius: 0;
                    transition: background 0.15s, box-shadow 0.15s;
                    flex-shrink: 0;
                    box-sizing: border-box;
                }

                .$p}-btn:hover {
                    background: rgba(255,255,255,0.2);
                    box-shadow: var(--$p}-glow);
                }

                .$p}-btn:active {
                    background: rgba(255,255,255,0.3);
                    box-shadow: var(--$p}-glow-subtle);
                }

                .$p}-btn svg {
                    width: 18px;
                    height: 18px;
                }

                /* Timeline */
                .$p}-timeline {
                    flex: 1;
                    height: var(--$p}-btn-size);
                    display: flex;
                    align-items: stretch;
                    cursor: pointer;
                    position: relative;
                    margin: 0 !important;
                    padding: 0 !important;
                }

                .$p}-timeline-track {
                    width: 100%;
                    height: 100%;
                    background: rgba(255,255,255,0.25);
                    border-radius: 0;
                    overflow: hidden;
                    position: relative;
                    transition: box-shadow 0.15s;
                }

                .$p}-timeline:hover .$p}-timeline-track {
                    box-shadow: var(--$p}-glow);
                }

                .$p}-timeline-progress {
                    height: 100%;
                    background: $PLATFORM.accentGradient};
                    border-radius: 0;
                    width: 0%;
                    position: absolute;
                    top: 0;
                    left: 0;
                }

                .$p}-panel.stacked .$p}-timeline {
                    height: var(--$p}-btn-size);
                }

                .$p}-timeline-thumb {
                    position: absolute;
                    right: -6px;
                    top: 50%;
                    transform: translateY(-50%) scale(0);
                    width: 12px;
                    height: 12px;
                    background: white;
                    border-radius: 50%;
                    box-shadow: 0 0 4px rgba(0,0,0,0.5);
                    transition: transform 0.15s, box-shadow 0.15s;
                    z-index: 2;
                }

                .$p}-timeline:hover .$p}-timeline-thumb {
                    box-shadow: 0 0 4px rgba(0,0,0,0.5), var(--$p}-glow-subtle);
                }

                .$p}-timeline:hover .$p}-timeline-thumb {
                    transform: translateY(-50%) scale(1);
                }

                .$p}-timeline-tooltip {
                    position: absolute;
                    bottom: 100%;
                    background: rgba(20,20,20,0.95);
                    color: #f0f0f0;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: 500;
                    font-family: monospace;
                    transform: translateX(-50%);
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.12s ease;
                    margin-bottom: 6px;
                    white-space: nowrap;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.4);
                }

                .$p}-timeline:hover .$p}-timeline-tooltip {
                    opacity: 1;
                    box-shadow: var(--$p}-glow);
                }

                .$p}-time-current,
                .$p}-time-duration {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    color: white;
                    font-size: 10px;
                    font-family: monospace;
                    line-height: 1;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.8);
                    pointer-events: none;
                    user-select: none;
                    z-index: 3;
                    padding: 0 5px;
                }

                .$p}-time-current { left: 0; }
                .$p}-time-duration { right: 0; }

                /* Volume Control */
                .$p}-volume-wrap {
                    display: flex;
                    align-items: center;
                    position: relative;
                }

                .$p}-slider-popup {
                    position: absolute;
                    bottom: 100%;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0, 0, 0, 0.95);
                    border-radius: 0;
                    padding: 6px 4px;
                    margin-bottom: 0;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.15s, visibility 0.15s;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    width: var(--$p}-btn-size);
                    overflow: hidden;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                    z-index: 2147483650;
                    box-sizing: border-box;
                }

                .$p}-volume-wrap:hover .$p}-slider-popup,
                .$p}-speed-wrap:hover .$p}-slider-popup {
                    opacity: 1;
                    visibility: visible;
                    box-shadow: var(--$p}-glow);
                }

                .$p}-slider-value {
                    color: white;
                    font-size: 9px;
                    font-weight: bold;
                    font-family: monospace;
                    white-space: nowrap;
                    max-width: 100%;
                    text-align: center;
                    overflow: hidden;
                }

                .$p}-auto-unmute-wrap {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 6px 4px;
                    cursor: pointer;
                    position: relative;
                    border-bottom: 1px solid rgba(255,255,255,0.2);
                    margin-bottom: 4px;
                }

                .$p}-auto-unmute-checkbox {
                    width: 14px;
                    height: 14px;
                    cursor: pointer;
                    accent-color: $PLATFORM.accentColor};
                    margin: 0;
                }

                /* Tooltip */
                .$p}-tooltip {
                    position: fixed;
                    background: rgba(20,20,20,0.95);
                    color: #f0f0f0;
                    padding: 5px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    white-space: nowrap;
                    pointer-events: none;
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.12s ease, visibility 0.12s ease;
                    z-index: 2147483650;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
                    letter-spacing: 0.01em;
                }

                .$p}-tooltip.visible {
                    opacity: 1;
                    visibility: visible;
                }

                /* Vertical Range Slider */
                .$p}-range-vertical {
                    -webkit-appearance: none;
                    appearance: none;
                    background: transparent;
                    cursor: pointer;
                    width: 60px;
                    height: 16px;
                    transform: rotate(-90deg);
                    transform-origin: center;
                    margin: 20px -2px;
                    touch-action: none;
                }

                .$p}-range-vertical::-webkit-slider-runnable-track {
                    height: 4px;
                    background: rgba(255,255,255,0.3);
                    border-radius: 2px;
                }

                .$p}-range-vertical::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: 50%;
                    margin-top: -6px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.5);
                    cursor: grab;
                }

                .$p}-range-vertical::-webkit-slider-thumb:active {
                    cursor: grabbing;
                    transform: scale(1.1);
                }

                .$p}-range-vertical::-moz-range-track {
                    height: 4px;
                    background: rgba(255,255,255,0.3);
                    border-radius: 2px;
                }

                .$p}-range-vertical::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: 50%;
                    border: none;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.5);
                    cursor: grab;
                }

                /* Speed Control */
                .$p}-speed-wrap {
                    display: flex;
                    align-items: center;
                    position: relative;
                }

                .$p}-speed-btn {
                    font-size: 11px;
                    font-weight: bold;
                    font-family: monospace;
                    background: rgba(255,255,255,0.1);
                }

                /* Hint Overlay */
                .$p}-hint {
                    position: absolute;
                    bottom: 80px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(0,0,0,0.85);
                    color: white;
                    padding: 8px 14px;
                    border-radius: 0;
                    font-size: 16px;
                    font-weight: bold;
                    pointer-events: none;
                    opacity: 0;
                    transition: opacity 0.15s;
                    z-index: 2147483645;
                }

                .$p}-hint.show {
                    opacity: 1;
                    box-shadow: var(--$p}-glow);
                }

                /* Stacked layout */
                .$p}-panel.stacked .$p}-controls {
                    flex-wrap: wrap;
                    gap: 0;
                }

                .$p}-panel.stacked .$p}-timeline {
                    order: -1;
                    width: 100%;
                    flex: none;
                    margin: 0 !important;
                }

                /* Wrapper */
                .$p}-wrapper {
                    position: relative !important;
                    z-index: 2147483646 !important;
                    isolation: isolate !important;
                }

                /* Ensure video is clickable */
                .$p}-wrapper video {
                    position: relative;
                    z-index: 0;
                }

                /* Ensure our wrapper doesn't break layout */
                .$p}-wrapper {
                    display: block !important;
                    contain: layout !important;
                }

                /* Catch-all: make sure mouse events reach wrapper even through overlays */
                .$p}-wrapper * {
                    pointer-events: auto;
                }

                /* ========================================
                   PLATFORM-SPECIFIC: NATIVE CONTROL HIDING
                   ======================================== */
                $PLATFORM.getNativeControlHidingCSS()}
            `;

			document.head.appendChild(css);
		},
	};

	const TooltipManager = {
		element: null,
		hideTimeout: null,

		init() {
			if (this.element) return;
			this.element = document.createElement("div");
			this.element.className = `$PLATFORM.classPrefix}-tooltip`;
			document.body.appendChild(this.element);
		},

		show(text, targetElement, position = "above") {
			if (!this.element) this.init();
			clearTimeout(this.hideTimeout);

			this.element.textContent = text;
			this.element.className = `$PLATFORM.classPrefix}-tooltip visible`;

			const rect = targetElement.getBoundingClientRect();
			this.element.style.left = "-9999px";
			this.element.style.top = "-9999px";
			const tooltipRect = this.element.getBoundingClientRect();

			let left, top;

			if (position === "left") {
				left = rect.left - tooltipRect.width - 6;
				top = rect.top + rect.height / 2 - tooltipRect.height / 2;
			} else if (position === "right") {
				left = rect.right + 6;
				top = rect.top + rect.height / 2 - tooltipRect.height / 2;
			} else {
				left = rect.left + rect.width / 2 - tooltipRect.width / 2;
				top = rect.top - tooltipRect.height - 6;
				if (top < 5) {
					top = rect.bottom + 6;
				}
			}

			if (left < 5) left = 5;
			if (left + tooltipRect.width > window.innerWidth - 5) {
				left = window.innerWidth - tooltipRect.width - 5;
			}
			if (top < 5) top = 5;
			if (top + tooltipRect.height > window.innerHeight - 5) {
				top = window.innerHeight - tooltipRect.height - 5;
			}

			this.element.style.left = `$left}px`;
			this.element.style.top = `$top}px`;
		},

		hide() {
			if (!this.element) return;
			this.hideTimeout = setTimeout(() => {
				this.element.classList.remove("visible");
			}, 50);
		},

		attach(element, text, position = "above") {
			element.addEventListener("mouseenter", () =>
				this.show(text, element, position),
			);
			element.addEventListener("mouseleave", () => this.hide());
		},
	};

	class VideoControlsUI {
		constructor(video, wrapper) {
			this.video = video;
			this.wrapper = wrapper;
			this.isDragging = false;
			this.hintTimeout = null;
			this.mouseActivityTimeout = null;
			this.lastMousePos = null;

			this.createUI();
			this.attachEvents();
			this.applyState();
			this.checkLayoutSpace();
		}

		createUI() {
			const p = PLATFORM.classPrefix;
			this.wrapper.classList.add(`$p}-wrapper`);

			const computedPos = getComputedStyle(this.wrapper).position;
			if (computedPos === "static") {
				this.wrapper.style.position = "relative";
			}

			this.panel = document.createElement("div");
			this.panel.className = `$p}-panel`;

			const controls = document.createElement("div");
			controls.className = `$p}-controls`;

			this.playBtn = this.createButton(`$p}-btn $p}-play`, ICONS.play, () =>
				this.togglePlay(),
			);
			TooltipManager.attach(this.playBtn, "Play / Pause (Space)");

			this.timeline = this.createTimeline();

			this.volumeWrap = this.createVolumeControl();

			this.speedWrap = this.createSpeedControl();

			this.supportBtn = document.createElement("a");
			this.supportBtn.className = `$p}-btn`;
			this.supportBtn.href = "https://ko-fi.com/piknockyou";
			this.supportBtn.target = "_blank";
			this.supportBtn.rel = "noopener noreferrer";
			this.supportBtn.ariaLabel = "Support this script";
			this.supportBtn.innerHTML = "☕";
			this.supportBtn.style.fontSize = "16px";
			this.supportBtn.style.textDecoration = "none";
			this.supportBtn.addEventListener("click", (e) => e.stopPropagation());
			TooltipManager.attach(this.supportBtn, "Support this script");

			this.pipBtn = this.createButton(`$p}-btn`, ICONS.pip, () =>
				this.togglePiP(),
			);
			TooltipManager.attach(this.pipBtn, "Picture-in-Picture (P)");

			this.fsBtn = this.createButton(`$p}-btn`, ICONS.fullscreen, () =>
				this.toggleFullscreen(),
			);
			TooltipManager.attach(this.fsBtn, "Fullscreen (F)");

			this.supportBtn.style.marginLeft = "auto";
			this.playBtn.style.marginLeft = "0";
			this.fsBtn.style.marginRight = "0";

			controls.append(
				this.playBtn,
				this.volumeWrap,
				this.speedWrap,
				this.timeline,
				this.supportBtn,
				this.pipBtn,
				this.fsBtn,
			);

			this.panel.appendChild(controls);
			this.wrapper.appendChild(this.panel);

			this.hint = document.createElement("div");
			this.hint.className = `$p}-hint`;
			this.wrapper.appendChild(this.hint);

			const stopPanelEvent = (e) => {
				e.stopPropagation();
				e.stopImmediatePropagation();
			};
			this.panel.addEventListener("click", stopPanelEvent);
			this.panel.addEventListener("dblclick", stopPanelEvent);
			this.panel.addEventListener("mousedown", stopPanelEvent);
			this.panel.addEventListener("mouseup", stopPanelEvent);
			this.panel.addEventListener("pointerdown", stopPanelEvent);
			this.panel.addEventListener("pointerup", stopPanelEvent);
			this.panel.addEventListener("touchstart", stopPanelEvent, {
				passive: true,
			});
			this.panel.addEventListener("touchend", stopPanelEvent);
		}

		createButton(className, icon, onClick) {
			const btn = document.createElement("button");
			btn.className = className;
			btn.innerHTML = icon;
			btn.addEventListener("click", onClick);
			return btn;
		}

		createTimeline() {
			const p = PLATFORM.classPrefix;
			const timeline = document.createElement("div");
			timeline.className = `$p}-timeline`;

			const track = document.createElement("div");
			track.className = `$p}-timeline-track`;

			this.progress = document.createElement("div");
			this.progress.className = `$p}-timeline-progress`;

			const thumb = document.createElement("div");
			thumb.className = `$p}-timeline-thumb`;

			this.tooltip = document.createElement("div");
			this.tooltip.className = `$p}-timeline-tooltip`;
			this.tooltip.textContent = "0:00";

			this.timeCurrent = document.createElement("span");
			this.timeCurrent.className = `$p}-time-current`;
			this.timeCurrent.textContent = "0:00";

			this.timeDuration = document.createElement("span");
			this.timeDuration.className = `$p}-time-duration`;
			this.timeDuration.textContent = "0:00";

			this.progress.appendChild(thumb);
			track.appendChild(this.progress);
			track.appendChild(this.timeCurrent);
			track.appendChild(this.timeDuration);
			timeline.appendChild(track);
			timeline.appendChild(this.tooltip);

			timeline.addEventListener("mousedown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.startSeek(e);
			});
			timeline.addEventListener("mousemove", (e) => this.updateTooltip(e));
			timeline.addEventListener("dragstart", (e) => e.preventDefault());

			timeline.addEventListener(
				"wheel",
				(e) => {
					e.preventDefault();
					e.stopPropagation();
					const delta =
						e.deltaY > 0 ? -CONFIG.WHEEL_SEEK_STEP : CONFIG.WHEEL_SEEK_STEP;
					this.seekRelative(delta);
				},
				{ passive: false },
			);

			return timeline;
		}

		createVolumeControl() {
			const p = PLATFORM.classPrefix;
			const wrap = document.createElement("div");
			wrap.className = `$p}-volume-wrap`;

			this.muteBtn = this.createButton(`$p}-btn`, ICONS.volumeHigh, () =>
				this.toggleMute(),
			);
			TooltipManager.attach(this.muteBtn, "Volume (M)", "left");

			const popup = document.createElement("div");
			popup.className = `$p}-slider-popup`;

			const autoUnmuteWrap = document.createElement("label");
			autoUnmuteWrap.className = `$p}-auto-unmute-wrap`;

			this.autoUnmuteCheckbox = document.createElement("input");
			this.autoUnmuteCheckbox.type = "checkbox";
			this.autoUnmuteCheckbox.className = `$p}-auto-unmute-checkbox`;
			this.autoUnmuteCheckbox.checked = State.get("autoUnmute");

			autoUnmuteWrap.appendChild(this.autoUnmuteCheckbox);
			TooltipManager.attach(autoUnmuteWrap, "Auto-unmute videos");

			this.autoUnmuteCheckbox.addEventListener("change", (e) => {
				e.stopPropagation();
				const checked = this.autoUnmuteCheckbox.checked;
				State.setAutoUnmute(checked);
				if (checked) {
					this.video._userMuteIntent = false;
					this.video.muted = false;
					this.updateVolumeUI();
					this.showHint("🔊 Auto-unmute ON");
				} else {
					this.showHint("🔇 Auto-unmute OFF");
				}
			});

			this.volumeValue = document.createElement("span");
			this.volumeValue.className = `$p}-slider-value`;
			this.volumeValue.textContent = `$Math.round(State.get("volume") * 100)}%`;

			this.volumeSlider = document.createElement("input");
			this.volumeSlider.type = "range";
			this.volumeSlider.className = `$p}-range-vertical`;
			this.volumeSlider.min = "0";
			this.volumeSlider.max = "1";
			this.volumeSlider.step = "0.01";
			this.volumeSlider.value = State.get("volume");

			const handleVolumeInput = (e) => {
				e.stopPropagation();
				const vol = parseFloat(this.volumeSlider.value);
				State.set("volume", vol);
				if (vol > 0 && State.get("muted")) State.set("muted", false);
				this.volumeValue.textContent = `$Math.round(vol * 100)}%`;
				this.applyVolume();
				this.showHint(`$Math.round(vol * 100)}%`);
			};

			this.volumeSlider.addEventListener("input", handleVolumeInput);
			this.volumeSlider.addEventListener("change", handleVolumeInput);

			popup.append(autoUnmuteWrap, this.volumeValue, this.volumeSlider);
			wrap.append(this.muteBtn, popup);

			wrap.addEventListener(
				"wheel",
				(e) => {
					e.preventDefault();
					e.stopPropagation();
					const delta =
						e.deltaY > 0 ? -CONFIG.WHEEL_VOLUME_STEP : CONFIG.WHEEL_VOLUME_STEP;
					this.adjustVolume(delta);
				},
				{ passive: false },
			);

			return wrap;
		}

		createSpeedControl() {
			const p = PLATFORM.classPrefix;
			const wrap = document.createElement("div");
			wrap.className = `$p}-speed-wrap`;

			this.speedBtn = document.createElement("button");
			this.speedBtn.className = `$p}-btn $p}-speed-btn`;
			this.speedBtn.textContent = `$State.get("speed")}x`;
			TooltipManager.attach(this.speedBtn, "Speed ([ / ])", "right");

			const popup = document.createElement("div");
			popup.className = `$p}-slider-popup`;

			this.speedValue = document.createElement("span");
			this.speedValue.className = `$p}-slider-value`;
			this.speedValue.textContent = `$State.get("speed")}x`;

			this.speedSlider = document.createElement("input");
			this.speedSlider.type = "range";
			this.speedSlider.className = `$p}-range-vertical`;
			this.speedSlider.min = "0";
			this.speedSlider.max = String(CONFIG.SPEEDS.length - 1);
			this.speedSlider.step = "1";
			this.speedSlider.value = String(
				CONFIG.SPEEDS.indexOf(State.get("speed")),
			);

			const handleSpeedInput = (e) => {
				e.stopPropagation();
				const idx = parseInt(this.speedSlider.value, 10);
				const speed = CONFIG.SPEEDS[idx];
				if (speed !== undefined) {
					State.set("speed", speed);
					this.video.playbackRate = speed;
					this.speedBtn.textContent = `$speed}x`;
					this.speedValue.textContent = `$speed}x`;
					this.showHint(`$speed}x`);
				}
			};

			this.speedSlider.addEventListener("input", handleSpeedInput);
			this.speedSlider.addEventListener("change", handleSpeedInput);

			this.speedBtn.addEventListener("click", () => {
				const currentIdx = CONFIG.SPEEDS.indexOf(State.get("speed"));
				const nextIdx = (currentIdx + 1) % CONFIG.SPEEDS.length;
				const speed = CONFIG.SPEEDS[nextIdx];
				State.set("speed", speed);
				this.video.playbackRate = speed;
				this.speedBtn.textContent = `$speed}x`;
				this.speedValue.textContent = `$speed}x`;
				this.speedSlider.value = String(nextIdx);
				this.showHint(`$speed}x`);
			});

			popup.append(this.speedValue, this.speedSlider);
			wrap.append(this.speedBtn, popup);

			wrap.addEventListener(
				"wheel",
				(e) => {
					e.preventDefault();
					e.stopPropagation();
					const direction =
						e.deltaY > 0 ? -CONFIG.WHEEL_SPEED_STEP : CONFIG.WHEEL_SPEED_STEP;
					this.cycleSpeed(direction);
				},
				{ passive: false },
			);

			return wrap;
		}

		attachEvents() {
			this.video.addEventListener("play", () => this.updatePlayButton());
			this.video.addEventListener("pause", () => this.updatePlayButton());
			this.video.addEventListener("timeupdate", () => this.updateTime());
			this.video.addEventListener("loadedmetadata", () => this.updateTime());
			this.video.addEventListener("volumechange", () => this.updateVolumeUI());
			this.video.addEventListener("ratechange", () => this.updateSpeedUI());

			this._docMouseMoveHandler = (e) => {
				const x = e.clientX;
				const y = e.clientY;
				const wrapperRect = this.wrapper.getBoundingClientRect();

				const isOverWrapper =
					x >= wrapperRect.left &&
					x <= wrapperRect.right &&
					y >= wrapperRect.top &&
					y <= wrapperRect.bottom;

				if (isOverWrapper) {
					this.lastMousePos = { x, y };

					this.showUI();
					this.clearHideTimer();
					this.scheduleHideUI();
				} else if (this.lastMousePos !== null) {

					this.lastMousePos = null;
					this.clearHideTimer();
					this.hideUI();
				}
			};

			document.addEventListener("mousemove", this._docMouseMoveHandler, true);

			this.panel.addEventListener(
				"mouseenter",
				(e) => {
					this.lastMousePos = { x: e.clientX, y: e.clientY };
					this.clearHideTimer();
					this.showUI();
				},
				true,
			);

			this.panel.addEventListener(
				"mouseleave",
				(e) => {
					this.lastMousePos = { x: e.clientX, y: e.clientY };
					this.scheduleHideUI();
				},
				true,
			);

			document.addEventListener("fullscreenchange", () => {

				this.lastMousePos = null;

				this.handleMouseActivity();
				this.checkLayoutSpace();

				setTimeout(() => {
					if (!this.isMouseOverPanel() && !this.isKeyboardFocusActive()) {
						this.hideUI();
						this.scheduleHideUI();
					}
				}, CONFIG.UI_HIDE_DELAY + 100);
			});

			this.video.addEventListener("leavepictureinpicture", () => {
				this.video.pause();
			});

			window.addEventListener("resize", () => this.checkLayoutSpace());
			if (window.ResizeObserver) {
				this.resizeObserver = new ResizeObserver(() => this.checkLayoutSpace());
				this.resizeObserver.observe(this.wrapper);
			}

			State.subscribe(() => this.applyState());

			const sliderPopups = this.panel.querySelectorAll(
				`.$PLATFORM.classPrefix}-slider-popup`,
			);
			sliderPopups.forEach((popup) => {
				popup.addEventListener("mouseenter", () => {
					this.clearHideTimer();
				});
				popup.addEventListener("mouseleave", () => {

					if (this.isMouseOverWrapper()) {
						this.scheduleHideUI();
					} else {
						this.hideUI();
					}
				});
			});

			const sliders = this.panel.querySelectorAll('input[type="range"]');
			sliders.forEach((slider) => {
				slider.addEventListener("mousedown", () => {
					this.clearHideTimer();
				});
			});
		}

		togglePlay() {
			if (this.video.paused) {
				this.video.play().catch(() => {});
			} else {
				this.video.pause();
			}
		}

		updatePlayButton() {
			const isPaused = this.video.paused;
			this.playBtn.innerHTML = isPaused ? ICONS.play : ICONS.pause;
			this.wrapper.classList.toggle("video-paused", isPaused);
			if (isPaused) {
				this.showUI();
				if (CONFIG.UI_HIDE_WHEN_PAUSED) this.scheduleHideUI();
			}
		}

		toggleMute() {
			const newMuted = !this.video.muted;
			this.video._userMuteIntent = newMuted;
			this.video.muted = newMuted;
			State.set("muted", newMuted);
			this.showHint(newMuted ? "🔇" : "🔊");
			this.updateVolumeUI();
		}

		applyVolume() {
			const vol = State.get("volume");
			this.video.volume = vol;
			this.updateVolumeUI();
		}

		updateVolumeUI() {
			const muted = this.video.muted;
			const vol = this.video._volumeSetupComplete
				? this.video.volume
				: State.get("volume");
			this.muteBtn.innerHTML =
				muted || vol === 0 ? ICONS.volumeMuted : ICONS.volumeHigh;
			this.volumeSlider.value = vol;
			this.volumeValue.textContent = `$Math.round(vol * 100)}%`;
			if (this.autoUnmuteCheckbox) {
				this.autoUnmuteCheckbox.checked = State.get("autoUnmute");
			}
			if (this.video._volumeSetupComplete) {
				State.data.volume = vol;
			}
		}

		updateSpeedUI() {
			const stateSpeed = State.get("speed");
			const rawSpeed = this.video._speedSetupComplete
				? this.video.playbackRate
				: stateSpeed;
			const speed =
				Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : stateSpeed;
			const closestSpeed = CONFIG.SPEEDS.reduce((prev, curr) =>
				Math.abs(curr - speed) < Math.abs(prev - speed) ? curr : prev,
			);
			const idx = CONFIG.SPEEDS.indexOf(closestSpeed);
			this.speedBtn.textContent = `$closestSpeed}x`;
			this.speedValue.textContent = `$closestSpeed}x`;
			this.speedSlider.value = String(
				idx >= 0 ? idx : CONFIG.SPEEDS.indexOf(1),
			);
			if (
				this.video._speedSetupComplete &&
				Number.isFinite(rawSpeed) &&
				rawSpeed > 0
			) {
				State.data.speed = speed;
			}
		}

		checkLayoutSpace() {
			const wrapperWidth = this.wrapper.offsetWidth;
			const useStacked = wrapperWidth < CONFIG.MIN_PANEL_WIDTH_FOR_INLINE;
			this.panel.classList.toggle("stacked", useStacked);
			this.wrapper.classList.toggle("stacked", useStacked);
		}

		updateTime() {
			if (!this.video.duration) return;
			const current = this.video.currentTime;
			const duration = this.video.duration;
			this.timeCurrent.textContent = Utils.formatTime(current);
			this.timeDuration.textContent = Utils.formatTime(duration);
			if (!this.isDragging) {
				const percent = (current / duration) * 100;
				this.progress.style.width = `$percent}%`;
			}
		}

		startSeek(e) {
			if (this._seekCleanup) {
				this._seekCleanup();
			}

			this.isDragging = true;
			this.clearHideTimer();
			this.showUI();
			this.seek(e);

			const onMove = (event) => {
				if ("buttons" in event && event.buttons === 0) {
					cleanup();
					return;
				}
				this.seek(event);
			};

			const onUp = () => {
				cleanup();
			};

			const onVisibilityChange = () => {
				if (document.visibilityState !== "visible") {
					cleanup();
				}
			};

			const cleanup = () => {
				this.isDragging = false;
				window.removeEventListener("mousemove", onMove, true);
				window.removeEventListener("mouseup", onUp, true);
				window.removeEventListener("blur", onUp, true);
				document.removeEventListener(
					"visibilitychange",
					onVisibilityChange,
					true,
				);
				this._seekCleanup = null;
			};

			this._seekCleanup = cleanup;

			window.addEventListener("mousemove", onMove, true);
			window.addEventListener("mouseup", onUp, true);
			window.addEventListener("blur", onUp, true);
			document.addEventListener("visibilitychange", onVisibilityChange, true);
		}

		seek(e) {
			const rect = this.timeline.getBoundingClientRect();
			const percent = Utils.clamp((e.clientX - rect.left) / rect.width, 0, 1);
			const time = percent * this.video.duration;
			this.video.currentTime = time;
			this.progress.style.width = `$percent * 100}%`;
			this.tooltip.textContent = Utils.formatTime(time);
			this.tooltip.style.left = `$percent * 100}%`;
			this.showHint(Utils.formatTime(time));
		}

		updateTooltip(e) {
			if (this.isDragging) return;
			const rect = this.timeline.getBoundingClientRect();
			const percent = Utils.clamp((e.clientX - rect.left) / rect.width, 0, 1);
			const time = percent * this.video.duration;
			this.tooltip.textContent = Utils.formatTime(time);
			this.tooltip.style.left = `$percent * 100}%`;
		}

		toggleFullscreen() {
			if (document.fullscreenElement) {
				document.exitFullscreen();
				this.fsBtn.innerHTML = ICONS.fullscreen;
			} else {
				(
					this.wrapper.requestFullscreen ||
					this.wrapper.webkitRequestFullscreen ||
					this.video.webkitEnterFullscreen
				)?.call(this.wrapper);
				this.fsBtn.innerHTML = ICONS.exitFullscreen;
			}
			setTimeout(() => this.handleMouseActivity(), 100);
		}

		togglePiP() {
			if (document.pictureInPictureElement) {
				document.exitPictureInPicture().catch(() => {});
			} else if (this.video.requestPictureInPicture) {
				this.video.requestPictureInPicture().catch(() => {});
			}
		}

		handleMouseActivity() {
			if (!this.wrapper) return;
			this.showUI();
			this.clearHideTimer();
			this.scheduleHideUI();
		}

		isMouseOverInteractiveElement() {
			if (!this.lastMousePos) return false;

			const { x, y } = this.lastMousePos;
			const elementAtPoint = document.elementFromPoint(x, y);

			if (!elementAtPoint) return false;

			if (!this.panel.contains(elementAtPoint)) return false;

			const p = PLATFORM.classPrefix;
			const interactiveSelectors = [
				`.$p}-btn`,
				`.$p}-speed-btn`,
				`.$p}-timeline`,
				`.$p}-slider-popup`,
				`.$p}-range-vertical`,
				`.$p}-auto-unmute-wrap`,
				`.$p}-auto-unmute-checkbox`,
				'input[type="range"]',
				'input[type="checkbox"]',
				"button",
				"a",
			];

			return interactiveSelectors.some(
				(selector) =>
					elementAtPoint.matches(selector) || elementAtPoint.closest(selector),
			);
		}

		clearHideTimer() {
			if (this.mouseActivityTimeout) {
				clearTimeout(this.mouseActivityTimeout);
				this.mouseActivityTimeout = null;
			}
		}

		isMouseOverPanel() {
			if (!this.panel || !this.lastMousePos) return false;
			const rect = this.panel.getBoundingClientRect();
			const { x, y } = this.lastMousePos;
			return (
				x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
			);
		}

		isMouseOverWrapper() {
			if (!this.wrapper || !this.lastMousePos) return false;
			const rect = this.wrapper.getBoundingClientRect();
			const { x, y } = this.lastMousePos;
			return (
				x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
			);
		}

		isKeyboardFocusActive() {
			const active = document.activeElement;
			if (!active || !(active instanceof Element)) return false;
			if (!this.panel || !this.panel.contains(active)) return false;

			try {
				return active.matches(":focus-visible");
			} catch (_) {
				return false;
			}
		}

		scheduleHideUI() {
			this.clearHideTimer();

			this.mouseActivityTimeout = setTimeout(() => {

				if (this.isDragging) {

					return;
				}

				if (this.isKeyboardFocusActive()) {
					this.scheduleHideUI();
					return;
				}

				if (this.isMouseOverPanel()) {
					this.scheduleHideUI();
					return;
				}

				this.hideUI();
			}, CONFIG.UI_HIDE_DELAY);
		}

		hideUI() {
			if (!this.wrapper) return;

			const active = document.activeElement;
			if (
				active &&
				active instanceof HTMLElement &&
				this.panel &&
				this.panel.contains(active)
			) {
				let focusVisible = false;
				try {
					focusVisible = active.matches(":focus-visible");
				} catch (_) {}
				if (!focusVisible) {
					active.blur();
				}
			}

			this.clearHideTimer();

			this.wrapper.classList.remove("ui-visible");
		}

		showUI() {
			const wrapper = this.wrapper;
			wrapper.classList.add("ui-visible");
		}

		showHint(text) {
			this.hint.textContent = text;
			this.hint.classList.add("show");
			clearTimeout(this.hintTimeout);
			this.hintTimeout = setTimeout(() => {
				this.hint.classList.remove("show");
			}, 800);
		}

		applyState() {
			const state = State.data;
			this.video.volume = state.volume;
			this.video.playbackRate = state.speed;

			if (this.video._userMuteIntent !== null) {
				this.video.muted = this.video._userMuteIntent;
			} else if (state.autoUnmute && this.video._autoUnmuteApplied) {
				this.video.muted = false;
			}

			this.volumeSlider.value = state.volume;
			this.speedSlider.value = String(CONFIG.SPEEDS.indexOf(state.speed));
			this.updateVolumeUI();
			this.updateSpeedUI();
			this.updatePlayButton();
			this.checkLayoutSpace();
		}

		seekRelative(seconds) {
			const newTime = Utils.clamp(
				this.video.currentTime + seconds,
				0,
				this.video.duration,
			);
			this.video.currentTime = newTime;
			this.showHint(`$seconds > 0 ? "+" : ""}$seconds}s`);
		}

		seekFrame(frames) {
			const frameTime = frames * CONFIG.FRAME_TIME;
			this.video.pause();
			this.video.currentTime = Utils.clamp(
				this.video.currentTime + frameTime,
				0,
				this.video.duration,
			);
		}

		adjustVolume(delta) {
			const newVol = Utils.clamp(State.get("volume") + delta, 0, 1);
			State.set("volume", newVol);
			if (newVol > 0) State.set("muted", false);
			this.applyVolume();
			this.showHint(`$Math.round(newVol * 100)}%`);
		}

		cycleSpeed(direction) {
			const speeds = CONFIG.SPEEDS;
			const current = State.get("speed");
			const idx = speeds.indexOf(current);
			const newIdx = Utils.clamp(idx + direction, 0, speeds.length - 1);
			const newSpeed = speeds[newIdx];
			State.set("speed", newSpeed);
			this.video.playbackRate = newSpeed;
			this.updateSpeedUI();
			this.showHint(`$newSpeed}x`);
		}

		setSpeedTemporary(speed) {
			this.originalSpeed = this.video.playbackRate;
			this.video.playbackRate = speed;
			this.showHint(`$speed}x ⏩`);
		}

		restoreSpeed() {
			if (this.originalSpeed !== undefined) {
				this.video.playbackRate = this.originalSpeed;
				this.showHint(`$this.originalSpeed}x`);
				this.originalSpeed = undefined;
			}
		}

		destroy() {
			this.clearHideTimer();
			clearTimeout(this.hintTimeout);

			if (this._seekCleanup) {
				this._seekCleanup();
			}

			if (this._docMouseMoveHandler) {
				document.removeEventListener(
					"mousemove",
					this._docMouseMoveHandler,
					true,
				);
			}

			if (this.resizeObserver) {
				this.resizeObserver.disconnect();
			}

			if (this.panel?.parentNode) {
				this.panel.remove();
			}
			if (this.hint?.parentNode) {
				this.hint.remove();
			}

			if (this.wrapper) {
				this.wrapper.classList.remove(
					`$PLATFORM.classPrefix}-wrapper`,
					"video-paused",
					"ui-visible",
					"stacked",
				);
			}
		}
	}

	const KeyboardHandler = {
		longPressTimer: null,
		isLongPress: false,

		init() {
			document.addEventListener("keydown", (e) => this.handleKeyDown(e), {
				capture: true,
			});
			document.addEventListener("keyup", (e) => this.handleKeyUp(e), {
				capture: true,
			});
		},

		handleKeyDown(e) {
			if (Utils.isInputFocused()) return;

			const video = Utils.getClosestVideo();
			if (!video) return;

			const ui = this.findUIForVideo(video);
			if (!ui) return;

			ui.handleMouseActivity();

			const key = e.key.toLowerCase();
			let handled = true;

			switch (key) {
				case " ":
				case "k":
					e.preventDefault();
					ui.togglePlay();
					break;

				case "arrowleft":
				case "j":
					e.preventDefault();
					ui.seekRelative(-CONFIG.SEEK_TIME);
					break;

				case "arrowright":
					e.preventDefault();
					if (!this.longPressTimer && !this.isLongPress) {
						this.longPressTimer = setTimeout(() => {
							this.isLongPress = true;
							ui.setSpeedTemporary(CONFIG.LONG_PRESS_SPEED);
						}, CONFIG.LONG_PRESS_DELAY);
					}
					break;

				case "l":
					e.preventDefault();
					ui.seekRelative(CONFIG.SEEK_TIME);
					break;

				case ",":
					e.preventDefault();
					ui.seekFrame(-1);
					break;

				case ".":
					e.preventDefault();
					ui.seekFrame(1);
					break;

				case "arrowup":
					e.preventDefault();
					ui.adjustVolume(0.05);
					break;

				case "arrowdown":
					e.preventDefault();
					ui.adjustVolume(-0.05);
					break;

				case "m":
					e.preventDefault();
					ui.toggleMute();
					break;

				case "<":
				case "[":
					e.preventDefault();
					ui.cycleSpeed(-1);
					break;

				case ">":
				case "]":
					e.preventDefault();
					ui.cycleSpeed(1);
					break;

				case "f":
					e.preventDefault();
					ui.toggleFullscreen();
					break;

				case "p":
					e.preventDefault();
					ui.togglePiP();
					break;

				case "0":
				case "1":
				case "2":
				case "3":
				case "4":
				case "5":
				case "6":
				case "7":
				case "8":
				case "9": {
					e.preventDefault();
					const percent = parseInt(key, 10) * 10;
					video.currentTime = (percent / 100) * video.duration;
					ui.showHint(`$percent}%`);
					break;
				}

				case "home":
					e.preventDefault();
					video.currentTime = 0;
					ui.showHint("Start");
					break;

				case "end":
					e.preventDefault();
					video.currentTime = video.duration;
					ui.showHint("End");
					break;

				default:
					handled = false;
			}

			if (handled) {
				e.stopPropagation();
				e.stopImmediatePropagation();
			}
		},

		handleKeyUp(e) {
			if (Utils.isInputFocused()) return;

			const key = e.key.toLowerCase();

			if (key === "arrowright") {
				if (this.longPressTimer) {
					clearTimeout(this.longPressTimer);
					this.longPressTimer = null;
				}

				const video = Utils.getClosestVideo();
				const ui = video ? this.findUIForVideo(video) : null;

				if (ui) ui.handleMouseActivity();

				if (this.isLongPress) {
					this.isLongPress = false;
					if (ui) ui.restoreSpeed();
				} else {
					if (ui) ui.seekRelative(CONFIG.SEEK_TIME);
				}

				e.preventDefault();
				e.stopPropagation();
			}
		},

		findUIForVideo(video) {
			return videoUIMap.get(video);
		},
	};

	const videoUIMap = new WeakMap();
	const processedVideos = new WeakSet();

	const MainController = {
		observer: null,
		_pollInterval: null,

		init() {
			State.init();
			AudioEngine.init();
			Styles.inject();
			TooltipManager.init();
			KeyboardHandler.init();

			this.processAllVideos();

			this.observer = new MutationObserver((mutations) => {
				let hasVideo = false;
				for (const m of mutations) {
					for (const node of m.addedNodes) {
						if (node.nodeName === "VIDEO") { hasVideo = true; break; }
						if (node.querySelectorAll) {
							if (node.querySelectorAll("video").length) { hasVideo = true; break; }
						}
					}
					if (hasVideo) break;
				}

				this.processAllVideos();
			});

			const startObserver = () => {
				this.observer.observe(document.body, {
					childList: true,
					subtree: true,
				});
			};

			if (document.body) {
				startObserver();
			} else {
				const bodyWait = setInterval(() => {
					if (document.body) {
						clearInterval(bodyWait);
						startObserver();
						this.processAllVideos();
					}
				}, 50);
			}

			this._pollInterval = setInterval(
				() => this.processAllVideos(),
				CONFIG.POLL_INTERVAL,
			);

			document.addEventListener("visibilitychange", () => {
				if (document.visibilityState === "visible") {
					document.querySelectorAll("video").forEach((v) => {
						v.volume = State.get("volume");
						v.playbackRate = State.get("speed");
					});
				}
			});
		},

		processAllVideos() {
			if (!isFacebookInjectionAllowed()) return;
			const videos = document.querySelectorAll("video");
			videos.forEach((video) => {
				this.processVideo(video);
			});
		},

		destroyAll() {

			document.querySelectorAll("video").forEach((video) => {
				const ui = videoUIMap.get(video);
				if (ui) {
					ui.destroy();
					videoUIMap.delete(video);
				}
				processedVideos.delete(video);
			});

			document
				.querySelectorAll(
					`.$PLATFORM.classPrefix}-panel, ` +
					`.$PLATFORM.classPrefix}-hint, ` +
					`.$PLATFORM.classPrefix}-tooltip`
				)
				.forEach((el) => el.remove());

			document
				.querySelectorAll(`.$PLATFORM.classPrefix}-wrapper`)
				.forEach((el) => {
					el.classList.remove(
						`$PLATFORM.classPrefix}-wrapper`,
						"video-paused",
						"ui-visible",
						"stacked",
					);
				});

			document.querySelectorAll("[data-video-id]").forEach((el) => {
				if (el.style.position === "relative") {
					el.style.removeProperty("position");
				}
			});
		},

		processVideo(video, retryCount = 0) {

			if (!isFacebookInjectionAllowed()) return;

			if (processedVideos.has(video)) return;

			const rect = video.getBoundingClientRect();
			const hasSize =
				rect.width >= CONFIG.MIN_VIDEO_WIDTH &&
				rect.height >= CONFIG.MIN_VIDEO_HEIGHT;

			if (!hasSize) {
				if (retryCount >= CONFIG.ZERO_RECT_RETRIES) return;
				setTimeout(() => {
					if (document.contains(video)) {
						this.processVideo(video, retryCount + 1);
					}
				}, CONFIG.ZERO_RECT_RETRY_DELAY);
				return;
			}

			const wrapper = PLATFORM.findVideoWrapper(video);
			if (!wrapper) return;

			if (wrapper.querySelector(`.$PLATFORM.classPrefix}-panel`)) return;

			processedVideos.add(video);

			const wPos = getComputedStyle(wrapper).position;
			if (wPos === "static") {
				wrapper.style.position = "relative";
			}

			const wRect = wrapper.getBoundingClientRect();
			if (wRect.width < CONFIG.MIN_VIDEO_WIDTH || wRect.height < CONFIG.MIN_VIDEO_HEIGHT) {
				const vRect = video.getBoundingClientRect();
				if (vRect.width > 0 && vRect.height > 0) {
					wrapper.style.width = wrapper.style.width || `$vRect.width}px`;
					wrapper.style.height = wrapper.style.height || `$vRect.height}px`;
				}
			}

			State.applyToVideo(video);

			const ui = new VideoControlsUI(video, wrapper);
			videoUIMap.set(video, ui);

			const cleanupObserver = new MutationObserver(() => {
				if (!document.contains(video)) {
					ui.destroy();
					videoUIMap.delete(video);
					processedVideos.delete(video);
					cleanupObserver.disconnect();
				}
			});

			if (document.body) {
				cleanupObserver.observe(document.body, {
					childList: true,
					subtree: true,
				});
			}
		},
	};

	document.addEventListener(
		"dblclick",
		(e) => {
			const wrapper = e.target.closest(`.$PLATFORM.classPrefix}-wrapper`);
			if (!wrapper) return;

			if (
				e.target.closest(`.$PLATFORM.classPrefix}-panel`) ||
				e.target.closest("button") ||
				e.target.closest('[role="button"]')
			) {
				return;
			}

			const video = wrapper.querySelector("video");
			if (video) {
				const ui = videoUIMap.get(video);
				if (ui) {
					e.preventDefault();
					e.stopPropagation();
					ui.toggleFullscreen();
				}
			}
		},
		{ capture: true },
	);

	document.addEventListener(
		"wheel",
		(e) => {
			const wrapper = e.target.closest(`.$PLATFORM.classPrefix}-wrapper`);
			if (wrapper && e.shiftKey) {
				const video = wrapper.querySelector("video");
				if (video) {
					e.preventDefault();
					const ui = videoUIMap.get(video);
					if (ui) {
						ui.adjustVolume(e.deltaY > 0 ? -0.05 : 0.05);
					}
				}
			}
		},
		{ passive: false },
	);

	let _earlyInitDone = false;

	const _earlyObserver = new MutationObserver(() => {

		if (!document.head || !document.body) return;
		if (_earlyInitDone) return;
		_earlyInitDone = true;

		_earlyObserver.disconnect();
		MainController.init();
	});

	_earlyObserver.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});

	if (document.head && document.body && !_earlyInitDone) {
		_earlyInitDone = true;
		_earlyObserver.disconnect();
		MainController.init();
	}

	document.addEventListener("DOMContentLoaded", () => {
		if (!_earlyInitDone) {
			_earlyInitDone = true;
			_earlyObserver.disconnect();
			MainController.init();
		} else {

			MainController.processAllVideos();
		}
	});

	window.addEventListener("load", () => {
		MainController.processAllVideos();
		setTimeout(() => MainController.processAllVideos(), 1000);
		setTimeout(() => MainController.processAllVideos(), 3000);
	});

	(function patchHistory() {
		const _push = history.pushState.bind(history);
		const _replace = history.replaceState.bind(history);

		const onNavigate = () => {
			if (isFacebookInjectionAllowed()) {

				setTimeout(() => MainController.processAllVideos(), 100);
				setTimeout(() => MainController.processAllVideos(), 600);
				setTimeout(() => MainController.processAllVideos(), 2000);
			} else {

				MainController.destroyAll();
			}
		};

		history.pushState = function (...args) {
			_push(...args);
			onNavigate();
		};

		history.replaceState = function (...args) {
			_replace(...args);
			onNavigate();
		};

		window.addEventListener("popstate", onNavigate);
	})();
})();

(function () {
    'use strict';

    const disableNewUrlFetchMethod = false;
    const prefetchAndAttachLink = false;
    const hoverToFetchAndAttachLink = true;
    const replaceJpegWithJpg = false;

    const postFilenameTemplate = '%id%-%datetime%-%medianame%';
    const storyFilenameTemplate = postFilenameTemplate;

    const datetimeTemplate = '%y%%m%%d%_%H%%M%%S%';

    const postIdPattern = /^\/p\/([^/]+)\
    const postUrlPattern = /instagram\.com\/p\/[\w-]+\

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
                    posterName = posterName.getAttribute('href').replace(/\
                    let postId = findPostId(articleNode);
                    let filename = filenameFormat(postFilenameTemplate, posterName, datetime, mediaName, postId, mediaIndex);
                    downloadResource(url, filename);
                } else {

                    openResource(url);
                }
            }
        } catch (e) {
            console.log(`Uncatched in postOnClicked(): $e}\n$e.stack}`);
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
                const listElements = [...articleNode.querySelectorAll(`:scope > div > div:nth-child($postView ? 1 : 2}) > div > div:nth-child(1) ul li[style*="translateX"]`)];
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

    let infoCache = {};
    let mediaIdCache = {};
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
                // method 1: extract from url.
                function method1() {
                    let href = window.location.href;
                    let match = href.match(/www.instagram.com\/stories\/[^\/]+\/(\d+)/);
                    if (!href.includes('highlights') && match) return match[1];
                }

                // method 3
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
                // multi-media post
                return getImgOrVedioUrl(infoJson.items[0].carousel_media[mediaIdx]);
            } else {
                // single media post
                return getImgOrVedioUrl(infoJson.items[0]);
            }
        } catch (e) {
            console.log(`Uncatched in getUrlFromInfoApi(): ${e}\n${e.stack}`);
            return null;
        }
    }

    function findPostName(articleNode) {
        // this grabs the username link that is visually in the author's post comment below the media
        // 'article section' includes the likes section and comment box
        // '+ * a' pulls the first element after the section that contains a link (comment box doesn't)
        // '[href^="/"][href$="/"]' requires the href attribute to begin and end with a slash to match a username
        let imgNoCanvas = articleNode.querySelector('article section + * a[href^="/"][href$="/"]');
        if (imgNoCanvas) {
            return imgNoCanvas;
        }

        // videos are handled differently
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
            // first H2 with a direction set
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

    // ================================
    // ====   Story & Highlight    ====
    // ================================
    async function storyOnMouseIn(target) {
        let sectionNode = storyGetSectionNode(target);
        let url = await storyGetUrl(target, sectionNode);
        target.setAttribute('href', url);
    }

    async function storyOnClicked(target) {
        // extract url from target story and download or open it
        let sectionNode = storyGetSectionNode(target);
        let url = await storyGetUrl(target, sectionNode);
        const posterUrlPat = /\/stories\/(.*)\/.*\//
        // download or open media url
        if (target.getAttribute('class').includes('download-btn')) {
            let mediaName = url.split('?')[0].split('\\').pop().split('/').pop();
            mediaName = mediaName.substring(0, mediaName.lastIndexOf('.'));
            let datetime = new Date(sectionNode.querySelector('time').getAttribute('datetime'));
            let posterName = "unkown";
            // method 1
            const posterNameHeader = sectionNode.querySelector('header a');
            if (posterNameHeader) {
                posterName = posterNameHeader.getAttribute('href').replace(/\//g, '');
            }

            // method 2
            if (posterName === "unkown") {
                const match = window.location.pathname.match(posterUrlPat);
                if (match) {
                    posterName = match[1];
                }
            }
            let filename = filenameFormat(storyFilenameTemplate, posterName, datetime, mediaName);
            downloadResource(url, filename);
        } else {
            // open url in new tab
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
        // open url in new tab
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

    // Current blob size limit is around 500MB for browsers
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
})();

// --- AlexRabbit: remove IG copy/click blockers (no external @require) ---
(function () {
    'use strict';
    const BLOCK_SELECTORS = ['._aagw', 'motion.div._aagw', 'motion.div[class*="_aagw"]'];
    const scrub = () => {
        for (const sel of BLOCK_SELECTORS) {
            document.querySelectorAll(sel).forEach((el) => el.remove());
        }
        document.querySelectorAll('motion.div').forEach((el) => {
            const cls = el.getAttribute('class') || '';
            if (cls.includes('_aagw')) el.remove();
        });
        document.querySelectorAll('motion.div[data-testid]').forEach((el) => {
            if ((el.getAttribute('class') || '').includes('_aagw')) el.remove();
        });
    };
    scrub();
    new MutationObserver(scrub).observe(document.documentElement, { childList: true, subtree: true });
})();


