/**
 * Packaging checks. These catch the class of mistake that only shows up when a
 * store rejects the upload or a user reports "the icon is missing".
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readManifest, EXTENSION_DIR, REPO_ROOT } from "./helpers/harness.js";

const manifest = readManifest();

describe("manifest.json", () => {
  test("is Manifest V3", () => {
    assert.equal(manifest.manifest_version, 3);
  });

  test("declares a name, description, and a store-legal version", () => {
    assert.ok(manifest.name.length > 0 && manifest.name.length <= 75);
    assert.ok(manifest.description.length > 0 && manifest.description.length <= 132);
    assert.match(manifest.version, /^\d+(\.\d+){0,3}$/);
  });

  test("keeps its version in step with package.json", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"));
    assert.equal(pkg.version, manifest.version, "bump both, or neither");
  });

  test("every referenced file exists on disk", () => {
    const referenced = [
      ...Object.values(manifest.icons),
      manifest.action.default_icon,
      manifest.action.default_popup,
      ...manifest.content_scripts.flatMap((entry) => entry.js ?? []),
      ...manifest.content_scripts.flatMap((entry) => entry.css ?? []),
    ];

    for (const file of new Set(referenced)) {
      assert.ok(fs.existsSync(path.join(EXTENSION_DIR, file)), `${file} is referenced but missing`);
    }
  });

  test("requests only the storage permission", () => {
    assert.deepEqual([...manifest.permissions].sort(), ["storage"]);
  });

  test("declares the Firefox add-on id required for signing", () => {
    assert.match(manifest.browser_specific_settings.gecko.id, /^\{[0-9a-f-]{36}\}$/);
  });

  test("registers exactly one content script, in dependency order", () => {
    // rules.js reads AD_CONTAINERS from itself and program.js reads REMOVAL_RULES from
    // rules.js, all as top-level consts in a shared global lexical environment — so the
    // order here is load-bearing, not cosmetic.
    assert.equal(manifest.content_scripts.length, 1);
    assert.deepEqual(manifest.content_scripts[0].js, ["defaults.js", "rules.js", "program.js"]);
  });

  test("runs the content script at document_start", () => {
    assert.equal(manifest.content_scripts[0].run_at, "document_start");
  });
});

describe("source files", () => {
  test("the extension directory contains no stray files", () => {
    const expected = [
      "defaults.js",
      "icon128.png",
      "icon16.png",
      "icon48.png",
      "manifest.json",
      "popup.html",
      "popup.js",
      "program.js",
      "rules.js",
      "style.css",
    ];

    assert.deepEqual(fs.readdirSync(EXTENSION_DIR).sort(), expected);
  });

  test("no source file contains a leftover debugger statement", () => {
    for (const file of ["program.js", "popup.js"]) {
      const source = fs.readFileSync(path.join(EXTENSION_DIR, file), "utf8");
      assert.ok(!/^\s*debugger\b/m.test(source), `${file} contains a debugger statement`);
    }
  });
});
