import { Schema, Document, model, models } from "mongoose";

export const CRM_APPOINTMENT_STATUSES = ["booked", "confirmed", "showed", "noshow", "cancelled"] as const;

export interface ICrmAppointment extends Document {
  title: string;
  contactId: string;
  start: Date;
  end: Date;
  status: (typeof CRM_APPOINTMENT_STATUSES)[number];
  assignedTo: string;
  location: string;
  notes: string;
  createdBy: string;
  googleEventId: string;
  googleOwner: string;
  createdAt: Date;
  updatedAt: Date;
}

const CrmAppointmentSchema = new Schema<ICrmAppointment>(
  {
    title: { type: String, default: "" },
    contactId: { type: String, default: "" },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: { type: String, enum: CRM_APPOINTMENT_STATUSES, default: "booked" },
    assignedTo: { type: String, default: "" },
    location: { type: String, default: "" },
    notes: { type: String, default: "" },
    createdBy: { type: String, default: "" },
    googleEventId: { type: String, default: "" },
    googleOwner: { type: String, default: "" },
  },
  { timestamps: true }
);

CrmAppointmentSchema.index({ start: 1 });
CrmAppointmentSchema.index({ contactId: 1 });

export const CrmAppointment =
  models.CrmAppointment || model<ICrmAppointment>("CrmAppointment", CrmAppointmentSchema, "crm_appointments");
