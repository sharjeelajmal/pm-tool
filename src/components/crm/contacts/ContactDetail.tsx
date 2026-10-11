"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  CalendarClock,
  CalendarPlus,
  Check,
  DollarSign,
  Kanban,
  ListTodo,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  StickyNote,
  Trash2,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import {
  APPOINTMENT_STATUS_LABELS,
  LEAD_SOURCES,
  LEAD_STATUS_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  STANDARD_FIELDS,
  contactDisplayName,
  formatMoney,
  type CrmAppointmentDTO,
  type CrmContactDetailDTO,
  type CrmContactInput,
  type CrmNoteDTO,
  type CrmOpportunityDTO,
  type CrmTaskDTO,
  type LeadStatus,
} from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import {
  CustomFieldInput,
  MemberSelect,
  STATUS_OPTIONS,
  StatusPicker,
  TagInput,
  fieldsForList,
  formatDate,
  formatDateTime,
  timeAgo,
  toDateTimeInput,
  toPicked,
  useListOptions,
} from "@/components/crm/common";
import { DateTimePicker } from "@/components/crm/pickers";
import { APPOINTMENT_STATUS_COLOR, LEAD_STATUS_COLOR, OPPORTUNITY_STATUS_COLOR, color } from "@/components/crm/theme";
import {
  AnimatedNumber,
  Avatar,
  Badge,
  Button,
  Card,
  ChoiceChips,
  Dropdown,
  EASE_OUT,
  EmptyState,
  HScroll,
  IconButton,
  Input,
  Segmented,
  Skeleton,
  Textarea,
  cn,
  useFeedback,
} from "@/components/crm/ui";
import { OpportunityModal } from "@/components/crm/opportunities/OpportunityModal";
import { AppointmentModal } from "@/components/crm/calendar/AppointmentModal";

type Tab = "notes" | "tasks" | "activity";

const QUICK_STATUSES: LeadStatus[] = ["active", "contacted", "interested", "not_interested", "converted", "dnd"];
const TAB_ORDER: Tab[] = ["notes", "tasks", "activity"];

export function ContactDetail({ id }: { id: string }) {
  const router = useRouter();
  const { lists, fields, refreshLists } = useCrm();
  const { toast, confirm } = useFeedback();
  const [contact, setContact] = React.useState<CrmContactDetailDTO | null>(null);
  const [error, setError] = React.useState("");
  const [tab, setTabState] = React.useState<Tab>("notes");
  const [tabDir, setTabDir] = React.useState(1);
  const [oppModal, setOppModal] = React.useState<{ open: boolean; opp: CrmOpportunityDTO | null }>({ open: false, opp: null });
  const [apptModal, setApptModal] = React.useState<{ open: boolean; appt: CrmAppointmentDTO | null }>({ open: false, appt: null });

  const setTab = (next: Tab) => {
    setTabDir(TAB_ORDER.indexOf(next) >= TAB_ORDER.indexOf(tab) ? 1 : -1);
    setTabState(next);
  };

  const load = React.useCallback(async () => {
    try {
      const res = await crmApi.contacts.get(id);
      setContact(res.contact);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const update = async (patch: CrmContactInput) => {
    if (!contact) return;
    try {
      const res = await crmApi.contacts.update(contact.id, patch);
      setContact((c) => (c ? { ...c, ...res.contact } : c));
      if (patch.listId !== undefined) refreshLists();
      // Refresh the timeline in the background.
      crmApi.contacts
        .get(contact.id)
        .then((r) => setContact((c) => (c ? { ...c, activity: r.contact.activity } : c)))
        .catch(() => undefined);
    } catch (e) {
      toast((e as Error).message, "error");
      throw e;
    }
  };

  const remove = async () => {
    if (!contact) return;
    const ok = await confirm({
      title: "Delete this lead?",
      message: "All notes, tasks, opportunities and appointments of this lead will be deleted too.",
      confirmLabel: "Delete lead",
      danger: true,
    });
    if (!ok) return;
    try {
      await crmApi.contacts.remove(contact.id);
      toast("Lead deleted");
      refreshLists();
      router.push("/crm/contacts");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  if (error) {
    return (
      <div className="p-8">
        <Card>
          <EmptyState
            icon={StickyNote}
            title="Lead not found"
            description={error}
            action={
              <Link href="/crm/contacts">
                <Button size="sm">Back to contacts</Button>
              </Link>
            }
          />
        </Card>
      </div>
    );
  }
  if (!contact) return <DetailSkeleton />;

  const name = contactDisplayName(contact);
  const list = lists.find((l) => l.id === contact.listId);
  const digits = contact.phone.replace(/\D/g, "");
  const openTasks = contact.tasks.filter((t) => !t.completed).length;
  const openValue = contact.opportunities.filter((o) => o.status === "open" || o.status === "won").reduce((s, o) => s + o.value, 0);
  const nextMeeting = contact.appointments
    .filter((a) => new Date(a.start) > new Date() && a.status !== "cancelled")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  const statusColor = color(LEAD_STATUS_COLOR[contact.status]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-7 flex flex-col gap-5">
      <Link href={list ? `/crm/contacts?list=${list.id}` : "/crm/contacts"} className="group self-start inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white">
        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
        {list ? list.name : "Contacts"}
      </Link>

      {/* Header */}
      <Card initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT }} className="overflow-hidden">
        <div className="relative h-24 sm:h-28 bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 overflow-hidden">
          <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:18px_18px]" />
          <motion.span animate={{ y: [0, -10, 0], x: [0, 8, 0] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="absolute -top-10 right-20 w-40 h-40 rounded-full bg-white/15 blur-xl" />
          <motion.span animate={{ y: [0, 12, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute -bottom-16 left-1/3 w-48 h-48 rounded-full bg-fuchsia-400/30 blur-2xl" />
          <span className="absolute right-6 top-5 w-16 h-16 rounded-2xl border-2 border-white/20 rotate-12" />
          <span className="absolute right-28 bottom-3 w-6 h-6 rounded-full border-2 border-white/25" />
        </div>
        <div className="px-5 sm:px-6 pb-5">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6">
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 flex-1 min-w-0">
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }} className="relative -mt-10 sm:-mt-12 shrink-0 w-fit">
                <Avatar name={name} size="lg" className="w-20 h-20 sm:w-24 sm:h-24 text-2xl ring-4 ring-white dark:ring-[#0F172A] shadow-xl" />
                <span className={cn("absolute bottom-1.5 right-1.5 w-4 h-4 rounded-full ring-4 ring-white dark:ring-[#0F172A]", statusColor.dot)} />
              </motion.div>
              <div className="min-w-0 flex-1 sm:pt-3">
                <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white truncate">{name}</h1>
                <div className="text-sm text-slate-500 truncate mt-0.5">
                  {[contact.businessName !== name && contact.businessName, contact.city, contact.country].filter(Boolean).join(" · ") || "No business details yet"}
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2.5">
                  <StatusPicker value={contact.status} onChange={(s) => update({ status: s }).catch(() => undefined)} />
                  {list && <Badge color={list.color} dot>{list.name}</Badge>}
                  {contact.assignedTo && (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                      <Avatar name={contact.assignedTo} size="xs" /> {contact.assignedTo}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400">Added {formatDate(contact.createdAt)}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {contact.phone && (
                <a href={`tel:${contact.phone}`}>
                  <Button size="sm" icon={Phone}>
                    Call
                  </Button>
                </a>
              )}
              {digits.length >= 7 && (
                <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">
                  <Button size="sm" icon={MessageCircle} className="hover:text-emerald-600">
                    WhatsApp
                  </Button>
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`}>
                  <Button size="sm" icon={Mail}>
                    Email
                  </Button>
                </a>
              )}
              <Button size="sm" icon={Kanban} onClick={() => setOppModal({ open: true, opp: null })}>
                Add to pipeline
              </Button>
              <Button size="sm" variant="primary" icon={CalendarPlus} onClick={() => setApptModal({ open: true, appt: null })}>
                Book follow-up
              </Button>
              <IconButton icon={Trash2} label="Delete lead" tone="danger" onClick={remove} size="md" />
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 shrink-0 sm:mr-2">Mark lead as</span>
            <ChoiceChips
              size="sm"
              value={contact.status}
              onChange={(s) => s !== contact.status && update({ status: s }).then(() => toast(`Marked as ${LEAD_STATUS_LABELS[s]}`)).catch(() => undefined)}
              options={QUICK_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABELS[s], colorName: LEAD_STATUS_COLOR[s] }))}
            />
          </div>
        </div>
      </Card>

      {/* Stats strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat i={0} icon={StickyNote} label="Notes" value={contact.notes.length} tone="from-amber-400 to-orange-500" onClick={() => setTab("notes")} />
        <MiniStat i={1} icon={ListTodo} label="Open tasks" value={openTasks} tone="from-rose-400 to-pink-500" onClick={() => setTab("tasks")} />
        <MiniStat i={2} icon={DollarSign} label="Deal value" value={openValue} format={(n) => formatMoney(n, true)} tone="from-emerald-400 to-teal-500" />
        <MiniStat
          i={3}
          icon={CalendarClock}
          label="Next meeting"
          text={nextMeeting ? new Date(nextMeeting.start).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " + new Date(nextMeeting.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "Not booked"}
          tone="from-blue-500 to-indigo-500"
          onClick={() => (nextMeeting ? setApptModal({ open: true, appt: nextMeeting }) : setApptModal({ open: true, appt: null }))}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_300px] gap-5 items-start">
        <DetailsPanel contact={contact} onSave={update} fields={fieldsForList(fields, contact.listId)} />

        <Card initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.1 }} className="min-w-0 overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/5">
            <HScroll arrows={false}>
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: "notes", label: "Notes", icon: StickyNote, count: contact.notes.length },
                { value: "tasks", label: "Tasks", icon: ListTodo, count: openTasks },
                { value: "activity", label: "Activity", icon: Activity },
              ]}
            />
            </HScroll>
          </div>
          <div className="relative p-4 overflow-hidden">
            <AnimatePresence mode="wait" initial={false} custom={tabDir}>
              <motion.div
                key={tab}
                custom={tabDir}
                initial={{ opacity: 0, x: tabDir * 28 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: tabDir * -28 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
              >
                {tab === "notes" && <NotesTab contact={contact} setContact={setContact} />}
                {tab === "tasks" && <TasksTab contact={contact} setContact={setContact} />}
                {tab === "activity" && <ActivityTab contact={contact} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </Card>

        <div className="flex flex-col gap-5 lg:col-span-2 xl:col-span-1">
          <Card initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.15 }}>
            <SideHeader icon={Kanban} title="Opportunities" onAdd={() => setOppModal({ open: true, opp: null })} addLabel="Add opportunity" />
            <div className="px-2 pb-3 flex flex-col">
              {contact.opportunities.length === 0 && <div className="px-2 py-3 text-xs text-slate-400">Not in any pipeline yet.</div>}
              {contact.opportunities.map((o, i) => (
                <motion.div key={o.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
                  <OpportunityRow opp={o} onClick={() => setOppModal({ open: true, opp: o })} />
                </motion.div>
              ))}
            </div>
          </Card>
          <Card initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.2 }}>
            <SideHeader icon={CalendarClock} title="Appointments" onAdd={() => setApptModal({ open: true, appt: null })} addLabel="Book appointment" />
            <div className="px-2 pb-3 flex flex-col">
              {contact.appointments.length === 0 && <div className="px-2 py-3 text-xs text-slate-400">No appointments booked.</div>}
              {contact.appointments.map((a, i) => (
                <motion.button
                  key={a.id}
                  type="button"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                  whileHover={{ x: 3 }}
                  onClick={() => setApptModal({ open: true, appt: a })}
                  className="flex items-start gap-3 text-left px-2 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
                >
                  <div className="w-11 shrink-0 rounded-xl bg-gradient-to-b from-blue-500 to-indigo-600 text-center py-1 text-white shadow-[0_6px_14px_-8px_rgba(37,99,235,0.9)]">
                    <div className="text-[9px] font-bold uppercase opacity-80">{new Date(a.start).toLocaleDateString("en-US", { month: "short" })}</div>
                    <div className="text-sm font-extrabold leading-none">{new Date(a.start).getDate()}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{a.title}</div>
                    <div className="text-[11px] text-slate-500">{formatDateTime(a.start)}</div>
                  </div>
                  <Badge color={APPOINTMENT_STATUS_COLOR[a.status]}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
                </motion.button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <OpportunityModal open={oppModal.open} opportunity={oppModal.opp} defaultContact={toPicked(contact)} onClose={() => setOppModal({ open: false, opp: null })} onSaved={load} onDeleted={load} />
      <AppointmentModal open={apptModal.open} appointment={apptModal.appt} defaultContact={toPicked(contact)} onClose={() => setApptModal({ open: false, appt: null })} onSaved={load} onDeleted={load} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DetailSkeleton() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-7 flex flex-col gap-5">
      <Skeleton className="h-4 w-24" />
      <Card className="overflow-hidden">
        <Skeleton className="h-28 rounded-none" />
        <div className="p-6 flex items-end gap-4 -mt-12">
          <Skeleton className="w-24 h-24 rounded-full ring-4 ring-white dark:ring-[#0F172A]" />
          <div className="flex-1 flex flex-col gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}

function MiniStat({
  i,
  icon: Icon,
  label,
  value,
  text,
  format,
  tone,
  onClick,
}: {
  i: number;
  icon: LucideIcon;
  label: string;
  value?: number;
  text?: string;
  format?: (n: number) => string;
  tone: string;
  onClick?: () => void;
}) {
  return (
    <Card
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.08 + i * 0.05 }}
      hover={!!onClick}
      onClick={onClick}
      className={cn("p-4 flex items-center gap-3", onClick && "cursor-pointer")}
    >
      <span className={cn("w-11 h-11 rounded-2xl bg-gradient-to-br flex items-center justify-center shrink-0 shadow-[0_10px_20px_-10px_rgba(15,23,42,0.5)]", tone)}>
        <Icon className="w-5 h-5 text-white" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
        <div className="text-lg font-extrabold text-slate-900 dark:text-white truncate">{text ?? <AnimatedNumber value={value || 0} format={format} />}</div>
      </div>
    </Card>
  );
}

function SideHeader({ icon: Icon, title, onAdd, addLabel }: { icon: LucideIcon; title: string; onAdd: () => void; addLabel: string }) {
  return (
    <div className="flex items-center justify-between px-4 pt-4 pb-2">
      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </span>
        {title}
      </h3>
      <motion.div whileHover={{ rotate: 90 }} transition={{ type: "spring", stiffness: 400, damping: 18 }}>
        <IconButton icon={Plus} label={addLabel} onClick={onAdd} />
      </motion.div>
    </div>
  );
}

function OpportunityRow({ opp, onClick }: { opp: CrmOpportunityDTO; onClick: () => void }) {
  const { pipelines } = useCrm();
  const pipeline = pipelines.find((p) => p.id === opp.pipelineId);
  const stage = pipeline?.stages.find((s) => s.id === opp.stageId);
  const stageIndex = pipeline ? pipeline.stages.findIndex((s) => s.id === opp.stageId) : -1;
  const progress = pipeline && stageIndex >= 0 ? (stageIndex + 1) / pipeline.stages.length : 0;
  return (
    <motion.button whileHover={{ x: 3 }} type="button" onClick={onClick} className="w-full flex flex-col gap-1.5 text-left px-2 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{opp.name}</span>
        <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">{formatMoney(opp.value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.9, ease: EASE_OUT }} className={cn("h-full rounded-full", color(stage?.color).bar)} />
      </div>
      <div className="flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
        <span className="truncate">{stage?.name || "Unknown stage"}</span>
        <Badge color={OPPORTUNITY_STATUS_COLOR[opp.status]} className="ml-auto">
          {OPPORTUNITY_STATUS_LABELS[opp.status]}
        </Badge>
      </div>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* Editable details ("boxes")                                         */
/* ------------------------------------------------------------------ */

function SavingField({
  label,
  value,
  onSave,
  type = "text",
  listId,
  className,
}: {
  label: string;
  value: string;
  onSave: (value: string) => Promise<void>;
  type?: string;
  listId?: string;
  className?: string;
}) {
  const [draft, setDraft] = React.useState(value);
  const [state, setState] = React.useState<"idle" | "saving" | "saved">("idle");
  React.useEffect(() => setDraft(value), [value]);

  const commit = async () => {
    if (draft === value) return;
    setState("saving");
    try {
      await onSave(draft);
      setState("saved");
      setTimeout(() => setState("idle"), 1400);
    } catch {
      setDraft(value);
      setState("idle");
    }
  };

  return (
    <label className={cn("flex flex-col gap-1 min-w-0", className)}>
      <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
        <AnimatePresence mode="wait">
          {state === "saving" && (
            <motion.span key="s" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
              <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
            </motion.span>
          )}
          {state === "saved" && (
            <motion.span key="d" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-1 text-emerald-600 normal-case tracking-normal">
              <Check className="w-3 h-3" /> Saved
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <Input
        type={type}
        value={draft}
        list={listId}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn("h-9 text-[13px]", state === "saved" && "border-emerald-400 ring-4 ring-emerald-500/10")}
      />
    </label>
  );
}

function DetailsPanel({
  contact,
  onSave,
  fields,
}: {
  contact: CrmContactDetailDTO;
  onSave: (patch: CrmContactInput) => Promise<void>;
  fields: ReturnType<typeof fieldsForList>;
}) {
  const listOptions = useListOptions();
  const [custom, setCustom] = React.useState<Record<string, unknown>>(contact.customFields);
  React.useEffect(() => setCustom(contact.customFields), [contact.customFields]);
  const types: Record<string, string> = { phone: "tel", email: "email", website: "url" };
  const group = (keys: string[]) => STANDARD_FIELDS.filter((f) => keys.includes(f.key));

  return (
    <Card initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.05 }} className="p-4 flex flex-col gap-5">
      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
          <Pencil className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
        </span>
        Lead details
        <span className="ml-auto text-[10px] font-semibold text-slate-400">Auto-saves</span>
      </h3>

      <section className="grid grid-cols-2 gap-3">
        {group(["firstName", "lastName", "businessName", "phone", "email", "website"]).map((f) => (
          <SavingField
            key={f.key}
            label={f.label}
            type={types[f.key]}
            value={contact[f.key]}
            onSave={(v) => onSave({ [f.key]: v })}
            className={["businessName", "email", "website"].includes(f.key) ? "col-span-2" : ""}
          />
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="col-span-2 text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Address</div>
        {group(["address", "city", "state", "postalCode", "country"]).map((f) => (
          <SavingField key={f.key} label={f.label} value={contact[f.key]} onSave={(v) => onSave({ [f.key]: v })} className={f.key === "address" ? "col-span-2" : ""} />
        ))}
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="col-span-2 text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Lead info</div>
        <div className="flex flex-col gap-1 col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">List</span>
          <Dropdown value={contact.listId} onChange={(v) => onSave({ listId: v }).catch(() => undefined)} options={listOptions} label="List" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
          <Dropdown value={contact.status} onChange={(v) => onSave({ status: v }).catch(() => undefined)} options={STATUS_OPTIONS} label="Status" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Owner</span>
          <MemberSelect value={contact.assignedTo} onChange={(v) => onSave({ assignedTo: v }).catch(() => undefined)} />
        </div>
        <SavingField label="Source" value={contact.source} onSave={(v) => onSave({ source: v })} listId="crm-detail-sources" className="col-span-2" />
        <datalist id="crm-detail-sources">
          {LEAD_SOURCES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <div className="flex flex-col gap-1 col-span-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tags</span>
          <TagInput value={contact.tags} onChange={(tags) => onSave({ tags }).catch(() => undefined)} />
        </div>
      </section>

      {fields.length > 0 && (
        <section className="grid grid-cols-2 gap-3">
          <div className="col-span-2 text-[11px] font-extrabold text-slate-700 dark:text-slate-200">Custom fields</div>
          {fields.map((field) => (
            <div key={field.id} className={cn("flex flex-col gap-1", (field.type === "textarea" || field.type === "url") && "col-span-2")}>
              {field.type !== "checkbox" && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{field.name}</span>}
              <CustomFieldInput
                field={field}
                value={custom[field.id]}
                onChange={(v) => setCustom((c) => ({ ...c, [field.id]: v }))}
                onCommit={(v) => {
                  if ((contact.customFields[field.id] ?? null) === (v ?? null)) return;
                  onSave({ customFields: { [field.id]: v } }).catch(() => undefined);
                }}
              />
            </div>
          ))}
        </section>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Notes                                                              */
/* ------------------------------------------------------------------ */

type SetContact = React.Dispatch<React.SetStateAction<CrmContactDetailDTO | null>>;

const listItem = {
  initial: { opacity: 0, y: -10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, x: 30, height: 0, marginTop: 0, transition: { duration: 0.22 } },
};

function NotesTab({ contact, setContact }: { contact: CrmContactDetailDTO; setContact: SetContact }) {
  const { me } = useCrm();
  const { toast, confirm } = useFeedback();
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState<{ id: string; body: string } | null>(null);

  const add = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      const res = await crmApi.notes.add(contact.id, body.trim());
      setContact((c) => (c ? { ...c, notes: [res.note, ...c.notes] } : c));
      setBody("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editing.body.trim()) return;
    try {
      const res = await crmApi.notes.update(contact.id, editing.id, editing.body.trim());
      setContact((c) => (c ? { ...c, notes: c.notes.map((n) => (n.id === res.note.id ? res.note : n)) } : c));
      setEditing(null);
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const remove = async (note: CrmNoteDTO) => {
    if (!(await confirm({ title: "Delete this note?", confirmLabel: "Delete", danger: true }))) return;
    try {
      await crmApi.notes.remove(contact.id, note.id);
      setContact((c) => (c ? { ...c, notes: c.notes.filter((n) => n.id !== note.id) } : c));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 transition-all focus-within:ring-4 focus-within:ring-blue-500/15 focus-within:border-blue-500 overflow-hidden">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && add()}
          placeholder="Write what you discussed with this lead…"
          className="w-full min-h-[96px] px-4 py-3 text-sm bg-transparent outline-none resize-y text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
        />
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5">
          <span className="text-[10px] text-slate-400">
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 font-sans">Ctrl</kbd> +{" "}
            <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 font-sans">Enter</kbd> to save
          </span>
          <Button size="xs" variant="primary" loading={saving} disabled={!body.trim()} onClick={add}>
            Add note
          </Button>
        </div>
      </div>

      {contact.notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" description="Keep a record of every conversation with this lead." className="py-8" />
      ) : (
        <ul className="flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {contact.notes.map((note) => {
              const canEdit = me.isAdmin || note.createdBy === me.username;
              return (
                <motion.li
                  key={note.id}
                  layout
                  {...listItem}
                  className="group relative rounded-2xl border border-amber-100 dark:border-amber-500/10 bg-gradient-to-br from-amber-50/90 to-orange-50/40 dark:from-amber-500/[0.06] dark:to-orange-500/[0.03] p-4 pl-5 overflow-hidden"
                >
                  <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-gradient-to-b from-amber-400 to-orange-500" />
                  {editing?.id === note.id ? (
                    <div className="flex flex-col gap-2">
                      <Textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} autoFocus />
                      <div className="flex justify-end gap-2">
                        <Button size="xs" onClick={() => setEditing(null)}>
                          Cancel
                        </Button>
                        <Button size="xs" variant="primary" onClick={saveEdit}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words leading-relaxed">{note.body}</p>
                      <div className="flex items-center gap-2 mt-3">
                        <Avatar name={note.createdBy} size="xs" />
                        <span className="text-[11px] text-slate-500">
                          <b className="font-semibold text-slate-600 dark:text-slate-300">{note.createdBy}</b> · {formatDateTime(note.createdAt)}
                          {note.updatedAt && " · edited"}
                        </span>
                        {canEdit && (
                          <span className="ml-auto flex opacity-0 group-hover:opacity-100 transition-opacity">
                            <IconButton icon={Pencil} label="Edit note" className="w-7 h-7" onClick={() => setEditing({ id: note.id, body: note.body })} />
                            <IconButton icon={Trash2} label="Delete note" tone="danger" className="w-7 h-7" onClick={() => remove(note)} />
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tasks                                                              */
/* ------------------------------------------------------------------ */

function TasksTab({ contact, setContact }: { contact: CrmContactDetailDTO; setContact: SetContact }) {
  const { me } = useCrm();
  const { toast } = useFeedback();
  const [title, setTitle] = React.useState("");
  const [due, setDue] = React.useState(() => {
    const d = new Date(Date.now() + 864e5);
    d.setHours(10, 0, 0, 0);
    return toDateTimeInput(d);
  });
  const [assignee, setAssignee] = React.useState(me.username);
  const [saving, setSaving] = React.useState(false);

  const add = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await crmApi.tasks.add(contact.id, { title: title.trim(), dueDate: due ? new Date(due).toISOString() : null, assignedTo: assignee });
      setContact((c) => (c ? { ...c, tasks: [...c.tasks, res.task] } : c));
      setTitle("");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (task: CrmTaskDTO) => {
    setContact((c) => (c ? { ...c, tasks: c.tasks.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t)) } : c));
    try {
      await crmApi.tasks.update(contact.id, task.id, { completed: !task.completed });
      if (!task.completed) toast("Task completed");
    } catch (e) {
      setContact((c) => (c ? { ...c, tasks: c.tasks.map((t) => (t.id === task.id ? task : t)) } : c));
      toast((e as Error).message, "error");
    }
  };

  const remove = async (task: CrmTaskDTO) => {
    try {
      await crmApi.tasks.remove(contact.id, task.id);
      setContact((c) => (c ? { ...c, tasks: c.tasks.filter((t) => t.id !== task.id) } : c));
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const sorted = [...contact.tasks].sort((a, b) => Number(a.completed) - Number(b.completed) || +new Date(a.dueDate || 8.64e15) - +new Date(b.dueDate || 8.64e15));
  const doneCount = contact.tasks.filter((t) => t.completed).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-3 flex flex-col gap-2 bg-slate-50/50 dark:bg-white/[0.02]">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="e.g. Call back about pricing" />
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="sm:flex-1 min-w-0">
            <DateTimePicker value={due} onChange={setDue} />
          </div>
          <MemberSelect value={assignee} onChange={setAssignee} allowEmpty={false} className="sm:w-44" />
          <Button size="md" variant="primary" icon={Plus} loading={saving} disabled={!title.trim()} onClick={add}>
            Add task
          </Button>
        </div>
      </div>

      {contact.tasks.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
            <motion.div animate={{ width: `${(doneCount / contact.tasks.length) * 100}%` }} transition={{ duration: 0.6, ease: EASE_OUT }} className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500" />
          </div>
          <span className="text-[11px] font-bold text-slate-500 tabular-nums">
            {doneCount}/{contact.tasks.length} done
          </span>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState icon={ListTodo} title="No tasks" description="Create follow-up tasks so nothing slips through." className="py-8" />
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {sorted.map((task) => {
              const overdue = !task.completed && task.dueDate && new Date(task.dueDate) < new Date();
              return (
                <motion.li
                  key={task.id}
                  layout
                  {...listItem}
                  className={cn(
                    "group flex items-start gap-3 px-3.5 py-3 rounded-2xl border transition-colors",
                    task.completed ? "border-slate-100 dark:border-white/5 bg-slate-50/60 dark:bg-white/[0.02]" : overdue ? "border-rose-200 dark:border-rose-500/25 bg-rose-50/50 dark:bg-rose-500/5" : "border-slate-200/70 dark:border-white/10 bg-white dark:bg-transparent"
                  )}
                >
                  <motion.button
                    whileTap={{ scale: 0.8 }}
                    type="button"
                    onClick={() => toggle(task)}
                    aria-label={task.completed ? "Mark as open" : "Mark as done"}
                    className={cn(
                      "mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors",
                      task.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 dark:border-white/20 hover:border-emerald-500"
                    )}
                  >
                    <AnimatePresence>{task.completed && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="w-3 h-3" /></motion.span>}</AnimatePresence>
                  </motion.button>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-sm font-semibold transition-colors", task.completed ? "line-through text-slate-400" : "text-slate-800 dark:text-white")}>{task.title}</div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px]">
                      {task.dueDate && (
                        <span className={cn("inline-flex items-center gap-1 font-semibold", overdue ? "text-rose-600" : "text-slate-500")}>
                          <CalendarClock className="w-3 h-3" />
                          {overdue ? "Overdue · " : ""}
                          {formatDateTime(task.dueDate)}
                        </span>
                      )}
                      {task.assignedTo && (
                        <span className="inline-flex items-center gap-1 text-slate-500">
                          <Avatar name={task.assignedTo} size="xs" /> {task.assignedTo}
                        </span>
                      )}
                    </div>
                  </div>
                  <IconButton icon={Trash2} label="Delete task" tone="danger" className="w-7 h-7 opacity-0 group-hover:opacity-100" onClick={() => remove(task)} />
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity                                                           */
/* ------------------------------------------------------------------ */

const ACTIVITY_ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  created: { icon: Plus, tone: "from-blue-500 to-indigo-500" },
  status: { icon: Check, tone: "from-emerald-400 to-teal-500" },
  assign: { icon: UserRound, tone: "from-violet-500 to-fuchsia-500" },
  note: { icon: StickyNote, tone: "from-amber-400 to-orange-500" },
  task: { icon: ListTodo, tone: "from-rose-400 to-pink-500" },
  opportunity: { icon: Kanban, tone: "from-indigo-500 to-blue-500" },
  appointment: { icon: CalendarClock, tone: "from-cyan-400 to-blue-500" },
  list: { icon: Activity, tone: "from-slate-400 to-slate-500" },
  update: { icon: Pencil, tone: "from-slate-400 to-slate-600" },
};

function ActivityTab({ contact }: { contact: CrmContactDetailDTO }) {
  if (contact.activity.length === 0) return <EmptyState icon={Activity} title="No activity yet" className="py-8" />;
  return (
    <ol className="relative flex flex-col gap-4 pl-1">
      <motion.span
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 0.8, ease: EASE_OUT }}
        style={{ transformOrigin: "top" }}
        className="absolute left-[17px] top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-blue-300 via-violet-300 to-transparent dark:from-blue-500/40 dark:via-violet-500/30"
      />
      {contact.activity.map((a, i) => {
        const meta = ACTIVITY_ICON[a.type] || ACTIVITY_ICON.update;
        return (
          <motion.li
            key={a.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(i, 15) * 0.04, duration: 0.3 }}
            className="relative flex items-start gap-3"
          >
            <span className={cn("relative z-10 w-8 h-8 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-[0_6px_14px_-8px_rgba(15,23,42,0.6)] ring-4 ring-white dark:ring-[#0F172A]", meta.tone)}>
              <meta.icon className="w-3.5 h-3.5 text-white" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{a.text}</div>
              <div className="text-[10px] text-slate-400 mt-0.5" title={formatDateTime(a.at)}>
                {a.by} · {timeAgo(a.at)}
              </div>
            </div>
          </motion.li>
        );
      })}
    </ol>
  );
}
