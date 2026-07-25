# Code review — Google Search Customizer v1.2.20

Review of the shipped extension (`Google Search Customizer v1/`) covering correctness,
robustness, performance, privacy, and accessibility.

**All nineteen findings have been fixed.** Each has regression cover in the test suite; the
`B*` numbers below are the ones the tests and commit messages refer to.

```bash
npm run check    # lint + 447 tests
```

`tests/known-bugs.test.js` used to hold a runnable reproduction of every open finding, each
assertion pinning the *present, incorrect* behaviour so that fixing a bug turned its test
red. It is gone because nothing is left in it. If a new finding turns up, that file is worth
recreating — the convention is described in [TESTING.md](TESTING.md).

---

## Summary

The extension does one thing and does it directly: match an obfuscated Google class name,
walk a fixed number of `parentNode` steps, set `display: none`. That design is easy to read
and easy to extend, which is almost certainly why it has survived five years of Google
reshuffling its markup.

The cost of that design was that it was entirely unguarded. There was no error handling
anywhere in the hot path, so a single mis-sized parent hop took down every setting below it
in the function. Three separate copies of the default configuration had already drifted
apart.

The deeper problem was *when* and *how* the hiding happened: imperatively, at
`document_idle`, after the page had painted. Content flashed before it disappeared, and
because `display: none` was written and never cleared, a setting could not be switched off
without a reload. That has now been replaced by a generated stylesheet injected at
`document_start` and gated on classes on `<html>` — see [The CSS rework](#the-css-rework).

The popup was the last part still working the old way — thirty hand-wired controls, a
read-modify-write against a rate-limited API on every keystroke of a colour picker, and no
labels on anything. That pass is done too.

| # | Finding | Severity | Status |
|---|---|---|---|
| B1 | "Places to visit" checkbox displays a different setting's value | **High** | ✅ Fixed |
| B2 | Three copies of the default config; two keys missing from one | **High** | ✅ Fixed |
| B6 | "Remove Emojis" deletes dashes, quotes, ellipses, ™, arrows, ≤ | **High** | ✅ Fixed |
| B7 | "Remove Emojis" destroys search-term highlighting and nested links | **High** | ✅ Fixed |
| B8 | Parent walk runs off the top of the tree, aborting the rest of the run | **High** | ✅ Fixed |
| B3 | Upgrades never add new keys to an existing stored configuration | Medium | ✅ Fixed |
| B5 | `removePaddingBeforeWidgetFromTo` called with 2 of 3 arguments | Medium | ✅ Fixed |
| B9 | Turning a setting off does not restore what it hid | Medium | ✅ Fixed |
| P1 | Content script runs at `document_idle` — content flashes before removal | Medium | ✅ Fixed |
| B4 | Dead 3-argument `removeElements` containing a typo | Low | ✅ Fixed |
| B13 | Undeclared loop variables leak onto the global object | Low | ✅ Fixed |
| B18 | `#bottomads` is tinted by "Really Stand Out" but never removed | Low | ✅ Fixed |
| B12 | Colour pickers write to `storage.sync` on every `input` event | Medium | ✅ Fixed |
| B16 | Only the active tab is updated; unresolved tab throws | Medium | ✅ Fixed |
| B10 | `<all_urls>` injection + substring domain check | Low | ✅ Fixed |
| B11 | Message listener covers every Google page, not just results pages | Low | ✅ Fixed |
| B14 | Four elements share `id="adTitle"`; heading misspelled | Low | ✅ Fixed |
| B15 | No `<label>` bound to any of the 30 checkboxes | Low | ✅ Fixed |
| B17 | Every toggle costs a storage read plus a write | Low | ✅ Fixed |

---

## The CSS rework

This closed B9, P1, B5, and B18 together, because they were all consequences of the same
design rather than independent bugs.

**Before.** Each setting was a run of `querySelectorAll` calls that walked up a fixed number
of parents and wrote `style.display = 'none'` onto whatever they landed on. That ran at
`document_idle` — after the page had painted — and there was no code anywhere that removed
a `display: none` once written.

**After.** [`rules.js`](../Google%20Search%20Customizer%20v1/rules.js) holds one declarative
table of what each setting hides. `program.js` turns it into a stylesheet at
`document_start` and injects it into `<html>` before the page has a body. Every rule is
gated on a class:

```css
html.gsc-removeUrl .byrV5b { display: none !important; }
html.gsc-askWidget *:has(> * > * > * > .EN1f2d) { display: none !important; }
html.gsc-twitterWidget .ULSxyf:has(.M42dy) { display: none !important; }
```

Applying a configuration is then one `classList` toggle per setting.

The parent hops become `:has()` chains: `hops: 4` is `*:has(> * > * > * > .X)`, which matches
the element exactly four levels above the marker class. `removeElementsFromTo` — "walk up
until you find this ancestor" — becomes `.ULSxyf:has(.M42dy)` directly.

**What this bought:**

- Nothing is visible before being hidden (P1).
- Switching a setting off puts the content straight back, with no reload (B9). The popup's
  permanent red *"Please refresh the page"* banner is gone; it now appears only for
  "Remove Emojis", which rewrites text and so genuinely cannot be undone in place.
- Content Google appends during endless scroll matches the rules on arrival, so the
  `PerformanceObserver` no longer re-applies anything except the emoji pass.
- The ad container list is defined once and read by both the "remove" and "really stand out"
  branches, which is what B18 was about.
- Collapse targets are declared in the table rather than hand-called, so the arity mistake
  behind B5 has nowhere to live.

**What could not move to CSS**, and still runs as a scripted pass:

- *Emoji removal*, which edits text.
- *Collapsing the gap a hidden widget leaves behind.* That needs "the sibling before the
  element that has this descendant", and `:has()` cannot be nested. The script marks the
  element with `data-gsc-collapse="<key>"` instead and the stylesheet acts on the mark, so
  it stays reversible.
- *Hop and ancestor rules on browsers without `:has()`* — Chrome 105+ and Firefox 121+.
  Below that, those rules are left out of the generated sheet and applied by the old parent
  walk instead; plain selectors work everywhere.

**Measured in Chrome** on a synthetic 4,500-element results page, all 44 generated rules
parsed (none dropped as invalid), all 73 fixtures hidden correctly and restored correctly:

| | avg ms to toggle every setting on and off |
|---|---|
| Generated sheet, with `:has()` | 31.74 |
| Same sheet, `:has()` rules removed | 31.72 |
| 44 plain class rules (baseline) | 31.45 |

`:has()` costs nothing measurable here — the time is full-document style recalculation, which
any 44 rules would pay. A single setting toggles in 6.7 ms, and appending 100 results with
every setting enabled costs 9 ms.

---

## Fixed

### B1 — The "Places to visit" checkbox showed a different setting's value

`popup.js` read the wrong key in `setUI`:

```js
document.getElementById("placesToVisitWidgetCheckBox").checked = configuration.relatedProductsServicesWidget;
```

Copy-paste from the line above. Every time the popup opened, the "Places to visit" box
rendered the state of "Find related products & services".

The user-visible failure was worse than a cosmetic mismatch. A user who had enabled the
feature saw an unchecked box, clicked it to enable what was already enabled, and the
`change` handler wrote `true` — which it already was, so the setting appeared stuck. When
the two settings differed the other way, the click silently turned off a feature they meant
to turn on.

**Fixed:** reads `configuration.placesToVisitWidget`.

Regression cover in [`tests/popup.test.js`](../tests/popup.test.js) — including a general
test that walks every boolean setting one at a time and asserts exactly one checkbox
responds, which catches the whole class of copy-paste error rather than this one instance.

### B2 + B3 — Three copies of the default configuration, and no merge on upgrade

The defaults were written out by hand in three places: the content script's cold start, the
popup's cold start, and the "Restore Defaults" button. The popup's copy was missing
`aboutWidget` and `popularExploreBuyWidget`.

Which one ran first was a race decided by user behaviour. Open a Google search before
opening the popup and all 34 keys landed in storage; open the popup first and 32 did. Those
two features then read `undefined` indefinitely.

Separately, both entry points used a present-or-absent check with no merge:

```js
if ('configuration' in storedConfiguration) { /* use it verbatim */ }
else { /* write defaults */ }
```

so a user who installed v1.1 and updated to v1.2 kept exactly the keys v1.1 knew about.
Given how often this extension adds widget toggles, that affected most upgrades.

**Fixed:** a new `defaults.js` holds the one frozen `DEFAULT_CONFIGURATION`, loaded ahead of
both `program.js` (via `content_scripts.js`) and `popup.js` (via `popup.html`). Both entry
points now merge it over whatever is stored and write the result back when anything was
missing:

```js
const configuration = applyConfigurationDefaults(storedConfiguration["configuration"]);

if (configurationNeedsUpgrade(storedConfiguration["configuration"]))
    chrome.storage.sync.set({ 'configuration': configuration }, function () {});
```

Existing users get their gaps repaired on the next search page or popup open; their own
choices are preserved.

Regression cover in [`tests/defaults.test.js`](../tests/defaults.test.js), including a test
that fails if a second copy of the defaults ever reappears in `program.js` or `popup.js`.

> Note that `DEFAULT_CONFIGURATION` is a top-level `const`, so it lives in the global
> lexical environment rather than on `window`. Scripts loaded together in one
> `content_scripts` entry — or as sibling `<script>` tags — share that environment, so
> `program.js` and `popup.js` both see it. Verified in a browser, not just in the harness.

### B6 — "Remove Emojis" deleted ordinary punctuation

The old pattern:

```js
/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g
```

Two of those ranges were far wider than intended:

- `[\u2011-\u26FF]` starts at U+2011 and runs for 1,775 code points. Before reaching
  anything emoji-like it sweeps up General Punctuation, Superscripts and Subscripts,
  Currency Symbols, Letterlike Symbols, Number Forms, Arrows, Mathematical Operators, and
  Box Drawing.
- `[\uE000-\uF8FF]` is the Private Use Area — where icon fonts put their glyphs.

Confirmed casualties in real search results:

| Input | Old output |
|---|---|
| `Node.js – the JavaScript runtime` | `Node.js  the JavaScript runtime` |
| `Rust—a systems language` | `Rusta systems language` |
| `It’s a “guide”` | `Its a guide` |
| `Read more…` | `Read more` |
| `Acme™ Widgets` | `Acme Widgets` |
| `Tutorial → part 1` | `Tutorial  part 1` |
| `5 ≤ 10` | `5  10` |

The em dash case was the worst: it deleted the separator without leaving a space, welding
two words together.

**Fixed** with Unicode property escapes, which is what they exist for:

```js
const EMOJI_PATTERN = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:[\uFE0E\uFE0F]|[\u{1F3FB}-\u{1F3FF}]|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*/gu;
const NOT_ACTUALLY_EMOJI = /^[©®™]$/;
```

The trailing group matters: skin tone modifiers, variation selectors, and zero-width-joiner
sequences have to be consumed as part of the same match, or stripping the base character
leaves orphaned modifiers behind as mojibake. `©`, `®`, and `™` are pictographic by
Unicode's reckoning but are ordinary text in a search result, so they are exempted.

Property escapes need Chrome 64+ / Firefox 78+, both well below this extension's floor.

Regression cover in [`tests/emoji.test.js`](../tests/emoji.test.js): seven kinds of emoji
that must go, fifteen kinds of punctuation and non-Latin text that must not.

### B7 — "Remove Emojis" destroyed the markup of every element it touched

The result was written back with `element.innerText = cleanedString`, which replaces all
child nodes with a single text node.

The targeted elements are not plain text. `.VwiC3b` is the result snippet, where Google
wraps matched query terms in `<em>`; `.LC20lb` is the title, which can contain nested
anchors. All of it was flattened. Because the guard was `if (element.innerText != cleaned)`,
this only happened when the regex matched something — which, given B6, was most results. The
symptom users saw was "search term highlighting sometimes disappears", with no obvious
connection to the emoji setting.

**Fixed** by rewriting individual text nodes:

```js
function removeEmojisFrom(element){
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

    for(let node = walker.nextNode(); node != null; node = walker.nextNode()){
        const cleanedString = node.nodeValue.replace(EMOJI_PATTERN, function(match){
            return NOT_ACTUALLY_EMOJI.test(match) ? match : '';
        });

        if(node.nodeValue != cleanedString)
            node.nodeValue = cleanedString;
    }
}
```

This also reaches emoji nested inside child elements, which the old code only handled
incidentally.

### B8 — The parent walk ran off the top of the document

`getParentNode` was unbounded:

```js
for(let i = 0; parentNum > i; i++)
    parent = parent.parentNode;
```

The hop counts in use go up to 16 (`.J1FGbf`), 13 (`.bH1Fqd`), and 12 (`.Lx2b0d`). If a
matched element sat closer to the root than its hop count assumed — because Google
restructured, or because the selector matched something unrelated — the walk reached
`document`, then `null`, then threw `TypeError` on `null.parentNode`.

`getParentNodeFromTo` failed one step earlier: `parent.className` is `undefined` on a
`Document`, and an `SVGAnimatedString` rather than a string on any SVG ancestor. Both made
`.includes()` throw.

What made this expensive was `modifySearchResults`: 400 lines of straight-line code with no
`try`/`catch`. The first throw ended the run and everything below it silently never
executed. A user whose page happened to trigger the crash in the "Things to know" block
found that "Remove favicons", "Colour URL", and "Remove emojis" had all stopped working,
with nothing in the UI to explain why — the call originates in a `chrome.storage` callback,
so the exception went to a console nobody was looking at.

**Fixed** in four parts:

1. The walk uses `parentElement` and stops when it runs out, so it lands on `<html>` instead
   of walking into the document and then into `null`.
2. `getParentNodeFromTo` reads the class via `getAttribute('class')`, which returns a string
   on every element including SVG, and breaks out when the walk reaches the top.
3. A shared `isSafeToHide` guard rejects `<html>` and `<body>` — hiding either would blank
   the page, and no widget is either of those, so landing on one is treated as the miss it is.
4. The four public helpers run through an `attempt()` wrapper that contains a failure to the
   one selector that caused it and logs it with context, so one stale selector can no longer
   disable every setting after it.

Regression cover in [`tests/utils.test.js`](../tests/utils.test.js), including the
end-to-end case: a `.dnXCYb` element three levels from the root no longer stops
`siteFavicons` from running.

### B4 — Dead `removeElements` overload containing a typo

`program.js` declared a three-argument `removeElements` and then a two-argument one.
JavaScript has no overloading — the second declaration won outright and the first was
unreachable. Which was fortunate, because it would have thrown on its first call:

```js
if(nonde.text.toLowerCase() == text.toLowerCase())   // `nonde`, and `.text` is not a property
```

**Fixed:** deleted along with the B8 rewrite.

### B13 — Undeclared loop variables leaked onto the global object

Five `for…of` loops omitted `let`, assigning to the global object rather than creating a
scoped binding: `element`, `entry`, and `child`. Content scripts run in an isolated world so
this could not collide with Google's own code, but the extension's functions shared those
bindings with each other, and the code would have broken immediately under `'use strict'`.

**Fixed:** all five declared. Two adjacent latent faults were fixed in the same pass:

- `setUrlColor` iterated `element.childNodes` and set `.style` on each — which throws on a
  text node. Now iterates `element.children`.
- `forEachDoThis` iterated live `HTMLCollection`s while its callback mutated the DOM, so
  elements could be skipped. Now snapshots with `Array.from`.

---

## Fixed — the popup pass

### B12 + B17 — The colour pickers exceeded the storage write quota

Both colour inputs listened for `input`, which fires continuously while a native colour
picker is dragged. Each event ran `changeConfig`, which was a read-modify-write against
`chrome.storage.sync`.

That API is rate limited to roughly **120 writes per minute** and **1800 per hour**, and
writes past the cap are rejected — silently, since nothing checked
`chrome.runtime.lastError`. A few seconds of dragging through a gradient blew the quota, and
the colour the user finally settled on was one of the rejected writes. It did not stick, with
no indication why.

`changeConfig` also re-read the whole configuration from storage before every single write,
even though the popup already held it in memory. That doubled the API traffic for no benefit
(B17).

**Fixed** by separating preview from save. Dragging now only previews — the new colour goes
straight to the page, which costs nothing because the content script just rewrites a couple
of CSS rules — and the value is written once, on `change`, when the picker closes:

```js
function previewAndCommit(elementId, key){
    const picker = document.getElementById(elementId);

    picker.addEventListener("input", event =>{
        configuration[key] = event.target.value;
        sendToProgramJS({ "configuration": configuration });
    });

    picker.addEventListener("change", event =>{
        changeConfig(key, event.target.value);
    });
}
```

The popup now holds the configuration for as long as it is open and writes straight from it.
It is the only writer while open, so the read was pure overhead.

Ten drag events plus a release: **1 write**, down from 10 writes and 10 reads.

### B16 — Only the active tab was notified, and an unresolved tab threw

```js
chrome.tabs.query({currentWindow: true, active: true}, function (tabs){
    chrome.tabs.sendMessage(tabs[0].id, payload);
});
```

Two problems. The query was scoped to one tab, so with several search pages open only the
frontmost updated. And `tabs[0]` was dereferenced unguarded — on a `chrome://` page, the New
Tab page, or the Web Store there is no content script and the array can be empty.
`tabs[0].id` then threw inside the callback: logged to a console nobody reads, and the send
never happened.

**Fixed** by messaging every tab, guarding the lookup, and absorbing the expected failures:

```js
chrome.tabs.query({}, function (tabs){
    if(!Array.isArray(tabs))
        return;

    for(const tab of tabs){
        if(tab == null || tab.id == null)
            continue;

        chrome.tabs.sendMessage(tab.id, payload, function(){
            void chrome.runtime.lastError;
        });
    }
});
```

Tabs are deliberately *not* filtered by URL: `chrome.tabs.query({url: …})` needs the `tabs`
permission, and the manifest already limits the content script to Google domains (B10). Tabs
without it simply fail to receive, which is what reading `lastError` in the callback absorbs
— that read is what stops Chrome logging "Receiving end does not exist" for each one.

The extension still requests only `storage`.

### B10 — `<all_urls>` injection with a substring domain check

The manifest injected the content script into **every page the user visits**, and the gate
was then applied in JavaScript:

```js
if(!window.location.href.includes(".google."))
```

That tested the whole URL, not the hostname, so `https://example.com/?ref=www.google.com`
passed. Combined with an `itemtype` of `SearchResultsPage`, which any site may declare, a
third-party page could make the content script activate in its DOM. Every page load also paid
for parsing and running the extension.

**Fixed** on both sides. `content_scripts.matches` now lists 192 Google domains instead of
`<all_urls>`, and the runtime check reads the hostname:

```js
function isGoogleDomain(){
    return /(^|\.)google(\.[a-z]{2,3})+$/.test(window.location.hostname);
}
```

A test asserts the two agree — that every host the manifest injects into is one
`isGoogleDomain` also accepts — so the gates cannot drift apart.

The trade-off worth knowing: an enumerated list can miss a domain, and if Google adds a
ccTLD the extension is simply inactive there until it is added. That is a better failure than
running everywhere, but it does need maintaining. The list is generated in
`content_scripts.matches`; adding one is a single line.

### B11 — The message listener covered every Google page

`chrome.runtime.onMessage.addListener` sat outside the gate, so a configuration pushed from
the popup while any Google page was focused would be applied to it — Maps, Drive, and the
rest included.

It still has to be *registered* before the page is confirmed as a results page, because the
popup may send at any time. **Fixed** by re-checking when the message arrives instead:

```js
function receivedMessage(message, sender, response){
    if(checkIfRun() !== true)
        return;

    modifySearchResults(applyConfigurationDefaults(message["configuration"]));
}
```

### B14 + B15 — Popup markup and accessibility

- Four `<h5>` elements shared `id="adTitle"`. Now a `.sectionTitle` class; a test asserts no
  id in the document is used twice.
- "URL Position and Apperance" → "Appearance".
- **None of the 33 checkboxes and radios had a `<label>`.** The caption was dead text beside
  a ~13 px box, and screen readers announced each control with no accessible name. Every one
  now has `<label for>`; the colour inputs have `aria-label`. Verified in a browser that
  clicking a caption toggles its control.
- `<html lang="en">` and `<meta charset="utf-8">` added.
- Scripts moved to `defer`, and the setup hangs on `DOMContentLoaded` instead of `load` — it
  no longer waits for images and other subresources.
- `rel="noopener"` on the outbound links.
- Dead `.tooltip` rules deleted; they styled a component that does not exist in the markup.
- Dark mode was largely unstyled: links rendered at their default `#0000ee` on `#121212`, a
  contrast ratio of **1.99**, and the toggle wrapper kept a white 2 px border. Links are now
  8.89, the notice 8.21, and everything else above 10 — all comfortably past WCAG AA.

---

## Not bugs, but worth knowing

**The selector table is still the maintenance burden.** ~70 targets reference obfuscated
Google class names, each paired with a hand-counted parent hop. There is no way to make that
robust — the names change without notice — but there are ways to make it *cheap*. It is now
one declarative table in `rules.js` rather than ~90 call sites, transcribed in
[SELECTORS.md](SELECTORS.md), and pinned by the table-driven tests in
[`tests/features.test.js`](../tests/features.test.js), so a stale entry produces a named
failing test instead of a bug report.

**The commented-out "Move URL" feature** has been disabled for some time. It is still
advertised in the README ("Remove, Move, Color the link") and in a screenshot caption. Note
that `moveUrl` still has an effect: it is one of the three settings that imply "remove the
arrow after the URL". Either restore the feature or drop it from the docs.

**Naming.** `youtubeWidtget` and `videoTumbnails` are misspelled config keys. Now that the
defaults live in one place, renaming them is a smaller job than it was — but it still needs a
storage migration, so the misspellings are marked as deliberate in `defaults.js`.

**Firefox floor corrected.** `browser_specific_settings.gecko.strict_min_version` was `58.0`,
but Firefox only supports Manifest V3 from **109**; it is now `109.0`. Note that 109–120 and
121+ behave differently: `:has()` arrived in 121, so below that the hop-based rules fall back
to the scripted parent walk and the flash-before-hide is back for those. Everything above 121
runs through CSS.

**ESLint is now wired up** (`npm run lint`, or `npm run check` for lint plus tests). It
retires a whole category of this review: `no-redeclare` catches B4's duplicate declaration,
`no-undef` catches B13's leaked loop variables, and `no-use-before-define` catches the two
temporal-dead-zone mistakes made during the CSS rework — a `const` read by a statement above
its declaration, which hoisting does not save you from. All four were verified by
reintroducing them and watching the linter object.

The three extension scripts share one global lexical environment, which a linter cannot infer
from a single file, so `eslint.config.js` declares the names each file publishes and the
files themselves carry `/* exported … */` comments. Those double as documentation of each
file's public surface.

---

## What is left

Nothing from this review. The items worth knowing about are the two above — the misspelled
config keys, and the "Move URL" feature that is disabled in code but still advertised in the
README — plus the standing maintenance job that no amount of refactoring removes:

**Google will change its class names.** When a setting stops working, the cause is a stale
entry in the `REMOVAL_RULES` table. [SELECTORS.md](SELECTORS.md) documents every one and how
to find the replacement, and `tests/features.test.js` turns a stale entry into a named
failing test rather than a bug report.

If a new defect turns up, `tests/known-bugs.test.js` is the file to recreate — see
[TESTING.md](TESTING.md) for the convention.
