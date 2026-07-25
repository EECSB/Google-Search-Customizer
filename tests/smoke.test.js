import test from "node:test";
import assert from "node:assert/strict";
import { loadProgram, loadPopup, serpDocument, isHidden, removalStyleSheet } from "./helpers/harness.js";

test("harness loads the content script and exposes its top-level functions", async () => {
  const env = await loadProgram();

  for (const fn of [
    // program.js
    "checkIfRun",
    "modifySearchResults",
    "applyScriptedPasses",
    "injectRemovalStyleSheet",
    "applyGatingClasses",
    "isShoppingTab",
    "markCollapseTargets",
    "hideWithoutHasSupport",
    "getParentNode",
    "isSafeToHide",
    "removeEmojisFrom",
    "attempt",
    // rules.js
    "targetSelector",
    "targetNeedsHas",
    "buildRemovalStyleSheet",
    "buildColorStyleSheet",
    "gatingClassesFor",
    "allGatingClasses",
    // defaults.js
    "applyConfigurationDefaults",
    "configurationNeedsUpgrade",
  ]) {
    assert.equal(typeof env.window[fn], "function", `${fn} should be a global function`);
  }
});

test("harness applies a setting to a SERP fixture through the stylesheet", async () => {
  const env = await loadProgram({
    html: serpDocument('<div class="byrV5b">example.com</div>'),
  });
  const url = env.document.querySelector(".byrV5b");

  assert.ok(removalStyleSheet(env), "the stylesheet was injected");
  assert.ok(!isHidden(url), "inert until a setting switches it on");

  env.window.modifySearchResults({ removeUrl: true });

  assert.ok(isHidden(url));
  assert.equal(url.style.display, "", "hidden by the cascade, not by an inline style");
});

test("harness loads popup.html and popup.js", async () => {
  const env = await loadPopup();

  assert.ok(env.document.getElementById("removeUrlCheckBox"), "popup DOM is present");
  assert.ok(env.storedConfiguration(), "popup wrote a default configuration");
});
