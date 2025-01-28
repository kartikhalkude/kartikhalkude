// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.static("public"));

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("New connection:", socket.id);

  socket.on("create-room", (roomId) => {
    if (rooms.has(roomId)) {
      socket.emit("error", "Room already exists");
      return;
    }

    rooms.set(roomId, {
      streamer: socket.id,
      viewers: new Set(),
      created: Date.now()
    });

    socket.join(roomId);
    socket.emit("room-created", roomId);
  });

  socket.on("join-room", (roomId) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit("error", "Room does not exist");
      return;
    }

    socket.join(roomId);
    room.viewers.add(socket.id);
    
    socket.emit("joined-room", roomId);
    io.to(room.streamer).emit("viewer-joined", {
      viewerId: socket.id,
      viewerCount: room.viewers.size
    });
  });

  socket.on("signal", (data) => {
    if (!data || !data.target || !data.message) return;
    io.to(data.target).emit("signal", {
      from: socket.id,
      message: data.message
    });
  });

  socket.on("disconnect", () => {
    rooms.forEach((room, roomId) => {
      if (room.streamer === socket.id) {
        io.to(roomId).emit("stream-ended", "Streamer disconnected");
        rooms.delete(roomId);
      } else if (room.viewers.has(socket.id)) {
        room.viewers.delete(socket.id);
        io.to(room.streamer).emit("viewer-left", {
          viewerId: socket.id,
          viewerCount: room.viewers.size
        });
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});