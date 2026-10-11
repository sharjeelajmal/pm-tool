"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Columns3, Copy, FolderPlus, Kanban, Link2, Pencil, Plus, Settings, ShieldCheck, Trash2, Unlink } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import { FIELD_TYPE_LABELS, type CrmFieldDTO, type CrmGoogleStatus, type CrmListDTO, type CrmPipelineDTO } from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { PageHeader } from "@/components/crm/PageHeader";
import { color } from "@/components/crm/theme";
import { Avatar, Badge, Button, Card, EmptyState, HScroll, IconButton, Segmented, Spinner, cn, useFeedback } from "@/components/crm/ui";
import { ListFormModal } from "@/components/crm/contacts/ListFormModal";
import { FieldFormModal } from "@/components/crm/contacts/FieldFormModal";
import { PipelineEditorModal } from "@/components/crm/opportunities/PipelineEditorModal";

type Tab = "team" | "lists" | "fields" | "pipelines" | "integrations";

export function SettingsView() {
  const router = useRouter();
  const params = useSearchParams();
  const { me } = useCrm();
  const tabs: { value: Tab; label: string }[] = [
    ...(me.isAdmin ? [{ value: "team" as const, label: "Team access" }] : []),
    { value: "lists", label: "Lead lists" },
    { value: "fields", label: "Custom fields" },
    { value: "pipelines", label: "Pipelines" },
    { value: "integrations", label: "Integrations" },
  ];
  const requested = params.get("tab") as Tab | null;
  const tab: Tab = requested && tabs.some((t) => t.value === requested) ? requested : tabs[0].value;

  return (
    <div className="flex flex-col pb-10">
      <PageHeader icon={Settings} title="Settings" subtitle="Configure lists, sheet columns, pipelines and integrations">
        <HScroll arrows={false}>
          <Segmented value={tab} onChange={(t) => router.replace(`/crm/settings?tab=${t}`, { scroll: false })} options={tabs} />
        </HScroll>
      </PageHeader>
      <div className="px-4 sm:px-6 lg:px-8 max-w-5xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transitionEnd: { transform: "none" } }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === "team" && <TeamTab />}
            {tab === "lists" && <ListsTab />}
            {tab === "fields" && <FieldsTab />}
            {tab === "pipelines" && <PipelinesTab />}
            {tab === "integrations" && <IntegrationsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function SectionCard({ title, description, action, children }: { title: string; description?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-white/5">
        <div>
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-white">{title}</h2>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

function TeamTab() {
  const { members, setAccessOpen } = useCrm();
  const team = members.filter((m) => !m.isAdmin);
  return (
    <SectionCard
      title="Team access"
      description="Choose which team members can open the Leads module, and whether they see all leads or only those assigned to them."
      action={
        <Button size="sm" variant="primary" icon={ShieldCheck} onClick={() => setAccessOpen(true)}>
          Manage access
        </Button>
      }
    >
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {members.map((m) => (
          <li key={m.username} className="flex items-center gap-3 px-5 py-3">
            <Avatar name={m.username} size="md" />
            <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-white">{m.username}</span>
            <Badge color={m.isAdmin ? "blue" : "emerald"}>{m.isAdmin ? "Admin · full access" : "Has access"}</Badge>
          </li>
        ))}
        {team.length === 0 && <li className="px-5 py-4 text-xs text-slate-400">No team members have access yet. Only you can open Leads.</li>}
      </ul>
    </SectionCard>
  );
}

function ListsTab() {
  const { lists, me, refreshLists } = useCrm();
  const { toast, confirm } = useFeedback();
  const [modal, setModal] = React.useState<{ open: boolean; list: CrmListDTO | null }>({ open: false, list: null });

  const remove = async (list: CrmListDTO) => {
    if (!(await confirm({ title: `Delete “${list.name}”?`, message: "Leads in it are kept and moved to “No list”.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await crmApi.lists.remove(list.id);
      await refreshLists();
      toast("List deleted");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <SectionCard
      title="Lead lists"
      description="Categories that group your leads (e.g. by country or niche)."
      action={
        <Button size="sm" variant="primary" icon={FolderPlus} onClick={() => setModal({ open: true, list: null })}>
          New list
        </Button>
      }
    >
      {lists.length === 0 ? (
        <EmptyState icon={FolderPlus} title="No lists yet" description="Create your first list to start organizing leads." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {lists.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-5 py-3">
              <span className={cn("w-3 h-3 rounded-full shrink-0", color(l.color).dot)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-white truncate">{l.name}</div>
                {l.description && <div className="text-[11px] text-slate-500 truncate">{l.description}</div>}
              </div>
              <span className="text-xs text-slate-500 tabular-nums">{l.count} leads</span>
              <IconButton icon={Pencil} label="Edit list" onClick={() => setModal({ open: true, list: l })} />
              {me.isAdmin && <IconButton icon={Trash2} label="Delete list" tone="danger" onClick={() => remove(l)} />}
            </li>
          ))}
        </ul>
      )}
      <ListFormModal open={modal.open} list={modal.list} onClose={() => setModal({ open: false, list: null })} />
    </SectionCard>
  );
}

function FieldsTab() {
  const { fields, lists, me, refreshFields } = useCrm();
  const { toast, confirm } = useFeedback();
  const [modal, setModal] = React.useState<{ open: boolean; field: CrmFieldDTO | null }>({ open: false, field: null });

  const remove = async (field: CrmFieldDTO) => {
    if (!(await confirm({ title: `Delete “${field.name}”?`, message: "This column and its values are removed from every lead.", confirmLabel: "Delete", danger: true }))) return;
    try {
      await crmApi.fields.remove(field.id);
      await refreshFields();
      toast("Column deleted");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  return (
    <SectionCard
      title="Custom fields"
      description="Extra columns for the lead sheet. Built-in columns (name, business, phone, email, address…) are always available."
      action={
        me.isAdmin && (
          <Button size="sm" variant="primary" icon={Plus} onClick={() => setModal({ open: true, field: null })}>
            Add field
          </Button>
        )
      }
    >
      {fields.length === 0 ? (
        <EmptyState icon={Columns3} title="No custom fields" description="Add fields like Budget, Rating or Show type to capture more about each lead." />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {fields.map((f) => (
            <li key={f.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-5 py-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-800 dark:text-white">{f.name}</div>
                <div className="text-[11px] text-slate-500">
                  {FIELD_TYPE_LABELS[f.type]}
                  {f.type === "dropdown" && ` · ${f.options.join(", ")}`}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {f.listIds.length === 0 ? (
                  <Badge>All lists</Badge>
                ) : (
                  f.listIds.map((id) => {
                    const l = lists.find((x) => x.id === id);
                    return l ? (
                      <Badge key={id} color={l.color}>
                        {l.name}
                      </Badge>
                    ) : null;
                  })
                )}
              </div>
              {me.isAdmin && (
                <div className="flex">
                  <IconButton icon={Pencil} label="Edit field" onClick={() => setModal({ open: true, field: f })} />
                  <IconButton icon={Trash2} label="Delete field" tone="danger" onClick={() => remove(f)} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <FieldFormModal open={modal.open} field={modal.field} onClose={() => setModal({ open: false, field: null })} />
    </SectionCard>
  );
}

function PipelinesTab() {
  const { pipelines, me } = useCrm();
  const [editor, setEditor] = React.useState<{ open: boolean; pipeline: CrmPipelineDTO | null }>({ open: false, pipeline: null });
  const [counts, setCounts] = React.useState<Record<string, number>>({});

  const open = async (pipeline: CrmPipelineDTO | null) => {
    setCounts({});
    if (pipeline) {
      try {
        const res = await crmApi.opportunities.list({ pipelineId: pipeline.id });
        setCounts(res.opportunities.reduce((acc, o) => ({ ...acc, [o.stageId]: (acc[o.stageId] || 0) + 1 }), {} as Record<string, number>));
      } catch {}
    }
    setEditor({ open: true, pipeline });
  };

  return (
    <SectionCard
      title="Pipelines"
      description="Each pipeline is a board of stages that interested leads move through until they're won."
      action={
        me.isAdmin && (
          <Button size="sm" variant="primary" icon={Plus} onClick={() => open(null)}>
            New pipeline
          </Button>
        )
      }
    >
      <ul className="divide-y divide-slate-100 dark:divide-white/5">
        {pipelines.map((p) => (
          <li key={p.id} className="px-5 py-4 flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Kanban className="w-4 h-4 text-blue-600" />
              <span className="flex-1 text-sm font-bold text-slate-800 dark:text-white">{p.name}</span>
              {me.isAdmin && (
                <Button size="xs" icon={Pencil} onClick={() => open(p)}>
                  Edit
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {p.stages.map((s, i) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">{i + 1}</span>
                  <span className={cn("w-1.5 h-1.5 rounded-full", color(s.color).dot)} />
                  {s.name}
                  {s.kind !== "open" && <span className="uppercase text-[9px] text-slate-400">· {s.kind}</span>}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <PipelineEditorModal open={editor.open} pipeline={editor.pipeline} stageCounts={counts} onClose={() => setEditor({ open: false, pipeline: null })} />
    </SectionCard>
  );
}

function IntegrationsTab() {
  const { me } = useCrm();
  const { toast, confirm } = useFeedback();
  const [google, setGoogle] = React.useState<CrmGoogleStatus | null>(null);

  const load = React.useCallback(() => {
    crmApi.google
      .status()
      .then((r) => setGoogle(r.google))
      .catch((e) => toast(e.message, "error"));
  }, [toast]);

  React.useEffect(() => {
    load();
  }, [load]);

  const disconnect = async () => {
    if (!(await confirm({ title: "Disconnect Google Calendar?", confirmLabel: "Disconnect", danger: true }))) return;
    await crmApi.google.disconnect().catch((e) => toast(e.message, "error"));
    load();
  };

  // Only rendered after the status request, i.e. on the client.
  const redirect = `${typeof window === "undefined" ? "" : window.location.origin}/api/crm/google/callback`;

  return (
    <SectionCard title="Google Calendar" description="Each user connects their own Google account. Booked appointments are added to it, and your Google events show as “Busy” in the CRM calendar.">
      <div className="p-5 flex flex-col gap-5">
        {!google ? (
          <Spinner />
        ) : !google.configured ? (
          <div className="flex flex-col gap-3">
            <Badge color="amber" className="self-start">
              Not set up on the server yet
            </Badge>
            {me.isAdmin ? (
              <ol className="list-decimal pl-5 text-xs text-slate-600 dark:text-slate-300 flex flex-col gap-2 leading-relaxed">
                <li>
                  Open <b>Google Cloud Console → APIs & Services</b>, create a project and enable the <b>Google Calendar API</b>.
                </li>
                <li>
                  Configure the <b>OAuth consent screen</b> (External), add the scopes <code>calendar.events</code> and <code>calendar.readonly</code>, and add your team as test users (or publish the app).
                </li>
                <li>
                  Create an <b>OAuth client ID</b> of type <i>Web application</i> with this authorized redirect URI:
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="px-2 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-[11px] break-all">{redirect}</code>
                    <IconButton
                      icon={Copy}
                      label="Copy redirect URI"
                      onClick={() => {
                        navigator.clipboard?.writeText(redirect);
                        toast("Copied");
                      }}
                    />
                  </div>
                </li>
                <li>
                  Add <code>GOOGLE_CLIENT_ID</code> and <code>GOOGLE_CLIENT_SECRET</code> to the server environment (e.g. Vercel → Settings → Environment Variables) and redeploy.
                </li>
              </ol>
            ) : (
              <p className="text-xs text-slate-500">Ask your business admin to enable Google Calendar sync.</p>
            )}
          </div>
        ) : google.connected ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-bold text-slate-800 dark:text-white">Connected as {google.email || "your Google account"}</div>
              <div className="text-xs text-slate-500">{google.syncEnabled ? "Appointments assigned to you sync automatically." : "Sync is paused."}</div>
            </div>
            <Button size="sm" variant="ghost" icon={Unlink} onClick={disconnect} className="text-rose-600">
              Disconnect
            </Button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 text-xs text-slate-600 dark:text-slate-300">Connect your Google account: meetings you book here are added to it, and your Google events show as busy time.</div>
            <a href={crmApi.google.connectUrl}>
              <Button size="sm" variant="primary" icon={Link2}>
                Connect Google Calendar
              </Button>
            </a>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
