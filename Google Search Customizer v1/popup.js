

window.addEventListener('load', (event) => {
    //Initialization////////////////////////////////////////////////////

    chrome.storage.sync.get(['configuration'], function(configuration) { 
        setUI(configuration["configuration"]);
    });

    ////////////////////////////////////////////////////////////////////


    //Events////////////////////////////////////////////////////////////

    //Checkbox events//////////////////////
    document.getElementById("leaveLinkCheckBox").addEventListener("change", event =>{
        let value;

        if(event.target.checked){
            value = true;
        }else{
            value = false;
        }

        changeConfig("leaveLink", value);
    });

    document.getElementById("leaveArrowCheckBox").addEventListener("change", event =>{
        let value;

        if(event.target.checked){
            value = true;
        }else{
            value = false;
        }

        changeConfig("leaveArrow", value);
    });

    document.getElementById("moveCheckBox").addEventListener("change", event =>{
        let value;

        if(event.target.checked){
            value = true;
        }else{
            value = false;
        }

        changeConfig("moveLink", value);
    });

    document.getElementById("colorLinkCheckBox").addEventListener("change", event =>{
        let value;

        if(event.target.checked){
            value = true;
        }else{
            value = false;
        }

        changeConfig("colorLink", value);
    });

    document.getElementById("pureSearchResultsCheckBox").addEventListener("change", event =>{
        let value;

        if(event.target.checked){
            value = true;
        }else{
            value = false;
        }

        changeConfig("onlyShowPureSerachResults", value);
    });
    
    //Button///////////////
    document.getElementById("defaultSettings").addEventListener("click", restoreDefaultConfig);

    function restoreDefaultConfig(){
        const defaultConfiguration = {
            "configuration":{
                "leaveLink": true,
                "leaveArrow": false,
                "moveLink": true,
                "colorLink": true,
                "adsDisplay": "standOut2", //"remove", "standOut1", "standOut2"
                "onlyShowPureSerachResults": false,
                "linkColor": "green",
                "adBackgroundColor": "antiquewhite"
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
        document.getElementById("leaveLinkCheckBox").checked = configuration.leaveLink;
        document.getElementById("leaveArrowCheckBox").checked = configuration.leaveArrow;
        document.getElementById("moveCheckBox").checked = configuration.moveLink;
        document.getElementById("colorLinkCheckBox").checked = configuration.colorLink;
        document.getElementById("pureSearchResultsCheckBox").checked = configuration.onlyShowPureSerachResults;

        var classname = document.getElementsByClassName("adsDisplay");

        for (var i = 0; i < classname.length; i++) {
            if(classname[i].value == configuration.adsDisplay){
                classname[i].checked = true;
            }
        }

        //= configuration.linkColor;
        //= configuration.adBackgroundColor;
    }

    function changeConfig(key, value){
        chrome.storage.sync.get(['configuration'], function(configuration) { 
            configuration["configuration"][key] = value;

            sendToProgramJS(configuration);

            chrome.storage.sync.set({'configuration': configuration["configuration"]}, function(){});
        });
    }

    function sendToProgramJS(payload){
        chrome.tabs.query({currentWindow: true, active: true}, function (tabs){
            chrome.tabs.sendMessage(tabs[0].id, payload);
        });
    }

    //////////////////////////////////////////////////////////////////////
});