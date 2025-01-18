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
}

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
        const currentTime = player.getCurrentTime();
        saveVideoState(currentVideoId, currentTime);
    }
}

function onPlayerError(event) {
    console.error('Error occurred:', event);
}

document.getElementById('loadVideo').addEventListener('click', () => {
    const url = document.getElementById('videoUrl').value;
    const videoId = getYouTubeEmbedLink(url);
    if (videoId) {
        currentVideoId = videoId;
        player.loadVideoById(videoId);
        saveVideoState(videoId, 0);
    }
});

function saveVideoState(videoId, currentTime) {
    fetch('/api/videoState', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ videoId, currentTime })
    });
}

window.onload = () => {
    fetch('/api/videoState')
        .then(response => response.json())
        .then(data => {
            if (data && data.videoId) {
                currentVideoId = data.videoId;
                player.loadVideoById(data.videoId, data.currentTime);
            } else {
                console.log('No video data found in the database.');
            }
        })
        .catch(error => {
            console.error('Error fetching video state:', error);
        });
};

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
