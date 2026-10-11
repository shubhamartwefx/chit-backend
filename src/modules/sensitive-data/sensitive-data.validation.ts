import { z } from 'zod';
import { REVEALABLE_FIELD_NAMES } from './revealable-fields';

export const revealSensitiveFieldSchema = z
  .object({
    field: z.enum(REVEALABLE_FIELD_NAMES),
  })
  .strict();

export type RevealSensitiveFieldInput = z.infer<
  typeof revealSensitiveFieldSchema
>;
