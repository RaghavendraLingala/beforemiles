/**
 * "What am I missing?" — one structured-output model call that reviews the
 * trip's *current state* (details, report, checklist progress, saved stops,
 * documents, score) and names the 3–5 most useful gaps.
 *
 * Like the readiness report, it uses only general knowledge: no live data is
 * fetched, and the prompt forbids presenting guesses as facts or inventing
 * businesses, phone numbers, or specific emergency resources. Owner-billed
 * via the DeepSpace AI proxy; generateReadinessReview gates who and how often.
 */

import { generateText, Output } from 'ai'
import { z } from 'zod/v4'
import { createDeepSpaceAI } from 'deepspace/worker'
import type { Env } from '../../worker'
import { CHECKLIST_CATEGORIES } from '../schemas/checklist-items-schema'
import { REVIEW_PRIORITIES, type ReviewSuggestion } from '../schemas/readiness-reviews-schema'
import { READINESS_MODEL } from './readiness'
import { describeTripState, type TripState } from '../lib/trip-state'
import type { AiStyle } from '../schemas/user-preferences-schema'
import { withStyle } from './style'

export const REVIEW_MODEL = READINESS_MODEL

const reviewSchema = z.object({
  suggestions: z
    .array(
      z.object({
        priority: z.enum(REVIEW_PRIORITIES).describe('high = do before leaving; low = nice to have'),
        title: z.string().describe('The gap, in at most 8 words.'),
        reason: z.string().describe('Why it matters for THIS trip, pointing at the trip state given.'),
        action: z.string().describe('A concrete, cautiously worded next step.'),
        checklistItem: z.string().describe('The same step as a short imperative checklist task, max 80 characters.'),
        category: z.enum(CHECKLIST_CATEGORIES),
      }),
    )
    .min(3)
    .max(5),
})

const INSTRUCTIONS = [
  'You are BeforeMiles, a travel-readiness reviewer. Given the current state of a trip plan, name the most useful',
  'preparation gaps: things not yet covered, or important items still unchecked as the date approaches.',
  'Do not repeat items that are already checked off or already on the checklist unless one is urgent and unchecked.',
  'You have no live data: never state current weather, traffic, closures, or opening hours — say what to check instead.',
  'Never invent business names, phone numbers, addresses, or specific emergency facilities; describe the kind of',
  'resource to look up. Use cautious wording ("consider", "confirm", "check"). Be specific to this trip and concise.',
].join(' ')

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

export async function reviewTripReadiness(env: Env, state: TripState, style?: AiStyle): Promise<ReviewSuggestion[]> {
  const anthropic = createDeepSpaceAI(env, 'anthropic')
  const { output } = await generateText({
    model: anthropic(REVIEW_MODEL),
    instructions: withStyle(INSTRUCTIONS, style),
    prompt: `Review this trip plan and list 3-5 missing preparation steps, most important first.\n\n${describeTripState(state)}`,
    output: Output.object({ schema: reviewSchema, name: 'readiness_review' }),
    maxOutputTokens: 2000,
  })
  return [...output.suggestions]
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])
    .map((s) => ({ ...s, checklistItem: s.checklistItem.slice(0, 120) }))
}
