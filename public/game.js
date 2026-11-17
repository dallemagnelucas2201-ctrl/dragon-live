const socket = io();
const canvas = document.getElementById('arena');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = canvas.clientWidth; canvas.height = canvas.clientHeight; }
window.addEventListener('resize', resize);
resize();

const BOSSES = [
  { lvl: 'NIVEAU 1', name: 'IGNIS', maxHp: 1000000, color: '#c62828', belly: '#fbc02d' },
  { lvl: 'NIVEAU 2', name: 'VERDOR', maxHp: 2500000, color: '#2e7d32', belly: '#aed581' },
  { lvl: 'NIVEAU 3', name: 'ABYSS', maxHp: 5000000, color: '#283593', belly: '#81d4fa' }
];
const LEVEL_COSTS = new Array(0, 100, 300, 800, 2000, 5000, 12000, 30000, 70000, 160000);
const LEVEL_NAMES = new Array('Paysan', 'Recrue', 'Soldat', 'Chevalier', 'Acier', 'Givre', 'Argent', 'Paladin', 'Champion', 'Roi');
const LEVEL_COLORS = new Array('#9e9e9e', '#8d6e63', '#42a5f5', '#26a69a', '#78909c', '#80deea', '#e0e0e0', '#ffd54f', '#ff7043', '#ab47bc');

let bossIdx = 0, bossHp = 1000000, heartLikes = 0, heartRainTimer = 0, fireBreathTimer = 0, nextFireIn = 45;
let players = {}, floatTexts = [], bannerIdx = 0;
const banners = new Array(
  "💬 ÉCRIS « GO » (OU M / F) POUR COMBATTRE !",
  "❤️ LIKE L'ÉCRAN = AURA DE PUISSANCE (+1 DÉGÂT)",
  "🪙 TES DÉGÂTS = OR • ÉCRIS « LEVEL UP »",
  "🎁 CADEAU = NIVEAU OFFERT + GROS DÉGÂTS"
);
setInterval(() => { bannerIdx = (bannerIdx + 1) % banners.length; document.getElementById('promo-text').innerText = banners.at(bannerIdx); }, 5000);

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
    players[userId] = {
      id: userId, name: nickname.slice(0, 11), gender, lvl: 0, aura: 1, gold: 0, totalDmg: 0,
      x: 40 + Math.random() * (canvas.width - 80),
      y: canvas.height * 0.52 + Math.random() * (canvas.height * 0.36),
      atkCd: Math.random()
    };
  }
  return players[userId];
}
function addFloat(text, x, y, color = '#ffd54f') { floatTexts.push({ text, x, y, color, life: 1.0 }); }

function damageBoss(amount, player) {
  const finalDmg = Math.round(amount * (heartRainTimer > 0 ? 2 : 1));
  bossHp -= finalDmg;
  if (player) { player.totalDmg += finalDmg; player.gold += finalDmg; }
  if (bossHp <= 0) {
    bossIdx = (bossIdx + 1) % BOSSES.length;
    bossHp = BOSSES.at(bossIdx).maxHp;
    document.getElementById('boss-lvl').innerText = BOSSES.at(bossIdx).lvl;
    document.getElementById('boss-name').innerText = BOSSES.at(bossIdx).name;
    addFloat("🎉 BOSS VAINCU !", canvas.width / 2, canvas.height * 0.3, '#7dff9b');
  }
}

socket.on('chat', (d) => {
  const txt = d.comment.trim().toUpperCase();
  const p = spawnOrGetPlayer(d.userId, d.nickname, txt === 'F' ? 'F' : 'M');
  if (txt === 'F' || txt === 'M') p.gender = txt;
  if (txt.includes('LEVEL') || txt.includes('UP')) {
    const nextLvl = p.lvl + 1;
    if (nextLvl < LEVEL_COSTS.length && p.gold >= LEVEL_COSTS.at(nextLvl)) {
      p.gold -= LEVEL_COSTS.at(nextLvl); p.lvl = nextLvl;
      addFloat(`⬆️ NIV ${p.lvl} ${LEVEL_NAMES.at(p.lvl)}!`, p.x, p.y - 20, '#7dff9b');
    } else if (nextLvl < LEVEL_COSTS.length) addFloat(`Manque ${LEVEL_COSTS.at(nextLvl) - p.gold} or`, p.x, p.y - 15, '#ff8a80');
  } else addFloat("⚔️ GO!", p.x, p.y - 15, '#fff');
});

socket.on('like', (d) => {
  const p = spawnOrGetPlayer(d.userId, d.nickname);
  p.aura += d.count; heartLikes += d.count;
  if (heartLikes >= 500) { heartLikes = 0; heartRainTimer = 15; addFloat("💖 PLUIE DE CŒURS (x2) !", canvas.width / 2, canvas.height * 0.25, '#ff4081'); }
});

socket.on('gift', (d) => {
  const p = spawnOrGetPlayer(d.userId, d.nickname);
  p.lvl = Math.min(9, p.lvl + (d.diamonds >= 50 ? 3 : (d.diamonds >= 10 ? 2 : 1)));
  p.aura += d.diamonds * 5;
  const burst = d.diamonds * 250;
  damageBoss(burst, p);
  const alertBox = document.getElementById('gift-alert');
  document.getElementById('gift-title').innerText = `🎁 MERCI ${p.name.toUpperCase()} !`;
  document.getElementById('gift-desc').innerText = `${d.giftName} • Niv ${p.lvl} (${LEVEL_NAMES.at(p.lvl)}) • -${burst} PV !`;
  alertBox.style.display = 'block';
  setTimeout(() => { alertBox.style.display = 'none'; }, 3500);
});

function startDemo() {
  document.getElementById('setup-modal').style.display = 'none';
  ['Yanis', 'Chloe', 'Sarah', 'Mehdi', 'Lina', 'Theo', 'Ines', 'Max'].forEach((n, i) => {
    const p = spawnOrGetPlayer('bot' + i, n, i % 2 === 0 ? 'M' : 'F');
    p.lvl = i % 5; p.aura = 2 + i * 3;
  });
  setInterval(() => {
    const keys = Object.keys(players);
    if (!keys.length) return;
    players[keys.at(Math.floor(Math.random() * keys.length))].aura += 2;
    heartLikes += 15;
    if (heartLikes >= 500) { heartLikes = 0; heartRainTimer = 12; }
  }, 800);
}

let lastTime = performance.now();
function loop(now) {
  const dt = (now - lastTime) / 1000; lastTime = now;
  if (heartRainTimer > 0) heartRainTimer -= dt;
  nextFireIn -= dt;
  if (nextFireIn <= 3 && nextFireIn > 0) document.getElementById('fire-warn').style.display = 'block';
  if (nextFireIn <= 0) {
    document.getElementById('fire-warn').style.display = 'none';
    fireBreathTimer = 2.0; nextFireIn = 45;
    Object.keys(players).forEach(id => {
      if (players[id].aura < 3 && players[id].lvl === 0) { addFloat("💀 Brûlé!", players[id].x, players[id].y, '#ff5252'); delete players[id]; }
    });
  }
  if (fireBreathTimer > 0) fireBreathTimer -= dt;

  const pList = Object.values(players);
  pList.forEach(p => {
    p.atkCd -= dt;
    if (p.atkCd <= 0) {
      p.atkCd = 1.0;
      const dmg = (1 + p.lvl * 2) * (1 + p.aura * 0.1);
      damageBoss(dmg, p);
      if (Math.random() < 0.35) addFloat(`-${dmg.toFixed(1)}`, canvas.width * 0.35 + Math.random() * (canvas.width * 0.3), canvas.height * 0.25 + Math.random() * 40, '#ffd54f');
    }
  });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width / 2, dragonY = canvas.height * 0.24, boss = BOSSES.at(bossIdx);
  ctx.fillStyle = boss.color;
  ctx.beginPath(); ctx.moveTo(cx, dragonY); ctx.lineTo(cx - 140, dragonY - 60); ctx.lineTo(cx - 120, dragonY + 50); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx, dragonY); ctx.lineTo(cx + 140, dragonY - 60); ctx.lineTo(cx + 120, dragonY + 50); ctx.fill();
  ctx.beginPath(); ctx.roundRect(cx - 55, dragonY - 30, 110, 120, 25); ctx.fill();
  ctx.fillStyle = boss.belly; ctx.beginPath(); ctx.roundRect(cx - 32, dragonY - 5, 64, 85, 15); ctx.fill();
  ctx.fillStyle = '#ffeb3b'; ctx.fillRect(cx - 28, dragonY - 45, 16, 10); ctx.fillRect(cx + 12, dragonY - 45, 16, 10);

  if (fireBreathTimer > 0) {
    const grad = ctx.createLinearGradient(cx, dragonY, cx, canvas.height);
    grad.addColorStop(0, 'rgba(255, 87, 34, 0.9)'); grad.addColorStop(1, 'rgba(255, 193, 7, 0.1)');
    ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(cx - 20, dragonY); ctx.lineTo(cx - 130, canvas.height); ctx.lineTo(cx + 130, canvas.height); ctx.lineTo(cx + 20, dragonY); ctx.fill();
  }

  ctx.strokeStyle = 'rgba(255, 193, 7, 0.25)'; ctx.lineWidth = 2;
  for (let i = 1; i <= 3; i++) { const y = canvas.height * (0.50 + i * 0.13); ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(canvas.width - 20, y); ctx.stroke(); }

  pList.forEach(p => {
    if (p.aura >= 5) { ctx.fillStyle = 'rgba(255, 213, 79, 0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, 18, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = LEVEL_COLORS.at(p.lvl) || '#9e9e9e'; ctx.beginPath(); ctx.roundRect(p.x - 10, p.y - 12, 20, 24, 5); ctx.fill();
    ctx.fillStyle = '#111'; ctx.fillRect(p.x - 6, p.y - 7, 12, 4);
    ctx.fillStyle = '#eceff1'; ctx.fillRect(p.x + 11, p.y - 14, 3, 18);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center'; ctx.fillText(p.name, p.x, p.y - 16);
    ctx.fillStyle = '#ffd54f'; ctx.font = '8px Arial'; ctx.fillText(`Niv${p.lvl} ⚡${p.aura}`, p.x, p.y + 21);
  });

  floatTexts.forEach(ft => { ft.y -= 25 * dt; ft.life -= dt; ctx.globalAlpha = Math.max(0, ft.life); ctx.fillStyle = ft.color; ctx.font = 'bold 13px Arial'; ctx.textAlign = 'center'; ctx.fillText(ft.text, ft.x, ft.y); ctx.globalAlpha = 1; });
  floatTexts = floatTexts.filter(ft => ft.life > 0);

  document.getElementById('queue-count').innerText = pList.length;
  document.getElementById('hp-fill').style.width = Math.max(0, (bossHp / boss.maxHp) * 100) + '%';
  document.getElementById('hp-text').innerText = `${Math.max(0, Math.round(bossHp)).toLocaleString('fr-FR')} / ${boss.maxHp.toLocaleString('fr-FR')} PV`;
  document.getElementById('heart-fill').style.width = Math.min(100, (heartLikes / 500) * 100) + '%';
  document.getElementById('heart-text').innerText = heartRainTimer > 0 ? `💖 PLUIE DE CŒURS (${Math.ceil(heartRainTimer)}s) !` : `❤️ ${heartLikes} / 500 • PLUIE DE CŒURS`;

  const byDmg = [...pList].sort((a, b) => b.totalDmg - a.totalDmg).slice(0, 3);
  document.getElementById('top-dmg').innerHTML = byDmg.map((p, i) => `<div class="board-row"><span>${i + 1}. ${p.name}</span><b>${Math.round(p.totalDmg)}</b></div>`).join('') || '<div class="board-row"><span>En attente...</span></div>';
  const byGold = [...pList].sort((a, b) => b.gold - a.gold).slice(0, 3);
  document.getElementById('top-gold').innerHTML = byGold.map((p, i) => `<div class="board-row"><span>${i + 1}. Niv${p.lvl} ${p.name}</span><b>${Math.round(p.gold)}🪙</b></div>`).join('') || '<div class="board-row"><span>En attente...</span></div>';

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
      
