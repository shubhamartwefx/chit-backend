import { z } from 'zod';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

export const createTutorialSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(120),
  content: z.string().trim().max(5000).optional(),
  video: z.string().trim().max(500).optional(),
  sortOrder: z.coerce.number().int().optional().default(0),
});

export type CreateTutorialInput = z.infer<typeof createTutorialSchema>;

export const updateTutorialSchema = createTutorialSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field is required' }
);

export type UpdateTutorialInput = z.infer<typeof updateTutorialSchema>;

export const listTutorialsQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export type ListTutorialsQueryInput = z.infer<typeof listTutorialsQuerySchema>;

export const tutorialIdParamsSchema = z.object({
  id: objectIdSchema,
});
