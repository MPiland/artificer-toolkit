import { describe, expect, it } from 'vitest'

import type { EncounterActorRecord } from '@artificer-toolkit/db'
import { ruleCapabilityReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleState'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import {
  DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
  DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
} from '../rules/systems/dnd5e/actionEconomyPolicy.js'
import { DND5E_REACTION_ALLOWANCE_DEFINITION_ID } from '../rules/systems/dnd5e/reactionEligibilityPolicy.js'
import {
  applyStagedActionEconomyRefreshes,
  mergeEncounterActorTerminalUpdates,
  stageEncounterActionEconomyRefreshes
} from './encounterActionEconomyRefresh.js'
import { encounterRuleUsageSnapshot } from './encounterActorState.js'

const systemId = '00000000-0000-0000-0000-000000000001'
const userId = '00000000-0000-4000-8000-000000000001'
const sourceId = '00000000-0000-4000-8000-000000000002'
const actorId = '00000000-0000-4000-8000-000000000003'

function current(definitionId: string): ReusableDefinitionCurrentDto {
  const document = ruleCapabilityReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'RULE_CAPABILITY',
    id: definitionId,
    gameSystemId: systemId,
    usage: { maximum: 1, refreshBoundary: 'START_OF_TURN' }
  })
  return {
    id: definitionId,
    gameSystemId: systemId,
    contentSourceId: sourceId,
    definitionFamilyKey: 'rule-capability',
    label: 'Fixture',
    description: null,
    document,
    checksum: checksumRuleDocument(document),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-08-31T00:00:00.000Z',
    publishedBy: userId
  }
}

function actor(): EncounterActorRecord {
  return {
    id: actorId,
    encounterId: '00000000-0000-4000-8000-000000000004',
    kind: 'CREATURE',
    sourceId: null,
    sourceRevision: 1,
    label: 'Fixture',
    systemId,
    stableTieKey: 'fixture',
    public: true,
    currentHitPoints: 1,
    maxHitPoints: 1,
    tempHitPoints: 0,
    conditions: [],
    resources: {
      ruleUsage: {
        [DND5E_ACTION_ALLOWANCE_DEFINITION_ID]: 1,
        [DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID]: 1,
        [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]: 1,
        '00000000-0000-4000-8000-000000000099': 4
      }
    },
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {},
    createdAt: '2026-08-31T00:00:00.000Z',
    updatedAt: '2026-08-31T00:00:00.000Z'
  }
}

describe('Encounter action-economy refresh', () => {
  it('stages and applies only System-selected START_OF_TURN usage refreshes', async () => {
    const definitions = new Map(
      [
        DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
        DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
        DND5E_REACTION_ALLOWANCE_DEFINITION_ID
      ].map((id) => [id, current(id)])
    )
    const owner = actor()
    const source = { requireCurrent: async (id: string) => definitions.get(id)! }

    const staged = await stageEncounterActionEconomyRefreshes({
      actorId,
      encounter: { actors: [owner] },
      definitions: source
    })
    expect(staged.refreshes).toHaveLength(3)
    expect(encounterRuleUsageSnapshot(staged.refreshedActor!)).toMatchObject({
      [DND5E_ACTION_ALLOWANCE_DEFINITION_ID]: 0,
      [DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID]: 0,
      [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]: 0,
      '00000000-0000-4000-8000-000000000099': 4
    })

    const applied = await applyStagedActionEconomyRefreshes({
      encounter: { actors: [owner] },
      definitions: source,
      refreshes: staged.refreshes
    })
    expect(encounterRuleUsageSnapshot(applied[0]!)).toMatchObject({
      [DND5E_ACTION_ALLOWANCE_DEFINITION_ID]: 0,
      [DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID]: 0,
      [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]: 0,
      '00000000-0000-4000-8000-000000000099': 4
    })
    await expect(
      applyStagedActionEconomyRefreshes({
        encounter: { actors: [...applied] },
        definitions: source,
        refreshes: staged.refreshes
      })
    ).rejects.toThrow('refresh plan is stale')
  })

  it('preserves a same-actor feature-charge mutation when applying a rule-usage refresh', async () => {
    const definitions = new Map(
      [
        DND5E_ACTION_ALLOWANCE_DEFINITION_ID,
        DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
        DND5E_REACTION_ALLOWANCE_DEFINITION_ID
      ].map((id) => [id, current(id)])
    )
    const owner = actor()
    const source = { requireCurrent: async (id: string) => definitions.get(id)! }
    const staged = await stageEncounterActionEconomyRefreshes({
      actorId,
      encounter: { actors: [owner] },
      definitions: source
    })
    const refreshed = await applyStagedActionEconomyRefreshes({
      encounter: { actors: [owner] },
      definitions: source,
      refreshes: staged.refreshes
    })
    const merged = mergeEncounterActorTerminalUpdates([
      refreshed,
      [
        {
          ...owner,
          currentHitPoints: 0,
          resources: { featureCharges: { breath: 0 } }
        }
      ]
    ])

    expect(merged).toHaveLength(1)
    expect(merged[0]).toMatchObject({
      currentHitPoints: 0,
      resources: {
        featureCharges: { breath: 0 },
        ruleUsage: {
          [DND5E_ACTION_ALLOWANCE_DEFINITION_ID]: 0,
          [DND5E_BONUS_ACTION_ALLOWANCE_DEFINITION_ID]: 0,
          [DND5E_REACTION_ALLOWANCE_DEFINITION_ID]: 0
        }
      }
    })
  })
})
