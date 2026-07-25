/**
 * Tests for when the content script activates, how it bootstraps its configuration,
 * and what it still needs to re-run when Google appends more results.
 *
 * Includes regression cover for finding P1: the script runs at document_start and
 * puts its stylesheet in place before the page has a body, so nothing is ever
 * visible before being hidden.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  loadProgram,
  createEnvironment,
  evaluateInWindow,
  serpDocument,
  flush,
  removalStyleSheet,
  isHidden,
  readManifest,
} from "./helpers/harness.js";

const SERP = "https://www.google.com/search?q=test";

describe("isGoogleDomain", () => {
  // Regression cover for B10. The old check was
  // `window.location.href.includes(".google.")`, which tested the whole URL rather
  // than the hostname — a path or query string was enough to satisfy it.

  const GOOGLE = [
    "https://www.google.com/search?q=test",
    "https://google.com/search?q=test",
    "https://www.google.co.uk/search?q=test",
    "https://www.google.com.au/search?q=test",
    "https://google.de/search?q=test",
    "https://www.google.cat/search?q=test",
    "https://images.google.com/",
  ];

  for (const url of GOOGLE) {
    test(`accepts ${new URL(url).hostname}`, async () => {
      const env = await loadProgram({ url, html: serpDocument() });
      assert.equal(env.window.isGoogleDomain(), true);
    });
  }

  const NOT_GOOGLE = [
    ["a Google URL in the query string", "https://example.com/redirect?to=https%3A%2F%2Fwww.google.com%2Fsearch"],
    ["a Google URL in the path", "https://example.com/www.google.com/search"],
    ["a hostname merely ending in google", "https://notgoogle.com/search?q=test"],
    ["a subdomain trick", "https://google.com.evil.example/search?q=test"],
    ["an unrelated search engine", "https://duckduckgo.com/?q=test"],
  ];

  for (const [label, url] of NOT_GOOGLE) {
    test(`rejects ${label}`, async () => {
      const env = await loadProgram({ url, html: serpDocument() });

      assert.equal(env.window.isGoogleDomain(), false);
      assert.equal(env.window.checkIfRun(), false, "and so the gate rejects the page");
      assert.equal(removalStyleSheet(env), null, "and nothing is injected");
    });
  }

  test("the manifest only injects into Google domains", () => {
    const matches = readManifest().content_scripts[0].matches;

    assert.ok(!matches.includes("<all_urls>"), "no blanket injection");
    assert.ok(matches.length > 100, "one pattern per Google ccTLD");

    for (const pattern of matches) {
      assert.match(pattern, /^\*:\/\/\*\.google\.[a-z.]+\/\*$/, `unexpected pattern: ${pattern}`);
    }

    assert.ok(matches.includes("*://*.google.com/*"));
    assert.ok(matches.includes("*://*.google.co.uk/*"));
  });

  test("every manifest pattern is one isGoogleDomain also accepts", async () => {
    // The two gates have to agree, or the extension is injected somewhere it then
    // refuses to run — or worse, runs somewhere the manifest did not intend.
    const env = await loadProgram({ html: serpDocument() });
    const hostnamePattern = /(^|\.)google(\.[a-z]{2,3})+$/;

    for (const pattern of readManifest().content_scripts[0].matches) {
      const host = pattern.replace(/^\*:\/\/\*\./, "").replace(/\/\*$/, "");

      assert.ok(hostnamePattern.test(host), `${host} is injected but would be rejected`);
      assert.ok(hostnamePattern.test("www." + host), `www.${host} likewise`);
    }

    assert.equal(typeof env.window.isGoogleDomain, "function");
  });
});

describe("checkIfRun", () => {
  test("activates on a Google results page", async () => {
    const env = await loadProgram({ url: SERP, html: serpDocument() });

    assert.equal(env.window.checkIfRun(), true);
  });

  test("activates on non-.com Google domains", async () => {
    for (const url of [
      "https://www.google.co.uk/search?q=test",
      "https://www.google.de/search?q=test",
      "https://www.google.com.au/search?q=test",
    ]) {
      const env = await loadProgram({ url, html: serpDocument() });
      assert.equal(env.window.checkIfRun(), true, url);
    }
  });

  test("says no on a Google page that is not a results page", async () => {
    const env = await loadProgram({
      url: "https://www.google.com/maps",
      html: serpDocument("", { itemtype: "http://schema.org/WebPage" }),
    });

    assert.equal(env.window.checkIfRun(), false);
  });

  test("says no on a non-Google site", async () => {
    const env = await loadProgram({
      url: "https://duckduckgo.com/?q=test",
      html: serpDocument(),
    });

    assert.equal(env.window.checkIfRun(), false);
  });

  test("answers undefined — not false — when <html> carries no itemtype yet", async () => {
    // The three-state answer matters at document_start: the check reads an attribute
    // off <html>, and "the parser has not got there yet" has to be distinguishable
    // from "this is not a search page", or the extension would give up too early.
    const env = await loadProgram({
      url: "https://www.google.com/",
      html: serpDocument("", { itemtype: null }),
    });

    assert.equal(env.window.checkIfRun(), undefined);
  });

  test("activates late when the itemtype only appears after parsing", async () => {
    // Built at a lower level than loadProgram so the attribute can be added in the
    // window between the content script running and DOMContentLoaded firing — which
    // is exactly the case the three-state answer exists for.
    const env = createEnvironment({
      url: SERP,
      html: serpDocument('<div class="byrV5b">example.com</div>', { itemtype: null }),
      store: { configuration: { removeUrl: true } },
    });

    evaluateInWindow(env.window, "defaults.js", "rules.js", "program.js");
    assert.equal(env.window.checkIfRun(), undefined, "cannot tell yet");
    assert.ok(!isHidden(env.document.querySelector(".byrV5b")), "nothing applied yet");

    // The parser reaches Google's markup and fills in the attribute.
    env.document.documentElement.setAttribute("itemtype", "http://schema.org/SearchResultsPage");

    await env.loaded;
    await flush();
    await flush();

    assert.ok(isHidden(env.document.querySelector(".byrV5b")), "the second check caught it");
  });
});

describe("P1 — the stylesheet is in place before the page paints", () => {
  test("it is injected on a document that has no body yet", async () => {
    // At document_start the parser has produced <html> and nothing else. Injecting
    // here is what stops ads and widgets being visible before they disappear.
    const env = await loadProgram({
      html: "<!DOCTYPE html><html itemscope itemtype='http://schema.org/SearchResultsPage'></html>",
    });

    assert.ok(removalStyleSheet(env), "the stylesheet is present");
  });

  test("rules apply to elements that did not exist when it was injected", async () => {
    const env = await loadProgram({
      html: serpDocument(),
      store: { configuration: { removeUrl: true } },
    });

    const appended = env.document.createElement("div");
    appended.className = "byrV5b";
    env.document.body.appendChild(appended);

    assert.ok(isHidden(appended), "hidden the moment it entered the document");
  });

  test("the manifest asks for document_start", () => {
    // Without this the script runs at document_idle — after the page has painted —
    // and the user watches the ads disappear instead of never seeing them.
    assert.equal(readManifest().content_scripts[0].run_at, "document_start");
  });

  test("nothing is injected on a site that is not Google", async () => {
    const env = await loadProgram({ url: "https://example.com/", html: serpDocument() });

    assert.equal(removalStyleSheet(env), null);
    assert.equal(env.calls.storageGets.length, 0);
  });
});

describe("configuration bootstrap", () => {
  test("writes a default configuration on first run", async () => {
    const env = await loadProgram({ url: SERP, html: serpDocument(), store: {} });

    assert.equal(env.calls.storageSets.length, 1, "exactly one write on a cold start");
    const stored = env.storedConfiguration();
    assert.equal(stored.adsDisplay, "normal");
    assert.equal(stored.urlColor, "#008000");
    assert.equal(stored.theme, "light");
  });

  test("reuses an existing configuration, repairing any gaps in it", async () => {
    const env = await loadProgram({
      url: SERP,
      html: serpDocument(),
      store: { configuration: { removeUrl: true, adsDisplay: "remove" } },
    });

    assert.equal(env.storedConfiguration().removeUrl, true, "the user's choices are kept");
    assert.equal(env.storedConfiguration().adsDisplay, "remove");
    assert.equal(env.storedConfiguration().theme, "light", "and the gaps are filled in");
  });

  test("applies the stored configuration to the page on load", async () => {
    const env = await loadProgram({
      url: SERP,
      html: serpDocument('<div class="byrV5b">example.com</div>'),
      store: { configuration: { removeUrl: true } },
    });

    assert.ok(isHidden(env.document.querySelector(".byrV5b")));
  });

  test("reads no storage at all when the gate rejects the site", async () => {
    const env = await loadProgram({
      url: "https://example.com/",
      html: serpDocument('<div class="byrV5b">example.com</div>'),
      store: {},
    });

    assert.equal(env.calls.storageGets.length, 0);
    assert.equal(env.calls.storageSets.length, 0);
    assert.ok(!isHidden(env.document.querySelector(".byrV5b")));
  });
});

describe("re-applying after Google appends more results", () => {
  test("new results need no re-application at all for CSS-driven settings", async () => {
    // This is what the PerformanceObserver used to exist for. The stylesheet matches
    // whatever arrives, so endless scroll is handled without any work.
    const env = await loadProgram({
      url: SERP,
      html: serpDocument(),
      store: { configuration: { newsWidget: true } },
    });

    // .aUSklf is hidden four levels up, which is `wrapper` itself.
    const wrapper = env.document.createElement("div");
    wrapper.innerHTML = '<div><div><div><div class="aUSklf">Top stories</div></div></div></div>';
    env.document.body.appendChild(wrapper);

    assert.ok(isHidden(wrapper), "hidden without an observer firing");
  });

  test("observes resource timing entries on a results page", async () => {
    const env = await loadProgram({ url: SERP, html: serpDocument() });

    assert.equal(env.performanceObserver.instances.length, 1);
    assert.equal(env.performanceObserver.instances[0].observedOptions.type, "resource");
  });

  test("registers no observer when the gate rejects the page", async () => {
    const env = await loadProgram({
      url: "https://www.google.com/maps",
      html: serpDocument("", { itemtype: "http://schema.org/WebPage" }),
    });

    assert.equal(env.performanceObserver.instances.length, 0);
  });

  test("re-runs the emoji pass over newly arrived results", async () => {
    // Emoji removal edits text, so it is the one thing that cannot be expressed as
    // CSS and still needs the observer.
    const env = await loadProgram({
      url: SERP,
      html: serpDocument(),
      store: { configuration: { removeEmojis: true } },
    });

    const appended = env.document.createElement("h3");
    appended.className = "LC20lb";
    appended.textContent = "Second page 🍕";
    env.document.body.appendChild(appended);
    assert.equal(appended.textContent, "Second page 🍕", "untouched until the observer fires");

    env.performanceObserver.emitSearchXhr();
    await flush();

    assert.equal(appended.textContent, "Second page ");
  });

  test("ignores resource entries that are not search requests", async () => {
    const env = await loadProgram({ url: SERP, html: serpDocument(), store: { configuration: {} } });
    const before = env.calls.storageGets.length;

    env.performanceObserver.emit([
      { initiatorType: "xmlhttprequest", name: "https://www.google.com/gen_204?atyp=i" },
      { initiatorType: "script", name: "https://www.google.com/search?q=x" },
      { initiatorType: "img", name: "https://www.google.com/logo.png" },
    ]);
    await flush();

    assert.equal(env.calls.storageGets.length, before, "no extra storage read");
  });

  test("accepts fetch as well as xmlhttprequest", async () => {
    const env = await loadProgram({ url: SERP, html: serpDocument(), store: { configuration: {} } });
    const before = env.calls.storageGets.length;

    env.performanceObserver.emit([{ initiatorType: "fetch", name: "https://www.google.com/search?q=x&start=10" }]);
    await flush();

    assert.equal(env.calls.storageGets.length, before + 1);
  });
});

describe("popup -> content script messaging", () => {
  test("registers a runtime message listener", async () => {
    const env = await loadProgram({ url: SERP, html: serpDocument() });

    assert.equal(env.calls.messageListeners.length, 1);
  });

  test("applies a configuration pushed from the popup", async () => {
    const env = await loadProgram({
      url: SERP,
      html: serpDocument('<div class="byrV5b">example.com</div>'),
      store: { configuration: {} },
    });

    env.calls.messageListeners[0]({ configuration: { removeUrl: true } }, {}, () => {});

    assert.ok(isHidden(env.document.querySelector(".byrV5b")));
  });

  test("ignores a message on a Google page that is not a results page", async () => {
    // Regression cover for B11. The listener has to be registered before the page is
    // known to be a SERP — the popup may send at any time — so the gate is re-checked
    // when the message arrives instead.
    const env = await loadProgram({
      url: "https://www.google.com/maps",
      html: serpDocument('<div class="byrV5b">a Google page that is not a SERP</div>', {
        itemtype: "http://schema.org/WebPage",
      }),
    });

    assert.equal(env.calls.messageListeners.length, 1, "the listener is registered");

    env.calls.messageListeners[0]({ configuration: { removeUrl: true } }, {}, () => {});

    assert.ok(!isHidden(env.document.querySelector(".byrV5b")), "but the message was ignored");
    assert.deepEqual(
      [...env.document.documentElement.classList].filter((c) => c.startsWith("gsc-")),
      [],
      "and no gating class was applied",
    );
  });

  test("no listener at all away from Google", async () => {
    const env = await loadProgram({
      url: "https://example.com/blog",
      html: serpDocument("", { itemtype: null }),
    });

    assert.equal(env.calls.messageListeners.length, 0);
  });

  test("un-applies it again when the setting is switched back off", async () => {
    const env = await loadProgram({
      url: SERP,
      html: serpDocument('<div class="byrV5b">example.com</div>'),
      store: { configuration: { removeUrl: true } },
    });
    const url = env.document.querySelector(".byrV5b");
    assert.ok(isHidden(url));

    env.calls.messageListeners[0]({ configuration: { removeUrl: false } }, {}, () => {});

    assert.ok(!isHidden(url), "no reload needed");
  });
});
