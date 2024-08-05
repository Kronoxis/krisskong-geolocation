class Minimap {
    constructor() {
        this.element = document.querySelector("#minimap");
        this.display = document.querySelector("#map");
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

        this.display.src = this._map;
        this.pin.style.transform = `rotate(${this._rotation}deg)`;

        this._lastLatitude = this._latitude;
        this._lastLongitude = this._longitude;

        requestAnimationFrame(this._update);
    }

    resize() {
        const { clientWidth: pageSize } = document.querySelector(".main-container");
        const { clientWidth: elementSize } = this.element;
        const scale = pageSize / elementSize;
        this.element.style.transform = `scale(${scale})`;
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
        switch (json.type) {
            case "location":
                const { latitude, longitude } = json;
                minimap.location = { latitude, longitude };
                break;
            case "map":
                const { image } = json;
                minimap.image = image;
                break;
        }
    });
}
connect();

function updateInfo() {
    minimap.error = !websocket || websocket.readyState !== WebSocket.OPEN;
}