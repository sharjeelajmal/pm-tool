import { Schema, Document, model, models } from "mongoose";

// "won"/"lost" stages flip the opportunity status automatically when a card lands in them.
export interface ICrmStage {
  id: string;
  name: string;
  color: string;
  kind: "open" | "won" | "lost";
}

export interface ICrmPipeline extends Document {
  name: string;
  stages: ICrmStage[];
  order: number;
  seedKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StageSchema = new Schema<ICrmStage>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    color: { type: String, default: "slate" },
    kind: { type: String, enum: ["open", "won", "lost"], default: "open" },
  },
  { _id: false }
);

const CrmPipelineSchema = new Schema<ICrmPipeline>(
  {
    name: { type: String, required: true },
    stages: { type: [StageSchema], default: [] },
    order: { type: Number, default: 0 },
    // Set only on the auto-created default pipeline; the unique index stops duplicate seeds.
    seedKey: { type: String, unique: true, sparse: true },
  },
  { timestamps: true }
);

export const CrmPipeline = models.CrmPipeline || model<ICrmPipeline>("CrmPipeline", CrmPipelineSchema, "crm_pipelines");
