const server = require("../../server.js");

// Overlay
server.route(function (fastify) {
    fastify.get("/minimap", function (request, reply) {
        return reply.view("/src/minimap/minimap.hbs", { SOCKET: process.env.SOCKET });
    })
});