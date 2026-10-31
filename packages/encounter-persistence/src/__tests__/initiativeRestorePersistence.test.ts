import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  evaluateSrdCharacter,
  srdFeature
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdCharacter'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { describe, expect, it } from 'vitest'

import {
  persistEncounterInitiativeRestores,
  type EncounterInitiativeRestoreCharacterRules
} from '../initiativeRestorePersistence.js'
import { createMemoryEncounterStore } from '../memoryEncounterStore.js'
import type { EncounterCharacterWriteTransaction } from '../ports.js'
import type { EncounterDocument } from '../store.js'

const ENCOUNTER_ID = '00000000-0000-4000-8000-0000000f0001'
const MONK_ACTOR = '00000000-0000-4000-8000-0000000f0002'
const MONK_ID = '00000000-0000-4000-8000-0000000f0003'
const GOBLIN_ACTOR = '00000000-0000-4000-8000-0000000f0004'
const ROOT_COMMAND = '00000000-0000-4000-8000-0000000f0005'
const OCCURRENCE = '00000000-0000-4000-8000-0000000f0006'
const OCCURRED_AT = '2026-10-20T00:00:00.000Z'

const monk = evaluateSrdCharacter({
  classes: [{ label: 'Monk', level: 20 }],
  features: [
    srdFeature({ owner: 'CLASS', classLabel: 'Monk', featureLabel: 'Perfect Self', level: 20 })
  ]
})

/** The Monk's ki pool as the policy would resolve it, named by the charge the real feature restores. */
function kiPool(used: number): CharacterRulePolicyOutput['resources'][number] {
  const [source] = monk.initiativeRestoreSources
  if (!source) throw new Error('The SRD Monk carries no initiative restore.')
  const poolId = createCharacterResourceOwnerKey({ kind: 'AUTHORED_GRANT', resourceGrantId: 'ki' })
  return {
    ownerKind: 'AUTHORED_GRANT',
    resourceGrantId: 'ki',
    availableAtLevel: 2,
    activeSourceLevel: 20,
    sequence: 0,
    poolId,
    resourceDefinitionId: 'ki',
    chargeId: source.chargeId,
    chargeCalculationId: poolId,
    state: 'RESOLVED',
    maximum: 20,
    rawUsed: used,
    effectiveUsed: used,
    remaining: 20 - used,
    reasonCode: 'CALCULATED',
    baseContribution: { sourceId: 'ki', value: 20 },
    bonusContributions: [],
    resetKind: 'SHORT_REST',
    resetResolution: { baseResetKind: 'SHORT_REST', appliedGrantId: null, source: null }
  }
}

const actors = [
  { id: GOBLIN_ACTOR, kind: 'CREATURE', sourceId: 'goblin' },
  { id: MONK_ACTOR, kind: 'CHARACTER', sourceId: MONK_ID }
] as unknown as EncounterRunActorState[]

function run(used: number) {
  const batches: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>[] = []
  const play = {
    _id: 'play',
    _creationTime: 1,
    characterId: MONK_ID,
    maximumHitPoints: 100,
    state: { hitpoints: {} }
  }
  const memory = createMemoryEncounterStore()
  memory.load(
    'characterPlayStates',
    [play] as unknown as EncounterDocument<'characterPlayStates'>[],
    { validate: false }
  )
  const ctx = {
    db: memory.store,
    ports: {
      readCharacterRow: async (characterId: string) => (characterId === MONK_ID ? { play } : null)
    }
  } as unknown as EncounterCharacterWriteTransaction
  const rules: EncounterInitiativeRestoreCharacterRules = {
    initiativeRestoreSources: monk.initiativeRestoreSources,
    output: { resources: [kiPool(used)] }
  }
  return {
    batches,
    settle: () =>
      persistEncounterInitiativeRestores(
        ctx,
        {
          state: { id: ENCOUNTER_ID, version: 3 } as never,
          campaign: {} as EncounterDocument<'campaigns'>,
          actors,
          orderedActorIds: [GOBLIN_ACTOR, MONK_ACTOR],
          rootCommandId: ROOT_COMMAND,
          occurrenceId: OCCURRENCE,
          occurredAt: OCCURRED_AT
        },
        {
          readCharacterRules: async () => rules,
          applyMechanics: async (batch) => {
            batches.push(batch)
            return {} as never
          }
        }
      )
  }
}

describe('persistEncounterInitiativeRestores', () => {
  it('raises an empty pool of a Character that rolled, one batch under a replay-stable command id', async () => {
    const first = run(20)
    await first.settle()
    await first.settle()
    expect(first.batches).toHaveLength(2)
    expect(first.batches[0]).toEqual(first.batches[1])
    expect(first.batches[0]).toMatchObject({
      encounterId: ENCOUNTER_ID,
      targetActorId: MONK_ACTOR,
      applications: [],
      forceVersionAdvance: false,
      characterResourceRestores: [{ beforeRemaining: 0, afterRemaining: 4, afterUsed: 16 }],
      commandId: deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId: OCCURRENCE,
        sourceCommandId: ROOT_COMMAND,
        phase: 'INITIATIVE_RESTORE',
        ordinal: 1,
        targetCharacterId: MONK_ID
      })
    })
  })

  it('restores nothing for a Character with ki left, and nothing for a Creature', async () => {
    const scenario = run(19)
    await scenario.settle()
    expect(scenario.batches).toEqual([])
  })
})
