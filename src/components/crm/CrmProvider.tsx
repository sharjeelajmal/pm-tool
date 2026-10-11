"use client";

import * as React from "react";
import { crmApi } from "@/lib/crm/client";
import type { CrmFieldDTO, CrmListDTO, CrmMe, CrmMember, CrmPipelineDTO } from "@/lib/crm/types";
import { FeedbackProvider } from "@/components/crm/ui";

interface CrmState {
  me: CrmMe;
  members: CrmMember[];
  lists: CrmListDTO[];
  listTotals: { total: number; unlisted: number };
  fields: CrmFieldDTO[];
  pipelines: CrmPipelineDTO[];
  ready: boolean;
  refreshLists: () => Promise<void>;
  refreshFields: () => Promise<void>;
  refreshPipelines: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  accessOpen: boolean;
  setAccessOpen: (open: boolean) => void;
}

const CrmContext = React.createContext<CrmState | null>(null);

export function useCrm() {
  const ctx = React.useContext(CrmContext);
  if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
  return ctx;
}

export function CrmProvider({ me, children }: { me: CrmMe; children: React.ReactNode }) {
  const [members, setMembers] = React.useState<CrmMember[]>([{ username: me.username, isAdmin: me.isAdmin }]);
  const [lists, setLists] = React.useState<CrmListDTO[]>([]);
  const [listTotals, setListTotals] = React.useState({ total: 0, unlisted: 0 });
  const [fields, setFields] = React.useState<CrmFieldDTO[]>([]);
  const [pipelines, setPipelines] = React.useState<CrmPipelineDTO[]>([]);
  const [ready, setReady] = React.useState(false);
  const [accessOpen, setAccessOpen] = React.useState(false);

  const refreshLists = React.useCallback(async () => {
    const res = await crmApi.lists.list();
    setLists(res.lists);
    setListTotals({ total: res.totalCount, unlisted: res.unlistedCount });
  }, []);
  const refreshFields = React.useCallback(async () => {
    setFields((await crmApi.fields.list()).fields);
  }, []);
  const refreshPipelines = React.useCallback(async () => {
    setPipelines((await crmApi.pipelines.list()).pipelines);
  }, []);
  const refreshMembers = React.useCallback(async () => {
    setMembers((await crmApi.me()).members);
  }, []);

  React.useEffect(() => {
    Promise.allSettled([refreshMembers(), refreshLists(), refreshFields(), refreshPipelines()]).finally(() => setReady(true));
  }, [refreshMembers, refreshLists, refreshFields, refreshPipelines]);

  const value = React.useMemo(
    () => ({
      me,
      members,
      lists,
      listTotals,
      fields,
      pipelines,
      ready,
      refreshLists,
      refreshFields,
      refreshPipelines,
      refreshMembers,
      accessOpen,
      setAccessOpen,
    }),
    [me, members, lists, listTotals, fields, pipelines, ready, refreshLists, refreshFields, refreshPipelines, refreshMembers, accessOpen]
  );

  return (
    <CrmContext.Provider value={value}>
      <FeedbackProvider>{children}</FeedbackProvider>
    </CrmContext.Provider>
  );
}
