/**
 * Tests for the options popup: DOM wiring, persistence, and the round trip
 * between popup.html, popup.js, and chrome.storage.sync.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { loadPopup, readExtensionFile, readManifest, flush } from "./helpers/harness.js";

/** Fires the event popup.js listens for on a control. */
function fire(env, id, type = "change") {
  env.document.getElementById(id).dispatchEvent(new env.window.Event(type));
}

/** Checks a box and dispatches the change event, like a real click would. */
function toggle(env, id, checked = true) {
  env.document.getElementById(id).checked = checked;
  fire(env, id, "change");
}

describe("popup DOM wiring", () => {
  test("every element popup.js looks up exists in popup.html", async () => {
    const env = await loadPopup();
    // Line comments are stripped first: popup.js keeps a few commented-out
    // lookups (the disabled "Move URL" feature) that must not count as live.
    const source = readExtensionFile("popup.js").replace(/^\s*\/\/.*$/gm, "");

    const ids = [...source.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)]
      .map((match) => match[1])
      .filter((id, index, all) => all.indexOf(id) === index);

    assert.ok(ids.length > 20, "sanity: the popup wires up a lot of controls");

    const missing = ids.filter((id) => env.document.getElementById(id) === null);
    assert.deepEqual(missing, [], `popup.js references ids that popup.html does not define`);
  });

  test("every checkbox in popup.html is wired to a config key in popup.js", async () => {
    const env = await loadPopup();
    const source = readExtensionFile("popup.js");

    const unwired = [...env.document.querySelectorAll('input[type="checkbox"]')]
      .map((input) => input.id)
      .filter((id) => !source.includes(`getElementById("${id}")`));

    assert.deepEqual(unwired, [], "checkboxes present in the markup but never wired up");
  });

  test("loading the popup with an empty store seeds a default configuration", async () => {
    const env = await loadPopup({ store: {} });

    assert.equal(env.calls.storageSets.length, 1);
    assert.equal(env.storedConfiguration().adsDisplay, "normal");
  });
});

describe("persisting changes", () => {
  test("checking a box writes the key to storage and pushes it to the tab", async () => {
    const env = await loadPopup({ store: { configuration: { removeUrl: false } } });
    const setsBefore = env.calls.storageSets.length;

    toggle(env, "removeUrlCheckBox", true);
    await flush();
    await flush();

    assert.equal(env.storedConfiguration().removeUrl, true);
    assert.ok(env.calls.storageSets.length > setsBefore, "the change was persisted");
    assert.equal(env.calls.sentMessages.at(-1).payload.configuration.removeUrl, true);
  });

  test("unchecking a box writes false", async () => {
    const env = await loadPopup({ store: { configuration: { removeUrl: true } } });

    toggle(env, "removeUrlCheckBox", false);
    await flush();
    await flush();

    assert.equal(env.storedConfiguration().removeUrl, false);
  });

  test("selecting an ad display mode persists the radio value", async () => {
    const env = await loadPopup({ store: { configuration: { adsDisplay: "normal" } } });

    const radio = [...env.document.querySelectorAll(".adsDisplay")].find((r) => r.value === "remove");
    radio.checked = true;
    radio.dispatchEvent(new env.window.Event("change"));
    await flush();
    await flush();

    assert.equal(env.storedConfiguration().adsDisplay, "remove");
  });

  test("picking a URL color persists the hex value when the picker closes", async () => {
    const env = await loadPopup({ store: { configuration: { urlColor: "#008000" } } });

    const picker = env.document.getElementById("urlColorSelection");
    picker.value = "#ff00ff";
    picker.dispatchEvent(new env.window.Event("change"));
    await flush();
    await flush();

    assert.equal(env.storedConfiguration().urlColor, "#ff00ff");
  });

  test("the dark mode button toggles the class and persists the theme", async () => {
    const env = await loadPopup({ store: { configuration: { theme: "light" } } });

    env.document.getElementById("darkModeToggle").dispatchEvent(new env.window.Event("click"));
    await flush();
    await flush();

    assert.ok(env.document.body.classList.contains("dark-mode"));
    assert.equal(env.storedConfiguration().theme, "dark");

    env.document.getElementById("darkModeToggle").dispatchEvent(new env.window.Event("click"));
    await flush();
    await flush();

    assert.ok(!env.document.body.classList.contains("dark-mode"));
    assert.equal(env.storedConfiguration().theme, "light");
  });
});

describe("restoring the stored configuration into the UI", () => {
  test("checkboxes reflect what is in storage", async () => {
    const env = await loadPopup({
      store: {
        configuration: {
          removeUrl: true,
          removeArrow: false,
          colorUrl: true,
          newsWidget: true,
          askWidget: false,
          urlColor: "#123456",
          adBackgroundColor: "#abcdef",
          adsDisplay: "standOut2",
        },
      },
    });

    assert.equal(env.document.getElementById("removeUrlCheckBox").checked, true);
    assert.equal(env.document.getElementById("removeArrowCheckBox").checked, false);
    assert.equal(env.document.getElementById("colorUrlCheckBox").checked, true);
    assert.equal(env.document.getElementById("newsWidgetCheckBox").checked, true);
    assert.equal(env.document.getElementById("askWidgetCheckBox").checked, false);
    assert.equal(env.document.getElementById("urlColorSelection").value, "#123456");
    assert.equal(env.document.getElementById("adBackgroundColorSelection").value, "#abcdef");
  });

  test("each checkbox reads its own configuration key", async () => {
    // Regression cover for B1: setUI assigned the "Places to visit" checkbox from
    // `configuration.relatedProductsServicesWidget`, a copy-paste from the line
    // above it. The box showed a neighbouring setting's value on every open, so a
    // user with the feature on saw it reported as off — and clicking to "enable"
    // it turned it off instead.
    const env = await loadPopup({
      store: {
        configuration: { placesToVisitWidget: true, relatedProductsServicesWidget: false },
      },
    });

    assert.equal(env.document.getElementById("placesToVisitWidgetCheckBox").checked, true);
    assert.equal(env.document.getElementById("relatedProductsServicesWidgetCheckBox").checked, false);
  });

  test("the same two settings stay independent in the other direction", async () => {
    const env = await loadPopup({
      store: {
        configuration: { placesToVisitWidget: false, relatedProductsServicesWidget: true },
      },
    });

    assert.equal(env.document.getElementById("placesToVisitWidgetCheckBox").checked, false);
    assert.equal(env.document.getElementById("relatedProductsServicesWidgetCheckBox").checked, true);
  });

  test("no two checkboxes are driven by the same configuration key", async () => {
    // The general form of B1. Turn each setting on one at a time and confirm
    // exactly one box responds.
    const env = await loadPopup({ store: {} });
    const defaults = env.storedConfiguration();

    const booleanKeys = Object.keys(defaults).filter((key) => typeof defaults[key] === "boolean");

    for (const key of booleanKeys) {
      const single = await loadPopup({ store: { configuration: { ...defaults, [key]: true } } });
      const checked = [...single.document.querySelectorAll('input[type="checkbox"]')]
        .filter((box) => box.checked)
        .map((box) => box.id);

      // `moveUrl` and `removeArrow`-style keys with no visible control show zero.
      assert.ok(checked.length <= 1, `${key} lit up ${checked.length} checkboxes: ${checked}`);
    }
  });

  test("the ad display radio matches the stored mode", async () => {
    const env = await loadPopup({ store: { configuration: { adsDisplay: "standOut1" } } });

    const checked = [...env.document.querySelectorAll(".adsDisplay")].filter((r) => r.checked);
    assert.equal(checked.length, 1);
    assert.equal(checked[0].value, "standOut1");
  });

  test("dark mode is applied on open when it is the stored theme", async () => {
    const env = await loadPopup({ store: { configuration: { theme: "dark" } } });

    assert.ok(env.document.body.classList.contains("dark-mode"));
  });
});

describe("Restore Defaults", () => {
  test("clears every toggle, rewrites storage, and notifies the tab", async () => {
    const env = await loadPopup({
      store: { configuration: { removeUrl: true, newsWidget: true, adsDisplay: "remove", theme: "light" } },
    });

    env.document.getElementById("defaultSettings").dispatchEvent(new env.window.Event("click"));
    await flush();
    await flush();

    assert.equal(env.document.getElementById("removeUrlCheckBox").checked, false);
    assert.equal(env.document.getElementById("newsWidgetCheckBox").checked, false);
    assert.equal(env.storedConfiguration().removeUrl, false);
    assert.equal(env.storedConfiguration().adsDisplay, "normal");
    assert.equal(env.calls.sentMessages.at(-1).payload.configuration.adsDisplay, "normal");
  });
});

describe("the refresh notice", () => {
  // Every setting now takes effect on the open page in both directions, so the popup no
  // longer carries a blanket "please refresh" banner. Remove Emojis is the exception:
  // it rewrites the text of the results, so switching it off cannot put the deleted
  // characters back without a reload.

  test("is hidden when Remove Emojis is off", async () => {
    const env = await loadPopup({ store: { configuration: { removeEmojis: false } } });

    assert.equal(env.document.getElementById("message").hidden, true);
  });

  test("is shown when Remove Emojis is on", async () => {
    const env = await loadPopup({ store: { configuration: { removeEmojis: true } } });

    assert.equal(env.document.getElementById("message").hidden, false);
    assert.match(env.document.getElementById("message").textContent, /Remove Emojis/);
  });

  test("appears and disappears as the setting is toggled", async () => {
    const env = await loadPopup({ store: { configuration: { removeEmojis: false } } });

    toggle(env, "removeEmojisCheckBox", true);
    assert.equal(env.document.getElementById("message").hidden, false);

    toggle(env, "removeEmojisCheckBox", false);
    assert.equal(env.document.getElementById("message").hidden, true);
  });

  test("no other setting brings it up", async () => {
    const env = await loadPopup({ store: { configuration: {} } });

    toggle(env, "newsWidgetCheckBox", true);
    toggle(env, "removeUrlCheckBox", true);

    assert.equal(env.document.getElementById("message").hidden, true);
  });
});

describe("colour pickers", () => {
  // Regression cover for B12. `input` fires continuously while a colour picker is
  // dragged and `change` once, when it closes. Both used to write to
  // chrome.storage.sync, which is rate limited to roughly 120 writes a minute — so a
  // few seconds of dragging exceeded the quota and the later writes were rejected
  // silently, leaving the chosen colour unsaved.

  test("dragging previews without touching storage", async () => {
    const env = await loadPopup({ store: { configuration: { urlColor: "#008000" } } });
    const writes = env.calls.storageSets.length;
    const sends = env.calls.sentMessages.length;
    const picker = env.document.getElementById("urlColorSelection");

    for (let i = 0; i < 10; i++) {
      picker.value = `#0080${String(i).padStart(2, "0")}`;
      picker.dispatchEvent(new env.window.Event("input"));
      await flush();
      await flush();
    }

    assert.equal(env.calls.storageSets.length - writes, 0, "no writes while dragging");
    assert.ok(env.calls.sentMessages.length > sends, "but the page follows along");
    assert.equal(env.calls.sentMessages.at(-1).payload.configuration.urlColor, "#008009");
  });

  test("closing the picker saves exactly once", async () => {
    const env = await loadPopup({ store: { configuration: { urlColor: "#008000" } } });
    const writes = env.calls.storageSets.length;
    const picker = env.document.getElementById("urlColorSelection");

    for (let i = 0; i < 10; i++) {
      picker.value = `#0080${String(i).padStart(2, "0")}`;
      picker.dispatchEvent(new env.window.Event("input"));
    }
    picker.value = "#123456";
    picker.dispatchEvent(new env.window.Event("change"));
    await flush();
    await flush();

    assert.equal(env.calls.storageSets.length - writes, 1);
    assert.equal(env.storedConfiguration().urlColor, "#123456");
  });

  test("the ad background picker behaves the same way", async () => {
    const env = await loadPopup({ store: { configuration: { adBackgroundColor: "#faebd7" } } });
    const writes = env.calls.storageSets.length;
    const picker = env.document.getElementById("adBackgroundColorSelection");

    picker.value = "#112233";
    picker.dispatchEvent(new env.window.Event("input"));
    await flush();
    assert.equal(env.calls.storageSets.length - writes, 0);

    picker.dispatchEvent(new env.window.Event("change"));
    await flush();
    await flush();
    assert.equal(env.storedConfiguration().adBackgroundColor, "#112233");
  });
});

describe("storage traffic", () => {
  test("a settings change writes without reading first", async () => {
    // Regression cover for B17. The popup holds the configuration in memory and is the
    // only writer while it is open, so re-reading storage before each write was pure
    // overhead — and it doubled the cost of B12.
    const env = await loadPopup({ store: { configuration: { removeUrl: false, removeArrow: false } } });
    const reads = env.calls.storageGets.length;
    const writes = env.calls.storageSets.length;

    toggle(env, "removeUrlCheckBox", true);
    toggle(env, "removeArrowCheckBox", true);
    await flush();
    await flush();

    assert.equal(env.calls.storageGets.length - reads, 0, "no extra reads");
    assert.equal(env.calls.storageSets.length - writes, 2, "one write per change");
  });

  test("the in-memory copy stays in step with what was written", async () => {
    const env = await loadPopup({ store: { configuration: {} } });

    toggle(env, "removeUrlCheckBox", true);
    toggle(env, "newsWidgetCheckBox", true);
    toggle(env, "removeUrlCheckBox", false);
    await flush();
    await flush();

    assert.equal(env.storedConfiguration().removeUrl, false);
    assert.equal(env.storedConfiguration().newsWidget, true);
    assert.equal(env.calls.sentMessages.at(-1).payload.configuration.newsWidget, true);
  });
});

describe("notifying open tabs", () => {
  // Regression cover for B16. The popup used to message only the active tab in the
  // current window, so with several search pages open the rest kept the old appearance
  // until reloaded — and it read tabs[0].id unguarded, which threw when the array was
  // empty.

  test("messages every open tab, not just the active one", async () => {
    const env = await loadPopup({ store: { configuration: {} } });
    env.setQueryResult([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const sent = env.calls.sentMessages.length;

    toggle(env, "removeUrlCheckBox", true);
    await flush();
    await flush();

    const delivered = env.calls.sentMessages.slice(sent);
    assert.deepEqual(
      delivered.map((m) => m.tabId),
      [1, 2, 3],
    );
    assert.ok(delivered.every((m) => m.payload.configuration.removeUrl === true));
  });

  test("does not filter tabs by URL, which would need the tabs permission", async () => {
    const env = await loadPopup({ store: { configuration: {} } });

    toggle(env, "removeUrlCheckBox", true);
    await flush();
    await flush();

    assert.deepEqual(Object.keys(env.calls.tabQueries.at(-1)), []);
    assert.deepEqual(readManifest().permissions, ["storage"]);
  });

  test("survives an empty tab list without throwing", async () => {
    // On a chrome:// page, the New Tab page, or the Web Store there is no content
    // script and the query can come back empty.
    const env = await loadPopup({ store: { configuration: {} } });
    env.setQueryResult([]);
    const errors = env.calls.callbackErrors.length;

    toggle(env, "removeUrlCheckBox", true);
    await flush();
    await flush();

    assert.equal(env.calls.callbackErrors.length - errors, 0, "no exception");
    assert.equal(env.storedConfiguration().removeUrl, true, "and the setting is still saved");
  });

  test("skips tabs with no id rather than throwing", async () => {
    const env = await loadPopup({ store: { configuration: {} } });
    env.setQueryResult([{ id: 1 }, {}, null, { id: 4 }]);
    const errors = env.calls.callbackErrors.length;
    const sent = env.calls.sentMessages.length;

    toggle(env, "removeUrlCheckBox", true);
    await flush();
    await flush();

    assert.equal(env.calls.callbackErrors.length - errors, 0);
    assert.deepEqual(
      env.calls.sentMessages.slice(sent).map((m) => m.tabId),
      [1, 4],
    );
  });
});

describe("popup markup quality", () => {
  test("the popup declares its stylesheet and scripts, deferred", async () => {
    const env = await loadPopup();

    assert.ok(env.document.querySelector('link[rel="stylesheet"][href="style.css"]'));

    for (const src of ["defaults.js", "popup.js"]) {
      const script = env.document.querySelector(`script[src="${src}"]`);
      assert.ok(script, `${src} is loaded`);
      assert.ok(script.hasAttribute("defer"), `${src} is deferred`);
    }
  });

  test("declares a language and a character encoding", async () => {
    const env = await loadPopup();

    assert.equal(env.document.documentElement.getAttribute("lang"), "en");
    assert.ok(env.document.querySelector("meta[charset]"));
  });

  test("no id is used twice", async () => {
    // Regression cover for B14: four <h5> elements shared id="adTitle".
    const env = await loadPopup();

    const ids = [...env.document.querySelectorAll("[id]")].map((el) => el.id);
    const duplicated = ids.filter((id, index) => ids.indexOf(id) !== index);

    assert.deepEqual([...new Set(duplicated)], []);
  });

  test("section headings are spelled correctly", async () => {
    const env = await loadPopup();

    const headings = [...env.document.querySelectorAll(".sectionTitle")].map((h) => h.textContent);
    assert.deepEqual(headings, [
      "URL Position and Appearance",
      "Ad Settings",
      "Widget Settings",
      "Additional Settings",
    ]);
  });

  test("every checkbox and radio has a label bound to it", async () => {
    // Regression cover for B15. Without a label the caption is not a click target —
    // each control was a ~13px hit area — and screen readers announce it with no name.
    const env = await loadPopup();

    const controls = [...env.document.querySelectorAll('input[type="checkbox"], input[type="radio"]')];
    assert.ok(controls.length > 30);

    const unlabelled = controls.filter(
      (control) => !env.document.querySelector(`label[for="${control.id}"]`) && !control.closest("label"),
    );

    assert.deepEqual(
      unlabelled.map((c) => c.id),
      [],
    );
  });

  test("every label points at a control that exists", async () => {
    const env = await loadPopup();

    const dangling = [...env.document.querySelectorAll("label[for]")]
      .map((label) => label.getAttribute("for"))
      .filter((id) => env.document.getElementById(id) === null);

    assert.deepEqual(dangling, []);
  });

  test("the colour inputs carry an accessible name", async () => {
    const env = await loadPopup();

    for (const id of ["urlColorSelection", "adBackgroundColorSelection"]) {
      const input = env.document.getElementById(id);
      const named =
        input.getAttribute("aria-label") || env.document.querySelector(`label[for="${id}"]`);

      assert.ok(named, `${id} has no accessible name`);
    }
  });

  test("outbound links open in a new tab, without handing over the opener", async () => {
    const env = await loadPopup();

    for (const anchor of env.document.querySelectorAll("a[href^='http']")) {
      assert.equal(anchor.target, "_blank", `${anchor.href} should open in a new tab`);
      assert.match(anchor.rel, /noopener/, `${anchor.href} should set rel=noopener`);
    }
  });
});
