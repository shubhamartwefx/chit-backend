import { unauthorized } from '../../common/errors';
import {
  DEFAULT_USER_PREFERENCES,
  IUserPreferences,
  PreferenceCurrency,
  PreferenceDateFormat,
  PreferenceTheme,
  User,
} from '../users/user.model';
import type { UpdatePreferencesInput } from './user-preferences.validation';

export type PreferencesDto = IUserPreferences;

function normalizePreferences(
  prefs?: Partial<IUserPreferences> | null
): PreferencesDto {
  return {
    theme: (prefs?.theme as PreferenceTheme) ?? DEFAULT_USER_PREFERENCES.theme,
    currency:
      (prefs?.currency as PreferenceCurrency) ??
      DEFAULT_USER_PREFERENCES.currency,
    dateFormat:
      (prefs?.dateFormat as PreferenceDateFormat) ??
      DEFAULT_USER_PREFERENCES.dateFormat,
  };
}

export class UserPreferencesService {
  async getPreferences(userId: string): Promise<PreferencesDto> {
    const user = await User.findById(userId).select('preferences').lean();
    if (!user) {
      throw unauthorized('User not found');
    }
    return normalizePreferences(user.preferences);
  }

  async updatePreferences(
    userId: string,
    input: UpdatePreferencesInput
  ): Promise<PreferencesDto> {
    const user = await User.findById(userId).select('preferences');
    if (!user) {
      throw unauthorized('User not found');
    }

    const current = normalizePreferences(user.preferences);
    const next: PreferencesDto = {
      theme: (input.theme as PreferenceTheme | undefined) ?? current.theme,
      currency:
        (input.currency as PreferenceCurrency | undefined) ?? current.currency,
      dateFormat:
        (input.dateFormat as PreferenceDateFormat | undefined) ??
        current.dateFormat,
    };

    user.preferences = next;
    await user.save();
    return next;
  }
}

export const userPreferencesService = new UserPreferencesService();
export { normalizePreferences };
