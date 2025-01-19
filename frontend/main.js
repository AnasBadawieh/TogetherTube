// frontend/main.js
const socket = io();
let player;
let currentVideoId = null;

function getYouTubeEmbedLink(url) {
    if (!url) {
        console.error('Invalid URL');
        return null;
    }
    const videoId = url.split('v=')[1];
    if (!videoId) {
        console.error('Invalid YouTube URL');
        return null;
    }
    const ampersandPosition = videoId.indexOf('&');
    if (ampersandPosition !== -1) {
        return videoId.substring(0, ampersandPosition);
    }
    return videoId;
}

function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
        height: '390',
        width: '640',
        events: {
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });

    // Fetch video state after player is ready
    fetchVideoState();
}

function onPlayerStateChange(event) {
    const currentTime = player.getCurrentTime();
    if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        saveVideoState(currentVideoId, currentTime, false);
        socket.emit('update-video', { videoId: currentVideoId, currentTime, isPlaying: false });
    } else if (event.data === YT.PlayerState.PLAYING) {
        saveVideoState(currentVideoId, currentTime, true);
        socket.emit('update-video', { videoId: currentVideoId, currentTime, isPlaying: true });
    }
}

function onPlayerError(event) {
    console.error('Error occurred:', event);
}

function saveVideoState(videoId, currentTime, isPlaying) {
    fetch('/api/videoState', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoId, currentTime, isPlaying })
    });
}

function isPlayerReady() {
    return player && typeof player.loadVideoById === 'function';
}

function fetchVideoState(Try = 20) {
    if (isPlayerReady()) {
        fetch('/api/videoState')
            .then(response => response.json())
            .then(data => {
                if (data && data.videoId) {
                    currentVideoId = data.videoId;
                    player.loadVideoById(data.videoId, data.currentTime);
                    if (data.isPlaying) {
                        player.playVideo();
                    } else {
                        player.pauseVideo();
                    }
                } else {
                    console.log('No video data found in the database.');
                }
            })
            .catch(error => {
                console.error('Error fetching video state:', error);
            });
    } else if (Try > 0) {
        setTimeout(() => fetchVideoState(Try - 1), 2000);
    } else {
        console.error('Player is not ready after multiple attempts.');
    }
}

document.getElementById('loadVideo').addEventListener('click', () => {
    const url = document.getElementById('videoUrl').value;
    const videoId = getYouTubeEmbedLink(url);
    if (videoId) {
        currentVideoId = videoId;
        player.loadVideoById(videoId);
        saveVideoState(videoId, 0, true);
        socket.emit('update-video', { videoId, currentTime: 0, isPlaying: true });
    }
});

socket.on('video-state', (data) => {
    if (data.videoId) {
        currentVideoId = data.videoId;
        player.loadVideoById(data.videoId, data.currentTime);
        if (data.isPlaying) {
            player.playVideo();
        } else {
            player.pauseVideo();
        }
    }
});