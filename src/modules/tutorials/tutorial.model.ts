import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const TUTORIAL_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
} as const;

export type TutorialStatus =
  (typeof TUTORIAL_STATUS)[keyof typeof TUTORIAL_STATUS];

export const TUTORIAL_LANGUAGES = {
  EN: 'en',
  KN: 'kn',
  TA: 'ta',
  TE: 'te',
  ML: 'ml',
  HI: 'hi',
} as const;

export type TutorialLanguage =
  (typeof TUTORIAL_LANGUAGES)[keyof typeof TUTORIAL_LANGUAGES];

export const TUTORIAL_LANGUAGE_VALUES = Object.values(
  TUTORIAL_LANGUAGES
) as TutorialLanguage[];

export const DEFAULT_TUTORIAL_VIDEO =
  'https://www.youtube.com/embed/dQw4w9WgXcQ';

export interface ITutorial {
  title: string;
  category: string;
  content: string;
  video: string;
  language: TutorialLanguage;
  sortOrder: number;
  status: TutorialStatus;
  createdBy: Types.ObjectId;
}

export interface ITutorialDocument extends ITutorial, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const tutorialSchema = new Schema<ITutorialDocument>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    category: { type: String, required: true, trim: true, maxlength: 120 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    video: { type: String, required: true, trim: true, maxlength: 500 },
    language: {
      type: String,
      enum: TUTORIAL_LANGUAGE_VALUES,
      required: true,
      default: TUTORIAL_LANGUAGES.EN,
      index: true,
    },
    sortOrder: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: Object.values(TUTORIAL_STATUS),
      required: true,
      default: TUTORIAL_STATUS.ACTIVE,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

tutorialSchema.index({ status: 1, language: 1, sortOrder: 1 });
tutorialSchema.index({ status: 1, category: 1, sortOrder: 1 });
tutorialSchema.index({ title: 'text', content: 'text', category: 'text' });

export const Tutorial: Model<ITutorialDocument> =
  mongoose.models.Tutorial ||
  mongoose.model<ITutorialDocument>('Tutorial', tutorialSchema);
