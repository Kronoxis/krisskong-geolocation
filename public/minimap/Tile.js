export class Tile {
    static _filter = "";
    static _zoom = 15;
    static _size = 200;

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.elements = {};
    }

    static set filter(filter) {
        Tile._filter = filter;
    }

    static get zoom() {
        return Tile._zoom;
    }

    static set zoom(zoom) {
        Tile._zoom = zoom;
    }

    static get size() {
        return Tile._size;
    }

    static set size(size) {
        Tile._size = size;
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
        const n = Math.PI - 2 * Math.PI * y / Math.pow(2, Tile._zoom);
        return (180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))));
    }

    static toLongitude(x) {
        return (x / Math.pow(2, Tile._zoom) * 360 - 180);
    }

    static latitudeToTile(latitude) {
        return Math.floor(Tile.latitudeOnTile(latitude));
    }

    static longitudeToTile(longitude) {
        return Math.floor(Tile.longitudeOnTile(longitude));
    }

    static latitudeOnTile(latitude) {
        return ((1 - Math.log(Math.tan(latitude * Math.PI / 180) + 1 / Math.cos(latitude * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, Tile._zoom));
    }

    static longitudeOnTile(longitude) {
        return ((longitude + 180) / 360 * Math.pow(2, Tile._zoom));
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

        const metersPerPixelEW = C / Math.pow(2, Tile._zoom + 8);
        const shiftMetersEW = 256 / 2 * metersPerPixelEW;
        const shiftDegreesEW = shiftMetersEW * 360 / C;

        const southTile = (256 * Tile.latitudeOnTile(this.latitude, Tile._zoom) + 256 / 2) / 256;
        const northTile = (256 * Tile.latitudeOnTile(this.latitude, Tile._zoom) - 256 / 2) / 256;

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

    find(order, type) {
        if (!this.elements[order]) return null;
        for (const el of this.elements[order]) {
            if (el.getAttribute("data-type") !== type) continue;
            return el;
        }
        return null;
    }

    draw(target, index) {
        // Offset tile based on index
        const x = ((index % 3) - 1);
        const y = -(Math.floor(index / 3) - 1);
        const transform = `translate(${Tile._size * y}px, ${Tile._size * x}px)`;

        // Append tile paths in order
        for (const order in this.elements) {
            for (const element of this.elements[order]) {
                element.style.transform = transform;
                element.setAttribute("data-order", order.toString());
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
                        ${Tile._filter}
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

            let type = "";
            let style = {};

            // Custom styles
            if (element.tags?.landuse) {
                order = 0;
                closed = true;
                let color = "none";
                switch (element.tags.landuse) {
                    case "forest": type = "forest"; color = "#37672d"; break;
                    case "farmland": type = "farmland"; color = "#e7da8e"; break;
                    case "residential": type = "residential"; color = "#98989a"; order = 1; break;
                    case "industrial": type = "industrial"; color = "#404040"; order = 1; break;
                    case "grass": type = "grass"; color = "#788b3c"; order = 2; break;
                    default: continue;
                }
                style.fill = color;
            } else if (element.tags?.water) {
                order = 0;
                closed = true;
                type = "water";
                style.fill = "#738aaf";
            } else if (element.tags?.waterway) {
                order = 0;
                let width = 0;
                switch (element.tags.waterway) {
                    case "stream": case "tidal_channel": case "ditch": type = "stream"; width = 1; break;
                    case "river": case "canal": type = "river"; width = 2; break;
                    default: continue;
                }
                style.stroke = "#738aaf";
                style.strokeWidth = width.toString();
            } else if (element.tags?.building) {
                order = 100;
                closed = true;
                type = "building";
                style.fill = "#ffffff";
            } else if (element.tags?.railway) {
                order = 200;
                let width = 0;
                let dotted = false;
                switch (element.tags.railway) {
                    case "light_rail": case "monorail": case "narrow_gauge": type = "monorail"; width = 1; break;
                    case "rail": case "tram": type = "rail"; width = 2; break;
                    case "subway": type = "subway"; width = 2; dotted = true; break;
                    default: continue;
                }
                style.stroke = "#4a0c00";
                style.strokeWidth = width.toString();
            } else if (element.tags?.highway) {
                order = 300;
                let width = 0;
                switch (element.tags.highway) {
                    case "living_street": case "service": type = "living_street"; width = 1; break;
                    case "residential": type = "residential_street"; width = 2; break;
                    case "tertiary": case "tertiary_link": type = "tertiary_street"; width = 4; break;
                    case "secondary": case "secondary_link": type = "secondary_street"; width = 6; break;
                    case "primary": case "primary_link": type = "primary_street"; width = 8; break;
                    case "trunk": case "trunk_link": type = "trunk"; width = 10; break;
                    case "motorway": case "motorway_link": type = "motorway"; width = 12; break;
                    default: continue;
                }
                style.stroke = "#010101";
                style.strokeWidth = width.toString();
            } else if (element.tags?.boundary) {
                order = 400;
                switch (element.tags["admin-level"]) {
                    case 2: break;
                    default: continue;
                }
                type = "boundary";
                style.stroke = "rgba(189, 0, 0, 0.45)";
                style.strokeWidth = 2;
            } else continue;

            // Generate path
            for (const nodeId of element.nodes) {
                const node = nodes[nodeId];
                const command = path.length === 0 ? "M" : "L";
                const lat = mapRange(node.lat, bbox[0], bbox[2], 0, Tile.size);
                const lon = mapRange(node.lon, bbox[1], bbox[3], 0, Tile.size);
                path += `${command}${lat} ${lon} `;
            }
            if (closed) path += "Z";

            // Append the path to the matching type element
            const existingEl = this.find(order, type);
            if (existingEl) {
                path = (existingEl.getAttribute("d") ?? "") + path;
                existingEl.setAttribute("d", path);
            } else {
                // Create a new element for the type with configured style
                const el = document.createElementNS("http://www.w3.org/2000/svg", "path");
                el.setAttribute("data-type", type);
                el.setAttribute("d", path);
                for (const key in style) el.style[key] = style[key];
                this.add(order, el);
            }
        }

        return true;
    }

    cache(websocket) {
        if (websocket.readyState === WebSocket.OPEN) {
            const tileData = this.toJSON();
            const cache = JSON.stringify({ type: "map", x: this.x, y: this.y, tile: tileData });
            websocket.send(cache);
        }
    }
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

function mapRange(value, fromMin, fromMax, toMin, toMax) {
    return (value - fromMin) / (fromMax - fromMin) * (toMax - toMin) + toMin;
}

function toDegrees(radians) {
    return radians / Math.PI * 180;
}