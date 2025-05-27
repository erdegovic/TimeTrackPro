import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  description: string;
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
    name: "Focus Flow",
    description: "Deep concentration music",
    color: "from-blue-500 to-purple-600",
    emoji: "🎯",
    tracks: [
      { id: "f1", title: "Ocean Waves", artist: "Nature Sounds", duration: "∞", description: "Calming ocean waves for deep focus" },
      { id: "f2", title: "Rain Forest", artist: "Nature Sounds", duration: "∞", description: "Gentle rainforest ambience" },
      { id: "f3", title: "White Noise", artist: "Focus Audio", duration: "∞", description: "Pure white noise for concentration" },
    ]
  },
  {
    id: "creative",
    name: "Creative Flow",
    description: "Boost your creativity",
    color: "from-pink-500 to-orange-500",
    emoji: "🎨",
    tracks: [
      { id: "c1", title: "Melodic Waves", artist: "Ambient Studio", duration: "∞", description: "Inspiring melodic patterns" },
      { id: "c2", title: "Peaceful Piano", artist: "Calm Music", duration: "∞", description: "Gentle piano melodies" },
      { id: "c3", title: "Soft Strings", artist: "Relaxation", duration: "∞", description: "Soothing string arrangements" },
    ]
  },
  {
    id: "meditation",
    name: "Meditation",
    description: "Mindfulness and peace",
    color: "from-green-500 to-teal-500",
    emoji: "🧘",
    tracks: [
      { id: "m1", title: "Breathing Guide", artist: "Mindfulness", duration: "∞", description: "Guided breathing exercise" },
      { id: "m2", title: "Tibetan Bowls", artist: "Meditation", duration: "∞", description: "Traditional singing bowls" },
      { id: "m3", title: "Forest Sounds", artist: "Nature", duration: "∞", description: "Deep forest ambience" },
    ]
  }
];

export default function NewMusicPlayer() {
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist>(playlists[0]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([70]);

  // Audio context for generating ambient sounds
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
  };

  const generateAmbientSound = (track: Track) => {
    initAudio();
    
    if (!audioContextRef.current || !gainNodeRef.current) return;

    // Stop current sound
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
    }

    // Create new oscillator based on track type
    oscillatorRef.current = audioContextRef.current.createOscillator();
    const gainNode = gainNodeRef.current;
    
    // Set volume
    gainNode.gain.value = volume[0] / 100 * 0.3;
    
    // Configure sound based on track
    if (track.id.includes("ocean") || track.title.includes("Ocean")) {
      // Ocean waves - low frequency with modulation
      oscillatorRef.current.type = 'sawtooth';
      oscillatorRef.current.frequency.value = 60 + Math.random() * 40;
      
      // Add wave-like modulation
      const lfo = audioContextRef.current.createOscillator();
      const lfoGain = audioContextRef.current.createGain();
      lfo.frequency.value = 0.3;
      lfoGain.gain.value = 15;
      
      lfo.connect(lfoGain);
      lfoGain.connect(oscillatorRef.current.frequency);
      lfo.start();
      
    } else if (track.title.includes("Rain") || track.title.includes("Forest")) {
      // Rain/forest - higher frequency with noise
      oscillatorRef.current.type = 'sine';
      oscillatorRef.current.frequency.value = 200 + Math.random() * 100;
      
    } else if (track.title.includes("White Noise")) {
      // White noise
      oscillatorRef.current.type = 'sawtooth';
      oscillatorRef.current.frequency.value = 440 + Math.random() * 220;
      
    } else {
      // Default ambient sound
      oscillatorRef.current.type = 'sine';
      oscillatorRef.current.frequency.value = 100 + Math.random() * 50;
    }
    
    oscillatorRef.current.connect(gainNode);
    oscillatorRef.current.start();
    
    setIsPlaying(true);
  };

  const stopSound = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current = null;
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