const app = new PIXI.Application({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: 0x1099bb,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});
document.body.appendChild(app.view);

// The "world" container will hold all game objects that move relative to the player
const world = new PIXI.Container();
app.stage.addChild(world);

let myId = null;
const otherPlayers = {};

// My player's state, both interpolated and target
const myPlayer = {
    x: 0, y: 0, rotation: 0,
    targetX: 0, targetY: 0, targetRotation: 0,
};

// --- Player Sprite Creation ---
function createAirplaneSprite(color) {
    const airplane = new PIXI.Graphics();
    airplane.beginFill(color);
    airplane.moveTo(15, 0);
    airplane.lineTo(-10, -7);
    airplane.lineTo(-10, 7);
    airplane.closePath();
    airplane.endFill();
    return airplane;
}

// My airplane sprite, which is always centered on screen
const playerSprite = createAirplaneSprite(0xFFFFFF);
playerSprite.x = app.screen.width / 2;
playerSprite.y = app.screen.height / 2;
app.stage.addChild(playerSprite); // Add to stage, not world

// --- Input Handling ---
let mouseX = 0;
let mouseY = 0;
let isBoosting = false;

window.addEventListener('mousemove', (event) => {
  mouseX = event.clientX;
  mouseY = event.clientY;
});
window.addEventListener('mousedown', (event) => {
  if (event.button === 2) { isBoosting = true; }
});
window.addEventListener('mouseup', (event) => {
  if (event.button === 2) { isBoosting = false; }
});
window.addEventListener('contextmenu', (event) => event.preventDefault());

// --- Game Loop ---
app.ticker.add((delta) => {
  // Update my player's visual rotation for immediate feedback
  const dx = mouseX - playerSprite.x;
  const dy = mouseY - playerSprite.y;
  playerSprite.rotation = Math.atan2(dy, dx);

  // Send my input state to the server
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({
        rotation: playerSprite.rotation,
        boosting: isBoosting
    }));
  }

  // Interpolate my player's camera position
  myPlayer.x += (myPlayer.targetX - myPlayer.x) * 0.1;
  myPlayer.y += (myPlayer.targetY - myPlayer.y) * 0.1;

  // Center the world on my player's interpolated position
  world.x = -myPlayer.x + app.screen.width / 2;
  world.y = -myPlayer.y + app.screen.height / 2;

  // Interpolate other players
  for (const id in otherPlayers) {
    const otherPlayer = otherPlayers[id];
    const sprite = otherPlayer.sprite;
    sprite.rotation += (otherPlayer.targetRotation - sprite.rotation) * 0.1;
    sprite.x += (otherPlayer.targetX - sprite.x) * 0.1;
    sprite.y += (otherPlayer.targetY - sprite.y) * 0.1;
  }
});

// --- WebSocket Handling ---
const socket = new WebSocket(`ws://${window.location.host}/ws`);

socket.addEventListener('message', function (event) {
    const data = JSON.parse(event.data);

    if (data.type === 'init') {
        myId = data.id;
        const initialState = data.players[myId];
        if (initialState) {
            myPlayer.x = myPlayer.targetX = initialState.x;
            myPlayer.y = myPlayer.targetY = initialState.y;
        }
        console.log(`Connected! My ID is ${myId}`);
    } else if (data.type === 'state') {
        const receivedPlayers = data.players;
        const receivedPlayerIds = new Set();

        for (const playerId in receivedPlayers) {
            const playerData = receivedPlayers[playerId];
            receivedPlayerIds.add(playerData.id);

            if (playerData.id === myId) {
                myPlayer.targetX = playerData.x;
                myPlayer.targetY = playerData.y;
                continue;
            }

            if (otherPlayers[playerData.id]) {
                otherPlayers[playerData.id].targetRotation = playerData.rotation;
                otherPlayers[playerData.id].targetX = playerData.x;
                otherPlayers[playerData.id].targetY = playerData.y;
            } else {
                const otherPlayerSprite = createAirplaneSprite(0xFF0000);
                otherPlayerSprite.x = playerData.x;
                otherPlayerSprite.y = playerData.y;
                otherPlayerSprite.rotation = playerData.rotation;
                world.addChild(otherPlayerSprite);

                otherPlayers[playerData.id] = {
                    sprite: otherPlayerSprite,
                    targetRotation: playerData.rotation,
                    targetX: playerData.x,
                    targetY: playerData.y,
                };
            }
        }

        for (const playerId in otherPlayers) {
            if (!receivedPlayerIds.has(playerId)) {
                world.removeChild(otherPlayers[playerId].sprite);
                delete otherPlayers[playerId];
            }
        }
    }
});

socket.addEventListener('close', () => console.log('Disconnected from WS Server'));
socket.addEventListener('open', () => console.log('Connected to WS Server'));
