const env = require("dotenv").config(".env").parsed;
const server = require("../../server.js");

// Overlay
server.route(function (fastify) {
    fastify.get("/minimap", function (request, reply) {
        return reply.view("/src/minimap/minimap.hbs", {
            URL: env.DEBUG ? "http://localhost:3000" : `https://${env.PROJECT}.glitch.me`,
            SOCKET: env.DEBUG ? "ws://localhost:3000" : `wss://${env.PROJECT}.glitch.me`
        });
    });
});

// Location
server.onLocationChanged(function (server, client, data) {
    server.clients.forEach(target => {
        if (target === client) return;
        switch (data.type) {
            case "location":
                target.send(JSON.stringify({ type: "location", time: data.time, latitude: data.latitude, longitude: data.longitude }));
                break;
            case "map":
                target.send(JSON.stringify({ type: "map", time: data.time, image: data.image }));
        }
    });
});