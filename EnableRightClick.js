// ==UserScript==
// @name         Enable Right Click 
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Override right-click block on websites without breaking other functionality
// @author       https://github.com/AlexRabbit
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Only override the contextmenu event
    document.addEventListener('contextmenu', function(e) {
        e.stopImmediatePropagation();
    }, true);
})();
