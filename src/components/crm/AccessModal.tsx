"use client";

import * as React from "react";
import { ShieldCheck, UsersRound } from "lucide-react";
import { crmApi } from "@/lib/crm/client";
import type { CrmAccessUser, CrmScope } from "@/lib/crm/types";
import { useCrm } from "@/components/crm/CrmProvider";
import { Avatar, Badge, EmptyState, Modal, Spinner, Toggle, cn, useFeedback } from "@/components/crm/ui";

// Admin picks which business users can open the Leads module, and how much they see.
export function AccessModal() {
  const { accessOpen, setAccessOpen, refreshMembers, me } = useCrm();
  const { toast } = useFeedback();
  const [users, setUsers] = React.useState<CrmAccessUser[] | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!accessOpen) return;
    setUsers(null);
    crmApi.access
      .list()
      .then((res) => setUsers(res.users))
      .catch((e) => {
        toast(e.message, "error");
        setUsers([]);
      });
  }, [accessOpen, toast]);

  const update = async (user: CrmAccessUser, hasAccess: boolean, scope: CrmScope) => {
    setSaving(user.username);
    const previous = users;
    setUsers((list) => list?.map((u) => (u.username === user.username ? { ...u, hasAccess, scope } : u)) || null);
    try {
      await crmApi.access.set(user.username, hasAccess, scope);
      await refreshMembers();
      toast(hasAccess ? `${user.username} can now open Leads` : `${user.username} no longer has access`);
    } catch (e) {
      setUsers(previous);
      toast((e as Error).message, "error");
    } finally {
      setSaving(null);
    }
  };

  const granted = users?.filter((u) => u.hasAccess).length || 0;

  return (
    <Modal
      open={accessOpen}
      onClose={() => setAccessOpen(false)}
      title="Who can access Leads"
      description="Choose which team members can open this module. You (the business admin) always have full access."
      icon={ShieldCheck}
      size="md"
    >
      <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/5 mb-4">
        <Avatar name={me.username} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 dark:text-white truncate">{me.username}</div>
          <div className="text-[11px] text-slate-500">Business admin</div>
        </div>
        <Badge color="blue">Owner · Full access</Badge>
      </div>

      {users === null ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No team members yet"
          description="Create team members from the workspace's user management first, then give them access here."
        />
      ) : (
        <>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Team members · {granted} of {users.length} with access
          </div>
          <ul className="flex flex-col divide-y divide-slate-100 dark:divide-white/5 rounded-xl border border-slate-200/70 dark:border-white/10 overflow-hidden">
            {users.map((user) => (
              <li key={user.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3 bg-white dark:bg-transparent">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <Avatar name={user.username} size="md" />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-white truncate">{user.username}</div>
                    <div className="text-[11px] text-slate-500">
                      {user.hasAccess ? (user.scope === "all" ? "Sees all leads" : "Sees only leads assigned to them") : "No access"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pl-12 sm:pl-0">
                  <div
                    className={cn(
                      "inline-flex rounded-lg bg-slate-100 dark:bg-white/5 p-0.5 text-[11px] font-semibold transition-opacity",
                      !user.hasAccess && "opacity-40 pointer-events-none"
                    )}
                  >
                    {(["all", "assigned"] as const).map((scope) => (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => update(user, true, scope)}
                        className={cn(
                          "px-2.5 py-1 rounded-md cursor-pointer",
                          user.scope === scope
                            ? "bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-sm"
                            : "text-slate-500"
                        )}
                      >
                        {scope === "all" ? "All data" : "Assigned only"}
                      </button>
                    ))}
                  </div>
                  {saving === user.username ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <Toggle
                      checked={user.hasAccess}
                      label={`Access for ${user.username}`}
                      onChange={(v) => update(user, v, user.scope)}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}
