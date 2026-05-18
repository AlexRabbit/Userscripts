
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
