import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, ArrowLeft, Shuffle, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  audioUrl: string;
  albumArt: string;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  gradient: string;
  tracks: Track[];
  coverArt: string;
}

const playlists: Playlist[] = [
  {
    id: "focus",
    name: "Deep Focus",
    description: "Ambient sounds for concentration",
    gradient: "from-blue-600 via-purple-600 to-indigo-800",
    coverArt: "🎯",
    tracks: [
      {
        id: "focus_1",
        title: "Ocean Waves",
        artist: "Nature Sounds",
        duration: "10:00",
        audioUrl: "/audio/focus/ocean-waves.mp3",
        albumArt: "🌊"
      },
      {
        id: "focus_2",
        title: "Forest Rain",
        artist: "Ambient Collective",
        duration: "12:30",
        audioUrl: "/audio/focus/forest-rain.mp3",
        albumArt: "🌲"
      },
      {
        id: "focus_3",
        title: "White Noise",
        artist: "Focus Audio",
        duration: "15:00",
        audioUrl: "/audio/focus/white-noise.mp3",
        albumArt: "⚪"
      },
      {
        id: "focus_4",
        title: "Cafe Ambience",
        artist: "Urban Sounds",
        duration: "8:45",
        audioUrl: "/audio/focus/cafe-ambience.mp3",
        albumArt: "☕"
      }
    ]
  },
  {
    id: "creative",
    name: "Creative Flow",
    description: "Inspiring music for creative work",
    gradient: "from-pink-500 via-rose-500 to-orange-500",
    coverArt: "🎨",
    tracks: [
      {
        id: "creative_1",
        title: "Ambient Synths",
        artist: "Creative Flow",
        duration: "14:20",
        audioUrl: "/audio/creative/ambient-synths.mp3",
        albumArt: "🎹"
      },
      {
        id: "creative_2",
        title: "Gentle Piano",
        artist: "Mindful Music",
        duration: "11:15",
        audioUrl: "/audio/creative/gentle-piano.mp3",
        albumArt: "🎼"
      },
      {
        id: "creative_3",
        title: "Nature Harmony",
        artist: "Organic Audio",
        duration: "13:40",
        audioUrl: "/audio/creative/nature-harmony.mp3",
        albumArt: "🍃"
      },
      {
        id: "creative_4",
        title: "Ethereal Pads",
        artist: "Atmospheric Music",
        duration: "16:30",
        audioUrl: "/audio/creative/ethereal-pads.mp3",
        albumArt: "✨"
      }
    ]
  },
  {
    id: "meditation",
    name: "Mindful Meditation",
    description: "Calming sounds for mindfulness",
    gradient: "from-green-500 via-emerald-500 to-teal-600",
    coverArt: "🧘",
    tracks: [
      {
        id: "meditation_1",
        title: "Tibetan Bowls",
        artist: "Zen Masters",
        duration: "18:00",
        audioUrl: "/audio/meditation/tibetan-bowls.mp3",
        albumArt: "🎭"
      },
      {
        id: "meditation_2",
        title: "Deep Meditation",
        artist: "Inner Peace",
        duration: "20:30",
        audioUrl: "/audio/meditation/deep-meditation.mp3",
        albumArt: "🕯️"
      },
      {
        id: "meditation_3",
        title: "Breath Flow",
        artist: "Mindfulness Audio",
        duration: "9:15",
        audioUrl: "/audio/meditation/breath-flow.mp3",
        albumArt: "💨"
      },
      {
        id: "meditation_4",
        title: "Temple Bells",
        artist: "Sacred Sounds",
        duration: "22:45",
        audioUrl: "/audio/meditation/temple-bells.mp3",
        albumArt: "🔔"
      }
    ]
  }
];

export default function SpotifyStylePlayer() {
  const [view, setView] = useState<'playlists' | 'player'>('playlists');
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState([70]);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0);
      });
      
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      });
      
      audioRef.current.addEventListener('ended', () => {
        handleNext();
      });
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100;
    }
  }, [volume]);

  const playTrack = (track: Track) => {
    if (!audioRef.current) return;
    
    audioRef.current.src = track.audioUrl;
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(error => {
        console.error('Error playing audio:', error);
      });
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setCurrentTrack(playlist.tracks[0]);
    setCurrentTrackIndex(0);
    setView('player');
    
    // Auto-start playing the first track
    setTimeout(() => {
      playTrack(playlist.tracks[0]);
    }, 500);
  };

  const handlePlayPause = () => {
    if (!audioRef.current || !currentTrack) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(error => console.error('Error playing audio:', error));
    }
  };

  const handleNext = () => {
    if (!selectedPlaylist) return;
    
    let nextIndex;
    if (repeatMode === 'one') {
      nextIndex = currentTrackIndex;
    } else if (isShuffled) {
      nextIndex = Math.floor(Math.random() * selectedPlaylist.tracks.length);
    } else {
      nextIndex = currentTrackIndex + 1;
      if (nextIndex >= selectedPlaylist.tracks.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          setIsPlaying(false);
          return;
        }
      }
    }
    
    const nextTrack = selectedPlaylist.tracks[nextIndex];
    setCurrentTrack(nextTrack);
    setCurrentTrackIndex(nextIndex);
    playTrack(nextTrack);
  };

  const handlePrevious = () => {
    if (!selectedPlaylist) return;
    
    let prevIndex;
    if (currentTime > 3) {
      // If more than 3 seconds into the song, restart current track
      audioRef.current!.currentTime = 0;
      return;
    }
    
    if (isShuffled) {
      prevIndex = Math.floor(Math.random() * selectedPlaylist.tracks.length);
    } else {
      prevIndex = currentTrackIndex - 1;
      if (prevIndex < 0) {
        prevIndex = selectedPlaylist.tracks.length - 1;
      }
    }
    
    const prevTrack = selectedPlaylist.tracks[prevIndex];
    setCurrentTrack(prevTrack);
    setCurrentTrackIndex(prevIndex);
    playTrack(prevTrack);
  };

  const handleSeek = (value: number[]) => {
    if (audioRef.current && duration) {
      const newTime = (value[0] / 100) * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleBackToPlaylists = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
    setView('playlists');
  };

  if (view === 'playlists') {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Music for Focus</h3>
        
        <div className="space-y-3">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              onClick={() => handlePlaylistSelect(playlist)}
              className="group cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-lg"
            >
              <div className={`bg-gradient-to-br ${playlist.gradient} p-6 text-white relative`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl mb-2">{playlist.coverArt}</div>
                    <h4 className="font-bold text-lg">{playlist.name}</h4>
                    <p className="text-white/80 text-sm">{playlist.description}</p>
                    <p className="text-white/60 text-xs mt-1">{playlist.tracks.length} tracks</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                      <Play className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-6">
        <Button
          onClick={handleBackToPlaylists}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="font-semibold text-gray-800">{selectedPlaylist?.name}</h3>
          <p className="text-xs text-gray-600">{selectedPlaylist?.description}</p>
        </div>
      </div>

      {/* Album Art and Track Info */}
      {currentTrack && (
        <div className={`bg-gradient-to-br ${selectedPlaylist?.gradient} rounded-2xl p-6 text-white`}>
          <div className="text-center">
            <div className="text-6xl mb-4">{currentTrack.albumArt}</div>
            <h4 className="font-bold text-xl mb-1">{currentTrack.title}</h4>
            <p className="text-white/80">{currentTrack.artist}</p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      <div className="space-y-2">
        <Slider
          value={[duration ? (currentTime / duration) * 100 : 0]}
          onValueChange={handleSeek}
          max={100}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center justify-center gap-4">
        <Button
          onClick={() => setIsShuffled(!isShuffled)}
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${isShuffled ? 'text-tickd-primary' : 'text-gray-400'}`}
        >
          <Shuffle className="h-4 w-4" />
        </Button>
        
        <Button
          onClick={handlePrevious}
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0"
        >
          <SkipBack className="h-5 w-5" />
        </Button>
        
        <Button
          onClick={handlePlayPause}
          className="h-12 w-12 rounded-full bg-tickd-primary hover:bg-tickd-primary/90"
        >
          {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
        </Button>
        
        <Button
          onClick={handleNext}
          variant="ghost"
          size="sm"
          className="h-10 w-10 p-0"
        >
          <SkipForward className="h-5 w-5" />
        </Button>
        
        <Button
          onClick={() => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off')}
          variant="ghost"
          size="sm"
          className={`h-8 w-8 p-0 ${repeatMode !== 'off' ? 'text-tickd-primary' : 'text-gray-400'}`}
        >
          <Repeat className="h-4 w-4" />
          {repeatMode === 'one' && (
            <span className="absolute -top-1 -right-1 text-xs">1</span>
          )}
        </Button>
      </div>

      {/* Volume Control */}
      <div className="flex items-center gap-3">
        <Volume2 className="h-4 w-4 text-gray-400" />
        <Slider
          value={volume}
          onValueChange={setVolume}
          max={100}
          step={1}
          className="flex-1"
        />
      </div>

      {/* Track List */}
      <div className="space-y-2 max-h-48 overflow-y-auto">
        <h5 className="font-medium text-gray-700 text-sm">Up Next</h5>
        {selectedPlaylist?.tracks.map((track, index) => (
          <div
            key={track.id}
            onClick={() => {
              setCurrentTrack(track);
              setCurrentTrackIndex(index);
              playTrack(track);
            }}
            className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
              currentTrack?.id === track.id 
                ? 'bg-tickd-primary/10 border-l-2 border-tickd-primary' 
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="text-lg">{track.albumArt}</div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${
                currentTrack?.id === track.id ? 'text-tickd-primary' : 'text-gray-800'
              }`}>
                {track.title}
              </p>
              <p className="text-xs text-gray-500 truncate">{track.artist}</p>
            </div>
            <span className="text-xs text-gray-400">{track.duration}</span>
          </div>
        ))}
      </div>

      {/* Now Playing Indicator */}
      {isPlaying && (
        <div className="text-center text-sm text-tickd-primary font-medium">
          ♪ Now playing
        </div>
      )}
    </div>
  );
}