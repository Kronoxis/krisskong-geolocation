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
        target.send(JSON.stringify({ type: "location", latitude: data.latitude, longitude: data.longitude }));
    });
});