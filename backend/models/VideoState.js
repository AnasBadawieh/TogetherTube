const mongoose = require('mongoose');

const videoStateSchema = new mongoose.Schema({
    videoId: String,
    currentTime: Number,
    isPlaying: Boolean
});

module.exports = mongoose.model('VideoState', videoStateSchema);