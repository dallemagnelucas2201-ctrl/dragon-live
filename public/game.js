const socket = io();
const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
window.addEventListener('resize', resize);
resize();

const BOSSES = [
  { lvl: 'NIVEAU 1', name: 'IGNIS', maxHp: 1000000, main: '#b71c1c', dark: '#7f0000', light: '#ef5350', belly: '#fbc02d', horn: '#fff8e1' },
  { lvl: 'NIVEAU 2', name: 'VERDOR', maxHp: 2500000, main: '#2e7d32', dark: '#1b5e20', light: '#66bb6a', belly: '#dce775', horn: '#f1f8e9' },
  { lvl: 'NIVEAU 3', name: 'ABYSS', maxHp: 5000000, main: '#1565c0', dark: '#0d47a1', light: '#42a5f5', belly: '#80deea', horn: '#e1f5fe' }
];
const LEVEL_COSTS = new Array(0, 100, 300, 800, 2000, 5000, 12000, 30000, 70000, 160000);
const LEVEL_NAMES = ['Paysan', 'Recrue', 'Soldat', 'Chevalier', 'Acier', 'Givre', 'Argent', 'Paladin', 'Champion', 'Roi'];
const LEVEL_COLORS = ['#8d6e63', '#78909c', '#29b6f6', '#26a69a', '#b0bec5', '#80deea', '#eceff1', '#ffd54f', '#ff7043', '#ab47bc'];

let bossIdx = 0, bossHp = 1000000, heartLikes = 0, heartRainTimer = 0, fireBreathTimer = 0, nextFireIn = 35, bossAtkTimer = 3.5;
let players = {}, floatTexts = [], bannerIdx = 0, hitFlash = 0, slotCounter = 0;
const banners = [
  "💬 ÉCRIS « GO » (OU M / F) POUR COMBATTRE !",
  "❤️ 1 LIKE = +1 PV • TES 1K LIKES = +100 DÉGÂTS",
  "🪙 1 PIÈCE = +10 DÉGÂTS • ÉCRIS « LEVEL UP »",
  "🔥 SURVIS AU SOUFFLE DU DRAGON AVEC TES PV !"
];
setInterval(() => { bannerIdx = (bannerIdx + 1) % banners.length; document.getElementById('promo-text').innerText = banners[bannerIdx]; }, 5000);

function connectLive() {
  const user = document.getElementById('tt-user').value.trim();
  if (!user) return;
  document.getElementById('status-msg').innerText = "Connexion en cours...";
  socket.emit('connectTikTok', user);
  if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});
}
socket.on('status', (res) => {
  document.getElementById('status-msg').innerText = res.msg;
  if (res.ok) setTimeout(() => { document.getElementById('setup-modal').style.display = 'none'; }, 1000);
});

function spawnOrGetPlayer(userId, nickname, gender = 'M') {
  if (!players[userId]) {
    const col = slotCounter % 5;
    const row = Math.floor(slotCounter / 5) % 4;
    slotCounter++;
    const homeX = 45 + col * ((canvas.width - 90) / 4);
    const homeY = canvas.height * 0.56 + row * 58;
    players[userId] = {
      id: userId, name: nickname.slice(0, 10), gender, lvl: 0,
      myLikes: 0, bonusDmg: 0, hp: 100, maxHp: 100, gold: 0, totalDmg: 0,
      x: canvas.width / 2, y: canvas.height + 20, homeX, homeY,
      state: 'walk', atkCd: 1 + Math.random() * 2, swing: 0
    };
  }
  return players[userId];
}
function addFloat(text, x, y, color = '#ffd54f') { floatTexts.push({ text, x, y, color, life: 1.0 }); }

function damageBoss(amount, player) {
  const finalDmg = Math.round(amount * (heartRainTimer > 0 ? 2 : 1));
  bossHp -= finalDmg; hitFlash = 0.1;
  if (player) { player.totalDmg += finalDmg; player.gold += finalDmg; player.swing = 0.35; }
  if (bossHp <= 0) {
    bossIdx = (bossIdx + 1) % BOSSES.length;
    bossHp = BOSSES[bossIdx].maxHp;
    document.getElementById('boss-lvl').innerText = BOSSES[bossIdx].lvl;
    document.getElementById('boss-name').innerText = BOSSES[bossIdx].name;
    addFloat("🎉 BOSS VAINCU !", canvas.width / 2, canvas.height * 0.28, '#7dff9b');
  }
}

socket.on('chat', (d) => {
  const txt = d.comment.trim().toUpperCase();
  const p = spawnOrGetPlayer(d.userId, d.nickname, txt === 'F' ? 'F' : 'M');
  if (txt === 'F' || txt === 'M') p.gender = txt;
  if (txt.includes('LEVEL') || txt.includes('UP')) {
    const nextLvl = p.lvl + 1;
    if (nextLvl < LEVEL_COSTS.length && p.gold >= LEVEL_COSTS[nextLvl]) {
      p.gold -= LEVEL_COSTS[nextLvl]; p.lvl = nextLvl;
      p.maxHp += 30; p.hp = p.maxHp;
      addFloat(`⬆️ NIV ${p.lvl} (+30 PV)!`, p.x, p.y - 26, '#7dff9b');
    } else if (nextLvl < LEVEL_COSTS.length) addFloat(`Manque ${LEVEL_COSTS[nextLvl] - p.gold} or`, p.x, p.y - 20, '#ff8a80');
  } else addFloat("⚔️ GO!", p.x, p.y - 20, '#fff');
});

socket.on('like', (d) => {
  const p = spawnOrGetPlayer(d.userId, d.nickname);
  const prevMilestones = Math.floor(p.myLikes / 1000);
  p.myLikes += d.count;
  const newMilestones = Math.floor(p.myLikes / 1000);
  if (newMilestones > prevMilestones) {
    const gained = (newMilestones - prevMilestones) * 100;
    p.bonusDmg += gained;
    addFloat(`🔥 1K LIKES: +${gained} DÉGÂTS!`, p.x, p.y - 32, '#ff4081');
  }
  p.maxHp += d.count;
  p.hp = Math.min(p.maxHp, p.hp + d.count);
  heartLikes += d.count;
  if (heartLikes >= 500) { heartLikes = 0; heartRainTimer = 15; addFloat("💖 PLUIE DE CŒURS (x2) !", canvas.width / 2, canvas.height * 0.22, '#ff4081'); }
});

socket.on('gift', (d) => {
  const p = spawnOrGetPlayer(d.userId, d.nickname);
  p.lvl = Math.min(9, p.lvl + (d.diamonds >= 50 ? 3 : (d.diamonds >= 10 ? 2 : 1)));
  const addedDmg = d.diamonds * 10;
  p.bonusDmg += addedDmg;
  const hpBonus = d.diamonds * 15;
  p.maxHp += hpBonus; p.hp = p.maxHp;
  const burst = d.diamonds * 250;
  damageBoss(burst, p);
  const alertBox = document.getElementById('gift-alert');
  document.getElementById('gift-title').innerText = `🎁 MERCI ${p.name.toUpperCase()} !`;
  document.getElementById('gift-desc').innerText = `${d.giftName} • +${addedDmg} DÉGÂTS/COUP • +${hpBonus} PV !`;
  alertBox.style.display = 'block';
  setTimeout(() => { alertBox.style.display = 'none'; }, 3500);
});

function startDemo() {
  document.getElementById('setup-modal').style.display = 'none';
  const pool = ['Yanis', 'Chloe', 'Sarah', 'Mehdi', 'Lina', 'Theo', 'Ines', 'Max', 'Kylian', 'Emma', 'Nolan', 'Jade', 'Sami', 'Zoe', 'Adam', 'Lou'];
  let idx = 0;
  setInterval(() => {
    if (Object.keys(players).length < 15) {
      const name = pool[idx % pool.length];
      const p = spawnOrGetPlayer('bot' + idx, name, idx % 2 === 0 ? 'M' : 'F');
      p.lvl = idx % 5;
      const likes = (idx % 12) * 8;
      p.myLikes = likes; p.maxHp += likes; p.hp = p.maxHp;
      addFloat("⚔️ GO!", p.x, p.y - 25, '#fff');
      idx++;
    }
    const keys = Object.keys(players);
    if (keys.length) {
      const rp = players[keys[Math.floor(Math.random() * keys.length)]];
      rp.myLikes += 5; rp.maxHp += 5; rp.hp = Math.min(rp.maxHp, rp.hp + 5);
      heartLikes += 20;
      if (heartLikes >= 500) { heartLikes = 0; heartRainTimer = 12; }
    }
  }, 1100);
}
function drawDragon(cx, y, t, boss) {
  const breath = Math.sin(t * 3) * 4;
  const flap = Math.sin(t * 4.5) * 14;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath(); ctx.ellipse(cx, y + 65, 75, 18, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = boss.dark; ctx.lineWidth = 14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(cx + 30, y + 40); ctx.quadraticCurveTo(cx + 95, y + 55, cx + 110 + Math.sin(t * 4) * 10, y + 20); ctx.stroke();
  [-1, 1].forEach(dir => {
    ctx.fillStyle = boss.dark;
    ctx.beginPath();
    ctx.moveTo(cx + dir * 25, y - 10);
    ctx.quadraticCurveTo(cx + dir * 110, y - 75 + flap, cx + dir * 145, y - 25 + flap);
    ctx.lineTo(cx + dir * 115, y + 35 + flap * 0.5);
    ctx.lineTo(cx + dir * 85, y + 15);
    ctx.lineTo(cx + dir * 55, y + 30);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = boss.light; ctx.lineWidth = 2.5; ctx.stroke();
  });
  ctx.fillStyle = hitFlash > 0 ? '#fff' : boss.main;
  ctx.beginPath(); ctx.ellipse(cx, y + 15 + breath * 0.4, 48, 55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = boss.belly;
  ctx.beginPath(); ctx.ellipse(cx, y + 22 + breath * 0.4, 30, 42, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let i = -15; i <= 45; i += 14) { ctx.beginPath(); ctx.moveTo(cx - 22, y + i); ctx.lineTo(cx + 22, y + i); ctx.stroke(); }
  [-1, 1].forEach(dir => {
    ctx.fillStyle = boss.main;
    ctx.beginPath(); ctx.ellipse(cx + dir * 48, y + 18, 16, 12, dir * 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let c = -1; c <= 1; c++) { ctx.beginPath(); ctx.arc(cx + dir * 54, y + 26 + c * 4, 3, 0, Math.PI * 2); ctx.fill(); }
  });
  const hy = y - 38 + breath;
  [-1, 1].forEach(dir => {
    ctx.fillStyle = boss.horn;
    ctx.beginPath(); ctx.moveTo(cx + dir * 16, hy - 18); ctx.lineTo(cx + dir * 36, hy - 48); ctx.lineTo(cx + dir * 8, hy - 22); ctx.fill();
  });
  ctx.fillStyle = hitFlash > 0 ? '#fff' : boss.main;
  ctx.beginPath(); ctx.roundRect(cx - 28, hy - 24, 56, 44, 16); ctx.fill();
  ctx.fillStyle = boss.light;
  ctx.beginPath(); ctx.roundRect(cx - 22, hy - 2, 44, 22, 10); ctx.fill();
  ctx.fillStyle = '#111'; ctx.fillRect(cx - 12, hy + 4, 5, 5); ctx.fillRect(cx + 7, hy + 4, 5, 5);
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath(); ctx.ellipse(cx - 14, hy - 10, 7, 4, 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx + 14, hy - 10, 7, 4, -0.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000'; ctx.fillRect(cx - 15, hy - 13, 2, 6); ctx.fillRect(cx + 13, hy - 13, 2, 6);
  ctx.restore();
}

function drawKnight(p, t) {
  const bob = Math.abs(Math.sin(t * 10 + p.x)) * (p.state === 'charge' ? 5 : 2);
  const col = LEVEL_COLORS[p.lvl] || '#8d6e63';
  ctx.save();
  if (p.myLikes >= 100 || p.bonusDmg > 0) {
    ctx.strokeStyle = p.bonusDmg > 0 ? '#ff4081' : '#ff9800';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 16, 6, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 12, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = p.gender === 'F' ? '#e91e63' : '#b71c1c';
  ctx.beginPath(); ctx.moveTo(p.x - 8, p.y - 6 - bob); ctx.lineTo(p.x - 13, p.y + 10); ctx.lineTo(p.x + 13, p.y + 10); ctx.lineTo(p.x + 8, p.y - 6 - bob); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.roundRect(p.x - 8, p.y - 8 - bob, 16, 18, 4); ctx.fill();
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = p.gender === 'F' ? '#f48fb1' : '#ff5252';
  ctx.beginPath(); ctx.ellipse(p.x, p.y - 19 - bob, 4, 6, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(p.x, p.y - 12 - bob, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.fillRect(p.x - 5, p.y - 13 - bob, 10, 3);
  ctx.fillStyle = '#37474f';
  ctx.beginPath(); ctx.arc(p.x - 9, p.y - bob, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 1.5; ctx.stroke();
  const ang = p.swing > 0 ? -1.1 : -0.2;
  ctx.save(); ctx.translate(p.x + 9, p.y - bob); ctx.rotate(ang);
  ctx.fillStyle = '#eceff1'; ctx.fillRect(-1.5, -16, 3, 16);
  ctx.fillStyle = '#ffd54f'; ctx.fillRect(-4, -2, 8, 2.5);
  ctx.restore();

  // HP Bar above head
  const hpPct = Math.max(0, Math.min(1, p.hp / p.maxHp));
  ctx.fillStyle = '#222'; ctx.fillRect(p.x - 18, p.y - 27 - bob, 36, 4);
  ctx.fillStyle = hpPct > 0.4 ? '#00e676' : '#ff1744';
  ctx.fillRect(p.x - 18, p.y - 27 - bob, 36 * hpPct, 4);

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath(); ctx.roundRect(p.x - 26, p.y - 40 - bob, 52, 11, 4); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 8.5px Arial'; ctx.textAlign = 'center';
  ctx.fillText(p.name, p.x, p.y - 31.5 - bob);
  ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 7.5px Arial';
  ctx.fillText(`❤️${Math.round(p.hp)} ⚔️${Math.round(1 + p.lvl * 2 + p.bonusDmg)}`, p.x, p.y + 22);
  ctx.restore();
}

let lastTime = performance.now();
function loop(now) {
  const dt = (now - lastTime) / 1000; lastTime = now;
  const t = now / 1000;
  if (hitFlash > 0) hitFlash -= dt;
  if (heartRainTimer > 0) heartRainTimer -= dt;

  // Dragon regular counter-attack on knights
  bossAtkTimer -= dt;
  if (bossAtkTimer <= 0) {
    bossAtkTimer = 3.2;
    const ids = Object.keys(players);
    if (ids.length > 0) {
      const targetId = ids[Math.floor(Math.random() * ids.length)];
      const target = players[targetId];
      const bossHit = 18 + bossIdx * 10;
      target.hp -= bossHit;
      addFloat(`💥 -${bossHit} PV`, target.x, target.y - 15, '#ff5252');
      if (target.hp <= 0) {
        addFloat(`💀 ${target.name} K.O!`, target.x, target.y, '#ff1744');
        delete players[targetId];
      }
    }
  }

  // Dragon Fire Breath (massive AoE damage)
  nextFireIn -= dt;
  if (nextFireIn <= 3 && nextFireIn > 0) document.getElementById('fire-warn').style.display = 'block';
   if (nextFireIn <= 0) {
    document.getElementById('fire-warn').style.display = 'none';
    fireBreathTimer = 2.0; nextFireIn = 35;
    Object.keys(players).forEach(id => {
      const p = players[id];
      if (p.lvl < 2) {
        addFloat("🔥 Brûlé (Niv < 2)!", p.x, p.y, '#ff5252');
        delete players[id];
      } else {
        addFloat("🛡️ Survit (Niv 2+)!", p.x, p.y - 10, '#7dff9b');
      }
    });
   }
  
  if (fireBreathTimer > 0) fireBreathTimer -= dt;

  const pList = Object.values(players);
  pList.forEach(p => {
    if (p.swing > 0) p.swing -= dt;
    let tx = p.homeX, ty = p.homeY, spd = 120;
    if (p.state === 'charge') { tx = canvas.width / 2 + (p.homeX - canvas.width / 2) * 0.35; ty = canvas.height * 0.34; spd = 280; }
    const dx = tx - p.x, dy = ty - p.y, dist = Math.hypot(dx, dy);
    if (dist > 4) { p.x += (dx / dist) * spd * dt; p.y += (dy / dist) * spd * dt; }
    else if (p.state === 'charge') {
      const dmg = 1 + p.lvl * 2 + p.bonusDmg;
      damageBoss(dmg, p);
      addFloat(`-${Math.round(dmg)}`, p.x, p.y - 20, '#ffd54f');
      p.state = 'walk';
    }
    p.atkCd -= dt;
    if (p.atkCd <= 0 && p.state === 'walk') { p.atkCd = 1.8 + Math.random() * 1.4; p.state = 'charge'; }
  });

  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#231934'); bgGrad.addColorStop(0.45, '#352847'); bgGrad.addColorStop(1, '#272033');
  ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  for (let gx = 0; gx < canvas.width; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, canvas.height * 0.42); ctx.lineTo(gx, canvas.height); ctx.stroke(); }
  for (let gy = canvas.height * 0.42; gy < canvas.height; gy += 35) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(canvas.width, gy); ctx.stroke(); }

  const gateY = canvas.height * 0.46;
  ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(15, gateY); ctx.lineTo(canvas.width - 15, gateY); ctx.stroke();
  for (let bx = 25; bx < canvas.width - 20; bx += 22) {
    ctx.fillStyle = '#ffd54f'; ctx.fillRect(bx - 2, gateY - 12, 4, 24);
  }
  ctx.strokeStyle = 'rgba(255, 193, 7, 0.3)'; ctx.lineWidth = 2;
  for (let i = 1; i <= 2; i++) { const y = gateY + i * (canvas.height * 0.17); ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(canvas.width - 20, y); ctx.stroke(); }

  drawDragon(canvas.width / 2, canvas.height * 0.23, t, BOSSES[bossIdx]);

  if (fireBreathTimer > 0) {
    const grad = ctx.createLinearGradient(canvas.width / 2, canvas.height * 0.23, canvas.width / 2, canvas.height);
    grad.addColorStop(0, 'rgba(255, 87, 34, 0.92)'); grad.addColorStop(1, 'rgba(255, 193, 7, 0.1)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(canvas.width / 2 - 22, canvas.height * 0.23); ctx.lineTo(20, canvas.height); ctx.lineTo(canvas.width - 20, canvas.height); ctx.lineTo(canvas.width / 2 + 22, canvas.height * 0.23); ctx.fill();
  }

  pList.sort((a, b) => a.y - b.y).forEach(p => drawKnight(p, t));

  floatTexts.forEach(ft => { ft.y -= 26 * dt; ft.life -= dt; ctx.globalAlpha = Math.max(0, ft.life); ctx.fillStyle = ft.color; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y); ctx.globalAlpha = 1; });
  floatTexts = floatTexts.filter(ft => ft.life > 0);

  document.getElementById('queue-count').innerText = pList.length;
  document.getElementById('hp-fill').style.width = Math.max(0, (bossHp / BOSSES[bossIdx].maxHp) * 100) + '%';
  document.getElementById('hp-text').innerText = `${Math.max(0, Math.round(bossHp)).toLocaleString('fr-FR')} / ${BOSSES[bossIdx].maxHp.toLocaleString('fr-FR')} PV`;
  document.getElementById('heart-fill').style.width = Math.min(100, (heartLikes / 500) * 100) + '%';
  document.getElementById('heart-text').innerText = heartRainTimer > 0 ? `💖 PLUIE DE CŒURS (${Math.ceil(heartRainTimer)}s) !` : `❤️ ${heartLikes} / 500 • PLUIE DE CŒURS`;

const byDmg = [...pList].sort((a, b) => b.totalDmg - a.totalDmg).slice(0, 3);
document.getElementById('top-dmg').innerHTML = byDmg.map((p, i) => <div class="board-row"><span>${i + 1}. ${p.name}</span><b>${Math.round(p.totalDmg)}</b></div>).join('') || 'En attente...';
const byGold = [...pList].sort((a, b) => b.gold - a.gold).slice(0, 3);
document.getElementById('top-gold').innerHTML = byGold.map((p, i) => <div class="board-row"><span>${i + 1}. Niv${p.lvl} ${p.name}</span><b>${Math.round(p.gold)}🪙</b></div>).join('') || 'En attente...';
requestAnimationFrame(loop);
}
requestAnimationFrame(loop);         
