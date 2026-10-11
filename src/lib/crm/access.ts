import { getAuthPayload } from "@/lib/authUtil";
import { connectDB } from "@/lib/db";
import { jsonResponse } from "@/lib/apiHeaders";
import { CrmAccess } from "@/models/crm/CrmAccess";
import { User } from "@/models/User";
import type { CrmAccessUser, CrmMe, CrmMember, CrmScope } from "@/lib/crm/types";

export type CrmContext = CrmMe;

type CrmContextResult =
  | { ok: true; ctx: CrmContext }
  | { ok: false; status: number; error: string };

export function getBusinessAdminUsername() {
  return (process.env.BUSINESS_USERNAME || "business").trim();
}

export async function getCrmContext(): Promise<CrmContextResult> {
  const auth = await getAuthPayload();
  if (auth.portal !== "business") {
    return { ok: false, status: 403, error: "The Leads module is only available in the business workspace" };
  }
  if (auth.isAdmin) {
    return { ok: true, ctx: { username: auth.username, isAdmin: true, scope: "all" } };
  }

  await connectDB();
  const access = await CrmAccess.findOne({ username: auth.username }).lean<{ scope: CrmScope }>();
  if (!access) {
    return { ok: false, status: 403, error: "You don't have access to the Leads module" };
  }
  return { ok: true, ctx: { username: auth.username, isAdmin: false, scope: access.scope || "all" } };
}

// Wraps a route handler with the CRM access check and a uniform error response.
export async function withCrm(
  handler: (ctx: CrmContext) => Promise<Response>,
  options: { adminOnly?: boolean } = {}
): Promise<Response> {
  try {
    const result = await getCrmContext();
    if (!result.ok) return jsonResponse({ success: false, error: result.error }, result.status);
    if (options.adminOnly && !result.ctx.isAdmin) {
      return jsonResponse({ success: false, error: "Only the business admin can do this" }, 403);
    }
    await connectDB();
    return await handler(result.ctx);
  } catch (error) {
    console.error("CRM route failed:", error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : "Something went wrong" },
      500
    );
  }
}

export function respond(result: { success: boolean; status?: number }) {
  return jsonResponse(result, result.success ? 200 : result.status || 400);
}

export async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}

// Mongo filter limiting "assigned only" users to their own records.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function scopeFilter(ctx: CrmContext, fields: string[] = ["assignedTo", "createdBy"]): Record<string, any> {
  if (ctx.scope === "all") return {};
  return { $or: fields.map((field) => ({ [field]: ctx.username })) };
}

export async function listCrmMembers(): Promise<CrmMember[]> {
  await connectDB();
  const rows = await CrmAccess.find({}, "username").sort({ username: 1 }).lean<{ username: string }[]>();
  return [
    { username: getBusinessAdminUsername(), isAdmin: true },
    ...rows.map((row) => ({ username: row.username, isAdmin: false })),
  ];
}

export async function listAccessUsers(): Promise<CrmAccessUser[]> {
  await connectDB();
  const [users, access] = await Promise.all([
    User.find({ portal: "business" }, "username").sort({ username: 1 }).lean<{ _id: unknown; username: string }[]>(),
    CrmAccess.find({}).lean<{ username: string; scope: CrmScope }[]>(),
  ]);
  const byUsername = new Map(access.map((row) => [row.username, row]));
  return users.map((user) => {
    const row = byUsername.get(user.username);
    return {
      id: String(user._id),
      username: user.username,
      hasAccess: !!row,
      scope: row?.scope || "all",
    };
  });
}

export async function setUserAccess(username: string, hasAccess: boolean, scope: CrmScope, grantedBy: string) {
  await connectDB();
  const exists = await User.exists({ username, portal: "business" });
  if (!exists) return { success: false as const, error: "User not found" };

  if (!hasAccess) {
    await CrmAccess.deleteOne({ username });
  } else {
    await CrmAccess.updateOne({ username }, { $set: { scope, grantedBy } }, { upsert: true });
  }
  return { success: true as const };
}
