//Check if this is actually the Google search engine and not some other google site.
function isSearch(){
    const classname = document.getElementsByClassName("RNNXgb"); //Class present on one of the divs of the Google search bar.

    if(classname != undefined && classname != null)
        return true;
    else
        return false;
}

//Get URL od current page.
const url = window.location.href;

//Only run on Google domain.
if(url.includes(".google.") && isSearch()){
    //Initialization///////////////////////////////////////////////////////////

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
        "UrlColor" : "green",
        "adBackgroundColor" : "antiquewhite",
        "removeEmojis": false,
        "youtubeWidtget": false,
        "images": false,
        "mapsFindResultsOnWidget": false
    };

    //Store defaults if nothing is stored.
    chrome.storage.sync.get(['configuration'], function(storedConfiguration) { 
        if('configuration' in storedConfiguration)
            configuration = storedConfiguration;
        else
            chrome.storage.sync.set({'configuration': configuration}, function(){});

        modifySearchResults(configuration["configuration"]);
    });
}


////////////////////////////////////////////////////////////////////////


//Receive data from popup.js////////////////////////////////////////////

chrome.runtime.onMessage.addListener(receivedMessage);

function receivedMessage(message, sender, response){
    modifySearchResults(message["configuration"]);
}

/////////////////////////////////////////////////////////////////////////


//Main Function//////////////////////////////////////////////////////////

function modifySearchResults(configuration){
    //Remove Url////////////////////////////////////////////////////////
    if(configuration.removeUrl){
        //Remove url and icon.
        removeElements(".TbwUpd", 0);
        //Remove url and icon on the litle pages thingy that appears.
        removeElements(".qdrjAc", 0);

        //Decrease distance between results.
        decreaseResultDistance("TbwUpd"); //Normal results.
    }


    //Remove arrows at the end of urls////////////////////////////////////
    if(configuration.removeArrow || configuration.removeUrl || configuration.moveUrl){
        //Remove arrow.
        removeElements(".B6fmyf", 0);
        //Remove arrow from ad.
        removeElements(".e1ycic", 0);
        //Remove 3 dots if present instaed of arrow.
        removeElements(".D6lY4c", 0);
        removeElements(".rIbAWc", 0);
    }


    //Modify Ads///////////////////////////////////////////////////////////////////////
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
            let tawElement = document.getElementById("tvcap");
            let adsbottom = document.getElementById("bottomads");

            //background-color: antiquewhite;

            //Color top ads if present.
            if(tawElement != undefined)
                tawElement.style.backgroundColor = configuration.adBackgroundColor;

            //Color bottom ads if present.
            if(tawElement != undefined)
                adsbottom.style.backgroundColor = configuration.adBackgroundColor;
            
            if(tawElement != undefined){
                ApplyToClass("waTp2e", function(element){
                    //Color ads.
                    element.style.backgroundColor = configuration.adBackgroundColor;
                    element.style.padding = "10px 10px 10px 10px";
                });
            }
        }
    }else if(configuration.adsDisplay == "remove"){
        //Remove whole ad section(top).
        removeElements("#tads", 0);
        //Remove whole ad section(bottom).
        removeElements("#tadsb", 0);
        //Remove whole ad section.
        removeElements(".ads-ad", 0);
    }

    
    //Move Url////////////////////////////////////////////////////////////////
    if(configuration.moveUrl){
        cutPasteUrl();
        cutPasteUrlPagesThingy();
        
        //Decrease distance between results.
        decreaseResultDistance("TbwUpd"); //Normal results.
    }


    //MoveUrl////////////////////////////////////////////////////////////////
    if(configuration.moveUrl && (configuration.adsDisplay != "remove")){
        cutPasteUrlAds();
        
        //Decrease distance between results.
        decreaseResultDistance("sA5rQ"); //Ads
        decreaseResultDistance("TbwUpd"); //Normal results.
    }


    //Remove Widgets///////////////////////////////////////////
    if(configuration.searchWidget)
        removeElements("#botstuff", 0);

    if(configuration.askWidget){
        removeElements(".JolIg", 4);
        removeElements(".Wt5Tfe", 2);
    }
        
    if(configuration.twitterWidget)
        removeElements(".otisdd", 2);

    if(configuration.newsWidget){
        removeElements(".GmE3X", 4);
        removeElements(".yG4QQe", 1);
    }

    if(configuration.mapsWidget){
        removeElements(".AEprdc", 1);
        removeElements(".kqmHwe", 1);
    }

    if(configuration.mapsFindResultsOnWidget){
        removeElements("#i4BWVe", 1);
    }

    if(configuration.youtubeWidtget){
        removeElements(".uVMCKf", 1);
    }

    if(configuration.sideBarWidget){
        removeElements(".liYKde", 1);
        removeElements(".Lj180d", 6);
    }

    if(configuration.ratingsWidget){
        removeElements(".liYKde", 1);
        removeElements(".dhIWPd", 1);
        removeElements(".fG8Fp", 1);
        removeElements(".smukrd", 1);
    }

    //Images next to/in some search results
    if(configuration.images){
        ApplyToClass("SD80kd", function(element){
            element.style.display = "none";
        });

        ApplyToClass("FxLDp", function(element){
            element.style.padding = "0";
        });
    }

    //Color Url////////////////////////////////////////////////////////////////
    if(configuration.colorUrl){
        //Set url color
        setUrlColor(configuration.urlColor);
        //Set url color in ads.
        setUrlColorAds(configuration.urlColor);
    }


    //Remove emojis//////////////////////////////////////////////////////////////
    if(configuration.removeEmojis){
        //Make list of elements to be processed.
        let listOfElementLists = [
            document.getElementsByClassName("LC20lb"), 
            document.getElementsByClassName("st"),
            document.getElementsByClassName("cbphWd"),
            document.getElementsByClassName("fl")
        ]; 

        //For each element take it's inner text replace any emojis with '' and save the new string back into the element.
        forEachDoThis(listOfElementLists, function(element){
            const cleanedString =element.innerText.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
            if(element.innerText != cleanedString)
                element.innerText = cleanedString;
        });
    }


}

////////////////////////////////////////////////////////////////////////////////



//Search results modification functions/////////////////////////////////////////

function setUrlColor(urlColor){
    if(urlColor != ""){
        let listOfElementLists = [
            document.getElementsByClassName("iUh30")//, //url part
            //document.getElementsByClassName("eipWBe"); //urn part
        ]

        //Set the text color for each element.
        forEachDoThis(listOfElementLists, function(element){
            element.style.color = urlColor;
        });
    }
}

function setUrlColorAds(urlColor){
    if(urlColor != ""){
        let urls = document.getElementsByClassName("gBIQub"); 

        for(let i = 0; urls.length > i; i++)
            urls[i].style.color = urlColor;
    }
}

function cutPasteUrl(){
    let elements = document.getElementsByClassName("TbwUpd");
    let elementsArrow = document.getElementsByClassName("eFM0qc");

    //Set elements to flex to always push url under title.
    for(let i = 0; i < elements.length; i++){
        elements[i].style.display = "flex";
    }

    let elementsG = document.getElementsByClassName("g");
    //Decrese margin.
    for(let i = 0; i < elementsG.length; i++){
        elementsG[i].style.margin = "0px 0px 20px 0px";
    }
    
    //Remove <br>.
    for(let i = 0; i < elements.length; i++){
        let brTags = elements[i].parentNode.getElementsByTagName("BR");
        for(berTag of brTags){
            berTag.parentNode.removeChild(berTag);
        }
    }

    //Insert url into new position.
    for (let i = 0; i < elements.length; i++){
        if(!elements[i].className.includes("NJjxre")){
            let element = elements[i]; //Get url element.
            let parentElement = element.parentNode.parentNode; //Get parent element
            
            //Get the element before which the url has to be inserted.
            insertBeforeElement = parentElement.childNodes[0];
            
            //insert element in new position.
            insertAfter(element, insertBeforeElement); //parentElement.insertBefore(element, insertBeforeElement);
        }
    }

    //Remove elements.
    for (let i = 0; elements.length > i; i++){
        if(elements[i].className.includes("NJjxre")){
            //Remove element.
            elements[i].parentNode.removeChild(elements[i]);
            i--;
        }
    }
}

function cutPasteUrlAds(){
    let elements = document.getElementsByClassName("ads-visurl");
    
    for (let i = 0; i < elements.length; i++){
        if(!elements[i].className.includes("NJjxre")){
            let element = elements[i]; //Get url element.
            let parentElement = element.parentNode.parentNode; //Get parent element
            
            //Get the element before which the url has to be inserted.
            insertBeforeElement = parentElement.childNodes[0];
            
            //insert element in new position.
            insertAfter(element, insertBeforeElement); //parentElement.insertBefore(element, insertBeforeElement);
        }
    }
}

function cutPasteUrlPagesThingy(){
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
        if(br.length != 0)
            br[0].parentNode.removeChild(br[0]);
    }
}

////////////////////////////////////////////////////////////////////////////////



//Utils/////////////////////////////////////////////////////////////////////////

function removeElements(name, parentNum){
    if(name[0] == '.'){
        name = name.replace('.', '');
        const elements = document.getElementsByClassName(name);

        for (let i = 0; i < elements.length; i++){
            let node = getParentNode(elements[i], parentNum);
            node.style.display = 'none';
        }
    }else if(name[0] == '#'){
        name = name.replace('#', '');

        const element = document.getElementById(name);

        if(element != null)
            getParentNode(element, parentNum).style.display = 'none';
    }else{
        throw "Undefined element!";
    }
}

function getParentNode(element, parentNum){
    let parent = element;

    for(let i = 0; parentNum > i; i++)
        parent = parent.parentNode

    return parent;
}

function ApplyToClass(className, delegate){
    let elements = document.getElementsByClassName(className);

    for (let i = 0; i < elements.length; i++)
        delegate(elements[i]);
}

function forEachDoThis(listOfElementLists, delegate){
    for(let elementList of listOfElementLists){
        for(element of elementList){
            delegate(element);
        }
    }
}

function insertAfter(newNode, referenceNode) {
    referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

/////////////////////////////////////////////////////////////////////////////////