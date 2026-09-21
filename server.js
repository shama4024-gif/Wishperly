const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.json());

// Serve index.html and static assets directly from current directory
app.use(express.static(__dirname));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Real-Time Ephemeral Matchmaking Queue
let waitingUser = null;

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  socket.on('join-waiting-room', ({ identity }) => {
    socket.identity = identity || 'Anonymous Star';

    if (waitingUser && waitingUser.id !== socket.id) {
      // Pair users together
      const roomId = `room_${waitingUser.id}_${socket.id}`;
      const partner = waitingUser;
      waitingUser = null;

      socket.join(roomId);
      partner.join(roomId);

      socket.roomId = roomId;
      partner.roomId = roomId;

      io.to(roomId).emit('match-found', {
        roomId,
        peers: [
          { id: partner.id, identity: partner.identity },
          { id: socket.id, identity: socket.identity }
        ]
      });
    } else {
      waitingUser = socket;
    }
  });

  socket.on('send-encrypted-payload', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('receive-encrypted-payload', data);
    }
  });

  socket.on('typing', (data) => {
    if (socket.roomId) {
      socket.to(socket.roomId).emit('peer-typing', data);
    }
  });

  socket.on('disconnect', () => {
    if (waitingUser && waitingUser.id === socket.id) {
      waitingUser = null;
    }
    if (socket.roomId) {
      socket.to(socket.roomId).emit('peer-left');
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`✨ Whisperly Server running on http://localhost:${PORT}`);
});
