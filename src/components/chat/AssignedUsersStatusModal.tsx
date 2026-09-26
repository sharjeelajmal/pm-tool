"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, Building2, ShieldCheck } from "lucide-react";

interface AssignedUsersStatusModalProps {
  assignedTo: string[];
  createdBy?: string;
  currentUsername?: string;
  onlineUsers: string[];
  businessUsername?: string;
  onClose: () => void;
}

export function AssignedUsersStatusModal({
  assignedTo = [],
  createdBy,
  currentUsername,
  onlineUsers = [],
  businessUsername = "business",
  onClose,
}: AssignedUsersStatusModalProps) {
  const normCurrent = (currentUsername || "").toLowerCase().trim();
  const normBusiness = (businessUsername || "business").toLowerCase().trim();

  const isBusinessOnline = onlineUsers.some(
    (u) => u && u.toLowerCase().trim() === normBusiness
  );
  const isMeBusiness = normCurrent === normBusiness;

  const assignedMembers = React.useMemo(() => {
    const list = new Set<string>();
    assignedTo.forEach((u) => {
      if (u && u.toLowerCase().trim() !== normBusiness) {
        list.add(u.trim());
      }
    });
    if (createdBy && createdBy.toLowerCase().trim() !== normBusiness) {
      list.add(createdBy.trim());
    }
    return Array.from(list);
  }, [assignedTo, createdBy, normBusiness]);

  const onlineMembersCount = assignedMembers.filter((u) =>
    onlineUsers.some((ou) => ou && ou.toLowerCase().trim() === u.toLowerCase().trim())
  ).length;

  const totalMembersCount = 1 + assignedMembers.length;
  const totalOnlineCount = (isBusinessOnline ? 1 : 0) + onlineMembersCount;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/10 overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Workspace Members
              </h3>
              <p className="text-[10px] text-slate-400">
                {totalOnlineCount} of {totalMembersCount} currently online
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 max-h-72 overflow-y-auto space-y-1.5 custom-scrollbar">
          {/* Always Show Business Account as Primary Auto-Assigned Admin */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-500/[0.06] border border-blue-200/60 dark:border-blue-500/20">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  <Building2 className="w-4 h-4" />
                </div>
                <span
                  className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#1E293B] ${
                    isBusinessOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    Business Account
                  </span>
                  {isMeBusiness && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 font-semibold">
                      You
                    </span>
                  )}
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" /> Auto-Assigned
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 truncate block">
                  @{businessUsername}
                </span>
              </div>
            </div>

            <div>
              {isBusinessOnline ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  Offline
                </span>
              )}
            </div>
          </div>

          {/* Assigned Users List */}
          {assignedMembers.map((user) => {
            const isOnline = onlineUsers.some(
              (ou) => ou && ou.toLowerCase().trim() === user.toLowerCase().trim()
            );
            const isMe = user.toLowerCase().trim() === normCurrent;
            const isOwner = createdBy && user.toLowerCase().trim() === createdBy.toLowerCase().trim();

            return (
              <div
                key={user}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs uppercase">
                      {user.slice(0, 1)}
                    </div>
                    <span
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#1E293B] ${
                        isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {user}
                      </span>
                      {isMe && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          You
                        </span>
                      )}
                      {isOwner && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                          Creator
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  {isOnline ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Online
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-400 text-[10px] font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      Offline
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-2.5 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
