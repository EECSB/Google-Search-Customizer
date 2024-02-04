//Check if this is actually the Google search engine and not some other google site.
function isSearch(){
    const classname = document.getElementsByClassName("RNNXgb"); //Class present on one of the divs of the Google search bar.

    if(classname != undefined && classname != null)
        return true;
    else
        return false;
}

//Get URL of current page.
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
        "urlColor" : "green",
        "adBackgroundColor" : "antiquewhite",
        "removeEmojis": false,
        "youtubeWidtget": false,
        "images": false,
        "mapsFindResultsOnWidget": false,
        "thingsToDoWidget": false,
        "imagesWidget": false,
        "featuredSnippet": false,
        "dictionaryWidget": false,
        "businessesWidget": false,
        "topSightsWidget": false,
        "otherMessages": false,
        "siteFavicons": false
    };

    chrome.storage.sync.get(['configuration'], function(storedConfiguration) {
        if ('configuration' in storedConfiguration) { // if there is a stored configuration already
            sendToMain(storedConfiguration);
        }
        else { // if there is no stored configuration yet = extension hasn't been used yet
            chrome.storage.sync.set({'configuration': configuration}, function(){}); // store the default configuration
            chrome.storage.sync.get(['configuration'], function(storedConfiguration) {
                sendToMain(storedConfiguration);
            });
        }
    });

    //Set configuration object to the saved one and set run main function.
    function sendToMain(storedConfiguration) {
        configuration = storedConfiguration;
        modifySearchResults(configuration["configuration"]);
    }

    //Register ajax event listener to listen for requests so we can reapply the styling on endless scroll page refresh.
    var requestObserver = new PerformanceObserver( onRequestsObserved );
    requestObserver.observe( { type: 'resource' } );

    function onRequestsObserved(batch) {
        const entries = batch.getEntries();

        let requestWasMade = false;
        for(entry of entries){
            //Check if the entry is a XHR or fetch.
            if (entry.initiatorType === 'xmlhttprequest' || entry.initiatorType === 'fetch') {
                //Check if this is a request for more search results.
                if (entry.name.includes('search?')) {
                    requestWasMade = true;
                    break;
                }
            }
        }

        if(requestWasMade){
            chrome.storage.sync.get(['configuration'], function(storedConfiguration) {
                modifySearchResults(storedConfiguration["configuration"]);
            });
        }
    }
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
        //Remove 3 dots if present instead of arrow.
        removeElements(".D6lY4c", 0);
        //Remove 3 dots if present instead of arrow in ads.
        removeElements(".ONMH0e", 0);

        //removeElements(".rIbAWc", 0); //causes problem by hiding the tools as the same class is also used there: https://github.com/EECSB/Google-Search-Customizer/issues/16
    }


    //Modify Ads///////////////////////////////////////////////////////////////////////
    if(configuration.adsDisplay == "standOut1" || configuration.adsDisplay == "standOut2"){
        //Make ad more obvious.
        let element = document.getElementsByClassName("CnP9N");

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
            //let tvcapElement = document.getElementById("tvcap");
            
            let tadsElement = document.getElementById("tads");
            //Color top ads if present.
            if(tadsElement != undefined){
                if(tadsElement.innerHTML != ""){
                    //Color ads.
                    tadsElement.style.backgroundColor = configuration.adBackgroundColor;
                    tadsElement.style.padding = "10px";
                }
            }
            
            let adsbottom = document.getElementById("bottomads");
            //Color bottom ads if present.
            if(adsbottom != undefined){
                if(adsbottom.innerHTML != ""){ //Make sure the div isn't empty. 
                    adsbottom.style.backgroundColor = configuration.adBackgroundColor;
                    adsbottom.style.padding = "10px";
                }
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

    if(configuration.adsDisplay == "remove"){
        removeElements(".IhvZRb", 2); //Ads in side bar widget
        removeElements(".T98FId", 2); //Ads in search results(as widget or "Popular products widget")

        removePaddingBeforeWidget(".T98FId", 2);
    }
    

    if(configuration.searchWidget){
        removeElements("#bres", 0);
        removeElements(".O3JH7", 2);

        removeElements(".YR2tRd", 2);
        
        removeElements(".O8VmIc", 2); //Search widget in image search.

    }

    if(configuration.askWidget){
        removeElements(".JolIg", 4); //Not sure if still needed?
        removeElements(".EN1f2d", 4);

        removeElements(".Okagcf", 1); //For widgets inline/embedded into the search result.

        removePaddingBeforeWidget(".EN1f2d", 4);
    }
        
    if(configuration.twitterWidget){
        removeElements(".otisdd", 2); //Doesn't seem to work anymore but I will leave it here in case this class is used only in certain cases for the twitter widget.
        //removeElements(".M42dy", 8);
        removeElementsFromTo(".M42dy", ".ULSxyf", 8);

        removePaddingBeforeWidget(".otisdd", 6); //Doesn't seem to work anymore but I will leave it here in case this class is used only in certain cases for the twitter widget.
        //removePaddingBeforeWidget(".M42dy", 8);
        removePaddingBeforeWidgetFromTo(".M42dy", 8);
    }
        
    if(configuration.newsWidget){
        removeElements(".AHFbof", 4); //Class not always present in news widget.
        removeElements(".aUSklf", 4);

        removePaddingBeforeWidget(".AHFbof", 4); //Class not always present in news widget.
        removePaddingBeforeWidget(".aUSklf", 4);
    }

    if(configuration.mapsWidget){
        removeElements(".AEprdc", 1); //Not sure if this class is still relevant.
        removeElements(".kqmHwe", 1);

        removeElementsFromTo(".Qq3Lb", ".ULSxyf", 3);

        removePaddingBeforeWidget(".kqmHwe", 4);
        removePaddingBeforeWidgetFromTo(".Qq3Lb", ".ULSxyf", 3);
    }

    if(configuration.mapsFindResultsOnWidget){
        removeElements("#i4BWVe", 1);

        removePaddingBeforeWidget("#i4BWVe", 1);
    }

    if(configuration.youtubeWidtget){ 
        removeElements(".uVMCKf", 2);

        removePaddingBeforeWidget(".uVMCKf", 2);
    }

    if(configuration.sideBarWidget){
        removeElements(".liYKde", 1);
        removeElements(".Lj180d", 6);
        removeElements(".TQc1id", 0);
    }

    if(configuration.ratingsWidget){
        removeElements(".liYKde", 1);
        removeElements(".dhIWPd", 1);
        removeElements(".fG8Fp", 1);
        removeElements(".smukrd", 1);
    }

    if(configuration.thingsToDoWidget){
        removeElements(".IYoemc", 3);

        removePaddingBeforeWidget(".IYoemc", 3);
    }

    if(configuration.imagesWidget){
        removeElements("#iur", 4);
        removeElements(".hisnlb", 8); 
        
        removePaddingBeforeWidget("#iur", 4); 
    }

    if(configuration.featuredSnippet){
        removeElements(".M8OgIe", 0);
        removeElements(".yKMVIe", 10);
    }
    
    if(configuration.dictionaryWidget){
        removeElements(".bH1Fqd", 13);

        removePaddingBeforeWidget("#iur", 4);
    }

    if(configuration.businessesWidget){
        removeElements(".ixfGmd", 3);

        removePaddingBeforeWidget(".ixfGmd", 3);
    }

    if(configuration.topSightsWidget){
        removeElements(".UXerFf", 6);

        removePaddingBeforeWidget(".UXerFf", 6);
    }

    if(configuration.otherMessages){
        removeElements(".WcS13d", 1);

        removePaddingBeforeWidget(".WcS13d", 3);
    }
    
    if(configuration.siteFavicons){
        removeElements(".H9lube", 0);
    }

    //Images next to/in some search results
    if(configuration.images){
        removeElements(".Sth6v", 0);
        removeElements(".AzcMvf", 1);
        removeElements(".SuXxEf", 0);
        


        removeElements(".W27f5e", 1); //Not sure if still needed.

        ApplyToClass("SD80kd", function(element){ //Not sure if still needed.
            element.style.display = "none";
        });
        
        removeElements(".fWhgmd", 4); //Not sure if still needed.

        //Seems to affect all the results. Will disable for now.
        /*ApplyToClass("FxLDp", function(element){ 
            element.style.padding = "0";
        });*/
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
            document.getElementsByClassName("fl"),
            document.getElementsByClassName("VwiC3b")
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

function removePaddingBeforeWidgetFromTo(name, parentName, maxParentNum){
    if(name[0] == '.'){
        name = name.replace('.', '');
        const elements = document.getElementsByClassName(name);
        
        let node;
        for (let i = 0; i < elements.length; i++){
            node = getParentNodeFromTo(elements[i], parentName, maxParentNum);

            if(node != undefined && node != null){
                let prevNode = node.previousElementSibling;
                if(prevNode != undefined)
                    prevNode.style.margin = "0px";
                else
                    node.style.margin = "0px";
            }
        }
    }else if(name[0] == '#'){
        name = name.replace('#', '');

        const element = document.getElementById(name);
        if(element != undefined){
            let node = getParentNodeFromTo(element, parentName, maxParentNum);
            if(node != undefined  && node != null){
                let prevNode = node.previousElementSibling;
                if(prevNode != undefined)
                    prevNode.style.margin = "0px";
                else
                    node.style.margin = "0px";
            }
        }     
    }else{
        throw "Undefined element!";
    }
}

function removePaddingBeforeWidget(name, parentNum){
    if(name[0] == '.'){
        name = name.replace('.', '');
        const elements = document.getElementsByClassName(name);
        
        let node;
        for (let i = 0; i < elements.length; i++){
            node = getParentNode(elements[i], parentNum);

            if(node != undefined){
                let prevNode = node.previousElementSibling;
                if(prevNode != undefined)
                    prevNode.style.margin = "0px";
                else
                    node.style.margin = "0px";
            }
        }
    }else if(name[0] == '#'){
        name = name.replace('#', '');

        const element = document.getElementById(name);
        if(element != undefined){
            let node = getParentNode(element, parentNum);
            if(node != undefined){
                let prevNode = node.previousElementSibling;
                if(prevNode != undefined)
                    prevNode.style.margin = "0px";
                else
                    node.style.margin = "0px";
            }
        }     
    }else{
        throw "Undefined element!";
    }
}

function setUrlColor(urlColor){
    if(urlColor != ""){
        let listOfElementLists = [
            document.getElementsByClassName("qLRx3b"), //url part
            document.getElementsByClassName("ylgVCe")//, //url part
        ]

        //Set the text color for each element.
        forEachDoThis(listOfElementLists, function(element){
            element.style.color = urlColor;
        });
    }
}

function setUrlColorAds(urlColor){
    if(urlColor != ""){
        let urls = document.getElementsByClassName("x2VHCd"); 

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

function removeElements(name, parentNum, text){
    const elements = document.getElementsByClassName(name);
    for (let i = 0; i < elements.length; i++){
        let node;
        if(parentNum == -1)
            node = elements[i];
        else
            node = getParentNode(elements[i], parentNum);

        if(nonde.text.toLowerCase() == text.toLowerCase())
            node.style.display = 'none';
    }
}

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

function removeElementsFromTo(name, parentName, maxParentNum){
    if(name[0] == '.'){
        name = name.replace('.', '');
        const elements = document.getElementsByClassName(name);

        for (let i = 0; i < elements.length; i++){
            let node = getParentNodeFromTo(elements[i], parentName, maxParentNum);
            if(node != null)
                node.style.display = 'none';
        }
    }else if(name[0] == '#'){
        name = name.replace('#', '');
        const element = document.getElementById(name);

        if(element != null){
            let node = getParentNodeFromTo(element, parentName, maxParentNum);
            if(node != null)
                node.style.display = 'none';
        }
    }else{
        throw "Undefined element!";
    }
}

function getParentNodeFromTo(element, parentName, maxParentNum){
    let parent = element;
    let returnParent = null;

    for(let i = 0; maxParentNum > i; i++){
        parent = parent.parentNode;
        
        if(parentName[0] == '.'){
            let parentNameTrimmed = parentName.substring(1)
            if(parent.className.includes(parentNameTrimmed)){
                returnParent = parent;
                break;
            } 
        }else if(parentName[0] == '#'){
            if(parentName == '#' + parent.id){
                returnParent = parent;
                break;
            } 
        }
    }

    return returnParent;
}

function getParentNode(element, parentNum){
    let parent = element;

    for(let i = 0; parentNum > i; i++)
        parent = parent.parentNode;

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