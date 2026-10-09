import { z } from 'zod';
import { TUTORIAL_LANGUAGE_VALUES, TUTORIAL_LIMITS } from './tutorial.model';

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, 'Must be a valid MongoDB ObjectId');

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/** Empty clears the value; otherwise only http(s) URLs (blocks javascript:/data: in iframe/img src). */
const optionalHttpUrlSchema = z
  .string()
  .trim()
  .max(TUTORIAL_LIMITS.URL)
  .refine((value) => value === '' || isHttpUrl(value), {
    message: 'Must be a valid http(s) URL',
  });

const tutorialFields = {
  title: z.string().trim().min(1).max(TUTORIAL_LIMITS.TITLE),
  category: z.string().trim().min(1).max(TUTORIAL_LIMITS.CATEGORY),
  description: z.string().trim().max(TUTORIAL_LIMITS.DESCRIPTION).optional(),
  content: z.string().trim().max(TUTORIAL_LIMITS.CONTENT).optional(),
  video: optionalHttpUrlSchema.optional(),
  imageUrl: optionalHttpUrlSchema.optional(),
  language: z.enum(TUTORIAL_LANGUAGE_VALUES as [string, ...string[]]),
  sortOrder: z.coerce.number().int(),
};

export const createTutorialSchema = z
  .object({
    ...tutorialFields,
    language: tutorialFields.language.optional().default('en'),
    sortOrder: tutorialFields.sortOrder.optional().default(0),
  })
  .strict();

export type CreateTutorialInput = z.infer<typeof createTutorialSchema>;

export const updateTutorialSchema = z
  .object(tutorialFields)
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateTutorialInput = z.infer<typeof updateTutorialSchema>;

export const listTutorialsQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(120).optional(),
  language: z.enum(TUTORIAL_LANGUAGE_VALUES as [string, ...string[]]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export type ListTutorialsQueryInput = z.infer<typeof listTutorialsQuerySchema>;

export const tutorialIdParamsSchema = z.object({
  id: objectIdSchema,
});
