// Browser-side API client for the Leads (CRM) module. Every call throws on failure.
import type {
  CrmAccessUser,
  CrmAppointmentDTO,
  CrmContactDTO,
  CrmContactDetailDTO,
  CrmContactInput,
  CrmDashboardDTO,
  CrmFieldDTO,
  CrmGoogleStatus,
  CrmListDTO,
  CrmMe,
  CrmMember,
  CrmNoteDTO,
  CrmOpportunityDTO,
  CrmPipelineDTO,
  CrmScope,
  CrmStageDTO,
  CrmTaskDTO,
  GoogleBusyEvent,
  LeadStatus,
} from "@/lib/crm/types";

type Json = Record<string, unknown>;

async function call<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({ success: false, error: `Request failed (${res.status})` }));
  if (!data.success) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

function qs(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export interface ContactQueryParams {
  list?: string;
  q?: string;
  status?: string;
  assignedTo?: string;
  tag?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export type ContactQueryResult = {
  contacts: CrmContactDTO[];
  total: number;
  page: number;
  limit: number;
  statusCounts: Record<LeadStatus, number>;
};

export const crmApi = {
  me: () => call<{ me: CrmMe; members: CrmMember[] }>("/api/crm/me"),

  access: {
    list: () => call<{ users: CrmAccessUser[] }>("/api/crm/access"),
    set: (username: string, hasAccess: boolean, scope: CrmScope) =>
      call<Json>("/api/crm/access", "PUT", { username, hasAccess, scope }),
  },

  lists: {
    list: () => call<{ lists: CrmListDTO[]; totalCount: number; unlistedCount: number }>("/api/crm/lists"),
    create: (data: { name: string; color?: string; description?: string }) =>
      call<{ list: CrmListDTO }>("/api/crm/lists", "POST", data),
    update: (id: string, data: { name?: string; color?: string; description?: string }) =>
      call<{ list: CrmListDTO }>(`/api/crm/lists/${id}`, "PUT", data),
    remove: (id: string) => call<Json>(`/api/crm/lists/${id}`, "DELETE"),
  },

  fields: {
    list: () => call<{ fields: CrmFieldDTO[] }>("/api/crm/fields"),
    create: (data: Omit<CrmFieldDTO, "id" | "order">) => call<{ field: CrmFieldDTO }>("/api/crm/fields", "POST", data),
    update: (id: string, data: Partial<Omit<CrmFieldDTO, "id" | "order" | "type">>) =>
      call<{ field: CrmFieldDTO }>(`/api/crm/fields/${id}`, "PUT", data),
    remove: (id: string) => call<Json>(`/api/crm/fields/${id}`, "DELETE"),
  },

  contacts: {
    query: (params: ContactQueryParams) =>
      call<ContactQueryResult>(`/api/crm/contacts${qs(params as Record<string, string>)}`),
    exportUrl: (params: ContactQueryParams) => `/api/crm/contacts/export${qs(params as Record<string, string>)}`,
    get: (id: string) => call<{ contact: CrmContactDetailDTO }>(`/api/crm/contacts/${id}`),
    create: (data: CrmContactInput) => call<{ contact: CrmContactDTO }>("/api/crm/contacts", "POST", data),
    update: (id: string, data: CrmContactInput) => call<{ contact: CrmContactDTO }>(`/api/crm/contacts/${id}`, "PUT", data),
    remove: (id: string) => call<Json>(`/api/crm/contacts/${id}`, "DELETE"),
    bulk: (ids: string[], action: string, value?: string) =>
      call<{ affected: number }>("/api/crm/contacts/bulk", "POST", { ids, action, value }),
    import: (data: {
      rows: Record<string, unknown>[];
      listId?: string;
      duplicateMode: "skip" | "update" | "create";
      status?: LeadStatus;
      assignedTo?: string;
      tags?: string[];
    }) => call<{ created: number; updated: number; skipped: number; invalid: number }>("/api/crm/contacts/import", "POST", data),
  },

  notes: {
    add: (contactId: string, body: string) => call<{ note: CrmNoteDTO }>(`/api/crm/contacts/${contactId}/notes`, "POST", { body }),
    update: (contactId: string, noteId: string, body: string) =>
      call<{ note: CrmNoteDTO }>(`/api/crm/contacts/${contactId}/notes/${noteId}`, "PUT", { body }),
    remove: (contactId: string, noteId: string) => call<Json>(`/api/crm/contacts/${contactId}/notes/${noteId}`, "DELETE"),
  },

  tasks: {
    add: (contactId: string, data: { title: string; description?: string; dueDate?: string | null; assignedTo?: string }) =>
      call<{ task: CrmTaskDTO }>(`/api/crm/contacts/${contactId}/tasks`, "POST", data),
    update: (contactId: string, taskId: string, data: Partial<Omit<CrmTaskDTO, "id" | "createdAt" | "createdBy">>) =>
      call<{ task: CrmTaskDTO }>(`/api/crm/contacts/${contactId}/tasks/${taskId}`, "PUT", data),
    remove: (contactId: string, taskId: string) => call<Json>(`/api/crm/contacts/${contactId}/tasks/${taskId}`, "DELETE"),
  },

  pipelines: {
    list: () => call<{ pipelines: CrmPipelineDTO[] }>("/api/crm/pipelines"),
    create: (data: { name: string; stages: Omit<CrmStageDTO, "id">[] }) =>
      call<{ pipeline: CrmPipelineDTO }>("/api/crm/pipelines", "POST", data),
    update: (id: string, data: { name: string; stages: (Omit<CrmStageDTO, "id"> & { id?: string })[]; moveTo?: Record<string, string> }) =>
      call<{ pipeline: CrmPipelineDTO }>(`/api/crm/pipelines/${id}`, "PUT", data),
    remove: (id: string) => call<Json>(`/api/crm/pipelines/${id}`, "DELETE"),
  },

  opportunities: {
    list: (params: { pipelineId?: string; q?: string; status?: string; assignedTo?: string; contactId?: string }) =>
      call<{ opportunities: CrmOpportunityDTO[] }>(`/api/crm/opportunities${qs(params)}`),
    create: (data: Partial<CrmOpportunityDTO> & { pipelineId: string; stageId: string; contactId: string }) =>
      call<{ opportunity: CrmOpportunityDTO }>("/api/crm/opportunities", "POST", data),
    update: (id: string, data: Partial<CrmOpportunityDTO> & { orderedIds?: string[] }) =>
      call<{ opportunity: CrmOpportunityDTO }>(`/api/crm/opportunities/${id}`, "PUT", data),
    remove: (id: string) => call<Json>(`/api/crm/opportunities/${id}`, "DELETE"),
    bulk: (ids: string[], action: "delete" | "status" | "assign", value?: string) =>
      call<{ affected: number }>("/api/crm/opportunities/bulk", "POST", { ids, action, value }),
  },

  appointments: {
    list: (params: { from?: string; to?: string; users?: string; contactId?: string }) =>
      call<{ appointments: CrmAppointmentDTO[] }>(`/api/crm/appointments${qs(params)}`),
    create: (data: Partial<CrmAppointmentDTO> & { start: string; end: string }) =>
      call<{ appointment: CrmAppointmentDTO; warning?: string }>("/api/crm/appointments", "POST", data),
    update: (id: string, data: Partial<CrmAppointmentDTO>) =>
      call<{ appointment: CrmAppointmentDTO; warning?: string }>(`/api/crm/appointments/${id}`, "PUT", data),
    remove: (id: string) => call<Json>(`/api/crm/appointments/${id}`, "DELETE"),
  },

  google: {
    status: () => call<{ google: CrmGoogleStatus }>("/api/crm/google/status"),
    setSync: (enabled: boolean) => call<{ google: CrmGoogleStatus }>("/api/crm/google/sync", "PUT", { enabled }),
    disconnect: () => call<Json>("/api/crm/google/disconnect", "POST"),
    busy: (from: string, to: string) => call<{ events: GoogleBusyEvent[] }>(`/api/crm/google/busy${qs({ from, to })}`),
    connectUrl: "/api/crm/google/connect",
  },

  dashboard: (params: { from?: string; to?: string; pipelineId?: string; tz?: string }) =>
    call<{ dashboard: CrmDashboardDTO }>(`/api/crm/dashboard${qs(params)}`),
};
