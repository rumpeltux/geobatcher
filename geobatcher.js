/****** Batch Geocoding functions ******/
var HOST_URL = 'http://open.mapquestapi.com/';
var PARAMS = 'maxResults=1&thumbMaps=false&key=Fmjtd%7Cluub256a2g%2Cba%3Do5-9urw0y'
var BATCH_POST = HOST_URL + 'geocoding/v1/batch?' + PARAMS;
var SINGLE_POST = HOST_URL + 'geocoding/v1/address?' + PARAMS;
var NOMINATIM_URL = HOST_URL + 'nominatim/v1/search?format=json&' + PARAMS;
var FXPT = 5; // 1m accuracy
var pois;
var centreLatLng = {lat:51.5080, lng:-0.1258};
var clicker;
var listings = [];
var alternatives = [];
        
function parser(string){
    listings = [];
    string = string.replace(/\n/g,'');
    string = string.replace(/{{(see|do|buy|eat|drink|sleep|listing)/g,'{{listing| type=$1');
    string = string.replace(/{{vCard/g,'{{listing');
    
    var listRegex = /{{(listing[^}]*)}}/g;
    var listArr = string.match(listRegex);
    for (var i=0; i<listArr.length; i++) {
        var listObj = new Object();
        var listParams = listArr[i].split('|');
        for (var j=1;j<listParams.length;j++) {
            var key = listParams[j].split('=');
            key[0] = key[0].replace(/(^\s+|\s+$)/,''); //trim whitespace
            //key[1] = key[1].replace('|','\\|');
            //key[1] = key[1].replace(/(^\s+|\s+$)/g,' '); //trim whitespace
            listObj[key[0]] = key[1];
        }
        listings.push(listObj);
    }
    //return listings;
}
/*
function geoParser(string) {
    var geoRegex = /{{(geo[^}]*)}}/;
    if (string.test(geoRegex)) {
        var geoLatLng = string.match(geoRegex)[0].slice(6, -2).split('|');
        alert(geoLatLng);
        return true;
    }
    return false;
}*/

function batchSearch() {
    var queryList = [];
    var textBox = document.getElementById("nolatlng");
    parser(textBox.value);
    //geoParser(textBox.value);
    var areaBox = ' ' + document.getElementById("area").value;

    // mapquest bug, no results shown if first result is null
    var query = "&location="+areaBox;
    var searchType = document.getElementById('search-address').checked;
    //creates mapquest batch geocoding query
    for (var i = 0; i < listings.length; i++) {
        //var str = listings[i].name;
        if (isWhitespaceOrEmpty(listings[i].lat)) {
            queryList.push(i);
            if (searchType && !isWhitespaceOrEmpty(listings[i].address)) {
                query += "&location=" + listings[i].address.replace(/#.*|.*\//,"") + ", " + areaBox;
            }
            else {
                query += "&location=" + listings[i].name.replace(/\u0026|\u2019/,"") + ", " + areaBox;
            }
        }
    }
    
    document.getElementById("stats").value = "Looking for "+queryList.length+" listings...";
    // runs mapquest batch geocoding query
    runQuery(BATCH_POST + query, function(response) { renderBatch(response, queryList); });
}

function batchSearchNominatim() {
    var queryList = [];
    var textBox = document.getElementById("nolatlng");
    var areaBox = '' + document.getElementById("area").value;
    parser(textBox.value);
    var searchType = document.getElementById('search-address').checked;
    //creates mapquest batch geocoding query
    for (var i = 0; i < listings.length; i++) {
        if (isWhitespaceOrEmpty(listings[i].lat)) {
            queryList.push(i);
            var query = (searchType && !isWhitespaceOrEmpty(listings[i].address)) ?
                listings[i].address.replace(/#.*|.*\//,"") :
                listings[i].name;
            runQuery(NOMINATIM_URL + '&q=' + encodeURIComponent(query + ", " + areaBox),
                function(i) {
                  return function(result) {
                    if (result && result.length) {
                        updateListing(i, result[0]);
                        insertLatLng();
                        mapListings();
                        if (result.length > 1) {
                            alternatives.push({index: i, result: result});
                            presentAlternatives();
                        }
                    } else {
                        updateListing(i);
                    }
                  }
                }(i));
        }
    }
    document.getElementById("stats").value = "Looking for "+queryList.length+" listings...";
    // runs mapquest batch geocoding query
};

function runQuery(url, callback) {
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.open('GET', url, true);
    xmlHttp.onreadystatechange = function () {
        if (xmlHttp.readyState == 4) {
            callback(JSON.parse(xmlHttp.responseText));
        }
    };
    xmlHttp.send(null);
};

function renderBatch(response, queryList) {
    // receives mapquest batch geocoding results
    if (response.results.length > 0) {
        centreLatLng = response.results[0].locations[0].latLng;
        clicker.setLatLng(centreLatLng);
        updateMarker(centreLatLng);
        for (var i = 1; i < response.results.length; i++) {
            // set maxResults as one, so only one location
            var location = response.results[i].locations[0];
            var bounds = 0.5; //(0.5 deg ~ 25-50km)
           
            // set geographical boundaries based on centreLatLng            
            if (location != undefined) {
                if (location.latLng.lat < (centreLatLng.lat-bounds) || location.latLng.lat > (centreLatLng.lat+bounds)) {
                    location = undefined;
                }
                else if (location.latLng.lng < (centreLatLng.lng-bounds) || location.latLng.lng > (centreLatLng.lng+bounds)) {
                    location = undefined;
                }
            }
            
            // assign dummy latlngs if not defined
            updateListing(queryList[i-1], location && {lat: location.latLng.lat, lon: location.latLng.lng});
        }
        insertLatLng();
    }
    else {
        document.getElementById("withlatlng").value = document.getElementById("nolatlng").value;
    }
    document.getElementById("stats").value = "Mapping...";
    mapListings();
};

function updateListing(index, location) {
    if (location) {
        listings[index].lat = parseFloat(location.lat).toFixed(FXPT)+' ';
        listings[index].long = parseFloat(location.lon).toFixed(FXPT)+' ';
    } else {
        listings[index].lat = parseFloat(centreLatLng.lat+0.001).toFixed(FXPT)+' ';
        listings[index].long = parseFloat(centreLatLng.lng+0.001).toFixed(FXPT)+' ';
        listings[index].type = "question";
    }
};

function isWhitespaceOrEmpty(text) {
   return !/[^\s]/.test(text);
}

function insertLatLng () {
    // finds and replaces latlng in the textbox
    var oldStr = document.getElementById("nolatlng").value;
    var i = 0;
    oldStr = oldStr.replace(/lat=[^|]+/g, function() {
        return 'lat=' + listings[i++].lat;
    });
    i = 0;
    oldStr = oldStr.replace(/long=[^|]+/g, function() {
        return 'long=' + listings[i++].long;
    });
    var textBox = document.getElementById("withlatlng");
    textBox.value = oldStr;

}

function mapFittedListings() {
    if (listings.length == 0) {
        parser(document.getElementById("nolatlng").value);
        singleSearch(document.getElementById("area").value);
    }
    else {
        parser(document.getElementById("withlatlng").value);
    }
    mapListings();
}

function mapListings () {
    pois.removeAll();
    if (alternatives.length) {
        presentAlternatives();
        return;
    }
    // map points of interest
    for (var i = 0; i < listings.length; i++) {
        if (!isWhitespaceOrEmpty(listings[i].lat)) {
            addPOI({"lng":listings[i]["long"], "lat":listings[i].lat},'<b>' + listings[i].name + 
                   '</b>,\n' + listings[i].address, i); 
        }
    }
    // centre map slightly off the last point
    //centreLatLng = {"lng":parseFloat(listings[0]["long"]-0.001).toFixed(FXPT), 
    //    "lat":parseFloat(listings[0].lat-0.001).toFixed(FXPT)};
    map.addShapeCollection(pois);
    document.getElementById("stats").value = pois.getSize() + " listings mapped";
    //map.setCenter(centreLatLng);
    //map.setZoomLevel(14);
    //clicker.setLatLng(centreLatLng);
    map.bestFit();
}

function removeQuestionMarks () {
    var lat = parseFloat(centreLatLng.lat+0.001).toFixed(FXPT) + " ";
    var lng = parseFloat(centreLatLng.lng+0.001).toFixed(FXPT) + " ";
    var patt= new RegExp("lat="+lat+"\\| long="+lng,"g");
    var str = document.getElementById("withlatlng").value;
    str = str.replace(patt, "lat= | long= "); 
    var textBox = document.getElementById("withlatlng");
    textBox.value = str;
    
    for (var i=0; i < listings.length; i++) {
        if (listings[i].lat == lat && listings[i]["long"] == lng) {
            listings[i].lat = " ";
            listings[i]["long"] = " ";
        }
    }
    mapListings();
}

function singleSearch (textBox) {
    var query = "&location="+textBox;
    query += "&boundingBox=" + parseFloat(centreLatLng.lat+0.1).toFixed(FXPT)+','+
        parseFloat(centreLatLng.lng-0.1).toFixed(FXPT) + ',' + 
        parseFloat(centreLatLng.lat-0.1).toFixed(FXPT)+','+
        parseFloat(centreLatLng.lng+0.1).toFixed(FXPT);
    // runs mapquest single geocoding query
    runQuery(SINGLE_POST + query, renderSingle);
}

function renderSingle(response) {
    if (response.results[0].locations.length > 0 ) {
        var location = response.results[0].locations[0];
        updateMarker (location.latLng);
        clicker.setLatLng(location.latLng);
        map.bestFit();
    }
    else {
        alert("No results found");
    }
}

function presentAlternatives() {
    if (!alternatives.length) return;
    var alt = alternatives[0];
    var altElement = document.getElementById('alternatives');
    if (altElement.innerHTML != '') return;
    var elements = [];
    for (var i=0; i<alt.result.length; i++) {
        var res = alt.result[i];
        elements.push('<li>' + res.display_name + '</li>');
        var poi = new MQA.Poi({lat: res.lat, lng: res.lon});
        poi.setRolloverContent((i + 1) + '. ' + res.display_name + ',<br>' + 'lat=' + res.lat +' | long=' + res.lon);
        poi.setDeclutterMode(true);
        pois.add(poi);
    }
    altElement.innerHTML = 'Found ' + alt.result.length + ' alternatives for "' + listings[alt.index].name + '".' +
        '<ol>' + elements.join('') + '</ol>';
    map.addShapeCollection(pois);
    map.bestFit();
    altElement.addEventListener('click', function listener(event) {
        var entry = event.target;
        var index = Array.prototype.indexOf.call(entry.parentElement.childNodes, entry);
        updateListing(alt.index, alt.result[index]);
        altElement.removeEventListener('click', listener);
        insertLatLng();
        altElement.innerHTML = '';
        alternatives.shift();
        mapListings();
    });
};

function updateMarker (latLng) {
    var e=document.getElementById("locate");
    e.value = 'lat=' + parseFloat(latLng.lat).toFixed(FXPT) +' | long=' 
            + parseFloat(latLng.lng).toFixed(FXPT);
    clicker.setRolloverContent(e.value);
}

/***** Mapping functions *****/

    MQA.EventUtil.observe(window, 'load', function() {
        /*Create an object for options*/ 
        var options={
            elt:document.getElementById('map'),       /*ID of element on the page where you want the map added*/ 
            zoom:15,                                  /*initial zoom level of the map*/ 
            latLng:centreLatLng,          /*center of map in latitude/longitude */ 
            mtype:'osm',                              /*map type (osm)*/ 
            bestFitMargin:0,                          /*margin offset from the map viewport when applying a bestfit on shapes*/ 
            zoomOnDoubleClick:true                    /*zoom in when double-clicking on map*/ 
        };
        
        /*Construct an instance of MQA.TileMap with the options object*/ 
        window.map = new MQA.TileMap(options);
        pois=new MQA.ShapeCollection();
        clicker = new MQA.Poi(centreLatLng);
        addHome(clicker); 
        updateMarker(centreLatLng);
        
        MQA.withModule('largezoom','mousewheel', function() {
            map.addControl(
                new MQA.LargeZoom(),
                new MQA.MapCornerPlacement(MQA.MapCorner.TOP_LEFT, new MQA.Size(4,4))
            );
            map.enableMouseWheelZoom();
        });
            
        MQA.EventManager.addListener(map, 'click', function(event){
            clicker.setLatLng(event.ll);
            updateMarker(event.ll);
        });
        
        MQA.EventManager.addListener(clicker,'dragend',function(event){
            updateMarker(this.latLng);
        });

    });
    function addHome(homePoi) {
        var icon=new MQA.Icon("http://open.mapquestapi.com/staticmap/geticon?uri=poi-red_1.png",20,29);   
        homePoi.setIcon(icon);
        homePoi.setKey("home");
        homePoi.draggable = "true";
        homePoi.setZIndex(1000);
        map.addShape(homePoi);
    }
    
    function addPOI(latlngArr, name, number) {
        var poi = new MQA.Poi(latlngArr);
        var arr = ["see","do","buy","eat","drink","sleep","listing","question"];
        if (arr.indexOf(listings[number].type) == -1) {
            listings[number].type = "see";
        }
        var icon = new MQA.Icon("./images/" + listings[number].type + ".png", 25, 25);
        poi.setRolloverContent(name + ',<br>' + 'lat=' + latlngArr.lat +' | long=' + latlngArr.lng);
        poi.setIcon(icon);
        poi.setDeclutterMode(true);
        pois.add(poi);
        
        poi.draggable = "true";
        MQA.EventManager.addListener(poi,'dragend',function(event){
            listings[number].lat = parseFloat(this.latLng.lat).toFixed(FXPT) + ' ';
            listings[number]["long"] = parseFloat(this.latLng.lng).toFixed(FXPT) + ' ';
            insertLatLng();
            var latlng = 'lat=' + listings[number].lat +
                '| long=' + listings[number]["long"];
            poi.setRolloverContent(name + ',<br>' + latlng);
        });
    }
