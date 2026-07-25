/**
 * Test harness for the Google Search Customizer extension.
 *
 * The extension ships as plain classic scripts with top-level side effects and
 * no module system, so there is nothing to `import`. This harness instead:
 *
 *   1. builds a jsdom window at a chosen URL with a chosen DOM,
 *   2. installs stubs for the browser APIs the scripts depend on
 *      (`chrome.storage`, `chrome.runtime`, `chrome.tabs`, `PerformanceObserver`),
 *   3. evaluates the real source file inside that window.
 *
 * Because the sources are sloppy-mode classic scripts, their top-level function
 * declarations land on the window object, which is how the tests reach
 * `modifySearchResults`, `getParentNode`, and friends.
 *
 * No source file is modified to make it testable.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (the directory holding package.json). */
export const REPO_ROOT = path.resolve(HERE, "..", "..");

/** The unpacked extension directory. Note the spaces in the folder name. */
export const EXTENSION_DIR = path.join(REPO_ROOT, "Google Search Customizer v1");

/** Reads a file from the extension directory as UTF-8 text. */
export function readExtensionFile(name) {
  return fs.readFileSync(path.join(EXTENSION_DIR, name), "utf8");
}

/** Parsed manifest.json. */
export function readManifest() {
  return JSON.parse(readExtensionFile("manifest.json"));
}

/**
 * Lets pending `queueMicrotask` / `setTimeout(0)` callbacks run.
 *
 * The chrome.storage stub resolves asynchronously on purpose — the real API is
 * async too, and several ordering bugs only appear if the stub keeps that
 * property. Tests must `await flush()` after anything that touches storage.
 */
export function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Minimal in-memory stand-in for the slice of the `chrome.*` API the extension
 * uses. Every call is recorded so tests can assert on what the extension did
 * rather than only on the DOM it produced.
 *
 * @param {object} [initialStore] Seed contents of `chrome.storage.sync`.
 */
export function createChromeStub(initialStore = {}) {
  const store = structuredClone(initialStore);

  const calls = {
    /** Every `chrome.storage.sync.get` key list, in order. */
    storageGets: [],
    /** Every object handed to `chrome.storage.sync.set`, in order. */
    storageSets: [],
    /** Every `{ tabId, payload }` passed to `chrome.tabs.sendMessage`. */
    sentMessages: [],
    /** Callbacks registered through `chrome.runtime.onMessage.addListener`. */
    messageListeners: [],
    /** Query objects passed to `chrome.tabs.query`. */
    tabQueries: [],
    /** Errors thrown *inside* extension callbacks. See `invoke` below. */
    callbackErrors: [],
  };

  /**
   * Runs an extension-supplied callback the way Chrome does: asynchronously,
   * and with exceptions contained rather than propagated. Chrome logs a throwing
   * callback to the page console and carries on; if the stub let the exception
   * escape it would instead take down the Node test process, and the failure
   * would be attributed to the harness rather than to the extension.
   */
  function invoke(callback, ...args) {
    queueMicrotask(() => {
      try {
        callback(...args);
      } catch (error) {
        calls.callbackErrors.push(error);
      }
    });
  }

  /** Tabs returned by `chrome.tabs.query`. Set to `[]` to simulate no match. */
  let queryResult = [{ id: 1, active: true, url: "https://www.google.com/search?q=test" }];

  const chrome = {
    storage: {
      sync: {
        get(keys, callback) {
          const list = Array.isArray(keys) ? keys : [keys];
          calls.storageGets.push(list);
          const result = {};
          for (const key of list) {
            if (key in store) result[key] = structuredClone(store[key]);
          }
          invoke(callback, result);
        },
        set(items, callback) {
          calls.storageSets.push(structuredClone(items));
          Object.assign(store, structuredClone(items));
          if (callback) invoke(callback);
        },
        clear(callback) {
          for (const key of Object.keys(store)) delete store[key];
          if (callback) invoke(callback);
        },
      },
    },
    runtime: {
      lastError: undefined,
      onMessage: {
        addListener(fn) {
          calls.messageListeners.push(fn);
        },
      },
    },
    tabs: {
      query(queryInfo, callback) {
        calls.tabQueries.push(queryInfo);
        invoke(callback, queryResult);
      },
      sendMessage(tabId, payload, callback) {
        calls.sentMessages.push({ tabId, payload: structuredClone(payload) });
        if (callback) invoke(callback);
      },
    },
  };

  return {
    chrome,
    store,
    calls,
    /** Replace what `chrome.tabs.query` resolves with. */
    setQueryResult(tabs) {
      queryResult = tabs;
    },
    /** Current value of `configuration` in the fake sync store. */
    storedConfiguration() {
      return store.configuration;
    },
  };
}

/**
 * `PerformanceObserver` stand-in. jsdom does not implement it, and the
 * extension uses it as its "Google loaded more results" signal.
 */
function installPerformanceObserverStub(window) {
  const instances = [];

  class PerformanceObserverStub {
    constructor(callback) {
      this.callback = callback;
      this.observedOptions = null;
      this.disconnected = false;
      instances.push(this);
    }
    observe(options) {
      this.observedOptions = options;
    }
    disconnect() {
      this.disconnected = true;
    }
  }

  window.PerformanceObserver = PerformanceObserverStub;

  return {
    instances,
    /**
     * Fires every registered observer with a synthetic entry batch.
     *
     * @param {Array<{initiatorType: string, name: string}>} entries
     */
    emit(entries) {
      for (const observer of instances) {
        observer.callback({ getEntries: () => entries });
      }
    },
    /** Convenience: emit the entry shape the extension treats as "more results". */
    emitSearchXhr(name = "https://www.google.com/search?q=test&ei=abc") {
      this.emit([{ initiatorType: "xmlhttprequest", name }]);
    },
  };
}

/**
 * jsdom implements `textContent` but not `innerText`, and `program.js` reads and
 * writes `innerText` in its emoji stripper.
 *
 * The shim maps `innerText` onto `textContent`. That is not a faithful
 * reproduction — real `innerText` is layout-aware, collapses whitespace, and
 * skips hidden nodes — but it preserves the property under test: assigning to
 * it replaces all child nodes with a single text node.
 */
function installInnerTextShim(window) {
  Object.defineProperty(window.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
    set(value) {
      this.textContent = value;
    },
  });
}

/**
 * jsdom ships no `window.CSS` at all, and the content script asks
 * `CSS.supports("selector(:has(*))")` to decide whether it can express its rules
 * in CSS or has to fall back to a scripted parent walk.
 *
 * Without this the answer is "no support" in every test, and the CSS path — the
 * thing actually under test — never runs.
 *
 * The implementation is not a hardcoded `true`: it answers `selector(...)`
 * queries by putting the selector through jsdom's own engine, so it reports what
 * this environment can genuinely match. jsdom's engine (nwsapi) does support
 * `:has()`, which is what makes the rework testable here at all.
 */
function installCssSupportsStub(window) {
  if (window.CSS == null) window.CSS = {};

  if (typeof window.CSS.supports !== "function") {
    window.CSS.supports = (condition) => {
      const selector = /^\s*selector\((.*)\)\s*$/s.exec(String(condition));
      if (selector === null) return false;

      try {
        window.document.querySelector(selector[1]);
        return true;
      } catch {
        return false;
      }
    };
  }
}

const SERP_ITEMTYPE = "http://schema.org/SearchResultsPage";

/**
 * Wraps a body fragment in a document that looks like a Google results page.
 *
 * `checkIfRun()` gates on `<html itemtype="…SearchResultsPage">`, so that
 * attribute is what makes a fixture "a SERP" as far as the extension cares.
 *
 * @param {string} body Inner HTML for `<body>`.
 * @param {object} [options]
 * @param {string|null} [options.itemtype] `itemtype` value, or null to omit it.
 */
export function serpDocument(body = "", { itemtype = SERP_ITEMTYPE } = {}) {
  const attr = itemtype === null ? "" : ` itemscope itemtype="${itemtype}"`;
  return `<!DOCTYPE html><html${attr}><head><title>test - Google Search</title></head><body>${body}</body></html>`;
}

/**
 * Builds a jsdom window with all stubs installed but no extension code loaded.
 *
 * @param {object} [options]
 * @param {string} [options.url] Page URL — decides whether `checkIfRun()` passes.
 * @param {string} [options.html] Full HTML document.
 * @param {object} [options.store] Seed contents of `chrome.storage.sync`.
 */
export function createEnvironment({
  url = "https://www.google.com/search?q=test",
  html = serpDocument(),
  store = {},
} = {}) {
  const dom = new JSDOM(html, { url, runScripts: "outside-only", pretendToBeVisual: true });
  const { window } = dom;

  const chromeStub = createChromeStub(store);
  window.chrome = chromeStub.chrome;
  // Firefox exposes the same surface as `browser`; the extension only uses
  // `chrome`, but mirroring it keeps the stub honest about the real environment.
  window.browser = chromeStub.chrome;

  const performanceObserver = installPerformanceObserverStub(window);
  installInnerTextShim(window);
  installCssSupportsStub(window);

  /** Uncaught errors thrown by extension code, so tests can assert on crashes. */
  const errors = [];
  window.addEventListener("error", (event) => errors.push(event.error ?? event.message));

  // jsdom fires `load` on its own once parsing settles. Callers must await this
  // rather than dispatching a synthetic `load`, otherwise popup.js runs its
  // whole setup twice and every listener ends up registered twice over — which
  // silently cancels out anything implemented as a toggle.
  const loaded = new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));

  return { dom, window, document: window.document, ...chromeStub, performanceObserver, errors, loaded };
}

/**
 * Evaluates one or more source files from the extension directory inside a jsdom
 * window, as a single unit.
 *
 * `window.eval` is an indirect eval, so the code runs in global scope and its
 * top-level `function` declarations become properties of `window` — exactly how
 * a real classic content script behaves.
 *
 * Multiple files are concatenated rather than eval'd one at a time. In a browser,
 * scripts listed together in `content_scripts.js` (or as sibling `<script>` tags)
 * share one global lexical environment, so a top-level `const` in `defaults.js` is
 * visible to `program.js`. Separate `eval` calls would not reproduce that —
 * `let`/`const` stay confined to each eval's own scope. Concatenating restores the
 * sharing that the real loading order provides.
 */
export function evaluateInWindow(window, ...filenames) {
  window.eval(filenames.map(readExtensionFile).join("\n;\n"));
}

/**
 * Loads `program.js` (the content script) into a fresh environment and waits
 * for its asynchronous storage bootstrap to settle.
 *
 * @param {object} [options] Same options as {@link createEnvironment}.
 * @returns The environment, plus the extension's global functions.
 */
export async function loadProgram(options = {}) {
  const env = createEnvironment(options);
  // Same order as `content_scripts.js` in the manifest.
  evaluateInWindow(env.window, "defaults.js", "rules.js", "program.js");
  await flush();
  await flush();
  return env;
}

/**
 * Loads `popup.html` + `popup.js`, waits for the window `load` event the popup
 * hangs all of its setup on, then lets its storage bootstrap settle.
 *
 * @param {object} [options]
 * @param {object} [options.store] Seed contents of `chrome.storage.sync`.
 */
export async function loadPopup({ store = {} } = {}) {
  const env = createEnvironment({
    url: "chrome-extension://abcdefghijklmnop/popup.html",
    html: readExtensionFile("popup.html"),
    store,
  });

  // Same order as the <script> tags in popup.html.
  evaluateInWindow(env.window, "defaults.js", "popup.js");
  await env.loaded;
  await flush();
  await flush();

  return env;
}

/**
 * Builds a chain of nested `<div>`s, `depth` levels deep, and returns both ends.
 *
 * The extension addresses elements as "this selector, then hop N parents up", so
 * fixtures need precise, known nesting depth.
 *
 * @param {Document} document
 * @param {number} depth Number of ancestors to place above the leaf.
 * @param {object} [leaf] Attributes for the innermost element.
 * @param {string} [leaf.className]
 * @param {string} [leaf.id]
 * @param {string} [leaf.text]
 * @returns {{root: Element, leaf: Element, ancestors: Element[]}}
 */
export function buildNested(document, depth, leaf = {}) {
  const leafElement = document.createElement("div");
  if (leaf.className) leafElement.className = leaf.className;
  if (leaf.id) leafElement.id = leaf.id;
  if (leaf.text) leafElement.textContent = leaf.text;

  const ancestors = [];
  let current = leafElement;
  for (let i = 0; i < depth; i++) {
    const parent = document.createElement("div");
    parent.setAttribute("data-level", String(depth - i));
    parent.appendChild(current);
    ancestors.unshift(parent);
    current = parent;
  }

  return { root: current, leaf: leafElement, ancestors };
}

/**
 * True when the element is hidden as far as the page is concerned.
 *
 * Reads the *computed* style rather than the inline one. The extension hides
 * almost everything through an injected stylesheet gated on classes on `<html>`,
 * so there is no inline style to look at — and checking the cascade is what
 * actually answers "would the user see this".
 *
 * jsdom's cascade does evaluate `:has()`, which is what makes the CSS-based rules
 * testable here at all. The `:has()`-free fallback path writes inline styles, and
 * this covers that too.
 *
 * @param {Element} element
 */
export function isHidden(element) {
  if (element == null) return false;

  const window = element.ownerDocument.defaultView;
  return window.getComputedStyle(element).display === "none";
}

/**
 * The text of the stylesheet the content script injects at document_start, or
 * null if it has not been injected.
 */
export function removalStyleSheet(env) {
  const style = env.document.getElementById("gsc-removal-styles");
  return style === null ? null : style.textContent;
}

/** The text of the colour stylesheet, or null if it has not been injected. */
export function colorStyleSheet(env) {
  const style = env.document.getElementById("gsc-color-styles");
  return style === null ? null : style.textContent;
}

/** The gating classes currently on `<html>`. */
export function gatingClasses(env) {
  return [...env.document.documentElement.classList].filter((name) => name.startsWith("gsc-"));
}
