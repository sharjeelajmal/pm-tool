import mongoose, { Schema, Document, model, models } from "mongoose";

export interface IComment {
  id: string;
  username: string;
  text: string;
  type?: string;
  mediaData?: string;
  createdAt: Date;
  readBy?: string[];
  deliveredTo?: string[];
  isEdited?: boolean;
  isDeleted?: boolean;
  updatedAt?: Date;
}

export interface INote extends Document {
  title: string;
  content: string;
  tags: string[];
  patientId?: string;
  categoryId?: string;
  pin?: string;
  isPinned?: boolean;
  portal: string;
  assignedTo?: string[];
  createdBy?: string;
  isTrashed?: boolean;
  comments?: IComment[];
  status?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>({
  id: { type: String, required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  type: { type: String, default: "text" },
  mediaData: { type: String },
  createdAt: { type: Date, default: Date.now },
  readBy: { type: [String], default: [] },
  deliveredTo: { type: [String], default: [] },
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  updatedAt: { type: Date },
});

const NoteSchema = new Schema<INote>(
  {
    title: { type: String, default: "" },
    content: { type: String, default: "" },
    tags: { type: [String], default: [] },
    patientId: { type: String, default: "" },
    categoryId: { type: String, default: 'general' },
    pin: { type: String, default: "" },
    isPinned: { type: Boolean, default: false },
    portal: { type: String, enum: ['personal', 'business'], required: true },
    assignedTo: [{ type: String }],
    createdBy: { type: String },
    isTrashed: { type: Boolean, default: false },
    comments: { type: [CommentSchema], default: [] },
    status: { type: String, enum: ['Pending', 'In Review', 'Done'], default: 'Pending' },
  },
  { timestamps: true }
);

if (models.Note && (
  !models.Note.schema.paths.pin || 
  !models.Note.schema.paths.isPinned || 
  !models.Note.schema.paths.categoryId || 
  !models.Note.schema.paths.portal || 
  !models.Note.schema.paths.assignedTo || 
  !models.Note.schema.paths.createdBy || 
  !models.Note.schema.paths.isTrashed ||
  !models.Note.schema.paths.status ||
  !(models.Note.schema.path('comments') as any)?.schema?.paths?.readBy ||
  !(models.Note.schema.path('comments') as any)?.schema?.paths?.isEdited
)) {
  delete (models as any).Note;
}

export const Note = models.Note || model<INote>("Note", NoteSchema, "notes");
