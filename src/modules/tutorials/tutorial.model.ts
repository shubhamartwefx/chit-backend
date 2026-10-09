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

export const TUTORIAL_LIMITS = {
  TITLE: 200,
  CATEGORY: 120,
  DESCRIPTION: 300,
  CONTENT: 20000,
  URL: 500,
} as const;

export interface ITutorial {
  title: string;
  category: string;
  description: string;
  /** Sanitized HTML (see common/html-sanitizer). */
  content: string;
  video: string;
  imageUrl: string;
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
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: TUTORIAL_LIMITS.TITLE,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: TUTORIAL_LIMITS.CATEGORY,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: TUTORIAL_LIMITS.DESCRIPTION,
    },
    content: {
      type: String,
      default: '',
      trim: true,
      maxlength: TUTORIAL_LIMITS.CONTENT,
    },
    video: { type: String, default: '', trim: true, maxlength: TUTORIAL_LIMITS.URL },
    imageUrl: {
      type: String,
      default: '',
      trim: true,
      maxlength: TUTORIAL_LIMITS.URL,
    },
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
