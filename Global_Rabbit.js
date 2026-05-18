// ==UserScript==
// @name         Global_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      2.0.0
// @description  Restore right-click, copy, cut, text selection, and drag on sites that block them. AdGuard-ready.
// @author       AlexRabbit (https://github.com/AlexRabbit)
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @license      MIT
// @downloadURL  https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Global_Rabbit.js
// @updateURL    https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/Global_Rabbit.js
// @supportURL   https://github.com/AlexRabbit/Userscripts/issues
// ==/UserScript==

(function () {
    'use strict';

    document.addEventListener(
        'contextmenu',
        (e) => {
            e.stopImmediatePropagation();
        },
        true
    );

    const nativePreventDefault = Event.prototype.preventDefault;
    const protectedTypes = new Set([
        'contextmenu',
        'copy',
        'cut',
        'selectstart',
        'select',
        'dragstart',
    ]);

    Event.prototype.preventDefault = function () {
        if (protectedTypes.has(this.type)) return;
        return nativePreventDefault.call(this);
    };

    function unBlockNode(node, eventName) {
        if (!node || node.nodeType !== 1) return;

        const onProp = 'on' + eventName;
        if (node[onProp]) node[onProp] = null;

        node.addEventListener(
            eventName,
            (e) => {
                for (let n = e.target; n; n = n.parentNode) {
                    if (n[onProp]) n[onProp] = null;
                }
            },
            true
        );

        if (node.shadowRoot) traverse(node.shadowRoot, eventName);
        node.childNodes.forEach((child) => traverse(child, eventName));

        if (node.tagName === 'IFRAME') {
            try {
                const doc = node.contentWindow?.document;
                if (doc) unBlockNode(doc.documentElement || doc, eventName);
            } catch {}
        }
    }

    function traverse(root, eventName) {
        if (!root) return;
        if (root.nodeType === 9) {
            unBlockNode(root.documentElement, eventName);
            return;
        }
        unBlockNode(root, eventName);
    }

    const HOOK_EVENTS = [
        'contextmenu',
        'click',
        'mousedown',
        'mouseup',
        'keydown',
        'keyup',
        'selectstart',
        'select',
        'copy',
        'cut',
        'dragstart',
    ];

    let styleEl;

    function injectSelectionStyle() {
        if (styleEl?.isConnected) return;
        styleEl = document.createElement('style');
        styleEl.id = 'ar-unlock-web-limits';
        styleEl.textContent =
            '*{-webkit-user-select:text!important;-moz-user-select:text!important;-ms-user-select:text!important;user-select:text!important;}';
        (document.documentElement || document.head || document.body)?.appendChild(styleEl);
    }

    function runUnlockPass() {
        const root = document.documentElement || document.body;
        if (!root) return;

        HOOK_EVENTS.forEach((name) => traverse(root, name));
        injectSelectionStyle();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runUnlockPass, { once: true });
    } else {
        runUnlockPass();
    }

    let debounce;
    const observer = new MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(runUnlockPass, 800);
    });

    const startObserver = () => {
        if (!document.body) return;
        observer.observe(document.body, { childList: true, subtree: true });
        runUnlockPass();
    };

    if (document.body) startObserver();
    else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
})();

/*
Credits — modified by AlexRabbit (https://github.com/AlexRabbit)
  - SN-Koarashi (5026) — Unlock Website Limit (Greasy Fork 404665)
  - naviamold1 — Fix Post Right Click (476010, Instagram overlay patterns)
*/
