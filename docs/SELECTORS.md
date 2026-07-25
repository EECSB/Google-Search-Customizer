# Selector reference

Every Google class name the extension targets, what it is meant to hit, and how many
`parentNode` steps `program.js` takes before hiding.

**This is the file that goes stale.** Google's class names are obfuscated build output and
change without notice. When a setting stops working, the cause is almost always a row in
this table.

Each row is pinned by a generated test in [`tests/features.test.js`](../tests/features.test.js).
A failing test names the config key, the selector, and the hop count, so you can go
straight to the relevant line of `program.js`.

## How to read a row

A row is a `{ selector, hops }` entry in the `REMOVAL_RULES` table in
[`rules.js`](../Google%20Search%20Customizer%20v1/rules.js). Hops **4** means: find every
element matching the selector, and hide the element **4** parents above it.

That becomes a CSS rule, gated on a class the content script puts on `<html>`:

| Table entry | Generated CSS |
|---|---|
| `{ selector: ".XqFnDf" }` | `html.gsc-mapsWidget .XqFnDf` |
| `{ selector: ".aUSklf", hops: 4 }` | `html.gsc-newsWidget *:has(> * > * > * > .aUSklf)` |
| `{ selector: ".M42dy", ancestor: ".ULSxyf" }` | `html.gsc-twitterWidget .ULSxyf:has(.M42dy)` |

A hop count of N produces N−1 intermediate `> *` steps. All rules end in
`display: none !important` — the `!important` is needed because Google sets inline styles on
some of these.

The hop count exists because Google's classes sit on inner elements — a text span, an icon —
rather than on the block a user would call "the widget". See
[ARCHITECTURE.md](ARCHITECTURE.md#how-a-setting-is-applied).

`padding` in the last column means the rule also has a `collapse` entry, which zeroes the
margin on the element *preceding* the widget so its absence does not leave a gap. Those
cannot be pure CSS — `:has()` cannot be nested, so it cannot express "the sibling before the
element that has this descendant" — so the script tags that element with
`data-gsc-collapse="<key>"` and the stylesheet acts on the tag.

---

## URL appearance

| Setting | Selector | Hops | Targets |
|---|---|---|---|
| `removeUrl` | `.byrV5b` | 0 | URL + favicon line under the title |
| `removeUrl` | `.qdrjAc` | 0 | URL on the inline sitelinks block |
| `removeArrow`¹ | `.B6fmyf` | 0 | Caret at the end of a URL |
| `removeArrow`¹ | `.e1ycic` | 0 | Caret at the end of an ad URL |
| `removeArrow`¹ | `.D6lY4c` | 0 | Kebab menu shown instead of the caret |
| `removeArrow`¹ | `.ONMH0e` | 0 | Kebab menu on ads |
| `colorUrl` | `.qLRx3b` | — | URL text (colour applied directly) |
| `colorUrl` | `.ylgVCe` | — | URL path segment |
| `colorUrl` | `.byrV5b` children | — | Everything inside the URL wrapper |
| `colorUrl` | `.x2VHCd` | — | Ad URL text |

¹ Also triggered by `removeUrl` and `moveUrl`.

> `.rIbAWc` was removed from this group — it is also used by the Tools bar, so hiding it
> hid the search tools ([issue #16](https://github.com/EECSB/Google-Search-Customizer/issues/16)).
> A cautionary example of how loose these class names are.

## Ads

| Mode | Selector | Hops | Targets |
|---|---|---|---|
| `remove` | `#tads` | 0 | Top ad block |
| `remove` | `#tadsb` | 0 | Bottom ad block |
| `remove` | `.ads-ad` | 0 | Individual ad |
| `remove` | `.IhvZRb` | 2 | Ads inside the sidebar widget |
| `remove` | `.T98FId` | 2 | Ads in results / "Popular products" — padding |
| `standOut1` | `.U3A9Ac.qV8iec` | — | "Sponsored" label: green text and border |
| `standOut2` | `.U3A9Ac.qV8iec` | — | As above, plus background tint |
| `standOut2` | `#tads, #tadsb, #bottomads` | — | Tints the block and every descendant |

`remove` skips `.IhvZRb` and `.T98FId` on the Shopping tab, detected by `udm=28` or
`sclient=gws-wiz-modeless-shopping` in the URL — otherwise it would empty the page the
user deliberately navigated to.

## Widgets

| Setting | Selector | Hops | Targets |
|---|---|---|---|
| `searchWidget` | `#bres` | 0 | "People also search for" / "Related searches" |
| `searchWidget` | `.O3JH7` | 2 | variant |
| `searchWidget` | `.YR2tRd` | 2 | variant |
| `searchWidget` | `.O8VmIc` | 2 | Related searches inside image search |
| `askWidget` | `.JolIg` | 4 | "People also ask" (legacy) |
| `askWidget` | `.EN1f2d` | 4 | "People also ask" — padding |
| `askWidget` | `.Okagcf` | 1 | "People also ask" embedded in a result |
| `twitterWidget` | `.otisdd` | 2 | Twitter block (legacy) — padding |
| `twitterWidget` | `.M42dy` in `.ULSxyf` | — | Twitter block, located by ancestor — padding |
| `newsWidget` | `.AHFbof` | 4 | Top stories (variant) — padding |
| `newsWidget` | `.aUSklf` | 4 | Top stories — padding |
| `newsWidget` | `.yG4QQe` | 2 | Top stories (variant) |
| `mapsWidget` | `.AEprdc` | 1 | Map block (legacy) |
| `mapsWidget` | `.kqmHwe` | 1 | Map block — padding |
| `mapsWidget` | `.Qq3Lb` in `.ULSxyf` | — | Map block, located by ancestor — padding |
| `mapsWidget` | `.Lx2b0d` | 12 | Map + images block |
| `mapsWidget` | `.XqFnDf` | 0 | City name heading |
| `mapsFindResultsOnWidget` | `#i4BWVe` | 1 | "Find results on" — padding |
| `youtubeWidtget`² | `.uVMCKf` | 0 | YouTube carousel |
| `youtubeWidtget`² | `.PYmpec` | 4 | YouTube carousel (variant) |
| `sideBarWidget` | `.liYKde` | 1 | Knowledge panel |
| `sideBarWidget` | `.Lj180d` | 6 | Knowledge panel (variant) |
| `sideBarWidget` | `.TQc1id` | 0 | Knowledge panel (variant) |
| `ratingsWidget` | `.liYKde` | 1 | Shared with `sideBarWidget` |
| `ratingsWidget` | `.dhIWPd` | 1 | Star ratings |
| `ratingsWidget` | `.fG8Fp` | 1 | Star ratings (variant) |
| `ratingsWidget` | `.smukrd` | 1 | Star ratings (variant) |
| `thingsToDoWidget` | `.IYoemc` | 3 | "Things to do" (legacy) — padding |
| `thingsToDoWidget` | `.NfrtPd.UE0K3b.QsV5nc` | 7 | "Things to do" — padding |
| `thingsToKnowWidget` | `.dnXCYb` | 7 | "Things to know" |
| `imagesWidget` | `#iur` | 3 | Images carousel — padding |
| `imagesWidget` | `.hisnlb` | 8 | Images carousel (variant) |
| `featuredSnippet` | `#Odp5De` | 0 | Featured snippet |
| `featuredSnippet` | `.yKMVIe` | 10 | Featured snippet (variant) |
| `featuredSnippet` | `.Wm5I1e` | 0 | AI Overview |
| `featuredSnippet` | `.YzCcne` | 0 | AI Overview (variant) |
| `dictionaryWidget` | `.bH1Fqd` | 13 | Dictionary block |
| `businessesWidget` | `.ixfGmd` | 3 | Local businesses — padding |
| `topSightsWidget` | `.UXerFf` | 6 | "Top sights" — padding |
| `otherMessages` | `.WcS13d` | 1 | Assorted Google notices — padding |
| `aboutWidget` | `.bzXtMb` | 0 | Cast, reviews, key moments |
| `aboutWidget` | `.yTFeqb.wp-ms.oJxARb.nBWfrd.VE2Ztc` | 3 | Episodes |
| `aboutWidget` | `.GJi8Lc` | 6 | variant |
| `aboutWidget` | `.dG2XIf` | 3 | Conversion tables and similar |
| `popularExploreBuyWidget` | `.ednlu.GAJC` | 8 | "Popular/Explore brands" |
| `popularExploreBuyWidget` | `.OTMJR.IFnjPb.SlP8xc.RES9jf` | 4 | "People also buy" |
| `popularExploreBuyWidget` | `#sho-qu__spinnerContainer` | 8 | Shopping spinner — skipped on the Shopping tab |
| `relatedProductsServicesWidget` | `#HbKV2c` | 0 | "Find related products & services" |
| `placesToVisitWidget` | `.J1FGbf` | 16 | "Places to visit" |

² Config key is misspelled in the source. It has to stay that way in all three default
objects until someone writes a storage migration.

`.kb0PBd.cvP2Ce.LnCrMe` and `.kb0PBd.cvP2Ce.LnCrMe.QgmGr` used to be listed under `images`
as well. Every element either could match is already matched by the plain `.LnCrMe` rule at
the same depth, so both have been dropped.

## Additional

| Setting | Selector | Hops | Targets |
|---|---|---|---|
| `images` | `.LnCrMe` | 0 | Thumbnail beside a result |
| `images` | `.Sth6v` | 0 | variant |
| `images` | `.AzcMvf` | 1 | variant |
| `images` | `.SuXxEf` | 0 | variant |
| `images` | `.EPx5le` | 2 | variant |
| `images` | `.W27f5e` | 1 | legacy |
| `images` | `.SD80kd` | — | Hidden directly, no parent walk |
| `images` | `.fWhgmd` | 4 | legacy |
| `siteFavicons` | `.H9lube` | 0 | Result favicon |
| `siteFavicons` | `.DDKf1c` | 0 | variant |
| `videoTumbnails`² | `.gY2b2c` | 0 | Video thumbnail |
| `aiModeTab` | `.olrp5b` | 2 | "AI Mode" tab in the search-type bar |
| `removeEmojis` | `.LC20lb`, `.st`, `.cbphWd`, `.fl`, `.VwiC3b` | — | Titles and snippets |

---

## Updating a stale selector

1. Open a Google search that shows the element, with the extension disabled.
2. Inspect the element the setting should hide.
3. Find a class on it or a descendant that looks like a widget identifier rather than a
   layout utility. Prefer one that appears once per widget.
4. Count `parentNode` steps from that element up to the container worth hiding.
   `$0.parentNode.parentNode` in the console, or:

   ```js
   let n = 0, node = $0;
   while (node) { console.log(n++, node.className, node); node = node.parentElement; }
   ```

5. Update the rule's `targets` in `rules.js`, this table, and the corresponding row in
   `FEATURE_SELECTORS` in `tests/features.test.js`.
6. `npm test`.

**Prefer the smallest hop count that works.** A high count is fragile in two directions:
Google adding a wrapper makes it hide too little, and Google removing one makes it hide too
much. Overshooting no longer throws — the generated selector simply matches nothing, or
matches `<html>`, which `isSafeToHide` refuses.

**Prefer an ancestor to a hop count where there is a stable-looking container class.**
`{ selector: ".M42dy", ancestor: ".ULSxyf" }` survives Google inserting or removing a
wrapper; `{ selector: ".M42dy", hops: 3 }` does not.
