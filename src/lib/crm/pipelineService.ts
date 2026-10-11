import { randomUUID } from "crypto";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { CrmPipeline } from "@/models/crm/CrmPipeline";
import { CrmOpportunity } from "@/models/crm/CrmOpportunity";
import { CrmContact } from "@/models/crm/CrmContact";
import { scopeFilter, type CrmContext } from "@/lib/crm/access";
import { activityEntry, logContactActivity, pushActivity } from "@/lib/crm/activity";
import { buildContactSummaries, toOpportunity, validIds } from "@/lib/crm/serialize";
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABELS,
  contactDisplayName,
  formatMoney,
  type CrmPipelineDTO,
  type OpportunityStatus,
} from "@/lib/crm/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Fail = { success: false; error: string; status?: number };
const fail = (error: string, status = 400): Fail => ({ success: false, error, status });

// Stages from the client's own GoHighLevel pipeline.
const DEFAULT_STAGES = [
  { name: "Fresh Lead", color: "sky", kind: "open" },
  { name: "Demo Sent", color: "indigo", kind: "open" },
  { name: "Demo Held · Outcome Pending", color: "violet", kind: "open" },
  { name: "Verbal Yes · Unpaid", color: "amber", kind: "open" },
  { name: "Not Sold · Post-demo Follow-up", color: "rose", kind: "open" },
  { name: "Closed · Won", color: "emerald", kind: "won" },
] as const;

function toPipeline(p: any): CrmPipelineDTO {
  return {
    id: String(p._id),
    name: p.name,
    order: p.order || 0,
    stages: (p.stages || []).map((s: any) => ({ id: s.id, name: s.name, color: s.color || "slate", kind: s.kind || "open" })),
  };
}

let seeding: Promise<void> | null = null;

// Several requests hit this at once on a fresh install, so seeding must be idempotent:
// one in-process lock plus an upsert on a unique seedKey (covers multiple server instances).
async function seedDefaultPipeline() {
  try {
    await CrmPipeline.updateOne(
      { seedKey: "default" },
      {
        $setOnInsert: {
          name: "Sales Pipeline",
          order: 0,
          seedKey: "default",
          stages: DEFAULT_STAGES.map((s) => ({ ...s, id: randomUUID() })),
        },
      },
      { upsert: true }
    );
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
  }
}

export async function fetchPipelines() {
  let pipelines = await CrmPipeline.find({}).sort({ order: 1, createdAt: 1 }).lean<any[]>();
  if (pipelines.length === 0) {
    seeding ??= seedDefaultPipeline().finally(() => (seeding = null));
    await seeding;
    pipelines = await CrmPipeline.find({}).sort({ order: 1, createdAt: 1 }).lean<any[]>();
  }
  return { success: true as const, pipelines: pipelines.map(toPipeline) };
}

const StageInputSchema = z.object({
  id: z.string().max(60).optional(),
  name: z.string().trim().min(1).max(80),
  color: z.string().max(20).optional(),
  kind: z.enum(["open", "won", "lost"]).optional(),
});

const PipelineInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  stages: z.array(StageInputSchema).min(1).max(30),
  // Where opportunities of removed stages should go: { removedStageId: targetStageId }.
  moveTo: z.record(z.string(), z.string()).optional(),
});

async function nameTaken(name: string, exceptId?: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return !!(await CrmPipeline.exists({
    name: { $regex: new RegExp(`^${escaped}$`, "i") },
    ...(exceptId ? { _id: { $ne: exceptId } } : {}),
  }));
}

export async function createPipeline(raw: unknown) {
  const parsed = PipelineInputSchema.safeParse(raw);
  if (!parsed.success) return fail("A pipeline needs a name and at least one stage");
  if (await nameTaken(parsed.data.name)) return fail("A pipeline with this name already exists");
  const order = await CrmPipeline.countDocuments();
  const pipeline = await CrmPipeline.create({
    name: parsed.data.name,
    order,
    stages: parsed.data.stages.map((s) => ({ id: randomUUID(), name: s.name, color: s.color || "slate", kind: s.kind || "open" })),
  });
  return { success: true as const, pipeline: toPipeline(pipeline.toObject()) };
}

export async function updatePipeline(id: string, raw: unknown) {
  if (!isValidObjectId(id)) return fail("Pipeline not found", 404);
  const pipeline = await CrmPipeline.findById(id);
  if (!pipeline) return fail("Pipeline not found", 404);
  const parsed = PipelineInputSchema.safeParse(raw);
  if (!parsed.success) return fail("A pipeline needs a name and at least one stage");
  if (await nameTaken(parsed.data.name, id)) return fail("A pipeline with this name already exists");

  const existingIds = new Set(pipeline.stages.map((s: any) => s.id));
  const stages = parsed.data.stages.map((s) => ({
    id: s.id && existingIds.has(s.id) ? s.id : randomUUID(),
    name: s.name,
    color: s.color || "slate",
    kind: s.kind || "open",
  }));
  const keptIds = new Set(stages.map((s) => s.id));
  const removed = pipeline.stages.filter((s: any) => !keptIds.has(s.id)).map((s: any) => s.id);

  // Re-home opportunities from deleted stages (GoHighLevel asks for a destination stage).
  for (const stageId of removed) {
    const target = parsed.data.moveTo?.[stageId];
    const destination = target && keptIds.has(target) ? target : stages[0].id;
    await CrmOpportunity.updateMany({ pipelineId: id, stageId }, { $set: { stageId: destination, stageChangedAt: new Date() } });
  }

  pipeline.name = parsed.data.name;
  pipeline.stages = stages as any;
  await pipeline.save();
  return { success: true as const, pipeline: toPipeline(pipeline.toObject()) };
}

export async function deletePipeline(id: string) {
  if (!isValidObjectId(id)) return fail("Pipeline not found", 404);
  if ((await CrmPipeline.countDocuments()) <= 1) return fail("You need at least one pipeline");
  const deleted = await CrmPipeline.findByIdAndDelete(id);
  if (!deleted) return fail("Pipeline not found", 404);
  await CrmOpportunity.deleteMany({ pipelineId: id });
  return { success: true as const };
}

/* ------------------------------------------------------------------ */
/* Opportunities                                                      */
/* ------------------------------------------------------------------ */

const OpportunityInputSchema = z.object({
  name: z.string().trim().max(200).optional(),
  pipelineId: z.string().max(40),
  stageId: z.string().max(60),
  status: z.enum(OPPORTUNITY_STATUSES).optional(),
  value: z.number().min(0).max(1e12).optional(),
  contactId: z.string().max(40),
  source: z.string().max(120).optional(),
  assignedTo: z.string().max(60).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
  lostReason: z.string().max(300).optional(),
  // Full ordering of the destination column after a drag & drop.
  orderedIds: z.array(z.string()).max(2000).optional(),
});

async function withSummaries(rows: any[]) {
  const summaries = await buildContactSummaries(rows.map((r) => r.contactId));
  return rows.map((r) => toOpportunity(r, summaries.get(r.contactId) || null));
}

export async function fetchOpportunities(
  ctx: CrmContext,
  query: { pipelineId?: string; q?: string; status?: string; assignedTo?: string; contactId?: string }
) {
  const and: any[] = [];
  const scope = scopeFilter(ctx);
  if ("$or" in scope) and.push(scope);
  if (query.pipelineId) and.push({ pipelineId: query.pipelineId });
  if (query.contactId) and.push({ contactId: query.contactId });
  if (query.status && query.status !== "all") and.push({ status: query.status });
  if (query.assignedTo) and.push({ assignedTo: query.assignedTo === "unassigned" ? "" : query.assignedTo });

  const q = (query.q || "").trim();
  if (q) {
    const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const contacts = await CrmContact.find(
      { $or: [{ firstName: rx }, { lastName: rx }, { businessName: rx }, { email: rx }, { phone: rx }] },
      "_id"
    )
      .limit(500)
      .lean<any[]>();
    and.push({ $or: [{ name: rx }, { source: rx }, { tags: rx }, { contactId: { $in: contacts.map((c) => String(c._id)) } }] });
  }

  const rows = await CrmOpportunity.find(and.length ? { $and: and } : {})
    .sort({ order: 1, updatedAt: -1 })
    .limit(3000)
    .lean<any[]>();
  return { success: true as const, opportunities: await withSummaries(rows) };
}

async function stageOf(pipelineId: string, stageId: string) {
  if (!isValidObjectId(pipelineId)) return null;
  const pipeline = await CrmPipeline.findById(pipelineId).lean<any>();
  const stage = pipeline?.stages?.find((s: any) => s.id === stageId);
  return pipeline && stage ? { pipeline, stage } : null;
}

async function applyOrdering(ctx: CrmContext, orderedIds: string[] | undefined) {
  if (!orderedIds?.length) return;
  const ids = validIds(orderedIds);
  await CrmOpportunity.bulkWrite(
    ids.map((oid, index) => ({ updateOne: { filter: { _id: oid, ...scopeFilter(ctx) }, update: { $set: { order: index } } } }))
  );
}

// Winning a deal marks its lead as converted.
async function markContactConverted(contactId: string, by: string) {
  if (!isValidObjectId(contactId)) return;
  await CrmContact.updateOne(
    { _id: contactId, status: { $ne: "converted" } },
    {
      $set: { status: "converted", lastActivityAt: new Date() },
      $push: pushActivity([activityEntry("status", "Status changed to Converted (opportunity won)", by)]),
    }
  );
}

export async function createOpportunity(ctx: CrmContext, raw: unknown) {
  const parsed = OpportunityInputSchema.safeParse(raw);
  if (!parsed.success) return fail("Pick a contact, pipeline and stage");
  const data = parsed.data;
  const target = await stageOf(data.pipelineId, data.stageId);
  if (!target) return fail("Pipeline stage not found");
  if (!isValidObjectId(data.contactId)) return fail("Pick a contact for this opportunity");
  const contact = await CrmContact.findOne({ _id: data.contactId, ...scopeFilter(ctx) }).lean<any>();
  if (!contact) return fail("Contact not found", 404);

  const top = await CrmOpportunity.findOne({ pipelineId: data.pipelineId, stageId: data.stageId }).sort({ order: 1 }).lean<any>();
  const status: OpportunityStatus =
    target.stage.kind === "won" ? "won" : target.stage.kind === "lost" ? "lost" : data.status || "open";

  const doc = await CrmOpportunity.create({
    name: data.name || contact.businessName || contactDisplayName(contact),
    pipelineId: data.pipelineId,
    stageId: data.stageId,
    status,
    value: data.value || 0,
    contactId: data.contactId,
    source: data.source ?? contact.source ?? "",
    assignedTo: data.assignedTo ?? (contact.assignedTo || ctx.username),
    tags: data.tags || [],
    lostReason: data.lostReason || "",
    order: top ? (top.order || 0) - 1 : 0,
    createdBy: ctx.username,
    stageChangedAt: new Date(),
    statusChangedAt: new Date(),
  });
  await logContactActivity(
    data.contactId,
    "opportunity",
    `Opportunity created in ${target.pipeline.name} → ${target.stage.name}${doc.value ? ` (${formatMoney(doc.value)})` : ""}`,
    ctx.username
  );
  if (status === "won") await markContactConverted(data.contactId, ctx.username);

  const [opportunity] = await withSummaries([doc.toObject()]);
  return { success: true as const, opportunity };
}

export async function updateOpportunity(ctx: CrmContext, id: string, raw: unknown) {
  if (!isValidObjectId(id)) return fail("Opportunity not found", 404);
  const doc = await CrmOpportunity.findOne({ _id: id, ...scopeFilter(ctx) });
  if (!doc) return fail("Opportunity not found", 404);
  const parsed = OpportunityInputSchema.partial().safeParse(raw);
  if (!parsed.success) return fail("Invalid opportunity data");
  const data = parsed.data;
  const now = new Date();
  const notes: string[] = [];

  const pipelineId = data.pipelineId ?? doc.pipelineId;
  const stageId = data.stageId ?? doc.stageId;
  let nextStatus: OpportunityStatus | undefined = data.status;

  if (pipelineId !== doc.pipelineId || stageId !== doc.stageId) {
    const target = await stageOf(pipelineId, stageId);
    if (!target) return fail("Pipeline stage not found");
    doc.pipelineId = pipelineId;
    doc.stageId = stageId;
    doc.stageChangedAt = now;
    notes.push(`moved to ${target.stage.name}`);
    if (!nextStatus && target.stage.kind === "won") nextStatus = "won";
    if (!nextStatus && target.stage.kind === "lost") nextStatus = "lost";
    if (!nextStatus && target.stage.kind === "open" && doc.status !== "open" && doc.status !== "abandoned") nextStatus = "open";
  }

  if (data.contactId !== undefined && data.contactId !== doc.contactId) {
    if (!isValidObjectId(data.contactId)) return fail("Contact not found", 404);
    const exists = await CrmContact.exists({ _id: data.contactId, ...scopeFilter(ctx) });
    if (!exists) return fail("Contact not found", 404);
    doc.contactId = data.contactId;
  }

  const wasWon = doc.status === "won";
  if (nextStatus && nextStatus !== doc.status) {
    doc.status = nextStatus;
    doc.statusChangedAt = now;
    notes.push(`marked ${OPPORTUNITY_STATUS_LABELS[nextStatus]}`);
    if (nextStatus !== "lost") doc.lostReason = "";
  }
  if (data.lostReason !== undefined && doc.status === "lost") doc.lostReason = data.lostReason;
  if (data.name !== undefined && data.name) doc.name = data.name;
  if (data.value !== undefined && data.value !== doc.value) {
    notes.push(`value set to ${formatMoney(data.value)}`);
    doc.value = data.value;
  }
  if (data.source !== undefined) doc.source = data.source;
  if (data.assignedTo !== undefined) doc.assignedTo = data.assignedTo;
  if (data.tags !== undefined) doc.tags = [...new Set(data.tags)];
  await doc.save();
  await applyOrdering(ctx, data.orderedIds);

  if (notes.length) {
    await logContactActivity(doc.contactId, "opportunity", `Opportunity "${doc.name}" ${notes.join(", ")}`, ctx.username);
  }
  if (!wasWon && doc.status === "won") await markContactConverted(doc.contactId, ctx.username);

  const [opportunity] = await withSummaries([doc.toObject()]);
  return { success: true as const, opportunity };
}

export async function deleteOpportunity(ctx: CrmContext, id: string) {
  if (!isValidObjectId(id)) return fail("Opportunity not found", 404);
  const doc = await CrmOpportunity.findOneAndDelete({ _id: id, ...scopeFilter(ctx) });
  if (!doc) return fail("Opportunity not found", 404);
  await logContactActivity(doc.contactId, "opportunity", `Opportunity "${doc.name}" deleted`, ctx.username);
  return { success: true as const };
}

const BulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(2000),
  action: z.enum(["delete", "status", "assign"]),
  value: z.string().max(60).optional(),
});

export async function bulkOpportunities(ctx: CrmContext, raw: unknown) {
  const parsed = BulkSchema.safeParse(raw);
  if (!parsed.success) return fail("Invalid bulk action");
  const filter = { _id: { $in: validIds(parsed.data.ids) }, ...scopeFilter(ctx) };
  const value = parsed.data.value || "";

  if (parsed.data.action === "delete") {
    const result = await CrmOpportunity.deleteMany(filter);
    return { success: true as const, affected: result.deletedCount || 0 };
  }
  if (parsed.data.action === "status") {
    if (!(OPPORTUNITY_STATUSES as readonly string[]).includes(value)) return fail("Invalid status");
    const result = await CrmOpportunity.updateMany(filter, { $set: { status: value, statusChangedAt: new Date() } });
    if (value === "won") {
      const rows = await CrmOpportunity.find(filter, "contactId").lean<any[]>();
      await Promise.all([...new Set(rows.map((r) => r.contactId))].map((cid) => markContactConverted(cid, ctx.username)));
    }
    return { success: true as const, affected: result.modifiedCount || 0 };
  }
  const result = await CrmOpportunity.updateMany(filter, { $set: { assignedTo: value } });
  return { success: true as const, affected: result.modifiedCount || 0 };
}
