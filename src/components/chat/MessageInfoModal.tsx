"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, CheckCheck, Clock, Pencil, User, Ban } from "lucide-react";
import { VoiceNotePlayer } from "@/components/voice/VoiceNotePlayer";

export interface CommentInfoItem {
  id: string;
  username: string;
  text: string;
  type?: string;
  mediaData?: string;
  createdAt: string;
  readBy?: string[];
  deliveredTo?: string[];
  isEdited?: boolean;
  isDeleted?: boolean;
  updatedAt?: string;
}

interface MessageInfoModalProps {
  comment: CommentInfoItem;
  currentUsername?: string;
  onClose: () => void;
}

export function MessageInfoModal({
  comment,
  currentUsername,
  onClose,
}: MessageInfoModalProps) {
  const isMe = comment.username === currentUsername;
  const readers = (comment.readBy || []).filter((u) => u !== comment.username);
  const deliveredUsers = (comment.deliveredTo || []).filter(
    (u) => u !== comment.username && !readers.includes(u)
  );

  const formatFullDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden flex flex-col max-h-[85vh]"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CheckCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Message Info
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-400">
                Delivery and read status
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-[#0F172A]/70 border border-slate-200/60 dark:border-white/5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                {isMe ? "You" : comment.username}
              </span>
              {comment.isEdited && (
                <span className="text-[10px] font-medium text-amber-500 flex items-center gap-1">
                  <Pencil className="w-2.5 h-2.5" /> Edited
                </span>
              )}
            </div>

            {comment.isDeleted ? (
              <div className="flex items-center gap-2 text-xs italic text-slate-400 dark:text-slate-500 py-1">
                <Ban className="w-3.5 h-3.5 opacity-60" />
                <span>This message was deleted</span>
              </div>
            ) : comment.type === "image" ? (
              <img
                src={comment.mediaData}
                alt="Shared message"
                className="max-h-44 rounded-xl object-contain"
              />
            ) : comment.type === "audio" ? (
              <VoiceNotePlayer src={comment.mediaData || ""} isMe={false} />
            ) : (
              <p className="text-xs text-slate-800 dark:text-slate-100 break-words whitespace-pre-wrap leading-relaxed">
                {comment.text}
              </p>
            )}
          </div>

          <div className="bg-slate-50/60 dark:bg-white/[0.02] rounded-2xl border border-slate-200/60 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5 overflow-hidden">
            <div className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-sky-500 dark:text-sky-400">
                  <svg
                    width="16"
                    height="12"
                    viewBox="0 0 16 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 6.5l3.5 3.5L11 2" />
                    <path d="M5 6.5l3.5 3.5L15 2" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Read by
                </span>
                <span className="ml-auto text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-white/5">
                  {readers.length}
                </span>
              </div>

              {readers.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic pl-6">
                  Not read yet
                </p>
              ) : (
                <div className="pl-6 space-y-1.5 mt-2">
                  {readers.map((user) => (
                    <div
                      key={user}
                      className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <div className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center text-[10px] font-bold">
                        {user.slice(0, 1).toUpperCase()}
                      </div>
                      <span>{user}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-slate-400">
                  <svg
                    width="16"
                    height="12"
                    viewBox="0 0 16 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 6.5l3.5 3.5L11 2" />
                    <path d="M5 6.5l3.5 3.5L15 2" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Delivered to
                </span>
                <span className="ml-auto text-[10px] font-semibold text-slate-400 px-2 py-0.5 rounded-full bg-slate-200/50 dark:bg-white/5">
                  {(comment.deliveredTo || []).filter((u) => u !== comment.username).length}
                </span>
              </div>

              {(comment.deliveredTo || []).filter((u) => u !== comment.username).length === 0 ? (
                <p className="text-[11px] text-slate-400 italic pl-6">
                  Delivered to server
                </p>
              ) : (
                <div className="pl-6 space-y-1.5 mt-2">
                  {(comment.deliveredTo || [])
                    .filter((u) => u !== comment.username)
                    .map((user) => (
                      <div
                        key={user}
                        className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
                      >
                        <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center text-[10px] font-bold">
                          {user.slice(0, 1).toUpperCase()}
                        </div>
                        <span>{user}</span>
                        {readers.includes(user) && (
                          <span className="text-[10px] text-sky-500 font-medium ml-auto">
                            Read
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="p-3.5">
              <div className="flex items-center gap-2">
                <div className="text-slate-400">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 12 11"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M1 6.5l3.5 3.5L11 2" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Sent
                </span>
                <span className="ml-auto text-[11px] text-slate-400 font-mono">
                  {formatFullDate(comment.createdAt)}
                </span>
              </div>
            </div>

            {comment.isEdited && comment.updatedAt && (
              <div className="p-3.5">
                <div className="flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    Edited
                  </span>
                  <span className="ml-auto text-[11px] text-slate-400 font-mono">
                    {formatFullDate(comment.updatedAt)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-3 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
