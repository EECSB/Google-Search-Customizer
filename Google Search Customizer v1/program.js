//Checks if this is actually the Google search engine and not some other site.
function checkIfRun(){
    //Don't run script if not on a google domain.
    if(!window.location.href.includes(".google."))
        return false;

    const elements = document.getElementsByTagName("html");

    for(element of elements){
        const itemTypeValue = element.getAttribute('itemtype');        
        
        //Only run script if we are on the search results page.
        if(itemTypeValue !== null){
            if(itemTypeValue.includes('SearchResultsPage'))
                return true;
            else
                return false;
        }
    }
}

if(checkIfRun()){
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
        "urlColor" : "#008000",
        "adBackgroundColor" : "#faebd7",
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
        "siteFavicons": false,
        "videoTumbnails": false
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
        //If this is left enabled the results will have no spacing between them whatsoever.
        //Seems like this isn't needed anymore?
        /*let elements = document.getElementsByClassName("TbwUpd");
        for (let i = 0; i < elements.length; i++){
            br = elements[i].parentNode.getElementsByTagName('br');
            if(br.length != 0)
                br[0].parentNode.removeChild(br[0]);
        }*/
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
        let element = document.querySelectorAll(".U3A9Ac.qV8iec");

        for (let i = 0; i < element.length; i++){
            element[i].style.color = "green";
            element[i].style.border = "1px solid green";
            element[i].style.borderRadius = "5px";
            element[i].style.margin = "0px";
            element[i].style.padding = "0px 5px 0px 5px";

            if(configuration.adsDisplay == "standOut2"){
                element[i].style.backgroundColor = configuration.adBackgroundColor;
            }
        }

        if(configuration.adsDisplay == "standOut2"){
            let adElements = document.querySelectorAll('#tads, #tadsb, #bottomads'); //tvcap

            //Color ads if any are present.
            if(adElements != undefined){
                for(adElement of adElements){
                    if(adElement.innerHTML != ""){
                        //Color ads.
                        adElement.style.backgroundColor = configuration.adBackgroundColor;
                        adElement.style.padding = "10px";
                    }
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

        //If top ads are present move up search results to reduce the gap.
        if(document.getElementById("tads") != null)
            document.getElementById("center_col").style.top = "-80px";
    }
    
    //Move Url////////////////////////////////////////////////////////////////
    if(configuration.moveUrl){
        //Push url and favicon under title.
        const elements = document.querySelectorAll('h3.LC20lb');
        for(element of elements){
            element.style.marginTop = '0';
            element.style.marginBottom = element.nextSibling.clientHeight + "px"; //Same as the height of the url div

            element.nextSibling.style.marginTop = /*element.clientHeight*/50 + "px"; //Same as height of the h3 element before it.
        }

        //Decrease vertical spacing between results.
        const searchResults = document.querySelectorAll('.g.Ww4FFb.vt6azd.tF2Cxc.asEBEc');
        for(result of searchResults){
            result.style.marginBottom = '0';
        }
    }


    //Move Url(within Ads)////////////////////////////////////////////////////
    if(configuration.moveUrl && (configuration.adsDisplay != "remove")){
        //Push url and favicon under title.
        const elements = document.querySelectorAll('.CCgQ5.vCa9Yd.QfkTvb.N8QANc.Va3FIb.EE3Upf');
        for(element of elements){
            element.style.marginTop = '0';
            element.style.marginBottom = element.nextSibling.clientHeight + "px"; //Same as the height of the url div

            element.nextSibling.style.marginTop = element.clientHeight + "px"; //Same as height of the h3 element before it.
        }
        
        //Decrease vertical spacing between results.
        const searchResults = document.querySelectorAll('.d8lRkd');
        for(result of searchResults){
            result.style.marginBottom = '0';
        }

        //If top ads are present move up search results to reduce the gap.
        if(document.getElementById("tads") != null)
            document.getElementById("center_col").style.top = "-80px";
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

        //Map + Images widget
        removeElements(".Lx2b0d", 12);

        //City name
        removeElements(".XqFnDf", 0);
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
        ///Not sure if still needed? //////////////
        removeElements(".IYoemc", 3);
        removePaddingBeforeWidget(".IYoemc", 3);
        ///////////////////////////////////////////
        
        removeElements(".NfrtPd.UE0K3b.QsV5nc", 7);
        removePaddingBeforeWidget(".NfrtPd.UE0K3b.QsV5nc", 7);
    }

    if(configuration.imagesWidget){
        removeElements("#iur", 4);
        removeElements(".hisnlb", 8); 
        
        removePaddingBeforeWidget("#iur", 4); 
    }

    if(configuration.featuredSnippet){
        removeElements("#Odp5De", 0);
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

        removeElements(".kb0PBd.cvP2Ce.LnCrMe.QgmGr", 0);
        removeElements(".EPx5le", 2);

        //////////////////////////////////////////////
        //Remove maybe?

        removeElements(".W27f5e", 1); //Not sure if still needed.

        ApplyToClass("SD80kd", function(element){ //Not sure if still needed.
            element.style.display = "none";
        });
        
        removeElements(".fWhgmd", 4); //Not sure if still needed.

        //////////////////////////////////////////////
    }

    //Video thumbnails next to/in some search results
    if(configuration.videoTumbnails){
        removeElements(".gY2b2c", 0);
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
    let elements = document.querySelectorAll(name);

    for (let i = 0; i < elements.length; i++){
        let node = getParentNodeFromTo(elements[i], parentName, maxParentNum);

        if(node != undefined && node != null){
            let prevNode = node.previousElementSibling;
            if(prevNode != undefined)
                prevNode.style.margin = "0px";
            else
                node.style.margin = "0px";
        }
    }
}

function removePaddingBeforeWidget(name, parentNum){
    let elements = document.querySelectorAll(name);

    for (let i = 0; i < elements.length; i++){
        let node = getParentNode(elements[i], parentNum);

        if(node != undefined){
            let prevNode = node.previousElementSibling;
            if(prevNode != undefined)
                prevNode.style.margin = "0px";
            else
                node.style.margin = "0px";
        }
    }    
}

function setUrlColor(urlColor){
    if(urlColor != ""){
        let listOfElementLists = [
            document.getElementsByClassName("qLRx3b"), //url part
            document.getElementsByClassName("ylgVCe"), //url part
        ]

        //Set the text color for each element.
        forEachDoThis(listOfElementLists, function(element){
            element.style.color = urlColor;
        });

        //Apply to the child of byrV5b //Not the nicest implementation but it's good enough for now.
        const elements = document.getElementsByClassName("byrV5b");
        for(element of elements){
            for(child of element.childNodes){
                child.style.color = urlColor;
            }
        }
    }
}

function setUrlColorAds(urlColor){
    if(urlColor != ""){
        let urls = document.getElementsByClassName("x2VHCd"); 

        for(let i = 0; urls.length > i; i++)
            urls[i].style.color = urlColor;
    }
}

////////////////////////////////////////////////////////////////////////////////



//Utils/////////////////////////////////////////////////////////////////////////

function removeElements(selector, parentNum, text){
    const elements = document.querySelectorAll(selector);
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

function removeElements(selector, parentNum){
    const elements = document.querySelectorAll(selector);

    for (let i = 0; i < elements.length; i++){
        let node = getParentNode(elements[i], parentNum);
        node.style.display = 'none';
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