const env = require("dotenv").config(".env").parsed;
const path = require("path");
const server = require("../../server.js");
const { access, constants, mkdir, readFile, writeFile } = require("node:fs/promises");

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
server.onData(function (server, client, data) {
    switch (data.type) {
        case "map":
            cacheMap(data.x, data.y, data.tile);
            return;
        case "request-map":
            loadMap(client, data.x, data.y);
            return;
    }
    server.clients.forEach(target => {
        if (target === client) return;
        switch (data.type) {
            case "location":
                target.send(JSON.stringify({ type: "location", time: data.time, latitude: data.latitude, longitude: data.longitude }));
                break;
        }
    });
});

const cacheDir = "cache";
const cacheFile = (x, y) => path.join(cacheDir, x.toFixed(0), y.toFixed(0), "tile.json");

async function cacheMap(x, y, tile) {
    const file = cacheFile(x, y);
    await mkdir(path.dirname(file), { mode: 0o644, recursive: true });
    await writeFile(file, JSON.stringify(tile), { encoding: "utf-8" });
}

async function loadMap(client, x, y) {
    try {
        const file = cacheFile(x, y);
        await access(file, constants.R_OK);
        const tile = JSON.parse(await readFile(file, { encoding: "utf-8" }));
        client.send(JSON.stringify({ type: "map", x, y, tile }));
    } catch (ex) {
        client.send(JSON.stringify({ type: "map", x, y, error: 404 }));
    }
}