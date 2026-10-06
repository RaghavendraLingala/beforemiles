/**
 * Trip Readiness Report generation — one structured-output model call.
 *
 * Everything here is a planning suggestion from the model's general
 * knowledge. No live weather, traffic, or place data is fetched, and the
 * prompt tells the model not to pretend otherwise. The UI labels it the same way.
 *
 * Billing: no authToken is passed, so the DeepSpace proxy bills the app owner
 * (APP_OWNER_JWT). generateReport limits who can trigger it (owner/editor) and
 * how often (cooldown per trip).
 */

import { generateText, Output } from 'ai'
import { z } from 'zod/v4'
import { createDeepSpaceAI } from 'deepspace/worker'
import type { Env } from '../../worker'
import type { Trip } from '../schemas/trips-schema'
import { CHECKLIST_CATEGORIES } from '../schemas/checklist-items-schema'
import { STOP_CATEGORIES } from '../schemas/stop-suggestions-schema'
import { tripLengthDays } from '../lib/format'
import type { AiStyle } from '../schemas/user-preferences-schema'
import { withStyle } from './style'

export const READINESS_MODEL = 'claude-sonnet-5'

const bullets = (description: string) => z.array(z.string()).max(8).describe(description)

const readinessSchema = z.object({
  summary: z.string().describe('2-3 sentence overview of the trip and its main preparation priorities.'),
  weatherPrep: bullets(
    'Typical seasonal conditions for the route and date, phrased as expectations to check (e.g. "Coastal fog is common in November — check the forecast the day before"). Never state a specific forecast.',
  ),
  whatToCarry: bullets('Items to bring, tailored to travel mode, trip type, and travelers.'),
  clothing: bullets('Clothing and footwear suggestions.'),
  emergencyPreparedness: bullets(
    'What emergency resources to locate before leaving (nearest hospitals along the route, roadside assistance, the local emergency number). Do not invent phone numbers other than well-known national emergency numbers.',
  ),
  safetyNotes: bullets('Route- and mode-specific safety notes.'),
  checklist: z
    .array(z.object({ text: z.string(), category: z.enum(CHECKLIST_CATEGORIES) }))
    .min(6)
    .max(14)
    .describe('Concrete before-you-leave tasks, each one actionable and checkable.'),
  stops: z
    .array(
      z.object({
        category: z.enum(STOP_CATEGORIES),
        title: z.string().describe('A kind of stop, optionally near a well-known town on the route.'),
        reason: z.string().describe('Why this stop is useful for this trip.'),
      }),
    )
    .min(3)
    .max(8)
    .describe('Useful stop types along the route, prioritising the traveler preferences.'),
})

export type ReadinessResult = z.infer<typeof readinessSchema>

const INSTRUCTIONS = [
  'You are BeforeMiles, a travel-readiness planner. You prepare people BEFORE a trip; you are not a navigation app.',
  'You have no live data: no current weather, traffic, closures, or business hours. Base everything on general knowledge,',
  'and phrase anything time-sensitive as something to verify ("check", "confirm"). Never present a guess as a fact.',
  'Do not name specific businesses or claim a place is open. Be concise, specific to this trip, and practical.',
].join(' ')

function describeTrip(trip: Trip): string {
  return [
    `Trip: ${trip.name}`,
    `Route: ${[trip.startLocation, ...(trip.stops ?? []), trip.destination].join(' → ')}`,
    trip.endDate && trip.endDate !== trip.travelDate
      ? `Travel dates: ${trip.travelDate} to ${trip.endDate} (${tripLengthDays(trip.travelDate, trip.endDate)} days)`
      : `Travel date: ${trip.travelDate} (day trip or one-way)`,
    `Trip type: ${trip.tripType}`,
    `Travel mode: ${trip.travelMode}`,
    `Travelers: ${trip.travelers}`,
    `Preferences: ${trip.preferences?.length ? trip.preferences.join(', ') : 'none given'}`,
  ].join('\n')
}

export async function generateReadiness(env: Env, trip: Trip, style?: AiStyle): Promise<ReadinessResult> {
  const anthropic = createDeepSpaceAI(env, 'anthropic')
  const { output } = await generateText({
    model: anthropic(READINESS_MODEL),
    instructions: withStyle(INSTRUCTIONS, style),
    prompt: `Create a Trip Readiness Report for this trip.\n\n${describeTrip(trip)}`,
    output: Output.object({ schema: readinessSchema, name: 'trip_readiness_report' }),
    maxOutputTokens: 4000,
  })
  return output
}
