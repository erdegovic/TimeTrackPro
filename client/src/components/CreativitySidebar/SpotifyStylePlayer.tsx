import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  audioUrl: string;
  albumArt: string;
  environment?: string;
  intensity?: "low" | "medium" | "high";
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  tracks: Track[];
  coverArt?: string;
  colorScheme?: string;
}

const playlists: Playlist[] = [
  {
    id: "deep-focus",
    name: "Deep Focus",
    description: "Minimal ambient textures for uninterrupted concentration",
    coverArt: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=600&fit=crop",
    colorScheme: "from-blue-100/80 to-blue-50/80",
    tracks: [
      {
        id: "df1",
        title: "Luminous Space",
        artist: "Ambient Collective",
        duration: "32:00",
        audioUrl: "/audio/focus/space.mp3",
        albumArt: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=300&h=300&fit=crop",
        environment: "Cosmic",
        intensity: "low"
      },
      {
        id: "df2",
        title: "Crystal Clear",
        artist: "Mindful Tones",
        duration: "45:00",
        audioUrl: "/audio/focus/crystal.mp3",
        albumArt: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=300&h=300&fit=crop",
        environment: "Mineral",
        intensity: "medium"
      },
      {
        id: "df3",
        title: "Digital Rain",
        artist: "Focus Waves",
        duration: "28:30",
        audioUrl: "/audio/focus/rain.mp3",
        albumArt: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=300&h=300&fit=crop",
        environment: "Cyber",
        intensity: "high"
      },
      {
        id: "df4",
        title: "Boreal Forest",
        artist: "Nature Soundscapes",
        duration: "38:15",
        audioUrl: "/audio/focus/forest.mp3",
        albumArt: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=300&h=300&fit=crop",
        environment: "Woodland",
        intensity: "medium"
      },
      {
        id: "df5",
        title: "Ocean Memory",
        artist: "Aquatic Harmonics",
        duration: "41:20",
        audioUrl: "/audio/focus/ocean.mp3",
        albumArt: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=300&h=300&fit=crop",
        environment: "Aquatic",
        intensity: "low"
      },
      {
        id: "df6",
        title: "Zen Garden",
        artist: "Meditation Studio",
        duration: "35:45",
        audioUrl: "/audio/focus/zen.mp3",
        albumArt: "https://images.unsplash.com/photo-1526397751294-331021109fbd?w=300&h=300&fit=crop",
        environment: "Japanese Garden",
        intensity: "low"
      }
    ]
  },
  {
    id: "creative-flow",
    name: "Creative Flow",
    description: "Subtle rhythms to stimulate creative thinking",
    coverArt: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=600&fit=crop",
    colorScheme: "from-purple-100/80 to-purple-50/80",
    tracks: [
      {
        id: "cf1",
        title: "Neural Pathways",
        artist: "Brainwave Studio",
        duration: "52:00",
        audioUrl: "/audio/creative/neural.mp3",
        albumArt: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&h=300&fit=crop",
        environment: "Abstract",
        intensity: "medium"
      },
      {
        id: "cf2",
        title: "Liquid Thoughts",
        artist: "Fluid Mind",
        duration: "48:30",
        audioUrl: "/audio/creative/liquid.mp3",
        albumArt: "https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=300&h=300&fit=crop",
        environment: "Watercolor",
        intensity: "low"
      },
      {
        id: "cf3",
        title: "Quantum Drift",
        artist: "Science Sounds",
        duration: "45:15",
        audioUrl: "/audio/creative/quantum.mp3",
        albumArt: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=300&h=300&fit=crop",
        environment: "Particle",
        intensity: "high"
      }
    ]
  },
  {
    id: "mindful-meditation",
    name: "Mindful Meditation",
    description: "Soothing atmospheres for relaxation and clarity",
    coverArt: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop",
    colorScheme: "from-green-100/80 to-green-50/80",
    tracks: [
      {
        id: "mm1",
        title: "Tibetan Resonance",
        artist: "Ancient Echoes",
        duration: "60:00",
        audioUrl: "/audio/meditation/tibetan.mp3",
        albumArt: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop",
        environment: "Himalayan",
        intensity: "low"
      },
      {
        id: "mm2",
        title: "Breathing Space",
        artist: "Mindful Moments",
        duration: "45:00",
        audioUrl: "/audio/meditation/breath.mp3",
        albumArt: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=300&h=300&fit=crop",
        environment: "Cloud",
        intensity: "medium"
      },
      {
        id: "mm3",
        title: "Golden Light",
        artist: "Inner Peace",
        duration: "55:30",
        audioUrl: "/audio/meditation/light.mp3",
        albumArt: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=300&h=300&fit=crop",
        environment: "Sunrise",
        intensity: "low"
      },
      {
        id: "mm4",
        title: "Forest Bathing",
        artist: "Nature Therapy",
        duration: "50:15",
        audioUrl: "/audio/meditation/forest.mp3",
        albumArt: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop",
        environment: "Bamboo Forest",
        intensity: "medium"
      }
    ]
  }
];

const musicList: Track[] = playlists.flatMap(playlist => playlist.tracks);

export default function CreativityPanelPlayer() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeControl, setShowVolumeControl] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const hoverPlayheadRef = useRef<HTMLDivElement | null>(null);
  const playlistContainerRef = useRef<HTMLDivElement | null>(null);

  const currentTrack = musicList[currentTrackIndex];

  // Initialize audio element and event listeners
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.src = currentTrack.audioUrl;
      audioRef.current.volume = isMuted ? 0 : volume;
    }

    const audio = audioRef.current;
    const timeline = timelineRef.current;
    const playhead = playheadRef.current;
    const hoverPlayhead = hoverPlayheadRef.current;

    const timeUpdate = () => {
      const duration = audio.duration || 0;
      const playPercent = 100 * (audio.currentTime / duration);
      if (playhead) {
        playhead.style.width = playPercent + "%";
      }
      const currentTimeFormatted = formatTime(parseInt(audio.currentTime.toString()));
      setCurrentTime(currentTimeFormatted);
    };

    const nextSong = () => {
      const nextIndex = (currentTrackIndex + 1) % musicList.length;
      setCurrentTrackIndex(nextIndex);
      updatePlayer(nextIndex);
      if (isPlaying) {
        audio.play();
      }
    };

    const changeCurrentTime = (e: MouseEvent) => {
      if (!timeline || !audio) return;
      const duration = audio.duration;
      const playheadWidth = timeline.offsetWidth;
      const offsetWidth = timeline.getBoundingClientRect().left;
      const userClickWidth = e.clientX - offsetWidth;
      const userClickWidthInPercent = (userClickWidth * 100) / playheadWidth;
      
      if (playhead) {
        playhead.style.width = userClickWidthInPercent + "%";
      }
      audio.currentTime = (duration * userClickWidthInPercent) / 100;
    };

    const hoverTimeLine = (e: MouseEvent) => {
      if (!timeline || !audio || !hoverPlayhead) return;
      const duration = audio.duration;
      const playheadWidth = timeline.offsetWidth;
      const offsetWidth = timeline.getBoundingClientRect().left;
      const userClickWidth = e.clientX - offsetWidth;
      const userClickWidthInPercent = (userClickWidth * 100) / playheadWidth;

      if (userClickWidthInPercent <= 100) {
        hoverPlayhead.style.width = userClickWidthInPercent + "%";
      }

      const time = (duration * userClickWidthInPercent) / 100;
      if (time >= 0 && time <= duration) {
        hoverPlayhead.setAttribute('data-content', formatTime(time));
      }
    };

    const resetTimeLine = () => {
      if (hoverPlayhead) {
        hoverPlayhead.style.width = "0";
      }
    };

    audio.addEventListener("timeupdate", timeUpdate);
    audio.addEventListener("ended", nextSong);
    
    if (timeline) {
      timeline.addEventListener("click", changeCurrentTime);
      timeline.addEventListener("mousemove", hoverTimeLine);
      timeline.addEventListener("mouseout", resetTimeLine);
    }

    return () => {
      audio.removeEventListener("timeupdate", timeUpdate);
      audio.removeEventListener("ended", nextSong);
      if (timeline) {
        timeline.removeEventListener("click", changeCurrentTime);
        timeline.removeEventListener("mousemove", hoverTimeLine);
        timeline.removeEventListener("mouseout", resetTimeLine);
      }
    };
  }, [currentTrackIndex, isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const formatTime = (currentTime: number) => {
    const minutes = Math.floor(currentTime / 60);
    let seconds: string | number = Math.floor(currentTime % 60);
    seconds = seconds >= 10 ? seconds : "0" + seconds;
    return minutes + ":" + seconds;
  };

  const updatePlayer = (index?: number) => {
    if (audioRef.current) {
      const trackIndex = index !== undefined ? index : currentTrackIndex;
      audioRef.current.src = musicList[trackIndex].audioUrl;
      audioRef.current.load();
      
      // Scroll to the selected track in the playlist
      if (playlistContainerRef.current && index !== undefined) {
        const trackElement = playlistContainerRef.current.children[index] as HTMLElement;
        if (trackElement) {
          trackElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  };

  const nextSong = () => {
    const nextIndex = (currentTrackIndex + 1) % musicList.length;
    setCurrentTrackIndex(nextIndex);
    updatePlayer(nextIndex);
    if (isPlaying && audioRef.current) {
      audioRef.current.play();
    }
  };

  const prevSong = () => {
    const prevIndex = (currentTrackIndex + musicList.length - 1) % musicList.length;
    setCurrentTrackIndex(prevIndex);
    updatePlayer(prevIndex);
    if (isPlaying && audioRef.current) {
      audioRef.current.play();
    }
  };

  const playOrPause = () => {
    if (!audioRef.current) return;
    
    if (!isPlaying) {
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
    setIsPlaying(!isPlaying);
  };

  const clickAudio = (index: number) => {
    setCurrentTrackIndex(index);
    updatePlayer(index);
    if (isPlaying && audioRef.current) {
      audioRef.current.play();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.MouseEvent<HTMLDivElement>) => {
    const volumeSlider = e.currentTarget;
    const rect = volumeSlider.getBoundingClientRect();
    const clickPosition = e.clientX - rect.left;
    const newVolume = Math.min(1, Math.max(0, clickPosition / rect.width));
    
    setVolume(newVolume);
    if (newVolume > 0) {
      setIsMuted(false);
    } else {
      setIsMuted(true);
    }
  };

  // Show playlist selection first
  if (!selectedPlaylist) {
    return (
      <div className="w-full h-full p-4">
        <motion.h3 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-xl font-bold text-gray-800 mb-6"
        >
          Soundscapes for Creativity
        </motion.h3>
        
        <div className="grid grid-cols-1 gap-4">
          {playlists.map((playlist, index) => (
            <motion.div
              key={playlist.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              onClick={() => setSelectedPlaylist(playlist.id)}
              className="group cursor-pointer rounded-xl overflow-hidden shadow-lg transition-all duration-300 hover:scale-105 hover:shadow-xl"
            >
              <div 
                className={`relative bg-gradient-to-br ${playlist.colorScheme || 'from-gray-100 to-gray-200'} p-6 h-32`}
                style={{
                  backgroundImage: `url(${playlist.coverArt})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-black/40 to-black/60" />
                <div className="relative z-10 text-white">
                  <h4 className="font-bold text-lg mb-1">{playlist.name}</h4>
                  <p className="text-white/90 text-sm mb-2 line-clamp-2">{playlist.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-white/80 text-xs">{playlist.tracks.length} tracks</span>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="bg-white/20 backdrop-blur-sm rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    >
                      <Play className="h-4 w-4 text-white" />
                    </motion.div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  const currentPlaylist = playlists.find(p => p.id === selectedPlaylist);
  const playlistTracks = currentPlaylist?.tracks || [];
  const currentPlaylistTrack = playlistTracks[currentTrackIndex] || currentTrack;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full h-full flex flex-col bg-gradient-to-b from-gray-50 to-gray-100 rounded-2xl overflow-hidden shadow-lg border border-gray-200"
    >
      {/* Current Song Section */}
      <div className="relative rounded-2xl m-3 p-4 shadow-sm border border-gray-100 overflow-hidden">
        {/* Blurred background */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-md scale-110"
          style={{
            backgroundImage: `url(${currentPlaylistTrack.albumArt})`,
          }}
        />
        <div className="absolute inset-0 bg-white/80" />
        
        {/* Content */}
        <div className="relative z-10">
          <audio ref={audioRef}>
            <source src={currentPlaylistTrack.audioUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
          
          {/* Back button and playlist info */}
          <div className="flex items-center justify-between mb-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedPlaylist(null)}
              className="text-gray-600 hover:text-tickd-primary transition-colors text-sm"
            >
              ← Back
            </motion.button>
            <span className="text-xs text-gray-500 font-medium">{currentPlaylist?.name}</span>
          </div>
          
          {/* Album Art */}
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="relative mx-auto w-32 h-24 mb-4 rounded-lg overflow-hidden shadow-md"
          >
            <img 
              src={currentPlaylistTrack.albumArt} 
              alt={currentPlaylistTrack.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='96' viewBox='0 0 128 96'%3E%3Crect fill='%23f3f4f6'/%3E%3Ctext y='50%25' x='50%25' dy='0.35em' text-anchor='middle' fill='%236b7280' font-size='24'%3E🎵%3C/text%3E%3C/svg%3E";
              }}
            />
          </motion.div>

          {/* Song Info */}
          <div className="text-center mb-4">
            <motion.h3 
              key={currentPlaylistTrack.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-base font-semibold mb-1 text-gray-900 truncate"
            >
              {currentPlaylistTrack.title}
            </motion.h3>
            <p className="text-tickd-primary font-medium text-sm truncate">{currentPlaylistTrack.artist}</p>
          </div>

          {/* Time Display */}
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>{currentTime}</span>
            <span>{currentPlaylistTrack.duration}</span>
          </div>

          {/* Timeline */}
          <div 
            ref={timelineRef}
            className="relative mx-auto w-full h-1 bg-tickd-primary/30 rounded-full cursor-pointer mb-4 hover:h-1.5 transition-all"
          >
            <div 
              ref={playheadRef}
              className="relative z-10 w-0 h-full rounded-full bg-tickd-primary"
            />
            <div 
              ref={hoverPlayheadRef}
              className="absolute z-0 top-0 w-0 h-full opacity-0 rounded-full bg-tickd-primary/60 transition-opacity hover:opacity-100"
              data-content="0:00"
            />
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-4 mb-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={prevSong}
              className="text-gray-700 hover:text-tickd-primary transition-all"
            >
              <SkipBack className="w-5 h-5" />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={playOrPause}
              className="w-12 h-12 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all"
            >
              <AnimatePresence mode="wait">
                {!isPlaying ? (
                  <motion.div
                    key="play"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Play className="w-5 h-5 ml-0.5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="pause"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                  >
                    <Pause className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={nextSong}
              className="text-gray-700 hover:text-tickd-primary transition-all"
            >
              <SkipForward className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center justify-center gap-3">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMute}
              className="text-gray-600 hover:text-tickd-primary transition-colors"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </motion.button>
            
            <div 
              onClick={handleVolumeChange}
              className="w-16 h-1 bg-gray-300 rounded-full cursor-pointer hover:bg-gray-400 transition-colors"
            >
              <div 
                className="h-full bg-tickd-primary rounded-full transition-all"
                style={{ width: `${isMuted ? 0 : volume * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Playlist */}
      <div className="flex-1 p-3 overflow-y-auto">
        <h4 className="font-medium text-gray-700 text-sm mb-2">{currentPlaylist?.name}</h4>
        <div ref={playlistContainerRef} className="space-y-1">
          {playlistTracks.map((track, index) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              onClick={() => clickAudio(index)}
              className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all hover:bg-white/60 ${
                currentTrackIndex === index && !isPlaying 
                  ? 'bg-white/40 border-l-2 border-tickd-primary' 
                  : currentTrackIndex === index && isPlaying 
                  ? 'bg-white/80 border-l-2 border-tickd-primary shadow-sm' 
                  : ''
              }`}
            >
              <img
                src={track.albumArt}
                alt={track.title}
                className="w-10 h-10 rounded-lg object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 40 40'%3E%3Crect fill='%23f3f4f6'/%3E%3Ctext y='50%25' x='50%25' dy='0.35em' text-anchor='middle' fill='%236b7280' font-size='16'%3E🎵%3C/text%3E%3C/svg%3E";
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-gray-800 font-medium text-sm truncate">
                  {track.title}
                </p>
                <p className="text-gray-500 text-xs truncate">
                  {track.artist}
                </p>
              </div>
              <span className="text-gray-400 text-xs font-medium">
                {currentTrackIndex === index ? currentTime : track.duration}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}