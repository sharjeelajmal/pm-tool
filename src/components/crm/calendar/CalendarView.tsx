"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Link2,
  Plus,
  RefreshCw,
  Unlink,
  UsersRound,
} from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS_LABELS,
  type AppointmentStatus,
  type CrmAppointmentDTO,
  type CrmGoogleStatus,
  type GoogleBusyEvent,
} from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { PageHeader } from "@/components/crm/PageHeader";
import { formatTime } from "@/components/crm/common";
import { APPOINTMENT_STATUS_COLOR, color, userColor } from "@/components/crm/theme";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, Badge, Button, Card, Dropdown, EmptyState, Menu, Popover, Segmented, Spinner, cn, useFeedback } from "@/components/crm/ui";
import { AppointmentModal } from "@/components/crm/calendar/AppointmentModal";

type View = "month" | "week" | "day" | "list";

const HOUR_PX = 56;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay());
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function rangeFor(view: View, cursor: Date) {
  if (view === "day") {
    const from = startOfDay(cursor);
    return { from, to: addDays(from, 1), days: [from] };
  }
  if (view === "week") {
    const from = startOfWeek(cursor);
    return { from, to: addDays(from, 7), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
  }
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  if (view === "list") {
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    return { from: first, to, days: [] as Date[] };
  }
  const from = startOfWeek(first);
  return { from, to: addDays(from, 42), days: Array.from({ length: 42 }, (_, i) => addDays(from, i)) };
}

function rangeTitle(view: View, cursor: Date, days: Date[]) {
  if (view === "day") return cursor.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (view === "week") {
    const fmt = (d: Date, year: boolean) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(year && { year: "numeric" }) });
    return `${fmt(days[0], false)} – ${fmt(days[6], true)}`;
  }
  return cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

interface Block {
  id: string;
  start: Date;
  end: Date;
  appt?: CrmAppointmentDTO;
  busy?: GoogleBusyEvent;
}

// Side-by-side layout for overlapping events in one day column.
function layoutDay(blocks: Block[]) {
  const sorted = [...blocks].sort((a, b) => +a.start - +b.start || +b.end - +a.end);
  const out: { block: Block; col: number; cols: number }[] = [];
  let cluster: { block: Block; col: number }[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    cluster.forEach((c) => out.push({ ...c, cols }));
    cluster = [];
  };
  for (const block of sorted) {
    if (cluster.length && +block.start >= clusterEnd) flush();
    const used = new Set(cluster.filter((c) => +c.block.end > +block.start).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    cluster.push({ block, col });
    clusterEnd = Math.max(clusterEnd, +block.end);
  }
  if (cluster.length) flush();
  return out;
}

export function CalendarView() {
  const router = useRouter();
  const { members, me } = useCrm();
  const { toast, confirm } = useFeedback();
  const [view, setView] = React.useState<View>("week");
  const [navDir, setNavDir] = React.useState(1);
  const [cursor, setCursor] = React.useState(() => startOfDay(new Date()));
  const [hiddenUsers, setHiddenUsers] = React.useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = React.useState<"" | AppointmentStatus>("");
  const [appointments, setAppointments] = React.useState<CrmAppointmentDTO[]>([]);
  const [busy, setBusy] = React.useState<GoogleBusyEvent[]>([]);
  const [google, setGoogle] = React.useState<CrmGoogleStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [modal, setModal] = React.useState<{ open: boolean; appt: CrmAppointmentDTO | null; start?: Date | null }>({ open: false, appt: null });
  const [now, setNow] = React.useState(() => new Date());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ id: string; offsetMin: number } | null>(null);

  const { days, fromIso, toIso } = React.useMemo(() => {
    const r = rangeFor(view, cursor);
    return { days: r.days, fromIso: r.from.toISOString(), toIso: r.to.toISOString() };
  }, [view, cursor]);
  const tz = React.useMemo(() => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const short = new Date().toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop();
      return `${zone} (${short})`;
    } catch {
      return "local time";
    }
  }, []);

  React.useEffect(() => {
    if (window.innerWidth < 768) setView("day");
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Feedback after returning from Google's consent screen.
  React.useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("google");
    if (!result) return;
    const messages: Record<string, [string, "success" | "error" | "info"]> = {
      connected: ["Google Calendar connected. New appointments will sync automatically.", "success"],
      denied: ["Google access was not granted.", "error"],
      failed: ["Could not connect Google Calendar. Please try again.", "error"],
      invalid_state: ["The Google sign-in expired. Please try again.", "error"],
      not_configured: ["Google Calendar sync is not set up on the server yet (missing Google API keys).", "info"],
    };
    const [msg, kind] = messages[result] || ["", "info"];
    if (msg) toast(msg, kind);
    router.replace("/crm/calendar", { scroll: false });
  }, [router, toast]);

  const loadGoogle = React.useCallback(() => {
    crmApi.google
      .status()
      .then((res) => setGoogle(res.google))
      .catch(() => setGoogle(null));
  }, []);
  React.useEffect(() => {
    loadGoogle();
  }, [loadGoogle]);

  const googleOn = !!(google?.connected && google?.syncEnabled);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [res, busyRes] = await Promise.all([
        crmApi.appointments.list({ from: fromIso, to: toIso }),
        googleOn ? crmApi.google.busy(fromIso, toIso).catch(() => ({ events: [] })) : Promise.resolve({ events: [] }),
      ]);
      setAppointments(res.appointments);
      setBusy(busyRes.events);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [fromIso, toIso, googleOn, toast]);

  React.useEffect(() => {
    load();
  }, [load]);


  const visible = appointments.filter(
    (a) => !hiddenUsers.has(a.assignedTo || "") && (!statusFilter || a.status === statusFilter)
  );

  const shift = (dir: number) => {
    setNavDir(dir);
    if (view === "day") setCursor((c) => addDays(c, dir));
    else if (view === "week") setCursor((c) => addDays(c, dir * 7));
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1));
  };

  const upsert = (appt: CrmAppointmentDTO) =>
    setAppointments((list) => (list.some((a) => a.id === appt.id) ? list.map((a) => (a.id === appt.id ? appt : a)) : [...list, appt]));

  const reschedule = async (appt: CrmAppointmentDTO, start: Date) => {
    const duration = +new Date(appt.end) - +new Date(appt.start);
    const end = new Date(+start + duration);
    if (+start === +new Date(appt.start)) return;
    const previous = appointments;
    upsert({ ...appt, start: start.toISOString(), end: end.toISOString() });
    try {
      const res = await crmApi.appointments.update(appt.id, { start: start.toISOString(), end: end.toISOString() });
      upsert(res.appointment);
      toast(res.warning || `Moved to ${start.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}`, res.warning ? "error" : "success");
    } catch (e) {
      setAppointments(previous);
      toast((e as Error).message, "error");
    }
  };

  const disconnectGoogle = async () => {
    if (!(await confirm({ title: "Disconnect Google Calendar?", message: "Appointments will stop syncing to your Google Calendar.", confirmLabel: "Disconnect", danger: true }))) return;
    try {
      await crmApi.google.disconnect();
      toast("Google Calendar disconnected");
      loadGoogle();
      setBusy([]);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const toggleSync = async () => {
    if (!google) return;
    try {
      const res = await crmApi.google.setSync(!google.syncEnabled);
      setGoogle(res.google);
      toast(res.google.syncEnabled ? "Google sync resumed" : "Google sync paused");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const toggleUser = (username: string) =>
    setHiddenUsers((prev) => {
      const next = new Set(prev);
      if (next.has(username)) next.delete(username);
      else next.add(username);
      return next;
    });

  const googleControl = !google ? null : !google.configured ? (
    me.isAdmin ? (
      <Button size="sm" icon={Link2} onClick={() => router.push("/crm/settings?tab=integrations")}>
        Set up Google sync
      </Button>
    ) : null
  ) : !google.connected ? (
    <a href={crmApi.google.connectUrl}>
      <Button size="sm" icon={GoogleGlyph}>
        Connect Google Calendar
      </Button>
    </a>
  ) : (
    <Menu
      width={250}
      header={google.email || "Google Calendar"}
      trigger={(props) => (
        <Button {...props} size="sm" icon={GoogleGlyph}>
          <span className={cn("w-1.5 h-1.5 rounded-full", google.syncEnabled ? "bg-emerald-500" : "bg-amber-500")} />
          {google.syncEnabled ? "Google synced" : "Sync paused"}
        </Button>
      )}
      items={[
        { label: "Refresh busy times", icon: RefreshCw, onClick: load },
        { label: google.syncEnabled ? "Pause sync" : "Resume sync", icon: google.syncEnabled ? CircleX : CircleCheck, onClick: toggleSync },
        "divider",
        { label: "Disconnect", icon: Unlink, danger: true, onClick: disconnectGoogle },
      ]}
    />
  );

  return (
    <div className="flex flex-col min-h-full pb-6">
      <PageHeader
        icon={CalendarDays}
        title="Calendar"
        subtitle="Follow-ups and meetings with your leads"
        actions={
          <>
            {googleControl}
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setModal({ open: true, appt: null, start: null })}>
              New appointment
            </Button>
          </>
        }
      >
        <div className="flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={() => setCursor(startOfDay(new Date()))}>
              Today
            </Button>
            <div className="flex">
              <button type="button" onClick={() => shift(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer" aria-label="Previous">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => shift(1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer" aria-label="Next">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.h2
                key={rangeTitle(view, cursor, days)}
                initial={{ opacity: 0, y: navDir * 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: navDir * -10 }}
                transition={{ duration: 0.22 }}
                className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white"
              >
                {rangeTitle(view, cursor, days)}
              </motion.h2>
            </AnimatePresence>
            {loading && <Spinner className="w-4 h-4" />}
            <span className="hidden lg:inline text-[11px] font-mono text-slate-400 ml-2">All times in {tz}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <Popover
              width={240}
              trigger={(props) => (
                <Button {...props} size="sm" icon={UsersRound}>
                  {hiddenUsers.size ? `${members.length - [...hiddenUsers].filter((u) => members.some((m) => m.username === u)).length} of ${members.length} users` : "All users"}
                </Button>
              )}
            >
              {() => (
                <div className="flex flex-col p-1">
                  <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Show calendars</div>
                  {members.map((m) => (
                    <label key={m.username} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-xs font-semibold">
                      <input type="checkbox" checked={!hiddenUsers.has(m.username)} onChange={() => toggleUser(m.username)} className="accent-blue-600" />
                      <span className={cn("w-2.5 h-2.5 rounded-full", color(userColor(m.username, members)).dot)} />
                      {m.username}
                    </label>
                  ))}
                </div>
              )}
            </Popover>
            <Dropdown
              size="sm"
              width={170}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as AppointmentStatus | "")}
              className="w-40"
              label="Status filter"
              options={[{ value: "", label: "All statuses" }, ...APPOINTMENT_STATUSES.map((st) => ({ value: st, label: APPOINTMENT_STATUS_LABELS[st], dot: color(APPOINTMENT_STATUS_COLOR[st]).dot }))]}
            />
            <Segmented
              size="sm"
              value={view}
              onChange={(v) => {
                setNavDir(1);
                setView(v);
              }}
              options={[
                { value: "month", label: "Month" },
                { value: "week", label: "Week" },
                { value: "day", label: "Day" },
                { value: "list", label: "List" },
              ]}
            />
          </div>
        </div>
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {members.map((m) => (
            <button
              key={m.username}
              type="button"
              onClick={() => toggleUser(m.username)}
              className={cn("inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-opacity", hiddenUsers.has(m.username) && "opacity-40 line-through")}
            >
              <span className={cn("w-2.5 h-2.5 rounded-full", color(userColor(m.username, members)).dot)} />
              {m.username}
            </button>
          ))}
          {busy.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-300 dark:bg-slate-600" /> Busy · Google
            </span>
          )}
        </div>
      </PageHeader>

      <div className="px-4 sm:px-6 lg:px-8 flex-1 min-h-0">
        <AnimatePresence mode="wait" initial={false} custom={navDir}>
        <motion.div
          key={`${view}-${fromIso}`}
          initial={{ opacity: 0, x: navDir * 36 }}
          animate={{ opacity: 1, x: 0, transitionEnd: { transform: "none" } }}
          exit={{ opacity: 0, x: navDir * -36 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        >
        {view === "month" && (
          <MonthGrid
            days={days}
            cursor={cursor}
            appointments={visible}
            busy={busy}
            members={members}
            onOpen={(appt) => setModal({ open: true, appt })}
            onDay={(day) => {
              setCursor(day);
              setView("day");
            }}
            onCreate={(day) => {
              const start = new Date(day);
              start.setHours(10, 0, 0, 0);
              setModal({ open: true, appt: null, start });
            }}
          />
        )}
        {(view === "week" || view === "day") && (
          <Card className="overflow-hidden">
            <div
              ref={(el) => {
                scrollRef.current = el;
                // Open each freshly mounted time grid around business hours.
                if (el && !el.dataset.init) {
                  el.dataset.init = "1";
                  el.scrollTop = HOUR_PX * 7.5;
                }
              }}
              className="overflow-auto max-h-[calc(100dvh-300px)] min-h-[420px]"
            >
              <div style={{ minWidth: view === "week" ? 64 + 7 * 100 : undefined }}>
                {/* Day headers */}
                <div className="sticky top-0 z-20 flex bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur border-b border-slate-200 dark:border-white/10">
                  <div className="w-16 shrink-0" />
                  {days.map((day) => {
                    const today = sameDay(day, now);
                    const allDay = busy.filter((b) => b.allDay && sameDay(new Date(b.start), day));
                    return (
                      <div key={day.toISOString()} className="flex-1 min-w-[100px] border-l border-slate-100 dark:border-white/5 py-2 px-1 text-center">
                        <button type="button" onClick={() => { setCursor(day); setView("day"); }} className="cursor-pointer">
                          <div className={cn("text-[11px] font-bold uppercase", today ? "text-blue-600" : "text-slate-500")}>{WEEKDAYS[day.getDay()]}</div>
                          <div className={cn("mx-auto mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-lg font-extrabold", today ? "bg-blue-600 text-white" : "text-slate-800 dark:text-white")}>
                            {day.getDate()}
                          </div>
                        </button>
                        {allDay.map((b) => (
                          <div key={b.id} className="mt-1 truncate rounded-md bg-slate-200/80 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300" title={b.title}>
                            Busy · Google
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                {/* Grid */}
                <div className="flex relative">
                  <div className="w-16 shrink-0">
                    {Array.from({ length: 24 }, (_, h) => (
                      <div key={h} style={{ height: HOUR_PX }} className="relative">
                        {h > 0 && (
                          <span className="absolute -top-2 right-2 text-[10px] font-semibold text-slate-400">
                            {new Date(2000, 0, 1, h).toLocaleTimeString("en-US", { hour: "numeric" }).toLowerCase()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {days.map((day) => (
                    <DayColumn
                      key={day.toISOString()}
                      day={day}
                      now={now}
                      appointments={visible.filter((a) => sameDay(new Date(a.start), day))}
                      busy={busy.filter((b) => !b.allDay && sameDay(new Date(b.start), day))}
                      members={members}
                      onOpen={(appt) => setModal({ open: true, appt })}
                      onCreate={(start) => setModal({ open: true, appt: null, start })}
                      dragRef={dragRef}
                      onDropAt={(id, start) => {
                        const appt = appointments.find((a) => a.id === id);
                        if (appt) reschedule(appt, start);
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
        {view === "list" && <AgendaList appointments={visible} members={members} onOpen={(appt) => setModal({ open: true, appt })} />}
        </motion.div>
        </AnimatePresence>
      </div>

      <AppointmentModal
        open={modal.open}
        appointment={modal.appt}
        defaultStart={modal.start}
        onClose={() => setModal({ open: false, appt: null })}
        onSaved={upsert}
        onDeleted={(id) => setAppointments((list) => list.filter((a) => a.id !== id))}
      />
    </div>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9l3.7-2.8z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

function DayColumn({
  day,
  now,
  appointments,
  busy,
  members,
  onOpen,
  onCreate,
  dragRef,
  onDropAt,
}: {
  day: Date;
  now: Date;
  appointments: CrmAppointmentDTO[];
  busy: GoogleBusyEvent[];
  members: { username: string }[];
  onOpen: (appt: CrmAppointmentDTO) => void;
  onCreate: (start: Date) => void;
  dragRef: React.MutableRefObject<{ id: string; offsetMin: number } | null>;
  onDropAt: (id: string, start: Date) => void;
}) {
  const [ghostTop, setGhostTop] = React.useState<number | null>(null);
  const blocks: Block[] = [
    ...appointments.map((a) => ({ id: a.id, start: new Date(a.start), end: new Date(a.end), appt: a })),
    ...busy.map((b) => ({ id: `g-${b.id}`, start: new Date(b.start), end: new Date(b.end), busy: b })),
  ];
  const laid = layoutDay(blocks);
  const isToday = sameDay(day, now);
  const nowTop = (now.getHours() * 60 + now.getMinutes()) * (HOUR_PX / 60);

  const minutesAt = (e: React.MouseEvent | React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return Math.max(0, Math.min(24 * 60 - 15, ((e.clientY - rect.top) / HOUR_PX) * 60));
  };
  const at = (minutes: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, Math.round(minutes / 15) * 15);

  return (
    <div
      className={cn("flex-1 min-w-[100px] relative border-l border-slate-100 dark:border-white/5 cursor-pointer", isToday && "bg-blue-50/30 dark:bg-blue-500/[0.03]")}
      style={{ height: HOUR_PX * 24 }}
      onClick={(e) => onCreate(at(Math.floor(minutesAt(e) / 30) * 30))}
      onDragOver={(e) => {
        if (!dragRef.current) return;
        e.preventDefault();
        const minutes = minutesAt(e) - dragRef.current.offsetMin;
        setGhostTop(Math.round(Math.max(0, minutes) / 15) * 15 * (HOUR_PX / 60));
      }}
      onDragLeave={() => setGhostTop(null)}
      onDrop={(e) => {
        e.preventDefault();
        setGhostTop(null);
        const drag = dragRef.current;
        if (!drag) return;
        onDropAt(drag.id, at(Math.max(0, minutesAt(e) - drag.offsetMin)));
        dragRef.current = null;
      }}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <div key={h} style={{ top: h * HOUR_PX, height: HOUR_PX }} className="absolute inset-x-0 border-t border-slate-100 dark:border-white/5">
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100/70 dark:border-white/[0.03]" />
        </div>
      ))}

      {ghostTop !== null && <div className="absolute inset-x-1 h-6 rounded-md border-2 border-dashed border-blue-500 bg-blue-500/10 z-20 pointer-events-none" style={{ top: ghostTop }} />}

      {laid.map(({ block, col, cols }) => {
        const startMin = block.start.getHours() * 60 + block.start.getMinutes();
        const duration = Math.max(20, (+block.end - +block.start) / 60000);
        const style: React.CSSProperties = {
          top: startMin * (HOUR_PX / 60),
          height: Math.min(duration, 24 * 60 - startMin) * (HOUR_PX / 60) - 2,
          left: `calc(${(col / cols) * 100}% + 2px)`,
          width: `calc(${100 / cols}% - 4px)`,
        };
        if (block.busy) {
          return (
            <div
              key={block.id}
              style={style}
              title={`${block.busy.title} · ${formatTime(block.start)} – ${formatTime(block.end)}`}
              onClick={(e) => e.stopPropagation()}
              className="crm-pop absolute z-[5] rounded-lg bg-slate-200/90 dark:bg-white/10 border border-slate-300/70 dark:border-white/10 px-1.5 py-1 overflow-hidden text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(148,163,184,0.18)_6px,rgba(148,163,184,0.18)_12px)] cursor-default"
            >
              Busy · Google
            </div>
          );
        }
        const appt = block.appt!;
        const c = color(userColor(appt.assignedTo, members));
        const short = duration <= 30;
        return (
          <div
            key={block.id}
            style={style}
            draggable
            onDragStart={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              dragRef.current = { id: appt.id, offsetMin: ((e.clientY - rect.top) / HOUR_PX) * 60 };
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", appt.id);
            }}
            onDragEnd={() => (dragRef.current = null)}
            onClick={(e) => {
              e.stopPropagation();
              onOpen(appt);
            }}
            title={`${appt.title}${appt.contact?.businessName ? ` · ${appt.contact.businessName}` : ""}`}
            className={cn(
              "crm-pop absolute z-10 rounded-lg border-l-[3px] px-1.5 overflow-hidden cursor-pointer shadow-sm hover:shadow-lg hover:z-30 hover:-translate-y-px transition-[box-shadow,transform]",
              c.event,
              short ? "py-0.5 flex items-center gap-1" : "py-1",
              appt.status === "showed" && "pr-4",
              appt.status === "cancelled" && "opacity-50 line-through",
              appt.status === "noshow" && "opacity-70"
            )}
          >
            <div className="text-[11px] font-bold leading-tight truncate">
              {appt.contact?.businessName || appt.title}
              {short && <span className="font-medium opacity-70"> · {formatTime(appt.start)}</span>}
            </div>
            {!short && (
              <div className="text-[10px] opacity-75 truncate">
                {formatTime(appt.start)} – {formatTime(appt.end)}
              </div>
            )}
            {!short && duration >= 60 && appt.contact?.phone && <div className="text-[10px] opacity-70 truncate">{appt.contact.phone}</div>}
            {appt.status === "showed" && <CircleCheck className="absolute top-1 right-1 w-3 h-3 text-emerald-600" />}
          </div>
        );
      })}

      {isToday && (
        <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: nowTop }}>
          <div className="relative h-0.5 bg-rose-500">
            <span className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-rose-500" />
          </div>
        </div>
      )}
    </div>
  );
}

function MonthGrid({
  days,
  cursor,
  appointments,
  busy,
  members,
  onOpen,
  onDay,
  onCreate,
}: {
  days: Date[];
  cursor: Date;
  appointments: CrmAppointmentDTO[];
  busy: GoogleBusyEvent[];
  members: { username: string }[];
  onOpen: (appt: CrmAppointmentDTO) => void;
  onDay: (day: Date) => void;
  onCreate: (day: Date) => void;
}) {
  const today = new Date();
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-white/10">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {days.map((day) => {
          const items = appointments.filter((a) => sameDay(new Date(a.start), day)).sort((a, b) => +new Date(a.start) - +new Date(b.start));
          const busyCount = busy.filter((b) => sameDay(new Date(b.start), day)).length;
          const inMonth = day.getMonth() === cursor.getMonth();
          const isToday = sameDay(day, today);
          return (
            <div
              key={day.toISOString()}
              onClick={() => onCreate(day)}
              className={cn(
                "min-h-[96px] sm:min-h-[120px] border-r border-b border-slate-100 dark:border-white/5 p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-slate-50/70 dark:hover:bg-white/[0.02]",
                !inMonth && "bg-slate-50/60 dark:bg-white/[0.01]"
              )}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDay(day);
                }}
                className={cn(
                  "self-start w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center cursor-pointer",
                  isToday ? "bg-blue-600 text-white" : inMonth ? "text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10" : "text-slate-400"
                )}
              >
                {day.getDate()}
              </button>
              {items.slice(0, 3).map((a) => {
                const c = color(userColor(a.assignedTo, members));
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(a);
                    }}
                    className={cn("crm-pop w-full text-left truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold cursor-pointer hover:brightness-95 transition", c.event, a.status === "cancelled" && "line-through opacity-50")}
                  >
                    <span className="hidden sm:inline opacity-70">{formatTime(a.start)} </span>
                    {a.contact?.businessName || a.title}
                  </button>
                );
              })}
              {items.length > 3 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDay(day);
                  }}
                  className="text-[10px] font-bold text-blue-600 text-left px-1 cursor-pointer hover:underline"
                >
                  +{items.length - 3} more
                </button>
              )}
              {busyCount > 0 && <span className="text-[9px] font-semibold text-slate-400 px-1">{busyCount} busy · Google</span>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function AgendaList({
  appointments,
  members,
  onOpen,
}: {
  appointments: CrmAppointmentDTO[];
  members: { username: string }[];
  onOpen: (appt: CrmAppointmentDTO) => void;
}) {
  const groups = new Map<string, CrmAppointmentDTO[]>();
  [...appointments]
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
    .forEach((a) => {
      const key = startOfDay(new Date(a.start)).toISOString();
      groups.set(key, [...(groups.get(key) || []), a]);
    });

  if (groups.size === 0) {
    return (
      <Card>
        <EmptyState icon={CalendarDays} title="No appointments this month" description="Book follow-ups from a lead's profile or click “New appointment”." />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([key, items]) => {
        const day = new Date(key);
        return (
          <Card key={key} className="overflow-hidden">
            <div className={cn("px-4 py-2.5 border-b border-slate-100 dark:border-white/5 text-xs font-extrabold", sameDay(day, new Date()) ? "text-blue-600" : "text-slate-700 dark:text-slate-200")}>
              {day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              {sameDay(day, new Date()) && " · Today"}
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {items.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => onOpen(a)} className="w-full flex items-center gap-3 sm:gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/[0.02] cursor-pointer">
                    <span className={cn("w-1 self-stretch rounded-full", color(userColor(a.assignedTo, members)).bar)} />
                    <div className="w-24 shrink-0 text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                      {formatTime(a.start)}
                      <div className="text-[10px] font-medium text-slate-400">{formatTime(a.end)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-sm font-bold text-slate-800 dark:text-white truncate", a.status === "cancelled" && "line-through opacity-60")}>{a.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">{[a.contact?.businessName, a.contact?.phone, a.location].filter(Boolean).join(" · ")}</div>
                    </div>
                    <Badge color={APPOINTMENT_STATUS_COLOR[a.status]} className="hidden sm:inline-flex">
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </Badge>
                    {a.assignedTo && <Avatar name={a.assignedTo} size="sm" />}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
