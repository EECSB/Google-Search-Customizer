//Shared configuration defaults/////////////////////////////////////////////////////////
//
//Loaded before program.js (as a content script) and before popup.js (from popup.html),
//so both halves of the extension read the same object.
//
//This used to be written out by hand in three places: the content script's cold start,
//the popup's cold start, and the "Restore Defaults" button. Two settings went missing
//from one of the copies, which meant whether they were ever saved depended on whether
//the user opened a search page or the popup first.
//
//To add a setting: add it here, and nowhere else.

//What this file publishes to the scripts loaded alongside it. These are classic scripts
//sharing one global lexical environment, so there is nothing to export - the comment is
//what tells a linter (and a reader) which names are the file's surface.
/* exported applyConfigurationDefaults, configurationNeedsUpgrade */

const DEFAULT_CONFIGURATION = Object.freeze({
    "removeUrl": false,
    "removeArrow": false,
    "moveUrl": false,
    "colorUrl": false,
    "adsDisplay": "normal", //"remove", "standOut1", "standOut2"
    "searchWidget": false,
    "askWidget": false,
    "twitterWidget": false,
    "newsWidget": false,
    "mapsWidget": false,
    "sideBarWidget": false,
    "ratingsWidget": false,
    "urlColor": "#008000",
    "adBackgroundColor": "#faebd7",
    "removeEmojis": false,
    "youtubeWidtget": false, //Misspelled, but renaming it would orphan every saved configuration.
    "images": false,
    "mapsFindResultsOnWidget": false,
    "thingsToDoWidget": false,
    "thingsToKnowWidget": false,
    "imagesWidget": false,
    "featuredSnippet": false,
    "dictionaryWidget": false,
    "businessesWidget": false,
    "topSightsWidget": false,
    "otherMessages": false,
    "siteFavicons": false,
    "videoTumbnails": false, //Misspelled, same reason as above.
    "aboutWidget": false,
    "popularExploreBuyWidget": false,
    "theme": "light",
    "aiModeTab": false,
    "relatedProductsServicesWidget": false,
    "placesToVisitWidget": false
});


//Returns a complete configuration: whatever was stored, with anything it is missing
//filled in from the defaults above.
//
//Storage holds whatever the version that wrote it knew about, and settings get added with
//almost every release. Without this, a configuration saved by an older version keeps its
//gaps forever - newly added settings read as undefined and their checkboxes render
//unchecked no matter what the user does.
function applyConfigurationDefaults(storedConfiguration){
    return Object.assign({}, DEFAULT_CONFIGURATION, storedConfiguration);
}


//True when the stored configuration is absent or predates one of the settings above, and
//therefore needs writing back.
function configurationNeedsUpgrade(storedConfiguration){
    if(storedConfiguration == null)
        return true;

    for(const key of Object.keys(DEFAULT_CONFIGURATION)){
        if(!(key in storedConfiguration))
            return true;
    }

    return false;
}
