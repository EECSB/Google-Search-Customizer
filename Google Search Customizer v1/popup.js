

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

    document.getElementById("pureSearchResultsCheckBox").addEventListener("change", event =>{
        changeConfig("onlyShowPureSerachResults",event.target.checked);
    });

    document.getElementById("removeEmojisCheckBox").addEventListener("change", event =>{
        changeConfig("removeEmojis", event.target.checked);
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
                "onlyShowPureSerachResults": false,
                "urlColor": "green",
                "adBackgroundColor": "antiquewhite",
                "removeEmojis": false
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
        document.getElementById("pureSearchResultsCheckBox").checked = configuration.onlyShowPureSerachResults;
        document.getElementById("removeEmojisCheckBox").checked = configuration.removeEmojis;

        var classname = document.getElementsByClassName("adsDisplay");

        for (var i = 0; i < classname.length; i++) {
            if(classname[i].value == configuration.adsDisplay){
                classname[i].checked = true;
            }
        }

        //= configuration.urlColor;
        //= configuration.adBackgroundColor;
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