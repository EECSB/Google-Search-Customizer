//Removal rules and stylesheet generation///////////////////////////////////////////////
//
//This is the single description of what each setting hides. program.js turns it into a
//stylesheet at document_start; the rules sit inert until a matching class is put on <html>,
//so switching a setting on or off is one classList toggle and takes effect immediately.
//
//Before this, every setting was a sequence of querySelectorAll calls that wrote
//style.display = 'none' onto whatever they found. That ran at document_idle - after the
//page had painted, so ads and widgets were visible before they disappeared - and it could
//not be undone, which is why the popup used to carry a "please refresh the page" banner.
//
//To change what a setting hides, edit the table below. Nothing else needs touching.

//What this file publishes to program.js. These are classic scripts sharing one global
//lexical environment, so there is nothing to export - the comment is what tells a linter
//(and a reader) which names are the file's surface.
/* exported EMOJI_TEXT_CLASSES, buildRemovalStyleSheet, buildColorStyleSheet,
            allGatingClasses, gatingClassesFor */

//Ad containers, shared by the "remove" and "really stand out" branches so they cannot
//drift apart. #bottomads used to be tinted by one and ignored by the other.
const AD_CONTAINERS = ["#tads", "#tadsb", "#bottomads"];

//Sponsored label inside an ad.
const AD_LABEL = ".U3A9Ac.qV8iec";

//Elements whose text colour the "Color URL" setting changes.
const URL_COLOR_TARGETS = [".qLRx3b", ".ylgVCe", ".byrV5b > *", ".x2VHCd"];

//Elements the "Remove Emojis" setting rewrites. Unlike everything else in this file this
//cannot be done in CSS - it edits text - so it stays a scripted pass.
const EMOJI_TEXT_CLASSES = ["LC20lb", "st", "cbphWd", "fl", "VwiC3b"];


//How a target is written:
//
//  { selector: ".byrV5b" }                  hide the matched element itself
//  { selector: ".EN1f2d", hops: 4 }         hide the element 4 parents above the match
//  { selector: ".M42dy", ancestor: ".ULSxyf" }
//                                           hide the nearest .ULSxyf containing the match
//
//`hops` exists because Google's class names sit on inner elements - a text span, an icon -
//rather than on the block worth hiding. See docs/SELECTORS.md.
const REMOVAL_RULES = Object.freeze([
    {
        key: "removeUrl",
        targets: [
            { selector: ".byrV5b" },        //Url + favicon line under the title
            { selector: ".qdrjAc" }         //Url on the inline sitelinks block
        ]
    },
    {
        key: "removeArrow",
        //Removing or moving the url leaves the arrow dangling, so those settings imply this one.
        when: function(configuration){
            return Boolean(configuration.removeArrow || configuration.removeUrl || configuration.moveUrl);
        },
        targets: [
            { selector: ".B6fmyf" },        //Caret after the url
            { selector: ".e1ycic" },        //Caret after an ad url
            { selector: ".D6lY4c" },        //Kebab menu shown instead of the caret
            { selector: ".ONMH0e" }         //Kebab menu on ads
        ]
        //.rIbAWc is deliberately absent: the same class is used by the Tools bar.
        //https://github.com/EECSB/Google-Search-Customizer/issues/16
    },
    {
        key: "adsRemove",
        when: function(configuration){
            return configuration.adsDisplay == "remove";
        },
        targets: AD_CONTAINERS.map(function(selector){ return { selector: selector }; })
            .concat([{ selector: ".ads-ad" }])
    },
    {
        key: "adsRemoveProducts",
        //Product blocks are ads everywhere except the Shopping tab, where removing them
        //would empty the page the user deliberately navigated to.
        when: function(configuration, context){
            return configuration.adsDisplay == "remove" && !context.isShoppingTab;
        },
        targets: [
            { selector: ".IhvZRb", hops: 2 },   //Ads in the sidebar widget
            { selector: ".T98FId", hops: 2 }    //Ads in results / "Popular products"
        ],
        collapse: [{ selector: ".T98FId", hops: 2 }]
    },
    {
        key: "searchWidget",
        targets: [
            { selector: "#bres" },              //"People also search for" / "Related searches"
            { selector: ".O3JH7", hops: 2 },
            { selector: ".YR2tRd", hops: 2 },
            { selector: ".O8VmIc", hops: 2 }    //Related searches inside image search
        ]
    },
    {
        key: "askWidget",
        targets: [
            { selector: ".JolIg", hops: 4 },    //"People also ask" (legacy)
            { selector: ".EN1f2d", hops: 4 },   //"People also ask"
            { selector: ".Okagcf", hops: 1 }    //"People also ask" embedded in a result
        ],
        collapse: [{ selector: ".EN1f2d", hops: 4 }]
    },
    {
        key: "twitterWidget",
        targets: [
            { selector: ".otisdd", hops: 2 },               //Legacy; kept in case it still appears
            { selector: ".M42dy", ancestor: ".ULSxyf" }
        ],
        collapse: [
            { selector: ".otisdd", hops: 6 },
            { selector: ".M42dy", ancestor: ".ULSxyf" }
        ]
    },
    {
        key: "newsWidget",
        targets: [
            { selector: ".AHFbof", hops: 4 },   //Top stories (variant)
            { selector: ".aUSklf", hops: 4 },   //Top stories
            { selector: ".yG4QQe", hops: 2 }
        ],
        collapse: [
            { selector: ".AHFbof", hops: 4 },
            { selector: ".aUSklf", hops: 4 }
        ]
    },
    {
        key: "mapsWidget",
        targets: [
            { selector: ".AEprdc", hops: 1 },   //Map block (legacy)
            { selector: ".kqmHwe", hops: 1 },   //Map block
            { selector: ".Qq3Lb", ancestor: ".ULSxyf" },
            { selector: ".Lx2b0d", hops: 12 },  //Map + images block
            { selector: ".XqFnDf" }             //City name heading
        ],
        collapse: [
            { selector: ".kqmHwe", hops: 4 },
            { selector: ".Qq3Lb", ancestor: ".ULSxyf" }
        ]
    },
    {
        key: "mapsFindResultsOnWidget",
        targets: [{ selector: "#i4BWVe", hops: 1 }],
        collapse: [{ selector: "#i4BWVe", hops: 1 }]
    },
    {
        key: "youtubeWidtget",                  //Misspelled key, kept for stored configurations.
        targets: [
            { selector: ".uVMCKf" },
            { selector: ".PYmpec", hops: 4 }
        ]
    },
    {
        key: "sideBarWidget",
        targets: [
            { selector: ".liYKde", hops: 1 },   //Knowledge panel
            { selector: ".Lj180d", hops: 6 },
            { selector: ".TQc1id" }
        ]
    },
    {
        key: "ratingsWidget",
        targets: [
            { selector: ".liYKde", hops: 1 },   //Shared with sideBarWidget
            { selector: ".dhIWPd", hops: 1 },
            { selector: ".fG8Fp", hops: 1 },
            { selector: ".smukrd", hops: 1 }
        ]
    },
    {
        key: "thingsToDoWidget",
        targets: [
            { selector: ".IYoemc", hops: 3 },   //Legacy
            { selector: ".NfrtPd.UE0K3b.QsV5nc", hops: 7 }
        ],
        collapse: [
            { selector: ".IYoemc", hops: 3 },
            { selector: ".NfrtPd.UE0K3b.QsV5nc", hops: 7 }
        ]
    },
    {
        key: "thingsToKnowWidget",
        targets: [{ selector: ".dnXCYb", hops: 7 }]
    },
    {
        key: "imagesWidget",
        targets: [
            { selector: "#iur", hops: 3 },
            { selector: ".hisnlb", hops: 8 }
        ],
        collapse: [{ selector: "#iur", hops: 3 }]
    },
    {
        key: "featuredSnippet",
        targets: [
            { selector: "#Odp5De" },
            { selector: ".yKMVIe", hops: 10 },
            { selector: ".Wm5I1e" },            //AI Overview
            { selector: ".YzCcne" }             //AI Overview (variant)
        ]
    },
    {
        key: "dictionaryWidget",
        targets: [{ selector: ".bH1Fqd", hops: 13 }],
        collapse: [{ selector: "#iur", hops: 4 }]
    },
    {
        key: "businessesWidget",
        targets: [{ selector: ".ixfGmd", hops: 3 }],
        collapse: [{ selector: ".ixfGmd", hops: 3 }]
    },
    {
        key: "topSightsWidget",
        targets: [{ selector: ".UXerFf", hops: 6 }],
        collapse: [{ selector: ".UXerFf", hops: 6 }]
    },
    {
        key: "otherMessages",
        targets: [{ selector: ".WcS13d", hops: 1 }],
        collapse: [{ selector: ".WcS13d", hops: 3 }]
    },
    {
        key: "siteFavicons",
        targets: [
            { selector: ".H9lube" },
            { selector: ".DDKf1c" }
        ]
    },
    {
        key: "aboutWidget",                     //Cast, movie/game reviews, key moments, episodes
        targets: [
            { selector: ".bzXtMb" },
            { selector: ".yTFeqb.wp-ms.oJxARb.nBWfrd.VE2Ztc", hops: 3 },
            { selector: ".GJi8Lc", hops: 6 },
            { selector: ".dG2XIf", hops: 3 }    //Conversion tables and similar
        ]
    },
    {
        key: "popularExploreBuyWidget",
        targets: [
            { selector: ".ednlu.GAJC", hops: 8 },
            { selector: ".OTMJR.IFnjPb.SlP8xc.RES9jf", hops: 4 }
        ]
    },
    {
        key: "popularExploreBuySpinner",
        //Split out from the rule above because it depends on the page as well as the
        //setting: the spinner is legitimate content while the Shopping tab is selected.
        when: function(configuration, context){
            return Boolean(configuration.popularExploreBuyWidget) && !context.isShoppingTab;
        },
        targets: [{ selector: "#sho-qu__spinnerContainer", hops: 8 }]
    },
    {
        key: "relatedProductsServicesWidget",
        targets: [{ selector: "#HbKV2c" }]
    },
    {
        key: "placesToVisitWidget",
        targets: [{ selector: ".J1FGbf", hops: 16 }]
    },
    {
        key: "images",                          //Images next to or inside search results
        targets: [
            { selector: ".LnCrMe" },
            { selector: ".Sth6v" },
            { selector: ".AzcMvf", hops: 1 },
            { selector: ".SuXxEf" },
            { selector: ".EPx5le", hops: 2 },
            { selector: ".W27f5e", hops: 1 },   //Legacy
            { selector: ".SD80kd" },            //Legacy
            { selector: ".fWhgmd", hops: 4 }    //Legacy
        ]
        //.kb0PBd.cvP2Ce.LnCrMe and .kb0PBd.cvP2Ce.LnCrMe.QgmGr used to be listed here too.
        //Both are strict subsets of the plain .LnCrMe rule above, at the same depth.
    },
    {
        key: "videoTumbnails",                  //Misspelled key, kept for stored configurations.
        targets: [{ selector: ".gY2b2c" }]
    },
    {
        key: "aiModeTab",
        targets: [{ selector: ".olrp5b", hops: 2 }]
    }
]);


//The class placed on <html> to switch a rule on.
function gatingClass(key){
    return "gsc-" + key;
}

//True when this rule should be active for the given configuration and page.
function ruleIsEnabled(rule, configuration, context){
    if(typeof rule.when === "function")
        return rule.when(configuration, context || {});

    return Boolean(configuration[rule.key]);
}

//Turns one target into the CSS selector that matches the element to hide.
//
//  { selector: ".X" }                -> .X
//  { selector: ".X", hops: 1 }       -> *:has(> .X)
//  { selector: ".X", hops: 3 }       -> *:has(> * > * > .X)
//  { selector: ".X", ancestor: ".Y"} -> .Y:has(.X)
function targetSelector(target){
    if(target.ancestor)
        return target.ancestor + ":has(" + target.selector + ")";

    if(!target.hops)
        return target.selector;

    let descent = "";
    for(let i = 1; i < target.hops; i++)
        descent += "> * ";

    return "*:has(" + descent + "> " + target.selector + ")";
}

//True when this target needs :has(), which is Chrome 105+ / Firefox 121+. Plain targets
//work everywhere; the rest fall back to a scripted parent walk on older browsers.
function targetNeedsHas(target){
    return Boolean(target.ancestor) || Boolean(target.hops);
}


//Builds the stylesheet injected at document_start. Every rule is inert until the matching
//class appears on <html>, so this is safe to inject before anything is known about the
//configuration - and safe to leave in place when a setting is switched off.
function buildRemovalStyleSheet(options){
    const supportsHas = !options || options.supportsHas !== false;
    const lines = [];

    for(const rule of REMOVAL_RULES){
        const gate = "html." + gatingClass(rule.key);
        const selectors = [];

        for(const target of rule.targets){
            if(targetNeedsHas(target) && !supportsHas)
                continue;

            selectors.push(gate + " " + targetSelector(target));
        }

        if(selectors.length > 0)
            lines.push(selectors.join(",\n") + " { display: none !important; }");

        //Widgets leave a gap behind them. The element to collapse is found by script and
        //tagged, because :has() cannot be nested and so cannot express "the sibling before
        //the element that has this descendant".
        if(rule.collapse)
            lines.push(gate + ' [data-gsc-collapse~="' + rule.key + '"] { margin: 0px !important; }');
    }

    //Ad appearance. Both "stand out" modes outline the Sponsored label; only the second
    //tints the ad block, and the :not(:empty) guard keeps it from painting a bare coloured
    //box when Google renders an empty container.
    lines.push(
        "html.gsc-adsStandOut " + AD_LABEL + ", html.gsc-adsStandOut2 " + AD_LABEL + " {" +
            " color: green !important;" +
            " border: 1px solid green !important;" +
            " border-radius: 5px !important;" +
            " margin: 0px !important;" +
            " padding: 0px 5px 0px 5px !important; }"
    );

    lines.push(
        AD_CONTAINERS.map(function(selector){
            return "html.gsc-adsStandOut2 " + selector + ":not(:empty)";
        }).join(",\n") + " { padding: 10px !important; }"
    );

    return lines.join("\n\n") + "\n";
}


//Builds the stylesheet that depends on colours the user picked. Kept separate from the one
//above so that changing a colour rewrites a handful of rules rather than all of them.
function buildColorStyleSheet(configuration){
    const lines = [];

    if(configuration.colorUrl && configuration.urlColor){
        lines.push(
            URL_COLOR_TARGETS.map(function(selector){
                return "html.gsc-colorUrl " + selector;
            }).join(",\n") + " { color: " + configuration.urlColor + " !important; }"
        );
    }

    if(configuration.adsDisplay == "standOut2" && configuration.adBackgroundColor){
        const tinted = [AD_LABEL];

        for(const container of AD_CONTAINERS){
            tinted.push(container + ":not(:empty)");
            tinted.push(container + ":not(:empty) *");
        }

        lines.push(
            tinted.map(function(selector){
                return "html.gsc-adsStandOut2 " + selector;
            }).join(",\n") + " { background-color: " + configuration.adBackgroundColor + " !important; }"
        );
    }

    return lines.join("\n\n");
}


//Every class this extension puts on <html>, so they can all be cleared before reapplying.
function allGatingClasses(){
    const classes = REMOVAL_RULES.map(function(rule){ return gatingClass(rule.key); });

    classes.push("gsc-colorUrl", "gsc-adsStandOut", "gsc-adsStandOut2");

    return classes;
}


//Works out which classes belong on <html> for a configuration.
function gatingClassesFor(configuration, context){
    const classes = [];

    for(const rule of REMOVAL_RULES){
        if(ruleIsEnabled(rule, configuration, context))
            classes.push(gatingClass(rule.key));
    }

    if(configuration.colorUrl)
        classes.push("gsc-colorUrl");

    if(configuration.adsDisplay == "standOut1")
        classes.push("gsc-adsStandOut");
    else if(configuration.adsDisplay == "standOut2")
        classes.push("gsc-adsStandOut2");

    return classes;
}
