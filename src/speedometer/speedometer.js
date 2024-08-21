const env = require("dotenv").config(".env").parsed;
const server = require("../../server.js");

let enabled = true;

// Overlay
server.route(function (fastify) {
    fastify.get("/speedometer", function (request, reply) {
        return reply.view("/src/speedometer/speedometer.hbs", { 
            URL: env.DEBUG ? "http://localhost:3000" : `https://${env.PROJECT}.glitch.me`,
            SOCKET: env.DEBUG ? "ws://localhost:3000" : `wss://${env.PROJECT}.glitch.me`
        });
    });
});

// API
server.route(function (fastify) {
    fastify.get("/speed", function (request, reply) {
        return reply.code(200).send(speed);
    });
});

server.onLocationChanged(function (server, client, data) {
    if (data.type !== "enable-speedometer") return;
    if (data.enable !== undefined) enabled = data.enable;
    else enabled = !enabled;
    server.clients.forEach(target => {
        if (target === client) return;
        target.send(JSON.stringify(data));
    });
});

server.onConnection(function (server, client) {
    client.send(JSON.stringify({ type: "enable-speedometer", enable: enabled }));
});

// Calculate Speed
let speed = 0;
server.onLocationChanged(function (server, client, data) {
    if (!enabled) return;
    if (data.type !== "location") return;
    
    const distance = haversine(data.latitude, data.longitude);
    const delta = deltaTime(data.time);
    if (delta > toHours(10)) {
        speed = distance / delta;
    }

    console.log(`${new Date(data.time).toLocaleTimeString()}: ${speed.toFixed(2)}km/h`);

    server.clients.forEach(target => {
        if (target === client) return;
        target.send(JSON.stringify({ type: "speed", time: data.time, speed }));
    })
});

const last = {
    valid: false,
    latitude: 0,
    longitude: 0,
    time: -1
};

function toRadians(degrees) {
    return degrees / 180 * Math.PI;
}

function toHours(milliseconds) {
    return milliseconds / 3600000;
}

/**
 * Haversine Distance Formula between last and current position
 * @param {number} latitude Latitude in degrees
 * @param {number} longitude Longitude in degrees
 * @returns Haversine distance in kilometers
 */
function haversine(latitude, longitude) {
    let distance = 0;
    if (last.valid) {
        const R = 6371;
        const lat1 = toRadians(last.latitude);
        const lat2 = toRadians(latitude);
        const lon1 = toRadians(last.longitude);
        const lon2 = toRadians(longitude);
        const sdLat = Math.sin((lat2 - lat1) / 2);
        const sdLon = Math.sin((lon2 - lon1) / 2);
        const cLat1 = Math.cos(lat1);
        const cLat2 = Math.cos(lat2);
        const a = sdLat * sdLat + cLat1 * cLat2 * sdLon * sdLon;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance = R * c;
    }

    last.latitude = latitude;
    last.longitude = longitude;
    last.valid = true;

    return distance;
}

/**
 * Time between last and current update
 * @param {number} time Current time
 * @returns Delta Time in hours
 */
function deltaTime(time) {
    let delta = 0;
    if (time > 0) {
        delta = toHours(time - last.time);
    }

    last.time = time;

    return delta;
}
