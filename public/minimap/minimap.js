// ---------------
// CONFIG 
// ---------------
// Size of minimap display in pixels
const displaySize = 200;
// Zoom level for data fetching (reduces number of fetches, increases chunk data size)
const zoom = 15;
// Zoom level to display
const targetZoom = 16;
// Number of tiles to keep in memory
const memorySize = 100;
// Nodes to show
const filters = {
    highway: [
        "motorway",
        "motorway_link",
        "trunk",
        "trunk_link",
        "primary",
        "primary_link",
        "secondary",
        "secondary_link",
        "tertiary",
        "tertiary_link",
        "residential",
        "service",
        "living_street"
    ],
    railway: [
        "light_rail",
        "monorail",
        "narrow_gauge",
        "rail",
        "subway",
        "tram"
    ],
    waterway: [
        "stream",
        "tidal_channel",
        "ditch",
        "river",
        "canal"
    ],
    water: "*",
    building: "*",
    landuse: [
        "forest",
        "farmland",
        "residential",
        "industrial",
        "grass"
    ],
    boundary: {
        admin_level: [
            "2"
        ]
    }
};
const filter = composeFilter(filters);

class Memory {
    constructor(size) {
        this.size = size;
        this.data = {};
        this.keys = [];
    }

    has(key) {
        return !!this.data[key];
    }

    get(key) {
        return this.data[key];
    }

    store(key, value) {
        this.data[key] = value;
        this.keys.push(key);
        if (this.keys.length > this.size) {
            const del = this.keys.shift();
            delete this.data[del];
        }
    }
}
const memory = new Memory(memorySize);

class Minimap {
    constructor() {
        this.element = document.querySelector("#minimap");
        this.buffer = document.getElementById("buffer");
        this.display = document.getElementById("display");
        this.pin = document.querySelector("#pin");

        this._latitude = 46.056946;
        this._longitude = 14.505751;
        this._targetLatitude = this._latitude;
        this._targetLongitude = this._longitude;
        this._lastLatitude = this._latitude;
        this._lastLongitude = this._longitude;
        this._tileX = 0;
        this._tileY = 0;
        this._bounds = [0, 0, 1, 1];
        this._rotation = 0;
        this._update = this.update.bind(this);
        this._time = -1;

        this._map = "";

        this.error = false;

        this.enabled = true;

        this.update();

        this._resize = this.resize.bind(this);
        window.addEventListener("resize", this._resize);
        this._resize();

        this._fetch = null;
        this._needsUpdate = false;
    }

    get location() { return { latitude: this._latitude, longitude: this._longitude }; }
    set location({ latitude, longitude }) { this._targetLatitude = latitude; this._targetLongitude = longitude; }

    update(time) {
        if (!this.enabled) return;

        // Render the buffer when it is ready
        if (this._needsUpdate) {
            this.display.innerHTML = this.buffer.innerHTML;
            this._needsUpdate = false;
        }

        // Replace pin with question mark if not connected        
        this.pin.classList.toggle("error", this.error);

        // Smooth location and pin rotation
        if (this.error) {
            this._rotation = 0;
        } else if (this._time > 0) {
            const deltaTime = (time - this._time) * 0.001;
            const t = Math.min(deltaTime, Math.max(deltaTime, 0.001), 0.2);
            this._latitude = this._latitude * (1 - t) + this._targetLatitude * t;
            this._longitude = this._longitude * (1 - t) + this._targetLongitude * t;

            const dLat = this._latitude - this._lastLatitude;
            const dLon = this._longitude - this._lastLongitude;
            if (Math.abs(dLat) > 0.000001 * t || Math.abs(dLon) > 0.000001 * t) {
                const len = Math.sqrt(dLat * dLat + dLon * dLon);
                let rot = Math.atan2(dLon / len, dLat / len) * 180 / Math.PI;
                while (this._rotation - rot > 180) rot += 360;
                while (this._rotation - rot < -180) rot -= 360;
                this._rotation = rot;
            }
        }
        this._time = time;

        this.pin.style.transform = `rotate(${this._rotation}deg)`;

        this.display.style.transform = `scale(${Math.pow(2, targetZoom - zoom)}) translate(${mapRange(this._latitude, this._bounds[0], this._bounds[2], displaySize * 0.5, -displaySize * 0.5)}px, ${mapRange(this._longitude, this._bounds[1], this._bounds[3], displaySize * 0.5, -displaySize * 0.5)}px)`;
        // console.log(this._latitude, this._longitude, ...this._bounds);

        this._lastLatitude = this._latitude;
        this._lastLongitude = this._longitude;

        // Update tile
        if (this._fetch === null) {
            const x = Tile.longitudeToTile(this._longitude);
            const y = Tile.latitudeToTile(this._latitude);
            if (x !== this._tileX || y !== this._tileY) {
                this.requestTile(x, y);
            }
        }

        requestAnimationFrame(this._update);
    }

    resize() {
        const { clientWidth: pageSize } = document.querySelector(".main-container");
        const { clientWidth: elementSize } = this.element;
        const scale = pageSize / elementSize;
        this.element.style.transform = `scale(${scale})`;
    }

    requestTile(x, y) {
        if (memory.has(Tile.getKey(x, y))) {
            // Get tile from memory
            this.onTile({ x, y, elements: memory.get(Tile.getKey(x, y)) });
        } else {
            // Get tile from server
            if (websocket.readyState === WebSocket.OPEN) {
                websocket.send(JSON.stringify({ type: "request-map", x, y }));
                this._fetch = "waiting";
            }
        }
    }

    async onTile(data) {
        const { x, y, error, tile: elements } = data;

        let tile = null;

        if (error) {
            switch (error) {
                case 404:
                    // Create tile from Overpass API
                    tile = new Tile(x, y);
                    if (await tile.download()) {
                        // Save it on the server
                        tile.cache();
                    } else {
                        // Invalidate the tile if something went wrong
                        tile = null;
                    }
                    break;
                default:
                    console.error("Unexpected error from 'map' message:", error);
                    break;
            }
        } else if (elements) {
            // Create tile from server data
            tile = Tile.fromJSON(x, y, elements);
        }

        if (tile) {
            // Draw the tile into the buffer
            tile.draw(this.buffer);

            // Save the index and bounds of the tile
            this._tileX = tile.x;
            this._tileY = tile.y;
            this._bounds = tile.bounds;

            // Store the tile in memory
            memory.store(tile.key, tile);
        }

        // Mark fetch as complete
        this._fetch = null;

        // Update display after buffer has rendered
        this._needsUpdate = true;
    }

    enable(state) {
        if (!this.enabled && state) requestAnimationFrame(this._update);
        this.enabled = state;
    }
}
const minimap = new Minimap();

class Tile {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.elements = {};
    }

    static fromJSON(x, y, data) {
        const tile = new Tile(x, y);
        for (const order in data) {
            for (const { s, d } of data[order]) {
                const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
                el.setAttribute("d", d);
                for (const key in s) el.style[key] = s[key];
                tile.add(order, el);
            }
        }
        return tile;
    }

    static getKey(x, y) {
        return `${x}/${y}`;
    }

    static toLatitude(y) {
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, zoom);
        return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
    }

    static toLongitude(x) {
        return (x / Math.pow(2, zoom) * 360 - 180);
    }

    static latitudeToTile(latitude) {
        return Math.floor(Tile.latitudeOnTile(latitude));
    }

    static longitudeToTile(longitude) {
        return Math.floor(Tile.longitudeOnTile(longitude));
    }

    static latitudeOnTile(latitude) {
        return ((1 - Math.log(Math.tan(latitude * Math.PI / 180) + 1 / Math.cos(latitude * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
    }

    static longitudeOnTile(longitude) {
        return ((longitude + 180) / 360 * Math.pow(2, zoom));
    }

    get key() {
        return Tile.getKey(this.x, this.y);
    }

    get latitude() {
        return Tile.toLatitude(this.y);
    }

    get longitude() {
        return Tile.toLongitude(this.x);
    }

    /**
     * Get the bounds of this tile
     * @returns {[minLat: number, minLon: number, maxLat: number, maxLon: number]} Bounds in degrees
     */
    get bounds() {
        const C = 40075016.686;
        const LIMIT_Y = toDegrees(Math.atan(Math.sinh(Math.PI)));

        const metersPerPixelEW = C / Math.pow(2, zoom + 8);
        const shiftMetersEW = 256 / 2 * metersPerPixelEW;
        const shiftDegreesEW = shiftMetersEW * 360 / C;

        const southTile = (256 * Tile.latitudeOnTile(this.latitude, zoom) + 256 / 2) / 256;
        const northTile = (256 * Tile.latitudeOnTile(this.latitude, zoom) - 256 / 2) / 256;

        return [
            Math.max(Tile.toLatitude(southTile), -LIMIT_Y),
            this.longitude - shiftDegreesEW,
            Math.min(Tile.toLatitude(northTile), LIMIT_Y),
            this.longitude + shiftDegreesEW
        ];
    }

    add(order, element) {
        if (!this.elements[order]) this.elements[order] = [];
        this.elements[order].push(element);
    }

    draw(target) {
        // Clear buffer
        target.innerHTML = "";

        // Append tile paths in order
        for (const order in this.elements) {
            for (const element of this.elements[order]) {
                target.append(element);
            }
        }
    }

    toJSON() {
        const data = {};
        for (const order in this.elements) {
            data[order] = this.elements[order].map(el => ({ s: getStyleProps(el.style), d: el.getAttribute("d") }));
        }
        return data;
    }

    async download() {
        // Get tile bounds
        const bbox = this.bounds;

        // Get data
        let data = null;
        try {
            const response = await fetch(`https://overpass-api.de/api/interpreter`, {
                method: "POST",
                body: "data=" + encodeURIComponent(`
                    [out:json][timeout:10]
                    [bbox:${bbox.join(",")}];
                    (
                        ${filter}
                    );
                    (._;>;);
                    out qt;
                `)
            });
            data = await response.json();
        } catch (ex) {
            console.error("Failed to load OSM data from Overpass", ex);
        }

        if (!data) return false;
        const { elements } = data;

        // Map nodes
        const nodes = {};
        for (const element of elements) {
            if (element.type !== "node") continue;
            nodes[element.id] = element;
        }

        // Construct elements
        for (const element of elements) {
            let path = "";
            let closed = false;
            let order = 0;
            if (element.type !== "way") continue;

            const el = document.createElementNS("http://www.w3.org/2000/svg", "path");

            // Custom styles
            if (element.tags?.landuse) {
                order = 0;
                closed = true;
                let color = "none";
                switch (element.tags.landuse) {
                    case "forest": color = "#37672d"; break;
                    case "farmland": color = "#e7da8e"; break;
                    case "residential": color = "#98989a"; order = 1; break;
                    case "industrial": color = "#404040"; order = 1; break;
                    case "grass": color = "#788b3c"; order = 2; break;
                    default: continue;
                }
                el.style.fill = color;
            } else if (element.tags?.water) {
                order = 0;
                closed = true;
                el.style.fill = "#738aaf";
            } else if (element.tags?.waterway) {
                order = 0;
                let width = 0;
                switch (element.tags.waterway) {
                    case "stream": width = 1; break;
                    case "tidal_channel": width = 1; break;
                    case "ditch": width = 1; break;
                    case "river": width = 2; break;
                    case "canal": width = 2; break;
                    default: continue;
                }
                el.style.stroke = "#738aaf";
                el.style.strokeWidth = width.toString();
            } else if (element.tags?.building) {
                order = 100;
                closed = true;
                el.style.fill = "#ffffff";
            } else if (element.tags?.railway) {
                order = 200;
                let width = 0;
                let dotted = false;
                switch (element.tags.railway) {
                    case "light_rail": width = 1; break;
                    case "monorail": width = 1; break;
                    case "narrow_gauge": width = 1; break;
                    case "rail": width = 2; break;
                    case "subway": width = 2; dotted = true; break;
                    case "tram": width = 2; break;
                    default: continue;
                }
                el.style.stroke = "#4a0c00";
                el.style.strokeWidth = width.toString();
            } else if (element.tags?.highway) {
                order = 300;
                let width = 0;
                switch (element.tags.highway) {
                    case "living_street": width = 1; break;
                    case "service": width = 1; break;
                    case "residential": width = 2; break;
                    case "tertiary": width = 4; break;
                    case "tertiary_link": width = 4; break;
                    case "secondary": width = 6; break;
                    case "secondary_link": width = 6; break;
                    case "primary": width = 8; break;
                    case "primary_link": width = 8; break;
                    case "trunk": width = 10; break;
                    case "trunk_link": width = 10; break;
                    case "motorway": width = 12; break;
                    case "motorway_link": width = 12; break;
                    default: continue;
                }
                el.style.stroke = "#010101";
                el.style.strokeWidth = width.toString();
            } else if (element.tags?.boundary) {
                order = 400;
                switch (element.tags["admin-level"]) {
                    case 2: break;
                    default: continue;
                }
                el.style.stroke = "rgba(189, 0, 0, 0.45)";
                el.style.strokeWidth = 2;
            } else continue;

            // Generate path
            for (const nodeId of element.nodes) {
                const node = nodes[nodeId];
                const command = path.length === 0 ? "M" : "L";
                const lat = mapRange(node.lat, bbox[0], bbox[2], 0, displaySize);
                const lon = mapRange(node.lon, bbox[1], bbox[3], 0, displaySize);
                path += `${command}${lat} ${lon} `;
            }
            if (closed) path += "Z";
            el.setAttribute("d", path);

            this.add(order, el);
        }

        return true;
    }

    cache() {
        if (websocket.readyState === WebSocket.OPEN) {
            const tileData = this.toJSON();
            const cache = JSON.stringify({ type: "map", x: this.x, y: this.y, tile: tileData });
            websocket.send(cache);
        }
    }
}

let websocket = null;
const packetTime = {};
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
        const { data: json } = event;
        const data = JSON.parse(json);

        if (packetTime[data.type] && packetTime[data.type] > data.time) return;
        packetTime[data.type] = data.time;

        switch (data.type) {
            case "location": {
                const { latitude, longitude } = data;
                minimap.location = { latitude, longitude };
                break;
            }
            case "map": {
                minimap.onTile(data);
                break;
            }
            case "enable-minimap": {
                const { enable } = data;
                document.querySelector(".main-container").style.display = enable ? "" : "none";
                minimap.enable(enable);
                break;
            }
        }
    });
}
connect();

function updateInfo() {
    minimap.error = !websocket || websocket.readyState !== WebSocket.OPEN;
}

function mapRange(value, fromMin, fromMax, toMin, toMax) {
    return (value - fromMin) / (fromMax - fromMin) * (toMax - toMin) + toMin;
}

function toRadians(degrees) {
    return degrees / 180 * Math.PI;
}
function toDegrees(radians) {
    return radians / Math.PI * 180;
}

/**
 * Haversine Distance Formula between two points
 * @param {number} fromLat Latitude in degrees of first point
 * @param {number} fromLon Longitude in degrees of first point
 * @param {number} toLat Latitude in degrees of second point
 * @param {number} toLon Longitude in degrees of second point
 * @returns Haversine distance in kilometers
 */
function haversine(fromLat, fromLon, toLat, toLon) {
    const R = 6371;
    const lat1 = toRadians(fromLat);
    const lat2 = toRadians(toLat);
    const lon1 = toRadians(fromLon);
    const lon2 = toRadians(toLon);
    const sdLat = Math.sin((lat2 - lat1) / 2);
    const sdLon = Math.sin((lon2 - lon1) / 2);
    const cLat1 = Math.cos(lat1);
    const cLat2 = Math.cos(lat2);
    const a = sdLat * sdLat + cLat1 * cLat2 * sdLon * sdLon;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Moves a point by given distances (x, y) in kilometers
 * @param {number} lat Latitude in degrees of point
 * @param {number} lon Longitude in degrees of point
 * @param {number} x Distance in kilometers
 * @returns {[lat: number, lon: number]} Point in degrees
 */
function movePoint(lat, lon, x, y) {
    const R = 6371;
    const lat1 = toRadians(lat);
    const lon1 = toRadians(lon);
    const lat2 = lat1 + y / R;
    const lon2 = lon1 + x / R / Math.cos(lat1);
    return [toDegrees(lat2), toDegrees(lon2)];
}

/**
 * Get the bounds of given size around a point
 * @param {number} lat Latitude in degrees of central point
 * @param {number} lon Longitude in degrees of central point
 * @param {number} size Size of bounds in kilometers
 * @returns {[minLat: number, minLon: number, maxLat: number, maxLon: number]} Bounds in degrees
 */
function getBounds(lat, lon, size) {
    const d = size * 0.5;
    const min = movePoint(lat, lon, -d, -d);
    const max = movePoint(lat, lon, d, d);
    return [...min, ...max];
}

/**
 * 
 * @param {Record<string, "*" | string[] | Record<string, "*" | string[]>} filters Node filter queries
 * @returns {string} Overpass API structured filter
 */
function composeFilter(filters) {
    let selection = "";
    for (const key in filters) {
        const filter = filters[key];
        if (filter === "*") {
            selection += `way["${key}"];`;
        } else if (Array.isArray(filter)) {
            for (const value of filter) selection += `way["${key}"="${value}"];`;
        } else {
            for (const tag in filter) {
                const values = filter[tag];
                if (values === "*") {
                    selection += `way["${key}"]["${tag}"];`;
                } else {
                    for (const value of values) selection += `way["${key}"]["${tag}"="${value}"];`;
                }
            }
        }
    }
    return selection;
}

/**
 * 
 * @param {CSSStyleDeclaration} style Element style
 * @returns {Partial<CSSStyleDeclaration>} Modified properties of the element style
 */
function getStyleProps(style) {
    const props = {};
    for (const key of style) {
        const value = style[key];
        props[key] = value;
    }
    return props;
}