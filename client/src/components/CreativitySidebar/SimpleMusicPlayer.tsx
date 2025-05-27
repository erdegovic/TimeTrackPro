import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipForward, SkipBack, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const playlists = [
  {
    id: "focus",
    name: "Deep Focus",
    emoji: "🎯",
    tracks: ["Flow State", "Concentration", "Deep Work"]
  },
  {
    id: "creative",
    name: "Creative Flow", 
    emoji: "✨",
    tracks: ["Inspiration", "Innovation", "Breakthrough"]
  },
  {
    id: "meditation",
    name: "Meditation",
    emoji: "🧘",
    tracks: ["Inner Peace", "Mindfulness", "Calm Waters"]
  }
];

export default function SimpleMusicPlayer() {
  const [currentPlaylist, setCurrentPlaylist] = useState(playlists[0]);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([50]);
  const [progress, setProgress] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  const createAmbientSound = () => {
    try {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }

      audioContextRef.current = new AudioContext();
      const oscillator = audioContextRef.current.createOscillator();
      const gainNode = audioContextRef.current.createGain();

      // Different sounds for different playlists
      if (currentPlaylist.id === "meditation") {
        // Ocean waves
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(100, audioContextRef.current.currentTime);
        gainNode.gain.setValueAtTime(volume[0] / 100 * 0.1, audioContextRef.current.currentTime);
      } else if (currentPlaylist.id === "focus") {
        // White noise for focus
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(200, audioContextRef.current.currentTime);
        gainNode.gain.setValueAtTime(volume[0] / 100 * 0.05, audioContextRef.current.currentTime);
      } else {
        // Creative ambient
        oscillator.type = "triangle";
        oscillator.frequency.setValueAtTime(150, audioContextRef.current.currentTime);
        gainNode.gain.setValueAtTime(volume[0] / 100 * 0.08, audioContextRef.current.currentTime);
      }

      oscillator.connect(gainNode);
      gainNode.connect(audioContextRef.current.destination);
      oscillator.start();

      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;

      return true;
    } catch (error) {
      console.log("Audio not available:", error);
      return false;
    }
  };

  const stopSound = () => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop();
      oscillatorRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const handlePlayPause = () => {
    if (!isPlaying) {
      const audioStarted = createAmbientSound();
      if (audioStarted) {
        setIsPlaying(true);
        console.log(`🎵 Playing: ${currentPlaylist.tracks[currentTrack]} from ${currentPlaylist.name}`);
      }
    } else {
      stopSound();
      setIsPlaying(false);
      console.log("⏸️ Music paused");
    }
  };

  const handleNext = () => {
    const nextTrack = (currentTrack + 1) % currentPlaylist.tracks.length;
    setCurrentTrack(nextTrack);
    setProgress(0);
    
    if (isPlaying) {
      stopSound();
      setTimeout(() => createAmbientSound(), 100);
    }
  };

  const handlePrevious = () => {
    const prevTrack = currentTrack === 0 ? currentPlaylist.tracks.length - 1 : currentTrack - 1;
    setCurrentTrack(prevTrack);
    setProgress(0);
    
    if (isPlaying) {
      stopSound();
      setTimeout(() => createAmbientSound(), 100);
    }
  };

  // Update volume in real-time
  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setValueAtTime(
        volume[0] / 100 * 0.1, 
        audioContextRef.current.currentTime
      );
    }
  }, [volume]);

  // Progress simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 180) { // 3 minutes
            handleNext();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Cleanup
  useEffect(() => {
    return () => stopSound();
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {playlists.map((playlist) => (
          <Button
            key={playlist.id}
            variant={currentPlaylist.id === playlist.id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setCurrentPlaylist(playlist);
              setCurrentTrack(0);
              setProgress(0);
              if (isPlaying) {
                stopSound();
                setTimeout(() => createAmbientSound(), 100);
              }
            }}
            className="text-xs"
          >
            {playlist.emoji} {playlist.name}
          </Button>
        ))}
      </div>

      <div className="bg-white/5 rounded-lg p-4 space-y-3">
        <div className="text-center">
          <div className="text-sm font-medium text-white/90">
            {currentPlaylist.tracks[currentTrack]}
          </div>
          <div className="text-xs text-white/60">
            {currentPlaylist.name}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1">
          <Slider
            value={[progress]}
            max={180}
            step={1}
            className="w-full"
            onValueChange={([value]) => setProgress(value)}
          />
          <div className="flex justify-between text-xs text-white/60">
            <span>{formatTime(progress)}</span>
            <span>3:00</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevious}
            className="text-white/80 hover:text-white"
          >
            <SkipBack className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="lg"
            onClick={handlePlayPause}
            className="text-white/80 hover:text-white bg-white/10 hover:bg-white/20"
          >
            {isPlaying ? (
              <Pause className="h-6 w-6" />
            ) : (
              <Play className="h-6 w-6" />
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleNext}
            className="text-white/80 hover:text-white"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <Volume2 className="h-4 w-4 text-white/60" />
          <Slider
            value={volume}
            max={100}
            step={1}
            onValueChange={setVolume}
            className="flex-1"
          />
          <span className="text-xs text-white/60 w-8">{volume[0]}%</span>
        </div>

        {isPlaying && (
          <div className="text-center">
            <div className="text-xs text-green-400 animate-pulse">
              ♪ Playing ambient sound
            </div>
          </div>
        )}
      </div>
    </div>
  );
}