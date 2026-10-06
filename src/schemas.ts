/**
 * Collection Schemas
 *
 * All collections with columns and RBAC permissions.
 * Single source of truth — imported by both worker and frontend.
 *
 * Add schemas by creating a file in src/schemas/ and importing it here.
 */

import type { CollectionSchema } from 'deepspace/schema'
import { usersSchema } from './schemas/users-schema'
import { settingsSchema } from './schemas/admin-schema'
import { tripsSchema } from './schemas/trips-schema'
import { teamMembersSchema } from './schemas/team-members-schema'
import { reportsSchema } from './schemas/reports-schema'
import { checklistItemsSchema } from './schemas/checklist-items-schema'
import { stopSuggestionsSchema } from './schemas/stop-suggestions-schema'
import { tripDocumentsSchema } from './schemas/trip-documents-schema'
import { readinessReviewsSchema } from './schemas/readiness-reviews-schema'
import { itineraryItemsSchema } from './schemas/itinerary-items-schema'
import { userPreferencesSchema } from './schemas/user-preferences-schema'

export const schemas: CollectionSchema[] = [
  usersSchema,
  settingsSchema,
  tripsSchema,
  teamMembersSchema,
  reportsSchema,
  checklistItemsSchema,
  stopSuggestionsSchema,
  tripDocumentsSchema,
  readinessReviewsSchema,
  itineraryItemsSchema,
  userPreferencesSchema,
]
