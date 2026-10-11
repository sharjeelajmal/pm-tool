"use client";

import * as React from "react";
import { FolderPlus } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import type { CrmListDTO } from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { COLOR_NAMES, color } from "@/components/crm/theme";
import { Button, Field, Input, Modal, Textarea, cn, useFeedback } from "@/components/crm/ui";

export function ListFormModal({
  open,
  onClose,
  list,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  list?: CrmListDTO | null;
  onSaved?: (list: CrmListDTO) => void;
}) {
  const { refreshLists } = useCrm();
  const { toast } = useFeedback();
  const [name, setName] = React.useState("");
  const [colorName, setColorName] = React.useState("blue");
  const [description, setDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(list?.name || "");
    setColorName(list?.color || COLOR_NAMES[(Math.random() * (COLOR_NAMES.length - 1) + 1) | 0]);
    setDescription(list?.description || "");
  }, [open, list]);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = list
        ? await crmApi.lists.update(list.id, { name: name.trim(), color: colorName, description })
        : await crmApi.lists.create({ name: name.trim(), color: colorName, description });
      await refreshLists();
      toast(list ? "List updated" : `List "${res.list.name}" created`);
      onSaved?.(res.list);
      onClose();
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={list ? "Edit lead list" : "New lead list"}
      description="Group leads by category, e.g. “Pakistani Leads” or “USA Magician Leads”."
      icon={FolderPlus}
      size="sm"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" loading={saving} disabled={!name.trim()} onClick={() => save()}>
            {list ? "Save changes" : "Create list"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-4">
        <Field label="List name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. USA Magician Leads" maxLength={60} />
        </Field>
        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {COLOR_NAMES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColorName(c)}
                aria-label={c}
                className={cn(
                  "w-7 h-7 rounded-full transition-transform cursor-pointer ring-offset-2 ring-offset-white dark:ring-offset-[#0F172A]",
                  color(c).dot,
                  colorName === c ? "ring-2 ring-slate-900 dark:ring-white scale-110" : "hover:scale-110"
                )}
              />
            ))}
          </div>
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional: where these leads come from"
            className="min-h-[64px]"
            maxLength={300}
          />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
