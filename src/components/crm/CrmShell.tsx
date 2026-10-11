"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  Contact,
  Kanban,
  LayoutDashboard,
  Plus,
  Settings,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCrm } from "@/components/crm/CrmProvider";
import { AccessModal } from "@/components/crm/AccessModal";
import { ListFormModal } from "@/components/crm/contacts/ListFormModal";
import { color } from "@/components/crm/theme";
import { AnimatedNumber, Avatar, SPRING, cn } from "@/components/crm/ui";

interface NavItem {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/crm", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { href: "/crm/contacts", label: "Contacts", short: "Contacts", icon: Contact },
  { href: "/crm/opportunities", label: "Opportunities", short: "Pipeline", icon: Kanban },
  { href: "/crm/calendar", label: "Calendar", short: "Calendar", icon: CalendarDays },
  { href: "/crm/settings", label: "Settings", short: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/crm" ? pathname === "/crm" : pathname.startsWith(href);
}

// Soft animated shapes behind every Leads page.
function BackgroundShapes() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 md:left-[76px] lg:left-64 overflow-hidden -z-0">
      <div className="absolute inset-0 crm-dot-grid [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]" />
      <div className="absolute -top-40 right-[8%] w-[38rem] h-[38rem] rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-400/10 dark:from-blue-500/10 dark:to-indigo-500/5 blur-3xl crm-float" />
      <div className="absolute top-1/3 -left-40 w-[30rem] h-[30rem] rounded-full bg-gradient-to-br from-violet-400/15 to-fuchsia-400/10 dark:from-violet-500/[0.07] dark:to-fuchsia-500/5 blur-3xl crm-float [animation-delay:-6s]" />
      <div className="absolute -bottom-40 right-1/4 w-[26rem] h-[26rem] rounded-full bg-gradient-to-br from-emerald-300/15 to-cyan-300/10 dark:from-emerald-500/[0.06] dark:to-cyan-500/5 blur-3xl crm-float [animation-delay:-11s]" />
    </div>
  );
}

function ListsNav({ onNew }: { onNew: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { lists, listTotals } = useCrm();
  const onContacts = pathname === "/crm/contacts";
  const current = onContacts ? params.get("list") || "all" : "";

  const items = [
    { id: "all", href: "/crm/contacts", name: "All Leads", count: listTotals.total, dot: "bg-gradient-to-br from-blue-500 to-indigo-500" },
    ...lists.map((l) => ({ id: l.id, href: `/crm/contacts?list=${l.id}`, name: l.name, count: l.count, dot: color(l.color).dot })),
  ];

  return (
    <div className="flex flex-col gap-0.5 overflow-y-auto max-h-[34vh] pr-1">
      {items.map((item, i) => {
        const active = current === item.id;
        return (
          <motion.div key={item.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
            <Link
              href={item.href}
              className={cn(
                "relative flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-semibold transition-colors",
                active ? "text-blue-700 dark:text-blue-300" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5"
              )}
            >
              {active && (
                <motion.span
                  layoutId="crmListActive"
                  transition={SPRING}
                  className="absolute inset-0 rounded-lg bg-blue-50 dark:bg-blue-500/15 ring-1 ring-inset ring-blue-200/70 dark:ring-blue-500/20"
                />
              )}
              <span className="relative flex items-center gap-2.5 min-w-0">
                <span className={cn("w-2 h-2 rounded-full shrink-0 transition-transform", item.dot, active && "scale-125")} />
                <span className="truncate">{item.name}</span>
              </span>
              <span className="relative text-[10px] font-bold text-slate-400 tabular-nums">
                <AnimatedNumber value={item.count} />
              </span>
            </Link>
          </motion.div>
        );
      })}
      {lists.length === 0 && (
        <button type="button" onClick={onNew} className="text-left px-3 py-2 text-xs text-slate-400 hover:text-blue-600 cursor-pointer">
          + Create your first list
        </button>
      )}
    </div>
  );
}

export function CrmShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { me, setAccessOpen } = useCrm();
  const [newListOpen, setNewListOpen] = React.useState(false);
  // Animate between modules, but not between a lead list and the next (same page).
  const pageKey = pathname.startsWith("/crm/contacts/") ? "contact-detail" : pathname;

  return (
    <div className="relative h-dvh bg-[#F6F8FC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex overflow-hidden font-sans">
      <BackgroundShapes />

      {/* Desktop sidebar */}
      <aside className="relative hidden md:flex w-[76px] lg:w-64 shrink-0 flex-col justify-between border-r border-slate-200/60 dark:border-white/[0.07] bg-white/70 dark:bg-[#0F172A]/70 backdrop-blur-xl z-20">
        <div className="flex flex-col min-h-0">
          <div className="p-4 lg:p-6 pb-5 flex items-center justify-center lg:justify-start gap-3">
            <motion.div
              whileHover={{ rotate: 90, scale: 1.05 }}
              transition={SPRING}
              className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 flex items-center justify-center shadow-[0_10px_24px_-8px_rgba(79,70,229,0.75)]"
            >
              <Target className="w-5 h-5 text-white" />
              <span className="absolute -right-0.5 -top-0.5 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#0F172A]" />
            </motion.div>
            <div className="hidden lg:flex flex-col min-w-0">
              <span className="font-extrabold text-lg tracking-tight leading-none">Leads CRM</span>
              <span className="text-[10px] text-slate-400 font-semibold mt-1">Business Workspace</span>
            </div>
          </div>

          <nav className="px-3 lg:px-4 flex flex-col gap-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={cn(
                    "relative flex items-center justify-center lg:justify-start gap-3 px-0 lg:px-4 py-3 lg:py-2.5 rounded-xl text-sm font-bold transition-colors group",
                    active ? "text-white" : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="crmNavActive"
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-[0_10px_24px_-10px_rgba(37,99,235,0.85)]"
                      transition={SPRING}
                    />
                  )}
                  <item.icon className={cn("relative w-4 h-4 transition-transform duration-300", active ? "scale-110" : "group-hover:scale-110 group-hover:-rotate-6")} />
                  <span className="relative hidden lg:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="my-5 border-t border-slate-200/60 dark:border-white/[0.07] mx-4" />

          <div className="px-4 hidden lg:flex flex-col min-h-0">
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Lead Lists</span>
              <motion.button
                whileHover={{ rotate: 90 }}
                whileTap={{ scale: 0.85 }}
                type="button"
                onClick={() => setNewListOpen(true)}
                className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-white/10 p-1 rounded-md cursor-pointer"
                title="New list"
              >
                <Plus className="w-3.5 h-3.5" />
              </motion.button>
            </div>
            <React.Suspense fallback={null}>
              <ListsNav onNew={() => setNewListOpen(true)} />
            </React.Suspense>
          </div>
        </div>

        <div className="p-3 lg:p-4 flex flex-col gap-2">
          {me.isAdmin && (
            <button
              type="button"
              title="Team access"
              onClick={() => setAccessOpen(true)}
              className="group flex items-center justify-center lg:justify-start gap-2 px-3 py-2.5 lg:py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-blue-600 transition-transform group-hover:scale-110" />
              <span className="hidden lg:inline">Team access</span>
            </button>
          )}
          <Link href="/" title="Back to Workspace" className="group flex items-center justify-center lg:justify-start gap-2 px-3 py-2.5 lg:py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            <span className="hidden lg:inline">Back to Workspace</span>
          </Link>
          <div className="flex flex-col lg:flex-row items-center gap-2 lg:gap-3 p-2 lg:p-2.5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-white/[0.04] dark:to-white/[0.02] border border-slate-200/60 dark:border-white/[0.06]">
            <Avatar name={me.username} size="md" title={me.username} />
            <div className="hidden lg:block flex-1 min-w-0">
              <div className="text-xs font-bold truncate">{me.username}</div>
              <div className="text-[10px] text-slate-500 truncate">{me.isAdmin ? "Admin" : me.scope === "all" ? "Member · all data" : "Member · assigned only"}</div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="relative flex-1 min-w-0 flex flex-col h-full z-10">
        <div className="md:hidden flex items-center justify-between gap-3 px-4 h-14 border-b border-slate-200/60 dark:border-white/10 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl shrink-0">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <ArrowLeft className="w-4 h-4" />
            Workspace
          </Link>
          <span className="flex items-center gap-2 font-extrabold text-sm">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
              <Target className="w-3.5 h-3.5 text-white" />
            </span>
            Leads CRM
          </span>
          <ThemeToggle />
        </div>

        <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-24 md:pb-0">
          <motion.div
            key={pageKey}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0, transitionEnd: { transform: "none" } }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </main>

        {/* Mobile tab bar */}
        <nav className="md:hidden fixed bottom-3 inset-x-3 z-40 grid grid-cols-5 rounded-2xl border border-slate-200/70 dark:border-white/10 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur-xl shadow-[0_16px_40px_-16px_rgba(15,23,42,0.4)] p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn("relative flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[10px] font-bold transition-colors", active ? "text-white" : "text-slate-400")}
              >
                {active && (
                  <motion.span layoutId="crmTabActive" transition={SPRING} className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-[0_8px_18px_-8px_rgba(37,99,235,0.9)]" />
                )}
                <item.icon className="relative w-5 h-5" />
                <span className="relative">{item.short}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {me.isAdmin && <AccessModal />}
      <ListFormModal open={newListOpen} onClose={() => setNewListOpen(false)} />
    </div>
  );
}
