/**
 * AlexRabbit Userscripts — AdGuard / Tampermonkey bootstrap
 * Include at the top of the script body (after metadata) when using GM_* APIs.
 * Uses native GM_* when the host provides them; falls back to localStorage.
 */
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
            /* quota / private mode */
        }
    };

    globalThis.GM_deleteValue = function (key) {
        try {
            localStorage.removeItem(PREFIX + key);
        } catch {
            /* ignore */
        }
    };
})();
