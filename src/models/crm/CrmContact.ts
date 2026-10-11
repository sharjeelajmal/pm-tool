import { Schema, Document, model, models } from "mongoose";

export const CRM_LEAD_STATUSES = [
  "new",
  "active",
  "contacted",
  "interested",
  "not_interested",
  "converted",
  "dnd",
] as const;

export interface ICrmNote {
  id: string;
  body: string;
  createdBy: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface ICrmTask {
  id: string;
  title: string;
  description: string;
  dueDate?: Date | null;
  assignedTo: string;
  completed: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface ICrmActivity {
  id: string;
  type: string;
  text: string;
  by: string;
  at: Date;
}

export interface ICrmContact extends Document {
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
  status: (typeof CRM_LEAD_STATUSES)[number];
  assignedTo: string;
  createdBy: string;
  customFields: Record<string, unknown>;
  notes: ICrmNote[];
  tasks: ICrmTask[];
  activity: ICrmActivity[];
  lastActivityAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<ICrmNote>(
  {
    id: { type: String, required: true },
    body: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date },
  },
  { _id: false }
);

const TaskSchema = new Schema<ICrmTask>(
  {
    id: { type: String, required: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    dueDate: { type: Date, default: null },
    assignedTo: { type: String, default: "" },
    completed: { type: Boolean, default: false },
    createdBy: { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ActivitySchema = new Schema<ICrmActivity>(
  {
    id: { type: String, required: true },
    type: { type: String, default: "update" },
    text: { type: String, default: "" },
    by: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const CrmContactSchema = new Schema<ICrmContact>(
  {
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    businessName: { type: String, default: "" },
    email: { type: String, default: "" },
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    country: { type: String, default: "" },
    source: { type: String, default: "" },
    tags: { type: [String], default: [] },
    listId: { type: String, default: "" },
    status: { type: String, enum: CRM_LEAD_STATUSES, default: "new" },
    assignedTo: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    customFields: { type: Schema.Types.Mixed, default: {} },
    notes: { type: [NoteSchema], default: [] },
    tasks: { type: [TaskSchema], default: [] },
    activity: { type: [ActivitySchema], default: [] },
    lastActivityAt: { type: Date },
  },
  { timestamps: true, minimize: false }
);

CrmContactSchema.index({ listId: 1, createdAt: -1 });
CrmContactSchema.index({ assignedTo: 1 });
CrmContactSchema.index({ email: 1 });
CrmContactSchema.index({ phone: 1 });

export const CrmContact = models.CrmContact || model<ICrmContact>("CrmContact", CrmContactSchema, "crm_contacts");
