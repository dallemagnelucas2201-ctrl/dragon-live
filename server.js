const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { TikTokLiveConnection, SignConfig } = require('tiktok-live-connector');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Clé gratuite EulerStream pour débloquer TikTok depuis Render
if (SignConfig) {
  SignConfig.apiKey = 'euler_ZWY1NjUxZDZkNTBmYzY3ZDg4MzgzNWY0NzVjOWM1NzE1MTE4MjE1ZDFhMzcyMTc3MzEzMjUw';
}

let tiktokConnection = null;

io.on('connection', (socket) => {
  socket.on('connectTikTok', async (rawUsername) => {
    const username = rawUsername.replace('@', '').trim();
    if (!username) return;

    if (tiktokConnection) {
      try { tiktokConnection.disconnect(); } catch (e) {}
    }

    tiktokConnection = new TikTokLiveConnection(username, {
      processInitialData: false,
      enableExtendedGiftInfo: true,
      requestPollingIntervalMs: 2000
    });

    try {
      const state = await Promise.race([
        tiktokConnection.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Délai dépassé (12s)')), 12000))
      ]);
      socket.emit('status', { ok: true, msg: `Connecté à @${username} (Room ${state.roomId})` });
    } catch (err) {
      socket.emit('status', { ok: false, msg: `Erreur : ${err.message || 'Live introuvable'} pour @${username}` });
      return;
    }

    tiktokConnection.on('chat', (data) => {
      io.emit('chat', {
        userId: data.userId,
        nickname: data.nickname || data.uniqueId,
        comment: data.comment || ''
      });
    });

    tiktokConnection.on('like', (data) => {
      io.emit('like', {
        userId: data.userId,
        nickname: data.nickname || data.uniqueId,
        count: data.likeCount || 1
      });
    });

    tiktokConnection.on('gift', (data) => {
      if (data.giftType === 1 && !data.repeatEnd) return;
      const diamonds = (data.diamondCount || 1) * (data.repeatCount || 1);
      io.emit('gift', {
        userId: data.userId,
        nickname: data.nickname || data.uniqueId,
        giftName: data.giftName || 'Cadeau',
        diamonds: diamonds
      });
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
