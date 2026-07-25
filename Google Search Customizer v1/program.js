//Content script///////////////////////////////////////////////////////////////////////
//
//Runs at document_start. Almost everything this extension does is expressed as CSS in
//rules.js: this file injects that stylesheet before the page paints, then puts a class on
//<html> for each enabled setting.
//
//Doing it that way means nothing is ever visible before being hidden, and switching a
//setting off puts the content straight back - neither of which was true when every setting
//was a sequence of querySelectorAll calls writing style.display = 'none' at document_idle.
//
//Two things cannot be done in CSS and still run as scripted passes over the DOM:
//  - removing emojis, which edits text
//  - collapsing the gap a hidden widget leaves behind, which needs "the sibling before the
//    element that has this descendant" - :has() cannot be nested, so it cannot say that


//Site check////////////////////////////////////////////////////////////////////////////

//True when this page is served from a Google domain.
//
//Checks the hostname rather than the whole URL. The previous version tested
//location.href.includes(".google."), which a path or query string was enough to satisfy -
//https://example.com/?ref=www.google.com passed it. The manifest now also limits injection
//to Google domains, so this is the second of two gates rather than the only one.
function isGoogleDomain(){
    const hostname = window.location.hostname;

    //google.com, www.google.com, google.co.uk, www.google.com.au, ...
    return /(^|\.)google(\.[a-z]{2,3})+$/.test(hostname);
}

//Returns true on a Google search results page, false on a page that is definitely not one,
//and undefined when it cannot tell yet.
//
//The third answer matters now that this runs at document_start: the check reads an
//attribute off <html>, and callers need to distinguish "not a search page" from "the parser
//has not got there yet" so they know whether it is worth asking again later.
function checkIfRun(){
    //Don't run script if not on a google domain.
    if(!isGoogleDomain())
        return false;

    const elements = document.getElementsByTagName("html");

    for(let element of elements){
        const itemTypeValue = element.getAttribute('itemtype');

        //Only run script if we are on the search results page.
        if(itemTypeValue !== null)
            return itemTypeValue.includes('SearchResultsPage');
    }

    return undefined;
}


//Startup///////////////////////////////////////////////////////////////////////////////
//
//The statement that actually starts everything is the last thing in this file. Function
//declarations hoist but const and let do not, so running it from up here would reach
//module state that has not been initialised yet. Everything below is declarations.

//Calls onConfirmed as soon as this is known to be a results page. At document_start the
//<html> attributes are normally parsed already; if they are not, this waits rather than
//deciding the answer is no.
function whenSearchPageConfirmed(onConfirmed){
    const verdict = checkIfRun();

    if(verdict === true){
        onConfirmed();
        return;
    }

    if(verdict === false)
        return;

    document.addEventListener('DOMContentLoaded', function(){
        if(checkIfRun() === true)
            onConfirmed();
    }, { once: true });
}

function start(){
    chrome.storage.sync.get(['configuration'], function(storedConfiguration) {
        const configuration = applyConfigurationDefaults(storedConfiguration["configuration"]);

        //Write back on a cold start, and also when the saved configuration predates
        //settings that have been added since - otherwise those settings stay missing.
        if(configurationNeedsUpgrade(storedConfiguration["configuration"]))
            chrome.storage.sync.set({'configuration': configuration}, function(){});

        modifySearchResults(configuration);
    });

    //Register ajax event listener to listen for requests so we can reapply the styling on endless scroll page refresh.
    //
    //Only the scripted passes need this now. The CSS rules match new results on their own,
    //which is most of what this observer used to be for.
    const requestObserver = new PerformanceObserver(onRequestsObserved);
    requestObserver.observe({ type: 'resource' });

    function onRequestsObserved(batch){
        const entries = batch.getEntries();

        let requestWasMade = false;
        for(let entry of entries){
            //Check if the entry is a XHR or fetch.
            if(entry.initiatorType === 'xmlhttprequest' || entry.initiatorType === 'fetch'){
                //Check if this is a request for more search results.
                if(entry.name.includes('search?')){
                    requestWasMade = true;
                    break;
                }
            }
        }

        if(requestWasMade){
            chrome.storage.sync.get(['configuration'], function(storedConfiguration){
                applyScriptedPasses(applyConfigurationDefaults(storedConfiguration["configuration"]));
            });
        }
    }
}


//Receive data from popup.js////////////////////////////////////////////////////////////

function receivedMessage(message, sender, response){
    //The listener is registered before the page is known to be a results page, because the
    //popup may send at any time. Re-checking here is what keeps a configuration change from
    //being applied to Maps, Drive, or any other Google page that is not a SERP.
    if(checkIfRun() !== true)
        return;

    modifySearchResults(applyConfigurationDefaults(message["configuration"]));
}


//Main Function/////////////////////////////////////////////////////////////////////////

//Applies a configuration to the page.
//
//The gating classes go on immediately - that is what makes a setting take effect, and
//removing one is what makes it reversible. The scripted passes need real elements, so they
//wait for the DOM if the page is still parsing.
function modifySearchResults(configuration){
    attempt("applying gating classes", function(){
        applyGatingClasses(configuration);
    });

    attempt("applying colour styles", function(){
        applyColorStyleSheet(configuration);
    });

    whenDomReady(function(){
        //isShoppingTab is partly a question about the DOM, so the classes are worked out
        //again once there is a DOM to ask.
        attempt("applying gating classes", function(){
            applyGatingClasses(configuration);
        });

        applyScriptedPasses(configuration);
    });
}

//The passes that cannot be expressed as CSS, plus the fallback walk for browsers without
//:has(). Re-run whenever Google appends more results.
function applyScriptedPasses(configuration){
    attempt("marking widget spacing", function(){
        markCollapseTargets(configuration);
    });

    attempt("removing emojis", function(){
        if(configuration.removeEmojis)
            removeEmojis();
    });

    attempt("hiding elements without :has() support", function(){
        if(!supportsHasSelector())
            hideWithoutHasSupport(configuration);
    });
}


//Stylesheet injection//////////////////////////////////////////////////////////////////

const REMOVAL_STYLE_ID = "gsc-removal-styles";
const COLOR_STYLE_ID = "gsc-color-styles";

//Injects the generated stylesheet.
//
//At document_start there is no <head> yet, so this appends to <html> - which is valid, and
//is what makes the rules apply to elements that do not exist yet.
function injectRemovalStyleSheet(){
    attempt("injecting the stylesheet", function(){
        if(document.getElementById(REMOVAL_STYLE_ID) != null)
            return;

        const style = document.createElement("style");
        style.id = REMOVAL_STYLE_ID;
        style.textContent = buildRemovalStyleSheet({ supportsHas: supportsHasSelector() });

        document.documentElement.appendChild(style);
    });
}

//Rewrites the colour rules. Separate from the sheet above so that dragging a colour picker
//replaces four rules instead of two hundred.
function applyColorStyleSheet(configuration){
    let style = document.getElementById(COLOR_STYLE_ID);

    if(style == null){
        style = document.createElement("style");
        style.id = COLOR_STYLE_ID;
        document.documentElement.appendChild(style);
    }

    style.textContent = buildColorStyleSheet(configuration);
}

//Puts one class on <html> per enabled setting, and takes off the ones that are no longer
//enabled. Taking them off is what restores content the user has stopped hiding.
function applyGatingClasses(configuration){
    const wanted = gatingClassesFor(configuration, { isShoppingTab: isShoppingTab() });
    const root = document.documentElement;

    for(const className of allGatingClasses()){
        root.classList.toggle(className, wanted.includes(className));
    }
}

//True when :has() is usable. Chrome 105+ and Firefox 121+; older browsers fall back to the
//scripted parent walk below.
let hasSelectorSupport = null;

function supportsHasSelector(){
    if(hasSelectorSupport === null){
        hasSelectorSupport =
            typeof CSS !== "undefined" &&
            typeof CSS.supports === "function" &&
            CSS.supports("selector(:has(*))");
    }

    return hasSelectorSupport;
}


//Shopping tab detection////////////////////////////////////////////////////////////////

//Product blocks and the shopping spinner are ads on the results tab and legitimate content
//on the Shopping tab, so several rules ask about this.
//
//udm=28 selects the Shopping tab. sclient=gws-wiz-modeless-shopping only appears once a
//search has been run from within that tab, so the search form is checked as well.
function isShoppingTab(){
    if(window.location.href.includes("sclient=gws-wiz-modeless-shopping"))
        return true;

    if(window.location.href.includes("udm=28"))
        return true;

    const searchForm = document.getElementById("searchform");

    if(searchForm != null){
        for(let link of searchForm.getElementsByTagName("a")){
            if(link.href.includes("/shopping?sca_esv"))
                return true;
        }
    }

    return false;
}


//Widget spacing////////////////////////////////////////////////////////////////////////

//Tags the element that should lose its margin so a hidden widget does not leave a gap.
//
//CSS cannot express this: it needs "the sibling before the element that has this
//descendant", and :has() is not allowed inside :has(). So the element is found by script
//and marked, and the stylesheet does the rest - which keeps it reversible, because the
//margin only applies while the setting's class is on <html>.
function markCollapseTargets(configuration){
    const context = { isShoppingTab: isShoppingTab() };

    for(const rule of REMOVAL_RULES){
        if(!rule.collapse || !ruleIsEnabled(rule, configuration, context))
            continue;

        for(const target of rule.collapse){
            for(const element of document.querySelectorAll(collapseSourceSelector(target))){
                const node = element.previousElementSibling || element;
                markCollapse(node, rule.key);
            }
        }
    }
}

//The widget itself, using :has() where available and a parent walk where it is not.
function collapseSourceSelector(target){
    return supportsHasSelector() ? targetSelector(target) : target.selector;
}

function markCollapse(node, key){
    const marked = (node.getAttribute("data-gsc-collapse") || "").split(/\s+/).filter(Boolean);

    if(marked.includes(key))
        return;

    marked.push(key);
    node.setAttribute("data-gsc-collapse", marked.join(" "));
}


//Fallback for browsers without :has()//////////////////////////////////////////////////

//Everything expressed with hops or an ancestor needs :has(). On a browser that lacks it
//those rules are left out of the stylesheet and applied here instead, the way the whole
//extension used to work. Plain selectors are handled by CSS on every browser.
function hideWithoutHasSupport(configuration){
    const context = { isShoppingTab: isShoppingTab() };

    for(const rule of REMOVAL_RULES){
        if(!ruleIsEnabled(rule, configuration, context))
            continue;

        for(const target of rule.targets){
            if(!targetNeedsHas(target))
                continue;

            if(target.ancestor)
                hideMatchingAncestor(target.selector, target.ancestor);
            else
                hideParent(target.selector, target.hops);
        }
    }
}

function hideParent(selector, hops){
    attempt("hideParent(" + selector + ", " + hops + ")", function(){
        for(const element of document.querySelectorAll(selector)){
            const node = getParentNode(element, hops);

            if(isSafeToHide(node))
                node.style.display = 'none';
        }
    });
}

function hideMatchingAncestor(selector, ancestorSelector){
    attempt("hideMatchingAncestor(" + selector + ", " + ancestorSelector + ")", function(){
        for(const element of document.querySelectorAll(selector)){
            const node = element.parentElement != null ? element.parentElement.closest(ancestorSelector) : null;

            if(isSafeToHide(node))
                node.style.display = 'none';
        }
    });
}

//Walks up parentNum levels and returns what it lands on.
//
//The hop counts go as high as 16 and were counted by hand against Google's markup, so
//overshooting is a question of when rather than if. Walking parentElement stops cleanly at
//<html>; parentNode used to carry on to the document and then to null, where it threw.
function getParentNode(element, parentNum){
    let parent = element;

    for(let i = 0; parentNum > i && parent.parentElement != null; i++)
        parent = parent.parentElement;

    return parent;
}

//A hop count that overshoots lands on <html>. Hiding <html> or <body> would blank the page,
//and no widget is either of those, so treat landing on one as the miss that it is.
function isSafeToHide(node){
    return node != null && node !== document.documentElement && node !== document.body;
}


//Emoji removal/////////////////////////////////////////////////////////////////////////

//Matches one emoji, including the multi code point kinds: a base symbol followed by any
//number of variation selectors, skin tone modifiers, or zero width joiner sequences. They
//have to be consumed as a unit, otherwise stripping the base leaves orphaned modifiers
//behind.
//
//This replaced a set of hand written code point ranges. [\u2011-\u26FF] alone covered 1775
//code points - General Punctuation, Letterlike Symbols, Arrows and Mathematical Operators
//among them - so it deleted en dashes, curly quotes, ellipses and arrows out of ordinary
//result titles. [\uE000-\uF8FF] added the Private Use Area on top of that.
const EMOJI_PATTERN = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})(?:[\uFE0E\uFE0F]|[\u{1F3FB}-\u{1F3FF}]|\u200D(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}))*/gu;

//Unicode classifies these three as pictographic, but in a search result they are ordinary
//text and get left alone.
const NOT_ACTUALLY_EMOJI = /^[©®™]$/;

function removeEmojis(){
    for(const className of EMOJI_TEXT_CLASSES){
        //Snapshot the collection first: getElementsByClassName is live, and rewriting an
        //element's text can shift it out from under the iteration.
        for(const element of Array.from(document.getElementsByClassName(className)))
            removeEmojisFrom(element);
    }
}

//Strips emojis from the text inside an element, leaving its markup intact.
//
//This used to assign to element.innerText, which replaces every child node with a single
//text node. The elements it runs against are not plain text - .VwiC3b is the result
//snippet, where Google wraps matched search terms in <em>, and .LC20lb titles can contain
//nested links - so all of that was being flattened. Rewriting individual text nodes touches
//only the characters.
//
//Note that this is the one setting a reload cannot undo on the spot: the original text is
//gone once it has been rewritten.
function removeEmojisFrom(element){
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

    for(let node = walker.nextNode(); node != null; node = walker.nextNode()){
        const cleanedString = node.nodeValue.replace(EMOJI_PATTERN, function(match){
            return NOT_ACTUALLY_EMOJI.test(match) ? match : '';
        });

        if(node.nodeValue != cleanedString)
            node.nodeValue = cleanedString;
    }
}


//Utils/////////////////////////////////////////////////////////////////////////////////

//Runs an action once the DOM can be queried, immediately if it already can.
function whenDomReady(action){
    if(document.readyState === "loading")
        document.addEventListener('DOMContentLoaded', action, { once: true });
    else
        action();
}

//Runs one step and keeps any failure contained to it.
//
//Applying a configuration is a sequence of independent steps, so without this an exception
//from one of them took the rest down with it. Nothing surfaced either - the call comes from
//a chrome.storage callback, so the error went to a console nobody is looking at while the
//user just saw unrelated settings stop working.
function attempt(description, action){
    try{
        action();
    }catch(error){
        console.warn("Google Search Customizer: " + description + " failed.", error);
    }
}


//Go///////////////////////////////////////////////////////////////////////////////////
//
//Last, so that every const and let above is initialised before anything reads it.

if(isGoogleDomain()){
    //The stylesheet is inert until a gating class appears on <html>, so it is safe to inject
    //before anything is known about the configuration or even about the page. Doing it here,
    //at document_start, is what stops content being visible before it is hidden.
    injectRemovalStyleSheet();

    //Registered before the page is confirmed as a results page, because it has to go on
    //synchronously - the popup may send at any time. receivedMessage re-checks the gate.
    chrome.runtime.onMessage.addListener(receivedMessage);

    whenSearchPageConfirmed(start);
}
