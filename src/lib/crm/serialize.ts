import { isValidObjectId, Types } from "mongoose";
import { CrmContact } from "@/models/crm/CrmContact";
import { CrmAppointment } from "@/models/crm/CrmAppointment";
import {
  contactDisplayName,
  type CrmActivityDTO,
  type CrmAppointmentDTO,
  type CrmContactDTO,
  type CrmContactSummary,
  type CrmNoteDTO,
  type CrmOpportunityDTO,
  type CrmTaskDTO,
  type LeadStatus,
} from "@/lib/crm/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export function iso(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value as string);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function isoOrNull(value: unknown): string | null {
  const out = iso(value);
  return out || null;
}

export function validIds(ids: unknown[]): string[] {
  return ids.map(String).filter((id) => isValidObjectId(id));
}

export function toNote(n: any): CrmNoteDTO {
  return {
    id: n.id,
    body: n.body || "",
    createdBy: n.createdBy || "",
    createdAt: iso(n.createdAt),
    updatedAt: n.updatedAt ? iso(n.updatedAt) : undefined,
  };
}

export function toTask(t: any): CrmTaskDTO {
  return {
    id: t.id,
    title: t.title || "",
    description: t.description || "",
    dueDate: isoOrNull(t.dueDate),
    assignedTo: t.assignedTo || "",
    completed: !!t.completed,
    createdBy: t.createdBy || "",
    createdAt: iso(t.createdAt),
  };
}

export function toActivity(a: any): CrmActivityDTO {
  return { id: a.id, type: a.type || "update", text: a.text || "", by: a.by || "", at: iso(a.at) };
}

// Accepts either a full document or an aggregation row that already carries the counts.
export function toContact(c: any): CrmContactDTO {
  const notes = Array.isArray(c.notes) ? c.notes : null;
  const tasks = Array.isArray(c.tasks) ? c.tasks : null;
  return {
    id: String(c._id),
    firstName: c.firstName || "",
    lastName: c.lastName || "",
    businessName: c.businessName || "",
    email: c.email || "",
    phone: c.phone || "",
    website: c.website || "",
    address: c.address || "",
    city: c.city || "",
    state: c.state || "",
    postalCode: c.postalCode || "",
    country: c.country || "",
    source: c.source || "",
    tags: c.tags || [],
    listId: c.listId || "",
    status: (c.status || "new") as LeadStatus,
    assignedTo: c.assignedTo || "",
    createdBy: c.createdBy || "",
    customFields: c.customFields || {},
    notesCount: c.notesCount ?? notes?.length ?? 0,
    tasksCount: c.tasksCount ?? tasks?.length ?? 0,
    openTasksCount: c.openTasksCount ?? tasks?.filter((t: any) => !t.completed).length ?? 0,
    lastActivityAt: isoOrNull(c.lastActivityAt),
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

export function toOpportunity(o: any, contact: CrmContactSummary | null): CrmOpportunityDTO {
  return {
    id: String(o._id),
    name: o.name || "",
    pipelineId: o.pipelineId,
    stageId: o.stageId,
    status: o.status || "open",
    value: o.value || 0,
    contactId: o.contactId || "",
    source: o.source || "",
    assignedTo: o.assignedTo || "",
    tags: o.tags || [],
    lostReason: o.lostReason || "",
    order: o.order || 0,
    createdBy: o.createdBy || "",
    createdAt: iso(o.createdAt),
    updatedAt: iso(o.updatedAt),
    stageChangedAt: isoOrNull(o.stageChangedAt),
    contact,
  };
}

export function toAppointment(a: any, contact: CrmContactSummary | null): CrmAppointmentDTO {
  return {
    id: String(a._id),
    title: a.title || "",
    contactId: a.contactId || "",
    start: iso(a.start),
    end: iso(a.end),
    status: a.status || "booked",
    assignedTo: a.assignedTo || "",
    location: a.location || "",
    notes: a.notes || "",
    createdBy: a.createdBy || "",
    googleEventId: a.googleEventId || "",
    contact,
  };
}

// Loads compact contact info (with note/task/appointment counts) for cards and calendar events.
export async function buildContactSummaries(contactIds: string[]): Promise<Map<string, CrmContactSummary>> {
  const ids = validIds([...new Set(contactIds.filter(Boolean))]);
  const out = new Map<string, CrmContactSummary>();
  if (ids.length === 0) return out;

  const [contacts, appointmentCounts] = await Promise.all([
    CrmContact.aggregate([
      { $match: { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } } },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          businessName: 1,
          phone: 1,
          email: 1,
          address: 1,
          city: 1,
          state: 1,
          notesCount: { $size: { $ifNull: ["$notes", []] } },
          tasksCount: {
            $size: {
              $filter: { input: { $ifNull: ["$tasks", []] }, as: "t", cond: { $ne: ["$$t.completed", true] } },
            },
          },
        },
      },
    ]),
    CrmAppointment.aggregate([
      { $match: { contactId: { $in: ids }, status: { $ne: "cancelled" } } },
      { $group: { _id: "$contactId", count: { $sum: 1 } } },
    ]),
  ]);

  const apptMap = new Map<string, number>(appointmentCounts.map((row: any) => [row._id, row.count]));
  for (const c of contacts) {
    const id = String(c._id);
    const address = [c.address, c.city, c.state].filter(Boolean).join(", ");
    out.set(id, {
      id,
      name: contactDisplayName(c),
      businessName: c.businessName || "",
      phone: c.phone || "",
      email: c.email || "",
      address,
      notesCount: c.notesCount || 0,
      tasksCount: c.tasksCount || 0,
      appointmentsCount: apptMap.get(id) || 0,
    });
  }
  return out;
}
