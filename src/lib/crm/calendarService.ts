import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { CrmAppointment } from "@/models/crm/CrmAppointment";
import { CrmContact } from "@/models/crm/CrmContact";
import { scopeFilter, type CrmContext } from "@/lib/crm/access";
import { logContactActivity } from "@/lib/crm/activity";
import { deleteGoogleEvent, syncAppointmentToGoogle } from "@/lib/crm/google";
import { buildContactSummaries, toAppointment } from "@/lib/crm/serialize";
import { APPOINTMENT_STATUSES, APPOINTMENT_STATUS_LABELS, contactDisplayName, type AppointmentStatus } from "@/lib/crm/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Fail = { success: false; error: string; status?: number };
const fail = (error: string, status = 400): Fail => ({ success: false, error, status });

const AppointmentSchema = z.object({
  title: z.string().trim().max(200).optional(),
  contactId: z.string().max(40).optional(),
  start: z.string(),
  end: z.string(),
  status: z.enum(APPOINTMENT_STATUSES).optional(),
  assignedTo: z.string().max(60).optional(),
  location: z.string().max(500).optional(),
  notes: z.string().max(10000).optional(),
});

function parseDate(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function withSummaries(rows: any[]) {
  const summaries = await buildContactSummaries(rows.map((r) => r.contactId));
  return rows.map((r) => toAppointment(r, summaries.get(r.contactId) || null));
}

// Best-effort Google push; a Google outage must never block saving the appointment.
async function pushToGoogle(doc: any) {
  try {
    const summaries = await buildContactSummaries([doc.contactId]);
    const ref = await syncAppointmentToGoogle(
      {
        id: String(doc._id),
        title: doc.title,
        start: doc.start,
        end: doc.end,
        status: doc.status,
        location: doc.location,
        notes: doc.notes,
        assignedTo: doc.assignedTo,
        createdBy: doc.createdBy,
        googleEventId: doc.googleEventId,
        googleOwner: doc.googleOwner,
      },
      summaries.get(doc.contactId) || null
    );
    if (ref.googleEventId !== doc.googleEventId || ref.googleOwner !== doc.googleOwner) {
      await CrmAppointment.updateOne({ _id: doc._id }, { $set: ref });
      doc.googleEventId = ref.googleEventId;
      doc.googleOwner = ref.googleOwner;
    }
    return "";
  } catch (error) {
    console.error("Google sync failed:", error);
    return "Saved, but syncing to Google Calendar failed";
  }
}

export async function fetchAppointments(
  ctx: CrmContext,
  query: { from?: string; to?: string; users?: string[]; contactId?: string }
) {
  const and: any[] = [];
  const scope = scopeFilter(ctx);
  if ("$or" in scope) and.push(scope);
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  if (from) and.push({ end: { $gt: from } });
  if (to) and.push({ start: { $lt: to } });
  if (query.users?.length) and.push({ assignedTo: { $in: query.users } });
  if (query.contactId) and.push({ contactId: query.contactId });

  const rows = await CrmAppointment.find(and.length ? { $and: and } : {})
    .sort({ start: 1 })
    .limit(2000)
    .lean<any[]>();
  return { success: true as const, appointments: await withSummaries(rows) };
}

async function contactInScope(ctx: CrmContext, contactId: string) {
  if (!contactId) return null;
  if (!isValidObjectId(contactId)) return undefined;
  const contact = await CrmContact.findOne({ _id: contactId, ...scopeFilter(ctx) }, "firstName lastName businessName email phone").lean<any>();
  return contact || undefined;
}

export async function createAppointment(ctx: CrmContext, raw: unknown) {
  const parsed = AppointmentSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid appointment data");
  const data = parsed.data;
  const start = parseDate(data.start);
  const end = parseDate(data.end);
  if (!start || !end || end <= start) return fail("End time must be after the start time");

  const contact = await contactInScope(ctx, data.contactId || "");
  if (contact === undefined) return fail("Selected lead not found", 404);

  const doc = await CrmAppointment.create({
    title: data.title || (contact ? `Meeting with ${contactDisplayName(contact)}` : "Appointment"),
    contactId: data.contactId || "",
    start,
    end,
    status: data.status || "booked",
    assignedTo: data.assignedTo ?? ctx.username,
    location: data.location || "",
    notes: data.notes || "",
    createdBy: ctx.username,
  });
  const warning = await pushToGoogle(doc);
  if (doc.contactId) await logContactActivity(doc.contactId, "appointment", `Appointment booked: ${doc.title}`, ctx.username);

  const [appointment] = await withSummaries([doc.toObject()]);
  return { success: true as const, appointment, warning };
}

export async function updateAppointment(ctx: CrmContext, id: string, raw: unknown) {
  if (!isValidObjectId(id)) return fail("Appointment not found", 404);
  const doc = await CrmAppointment.findOne({ _id: id, ...scopeFilter(ctx) });
  if (!doc) return fail("Appointment not found", 404);
  const parsed = AppointmentSchema.partial().safeParse(raw);
  if (!parsed.success) return fail("Invalid appointment data");
  const data = parsed.data;

  const start = data.start !== undefined ? parseDate(data.start) : doc.start;
  const end = data.end !== undefined ? parseDate(data.end) : doc.end;
  if (!start || !end || end <= start) return fail("End time must be after the start time");

  if (data.contactId !== undefined && data.contactId !== doc.contactId) {
    const contact = await contactInScope(ctx, data.contactId);
    if (contact === undefined) return fail("Selected lead not found", 404);
    doc.contactId = data.contactId;
  }
  const previousStatus = doc.status as AppointmentStatus;
  doc.start = start;
  doc.end = end;
  if (data.title !== undefined) doc.title = data.title || doc.title;
  if (data.status !== undefined) doc.status = data.status;
  if (data.assignedTo !== undefined) doc.assignedTo = data.assignedTo;
  if (data.location !== undefined) doc.location = data.location;
  if (data.notes !== undefined) doc.notes = data.notes;
  await doc.save();

  const warning = await pushToGoogle(doc);
  if (doc.contactId && previousStatus !== doc.status) {
    await logContactActivity(
      doc.contactId,
      "appointment",
      `Appointment "${doc.title}" marked ${APPOINTMENT_STATUS_LABELS[doc.status as AppointmentStatus]}`,
      ctx.username
    );
  }
  const [appointment] = await withSummaries([doc.toObject()]);
  return { success: true as const, appointment, warning };
}

export async function deleteAppointment(ctx: CrmContext, id: string) {
  if (!isValidObjectId(id)) return fail("Appointment not found", 404);
  const doc = await CrmAppointment.findOneAndDelete({ _id: id, ...scopeFilter(ctx) });
  if (!doc) return fail("Appointment not found", 404);
  await deleteGoogleEvent(doc.googleOwner, doc.googleEventId).catch(() => undefined);
  if (doc.contactId) await logContactActivity(doc.contactId, "appointment", `Appointment deleted: ${doc.title}`, ctx.username);
  return { success: true as const };
}

export async function removeAppointmentsForContacts(contactIds: string[]) {
  const synced = await CrmAppointment.find(
    { contactId: { $in: contactIds }, googleEventId: { $ne: "" } },
    "googleEventId googleOwner"
  ).lean<any[]>();
  await Promise.all(synced.map((a) => deleteGoogleEvent(a.googleOwner, a.googleEventId).catch(() => undefined)));
  await CrmAppointment.deleteMany({ contactId: { $in: contactIds } });
}
