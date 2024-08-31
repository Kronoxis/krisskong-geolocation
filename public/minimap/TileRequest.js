import { Tile } from "./Tile.js";
import { Memory } from "./Memory.js";

export class TileRequest {
    constructor(x, y, mapIndex) {
        this.x = x;
        this.y = y;
        this.mapIndex = mapIndex;
        this._onData = this.onData.bind(this);
        this._websocket = null;
        this.tile = new Promise((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        });
    }

    async send(websocket) {
        if (Memory.has(Tile.getKey(this.x, this.y))) {
            // Get tile from memory
            this.construct(Memory.get(Tile.getKey(this.x, this.y)));
        } else {
            // Wait for socket to open
            let attempt = 0;
            while (websocket.readyState !== WebSocket.OPEN) {
                ++attempt;
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                if (attempt > 20) {
                    console.error("Tile request failed, websocket has been closed for 210 seconds");
                    return;
                }
            }
            // Get tile from server
            this._websocket = websocket;
            websocket.addEventListener("message", this._onData);
            websocket.send(JSON.stringify({ type: "request-map", x: this.x, y: this.y }));
        }
    }

    onData(event) {
        const { data: json } = event;
        const data = JSON.parse(json);
        if (data.type !== "map") return;
        if (data.x !== this.x || data.y !== this.y) return;
        this._websocket.removeEventListener("message", this._onData);
        this.process(data);
    }

    async process(data) {
        const { x, y, error, tile: elements } = data;

        let tile = null;
        if (error) {
            switch (error) {
                case 404:
                    // Create tile from Overpass API
                    tile = new Tile(x, y);
                    if (await tile.download()) {
                        // Save it on the server
                        tile.cache(this._websocket);
                    } else {
                        // Invalidate the tile if something went wrong
                        tile = null;
                        this.reject("Failed to download");
                    }
                    break;
                default:
                    console.error("Unexpected error from 'map' message:", error);
                    this.reject("Unexpected server error: " + error);
                    break;
            }
        } else if (elements) {
            // Create tile from server data
            tile = Tile.fromJSON(x, y, elements);
        } else {
            this.reject("Process called with neither `tile` nor `error`");
        }

        this.construct(tile);
    }

    construct(tile) {
        if (tile) {
            // Store the tile in memory
            Memory.store(tile.key, tile);

            this.tile = tile;
            this.resolve(tile);
        } else {
            this.reject(`Failed to construct Tile`);
        }
    }
}