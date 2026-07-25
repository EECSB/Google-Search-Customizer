/**
 * Tests for rules.js — the declarative rule table and the CSS it generates.
 *
 * This is where the extension's behaviour now lives. Each rule becomes a stylesheet
 * entry gated on a class on `<html>`, injected at document_start, so:
 *
 *   - nothing is ever visible before being hidden (finding P1), and
 *   - switching a setting off puts the content straight back (finding B9).
 *
 * The generated CSS is asserted as text here; that it actually hides the right
 * element is covered by tests/features.test.js, which reads computed styles.
 *
 * Note that `REMOVAL_RULES` is a top-level `const` and so is not reachable as
 * `window.REMOVAL_RULES` — in a browser as much as in the harness. Tests go through
 * `allGatingClasses()`, which is a function declaration and therefore is.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { loadProgram, serpDocument, removalStyleSheet, colorStyleSheet } from "./helpers/harness.js";

/** A configuration with every rule and both colour features switched on. */
function everythingOn(env) {
  const configuration = { adsDisplay: "standOut2", urlColor: "#008000", adBackgroundColor: "#faebd7" };

  for (const className of env.window.allGatingClasses()) {
    configuration[className.replace(/^gsc-/, "")] = true;
  }

  return configuration;
}

describe("targetSelector", () => {
  test("a plain target is used as-is", async () => {
    const env = await loadProgram({ html: serpDocument() });

    assert.equal(env.window.targetSelector({ selector: ".byrV5b" }), ".byrV5b");
    assert.equal(env.window.targetSelector({ selector: "#tads" }), "#tads");
  });

  test("a hop count becomes a :has() chain of that depth", async () => {
    const env = await loadProgram({ html: serpDocument() });
    const { targetSelector } = env.window;

    assert.equal(targetSelector({ selector: ".X", hops: 1 }), "*:has(> .X)");
    assert.equal(targetSelector({ selector: ".X", hops: 2 }), "*:has(> * > .X)");
    assert.equal(targetSelector({ selector: ".X", hops: 3 }), "*:has(> * > * > .X)");
    assert.equal(targetSelector({ selector: ".X", hops: 4 }), "*:has(> * > * > * > .X)");
  });

  test("hop N produces N-1 intermediate levels", async () => {
    const env = await loadProgram({ html: serpDocument() });

    for (const hops of [1, 2, 5, 12, 16]) {
      const selector = env.window.targetSelector({ selector: ".X", hops });
      const intermediates = selector.split("> *").length - 1;

      assert.equal(intermediates, hops - 1, `${hops} hops`);
    }
  });

  test("an ancestor target becomes :has() on that ancestor", async () => {
    const env = await loadProgram({ html: serpDocument() });

    assert.equal(
      env.window.targetSelector({ selector: ".M42dy", ancestor: ".ULSxyf" }),
      ".ULSxyf:has(.M42dy)",
    );
  });

  test("only hop and ancestor targets need :has()", async () => {
    const env = await loadProgram({ html: serpDocument() });
    const { targetNeedsHas } = env.window;

    assert.equal(targetNeedsHas({ selector: ".X" }), false);
    assert.equal(targetNeedsHas({ selector: ".X", hops: 0 }), false);
    assert.equal(targetNeedsHas({ selector: ".X", hops: 1 }), true);
    assert.equal(targetNeedsHas({ selector: ".X", ancestor: ".Y" }), true);
  });
});

describe("the generated stylesheet", () => {
  test("is injected into <html> at startup", async () => {
    const env = await loadProgram({ html: serpDocument() });

    const style = env.document.getElementById("gsc-removal-styles");
    assert.ok(style, "the stylesheet element exists");
    assert.equal(style.parentElement, env.document.documentElement, "appended to <html>");
    assert.ok(style.textContent.length > 500);
  });

  test("is injected before the page has a body", async () => {
    // At document_start there is no <head> and no <body>. The rules still have to
    // apply to elements that do not exist yet — that is the whole point of P1.
    const env = await loadProgram({
      html: "<!DOCTYPE html><html itemscope itemtype='http://schema.org/SearchResultsPage'></html>",
    });

    assert.ok(removalStyleSheet(env), "injected regardless");
  });

  test("is injected only once", async () => {
    const env = await loadProgram({ html: serpDocument() });

    env.window.injectRemovalStyleSheet();
    env.window.injectRemovalStyleSheet();

    assert.equal(env.document.querySelectorAll("#gsc-removal-styles").length, 1);
  });

  test("every gating class the extension can set appears in a stylesheet", async () => {
    const env = await loadProgram({ html: serpDocument() });
    env.window.modifySearchResults(everythingOn(env));

    const css = removalStyleSheet(env) + "\n" + colorStyleSheet(env);

    for (const className of env.window.allGatingClasses()) {
      assert.ok(css.includes("html." + className + " "), `${className} gates nothing`);
    }
  });

  test("every removal rule hides with display:none !important", async () => {
    const env = await loadProgram({ html: serpDocument() });

    // !important is needed because Google sets inline styles on some of these.
    const blocks = removalStyleSheet(env)
      .split("}")
      .filter((block) => block.includes("display:"));

    assert.ok(blocks.length > 20);
    assert.ok(blocks.every((block) => block.includes("display: none !important")));
  });

  test("contains no ungated rule that could affect an unrelated page", async () => {
    const env = await loadProgram({ html: serpDocument() });

    for (const block of removalStyleSheet(env).split("}")) {
      for (const selector of block.split("{")[0].split(",")) {
        if (selector.trim() === "") continue;

        assert.match(selector.trim(), /^html\.gsc-/, `ungated selector: ${selector.trim()}`);
      }
    }
  });

  test("leaves out :has() rules when the browser does not support it", async () => {
    const env = await loadProgram({ html: serpDocument() });

    const withHas = env.window.buildRemovalStyleSheet({ supportsHas: true });
    const withoutHas = env.window.buildRemovalStyleSheet({ supportsHas: false });

    assert.ok(withHas.includes(":has("));
    assert.ok(!withoutHas.includes(":has("), "no :has() anywhere in the fallback sheet");
    assert.ok(withoutHas.includes(".byrV5b"), "plain selectors still work everywhere");
    assert.ok(withoutHas.length < withHas.length);
  });

  test("collapse rules are expressed as an attribute the script sets", async () => {
    // :has() cannot be nested, so CSS cannot say "the sibling before the element
    // that has this descendant". The script marks the element instead, and the
    // margin still comes from the gated stylesheet so it stays reversible.
    const env = await loadProgram({ html: serpDocument() });

    assert.ok(
      removalStyleSheet(env).includes(
        'html.gsc-askWidget [data-gsc-collapse~="askWidget"] { margin: 0px !important; }',
      ),
    );
  });

  test("the ad containers are the same list in both ad modes", async () => {
    // #bottomads used to be tinted by "Really Stand Out" and ignored by "Remove"
    // (finding B18). Both branches now read one shared list.
    const env = await loadProgram({ html: serpDocument() });
    env.window.modifySearchResults({ adsDisplay: "standOut2", adBackgroundColor: "#faebd7" });

    const removal = removalStyleSheet(env);
    const colors = colorStyleSheet(env);

    for (const container of ["#tads", "#tadsb", "#bottomads"]) {
      assert.ok(removal.includes("html.gsc-adsRemove " + container), `${container} is removable`);
      assert.ok(colors.includes("html.gsc-adsStandOut2 " + container), `${container} is tintable`);
    }
  });
});

describe("the colour stylesheet", () => {
  test("is empty when neither colour setting is on", async () => {
    const env = await loadProgram({ html: serpDocument() });

    env.window.modifySearchResults({ colorUrl: false, adsDisplay: "normal" });

    assert.equal(colorStyleSheet(env), "");
  });

  test("colours result and ad URLs when Color URL is on", async () => {
    const env = await loadProgram({ html: serpDocument() });

    env.window.modifySearchResults({ colorUrl: true, urlColor: "#008000" });
    const css = colorStyleSheet(env);

    assert.ok(css.includes("html.gsc-colorUrl .qLRx3b"));
    assert.ok(css.includes("html.gsc-colorUrl .x2VHCd"));
    assert.ok(css.includes("color: #008000 !important"));
  });

  test("tints ad blocks and their descendants under standOut2", async () => {
    const env = await loadProgram({ html: serpDocument() });

    env.window.modifySearchResults({ adsDisplay: "standOut2", adBackgroundColor: "#faebd7" });
    const css = colorStyleSheet(env);

    assert.ok(css.includes("html.gsc-adsStandOut2 #tads:not(:empty)"));
    assert.ok(css.includes("html.gsc-adsStandOut2 #tads:not(:empty) *"));
    assert.ok(css.includes("background-color: #faebd7 !important"));
  });

  test("does not tint under standOut1", async () => {
    const env = await loadProgram({ html: serpDocument() });

    env.window.modifySearchResults({ adsDisplay: "standOut1", adBackgroundColor: "#faebd7" });

    assert.equal(colorStyleSheet(env).includes("background-color"), false);
  });

  test("is rewritten rather than appended to when the colour changes", async () => {
    const env = await loadProgram({ html: serpDocument() });

    env.window.modifySearchResults({ colorUrl: true, urlColor: "#008000" });
    env.window.modifySearchResults({ colorUrl: true, urlColor: "#ff00ff" });

    const css = colorStyleSheet(env);
    assert.ok(css.includes("#ff00ff"));
    assert.ok(!css.includes("#008000"), "the old colour is gone, not just overridden");
    assert.equal(env.document.querySelectorAll("#gsc-color-styles").length, 1);
  });
});

describe("gating classes", () => {
  test("one class goes on <html> per enabled rule", async () => {
    const env = await loadProgram({ html: serpDocument() });

    env.window.modifySearchResults({ newsWidget: true, askWidget: true });

    const classes = [...env.document.documentElement.classList];
    assert.ok(classes.includes("gsc-newsWidget"));
    assert.ok(classes.includes("gsc-askWidget"));
    assert.ok(!classes.includes("gsc-mapsWidget"));
  });

  test("classes are removed again when the setting is switched off", async () => {
    const env = await loadProgram({ html: serpDocument() });

    env.window.modifySearchResults({ newsWidget: true });
    assert.ok(env.document.documentElement.classList.contains("gsc-newsWidget"));

    env.window.modifySearchResults({ newsWidget: false });
    assert.ok(!env.document.documentElement.classList.contains("gsc-newsWidget"));
  });

  test("removing the url implies removing the arrow after it", async () => {
    const env = await loadProgram({ html: serpDocument() });

    for (const key of ["removeArrow", "removeUrl", "moveUrl"]) {
      env.window.modifySearchResults({ [key]: true });
      assert.ok(
        env.document.documentElement.classList.contains("gsc-removeArrow"),
        `${key} should imply gsc-removeArrow`,
      );
    }

    env.window.modifySearchResults({});
    assert.ok(!env.document.documentElement.classList.contains("gsc-removeArrow"));
  });

  test("the ad display mode maps to one class at a time", async () => {
    const env = await loadProgram({ html: serpDocument() });
    const root = env.document.documentElement;
    const adClasses = () =>
      ["gsc-adsRemove", "gsc-adsStandOut", "gsc-adsStandOut2"].filter((c) => root.classList.contains(c));

    env.window.modifySearchResults({ adsDisplay: "remove" });
    assert.deepEqual(adClasses(), ["gsc-adsRemove"]);

    env.window.modifySearchResults({ adsDisplay: "standOut1" });
    assert.deepEqual(adClasses(), ["gsc-adsStandOut"]);

    env.window.modifySearchResults({ adsDisplay: "standOut2" });
    assert.deepEqual(adClasses(), ["gsc-adsStandOut2"]);

    env.window.modifySearchResults({ adsDisplay: "normal" });
    assert.deepEqual(adClasses(), []);
  });

  test("no class is left behind by a configuration that turns everything off", async () => {
    const env = await loadProgram({ html: serpDocument() });

    env.window.modifySearchResults(everythingOn(env));
    assert.ok([...env.document.documentElement.classList].length > 20);

    env.window.modifySearchResults({ adsDisplay: "normal" });
    assert.deepEqual(
      [...env.document.documentElement.classList].filter((c) => c.startsWith("gsc-")),
      [],
    );
  });
});
