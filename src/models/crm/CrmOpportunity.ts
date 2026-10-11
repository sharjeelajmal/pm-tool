import { Schema, Document, model, models } from "mongoose";

export const CRM_OPPORTUNITY_STATUSES = ["open", "won", "lost", "abandoned"] as const;

export interface ICrmOpportunity extends Document {
  name: string;
  pipelineId: string;
  stageId: string;
  status: (typeof CRM_OPPORTUNITY_STATUSES)[number];
  value: number;
  contactId: string;
  source: string;
  assignedTo: string;
  tags: string[];
  lostReason: string;
  order: number;
  createdBy: string;
  stageChangedAt?: Date;
  statusChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CrmOpportunitySchema = new Schema<ICrmOpportunity>(
  {
    name: { type: String, required: true },
    pipelineId: { type: String, required: true },
    stageId: { type: String, required: true },
    status: { type: String, enum: CRM_OPPORTUNITY_STATUSES, default: "open" },
    value: { type: Number, default: 0 },
    contactId: { type: String, default: "" },
    source: { type: String, default: "" },
    assignedTo: { type: String, default: "" },
    tags: { type: [String], default: [] },
    lostReason: { type: String, default: "" },
    order: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
    stageChangedAt: { type: Date },
    statusChangedAt: { type: Date },
  },
  { timestamps: true }
);

CrmOpportunitySchema.index({ pipelineId: 1, stageId: 1, order: 1 });
CrmOpportunitySchema.index({ contactId: 1 });

export const CrmOpportunity =
  models.CrmOpportunity || model<ICrmOpportunity>("CrmOpportunity", CrmOpportunitySchema, "crm_opportunities");
