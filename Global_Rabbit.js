// ==UserScript==
// @name         Global_Rabbit
// @namespace    https://github.com/AlexRabbit/Userscripts
// @version      2.1.0
// @description  Restore right-click on sites that block it, without breaking buttons or other events. AdGuard-ready.
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
        function (e) {
            e.stopImmediatePropagation();
        },
        true
    );
})();

/*
Credits — modified by AlexRabbit (https://github.com/AlexRabbit)
  - AlexRabbit — minimal contextmenu-only approach (Enable Right Click pattern)
*/
