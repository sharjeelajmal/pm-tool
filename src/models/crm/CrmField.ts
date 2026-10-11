import { Schema, Document, model, models } from "mongoose";

export const CRM_FIELD_TYPES = [
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

// A custom column on the lead sheet. Empty listIds means it shows on every list.
export interface ICrmField extends Document {
  name: string;
  type: (typeof CRM_FIELD_TYPES)[number];
  options: string[];
  listIds: string[];
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const CrmFieldSchema = new Schema<ICrmField>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: CRM_FIELD_TYPES, default: "text" },
    options: { type: [String], default: [] },
    listIds: { type: [String], default: [] },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const CrmField = models.CrmField || model<ICrmField>("CrmField", CrmFieldSchema, "crm_fields");
