"use client";

import * as React from "react";
import { CalendarPlus, Check, Kanban, Loader2, Maximize2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import {
  STANDARD_FIELDS,
  type CrmContactDTO,
  type CrmContactInput,
  type CrmFieldDTO,
  type FieldType,
  type LeadStatus,
} from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { StatusPicker, fieldsForList, useMemberOptions } from "@/components/crm/common";
import { DatePicker } from "@/components/crm/pickers";
import { FieldFormModal } from "@/components/crm/contacts/FieldFormModal";
import { Card, Dropdown, IconButton, Menu, cn, useFeedback } from "@/components/crm/ui";
import { motion } from "framer-motion";

type ColumnKind = "std" | "status" | "owner" | "tags" | "custom";

interface Column {
  id: string;
  label: string;
  width: number;
  kind: ColumnKind;
  field?: CrmFieldDTO;
}

const WIDTHS: Record<string, number> = {
  firstName: 140,
  lastName: 140,
  businessName: 210,
  phone: 160,
  email: 210,
  website: 190,
  address: 220,
  city: 130,
  state: 130,
  postalCode: 110,
  country: 130,
  source: 150,
};

const INPUT_TYPE: Partial<Record<string, string>> = { phone: "tel", email: "email", website: "url" };
const FIELD_INPUT: Partial<Record<FieldType, string>> = { number: "number", monetary: "number", date: "date", email: "email", url: "url", phone: "tel" };

const cellInput =
  "w-full h-9 px-3 bg-transparent outline-none text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:bg-blue-50/70 dark:focus:bg-blue-500/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 disabled:cursor-not-allowed";

function focusCell(row: number, col: number) {
  const el = document.querySelector<HTMLElement>(`[data-sheet] [data-row="${row}"][data-col="${col}"]`);
  el?.focus();
  if (el instanceof HTMLInputElement) el.select();
}

function cellKeys(row: number, col: number, onEscape: () => void) {
  return (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      focusCell(row + 1, col);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focusCell(row - 1, col);
    } else if (e.key === "Escape") {
      onEscape();
      (e.currentTarget as HTMLElement).blur();
    }
  };
}

const TextCell = React.memo(function TextCell({
  value,
  row,
  col,
  type = "text",
  disabled,
  placeholder,
  onCommit,
}: {
  value: string;
  row: number;
  col: number;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const focused = React.useRef(false);
  React.useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <input
      data-row={row}
      data-col={col}
      type={type}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={() => (focused.current = true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        focused.current = false;
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={cellKeys(row, col, () => setDraft(value))}
      className={cellInput}
    />
  );
});

interface Props {
  contacts: CrmContactDTO[];
  loading: boolean;
  listId: string;
  onPatch: (id: string, patch: CrmContactInput) => Promise<CrmContactDTO>;
  onCreate: (input: CrmContactInput) => Promise<CrmContactDTO>;
  onOpen: (contact: CrmContactDTO) => void;
  onAddOpportunity: (contact: CrmContactDTO) => void;
  onBook: (contact: CrmContactDTO) => void;
  onDelete: (contact: CrmContactDTO) => void;
}

function patchFor(col: Column, raw: unknown): CrmContactInput {
  switch (col.kind) {
    case "std":
      return { [col.id]: String(raw ?? "") } as CrmContactInput;
    case "status":
      return { status: raw as LeadStatus };
    case "owner":
      return { assignedTo: String(raw ?? "") };
    case "tags":
      return {
        tags: String(raw ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };
    default: {
      let value: unknown = raw;
      if (col.field && (col.field.type === "number" || col.field.type === "monetary")) value = raw === "" || raw === null ? null : Number(raw);
      return { customFields: { [col.id]: value } };
    }
  }
}

function isBlank(raw: unknown) {
  return raw === null || raw === undefined || raw === "" || raw === false;
}

export function LeadSheet({ contacts, loading, listId, onPatch, onCreate, onOpen, onAddOpportunity, onBook, onDelete }: Props) {
  const { fields, me } = useCrm();
  const ownerOptions = useMemberOptions(true);
  const { toast } = useFeedback();
  const [fieldModal, setFieldModal] = React.useState(false);
  const [saving, setSaving] = React.useState<Record<number, "saving" | "saved">>({});
  // Ghost row index -> contact being / already created from it.
  const pending = React.useRef(new Map<number, Promise<CrmContactDTO | null>>());

  React.useEffect(() => {
    for (const row of [...pending.current.keys()]) if (row < contacts.length) pending.current.delete(row);
  }, [contacts]);

  const columns = React.useMemo<Column[]>(() => {
    const custom = listId === "all" || listId === "none" ? (listId === "all" ? fields : fieldsForList(fields, "")) : fieldsForList(fields, listId);
    return [
      ...STANDARD_FIELDS.map((f) => ({ id: f.key, label: f.label, width: WIDTHS[f.key] || 150, kind: "std" as const })),
      { id: "status", label: "Status", width: 170, kind: "status" as const },
      { id: "assignedTo", label: "Owner", width: 150, kind: "owner" as const },
      { id: "tags", label: "Tags", width: 190, kind: "tags" as const },
      ...custom.map((f) => ({ id: f.id, label: f.name, width: f.type === "checkbox" ? 120 : 170, kind: "custom" as const, field: f })),
    ];
  }, [fields, listId]);

  const markRow = (row: number, state: "saving" | "saved" | null) =>
    setSaving((s) => {
      const next = { ...s };
      if (state) next[row] = state;
      else delete next[row];
      return next;
    });

  const commit = async (row: number, col: Column, raw: unknown) => {
    const patch = patchFor(col, raw);
    const contact = contacts[row];
    markRow(row, "saving");
    try {
      if (contact) {
        await onPatch(contact.id, patch);
      } else {
        const existing = pending.current.get(row);
        if (existing) {
          const created = await existing;
          if (created) await onPatch(created.id, patch);
        } else {
          if (isBlank(raw)) {
            markRow(row, null);
            return;
          }
          const promise = onCreate(patch).catch((e) => {
            toast((e as Error).message, "error");
            return null;
          });
          pending.current.set(row, promise);
          const created = await promise;
          if (!created) pending.current.delete(row);
          else toast("Lead added");
        }
      }
      markRow(row, "saved");
      setTimeout(() => markRow(row, null), 1200);
    } catch {
      markRow(row, null);
    }
  };

  // One editable blank row at a time, plus a few faded rows for the "blank sheet" look.
  const ghostCount = contacts.length === 0 ? 8 : 3;
  const totalWidth = 96 + columns.reduce((sum, c) => sum + c.width, 0) + (me.isAdmin ? 130 : 0);

  const renderCell = (row: number, col: Column, colIndex: number, contact: CrmContactDTO | undefined, editable: boolean) => {
    const disabled = !editable;
    switch (col.kind) {
      case "std": {
        const value = contact ? String(contact[col.id as keyof CrmContactDTO] ?? "") : "";
        return (
          <TextCell
            value={value}
            row={row}
            col={colIndex}
            type={INPUT_TYPE[col.id] || "text"}
            disabled={disabled}
            placeholder={editable && !contact && colIndex === 0 ? "Type to add a lead…" : undefined}
            onCommit={(v) => commit(row, col, v)}
          />
        );
      }
      case "status":
        return contact ? (
          <div className="h-9 px-2.5 flex items-center">
            <StatusPicker value={contact.status} onChange={(s) => commit(row, col, s)} />
          </div>
        ) : (
          <div className="h-9" />
        );
      case "owner":
        return contact ? (
          <Dropdown size="cell" value={contact.assignedTo || ""} onChange={(v) => commit(row, col, v)} options={ownerOptions} label="Owner" />
        ) : (
          <div className="h-9" />
        );
      case "tags":
        return (
          <TextCell
            value={(contact?.tags || []).join(", ")}
            row={row}
            col={colIndex}
            disabled={disabled}
            onCommit={(v) => commit(row, col, v)}
          />
        );
      default: {
        const field = col.field!;
        const raw = contact?.customFields?.[field.id];
        if (field.type === "checkbox") {
          return (
            <label className="h-9 px-3 flex items-center">
              <input
                type="checkbox"
                data-row={row}
                data-col={colIndex}
                disabled={disabled}
                checked={raw === true}
                onChange={(e) => commit(row, col, e.target.checked)}
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
            </label>
          );
        }
        if (field.type === "dropdown") {
          return disabled ? (
            <div className="h-9" />
          ) : (
            <Dropdown
              size="cell"
              value={raw === null || raw === undefined ? "" : String(raw)}
              onChange={(v) => commit(row, col, v)}
              options={[{ value: "", label: "—" }, ...field.options.map((o) => ({ value: o, label: o }))]}
              placeholder=""
              label={field.name}
            />
          );
        }
        if (field.type === "date") {
          return disabled ? <div className="h-9" /> : <DatePicker size="cell" value={raw ? String(raw).slice(0, 10) : ""} onChange={(v) => commit(row, col, v)} placeholder="" />;
        }
        return (
          <TextCell
            value={raw === null || raw === undefined ? "" : String(raw)}
            row={row}
            col={colIndex}
            type={FIELD_INPUT[field.type] || "text"}
            disabled={disabled}
            onCommit={(v) => commit(row, col, v)}
          />
        );
      }
    }
  };

  const rows = contacts.length + ghostCount;

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-2 text-[11px] text-slate-500">
        <span>
          Click any box to edit, changes save automatically. Type in the empty row to add a new lead.{" "}
          <span className="hidden sm:inline">Enter / ↑ ↓ move between rows.</span>
        </span>
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />}
      </div>
      <Card className="overflow-hidden">
        <div data-sheet className="overflow-auto max-h-[70dvh]">
          <table className="border-separate border-spacing-0 table-fixed text-left" style={{ width: totalWidth }}>
            <colgroup>
              <col style={{ width: 96 }} />
              {columns.map((c) => (
                <col key={c.id} style={{ width: c.width }} />
              ))}
              {me.isAdmin && <col style={{ width: 130 }} />}
            </colgroup>
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-30 h-9 bg-slate-100 dark:bg-[#131c31] border-b border-r border-slate-200 dark:border-white/10" />
                {columns.map((c) => (
                  <th
                    key={c.id}
                    className="sticky top-0 z-20 h-9 px-3 bg-slate-100 dark:bg-[#131c31] border-b border-r border-slate-200 dark:border-white/10 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate"
                    title={c.field ? `Custom · ${c.label}` : c.label}
                  >
                    {c.label}
                    {c.field && <span className="ml-1 text-[9px] text-blue-500 normal-case tracking-normal">custom</span>}
                  </th>
                ))}
                {me.isAdmin && (
                  <th className="sticky top-0 z-20 h-9 bg-slate-100 dark:bg-[#131c31] border-b border-slate-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => setFieldModal(true)}
                      className="w-full h-9 inline-flex items-center justify-center gap-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add column
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, row) => {
                const contact = contacts[row];
                const isGhost = !contact;
                // Only the first blank row is typeable; the rest are visual "empty boxes".
                const editable = !isGhost || row === contacts.length;
                const state = saving[row];
                return (
                  <motion.tr
                    key={row}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: isGhost && !editable ? 0.5 : 1, y: 0 }}
                    transition={{ delay: Math.min(row, 20) * 0.015, duration: 0.3 }}
                    className="group"
                  >
                    <td className="sticky left-0 z-10 h-9 bg-slate-50 dark:bg-[#0F172A] border-b border-r border-slate-200 dark:border-white/10 group-hover:bg-slate-100 dark:group-hover:bg-[#131c31]">
                      <div className="flex items-center h-9 pl-2 pr-1 gap-1">
                        <span className="w-6 text-[10px] font-semibold text-slate-400 tabular-nums text-right">
                          {state === "saving" ? (
                            <Loader2 className="w-3 h-3 animate-spin text-blue-600 ml-auto" />
                          ) : state === "saved" ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500 ml-auto" />
                          ) : (
                            row + 1
                          )}
                        </span>
                        {contact && (
                          <>
                            <IconButton icon={Maximize2} label="Open lead profile" onClick={() => onOpen(contact)} className="w-7 h-7" />
                            <Menu
                              align="start"
                              trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label="Row actions" className="w-7 h-7" />}
                              items={[
                                { label: "Open profile", icon: Maximize2, onClick: () => onOpen(contact) },
                                { label: "Add to pipeline", icon: Kanban, onClick: () => onAddOpportunity(contact) },
                                { label: "Book follow-up", icon: CalendarPlus, onClick: () => onBook(contact) },
                                "divider",
                                { label: "Delete lead", icon: Trash2, danger: true, onClick: () => onDelete(contact) },
                              ]}
                            />
                          </>
                        )}
                      </div>
                    </td>
                    {columns.map((col, colIndex) => (
                      <td
                        key={col.id}
                        className={cn(
                          "h-9 p-0 border-b border-r border-slate-200 dark:border-white/10",
                          isGhost ? "bg-white/60 dark:bg-transparent" : "bg-white dark:bg-[#0F172A]"
                        )}
                      >
                        {renderCell(row, col, colIndex, contact, editable)}
                      </td>
                    ))}
                    {me.isAdmin && <td className="h-9 border-b border-slate-200 dark:border-white/10" />}
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <FieldFormModal
        open={fieldModal}
        onClose={() => setFieldModal(false)}
        defaultListIds={listId !== "all" && listId !== "none" ? [listId] : []}
      />
    </>
  );
}
