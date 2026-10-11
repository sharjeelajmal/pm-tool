"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Dropdown, Popover, cn, controlClass, type DropdownOption } from "@/components/crm/ui";

// Dates are exchanged as "YYYY-MM-DD" (local) and times as "HH:mm".
const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function parseYmd(value: string | undefined | null) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && ymd(a) === ymd(b);
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export function formatYmd(value: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) {
  const d = parseYmd(value);
  return d ? d.toLocaleDateString("en-US", opts) : "";
}

export function timeLabel(value: string) {
  const [h, m] = value.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* ------------------------------------------------------------------ */
/* Month grid with animated month changes and optional range preview  */
/* ------------------------------------------------------------------ */

export function MonthCalendar({
  selected,
  range,
  onPick,
  initialMonth,
  min,
}: {
  selected?: Date | null;
  range?: { from: Date | null; to: Date | null };
  onPick: (date: Date) => void;
  initialMonth?: Date | null;
  min?: Date | null;
}) {
  const start = initialMonth || selected || range?.from || new Date();
  const [month, setMonth] = React.useState(() => new Date(start.getFullYear(), start.getMonth(), 1));
  const [dir, setDir] = React.useState(0);
  const [hover, setHover] = React.useState<Date | null>(null);
  const today = new Date();

  const shift = (delta: number) => {
    setDir(delta);
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  };

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));

  // While picking the end of a range, preview it under the cursor.
  const rFrom = range?.from || null;
  const rTo = range?.to || (rFrom && hover && hover >= rFrom ? hover : null);

  return (
    <div className="w-[272px] select-none">
      <div className="flex items-center justify-between px-1 pb-2">
        <button type="button" onClick={() => shift(-1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer" aria-label="Previous month">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.span
            key={month.toISOString()}
            custom={dir}
            initial={{ opacity: 0, y: dir >= 0 ? 8 : -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: dir >= 0 ? -8 : 8 }}
            transition={{ duration: 0.2 }}
            className="text-sm font-extrabold text-slate-900 dark:text-white"
          >
            {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </motion.span>
        </AnimatePresence>
        <button type="button" onClick={() => shift(1)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer" aria-label="Next month">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase tracking-wider text-slate-400 pb-1">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="relative overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={month.toISOString()}
            initial={{ opacity: 0, x: dir >= 0 ? 40 : -40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir >= 0 ? -40 : 40 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="grid grid-cols-7 gap-y-0.5"
            onMouseLeave={() => setHover(null)}
          >
            {days.map((day) => {
              const inMonth = day.getMonth() === month.getMonth();
              const isSel = sameDay(day, selected || null) || sameDay(day, rFrom) || sameDay(day, rTo);
              const inRange = rFrom && rTo && day > rFrom && day < rTo;
              const disabled = !!min && day < new Date(min.getFullYear(), min.getMonth(), min.getDate());
              const isToday = sameDay(day, today);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={disabled}
                  onMouseEnter={() => setHover(day)}
                  onClick={() => onPick(day)}
                  className={cn(
                    "relative h-9 text-xs font-semibold cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed",
                    inRange && "bg-blue-50 dark:bg-blue-500/10",
                    sameDay(day, rFrom) && rTo && "bg-gradient-to-r from-transparent from-50% to-blue-50 to-50% dark:to-blue-500/10",
                    sameDay(day, rTo) && rFrom && !sameDay(rFrom, rTo) && "bg-gradient-to-l from-transparent from-50% to-blue-50 to-50% dark:to-blue-500/10"
                  )}
                >
                  <span
                    className={cn(
                      "mx-auto w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                      isSel
                        ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_6px_14px_-6px_rgba(37,99,235,0.9)] scale-105"
                        : inMonth
                        ? "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
                        : "text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-white/5"
                    )}
                  >
                    {day.getDate()}
                  </span>
                  {isToday && !isSel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-500" />}
                </button>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DatePicker                                                         */
/* ------------------------------------------------------------------ */

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  size = "md",
  clearable = true,
  className,
  min,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "md" | "sm" | "cell";
  clearable?: boolean;
  className?: string;
  min?: string;
}) {
  const date = parseYmd(value);
  const sizes = {
    md: "h-10 px-3 text-sm rounded-xl",
    sm: "h-8 px-2.5 text-xs rounded-lg",
    cell: "h-9 px-3 text-[13px] rounded-none border-0 bg-transparent dark:bg-transparent shadow-none hover:bg-slate-50 dark:hover:bg-white/[0.03] focus:ring-2 focus:ring-inset focus:ring-blue-500",
  };
  return (
    <Popover
      width={296}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className={cn(controlClass, "inline-flex items-center gap-2 text-left cursor-pointer shadow-sm", sizes[size], props["aria-expanded"] && "border-blue-500 ring-4 ring-blue-500/15", className)}
        >
          {size !== "cell" && <CalendarDays className="w-4 h-4 text-slate-400 shrink-0" />}
          <span className={cn("flex-1 truncate font-medium", !date && "text-slate-400")}>{date ? formatYmd(value) : placeholder}</span>
          {size !== "cell" && <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform duration-300", props["aria-expanded"] && "rotate-180")} />}
        </button>
      )}
    >
      {(close) => (
        <div className="p-2">
          <MonthCalendar
            selected={date}
            min={parseYmd(min)}
            onPick={(d) => {
              onChange(ymd(d));
              close();
            }}
          />
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100 dark:border-white/5">
            <button
              type="button"
              onClick={() => {
                onChange(ymd(new Date()));
                close();
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
            >
              Today
            </button>
            {clearable && value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  close();
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* TimePicker                                                         */
/* ------------------------------------------------------------------ */

const TIME_OPTIONS: DropdownOption[] = Array.from({ length: 96 }, (_, i) => {
  const value = `${pad(Math.floor(i / 4))}:${pad((i % 4) * 15)}`;
  return { value, label: timeLabel(value) };
});

export function TimePicker({ value, onChange, className, size = "md" }: { value: string; onChange: (value: string) => void; className?: string; size?: "md" | "sm" }) {
  // Keep an off-grid time (e.g. 10:05) selectable.
  const options = TIME_OPTIONS.some((o) => o.value === value) || !value ? TIME_OPTIONS : [{ value, label: timeLabel(value) }, ...TIME_OPTIONS];
  return <Dropdown value={value} onChange={onChange} options={options} icon={Clock} searchable size={size} className={className} label="Time" />;
}

export function DateTimePicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  // value: "YYYY-MM-DDTHH:mm" or ""
  const [d, t] = value ? value.split("T") : ["", ""];
  return (
    <div className="flex gap-2 min-w-0">
      <DatePicker value={d} onChange={(nd) => onChange(nd ? `${nd}T${t || "10:00"}` : "")} className="flex-1 min-w-0" />
      <TimePicker value={t || "10:00"} onChange={(nt) => onChange(`${d || ymd(new Date())}T${nt}`)} className="w-36" />
    </div>
  );
}
