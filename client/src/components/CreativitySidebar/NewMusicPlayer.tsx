import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Music, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  description: string;
  audioUrl?: string;
  filename?: string;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  color: string;
  tracks: Track[];
  emoji: string;
}

// Initialize with placeholder tracks - will be replaced with uploaded files
const initialPlaylists: Playlist[] = [
  {
    id: "focus",
    name: "Focus Flow",
    description: "Deep concentration music",
    color: "from-blue-500 to-purple-600",
    emoji: "🎯",
    tracks: [
      { id: "f1", title: "Upload your focus music", artist: "Envato Elements", duration: "0:00", description: "Upload MP3 files from Envato Elements for focus music" },
    ]
  },
  {
    id: "creative",
    name: "Creative Flow",
    description: "Boost your creativity",
    color: "from-pink-500 to-orange-500",
    emoji: "🎨",
    tracks: [
      { id: "c1", title: "Upload your creative music", artist: "Envato Elements", duration: "0:00", description: "Upload MP3 files from Envato Elements for creative work" },
    ]
  },
  {
    id: "meditation",
    name: "Meditation",
    description: "Mindfulness and peace",
    color: "from-green-500 to-teal-500",
    emoji: "🧘",
    tracks: [
      { id: "m1", title: "Upload your meditation music", artist: "Envato Elements", duration: "0:00", description: "Upload MP3 files from Envato Elements for meditation" },
    ]
  }
];

export default function NewMusicPlayer() {
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist>(initialPlaylists[0]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([70]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // HTML audio element for playing real audio files
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
      
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0);
      });
      
      audioRef.current.addEventListener('timeupdate', () => {
        setCurrentTime(audioRef.current?.currentTime || 0);
      });
      
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  // Update volume when slider changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100;
    }
  }, [volume]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith('audio/')) {
      alert('Please select a valid audio file (MP3, WAV, etc.)');
      return;
    }

    const audioUrl = URL.createObjectURL(file);
    const trackId = `${selectedPlaylist.id}_${Date.now()}`;
    
    // Create audio element to get duration
    const tempAudio = new Audio(audioUrl);
    tempAudio.addEventListener('loadedmetadata', () => {
      const minutes = Math.floor(tempAudio.duration / 60);
      const seconds = Math.floor(tempAudio.duration % 60);
      const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      
      const newTrack: Track = {
        id: trackId,
        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
        artist: "Envato Elements",
        duration: durationStr,
        description: `Uploaded from ${file.name}`,
        audioUrl: audioUrl,
        filename: file.name
      };

      // Update the playlist with the new track
      const updatedPlaylists = playlists.map(playlist => {
        if (playlist.id === selectedPlaylist.id) {
          const updatedTracks = playlist.tracks.filter(t => !t.title.includes("Upload your"));
          return {
            ...playlist,
            tracks: [...updatedTracks, newTrack]
          };
        }
        return playlist;
      });

      setPlaylists(updatedPlaylists);
      
      // Update selected playlist
      const updatedSelectedPlaylist = updatedPlaylists.find(p => p.id === selectedPlaylist.id);
      if (updatedSelectedPlaylist) {
        setSelectedPlaylist(updatedSelectedPlaylist);
      }
      
      // Auto-select the new track
      setCurrentTrack(newTrack);
    });
  };

  const playTrack = (track: Track) => {
    if (!track.audioUrl || !audioRef.current) return;
    
    audioRef.current.src = track.audioUrl;
    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch(error => {
        console.error('Error playing audio:', error);
        alert('Unable to play this audio file');
      });
  };

  const stopSound = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      stopSound();
    } else {
      if (currentTrack) {
        generateAmbientSound(currentTrack);
      } else {
        // Start with first track
        const firstTrack = selectedPlaylist.tracks[0];
        setCurrentTrack(firstTrack);
        generateAmbientSound(firstTrack);
      }
    }
  };

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
    if (isPlaying) {
      stopSound();
      setTimeout(() => generateAmbientSound(track), 100);
    }
  };

  const handleNext = () => {
    if (!currentTrack) return;
    
    const currentIndex = selectedPlaylist.tracks.findIndex(t => t.id === currentTrack.id);
    const nextIndex = (currentIndex + 1) % selectedPlaylist.tracks.length;
    const nextTrack = selectedPlaylist.tracks[nextIndex];
    
    setCurrentTrack(nextTrack);
    if (isPlaying) {
      stopSound();
      setTimeout(() => generateAmbientSound(nextTrack), 100);
    }
  };

  const handlePrevious = () => {
    if (!currentTrack) return;
    
    const currentIndex = selectedPlaylist.tracks.findIndex(t => t.id === currentTrack.id);
    const prevIndex = currentIndex === 0 ? selectedPlaylist.tracks.length - 1 : currentIndex - 1;
    const prevTrack = selectedPlaylist.tracks[prevIndex];
    
    setCurrentTrack(prevTrack);
    if (isPlaying) {
      stopSound();
      setTimeout(() => generateAmbientSound(prevTrack), 100);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update volume
  useEffect(() => {
    if (gainNodeRef.current && isPlaying) {
      gainNodeRef.current.gain.value = volume[0] / 100 * 0.3;
    }
  }, [volume, isPlaying]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">🎵 Ambient Music Player</h3>
        <p className="text-sm text-gray-600">Enhance your focus with ambient sounds</p>
      </div>

      {/* Playlist Selection */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-700">Select Playlist</h4>
        <div className="grid gap-2">
          {playlists.map((playlist) => (
            <button
              key={playlist.id}
              onClick={() => {
                setSelectedPlaylist(playlist);
                setCurrentTrack(null);
                if (isPlaying) {
                  stopSound();
                }
              }}
              className={`p-3 rounded-lg border text-left transition-all duration-200 ${
                selectedPlaylist.id === playlist.id
                  ? 'border-tickd-primary bg-tickd-primary/10'
                  : 'border-gray-200 hover:border-tickd-primary/50 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-xl">{playlist.emoji}</span>
                <div>
                  <div className="font-medium text-gray-800">{playlist.name}</div>
                  <div className="text-sm text-gray-600">{playlist.description}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Current Track Display */}
      {currentTrack && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center space-x-3 mb-3">
            <div className={`w-12 h-12 rounded-lg bg-gradient-to-r ${selectedPlaylist.color} flex items-center justify-center`}>
              <Music className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="font-medium text-gray-800">{currentTrack.title}</div>
              <div className="text-sm text-gray-600">{currentTrack.artist}</div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">{currentTrack.description}</p>
          
          {/* Controls */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              className="w-10 h-10 rounded-full p-0"
            >
              <SkipBack className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handlePlayPause}
              className={`w-12 h-12 rounded-full p-0 bg-gradient-to-r ${selectedPlaylist.color} hover:opacity-90`}
            >
              {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              className="w-10 h-10 rounded-full p-0"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center space-x-3">
            <Volume2 className="w-4 h-4 text-gray-600" />
            <Slider
              value={volume}
              onValueChange={setVolume}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-sm text-gray-600 w-8">{volume[0]}%</span>
          </div>
        </div>
      )}

      {/* Track List */}
      <div className="space-y-2">
        <h4 className="font-medium text-gray-700">Tracks</h4>
        <div className="space-y-2">
          {selectedPlaylist.tracks.map((track) => (
            <button
              key={track.id}
              onClick={() => handleTrackSelect(track)}
              className={`w-full p-3 rounded-lg border text-left transition-all duration-200 ${
                currentTrack?.id === track.id
                  ? 'border-tickd-primary bg-tickd-primary/10'
                  : 'border-gray-200 hover:border-tickd-primary/50 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-800">{track.title}</div>
                  <div className="text-sm text-gray-600">{track.artist}</div>
                </div>
                <div className="text-sm text-gray-500">{track.duration}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {isPlaying && (
        <div className="text-center text-sm text-tickd-primary font-medium">
          🎵 Now playing ambient sounds...
        </div>
      )}
    </div>
  );
}