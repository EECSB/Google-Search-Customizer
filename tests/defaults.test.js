/**
 * Tests for defaults.js — the shared configuration object.
 *
 * Regression cover for two findings:
 *
 *   B2  The defaults used to be written out by hand in three places (the content
 *       script's cold start, the popup's cold start, and "Restore Defaults") and
 *       two of the copies had drifted apart, so whether `aboutWidget` and
 *       `popularExploreBuyWidget` were ever saved depended on whether the user
 *       opened a search page or the popup first.
 *
 *   B3  Nothing merged current defaults over a stored configuration, so settings
 *       added in an update never reached users who already had one saved.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { loadProgram, loadPopup, serpDocument, flush, readExtensionFile } from "./helpers/harness.js";

/** Defaults the content script seeds when storage is empty. */
async function programDefaults() {
  const env = await loadProgram({ html: serpDocument(), store: {} });
  return env.calls.storageSets.at(-1).configuration;
}

/** Defaults the popup seeds when storage is empty. */
async function popupSeedDefaults() {
  const env = await loadPopup({ store: {} });
  return env.calls.storageSets.at(-1).configuration;
}

/** Defaults the "Restore Defaults" button writes. */
async function restoreButtonDefaults() {
  const env = await loadPopup({ store: { configuration: { removeUrl: true } } });
  env.document.getElementById("defaultSettings").dispatchEvent(new env.window.Event("click"));
  await flush();
  await flush();
  return env.calls.storageSets.at(-1).configuration;
}

describe("one shared defaults object", () => {
  test("the content script, the popup, and Restore Defaults all agree", async () => {
    const fromProgram = await programDefaults();
    const fromPopup = await popupSeedDefaults();
    const fromButton = await restoreButtonDefaults();

    assert.deepEqual(Object.keys(fromPopup).sort(), Object.keys(fromProgram).sort());
    assert.deepEqual(Object.keys(fromButton).sort(), Object.keys(fromProgram).sort());
    assert.deepEqual(fromPopup, fromProgram);
    assert.deepEqual(fromButton, fromProgram);
  });

  test("the two keys that used to be missing from the popup's copy are present", async () => {
    const fromPopup = await popupSeedDefaults();

    assert.equal(fromPopup.aboutWidget, false);
    assert.equal(fromPopup.popularExploreBuyWidget, false);
  });

  test("it is the only place default values are written down", () => {
    // If a second copy reappears this test is what catches it. Matching on a
    // key *assigned a literal default* rather than a bare mention, so that
    // `changeConfig("adsDisplay", …)` in popup.js does not count.
    const declaresDefault = /"(?:adsDisplay|urlColor|adBackgroundColor)"\s*:\s*"/;

    for (const file of ["program.js", "popup.js"]) {
      assert.ok(
        !declaresDefault.test(readExtensionFile(file)),
        `${file} declares configuration defaults of its own`,
      );
    }

    assert.match(readExtensionFile("defaults.js"), declaresDefault);
  });

  test("it is loaded before both scripts that depend on it", () => {
    const manifest = JSON.parse(readExtensionFile("manifest.json"));
    assert.equal(manifest.content_scripts[0].js[0], "defaults.js", "first in the content script list");

    const popupHtml = readExtensionFile("popup.html");
    assert.ok(
      popupHtml.indexOf('src="defaults.js"') < popupHtml.indexOf('src="popup.js"'),
      "defaults.js must come first in popup.html",
    );
  });

  test("every widget toggle defaults to off, and the value settings have sensible defaults", async () => {
    const defaults = await programDefaults();

    assert.equal(defaults.adsDisplay, "normal");
    assert.equal(defaults.theme, "light");
    assert.equal(defaults.urlColor, "#008000");
    assert.equal(defaults.adBackgroundColor, "#faebd7");

    const booleans = Object.entries(defaults).filter(([, value]) => typeof value === "boolean");
    assert.ok(booleans.length > 25);
    assert.deepEqual(
      booleans.filter(([, value]) => value !== false),
      [],
      "the extension must do nothing until the user asks it to",
    );
  });
});

describe("merging stored configurations over the defaults", () => {
  test("a configuration saved by an older version gains the newer keys", async () => {
    const legacy = { removeUrl: true, adsDisplay: "remove", urlColor: "#008000" };
    const env = await loadProgram({ html: serpDocument(), store: { configuration: legacy } });

    const stored = env.storedConfiguration();
    assert.equal("aiModeTab" in stored, true, "a setting added after the stored copy was written");
    assert.equal("placesToVisitWidget" in stored, true);
    assert.equal(stored.aiModeTab, false, "and it defaults to off");
  });

  test("the user's own choices survive the merge", async () => {
    const legacy = { removeUrl: true, adsDisplay: "remove", urlColor: "#123456" };
    const env = await loadProgram({ html: serpDocument(), store: { configuration: legacy } });

    const stored = env.storedConfiguration();
    assert.equal(stored.removeUrl, true);
    assert.equal(stored.adsDisplay, "remove");
    assert.equal(stored.urlColor, "#123456");
  });

  test("the upgraded configuration is written back, not just held in memory", async () => {
    const env = await loadProgram({
      html: serpDocument(),
      store: { configuration: { removeUrl: true } },
    });

    assert.equal(env.calls.storageSets.length, 1, "the gaps are repaired in storage");
  });

  test("a complete configuration is left alone", async () => {
    const complete = await programDefaults();
    const env = await loadProgram({ html: serpDocument(), store: { configuration: complete } });

    assert.equal(env.calls.storageSets.length, 0, "no pointless write when nothing is missing");
  });

  test("the popup repairs a stored configuration too", async () => {
    const env = await loadPopup({ store: { configuration: { removeUrl: true } } });

    assert.equal("aiModeTab" in env.storedConfiguration(), true);
    assert.equal(env.document.getElementById("aiModeTabCheckBox").checked, false);
    assert.equal(env.document.getElementById("removeUrlCheckBox").checked, true);
  });

  test("a configuration pushed from the popup is completed before it is applied", async () => {
    // The popup sends whatever it has. If that predates a setting, the content
    // script must still see a defined value rather than `undefined`.
    const env = await loadProgram({ html: serpDocument('<div class="olrp5b"><i></i></div>') });

    assert.doesNotThrow(() =>
      env.calls.messageListeners[0]({ configuration: { removeUrl: true } }, {}, () => {}),
    );
  });
});

describe("the shared defaults object cannot be mutated by accident", () => {
  // `DEFAULT_CONFIGURATION` is a top-level `const`, so it lives in the global
  // lexical environment rather than on `window` — in a real browser as much as in
  // the harness. These tests therefore go through the accessor that is reachable,
  // which is also the only way the extension itself touches it.

  test("it is frozen at the point of declaration", () => {
    assert.match(readExtensionFile("defaults.js"), /const DEFAULT_CONFIGURATION = Object\.freeze\(/);
  });

  test("applyConfigurationDefaults hands back a fresh, writable copy each time", async () => {
    const env = await loadProgram({ html: serpDocument() });

    const first = env.window.applyConfigurationDefaults(null);
    const second = env.window.applyConfigurationDefaults(null);

    assert.notEqual(first, second, "not the same object twice");
    assert.equal(first.removeUrl, false);

    first.removeUrl = true;

    assert.equal(second.removeUrl, false, "copies are independent");
    assert.equal(
      env.window.applyConfigurationDefaults(null).removeUrl,
      false,
      "and the shared object behind them is untouched",
    );
  });

  test("a stored configuration passed in is not mutated either", async () => {
    const env = await loadProgram({ html: serpDocument() });
    const stored = { removeUrl: true };

    const merged = env.window.applyConfigurationDefaults(stored);

    assert.equal(merged.removeUrl, true);
    assert.deepEqual(Object.keys(stored), ["removeUrl"], "the caller's object is left alone");
  });

  test("configurationNeedsUpgrade recognises absent, partial, and complete input", async () => {
    const env = await loadProgram({ html: serpDocument() });
    const { configurationNeedsUpgrade, applyConfigurationDefaults } = env.window;

    assert.equal(configurationNeedsUpgrade(null), true, "absent");
    assert.equal(configurationNeedsUpgrade(undefined), true, "absent");
    assert.equal(configurationNeedsUpgrade({}), true, "empty");
    assert.equal(configurationNeedsUpgrade({ removeUrl: true }), true, "partial");
    assert.equal(configurationNeedsUpgrade(applyConfigurationDefaults(null)), false, "complete");
  });
});
