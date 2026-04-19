const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const difficultyEl = document.getElementById('difficulty');
const mobileControlsEl = document.getElementById('mobileControls');
const modeSelectEl = document.getElementById('modeSelect');
const gameScreenEl = document.getElementById('gameScreen');
const classicModeBtn = document.getElementById('classicModeBtn');
const endlessModeBtn = document.getElementById('endlessModeBtn');
const backToModesBtn = document.getElementById('backToModesBtn');
const classicControlsEl = document.getElementById('classicControls');
const homeVersionTagEl = document.getElementById('homeVersionTag');
const classicHudEl = document.getElementById('classicHud');
const endlessHudEl = document.getElementById('endlessHud');
const endlessTimerEl = document.getElementById('endlessTimer');
const endlessScoreEl = document.getElementById('endlessScore');
const endlessBestEl = document.getElementById('endlessBest');
const coinCountEl = document.getElementById('coinCount');
const gameTitleEl = document.getElementById('gameTitle');
const gameHintEl = document.getElementById('gameHint');

const COLS = 12;
const ROWS = 16;
const TILE = 40;
const SAFE_ROWS = new Set([0, 1, ROWS - 1]);
const SNIPER_LOCK_DISTANCE = 10;
const BUILD_TAG = '3.1.7beta2.4';
const SNIPER_DEATH_GIF = 'assets-sniper-death.gif';
const DEFEAT_SFX = 'assets-defeat-sfx.mp3';
const PLAYER_SPRITE = 'assets-player.png';
const LEFT_VEHICLE_SPRITES = ['assets-left-1.png', 'assets-left-2.png', 'assets-left-3.png'];
const RIGHT_VEHICLE_SPRITES = ['assets-right-1.png', 'assets-right-2.png', 'assets-right-3.png'];
const LEFT_VEHICLE_NAMES = ['核弹', '大运', '火箭'];
const RIGHT_VEHICLE_NAMES = ['战斗机', '坦克', 'UFO'];
const COIN_SPRITE = 'assets-coin.gif';
const ENDLESS_SCORE_PER_SEC = 1.234;
const ENDLESS_COIN_CHANCE = 0.333;
const ENDLESS_SCROLL_GROWTH_PER_MIN = 0.15;
const ENDLESS_SNIPE_INTERVAL = 3;
const CLASSIC_RESPAWN_INVINCIBLE_SECONDS = 0;
const ENDLESS_RESPAWN_INVINCIBLE_SECONDS = 3.1;
const ENDLESS_START_COUNTDOWN_SECONDS = 5;

const DIFFICULTIES = {
  easy: { label: '简单', carMultiplier: 1, sniperMove: 1, aimSeconds: 1, spawnDelay: 0 },
  hard: { label: '困难', carMultiplier: 2, sniperMove: 3, aimSeconds: 0.5, spawnDelay: 3 },
  extreme: { label: '极难', carMultiplier: 4, sniperMove: 5, aimSeconds: 0.3, spawnDelay: 5 },
  inferno: { label: '炼狱', carMultiplier: 8, sniperMove: 7, aimSeconds: 0, spawnDelay: 6 }
};

const DEATH_SUBTITLE_MAP = {
  sniper: '你被狙飞了！',
  坦克: '你被坦克碾压了!',
  核弹: '你被核爆了',
  大运: '你撞大运了',
  火箭: '你被火箭撞飞了',
  战斗机: '你被战斗机撞飞了',
  UFO: '你被外星人带走了'
};

const playerImage = new Image();
playerImage.src = PLAYER_SPRITE;
const coinImage = new Image();
coinImage.src = COIN_SPRITE;
const leftVehicleImages = LEFT_VEHICLE_SPRITES.map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});
const rightVehicleImages = RIGHT_VEHICLE_SPRITES.map((src) => {
  const img = new Image();
  img.src = src;
  return img;
});
const sniperDeathImage = new Image();
sniperDeathImage.src = SNIPER_DEATH_GIF;
const defeatAudio = new Audio(DEFEAT_SFX);
defeatAudio.preload = 'auto';
defeatAudio.volume = 0.85;

let currentMode = null;
let best = Number(localStorage.getItem('crossyBest') || 0);
let endlessBest = Number(localStorage.getItem('crossyEndlessBest') || 0);
let currentDifficulty = difficultyEl.value;
bestEl.textContent = best;
endlessBestEl.textContent = endlessBest.toFixed(3);

const classicLaneTypes = Array.from({ length: ROWS }, (_, row) => {
  if (SAFE_ROWS.has(row)) return 'safe';
  return row % 2 === 0 ? 'road' : 'grass';
});

let player;
let cars;
let score;
let gameOver;
let sniper;
let lastTime = 0;
let elapsedTime = 0;
let resultText = '';
let resultSubtitle = '';
let resultStyle = 'lose';
let killEffect = null;
let invincibleTime = 0;
let endlessRows = [];
let endlessRowMap = new Map();
let endlessWorldRowStart = 0;
let endlessScrollOffset = 0;
let endlessScore = 0;
let endlessCoins = 0;
let endlessSniperCooldown = ENDLESS_SNIPE_INTERVAL;
let endlessStartCountdown = 0;

function getDifficultyConfig() {
  return DIFFICULTIES[currentDifficulty];
}

function getPlayerCenter() {
  return {
    x: player.col * TILE + TILE / 2,
    y: player.row * TILE + TILE / 2
  };
}

function resetSharedState() {
  score = 0;
  elapsedTime = 0;
  gameOver = false;
  resultText = '';
  resultSubtitle = '';
  killEffect = null;
  lastTime = 0;
}

function showModeSelect() {
  currentMode = null;
  modeSelectEl.classList.remove('hidden');
  gameScreenEl.classList.add('hidden');
}

function showGameScreen() {
  modeSelectEl.classList.add('hidden');
  gameScreenEl.classList.remove('hidden');
}

function updateClassicHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  timerEl.textContent = `${elapsedTime.toFixed(2)}s`;
}

function updateEndlessHud() {
  endlessTimerEl.textContent = `${elapsedTime.toFixed(2)}s`;
  endlessScoreEl.textContent = endlessScore.toFixed(3);
  endlessBestEl.textContent = endlessBest.toFixed(3);
  coinCountEl.textContent = String(endlessCoins);
}

function randomSpawnPoint() {
  return {
    x: 30 + Math.random() * (canvas.width - 60),
    y: 30 + Math.random() * (canvas.height - 60)
  };
}

function startClassicMode() {
  currentMode = 'classic';
  showGameScreen();
  classicControlsEl.classList.remove('hidden');
  classicHudEl.classList.remove('hidden');
  endlessHudEl.classList.add('hidden');
  gameTitleEl.textContent = '过马路（经典版）';
  gameHintEl.textContent = '方向键 / WASD 移动，R 重新开始';
  resetClassicMode();
}

function startEndlessMode() {
  currentMode = 'endless';
  showGameScreen();
  classicControlsEl.classList.add('hidden');
  classicHudEl.classList.add('hidden');
  endlessHudEl.classList.remove('hidden');
  gameTitleEl.textContent = '过马路（无尽模式）';
  gameHintEl.textContent = '方向键 / WASD 或触控按钮横向躲避，努力生存并捡金币';
  resetEndlessMode();
}

function resetClassicMode() {
  const diff = getDifficultyConfig();
  resetSharedState();
  invincibleTime = CLASSIC_RESPAWN_INVINCIBLE_SECONDS;
  player = { col: Math.floor(COLS / 2), row: ROWS - 1 };
  cars = [];
  const spawn = randomSpawnPoint();
  sniper = {
    x: spawn.x,
    y: spawn.y,
    aimTime: 0,
    firing: false,
    shotTimer: 0,
    shotLine: null,
    moveFactor: diff.sniperMove,
    aimSeconds: diff.aimSeconds,
    spawned: diff.spawnDelay === 0,
    spawnCountdown: diff.spawnDelay
  };
  statusEl.textContent = diff.spawnDelay === 0
    ? `当前难度：${diff.label}。狙击手已在开局出现。`
    : `当前难度：${diff.label}。狙击手会在 ${diff.spawnDelay} 秒后随机现身。`;
  buildClassicCars();
  updateClassicHud();
}

function getEndlessRowType(worldRow) {
  return ((worldRow % 3) + 3) % 3 === 2 ? 'road' : 'safe';
}

function createEndlessRowForWorld(worldRow) {
  const type = getEndlessRowType(worldRow);
  const row = type === 'road' ? createEndlessRoadRow(0) : createEndlessSafeRow(0);
  row.worldRow = worldRow;
  return row;
}

function getEndlessRowByWorld(worldRow) {
  let row = endlessRowMap.get(worldRow);
  if (!row) {
    row = createEndlessRowForWorld(worldRow);
    endlessRowMap.set(worldRow, row);
  }
  return row;
}

function rebuildEndlessRows() {
  endlessRows = [];
  for (let index = 0; index < ROWS + 4; index++) {
    const worldRow = endlessWorldRowStart + index;
    const row = getEndlessRowByWorld(worldRow);
    row.worldRow = worldRow;
    endlessRows.push(row);
  }

  const minKeep = endlessWorldRowStart - 2;
  const maxKeep = endlessWorldRowStart + ROWS + 8;
  for (const key of Array.from(endlessRowMap.keys())) {
    if (key < minKeep || key > maxKeep) endlessRowMap.delete(key);
  }
}

function getEndlessRowY(index) {
  return canvas.height - TILE + endlessScrollOffset - index * TILE;
}

function resetEndlessMode() {
  resetSharedState();
  invincibleTime = ENDLESS_RESPAWN_INVINCIBLE_SECONDS;
  player = { col: Math.floor(COLS / 2), row: ROWS - 1 };
  cars = [];
  endlessRows = [];
  endlessRowMap = new Map();
  endlessWorldRowStart = 0;
  endlessScrollOffset = 0;
  endlessScore = 0;
  endlessCoins = 0;
  endlessSniperCooldown = ENDLESS_SNIPE_INTERVAL;
  endlessStartCountdown = ENDLESS_START_COUNTDOWN_SECONDS;
  sniper = {
    x: canvas.width / 2,
    y: 60,
    aimTime: 0,
    firing: false,
    shotTimer: 0,
    shotLine: null,
    moveFactor: 1,
    aimSeconds: 0,
    spawned: true,
    spawnCountdown: 0
  };
  rebuildEndlessRows();
  statusEl.textContent = '无尽模式开始，底部出生点固定在安全路，地图会像流水线一样持续向下滚动。';
  updateEndlessHud();
}

function buildClassicCars() {
  cars = [];
  const diff = getDifficultyConfig();
  for (let row = 0; row < ROWS; row++) {
    if (classicLaneTypes[row] !== 'road') continue;
    const dir = row % 4 === 0 ? 1 : -1;
    const baseSpeed = 1.2 + (ROWS - row) * 0.03;
    const speed = baseSpeed * diff.carMultiplier;
    const spriteSet = dir > 0 ? rightVehicleImages : leftVehicleImages;
    const nameSet = dir > 0 ? RIGHT_VEHICLE_NAMES : LEFT_VEHICLE_NAMES;
    for (let i = 0; i < 3; i++) {
      cars.push({
        row,
        x: (i * 180 + row * 37) % (canvas.width + 120) - 60,
        width: 78,
        height: 42,
        dir,
        speed,
        image: spriteSet[i % 3],
        label: nameSet[i % 3]
      });
    }
  }
}

function createEndlessRoadRow(y = 0) {
  const gapWidth = 2 + Math.floor(Math.random() * 2);
  const minStart = 1;
  const maxStart = COLS - gapWidth - 1;
  const gapStart = Math.max(minStart, Math.min(maxStart, Math.floor(Math.random() * (maxStart - minStart + 1)) + minStart));
  const dir = Math.random() > 0.5 ? 1 : -1;
  const spriteSet = dir > 0 ? rightVehicleImages : leftVehicleImages;
  const nameSet = dir > 0 ? RIGHT_VEHICLE_NAMES : LEFT_VEHICLE_NAMES;
  const segments = [];
  for (let col = 0; col < COLS; col++) {
    if (col >= gapStart && col < gapStart + gapWidth) continue;
    const idx = Math.floor(Math.random() * 3);
    segments.push({ col, image: spriteSet[idx], label: nameSet[idx] });
  }
  const coin = Math.random() < ENDLESS_COIN_CHANCE ? {
    col: gapStart + Math.floor(gapWidth / 2),
    collected: false
  } : null;
  return { y, type: 'road', segments, coin };
}

function createEndlessSafeRow(y = 0) {
  return { y, type: 'safe', segments: [], coin: null };
}

function playDefeatSound() {
  try {
    defeatAudio.currentTime = 0;
    defeatAudio.play().catch(() => {});
  } catch {}
}

function triggerLose(message, cause = 'sniper') {
  const target = getPlayerCenter();
  const endlessSubtitle = cause === 'scroll'
    ? '你太慢了。'
    : (DEATH_SUBTITLE_MAP[cause] || '你被创飞了');
  gameOver = true;
  resultText = currentMode === 'endless' ? '游戏结束' : '失败';
  resultSubtitle = currentMode === 'endless'
    ? `${endlessSubtitle}\n分数 ${endlessScore.toFixed(3)} | 时间 ${elapsedTime.toFixed(2)}s | 金币 ${endlessCoins} | 最高分 ${endlessBest.toFixed(3)}`
    : (DEATH_SUBTITLE_MAP[cause] || '你被创飞了');
  resultStyle = 'lose';
  statusEl.textContent = message;
  playDefeatSound();
  killEffect = {
    x: target.x,
    y: target.y,
    width: 96,
    height: 96,
    alpha: 1,
    alive: true
  };
}

function triggerWin() {
  gameOver = true;
  resultText = '胜利';
  resultSubtitle = '';
  resultStyle = 'win';
  statusEl.textContent = `成功过马路了，用时 ${elapsedTime.toFixed(2)} 秒，按 R 再来一局。`;
}

function movePlayer(dx, dy) {
  if (gameOver) return;
  const verticalAllowed = currentMode === 'classic' || currentMode === 'endless';
  const nextCol = Math.max(0, Math.min(COLS - 1, player.col + dx));
  const nextRow = verticalAllowed ? Math.max(0, Math.min(ROWS - 1, player.row + dy)) : player.row;
  if (nextCol === player.col && nextRow === player.row) return;
  player.col = nextCol;
  if (currentMode === 'classic' && nextRow < player.row) {
    score += 1;
    if (score > best) {
      best = score;
      localStorage.setItem('crossyBest', String(best));
    }
  }
  player.row = nextRow;
  if (currentMode === 'classic') updateClassicHud();
}

function handleRestart() {
  if (currentMode === 'classic') resetClassicMode();
  else if (currentMode === 'endless') resetEndlessMode();
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'arrowup' || key === 'w') movePlayer(0, -1);
  else if (key === 'arrowdown' || key === 's') movePlayer(0, 1);
  else if (key === 'arrowleft' || key === 'a') movePlayer(-1, 0);
  else if (key === 'arrowright' || key === 'd') movePlayer(1, 0);
  else if (key === 'r') handleRestart();
});

if (mobileControlsEl) {
  const handleMobileAction = (target) => {
    const move = target.dataset.move;
    const action = target.dataset.action;
    if (move === 'up') movePlayer(0, -1);
    else if (move === 'down') movePlayer(0, 1);
    else if (move === 'left') movePlayer(-1, 0);
    else if (move === 'right') movePlayer(1, 0);
    else if (action === 'restart') handleRestart();
  };
  mobileControlsEl.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => handleMobileAction(button));
    button.addEventListener('touchstart', (event) => {
      event.preventDefault();
      handleMobileAction(button);
    }, { passive: false });
  });
}

classicModeBtn.addEventListener('click', startClassicMode);
endlessModeBtn.addEventListener('click', startEndlessMode);
backToModesBtn.addEventListener('click', showModeSelect);
difficultyEl.addEventListener('change', () => {
  currentDifficulty = difficultyEl.value;
  if (currentMode === 'classic') resetClassicMode();
});

function updateClassicSniper(deltaSeconds) {
  if (!sniper.spawned) {
    sniper.spawnCountdown -= deltaSeconds;
    if (sniper.spawnCountdown <= 0) {
      sniper.spawned = true;
      const spawn = randomSpawnPoint();
      sniper.x = spawn.x;
      sniper.y = spawn.y;
      statusEl.textContent = '狙击手已现身，快躲开锁定！';
    }
    return;
  }
  const target = getPlayerCenter();
  const followSpeed = 0.018 * sniper.moveFactor;
  sniper.x += (target.x - sniper.x) * followSpeed * deltaSeconds * 60;
  sniper.y += (target.y - sniper.y) * followSpeed * deltaSeconds * 60;
  const distance = Math.hypot(target.x - sniper.x, target.y - sniper.y);
  if (!sniper.firing) {
    if (distance <= SNIPER_LOCK_DISTANCE) {
      sniper.aimTime += deltaSeconds;
      if (sniper.aimSeconds === 0 || sniper.aimTime >= sniper.aimSeconds) {
        sniper.firing = true;
        sniper.shotTimer = 0.22;
        sniper.shotLine = { fromX: sniper.x, fromY: sniper.y, toX: target.x, toY: target.y };
        triggerLose('你被狙击手击中了，按 R 重新开始。', 'sniper');
      } else {
        const remaining = Math.max(0, sniper.aimSeconds - sniper.aimTime).toFixed(1);
        statusEl.textContent = `狙击手已锁定，${remaining} 秒后开枪，快躲开！`;
      }
    } else {
      sniper.aimTime = 0;
    }
  } else if (sniper.shotTimer > 0) {
    sniper.shotTimer -= deltaSeconds;
  }
}

function updateClassicCars(deltaSeconds) {
  for (const car of cars) {
    car.x += car.speed * car.dir * deltaSeconds * 60;
    if (car.dir > 0 && car.x > canvas.width + 90) car.x = -100;
    if (car.dir < 0 && car.x < -100) car.x = canvas.width + 90;
    if (car.row === player.row) {
      const px = player.col * TILE + TILE / 2;
      const py = player.row * TILE + TILE / 2;
      if (invincibleTime <= 0 && px > car.x - car.width / 2 && px < car.x + car.width / 2 && py > car.row * TILE + 4 && py < car.row * TILE + TILE - 4) {
        triggerLose('撞到了，按 R 重新开始。', car.label);
      }
    }
  }
}

function updateClassic(deltaSeconds) {
  if (!gameOver) {
    elapsedTime += deltaSeconds;
    invincibleTime = Math.max(0, invincibleTime - deltaSeconds);
    updateClassicCars(deltaSeconds);
    updateClassicSniper(deltaSeconds);
    if (!gameOver && player.row === 0) triggerWin();
    updateClassicHud();
  } else {
    if (sniper.shotTimer > 0) sniper.shotTimer -= deltaSeconds;
    updateKillEffect(deltaSeconds);
  }
}

function updateEndless(deltaSeconds) {
  if (!gameOver) {
    if (endlessStartCountdown > 0) {
      endlessStartCountdown = Math.max(0, endlessStartCountdown - deltaSeconds);
      invincibleTime = Math.max(invincibleTime, endlessStartCountdown);
      if (sniper.shotTimer > 0) sniper.shotTimer -= deltaSeconds;
      updateEndlessHud();
      return;
    }

    elapsedTime += deltaSeconds;
    invincibleTime = Math.max(0, invincibleTime - deltaSeconds);
    const scrollSpeed = 1 + Math.floor(elapsedTime / 60) * ENDLESS_SCROLL_GROWTH_PER_MIN;
    const deltaY = scrollSpeed * deltaSeconds * 60;
    endlessScore += ENDLESS_SCORE_PER_SEC * deltaSeconds;
    if (endlessScore > endlessBest) {
      endlessBest = endlessScore;
      localStorage.setItem('crossyEndlessBest', String(endlessBest));
    }

    endlessScrollOffset += deltaY;
    while (endlessScrollOffset >= TILE) {
      endlessScrollOffset -= TILE;
      endlessWorldRowStart += 1;
      rebuildEndlessRows();
    }

    const playerCenter = getPlayerCenter();
    const followFactor = Math.min(0.08, deltaSeconds * 0.8);
    const sway = Math.sin(elapsedTime * 1.8) * 18;
    sniper.x += ((playerCenter.x + sway) - sniper.x) * followFactor;
    sniper.y += (playerCenter.y - sniper.y) * followFactor;
    endlessSniperCooldown -= deltaSeconds;
    if (endlessSniperCooldown <= 0) {
      endlessSniperCooldown = ENDLESS_SNIPE_INTERVAL;
      sniper.shotTimer = 0.22;
      sniper.shotLine = { fromX: sniper.x, fromY: sniper.y, toX: playerCenter.x, toY: playerCenter.y };
      if (invincibleTime <= 0 && Math.hypot(playerCenter.x - sniper.x, playerCenter.y - sniper.y) <= SNIPER_LOCK_DISTANCE) {
        triggerLose('你被狙击手击中了。', 'sniper');
      }
    }

    const playerRect = {
      x: player.col * TILE + 4,
      y: player.row * TILE + 4,
      w: TILE - 8,
      h: TILE - 8
    };

    for (let index = 0; index < endlessRows.length; index++) {
      const row = endlessRows[index];
      const y = getEndlessRowY(index);
      if (y < -TILE || y > canvas.height) continue;
      if (row.type === 'safe') continue;
      for (const seg of row.segments) {
        const x = seg.col * TILE;
        if (invincibleTime <= 0 && playerRect.x < x + TILE && playerRect.x + playerRect.w > x && playerRect.y < y + TILE && playerRect.y + playerRect.h > y) {
          triggerLose('你撞到了障碍物。', seg.label);
          break;
        }
      }
      if (gameOver) break;
      if (row.coin && !row.coin.collected) {
        const coinX = row.coin.col * TILE + 10;
        const coinY = y + 8;
        if (playerRect.x < coinX + 20 && playerRect.x + playerRect.w > coinX && playerRect.y < coinY + 20 && playerRect.y + playerRect.h > coinY) {
          row.coin.collected = true;
          endlessCoins += 1;
        }
      }
    }
    updateEndlessHud();
  } else {
    if (sniper.shotTimer > 0) sniper.shotTimer -= deltaSeconds;
    updateKillEffect(deltaSeconds);
  }
}

function updateKillEffect(deltaSeconds) {
  if (!killEffect || !killEffect.alive) return;
  killEffect.alpha -= 0.9 * deltaSeconds;
  if (killEffect.alpha <= 0) killEffect.alive = false;
}

function drawClassicRows() {
  for (let row = 0; row < ROWS; row++) {
    const y = row * TILE;
    if (classicLaneTypes[row] === 'road') {
      ctx.fillStyle = '#4b5563';
      ctx.fillRect(0, y, canvas.width, TILE);
      ctx.strokeStyle = '#fbbf24';
      ctx.setLineDash([14, 14]);
      ctx.beginPath();
      ctx.moveTo(0, y + TILE / 2);
      ctx.lineTo(canvas.width, y + TILE / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = row === 0 ? '#86efac' : '#65a30d';
      ctx.fillRect(0, y, canvas.width, TILE);
    }
  }
}

function drawEndlessRows() {
  for (let index = 0; index < endlessRows.length; index++) {
    const row = endlessRows[index];
    const y = getEndlessRowY(index);
    if (y < -TILE || y > canvas.height) continue;
    if (row.type === 'safe') {
      ctx.fillStyle = '#9ae66e';
      ctx.fillRect(0, y, canvas.width, TILE);
      continue;
    }
    ctx.fillStyle = '#4b5563';
    ctx.fillRect(0, y, canvas.width, TILE);
    ctx.strokeStyle = '#fbbf24';
    ctx.setLineDash([14, 14]);
    ctx.beginPath();
    ctx.moveTo(0, y + TILE / 2);
    ctx.lineTo(canvas.width, y + TILE / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const seg of row.segments) {
      const x = seg.col * TILE;
      if (seg.image.complete) ctx.drawImage(seg.image, x, y + 1, TILE, TILE - 2);
      else {
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(x + 2, y + 4, TILE - 4, TILE - 8);
      }
    }
    if (row.coin && !row.coin.collected) {
      const coinX = row.coin.col * TILE + 8;
      const coinY = y + 6;
      if (coinImage.complete) ctx.drawImage(coinImage, coinX, coinY, 24, 24);
      else {
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(coinX + 12, coinY + 12, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawPlayer() {
  const x = player.col * TILE + 2;
  const y = player.row * TILE + 1;
  if (playerImage.complete) ctx.drawImage(playerImage, x, y, TILE - 4, TILE - 2);
  else {
    ctx.fillStyle = '#fde047';
    ctx.fillRect(x, y, TILE - 4, TILE - 2);
  }
}

function drawClassicCars() {
  for (const car of cars) {
    const y = car.row * TILE + 1;
    if (car.image.complete) ctx.drawImage(car.image, car.x - car.width / 2, y, car.width, car.height);
    else {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(car.x - car.width / 2, y + 6, car.width, car.height - 12);
    }
  }
}

function drawSniper() {
  if (!sniper || !sniper.spawned) return;
  const pulse = 1 + Math.sin(Date.now() / 120) * 0.15;
  ctx.save();
  ctx.strokeStyle = '#ff4d4f';
  ctx.lineWidth = 4;
  ctx.shadowColor = 'rgba(255, 0, 0, 0.55)';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(sniper.x, sniper.y, 18 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(sniper.x, sniper.y, 7 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(sniper.x - 26, sniper.y);
  ctx.lineTo(sniper.x + 26, sniper.y);
  ctx.moveTo(sniper.x, sniper.y - 26);
  ctx.lineTo(sniper.x, sniper.y + 26);
  ctx.stroke();
  ctx.restore();
  if (sniper.shotLine && sniper.shotTimer > 0) {
    ctx.save();
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sniper.shotLine.fromX, sniper.shotLine.fromY);
    ctx.lineTo(sniper.shotLine.toX, sniper.shotLine.toY);
    ctx.stroke();
    ctx.restore();
  }
}

function drawKillEffect() {
  if (!killEffect || !killEffect.alive) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0, killEffect.alpha);
  if (sniperDeathImage.complete) ctx.drawImage(sniperDeathImage, killEffect.x - killEffect.width / 2, killEffect.y - killEffect.height / 2, killEffect.width, killEffect.height);
  ctx.restore();
}

function drawCountdownOverlay() {
  if (currentMode !== 'endless' || gameOver || endlessStartCountdown <= 0) return;
  const countValue = Math.ceil(endlessStartCountdown);
  const text = countValue > 0 ? String(countValue) : '开始';
  ctx.save();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#9a6700';
  ctx.shadowColor = 'rgba(250, 204, 21, 0.65)';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 8;
  ctx.font = '900 72px Microsoft YaHei, Arial';
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  ctx.font = '900 28px Microsoft YaHei, Arial';
  ctx.lineWidth = 5;
  ctx.strokeText('准备开始', canvas.width / 2, canvas.height / 2 - 70);
  ctx.fillText('准备开始', canvas.width / 2, canvas.height / 2 - 70);
  ctx.restore();
}

function drawResultText() {
  if (!resultText) return;
  ctx.save();
  ctx.textAlign = 'center';
  if (resultStyle === 'win') {
    ctx.fillStyle = '#ffd700';
    ctx.strokeStyle = '#9a6700';
    ctx.shadowColor = 'rgba(255, 215, 0, 0.6)';
  } else {
    ctx.fillStyle = '#b8bcc6';
    ctx.strokeStyle = '#4b5563';
    ctx.shadowColor = 'rgba(107, 114, 128, 0.65)';
  }
  ctx.shadowBlur = 16;
  ctx.font = 'bold 56px Microsoft YaHei, Arial';
  ctx.lineWidth = 6;
  ctx.strokeText(resultText, canvas.width / 2, canvas.height / 2 - 30);
  ctx.fillText(resultText, canvas.width / 2, canvas.height / 2 - 30);
  if (resultSubtitle) {
    ctx.font = currentMode === 'endless' ? 'bold 18px Microsoft YaHei, Arial' : 'bold 28px Microsoft YaHei, Arial';
    ctx.lineWidth = 4;
    const lines = resultSubtitle.split('\n');
    lines.forEach((line, index) => {
      const y = canvas.height / 2 + 12 + index * 24;
      ctx.strokeText(line, canvas.width / 2, y);
      ctx.fillText(line, canvas.width / 2, y);
    });
  }
  ctx.restore();
}

function drawVersionTag() {
  ctx.save();
  ctx.fillStyle = 'rgba(17, 24, 39, 0.72)';
  ctx.fillRect(canvas.width - 110, canvas.height - 34, 98, 22);
  ctx.fillStyle = '#ffffff';
  ctx.font = '14px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`v${BUILD_TAG}`, canvas.width - 18, canvas.height - 18);
  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (currentMode === 'classic') {
    drawClassicRows();
    drawClassicCars();
  } else if (currentMode === 'endless') {
    drawEndlessRows();
  } else {
    return;
  }
  drawPlayer();
  drawSniper();
  drawKillEffect();
  drawCountdownOverlay();
  drawResultText();
  drawVersionTag();
}

function loop(timestamp = 0) {
  const deltaSeconds = Math.min(0.05, (timestamp - lastTime) / 1000 || 0.016);
  lastTime = timestamp;
  if (currentMode === 'classic') updateClassic(deltaSeconds);
  else if (currentMode === 'endless') updateEndless(deltaSeconds);
  render();
  requestAnimationFrame(loop);
}

showModeSelect();
loop();
