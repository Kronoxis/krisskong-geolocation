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
}

// Focus
document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") start();
    else stop();
});

// UI
const button = document.querySelector("#start");
button.addEventListener("click", start);
const running = document.querySelector("#running");
running.style.display = "none";
const info = document.querySelector("#data");
const privacy = document.querySelector("#privacy");
privacy.addEventListener("click", () => {
    privacy.classList.toggle("show");
    updateInfo();
});

// Hooks
let watch = null;
let lifeline = null;
let wake = null;
let fakeWatch = null;
let heartbeat = "";
keepAlive();

// Debug
const params = new URLSearchParams(window.location.search);
const debug = params.has("debug");
if (debug) {
    watch = setInterval(fakePosition, 2000);
}

// Geolocation logic
const data = { type: "location", latitude: 0, longitude: 0, time: -1 };
start();
function start() {
    // Stop watching Geolocation if it is already running
    if (watch !== null) stop();
    // Start watching Geolocation
    if (!debug) {
        watch = navigator.geolocation.watchPosition(onPosition, onError, {
            enableHighAccuracy: true,
            timeout: 10000
        });
    } else {
        watch = setInterval(fakePosition, 500);
    }

    // Reconnect socket
    if (!websocket ||
        websocket.readyState !== WebSocket.CONNECTING ||
        websocket.readyState !== websocket.OPEN) {
        connect();
    }

    // Prevent server from sleeping by pinging it every 5 minutes
    lifeline = setInterval(keepAlive, 5 * 60000);

    // Prevent device sleep
    navigator.wakeLock.request("screen").then(function (lock) { wake = lock; });

    // Show the info
    button.style.display = "none";
    running.style.display = "";
}

function stop() {
    // Stop watching Geolocation
    if (!debug) {
        navigator.geolocation.clearWatch(watch);
    } else {
        clearInterval(watch);
    }
    watch = null;

    // Let server sleep
    clearInterval(lifeline);
    lifeline = null;

    // Release wake lock
    if (wake) wake.release();

    // Show button
    button.style.display = "";
    running.style.display = "none";
}

async function keepAlive() {
    try {
        const response = await fetch("/ping");
        const text = await response.text();
        if (text !== "pong") {
            console.error("Unexpected heartbeat");
            heartbeat = `Unstable at ${new Date().toLocaleTimeString()}`;
            return;
        }
        heartbeat = `Healthy at ${new Date().toLocaleTimeString()}`;
    } catch (ex) {
        console.error("Heartbeat exception", ex);
        heartbeat = `Died at ${new Date().toLocaleTimeString()}`;
    }
}

function websocketState() {
    switch (websocket?.readyState) {
        case WebSocket.OPEN: return "Connected";
        case WebSocket.CONNECTING: return "Connecting";
        case WebSocket.CLOSING: return "Closing";
        case WebSocket.CLOSED: return "Closed";
        default: return "Unknown";
    }
}

function updateInfo() {
    const priv = !privacy.classList.contains("show");
    const privify = (number) => priv ? number.replace(/(\d+).(\d{3})/, "*.*****") : number;
    info.innerHTML =
        `Status: ${websocketState()}<br/>` +
        `Heartbeat: ${heartbeat}<br/>` +
        `Latitude: ${privify(data.latitude.toFixed(8))}<br/>` +
        `Longitude: ${privify(data.longitude.toFixed(8))}<br/>` +
        `Last updated: ${new Date(data.time).toLocaleTimeString()}`;
}

function onPosition(pos) {
    // Get position from Geolocation
    const { latitude, longitude } = pos.coords;
    const time = Date.now();

    data.latitude = latitude;
    data.longitude = longitude;
    data.time = time;

    // Send position to server
    if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(data));

        // Update Minimap
        minimap.location = { latitude, longitude };
        minimap.update();
    }

    // Update UI
    updateInfo();
}

function onError(e) {
    // Handle errors
    console.error(e);
    running.innerHTML = `Something went wrong! Refresh and try again.<br/>Error code: ${e.code}`;
}

function fakePosition() {
    // Send random position
    onPosition({
        coords: {
            latitude: 46.056946 + Math.random() * 0.0002,
            longitude: 14.505751 + Math.random() * 0.0002
        }
    });
}

// Render out the minimap on device (due to StreamElements limitations)
class Minimap {
    constructor() {
        this.display = document.querySelector("#minimap");

        this.map = L.map(this.display, {
            dragging: false,
            keyboard: false,
            zoomControl: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            touchZoom: false,
            tap: false,
            attributionControl: false,
            center: [46.056946, 14.505751],
            zoom: 20,
        });
        this.setStyle();

        this._latitude = 46.056946;
        this._longitude = 14.505751;
        this._targetLatitude = this._latitude;
        this._targetLongitude = this._longitude;
        this._update = this.update.bind(this);
        this._time = -1;

        this.update();
    }

    async setStyle() {
        const response = await fetch(`${window.URL}/minimap/mapstyle.json`);
        const style = await response.json();
        // style.sources.openmaptiles.url += `?api_key=${window.STADIA_API_KEY}`;
        L.maplibreGL({ style }).addTo(this.map);
    }

    get location() { return { latitude: this._latitude, longitude: this._longitude }; }
    set location({ latitude, longitude }) { this._targetLatitude = latitude; this._targetLongitude = longitude; }

    update(time) {
        // if (this._time > 0) {
        //     const deltaTime = (time - this._time) * 0.001;
        //     const t = Math.min(deltaTime, Math.max(deltaTime, 0.001), 0.2);
        //     this._latitude = this._latitude * (1 - t) + this._targetLatitude * t;
        //     this._longitude = this._longitude * (1 - t) + this._targetLongitude * t;
        // }
        // this._time = time;

        // if (!approximately(this._latitude, this._targetLatitude) ||
        //     !approximately(this._longitude, this._targetLongitude)) {

            // this.map.panTo([this._latitude, this._longitude]);
            this.map.panTo([this._targetLatitude, this._targetLongitude], { animate: false });
            if (!this.canvas) this.canvas = this.display.querySelector("canvas");
            if (this.canvas) {
                const image = this.canvas.toDataURL("png");
                websocket.send(JSON.stringify({ type: "map", image }));
            }
        // }

        // requestAnimationFrame(this._update);
    }
}
const minimap = new Minimap();

function approximately(a, b, epsilon = 1e-10) {
    return Math.abs(a - b) < epsilon;
}