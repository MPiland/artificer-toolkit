import { describe, expect, it } from 'vitest'

import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  createMovementReactionChoiceDefinition,
  resumeMovementReactionChoice,
  startMovementReactionChoice
} from './movementReactionChoice.js'
import { DND5E_SYSTEM_ID } from './systems/dnd5e/characterActionCapabilityDiscovery.js'
import { createDnd5eCharacterActionRuntime } from './systems/dnd5e/characterActionRuntime.js'

const DEFINITION_ID = '00000000-0000-4000-8000-0000000000e1'
const OCCURRENCE_ID = '00000000-0000-4000-8000-0000000000e2'

function runtime() {
  return createDnd5eCharacterActionRuntime({
    continuationIntegrityKey: new Uint8Array(32).fill(3),
    definitions: {
      async requireCurrent() {
        throw new Error('The resolved choice source must not be looked up again.')
      }
    }
  })
}

describe('movement reaction bounded choice', () => {
  it('publishes one portable System-owned choice graph and settles an exact index', async () => {
    const published = createMovementReactionChoiceDefinition({
      definitionId: DEFINITION_ID,
      gameSystemId: DND5E_SYSTEM_ID
    })
    expect(published.checksum).toBe(checksumRuleDocument(published.definition))

    const rulesRuntime = runtime()
    const continuation = await startMovementReactionChoice({
      runtime: rulesRuntime,
      occurrenceId: OCCURRENCE_ID,
      published,
      optionCount: 3
    })
    expect(continuation.request).toMatchObject({
      min: 0,
      max: 2,
      nodeId: 'choice'
    })
    await expect(
      resumeMovementReactionChoice({
        runtime: rulesRuntime,
        continuation,
        selectedIndex: 1
      })
    ).resolves.toBe(1)
  })

  it('rejects empty or out-of-range choices', async () => {
    const published = createMovementReactionChoiceDefinition({
      definitionId: DEFINITION_ID,
      gameSystemId: DND5E_SYSTEM_ID
    })
    await expect(
      startMovementReactionChoice({
        runtime: runtime(),
        occurrenceId: OCCURRENCE_ID,
        published,
        optionCount: 0
      })
    ).rejects.toThrow('between 1 and')

    const rulesRuntime = runtime()
    const continuation = await startMovementReactionChoice({
      runtime: rulesRuntime,
      occurrenceId: OCCURRENCE_ID,
      published,
      optionCount: 2
    })
    await expect(
      resumeMovementReactionChoice({
        runtime: rulesRuntime,
        continuation,
        selectedIndex: 2
      })
    ).rejects.toThrow('exactly satisfy the issued request')
  })
})
