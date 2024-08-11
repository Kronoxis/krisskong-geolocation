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
            cacheMap(data.latIndex, data.lonIndex, data.tile);
            return;
        case "request-map":
            loadMap(client, data.latIndex, data.lonIndex);
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
const cacheFile = (latIndex, lonIndex) => path.join(cacheDir, latIndex.toFixed(0), lonIndex.toFixed(0), "tile.json");

async function cacheMap(latIndex, lonIndex, tile) {
    const file = cacheFile(latIndex, lonIndex);
    await mkdir(path.dirname(file), { mode: 0o644, recursive: true });
    await writeFile(file, JSON.stringify(tile), { encoding: "utf-8" });
}

async function loadMap(client, latIndex, lonIndex) {
    try {
        const file = cacheFile(latIndex, lonIndex);
        await access(file, constants.R_OK);
        const tile = JSON.parse(await readFile(file, { encoding: "utf-8" }));
        client.send(JSON.stringify({ type: "map", latIndex, lonIndex, tile }));
    } catch (ex) {
        client.send(JSON.stringify({ type: "map", latIndex, lonIndex, error: 404 }));
    }
}