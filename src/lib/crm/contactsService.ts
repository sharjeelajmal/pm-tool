import { randomUUID } from "crypto";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { CrmContact } from "@/models/crm/CrmContact";
import { CrmList } from "@/models/crm/CrmList";
import { CrmField } from "@/models/crm/CrmField";
import { CrmOpportunity } from "@/models/crm/CrmOpportunity";
import { CrmAppointment } from "@/models/crm/CrmAppointment";
import { scopeFilter, type CrmContext } from "@/lib/crm/access";
import { activityEntry, pushActivity } from "@/lib/crm/activity";
import { removeAppointmentsForContacts } from "@/lib/crm/calendarService";
import { toCsv } from "@/lib/crm/csv";
import {
  buildContactSummaries,
  toActivity,
  toAppointment,
  toContact,
  toNote,
  toOpportunity,
  toTask,
  validIds,
} from "@/lib/crm/serialize";
import {
  FIELD_TYPES,
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  STANDARD_FIELDS,
  type CrmContactInput,
  type CrmFieldDTO,
  type CrmListDTO,
  type LeadStatus,
} from "@/lib/crm/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Fail = { success: false; error: string; status?: number };
const fail = (error: string, status = 400): Fail => ({ success: false, error, status });

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------------------------------------------ */
/* Lists (categories)                                                 */
/* ------------------------------------------------------------------ */

const ListInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color: z.string().max(20).optional(),
  description: z.string().max(300).optional(),
});

function toList(l: any, count: number): CrmListDTO {
  return {
    id: String(l._id),
    name: l.name,
    color: l.color || "blue",
    description: l.description || "",
    order: l.order || 0,
    count,
  };
}

export async function fetchLists(ctx: CrmContext) {
  const [lists, counts] = await Promise.all([
    CrmList.find({}).sort({ order: 1, createdAt: 1 }).lean<any[]>(),
    CrmContact.aggregate([{ $match: scopeFilter(ctx) }, { $group: { _id: "$listId", count: { $sum: 1 } } }]),
  ]);
  const countMap = new Map<string, number>(counts.map((row: any) => [row._id || "", row.count]));
  const totalCount = counts.reduce((sum: number, row: any) => sum + row.count, 0);
  return {
    success: true as const,
    lists: lists.map((l) => toList(l, countMap.get(String(l._id)) || 0)),
    totalCount,
    unlistedCount: countMap.get("") || 0,
  };
}

export async function createList(raw: unknown, ctx: CrmContext) {
  const parsed = ListInputSchema.safeParse(raw);
  if (!parsed.success) return fail("List name is required");
  const order = await CrmList.countDocuments();
  const list = await CrmList.create({ ...parsed.data, order, createdBy: ctx.username });
  return { success: true as const, list: toList(list, 0) };
}

export async function updateList(id: string, raw: unknown) {
  if (!isValidObjectId(id)) return fail("List not found", 404);
  const parsed = ListInputSchema.partial().safeParse(raw);
  if (!parsed.success) return fail("Invalid list data");
  const list = await CrmList.findByIdAndUpdate(id, { $set: parsed.data }, { returnDocument: "after" }).lean<any>();
  if (!list) return fail("List not found", 404);
  const count = await CrmContact.countDocuments({ listId: id });
  return { success: true as const, list: toList(list, count) };
}

export async function deleteList(id: string) {
  if (!isValidObjectId(id)) return fail("List not found", 404);
  const deleted = await CrmList.findByIdAndDelete(id);
  if (!deleted) return fail("List not found", 404);
  await Promise.all([
    CrmContact.updateMany({ listId: id }, { $set: { listId: "" } }),
    CrmField.updateMany({ listIds: id }, { $pull: { listIds: id } }),
  ]);
  return { success: true as const };
}

/* ------------------------------------------------------------------ */
/* Custom fields (sheet columns)                                      */
/* ------------------------------------------------------------------ */

const FieldInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(FIELD_TYPES),
  options: z.array(z.string().trim().min(1).max(80)).max(100).optional(),
  listIds: z.array(z.string().max(40)).max(100).optional(),
});

function toField(f: any): CrmFieldDTO {
  return {
    id: String(f._id),
    name: f.name,
    type: f.type,
    options: f.options || [],
    listIds: f.listIds || [],
    order: f.order || 0,
  };
}

export async function fetchFields() {
  const fields = await CrmField.find({}).sort({ order: 1, createdAt: 1 }).lean<any[]>();
  return { success: true as const, fields: fields.map(toField) };
}

export async function createField(raw: unknown) {
  const parsed = FieldInputSchema.safeParse(raw);
  if (!parsed.success) return fail("Field name and type are required");
  const order = await CrmField.countDocuments();
  const field = await CrmField.create({ ...parsed.data, listIds: validIds(parsed.data.listIds || []), order });
  return { success: true as const, field: toField(field) };
}

export async function updateField(id: string, raw: unknown) {
  if (!isValidObjectId(id)) return fail("Field not found", 404);
  const parsed = FieldInputSchema.partial().safeParse(raw);
  if (!parsed.success) return fail("Invalid field data");
  const data: any = { ...parsed.data };
  // Like GoHighLevel, a field's type is fixed once created (existing values depend on it).
  delete data.type;
  if (data.listIds) data.listIds = validIds(data.listIds);
  const field = await CrmField.findByIdAndUpdate(id, { $set: data }, { returnDocument: "after" }).lean<any>();
  if (!field) return fail("Field not found", 404);
  return { success: true as const, field: toField(field) };
}

export async function deleteField(id: string) {
  if (!isValidObjectId(id)) return fail("Field not found", 404);
  const deleted = await CrmField.findByIdAndDelete(id);
  if (!deleted) return fail("Field not found", 404);
  await CrmContact.updateMany({}, { $unset: { [`customFields.${id}`]: "" } });
  return { success: true as const };
}

/* ------------------------------------------------------------------ */
/* Contacts                                                           */
/* ------------------------------------------------------------------ */

const shortText = z.string().max(500).optional();
const ContactInputSchema = z.object({
  firstName: shortText,
  lastName: shortText,
  businessName: shortText,
  email: shortText,
  phone: shortText,
  website: shortText,
  address: shortText,
  city: shortText,
  state: shortText,
  postalCode: shortText,
  country: shortText,
  source: shortText,
  tags: z.array(z.string().trim().min(1).max(60)).max(50).optional(),
  listId: z.string().max(40).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  assignedTo: z.string().max(60).optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

const FIELD_KEY = /^[a-f0-9]{24}$/i;

// Custom field values are stored as primitives keyed by field id.
function sanitizeCustomFields(input: Record<string, unknown> | undefined) {
  const out: Record<string, string | number | boolean | null> = {};
  if (!input) return out;
  for (const [key, value] of Object.entries(input)) {
    if (!FIELD_KEY.test(key)) continue;
    if (value === null || value === undefined || value === "") out[key] = null;
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else out[key] = String(value).slice(0, 5000);
  }
  return out;
}

const STANDARD_LABELS = Object.fromEntries(STANDARD_FIELDS.map((f) => [f.key, f.label])) as Record<string, string>;

export interface ContactQuery {
  listId?: string;
  q?: string;
  status?: string;
  assignedTo?: string;
  tag?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  page?: number;
  limit?: number;
}

export function contactQueryFromSearch(params: URLSearchParams): ContactQuery {
  return {
    listId: params.get("list") || undefined,
    q: params.get("q") || undefined,
    status: params.get("status") || undefined,
    assignedTo: params.get("assignedTo") || undefined,
    tag: params.get("tag") || undefined,
    from: params.get("from") || undefined,
    to: params.get("to") || undefined,
    sort: params.get("sort") || undefined,
    dir: params.get("dir") || undefined,
    page: Number(params.get("page")) || 1,
    limit: Number(params.get("limit")) || 50,
  };
}

const SEARCH_FIELDS = ["firstName", "lastName", "businessName", "email", "phone", "city", "state", "country", "source", "tags"];
const SORTABLE = new Set(["createdAt", "updatedAt", "firstName", "lastName", "businessName", "status", "lastActivityAt", "city"]);

function buildContactMatch(ctx: CrmContext, query: ContactQuery) {
  const and: any[] = [];
  const scope = scopeFilter(ctx);
  if ("$or" in scope) and.push(scope);
  if (query.listId && query.listId !== "all") and.push({ listId: query.listId === "none" ? "" : query.listId });
  if (query.status && (LEAD_STATUSES as readonly string[]).includes(query.status)) and.push({ status: query.status });
  if (query.assignedTo) and.push({ assignedTo: query.assignedTo === "unassigned" ? "" : query.assignedTo });
  if (query.tag) and.push({ tags: query.tag });

  const range: any = {};
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (from && !Number.isNaN(from.getTime())) range.$gte = from;
  if (to && !Number.isNaN(to.getTime())) range.$lte = to;
  if (Object.keys(range).length) and.push({ createdAt: range });

  // Every word must match some field, so "john smith" finds first + last name.
  const words = (query.q || "").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  for (const word of words) {
    const rx = new RegExp(escapeRegex(word), "i");
    and.push({ $or: SEARCH_FIELDS.map((field) => ({ [field]: rx })) });
  }
  return and.length ? { $and: and } : {};
}

const COUNT_FIELDS = {
  notesCount: { $size: { $ifNull: ["$notes", []] } },
  tasksCount: { $size: { $ifNull: ["$tasks", []] } },
  openTasksCount: {
    $size: { $filter: { input: { $ifNull: ["$tasks", []] }, as: "t", cond: { $ne: ["$$t.completed", true] } } },
  },
};

export async function queryContacts(ctx: CrmContext, query: ContactQuery) {
  const match = buildContactMatch(ctx, query);
  const limit = Math.min(Math.max(query.limit || 50, 1), 500);
  const page = Math.max(query.page || 1, 1);
  const sortField = query.sort && SORTABLE.has(query.sort) ? query.sort : "createdAt";
  const dir = query.dir === "asc" ? 1 : -1;

  const [total, rows, statusAgg] = await Promise.all([
    CrmContact.countDocuments(match),
    CrmContact.aggregate([
      { $match: match },
      { $sort: { [sortField]: dir, _id: dir } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $addFields: COUNT_FIELDS },
      { $project: { notes: 0, tasks: 0, activity: 0 } },
    ]),
    // Per-status counts for the same filters (ignoring the status filter itself) to drive the summary cards.
    CrmContact.aggregate([
      { $match: buildContactMatch(ctx, { ...query, status: undefined }) },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = Object.fromEntries(LEAD_STATUSES.map((st) => [st, 0])) as Record<LeadStatus, number>;
  for (const row of statusAgg) if (row._id in statusCounts) statusCounts[row._id as LeadStatus] = row.count;

  return { success: true as const, contacts: rows.map(toContact), total, page, limit, statusCounts };
}

async function findScopedContact(ctx: CrmContext, id: string) {
  if (!isValidObjectId(id)) return null;
  return CrmContact.findOne({ _id: id, ...scopeFilter(ctx) });
}

export async function getContact(ctx: CrmContext, id: string) {
  const contact = await findScopedContact(ctx, id);
  if (!contact) return fail("Lead not found", 404);

  const [opportunities, appointments, summaries] = await Promise.all([
    CrmOpportunity.find({ contactId: id }).sort({ createdAt: -1 }).lean<any[]>(),
    CrmAppointment.find({ contactId: id }).sort({ start: -1 }).lean<any[]>(),
    buildContactSummaries([id]),
  ]);
  const summary = summaries.get(id) || null;
  const obj = contact.toObject();

  return {
    success: true as const,
    contact: {
      ...toContact(obj),
      notes: [...(obj.notes || [])].reverse().map(toNote),
      tasks: [...(obj.tasks || [])]
        .sort((a: any, b: any) => Number(a.completed) - Number(b.completed) || +new Date(a.dueDate || 8.64e15) - +new Date(b.dueDate || 8.64e15))
        .map(toTask),
      activity: [...(obj.activity || [])].reverse().map(toActivity),
      opportunities: opportunities.map((o) => toOpportunity(o, summary)),
      appointments: appointments.map((a) => toAppointment(a, summary)),
    },
  };
}

function hasIdentity(data: CrmContactInput) {
  return [data.firstName, data.lastName, data.businessName, data.email, data.phone].some((v) => v && v.trim());
}

// Sheet rows may start from any cell, so a manual create only needs one filled value.
function hasAnyValue(data: CrmContactInput) {
  const standard = STANDARD_FIELDS.some(({ key }) => (data[key] || "").trim());
  const custom = Object.values(data.customFields || {}).some((v) => v !== null && v !== undefined && v !== "");
  return standard || custom;
}

async function listExists(listId: string) {
  if (!listId) return true;
  return isValidObjectId(listId) && !!(await CrmList.exists({ _id: listId }));
}

export async function createContact(ctx: CrmContext, raw: unknown) {
  const parsed = ContactInputSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid lead data");
  const data = parsed.data;
  if (!hasAnyValue(data)) return fail("Fill in at least one field");
  if (data.listId && !(await listExists(data.listId))) return fail("Selected list no longer exists");

  const contact = await CrmContact.create({
    ...data,
    email: (data.email || "").trim().toLowerCase(),
    assignedTo: data.assignedTo ?? (ctx.scope === "assigned" ? ctx.username : ""),
    customFields: sanitizeCustomFields(data.customFields),
    createdBy: ctx.username,
    activity: [activityEntry("created", "Lead created", ctx.username)],
    lastActivityAt: new Date(),
  });
  return { success: true as const, contact: toContact(contact.toObject()) };
}

export async function updateContact(ctx: CrmContext, id: string, raw: unknown) {
  const contact = await findScopedContact(ctx, id);
  if (!contact) return fail("Lead not found", 404);
  const parsed = ContactInputSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid lead data");
  const data = parsed.data;

  const $set: Record<string, unknown> = {};
  const changed: string[] = [];
  const entries: ReturnType<typeof activityEntry>[] = [];

  for (const { key } of STANDARD_FIELDS) {
    const value = data[key];
    if (value === undefined) continue;
    const next = key === "email" ? value.trim().toLowerCase() : value;
    if ((contact as any)[key] !== next) {
      $set[key] = next;
      changed.push(STANDARD_LABELS[key]);
    }
  }

  if (data.status && data.status !== contact.status) {
    $set.status = data.status;
    entries.push(
      activityEntry(
        "status",
        `Status changed from ${LEAD_STATUS_LABELS[contact.status as LeadStatus]} to ${LEAD_STATUS_LABELS[data.status]}`,
        ctx.username
      )
    );
  }
  if (data.assignedTo !== undefined && data.assignedTo !== contact.assignedTo) {
    $set.assignedTo = data.assignedTo;
    entries.push(activityEntry("assign", data.assignedTo ? `Assigned to ${data.assignedTo}` : "Unassigned", ctx.username));
  }
  if (data.listId !== undefined && data.listId !== contact.listId) {
    if (!(await listExists(data.listId))) return fail("Selected list no longer exists");
    $set.listId = data.listId;
    const list = data.listId ? await CrmList.findById(data.listId, "name").lean<any>() : null;
    entries.push(activityEntry("list", list ? `Moved to list "${list.name}"` : "Removed from list", ctx.username));
  }
  if (data.tags !== undefined) {
    $set.tags = [...new Set(data.tags)];
    changed.push("Tags");
  }
  if (data.customFields) {
    const custom = sanitizeCustomFields(data.customFields);
    const current = (contact.customFields || {}) as Record<string, unknown>;
    let customChanged = false;
    for (const [key, value] of Object.entries(custom)) {
      if ((current[key] ?? null) !== value) {
        $set[`customFields.${key}`] = value;
        customChanged = true;
      }
    }
    if (customChanged) changed.push("Custom fields");
  }

  if (changed.length) entries.push(activityEntry("update", `Updated ${changed.join(", ")}`, ctx.username));
  if (Object.keys($set).length === 0) return { success: true as const, contact: toContact(contact.toObject()) };

  $set.lastActivityAt = new Date();
  const updated = await CrmContact.findByIdAndUpdate(
    id,
    { $set, ...(entries.length ? { $push: pushActivity(entries) } : {}) },
    { returnDocument: "after" }
  ).lean<any>();
  return { success: true as const, contact: toContact(updated) };
}

async function deleteContactsByIds(ids: string[]) {
  if (ids.length === 0) return 0;
  const result = await CrmContact.deleteMany({ _id: { $in: ids } });
  await Promise.all([CrmOpportunity.deleteMany({ contactId: { $in: ids } }), removeAppointmentsForContacts(ids)]);
  return result.deletedCount || 0;
}

export async function deleteContact(ctx: CrmContext, id: string) {
  const contact = await findScopedContact(ctx, id);
  if (!contact) return fail("Lead not found", 404);
  await deleteContactsByIds([id]);
  return { success: true as const };
}

/* ------------------------------------------------------------------ */
/* Notes & tasks                                                      */
/* ------------------------------------------------------------------ */

const NoteSchema = z.object({ body: z.string().trim().min(1).max(10000) });

export async function addNote(ctx: CrmContext, contactId: string, raw: unknown) {
  const contact = await findScopedContact(ctx, contactId);
  if (!contact) return fail("Lead not found", 404);
  const parsed = NoteSchema.safeParse(raw);
  if (!parsed.success) return fail("Note can't be empty");

  const note = { id: randomUUID(), body: parsed.data.body, createdBy: ctx.username, createdAt: new Date() };
  await CrmContact.updateOne(
    { _id: contactId },
    {
      $push: { notes: note, ...pushActivity([activityEntry("note", "Note added", ctx.username)]) },
      $set: { lastActivityAt: new Date() },
    }
  );
  return { success: true as const, note: toNote(note) };
}

export async function updateNote(ctx: CrmContext, contactId: string, noteId: string, raw: unknown) {
  const contact = await findScopedContact(ctx, contactId);
  if (!contact) return fail("Lead not found", 404);
  const note = contact.notes.find((n: any) => n.id === noteId);
  if (!note) return fail("Note not found", 404);
  if (!ctx.isAdmin && note.createdBy !== ctx.username) return fail("You can only edit your own notes", 403);
  const parsed = NoteSchema.safeParse(raw);
  if (!parsed.success) return fail("Note can't be empty");

  const updatedAt = new Date();
  await CrmContact.updateOne(
    { _id: contactId, "notes.id": noteId },
    { $set: { "notes.$.body": parsed.data.body, "notes.$.updatedAt": updatedAt } }
  );
  const plain = typeof note.toObject === "function" ? note.toObject() : note;
  return { success: true as const, note: toNote({ ...plain, body: parsed.data.body, updatedAt }) };
}

export async function deleteNote(ctx: CrmContext, contactId: string, noteId: string) {
  const contact = await findScopedContact(ctx, contactId);
  if (!contact) return fail("Lead not found", 404);
  const note = contact.notes.find((n: any) => n.id === noteId);
  if (!note) return fail("Note not found", 404);
  if (!ctx.isAdmin && note.createdBy !== ctx.username) return fail("You can only delete your own notes", 403);
  await CrmContact.updateOne({ _id: contactId }, { $pull: { notes: { id: noteId } } });
  return { success: true as const };
}

const TaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueDate: z.string().nullable().optional(),
  assignedTo: z.string().max(60).optional(),
  completed: z.boolean().optional(),
});

function parseDue(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function addTask(ctx: CrmContext, contactId: string, raw: unknown) {
  const contact = await findScopedContact(ctx, contactId);
  if (!contact) return fail("Lead not found", 404);
  const parsed = TaskSchema.safeParse(raw);
  if (!parsed.success) return fail("Task title is required");

  const task = {
    id: randomUUID(),
    title: parsed.data.title,
    description: parsed.data.description || "",
    dueDate: parseDue(parsed.data.dueDate),
    assignedTo: parsed.data.assignedTo ?? ctx.username,
    completed: false,
    createdBy: ctx.username,
    createdAt: new Date(),
  };
  await CrmContact.updateOne(
    { _id: contactId },
    {
      $push: { tasks: task, ...pushActivity([activityEntry("task", `Task created: ${task.title}`, ctx.username)]) },
      $set: { lastActivityAt: new Date() },
    }
  );
  return { success: true as const, task: toTask(task) };
}

export async function updateTask(ctx: CrmContext, contactId: string, taskId: string, raw: unknown) {
  const contact = await findScopedContact(ctx, contactId);
  if (!contact) return fail("Lead not found", 404);
  const task = contact.tasks.find((t: any) => t.id === taskId);
  if (!task) return fail("Task not found", 404);
  const parsed = TaskSchema.partial().safeParse(raw);
  if (!parsed.success) return fail("Invalid task data");

  const $set: Record<string, unknown> = {};
  const next: any = { ...(task.toObject ? task.toObject() : task) };
  for (const key of ["title", "description", "assignedTo", "completed"] as const) {
    if (parsed.data[key] !== undefined) {
      $set[`tasks.$.${key}`] = parsed.data[key];
      next[key] = parsed.data[key];
    }
  }
  if (parsed.data.dueDate !== undefined) {
    next.dueDate = parseDue(parsed.data.dueDate);
    $set["tasks.$.dueDate"] = next.dueDate;
  }
  const update: any = { $set };
  if (parsed.data.completed === true && !task.completed) {
    update.$push = pushActivity([activityEntry("task", `Task completed: ${next.title}`, ctx.username)]);
  }
  await CrmContact.updateOne({ _id: contactId, "tasks.id": taskId }, update);
  return { success: true as const, task: toTask(next) };
}

export async function deleteTask(ctx: CrmContext, contactId: string, taskId: string) {
  const contact = await findScopedContact(ctx, contactId);
  if (!contact) return fail("Lead not found", 404);
  await CrmContact.updateOne({ _id: contactId }, { $pull: { tasks: { id: taskId } } });
  return { success: true as const };
}

/* ------------------------------------------------------------------ */
/* Bulk actions                                                       */
/* ------------------------------------------------------------------ */

const BulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(2000),
  action: z.enum(["delete", "status", "assign", "list", "addTag", "removeTag"]),
  value: z.string().max(80).optional(),
});

export async function bulkContacts(ctx: CrmContext, raw: unknown) {
  const parsed = BulkSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid bulk action");
  const { action, value = "" } = parsed.data;

  // Only act on records this user is allowed to see.
  const scoped = await CrmContact.find({ _id: { $in: validIds(parsed.data.ids) }, ...scopeFilter(ctx) }, "_id").lean<any[]>();
  const ids = scoped.map((c) => String(c._id));
  if (ids.length === 0) return fail("No matching leads");
  const filter = { _id: { $in: ids } };
  const now = new Date();

  switch (action) {
    case "delete":
      await deleteContactsByIds(ids);
      break;
    case "status": {
      if (!(LEAD_STATUSES as readonly string[]).includes(value)) return fail("Invalid status");
      await CrmContact.updateMany(filter, {
        $set: { status: value, lastActivityAt: now },
        $push: pushActivity([activityEntry("status", `Status set to ${LEAD_STATUS_LABELS[value as LeadStatus]}`, ctx.username)]),
      });
      break;
    }
    case "assign":
      await CrmContact.updateMany(filter, {
        $set: { assignedTo: value, lastActivityAt: now },
        $push: pushActivity([activityEntry("assign", value ? `Assigned to ${value}` : "Unassigned", ctx.username)]),
      });
      break;
    case "list": {
      if (!(await listExists(value))) return fail("Selected list no longer exists");
      const list = value ? await CrmList.findById(value, "name").lean<any>() : null;
      await CrmContact.updateMany(filter, {
        $set: { listId: value, lastActivityAt: now },
        $push: pushActivity([activityEntry("list", list ? `Moved to list "${list.name}"` : "Removed from list", ctx.username)]),
      });
      break;
    }
    case "addTag":
      if (!value.trim()) return fail("Tag is required");
      await CrmContact.updateMany(filter, { $addToSet: { tags: value.trim() } });
      break;
    case "removeTag":
      await CrmContact.updateMany(filter, { $pull: { tags: value.trim() } });
      break;
  }
  return { success: true as const, affected: ids.length };
}

/* ------------------------------------------------------------------ */
/* Import / export                                                    */
/* ------------------------------------------------------------------ */

const ImportSchema = z.object({
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
  listId: z.string().max(40).optional(),
  duplicateMode: z.enum(["skip", "update", "create"]).default("skip"),
  status: z.enum(LEAD_STATUSES).optional(),
  assignedTo: z.string().max(60).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
});

const normEmail = (v: unknown) => String(v || "").trim().toLowerCase();
const normPhone = (v: unknown) => String(v || "").replace(/\D/g, "").slice(-10);

export async function importContacts(ctx: CrmContext, raw: unknown) {
  const parsed = ImportSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid import file");
  const { rows, duplicateMode, status, assignedTo, tags = [] } = parsed.data;
  const listId = parsed.data.listId || "";
  if (!(await listExists(listId))) return fail("Selected list no longer exists");

  const existing = await CrmContact.find({}, "email phone").lean<any[]>();
  const byEmail = new Map<string, string>();
  const byPhone = new Map<string, string>();
  for (const c of existing) {
    if (c.email) byEmail.set(normEmail(c.email), String(c._id));
    const p = normPhone(c.phone);
    if (p.length >= 7) byPhone.set(p, String(c._id));
  }

  const toInsert: any[] = [];
  const updates: { id: string; set: Record<string, unknown> }[] = [];
  let skipped = 0;
  let invalid = 0;
  const seen = new Set<string>();

  for (const row of rows) {
    const data: Record<string, unknown> = {};
    for (const { key } of STANDARD_FIELDS) {
      const value = row[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") data[key] = String(value).trim().slice(0, 500);
    }
    if (data.email) data.email = normEmail(data.email);
    const rowTags = typeof row.tags === "string" ? row.tags.split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [];
    const custom = sanitizeCustomFields((row.customFields as Record<string, unknown>) || {});

    if (!hasIdentity(data as CrmContactInput)) {
      invalid++;
      continue;
    }

    const emailKey = data.email ? normEmail(data.email) : "";
    const phoneKey = normPhone(data.phone);
    const dupKey = emailKey || (phoneKey.length >= 7 ? `p:${phoneKey}` : "");
    const existingId = (emailKey && byEmail.get(emailKey)) || (phoneKey.length >= 7 && byPhone.get(phoneKey)) || "";

    if (duplicateMode !== "create" && (existingId || (dupKey && seen.has(dupKey)))) {
      if (duplicateMode === "update" && existingId) {
        const set: Record<string, unknown> = { ...data, lastActivityAt: new Date() };
        for (const [k, v] of Object.entries(custom)) set[`customFields.${k}`] = v;
        updates.push({ id: existingId, set });
      } else {
        skipped++;
      }
      continue;
    }
    if (dupKey) seen.add(dupKey);

    toInsert.push({
      ...data,
      listId,
      status: status || "new",
      assignedTo: assignedTo ?? (ctx.scope === "assigned" ? ctx.username : ""),
      tags: [...new Set([...tags, ...rowTags])],
      customFields: custom,
      createdBy: ctx.username,
      activity: [activityEntry("created", "Imported from CSV", ctx.username)],
      lastActivityAt: new Date(),
    });
  }

  if (toInsert.length) await CrmContact.insertMany(toInsert, { ordered: false });
  if (updates.length) {
    await CrmContact.bulkWrite(
      updates.map((u) => ({
        updateOne: {
          filter: { _id: u.id, ...scopeFilter(ctx) },
          update: { $set: u.set, $push: pushActivity([activityEntry("update", "Updated from CSV import", ctx.username)]) },
        },
      })) as any[]
    );
  }

  return { success: true as const, created: toInsert.length, updated: updates.length, skipped, invalid };
}

export async function exportContactsCsv(ctx: CrmContext, query: ContactQuery) {
  const match = buildContactMatch(ctx, query);
  const [contacts, lists, fields] = await Promise.all([
    CrmContact.find(match, { notes: 0, tasks: 0, activity: 0 }).sort({ createdAt: -1 }).limit(50000).lean<any[]>(),
    CrmList.find({}, "name").lean<any[]>(),
    CrmField.find({}).sort({ order: 1, createdAt: 1 }).lean<any[]>(),
  ]);
  const listNames = new Map(lists.map((l) => [String(l._id), l.name]));
  const activeList = query.listId && query.listId !== "all" && query.listId !== "none" ? query.listId : "";
  const columns = fields.filter((f) => !activeList || !f.listIds?.length || f.listIds.includes(activeList));

  const header = [
    ...STANDARD_FIELDS.map((f) => f.label),
    "List",
    "Status",
    "Assigned To",
    "Tags",
    ...columns.map((f) => f.name),
    "Created At",
  ];
  const body = contacts.map((c) => [
    ...STANDARD_FIELDS.map((f) => c[f.key] || ""),
    listNames.get(c.listId) || "",
    LEAD_STATUS_LABELS[(c.status || "new") as LeadStatus],
    c.assignedTo || "",
    (c.tags || []).join("; "),
    ...columns.map((f) => {
      const value = c.customFields?.[String(f._id)];
      if (value === null || value === undefined) return "";
      if (typeof value === "boolean") return value ? "Yes" : "No";
      return value as string | number;
    }),
    c.createdAt ? new Date(c.createdAt).toISOString() : "",
  ]);
  return { csv: toCsv([header, ...body]), count: contacts.length };
}
