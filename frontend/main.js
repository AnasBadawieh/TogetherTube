// frontend/main.js
const socket = io();
let player;

function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    events: {
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
}

function onPlayerStateChange(event) {
  // Handle player state changes if needed
}

function onPlayerError(event) {
  console.error('YouTube Player Error:', event);
}

document.getElementById('loadVideo').addEventListener('click', () => {
  const url = document.getElementById('videoUrl').value;
  const embedLink = getYouTubeEmbedLink(url);
  console.log(embedLink);

  if (embedLink.startsWith('https://www.youtube.com/embed/')) {
    const videoId = embedLink.split('/embed/')[1];
    if (player && typeof player.loadVideoById === 'function') {
      player.loadVideoById(videoId);
      socket.emit('update-video', { url: embedLink, timestamp: 0, isPlaying: true });
    } else {
      console.error('YouTube Player is not initialized');
    }
  } else {
    console.error(embedLink); // Log the error message from getYouTubeEmbedLink
  }
});

socket.on('video-state', (data) => {
  if (data.url) {
    const videoId = new URL(data.url).searchParams.get('v');
    if (player && typeof player.loadVideoById === 'function') {
      player.loadVideoById(videoId, data.timestamp);
      if (data.isPlaying) {
        player.playVideo();
      } else {
        player.pauseVideo();
      }
    }
  }
});
