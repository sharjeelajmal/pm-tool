"use client";

import * as React from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ArrowUpDown,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Kanban,
  LayoutList,
  ListTodo,
  Phone,
  Plus,
  Search,
  Settings2,
  StickyNote,
  Tag,
  Trash2,
  Trophy,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import {
  LOST_REASONS,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  formatMoney,
  type CrmOpportunityDTO,
  type CrmStageDTO,
  type OpportunityStatus,
} from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { PageHeader } from "@/components/crm/PageHeader";
import { formatDate, timeAgo, useMemberOptions } from "@/components/crm/common";
import { OPPORTUNITY_STATUS_COLOR, color } from "@/components/crm/theme";
import {
  AnimatedNumber,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  Dropdown,
  EASE_OUT,
  EmptyState,
  HScroll,
  Menu,
  Modal,
  SPRING,
  Segmented,
  Skeleton,
  cn,
  useFeedback,
  useMounted,
} from "@/components/crm/ui";
import { OpportunityModal } from "@/components/crm/opportunities/OpportunityModal";
import { PipelineEditorModal } from "@/components/crm/opportunities/PipelineEditorModal";

type StatusFilter = "all" | OpportunityStatus;
type SortMode = "manual" | "valueDesc" | "newest" | "oldest" | "updated";

const SORT_LABELS: Record<SortMode, string> = {
  manual: "Manual order",
  valueDesc: "Highest value",
  newest: "Newest first",
  oldest: "Oldest first",
  updated: "Recently updated",
};

function sortOpps(list: CrmOpportunityDTO[], mode: SortMode) {
  const arr = [...list];
  switch (mode) {
    case "valueDesc":
      return arr.sort((a, b) => b.value - a.value);
    case "newest":
      return arr.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    case "oldest":
      return arr.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    case "updated":
      return arr.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    default:
      return arr.sort((a, b) => a.order - b.order);
  }
}

// Short confetti burst when a deal is won.
function Celebrate({ burst }: { burst: number }) {
  const mounted = useMounted();
  if (!mounted || !burst) return null;
  const colors = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];
  return createPortal(
    <div key={burst} className="pointer-events-none fixed inset-0 z-[150] overflow-hidden">
      {Array.from({ length: 46 }, (_, i) => {
        const angle = (i / 46) * Math.PI * 2;
        const dist = 160 + (i % 5) * 45;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 w-2.5 h-1.5 rounded-sm"
            style={{ background: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist + 120, opacity: 0, rotate: 540, scale: 0.6 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          />
        );
      })}
    </div>,
    document.body
  );
}

export function PipelineBoard() {
  const { pipelines, me, ready } = useCrm();
  const { toast, confirm } = useFeedback();
  const ownerOptions = useMemberOptions(false);
  const [pipelineId, setPipelineId] = React.useState("");
  const [opps, setOpps] = React.useState<CrmOpportunityDTO[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [q, setQ] = React.useState("");
  const [owner, setOwner] = React.useState("");
  const [view, setView] = React.useState<"board" | "list">("board");
  const [sort, setSort] = React.useState<SortMode>("manual");
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [dragId, setDragId] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{ stageId: string; index: number } | null>(null);
  const [modal, setModal] = React.useState<{ open: boolean; opp: CrmOpportunityDTO | null; stageId?: string }>({ open: false, opp: null });
  const [editor, setEditor] = React.useState<{ open: boolean; isNew: boolean }>({ open: false, isNew: false });
  const [lostPrompt, setLostPrompt] = React.useState<{ opp: CrmOpportunityDTO; stageId?: string; orderedIds?: string[] } | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [burst, setBurst] = React.useState(0);

  React.useEffect(() => {
    if (!ready || pipelines.length === 0) return;
    let saved = "";
    try {
      saved = localStorage.getItem("crm.pipeline") || "";
      const savedView = localStorage.getItem("crm.pipeline.view");
      if (savedView === "list" || savedView === "board") setView(savedView);
    } catch {}
    setPipelineId((current) => (current && pipelines.some((p) => p.id === current) ? current : pipelines.some((p) => p.id === saved) ? saved : pipelines[0].id));
  }, [ready, pipelines]);

  React.useEffect(() => {
    if (!pipelineId) return;
    try {
      localStorage.setItem("crm.pipeline", pipelineId);
      setCollapsed(new Set(JSON.parse(localStorage.getItem(`crm.pipeline.collapsed.${pipelineId}`) || "[]")));
    } catch {}
  }, [pipelineId]);

  const load = React.useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    try {
      const res = await crmApi.opportunities.list({ pipelineId, assignedTo: owner || undefined });
      setOpps(res.opportunities);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setLoading(false);
    }
  }, [pipelineId, owner, toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const pipeline = pipelines.find((p) => p.id === pipelineId) || null;
  const needle = q.trim().toLowerCase();
  const visible = opps.filter((o) => {
    if (status !== "all" && o.status !== status) return false;
    if (!needle) return true;
    return [o.name, o.source, o.contact?.name, o.contact?.businessName, o.contact?.phone, o.contact?.email, ...o.tags]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(needle));
  });
  const statusCounts = OPPORTUNITY_STATUSES.reduce((acc, s) => ({ ...acc, [s]: opps.filter((o) => o.status === s).length }), {} as Record<OpportunityStatus, number>);
  const stageCounts = opps.reduce((acc, o) => ({ ...acc, [o.stageId]: (acc[o.stageId] || 0) + 1 }), {} as Record<string, number>);
  const totalValue = visible.reduce((sum, o) => sum + o.value, 0);
  const maxStageValue = Math.max(1, ...(pipeline?.stages.map((s) => visible.filter((o) => o.stageId === s.id).reduce((a, o) => a + o.value, 0)) || [1]));

  const toggleCollapse = (stageId: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      try {
        localStorage.setItem(`crm.pipeline.collapsed.${pipelineId}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });

  const saveOpp = (opp: CrmOpportunityDTO) =>
    setOpps((list) => (list.some((o) => o.id === opp.id) ? list.map((o) => (o.id === opp.id ? opp : o)) : opp.pipelineId === pipelineId ? [opp, ...list] : list));

  const celebrate = (name: string) => {
    setBurst((b) => b + 1);
    toast(`🎉 ${name} marked as won`);
  };

  const commitMove = async (opp: CrmOpportunityDTO, stageId: string, index: number, extra: Partial<CrmOpportunityDTO> = {}) => {
    const column = sortOpps(
      opps.filter((o) => o.stageId === stageId && o.id !== opp.id && (status === "all" || o.status === status)),
      "manual"
    );
    const insertAt = sort === "manual" ? Math.max(0, Math.min(index, column.length)) : column.length;
    column.splice(insertAt, 0, { ...opp, stageId });
    const orderedIds = column.map((o) => o.id);
    const target = pipeline?.stages.find((s) => s.id === stageId);

    if (target?.kind === "lost" && opp.status !== "lost" && !extra.lostReason) {
      setLostPrompt({ opp, stageId, orderedIds });
      return;
    }
    if (opp.stageId === stageId && orderedIds.indexOf(opp.id) === sortOpps(opps.filter((o) => o.stageId === stageId), "manual").findIndex((o) => o.id === opp.id)) return;

    const previous = opps;
    setOpps((list) =>
      list.map((o) => {
        const pos = orderedIds.indexOf(o.id);
        if (o.id === opp.id) return { ...o, ...extra, stageId, order: pos, status: target?.kind === "won" ? "won" : extra.status || o.status };
        return pos >= 0 ? { ...o, order: pos } : o;
      })
    );
    try {
      const res = await crmApi.opportunities.update(opp.id, { stageId, orderedIds, ...extra });
      saveOpp(res.opportunity);
      if (res.opportunity.status === "won" && opp.status !== "won") celebrate(opp.name);
    } catch (e) {
      setOpps(previous);
      toast((e as Error).message, "error");
    }
  };

  const setOppStatus = async (opp: CrmOpportunityDTO, next: OpportunityStatus, lostReason?: string) => {
    if (next === "lost" && lostReason === undefined) {
      setLostPrompt({ opp });
      return;
    }
    const previous = opps;
    setOpps((list) => list.map((o) => (o.id === opp.id ? { ...o, status: next, lostReason: lostReason || "" } : o)));
    try {
      const res = await crmApi.opportunities.update(opp.id, { status: next, lostReason });
      saveOpp(res.opportunity);
      if (next === "won") celebrate(opp.name);
      else toast(`Marked as ${OPPORTUNITY_STATUS_LABELS[next]}`);
    } catch (e) {
      setOpps(previous);
      toast((e as Error).message, "error");
    }
  };

  const onDragEnd = () => {
    setDragId(null);
    setDropTarget(null);
  };

  const dragged = dragId ? opps.find((o) => o.id === dragId) || null : null;

  const bulk = async (action: "delete" | "status", value?: string) => {
    const ids = [...selected];
    if (action === "delete" && !(await confirm({ title: `Delete ${ids.length} opportunities?`, confirmLabel: "Delete", danger: true }))) return;
    try {
      const res = await crmApi.opportunities.bulk(ids, action, value);
      toast(`${action === "delete" ? "Deleted" : "Updated"} ${res.affected} opportunities`);
      setSelected(new Set());
      load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <div className="flex flex-col min-h-full">
      <PageHeader
        icon={Kanban}
        title={
          <Menu
            align="start"
            width={280}
            header="Pipelines"
            trigger={(props) => (
              <button {...props} type="button" className="group inline-flex items-center gap-2 max-w-full cursor-pointer hover:text-blue-600 transition-colors">
                <span className="truncate">{pipeline?.name || "Opportunities"}</span>
                <ChevronDown className={cn("w-5 h-5 shrink-0 text-slate-400 transition-transform duration-300", props["aria-expanded"] && "rotate-180")} />
              </button>
            )}
            items={[
              ...pipelines.map((p) => ({ label: p.name, active: p.id === pipelineId, onClick: () => setPipelineId(p.id) })),
              ...(me.isAdmin ? (["divider", { label: "New pipeline", icon: Plus, onClick: () => setEditor({ open: true, isNew: true }) }] as const) : []),
            ]}
          />
        }
        subtitle={
          <span className="inline-flex items-center gap-2">
            <span className="text-blue-600 dark:text-blue-400 font-bold">
              <AnimatedNumber value={visible.length} /> opportunities
            </span>
            <span>·</span>
            <span className="font-semibold">
              <AnimatedNumber value={totalValue} format={(n) => formatMoney(n)} />
            </span>
          </span>
        }
        actions={
          <>
            {me.isAdmin && pipeline && (
              <Button size="sm" icon={Settings2} onClick={() => setEditor({ open: true, isNew: false })}>
                Edit pipeline
              </Button>
            )}
            <Button size="sm" variant="primary" icon={Plus} disabled={!pipeline} onClick={() => setModal({ open: true, opp: null })}>
              Add opportunity
            </Button>
          </>
        }
      >
        <div className="flex flex-col xl:flex-row xl:items-center gap-2">
          <HScroll arrows={false}>
            <Segmented
              value={status}
              onChange={setStatus}
              options={[{ value: "all", label: "All", count: opps.length }, ...OPPORTUNITY_STATUSES.map((s) => ({ value: s, label: OPPORTUNITY_STATUS_LABELS[s], count: statusCounts[s] }))]}
            />
          </HScroll>
          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search opportunities"
                className="h-10 w-full sm:w-60 pl-9 pr-8 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-sm outline-none shadow-sm transition-all focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500"
              />
              {q && (
                <button type="button" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {me.scope === "all" && (
              <Dropdown value={owner} onChange={setOwner} className="w-40" label="Owner filter" options={[{ value: "", label: "Any owner", icon: UsersRound }, { value: "unassigned", label: "Unassigned", icon: UsersRound }, ...ownerOptions]} />
            )}
            <Menu
              header="Sort cards"
              trigger={(props) => (
                <Button {...props} icon={ArrowUpDown}>
                  <span className="hidden sm:inline">{SORT_LABELS[sort]}</span>
                </Button>
              )}
              items={(Object.keys(SORT_LABELS) as SortMode[]).map((m) => ({ label: SORT_LABELS[m], active: sort === m, onClick: () => setSort(m) }))}
            />
            <Segmented
              value={view}
              onChange={(v) => {
                setView(v);
                try {
                  localStorage.setItem("crm.pipeline.view", v);
                } catch {}
              }}
              options={[
                { value: "board", label: "Board", icon: Kanban },
                { value: "list", label: "List", icon: LayoutList },
              ]}
            />
          </div>
        </div>
      </PageHeader>

      <AnimatePresence mode="wait" initial={false}>
        {!pipeline || (loading && opps.length === 0) ? (
          <motion.div key="skeleton" exit={{ opacity: 0 }} className="flex gap-4 px-4 sm:px-6 lg:px-8 overflow-hidden">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="w-[300px] shrink-0 flex flex-col gap-3" style={{ opacity: 1 - i * 0.15 }}>
                <Skeleton className="h-16 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
                <Skeleton className="h-36 rounded-2xl" />
              </div>
            ))}
          </motion.div>
        ) : view === "board" ? (
          <motion.div
            key={`board-${pipelineId}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="flex-1 min-h-0"
          >
            <LayoutGroup id="pipeline-board">
              <HScroll wheel={false} ignoreDragFrom="[data-opp-card], button, a" step={0.6} innerClassName="gap-4 items-start min-h-[60vh] px-4 sm:px-6 lg:px-8 pb-28">
                {pipeline.stages.map((stage, i) => {
                  const column = sortOpps(
                    visible.filter((o) => o.stageId === stage.id),
                    sort
                  );
                  return (
                    <StageColumn
                      key={stage.id}
                      index={i}
                      stage={stage}
                      opps={column}
                      maxValue={maxStageValue}
                      collapsed={collapsed.has(stage.id)}
                      onToggle={() => toggleCollapse(stage.id)}
                      dragId={dragId}
                      dropIndex={dropTarget?.stageId === stage.id ? dropTarget.index : null}
                      onDragOverIndex={(index) => setDropTarget((t) => (t && t.stageId === stage.id && t.index === index ? t : { stageId: stage.id, index }))}
                      onDrop={(index) => {
                        if (dragged) commitMove(dragged, stage.id, index);
                        onDragEnd();
                      }}
                      onDragStart={setDragId}
                      onDragEnd={onDragEnd}
                      onOpen={(opp) => setModal({ open: true, opp })}
                      onAdd={() => setModal({ open: true, opp: null, stageId: stage.id })}
                      onStatus={setOppStatus}
                    />
                  );
                })}
              </HScroll>
            </LayoutGroup>
          </motion.div>
        ) : (
          <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: EASE_OUT }}>
            <OpportunityList opps={sortOpps(visible, sort === "manual" ? "updated" : sort)} stages={pipeline.stages} selected={selected} onSelect={setSelected} onOpen={(opp) => setModal({ open: true, opp })} onBulk={bulk} />
          </motion.div>
        )}
      </AnimatePresence>

      <DropZones dragged={dragged} onDropStatus={(s) => dragged && dragged.status !== s && setOppStatus(dragged, s, s === "lost" ? undefined : "")} onDone={onDragEnd} />
      <Celebrate burst={burst} />

      <OpportunityModal
        open={modal.open}
        opportunity={modal.opp}
        defaultPipelineId={pipelineId}
        defaultStageId={modal.stageId}
        onClose={() => setModal({ open: false, opp: null })}
        onSaved={(opp) => {
          if (opp.pipelineId !== pipelineId) setOpps((list) => list.filter((o) => o.id !== opp.id));
          else {
            const before = opps.find((o) => o.id === opp.id);
            saveOpp(opp);
            if (opp.status === "won" && before?.status !== "won") setBurst((b) => b + 1);
          }
        }}
        onDeleted={(id) => setOpps((list) => list.filter((o) => o.id !== id))}
      />
      <PipelineEditorModal
        open={editor.open}
        pipeline={editor.isNew ? null : pipeline}
        stageCounts={editor.isNew ? {} : stageCounts}
        onClose={() => setEditor({ open: false, isNew: false })}
        onSaved={(p) => {
          if (p) setPipelineId(p.id);
          else setPipelineId("");
          load();
        }}
      />
      <LostReasonModal
        prompt={lostPrompt}
        onClose={() => setLostPrompt(null)}
        onConfirm={(reason) => {
          const p = lostPrompt;
          setLostPrompt(null);
          if (!p) return;
          if (p.stageId) commitMove(p.opp, p.stageId, p.orderedIds?.indexOf(p.opp.id) ?? 0, { status: "lost", lostReason: reason || "Other" });
          else setOppStatus(p.opp, "lost", reason);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function DropZones({ dragged, onDropStatus, onDone }: { dragged: CrmOpportunityDTO | null; onDropStatus: (s: OpportunityStatus) => void; onDone: () => void }) {
  const mounted = useMounted();
  const [over, setOver] = React.useState<string | null>(null);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {dragged && (
        <motion.div
          initial={{ opacity: 0, y: 40, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%" }}
          exit={{ opacity: 0, y: 40, x: "-50%" }}
          transition={SPRING}
          className="fixed bottom-24 md:bottom-6 left-1/2 md:left-[calc(50%+38px)] lg:left-[calc(50%+8rem)] z-[60] flex gap-2 p-2 rounded-3xl bg-white/90 dark:bg-[#111a2e]/90 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.5)] font-sans"
        >
          {(["won", "lost", "abandoned"] as const).map((s) => {
            const c = color(OPPORTUNITY_STATUS_COLOR[s]);
            return (
              <div
                key={s}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (over !== s) setOver(s);
                }}
                onDragLeave={() => setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(null);
                  onDropStatus(s);
                  onDone();
                }}
                className={cn(
                  "w-28 sm:w-36 h-16 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold uppercase tracking-wider transition-all duration-200",
                  c.soft,
                  over === s ? "scale-110 border-solid shadow-lg" : "border-current/30"
                )}
              >
                {s === "won" ? <Trophy className="w-4 h-4" /> : s === "lost" ? <X className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                {OPPORTUNITY_STATUS_LABELS[s]}
              </div>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function StageColumn({
  index,
  stage,
  opps,
  maxValue,
  collapsed,
  onToggle,
  dragId,
  dropIndex,
  onDragOverIndex,
  onDrop,
  onDragStart,
  onDragEnd,
  onOpen,
  onAdd,
  onStatus,
}: {
  index: number;
  stage: CrmStageDTO;
  opps: CrmOpportunityDTO[];
  maxValue: number;
  collapsed: boolean;
  onToggle: () => void;
  dragId: string | null;
  dropIndex: number | null;
  onDragOverIndex: (index: number) => void;
  onDrop: (index: number) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onOpen: (opp: CrmOpportunityDTO) => void;
  onAdd: () => void;
  onStatus: (opp: CrmOpportunityDTO, status: OpportunityStatus) => void;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const c = color(stage.color);
  const value = opps.reduce((sum, o) => sum + o.value, 0);

  const indexFromEvent = (e: React.DragEvent) => {
    const cards = Array.from(listRef.current?.querySelectorAll<HTMLElement>("[data-opp-card]") || []);
    const y = e.clientY;
    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (y < rect.top + rect.height / 2) return i;
    }
    return cards.length;
  };

  if (collapsed) {
    return (
      <motion.button
        layout
        type="button"
        onClick={onToggle}
        onDragOver={(e) => {
          e.preventDefault();
          onDragOverIndex(opps.length);
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(opps.length);
        }}
        className={cn("shrink-0 w-12 rounded-2xl border border-t-4 bg-white/90 dark:bg-[#0F172A]/90 border-slate-200/70 dark:border-white/10 min-h-[60vh] flex flex-col items-center py-3 gap-3 cursor-pointer hover:bg-slate-50", c.topBorder)}
        title={`Expand ${stage.name}`}
      >
        <ChevronRight className="w-4 h-4 text-slate-400" />
        <span className="text-[11px] font-bold text-slate-500 tabular-nums">{opps.length}</span>
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap">{stage.name}</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: EASE_OUT }}
      className="shrink-0 w-[82vw] max-w-[300px] sm:w-[300px] flex flex-col gap-3"
    >
      <div className={cn("relative overflow-hidden rounded-2xl border border-t-4 bg-white/90 dark:bg-[#0F172A]/90 backdrop-blur border-slate-200/70 dark:border-white/10 px-4 py-3 shadow-[0_10px_28px_-18px_rgba(15,23,42,0.35)]", c.topBorder)}>
        <span className={cn("pointer-events-none absolute -right-6 -top-8 w-20 h-20 rounded-full opacity-15 blur-xl", c.bar)} />
        <div className="relative flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {stage.kind === "won" ? <Trophy className="w-4 h-4 text-emerald-500 shrink-0" /> : <span className={cn("w-2 h-2 rounded-full shrink-0", c.dot)} />}
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white truncate" title={stage.name}>
              {stage.name}
            </h3>
          </div>
          <button type="button" onClick={onToggle} className="text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer" title="Collapse">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="relative flex items-center gap-2 mt-1 text-[11px] text-slate-500">
          <span>
            <AnimatedNumber value={opps.length} duration={0.4} /> opportunit{opps.length === 1 ? "y" : "ies"}
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100 tabular-nums">
            <AnimatedNumber value={value} format={(n) => formatMoney(n)} duration={0.6} />
          </span>
        </div>
        <div className="relative mt-2.5 h-1 rounded-full bg-slate-100 dark:bg-white/[0.06] overflow-hidden">
          <motion.div animate={{ width: `${(value / maxValue) * 100}%` }} transition={{ duration: 0.7, ease: EASE_OUT }} className={cn("h-full rounded-full", c.bar)} />
        </div>
      </div>

      <div
        ref={listRef}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOverIndex(indexFromEvent(e));
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(indexFromEvent(e));
        }}
        className={cn(
          "flex flex-col gap-2.5 min-h-[50vh] rounded-2xl p-1 -m-1 transition-all duration-300",
          dragId && "bg-slate-100/70 dark:bg-white/[0.03] outline-2 outline-dashed outline-slate-200 dark:outline-white/10",
          dropIndex !== null && "bg-blue-50/70 dark:bg-blue-500/[0.06] outline-blue-300 dark:outline-blue-500/40"
        )}
      >
        <AnimatePresence initial={false}>
          {opps.map((opp, i) => (
            <React.Fragment key={opp.id}>
              {dropIndex === i && dragId !== opp.id && <DropMarker />}
              <OpportunityCard
                opp={opp}
                index={i}
                dragging={dragId === opp.id}
                onDragStart={() => onDragStart(opp.id)}
                onDragEnd={onDragEnd}
                onOpen={() => onOpen(opp)}
                onStatus={(s) => onStatus(opp, s)}
              />
            </React.Fragment>
          ))}
        </AnimatePresence>
        {dropIndex !== null && dropIndex >= opps.length && <DropMarker />}
        <button
          type="button"
          onClick={onAdd}
          className="group flex items-center justify-center gap-1.5 h-10 rounded-xl text-xs font-bold text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-white/5 border border-dashed border-transparent hover:border-blue-200 dark:hover:border-white/10 transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 transition-transform group-hover:rotate-90" /> Add
        </button>
      </div>
    </motion.div>
  );
}

function DropMarker() {
  return <motion.div layout initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} className="h-1 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 mx-2 shadow shadow-blue-500/40" />;
}

function CountIcon({ icon: Icon, count, title, href, tone }: { icon: typeof Phone; count?: number; title: string; href?: string; tone?: string }) {
  const body = (
    <span className="relative inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 dark:hover:text-white transition-colors" title={title}>
      <Icon className="w-3.5 h-3.5" />
      {!!count && (
        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={SPRING} className={cn("absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center tabular-nums shadow", tone || "bg-blue-600")}>
          {count}
        </motion.span>
      )}
    </span>
  );
  return href ? (
    <a href={href} onClick={(e) => e.stopPropagation()}>
      {body}
    </a>
  ) : (
    body
  );
}

function OpportunityCard({
  opp,
  index,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onStatus,
}: {
  opp: CrmOpportunityDTO;
  index: number;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onStatus: (status: OpportunityStatus) => void;
}) {
  const contact = opp.contact;
  const won = opp.status === "won";
  return (
    // Outer element animates layout (moves between columns); inner element owns native drag & drop.
    <motion.div
      layout
      layoutId={`opp-${opp.id}`}
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: dragging ? 0.4 : 1, y: 0, scale: dragging ? 0.97 : 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={{ layout: SPRING, delay: Math.min(index, 8) * 0.03, duration: 0.3 }}
    >
      <div
        data-opp-card
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", opp.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        className={cn(
          "group relative overflow-hidden rounded-2xl border bg-white dark:bg-[#0F172A] p-3.5 cursor-grab active:cursor-grabbing select-none",
          "transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-0.5",
          won
            ? "border-emerald-200 dark:border-emerald-500/30 shadow-[0_12px_28px_-18px_rgba(16,185,129,0.8)]"
            : "border-slate-200/70 dark:border-white/10 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-18px_rgba(15,23,42,0.4)] hover:shadow-[0_18px_36px_-18px_rgba(37,99,235,0.45)] hover:border-blue-200 dark:hover:border-blue-500/30",
          (opp.status === "lost" || opp.status === "abandoned") && "opacity-70 grayscale-[30%]"
        )}
      >
        {won && <span className="pointer-events-none absolute -right-6 -top-6 w-20 h-20 rounded-full bg-emerald-400/20 blur-xl" />}
        <div className="relative flex items-start justify-between gap-2">
          <div className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{opp.name}</div>
          {opp.assignedTo ? (
            <Avatar name={opp.assignedTo} size="sm" title={`Owner: ${opp.assignedTo}`} />
          ) : (
            <span className="w-7 h-7 rounded-full border border-dashed border-slate-300 dark:border-white/20 flex items-center justify-center text-slate-400 shrink-0" title="Unassigned">
              <UserRound className="w-3.5 h-3.5" />
            </span>
          )}
        </div>

        <dl className="relative mt-3 grid grid-cols-[88px_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-xs">
          {contact?.businessName && (
            <>
              <dt className="text-slate-400">Business name:</dt>
              <dd className="text-slate-700 dark:text-slate-200 truncate" title={contact.businessName}>
                {contact.businessName}
              </dd>
            </>
          )}
          {contact && contact.name !== contact.businessName && contact.name !== opp.name && (
            <>
              <dt className="text-slate-400">Contact:</dt>
              <dd className="text-slate-700 dark:text-slate-200 truncate">{contact.name}</dd>
            </>
          )}
          {opp.source && (
            <>
              <dt className="text-slate-400">Source:</dt>
              <dd className="text-slate-700 dark:text-slate-200 truncate">{opp.source}</dd>
            </>
          )}
          <dt className="text-slate-400">Value:</dt>
          <dd className={cn("font-extrabold tabular-nums", won ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-white")}>{formatMoney(opp.value)}</dd>
        </dl>

        <div className="relative mt-3 pt-2.5 border-t border-slate-100 dark:border-white/5 flex items-center gap-0.5 -ml-1.5">
          <CountIcon icon={Phone} title={contact?.phone ? `Call ${contact.phone}` : "No phone"} href={contact?.phone ? `tel:${contact.phone}` : undefined} />
          <CountIcon icon={StickyNote} title="Notes" count={contact?.notesCount} tone="bg-amber-500" />
          <CountIcon icon={ListTodo} title="Open tasks" count={contact?.tasksCount} tone="bg-rose-500" />
          <CountIcon icon={CalendarClock} title="Appointments" count={contact?.appointmentsCount} />
          <CountIcon icon={Tag} title={opp.tags.length ? opp.tags.join(", ") : "No tags"} count={opp.tags.length} tone="bg-violet-500" />
          <div className="ml-auto" onClick={(e) => e.stopPropagation()}>
            {opp.status !== "open" ? (
              <Badge color={OPPORTUNITY_STATUS_COLOR[opp.status]}>{OPPORTUNITY_STATUS_LABELS[opp.status]}</Badge>
            ) : (
              <Menu
                width={170}
                header="Set status"
                trigger={(props) => (
                  <button {...props} type="button" className="text-[10px] font-bold text-slate-400 hover:text-blue-600 px-1.5 py-1 rounded-md hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer transition-colors">
                    {opp.stageChangedAt ? timeAgo(opp.stageChangedAt) : "Status"}
                  </button>
                )}
                items={OPPORTUNITY_STATUSES.map((s) => ({ label: OPPORTUNITY_STATUS_LABELS[s], active: s === opp.status, onClick: () => s !== opp.status && onStatus(s) }))}
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */

function OpportunityList({
  opps,
  stages,
  selected,
  onSelect,
  onOpen,
  onBulk,
}: {
  opps: CrmOpportunityDTO[];
  stages: CrmStageDTO[];
  selected: Set<string>;
  onSelect: (s: Set<string>) => void;
  onOpen: (opp: CrmOpportunityDTO) => void;
  onBulk: (action: "delete" | "status", value?: string) => void;
}) {
  const stageMap = new Map(stages.map((s) => [s.id, s]));
  const all = opps.length > 0 && opps.every((o) => selected.has(o.id));
  return (
    <div className="px-4 sm:px-6 lg:px-8 pb-10 flex flex-col gap-3">
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-blue-500/10 dark:to-indigo-500/5 px-3 py-2 overflow-hidden"
          >
            <span className="text-xs font-bold text-blue-800 dark:text-blue-200">{selected.size} selected</span>
            <Menu
              align="start"
              header="Set status"
              trigger={(props) => (
                <Button {...props} size="xs">
                  Change status
                </Button>
              )}
              items={OPPORTUNITY_STATUSES.map((s) => ({ label: OPPORTUNITY_STATUS_LABELS[s], onClick: () => onBulk("status", s) }))}
            />
            <Button size="xs" variant="danger" icon={Trash2} onClick={() => onBulk("delete")}>
              Delete
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <Card className="overflow-hidden">
        {opps.length === 0 ? (
          <EmptyState icon={Kanban} title="No opportunities" description="Add interested leads to this pipeline to track them to close." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="border-b border-slate-100 dark:border-white/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/60 dark:bg-white/[0.02]">
                  <th className="pl-4 pr-2 py-3 w-10">
                    <Checkbox checked={all} indeterminate={selected.size > 0} onChange={(v) => onSelect(v ? new Set(opps.map((o) => o.id)) : new Set())} />
                  </th>
                  <th className="px-3 py-3">Opportunity</th>
                  <th className="px-3 py-3">Stage</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3 text-right">Value</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Source</th>
                  <th className="px-3 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {opps.map((o, i) => {
                  const stage = stageMap.get(o.stageId);
                  return (
                    <motion.tr
                      key={o.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i, 14) * 0.03 }}
                      onClick={() => onOpen(o)}
                      className="group cursor-pointer border-b border-slate-100 dark:border-white/5 last:border-0 hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                    >
                      <td className="pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(o.id)}
                          onChange={(v) => {
                            const next = new Set(selected);
                            if (v) next.add(o.id);
                            else next.delete(o.id);
                            onSelect(next);
                          }}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-800 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{o.name}</div>
                        {o.contact && (
                          <Link href={`/crm/contacts/${o.contact.id}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-slate-500 hover:text-blue-600">
                            {o.contact.name}
                            {o.contact.phone ? ` · ${o.contact.phone}` : ""}
                          </Link>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                          <span className={cn("w-2 h-2 rounded-full", color(stage?.color).dot)} />
                          {stage?.name || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <Badge color={OPPORTUNITY_STATUS_COLOR[o.status]}>{OPPORTUNITY_STATUS_LABELS[o.status]}</Badge>
                        {o.status === "lost" && o.lostReason && <div className="text-[10px] text-slate-400 mt-1">{o.lostReason}</div>}
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">{formatMoney(o.value)}</td>
                      <td className="px-3 py-3">
                        {o.assignedTo ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <Avatar name={o.assignedTo} size="xs" /> {o.assignedTo}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">{o.source || "—"}</td>
                      <td className="px-3 py-3 text-xs text-slate-500 whitespace-nowrap">{formatDate(o.createdAt)}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function LostReasonModal({ prompt, onClose, onConfirm }: { prompt: { opp: CrmOpportunityDTO } | null; onClose: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = React.useState("");
  React.useEffect(() => {
    if (prompt) setReason("");
  }, [prompt]);
  return (
    <Modal
      open={!!prompt}
      onClose={onClose}
      title="Why was this deal lost?"
      description={prompt?.opp.name}
      size="sm"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" onClick={() => onConfirm(reason)}>
            Mark as lost
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-1.5">
        {LOST_REASONS.map((r, i) => (
          <motion.button
            key={r}
            type="button"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            onClick={() => setReason(r)}
            className={cn(
              "relative text-left px-3.5 py-2.5 rounded-xl border text-sm font-semibold cursor-pointer transition-colors",
              reason === r ? "border-rose-400 text-rose-700 dark:text-rose-300" : "border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
            )}
          >
            {reason === r && <motion.span layoutId="lostReason" transition={SPRING} className="absolute inset-0 rounded-xl bg-rose-50 dark:bg-rose-500/10" />}
            <span className="relative">{r}</span>
          </motion.button>
        ))}
      </div>
    </Modal>
  );
}
