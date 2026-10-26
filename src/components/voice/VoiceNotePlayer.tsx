"use client";

import * as React from "react";
import { Play, Pause, Trash2, Mic, Download, Gauge, Link2, Loader2, Check, X, MoreVertical } from "lucide-react";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";

interface VoiceNotePlayerProps {
  src: string;
  isMe?: boolean;
  onDelete?: () => void;
  className?: string;
}

function getWaveformHeights(seed: string, count: number = 26): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const pseudoRandom = Math.abs(Math.sin(hash + i * 1.42));
    const h = Math.round(20 + pseudoRandom * 75);
    heights.push(h);
  }
  return heights;
}

// Recordings are uploaded to Cloudinary as video resources (.webm/.mp4). Changing the extension makes
// Cloudinary convert on the fly, so this returns a real Ogg audio file.
function oggUrlFor(src: string) {
  const match = src.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/.+?)(\.[a-z0-9]+)?$/i);
  return match ? `${match[1]}.ogg` : null;
}

function extensionOf(src: string) {
  return src.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1] || "webm";
}

// Cloudinary URLs carry the upload time as /v<unix seconds>/, i.e. when the voice note was recorded.
function fileNameFor(src: string, ext: string) {
  const version = src.match(/\/v(\d{10})\//)?.[1];
  const d = version ? new Date(Number(version) * 1000) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `voice-note-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}

async function saveFile(url: string, fileName: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const href = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

type ActionStatus = "idle" | "busy" | "done" | "error";

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
  const [waveformHeights] = React.useState(() => getWaveformHeights(src, 26));
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const [status, setStatus] = React.useState<ActionStatus>("idle");
  const statusTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const moreButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const longPressRef = React.useRef<{ timer: ReturnType<typeof setTimeout>; x: number; y: number; fired: boolean } | null>(null);

  const closeMenu = React.useCallback(() => setMenuPos(null), []);

  React.useEffect(
    () => () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
      if (longPressRef.current) clearTimeout(longPressRef.current.timer);
    },
    []
  );

  const flashStatus = (next: ActionStatus) => {
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current);
    setStatus(next);
    if (next !== "busy") statusTimerRef.current = setTimeout(() => setStatus("idle"), 1800);
  };

  const downloadOgg = async () => {
    if (!src || status === "busy") return;
    flashStatus("busy");
    const ogg = oggUrlFor(src);
    // Not a Cloudinary file, or the conversion failed: save the original recording instead.
    const saveOriginal = () => saveFile(src, fileNameFor(src, extensionOf(src)));
    try {
      await (ogg ? saveFile(ogg, fileNameFor(src, "ogg")).catch(saveOriginal) : saveOriginal());
      flashStatus("done");
    } catch {
      flashStatus("error");
    }
  };

  const copyLink = () => {
    navigator.clipboard
      .writeText(src)
      .then(() => flashStatus("done"))
      .catch(() => flashStatus("error"));
  };

  React.useEffect(() => {
    if (!src) return;
    let isCancelled = false;

    // Decode actual finite duration from audio data (fixes Chromium WebM duration Infinity bug)
    const calculateExactDuration = async () => {
      try {
        const response = await fetch(src);
        const arrayBuffer = await response.arrayBuffer();
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        if (!isCancelled && decoded.duration && Number.isFinite(decoded.duration)) {
          setDuration(decoded.duration);
        }
        void ctx.close();
      } catch {}
    };

    void calculateExactDuration();
    return () => {
      isCancelled = true;
    };
  }, [src]);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if ((!duration || !Number.isFinite(duration)) && audio.duration && Number.isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onLoadedMetadata = () => {
      if (audio.duration && Number.isFinite(audio.duration) && audio.duration !== Infinity) {
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
  }, [src, duration]);

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

  const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;

  const changeSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    changeSpeed();
  };

  const openMenuAt = (x: number, y: number) => setMenuPos({ x, y });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenuAt(e.clientX, e.clientY);
  };

  // iOS never fires "contextmenu", so a touch long-press opens the same menu.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return;
    const { clientX: x, clientY: y } = e;
    const press = {
      x,
      y,
      fired: false,
      timer: setTimeout(() => {
        press.fired = true;
        openMenuAt(x, y);
      }, 500),
    };
    longPressRef.current = press;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const press = longPressRef.current;
    if (press && !press.fired && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) {
      clearTimeout(press.timer);
      longPressRef.current = null;
    }
  };

  const handlePointerEnd = () => {
    const press = longPressRef.current;
    if (press && !press.fired) {
      clearTimeout(press.timer);
      longPressRef.current = null;
    }
  };

  // The tap that ends a long-press must not also play/seek.
  const handleClickCapture = (e: React.MouseEvent) => {
    if (longPressRef.current?.fired) {
      e.preventDefault();
      e.stopPropagation();
      longPressRef.current = null;
    }
  };

  const toggleMenuFromButton = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (menuPos) return closeMenu();
    const rect = e.currentTarget.getBoundingClientRect();
    openMenuAt(rect.left, rect.bottom + 6);
  };

  const formatTime = (time: number) => {
    if (!time || Number.isNaN(time) || !Number.isFinite(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const menuItems: ContextMenuItem[] = [
    {
      key: "play",
      label: isPlaying ? "Pause" : "Play",
      icon: isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />,
      onSelect: togglePlay,
    },
    {
      key: "speed",
      label: `Speed ${playbackRate}x → ${nextRate}x`,
      icon: <Gauge className="w-4 h-4" />,
      onSelect: changeSpeed,
    },
    {
      key: "copy",
      label: "Copy link",
      icon: <Link2 className="w-4 h-4" />,
      onSelect: copyLink,
    },
    {
      key: "download",
      label: status === "busy" ? "Downloading…" : "Download",
      hint: ".ogg",
      icon: <Download className="w-4 h-4" />,
      disabled: !src || status === "busy",
      onSelect: () => void downloadOgg(),
    },
    ...(onDelete
      ? [
          {
            key: "delete",
            label: "Delete voice note",
            icon: <Trash2 className="w-4 h-4" />,
            danger: true,
            separatorBefore: true,
            onSelect: onDelete,
          },
        ]
      : []),
  ];

  return (
    <>
      <div
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={handleClickCapture}
        title="Right-click for options"
        className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl select-none [-webkit-touch-callout:none] transition-all shadow-sm ${
          isMe
            ? "bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-500/25 text-slate-800 dark:text-slate-100 rounded-tr-sm"
            : "bg-white dark:bg-[#1E293B] border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-slate-100 rounded-tl-sm"
        } ${className}`}
        style={{ maxWidth: "340px", minWidth: "260px" }}
      >
        <audio ref={audioRef} src={src} preload="metadata" />

        <button
          type="button"
          onClick={togglePlay}
          className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-md shadow-blue-500/25 transition-transform active:scale-95 cursor-pointer"
          title={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4 fill-current" />
          ) : (
            <Play className="w-4 h-4 fill-current ml-0.5" />
          )}
        </button>

        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div
            onClick={handleSeek}
            className="h-8 flex items-center justify-between gap-[3px] cursor-pointer py-1"
            title="Click to seek"
          >
            {waveformHeights.map((heightPercent, idx) => {
              const barProgress = idx / (waveformHeights.length - 1);
              const isPlayed = barProgress <= progress;

              return (
                <div
                  key={idx}
                  className="flex-1 flex items-center justify-center h-full min-w-0"
                >
                  <div
                    className={`w-full max-w-[4px] rounded-full transition-colors duration-100 ${
                      isPlayed
                        ? "bg-blue-600 dark:bg-blue-400"
                        : "bg-slate-300 dark:bg-slate-700 group-hover:bg-slate-400 dark:group-hover:bg-slate-600"
                    }`}
                    style={{
                      height: `${heightPercent}%`,
                      minHeight: "6px",
                      maxHeight: "26px",
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] font-semibold tracking-wide opacity-80 px-0.5 mt-0.5">
            <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">
              {isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
            </span>
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Playback Speed"
            >
              {playbackRate}x
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            ref={moreButtonRef}
            type="button"
            onClick={toggleMenuFromButton}
            aria-haspopup="menu"
            aria-expanded={!!menuPos}
            title={status === "busy" ? "Downloading…" : "More options"}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors cursor-pointer"
          >
            {status === "busy" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : status === "done" ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : status === "error" ? (
              <X className="w-3.5 h-3.5 text-rose-500" />
            ) : (
              <>
                <Mic className={`w-3.5 h-3.5 group-hover:hidden ${menuPos ? "hidden" : ""}`} />
                <MoreVertical className={`w-3.5 h-3.5 group-hover:block ${menuPos ? "block" : "hidden"}`} />
              </>
            )}
          </button>

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
      <ContextMenu
        position={menuPos}
        items={menuItems}
        title={`Voice note · ${formatTime(duration)}`}
        onClose={closeMenu}
        toggleRef={moreButtonRef}
      />
    </>
  );
}
