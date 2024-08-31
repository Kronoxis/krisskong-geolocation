import { TileRequest } from "./TileRequest.js";

export class TileGrid {
    constructor() {
        this.grid = new Array(9);
        this.x = 0;
        this.y = 0;

        this._cancel = () => { };

        this._loadHooks = [];
        this._completeHooks = [];
    }

    getTile(index) {
        return this.grid[index].tile;
    }

    async setTile(websocket, x, y, heading) {
        // Cancel previous in case it's still fetching
        this._cancel();

        // Update cancel method to current
        let abort = false;
        this._cancel = () => abort = true;

        // Update coordinates
        this.x = x;
        this.y = y;

        // Create requests for each tile in grid around given x, y center
        this.grid[0] = new TileRequest(x - 1, y - 1, 0);
        this.grid[1] = new TileRequest(x + 0, y - 1, 1);
        this.grid[2] = new TileRequest(x + 1, y - 1, 2);
        this.grid[3] = new TileRequest(x - 1, y + 0, 3);
        this.grid[4] = new TileRequest(x + 0, y + 0, 4);
        this.grid[5] = new TileRequest(x + 1, y + 0, 5);
        this.grid[6] = new TileRequest(x - 1, y + 1, 6);
        this.grid[7] = new TileRequest(x + 0, y + 1, 7);
        this.grid[8] = new TileRequest(x + 1, y + 1, 8);

        // Use the heading to optimise request order
        let order = "";
        heading = ((heading % 360) + 360) % 360;
        if (heading < 22.5 || heading >= 337.5) {
            // Northbound
            order = "410235768";
        } else if (heading < 67.5) {
            // Northeastbound
            order = "421508637";
        } else if (heading < 112.5) {
            // Eastbound
            order = "452817306";
        } else if (heading < 157.5) {
            // Southeastbound
            order = "485726013";
        } else if (heading < 202.5) {
            // Southbound
            order = "478653120";
        } else if (heading < 247.5) {
            // Southwestbound
            order = "467380251";
        } else if (heading < 292.5) {
            // Westbound
            order = "436071582";
        } else {
            // Northwestbound
            order = "403162875";
        }

        // Request each tile in sequence
        for (const index of order) {
            if (abort) return;
            const i = parseInt(index);
            this.grid[i].send(websocket);
            const tile = await this.grid[i].tile;
            this._onLoad(i, tile, x, y);
        }

        this._onComplete();
    }

    onLoad(hook) {
        this._loadHooks.push(hook);
    }

    _onLoad(index, tile, x, y) {
        for (const hook of this._loadHooks) {
            hook(index, tile, x, y);
        }
    }

    onComplete(hook) {
        this._completeHooks.push(hook);
    }

    _onComplete() {
        for (const hook of this._completeHooks) {
            hook();
        }
    }
}