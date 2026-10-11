"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarPlus, ChevronRight, Kanban, ListTodo, Mail, MoreHorizontal, Phone, StickyNote, Trash2 } from "lucide-react";
import { contactDisplayName, type CrmContactDTO, type CrmListDTO, type LeadStatus } from "@/lib/crm/types";
import { StatusPicker, formatDate, timeAgo } from "@/components/crm/common";
import { Avatar, Badge, Button, Card, Checkbox, EASE_OUT, IconButton, Menu, cn } from "@/components/crm/ui";

interface Props {
  contacts: CrmContactDTO[];
  loading: boolean;
  animateKey: string;
  selected: Set<string>;
  onSelect: (selected: Set<string>) => void;
  listMeta: (id: string) => CrmListDTO | null;
  onStatus: (contact: CrmContactDTO, status: LeadStatus) => void;
  onOpen: (contact: CrmContactDTO) => void;
  onAddOpportunity: (contact: CrmContactDTO) => void;
  onBook: (contact: CrmContactDTO) => void;
  onDelete: (contact: CrmContactDTO) => void;
}

const rowMotion = {
  hidden: { opacity: 0, y: 8 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: Math.min(i, 14) * 0.03, duration: 0.35, ease: EASE_OUT } }),
  exit: { opacity: 0, x: -16, transition: { duration: 0.2 } },
};

function RowMenu({ contact, onAddOpportunity, onBook, onDelete }: Pick<Props, "onAddOpportunity" | "onBook" | "onDelete"> & { contact: CrmContactDTO }) {
  return (
    <Menu
      trigger={(props) => <IconButton {...props} icon={MoreHorizontal} label="More actions" />}
      items={[
        { label: "Add to pipeline", icon: Kanban, onClick: () => onAddOpportunity(contact) },
        { label: "Book follow-up", icon: CalendarPlus, onClick: () => onBook(contact) },
        ...(contact.phone ? [{ label: `Call ${contact.phone}`, icon: Phone, onClick: () => window.open(`tel:${contact.phone}`) }] : []),
        ...(contact.email ? [{ label: "Send email", icon: Mail, onClick: () => window.open(`mailto:${contact.email}`) }] : []),
        "divider",
        { label: "Delete lead", icon: Trash2, danger: true, onClick: () => onDelete(contact) },
      ]}
    />
  );
}

function Counters({ contact }: { contact: CrmContactDTO }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] font-bold",
          contact.notesCount ? "bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-200" : "text-slate-300 dark:text-slate-600"
        )}
        title="Notes"
      >
        <StickyNote className="w-3.5 h-3.5" />
        {contact.notesCount}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1 h-6 px-2 rounded-lg text-[11px] font-bold",
          contact.openTasksCount ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" : "text-slate-300 dark:text-slate-600"
        )}
        title="Open tasks"
      >
        <ListTodo className="w-3.5 h-3.5" />
        {contact.openTasksCount}
      </span>
    </div>
  );
}

export function LeadsTable({ contacts, loading, animateKey, selected, onSelect, listMeta, onStatus, onOpen, onAddOpportunity, onBook, onDelete }: Props) {
  const allSelected = contacts.length > 0 && contacts.every((c) => selected.has(c.id));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onSelect(next);
  };
  const toggleAll = (on: boolean) => onSelect(on ? new Set(contacts.map((c) => c.id)) : new Set());

  return (
    // Layout follows the space the table actually has (container query), not the window.
    <div className="@container">
      {/* Desktop table */}
      <Card className={cn("hidden @min-[940px]:block overflow-hidden transition-opacity duration-300", loading && "opacity-60")}>
        <div className="relative overflow-x-auto">
          {loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden z-10">
              <div className="crm-progress" />
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-white/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/60 dark:bg-white/[0.02]">
                <th className="pl-4 pr-2 py-3 w-10">
                  <Checkbox checked={allSelected} indeterminate={selected.size > 0} onChange={toggleAll} label="Select all" />
                </th>
                <th className="px-3 py-3">Lead</th>
                <th className="px-3 py-3">Contact</th>
                <th className="px-3 py-3">List</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3 hidden @min-[1060px]:table-cell">Added</th>
                <th className="px-3 py-3 hidden @min-[1180px]:table-cell">Activity</th>
                <th className="pr-4 pl-2 py-3 w-40" />
              </tr>
            </thead>
            <tbody key={animateKey}>
              <AnimatePresence initial={true}>
                {contacts.map((c, i) => {
                  const name = contactDisplayName(c);
                  const list = c.listId ? listMeta(c.listId) : null;
                  const isSelected = selected.has(c.id);
                  return (
                    <motion.tr
                      key={c.id}
                      custom={i}
                      variants={rowMotion}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      layout="position"
                      onClick={() => onOpen(c)}
                      className={cn(
                        "group relative cursor-pointer border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors",
                        isSelected ? "bg-blue-50/70 dark:bg-blue-500/[0.07]" : "hover:bg-slate-50/90 dark:hover:bg-white/[0.025]"
                      )}
                    >
                      <td className="relative pl-4 pr-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <span className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-indigo-500 transition-all duration-300", isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
                        <Checkbox checked={isSelected} onChange={(v) => toggle(c.id, v)} label={`Select ${name}`} />
                      </td>
                      <td className="px-3 py-3 max-w-[260px]">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar name={name} size="md" className="transition-transform duration-300 group-hover:scale-110" />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors">{name}</div>
                            <div className="text-[11px] text-slate-500 truncate">{c.businessName && name !== c.businessName ? c.businessName : [c.city, c.country].filter(Boolean).join(", ") || "—"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 max-w-[220px]">
                        <div className="text-slate-700 dark:text-slate-200 truncate font-medium tabular-nums">{c.phone || "—"}</div>
                        <div className="text-[11px] text-slate-500 truncate">{c.email}</div>
                      </td>
                      <td className="px-3 py-3">
                        {list ? (
                          <Badge color={list.color} dot>
                            {list.name}
                          </Badge>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <StatusPicker value={c.status} onChange={(s) => onStatus(c, s)} />
                      </td>
                      <td className="px-3 py-3">
                        {c.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={c.assignedTo} size="xs" />
                            <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-[90px]">{c.assignedTo}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">Unassigned</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap hidden @min-[1060px]:table-cell">
                        <div className="text-xs text-slate-700 dark:text-slate-200">{formatDate(c.createdAt)}</div>
                        <div className="text-[10px] text-slate-400">{c.lastActivityAt ? `Active ${timeAgo(c.lastActivityAt)}` : ""}</div>
                      </td>
                      <td className="px-3 py-3 hidden @min-[1180px]:table-cell">
                        <Counters contact={c} />
                      </td>
                      <td className="pr-4 pl-2 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="xs" variant="soft" onClick={() => onOpen(c)} className="gap-1 pr-2">
                            Manage
                            <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                          </Button>
                          <RowMenu contact={c} onAddOpportunity={onAddOpportunity} onBook={onBook} onDelete={onDelete} />
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile cards */}
      <div key={`m-${animateKey}`} className={cn("@min-[940px]:hidden grid grid-cols-1 @min-[600px]:grid-cols-2 gap-2.5 transition-opacity", loading && "opacity-60")}>
        <AnimatePresence initial>
          {contacts.map((c, i) => {
            const name = contactDisplayName(c);
            const list = c.listId ? listMeta(c.listId) : null;
            return (
              <motion.div key={c.id} custom={i} variants={rowMotion} initial="hidden" animate="show" exit="exit" layout="position">
                <Card className={cn("p-3.5 h-full", selected.has(c.id) && "ring-2 ring-blue-500/60")}>
                  <div className="flex items-start gap-3">
                    <Checkbox checked={selected.has(c.id)} onChange={(v) => toggle(c.id, v)} className="mt-2.5" />
                    <button type="button" onClick={() => onOpen(c)} className="flex items-start gap-3 flex-1 min-w-0 text-left cursor-pointer">
                      <Avatar name={name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-slate-800 dark:text-white truncate">{name}</div>
                        <div className="text-[11px] text-slate-500 truncate">{[c.businessName !== name && c.businessName, c.phone].filter(Boolean).join(" · ") || "—"}</div>
                      </div>
                    </button>
                    <RowMenu contact={c} onAddOpportunity={onAddOpportunity} onBook={onBook} onDelete={onDelete} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-3 pl-7">
                    <StatusPicker value={c.status} onChange={(s) => onStatus(c, s)} />
                    {list && <Badge color={list.color}>{list.name}</Badge>}
                    <span className="ml-auto">
                      <Counters contact={c} />
                    </span>
                  </div>
                  <div className="flex gap-2 mt-3 pl-7">
                    <Button size="xs" variant="soft" className="flex-1" onClick={() => onOpen(c)}>
                      Manage
                    </Button>
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="inline-flex items-center justify-center h-7 px-3 rounded-lg text-[11px] font-semibold border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 active:scale-95 transition-transform">
                        <Phone className="w-3.5 h-3.5 mr-1" />
                        Call
                      </a>
                    )}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
