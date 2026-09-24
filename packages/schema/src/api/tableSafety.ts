import { z } from '../zod.js'

export const tableSafetyPracticeDtoSchema = z.enum([
  'SESSION_ZERO',
  'LINES_AND_VEILS',
  'X_CARD',
  'OPEN_DOOR',
  'SCRIPT_CHANGE',
  'OTHER'
])

export type TableSafetyPracticeDto = z.infer<typeof tableSafetyPracticeDtoSchema>
