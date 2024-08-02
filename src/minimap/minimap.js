const server = require("../../server.js");

// Overlay
server.route(function (fastify) {
    fastify.get("/minimap", function (request, reply) {
        return reply.view("/src/minimap/minimap.hbs", { 
            URL: env.DEBUG ? "http://localhost:3000" : `https://${env.PROJECT}.glitch.me`,
            SOCKET: env.DEBUG ? "ws://localhost:3000" : `wss://${env.PROJECT}.glitch.me`
        });
    })
});