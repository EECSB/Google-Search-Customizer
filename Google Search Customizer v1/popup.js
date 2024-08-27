window.addEventListener('load', (event) => {
    let configuration = {
        "removeUrl" : false,
        "removeArrow" : false,
        "moveUrl": false,
        "colorUrl": false,
        "adsDisplay" : "normal", //"remove", "standOut1", "standOut2"
        "searchWidget": false,
        "askWidget": false,
        "twitterWidget": false,
        "newsWidget": false,
        "mapsWidget": false,
        "sideBarWidget": false,
        "ratingsWidget": false,
        "urlColor" : "#008000",
        "adBackgroundColor" : "#faebd7",
        "removeEmojis": false,
        "youtubeWidtget": false,
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
        "videoTumbnails": false,
        "theme": "light"
    };
    //Initialization////////////////////////////////////////////////////
    chrome.storage.sync.get(['configuration'], function(storedConfiguration) {
        if ('configuration' in storedConfiguration) { // if there is a stored configuration already
            storeConfig(storedConfiguration);
        }
        else { // if there is no stored configuration yet = extension hasn't been used yet
            chrome.storage.sync.set({'configuration': configuration}, function(){});
            chrome.storage.sync.get(['configuration'], function(storedConfiguration) {
                storeConfig(storedConfiguration);
            });
        }
    });
    // set configuration object to the saved one and set UI
    function storeConfig(storedConfiguration) {
        configuration = storedConfiguration;
        setUI(configuration["configuration"]);
    }

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

        document.getElementById("moveCheckBox").addEventListener("change", event =>{
            changeConfig("moveUrl", event.target.checked);
        });

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

        ///////////////////////////////////////////////////////////////////////////

        //Other////////////////////////////////////////////////////////////////////

        //Color Selection /////
        document.getElementById("adBackgroundColorSelection").addEventListener("input", event =>{
            changeConfig("adBackgroundColor", event.target.value);
        });

        document.getElementById("urlColorSelection").addEventListener("input", event =>{
            changeConfig("urlColor", event.target.value);
        });
    
        //Button///////////////
        document.getElementById("defaultSettings").addEventListener("click", restoreDefaultConfig);
        
        ///////////////////////////////////////////////////////////////////////////
    
    ///////////////////////////////////////////////////////////////////////////

    function restoreDefaultConfig(){
        const defaultConfiguration = {
            "configuration":{
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
                "youtubeWidtget": false,
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
                "videoTumbnails": false,
                "theme": "light"
            }
        }

        sendToProgramJS(defaultConfiguration);

        setUI(defaultConfiguration["configuration"]);

        chrome.storage.sync.set({'configuration': defaultConfiguration["configuration"]}, function(){});
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
        document.getElementById("moveCheckBox").checked = configuration.moveUrl;
        document.getElementById("colorUrlCheckBox").checked = configuration.colorUrl;
        document.getElementById("removeEmojisCheckBox").checked = configuration.removeEmojis;

        document.getElementById("searchWidgetCheckBox").checked = configuration.searchWidget;
        document.getElementById("askWidgetCheckBox").checked = configuration.askWidget;
        document.getElementById("twitterWidgetCheckBox").checked = configuration.twitterWidget;
        document.getElementById("newsWidgetCheckBox").checked = configuration.newsWidget;
        document.getElementById("mapsWidgetCheckBox").checked = configuration.mapsWidget;
        document.getElementById("sideBarWidgetCheckBox").checked = configuration.sideBarWidget;
        document.getElementById("ratingsWidgetCheckBox").checked = configuration.ratingsWidget;
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

    function changeConfig(key, value){
        chrome.storage.sync.get(['configuration'], function(configuration) { 
            configuration["configuration"][key] = value;

            chrome.storage.sync.set({'configuration': configuration["configuration"]}, function(){});

            sendToProgramJS(configuration);
        });
    }

    function sendToProgramJS(payload){
        chrome.tabs.query({currentWindow: true, active: true}, function (tabs){
            chrome.tabs.sendMessage(tabs[0].id, payload); ///////////////////////////////////////////////////////////////////////////////////////////////////////////
        });
    }

    //////////////////////////////////////////////////////////////////////
});