# Architecture

How the extension is put together, what runs where, and why it is shaped the way it is.

For known defects see [CODE-REVIEW.md](CODE-REVIEW.md). For the selector table see
[SELECTORS.md](SELECTORS.md). For the test suite see [TESTING.md](TESTING.md).

---

## The shape of it

Four files, no build step, no dependencies, no bundler. What is in the repository is
exactly what ships.

```
Google Search Customizer v1/
├── manifest.json    Manifest V3 declaration
├── defaults.js      The one shared default configuration; loaded by both halves
├── rules.js         What each setting hides, and the CSS generated from it
├── program.js       Content script — injects the stylesheet, sets the gating classes
├── popup.html       Settings UI
├── popup.js         Settings UI logic
├── style.css        Settings UI styling
└── icon{16,48,128}.png
```

There is no background script or service worker. The two halves talk to each other
directly, and `chrome.storage.sync` is the only thing that persists.

```
        ┌──────────────────────┐                  ┌────────────────────────┐
        │  popup.html/.js      │                  │  program.js            │
        │  (extension page)    │                  │  (content script,      │
        │                      │                  │   isolated world)      │
        └──────────┬───────────┘                  └───────────┬────────────┘
                   │                                          │
    read/write     │           chrome.tabs.sendMessage        │  read
    configuration  │        ─────────────────────────────▶    │  configuration
                   │         (active tab only, one-way)       │
                   ▼                                          ▼
        ┌───────────────────────────────────────────────────────────────────┐
        │                     chrome.storage.sync                           │
        │             { configuration: { …34 keys… } }                      │
        └───────────────────────────────────────────────────────────────────┘
```

Both sides read the same defaults out of `defaults.js`, and both will seed storage if it is
empty. Whichever runs first, the result is the same.

### defaults.js

`defaults.js` exports nothing — it is a classic script that declares one frozen object:

```js
const DEFAULT_CONFIGURATION = Object.freeze({ /* 34 keys */ });
function applyConfigurationDefaults(storedConfiguration){ /* … */ }
function configurationNeedsUpgrade(storedConfiguration){ /* … */ }
```

The manifest lists it ahead of `program.js` in `content_scripts.js`, and `popup.html` loads
it in a `<script>` tag ahead of `popup.js`. Scripts loaded together that way share one
global lexical environment, so a top-level `const` in the first is visible to the second.
(It is *not* visible as `window.DEFAULT_CONFIGURATION` — top-level `const` goes into the
lexical environment, not onto the global object.)

Both entry points do the same two things on startup:

```js
const configuration = applyConfigurationDefaults(storedConfiguration["configuration"]);

if (configurationNeedsUpgrade(storedConfiguration["configuration"]))
    chrome.storage.sync.set({ 'configuration': configuration }, function () {});
```

Merging rather than replacing is what keeps settings added in an update from reading as
`undefined` for anyone who already had a configuration saved.

**To add a setting, add it to `defaults.js` and nowhere else.** This used to be three
hand-maintained copies, and two of them had already drifted apart.

---

## The content script

It runs at `run_at: document_start`, before the page has a `<body>`. In outline:

```js
if (window.location.href.includes(".google.")) {
    injectRemovalStyleSheet();                        // inert until a class is set
    chrome.runtime.onMessage.addListener(receivedMessage);
    whenSearchPageConfirmed(start);                   // now, or at DOMContentLoaded
}
```

That statement is deliberately the **last** thing in the file. Function declarations hoist
but `const` and `let` do not, so running it from the top would reach module state that has
not been initialised yet. (This was got wrong twice while writing the rework, both times
caught by a test.)

### Deciding whether to run

There are two gates, and they have to agree.

**The manifest** lists 192 Google domains in `content_scripts.matches` — one pattern per
ccTLD — so the script is only injected on Google in the first place. This used to be
`<all_urls>`, which meant every page load paid for parsing and running it. The trade-off of
an enumerated list is that a domain Google adds later is simply not covered until it is added
here.

**`checkIfRun()`** is the runtime gate, and requires both:

1. `isGoogleDomain()` — the **hostname** matches `/(^|\.)google(\.[a-z]{2,3})+$/}`, and
2. the `<html>` element carries `itemtype="…/SearchResultsPage"`.

The hostname check matters: the previous version tested `location.href.includes(".google.")`,
which a path or query string was enough to satisfy, so `https://example.com/?ref=google.com`
passed. A test asserts every host the manifest injects into is one `isGoogleDomain` accepts,
so the two gates cannot drift apart.

The second condition is what distinguishes a results page from Gmail, Maps, or Drive. Google
sets it via schema.org microdata on the root element.

`checkIfRun` answers **three** ways, and the third matters:

| Answer | Meaning |
|---|---|
| `true` | A results page. Start now. |
| `false` | Definitely not one — wrong domain, or a different `itemtype`. Stop. |
| `undefined` | Cannot tell yet: `<html>` carries no `itemtype` at all. |

At `document_start` the `<html>` attributes are normally parsed already, but "not yet" and
"not a search page" have to be distinguishable or the extension would give up too early on a
page it should have handled. `whenSearchPageConfirmed` treats `undefined` as "ask again at
`DOMContentLoaded`".

### How a setting is applied

Everything a setting hides is declared in `rules.js`:

```js
{
    key: "askWidget",
    targets: [
        { selector: ".JolIg", hops: 4 },
        { selector: ".EN1f2d", hops: 4 },
        { selector: ".Okagcf", hops: 1 }
    ],
    collapse: [{ selector: ".EN1f2d", hops: 4 }]
}
```

`buildRemovalStyleSheet()` turns that into CSS, gated on a class named after the key:

```css
html.gsc-askWidget *:has(> * > * > .JolIg),
html.gsc-askWidget *:has(> * > * > .EN1f2d),
html.gsc-askWidget *:has(> .Okagcf) { display: none !important; }

html.gsc-askWidget [data-gsc-collapse~="askWidget"] { margin: 0px !important; }
```

Applying a configuration is then `applyGatingClasses()`: one `classList.toggle` per rule.
Switching a setting off removes its class, and the content comes straight back.

**The hop count is the whole design.** Google's class names are obfuscated and apply to inner
elements — the text span, the icon, the link — not to the block a user thinks of as "the
widget". So a rule matches whatever element carries a stable-looking class and counts parents
up to the container worth hiding. Those counts range from 0 to 16 and were derived by
inspecting live pages.

| Target form | CSS |
|---|---|
| `{ selector: ".X" }` | `.X` |
| `{ selector: ".X", hops: 1 }` | `*:has(> .X)` |
| `{ selector: ".X", hops: 4 }` | `*:has(> * > * > * > .X)` |
| `{ selector: ".X", ancestor: ".Y" }` | `.Y:has(.X)` |

This is still the maintenance burden. When Google restructures, either the class name
disappears (the setting silently stops working) or the nesting depth changes and the wrong
element gets hidden. See [SELECTORS.md](SELECTORS.md).

### What could not be done in CSS

Three things still run as scripted passes, in `applyScriptedPasses()`:

| Pass | Why it cannot be CSS |
|---|---|
| `removeEmojis()` | Edits text. Walks text nodes so the markup Google puts inside titles and snippets survives. |
| `markCollapseTargets()` | Needs "the sibling before the element that has this descendant". `:has()` cannot be nested, so CSS cannot express it. The script marks the element with `data-gsc-collapse="<key>"` and the stylesheet acts on the mark — which keeps it reversible. |
| `hideWithoutHasSupport()` | Fallback for browsers without `:has()` (below Chrome 105 / Firefox 121). Those rules are left out of the generated sheet and applied by a parent walk instead. Plain selectors work everywhere. |

Colours are CSS too, but they depend on values the user picked, so they live in a second
`<style>` element that is rewritten whenever the configuration changes rather than being
generated once.

### Guards

| Guard | Why |
|---|---|
| `attempt(description, action)` | Contains a failure to the one step that caused it, and logs it with context. Applying a configuration is a sequence of independent steps; without this one exception took the rest down with it, silently, because the call comes from a `chrome.storage` callback. |
| `isSafeToHide(node)` | Rejects `null`, `<html>`, and `<body>`. A hop count that overshoots lands on `<html>`, and hiding that would blank the page. |
| `getParentNode` walking `parentElement` | Stops at `<html>` rather than continuing into the document and then into `null`, which used to throw. |

### Reacting to more results

Google's endless scroll appends results over XHR without a navigation. **The CSS rules match
whatever arrives on their own**, so this no longer needs handling for most settings — which
is what the `PerformanceObserver` used to exist for.

It is still registered, because the scripted passes above do need re-running:

```js
const requestObserver = new PerformanceObserver(onRequestsObserved);
requestObserver.observe({ type: 'resource' });
```

When a batch contains an `xmlhttprequest` or `fetch` entry whose URL contains `search?`, the
handler re-reads the configuration and calls `applyScriptedPasses` — not the whole pass.

Using resource timing rather than a `MutationObserver` is an unusual choice, and a reasonable
one: a `MutationObserver` on a Google SERP fires constantly, whereas resource entries are a
precise signal for "more results just arrived". The trade-off is that it only catches content
that arrives over the network.

### Receiving settings changes

`chrome.runtime.onMessage.addListener(receivedMessage)` applies a configuration pushed from
the popup without waiting for a reload.

It is registered *before* the page is confirmed as a results page — it has to go on
synchronously, because the popup may send at any time — so `receivedMessage` re-checks the
gate when a message actually arrives. Without that, a configuration change made while Maps
or Drive was focused would be applied there.
---

## The popup

`popup.js` runs its setup on `DOMContentLoaded` (the scripts are deferred) and then:

1. Reads `configuration` from `chrome.storage.sync`, seeding and merging defaults, and keeps
   it in memory for as long as the popup is open.
2. Calls `setUI()` to reflect it onto ~30 checkboxes, 4 radios, 2 colour inputs, and the
   dark-mode class.
3. Registers one listener per control. Each calls `changeConfig(key, value)`.

`changeConfig` writes straight from the in-memory copy and pushes the result to the tabs:

```js
function changeConfig(key, value){
    configuration[key] = value;
    chrome.storage.sync.set({'configuration': configuration}, function(){});
    sendToProgramJS({ "configuration": configuration });
}
```

It used to re-read storage first, which was pure overhead — the popup is the only writer
while it is open.

**Colour pickers are a special case.** `input` fires continuously while one is dragged and
`change` once, when it closes. Writing on `input` blew `chrome.storage.sync`'s ~120
writes/minute quota, and the rejected writes were silent, so the colour the user settled on
often did not stick. Dragging now only previews — the value goes to the page, which costs
nothing because the content script just rewrites a couple of CSS rules — and the save happens
on `change`.

**`sendToProgramJS` messages every tab**, not just the active one, so several open search
pages all update. Tabs are not filtered by URL because `chrome.tabs.query({url: …})` needs
the `tabs` permission and the manifest already limits the content script to Google domains.
Tabs without it fail to receive; reading `chrome.runtime.lastError` in the callback is what
stops Chrome logging each failure.

Each control is wired individually rather than through a loop over a schema. That is ~30
near-identical five-line blocks in `popup.js` plus ~30 near-identical assignments in
`setUI`, and adding a feature still means editing `defaults.js`, `rules.js`, `popup.html`,
the listener block, and `setUI`. It is also where B1 came from — one of those hand-written
assignments read the wrong key, so a checkbox displayed its neighbour's value.

The popup is now the only part of the extension that still works this way; the content
script's half of the same problem became the `rules.js` table.

A schema-driven rewrite would collapse all of it:

```js
const SETTINGS = [
  { key: "removeUrl",    id: "removeUrlCheckBox",    label: "Remove URL" },
  { key: "removeArrow",  id: "removeArrowCheckBox",  label: "Remove Arrow/Dots after URL" },
  // …
];

for (const { key, id } of SETTINGS) {
  document.getElementById(id).addEventListener("change", (e) => changeConfig(key, e.target.checked));
}
```

with the same array driving `setUI`, the defaults, and — if the markup were generated —
`popup.html` too.

---

## Data flow for one settings change

1. User clicks a checkbox in the popup.
2. `change` fires → `changeConfig("newsWidget", true)`.
3. `chrome.storage.sync.get` → mutate → `chrome.storage.sync.set`.
4. `chrome.tabs.query({})` → `chrome.tabs.sendMessage` to every tab.
5. In each content script, `receivedMessage` re-checks the gate, then
   `modifySearchResults(configuration)`.
6. `applyGatingClasses` puts `gsc-newsWidget` on `<html>`.
7. The already-injected rule `html.gsc-newsWidget *:has(> * > * > * > .aUSklf)` starts
   matching, and the Top stories block disappears.

Unchecking the box repeats steps 1–6 and step 6 takes the class off again, so the block comes
back. There is no step that has to undo anything, which is the point.

Every open search page updates, not just the frontmost. Tabs with no content script — which
is every non-Google tab — simply fail to receive, and the error is absorbed in the send
callback.

The page load path is shorter: the stylesheet is injected at `document_start`, and the
configuration read that follows only has to set classes. Nothing is queried, walked, or
written per element.

---

## Browser compatibility

`manifest.json` declares Manifest V3 with `browser_specific_settings.gecko` for Firefox
signing and `strict_min_version: 58.0`.

The `58.0` floor is stale — Firefox only supports MV3 from **109**. Raising it to `109.0`
would describe reality; the current value just lets older installs fail in a less obvious
way.

There are now effectively three tiers:

| Browser | Behaviour |
|---|---|
| Chrome 105+, Firefox 121+ | Everything runs through CSS. No flash, fully reversible. |
| Firefox 109–120 | No `:has()`. Plain selectors still come from CSS; hop and ancestor rules fall back to the scripted parent walk, which behaves as the extension did before the rework. |
| Below that | Manifest V3 is not supported at all. |

`CSS.supports("selector(:has(*))")` is what picks between the first two, and it decides both
which rules go into the generated stylesheet and whether the fallback pass runs.

Other floors: `:has()` — Chrome 105 / Firefox 121. Unicode property escapes in the emoji
pattern — Chrome 64 / Firefox 78. `PerformanceObserver` with `{ type: … }` — Firefox 57.

The extension is published for Chrome, Firefox, and Edge, and uses the `chrome.*` namespace
throughout — which Firefox supports for the callback-style API used here.

---

## Where to make changes

| Goal | Files |
|---|---|
| A widget stopped being removed | `rules.js` — update the selector or hop count in that rule's `targets`. Update the matching row in [SELECTORS.md](SELECTORS.md) and `tests/features.test.js` |
| Add a new toggle | `defaults.js` (the default value), `rules.js` (what it hides), `popup.html` (markup), `popup.js` (listener + `setUI`), plus a row in `tests/features.test.js` |
| Change a default value | `defaults.js`, and nowhere else |
| Change what a setting hides | `rules.js`, and nowhere else |
| Change *how* hiding works | `buildRemovalStyleSheet` / `targetSelector` in `rules.js` |
| Popup appearance | `popup.html`, `style.css` |
| Permissions, matched sites, load order | `manifest.json`, then `tests/manifest.test.js` |

Note that `defaults.js`, `rules.js`, and `program.js` are classic scripts sharing one global
lexical environment, in that order. `rules.js` reads nothing from `defaults.js`, but
`program.js` reads `REMOVAL_RULES` and the builders from `rules.js`, so the order in
`content_scripts.js` and in `popup.html` is load-bearing.
