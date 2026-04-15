const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const timerEl = document.getElementById('timer');
const statusEl = document.getElementById('status');
const difficultyEl = document.getElementById('difficulty');

const COLS = 12;
const ROWS = 16;
const TILE = 40;
const SAFE_ROWS = new Set([0, 1, ROWS - 1]);
const SNIPER_LOCK_DISTANCE = 10;
const BUILD_TAG = '2.2.2';
const SNIPER_DEATH_GIF = 'assets-sniper-death.gif';
const DEFEAT_SFX = 'assets-defeat-sfx.mp3';
const PLAYER_SPRITE = 'assets-player.png';
const LEFT_VEHICLE_SPRITES = ['assets-left-1.png', 'assets-left-2.png', 'assets-left-3.png'];
const RIGHT_VEHICLE_SPRITES = ['assets-right-1.png', 'assets-right-2.png', 'assets-right-3.png'];
const LEFT_VEHICLE_NAMES = ['核弹', '大运', '火箭'];
const RIGHT_VEHICLE_NAMES = ['战斗机', '坦克', 'UFO'];

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

let best = Number(localStorage.getItem('crossyBest') || 0);
let currentDifficulty = difficultyEl.value;
bestEl.textContent = best;

const laneTypes = Array.from({ length: ROWS }, (_, row) => {
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

function getDifficultyConfig() {
  return DIFFICULTIES[currentDifficulty];
}

function getPlayerCenter() {
  return {
    x: player.col * TILE + TILE / 2,
    y: player.row * TILE + TILE / 2
  };
}

function updateHud() {
  scoreEl.textContent = score;
  bestEl.textContent = best;
  timerEl.textContent = `${elapsedTime.toFixed(2)}s`;
}

function randomSpawnPoint() {
  return {
    x: 30 + Math.random() * (canvas.width - 60),
    y: 30 + Math.random() * (canvas.height - 60)
  };
}

function resetGame() {
  const diff = getDifficultyConfig();
  player = { col: Math.floor(COLS / 2), row: ROWS - 1 };
  cars = [];
  score = 0;
  elapsedTime = 0;
  gameOver = false;
  resultText = '';
  resultSubtitle = '';
  killEffect = null;
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
  buildCars();
  updateHud();
}

function buildCars() {
  cars = [];
  const diff = getDifficultyConfig();
  for (let row = 0; row < ROWS; row++) {
    if (laneTypes[row] !== 'road') continue;
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
        spriteIndex: i % 3,
        image: spriteSet[i % 3],
        label: nameSet[i % 3]
      });
    }
  }
}

function playDefeatSound() {
  try {
    defeatAudio.currentTime = 0;
    defeatAudio.play().catch(() => {});
  } catch {}
}

function triggerLose(message, cause = 'sniper') {
  const target = getPlayerCenter();
  gameOver = true;
  resultText = '失败';
  resultSubtitle = DEATH_SUBTITLE_MAP[cause] || '你被创飞了';
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
  const nextCol = Math.max(0, Math.min(COLS - 1, player.col + dx));
  const nextRow = Math.max(0, Math.min(ROWS - 1, player.row + dy));
  if (nextCol === player.col && nextRow === player.row) return;
  player.col = nextCol;
  if (nextRow < player.row) {
    score += 1;
    if (score > best) {
      best = score;
      localStorage.setItem('crossyBest', String(best));
    }
  }
  player.row = nextRow;
  updateHud();
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'arrowup' || key === 'w') movePlayer(0, -1);
  else if (key === 'arrowdown' || key === 's') movePlayer(0, 1);
  else if (key === 'arrowleft' || key === 'a') movePlayer(-1, 0);
  else if (key === 'arrowright' || key === 'd') movePlayer(1, 0);
  else if (key === 'r') resetGame();
});

difficultyEl.addEventListener('change', () => {
  currentDifficulty = difficultyEl.value;
  resetGame();
});

function updateSniper(deltaSeconds) {
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
      if (sniper.aimSeconds === 0) {
        sniper.firing = true;
        sniper.shotTimer = 0.22;
        sniper.shotLine = { fromX: sniper.x, fromY: sniper.y, toX: target.x, toY: target.y };
        triggerLose('炼狱狙击瞬间命中，你已经死亡。按 R 重新开始。', 'sniper');
        return;
      }
      const remaining = Math.max(0, sniper.aimSeconds - sniper.aimTime).toFixed(1);
      statusEl.textContent = `狙击手已锁定，${remaining} 秒后开枪，快躲开！`;
      if (sniper.aimTime >= sniper.aimSeconds) {
        sniper.firing = true;
        sniper.shotTimer = 0.22;
        sniper.shotLine = { fromX: sniper.x, fromY: sniper.y, toX: target.x, toY: target.y };
        triggerLose('你被狙击手击中了，按 R 重新开始。', 'sniper');
      }
    } else {
      sniper.aimTime = 0;
    }
  } else if (sniper.shotTimer > 0) {
    sniper.shotTimer -= deltaSeconds;
  }
}

function updateCars(deltaSeconds) {
  for (const car of cars) {
    car.x += car.speed * car.dir * deltaSeconds * 60;
    if (car.dir > 0 && car.x > canvas.width + 90) car.x = -100;
    if (car.dir < 0 && car.x < -100) car.x = canvas.width + 90;

    if (car.row === player.row) {
      const px = player.col * TILE + TILE / 2;
      const py = player.row * TILE + TILE / 2;
      if (
        px > car.x - car.width / 2 &&
        px < car.x + car.width / 2 &&
        py > car.row * TILE + 4 &&
        py < car.row * TILE + TILE - 4
      ) {
        triggerLose('撞到了，按 R 重新开始。', car.label);
      }
    }
  }
}

function updateKillEffect(deltaSeconds) {
  if (!killEffect || !killEffect.alive) return;
  killEffect.alpha -= 0.9 * deltaSeconds;
  if (killEffect.alpha <= 0) {
    killEffect.alive = false;
  }
}

function update(deltaSeconds) {
  if (!gameOver) {
    elapsedTime += deltaSeconds;
    updateCars(deltaSeconds);
    updateSniper(deltaSeconds);

    if (!gameOver && player.row === 0) {
      triggerWin();
    }

    updateHud();
  } else {
    if (sniper.shotTimer > 0) sniper.shotTimer -= deltaSeconds;
    updateKillEffect(deltaSeconds);
  }
}

function drawRow(row) {
  const y = row * TILE;
  if (laneTypes[row] === 'road') {
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

function drawCars() {
  for (const car of cars) {
    const y = car.row * TILE + 1;
    if (car.image.complete) {
      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(car.image, car.x - car.width / 2, y, car.width, car.height);
      ctx.restore();
    } else {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(car.x - car.width / 2, y + 6, car.width, car.height - 12);
    }
  }
}

function drawPlayer() {
  const x = player.col * TILE + 2;
  const y = player.row * TILE + 1;
  if (playerImage.complete) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(playerImage, x, y, TILE - 4, TILE - 2);
    ctx.restore();
  } else {
    ctx.fillStyle = '#fde047';
    ctx.fillRect(x, y, TILE - 4, TILE - 2);
  }
}

function drawSniper() {
  if (!sniper.spawned) return;

  const pulse = 1 + Math.sin(Date.now() / 120) * 0.15;
  ctx.save();
  ctx.strokeStyle = sniper.aimTime > 0 ? '#ff1f1f' : '#ff4d4f';
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
  if (sniperDeathImage.complete) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sniperDeathImage,
      killEffect.x - killEffect.width / 2,
      killEffect.y - killEffect.height / 2,
      killEffect.width,
      killEffect.height
    );
  } else {
    ctx.fillStyle = 'rgba(255, 230, 120, 0.85)';
    ctx.beginPath();
    ctx.arc(killEffect.x, killEffect.y, 26, 0, Math.PI * 2);
    ctx.fill();
  }
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
  ctx.font = 'bold 64px Microsoft YaHei, Arial';
  ctx.lineWidth = 6;
  ctx.strokeText(resultText, canvas.width / 2, canvas.height / 2 - (resultSubtitle ? 20 : 0));
  ctx.fillText(resultText, canvas.width / 2, canvas.height / 2 - (resultSubtitle ? 20 : 0));

  if (resultSubtitle) {
    ctx.font = 'bold 28px Microsoft YaHei, Arial';
    ctx.lineWidth = 4;
    ctx.strokeText(resultSubtitle, canvas.width / 2, canvas.height / 2 + 24);
    ctx.fillText(resultSubtitle, canvas.width / 2, canvas.height / 2 + 24);
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
  for (let row = 0; row < ROWS; row++) drawRow(row);
  drawCars();
  drawPlayer();
  drawSniper();
  drawKillEffect();
  drawResultText();
  drawVersionTag();
}

function loop(timestamp = 0) {
  const deltaSeconds = Math.min(0.05, (timestamp - lastTime) / 1000 || 0.016);
  lastTime = timestamp;
  update(deltaSeconds);
  render();
  requestAnimationFrame(loop);
}

const initialDiff = getDifficultyConfig();
statusEl.textContent = initialDiff.spawnDelay === 0
  ? `当前难度：${initialDiff.label}。狙击手已在开局出现。当前版本: ${BUILD_TAG}`
  : `当前难度：${initialDiff.label}。狙击手会在 ${initialDiff.spawnDelay} 秒后随机现身。当前版本: ${BUILD_TAG}`;
resetGame();
loop();
