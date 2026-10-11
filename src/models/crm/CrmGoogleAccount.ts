import { Schema, Document, model, models } from "mongoose";

// One Google Calendar connection per CRM user (GoHighLevel-style per-user sync).
export interface ICrmGoogleAccount extends Document {
  username: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  calendarId: string;
  syncEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CrmGoogleAccountSchema = new Schema<ICrmGoogleAccount>(
  {
    username: { type: String, required: true, unique: true },
    email: { type: String, default: "" },
    accessToken: { type: String, default: "" },
    refreshToken: { type: String, default: "" },
    expiresAt: { type: Date, default: () => new Date(0) },
    calendarId: { type: String, default: "primary" },
    syncEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const CrmGoogleAccount =
  models.CrmGoogleAccount || model<ICrmGoogleAccount>("CrmGoogleAccount", CrmGoogleAccountSchema, "crm_google_accounts");
