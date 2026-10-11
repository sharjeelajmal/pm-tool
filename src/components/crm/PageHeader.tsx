"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ShieldCheck, type LucideIcon } from "lucide-react";
import { useCrm } from "@/components/crm/CrmProvider";
import { Avatar, Button, EASE_OUT } from "@/components/crm/ui";

// Shared page header; the admin's "Share access" control sits on top of every Leads page.
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
  icon: Icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  icon?: LucideIcon;
}) {
  const { me, members, setAccessOpen } = useCrm();
  const team = members.filter((m) => !m.isAdmin);

  return (
    <header className="px-4 sm:px-6 lg:px-8 pt-5 sm:pt-8 pb-4 flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="flex items-center gap-3.5 flex-1 min-w-0"
        >
          {Icon && (
            <motion.span
              initial={{ scale: 0.6, rotate: -15, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.05 }}
              className="hidden sm:flex w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 items-center justify-center shadow-[0_14px_30px_-12px_rgba(79,70,229,0.85)]"
            >
              <Icon className="w-6 h-6 text-white" />
            </motion.span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-white truncate leading-tight">{title}</h1>
            {subtitle && <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</div>}
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.08 }}
          className="flex flex-wrap items-center gap-2"
        >
          {actions}
          {me.isAdmin && (
            <Button size="sm" variant="secondary" onClick={() => setAccessOpen(true)} title="Choose who can access the Leads module" className="gap-2">
              {team.length > 0 ? (
                <span className="flex -space-x-1.5">
                  {team.slice(0, 3).map((m) => (
                    <Avatar key={m.username} name={m.username} size="xs" />
                  ))}
                </span>
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              Share access
              {team.length > 3 && <span className="text-[10px] text-slate-400">+{team.length - 3}</span>}
            </Button>
          )}
        </motion.div>
      </div>
      {children && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.14 }} className="flex flex-col gap-3">
          {children}
        </motion.div>
      )}
    </header>
  );
}
