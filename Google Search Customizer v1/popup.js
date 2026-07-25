whenPopupReady(() => {
    //The configuration is held here for as long as the popup is open. The popup is the only
    //thing writing it while it is open, so there is no need to re-read storage before every
    //change - which is what it used to do, doubling the API traffic for no benefit.
    let configuration = applyConfigurationDefaults(null);

    //Initialization////////////////////////////////////////////////////
    //The defaults come from defaults.js, which popup.html loads ahead of this file, so the
    //popup and the content script cannot disagree about them.
    chrome.storage.sync.get(['configuration'], function(storedConfiguration) {
        configuration = applyConfigurationDefaults(storedConfiguration["configuration"]);

        //Write back on a cold start, and also when the saved configuration predates
        //settings that have been added since - otherwise those settings stay missing.
        if(configurationNeedsUpgrade(storedConfiguration["configuration"]))
            chrome.storage.sync.set({'configuration': configuration}, function(){});

        setUI(configuration);
    });

    ////////////////////////////////////////////////////////////////////

    //Events////////////////////////////////////////////////////////////
    
        //UI Events////////////////////////////////////////////////////////////////
    
        document.getElementById('darkModeToggle').addEventListener('click', () => {
            const body = document.body;
            body.classList.toggle('dark-mode');

            if (body.classList.contains('dark-mode'))
                changeConfig("theme", "dark");
            else
                changeConfig("theme", "light");
        });
    
        ///////////////////////////////////////////////////////////////////////////

        //Checkbox events//////////////////////////////////////////////////////////
        
        document.getElementById("removeUrlCheckBox").addEventListener("change", event =>{
            changeConfig("removeUrl", event.target.checked);
        });

        document.getElementById("removeArrowCheckBox").addEventListener("change", event =>{
            changeConfig("removeArrow", event.target.checked);
        });

        //document.getElementById("moveCheckBox").addEventListener("change", event =>{
        //    changeConfig("moveUrl", event.target.checked);
        //});

        document.getElementById("colorUrlCheckBox").addEventListener("change", event =>{
            changeConfig("colorUrl", event.target.checked);
        });

        document.getElementById("searchWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("searchWidget",event.target.checked);
        });

        document.getElementById("askWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("askWidget",event.target.checked);
        });

        document.getElementById("twitterWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("twitterWidget",event.target.checked);
        });

        document.getElementById("newsWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("newsWidget",event.target.checked);
        });

        document.getElementById("mapsWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("mapsWidget",event.target.checked);
        });

        document.getElementById("sideBarWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("sideBarWidget",event.target.checked);
        });

        document.getElementById("ratingsWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("ratingsWidget",event.target.checked);
        });

        document.getElementById("removeEmojisCheckBox").addEventListener("change", event =>{
            changeConfig("removeEmojis", event.target.checked);
            setRefreshNoticeVisible(event.target.checked);
        });

        document.getElementById("youtubeWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("youtubeWidtget", event.target.checked);
        });

        document.getElementById("imagesCheckBox").addEventListener("change", event =>{
            changeConfig("images", event.target.checked);
        });

        document.getElementById("mapsFindResultsOnWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("mapsFindResultsOnWidget", event.target.checked);
        });

        document.getElementById("thingsToDoWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("thingsToDoWidget", event.target.checked);
        });

        document.getElementById("thingsToKnowWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("thingsToKnowWidget", event.target.checked);
        });

        document.getElementById("imagesWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("imagesWidget", event.target.checked);
        });

        document.getElementById("featuredSnippetCheckBox").addEventListener("change", event =>{
            changeConfig("featuredSnippet", event.target.checked);
        });

        document.getElementById("dictionaryWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("dictionaryWidget", event.target.checked);
        });

        document.getElementById("businessesWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("businessesWidget", event.target.checked);
        });

        document.getElementById("topSightsWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("topSightsWidget", event.target.checked);
        });

        document.getElementById("otherMessagesCheckBox").addEventListener("change", event =>{
            changeConfig("otherMessages", event.target.checked);
        });  

        document.getElementById("siteFaviconsCheckBox").addEventListener("change", event =>{
            changeConfig("siteFavicons", event.target.checked);
        });
        
        document.getElementById("videoTumbnailsCheckBox").addEventListener("change", event =>{
            changeConfig("videoTumbnails", event.target.checked);
        });

        document.getElementById("aiModeTabCheckBox").addEventListener("change", event =>{
            changeConfig("aiModeTab", event.target.checked);
        });

        document.getElementById("aboutWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("aboutWidget", event.target.checked);
        });

        document.getElementById("popularExploreBuyWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("popularExploreBuyWidget", event.target.checked);
        });

        document.getElementById("relatedProductsServicesWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("relatedProductsServicesWidget", event.target.checked);
        });
        
        document.getElementById("placesToVisitWidgetCheckBox").addEventListener("change", event =>{
            changeConfig("placesToVisitWidget", event.target.checked);
        });

        ///////////////////////////////////////////////////////////////////////////

        //Other////////////////////////////////////////////////////////////////////

        //Color Selection /////
        //
        //A colour picker fires "input" continuously while it is dragged and "change" once,
        //when it closes. Both used to write to chrome.storage.sync, which is rate limited to
        //roughly 120 writes a minute - a few seconds of dragging blew through the quota and
        //the remaining writes were rejected silently, so the chosen colour did not stick.
        //
        //Dragging now only previews: the new colour goes straight to the page, which costs
        //nothing because the content script just rewrites a couple of CSS rules. The value is
        //saved once, when the picker closes.
        previewAndCommit("adBackgroundColorSelection", "adBackgroundColor");
        previewAndCommit("urlColorSelection", "urlColor");
    
        //Button///////////////
        document.getElementById("defaultSettings").addEventListener("click", restoreDefaultConfig);
        
        ///////////////////////////////////////////////////////////////////////////
    
    ///////////////////////////////////////////////////////////////////////////

    //Wires a colour input so that dragging previews and releasing saves.
    function previewAndCommit(elementId, key){
        const picker = document.getElementById(elementId);

        picker.addEventListener("input", event =>{
            configuration[key] = event.target.value;
            sendToProgramJS({ "configuration": configuration });
        });

        picker.addEventListener("change", event =>{
            changeConfig(key, event.target.value);
        });
    }

    function restoreDefaultConfig(){
        //applyConfigurationDefaults with nothing to merge in gives a plain, mutable copy of
        //the defaults. DEFAULT_CONFIGURATION itself is frozen and shared, so it must not be
        //handed out directly.
        configuration = applyConfigurationDefaults(null);

        sendToProgramJS({ "configuration": configuration });
        setUI(configuration);

        chrome.storage.sync.set({'configuration': configuration}, function(){});
    }

    ///////////////////////

    //Radio events/////////
    var classname = document.getElementsByClassName("adsDisplay");

    for (var i = 0; i < classname.length; i++) {
        classname[i].addEventListener('change', setAdSettings, false);
    }

    function setAdSettings(){
        changeConfig("adsDisplay", this.value);
    }

    ///////////////////////
    
    //Functions////////////////////////////////////////////////////////////

    function setUI(configuration){
        document.getElementById("removeUrlCheckBox").checked = configuration.removeUrl;
        document.getElementById("removeArrowCheckBox").checked = configuration.removeArrow;
        //document.getElementById("moveCheckBox").checked = configuration.moveUrl;
        document.getElementById("colorUrlCheckBox").checked = configuration.colorUrl;
        document.getElementById("removeEmojisCheckBox").checked = configuration.removeEmojis;
        setRefreshNoticeVisible(configuration.removeEmojis);

        document.getElementById("searchWidgetCheckBox").checked = configuration.searchWidget;
        document.getElementById("askWidgetCheckBox").checked = configuration.askWidget;
        document.getElementById("twitterWidgetCheckBox").checked = configuration.twitterWidget;
        document.getElementById("newsWidgetCheckBox").checked = configuration.newsWidget;
        document.getElementById("mapsWidgetCheckBox").checked = configuration.mapsWidget;
        document.getElementById("sideBarWidgetCheckBox").checked = configuration.sideBarWidget;
        document.getElementById("ratingsWidgetCheckBox").checked = configuration.ratingsWidget;
        document.getElementById("youtubeWidgetCheckBox").checked = configuration.youtubeWidtget;
        document.getElementById("imagesCheckBox").checked = configuration.images;
        document.getElementById("mapsFindResultsOnWidgetCheckBox").checked = configuration.mapsFindResultsOnWidget;
        document.getElementById("thingsToDoWidgetCheckBox").checked = configuration.thingsToDoWidget;
        document.getElementById("thingsToKnowWidgetCheckBox").checked = configuration.thingsToKnowWidget;
        document.getElementById("imagesWidgetCheckBox").checked = configuration.imagesWidget;
        document.getElementById("featuredSnippetCheckBox").checked = configuration.featuredSnippet;
        document.getElementById("dictionaryWidgetCheckBox").checked = configuration.dictionaryWidget;
        document.getElementById("businessesWidgetCheckBox").checked = configuration.businessesWidget;
        document.getElementById("topSightsWidgetCheckBox").checked = configuration.topSightsWidget;
        document.getElementById("otherMessagesCheckBox").checked = configuration.otherMessages;
        document.getElementById("siteFaviconsCheckBox").checked = configuration.siteFavicons;
        document.getElementById("videoTumbnailsCheckBox").checked = configuration.videoTumbnails;
        document.getElementById("aiModeTabCheckBox").checked = configuration.aiModeTab;
        document.getElementById("aboutWidgetCheckBox").checked = configuration.aboutWidget;
        document.getElementById("popularExploreBuyWidgetCheckBox").checked = configuration.popularExploreBuyWidget;
        document.getElementById("relatedProductsServicesWidgetCheckBox").checked = configuration.relatedProductsServicesWidget;
        document.getElementById("placesToVisitWidgetCheckBox").checked = configuration.placesToVisitWidget;
        
        document.getElementById("adBackgroundColorSelection").value = configuration.adBackgroundColor;
        document.getElementById("urlColorSelection").value = configuration.urlColor;
        
        //Set theme.
        if (configuration["theme"] == "dark")
            document.body.classList.add('dark-mode');

        var classname = document.getElementsByClassName("adsDisplay");

        for (var i = 0; i < classname.length; i++) {
            if(classname[i].value == configuration.adsDisplay){
                classname[i].checked = true;
            }
        }
    }

    //Every setting now takes effect on the open search page as soon as it is changed, and
    //takes effect in reverse when it is switched off - the content script drives them from a
    //stylesheet rather than by writing display:none onto elements.
    //
    //Remove Emojis is the exception. Switching it on works immediately, but it rewrites the
    //text of the results, so switching it off cannot put the deleted characters back without
    //a reload. The notice is shown only while that setting is on.
    function setRefreshNoticeVisible(visible){
        document.getElementById("message").hidden = !visible;
    }

    //Saves one setting and pushes the result to the open search pages.
    //
    //Writes straight from the copy held above rather than re-reading storage first. The
    //popup is the only writer while it is open, so the read was pure overhead - and it is
    //what made the colour picker's write rate twice as expensive as it needed to be.
    function changeConfig(key, value){
        configuration[key] = value;

        chrome.storage.sync.set({'configuration': configuration}, function(){});

        sendToProgramJS({ "configuration": configuration });
    }

    //Sends a configuration to every tab that has the content script in it.
    //
    //This used to target only the active tab in the current window, so with several search
    //pages open the rest kept the old appearance until they were reloaded. It also read
    //tabs[0].id without checking - on a chrome:// page, the New Tab page, or the Web Store
    //the array can be empty, and the resulting TypeError went to a console nobody reads
    //while the send silently never happened.
    //
    //Tabs are not filtered by URL: doing that needs the "tabs" permission, and the manifest
    //already limits the content script to Google domains. Tabs without it just fail to
    //receive, which is what the callback below absorbs.
    function sendToProgramJS(payload){
        chrome.tabs.query({}, function (tabs){
            if(!Array.isArray(tabs))
                return;

            for(const tab of tabs){
                if(tab == null || tab.id == null)
                    continue;

                //Reading lastError is what stops Chrome logging "Receiving end does not
                //exist" for every tab that has no content script in it.
                chrome.tabs.sendMessage(tab.id, payload, function(){
                    void chrome.runtime.lastError;
                });
            }
        });
    }

    //////////////////////////////////////////////////////////////////////
});

//Runs the popup's setup once the DOM is ready, immediately if it already is.
//
//popup.js used to hang everything on window "load", which waits for images and the rest of
//the subresources. The scripts are deferred now, so this fires as soon as parsing is done.
function whenPopupReady(action){
    if(document.readyState === "loading")
        document.addEventListener('DOMContentLoaded', action, { once: true });
    else
        action();
}
