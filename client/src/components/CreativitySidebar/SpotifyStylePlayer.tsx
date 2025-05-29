import { useState, useRef, useEffect } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface Track {
  id: string;
  title: string;
  artist: string;
  duration: string;
  audioUrl: string;
  albumArt: string;
}

const musicList: Track[] = [
  {
    id: "focus_1",
    title: "Ocean Waves",
    artist: "Nature Sounds",
    duration: "10:00",
    audioUrl: "/audio/focus/ocean-waves.mp3",
    albumArt: "https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=300&h=300&fit=crop&crop=center"
  },
  {
    id: "focus_2",
    title: "Forest Rain",
    artist: "Ambient Collective", 
    duration: "12:30",
    audioUrl: "/audio/focus/forest-rain.mp3",
    albumArt: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&h=300&fit=crop&crop=center"
  },
  {
    id: "focus_3",
    title: "White Noise",
    artist: "Focus Audio",
    duration: "15:00",
    audioUrl: "/audio/focus/white-noise.mp3",
    albumArt: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=300&h=300&fit=crop&crop=center"
  },
  {
    id: "creative_1",
    title: "Ambient Synths",
    artist: "Creative Flow",
    duration: "14:20",
    audioUrl: "/audio/creative/ambient-synths.mp3",
    albumArt: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop&crop=center"
  },
  {
    id: "creative_2",
    title: "Gentle Piano",
    artist: "Mindful Music",
    duration: "11:15", 
    audioUrl: "/audio/creative/gentle-piano.mp3",
    albumArt: "https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=300&h=300&fit=crop&crop=center"
  },
  {
    id: "meditation_1",
    title: "Tibetan Bowls",
    artist: "Zen Masters",
    duration: "18:00",
    audioUrl: "/audio/meditation/tibetan-bowls.mp3",
    albumArt: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop&crop=center"
  }
];

export default function SpotifyStylePlayer() {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [duration, setDuration] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const playheadRef = useRef<HTMLDivElement | null>(null);
  const hoverPlayheadRef = useRef<HTMLDivElement | null>(null);

  const currentTrack = musicList[currentTrackIndex];

  // Initialize audio element and event listeners
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.src = currentTrack.audioUrl;
    }

    const audio = audioRef.current;
    const timeline = timelineRef.current;
    const playhead = playheadRef.current;
    const hoverPlayhead = hoverPlayheadRef.current;

    const timeUpdate = () => {
      const duration = audio.duration;
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
      const offsetWidth = timeline.offsetLeft;
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
      const offsetWidth = timeline.offsetLeft;
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

  const formatTime = (currentTime: number) => {
    const minutes = Math.floor(currentTime / 60);
    let seconds: string | number = Math.floor(currentTime % 60);
    seconds = seconds >= 10 ? seconds : "0" + (seconds % 60);
    return minutes + ":" + seconds;
  };

  const updatePlayer = (index?: number) => {
    if (audioRef.current) {
      const trackIndex = index !== undefined ? index : currentTrackIndex;
      audioRef.current.src = musicList[trackIndex].audioUrl;
      audioRef.current.load();
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

  return (
    <div className="w-full bg-gradient-to-b from-gray-50 to-gray-100 rounded-2xl overflow-hidden shadow-lg border border-gray-200">
      {/* Current Song Section */}
      <div className="bg-white rounded-2xl m-3 p-4 shadow-sm border border-gray-100">
        <audio ref={audioRef}>
          <source src={currentTrack.audioUrl} type="audio/mpeg" />
          Your browser does not support the audio element.
        </audio>
        
        {/* Album Art */}
        <div className="relative mx-auto w-32 h-24 mb-4 rounded-lg overflow-hidden shadow-md">
          <img 
            src={currentTrack.albumArt} 
            alt={currentTrack.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='96' viewBox='0 0 128 96'%3E%3Crect fill='%23f3f4f6'/%3E%3Ctext y='50%25' x='50%25' dy='0.35em' text-anchor='middle' fill='%236b7280' font-size='24'%3E🎵%3C/text%3E%3C/svg%3E";
            }}
          />
        </div>

        {/* Song Info */}
        <div className="text-center mb-4">
          <h3 className="text-base font-semibold mb-1 text-gray-900 truncate">{currentTrack.title}</h3>
          <p className="text-tickd-primary font-medium text-sm truncate">{currentTrack.artist}</p>
        </div>

        {/* Time Display */}
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>{currentTime}</span>
          <span>{currentTrack.duration}</span>
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
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={prevSong}
            className="text-gray-700 hover:text-tickd-primary hover:scale-110 transition-all"
          >
            <SkipBack className="w-5 h-5" />
          </button>
          
          <button
            onClick={playOrPause}
            className="w-10 h-10 bg-tickd-primary hover:bg-tickd-primary/90 rounded-full flex items-center justify-center text-white shadow-lg hover:shadow-xl transition-all"
          >
            {!isPlaying ? (
              <Play className="w-4 h-4 ml-0.5" />
            ) : (
              <Pause className="w-4 h-4" />
            )}
          </button>
          
          <button
            onClick={nextSong}
            className="text-gray-700 hover:text-tickd-primary hover:scale-110 transition-all"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Playlist */}
      <div className="p-3 max-h-40 overflow-y-auto">
        <div className="space-y-1">
          {musicList.map((track, index) => (
            <div
              key={track.id}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}