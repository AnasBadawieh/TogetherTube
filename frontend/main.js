// frontend/main.js
const socket = io();
let player;

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    events: {
      onStateChange: onPlayerStateChange,
    },
  });
}

document.getElementById('loadVideo').addEventListener('click', () => {
  const url = document.getElementById('videoUrl').value;
  const videoId = new URL(url).searchParams.get('v');
  player.loadVideoById(videoId);
  socket.emit('update-video', { url, timestamp: 0, isPlaying: true });
});

socket.on('video-state', (data) => {
  if (data.url) {
    const videoId = new URL(data.url).searchParams.get('v');
    player.loadVideoById(videoId, data.timestamp);
    data.isPlaying ? player.playVideo() : player.pauseVideo();
  }
});

function onPlayerStateChange(event) {
  const isPlaying = event.data === YT.PlayerState.PLAYING;
  socket.emit('update-video', {
    url: player.getVideoUrl(),
    timestamp: player.getCurrentTime(),
    isPlaying,
  });
}
