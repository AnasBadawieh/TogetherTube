// backend/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const VideoState = require('./models/VideoState');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB connection error:', err));

// Master state in server
let masterState = {
  videoId: null,
  isPlaying: false,
  lastKnownTime: 0,    // the time in the video where we last started playing
  startWallClock: 0    // the Date.now() when we started playing
};

// Helper: calculates current time based on server clock
function getCurrentTime() {
  if (!masterState.isPlaying) return masterState.lastKnownTime;
  const elapsed = (Date.now() - masterState.startWallClock) / 1000;
  return masterState.lastKnownTime + elapsed;
}

io.on('connection', (socket) => {
  // Send initial state so new clients can sync
  socket.emit('initState', {
    videoId: masterState.videoId,
    isPlaying: masterState.isPlaying,
    currentTime: getCurrentTime()
  });

  // Handle play event
  socket.on('playVideo', async (data) => {
    // Example data: { videoId, startTime }
    masterState.videoId = data.videoId;
    masterState.lastKnownTime = data.startTime; 
    masterState.startWallClock = Date.now();
    masterState.isPlaying = true;

    // Save to DB (optional)
    await VideoState.findOneAndUpdate(
      {},
      {
        videoId: masterState.videoId,
        currentTime: masterState.lastKnownTime,
        isPlaying: masterState.isPlaying
      },
      { upsert: true }
    );

    // Broadcast
    io.emit('playEvent', {
      videoId: masterState.videoId,
      startTime: masterState.lastKnownTime,
      serverWallClock: masterState.startWallClock
    });
  });

  // Handle pause
  socket.on('pauseVideo', async () => {
    // Update lastKnownTime based on how long it played
    const current = getCurrentTime();
    masterState.lastKnownTime = current;
    masterState.isPlaying = false;

    await VideoState.findOneAndUpdate(
      {},
      {
        videoId: masterState.videoId,
        currentTime: masterState.lastKnownTime,
        isPlaying: masterState.isPlaying
      },
      { upsert: true }
    );

    // Broadcast pause
    io.emit('pauseEvent', {
      videoId: masterState.videoId,
      lastKnownTime: masterState.lastKnownTime
    });
  });

  // Handle seek
  socket.on('seekVideo', async (data) => {
    // Example data: { newTime }
    masterState.lastKnownTime = data.newTime;
    masterState.startWallClock = Date.now(); // if still playing, it starts from newTime
    if (masterState.isPlaying) {
      // If still playing, we effectively "play" from the new time
      io.emit('seekEvent', {
        videoId: masterState.videoId,
        newTime: masterState.lastKnownTime,
        serverWallClock: masterState.startWallClock
      });
    } else {
      // If paused, just store the new time
      io.emit('seekEvent', { 
        videoId: masterState.videoId, 
        newTime: masterState.lastKnownTime 
      });
    }

    await VideoState.findOneAndUpdate(
      {},
      {
        videoId: masterState.videoId,
        currentTime: masterState.lastKnownTime,
        isPlaying: masterState.isPlaying
      },
      { upsert: true }
    );
  });
});

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

server.listen(3000, () => {
  console.log('Server running on port 3000');
});
