"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Kanban, Plus, Trash2 } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import type { CrmPipelineDTO, CrmStageDTO } from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { COLOR_NAMES, color } from "@/components/crm/theme";
import { Button, Dropdown, Field, IconButton, Input, Modal, Popover, cn, useFeedback } from "@/components/crm/ui";

type DraftStage = Omit<CrmStageDTO, "id"> & { id?: string; key: string };

let keySeq = 0;
const nextKey = () => `s${++keySeq}`;

export function PipelineEditorModal({
  open,
  onClose,
  pipeline,
  stageCounts = {},
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  pipeline?: CrmPipelineDTO | null;
  stageCounts?: Record<string, number>;
  onSaved?: (pipeline: CrmPipelineDTO | null) => void;
}) {
  const { pipelines, refreshPipelines } = useCrm();
  const { toast, confirm } = useFeedback();
  const [name, setName] = React.useState("");
  const [stages, setStages] = React.useState<DraftStage[]>([]);
  const [moveTo, setMoveTo] = React.useState<Record<string, string>>({});
  const [removed, setRemoved] = React.useState<CrmStageDTO[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(pipeline?.name || "");
    setStages(
      pipeline
        ? pipeline.stages.map((s) => ({ ...s, key: nextKey() }))
        : [
            { name: "New Lead", color: "sky", kind: "open", key: nextKey() },
            { name: "Contacted", color: "indigo", kind: "open", key: nextKey() },
            { name: "Proposal Sent", color: "amber", kind: "open", key: nextKey() },
            { name: "Closed · Won", color: "emerald", kind: "won", key: nextKey() },
          ]
    );
    setMoveTo({});
    setRemoved([]);
  }, [open, pipeline]);

  const patch = (key: string, data: Partial<DraftStage>) => setStages((list) => list.map((s) => (s.key === key ? { ...s, ...data } : s)));
  const move = (index: number, delta: number) =>
    setStages((list) => {
      const next = [...list];
      const target = index + delta;
      if (target < 0 || target >= next.length) return list;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const removeStage = (stage: DraftStage) => {
    setStages((list) => list.filter((s) => s.key !== stage.key));
    if (stage.id) setRemoved((r) => [...r, { id: stage.id!, name: stage.name, color: stage.color, kind: stage.kind }]);
  };

  const keptWithIds = stages.filter((s) => s.id);
  const valid = name.trim() && stages.length > 0 && stages.every((s) => s.name.trim());

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        stages: stages.map(({ id, name: n, color: c, kind }) => ({ id, name: n.trim(), color: c, kind })),
        moveTo,
      };
      const res = pipeline ? await crmApi.pipelines.update(pipeline.id, payload) : await crmApi.pipelines.create(payload);
      await refreshPipelines();
      toast(pipeline ? "Pipeline saved" : `Pipeline “${res.pipeline.name}” created`);
      onSaved?.(res.pipeline);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const deletePipeline = async () => {
    if (!pipeline) return;
    const total = Object.values(stageCounts).reduce((a, b) => a + b, 0);
    const ok = await confirm({
      title: `Delete “${pipeline.name}”?`,
      message: total ? `${total} opportunities in this pipeline will be deleted. Leads are kept.` : "This pipeline has no opportunities.",
      confirmLabel: "Delete pipeline",
      danger: true,
    });
    if (!ok) return;
    try {
      await crmApi.pipelines.remove(pipeline.id);
      await refreshPipelines();
      toast("Pipeline deleted");
      onSaved?.(null);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pipeline ? "Edit pipeline" : "New pipeline"}
      description="Stages are the columns of your board. Mark a stage as Won or Lost to update the deal status automatically."
      icon={Kanban}
      size="lg"
      footer={
        <>
          {pipeline && pipelines.length > 1 && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={deletePipeline} className="mr-auto text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
              Delete pipeline
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={saving} disabled={!valid} onClick={save}>
            {pipeline ? "Save pipeline" : "Create pipeline"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Pipeline name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2.2 Maps · Warm Conversion" autoFocus={!pipeline} />
        </Field>

        <div className="flex flex-col gap-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Stages</div>
          {stages.map((stage, index) => (
            <div key={stage.key} className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.02] p-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer" aria-label="Move up">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === stages.length - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer" aria-label="Move down">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
              <Popover
                width={196}
                trigger={(props) => (
                  <button {...props} type="button" className={cn("w-6 h-6 rounded-full shrink-0 cursor-pointer ring-2 ring-white dark:ring-[#0F172A] shadow", color(stage.color).dot)} aria-label="Stage color" />
                )}
              >
                {(close) => (
                  <div className="grid grid-cols-6 gap-2 p-2">
                    {COLOR_NAMES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          patch(stage.key, { color: c });
                          close();
                        }}
                        className={cn("w-6 h-6 rounded-full cursor-pointer", color(c).dot, stage.color === c && "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-[#111a2e]")}
                        aria-label={c}
                      />
                    ))}
                  </div>
                )}
              </Popover>
              <Input value={stage.name} onChange={(e) => patch(stage.key, { name: e.target.value })} className="h-9 flex-1" placeholder="Stage name" />
              <Dropdown
                size="sm"
                width={150}
                value={stage.kind}
                onChange={(v) => patch(stage.key, { kind: v })}
                options={[
                  { value: "open", label: "Open", dot: "bg-blue-500" },
                  { value: "won", label: "Won", dot: "bg-emerald-500", description: "Marks deals won" },
                  { value: "lost", label: "Lost", dot: "bg-rose-500", description: "Marks deals lost" },
                ]}
                className="w-28 h-9"
                label="Stage type"
              />
              <IconButton icon={Trash2} label="Delete stage" tone="danger" disabled={stages.length <= 1} onClick={() => removeStage(stage)} />
            </div>
          ))}
          <Button
            size="sm"
            variant="soft"
            icon={Plus}
            className="self-start"
            onClick={() => setStages((list) => [...list, { name: "", color: COLOR_NAMES[(list.length + 2) % COLOR_NAMES.length], kind: "open", key: nextKey() }])}
          >
            Add stage
          </Button>
        </div>

        {removed.filter((s) => stageCounts[s.id]).length > 0 && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/5 p-3">
            <div className="text-xs font-bold text-amber-800 dark:text-amber-300">Move opportunities from deleted stages</div>
            {removed
              .filter((s) => stageCounts[s.id])
              .map((s) => (
                <div key={s.id} className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
                  <span className="flex-1 text-slate-700 dark:text-slate-200">
                    <b>{stageCounts[s.id]}</b> in “{s.name}” move to
                  </span>
                  <Dropdown
                    value={moveTo[s.id] || keptWithIds[0]?.id || ""}
                    onChange={(v) => setMoveTo((m) => ({ ...m, [s.id]: v }))}
                    options={keptWithIds.length ? keptWithIds.map((k) => ({ value: k.id || "", label: k.name, dot: color(k.color).dot })) : [{ value: "", label: "First stage" }]}
                    className="sm:w-56 h-9"
                    label="Destination stage"
                  />
                </div>
              ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
