import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipForward, SkipBack, Volume2, Shuffle, Repeat, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  url: string;
  category: string;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  color: string;
  tracks: Track[];
  emoji: string;
}

const playlists: Playlist[] = [
  {
    id: "focus",
    name: "Deep Focus",
    description: "Instrumental tracks for concentrated work",
    color: "from-blue-500 to-purple-600",
    emoji: "🎯",
    tracks: [
      { id: "1", title: "Flow State", artist: "Focus Sounds", duration: "4:32", url: "", category: "Instrumental" },
      { id: "2", title: "Concentration", artist: "Brain Waves", duration: "5:15", url: "", category: "Ambient" },
      { id: "3", title: "Deep Work", artist: "Productivity Labs", duration: "6:08", url: "", category: "Electronic" },
    ]
  },
  {
    id: "creative",
    name: "Creative Flow",
    description: "Inspiring melodies for creative tasks",
    color: "from-yellow-500 to-orange-600",
    emoji: "✨",
    tracks: [
      { id: "4", title: "Inspiration", artist: "Creative Minds", duration: "3:45", url: "", category: "Cinematic" },
      { id: "5", title: "Innovation", artist: "Future Sounds", duration: "4:20", url: "", category: "Ambient" },
      { id: "6", title: "Breakthrough", artist: "Vision Music", duration: "5:33", url: "", category: "Electronic" },
    ]
  },
  {
    id: "meditation",
    name: "Meditation",
    description: "Calming sounds for mindfulness",
    color: "from-green-500 to-teal-600",
    emoji: "🧘",
    tracks: [
      { id: "7", title: "Inner Peace", artist: "Zen Masters", duration: "8:00", url: "", category: "Nature" },
      { id: "8", title: "Mindfulness", artist: "Calm Waters", duration: "10:15", url: "", category: "Meditation" },
      { id: "9", title: "Serenity", artist: "Peaceful Mind", duration: "7:30", url: "", category: "Ambient" },
    ]
  },
  {
    id: "energy",
    name: "Energy Boost",
    description: "Upbeat tracks to energize your day",
    color: "from-red-500 to-pink-600",
    emoji: "⚡",
    tracks: [
      { id: "10", title: "Power Up", artist: "Energy Corp", duration: "3:22", url: "", category: "Electronic" },
      { id: "11", title: "Motivation", artist: "Drive Music", duration: "4:10", url: "", category: "Pop" },
      { id: "12", title: "Breakthrough", artist: "Peak Performance", duration: "3:55", url: "", category: "Rock" },
    ]
  }
];

export default function MusicPlayer() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist>(playlists[0]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  
  const audioRef = useRef<HTMLAudioElement>(null);

  const handlePlayPause = () => {
    if (!currentTrack) {
      // Start playing first track of selected playlist
      setCurrentTrack(selectedPlaylist.tracks[0]);
      setIsPlaying(true);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const handleNext = () => {
    if (!currentTrack) return;
    const currentIndex = selectedPlaylist.tracks.findIndex(t => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % selectedPlaylist.tracks.length;
    setCurrentTrack(selectedPlaylist.tracks[nextIndex]);
  };

  const handlePrevious = () => {
    if (!currentTrack) return;
    const currentIndex = selectedPlaylist.tracks.findIndex(t => t.id === currentTrack.id);
    const prevIndex = currentIndex === 0 ? selectedPlaylist.tracks.length - 1 : currentIndex - 1;
    setCurrentTrack(selectedPlaylist.tracks[prevIndex]);
  };

  return (
    <div className="space-y-4">
      {/* Current Playing Track */}
      {currentTrack && (
        <div className="tickd-card p-4 bg-gradient-to-r from-white/80 to-white/60">
          <div className="text-center mb-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-gradient-to-br from-tickd-primary to-tickd-secondary flex items-center justify-center animate-pulse">
              <Music className="w-8 h-8 text-white" />
            </div>
            <h3 className="font-semibold text-sm truncate">{currentTrack.title}</h3>
            <p className="text-xs tickd-light-text">{currentTrack.artist}</p>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={1}
              className="w-full"
              onValueChange={(value) => setCurrentTime(value[0])}
            />
            <div className="flex justify-between text-xs tickd-light-text mt-1">
              <span>0:00</span>
              <span>{currentTrack.duration}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsShuffled(!isShuffled)}
              className={`w-8 h-8 ${isShuffled ? 'tickd-primary' : 'text-gray-500'}`}
            >
              <Shuffle className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrevious}
              className="w-8 h-8 text-gray-700 hover:tickd-primary"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handlePlayPause}
              className="w-12 h-12 rounded-full tickd-bg-primary text-white hover:scale-105 transition-transform"
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="w-8 h-8 text-gray-700 hover:tickd-primary"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRepeatMode(repeatMode === 'none' ? 'all' : repeatMode === 'all' ? 'one' : 'none')}
              className={`w-8 h-8 ${repeatMode !== 'none' ? 'tickd-primary' : 'text-gray-500'}`}
            >
              <Repeat className="w-4 h-4" />
            </Button>
          </div>

          {/* Volume */}
          <div className="flex items-center space-x-2">
            <Volume2 className="w-4 h-4 text-gray-500" />
            <Slider
              value={[volume]}
              max={100}
              step={1}
              className="flex-1"
              onValueChange={(value) => setVolume(value[0])}
            />
          </div>
        </div>
      )}

      {/* Playlist Selection */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700">Choose Your Vibe</h4>
        <div className="grid grid-cols-2 gap-2">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => setSelectedPlaylist(playlist)}
              className={`p-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                selectedPlaylist.id === playlist.id
                  ? `bg-gradient-to-r ${playlist.color} text-white shadow-lg`
                  : 'bg-white/60 text-gray-700 hover:bg-white/80'
              }`}
            >
              <div className="text-lg mb-1">{playlist.emoji}</div>
              <div className="text-xs font-medium">{playlist.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Track List */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-700">{selectedPlaylist.name}</h4>
        <p className="text-xs tickd-light-text">{selectedPlaylist.description}</p>
        
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {selectedPlaylist.tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => handleTrackSelect(track)}
              className={`w-full p-2 rounded-lg text-left transition-all duration-200 hover:bg-white/60 ${
                currentTrack?.id === track.id ? 'bg-white/80 border-l-2 tickd-border-primary' : 'bg-white/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{track.title}</div>
                  <div className="text-xs tickd-light-text truncate">{track.artist}</div>
                </div>
                <div className="text-xs tickd-light-text ml-2">{track.duration}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Note about music */}
      <div className="text-center p-3 bg-white/40 rounded-lg">
        <p className="text-xs tickd-light-text">
          🎵 Music enhances focus and creativity by 40%
        </p>
      </div>
    </div>
  );
}