/**
 * New-trip templates — client-side shortcuts that prefill the form's trip
 * style. They never touch the route (start, destination, stops are specific
 * to each trip) and every field stays editable; the server validates the
 * submitted values exactly as it does for a hand-filled form.
 */

import type { TRIP_PREFERENCES, TravelMode, TripType } from '../schemas/trips-schema'

type Preference = (typeof TRIP_PREFERENCES)[number]

export type TripTemplate = {
  id: string
  label: string
  tripType: TripType
  travelMode: TravelMode
  preferences: Preference[]
}

export const TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: 'road-trip',
    label: 'Road trip',
    tripType: 'leisure',
    travelMode: 'car',
    preferences: ['fuel/EV charging', 'restrooms', 'emergency centers'],
  },
  {
    id: 'hiking',
    label: 'Hiking trip',
    tripType: 'adventure',
    travelMode: 'walking',
    preferences: ['hiking/walking', 'emergency centers', 'restrooms'],
  },
  {
    id: 'family',
    label: 'Family trip',
    tripType: 'family',
    travelMode: 'car',
    preferences: ['family-friendly', 'restrooms', 'emergency centers'],
  },
  {
    id: 'city',
    label: 'City visit',
    tripType: 'leisure',
    travelMode: 'train',
    preferences: ['hiking/walking', 'restrooms', 'budget-friendly'],
  },
  {
    id: 'business',
    label: 'Business trip',
    tripType: 'business',
    travelMode: 'flight',
    preferences: ['restrooms'],
  },
  {
    id: 'airport',
    label: 'Airport travel',
    tripType: 'other',
    travelMode: 'flight',
    preferences: ['restrooms', 'family-friendly'],
  },
]

export const DEFAULT_TRIP_STYLE = {
  tripType: 'leisure' as TripType,
  travelMode: 'car' as TravelMode,
  preferences: [] as string[],
}
