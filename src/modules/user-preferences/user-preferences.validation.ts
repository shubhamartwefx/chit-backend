import { z } from 'zod';
import {
  PREFERENCE_CURRENCIES,
  PREFERENCE_DATE_FORMATS,
  PREFERENCE_THEMES,
} from '../users/user.model';

const themeValues = Object.values(PREFERENCE_THEMES) as [string, ...string[]];
const currencyValues = Object.values(PREFERENCE_CURRENCIES) as [
  string,
  ...string[],
];
const dateFormatValues = Object.values(PREFERENCE_DATE_FORMATS) as [
  string,
  ...string[],
];

export const updatePreferencesSchema = z
  .object({
    theme: z.enum(themeValues).optional(),
    currency: z.enum(currencyValues).optional(),
    dateFormat: z.enum(dateFormatValues).optional(),
  })
  .refine(
    (val) =>
      val.theme !== undefined ||
      val.currency !== undefined ||
      val.dateFormat !== undefined,
    {
      message: 'Provide at least one of theme, currency, or dateFormat',
    }
  );

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
