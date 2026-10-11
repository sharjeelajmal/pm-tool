import { CrmContact } from "@/models/crm/CrmContact";
import { CrmList } from "@/models/crm/CrmList";
import { CrmOpportunity } from "@/models/crm/CrmOpportunity";
import { CrmAppointment } from "@/models/crm/CrmAppointment";
import { scopeFilter, type CrmContext } from "@/lib/crm/access";
import { fetchPipelines } from "@/lib/crm/pipelineService";
import { buildContactSummaries, toAppointment, toContact, toTask } from "@/lib/crm/serialize";
import { LEAD_STATUSES, contactDisplayName, type CrmDashboardDTO, type LeadStatus } from "@/lib/crm/types";

/* eslint-disable @typescript-eslint/no-explicit-any */

const DAY = 24 * 60 * 60 * 1000;

function parseDate(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeTimeZone(tz?: string | null) {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

const and = (...parts: any[]) => {
  const list = parts.filter((p) => p && Object.keys(p).length);
  return list.length ? { $and: list } : {};
};

export async function fetchDashboard(
  ctx: CrmContext,
  query: { from?: string | null; to?: string | null; pipelineId?: string | null; tz?: string | null }
): Promise<{ success: true; dashboard: CrmDashboardDTO }> {
  const scope = scopeFilter(ctx);
  const now = new Date();
  const from = parseDate(query.from);
  const to = parseDate(query.to);
  const tz = safeTimeZone(query.tz);

  const createdRange = from || to ? { createdAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) } } : {};
  const statusRange = from || to ? { statusChangedAt: { ...(from && { $gte: from }), ...(to && { $lte: to }) } } : {};

  // Comparison window of equal length just before the selected one.
  let prevRange: any = null;
  if (from) {
    const end = to || now;
    const span = end.getTime() - from.getTime();
    prevRange = { createdAt: { $gte: new Date(from.getTime() - span), $lt: from } };
  }

  // Daily series: selected range, or the last 30 days.
  const seriesFrom = from || new Date(now.getTime() - 29 * DAY);
  const seriesTo = to || now;

  const contactMatch = and(scope, createdRange);
  const oppScope = scopeFilter(ctx);

  const [
    totalLeads,
    leadsInRange,
    leadsPrevRange,
    openAgg,
    wonAgg,
    lostCount,
    createdOpps,
    wonOfCreated,
    lists,
    byListAgg,
    byStatusAgg,
    bySourceAgg,
    seriesAgg,
    upcomingRows,
    upcomingCount,
    taskRows,
    taskCounts,
    recentRows,
    pipelinesResult,
  ] = await Promise.all([
    CrmContact.countDocuments(scope),
    CrmContact.countDocuments(contactMatch),
    prevRange ? CrmContact.countDocuments(and(scope, prevRange)) : Promise.resolve(0),
    CrmOpportunity.aggregate([{ $match: and(oppScope, { status: "open" }) }, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$value" } } }]),
    CrmOpportunity.aggregate([{ $match: and(oppScope, { status: "won" }, statusRange) }, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$value" } } }]),
    CrmOpportunity.countDocuments(and(oppScope, { status: "lost" }, statusRange)),
    CrmOpportunity.countDocuments(and(oppScope, createdRange)),
    CrmOpportunity.countDocuments(and(oppScope, createdRange, { status: "won" })),
    CrmList.find({}).sort({ order: 1, createdAt: 1 }).lean<any[]>(),
    CrmContact.aggregate([{ $match: contactMatch }, { $group: { _id: "$listId", count: { $sum: 1 } } }]),
    CrmContact.aggregate([{ $match: contactMatch }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    CrmContact.aggregate([
      { $match: contactMatch },
      { $group: { _id: { $cond: [{ $eq: [{ $ifNull: ["$source", ""] }, ""] }, "Unknown", "$source"] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    CrmContact.aggregate([
      { $match: and(scope, { createdAt: { $gte: seriesFrom, $lte: seriesTo } }) },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: tz } }, count: { $sum: 1 } } },
    ]),
    CrmAppointment.find(and(scopeFilter(ctx), { start: { $gte: now }, status: { $ne: "cancelled" } }))
      .sort({ start: 1 })
      .limit(6)
      .lean<any[]>(),
    CrmAppointment.countDocuments(and(scopeFilter(ctx), { start: { $gte: now, $lte: new Date(now.getTime() + 7 * DAY) }, status: { $ne: "cancelled" } })),
    CrmContact.aggregate([
      { $match: scope },
      { $unwind: "$tasks" },
      { $match: { "tasks.completed": { $ne: true } } },
      // Tasks without a due date go last.
      { $addFields: { noDue: { $cond: [{ $ifNull: ["$tasks.dueDate", false] }, 0, 1] } } },
      { $sort: { noDue: 1, "tasks.dueDate": 1 } },
      { $limit: 8 },
      { $project: { task: "$tasks", firstName: 1, lastName: 1, businessName: 1, email: 1, phone: 1 } },
    ]),
    CrmContact.aggregate([
      { $match: scope },
      { $unwind: "$tasks" },
      { $match: { "tasks.completed": { $ne: true } } },
      {
        $group: {
          _id: null,
          open: { $sum: 1 },
          overdue: { $sum: { $cond: [{ $and: [{ $ne: ["$tasks.dueDate", null] }, { $lt: ["$tasks.dueDate", now] }] }, 1, 0] } },
        },
      },
    ]),
    CrmContact.find(scope, { notes: 0, tasks: 0, activity: 0 }).sort({ createdAt: -1 }).limit(6).lean<any[]>(),
    fetchPipelines(),
  ]);

  const countByList = new Map<string, number>(byListAgg.map((r: any) => [r._id || "", r.count]));
  const byList = lists.map((l) => ({ id: String(l._id), name: l.name, color: l.color || "blue", count: countByList.get(String(l._id)) || 0 }));
  const unlisted = countByList.get("") || 0;
  if (unlisted) byList.push({ id: "none", name: "No list", color: "slate", count: unlisted });

  const statusMap = new Map<string, number>(byStatusAgg.map((r: any) => [r._id, r.count]));
  const byStatus = LEAD_STATUSES.map((status) => ({ status: status as LeadStatus, count: statusMap.get(status) || 0 }));

  // Fill empty days so the chart has a continuous axis.
  const seriesMap = new Map<string, number>(seriesAgg.map((r: any) => [r._id, r.count]));
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const leadsOverTime: { date: string; count: number }[] = [];
  const seen = new Set<string>();
  for (let t = seriesFrom.getTime(); t <= seriesTo.getTime() + DAY / 2 && leadsOverTime.length < 400; t += DAY) {
    const key = fmt.format(new Date(t));
    if (seen.has(key)) continue;
    seen.add(key);
    leadsOverTime.push({ date: key, count: seriesMap.get(key) || 0 });
  }

  const pipelines = pipelinesResult.pipelines;
  const pipeline = pipelines.find((p) => p.id === query.pipelineId) || pipelines[0] || null;
  let pipelineStats: CrmDashboardDTO["pipeline"] = null;
  if (pipeline) {
    const stageAgg = await CrmOpportunity.aggregate([
      { $match: and(oppScope, { pipelineId: pipeline.id, status: { $in: ["open", "won"] } }) },
      { $group: { _id: "$stageId", count: { $sum: 1 }, value: { $sum: "$value" } } },
    ]);
    const stageMap = new Map<string, any>(stageAgg.map((r: any) => [r._id, r]));
    pipelineStats = {
      id: pipeline.id,
      name: pipeline.name,
      stages: pipeline.stages.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        count: stageMap.get(s.id)?.count || 0,
        value: stageMap.get(s.id)?.value || 0,
      })),
    };
  }

  const summaries = await buildContactSummaries(upcomingRows.map((r) => r.contactId));

  return {
    success: true,
    dashboard: {
      range: { from: from?.toISOString() || null, to: to?.toISOString() || null },
      totals: {
        leads: totalLeads,
        leadsInRange,
        leadsPrevRange,
        openOpportunities: openAgg[0]?.count || 0,
        openValue: openAgg[0]?.value || 0,
        wonCount: wonAgg[0]?.count || 0,
        wonValue: wonAgg[0]?.value || 0,
        lostCount,
        conversionRate: createdOpps ? Math.round((wonOfCreated / createdOpps) * 1000) / 10 : 0,
        upcomingAppointments: upcomingCount,
        openTasks: taskCounts[0]?.open || 0,
        overdueTasks: taskCounts[0]?.overdue || 0,
      },
      byList,
      byStatus,
      bySource: bySourceAgg.map((r: any) => ({ source: r._id, count: r.count })),
      leadsOverTime,
      pipeline: pipelineStats,
      upcoming: upcomingRows.map((r) => toAppointment(r, summaries.get(r.contactId) || null)),
      tasks: taskRows.map((r: any) => ({ ...toTask(r.task), contactId: String(r._id), contactName: contactDisplayName(r) })),
      recentLeads: recentRows.map(toContact),
    },
  };
}
