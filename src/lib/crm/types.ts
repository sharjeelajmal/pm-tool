// Shared (client + server) CRM types and constants. No server-only imports here.

export const LEAD_STATUSES = [
  "new",
  "active",
  "contacted",
  "interested",
  "not_interested",
  "converted",
  "dnd",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  active: "Active",
  contacted: "Contacted",
  interested: "Interested",
  not_interested: "Not Interested",
  converted: "Converted",
  dnd: "Do Not Contact",
};

export const OPPORTUNITY_STATUSES = ["open", "won", "lost", "abandoned"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const OPPORTUNITY_STATUS_LABELS: Record<OpportunityStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
  abandoned: "Abandoned",
};

export const LOST_REASONS = [
  "Price too high",
  "Went with a competitor",
  "No response",
  "Not a good fit",
  "Bad timing",
  "No budget",
  "Other",
];

export const APPOINTMENT_STATUSES =["booked", "confirmed", "showed", "noshow", "cancelled"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  booked: "Booked",
  confirmed: "Confirmed",
  showed: "Showed",
  noshow: "No Show",
  cancelled: "Cancelled",
};

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "monetary",
  "date",
  "dropdown",
  "checkbox",
  "phone",
  "email",
  "url",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Single line",
  textarea: "Multi line",
  number: "Number",
  monetary: "Monetary",
  date: "Date",
  dropdown: "Dropdown",
  checkbox: "Checkbox",
  phone: "Phone",
  email: "Email",
  url: "Website / URL",
};

// Built-in contact columns, in sheet order.
export const STANDARD_FIELDS = [
  { key: "firstName", label: "First Name" },
  { key: "lastName", label: "Last Name" },
  { key: "businessName", label: "Business Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "postalCode", label: "Postal Code" },
  { key: "country", label: "Country" },
  { key: "source", label: "Source" },
] as const;
export type StandardFieldKey = (typeof STANDARD_FIELDS)[number]["key"];

export const LEAD_SOURCES = [
  "Google Maps",
  "Facebook",
  "Instagram",
  "LinkedIn",
  "Website",
  "Referral",
  "Cold Call",
  "Email Campaign",
  "Walk-in",
  "Other",
];

export type CrmScope = "all" | "assigned";

export interface CrmMe {
  username: string;
  isAdmin: boolean;
  scope: CrmScope;
}

export interface CrmMember {
  username: string;
  isAdmin: boolean;
}

export interface CrmAccessUser {
  id: string;
  username: string;
  hasAccess: boolean;
  scope: CrmScope;
}

export interface CrmListDTO {
  id: string;
  name: string;
  color: string;
  description: string;
  order: number;
  count: number;
}

export interface CrmFieldDTO {
  id: string;
  name: string;
  type: FieldType;
  options: string[];
  listIds: string[];
  order: number;
}

export interface CrmNoteDTO {
  id: string;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CrmTaskDTO {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  assignedTo: string;
  completed: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CrmActivityDTO {
  id: string;
  type: string;
  text: string;
  by: string;
  at: string;
}

export interface CrmContactDTO {
  id: string;
  firstName: string;
  lastName: string;
  businessName: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  source: string;
  tags: string[];
  listId: string;
  status: LeadStatus;
  assignedTo: string;
  createdBy: string;
  customFields: Record<string, unknown>;
  notesCount: number;
  tasksCount: number;
  openTasksCount: number;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContactDetailDTO extends CrmContactDTO {
  notes: CrmNoteDTO[];
  tasks: CrmTaskDTO[];
  activity: CrmActivityDTO[];
  opportunities: CrmOpportunityDTO[];
  appointments: CrmAppointmentDTO[];
}

export type CrmContactInput = Partial<
  Pick<
    CrmContactDTO,
    | StandardFieldKey
    | "tags"
    | "listId"
    | "status"
    | "assignedTo"
    | "customFields"
  >
>;

export interface CrmStageDTO {
  id: string;
  name: string;
  color: string;
  kind: "open" | "won" | "lost";
}

export interface CrmPipelineDTO {
  id: string;
  name: string;
  stages: CrmStageDTO[];
  order: number;
}

// Compact contact info embedded in cards / appointments.
export interface CrmContactSummary {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  address: string;
  notesCount: number;
  tasksCount: number;
  appointmentsCount: number;
}

export interface CrmOpportunityDTO {
  id: string;
  name: string;
  pipelineId: string;
  stageId: string;
  status: OpportunityStatus;
  value: number;
  contactId: string;
  source: string;
  assignedTo: string;
  tags: string[];
  lostReason: string;
  order: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  stageChangedAt: string | null;
  contact: CrmContactSummary | null;
}

export interface CrmAppointmentDTO {
  id: string;
  title: string;
  contactId: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  assignedTo: string;
  location: string;
  notes: string;
  createdBy: string;
  googleEventId: string;
  contact: CrmContactSummary | null;
}

export interface GoogleBusyEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
}

export interface CrmGoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string;
  syncEnabled: boolean;
}

export interface CrmDashboardDTO {
  range: { from: string | null; to: string | null };
  totals: {
    leads: number;
    leadsInRange: number;
    leadsPrevRange: number;
    openOpportunities: number;
    openValue: number;
    wonCount: number;
    wonValue: number;
    lostCount: number;
    conversionRate: number;
    upcomingAppointments: number;
    openTasks: number;
    overdueTasks: number;
  };
  byList: { id: string; name: string; color: string; count: number }[];
  byStatus: { status: LeadStatus; count: number }[];
  bySource: { source: string; count: number }[];
  leadsOverTime: { date: string; count: number }[];
  pipeline: {
    id: string;
    name: string;
    stages: { id: string; name: string; color: string; count: number; value: number }[];
  } | null;
  upcoming: CrmAppointmentDTO[];
  tasks: (CrmTaskDTO & { contactId: string; contactName: string })[];
  recentLeads: CrmContactDTO[];
}

export function contactDisplayName(c: {
  firstName?: string;
  lastName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
}) {
  const full = `${c.firstName || ""} ${c.lastName || ""}`.trim();
  return full || c.businessName || c.email || c.phone || "Unnamed lead";
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatMoney(value: number, compact = false) {
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}
