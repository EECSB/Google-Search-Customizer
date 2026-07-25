# Google-Search-Customizer
![enter image description here](https://eecs.blog/wp-content/uploads/2020/09/icon280.png)

## Where to download?

You can add the extension to your browser by downloading it from the official extension websites for the following browsers:
[Chrome](https://chrome.google.com/webstore/detail/google-search-ad-remover/pdhiefmcgnjohonhoobalejfnbminlkc), [Firefox](https://addons.mozilla.org/en-US/firefox/addon/google-search-customizer/?utm_source=addons.mozilla.org&utm_medium=referral&utm_content=search), [Edge](https://microsoftedge.microsoft.com/addons/detail/google-search-ad-remover-/eebiagooojcejfpkopfnehbnjljijnhl)

The extension can also be installed manually like so: Download the files from Github -> In chrome open: Extensions -> Manage Extensions -> Load Unpacked and select the folder with the downloaded files.

## Important Note For Firefox and Opera users:

[Issue 27](https://github.com/EECSB/Google-Search-Customizer/issues/27) In Firefox, the extension has to be manually enabled after the installation like so:
![enter image description here](https://eecs.blog/wp-content/uploads/2024/08/enable-google-search-customizer-extension-in-firefox.png)

[Issue 24](https://github.com/EECSB/Google-Search-Customizer/issues/24) In Opera, the extension has to be manually enabled after the installation like so:
![enter image description here](https://eecs.blog/wp-content/uploads/2024/08/enable-google-search-customizer-extension-in-opera.png)

## What does this extension do?

This extension allows you to customize how your Google Search results are displayed. You can:

-   Remove, Move, Color the link of the webpage in the search result.
-   Remove, Make the Ads stand out(make ad more obvious, make ad really obvious).
-   Remove Emojis from titles and descriptions of search results.
-   Remove other stuff Google inserts in the search results("People also ask", "Top News",  …).

## Examples:

This is the extension settings menu where you can select how your search results appear. 
![enter image description here](https://eecs.blog/wp-content/uploads/2020/10/UI.png)


This demonstrates what the controls under **URL Position and Appearance** do. Remove the url(**remove url**), remove arrow after the url(**remove arrow after url**), color the url green(**color url**), move the url below the title(**move url**). 
![enter image description here](https://eecs.blog/wp-content/uploads/2020/09/url-settings.png)


This demonstrates what the controls under **Ad Settings** do. You can keep the ads the way they are(**normal**), remove them(**remove**), make them stand out a bit more by putting a green ad marker before the url(**stand out**), do what the standout option does and also color the background of the ads(**really stand out**).
![enter image description here](https://eecs.blog/wp-content/uploads/2020/09/ad-settings.png)


The **Only Show Pure Results** option will remove any "widgets" that Google decides to put in the search results such as "People also ask", "Twitter", "Top stories", "the side widget thing", ... 
![enter image description here](https://eecs.blog/wp-content/uploads/2020/09/show-only-pure-results.png)


The **Remove emojis** option will well... remove all the emojis from the search results.
![enter image description here](https://eecs.blog/wp-content/uploads/2020/09/remove-emojis.png)


## Why I made it?

Some time ago Google changed how their search results appear. Ads use to be obvious compared to regular search results.

After the update, it is way harder to tell the difference between an ad and a genuine search result. What Google is trying to do here is increase the CTR for their ads by trying to blend them in with the regular search results.

Compared to how Google Search results looked years ago there are now fewer results per page and the pages contain a bunch of other clutter that you might or might not find useful.

I don't really appreciate how they have changed the search results in the past years. If you don't either you can use this extension I made to clean them up.

I didn't make this extension for profit. As mentioned above I made this extension because I didn't appreciate the new look of the Google search results and I knew there were a lot of people who didn't either.

I also thought this would be a good opportunity to learn how to make a web browser extension and document the progress on [my blog](https://eecs.blog/)(You can find [source code](https://github.com/EECSB/Google-Search-Customizer) my Github page). The extension is free and will continue to remain so. Feel free to copy any of the code or fork the project and make your own version of the extension with other/different features. 

## Development

The extension is plain HTML/CSS/JS with no build step — what is in
`Google Search Customizer v1/` is exactly what ships. Load it unpacked to work on it.

There is a test suite covering the DOM manipulation, the popup wiring, and the packaging.
It runs the real source files in [jsdom](https://github.com/jsdom/jsdom) with stubbed
`chrome.*` APIs, so no source file needs modifying to be testable:

```bash
npm install
npm run check
```

That lints and then runs the tests; `npm run lint` and `npm test` do either half. Requires
Node 20+. jsdom and ESLint are dev dependencies only; nothing is added to the extension.

### How it works, briefly

`rules.js` holds one table describing what each setting hides. The content script turns that
into a stylesheet, injects it at `document_start` before the page has painted, and then puts
one class on `<html>` per enabled setting:

```css
html.gsc-removeUrl .byrV5b { display: none !important; }
html.gsc-askWidget *:has(> * > * > * > .EN1f2d) { display: none !important; }
```

So nothing is ever visible before being hidden, and switching a setting off puts the content
straight back without a reload.

### Documentation

| Document | What it covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the pieces fit together and where to make a given change |
| [docs/SELECTORS.md](docs/SELECTORS.md) | Every Google class name the extension targets, and how to update a stale one |
| [docs/CODE-REVIEW.md](docs/CODE-REVIEW.md) | Known bugs and improvement opportunities, ranked |
| [docs/TESTING.md](docs/TESTING.md) | How the test harness works and how to add cases |

**If a setting has stopped working**, the cause is almost always a stale entry in
[docs/SELECTORS.md](docs/SELECTORS.md) — Google changes its obfuscated class names without
notice. That file explains how to find the new one.

## Privacy and Guarantees

The extension doesn't collect any information at all. It only saves the setting you choose in the extension and saves it in your browser(Feel free to look at the [code](https://github.com/EECSB/Google-Search-Customizer).).

I make no guarantees that this extension will be without bugs or that I will keep updating it. Bugs can be reported on the projects [Github page](https://github.com/EECSB/Google-Search-Customizer/issues).
