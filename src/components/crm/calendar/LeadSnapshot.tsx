"use client";

import * as React from "react";
import Link from "next/link";
import { Building2, ExternalLink, Mail, MapPin, Phone, Send, StickyNote } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import { contactDisplayName, type CrmContactDetailDTO } from "@/lib/crm/types";
import { StatusBadge, formatDateTime } from "@/components/crm/common";
import { Avatar, Button, Spinner, Textarea, useFeedback } from "@/components/crm/ui";

// Lead details + conversation notes shown next to a meeting, so the caller has full context.
export function LeadSnapshot({ contactId }: { contactId: string }) {
  const { toast } = useFeedback();
  const [contact, setContact] = React.useState<CrmContactDetailDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    crmApi.contacts
      .get(contactId)
      .then((res) => !cancelled && setContact(res.contact))
      .catch(() => !cancelled && setContact(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const addNote = async () => {
    if (!note.trim() || !contact) return;
    setSaving(true);
    try {
      const res = await crmApi.notes.add(contact.id, note.trim());
      setContact({ ...contact, notes: [res.note, ...contact.notes], notesCount: contact.notesCount + 1 });
      setNote("");
      toast("Note saved to the lead");
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }
  if (!contact) return <div className="text-xs text-slate-400 py-6 text-center">Lead details are not available.</div>;

  const name = contactDisplayName(contact);
  const address = [contact.address, contact.city, contact.state, contact.postalCode, contact.country].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar name={name} size="md" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{name}</div>
          <div className="mt-1">
            <StatusBadge status={contact.status} />
          </div>
        </div>
        <Link href={`/crm/contacts/${contact.id}`} className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1 shrink-0">
          Profile <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      <dl className="flex flex-col gap-2.5 text-xs">
        <InfoRow icon={Building2} label="Business" value={contact.businessName} />
        <InfoRow icon={Phone} label="Phone" value={contact.phone} href={contact.phone ? `tel:${contact.phone}` : undefined} />
        <InfoRow icon={Mail} label="Email" value={contact.email} href={contact.email ? `mailto:${contact.email}` : undefined} />
        <InfoRow
          icon={MapPin}
          label="Address"
          value={address}
          href={address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}` : undefined}
        />
      </dl>

      <div className="flex flex-col gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <StickyNote className="w-3.5 h-3.5" />
          Conversation notes · {contact.notes.length}
        </div>
        <div className="flex flex-col gap-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you talk about? Add a note…"
            className="min-h-[64px] text-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addNote();
            }}
          />
          <Button size="xs" variant="primary" icon={Send} loading={saving} disabled={!note.trim()} onClick={addNote} className="self-end">
            Save note
          </Button>
        </div>
        <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
          {contact.notes.length === 0 && <div className="text-xs text-slate-400">No notes yet.</div>}
          {contact.notes.map((n) => (
            <div key={n.id} className="rounded-xl bg-amber-50/70 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 px-3 py-2">
              <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap break-words">{n.body}</p>
              <div className="text-[10px] text-slate-400 mt-1.5">
                {n.createdBy} · {formatDateTime(n.createdAt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 flex-1">
        {value ? (
          href ? (
            <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="text-slate-700 dark:text-slate-200 hover:text-blue-600 break-words">
              {value}
            </a>
          ) : (
            <span className="text-slate-700 dark:text-slate-200 break-words">{value}</span>
          )
        ) : (
          <span className="text-slate-400">No {label.toLowerCase()}</span>
        )}
      </dd>
    </div>
  );
}
