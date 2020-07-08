//Initialization/////////////////////////////////////////////////////////////////

let configuration = {
    "leaveLink" : true,
    "leaveArrow" : false,
    "moveLink": true,
    "adsDisplay" : "standOut2", //"remove", "standOut1", "standOut2"
    "onlyShowPureSerachResults" : false,
    "linkColor" : "green",
    "adBackgroundColor" : "antiquewhite"
};

//Store defaults if nothing is stored.
chrome.storage.sync.get(['configuration'], function(storedConfiguration) { 
    if('configuration' in storedConfiguration){
        configuration = storedConfiguration;
    }else{
        chrome.storage.sync.set({'configuration': configuration}, function(){});
    }

    modifySearchResults(configuration["configuration"]);
});



/////////////////////////////////////////////////////////////////////////


//Receive data from popup.js/////////////////////////////////////////////

chrome.runtime.onMessage.addListener(receivedMessage);

function receivedMessage(message, sender, response){
    modifySearchResults(message["configuration"]);
}

/////////////////////////////////////////////////////////////////////////


//Functions//////////////////////////////////////////////////////////////

function modifySearchResults(configuration){
    /////////////////////////////////////////////////////////////////////////

    if(configuration.leaveLink){
        //Remove just the icon and leave the link.
        removeElements(".xA33Gc", 0);
        //Remove just the icon and leave the link on the litle pages thingy that appears.
        removeElements(".Oe4cyf", 0);
    }else{
        //Remove link and icon.
        removeElements(".TbwUpd", 0);
        //Remove link and icon on the litle pages thingy that appears.
        removeElements(".qdrjAc", 0);

        //Decrease distance between results.
        decreaseResultDistance("TbwUpd"); //Normal results.
    }

    /////////////////////////////////////////////////////////////////////////


    /////////////////////////////////////////////////////////////////////////

    if(!configuration.leaveArrow){
        //Remove arrow.
        removeElements(".B6fmyf", 0);
        //Remove arrow from ad.
        removeElements(".e1ycic", 0);
    }

    /////////////////////////////////////////////////////////////////////////


    /////////////////////////////////////////////////////////////////////////

    if(configuration.adsDisplay == "standOut1" || configuration.adsDisplay == "standOut2"){
        //Make ad more obvious.
        let element = document.getElementsByClassName("VqFMTc");

        for (let i = 0; i < element.length; i++){
            element[i].style.color = "green";
            element[i].style.border = "1px solid green";
            element[i].style.borderRadius = "5px";
            element[i].style.margin = "0px 5px 0px 0px";
            element[i].style.padding = "0px 0px 0px 5px";

            if(configuration.adsDisplay == "standOut2"){
                element[i].style.backgroundColor = configuration.adBackgroundColor;
            }
        }

        if(configuration.adsDisplay == "standOut2"){
            tawElement = document.getElementById("tvcap");

            if(tawElement != undefined){
                tawElement.style.backgroundColor = configuration.adBackgroundColor;
            } 
        }
    }else if(configuration.adsDisplay == "remove"){
        //Remove whole ad section.
        removeElements("#tads", 0);
        ////Remove whole ad section.
        removeElements(".ads-ad", 0);
    }

    /////////////////////////////////////////////////////////////////////////


    /////////////////////////////////////////////////////////////////////////

    if(configuration.moveLink){
        cutPasteLink();
        cutPasteLinkPagesThingy();
        
        //Decrease distance between results.
        decreaseResultDistance("TbwUpd"); //Normal results.
    }

    if(configuration.moveLink && (configuration.adsDisplay != "remove")){
        cutPasteLinkAds();
        
        //Decrease distance between results.
        decreaseResultDistance("sA5rQ"); //Ads
        decreaseResultDistance("TbwUpd"); //Normal results.
    }

    /////////////////////////////////////////////////////////////////////////


    /////////////////////////////////////////////////////////////////////////

    if(configuration.onlyShowPureSerachResults){
        //Remove all BS except pure results. 
        removeElements(".e2BEnf", 1);

        //"People also ask" remove.
        removeElements(".xpdopen", 2);
    }

    /////////////////////////////////////////////////////////////////////////


    /////////////////////////////////////////////////////////////////////////

    setLinkColor(configuration.linkColor);

    /////////////////////////////////////////////////////////////////////////
}



function setLinkColor(linkColor){
    if(linkColor != ""){
        links = document.getElementsByClassName("iUh30");

        for(let i = 0; links.length > i; i++){
            links[i].style.color = linkColor;
        }
    }
}

function cutPasteLink(){
    let elements = document.getElementsByClassName("TbwUpd");
    let elementsConst = [];

    for (let i = 0; i < elements.length; i++){
        elementsConst.push(elements[i].getAttribute('class'));
    }

    for (let i = 0; i < elements.length; i++){
        if(!elementsConst[i].includes("qks8td")){
            let element = elements[i];
            let parentElement = element.parentNode.parentNode.parentNode;
            
            elements[i].parentNode.removeChild(elements[i]);
    
            insertBeforeElement = parentElement.childNodes[1]
    
            parentElement.insertBefore(element, insertBeforeElement);
        } 
    }
}

function cutPasteLinkAds(){
    let elements = document.getElementsByClassName("ads-visurl");
    let elementsConst = [];

    for (let i = 0; i < elements.length; i++){
        elementsConst.push(elements[i].getAttribute('class'));
    }

    for (let i = 0; i < elements.length; i++){
        if(!elementsConst[i].includes("nYN2jf")){
            let element = elements[i];
            let parentElement = element.parentNode.parentNode.parentNode/*.parentNode*/;
            
            elements[i].parentNode.removeChild(elements[i]);
    
            insertBeforeElement = parentElement.childNodes[1]
    
            parentElement.insertBefore(element, insertBeforeElement);
        } 
    }
}

function cutPasteLinkPagesThingy(){
    let elements = document.getElementsByClassName("qdrjAc");
    let elementsConst = [];

    for (let i = 0; i < elements.length; i++){
        elementsConst.push(elements[i].getAttribute('class'));
    }

    for (let i = 0; i < elements.length; i++){
        //if(!elementsConst[i].includes("qks8td")){
            let element = elements[i];
            let parentElement = element.parentNode.parentNode.parentNode;
            
            elements[i].parentNode.removeChild(elements[i]);
    
            insertBeforeElement = parentElement.childNodes[1]
    
            parentElement.insertBefore(element, insertBeforeElement);
        //} 
    }
}

function decreaseResultDistance(className){
    elements = document.getElementsByClassName(className);

    for (let i = 0; i < elements.length; i++){
        br = elements[i].parentNode.getElementsByTagName('br');
        if(br.length != 0){
            br[0].parentNode.removeChild(br[0]);
        }
    }
}

function removeElements(name, parentNum){
    let elements;

    if(name[0] == '.'){
        name = name.replace('.', '');
        elements = document.getElementsByClassName(name);
    }else if(name[0] == '#'){
        name = name.replace('#', '');
        elements = document.getElementById(name);
    }else{
        throw "Undefined element!";
    }

    for (let i = 0; i < elements.length; i++){

        let node = getParentNode(elements[i], parentNum);
        node.style.display = 'none';
    }
}

function getParentNode(element, parentNum){
    let parent = element;

    for(let i = 0; parentNum > i; i++){
        parent = parent.parentNode
    }

    return parent;
}

/////////////////////////////////////////////////////////////////////////