"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CircleAlert,
  FolderPlus,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Sparkles,
  Trophy,
  Upload,
  UserPlus,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import { LEAD_STATUS_LABELS, contactDisplayName, formatMoney, type CrmDashboardDTO } from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { PageHeader } from "@/components/crm/PageHeader";
import { DateRangePicker, StatusBadge, formatDateTime, formatTime, rangeToIso, timeAgo, type DateRange } from "@/components/crm/common";
import { color } from "@/components/crm/theme";
import { AnimatedNumber, Avatar, Card, Dropdown, EASE_OUT, Segmented, Skeleton, cn, useFeedback } from "@/components/crm/ui";

// Single-series marks use the validated slot-1 blue (dataviz reference palette), per mode.
const MARK = "bg-[#2a78d6] dark:bg-[#3987e5]";
const MARK_HEX = { light: "#2a78d6", dark: "#3987e5" };

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

function useIsDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    const el = document.documentElement;
    const update = () => setDark(el.classList.contains("dark"));
    update();
    const obs = new MutationObserver(update);
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export function DashboardView() {
  const { me, pipelines, lists } = useCrm();
  const { toast } = useFeedback();
  const [range, setRange] = React.useState<DateRange>({ preset: "30d" });
  const [pipelineId, setPipelineId] = React.useState("");
  const [data, setData] = React.useState<CrmDashboardDTO | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    crmApi
      .dashboard({ ...rangeToIso(range), pipelineId: pipelineId || undefined, tz })
      .then((res) => !cancelled && setData(res.dashboard))
      .catch((e) => !cancelled && toast(e.message, "error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range, pipelineId, toast]);

  const t = data?.totals;
  const hasRange = range.preset !== "all";
  const delta = t && hasRange && t.leadsPrevRange > 0 ? ((t.leadsInRange - t.leadsPrevRange) / t.leadsPrevRange) * 100 : null;
  const spark = data?.leadsOverTime.slice(-14).map((d) => d.count) || [];

  return (
    <div className="flex flex-col pb-10">
      <PageHeader
        icon={LayoutDashboard}
        title={`${greeting()}, ${me.username} 👋`}
        subtitle="Your leads, pipeline and follow-ups at a glance"
        actions={
          <>
            <DateRangePicker value={range} onChange={setRange} align="end" className="h-8 text-xs" />
            {pipelines.length > 1 && (
              <Dropdown
                size="sm"
                width={220}
                value={pipelineId || data?.pipeline?.id || ""}
                onChange={setPipelineId}
                options={pipelines.map((p) => ({ value: p.id, label: p.name, icon: Kanban }))}
                className="w-48"
                label="Pipeline"
              />
            )}
          </>
        }
      />

      {!data ? (
        <DashboardSkeleton />
      ) : (
        <div className={cn("px-4 sm:px-6 lg:px-8 flex flex-col gap-5 transition-opacity duration-300", loading && "opacity-60")}>
          {data.totals.leads === 0 && <GettingStarted hasLists={lists.length > 0} />}

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <StatTile i={0} icon={UsersRound} tone="from-blue-500 to-indigo-500" label="Total leads" value={t!.leads} hint={`${lists.length} list${lists.length === 1 ? "" : "s"}`} href="/crm/contacts" visual={<Sparkline values={spark} />} />
            <StatTile
              i={1}
              icon={UserPlus}
              tone="from-sky-400 to-blue-500"
              label={hasRange ? "New leads in range" : "New leads"}
              value={t!.leadsInRange}
              delta={delta}
              hint={delta === null ? (hasRange ? "No earlier data to compare" : "All time") : "vs previous period"}
            />
            <StatTile i={2} icon={Kanban} tone="from-violet-500 to-fuchsia-500" label="Open pipeline" value={t!.openValue} format={(n) => formatMoney(n, true)} hint={`${t!.openOpportunities} open deal${t!.openOpportunities === 1 ? "" : "s"}`} href="/crm/opportunities" />
            <StatTile i={3} icon={Wallet} tone="from-emerald-400 to-teal-500" label="Won revenue" value={t!.wonValue} format={(n) => formatMoney(n, true)} hint={`${t!.wonCount} deal${t!.wonCount === 1 ? "" : "s"} won`} />
            <StatTile i={4} icon={Trophy} tone="from-amber-400 to-orange-500" label="Win rate" value={t!.conversionRate} format={(n) => `${n.toFixed(1)}%`} hint={`${t!.wonCount} won · ${t!.lostCount} lost`} visual={<Gauge value={t!.conversionRate / 100} />} />
            <StatTile
              i={5}
              icon={CalendarClock}
              tone="from-rose-400 to-pink-500"
              label="Follow-ups (7 days)"
              value={t!.upcomingAppointments}
              hint={t!.overdueTasks ? `${t!.overdueTasks} overdue task${t!.overdueTasks === 1 ? "" : "s"}` : `${t!.openTasks} open tasks`}
              warn={t!.overdueTasks > 0}
              href="/crm/calendar"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
            <LeadsOverTime series={data.leadsOverTime} className="xl:col-span-2" />
            <PipelineFunnel pipeline={data.pipeline} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <BarListCard
              i={0}
              title="Leads by list"
              empty="No leads in this period"
              rows={data.byList.map((l) => ({ key: l.id, label: l.name, value: l.count, dot: color(l.color).dot, href: l.id === "none" ? "/crm/contacts?list=none" : `/crm/contacts?list=${l.id}` }))}
            />
            <BarListCard
              i={1}
              title="Leads by status"
              empty="No leads in this period"
              rows={data.byStatus.filter((s) => s.count > 0).map((s) => ({ key: s.status, label: LEAD_STATUS_LABELS[s.status], value: s.count, badge: <StatusBadge status={s.status} /> }))}
            />
            <BarListCard i={2} title="Lead sources" empty="No sources recorded" rows={data.bySource.map((s) => ({ key: s.source, label: s.source, value: s.count }))} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <UpcomingCard items={data.upcoming} />
            <TasksCard items={data.tasks} />
            <RecentLeadsCard items={data.recentLeads} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 flex flex-col gap-5">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[132px] rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Skeleton className="h-[330px] rounded-2xl xl:col-span-2" />
        <Skeleton className="h-[330px] rounded-2xl" />
      </div>
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const isDark = useIsDark();
  if (values.length < 2) return null;
  const w = 84;
  const h = 26;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - (v / max) * (h - 6)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <motion.path d={d} fill="none" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="stroke-slate-300 dark:stroke-slate-600" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: EASE_OUT }} />
      <motion.circle cx={last[0]} cy={last[1]} r={3.5} fill={isDark ? MARK_HEX.dark : MARK_HEX.light} strokeWidth={2} className="stroke-white dark:stroke-[#0F172A]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.9 }} />
    </svg>
  );
}

// Radial meter: fill in the accent, track a lighter step of the same hue.
function Gauge({ value }: { value: number }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90" aria-hidden>
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="5" className="stroke-[#cde2fb] dark:stroke-[#104281]" />
      <motion.circle cx="20" cy="20" r={r} fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-[#2a78d6] dark:stroke-[#3987e5]" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 1.2, ease: EASE_OUT }} />
    </svg>
  );
}

function StatTile({
  i,
  icon: Icon,
  tone,
  label,
  value,
  format,
  hint,
  delta,
  warn,
  href,
  visual,
}: {
  i: number;
  icon: LucideIcon;
  tone: string;
  label: string;
  value: number;
  format?: (n: number) => string;
  hint?: string;
  delta?: number | null;
  warn?: boolean;
  href?: string;
  visual?: React.ReactNode;
}) {
  const body = (
    <Card
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE_OUT, delay: i * 0.05 }}
      hover={!!href}
      className="relative overflow-hidden p-4 h-full flex flex-col gap-2"
    >
      <span className={cn("pointer-events-none absolute -right-10 -top-10 w-28 h-28 rounded-full bg-gradient-to-br opacity-[0.12] blur-xl", tone)} />
      <div className="relative flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">{label}</span>
        <span className={cn("w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-[0_8px_16px_-8px_rgba(15,23,42,0.5)]", tone)}>
          <Icon className="w-4 h-4 text-white" />
        </span>
      </div>
      <div className="relative flex items-end justify-between gap-2">
        <div className="text-[26px] leading-none font-extrabold text-slate-900 dark:text-white tracking-tight">
          <AnimatedNumber value={value} format={format || ((n) => compact(Math.round(n)))} />
        </div>
        {visual}
      </div>
      <div className="relative flex items-center gap-1.5 text-[11px] min-w-0 mt-auto">
        {delta !== undefined && delta !== null && (
          <span className={cn("inline-flex items-center gap-0.5 font-bold rounded-full px-1.5 py-0.5", delta >= 0 ? "text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10" : "text-rose-700 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10")}>
            {delta >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {delta >= 0 ? "+" : ""}
            {Math.round(delta)}%
          </span>
        )}
        {warn && <CircleAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
        <span className={cn("truncate", warn ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-slate-400")}>{hint}</span>
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

function CardHeader({ title, subtitle, right }: { title: string; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3">
      <div className="min-w-0">
        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

function niceMax(value: number) {
  if (value <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function bucketize(series: { date: string; count: number }[]) {
  if (series.length <= 62) return { unit: "day" as const, buckets: series.map((s) => ({ key: s.date, start: s.date, count: s.count })) };
  const buckets: { key: string; start: string; count: number }[] = [];
  for (let i = 0; i < series.length; i += 7) {
    const chunk = series.slice(i, i + 7);
    buckets.push({ key: chunk[0].date, start: chunk[0].date, count: chunk.reduce((a, b) => a + b.count, 0) });
  }
  return { unit: "week" as const, buckets };
}

const labelDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Monotone cubic path (no overshoot below zero).
function monotonePath(pts: [number, number][]) {
  if (pts.length < 2) return "";
  const n = pts.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    slope.push((pts[i + 1][1] - pts[i][1]) / (dx[i] || 1));
  }
  const m: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) m.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  m.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + m[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - m[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

function LeadsOverTime({ series, className }: { series: { date: string; count: number }[]; className?: string }) {
  const [mode, setMode] = React.useState<"chart" | "table">("chart");
  const [hover, setHover] = React.useState<number | null>(null);
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const isDark = useIsDark();
  const { unit, buckets } = bucketize(series);
  const total = buckets.reduce((a, b) => a + b.count, 0);
  const peak = Math.max(0, ...buckets.map((b) => b.count));
  const max = niceMax(peak);
  const H = 210;
  const PAD = { l: 34, r: 12, t: 12, b: 26 };
  const innerW = Math.max(10, width - PAD.l - PAD.r);
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (buckets.length <= 1 ? innerW / 2 : (i / (buckets.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - (v / max) * innerH;
  const pts = buckets.map((b, i) => [x(i), y(b.count)] as [number, number]);
  const line = monotonePath(pts);
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${PAD.t + innerH} L${pts[0][0]},${PAD.t + innerH} Z` : "";
  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
  const stroke = isDark ? MARK_HEX.dark : MARK_HEX.light;
  const last = pts[pts.length - 1];
  const hv = hover !== null ? buckets[hover] : null;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const rel = e.clientX - rect.left;
    const idx = buckets.length <= 1 ? 0 : Math.round((rel / rect.width) * (buckets.length - 1));
    setHover(Math.max(0, Math.min(buckets.length - 1, idx)));
  };

  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.15 }} className={className}>
      <CardHeader
        title="New leads over time"
        subtitle={
          <>
            <AnimatedNumber value={total} /> leads · per {unit}
          </>
        }
        right={
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "chart", label: "Chart" },
              { value: "table", label: "Table" },
            ]}
          />
        }
      />
      <AnimatePresence mode="wait" initial={false}>
        {mode === "table" ? (
          <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 pb-5 max-h-[230px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="py-1.5">{unit === "week" ? "Week of" : "Date"}</th>
                  <th className="py-1.5 text-right">New leads</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {[...buckets].reverse().map((b) => (
                  <tr key={b.key}>
                    <td className="py-1.5 text-slate-600 dark:text-slate-300">{labelDate(b.start)}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100">{b.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        ) : (
          <motion.div key="chart" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} ref={wrapRef} className="relative px-3 pb-3">
            {width > 0 && (
              <svg width={width} height={H} role="img" aria-label={`New leads per ${unit}, peak ${peak}`} className="block">
                <defs>
                  <linearGradient id="crm-area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={stroke} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                {ticks.map((tick) => (
                  <g key={tick}>
                    <line x1={PAD.l} x2={PAD.l + innerW} y1={y(tick)} y2={y(tick)} className="stroke-slate-100 dark:stroke-white/[0.06]" strokeWidth={1} />
                    <text x={PAD.l - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-slate-400 text-[10px] tabular-nums">
                      {compact(tick)}
                    </text>
                  </g>
                ))}
                {buckets.map((b, i) =>
                  i % labelEvery === 0 ? (
                    <text key={b.key} x={x(i)} y={H - 6} textAnchor="middle" className="fill-slate-400 text-[10px]">
                      {labelDate(b.start)}
                    </text>
                  ) : null
                )}
                <motion.path d={area} fill="url(#crm-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
                <motion.path d={line} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: EASE_OUT }} />
                {last && hover === null && (
                  <motion.circle cx={last[0]} cy={last[1]} r={4.5} fill={stroke} strokeWidth={2} className="stroke-white dark:stroke-[#0F172A]" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.1 }} />
                )}
                {hover !== null && pts[hover] && (
                  <g>
                    <line x1={pts[hover][0]} x2={pts[hover][0]} y1={PAD.t} y2={PAD.t + innerH} className="stroke-slate-300 dark:stroke-white/20" strokeWidth={1} />
                    <circle cx={pts[hover][0]} cy={pts[hover][1]} r={5} fill={stroke} strokeWidth={2} className="stroke-white dark:stroke-[#0F172A]" />
                  </g>
                )}
                <rect x={PAD.l} y={PAD.t} width={innerW} height={innerH} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
              </svg>
            )}
            <AnimatePresence>
              {hv && hover !== null && pts[hover] && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="pointer-events-none absolute z-10 rounded-xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-3 py-2 text-[11px] shadow-xl whitespace-nowrap"
                  style={{ left: Math.min(Math.max(pts[hover][0] + 12, 12), width - 130), top: Math.max(pts[hover][1] - 52, 4) }}
                >
                  <div className="font-extrabold text-sm tabular-nums">
                    {hv.count} lead{hv.count === 1 ? "" : "s"}
                  </div>
                  <div className="opacity-70">{unit === "week" ? `Week of ${labelDate(hv.start)}` : labelDate(hv.start)}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

function PipelineFunnel({ pipeline }: { pipeline: CrmDashboardDTO["pipeline"] }) {
  const [hover, setHover] = React.useState<string | null>(null);
  const stages = pipeline?.stages || [];
  const max = Math.max(1, ...stages.map((s) => s.count));
  const total = stages.reduce((a, s) => a + s.count, 0);
  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.2 }}>
      <CardHeader
        title="Pipeline funnel"
        subtitle={pipeline ? `${pipeline.name} · ${total} active deals` : "No pipeline"}
        right={
          <Link href="/crm/opportunities" className="group text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1 shrink-0">
            Board <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      />
      <div className="px-5 pb-5 flex flex-col gap-[2px]">
        {stages.map((s, i) => {
          const share = s.count / max;
          const prev = i > 0 ? stages[i - 1].count : null;
          return (
            <div key={s.id} className="relative" onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)}>
              <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                <span className="flex items-center gap-1.5 min-w-0 font-semibold text-slate-700 dark:text-slate-200">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", color(s.color).dot)} />
                  <span className="truncate">{s.name}</span>
                </span>
                <span className="text-slate-500 tabular-nums shrink-0">
                  <b className="text-slate-800 dark:text-slate-100">{s.count}</b> · {formatMoney(s.value, true)}
                </span>
              </div>
              <div className="h-7 flex justify-center mb-1.5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(share * 100, s.count ? 8 : 2)}%` }}
                  transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.25 + i * 0.07 }}
                  className={cn("h-full rounded-lg transition-opacity", MARK, hover && hover !== s.id && "opacity-40", !s.count && "opacity-25")}
                />
              </div>
              <AnimatePresence>
                {hover === s.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="pointer-events-none absolute right-0 -top-8 z-10 rounded-xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-2.5 py-1.5 text-[11px] shadow-xl whitespace-nowrap"
                  >
                    {total ? Math.round((s.count / total) * 100) : 0}% of active deals
                    {prev !== null && prev > 0 && ` · ${Math.round((s.count / prev) * 100)}% of previous stage`}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
        {!stages.length && <div className="text-xs text-slate-400 py-6 text-center">No stages yet</div>}
      </div>
    </Card>
  );
}

function BarListCard({
  i,
  title,
  rows,
  empty,
}: {
  i: number;
  title: string;
  empty: string;
  rows: { key: string; label: string; value: number; dot?: string; badge?: React.ReactNode; href?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.25 + i * 0.05 }}>
      <CardHeader title={title} subtitle={`${total.toLocaleString()} leads`} />
      <div className="px-5 pb-5 flex flex-col gap-3.5">
        {rows.length === 0 && <div className="text-xs text-slate-400 py-6 text-center">{empty}</div>}
        {rows.map((r, idx) => {
          const label = (
            <span className="flex items-center gap-2 min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200">
              {r.badge || (
                <>
                  {r.dot && <span className={cn("w-2 h-2 rounded-full shrink-0", r.dot)} />}
                  <span className="truncate">{r.label}</span>
                </>
              )}
            </span>
          );
          return (
            <div key={r.key} className="group relative" title={`${total ? Math.round((r.value / total) * 100) : 0}% of leads`}>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                {r.href ? (
                  <Link href={r.href} className="min-w-0 hover:underline">
                    {label}
                  </Link>
                ) : (
                  label
                )}
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                  {r.value.toLocaleString()} <span className="text-[10px] font-semibold text-slate-400">· {total ? Math.round((r.value / total) * 100) : 0}%</span>
                </span>
              </div>
              <div className="h-2 rounded-r-full bg-slate-100/80 dark:bg-white/[0.05] overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(r.value / max) * 100}%` }}
                  transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.35 + idx * 0.06 }}
                  className={cn("h-full rounded-r-[4px] group-hover:brightness-110", MARK)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

const listAnim = (i: number) => ({ initial: { opacity: 0, x: -8 }, animate: { opacity: 1, x: 0 }, transition: { delay: 0.35 + i * 0.05 } });

function UpcomingCard({ items }: { items: CrmDashboardDTO["upcoming"] }) {
  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.3 }}>
      <CardHeader
        title="Upcoming appointments"
        right={
          <Link href="/crm/calendar" className="group text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1">
            Calendar <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      />
      <ul className="px-3 pb-4 flex flex-col">
        {items.length === 0 && <li className="px-2 py-6 text-xs text-slate-400 text-center">Nothing booked yet</li>}
        {items.map((a, i) => {
          const d = new Date(a.start);
          return (
            <motion.li key={a.id} {...listAnim(i)}>
              <Link href={a.contactId ? `/crm/contacts/${a.contactId}` : "/crm/calendar"} className="group flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <div className="w-11 shrink-0 rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 text-center py-1 text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)] transition-transform group-hover:scale-105">
                  <div className="text-[9px] font-bold uppercase opacity-80">{d.toLocaleDateString("en-US", { month: "short" })}</div>
                  <div className="text-sm font-extrabold leading-none">{d.getDate()}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{a.contact?.businessName || a.title}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {formatTime(a.start)} · {a.contact?.phone || a.title}
                  </div>
                </div>
                {a.assignedTo && <Avatar name={a.assignedTo} size="xs" />}
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}

function TasksCard({ items }: { items: CrmDashboardDTO["tasks"] }) {
  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.35 }}>
      <CardHeader title="Tasks to do" subtitle="Soonest due first" />
      <ul className="px-3 pb-4 flex flex-col">
        {items.length === 0 && <li className="px-2 py-6 text-xs text-slate-400 text-center">All caught up 🎉</li>}
        {items.map((task, i) => {
          const overdue = task.dueDate && new Date(task.dueDate) < new Date();
          return (
            <motion.li key={task.id} {...listAnim(i)}>
              <Link href={`/crm/contacts/${task.contactId}`} className="flex items-start gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <span className={cn("mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0", overdue ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-slate-100 text-slate-500 dark:bg-white/5")}>
                  <ListTodo className="w-3.5 h-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{task.title}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {task.contactName}
                    {task.dueDate && (
                      <span className={cn(overdue && "text-rose-600 dark:text-rose-400 font-semibold")}>
                        {" "}
                        · {overdue ? "Overdue, " : ""}
                        {formatDateTime(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}

function RecentLeadsCard({ items }: { items: CrmDashboardDTO["recentLeads"] }) {
  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.4 }}>
      <CardHeader
        title="Recently added leads"
        right={
          <Link href="/crm/contacts" className="group text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1">
            All contacts <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        }
      />
      <ul className="px-3 pb-4 flex flex-col">
        {items.length === 0 && <li className="px-2 py-6 text-xs text-slate-400 text-center">No leads yet</li>}
        {items.map((c, i) => {
          const name = contactDisplayName(c);
          return (
            <motion.li key={c.id} {...listAnim(i)}>
              <Link href={`/crm/contacts/${c.id}`} className="group flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                <Avatar name={name} size="sm" className="transition-transform group-hover:scale-110" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{timeAgo(c.createdAt)}</div>
                </div>
                <StatusBadge status={c.status} />
              </Link>
            </motion.li>
          );
        })}
      </ul>
    </Card>
  );
}

function GettingStarted({ hasLists }: { hasLists: boolean }) {
  const steps = [
    { icon: FolderPlus, title: "Create a lead list", text: "e.g. Pakistani Leads, USA Magician Leads", href: "/crm/contacts", done: hasLists },
    { icon: Upload, title: "Add or import leads", text: "Type into the sheet or upload a CSV", href: "/crm/contacts", done: false },
    { icon: Kanban, title: "Move interested leads to the pipeline", text: "Track Demo → Verbal yes → Won", href: "/crm/opportunities", done: false },
    { icon: CalendarClock, title: "Book follow-ups", text: "Connect Google Calendar to sync meetings", href: "/crm/calendar", done: false },
  ];
  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden p-5 sm:p-6 bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 border-0 text-white">
      <motion.span animate={{ y: [0, -14, 0] }} transition={{ duration: 8, repeat: Infinity }} className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-xl" />
      <span className="absolute right-10 bottom-4 w-14 h-14 rounded-2xl border-2 border-white/20 rotate-12" />
      <div className="relative flex items-center gap-2 text-sm font-extrabold">
        <Sparkles className="w-4 h-4" /> Welcome to Leads CRM
      </div>
      <p className="relative text-xs text-blue-100 mt-1">Four steps to get your sales process running:</p>
      <div className="relative grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mt-4">
        {steps.map((s, i) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }} whileHover={{ y: -3 }}>
            <Link href={s.href} className="rounded-2xl bg-white/10 hover:bg-white/15 transition-colors p-3.5 flex gap-3 h-full">
              <span className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0 text-xs font-extrabold">{s.done ? "✓" : i + 1}</span>
              <span className="min-w-0">
                <span className="block text-xs font-bold">{s.title}</span>
                <span className="block text-[11px] text-blue-100 mt-0.5">{s.text}</span>
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
