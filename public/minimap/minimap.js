class Minimap {
    constructor() {
        this.element = document.querySelector("#minimap");
        this._latitude = 0;
        this._longitude = 0;
        this._targetLatitude = 0;
        this._targetLongitude = 0;
        this._update = this.update.bind(this);
        this._time = -1;

        this.error = false;

        this.update();
    }

    get location() { return { latitude: this._latitude, longitude: this._longitude }; }
    set location({ latitude, longitude }) { this._targetLatitude = latitude; this._targetLongitude = longitude; }

    async update(time) {
        if (this.error) {
        }
        else if (this._time > 0) {
            const deltaTime = (time - this._time) * 0.001;
        }
        this._time = time;

        await new Promise(resolve => setTimeout(resolve, 1000));

        requestAnimationFrame(this._update);
    }
}
const minimap = new Minimap();

let websocket = null;
function connect() {
    websocket = new WebSocket(window.SOCKET);
    websocket.addEventListener("open", function () {
        updateInfo();
    });
    websocket.addEventListener("error", function (event) {
        updateInfo();
        console.error("WebSocket error", event);
        connect();
    });
    websocket.addEventListener("close", function () {
        updateInfo();
        if (document.visibilityState !== "visible") return;
        connect();
    });
    websocket.addEventListener("message", function (event) {
        const { data } = event;
        const json = JSON.parse(data);
        if (json.type !== "location") return;
        const { latitude, longitude } = json;
        minimap.location = { latitude, longitude };
    });
}
connect();

function updateInfo() {
    minimap.error = !websocket || websocket.readyState !== WebSocket.OPEN;
}

const map = L.map("map").setView([46.056946, 14.505751], 20);

L.maplibreGL({
    style: {
        "version": 8,
        "name": "KrissKong",
        "metadata": {
            "mapbox:autocomposite": false,
            "openmaptiles:version": "3.x",
            "maputnik:renderer": "mlgljs"
        },
        "center": [46.056946, 14.505751],
        "zoom": 20,
        "bearing": 0,
        "pitch": 0,
        "sources": {
            "openmaptiles": {
                "type": "vector",
                "scheme": "xyz",
                "url": "https://tiles.stadiamaps.com/data/openmaptiles.json"
            }
        },
        "sprite": "https://tiles.stadiamaps.com/styles/alidade-smooth-dark/sprite",
        "glyphs": "https://tiles.stadiamaps.com/fonts/{fontstack}/{range}.pbf",
        "layers": [
            {
                "id": "background",
                "type": "background",
                "paint": { "background-color": "rgba(120, 139, 60, 1)" }
            },
            {
                "id": "park_fill",
                "type": "fill",
                "source": "openmaptiles",
                "source-layer": "park",
                "filter": ["==", "$type", "Polygon"],
                "layout": { "visibility": "visible" },
                "paint": { "fill-color": "rgba(55, 103, 45, 1)" }
            },
            {
                "id": "landuse_residential",
                "type": "fill",
                "source": "openmaptiles",
                "source-layer": "landuse",
                "maxzoom": 24,
                "filter": [
                    "all",
                    ["==", "$type", "Polygon"],
                    ["==", "class", "residential"]
                ],
                "layout": { "visibility": "visible" },
                "paint": { "fill-color": "rgba(152, 152, 154, 1)", "fill-opacity": 1 }
            },
            {
                "id": "landcover_wood",
                "type": "fill",
                "source": "openmaptiles",
                "source-layer": "landcover",
                "minzoom": 10,
                "filter": ["all", ["==", "$type", "Polygon"], ["==", "class", "wood"]],
                "layout": { "visibility": "visible" },
                "paint": { "fill-color": "rgba(55, 103, 45, 1)", "fill-opacity": 1 }
            },
            {
                "id": "landcover_park",
                "type": "fill",
                "source": "openmaptiles",
                "source-layer": "landcover",
                "minzoom": 10,
                "filter": ["all", ["==", "$type", "Polygon"], ["==", "subclass", "park"]],
                "layout": { "visibility": "visible" },
                "paint": { "fill-color": "rgba(55, 103, 45, 1)", "fill-opacity": 1 }
            },
            {
                "id": "boundary_state",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "boundary",
                "filter": ["==", "admin_level", 4],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": {
                    "line-color": "hsla(353, 34%, 80%, 30%)",
                    "line-width": { "base": 1.3, "stops": [[3, 1], [22, 15]] },
                    "line-blur": 0.4,
                    "line-dasharray": [2, 2],
                    "line-opacity": 1
                }
            },
            {
                "id": "boundary_country",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "boundary",
                "filter": ["==", "admin_level", 2],
                "layout": { "line-cap": "butt", "line-join": "round" },
                "paint": {
                    "line-color": "rgba(189, 0, 0, 0.45)",
                    "line-width": { "base": 1.1, "stops": [[3, 1], [22, 20]] },
                    "line-blur": 0,
                    "line-opacity": 1
                }
            },
            {
                "id": "water",
                "type": "fill",
                "source": "openmaptiles",
                "source-layer": "water",
                "filter": ["==", "$type", "Polygon"],
                "layout": { "visibility": "visible" },
                "paint": { "fill-color": "rgba(115, 138, 175, 1)", "fill-antialias": true }
            },
            {
                "id": "waterway",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "waterway",
                "filter": ["==", "$type", "LineString"],
                "layout": { "visibility": "visible" },
                "paint": { "line-color": "rgba(115, 138, 175, 1)" }
            },
            {
                "id": "building",
                "type": "fill",
                "source": "openmaptiles",
                "source-layer": "building",
                "minzoom": 0,
                "filter": ["==", "$type", "Polygon"],
                "paint": {
                    "fill-color": "rgba(255, 255, 255, 1)",
                    "fill-outline-color": "rgba(255, 255, 255, 1)",
                    "fill-antialias": true
                }
            },
            {
                "id": "tunnel_motorway_casing",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 6,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["all", ["==", "brunnel", "tunnel"], ["==", "class", "motorway"]]
                ],
                "layout": {
                    "line-cap": "butt",
                    "line-join": "miter",
                    "visibility": "visible"
                },
                "paint": {
                    "line-color": "rgba(1, 1, 1, 1)",
                    "line-width": 35,
                    "line-opacity": 1
                }
            },
            {
                "id": "tunnel_motorway_inner",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 6,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["all", ["==", "brunnel", "tunnel"], ["==", "class", "motorway"]]
                ],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": { "line-color": "rgba(1, 1, 1, 1)", "line-width": 30 }
            },
            {
                "id": "highway_path",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["in", "class", "path", "footway", "construction"]
                ],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": {
                    "line-color": "rgba(1, 1, 1, 1)",
                    "line-width": { "base": 1.2, "stops": [[13, 1], [20, 10]] },
                    "line-opacity": 1
                }
            },
            {
                "id": "highway_minor",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 8,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["in", "class", "minor", "service", "track"]
                ],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": {
                    "line-color": "rgba(1, 1, 1, 1)",
                    "line-width": { "base": 1.55, "stops": [[13, 1], [18, 8]] },
                    "line-opacity": 1
                }
            },
            {
                "id": "highway_major_casing",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 12,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["in", "class", "primary", "secondary", "tertiary", "trunk"]
                ],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": {
                    "line-color": "rgba(1, 1, 1, 1)",
                    "line-dasharray": [12, 0],
                    "line-width": 20
                }
            },
            {
                "id": "highway_major_inner",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 12,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["in", "class", "primary", "secondary", "tertiary", "trunk"]
                ],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": {
                    "line-color": "rgba(1, 1, 1, 1)",
                    "line-width": { "base": 1.3, "stops": [[10, 2], [20, 18]] },
                    "line-gap-width": 0
                }
            },
            {
                "id": "highway_major_subtle",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "maxzoom": 12,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["in", "class", "primary", "secondary", "tertiary", "trunk"]
                ],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": { "line-color": "rgba(1, 1, 1, 1)", "line-width": 1 }
            },
            {
                "id": "highway_motorway_casing",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 6,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    [
                        "all",
                        ["!in", "brunnel", "bridge", "tunnel"],
                        ["==", "class", "motorway"]
                    ]
                ],
                "layout": {
                    "line-cap": "butt",
                    "line-join": "miter",
                    "visibility": "visible"
                },
                "paint": {
                    "line-color": "rgba(1, 1, 1, 1)",
                    "line-width": 30,
                    "line-dasharray": [2, 0],
                    "line-opacity": 1
                }
            },
            {
                "id": "highway_motorway_inner",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 6,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    [
                        "all",
                        ["!in", "brunnel", "bridge", "tunnel"],
                        ["==", "class", "motorway"]
                    ]
                ],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": { "line-color": "rgba(1, 1, 1, 1)", "line-width": 25 }
            },
            {
                "id": "highway_motorway_subtle",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "maxzoom": 6,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["==", "class", "motorway"]
                ],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": { "line-color": "rgba(1, 1, 1, 1)", "line-width": 1.5 }
            },
            {
                "id": "railway_service",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 0,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["all", ["==", "class", "rail"], ["has", "service"]]
                ],
                "layout": { "visibility": "visible", "line-join": "round" },
                "paint": { "line-color": "rgba(74, 12, 0, 1)", "line-width": 7 }
            },
            {
                "id": "railway",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 13,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["all", ["!has", "service"], ["==", "class", "rail"]]
                ],
                "layout": { "visibility": "visible", "line-join": "round" },
                "paint": { "line-color": "rgba(74, 12, 0, 1)", "line-width": 7 }
            },
            {
                "id": "highway_motorway_bridge_casing",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 6,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["all", ["==", "brunnel", "bridge"], ["==", "class", "motorway"]]
                ],
                "layout": {
                    "line-cap": "butt",
                    "line-join": "miter",
                    "visibility": "visible"
                },
                "paint": {
                    "line-color": "rgba(1, 1, 1, 1)",
                    "line-width": { "base": 1.4, "stops": [[5.8, 0], [6, 5], [20, 35]] },
                    "line-dasharray": [2, 0],
                    "line-opacity": 1
                }
            },
            {
                "id": "highway_motorway_bridge_inner",
                "type": "line",
                "source": "openmaptiles",
                "source-layer": "transportation",
                "minzoom": 6,
                "filter": [
                    "all",
                    ["==", "$type", "LineString"],
                    ["all", ["==", "brunnel", "bridge"], ["==", "class", "motorway"]]
                ],
                "layout": {
                    "line-cap": "round",
                    "line-join": "round",
                    "visibility": "visible"
                },
                "paint": {
                    "line-color": "rgba(1, 1, 1, 1)",
                    "line-width": { "base": 1.4, "stops": [[4, 2], [6, 1.3], [20, 30]] }
                }
            }
        ],
        "id": "iy3r2mb"
    },
}).addTo(map);