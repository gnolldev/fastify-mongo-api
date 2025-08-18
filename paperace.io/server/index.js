const fastify = require('fastify')({ logger: true });
const path = require('path');
const crypto = require('crypto');

const WORLD_WIDTH = 2000;
const WORLD_HEIGHT = 2000;
const BASE_SPEED = 3;
const BOOST_MULTIPLIER = 2;
const CELL_SIZE = 200;
const AOI_RADIUS = 400; // Area of Interest radius

// --- Spatial Grid ---
class SpatialGrid {
    constructor(width, height, cellSize) {
        this.width = width;
        this.height = height;
        this.cellSize = cellSize;
        this.gridWidth = Math.ceil(width / cellSize);
        this.gridHeight = Math.ceil(height / cellSize);
        this.grid = Array.from({ length: this.gridWidth * this.gridHeight }, () => new Set());
    }

    getCellIndex(x, y) {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return cellY * this.gridWidth + cellX;
    }

    add(player) {
        const cellIndex = this.getCellIndex(player.x, player.y);
        if (this.grid[cellIndex]) {
            this.grid[cellIndex].add(player);
        }
        player.cellIndex = cellIndex;
    }

    remove(player) {
        const cellIndex = player.cellIndex;
        if (cellIndex !== undefined && this.grid[cellIndex]) {
            this.grid[cellIndex].delete(player);
        }
    }

    update(player) {
        const newCellIndex = this.getCellIndex(player.x, player.y);
        if (player.cellIndex !== newCellIndex) {
            this.remove(player);
            this.add(player);
        }
    }

    query(x, y, radius) {
        const nearbyPlayers = new Set();
        const minCellX = Math.floor(Math.max(0, x - radius) / this.cellSize);
        const maxCellX = Math.floor(Math.min(this.width, x + radius) / this.cellSize);
        const minCellY = Math.floor(Math.max(0, y - radius) / this.cellSize);
        const maxCellY = Math.floor(Math.min(this.height, y + radius) / this.cellSize);

        for (let cy = minCellY; cy <= maxCellY; cy++) {
            for (let cx = minCellX; cx <= maxCellX; cx++) {
                const cellIndex = cy * this.gridWidth + cx;
                if (this.grid[cellIndex]) {
                    for (const player of this.grid[cellIndex]) {
                        nearbyPlayers.add(player);
                    }
                }
            }
        }
        return nearbyPlayers;
    }
}

// --- Server Setup ---
const players = {};
const connections = new Set();
const grid = new SpatialGrid(WORLD_WIDTH, WORLD_HEIGHT, CELL_SIZE);

fastify.register(require('@fastify/static'), { root: path.join(__dirname, '..', 'client') });
fastify.register(require('@fastify/websocket'));

fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const { socket } = connection;
    connections.add(socket);

    const playerId = crypto.randomUUID();
    socket.playerId = playerId;

    const player = {
      id: playerId,
      rotation: 0,
      x: Math.random() * WORLD_WIDTH,
      y: Math.random() * WORLD_HEIGHT,
      boosting: false,
      cellIndex: -1,
    };
    players[playerId] = player;
    grid.add(player);

    fastify.log.info(`Player ${playerId} connected and added to grid.`);
    socket.send(JSON.stringify({ type: 'init', id: playerId, players }));

    socket.on('message', message => {
      try {
        const data = JSON.parse(message.toString());
        const player = players[socket.playerId];
        if (!player) return;

        if (data.rotation !== undefined) player.rotation = data.rotation;
        if (data.boosting !== undefined) player.boosting = data.boosting;
      } catch (e) {
        fastify.log.error(`Failed to parse message from client ${socket.playerId}`, e);
      }
    });

    socket.on('close', () => {
      connections.delete(socket);
      const player = players[socket.playerId];
      if (player) {
          grid.remove(player);
          delete players[socket.playerId];
          fastify.log.info(`Player ${socket.playerId} disconnected and removed from grid.`);
      }
    });
  })
})

// --- Game Loop ---
setInterval(() => {
  // Update player positions
  for (const id in players) {
    const player = players[id];
    const speed = player.boosting ? BASE_SPEED * BOOST_MULTIPLIER : BASE_SPEED;

    player.x += speed * Math.cos(player.rotation);
    player.y += speed * Math.sin(player.rotation);

    player.x = Math.max(0, Math.min(WORLD_WIDTH, player.x));
    player.y = Math.max(0, Math.min(WORLD_HEIGHT, player.y));

    grid.update(player);
  }

  // Smart state broadcasting
  for (const connection of connections) {
    const player = players[connection.playerId];
    if (!player) continue;

    const nearbyPlayersSet = grid.query(player.x, player.y, AOI_RADIUS);
    const nearbyPlayersObj = {};
    for (const nearbyPlayer of nearbyPlayersSet) {
        nearbyPlayersObj[nearbyPlayer.id] = nearbyPlayer;
    }

    const gameState = { type: 'state', players: nearbyPlayersObj };
    connection.send(JSON.stringify(gameState));
  }
}, 100);

// --- Server Start ---
const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
