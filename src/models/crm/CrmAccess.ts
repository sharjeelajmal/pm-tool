import { Schema, Document, model, models } from "mongoose";

// Which business users may open the Leads (CRM) module.
// The business admin always has access and is never stored here.
export interface ICrmAccess extends Document {
  username: string;
  scope: "all" | "assigned";
  grantedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CrmAccessSchema = new Schema<ICrmAccess>(
  {
    username: { type: String, required: true, unique: true },
    scope: { type: String, enum: ["all", "assigned"], default: "all" },
    grantedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const CrmAccess = models.CrmAccess || model<ICrmAccess>("CrmAccess", CrmAccessSchema, "crm_access");
