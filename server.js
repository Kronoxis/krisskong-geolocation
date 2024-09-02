const env = require("dotenv").config(".env").parsed;
const path = require("path");

// ---------------
// FASTIFY SETUP 
// ---------------

// Require the fastify framework and instantiate it
const fastify = require("fastify")({
    // set this to true for detailed logging:
    logger: false,
});

// Add CORS
fastify.register(require("@fastify/cors"), {
    origin: "*"
});

// Setup our static files
fastify.register(require("@fastify/static"), {
    root: path.join(__dirname, "public"),
    prefix: "/", // optional: default '/'
});

// point-of-view is a templating manager for fastify
fastify.register(require("@fastify/view"), {
    engine: {
        handlebars: require("handlebars"),
    },
});

// ---------------
// APPLICATIONS 
// ---------------

// Application Routes
/**
 * 
 * @param {(fastify: 
 *            FastifyInstance<
 *              Server<typeof IncomingMessage, typeof ServerResponse>, 
 *              IncomingMessage, 
 *              ServerResponse<IncomingMessage>, 
 *              FastifyBaseLogger, 
 *              FastifyTypeProviderDefault
 *            >) => void} route 
 */
exports.route = function (route) {
    route(fastify);
}

// WebSocket Hooks
const connectHooks = [];

/**
 * Add a hook to the WebSocket connect event
 * @param {(server: WebSocket.Server<typeof WebSocket, typeof IncomingMessage>, 
*           client: WebSocket,
*          ) => void} hook 
*/
exports.onConnection = function (hook) {
    connectHooks.push(hook);
}

const dataHooks = [];
/**
 * Add a hook to the WebSocket message event
 * @param {(server: WebSocket.Server<typeof WebSocket, typeof IncomingMessage>, 
 *          client: WebSocket,
 *          data: { 
 *            latitude: number; 
 *            longitude: number; 
 *            time: number; 
 *         }) => void} hook 
 */
exports.onData = function (hook) {
    dataHooks.push(hook);
}

// ---------------
// WEBSOCKET 
// ---------------

const WebSocket = require("ws").WebSocketServer;
const wss = new WebSocket(fastify);
const decoder = new TextDecoder();
const packetTime = {};
wss.on("connection", function connection(ws) {
    ws.on("error", console.error);
    ws.on("message", function message(rawData) {
        const data = JSON.parse(decoder.decode(rawData));

        if (packetTime[data.type] && packetTime[data.type] > data.time) {
            console.log(`Packet from ${new Date(data.time).toLocaleTimeString()} dropped, ` +
                `last handled packet was at ${new Date(packetTime[data.type]).toLocaleTimeString()}`);
            return;
        }
        packetTime[data.type] = data.time;

        if (data.type === "connect-transmitter") {
            ws.type = "transmitter";
        }

        for (const hook of dataHooks) hook?.(wss, ws, data);
    });

    ws.type = "receiver";
    for (const hook of connectHooks) hook?.(wss, ws);
});

exports.isTransmitting = function () {
    for (const client of wss.clients) {
        if (client.type === "transmitter") return true;
    }
    return false;
};

// ---------------
// LIFELINE 
// ---------------

fastify.get("/ping", function (request, reply) {
    console.log("I'm alive");
    return reply.code(200).send("pong");
});

// ---------------
// RUN SERVER 
// ---------------

fastify.listen(
    { port: env.PORT, host: "0.0.0.0" },
    function (err, address) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log(`Your app is listening on ${address}`);
    }
);