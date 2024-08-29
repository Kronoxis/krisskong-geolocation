import { composeFilter } from "./FilterUtil.js";
import { Tile } from "./Tile.js";
import { TileGrid } from "./TileGrid.js";
import { Memory } from "./Memory.js";

// ---------------
// CONFIG 
// ---------------
// Size of minimap display in pixels
Tile.size = 200;
// Zoom level for data fetching (reduces number of fetches, increases chunk data size)
Tile.zoom = 15;
// Zoom level to display
const targetZoom = 16;
// Number of tiles to keep in memory
Memory.size = 100;
// Nodes to show
Tile.filter = composeFilter({
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
});

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
        this._bounds = [0, 0, 1, 1];
        this._rotation = 0;
        this._update = this.update.bind(this);
        this._time = -1;

        this._map = "";

        this.error = false;

        this.enabled = true;

        this._resize = this.resize.bind(this);
        window.addEventListener("resize", this._resize);
        this._resize();

        this._needsUpdate = false;

        this.grid = new TileGrid();
        this.grid.onLoad((index, tile, x, y) => {
            // Make sure the tile is from the current grid
            if (x !== this.grid.x || y !== this.grid.y) return;

            // Draw the tile
            tile.draw(this.buffer, index);
        });
        this.grid.onComplete(() => {
            // Use the bounds of the center tile
            this._bounds = this.grid.getTile(4).bounds;
            this._needsUpdate = true;
        });

        requestAnimationFrame(this._update);
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

        this.display.style.transform = `scale(${Math.pow(2, targetZoom - Tile.zoom)}) translate(${mapRange(this._latitude, this._bounds[0], this._bounds[2], Tile.size * 0.5, -Tile.size * 0.5)}px, ${mapRange(this._longitude, this._bounds[1], this._bounds[3], Tile.size * 0.5, -Tile.size * 0.5)}px)`;

        this._lastLatitude = this._latitude;
        this._lastLongitude = this._longitude;

        // Update tile
            const x = Math.round(Tile.longitudeOnTile(this._longitude));
            const y = Math.round(Tile.latitudeOnTile(this._latitude));
            if (x !== this.grid.x || y !== this.grid.y) {
                this.buffer.innerHTML = "";
                this.grid.setTile(websocket, x, y, this._rotation);
            }

        requestAnimationFrame(this._update);
    }

    resize() {
        const { clientWidth: pageSize } = document.querySelector(".main-container");
        const { clientWidth: elementSize } = this.element;
        const scale = pageSize / elementSize;
        this.element.style.transform = `scale(${scale})`;
    }

    enable(state) {
        if (!this.enabled && state) requestAnimationFrame(this._update);
        this.enabled = state;
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
            case "location": {
                const { latitude, longitude } = data;
                minimap.location = { latitude, longitude };
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