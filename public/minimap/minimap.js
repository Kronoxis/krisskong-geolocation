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
        this._rotation = 0;
        this._update = this.update.bind(this);
        this._time = -1;

        this._map = "";

        this.error = false;

        this.update();

        this._resize = this.resize.bind(this);
        window.addEventListener("resize", this._resize);
        this._resize();

        this._fetch = null;
    }

    get location() { return { latitude: this._latitude, longitude: this._longitude }; }
    set location({ latitude, longitude }) { this._targetLatitude = latitude; this._targetLongitude = longitude; }

    get image() { return this._map; }
    set image(data) { this._map = data; }

    update(time) {
        this.pin.classList.toggle("error", this.error);
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
                this._rotation = Math.atan2(dLon / len, dLat / len) * 180 / Math.PI;
            }
        }
        this._time = time;

        this.pin.style.transform = `rotate(${this._rotation}deg)`;

        this._lastLatitude = this._latitude;
        this._lastLongitude = this._longitude;

        if (this._fetch === null) this._fetch = this.openstreetmap();

        requestAnimationFrame(this._update);
    }

    resize() {
        const { clientWidth: pageSize } = document.querySelector(".main-container");
        const { clientWidth: elementSize } = this.element;
        const scale = pageSize / elementSize;
        this.element.style.transform = `scale(${scale})`;
    }

    async openstreetmap() {
        // Copy buffer to display
        this.display.innerHTML = this.buffer.innerHTML;

        // Clear buffer
        this.buffer.innerHTML = "";

        // Get map around location
        const bbox = getBounds(this._latitude, this._longitude, 2.500);
        let data = null;
        try {
            // Get data
            const response = await fetch(`https://overpass-api.de/api/interpreter`, {
                method: "POST",
                body: `data=${encodeURIComponent(`
                    [out:json][timeout:10];
                    node(${bbox.join(",")});
                    way(bn);
                    (._;>;);
                    out qt;
                `)}`
            });
            data = await response.json();
        } catch (ex) {
            console.error("Failed to load OSM data from Overpass", ex);
        }

        if (data) {
            // Map nodes by ID
            const nodes = {};
            for (const element of data.elements) {
                if (element.type !== "node") continue;
                nodes[element.id] = element;
            }

            // Create ways
            const ways = {};
            for (const element of data.elements) {
                const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
                let path = "";
                let closed = false;
                let order = 0;
                if (element.type !== "way") continue;

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
                    el.style.stroke = "none";
                } else if (element.tags?.water) {
                    order = 0;
                    closed = true;
                    el.style.fill = "#738aaf";
                    el.style.stroke = "none";
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
                    el.style.strokeLinecap = "round";
                    el.style.strokeLinejoin = "round";
                    el.style.fill = "none";
                } else if (element.tags?.building) {
                    order = 100;
                    closed = true;
                    el.style.fill = "#ffffff";
                    el.style.stroke = "none";
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
                    el.style.strokeLinecap = "round";
                    el.style.strokeLinejoin = "round";
                    el.style.fill = "none";
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
                    el.style.strokeLinecap = "round";
                    el.style.strokeLinejoin = "round";
                    el.style.fill = "none";
                } else if (element.tags?.boundary) {
                    order = 400;
                    switch (element.tags["admin-level"]) {
                        case 2: break;
                        default: continue;
                    }
                    el.style.stroke = "rgba(189, 0, 0, 0.45)";
                    el.strokeWidth = 2;
                    el.style.strokeLinecap = "round";
                    el.style.strokeLinejoin = "round";
                    el.style.fill = "none";
                } else continue;

                // Generate path
                for (const nodeId of element.nodes) {
                    const node = nodes[nodeId];
                    const command = path.length === 0 ? "M" : "L";
                    const lat = mapRange(node.lat, bbox[0], bbox[2], 0, 200);
                    const lon = mapRange(node.lon, bbox[1], bbox[3], 0, 200);
                    path += `${command}${lat} ${lon} `;
                }
                if (closed) path += "Z";
                el.setAttribute("d", path);
                if (!ways[order]) ways[order] = [];
                ways[order].push(el);
            }

            // Draw ways
            for (const order in ways) {
                for (const way of ways[order]) {
                    this.buffer.append(way);
                }
            }
        }

        // await new Promise(resolve => setTimeout(resolve, 1000));
        this._fetch = null;
    }
}
const minimap = new Minimap();

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
            case "location":
                const { latitude, longitude } = data;
                minimap.location = { latitude, longitude };
                break;
            case "map":
                const { image } = data;
                minimap.image = image;
                break;
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