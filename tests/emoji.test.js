/**
 * Tests for the "Remove Emojis" setting.
 *
 * Regression cover for two findings:
 *
 *   B6  The old pattern used hand-written code point ranges. `[‑-⛿]`
 *       alone covered 1,775 code points — General Punctuation, Letterlike
 *       Symbols, Arrows, Mathematical Operators — so it deleted en dashes, curly
 *       quotes, ellipses and arrows out of ordinary result titles.
 *       `[-]` added the Private Use Area on top.
 *
 *   B7  The result was written back with `element.innerText = cleaned`, which
 *       replaces every child node, flattening the `<em>` tags Google puts around
 *       matched search terms and any nested links.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { loadProgram, serpDocument } from "./helpers/harness.js";

/** Runs the emoji stripper over one result title and returns the text. */
async function stripFrom(text) {
  const env = await loadProgram({ html: serpDocument(`<h3 class="LC20lb">${text}</h3>`) });
  env.window.modifySearchResults({ removeEmojis: true });
  return env.document.querySelector(".LC20lb").textContent;
}

describe("removing emojis", () => {
  const REMOVED = [
    ["a plain emoji", "Best pizza 🍕 near me", "Best pizza  near me"],
    ["several emoji", "🔥🔥 Deals 🔥", " Deals "],
    ["an emoji with a skin tone modifier", "Wave 👋🏽 hello", "Wave  hello"],
    ["a zero-width-joiner sequence", "Family 👨‍👩‍👧‍👦 photo", "Family  photo"],
    ["a flag built from regional indicators", "Made in 🇺🇸 today", "Made in  today"],
    ["a symbol with an emoji variation selector", "I ❤️ this", "I  this"],
    ["a pictograph that defaults to text presentation", "Sunny ☀ day", "Sunny  day"],
  ];

  for (const [label, input, expected] of REMOVED) {
    test(`removes ${label}`, async () => {
      // Multi-code-point emoji have to be consumed as a unit. Matching only the
      // base character would strip the visible glyph and leave the skin tone
      // modifier or joiner behind as mojibake.
      assert.equal(await stripFrom(input), expected);
    });
  }

  test("does nothing when the setting is off", async () => {
    const env = await loadProgram({ html: serpDocument('<h3 class="LC20lb">Pizza 🍕 here</h3>') });

    env.window.modifySearchResults({ removeEmojis: false });

    assert.equal(env.document.querySelector(".LC20lb").textContent, "Pizza 🍕 here");
  });

  test("covers titles and snippets alike", async () => {
    const env = await loadProgram({
      html: serpDocument('<h3 class="LC20lb">Title 🍕</h3><div class="VwiC3b">Snippet 🚀</div>'),
    });

    env.window.modifySearchResults({ removeEmojis: true });

    assert.equal(env.document.querySelector(".LC20lb").textContent, "Title ");
    assert.equal(env.document.querySelector(".VwiC3b").textContent, "Snippet ");
  });
});

describe("leaving ordinary punctuation alone", () => {
  const PRESERVED = [
    ["en dash", "Node.js – the JavaScript runtime"],
    ["em dash", "Rust—a systems language"],
    ["curly apostrophe", "It’s a guide"],
    ["curly quotes", "The “best” option"],
    ["ellipsis", "Read more…"],
    ["trademark sign", "Acme™ Widgets"],
    ["copyright and registered signs", "© 2024 Example®"],
    ["arrows", "Tutorial → part 1 ⇒ done"],
    ["mathematical operators", "5 ≤ 10 and 5 ± 2 × 3"],
    ["currency symbols", "Price: €30 / £25 / ¥400"],
    ["fractions and ordinals", "½ cup · N° 5"],
    ["non-breaking hyphen", "Item ‑ part two"],
    ["accented Latin text", "Ünïcödé áccents ñ ß æ"],
    ["CJK text", "日本語のテキスト 中文 한국어"],
    ["Cyrillic, Greek, Hebrew, and Arabic", "Математика Ελληνικά עברית العربية"],
  ];

  for (const [label, input] of PRESERVED) {
    test(`keeps the ${label}`, async () => {
      assert.equal(await stripFrom(input), input);
    });
  }

  test("the em dash case does not weld two words together", async () => {
    // The worst of the old behaviour: it deleted the separator without leaving a
    // space, so "Rust—a systems language" became "Rusta systems language".
    const result = await stripFrom("Rust—a systems language");

    assert.ok(!result.includes("Rusta"));
    assert.equal(result, "Rust—a systems language");
  });
});

describe("preserving markup", () => {
  test("keeps the <em> Google wraps around matched search terms", async () => {
    const env = await loadProgram({
      html: serpDocument('<div class="VwiC3b">Learn <em>JavaScript</em> — free 🚀</div>'),
    });

    env.window.modifySearchResults({ removeEmojis: true });

    const snippet = env.document.querySelector(".VwiC3b");
    assert.ok(snippet.querySelector("em"), "the highlighting survives");
    assert.equal(snippet.querySelector("em").textContent, "JavaScript");
    assert.equal(snippet.textContent, "Learn JavaScript — free ");
  });

  test("keeps nested links inside a title", async () => {
    const env = await loadProgram({
      html: serpDocument('<h3 class="LC20lb">Docs <a href="https://example.com" id="deep">API 🚀</a></h3>'),
    });

    env.window.modifySearchResults({ removeEmojis: true });

    const anchor = env.document.getElementById("deep");
    assert.ok(anchor, "the anchor is still an element");
    assert.equal(anchor.getAttribute("href"), "https://example.com");
    assert.equal(anchor.textContent, "API ");
  });

  test("strips emoji from nested elements, not just the top-level text", async () => {
    const env = await loadProgram({
      html: serpDocument('<div class="VwiC3b">Outer 🍕 <span><b>deep 🚀 text</b></span></div>'),
    });

    env.window.modifySearchResults({ removeEmojis: true });

    const snippet = env.document.querySelector(".VwiC3b");
    assert.equal(snippet.textContent, "Outer  deep  text");
    assert.ok(snippet.querySelector("b"), "the nesting is intact");
  });

  test("leaves text nodes untouched when they contain no emoji", async () => {
    const env = await loadProgram({
      html: serpDocument('<div class="VwiC3b">Learn <em>JavaScript</em> for free</div>'),
    });
    const before = env.document.querySelector(".VwiC3b").innerHTML;

    env.window.modifySearchResults({ removeEmojis: true });

    assert.equal(env.document.querySelector(".VwiC3b").innerHTML, before);
  });
});
