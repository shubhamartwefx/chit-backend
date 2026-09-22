import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export const CALENDAR_EVENT_OWNER_TYPES = {
  AGENT: 'agent',
  BRANCH: 'branch',
} as const;

export type CalendarEventOwnerType =
  (typeof CALENDAR_EVENT_OWNER_TYPES)[keyof typeof CALENDAR_EVENT_OWNER_TYPES];

export const CALENDAR_EVENT_STATUS = {
  ACTIVE: 'active',
  DELETED: 'deleted',
} as const;

export type CalendarEventStatus =
  (typeof CALENDAR_EVENT_STATUS)[keyof typeof CALENDAR_EVENT_STATUS];

export interface ICalendarEvent {
  ownerType: CalendarEventOwnerType;
  ownerId: Types.ObjectId;
  chitId: Types.ObjectId;
  title: string;
  start: Date;
  end: Date;
  color: string;
  status: CalendarEventStatus;
  createdBy: Types.ObjectId;
}

export interface ICalendarEventDocument extends ICalendarEvent, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const calendarEventSchema = new Schema<ICalendarEventDocument>(
  {
    ownerType: {
      type: String,
      enum: Object.values(CALENDAR_EVENT_OWNER_TYPES),
      required: true,
      index: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chitId: {
      type: Schema.Types.ObjectId,
      ref: 'Chit',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    color: {
      type: String,
      required: true,
      trim: true,
      maxlength: 7,
      default: '#60a5fa',
    },
    status: {
      type: String,
      enum: Object.values(CALENDAR_EVENT_STATUS),
      required: true,
      default: CALENDAR_EVENT_STATUS.ACTIVE,
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

calendarEventSchema.index({ ownerType: 1, ownerId: 1, status: 1, start: 1 });
calendarEventSchema.index({ chitId: 1, status: 1 });

export const CalendarEvent: Model<ICalendarEventDocument> =
  mongoose.models.CalendarEvent ||
  mongoose.model<ICalendarEventDocument>('CalendarEvent', calendarEventSchema);
