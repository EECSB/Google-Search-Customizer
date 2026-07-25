# Testing

The extension ships as plain classic scripts with top-level side effects and no module
system, so there is nothing to `import`. The suite works around that by loading the real
source files into a [jsdom](https://github.com/jsdom/jsdom) window with stubbed browser
APIs, and asserting on what they do to the DOM and to storage.

**No source file was modified to make it testable.** What the tests exercise is exactly
what ships.

## Running

```bash
npm install
npm run check
```

That runs the linter and then the tests. Either half on its own:

```bash
npm run lint
npm test
npm run test:watch
```

Requires Node 20 or newer (uses the built-in `node:test` runner). jsdom and ESLint are dev
dependencies — nothing is added to the shipped extension.

### The linter

`eslint.config.js` is worth a look before adding a rule. The three extension scripts are
classic scripts that share one global lexical environment, which ESLint cannot infer from a
single file, so the config declares the names each file publishes and the files carry
`/* exported … */` comments.

The rule that earns its place is `no-use-before-define` with `{ functions: false }`: function
declarations hoist, `const` and `let` do not, and reading module state above its declaration
is the exact mistake that broke the stylesheet injection twice during the CSS rework. Both
times the failure was silent, because the error containment caught it.

## Layout

| File | Covers |
|---|---|
| `tests/helpers/harness.js` | The loader, the `chrome.*` stubs, and the DOM fixture builders |
| `tests/smoke.test.js` | The harness itself loads and exposes what it claims to |
| `tests/utils.test.js` | What still touches the DOM directly: the parent walk, collapse marking, the shopping-tab check, error containment, and the no-`:has()` fallback |
| `tests/stylesheet.test.js` | `rules.js`: selector generation, the injected sheet, and the gating classes |
| `tests/defaults.test.js` | The shared `defaults.js`: one source of truth, and the merge on upgrade |
| `tests/emoji.test.js` | "Remove Emojis": what must go, what must survive, and markup preservation |
| `tests/lifecycle.test.js` | Activation gate, storage bootstrap, `PerformanceObserver` reapplication, messaging |
| `tests/features.test.js` | Table-driven: every `[setting, selector, hop count]` triple |
| `tests/popup.test.js` | Popup wiring, persistence, and `setUI` |
| `tests/manifest.test.js` | Packaging: referenced files exist, versions agree, permissions are minimal |

## How the harness works

`createEnvironment()` builds a jsdom window at a chosen URL, installs stubs, and returns
handles to everything:

```js
const env = await loadProgram({
  url: "https://www.google.com/search?q=test",
  html: serpDocument('<div class="byrV5b">example.com</div>'),
  store: { configuration: { removeUrl: true } },
});

assert.equal(env.document.querySelector(".byrV5b").style.display, "none");
```

`loadProgram` evaluates `defaults.js` and `program.js` with `window.eval`. That is an
indirect eval, so the code runs in global scope and its top-level `function` declarations
become properties of `window` — the same thing a real classic content script does. This is
how tests reach `modifySearchResults`, `getParentNode`, and the rest without any export
machinery.

The two files are concatenated and eval'd as one unit rather than separately. In a browser,
scripts listed together in `content_scripts.js` (or as sibling `<script>` tags) share one
global lexical environment, so the top-level `const DEFAULT_CONFIGURATION` in `defaults.js`
is visible to `program.js`. Separate `eval` calls would not reproduce that — `let` and
`const` stay confined to each eval's own scope.

Note the corollary: `DEFAULT_CONFIGURATION` is **not** reachable as
`window.DEFAULT_CONFIGURATION`, in the harness or in a real browser, because top-level
`const` goes into the lexical environment rather than onto the global object. Tests reach it
through `applyConfigurationDefaults`, which is a function declaration and therefore is on
`window`.

`loadPopup` does the same for `popup.html` + `defaults.js` + `popup.js`, then awaits the
window `load` event that the popup hangs all of its setup on. Awaiting jsdom's own `load`
matters: dispatching a synthetic one on top of it makes the popup run its whole setup twice
and register every listener twice over, which silently cancels out anything implemented as a
toggle.

### What is stubbed

| API | Stub behaviour |
|---|---|
| `chrome.storage.sync` | In-memory object. **Asynchronous on purpose** — the real API is too, and ordering bugs only surface if the stub keeps that property. `await flush()` after anything that touches it. |
| `chrome.runtime.onMessage` | Records listeners in `env.calls.messageListeners` so tests can invoke them directly |
| `chrome.tabs` | Records queries and messages; `env.setQueryResult([])` simulates an unresolvable tab |
| `PerformanceObserver` | jsdom has none. `env.performanceObserver.emitSearchXhr()` fires a synthetic "more results arrived" batch |
| `CSS.supports` | jsdom has no `window.CSS` at all, and the content script asks it whether `:has()` is usable. See below. |
| `innerText` | jsdom has no `innerText`; shimmed onto `textContent` |

### `CSS.supports`, specifically

The content script calls `CSS.supports("selector(:has(*))")` to decide whether it can express
its rules in CSS or has to fall back to a scripted parent walk. jsdom ships no `window.CSS`,
so without a stub the answer is always "no support" and the CSS path — the thing actually
under test — never runs. That is worth knowing because the failure is silent: the fallback
produces the right result for the first assertion and the wrong one for reversibility.

The stub is not a hardcoded `true`. It answers `selector(...)` queries by putting the
selector through jsdom's own engine, so it reports what this environment can genuinely
match. jsdom's engine (nwsapi) does support `:has()`.

To exercise the fallback deliberately, override the check after loading:

```js
const env = await loadProgram({ html: serpDocument() });
env.window.supportsHasSelector = () => false;
```

Errors thrown *inside* extension callbacks are caught and recorded in
`env.calls.callbackErrors` rather than propagated. Chrome behaves the same way — it logs a
throwing callback and carries on — and letting them escape would take down the Node test
process and misattribute the failure to the harness.

### What the fixtures are

Synthetic. `buildNested(document, depth, { className })` produces a chain of `<div>`s of a
known depth with the target class on the leaf.

They are not captured Google pages, and that is deliberate: the contract under test is
"given this class at this depth, hide the ancestor N levels up", which is precisely what
`program.js` encodes. A captured page would go stale the moment Google shipped a change,
and would not tell you anything the synthetic fixture does not.

The limitation is worth stating plainly: **these tests verify the extension does what its
source says, not that its selectors still match live Google.** Only opening a browser can
tell you that. What the suite catches is regressions, wiring mistakes, and the
consequences of editing a hop count.

### Hidden means computed, not inline

`isHidden(element)` reads `getComputedStyle(element).display`, not `element.style.display`.
Almost everything is hidden by the injected stylesheet now, so there is no inline style to
look at — and the cascade is what actually answers "would the user see this".

This works because **jsdom's cascade evaluates `:has()`**, which is what makes the CSS rules
testable here at all rather than only assertable as generated text. Two things it does not
do, both worked around rather than papered over:

- `:has()` inside `:not()` is rejected by its selector engine, so no rule uses that form.
- `var()` is not resolved in computed styles, so the colour rules emit literal values rather
  than custom properties.

Colours and margins are checked the same way, through `getComputedStyle`. Note that computed
values are normalised: `green` reads back as `rgb(0, 128, 0)`, and an unset background as
`rgba(0, 0, 0, 0)` rather than `""`.

### The `innerText` shim, specifically

jsdom implements `textContent` but not `innerText`. The shim maps it onto `textContent`.

That is not faithful — real `innerText` is layout-aware, collapses whitespace, and skips
hidden elements. The emoji stripper no longer touches `innerText` (it walks text nodes
instead), so the shim now only exists so that older behaviour can still be exercised if
needed.

## The known-bugs convention

There used to be a `tests/known-bugs.test.js` holding a runnable reproduction of every open
finding. It is gone because every finding is fixed, but the convention is worth keeping for
the next one.

The idea: when you find a defect you are not fixing yet, write a test that **asserts the
current, wrong behaviour**, with a comment saying what it should become:

```js
test("the popup shows a neighbouring setting's value", async () => {
  const env = await loadPopup({ store: { configuration: { placesToVisitWidget: true } } });

  // AFTER THE FIX: assert.equal(..., true)
  assert.equal(env.document.getElementById("placesToVisitWidgetCheckBox").checked, false);
});
```

The suite stays green, the bug has a concrete demonstration instead of a paragraph of prose,
and fixing it turns the test red — which is the signal to invert the assertion and move it
into the suite it belongs to. Every regression test in this repo arrived that way.

Green means "behaves exactly as documented", not "has no bugs".

## What the suite cannot tell you

Two things need a real browser, and both were checked by hand for the CSS rework:

1. **That Chrome accepts the generated CSS.** An unparseable rule is dropped silently, so a
   typo in the generator would look like "that setting stopped working" rather than an error.
   Counting `style.sheet.cssRules.length` against the number of rules written is what catches
   it.
2. **What `:has()` costs.** On a synthetic 4,500-element results page, toggling every setting
   on and off averaged 31.74 ms with `:has()`, 31.72 ms with those rules removed, and 31.45 ms
   for a plain-selector sheet of the same size — the time is full-document style recalculation,
   not `:has()`.

## Adding tests

**A new setting** — add a row to `FEATURE_SELECTORS` in `tests/features.test.js`. Each row
generates four tests automatically: hidden when on, untouched when off, restored when
switched back off, and hidden on arrival for content added later.

```js
myNewWidget: [[".AbCdEf", 3, "the thing it hides"]],
```

**A selector or hop-count change** — update the same row. The test name includes the config
key, the selector, and the hop count, so a failure points straight at the entry in `rules.js`
that needs attention.

**A popup control** — `tests/popup.test.js` already asserts that every `getElementById`
in `popup.js` resolves against `popup.html`, that every checkbox in the markup is wired to
something, and that no two checkboxes are driven by the same configuration key. New controls
are covered by those three tests without any edits.

**A new setting's default** — `tests/defaults.test.js` asserts that the content script, the
popup, and "Restore Defaults" all produce identical configurations, and fails if a second
copy of the defaults appears outside `defaults.js`. Nothing to add.
