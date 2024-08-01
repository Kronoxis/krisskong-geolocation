const server = require("../../server.js");

// UI
server.route(function (fastify) {
    fastify.get("/", function (request, reply) {
        return reply.view("/src/transmitter/transmitter.hbs", { SOCKET: process.env.SOCKET });
    });
});