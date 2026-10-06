import { useQuery } from 'deepspace'
import {
  DEFAULT_USER_PREFERENCES,
  type UserPreferences,
} from '../schemas/user-preferences-schema'

/**
 * The signed-in user's saved preferences, falling back to app defaults. The
 * RecordRoom only returns the caller's own row (read: 'own').
 */
export function useUserPreferences() {
  const { records, status } = useQuery<UserPreferences>('user_preferences')
  const saved = records[0]?.data
  return {
    loading: status === 'loading',
    saved: !!saved,
    prefs: { ...DEFAULT_USER_PREFERENCES, ...(saved ?? {}) },
  }
}
