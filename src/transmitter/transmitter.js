const env = require("dotenv").config(".env").parsed;
const server = require("../../server.js");

// UI
server.route(function (fastify) {
    fastify.get("/", function (request, reply) {
        return reply.view("/src/transmitter/transmitter.hbs", {
            URL: env.DEBUG ? "http://localhost:3000" : `https://${env.PROJECT}.glitch.me`,
            SOCKET: env.DEBUG ? "ws://localhost:3000" : `wss://${env.PROJECT}.glitch.me`,
        });
    });
});

// Log
server.onLocationChanged(function (server, client, data) {
    if (data.type !== "location") return;
    console.log(`${new Date(data.time).toLocaleTimeString()}: ${data.latitude}, ${data.longitude}`);
});