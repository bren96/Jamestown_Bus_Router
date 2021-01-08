var PathFinder = require('geojson-path-finder'),
    L = require('leaflet');

// create map and set center and zoom level
var map = new L.map('mapid');
map.setView([42.198562, -79.386377], 9);

// create and add the tile layer
var tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Data copyright OpenStreetMap contributors | @Turf.js | @perliedman/geojson-path-finder'
});
tiles.addTo(map);


// add info control to top-right corner of map
var info = L.control({
    position:'topright'
});
info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info');
    this.update();
    return this._div;
};
// add content to control div
info.update = function (props){
    this._div.innerHTML = (
        "<h2 id='title'>Chautauqua Area Regional Transit System</h2></a>" +
        "<h4 id='subtitle'>Click on map to select nearest bus station. Second click on map will calculate route closest to that location.</h4>" +
        "<a href='https://chqgov.com/carts/CARTS'>Read more about CARTS</a>" +
        "<p id='startId'>Start: First Click</p>" +
        "<p id='finishId'>Finish: Second Click</p>" +
        "<button id='refreshId'>Refresh</button>" +
        "<div><table id='directionsId'></table></div>"
    );
};
info.addTo(map);

// add all routes to map
var routesPolyline = L.geoJSON(routesJSON, {
    style: {
        "color": "#454b54",
        "weight": 2,
        "opacity": 0.5
    },
});
routesPolyline.addTo(map);
// fit map bounds to all routes
map.fitBounds(routesPolyline.getBounds());

// add custom bus stop icon
var stopIcon = L.icon({
    iconUrl: 'data/Bus Icon Unselected.png',
    iconSize: [20, 20]
});

// add custom selected bus stop icon
var selectedStopIcon = L.icon({
    iconUrl: 'data/Bus Icon Selected.png',
    iconSize: [30, 30]
});

// add all bus stops to map
var stopsPoints = L.geoJSON(stopsJSON, {
    pointToLayer: function(geoJsonPoint, latlng) {
        return L.marker(latlng, {
            icon: stopIcon,
            // disable interactivity
            interactive: false
        });
    }
});
stopsPoints.addTo(map)

// create list to store layer name variables -> will be cleared when Refresh Button is clicked
var tempLayers = [];

// Generate Shortest Paths
// GLOBAL VARIABLES
var currentRoute;
var route1;
var route2;
var routeColors = {
    'RED':'#e31a1c',
    'BLUE':'#1f78b4',
    'GREEN':'#33a02c',
    'ORANGE':'#ff7f00',
    'PINK':'#fb99b1',
    'LILAC':'#6a3d9a',
    'TEAL':'#008080',
}
var directionsUI = document.getElementById('directionsId')

// logic check for routing -> determines how many paths are calculated -> passes route information to UI
function routeCheck(start, finish) {
    var startGroup = start.properties.GROUP.split(','); //list of routes start station serves 
    var finishGroup = finish.properties.GROUP.split(','); // list of routes finish station serves
    // if start and finish are on the same route
    for (line in startGroup) {
        if (finish.properties[startGroup[line]] == 'YES') {
            // set currentRoute global variable
            currentRoute = startGroup[line]
            // pass route information to UI
            directionsUI.innerHTML = (
                "<tr><th>Order</th><th>Name</th><th>Route</th></tr>" +
                "<tr><td>1</td><td>"+start.properties.OBJECTID+"</td><td><i style='background-color:"+routeColors[currentRoute]+"'>"+currentRoute+"</i></td></tr>" +
                "<tr><td>2</td><td>"+finish.properties.OBJECTID+"</td><td><i style='background-color:"+routeColors[currentRoute]+"'>"+currentRoute+"</i></td></tr>"
            );
            // pass start and finish to calcPath
            var routeWhole;
            return calcPath(start, finish, 6, routeWhole);
        };
    };
    // if start and finish are on different routes -> calculate stops that share the same routes as the start and finish
    var startShareGroup = []; // list of stops that share the same route as the starting station
    var finishShareGroup = []; // list of stops that share the same routes as the finishing station
    // go through each feature and read the Group property
    for (feature in stopsJSON.features) {
        var stopGroup = stopsJSON.features[feature].properties.GROUP.split(',') //list of routes the station serves
        // check if a route in startGroup is in the stopGroup
        for (startLine in startGroup) {
            if (stopGroup.indexOf(startGroup[startLine]) > -1) {
                startShareGroup.push(feature)
            };
        };
        // check if a route in finishGroup is in the stopGroup
        for (finishLine in finishGroup) {
            if (stopGroup.indexOf(finishGroup[finishLine]) > -1) {
                finishShareGroup.push(feature)
            };
        };
    };

    // check if startShareGroup and finishShareGroup overlap
    var shareGroupOverlap = []; //list of stops that share the SAME routes as the starting and finishing stations
    for (startShareLine in startShareGroup) {
        if (finishShareGroup.indexOf(startShareGroup[startShareLine]) > -1) {
            shareGroupOverlap.push(stopsJSON.features[startShareGroup[startShareLine]])
        };
    };

    // with stations that share the same routes -> calculate nearest to starting station
    var nearestOverlap;
    var nearestOverlapStop;
    nearestOverlap = turf.nearestPoint(start, turf.featureCollection(shareGroupOverlap));
    
    // add nearest station that shares all routes to map
    nearestOverlapStop = L.geoJSON(nearestOverlap, {
        pointToLayer: function(geoJsonPoint, latlng) {
            return L.marker(latlng, {
                icon: selectedStopIcon
            });
        }
    }).bindPopup(
        function (layer) {
            return ("Connection: " + layer.feature.properties.OBJECTID);
        }
    ).addTo(map);
    tempLayers.push(nearestOverlapStop);
 
    // determine name of starting route -> pass route information to UI
    var nearestOverlapGroup = nearestOverlap.properties.GROUP.split(',')
    var matchCount = 0;
    for (startRoute in startGroup){
        if (matchCount == 0){
            if (nearestOverlapGroup.indexOf(startGroup[startRoute]) > -1){
                matchCount = 1;
                // set currentRoute variable
                currentRoute = startGroup[startRoute];
                route1 = currentRoute
                // pass route information to UI
                directionsUI.innerHTML = (
                    "<tr><th>Order</th><th>Name</th><th>Route</th></tr>" +
                    "<tr><td>1</td><td>"+start.properties.OBJECTID+"</td><td><i style='background-color:"+routeColors[route1]+"'>"+route1+"</i></td></tr>"
                );
                // pass start and finish features, strokeWidth, and empty layer variable to calcPath
                var routePt1
                calcPath(start, nearestOverlap, 6, routePt1);
            };
        };
        break
    };

    // determine name of finishing route -> pass route information to UI
    matchCount = 0;
    for (finishRoute in finishGroup){
        if (matchCount == 0){
            if (nearestOverlapGroup.indexOf(finishGroup[finishRoute]) > -1){
                matchCount = 1;
                // set currentRoute variable
                currentRoute = finishGroup[finishRoute];
                route2 = currentRoute;
                // pass route information to UI
                directionsUI.innerHTML += (
                    "<tr><td>2</td><td>"+nearestOverlap.properties.OBJECTID+"</td><td>"+"<i style='background-color:"+routeColors[route1]+"'>"+route1+"</i> to <i style='background-color:"+routeColors[route2]+"'>"+route2+"</i></td></tr>" +
                    "<tr><td>3</td><td>"+finish.properties.OBJECTID+"</td><td><i style='background-color:"+routeColors[currentRoute]+"'>"+currentRoute+"</i></td></tr>"
                );
                // pass start and finish features, strokeWidth, and empty layer variable to calcPath
                var routePt2;
                calcPath(nearestOverlap, finish, 3, routePt2);        
            };
        };
        break
    };
};

// calculate weight(cost) of possible paths -> obey direction of bus route
function weightFn(a, b, props) {
    var distance = turf.distance(turf.point(a), turf.point(b)) * 1000;
    var forward = distance;
    var backward = distance;
    if (props[currentRoute] == 'False') {
        forward = distance * 1000;
        backward = distance;
    } else if (props[currentRoute] == 'True') {
        forward = distance;
        backward = distance * 1000;
    } else if (props[currentRoute] == 'BOTH') {
        forward = distance;
        backward = distance;
    } else {
        forward = distance * 1000;
        backward = distance * 1000;
    }
    return {
        forward: forward,
        backward: backward,
    }
};

// calculate shortest path -> add to map
function calcPath(start, finish, strokeWidth, pathVar) {
    var pathFinder = new PathFinder(routesJSON, {
        weightFn: weightFn
    });
    var path = pathFinder.findPath(start, finish);
    // add path to map
    var pathPolylineCoords = [];
    for (var coord in path.path) {
        pathPolylineCoords.push(
            [path.path[coord][1], path.path[coord][0]]
        );
    };
    pathVar = L.polyline(pathPolylineCoords, {
        color: routeColors[currentRoute],
        weight: strokeWidth
    }).addTo(map);
    tempLayers.push(pathVar);
};

// START - FINISH UI
// global variables
var start = [];
var finish = [];
var startStop;
var finishStop;
var nearestStartStop;
var nearestFinishStop;
var startUi = document.getElementById('startId');
var finishUi = document.getElementById('finishId');
var refreshButton = document.getElementById('refreshId')

// on refresh button click
function refreshUi(e) {
    // resest UI Text
    startUi.innerText = 'Start: First Click';
    finishUi.innerText = 'Finish: Second Click';
    directionsUI.innerHTML = "";
    // for each layer in tempLayers -> remove from map
    for (layer in tempLayers){
        tempLayers[layer].removeFrom(map)
    };
    // reset start and finish lists
    start = [];
    finish = [];
    // stop click from propagating to map
    L.DomEvent.stopPropagation(e);
};
refreshButton.addEventListener('click', refreshUi);

// on map click
function onMapClick(e) {
    // check if start position already calculated
    if (start.length == 0) {
        start.push(e.latlng);
        // find nearest point from map click lat/lng
        startStop = turf.nearestPoint(
            [start[0].lng, start[0].lat],
            stopsJSON
        );
        // add nearest point to map
        nearestStartStop = L.geoJSON(startStop, {
            pointToLayer: function(geoJsonPoint, latlng) {
                return L.marker(latlng, {
                    icon: selectedStopIcon
                });
            }
        }).bindPopup(
            function (layer) {
                return ("Start: " + layer.feature.properties.OBJECTID);
            }
        ).addTo(map);
        tempLayers.push(nearestStartStop)
        // update Start UI
        startUi.innerText = 'Start: ' + startStop.properties.OBJECTID;
    } else if (finish.length == 0) {
        // check if finish position already calculated
        finish.push(e.latlng);
        // find nearest point from map click lat/lng
        finishStop = turf.nearestPoint(
            [finish[0].lng, finish[0].lat],
            stopsJSON
        );
        // add nearest point to map
        nearestFinishStop = L.geoJSON(finishStop, {
            pointToLayer: function(geoJsonPoint, latlng) {
                return L.marker(latlng, {
                    icon: selectedStopIcon
                });
            }
        }).bindPopup(
            function (layer) {
                return ("Finish: " + layer.feature.properties.OBJECTID);
            }
        ).addTo(map);
        tempLayers.push(nearestFinishStop);
        // check route before passing to calcPath
        routeCheck(startStop, finishStop)
        // update Finish UI
        finishUi.innerText = 'Finish: ' + finishStop.properties.OBJECTID;
    };
};
map.on('click', onMapClick);