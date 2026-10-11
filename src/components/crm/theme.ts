import type { AppointmentStatus, LeadStatus, OpportunityStatus } from "@/lib/crm/types";

// Full class strings so Tailwind can see them at build time.
export const COLORS = {
  slate: {
    dot: "bg-slate-400",
    soft: "bg-slate-100 text-slate-700 ring-slate-500/15 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-400/20",
    text: "text-slate-600 dark:text-slate-300",
    bar: "bg-slate-400",
    topBorder: "border-t-slate-400",
    leftBorder: "border-l-slate-400",
    event: "bg-slate-100 text-slate-800 border-slate-400 dark:bg-slate-500/20 dark:text-slate-100",
    hex: "#94a3b8",
  },
  blue: {
    dot: "bg-blue-500",
    soft: "bg-blue-50 text-blue-700 ring-blue-600/15 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/20",
    text: "text-blue-600 dark:text-blue-400",
    bar: "bg-blue-500",
    topBorder: "border-t-blue-500",
    leftBorder: "border-l-blue-500",
    event: "bg-blue-50 text-blue-900 border-blue-500 dark:bg-blue-500/20 dark:text-blue-100",
    hex: "#3b82f6",
  },
  sky: {
    dot: "bg-sky-500",
    soft: "bg-sky-50 text-sky-700 ring-sky-600/15 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-400/20",
    text: "text-sky-600 dark:text-sky-400",
    bar: "bg-sky-500",
    topBorder: "border-t-sky-500",
    leftBorder: "border-l-sky-500",
    event: "bg-sky-50 text-sky-900 border-sky-500 dark:bg-sky-500/20 dark:text-sky-100",
    hex: "#0ea5e9",
  },
  indigo: {
    dot: "bg-indigo-500",
    soft: "bg-indigo-50 text-indigo-700 ring-indigo-600/15 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-400/20",
    text: "text-indigo-600 dark:text-indigo-400",
    bar: "bg-indigo-500",
    topBorder: "border-t-indigo-500",
    leftBorder: "border-l-indigo-500",
    event: "bg-indigo-50 text-indigo-900 border-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-100",
    hex: "#6366f1",
  },
  violet: {
    dot: "bg-violet-500",
    soft: "bg-violet-50 text-violet-700 ring-violet-600/15 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-400/20",
    text: "text-violet-600 dark:text-violet-400",
    bar: "bg-violet-500",
    topBorder: "border-t-violet-500",
    leftBorder: "border-l-violet-500",
    event: "bg-violet-50 text-violet-900 border-violet-500 dark:bg-violet-500/20 dark:text-violet-100",
    hex: "#8b5cf6",
  },
  pink: {
    dot: "bg-pink-500",
    soft: "bg-pink-50 text-pink-700 ring-pink-600/15 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-400/20",
    text: "text-pink-600 dark:text-pink-400",
    bar: "bg-pink-500",
    topBorder: "border-t-pink-500",
    leftBorder: "border-l-pink-500",
    event: "bg-pink-50 text-pink-900 border-pink-500 dark:bg-pink-500/20 dark:text-pink-100",
    hex: "#ec4899",
  },
  rose: {
    dot: "bg-rose-500",
    soft: "bg-rose-50 text-rose-700 ring-rose-600/15 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-400/20",
    text: "text-rose-600 dark:text-rose-400",
    bar: "bg-rose-500",
    topBorder: "border-t-rose-500",
    leftBorder: "border-l-rose-500",
    event: "bg-rose-50 text-rose-900 border-rose-500 dark:bg-rose-500/20 dark:text-rose-100",
    hex: "#f43f5e",
  },
  orange: {
    dot: "bg-orange-500",
    soft: "bg-orange-50 text-orange-700 ring-orange-600/15 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/20",
    text: "text-orange-600 dark:text-orange-400",
    bar: "bg-orange-500",
    topBorder: "border-t-orange-500",
    leftBorder: "border-l-orange-500",
    event: "bg-orange-50 text-orange-900 border-orange-500 dark:bg-orange-500/20 dark:text-orange-100",
    hex: "#f97316",
  },
  amber: {
    dot: "bg-amber-500",
    soft: "bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-400/20",
    text: "text-amber-600 dark:text-amber-400",
    bar: "bg-amber-500",
    topBorder: "border-t-amber-500",
    leftBorder: "border-l-amber-500",
    event: "bg-amber-50 text-amber-900 border-amber-500 dark:bg-amber-500/20 dark:text-amber-100",
    hex: "#f59e0b",
  },
  lime: {
    dot: "bg-lime-500",
    soft: "bg-lime-50 text-lime-700 ring-lime-600/15 dark:bg-lime-500/15 dark:text-lime-300 dark:ring-lime-400/20",
    text: "text-lime-600 dark:text-lime-400",
    bar: "bg-lime-500",
    topBorder: "border-t-lime-500",
    leftBorder: "border-l-lime-500",
    event: "bg-lime-50 text-lime-900 border-lime-500 dark:bg-lime-500/20 dark:text-lime-100",
    hex: "#84cc16",
  },
  emerald: {
    dot: "bg-emerald-500",
    soft: "bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20",
    text: "text-emerald-600 dark:text-emerald-400",
    bar: "bg-emerald-500",
    topBorder: "border-t-emerald-500",
    leftBorder: "border-l-emerald-500",
    event: "bg-emerald-50 text-emerald-900 border-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-100",
    hex: "#10b981",
  },
  teal: {
    dot: "bg-teal-500",
    soft: "bg-teal-50 text-teal-700 ring-teal-600/15 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-400/20",
    text: "text-teal-600 dark:text-teal-400",
    bar: "bg-teal-500",
    topBorder: "border-t-teal-500",
    leftBorder: "border-l-teal-500",
    event: "bg-teal-50 text-teal-900 border-teal-500 dark:bg-teal-500/20 dark:text-teal-100",
    hex: "#14b8a6",
  },
  cyan: {
    dot: "bg-cyan-500",
    soft: "bg-cyan-50 text-cyan-700 ring-cyan-600/15 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-400/20",
    text: "text-cyan-600 dark:text-cyan-400",
    bar: "bg-cyan-500",
    topBorder: "border-t-cyan-500",
    leftBorder: "border-l-cyan-500",
    event: "bg-cyan-50 text-cyan-900 border-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-100",
    hex: "#06b6d4",
  },
} as const;

export type ColorName = keyof typeof COLORS;
export const COLOR_NAMES = Object.keys(COLORS) as ColorName[];

export function color(name: string | undefined) {
  return COLORS[(name as ColorName) || "slate"] || COLORS.slate;
}

export const LEAD_STATUS_COLOR: Record<LeadStatus, ColorName> = {
  new: "sky",
  active: "blue",
  contacted: "indigo",
  interested: "amber",
  not_interested: "rose",
  converted: "emerald",
  dnd: "slate",
};

export const OPPORTUNITY_STATUS_COLOR: Record<OpportunityStatus, ColorName> = {
  open: "blue",
  won: "emerald",
  lost: "rose",
  abandoned: "slate",
};

export const APPOINTMENT_STATUS_COLOR: Record<AppointmentStatus, ColorName> = {
  booked: "blue",
  confirmed: "emerald",
  showed: "teal",
  noshow: "orange",
  cancelled: "rose",
};

// Stable per-user color, like GoHighLevel's calendar legend.
const USER_COLORS: ColorName[] = ["lime", "blue", "violet", "amber", "rose", "cyan", "orange", "pink", "teal", "indigo"];

export function userColor(username: string, members?: { username: string }[]): ColorName {
  if (!username) return "slate";
  const index = members?.findIndex((m) => m.username === username) ?? -1;
  if (index >= 0) return USER_COLORS[index % USER_COLORS.length];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = (hash * 31 + username.charCodeAt(i)) | 0;
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}
