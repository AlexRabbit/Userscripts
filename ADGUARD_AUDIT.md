# AdGuard userscript audit and SimpCity fix

## Confirmed cause

SimpCity_Links_Rabbit 1.1.0 contains an invalid URL regular expression: its literal slashes are not escaped. JavaScript cannot parse the file, so none of it runs and neither export button appears. The supplied `/threads/.../page-10` URL matches its metadata. This failure occurs before AdGuard API calls or website selectors matter.

Version 1.1.1 fixes the regular expression. No special AdGuard startup call is required.

## Changelog — 1.1.1

- Fixed the parse error that prevented the entire SimpCity exporter from starting.
- Fixed full exports opened on later pages skipping page 1.
- Preserved encoded query parameters and tolerated malformed percent escapes in links.
- Included plain-text URLs when parsing fetched HTML and lazy-loaded media sources.
- Saved TXT before DLC creation so an unavailable dependency or DLC service cannot discard the TXT export.
- Used browser Blob downloads without relying on `GM_download`, which is absent from AdGuard's documented supported-function list.
- Removed unused storage grants and added 30-second timeouts to privileged requests.
- Corrected README advice suggesting that scripts should avoid their required grants.
- Added six offline regression checks, including syntax checks for every script.

## Install the local fix now

1. Open AdGuard's standalone application, then **Settings → Extensions**.
2. Disable the old **SimpCity_Links_Rabbit** entry to avoid duplicate versions.
3. Choose **Add extension → Import from file or URL** and select the local `SimpCity_Links_Rabbit.js` beside this document. Menu wording may vary by platform/version.
4. Confirm the installed version is **1.1.1** and enable it.
5. Reload an accessible, logged-in SimpCity thread. Look at the bottom-right for **Export (+new)** and **Full export**. There is no separate menu to open.
6. Try **Full export**. TXT should download even if DLC creation fails. If the browser blocks multiple downloads, allow downloads for this site.

The GitHub raw install URL still serves the old version until these changes are uploaded. This work has not pushed or changed the repository remotely. The local fix retains the existing upstream update URL.

## If no buttons appear after installing 1.1.1

- Check that AdGuard's Extensions feature and this script are enabled and that the browser/site is filtered.
- Check HTTPS filtering for this site in AdGuard. Avoid disabling protections globally.
- Make sure the address is `https://simpcity.cr/threads/...`; other domains are not in the match list.
- Complete any normal login or site challenge and reload the thread.
- Temporarily disable Forum_Rabbit to isolate an interaction between the two scripts.
- In browser developer tools, check whether `document.getElementById('sclr-export-btn')` returns a button and capture the first script error if it does not.

AdGuard documents userscript management for its standalone Windows, Mac, and Android apps. Browser extension or DNS filtering alone should not be assumed to provide the same feature.

## Other scripts: evidence and limits

All seven repository scripts were syntax-checked; only SimpCity_Links_Rabbit failed before the fix. The other six passing does not establish live functionality.

- Global_Rabbit intentionally has no menu; it only intercepts context-menu events.
- Forum_Rabbit has a DOMContentLoaded-only initialization section. If injected after that event, that section can be missed. It also depends on external libraries and several GM APIs. This is a follow-up candidate, not a verified cause of the user's current failure.
- Paywall_Rabbit also has DOMContentLoaded-only branches and clears site localStorage on many matched sites. Its blanket compatibility claim needs live, site-specific review. No paywall or storage behavior was changed in this fix.
- Instagram, Telegram, and TikTok require separate live feature checks; passing syntax does not validate current selectors, downloads, or providers.

## Verification

Run `node --test tests/userscripts.test.cjs` from the repository folder with Node.js installed.

Six tests passed: all-script parsing; immediate menu insertion without duplicates; deferred startup; encoded/malformed link handling; page-10 full scan including page 1; TXT survival and button recovery on DLC failure.

The tests use controlled DOM/network stubs and synthetic links. They do not validate real browser rendering, AdGuard injection, website HTML selectors, authentication, external providers, or DLC acceptance by JDownloader. The supplied live thread could not be accessed through the web tool. No live media or user data was downloaded.

## Remaining limitations and next ideas

- Verify the fixed script inside the user's actual AdGuard/browser setup.
- Verify DLC creation and import in JDownloader; the legacy service still uses HTTP and its protocol was not redesigned or certified here.
- Decouple the CryptoJS dependency from startup so a failed CDN load cannot prevent the menu.
- Add browser-based fixture tests with real XenForo HTML and a download-capable browser.
- Reject login/challenge responses during scans instead of interpreting them as empty pages.
- Add cancellation, retry/backoff, and a current-page-only export.
- Add a TXT-only button to avoid waiting for Turbo resolution and DLC requests.
- Add clearer diagnostics for permissions, dependencies, storage limits, and unsupported hosts.
- Review cached state integrity and storage quota handling.
- Validate both SimpCity scripts together and fix Forum_Rabbit's late initialization.
- Audit Telegram and TikTok against their current pages and APIs.
- Add automated syntax checks on pull requests to prevent another broken release.

## Sources

- [Original SimpCity script](https://raw.githubusercontent.com/AlexRabbit/Userscripts/main/SimpCity_Links_Rabbit.js)
- [AdGuard userscripts and compatibility](https://adguard.com/kb/general/extensions/)

Applied task-relevant engineering, audit, verification, and reporting guidance from the user's local SystemPrompts.html. Its unrelated application, Telegram, deployment, packaging, and security-engagement templates do not apply to this userscript repair.
