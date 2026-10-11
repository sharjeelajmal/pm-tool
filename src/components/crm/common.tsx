"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarRange, Check, ChevronDown, Plus, Search, UserPlus, UsersRound, X } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  contactDisplayName,
  type CrmContactDTO,
  type CrmFieldDTO,
  type LeadStatus,
} from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { LEAD_STATUS_COLOR, color } from "@/components/crm/theme";
import { DatePicker, MonthCalendar, ymd } from "@/components/crm/pickers";
import {
  Avatar,
  Badge,
  Button,
  Checkbox,
  Dropdown,
  Input,
  Popover,
  Spinner,
  cn,
  itemVariants,
  listVariants,
  useFeedback,
  type DropdownOption,
} from "@/components/crm/ui";

/* ------------------------------------------------------------------ */
/* Date helpers                                                       */
/* ------------------------------------------------------------------ */

export function formatDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = {}) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...opts });
}

export function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [365 * 864e5, "y"],
    [30 * 864e5, "mo"],
    [7 * 864e5, "w"],
    [864e5, "d"],
    [36e5, "h"],
    [6e4, "m"],
  ];
  for (const [ms, label] of units) {
    if (abs >= ms) {
      const n = Math.floor(abs / ms);
      return diff >= 0 ? `${n}${label} ago` : `in ${n}${label}`;
    }
  }
  return "just now";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateInput(date: Date) {
  return ymd(date);
}

export function toDateTimeInput(date: Date) {
  return `${ymd(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateInput(value: string, endOfDay = false) {
  const [y, m, d] = value.split("-").map(Number);
  return endOfDay ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
}

/* ------------------------------------------------------------------ */
/* Date range picker                                                  */
/* ------------------------------------------------------------------ */

export type RangePreset = "all" | "today" | "yesterday" | "7d" | "30d" | "thisMonth" | "lastMonth" | "thisYear" | "custom";

export interface DateRange {
  preset: RangePreset;
  from?: string; // YYYY-MM-DD (custom only)
  to?: string;
}

const PRESET_LABELS: Record<RangePreset, string> = {
  all: "All time",
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  thisMonth: "This month",
  lastMonth: "Last month",
  thisYear: "This year",
  custom: "Custom range",
};

export function rangeBounds(range: DateRange): { from?: Date; to?: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  const today = startOfDay(now);
  switch (range.preset) {
    case "today":
      return { from: today, to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(today.getTime() - 864e5);
      return { from: y, to: endOfDay(y) };
    }
    case "7d":
      return { from: new Date(today.getTime() - 6 * 864e5), to: endOfDay(now) };
    case "30d":
      return { from: new Date(today.getTime() - 29 * 864e5), to: endOfDay(now) };
    case "thisMonth":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "lastMonth":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    case "thisYear":
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case "custom":
      return {
        from: range.from ? fromDateInput(range.from) : undefined,
        to: range.to ? fromDateInput(range.to, true) : undefined,
      };
    default:
      return {};
  }
}

export function rangeToIso(range: DateRange) {
  const { from, to } = rangeBounds(range);
  return { from: from?.toISOString(), to: to?.toISOString() };
}

export function rangeLabel(range: DateRange) {
  if (range.preset !== "custom") return PRESET_LABELS[range.preset];
  const { from, to } = rangeBounds(range);
  const f = (d?: Date) => (d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "…");
  return `${f(from)} – ${f(to)}`;
}

export function DateRangePicker({
  value,
  onChange,
  align = "start",
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  align?: "start" | "end";
  className?: string;
}) {
  const [draft, setDraft] = React.useState<{ from: Date | null; to: Date | null }>({ from: null, to: null });

  const pick = (day: Date) =>
    setDraft((d) => (!d.from || d.to || day < d.from ? { from: day, to: null } : { from: d.from, to: day }));

  return (
    <Popover
      align={align}
      width={460}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          onClick={(e) => {
            const b = rangeBounds(value);
            setDraft({ from: b.from || null, to: b.to ? new Date(b.to.getFullYear(), b.to.getMonth(), b.to.getDate()) : null });
            props.onClick(e);
          }}
          className={cn(
            "h-10 inline-flex items-center gap-2 px-3 rounded-xl border text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shadow-sm",
            value.preset !== "all"
              ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-300"
              : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:border-slate-300",
            props["aria-expanded"] && "ring-4 ring-blue-500/15 border-blue-500",
            className
          )}
        >
          <CalendarRange className="w-4 h-4" />
          {rangeLabel(value)}
          <ChevronDown className={cn("w-3.5 h-3.5 opacity-60 transition-transform duration-300", props["aria-expanded"] && "rotate-180")} />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col sm:flex-row gap-2 p-1">
          <motion.div initial="hidden" animate="show" variants={listVariants} className="flex sm:flex-col flex-wrap gap-0.5 sm:w-36 sm:border-r border-slate-100 dark:border-white/5 sm:pr-2">
            {(Object.keys(PRESET_LABELS) as RangePreset[])
              .filter((p) => p !== "custom")
              .map((preset) => (
                <motion.button
                  variants={itemVariants}
                  key={preset}
                  type="button"
                  onClick={() => {
                    onChange({ preset });
                    close();
                  }}
                  className={cn(
                    "text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors",
                    value.preset === preset
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                  )}
                >
                  {PRESET_LABELS[preset]}
                </motion.button>
              ))}
          </motion.div>
          <div className="flex flex-col gap-2">
            <MonthCalendar range={draft} onPick={pick} initialMonth={draft.from} />
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <span className="text-[11px] text-slate-500">
                {draft.from ? draft.from.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Start"} →{" "}
                {draft.to ? draft.to.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "End"}
              </span>
              <Button
                size="xs"
                variant="primary"
                disabled={!draft.from}
                onClick={() => {
                  if (!draft.from) return;
                  onChange({ preset: "custom", from: ymd(draft.from), to: ymd(draft.to || draft.from) });
                  close();
                }}
              >
                Apply range
              </Button>
            </div>
          </div>
        </div>
      )}
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Pickers                                                            */
/* ------------------------------------------------------------------ */

export function StatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge color={LEAD_STATUS_COLOR[status]} dot>
      {LEAD_STATUS_LABELS[status]}
    </Badge>
  );
}

export function StatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: LeadStatus;
  onChange: (status: LeadStatus) => void;
  disabled?: boolean;
}) {
  return (
    <Popover
      width={200}
      trigger={(props) => (
        <button {...props} type="button" disabled={disabled} className="inline-flex items-center gap-1 cursor-pointer disabled:cursor-default group">
          <motion.span key={value} initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 28 }}>
            <StatusBadge status={value} />
          </motion.span>
          {!disabled && <ChevronDown className={cn("w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-all", props["aria-expanded"] && "opacity-100 rotate-180")} />}
        </button>
      )}
    >
      {(close) => (
        <motion.div className="flex flex-col" initial="hidden" animate="show" variants={listVariants}>
          <div className="px-2.5 pt-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Lead status</div>
          {LEAD_STATUSES.map((status) => (
            <motion.button
              variants={itemVariants}
              key={status}
              type="button"
              onClick={() => {
                close();
                if (status !== value) onChange(status);
              }}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors",
                status === value ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" : "text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5"
              )}
            >
              <span className={cn("w-2 h-2 rounded-full ring-4 ring-current/10", color(LEAD_STATUS_COLOR[status]).dot)} />
              <span className="flex-1 text-left">{LEAD_STATUS_LABELS[status]}</span>
              {status === value && <Check className="w-3.5 h-3.5" />}
            </motion.button>
          ))}
        </motion.div>
      )}
    </Popover>
  );
}

export const STATUS_OPTIONS: DropdownOption<LeadStatus>[] = LEAD_STATUSES.map((s) => ({
  value: s,
  label: LEAD_STATUS_LABELS[s],
  dot: color(LEAD_STATUS_COLOR[s]).dot,
}));

export function useListOptions(noneLabel = "No list"): DropdownOption[] {
  const { lists } = useCrm();
  return [{ value: "", label: noneLabel, dot: "bg-slate-300 dark:bg-slate-600" }, ...lists.map((l) => ({ value: l.id, label: l.name, dot: color(l.color).dot }))];
}

export function useMemberOptions(allowEmpty = true, emptyLabel = "Unassigned", current?: string): DropdownOption[] {
  const { members } = useCrm();
  const opts: DropdownOption[] = members.map((m) => ({ value: m.username, label: m.username, avatar: m.username, description: m.isAdmin ? "Admin" : "Team member" }));
  if (current && !members.some((m) => m.username === current)) opts.unshift({ value: current, label: current, avatar: current });
  if (allowEmpty) opts.unshift({ value: "", label: emptyLabel, icon: UsersRound });
  return opts;
}

export function MemberSelect({
  value,
  onChange,
  allowEmpty = true,
  emptyLabel = "Unassigned",
  className,
  size = "md",
}: {
  value: string;
  onChange: (username: string) => void;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
  size?: "md" | "sm" | "cell";
}) {
  const options = useMemberOptions(allowEmpty, emptyLabel, value);
  return <Dropdown value={value} onChange={onChange} options={options} className={className} size={size} label="Owner" placeholder={emptyLabel} />;
}

export function TagInput({ value, onChange, placeholder = "Add tag…" }: { value: string[]; onChange: (tags: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = React.useState("");
  const add = (raw: string) => {
    const tags = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length) onChange([...new Set([...value, ...tags])]);
    setDraft("");
  };
  return (
    <div className="min-h-10 w-full flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120]/60 px-2 py-1.5 transition-all focus-within:ring-4 focus-within:ring-blue-500/15 focus-within:border-blue-500">
      <AnimatePresence initial={false}>
        {value.map((tag) => (
          <motion.span
            key={tag}
            layout
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.6, opacity: 0 }}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-500/15 dark:to-indigo-500/15 ring-1 ring-inset ring-blue-200/60 dark:ring-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:text-blue-200"
          >
            #{tag}
            <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="text-blue-400 hover:text-rose-500 cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </motion.span>
        ))}
      </AnimatePresence>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === ",") && draft.trim()) {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={value.length ? "" : placeholder}
        className="flex-1 min-w-[80px] bg-transparent text-sm outline-none px-1 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
      />
    </div>
  );
}

// Input control for one custom field, matching its type.
export function CustomFieldInput({
  field,
  value,
  onChange,
  onCommit,
  compact,
}: {
  field: CrmFieldDTO;
  value: unknown;
  onChange: (value: unknown) => void;
  onCommit?: (value: unknown) => void;
  compact?: boolean;
}) {
  const text = value === null || value === undefined ? "" : String(value);
  const commit = (v: unknown) => onCommit?.(v);

  switch (field.type) {
    case "checkbox":
      return (
        <div className={cn("flex items-center gap-2 text-sm", compact ? "h-9 px-3" : "h-10")}>
          <Checkbox
            checked={value === true || value === "true"}
            onChange={(v) => {
              onChange(v);
              commit(v);
            }}
            label={field.name}
          />
          {!compact && <span className="text-slate-600 dark:text-slate-300">{field.name}</span>}
        </div>
      );
    case "dropdown":
      return (
        <Dropdown
          value={text}
          size={compact ? "cell" : "md"}
          onChange={(v) => {
            onChange(v);
            commit(v);
          }}
          options={[{ value: "", label: "—" }, ...field.options.map((o) => ({ value: o, label: o }))]}
          placeholder="—"
          label={field.name}
        />
      );
    case "date":
      return (
        <DatePicker
          value={text.slice(0, 10)}
          size={compact ? "cell" : "md"}
          onChange={(v) => {
            onChange(v);
            commit(v);
          }}
        />
      );
    case "textarea":
      if (!compact) {
        return (
          <textarea
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            className="w-full min-h-[72px] rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1120]/60 px-3 py-2 text-sm focus:outline-none focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500"
          />
        );
      }
      break;
    default:
      break;
  }

  const type =
    field.type === "number" || field.type === "monetary"
      ? "number"
      : field.type === "email"
      ? "email"
      : field.type === "url"
      ? "url"
      : field.type === "phone"
      ? "tel"
      : "text";
  const parse = (raw: string) => (type === "number" ? (raw === "" ? null : Number(raw)) : raw);

  return (
    <Input
      type={type}
      value={text}
      step={field.type === "monetary" ? "0.01" : undefined}
      onChange={(e) => onChange(parse(e.target.value))}
      onBlur={(e) => commit(parse(e.target.value))}
      className={compact ? "h-9 rounded-none border-0 bg-transparent focus:ring-0 dark:bg-transparent" : ""}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Contact picker (search existing or quick-create)                   */
/* ------------------------------------------------------------------ */

export interface PickedContact {
  id: string;
  name: string;
  businessName: string;
  phone: string;
}

export function toPicked(c: Pick<CrmContactDTO, "id" | "firstName" | "lastName" | "businessName" | "email" | "phone">): PickedContact {
  return { id: c.id, name: contactDisplayName(c), businessName: c.businessName, phone: c.phone };
}

export function ContactPicker({
  value,
  onChange,
  disabled,
}: {
  value: PickedContact | null;
  onChange: (contact: PickedContact | null) => void;
  disabled?: boolean;
}) {
  const { toast } = useFeedback();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<CrmContactDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [draft, setDraft] = React.useState({ firstName: "", businessName: "", phone: "" });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (value || creating) return;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await crmApi.contacts.query({ q: query, limit: 8, sort: "updatedAt" });
        setResults(res.contacts);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, value, creating]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      {value ? (
        <motion.div
          key="picked"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="flex items-center gap-3 rounded-2xl border border-blue-200/70 dark:border-blue-500/25 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 dark:from-blue-500/10 dark:to-indigo-500/5 px-3 py-2.5"
        >
          <Avatar name={value.name} size="md" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{value.name}</div>
            <div className="text-[11px] text-slate-500 truncate">{[value.businessName, value.phone].filter(Boolean).join(" · ") || "No details"}</div>
          </div>
          {!disabled && (
            <button type="button" onClick={() => onChange(null)} className="text-xs font-bold text-blue-600 hover:underline cursor-pointer">
              Change
            </button>
          )}
        </motion.div>
      ) : creating ? (
        <motion.div
          key="create"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/40 dark:bg-blue-500/5 p-3 flex flex-col gap-2"
        >
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">New lead</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input placeholder="Contact name" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} autoFocus />
            <Input placeholder="Business name" value={draft.businessName} onChange={(e) => setDraft({ ...draft, businessName: e.target.value })} />
            <Input placeholder="Phone" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="xs" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="primary"
              loading={saving}
              disabled={!draft.firstName.trim() && !draft.businessName.trim() && !draft.phone.trim()}
              onClick={async () => {
                setSaving(true);
                try {
                  const res = await crmApi.contacts.create({ ...draft, source: "Manual" });
                  onChange(toPicked(res.contact));
                  setCreating(false);
                  toast("Lead created");
                } catch (e) {
                  toast((e as Error).message, "error");
                } finally {
                  setSaving(false);
                }
              }}
            >
              Create & select
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="search"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden focus-within:ring-4 focus-within:ring-blue-500/15 focus-within:border-blue-500 transition-all"
        >
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search leads by name, business, phone…"
              className="w-full h-11 pl-9 pr-3 text-sm bg-white dark:bg-[#0B1120]/60 outline-none text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
            />
            {loading && <Spinner className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4" />}
          </div>
          <motion.div key={query + results.length} initial="hidden" animate="show" variants={listVariants} className="max-h-52 overflow-y-auto border-t border-slate-100 dark:border-white/5 p-1">
            {results.map((c) => (
              <motion.button
                variants={itemVariants}
                key={c.id}
                type="button"
                onClick={() => onChange(toPicked(c))}
                className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <Avatar name={contactDisplayName(c)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800 dark:text-white truncate">{contactDisplayName(c)}</div>
                  <div className="text-[11px] text-slate-500 truncate">{[c.businessName, c.phone, c.email].filter(Boolean).join(" · ")}</div>
                </div>
                <StatusBadge status={c.status} />
              </motion.button>
            ))}
            {!loading && results.length === 0 && <div className="px-3 py-4 text-xs text-slate-400 text-center">No leads found</div>}
          </motion.div>
          <button
            type="button"
            onClick={() => {
              setDraft({ firstName: query, businessName: "", phone: "" });
              setCreating(true);
            }}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-blue-600 dark:text-blue-400 border-t border-slate-100 dark:border-white/5 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            Create a new lead{query ? ` “${query}”` : ""}
            <Plus className="w-3.5 h-3.5 ml-auto" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Custom fields that apply to a given list (no listIds = all lists).
export function fieldsForList(fields: CrmFieldDTO[], listId: string) {
  return fields.filter((f) => !f.listIds.length || (listId && f.listIds.includes(listId)));
}
