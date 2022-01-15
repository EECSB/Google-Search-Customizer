

window.addEventListener('load', (event) => {
    //Initialization////////////////////////////////////////////////////
    chrome.storage.sync.get(['configuration'], function(configuration) { 
        setUI(configuration["configuration"]);
    });

    ////////////////////////////////////////////////////////////////////

    //Events////////////////////////////////////////////////////////////

    //Checkbox events//////////////////////
    
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

    document.getElementById("youtubeWidtgetCheckBox").addEventListener("change", event =>{
        changeConfig("youtubeWidtget", event.target.checked);
    });

    document.getElementById("imagesCheckBox").addEventListener("change", event =>{
        changeConfig("images", event.target.checked);
    });

    document.getElementById("mapsFindResultsOnWidgetCheckBox").addEventListener("change", event =>{
        changeConfig("mapsFindResultsOnWidget", event.target.checked);
    });

    //Color Selection /////
    document.getElementById("adBackgroundColorSelection").addEventListener("change", event =>{
        changeConfig("adBackgroundColor", event.target.value);
    });

    document.getElementById("urlColorSelection").addEventListener("change", event =>{
        changeConfig("urlColor", event.target.value);
    });
    
    //Button///////////////
    document.getElementById("defaultSettings").addEventListener("click", restoreDefaultConfig);

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
                "urlColor": "green",
                "adBackgroundColor": "antiquewhite",
                "removeEmojis": false,
                "youtubeWidtget": false,
                "images": false,
                "mapsFindResultsOnWidget": false
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
        document.getElementById("youtubeWidtgetCheckBox").checked = configuration.youtubeWidtget;
        document.getElementById("imagesCheckBox").checked = configuration.images;
        document.getElementById("mapsFindResultsOnWidgetCheckBox").checked = configuration.mapsFindResultsOnWidget;

        document.getElementById("adBackgroundColorSelection").value  = configuration.adBackgroundColor;
        document.getElementById("urlColorSelection").value  = configuration.urlColor;

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
            chrome.tabs.sendMessage(tabs[0].id, payload);
        });
    }

    //////////////////////////////////////////////////////////////////////
});