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

    update(time) {
        if (this.error) {
        }
        else if (this._time > 0) {
            const deltaTime = (time - this._time) * 0.001;
        }
        this._time = time;
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
