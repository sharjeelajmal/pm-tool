"use client";

import * as React from "react";
import { CircleCheck, Download, FileSpreadsheet, Upload } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import { parseCsv, toCsv } from "@/lib/crm/csv";
import { STANDARD_FIELDS, type LeadStatus } from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { MemberSelect, STATUS_OPTIONS, TagInput, useListOptions } from "@/components/crm/common";
import { Button, Dropdown, Field, Modal, cn, useFeedback } from "@/components/crm/ui";

const SYNONYMS: Record<string, string[]> = {
  fullName: ["name", "full name", "contact name", "contact", "lead name"],
  firstName: ["first name", "firstname", "first", "fname", "given name"],
  lastName: ["last name", "lastname", "surname", "last", "lname", "family name"],
  businessName: ["business name", "business", "company", "company name", "organization", "organisation", "firm"],
  phone: ["phone", "phone number", "mobile", "cell", "telephone", "tel", "contact number", "whatsapp", "number"],
  email: ["email", "e-mail", "email address", "mail"],
  website: ["website", "url", "site", "web", "domain"],
  address: ["address", "street", "address1", "street address", "address line 1"],
  city: ["city", "town"],
  state: ["state", "province", "region"],
  postalCode: ["zip", "zip code", "postal code", "postcode", "postal"],
  country: ["country"],
  source: ["source", "lead source", "channel"],
  tags: ["tags", "tag", "labels", "label"],
};

const CHUNK = 1000;
type Step = "upload" | "map" | "importing" | "done";

function normalize(header: string) {
  return header.toLowerCase().replace(/[_\-.]+/g, " ").replace(/\s+/g, " ").trim();
}

export function ImportModal({
  open,
  onClose,
  defaultListId = "",
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  defaultListId?: string;
  onImported?: () => void;
}) {
  const { fields, me, refreshLists } = useCrm();
  const listOptions = useListOptions();
  const { toast } = useFeedback();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [step, setStep] = React.useState<Step>("upload");
  const [fileName, setFileName] = React.useState("");
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [rows, setRows] = React.useState<string[][]>([]);
  const [mapping, setMapping] = React.useState<string[]>([]);
  const [listId, setListId] = React.useState(defaultListId);
  const [status, setStatus] = React.useState<LeadStatus>("new");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [duplicateMode, setDuplicateMode] = React.useState<"skip" | "update" | "create">("skip");
  const [progress, setProgress] = React.useState(0);
  const [result, setResult] = React.useState({ created: 0, updated: 0, skipped: 0, invalid: 0 });
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setStep("upload");
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping([]);
    setListId(defaultListId);
    setStatus("new");
    setAssignedTo(me.scope === "assigned" ? me.username : "");
    setTags([]);
    setDuplicateMode("skip");
    setProgress(0);
  }, [open, defaultListId, me]);

  const targets = React.useMemo(
    () => [
      { value: "", label: "— Don't import —" },
      { value: "fullName", label: "Full name (split into first / last)" },
      ...STANDARD_FIELDS.map((f) => ({ value: f.key, label: f.label })),
      { value: "tags", label: "Tags (comma or ; separated)" },
      ...fields.map((f) => ({ value: `cf:${f.id}`, label: `Custom · ${f.name}` })),
    ],
    [fields]
  );

  const readFile = async (file: File) => {
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      toast("Please upload a .csv file (in Excel: File → Save As → CSV)", "error");
      return;
    }
    const parsed = parseCsv(await file.text());
    if (parsed.length < 2) {
      toast("The file has no data rows", "error");
      return;
    }
    const [head, ...body] = parsed;
    if (body.length > 20000) {
      toast("Please split files larger than 20,000 rows", "error");
      return;
    }
    // Auto-map columns by header name.
    const used = new Set<string>();
    const auto = head.map((h) => {
      const n = normalize(h);
      const custom = fields.find((f) => normalize(f.name) === n);
      let target = custom ? `cf:${custom.id}` : "";
      if (!target) {
        target = Object.entries(SYNONYMS).find(([, names]) => names.includes(n))?.[0] || "";
      }
      if (target && used.has(target)) return "";
      if (target) used.add(target);
      return target;
    });
    setFileName(file.name);
    setHeaders(head);
    setRows(body);
    setMapping(auto);
    setStep("map");
  };

  const buildRow = (row: string[]) => {
    const out: Record<string, unknown> = {};
    const custom: Record<string, unknown> = {};
    mapping.forEach((target, i) => {
      const value = (row[i] || "").trim();
      if (!target || !value) return;
      if (target === "fullName") {
        const [first, ...rest] = value.split(/\s+/);
        out.firstName ??= first;
        if (rest.length) out.lastName ??= rest.join(" ");
      } else if (target.startsWith("cf:")) {
        custom[target.slice(3)] = value;
      } else {
        out[target] = value;
      }
    });
    out.customFields = custom;
    return out;
  };

  const runImport = async () => {
    setStep("importing");
    const totals = { created: 0, updated: 0, skipped: 0, invalid: 0 };
    try {
      for (let i = 0; i < rows.length; i += CHUNK) {
        const chunk = rows.slice(i, i + CHUNK).map(buildRow);
        const res = await crmApi.contacts.import({ rows: chunk, listId, duplicateMode, status, assignedTo, tags });
        totals.created += res.created;
        totals.updated += res.updated;
        totals.skipped += res.skipped;
        totals.invalid += res.invalid;
        setProgress(Math.min(100, Math.round(((i + chunk.length) / rows.length) * 100)));
      }
      setResult(totals);
      setStep("done");
      refreshLists();
      onImported?.();
    } catch (e) {
      toast((e as Error).message, "error");
      setResult(totals);
      setStep("done");
    }
  };

  const downloadTemplate = () => {
    const header = [...STANDARD_FIELDS.map((f) => f.label), "Tags", ...fields.map((f) => f.name)];
    const sample = ["Ali", "Khan", "Khan Traders", "+92 300 1234567", "ali@example.com", "", "", "Lahore", "Punjab", "", "Pakistan", "Google Maps", "vip; follow-up"];
    const blob = new Blob([toCsv([header, sample])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const mappedCount = mapping.filter(Boolean).length;
  const identityMapped = mapping.some((m) => ["fullName", "firstName", "lastName", "businessName", "email", "phone"].includes(m));

  return (
    <Modal
      open={open}
      onClose={step === "importing" ? () => undefined : onClose}
      title="Import leads from CSV"
      description={step === "map" ? `${fileName} · ${rows.length.toLocaleString()} rows` : "Upload a CSV exported from Excel, Google Sheets or another CRM."}
      icon={FileSpreadsheet}
      size="lg"
      footer={
        step === "map" ? (
          <>
            <Button size="sm" onClick={() => setStep("upload")}>
              Back
            </Button>
            <Button size="sm" variant="primary" disabled={!identityMapped} onClick={runImport}>
              Import {rows.length.toLocaleString()} leads
            </Button>
          </>
        ) : step === "done" ? (
          <Button size="sm" variant="primary" onClick={onClose}>
            Done
          </Button>
        ) : undefined
      }
    >
      {step === "upload" && (
        <div className="flex flex-col gap-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) readFile(file);
            }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center text-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 cursor-pointer transition-colors",
              dragging
                ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10"
                : "border-slate-200 dark:border-white/10 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-white/5"
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <Upload className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-white">Drop your CSV here, or click to browse</div>
              <div className="text-xs text-slate-500 mt-1">Columns are matched automatically, you can adjust them on the next step.</div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) readFile(file);
                e.target.value = "";
              }}
            />
          </div>
          <button type="button" onClick={downloadTemplate} className="self-start inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            Download a sample template
          </button>
        </div>
      )}

      {step === "map" && (
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-extrabold text-slate-800 dark:text-white">Map columns</h3>
              <span className="text-[11px] text-slate-500">
                {mappedCount} of {headers.length} columns mapped
              </span>
            </div>
            <div className="rounded-xl border border-slate-200/70 dark:border-white/10 overflow-hidden divide-y divide-slate-100 dark:divide-white/5">
              {headers.map((header, i) => (
                <div key={`${header}-${i}`} className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 items-center px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-white truncate">{header || `Column ${i + 1}`}</div>
                    <div className="text-[11px] text-slate-400 truncate">e.g. {rows.find((r) => r[i])?.[i] || "—"}</div>
                  </div>
                  <Dropdown
                    value={mapping[i] || ""}
                    onChange={(val) => setMapping((m) => m.map((v, j) => (j === i ? val : v === val && val ? "" : v)))}
                    options={targets}
                    searchable
                    label={`Map ${header || `column ${i + 1}`}`}
                  />
                </div>
              ))}
            </div>
            {!identityMapped && (
              <p className="text-[11px] text-rose-600 mt-2">Map at least one of: name, business name, email or phone.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Add to list">
              <Dropdown value={listId} onChange={setListId} options={listOptions} label="Lead list" />
            </Field>
            <Field label="Status for new leads">
              <Dropdown value={status} onChange={setStatus} options={STATUS_OPTIONS} label="Status" />
            </Field>
            <Field label="Owner">
              <MemberSelect value={assignedTo} onChange={setAssignedTo} />
            </Field>
            <Field label="Tags for all imported leads">
              <TagInput value={tags} onChange={setTags} />
            </Field>
          </div>

          <Field label="When a lead already exists (same email or phone)">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(
                [
                  ["skip", "Skip it", "Keep the existing lead untouched"],
                  ["update", "Update it", "Fill in the new values from the file"],
                  ["create", "Create anyway", "Allow duplicates"],
                ] as const
              ).map(([value, label, hint]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDuplicateMode(value)}
                  className={cn(
                    "text-left rounded-xl border px-3 py-2.5 transition-colors cursor-pointer",
                    duplicateMode === value
                      ? "border-blue-500 bg-blue-50/60 dark:bg-blue-500/10 ring-1 ring-blue-500"
                      : "border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5"
                  )}
                >
                  <div className="text-xs font-bold text-slate-800 dark:text-white">{label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{hint}</div>
                </button>
              ))}
            </div>
          </Field>
        </div>
      )}

      {step === "importing" && (
        <div className="py-12 flex flex-col items-center gap-4">
          <div className="text-sm font-bold text-slate-800 dark:text-white">Importing leads… {progress}%</div>
          <div className="w-full max-w-sm h-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
            <div className="h-full bg-blue-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-slate-500">Please keep this window open.</div>
        </div>
      )}

      {step === "done" && (
        <div className="py-8 flex flex-col items-center gap-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <CircleCheck className="w-7 h-7 text-emerald-600" />
          </div>
          <div className="text-base font-extrabold text-slate-900 dark:text-white">Import finished</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
            {(
              [
                ["Created", result.created, "text-emerald-600"],
                ["Updated", result.updated, "text-blue-600"],
                ["Skipped (duplicates)", result.skipped, "text-amber-600"],
                ["Empty rows", result.invalid, "text-slate-500"],
              ] as const
            ).map(([label, value, tone]) => (
              <div key={label} className="rounded-xl border border-slate-200/70 dark:border-white/10 p-3">
                <div className={cn("text-xl font-extrabold tabular-nums", tone)}>{value.toLocaleString()}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
