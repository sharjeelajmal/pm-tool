import { Schema, Document, model, models } from "mongoose";

// A lead list / category, e.g. "Pakistani Leads", "USA Magician Leads".
export interface ICrmList extends Document {
  name: string;
  color: string;
  description: string;
  order: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CrmListSchema = new Schema<ICrmList>(
  {
    name: { type: String, required: true },
    color: { type: String, default: "blue" },
    description: { type: String, default: "" },
    order: { type: Number, default: 0 },
    createdBy: { type: String, default: "" },
  },
  { timestamps: true }
);

export const CrmList = models.CrmList || model<ICrmList>("CrmList", CrmListSchema, "crm_lists");
