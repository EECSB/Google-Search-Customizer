/**
 * Behavioural tests for modifySearchResults() — one per user-facing toggle.
 *
 * Every feature in this extension is a "selector + parent hop count" pair against
 * Google's obfuscated markup. Those pairs are the single most fragile thing in the
 * codebase and the most common source of bug reports, so they are pinned here as
 * an explicit table. When Google reshuffles its class names, the table is the
 * place to look, and a failing row tells you exactly which toggle went stale.
 *
 * The fixtures are synthetic: they reproduce the class name and the nesting depth
 * that program.js assumes, not a captured Google page. That is deliberate — the
 * contract under test is "given this class at this depth, hide the ancestor N
 * levels up", which is exactly what the source encodes.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { loadProgram, serpDocument, buildNested, isHidden } from "./helpers/harness.js";

/**
 * The full selector map, transcribed from modifySearchResults().
 *
 * `hops` is how many `parentNode` steps program.js takes before hiding.
 */
const FEATURE_SELECTORS = {
  removeUrl: [
    [".byrV5b", 0, "URL + favicon line under the title"],
    [".qdrjAc", 0, "URL on the inline sitelinks block"],
  ],
  removeArrow: [
    [".B6fmyf", 0, "caret after the URL"],
    [".e1ycic", 0, "caret after an ad URL"],
    [".D6lY4c", 0, "kebab menu shown instead of the caret"],
    [".ONMH0e", 0, "kebab menu on ads"],
  ],
  searchWidget: [
    ["#bres", 0, '"People also search for" / "Related searches"'],
    [".O3JH7", 2, "related-searches variant"],
    [".YR2tRd", 2, "related-searches variant"],
    [".O8VmIc", 2, "related-searches inside image search"],
  ],
  askWidget: [
    [".JolIg", 4, '"People also ask" (legacy)'],
    [".EN1f2d", 4, '"People also ask"'],
    [".Okagcf", 1, '"People also ask" embedded inside a result'],
  ],
  newsWidget: [
    [".AHFbof", 4, "Top stories (variant)"],
    [".aUSklf", 4, "Top stories"],
    [".yG4QQe", 2, "Top stories (variant)"],
  ],
  mapsWidget: [
    [".AEprdc", 1, "map block (legacy)"],
    [".kqmHwe", 1, "map block"],
    [".Lx2b0d", 12, "map + images block"],
    [".XqFnDf", 0, "city name heading"],
  ],
  mapsFindResultsOnWidget: [["#i4BWVe", 1, '"Find results on" block']],
  youtubeWidtget: [
    [".uVMCKf", 0, "YouTube video carousel"],
    [".PYmpec", 4, "YouTube video carousel (variant)"],
  ],
  sideBarWidget: [
    [".liYKde", 1, "knowledge panel"],
    [".Lj180d", 6, "knowledge panel (variant)"],
    [".TQc1id", 0, "knowledge panel (variant)"],
  ],
  ratingsWidget: [
    [".dhIWPd", 1, "star ratings"],
    [".fG8Fp", 1, "star ratings (variant)"],
    [".smukrd", 1, "star ratings (variant)"],
  ],
  thingsToDoWidget: [
    [".IYoemc", 3, '"Things to do" (legacy)'],
    [".NfrtPd.UE0K3b.QsV5nc", 7, '"Things to do"'],
  ],
  thingsToKnowWidget: [[".dnXCYb", 7, '"Things to know"']],
  imagesWidget: [
    ["#iur", 3, "images carousel"],
    [".hisnlb", 8, "images carousel (variant)"],
  ],
  featuredSnippet: [
    ["#Odp5De", 0, "featured snippet"],
    [".yKMVIe", 10, "featured snippet (variant)"],
    [".Wm5I1e", 0, "AI Overview"],
    [".YzCcne", 0, "AI Overview (variant)"],
  ],
  dictionaryWidget: [[".bH1Fqd", 13, "dictionary block"]],
  businessesWidget: [[".ixfGmd", 3, "local businesses block"]],
  topSightsWidget: [[".UXerFf", 6, '"Top sights"']],
  otherMessages: [[".WcS13d", 1, "assorted Google notices"]],
  siteFavicons: [
    [".H9lube", 0, "result favicon"],
    [".DDKf1c", 0, "result favicon (variant)"],
  ],
  aboutWidget: [
    [".bzXtMb", 0, "cast / reviews / key moments"],
    [".yTFeqb.wp-ms.oJxARb.nBWfrd.VE2Ztc", 3, "episodes block"],
    [".GJi8Lc", 6, "about block (variant)"],
    [".dG2XIf", 3, "conversion tables and similar"],
  ],
  popularExploreBuyWidget: [
    [".ednlu.GAJC", 8, '"Popular/Explore brands"'],
    [".OTMJR.IFnjPb.SlP8xc.RES9jf", 4, '"People also buy"'],
  ],
  relatedProductsServicesWidget: [["#HbKV2c", 0, '"Find related products & services"']],
  placesToVisitWidget: [[".J1FGbf", 16, '"Places to visit"']],
  images: [
    [".LnCrMe", 0, "thumbnail beside a result"],
    [".Sth6v", 0, "thumbnail beside a result (variant)"],
    [".AzcMvf", 1, "thumbnail beside a result (variant)"],
    [".SuXxEf", 0, "thumbnail beside a result (variant)"],
    [".EPx5le", 2, "thumbnail beside a result (variant)"],
    [".W27f5e", 1, "thumbnail beside a result (legacy)"],
    [".fWhgmd", 4, "thumbnail beside a result (legacy)"],
  ],
  videoTumbnails: [[".gY2b2c", 0, "video thumbnail"]],
  aiModeTab: [[".olrp5b", 2, '"AI Mode" tab in the search-type bar']],
};

/**
 * Mounts a fixture for one `[selector, hops]` row and returns the node the
 * extension is expected to hide.
 */
/**
 * Computed style of the first element matching `selector`.
 *
 * Colours and spacing come from the injected stylesheet now, not from inline
 * styles, so the cascade is what has to be asked.
 */
function style(env, selector) {
  return env.window.getComputedStyle(env.document.querySelector(selector));
}

/** What a computed background-color reads as when nothing set it. */
const UNTINTED = "rgba(0, 0, 0, 0)";

function mountSelector(document, selector, hops) {
  const leafAttrs =
    selector[0] === "#"
      ? { id: selector.slice(1) }
      : { className: selector.slice(1).split(".").join(" ") };

  const { root, leaf, ancestors } = buildNested(document, hops + 2, leafAttrs);
  document.body.appendChild(root);

  return { leaf, expected: hops === 0 ? leaf : ancestors[ancestors.length - hops] };
}

describe("widget removal selector map", () => {
  for (const [configKey, rows] of Object.entries(FEATURE_SELECTORS)) {
    for (const [selector, hops, description] of rows) {
      test(`${configKey}: hides ${hops} level(s) above ${selector} — ${description}`, async () => {
        const env = await loadProgram({ html: serpDocument() });
        const { expected } = mountSelector(env.document, selector, hops);

        env.window.modifySearchResults({ [configKey]: true });

        assert.ok(isHidden(expected), `${selector} +${hops} should be hidden`);
      });

      test(`${configKey}: leaves ${selector} alone when the toggle is off`, async () => {
        const env = await loadProgram({ html: serpDocument() });
        const { leaf, expected } = mountSelector(env.document, selector, hops);

        env.window.modifySearchResults({});

        assert.ok(!isHidden(expected), `${selector} +${hops} should stay visible`);
        assert.ok(!isHidden(leaf));
      });

      test(`${configKey}: brings ${selector} back when the toggle is switched off`, async () => {
        // Regression cover for B9. Hiding used to be one-way — `style.display = 'none'`
        // was written and never cleared — so unchecking a box did nothing until the
        // page was reloaded, which is what the popup's old "please refresh" banner was
        // apologising for.
        const env = await loadProgram({ html: serpDocument() });
        const { expected } = mountSelector(env.document, selector, hops);

        env.window.modifySearchResults({ [configKey]: true });
        assert.ok(isHidden(expected), "hidden while the setting is on");

        env.window.modifySearchResults({ [configKey]: false });
        assert.ok(!isHidden(expected), `${selector} +${hops} should come back`);
      });

      test(`${configKey}: hides ${selector} that arrives after the configuration was applied`, async () => {
        // The rules live in a stylesheet, so content Google appends later matches them
        // with no re-application. This is what the endless-scroll observer used to do.
        const env = await loadProgram({ html: serpDocument() });

        env.window.modifySearchResults({ [configKey]: true });
        const { expected } = mountSelector(env.document, selector, hops);

        assert.ok(isHidden(expected), `${selector} +${hops} should be hidden on arrival`);
      });
    }
  }
});

describe("removeArrow is implied by removeUrl and moveUrl", () => {
  for (const trigger of ["removeArrow", "removeUrl", "moveUrl"]) {
    test(`${trigger} removes the trailing caret`, async () => {
      const env = await loadProgram({ html: serpDocument('<span class="B6fmyf">caret</span>') });

      env.window.modifySearchResults({ [trigger]: true });

      assert.ok(isHidden(env.document.querySelector(".B6fmyf")));
    });
  }
});

describe("ad display modes", () => {
  const AD_MARKUP = `
    <div id="tads"><div class="ad">Sponsored A</div></div>
    <div id="tadsb"><div class="ad">Sponsored B</div></div>
    <div class="ads-ad">Sponsored C</div>
    <span class="U3A9Ac qV8iec">Sponsored</span>
  `;

  test('"normal" leaves ads untouched', async () => {
    const env = await loadProgram({ html: serpDocument(AD_MARKUP) });

    env.window.modifySearchResults({ adsDisplay: "normal" });

    assert.ok(!isHidden(env.document.getElementById("tads")));
    assert.equal(env.document.querySelector(".U3A9Ac.qV8iec").style.border, "");
  });

  test('"remove" hides the top, bottom, and inline ad blocks', async () => {
    const env = await loadProgram({ html: serpDocument(AD_MARKUP) });

    env.window.modifySearchResults({ adsDisplay: "remove" });

    assert.ok(isHidden(env.document.getElementById("tads")));
    assert.ok(isHidden(env.document.getElementById("tadsb")));
    assert.ok(isHidden(env.document.querySelector(".ads-ad")));
  });

  test('"standOut1" outlines the Sponsored label without tinting the block', async () => {
    const env = await loadProgram({ html: serpDocument(AD_MARKUP) });

    env.window.modifySearchResults({ adsDisplay: "standOut1", adBackgroundColor: "#faebd7" });

    const label = style(env, ".U3A9Ac.qV8iec");
    assert.equal(label.color, "rgb(0, 128, 0)", "the green marker text");
    assert.equal(label.border, "1px solid green");
    assert.equal(label.backgroundColor, UNTINTED, "standOut1 does not tint");
    assert.equal(style(env, "#tads").backgroundColor, UNTINTED);
  });

  test('"standOut2" tints the ad block and every descendant', async () => {
    const env = await loadProgram({ html: serpDocument(AD_MARKUP) });

    env.window.modifySearchResults({ adsDisplay: "standOut2", adBackgroundColor: "#faebd7" });

    assert.equal(style(env, "#tads").backgroundColor, "rgb(250, 235, 215)");
    assert.equal(style(env, "#tads").padding, "10px");
    assert.equal(style(env, "#tads .ad").backgroundColor, "rgb(250, 235, 215)");
  });

  test('"standOut2" skips ad containers that are empty', async () => {
    // Without the :not(:empty) guard this paints a bare coloured box wherever
    // Google renders an ad container it did not fill.
    const env = await loadProgram({ html: serpDocument('<div id="tads"></div>') });

    env.window.modifySearchResults({ adsDisplay: "standOut2", adBackgroundColor: "#faebd7" });

    assert.equal(style(env, "#tads").backgroundColor, UNTINTED);
  });

  test("switching back to normal undoes the tint", async () => {
    const env = await loadProgram({ html: serpDocument(AD_MARKUP) });

    env.window.modifySearchResults({ adsDisplay: "standOut2", adBackgroundColor: "#faebd7" });
    assert.equal(style(env, "#tads").backgroundColor, "rgb(250, 235, 215)");

    env.window.modifySearchResults({ adsDisplay: "normal" });
    assert.equal(style(env, "#tads").backgroundColor, UNTINTED, "no reload needed");
  });

  test('"remove" also strips ads embedded in the sidebar and results', async () => {
    const env = await loadProgram({ html: serpDocument() });
    const sidebar = mountSelector(env.document, ".IhvZRb", 2);
    const inline = mountSelector(env.document, ".T98FId", 2);

    env.window.modifySearchResults({ adsDisplay: "remove" });

    assert.ok(isHidden(sidebar.expected));
    assert.ok(isHidden(inline.expected));
  });

  test('"remove" spares product blocks on the Shopping tab', async () => {
    for (const url of [
      "https://www.google.com/search?q=shoes&udm=28",
      "https://www.google.com/search?q=shoes&sclient=gws-wiz-modeless-shopping",
    ]) {
      const env = await loadProgram({ url, html: serpDocument() });
      const inline = mountSelector(env.document, ".T98FId", 2);

      env.window.modifySearchResults({ adsDisplay: "remove" });

      assert.ok(!isHidden(inline.expected), `product blocks kept on ${url}`);
    }
  });
});

describe("popularExploreBuyWidget shopping-tab guard", () => {
  const SPINNER = '<div id="sho-qu__spinnerContainer">loading</div>';

  test("hides the shopping spinner on the regular results tab", async () => {
    const env = await loadProgram({ html: serpDocument() });
    const spinner = mountSelector(env.document, "#sho-qu__spinnerContainer", 8);
    env.document.body.insertAdjacentHTML(
      "afterbegin",
      '<form id="searchform"><a href="/search?q=x">All</a></form>',
    );

    env.window.modifySearchResults({ popularExploreBuyWidget: true });

    assert.ok(isHidden(spinner.expected));
  });

  test("keeps the shopping spinner when the Shopping tab is active", async () => {
    const env = await loadProgram({ html: serpDocument() });
    const spinner = mountSelector(env.document, "#sho-qu__spinnerContainer", 8);
    env.document.body.insertAdjacentHTML(
      "afterbegin",
      '<form id="searchform"><a href="/shopping?sca_esv=abc123">Shopping</a></form>',
    );

    env.window.modifySearchResults({ popularExploreBuyWidget: true });

    assert.ok(!isHidden(spinner.expected));
  });

  test("does not throw when the page has no search form", async () => {
    const env = await loadProgram({ html: serpDocument(SPINNER) });

    assert.doesNotThrow(() => env.window.modifySearchResults({ popularExploreBuyWidget: true }));
  });
});

describe("URL coloring", () => {
  test("colors organic and ad URLs when enabled", async () => {
    const env = await loadProgram({
      html: serpDocument(
        '<cite class="qLRx3b">example.com</cite><span class="x2VHCd">ad.example</span>' +
          '<div class="byrV5b"><span id="urlpart">example.com</span></div>',
      ),
    });

    env.window.modifySearchResults({ colorUrl: true, urlColor: "#008000" });

    assert.equal(style(env, ".qLRx3b").color, "rgb(0, 128, 0)");
    assert.equal(style(env, ".x2VHCd").color, "rgb(0, 128, 0)", "ad URLs too");
    assert.equal(style(env, "#urlpart").color, "rgb(0, 128, 0)", "children of the URL wrapper too");
  });

  test("leaves URLs alone when disabled", async () => {
    const env = await loadProgram({ html: serpDocument('<cite class="qLRx3b">example.com</cite>') });

    env.window.modifySearchResults({ colorUrl: false, urlColor: "#008000" });

    assert.notEqual(style(env, ".qLRx3b").color, "rgb(0, 128, 0)");
  });

  test("restores the original colour when switched off", async () => {
    const env = await loadProgram({ html: serpDocument('<cite class="qLRx3b">example.com</cite>') });
    const before = style(env, ".qLRx3b").color;

    env.window.modifySearchResults({ colorUrl: true, urlColor: "#008000" });
    assert.equal(style(env, ".qLRx3b").color, "rgb(0, 128, 0)");

    env.window.modifySearchResults({ colorUrl: false, urlColor: "#008000" });
    assert.equal(style(env, ".qLRx3b").color, before, "no reload needed");
  });

  test("follows a colour change without accumulating rules", async () => {
    const env = await loadProgram({ html: serpDocument('<cite class="qLRx3b">example.com</cite>') });

    env.window.modifySearchResults({ colorUrl: true, urlColor: "#008000" });
    env.window.modifySearchResults({ colorUrl: true, urlColor: "#ff00ff" });

    assert.equal(style(env, ".qLRx3b").color, "rgb(255, 0, 255)");
  });
});

describe("images toggle", () => {
  test("hides SD80kd icons", async () => {
    const env = await loadProgram({ html: serpDocument('<i class="SD80kd"></i>') });

    env.window.modifySearchResults({ images: true });

    assert.ok(isHidden(env.document.querySelector(".SD80kd")));
  });
});

describe("independence of toggles", () => {
  test("enabling one widget toggle does not hide another widget", async () => {
    const env = await loadProgram({ html: serpDocument() });
    const news = mountSelector(env.document, ".aUSklf", 4);
    const ask = mountSelector(env.document, ".EN1f2d", 4);

    env.window.modifySearchResults({ newsWidget: true });

    assert.ok(isHidden(news.expected), "the news widget is hidden");
    assert.ok(!isHidden(ask.expected), '"People also ask" is untouched');
  });

  test("an empty configuration object changes nothing", async () => {
    const env = await loadProgram({
      html: serpDocument('<div class="byrV5b">url</div><div id="tads">ad</div><cite class="qLRx3b">x</cite>'),
    });

    env.window.modifySearchResults({});

    assert.ok(!isHidden(env.document.querySelector(".byrV5b")));
    assert.ok(!isHidden(env.document.getElementById("tads")));
    assert.equal(env.document.querySelector(".qLRx3b").style.color, "");
  });
});
