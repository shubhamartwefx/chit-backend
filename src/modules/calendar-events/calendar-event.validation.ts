import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex value like #60a5fa');

export const createCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    chitId: objectIdSchema,
    start: z.coerce.date(),
    end: z.coerce.date(),
    color: hexColorSchema.optional().default('#60a5fa'),
  })
  .refine((data) => data.end.getTime() > data.start.getTime(), {
    message: 'end must be after start',
    path: ['end'],
  });

export type CreateCalendarEventInput = z.infer<typeof createCalendarEventSchema>;

export const updateCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    chitId: objectIdSchema.optional(),
    start: z.coerce.date().optional(),
    end: z.coerce.date().optional(),
    color: hexColorSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  })
  .superRefine((data, ctx) => {
    if (data.start && data.end && data.end.getTime() <= data.start.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'end must be after start',
        path: ['end'],
      });
    }
  });

export type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventSchema>;

export const listCalendarEventsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type ListCalendarEventsQueryInput = z.infer<
  typeof listCalendarEventsQuerySchema
>;

export const calendarEventIdParamsSchema = z.object({
  id: objectIdSchema,
});
