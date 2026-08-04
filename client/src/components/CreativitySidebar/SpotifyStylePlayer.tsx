import { useEffect, useMemo, useRef, useState } from "react";
import {
  Disc3,
  Folder,
  Headphones,
  ImageIcon,
  ListMusic,
  Pause,
  Play,
  RefreshCw,
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
  },
  emerald: {
    bar: "bg-emerald-500",
    selected: "border-emerald-500 bg-emerald-50 text-emerald-950",
    icon: "bg-emerald-100 text-emerald-700",
  },
  violet: {
    bar: "bg-violet-500",
    selected: "border-violet-500 bg-violet-50 text-violet-950",
    icon: "bg-violet-100 text-violet-700",
  },
};

export default function CreativityPanelPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playlists, setPlaylists] = useState<Playlist[]>(fallbackPlaylists);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(fallbackPlaylists[0].id);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) || playlists[0],
    [playlists, selectedPlaylistId],
  );

  const currentTrack = useMemo(
    () => playlists.flatMap((playlist) => playlist.tracks).find((track) => track.id === currentTrackId) || null,
    [playlists, currentTrackId],
  );

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

  return (
    <div className="space-y-4">
      <audio ref={audioRef} onEnded={() => setIsPlaying(false)} />

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Headphones className="h-4 w-4 text-slate-700" />
              Soundtracks
            </div>
            <h3 className="text-lg font-semibold text-slate-950">Session music</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Choose a soundtrack that matches the pace of your current session.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-md"
            onClick={() => loadLibrary(true)}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <div className="grid gap-2">
          {playlists.map((playlist) => {
            const isSelected = selectedPlaylist.id === playlist.id;
            const classes = accentClasses[playlist.accent] || accentClasses.blue;

            return (
              <button
                key={playlist.id}
                onClick={() => setSelectedPlaylistId(playlist.id)}
                className={`rounded-lg border p-3 text-left transition ${
                  isSelected
                    ? classes.selected
                    : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`h-8 w-1.5 rounded-full ${classes.bar}`} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{playlist.name}</div>
                      <div className="truncate text-xs text-slate-500">
                        {playlist.intent} / {playlist.tracks.length} tracks
                      </div>
                    </div>
                  </div>
                  <ListMusic className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${accentClasses[selectedPlaylist.accent].icon}`}>
            <Disc3 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-base font-semibold text-slate-950">{selectedPlaylist.name}</h4>
            <p className="truncate text-xs text-slate-500">{selectedPlaylist.intent} soundtrack</p>
          </div>
          <Badge variant="secondary" className="rounded-md bg-slate-100 text-slate-700">
            {selectedPlaylist.tracks.length}
          </Badge>
        </div>

        <p className="mb-4 text-sm leading-5 text-slate-600">{selectedPlaylist.description}</p>

        {currentTrack && (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-950 p-3 text-white">
            <div className="mb-3 flex items-center gap-3">
              {currentTrack.thumbnailUrl ? (
                <img
                  src={currentTrack.thumbnailUrl}
                  alt=""
                  className="h-12 w-12 rounded-md object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/10">
                  <ImageIcon className="h-5 w-5 text-slate-300" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{currentTrack.title}</div>
                <div className="truncate text-xs text-slate-300">{currentTrack.fileName}</div>
              </div>
            </div>
            <Button type="button" className="h-9 w-full rounded-md bg-white text-slate-950 hover:bg-slate-100" onClick={toggleCurrentTrack}>
              {isPlaying ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
              {isPlaying ? "Pause" : "Play"}
            </Button>
          </div>
        )}

        {selectedPlaylist.tracks.length > 0 ? (
          <div className="space-y-2">
            {selectedPlaylist.tracks.map((track) => {
              const isCurrent = currentTrackId === track.id;

              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => playTrack(track)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition ${
                    isCurrent
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {track.thumbnailUrl ? (
                    <img src={track.thumbnailUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
                  ) : (
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${isCurrent ? "bg-white/10" : "bg-slate-100"}`}>
                      <Play className={`h-4 w-4 ${isCurrent ? "text-white" : "text-slate-500"}`} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{track.title}</span>
                    <span className={`block truncate text-xs ${isCurrent ? "text-slate-300" : "text-slate-500"}`}>
                      {track.fileName}
                    </span>
                  </span>
                  {isCurrent && isPlaying ? <Pause className="h-4 w-4 shrink-0" /> : <Play className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
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
