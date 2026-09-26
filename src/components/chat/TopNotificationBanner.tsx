"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, X, ArrowRight, UserCheck } from "lucide-react";

export interface AssignedMessageNotification {
  id: string;
  noteId: string;
  noteTitle: string;
  sender: string;
  text: string;
  type?: string;
  createdAt: string;
}

interface TopNotificationBannerProps {
  notification: AssignedMessageNotification | null;
  onOpen: (noteId: string) => void;
  onDismiss: () => void;
}

function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {}
}

export function TopNotificationBanner({
  notification,
  onOpen,
  onDismiss,
}: TopNotificationBannerProps) {
  React.useEffect(() => {
    if (!notification) return;

    playChime();

    const timer = setTimeout(() => {
      onDismiss();
    }, 7000);

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -25, scale: 0.95 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[92vw] max-w-lg cursor-pointer select-none"
          onClick={() => onOpen(notification.noteId)}
        >
          <div className="relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-xl border border-blue-500/30 dark:border-blue-500/25 shadow-2xl shadow-blue-500/10 p-3.5 flex items-start gap-3 transition-transform hover:scale-[1.01] active:scale-[0.99]">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/25">
              <MessageSquare className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {notification.sender}
                </span>
                <span className="text-[11px] text-slate-400">in</span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 truncate max-w-[170px]">
                  {notification.noteTitle}
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="w-2.5 h-2.5" /> Assigned to you
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 break-words">
                {notification.text}
              </p>

              <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">
                <span>View note and reply</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
