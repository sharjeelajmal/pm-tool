"use client";

import * as React from "react";
import { Play, Pause, Trash2, Mic } from "lucide-react";

interface VoiceNotePlayerProps {
  src: string;
  isMe?: boolean;
  onDelete?: () => void;
  className?: string;
}

function getWaveformHeights(seed: string, count: number = 24): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const pseudoRandom = Math.abs(Math.sin(hash + i * 1.37));
    const h = Math.round(18 + pseudoRandom * 78);
    heights.push(h);
  }
  return heights;
}

export function VoiceNotePlayer({
  src,
  isMe = false,
  onDelete,
  className = "",
}: VoiceNotePlayerProps) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [waveformHeights] = React.useState(() => getWaveformHeights(src, 24));

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && !Number.isNaN(audio.duration) && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (time: number) => {
    if (!time || Number.isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      className={`group relative flex items-center gap-3 px-3 py-2 rounded-2xl select-none transition-all ${
        isMe
          ? "bg-blue-600 text-white shadow-sm"
          : "bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-100 shadow-sm"
      } ${className}`}
      style={{ maxWidth: "340px", minWidth: "260px" }}
    >
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
          isMe
            ? "bg-white text-blue-600 hover:bg-slate-100 shadow"
            : "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 shadow-md shadow-blue-500/20"
        }`}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current" />
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center min-w-0">
        <div
          onClick={handleSeek}
          className="h-8 flex items-center justify-between gap-[3px] cursor-pointer py-1"
          title="Click to seek"
        >
          {waveformHeights.map((heightPercent, idx) => {
            const barProgress = idx / waveformHeights.length;
            const isPlayed = barProgress <= progress;

            return (
              <div
                key={idx}
                className="flex-1 flex items-center justify-center h-full min-w-0"
              >
                <div
                  className={`w-full max-w-[4px] rounded-full transition-colors duration-150 ${
                    isMe
                      ? isPlayed
                        ? "bg-white"
                        : "bg-white/35 group-hover:bg-white/45"
                      : isPlayed
                      ? "bg-blue-600 dark:bg-blue-400"
                      : "bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-600"
                  }`}
                  style={{
                    height: `${heightPercent}%`,
                    minHeight: "5px",
                    maxHeight: "26px",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide opacity-80 px-0.5">
          <span>{isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}</span>
          <button
            type="button"
            onClick={cycleSpeed}
            className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
              isMe
                ? "bg-white/20 hover:bg-white/30 text-white"
                : "bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300"
            }`}
            title="Playback Speed"
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center ${
            isMe ? "bg-white/15 text-white" : "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
        </div>

        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 rounded-lg text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
            title="Delete Audio"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
