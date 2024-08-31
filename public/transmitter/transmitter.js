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
const locationData = { type: "location", latitude: 0, longitude: 0, time: -1 };
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
        `Latitude: ${privify(locationData.latitude.toFixed(8))}<br/>` +
        `Longitude: ${privify(locationData.longitude.toFixed(8))}<br/>` +
        `Last updated: ${new Date(locationData.time).toLocaleTimeString()}`;
}

function onPosition(pos) {
    // Get position from Geolocation
    const { latitude, longitude } = pos.coords;
    const time = Date.now();

    locationData.latitude = latitude;
    locationData.longitude = longitude;
    locationData.time = time;

    // Send position to server
    if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify(locationData));
    }

    // Update UI
    updateInfo();
}

function onError(e) {
    // Handle errors
    console.error(e);
    running.innerHTML = `Something went wrong! Refresh and try again.<br/>Error code: ${e.code}`;
}

let fakeLatitude = 46.056946;
let fakeLongitude = 14.505751;
let fakeX = 0, fakeY = 0;
let fakeS = 1;
function fakePosition() {
    // Send fake position
    fakeLongitude += fakeX === null ? Math.random() * 0.0002 - 0.0001 : 0.0001 * fakeX * fakeS;
    fakeLatitude += fakeY === null ? Math.random() * 0.0002 - 0.0001 : 0.0001 * fakeY * fakeS;
    onPosition({
        coords: {
            latitude: fakeLatitude,
            longitude: fakeLongitude
        }
    });
}

window.enableApplication = function (application, enable) {
    if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: `enable-${application}`, enable }));
    }
}

window.setDirection = function (x, y) {
    fakeX = x;
    fakeY = y;
}

window.addSpeed = function (value) {
    fakeS *= value;
}