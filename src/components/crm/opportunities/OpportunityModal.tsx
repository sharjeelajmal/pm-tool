"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Kanban, Trash2 } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import {
  LEAD_SOURCES,
  LOST_REASONS,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  type CrmOpportunityDTO,
  type OpportunityStatus,
} from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { ContactPicker, MemberSelect, TagInput, type PickedContact } from "@/components/crm/common";
import { OPPORTUNITY_STATUS_COLOR, color } from "@/components/crm/theme";
import { Button, ChoiceChips, Dropdown, Field, Input, Modal, useFeedback } from "@/components/crm/ui";

export function OpportunityModal({
  open,
  onClose,
  opportunity,
  defaultContact,
  defaultPipelineId,
  defaultStageId,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  opportunity?: CrmOpportunityDTO | null;
  defaultContact?: PickedContact | null;
  defaultPipelineId?: string;
  defaultStageId?: string;
  onSaved?: (opportunity: CrmOpportunityDTO) => void;
  onDeleted?: (id: string) => void;
}) {
  const { pipelines, me } = useCrm();
  const { toast, confirm } = useFeedback();
  const [contact, setContact] = React.useState<PickedContact | null>(null);
  const [name, setName] = React.useState("");
  const [pipelineId, setPipelineId] = React.useState("");
  const [stageId, setStageId] = React.useState("");
  const [status, setStatus] = React.useState<OpportunityStatus>("open");
  const [value, setValue] = React.useState("");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [source, setSource] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [lostReason, setLostReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const pipeline = pipelines.find((p) => p.id === (opportunity?.pipelineId || defaultPipelineId)) || pipelines[0];
    setContact(
      opportunity?.contact
        ? { id: opportunity.contact.id, name: opportunity.contact.name, businessName: opportunity.contact.businessName, phone: opportunity.contact.phone }
        : defaultContact || null
    );
    setName(opportunity?.name || "");
    setPipelineId(pipeline?.id || "");
    setStageId(opportunity?.stageId || defaultStageId || pipeline?.stages[0]?.id || "");
    setStatus(opportunity?.status || "open");
    setValue(opportunity ? String(opportunity.value || "") : "");
    setAssignedTo(opportunity?.assignedTo ?? me.username);
    setSource(opportunity?.source || "");
    setTags(opportunity?.tags || []);
    setLostReason(opportunity?.lostReason || "");
  }, [open, opportunity, defaultContact, defaultPipelineId, defaultStageId, pipelines, me]);

  const pipeline = pipelines.find((p) => p.id === pipelineId);

  const save = async () => {
    if (!contact) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim() || contact.businessName || contact.name,
        pipelineId,
        stageId,
        status,
        value: Number(value) || 0,
        contactId: contact.id,
        assignedTo,
        source,
        tags,
        lostReason: status === "lost" ? lostReason : "",
      };
      const res = opportunity ? await crmApi.opportunities.update(opportunity.id, payload) : await crmApi.opportunities.create(payload);
      toast(opportunity ? "Opportunity updated" : "Opportunity added to pipeline");
      onSaved?.(res.opportunity);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!opportunity) return;
    const ok = await confirm({ title: "Delete this opportunity?", message: "The lead itself is kept.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await crmApi.opportunities.remove(opportunity.id);
      toast("Opportunity deleted");
      onDeleted?.(opportunity.id);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={opportunity ? "Edit opportunity" : "Add opportunity"}
      description={opportunity ? opportunity.name : "Put an interested lead into a pipeline stage."}
      icon={Kanban}
      size="lg"
      footer={
        <>
          {opportunity && (
            <Button size="sm" variant="ghost" icon={Trash2} onClick={remove} className="mr-auto text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
              Delete
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={saving} disabled={!contact || !pipelineId || !stageId} onClick={save}>
            {opportunity ? "Save changes" : "Add to pipeline"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Lead / contact" required>
          <ContactPicker value={contact} onChange={setContact} />
        </Field>
        {opportunity?.contact && (
          <Link
            href={`/crm/contacts/${opportunity.contact.id}`}
            className="self-start -mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
          >
            Open lead profile <ExternalLink className="w-3 h-3" />
          </Link>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Opportunity name" className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={contact ? contact.businessName || contact.name : "Defaults to the lead's business name"} />
          </Field>
          <Field label="Pipeline">
            <Dropdown
              value={pipelineId}
              onChange={(v) => {
                setPipelineId(v);
                setStageId(pipelines.find((p) => p.id === v)?.stages[0]?.id || "");
              }}
              options={pipelines.map((p) => ({ value: p.id, label: p.name, icon: Kanban }))}
              label="Pipeline"
            />
          </Field>
          <Field label="Stage">
            <Dropdown
              value={stageId}
              onChange={setStageId}
              options={(pipeline?.stages || []).map((s) => ({ value: s.id, label: s.name, dot: color(s.color).dot, description: s.kind !== "open" ? `Marks the deal ${s.kind}` : undefined }))}
              label="Stage"
            />
          </Field>
          <Field label="Opportunity value (USD)">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
              <Input type="number" min={0} step="0.01" value={value} onChange={(e) => setValue(e.target.value)} className="pl-7" placeholder="0.00" />
            </div>
          </Field>
          <Field label="Owner">
            <MemberSelect value={assignedTo} onChange={setAssignedTo} />
          </Field>
        </div>

        <Field label="Status">
          <ChoiceChips
            value={status}
            onChange={setStatus}
            options={OPPORTUNITY_STATUSES.map((s) => ({ value: s, label: OPPORTUNITY_STATUS_LABELS[s], colorName: OPPORTUNITY_STATUS_COLOR[s] }))}
          />
        </Field>
        {status === "lost" && (
          <Field label="Lost reason">
            <Dropdown
              value={LOST_REASONS.includes(lostReason) || !lostReason ? lostReason : "Other"}
              onChange={setLostReason}
              options={LOST_REASONS.map((r) => ({ value: r, label: r }))}
              placeholder="Select a reason…"
              label="Lost reason"
            />
          </Field>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Source">
            <Input list="crm-opp-sources" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Google Maps" />
            <datalist id="crm-opp-sources">
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field label="Tags">
            <TagInput value={tags} onChange={setTags} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
