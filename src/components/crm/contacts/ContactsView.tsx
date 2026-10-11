"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ArrowUpDown,
  Contact,
  Download,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Sheet as SheetIcon,
  Table2,
  Tag,
  Trash2,
  Upload,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { crmApi, type ContactQueryResult } from "@/lib/crm/client";
import { LEAD_STATUSES, LEAD_STATUS_LABELS, type CrmContactDTO, type CrmContactInput, type CrmListDTO, type LeadStatus } from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { PageHeader } from "@/components/crm/PageHeader";
import { DateRangePicker, rangeToIso, toPicked, useMemberOptions, type DateRange } from "@/components/crm/common";
import { LEAD_STATUS_COLOR, color } from "@/components/crm/theme";
import {
  AnimatedNumber,
  Button,
  Card,
  Dropdown,
  EmptyState,
  HScroll,
  IconButton,
  Menu,
  Popover,
  SPRING,
  Segmented,
  Skeleton,
  cn,
  useFeedback,
} from "@/components/crm/ui";
import { ContactFormModal } from "@/components/crm/contacts/ContactFormModal";
import { ImportModal } from "@/components/crm/contacts/ImportModal";
import { ListFormModal } from "@/components/crm/contacts/ListFormModal";
import { LeadsTable } from "@/components/crm/contacts/LeadsTable";
import { LeadSheet } from "@/components/crm/contacts/LeadSheet";
import { OpportunityModal } from "@/components/crm/opportunities/OpportunityModal";
import { AppointmentModal } from "@/components/crm/calendar/AppointmentModal";

type View = "table" | "sheet";

const SORTS = [
  { field: "createdAt", dir: "desc", label: "Newest first" },
  { field: "createdAt", dir: "asc", label: "Oldest first" },
  { field: "lastActivityAt", dir: "desc", label: "Recent activity" },
  { field: "businessName", dir: "asc", label: "Business name A–Z" },
  { field: "firstName", dir: "asc", label: "First name A–Z" },
] as const;

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function ContactsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listParam = searchParams.get("list") || "all";
  const { lists, listTotals, me, members, refreshLists } = useCrm();
  const { toast, confirm } = useFeedback();
  const ownerOptions = useMemberOptions(false);

  const [view, setViewState] = React.useState<View>("table");
  const [q, setQ] = React.useState("");
  const debouncedQ = useDebounced(q);
  const [status, setStatus] = React.useState<"" | LeadStatus>("");
  const [assignedTo, setAssignedTo] = React.useState("");
  const [range, setRange] = React.useState<DateRange>({ preset: "all" });
  const [sort, setSort] = React.useState<{ field: string; dir: "asc" | "desc" }>({ field: "createdAt", dir: "desc" });
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);
  const [data, setData] = React.useState<ContactQueryResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [reloadKey, setReloadKey] = React.useState(0);

  const [addOpen, setAddOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const [listModal, setListModal] = React.useState<{ open: boolean; list: CrmListDTO | null }>({ open: false, list: null });
  const [oppFor, setOppFor] = React.useState<CrmContactDTO | null>(null);
  const [apptFor, setApptFor] = React.useState<CrmContactDTO | null>(null);

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem("crm.contacts.view");
      if (saved === "sheet" || saved === "table") setViewState(saved);
    } catch {}
  }, []);
  const setView = (v: View) => {
    setViewState(v);
    setPage(1);
    try {
      localStorage.setItem("crm.contacts.view", v);
    } catch {}
  };

  const activeList = lists.find((l) => l.id === listParam) || null;
  const pageSize = view === "sheet" ? 100 : limit;

  const query = React.useMemo(
    () => ({
      list: listParam === "all" ? undefined : listParam,
      q: debouncedQ || undefined,
      status: status || undefined,
      assignedTo: assignedTo || undefined,
      ...rangeToIso(range),
      sort: sort.field,
      dir: sort.dir,
    }),
    [listParam, debouncedQ, status, assignedTo, range, sort]
  );

  // Any filter change goes back to page 1 and clears the selection.
  React.useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [query]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    crmApi.contacts
      .query({ ...query, page, limit: pageSize })
      .then((res) => !cancelled && setData(res))
      .catch((e) => !cancelled && toast(e.message, "error"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query, page, pageSize, reloadKey, toast]);

  const reload = () => {
    setReloadKey((k) => k + 1);
    refreshLists();
  };

  const selectList = (id: string) => router.replace(id === "all" ? "/crm/contacts" : `/crm/contacts?list=${id}`, { scroll: false });

  const replaceContact = (contact: CrmContactDTO) =>
    setData((d) => (d ? { ...d, contacts: d.contacts.map((c) => (c.id === contact.id ? { ...c, ...contact } : c)) } : d));

  const patchContact = async (id: string, patch: CrmContactInput) => {
    const before = data?.contacts.find((c) => c.id === id);
    if (before) replaceContact({ ...before, ...(patch as Partial<CrmContactDTO>), customFields: { ...before.customFields, ...(patch.customFields || {}) } });
    try {
      const res = await crmApi.contacts.update(id, patch);
      replaceContact(res.contact);
      if (patch.listId !== undefined) refreshLists();
      return res.contact;
    } catch (e) {
      if (before) replaceContact(before);
      toast((e as Error).message, "error");
      throw e;
    }
  };

  const createFromSheet = async (input: CrmContactInput) => {
    const res = await crmApi.contacts.create({ listId: activeList?.id || "", ...input });
    setData((d) => (d ? { ...d, contacts: [...d.contacts, res.contact], total: d.total + 1 } : d));
    refreshLists();
    return res.contact;
  };

  const deleteContact = async (contact: CrmContactDTO) => {
    const ok = await confirm({
      title: "Delete this lead?",
      message: "The lead, its notes, tasks, opportunities and appointments will be permanently deleted.",
      confirmLabel: "Delete lead",
      danger: true,
    });
    if (!ok) return;
    try {
      await crmApi.contacts.remove(contact.id);
      setData((d) => (d ? { ...d, contacts: d.contacts.filter((c) => c.id !== contact.id), total: d.total - 1 } : d));
      toast("Lead deleted");
      refreshLists();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const runBulk = async (action: string, value?: string, label?: string) => {
    const ids = [...selected];
    if (action === "delete") {
      const ok = await confirm({
        title: `Delete ${ids.length} lead${ids.length > 1 ? "s" : ""}?`,
        message: "Their notes, tasks, opportunities and appointments will also be deleted. This can't be undone.",
        confirmLabel: "Delete",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const res = await crmApi.contacts.bulk(ids, action, value);
      toast(`${label || "Updated"} ${res.affected} lead${res.affected === 1 ? "" : "s"}`);
      setSelected(new Set());
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const deleteList = async (list: CrmListDTO) => {
    const ok = await confirm({
      title: `Delete “${list.name}”?`,
      message: `The ${list.count} lead(s) in it are kept and moved to “No list”.`,
      confirmLabel: "Delete list",
      danger: true,
    });
    if (!ok) return;
    try {
      await crmApi.lists.remove(list.id);
      toast("List deleted");
      if (listParam === list.id) selectList("all");
      reload();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };

  const exportCsv = () => {
    // API download (Content-Disposition: attachment), not a page navigation.
    const link = document.createElement("a");
    link.href = crmApi.contacts.exportUrl(query);
    link.download = "";
    link.click();
    toast("Preparing your CSV download…", "info");
  };

  const contacts = data?.contacts || [];
  const total = data?.total || 0;
  const counts = data?.statusCounts;
  const countAll = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  const filtersActive = !!(q || status || assignedTo || range.preset !== "all");
  const listMeta = (id: string) => lists.find((l) => l.id === id) || null;
  const firstLoad = loading && !data;

  return (
    <div className="flex flex-col pb-10">
      <PageHeader
        icon={Contact}
        title={activeList ? activeList.name : listParam === "none" ? "Leads without a list" : "Contacts"}
        subtitle={activeList?.description || "Every lead in one place. Filter, edit in the sheet, and export."}
        actions={
          <>
            <Button size="sm" icon={Upload} onClick={() => setImportOpen(true)}>
              Import
            </Button>
            <Button size="sm" icon={Download} onClick={exportCsv} disabled={!total}>
              Export
            </Button>
            <Button size="sm" variant="primary" icon={UserPlus} onClick={() => setAddOpen(true)}>
              Add lead
            </Button>
          </>
        }
      />

      {/* Category cards */}
      <div className="px-4 sm:px-6 lg:px-8">
        <LayoutGroup id="list-cards">
          <HScroll innerClassName="gap-3 py-1.5 px-1">
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setListModal({ open: true, list: null })}
              className="group snap-start shrink-0 w-36 sm:w-40 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-blue-600 hover:border-blue-300 dark:hover:border-blue-500/40 hover:bg-blue-50/40 dark:hover:bg-blue-500/5 transition-colors cursor-pointer min-h-[116px]"
            >
              <span className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 group-hover:bg-blue-100 dark:group-hover:bg-blue-500/15 flex items-center justify-center transition-colors">
                <FolderPlus className="w-4.5 h-4.5 transition-transform group-hover:scale-110" />
              </span>
              <span className="text-xs font-bold">New list</span>
            </motion.button>
            <ListCard index={0} title="All Leads" count={listTotals.total} total={listTotals.total} subtitle={`${lists.length} list${lists.length === 1 ? "" : "s"}`} active={listParam === "all"} onClick={() => selectList("all")} colorName="indigo" gradient />
            {lists.map((list, i) => (
              <ListCard
                key={list.id}
                index={i + 1}
                title={list.name}
                count={list.count}
                total={listTotals.total}
                subtitle={listTotals.total ? `${Math.round((list.count / listTotals.total) * 100)}% of all leads` : "No leads yet"}
                colorName={list.color}
                active={listParam === list.id}
                onClick={() => selectList(list.id)}
                menu={
                  <Menu
                    trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label="List options" className="w-7 h-7 -mr-1.5 -mt-1" />}
                    items={[
                      { label: "Edit list", icon: Pencil, onClick: () => setListModal({ open: true, list }) },
                      ...(me.isAdmin ? [{ label: "Delete list", icon: Trash2, danger: true, onClick: () => deleteList(list) }] : []),
                    ]}
                  />
                }
              />
            ))}
            {listTotals.unlisted > 0 && (
              <ListCard index={lists.length + 1} title="No list" count={listTotals.unlisted} total={listTotals.total} subtitle="Not in any list yet" colorName="slate" active={listParam === "none"} onClick={() => selectList("none")} />
            )}
          </HScroll>
        </LayoutGroup>
      </div>

      {/* Status filter */}
      <div className="px-4 sm:px-6 lg:px-8 mt-4">
        <LayoutGroup id="status-chips">
          <HScroll innerClassName="gap-1.5 py-0.5">
            <StatusChip label="All" count={countAll} active={!status} onClick={() => setStatus("")} />
            {LEAD_STATUSES.map((s) => (
              <StatusChip key={s} label={LEAD_STATUS_LABELS[s]} count={counts?.[s] ?? 0} dot={color(LEAD_STATUS_COLOR[s]).dot} active={status === s} onClick={() => setStatus(status === s ? "" : s)} />
            ))}
          </HScroll>
        </LayoutGroup>
      </div>

      {/* Toolbar */}
      <div className="px-4 sm:px-6 lg:px-8 mt-4 flex flex-col xl:flex-row gap-2 xl:items-center">
        <div className="relative flex-1 min-w-0 xl:max-w-sm group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, business, phone, email, tag…"
            className="w-full h-10 pl-9 pr-9 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-sm outline-none transition-all shadow-sm focus:ring-4 focus:ring-blue-500/15 focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
          />
          <AnimatePresence>
            {q && (
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          {me.scope === "all" && (
            <Dropdown
              value={assignedTo}
              onChange={setAssignedTo}
              className="flex-1 min-w-0 sm:flex-none sm:w-44"
              width={200}
              label="Owner filter"
              options={[{ value: "", label: "Any owner", icon: UsersRound }, { value: "unassigned", label: "Unassigned", icon: UsersRound }, ...ownerOptions]}
            />
          )}
          <Menu
            align="start"
            header="Sort by"
            trigger={(props) => (
              <Button {...props} size="md" icon={ArrowUpDown}>
                <span className="hidden sm:inline">{SORTS.find((s) => s.field === sort.field && s.dir === sort.dir)?.label || "Sort"}</span>
              </Button>
            )}
            items={SORTS.map((s) => ({
              label: s.label,
              active: s.field === sort.field && s.dir === sort.dir,
              onClick: () => setSort({ field: s.field, dir: s.dir }),
            }))}
          />
          <AnimatePresence>
            {filtersActive && (
              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}>
                <Button
                  size="md"
                  variant="ghost"
                  icon={X}
                  onClick={() => {
                    setQ("");
                    setStatus("");
                    setAssignedTo("");
                    setRange({ preset: "all" });
                  }}
                >
                  Clear filters
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="xl:ml-auto">
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: "table", label: "Table", icon: Table2 },
              { value: "sheet", label: "Sheet", icon: SheetIcon },
            ]}
          />
        </div>
      </div>

      {/* Bulk actions */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -8 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="px-4 sm:px-6 lg:px-8 overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-gradient-to-r from-blue-50 to-indigo-50/60 dark:from-blue-500/10 dark:to-indigo-500/5 px-3 py-2 shadow-[0_10px_30px_-18px_rgba(37,99,235,0.7)]">
              <span className="inline-flex items-center gap-2 text-xs font-bold text-blue-800 dark:text-blue-200 mr-1">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-[11px]">
                  <AnimatedNumber value={selected.size} duration={0.3} />
                </span>
                selected
              </span>
              <Menu
                align="start"
                header="Set status"
                trigger={(props) => (
                  <Button {...props} size="xs">
                    Status
                  </Button>
                )}
                items={LEAD_STATUSES.map((s) => ({ label: LEAD_STATUS_LABELS[s], onClick: () => runBulk("status", s, "Updated") }))}
              />
              <Menu
                align="start"
                header="Assign to"
                trigger={(props) => (
                  <Button {...props} size="xs">
                    Assign
                  </Button>
                )}
                items={[{ label: "Unassigned", onClick: () => runBulk("assign", "", "Unassigned") }, ...members.map((m) => ({ label: m.username, onClick: () => runBulk("assign", m.username, "Assigned") }))]}
              />
              <Menu
                align="start"
                header="Move to list"
                trigger={(props) => (
                  <Button {...props} size="xs">
                    Move to list
                  </Button>
                )}
                items={[{ label: "No list", onClick: () => runBulk("list", "", "Moved") }, ...lists.map((l) => ({ label: l.name, onClick: () => runBulk("list", l.id, "Moved") }))]}
              />
              <BulkTagButton onApply={(tag, remove) => runBulk(remove ? "removeTag" : "addTag", tag, remove ? "Untagged" : "Tagged")} />
              <Button size="xs" variant="danger" icon={Trash2} onClick={() => runBulk("delete", undefined, "Deleted")}>
                Delete
              </Button>
              <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline cursor-pointer">
                Clear selection
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Data */}
      <div className="px-4 sm:px-6 lg:px-8 mt-3">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={firstLoad ? "loading" : total === 0 && view === "table" ? "empty" : view}
            initial={{ opacity: 0, y: 12, scale: 0.995 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.995 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {firstLoad ? (
              <TableSkeleton />
            ) : total === 0 && view === "table" ? (
              <Card>
                <EmptyState
                  icon={UsersRound}
                  title={filtersActive ? "No leads match these filters" : activeList ? `“${activeList.name}” is empty` : "No leads yet"}
                  description={filtersActive ? "Try a different search, status or date range." : "Add leads one by one, import a CSV, or switch to Sheet view and start typing."}
                  action={
                    !filtersActive && (
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button size="sm" icon={Upload} onClick={() => setImportOpen(true)}>
                          Import CSV
                        </Button>
                        <Button size="sm" icon={SheetIcon} onClick={() => setView("sheet")}>
                          Open sheet
                        </Button>
                        <Button size="sm" variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>
                          Add lead
                        </Button>
                      </div>
                    )
                  }
                />
              </Card>
            ) : view === "table" ? (
              <LeadsTable
                contacts={contacts}
                loading={loading}
                animateKey={`${JSON.stringify(query)}-${page}`}
                selected={selected}
                onSelect={setSelected}
                listMeta={listMeta}
                onStatus={(c, s) => patchContact(c.id, { status: s }).catch(() => undefined)}
                onOpen={(c) => router.push(`/crm/contacts/${c.id}`)}
                onAddOpportunity={setOppFor}
                onBook={setApptFor}
                onDelete={deleteContact}
              />
            ) : (
              <LeadSheet
                contacts={contacts}
                loading={loading}
                listId={listParam}
                onPatch={patchContact}
                onCreate={createFromSheet}
                onOpen={(c) => router.push(`/crm/contacts/${c.id}`)}
                onAddOpportunity={setOppFor}
                onBook={setApptFor}
                onDelete={deleteContact}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 text-xs text-slate-500">
            <span>
              Showing <b className="text-slate-700 dark:text-slate-200">{(page - 1) * pageSize + 1}</b>–<b className="text-slate-700 dark:text-slate-200">{Math.min(page * pageSize, total)}</b> of{" "}
              <b className="text-slate-700 dark:text-slate-200">
                <AnimatedNumber value={total} />
              </b>{" "}
              leads
            </span>
            <div className="flex items-center gap-2">
              {view === "table" && (
                <Dropdown
                  size="sm"
                  width={130}
                  value={String(limit)}
                  onChange={(v) => {
                    setLimit(Number(v));
                    setPage(1);
                  }}
                  options={[25, 50, 100, 200].map((n) => ({ value: String(n), label: `${n} / page` }))}
                  className="w-32"
                  label="Rows per page"
                />
              )}
              <Button size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button size="sm" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <ContactFormModal open={addOpen} onClose={() => setAddOpen(false)} defaultListId={activeList?.id || ""} onCreated={() => setReloadKey((k) => k + 1)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} defaultListId={activeList?.id || ""} onImported={() => setReloadKey((k) => k + 1)} />
      <ListFormModal open={listModal.open} list={listModal.list} onClose={() => setListModal({ open: false, list: null })} onSaved={(list) => !listModal.list && selectList(list.id)} />
      <OpportunityModal
        open={!!oppFor}
        onClose={() => setOppFor(null)}
        defaultContact={oppFor ? toPicked(oppFor) : null}
        onSaved={() => {
          setOppFor(null);
          setReloadKey((k) => k + 1);
        }}
      />
      <AppointmentModal open={!!apptFor} onClose={() => setApptFor(null)} defaultContact={apptFor ? toPicked(apptFor) : null} onSaved={() => setApptFor(null)} />
    </div>
  );
}

function TableSkeleton() {
  return (
    <Card className="p-4 flex flex-col gap-3">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="flex items-center gap-4" style={{ opacity: 1 - i * 0.1 }}>
          <Skeleton className="w-4 h-4 rounded" />
          <Skeleton className="w-9 h-9 rounded-full" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-2.5 w-1/5" />
          </div>
          <Skeleton className="hidden md:block h-5 w-24 rounded-full" />
          <Skeleton className="hidden md:block h-5 w-20 rounded-full" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </Card>
  );
}

// Share-of-all-leads ring for a list card.
function ShareRing({ value, hex }: { value: number; hex: string }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="w-11 h-11 -rotate-90 shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-slate-100 dark:stroke-white/[0.07]" />
      <motion.circle
        cx="20"
        cy="20"
        r={r}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        stroke={hex}
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))) }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

function ListCard({
  index,
  title,
  count,
  total,
  subtitle,
  colorName,
  active,
  onClick,
  menu,
  gradient,
}: {
  index: number;
  title: string;
  count: number;
  total: number;
  subtitle: string;
  colorName?: string;
  active: boolean;
  onClick: () => void;
  menu?: React.ReactNode;
  gradient?: boolean;
}) {
  const c = color(colorName);
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative snap-start shrink-0 w-52 sm:w-56 rounded-2xl p-4 text-left cursor-pointer overflow-hidden",
        "bg-white/90 dark:bg-[#0F172A]/90 border shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-16px_rgba(15,23,42,0.18)] transition-[border-color,box-shadow] duration-300",
        active ? "border-transparent" : "border-slate-200/70 dark:border-white/[0.08] hover:border-slate-300 dark:hover:border-white/20"
      )}
    >
      {active && (
        <motion.span
          layoutId="listCardActive"
          transition={SPRING}
          className="absolute inset-0 rounded-2xl ring-2 ring-blue-500 shadow-[0_18px_40px_-18px_rgba(37,99,235,0.7)] bg-gradient-to-br from-blue-50/80 to-transparent dark:from-blue-500/10"
        />
      )}
      <span className={cn("pointer-events-none absolute -right-8 -top-8 w-24 h-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40", gradient ? "bg-gradient-to-br from-blue-500 to-violet-500" : c.bar)} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("w-2 h-2 rounded-full shrink-0", gradient ? "bg-gradient-to-br from-blue-500 to-violet-500" : c.dot)} />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{title}</span>
        </div>
        <div onClick={(e) => e.stopPropagation()}>{menu}</div>
      </div>
      <div className="relative flex items-end justify-between gap-2 mt-2">
        <div className="min-w-0">
          <div className="text-[28px] leading-none font-extrabold tracking-tight text-slate-900 dark:text-white">
            <AnimatedNumber value={count} />
          </div>
          <div className="text-[11px] text-slate-400 mt-1.5 truncate">{subtitle}</div>
        </div>
        <ShareRing value={total ? count / total : 0} hex={gradient ? "#6366f1" : c.hex} />
      </div>
    </motion.div>
  );
}

function StatusChip({ label, count, active, onClick, dot }: { label: string; count: number; active: boolean; onClick: () => void; dot?: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      type="button"
      onClick={onClick}
      className={cn(
        "relative shrink-0 inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-bold border cursor-pointer transition-colors duration-200",
        active ? "border-transparent text-white dark:text-slate-900" : "bg-white/80 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10 hover:border-slate-300"
      )}
    >
      {active && <motion.span layoutId="statusChipActive" transition={SPRING} className="absolute inset-0 rounded-full bg-slate-900 dark:bg-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.8)]" />}
      {dot && <span className={cn("relative w-1.5 h-1.5 rounded-full", dot)} />}
      <span className="relative">{label}</span>
      <span className={cn("relative tabular-nums text-[10px]", active ? "opacity-70" : "text-slate-400")}>
        <AnimatedNumber value={count} duration={0.6} />
      </span>
    </motion.button>
  );
}

function BulkTagButton({ onApply }: { onApply: (tag: string, remove: boolean) => void }) {
  const [tag, setTag] = React.useState("");
  return (
    <Popover
      width={240}
      trigger={(props) => (
        <Button {...props} size="xs" icon={Tag}>
          Tags
        </Button>
      )}
    >
      {(close) => (
        <div className="p-2 flex flex-col gap-2">
          <input
            autoFocus
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Tag name"
            className="h-9 px-3 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
          />
          <div className="flex gap-2">
            <Button
              size="xs"
              variant="primary"
              disabled={!tag.trim()}
              onClick={() => {
                onApply(tag.trim(), false);
                setTag("");
                close();
              }}
              className="flex-1"
            >
              Add tag
            </Button>
            <Button
              size="xs"
              disabled={!tag.trim()}
              onClick={() => {
                onApply(tag.trim(), true);
                setTag("");
                close();
              }}
              className="flex-1"
            >
              Remove tag
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}
