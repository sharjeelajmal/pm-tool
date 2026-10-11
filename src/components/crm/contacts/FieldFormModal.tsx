"use client";

import * as React from "react";
import { Columns3 } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import { FIELD_TYPES, FIELD_TYPE_LABELS, type CrmFieldDTO, type FieldType } from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { color } from "@/components/crm/theme";
import { Button, Dropdown, Field, Input, Modal, Textarea, cn, useFeedback } from "@/components/crm/ui";

export function FieldFormModal({
  open,
  onClose,
  field,
  defaultListIds = [],
}: {
  open: boolean;
  onClose: () => void;
  field?: CrmFieldDTO | null;
  defaultListIds?: string[];
}) {
  const { lists, refreshFields } = useCrm();
  const { toast } = useFeedback();
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState<FieldType>("text");
  const [options, setOptions] = React.useState("");
  const [listIds, setListIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setName(field?.name || "");
    setType(field?.type || "text");
    setOptions((field?.options || []).join("\n"));
    setListIds(field?.listIds || defaultListIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, field]);

  const save = async () => {
    setSaving(true);
    try {
      const opts = options
        .split("\n")
        .map((o) => o.trim())
        .filter(Boolean);
      if (field) await crmApi.fields.update(field.id, { name: name.trim(), options: opts, listIds });
      else await crmApi.fields.create({ name: name.trim(), type, options: opts, listIds });
      await refreshFields();
      toast(field ? "Column updated" : `Column “${name.trim()}” added`);
      onClose();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleList = (id: string) => setListIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={field ? "Edit custom column" : "Add a custom column"}
      description="Custom columns appear in the lead sheet, the lead profile and CSV import/export."
      icon={Columns3}
      size="sm"
      footer={
        <>
          <Button size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            loading={saving}
            disabled={!name.trim() || (type === "dropdown" && !options.trim())}
            onClick={save}
          >
            {field ? "Save" : "Add column"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Column name" required>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Budget, Show type, Rating" maxLength={60} />
        </Field>
        <Field label="Type" hint={field ? "The type can't be changed after the column is created." : undefined}>
          <Dropdown value={type} disabled={!!field} onChange={setType} options={FIELD_TYPES.map((t) => ({ value: t, label: FIELD_TYPE_LABELS[t] }))} label="Field type" />
        </Field>
        {type === "dropdown" && (
          <Field label="Options" hint="One option per line">
            <Textarea value={options} onChange={(e) => setOptions(e.target.value)} placeholder={"Hot\nWarm\nCold"} />
          </Field>
        )}
        {lists.length > 0 && (
          <Field label="Show in lists" hint={listIds.length ? undefined : "Shown in every list"}>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setListIds([])}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer",
                  !listIds.length ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300" : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                )}
              >
                All lists
              </button>
              {lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggleList(l.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer",
                    listIds.includes(l.id)
                      ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                      : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", color(l.color).dot)} />
                  {l.name}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  );
}
