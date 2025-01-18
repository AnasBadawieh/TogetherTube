// backend/models/VideoState.js
const mongoose = require('mongoose');

const VideoStateSchema = new mongoose.Schema({
  url: { type: String, required: true },
  timestamp: { type: Number, required: true },
  isPlaying: { type: Boolean, required: true },
});

module.exports = mongoose.model('VideoState', VideoStateSchema);
