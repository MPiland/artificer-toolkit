import { describe, expect, it, vi } from 'vitest'

import type { EncounterActorRecord } from '@artificer-toolkit/db'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  DND5E_REACTION_ALLOWANCE_DEFINITION_ID
} from '../rules/systems/dnd5e/reactionEligibilityPolicy.js'
import { DND5E_SYSTEM_ID } from '../rules/systems/dnd5e/characterActionCapabilityDiscovery.js'
import { resolveEncounterMovementReactionRuleStates } from './encounterMovementReactionRuleState.js'

const ENCOUNTER_ID = '11111111-1111-4111-8111-111111111111'
const CHARACTER_ACTOR_ID = '22222222-2222-4222-8222-222222222222'
const CHARACTER_ID = '33333333-3333-4333-8333-333333333333'
const CREATURE_ACTOR_ID = '44444444-4444-4444-8444-444444444444'
const CONDITION_ID = '55555555-5555-4555-8555-555555555555'
const CONTRIBUTION_ID = '66666666-6666-4666-8666-666666666666'
const SOURCE_ID = '77777777-7777-4777-8777-777777777777'
const USER_ID = '88888888-8888-4888-8888-888888888888'

function actor(input: {
  id: string
  kind: 'CHARACTER' | 'CREATURE'
  sourceId: string
  conditions?: EncounterActorRecord['conditions']
  resources?: EncounterActorRecord['resources']
}): EncounterActorRecord {
  return {
    id: input.id,
    encounterId: ENCOUNTER_ID,
    kind: input.kind,
    sourceId: input.sourceId,
    sourceRevision: 1,
    label: input.kind,
    systemId: DND5E_SYSTEM_ID,
    stableTieKey: input.id,
    initiative: null,
    manualOrder: null,
    public: true,
    currentHitPoints: 10,
    maxHitPoints: 10,
    tempHitPoints: 0,
    conditions: input.conditions ?? [],
    resources: input.resources ?? {},
    gmNotes: null,
    snapshot: null,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z'
  }
}

function current(input: {
  id: string
  family: string
  document: ReusableDefinitionCurrentDto['document']
}): ReusableDefinitionCurrentDto {
  return {
    id: input.id,
    gameSystemId: DND5E_SYSTEM_ID,
    contentSourceId: SOURCE_ID,
    definitionFamilyKey: input.family,
    label: input.family,
    description: null,
    document: input.document,
    checksum: checksumRuleDocument(input.document),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-08-28T00:00:00.000Z',
    publishedBy: USER_ID
  }
}

const definitions = [
  current({
    id: DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
    family: 'rule-capability',
    document: {
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
      gameSystemId: DND5E_SYSTEM_ID,
      usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
    }
  }),
  current({
    id: DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
    family: 'rule-capability',
    document: {
      schemaVersion: 1,
      kind: 'RULE_CAPABILITY',
      id: DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
      gameSystemId: DND5E_SYSTEM_ID,
      usage: null
    }
  }),
  current({
    id: CONDITION_ID,
    family: 'condition-rule-state',
    document: {
      schemaVersion: 1,
      kind: 'CONDITION_RULE_STATE',
      id: CONDITION_ID,
      gameSystemId: DND5E_SYSTEM_ID,
      capabilitySuppressions: [
        {
          id: CONTRIBUTION_ID,
          order: 0,
          kind: 'CAPABILITY_SUPPRESS',
          capabilityDefinitionIds: [
            DND5E_REACTION_ALLOWANCE_DEFINITION_ID,
            DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID
          ].sort()
        }
      ]
    }
  })
]

describe('Encounter movement reaction rule state', () => {
  it('resolves locked Character and Encounter actor condition UUIDs through one cached definition source', async () => {
    const character = actor({
      id: CHARACTER_ACTOR_ID,
      kind: 'CHARACTER',
      sourceId: CHARACTER_ID
    })
    const creature = actor({
      id: CREATURE_ACTOR_ID,
      kind: 'CREATURE',
      sourceId: SOURCE_ID,
      resources: { ruleUsage: { [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]: 1 } }
    })
    const byId = new Map(definitions.map((definition) => [definition.id, definition]))
    const requireCurrent = vi.fn(async (definitionId: string) => {
      const definition = byId.get(definitionId)
      if (!definition) throw new Error('missing')
      return definition
    })
    const resolved = await resolveEncounterMovementReactionRuleStates({
      encounter: {
        actors: [creature, character],
        gameSystemId: DND5E_SYSTEM_ID
      },
      lockedCharacters: new Map([
        [CHARACTER_ID, { actor: character, activeConditionDefinitionIds: [CONDITION_ID] }]
      ]),
      definitions: { requireCurrent }
    })

    expect(resolved.get(CHARACTER_ACTOR_ID)?.capabilityState.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ available: false }),
        expect.objectContaining({ available: false })
      ])
    )
    expect(resolved.get(CREATURE_ACTOR_ID)).toMatchObject({
      capabilityState: {
        capabilities: [{ available: true }, { available: true }]
      },
      ruleUsage: { [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]: 1 }
    })
    expect(requireCurrent).toHaveBeenCalledTimes(3)
  })

  it('fails closed for a missing Character lock or non-normalized Encounter condition state', async () => {
    const character = actor({
      id: CHARACTER_ACTOR_ID,
      kind: 'CHARACTER',
      sourceId: CHARACTER_ID
    })
    await expect(
      resolveEncounterMovementReactionRuleStates({
        encounter: { actors: [character], gameSystemId: DND5E_SYSTEM_ID },
        lockedCharacters: new Map(),
        definitions: {
          async requireCurrent() {
            throw new Error('unused')
          }
        }
      })
    ).rejects.toThrow('was not locked')

    const creature = actor({
      id: CREATURE_ACTOR_ID,
      kind: 'CREATURE',
      sourceId: SOURCE_ID,
      conditions: { malformed: true }
    })
    await expect(
      resolveEncounterMovementReactionRuleStates({
        encounter: { actors: [creature], gameSystemId: DND5E_SYSTEM_ID },
        lockedCharacters: new Map(),
        definitions: {
          async requireCurrent() {
            throw new Error('unused')
          }
        }
      })
    ).rejects.toThrow('not normalized')
  })
})
