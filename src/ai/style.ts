import type { AiStyle } from '../schemas/user-preferences-schema'

/** One extra instruction per AI style — appended to the report and review prompts. */
const STYLE_INSTRUCTIONS: Record<AiStyle, string> = {
  concise: 'Style: keep every bullet short and scannable — one line where possible.',
  detailed: 'Style: give fuller explanations, with a short reason behind each suggestion.',
  'safety-focused':
    'Style: prioritize safety and emergency preparedness — put safety-related items first and be explicit about what to verify.',
}

export function withStyle(instructions: string, style?: AiStyle): string {
  return style ? `${instructions} ${STYLE_INSTRUCTIONS[style]}` : instructions
}
