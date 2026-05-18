import fs from 'fs';

const src = fs.readFileSync('_sources/ig-download.js', 'utf8');
const m = src.match(/\(function \(\) \{[\s\S]*\}\)\(\);/);
if (!m) throw new Error('no iife');
let body = m[0];

const rcBlock = `
    const rcStyle = document.createElement('style');
    rcStyle.id = 'ar-ig-rightclick';
    rcStyle.textContent = 'motion.div._aagw,div._aagw,motion.div[class*="_aagw"],motion.div[class*="_aagw"]{pointer-events:none!important}';
    (document.head || document.documentElement).appendChild(rcStyle);
    setInterval(() => {
        document.querySelectorAll('motion.div._aagw, div._aagw').forEach((el) => {
            try {
                el.remove();
            } catch {}
        });
    }, 800);
`;

body = body.replace("'use strict';", `'use strict';${rcBlock}`);

const injectModern = `
        if (isPostPage() && document.getElementsByClassName('custom-btn').length === 0) {
            const saveBtn = document.querySelector('button[aria-label="Save"], button[aria-label^="Save"]');
            if (saveBtn && saveBtn.parentElement) {
                addCustomBtn(saveBtn, iconColor, (node, btn) => {
                    node.parentElement.insertBefore(btn, saveBtn);
                });
            }
        }
`;

body = body.replace('preUrl = curUrl;', `${injectModern}        preUrl = curUrl;`);

body = body.replace(
    "console.log('Err: not find media at handle post single');",
    "const mainImg = document.querySelector('main img[src], article img[src]'); if (mainImg) url = mainImg.getAttribute('src'); else console.log('Err: not find media at handle post single');"
);

body = body.replace(
    'function findPostId(articleNode) {',
    `function findPostId(articleNode) {
        const pm = location.pathname.match(postIdPattern);
        if (pm) return pm[1];`
);

body = body.replace('if (url.length > 0)', 'if (url && url.length > 0)');

const saveSel =
    "const savePostSelector = 'article *:not(li)>*>*>*>div:not([class])>div[role=\"button\"]:not([style]):not([tabindex=\"-1\"]), article *:not(li)>*>*>*>div:not([class])>motion.div[role=\"button\"]:not([style]):not([tabindex=\"-1\"])';";
body = body.replace(
    "const savePostSelector = 'article *:not(li)>*>*>*>motion.div:not([class])>motion.div[role=\"button\"]:not([style]):not([tabindex=\"-1\"])';",
    saveSel
);
body = body.replace(
    "const savePostSelector = 'article *:not(li)>*>*>*>motion.div:not([class])>motion.div[role=\"button\"]:not([style]):not([tabindex=\"-1\"])';",
    saveSel
);
if (!body.includes('motion.div[role="button"]')) {
    body = body.replace(
        "const savePostSelector = 'article *:not(li)>*>*>*>div:not([class])>div[role=\"button\"]:not([style]):not([tabindex=\"-1\"])';",
        saveSel
    );
}

fs.writeFileSync('lib/instagram-download.js', body);
console.log('wrote lib/instagram-download.js', body.length);
