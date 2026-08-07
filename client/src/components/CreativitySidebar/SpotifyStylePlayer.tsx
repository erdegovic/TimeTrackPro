import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Disc3,
  Folder,
  Headphones,
  ImageIcon,
  ListMusic,
  Pause,
  Play,
  RefreshCw,
  Repeat,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Track {
  id: string;
  title: string;
  fileName: string;
  url: string;
  thumbnailUrl: string | null;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  intent: string;
  accent: "blue" | "emerald" | "violet";
  folder: string;
  tracks: Track[];
}

const fallbackPlaylists: Playlist[] = [
  {
    id: "deep-work",
    name: "Deep Work",
    description: "Slow ambient layers for long editing, invoicing, and writing sessions.",
    intent: "Focus",
    accent: "blue",
    folder: "deep-work",
    tracks: [],
  },
  {
    id: "creative-flow",
    name: "Creative Flow",
    description: "Warm rhythmic beds for concepting, arranging, and design passes.",
    intent: "Create",
    accent: "emerald",
    folder: "creative-flow",
    tracks: [],
  },
  {
    id: "reset",
    name: "Reset",
    description: "Gentle textures for between-client breaks and end-of-day decompression.",
    intent: "Recover",
    accent: "violet",
    folder: "reset",
    tracks: [],
  },
];

const accentClasses = {
  blue: {
    bar: "bg-blue-500",
    selected: "border-blue-500 bg-blue-50 text-blue-950",
    icon: "bg-blue-100 text-blue-700",
    glow: "from-blue-500/20 to-sky-400/10",
    seek: "bg-blue-500",
  },
  emerald: {
    bar: "bg-emerald-500",
    selected: "border-emerald-500 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-100 text-emerald-700",
    glow: "from-emerald-500/20 to-teal-400/10",
    seek: "bg-emerald-500",
  },
  violet: {
    bar: "bg-violet-500",
    selected: "border-violet-500 bg-violet-50 text-violet-950",
    icon: "bg-violet-100 text-violet-700",
    glow: "from-violet-500/20 to-fuchsia-400/10",
    seek: "bg-violet-500",
  },
};

const formatClock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

/** Static bar heights so the equaliser looks organic rather than uniform. */
const EQ_BARS = [0.45, 0.85, 0.6, 1, 0.5, 0.75, 0.35];

export default function CreativityPanelPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seekRef = useRef<HTMLDivElement | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>(fallbackPlaylists);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(fallbackPlaylists[0].id);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) || playlists[0],
    [playlists, selectedPlaylistId],
  );

  const currentTrack = useMemo(
    () => playlists.flatMap((playlist) => playlist.tracks).find((track) => track.id === currentTrackId) || null,
    [playlists, currentTrackId],
  );

  /** The playlist the playing track belongs to, which may differ from the browsed one. */
  const playingPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.tracks.some((track) => track.id === currentTrackId)) || selectedPlaylist,
    [playlists, currentTrackId, selectedPlaylist],
  );

  const accent = accentClasses[selectedPlaylist?.accent] || accentClasses.blue;
  const playingAccent = accentClasses[playingPlaylist?.accent] || accentClasses.blue;

  const loadLibrary = async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);

    try {
      const response = await fetch("/api/music-library", { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load music library");

      const data = await response.json();
      const nextPlaylists = Array.isArray(data.playlists) ? data.playlists : fallbackPlaylists;
      setPlaylists(nextPlaylists);

      if (!nextPlaylists.some((playlist: Playlist) => playlist.id === selectedPlaylistId)) {
        setSelectedPlaylistId(nextPlaylists[0]?.id || fallbackPlaylists[0].id);
      }
    } catch (error) {
      console.error("Music library load error:", error);
      setPlaylists(fallbackPlaylists);
    } finally {
      if (showRefreshing) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadLibrary();
    const interval = window.setInterval(() => loadLibrary(), 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    audioRef.current.src = currentTrack.url;
    setCurrentTime(0);
    setDuration(0);
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    }
  }, [currentTrack?.id]);

  const playTrack = (track: Track) => {
    setCurrentTrackId(track.id);
    setIsPlaying(true);

    window.setTimeout(() => {
      audioRef.current?.play().catch(() => setIsPlaying(false));
    }, 0);
  };

  const toggleCurrentTrack = () => {
    const audio = audioRef.current;
    const trackToPlay = currentTrack || selectedPlaylist.tracks[0];
    if (!audio || !trackToPlay) return;

    if (!currentTrack) {
      playTrack(trackToPlay);
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  };

  const step = useCallback(
    (offset: number) => {
      const tracks = playingPlaylist?.tracks || [];
      if (tracks.length === 0) return;
      const index = tracks.findIndex((track) => track.id === currentTrackId);
      // Wraps in both directions so the controls are never dead ends.
      const nextIndex = index === -1 ? 0 : (index + offset + tracks.length) % tracks.length;
      playTrack(tracks[nextIndex]);
    },
    [playingPlaylist, currentTrackId],
  );

  const handleEnded = () => {
    const audio = audioRef.current;
    if (repeatOne && audio) {
      audio.currentTime = 0;
      audio.play().catch(() => setIsPlaying(false));
      return;
    }

    const tracks = playingPlaylist?.tracks || [];
    const index = tracks.findIndex((track) => track.id === currentTrackId);
    if (index !== -1 && index < tracks.length - 1) {
      playTrack(tracks[index + 1]);
      return;
    }
    setIsPlaying(false);
  };

  const seekTo = (clientX: number) => {
    const audio = audioRef.current;
    const bar = seekRef.current;
    if (!audio || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const hasTracks = (selectedPlaylist?.tracks.length || 0) > 0;

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        onEnded={handleEnded}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        {/* The refresh control sits on the eyebrow row rather than beside the
            heading block: in a 336px panel a button next to the text squeezed the
            description into a three-line ragged column. */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Headphones className="h-4 w-4 shrink-0 text-slate-700" />
            <span className="truncate">Soundtracks</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg text-slate-500 hover:text-slate-900"
            onClick={() => loadLibrary(true)}
            disabled={isRefreshing}
            aria-label="Refresh soundtrack library"
            title="Refresh soundtrack library"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold tracking-tight text-slate-950">Session music</h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Choose a soundtrack that matches the pace of your current session.
          </p>
        </div>

        <div className="grid gap-2">
          {playlists.map((playlist) => {
            const isSelected = selectedPlaylist.id === playlist.id;
            const isSourceOfPlayback = isPlaying && playingPlaylist?.id === playlist.id;
            const classes = accentClasses[playlist.accent] || accentClasses.blue;

            return (
              <button
                key={playlist.id}
                type="button"
                onClick={() => setSelectedPlaylistId(playlist.id)}
                aria-pressed={isSelected}
                className={`rounded-xl border p-3 text-left transition-all duration-300 ${
                  isSelected
                    ? `${classes.selected} shadow-sm`
                    : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`h-8 w-1.5 shrink-0 rounded-full transition-all duration-300 ${classes.bar} ${isSelected ? "opacity-100" : "opacity-60"}`} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{playlist.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {playlist.intent} / {playlist.tracks.length} tracks
                      </div>
                    </div>
                  </div>
                  {isSourceOfPlayback ? (
                    <span className="flex h-4 shrink-0 items-end gap-[2px]" aria-label="Playing">
                      {EQ_BARS.slice(0, 3).map((height, index) => (
                        <span
                          key={index}
                          className={`tickd-eq-bar w-[3px] rounded-sm ${classes.bar}`}
                          style={{ height: `${height * 16}px`, animationDelay: `${index * 140}ms` }}
                        />
                      ))}
                    </span>
                  ) : (
                    <ListMusic className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.icon}`}>
            <Disc3 className={`h-5 w-5 ${isPlaying && playingPlaylist?.id === selectedPlaylist.id ? "tickd-spin-slow" : ""}`} />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-base font-semibold text-slate-950">{selectedPlaylist.name}</h4>
            <p className="truncate text-xs text-slate-500">{selectedPlaylist.intent} soundtrack</p>
          </div>
          <Badge variant="secondary" className="shrink-0 rounded-md bg-slate-100 text-slate-700">
            {selectedPlaylist.tracks.length}
          </Badge>
        </div>

        <p className="mb-4 text-sm leading-5 text-slate-600">{selectedPlaylist.description}</p>

        {currentTrack && (
          <div className="tickd-sheen relative mb-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 text-white shadow-lg shadow-slate-950/20">
            {/* Accent wash tinted by the playing playlist. */}
            <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${playingAccent.glow}`} />

            <div className="relative">
              <div className="mb-3 flex items-center gap-3">
                {/* Artwork is deliberately static. Spinning it read as a tilted
                    square rather than a record, because the ring and the rounded
                    corners stay axis-aligned with the image. The rotation lives on
                    the Disc3 playlist icon instead, and playback is signalled here
                    by the equaliser badge and the ring lighting up. */}
                <div className="relative h-14 w-14 shrink-0">
                  {currentTrack.thumbnailUrl ? (
                    <img
                      src={currentTrack.thumbnailUrl}
                      alt=""
                      className={`h-14 w-14 rounded-xl object-cover ring-1 transition-all duration-500 ${isPlaying ? "ring-white/40 shadow-lg shadow-black/30" : "ring-white/15"}`}
                    />
                  ) : (
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl bg-white/10 ring-1 transition-all duration-500 ${isPlaying ? "ring-white/40" : "ring-white/15"}`}>
                      <ImageIcon className="h-5 w-5 text-slate-300" />
                    </div>
                  )}
                  {isPlaying && (
                    <span className="absolute -bottom-1 -right-1 flex h-5 items-end gap-[2px] rounded-md bg-slate-950/90 px-1 py-1 ring-1 ring-white/15">
                      {EQ_BARS.slice(0, 3).map((height, index) => (
                        <span
                          key={index}
                          className="tickd-eq-bar w-[2px] rounded-sm bg-white"
                          style={{ height: `${height * 12}px`, animationDelay: `${index * 160}ms` }}
                        />
                      ))}
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{currentTrack.title}</div>
                  <div className="truncate text-xs text-slate-300">{playingPlaylist?.name}</div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  aria-label={isMuted ? "Unmute" : "Mute"}
                  title={isMuted ? "Unmute" : "Mute"}
                  className="h-9 w-9 shrink-0 text-slate-300 hover:bg-white/10 hover:text-white"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </Button>
              </div>

              {/* Seek bar */}
              <div
                ref={seekRef}
                role="slider"
                tabIndex={0}
                aria-label="Seek"
                aria-valuemin={0}
                aria-valuemax={Math.round(duration)}
                aria-valuenow={Math.round(currentTime)}
                onClick={(event) => seekTo(event.clientX)}
                onKeyDown={(event) => {
                  const audio = audioRef.current;
                  if (!audio) return;
                  if (event.key === "ArrowRight") audio.currentTime = Math.min(duration, audio.currentTime + 5);
                  if (event.key === "ArrowLeft") audio.currentTime = Math.max(0, audio.currentTime - 5);
                }}
                className="group mb-1 cursor-pointer py-2"
              >
                <div className="relative h-1 rounded-full bg-white/15">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-200 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                  <span
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity duration-200 group-hover:opacity-100"
                    style={{ left: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between text-[11px] font-medium tabular-nums text-slate-400">
                <span>{formatClock(currentTime)}</span>
                <span>{duration ? formatClock(duration) : "--:--"}</span>
              </div>

              <div className="flex items-center justify-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setRepeatOne((value) => !value)}
                  aria-pressed={repeatOne}
                  aria-label="Repeat current track"
                  title="Repeat current track"
                  className={`h-9 w-9 hover:bg-white/10 ${repeatOne ? "text-white" : "text-slate-400 hover:text-white"}`}
                >
                  <Repeat className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => step(-1)}
                  aria-label="Previous track"
                  title="Previous track"
                  className="h-10 w-10 text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  onClick={toggleCurrentTrack}
                  aria-label={isPlaying ? "Pause" : "Play"}
                  className="h-12 w-12 rounded-full bg-white p-0 text-slate-950 shadow-lg transition-transform duration-200 hover:scale-105 hover:bg-slate-100 active:scale-95"
                >
                  {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-[1px]" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => step(1)}
                  aria-label="Next track"
                  title="Next track"
                  className="h-10 w-10 text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
                <span className="h-9 w-9" aria-hidden="true" />
              </div>
            </div>
          </div>
        )}

        {hasTracks ? (
          <div className="space-y-2">
            {selectedPlaylist.tracks.map((track) => {
              const isCurrent = currentTrackId === track.id;

              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => (isCurrent ? toggleCurrentTrack() : playTrack(track))}
                  className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all duration-300 ${
                    isCurrent
                      ? "border-slate-950 bg-slate-950 text-white shadow-md shadow-slate-950/20"
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50 hover:shadow-sm"
                  }`}
                >
                  {track.thumbnailUrl ? (
                    <img src={track.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${isCurrent ? "bg-white/10" : "bg-slate-100"}`}>
                      <Play className={`h-4 w-4 ${isCurrent ? "text-white" : "text-slate-500"}`} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{track.title}</span>
                    <span className={`block truncate text-xs ${isCurrent ? "text-slate-300" : "text-slate-500"}`}>
                      {track.fileName}
                    </span>
                  </span>
                  {isCurrent && isPlaying ? (
                    <span className="flex h-4 shrink-0 items-end gap-[2px]" aria-hidden="true">
                      {EQ_BARS.slice(0, 3).map((height, index) => (
                        <span
                          key={index}
                          className="tickd-eq-bar w-[3px] rounded-sm bg-white"
                          style={{ height: `${height * 16}px`, animationDelay: `${index * 140}ms` }}
                        />
                      ))}
                    </span>
                  ) : (
                    <Play className="h-4 w-4 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Folder className="h-4 w-4" />
              Soundtracks coming soon
            </div>
            <p className="text-xs leading-5 text-slate-500">
              This playlist is ready and will appear here once tracks are available.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
