import { describe, expectTypeOf, it } from 'vitest'

import {
  encounterConcealmentCheckPendingContextDtoSchema,
  type EncounterConcealmentCheckPendingContextDto
} from '../shared/ruleExecutionDirectActionPendingContexts.js'
import type { z } from '../zod.js'

describe('the concealment check pending context', () => {
  /** The hand-written type exists only to keep embedding settlements within the compiler's size limit. */
  it('is exactly what its schema parses', () => {
    expectTypeOf<EncounterConcealmentCheckPendingContextDto>().toEqualTypeOf<
      z.infer<typeof encounterConcealmentCheckPendingContextDtoSchema>
    >()
  })
})
