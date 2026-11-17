const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let tiktokConnection = null;

io.on('connection', (socket) => {
    socket.on('connectTikTok', (username) => {
        if (!username) return;
        const cleanUser = username.replace('@', '').trim();
        
        if (tiktokConnection) {
            try { tiktokConnection.disconnect(); } catch (e) {}
        }

        tiktokConnection = new WebcastPushConnection(cleanUser, {
            processInitialData: false,
            enableExtendedGiftInfo: true
        });

        tiktokConnection.connect()
            .then(() => {
                io.emit('status', { ok: true, msg: 'Connecté à @' + cleanUser });
            })
            .catch((err) => {
                io.emit('status', { ok: false, msg: 'Erreur : Live introuvable pour @' + cleanUser });
            });

        tiktokConnection.on('chat', (data) => {
            io.emit('chat', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                comment: data.comment || ''
            });
        });

        tiktokConnection.on('like', (data) => {
            io.emit('like', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                count: data.likeCount || 1
            });
        });

        tiktokConnection.on('gift', (data) => {
            if (data.giftType === 1 && !data.repeatEnd) return;
            const diamonds = (data.diamondCount || 1) * (data.repeatCount || 1);
            io.emit('gift', {
                userId: data.uniqueId,
                nickname: data.nickname || data.uniqueId,
                giftName: data.giftName || 'Cadeau',
                diamonds: diamonds
            });
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log('Serveur prêt sur le port ' + PORT));
                  
