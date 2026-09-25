"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Trash2, Check, Mic, Square } from "lucide-react";

interface VoiceRecorderUIProps {
  onFinish: (audioBlob: Blob) => void | Promise<void>;
  onCancel: () => void;
  variant?: "inline" | "floating";
}

export function VoiceRecorderUI({
  onFinish,
  onCancel,
  variant = "floating",
}: VoiceRecorderUIProps) {
  const [recordingTime, setRecordingTime] = React.useState(0);
  const [waveform, setWaveform] = React.useState<number[]>(() =>
    Array.from({ length: 22 }, () => 14)
  );

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const timerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const isCancelledRef = React.useRef<boolean>(false);

  React.useEffect(() => {
    let stream: MediaStream | null = null;

    async function initAudio() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
          if (isCancelledRef.current) return;

          const mimeType = mediaRecorder.mimeType || "audio/webm";
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          if (blob.size > 0) {
            void onFinish(blob);
          }
        };

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.4;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        let lastSampleTime = 0;
        const updateWaveform = (now: number) => {
          if (!analyserRef.current) return;

          if (now - lastSampleTime > 65) {
            lastSampleTime = now;
            analyserRef.current.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const currentHeight = Math.min(100, Math.max(14, Math.round((average / 115) * 100)));

            setWaveform((prev) => [...prev.slice(1), currentHeight]);
          }

          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        };

        mediaRecorder.start(100);

        timerIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);

        animationFrameRef.current = requestAnimationFrame(updateWaveform);
      } catch (err) {
        alert("Microphone permission is required to record voice notes.");
        onCancel();
      }
    }

    void initAudio();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        void audioContextRef.current.close().catch(() => {});
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {}
      }
    };
  }, []);

  const handleStopAndSave = () => {
    isCancelledRef.current = false;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancelRecording = () => {
    isCancelledRef.current = true;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  if (variant === "inline") {
    return (
      <div className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-blue-50/90 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-500/25 rounded-2xl shadow-inner select-none transition-all">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCancelRecording}
            className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors cursor-pointer"
            title="Cancel Recording"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600 dark:bg-blue-500" />
            </span>
            <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
              {formatTime(recordingTime)}
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center gap-[3px] h-7 max-w-[200px] overflow-hidden px-1">
          {waveform.map((h, i) => (
            <div
              key={i}
              className="flex-1 max-w-[4px] bg-blue-600 dark:bg-blue-400 rounded-full transition-all duration-75"
              style={{
                height: `${h}%`,
                minHeight: "5px",
                maxHeight: "26px",
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleStopAndSave}
            className="h-8 px-3 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs font-bold shadow-md shadow-blue-500/20 transition-all cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 15, scale: 0.95 }}
      className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-4 px-5 py-3 rounded-full bg-slate-900/95 dark:bg-[#0F172A]/95 backdrop-blur-xl border border-white/15 text-white shadow-2xl shadow-blue-500/15 select-none"
    >
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
          <Mic className="w-4 h-4 animate-pulse" />
        </div>
        <span className="font-mono font-bold text-sm tracking-wider text-blue-400">
          {formatTime(recordingTime)}
        </span>
      </div>

      <div className="h-8 flex items-center gap-[3px] w-48 sm:w-64 px-2 bg-white/5 rounded-xl border border-white/5">
        {waveform.map((h, i) => (
          <div
            key={i}
            className="flex-1 max-w-[4.5px] bg-blue-500 rounded-full transition-all duration-75"
            style={{
              height: `${h}%`,
              minHeight: "5px",
              maxHeight: "28px",
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleCancelRecording}
          className="p-2 rounded-full text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors cursor-pointer"
          title="Cancel"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleStopAndSave}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
        >
          <Square className="w-3 h-3 fill-current" />
          <span>Save Voice</span>
        </button>
      </div>
    </motion.div>
  );
}
