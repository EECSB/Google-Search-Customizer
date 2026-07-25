/**
 * Tests for the parts of program.js that still touch the DOM directly.
 *
 * Most of what used to live here went away with the CSS rework: `removeElements`,
 * `removeElementsFromTo`, `removePaddingBeforeWidget`, `setUrlColor`, `ApplyToClass`
 * and `forEachDoThis` were all machinery for hiding things by writing inline styles,
 * and the stylesheet does that now. See tests/stylesheet.test.js.
 *
 * What remains is:
 *   - the parent walk, still used by the fallback for browsers without :has()
 *   - the collapse-marking pass, which CSS cannot express
 *   - the shopping-tab check, which several rules depend on
 *   - the error containment around all of it
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { loadProgram, serpDocument, buildNested, isHidden } from "./helpers/harness.js";

/** Loads the content script against a SERP whose <body> is `body`. */
async function withBody(body) {
  return loadProgram({ html: serpDocument(body) });
}

describe("getParentNode", () => {
  test("returns the element itself for a hop count of 0", async () => {
    const env = await withBody('<div class="leaf"></div>');
    const leaf = env.document.querySelector(".leaf");

    assert.equal(env.window.getParentNode(leaf, 0), leaf);
  });

  test("walks exactly N ancestors up", async () => {
    const env = await withBody("");
    const { root, leaf, ancestors } = buildNested(env.document, 4, { className: "leaf" });
    env.document.body.appendChild(root);

    assert.equal(env.window.getParentNode(leaf, 1), ancestors[3]);
    assert.equal(env.window.getParentNode(leaf, 2), ancestors[2]);
    assert.equal(env.window.getParentNode(leaf, 4), root);
  });

  test("treats a negative hop count as zero rather than rejecting it", async () => {
    const env = await withBody('<div class="leaf"></div>');
    const leaf = env.document.querySelector(".leaf");

    assert.equal(env.window.getParentNode(leaf, -1), leaf);
  });

  test("stops at <html> instead of walking on to the document", async () => {
    const env = await withBody('<div class="leaf"></div>');
    const leaf = env.document.querySelector(".leaf");

    assert.equal(env.window.getParentNode(leaf, 2), env.document.documentElement);
    assert.equal(env.window.getParentNode(leaf, 3), env.document.documentElement);
  });

  test("returns <html> rather than throwing when the hop count overshoots", async () => {
    // Regression cover for B8. The walk used to use parentNode without a bound, so it
    // reached the document, then null, then threw on null.parentNode.
    const env = await withBody('<div class="leaf"></div>');
    const leaf = env.document.querySelector(".leaf");

    for (const hops of [4, 10, 16, 100]) {
      assert.doesNotThrow(() => env.window.getParentNode(leaf, hops), `${hops} hops`);
      assert.equal(env.window.getParentNode(leaf, hops), env.document.documentElement);
    }
  });
});

describe("isSafeToHide", () => {
  test("rejects nothing, <html>, and <body>", async () => {
    // A hop count that overshoots lands on <html>; hiding that would blank the page.
    const env = await withBody('<div class="leaf"></div>');

    assert.equal(env.window.isSafeToHide(null), false);
    assert.equal(env.window.isSafeToHide(undefined), false);
    assert.equal(env.window.isSafeToHide(env.document.documentElement), false);
    assert.equal(env.window.isSafeToHide(env.document.body), false);
    assert.equal(env.window.isSafeToHide(env.document.querySelector(".leaf")), true);
  });
});

describe("attempt", () => {
  test("contains a failure and logs it with context", async () => {
    const env = await withBody("<div></div>");
    const warnings = [];
    env.window.console.warn = (...args) => warnings.push(args.join(" "));

    assert.doesNotThrow(() =>
      env.window.attempt("doing a thing", () => {
        throw new Error("boom");
      }),
    );

    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /Google Search Customizer: doing a thing failed/);
  });

  test("lets a successful action through untouched", async () => {
    const env = await withBody("<div></div>");
    let ran = false;

    env.window.attempt("fine", () => {
      ran = true;
    });

    assert.equal(ran, true);
  });

  test("one failing step does not stop the ones after it", async () => {
    // The failure mode B8 was really about: applying a configuration is a sequence of
    // independent steps, and one throw used to end the whole run.
    const env = await withBody('<h3 class="LC20lb">Title 🍕</h3>');
    env.window.console.warn = () => {};

    // Break the first scripted pass, then confirm the emoji pass still runs.
    env.window.markCollapseTargets = () => {
      throw new Error("broken");
    };

    assert.doesNotThrow(() => env.window.applyScriptedPasses({ removeEmojis: true }));
    assert.equal(env.document.querySelector(".LC20lb").textContent, "Title ");
  });
});

describe("isShoppingTab", () => {
  test("recognises the Shopping tab from the url", async () => {
    for (const url of [
      "https://www.google.com/search?q=shoes&udm=28",
      "https://www.google.com/search?q=shoes&sclient=gws-wiz-modeless-shopping",
    ]) {
      const env = await loadProgram({ url, html: serpDocument() });
      assert.equal(env.window.isShoppingTab(), true, url);
    }
  });

  test("recognises it from the search form when the url does not say", async () => {
    // sclient=gws-wiz-modeless-shopping only appears once a search has been run from
    // inside the Shopping tab, so the first switch to it has to be detected another way.
    const env = await withBody('<form id="searchform"><a href="/shopping?sca_esv=abc123">Shopping</a></form>');

    assert.equal(env.window.isShoppingTab(), true);
  });

  test("says no on the ordinary results tab", async () => {
    const env = await withBody('<form id="searchform"><a href="/search?q=x">All</a></form>');

    assert.equal(env.window.isShoppingTab(), false);
  });

  test("says no when the page has no search form at all", async () => {
    const env = await withBody("");

    assert.equal(env.window.isShoppingTab(), false);
  });
});

describe("collapse marking", () => {
  /** A widget at `hops` above `.selector`, preceded by a sibling with a margin. */
  function mountWidget(document, selector, hops) {
    const { root, ancestors } = buildNested(document, hops + 1, { className: selector.slice(1) });
    const widget = ancestors[ancestors.length - hops];

    const previous = document.createElement("div");
    previous.id = "previousResult";
    widget.parentElement.insertBefore(previous, widget);

    document.body.appendChild(root);
    return { widget, previous };
  }

  test("marks the sibling before the widget", async () => {
    const env = await withBody("");
    const { previous } = mountWidget(env.document, ".EN1f2d", 4);

    env.window.markCollapseTargets({ askWidget: true });

    assert.equal(previous.getAttribute("data-gsc-collapse"), "askWidget");
  });

  test("the margin comes from the stylesheet, so it goes away with the setting", async () => {
    // Marking is one-way, but the rule that acts on the mark is gated on the same class
    // as the removal, so switching the setting off restores the spacing.
    const env = await withBody("");
    const { previous } = mountWidget(env.document, ".EN1f2d", 4);

    env.window.modifySearchResults({ askWidget: true });
    assert.equal(env.window.getComputedStyle(previous).margin, "0px");

    env.window.modifySearchResults({ askWidget: false });
    assert.notEqual(env.window.getComputedStyle(previous).margin, "0px");
  });

  test("marks the widget itself when it has no preceding sibling", async () => {
    const env = await withBody("");
    const { root, ancestors } = buildNested(env.document, 5, { className: "EN1f2d" });
    env.document.body.appendChild(root);
    const widget = ancestors[ancestors.length - 4];

    env.window.markCollapseTargets({ askWidget: true });

    assert.equal(widget.getAttribute("data-gsc-collapse"), "askWidget");
  });

  test("does nothing when the setting is off", async () => {
    const env = await withBody("");
    const { previous } = mountWidget(env.document, ".EN1f2d", 4);

    env.window.markCollapseTargets({ askWidget: false });

    assert.equal(previous.getAttribute("data-gsc-collapse"), null);
  });

  test("marking twice does not duplicate the entry", async () => {
    const env = await withBody("");
    const { previous } = mountWidget(env.document, ".EN1f2d", 4);

    env.window.markCollapseTargets({ askWidget: true });
    env.window.markCollapseTargets({ askWidget: true });

    assert.equal(previous.getAttribute("data-gsc-collapse"), "askWidget");
  });

  test("one element can be marked for more than one setting", async () => {
    // The attribute holds a space-separated list, matched with [attr~="key"], so an
    // element that precedes two different widgets carries both keys.
    //
    // "People also ask" and "Top stories" both collapse four levels above their
    // marker class, so a container holding both resolves to the same widget element
    // and therefore to the same preceding sibling.
    const env = await withBody(
      '<div id="container">' +
        '<div id="previousResult"></div>' +
        '<div id="widget"><div><div><div>' +
        '<span class="EN1f2d"></span><span class="aUSklf"></span>' +
        "</div></div></div></div>" +
        "</div>",
    );

    env.window.markCollapseTargets({ askWidget: true, newsWidget: true });

    const marked = env.document.getElementById("previousResult").getAttribute("data-gsc-collapse");
    assert.deepEqual(marked.split(" ").sort(), ["askWidget", "newsWidget"]);
  });

  test("both settings' margin rules match an element marked for both", async () => {
    const env = await withBody(
      '<div id="container">' +
        '<div id="previousResult"></div>' +
        '<div id="widget"><div><div><div>' +
        '<span class="EN1f2d"></span><span class="aUSklf"></span>' +
        "</div></div></div></div>" +
        "</div>",
    );
    const previous = env.document.getElementById("previousResult");

    env.window.modifySearchResults({ askWidget: true, newsWidget: true });
    assert.equal(env.window.getComputedStyle(previous).margin, "0px");

    // Switching one off leaves the other's rule applying.
    env.window.modifySearchResults({ askWidget: false, newsWidget: true });
    assert.equal(env.window.getComputedStyle(previous).margin, "0px");

    env.window.modifySearchResults({ askWidget: false, newsWidget: false });
    assert.notEqual(env.window.getComputedStyle(previous).margin, "0px");
  });

  test("the twitter widget's spacing is collapsed, which the old call site never did", async () => {
    // Finding B5: removePaddingBeforeWidgetFromTo(".M42dy", 8) passed two arguments to a
    // three-argument function, so it silently did nothing. The table has no call sites to
    // get wrong.
    const env = await withBody("");
    const { root, ancestors } = buildNested(env.document, 4, { className: "M42dy" });
    ancestors[1].className = "ULSxyf";

    const previous = env.document.createElement("div");
    previous.id = "previousResult";
    ancestors[0].insertBefore(previous, ancestors[1]);
    env.document.body.appendChild(root);

    env.window.modifySearchResults({ twitterWidget: true });

    assert.equal(env.window.getComputedStyle(previous).margin, "0px");
  });
});

describe("the fallback for browsers without :has()", () => {
  /** Forces the fallback path and returns a freshly loaded environment. */
  async function withoutHasSupport(body) {
    const env = await loadProgram({ html: serpDocument(body) });
    env.window.supportsHasSelector = () => false;
    return env;
  }

  test("hides the ancestor at the requested hop count by script", async () => {
    const env = await withoutHasSupport("");
    const { root, leaf, ancestors } = buildNested(env.document, 6, { className: "EN1f2d" });
    env.document.body.appendChild(root);
    const expected = ancestors[ancestors.length - 4];

    env.window.hideWithoutHasSupport({ askWidget: true });

    assert.ok(isHidden(expected), "the 4-hop ancestor is hidden");
    assert.ok(!isHidden(leaf), "the matched element itself is untouched");
  });

  test("hides the nearest matching ancestor for an ancestor target", async () => {
    const env = await withoutHasSupport("");
    const { root, ancestors } = buildNested(env.document, 5, { className: "M42dy" });
    ancestors[1].className = "ULSxyf";
    env.document.body.appendChild(root);

    env.window.hideWithoutHasSupport({ twitterWidget: true });

    assert.ok(isHidden(ancestors[1]));
  });

  test("leaves plain targets to CSS, which works on every browser", async () => {
    const env = await withoutHasSupport('<div class="byrV5b">example.com</div>');
    const url = env.document.querySelector(".byrV5b");

    env.window.hideWithoutHasSupport({ removeUrl: true });
    assert.equal(url.style.display, "", "no inline style was written");

    env.document.documentElement.classList.add("gsc-removeUrl");
    assert.ok(isHidden(url), "the stylesheet still handles it");
  });

  test("refuses to hide <html> or <body> when a hop count overshoots", async () => {
    const env = await withoutHasSupport('<div class="dnXCYb">shallow</div>');

    env.window.hideWithoutHasSupport({ thingsToKnowWidget: true });

    assert.ok(!isHidden(env.document.documentElement), "the page is still visible");
    assert.ok(!isHidden(env.document.body));
  });

  test("does nothing when the setting is off", async () => {
    const env = await withoutHasSupport("");
    const { root, ancestors } = buildNested(env.document, 6, { className: "EN1f2d" });
    env.document.body.appendChild(root);

    env.window.hideWithoutHasSupport({});

    assert.ok(!isHidden(ancestors[ancestors.length - 4]));
  });
});
