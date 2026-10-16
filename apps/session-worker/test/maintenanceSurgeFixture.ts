import { currentSrdDefinition } from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { ruleMaintenanceReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleMaintenance'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import type { ClassFeature } from '../src/testing/srdCharacterSource.js'

export const MAINTENANCE_DEFINITION_ID = '00000000-0000-4000-8000-0000000008f0'

const maintenanceDocument = ruleMaintenanceReusableDefinitionDocumentDtoSchema.parse({
  schemaVersion: 1,
  kind: 'RULE_MAINTENANCE',
  id: MAINTENANCE_DEFINITION_ID,
  gameSystemId: srdSystemRecord.id,
  replacementPolicy: 'REPLACE_SAME_DEFINITION',
  emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY',
  damageCheckDefinitionId: null
})

/** The reusable maintenance policy the room serves, such as the one a Surge Feature maintains. */
export const maintenanceDefinition = currentSrdDefinition({
  id: maintenanceDocument.id,
  definitionFamilyKey: 'rule-maintenance',
  label: 'Native maintained effect fixture',
  description: 'Reusable maintenance policy for native test actions.',
  document: jsonValueSchema.parse(maintenanceDocument),
  checksum: checksumRuleDocument(maintenanceDocument)
})

/**
 * A Fighter Feature that spends one of two charges to heal 1d4 and maintains a maintenance
 * definition for three rounds: on the Fighter, or on one target.
 */
export function surgeFeature(input: { seed: number; label: string; self: boolean }): ClassFeature {
  const chargeId = testUuid(input.seed)
  return {
    id: testUuid(input.seed + 1),
    label: input.label,
    description: 'Heals and maintains a native test effect.',
    attributes: ['LIMITED_USE'],
    charges: {
      id: chargeId,
      limitKind: 'FIXED_AMOUNT',
      scalingKind: 'NONE',
      resetKind: 'SHORT_REST',
      amount: 2
    },
    availableAtLevel: 1,
    order: 1,
    effects: [
      {
        id: testUuid(input.seed + 2),
        order: 1,
        invocation: {
          kind: 'ACTION',
          triggerCode: 'ACTIVATED',
          resourceUse: { chargeId, cost: 1 },
          activation: { code: 'ACTION', amount: 1 },
          range: {
            id: testUuid(input.seed + 3),
            rangeKind: input.self ? 'SELF' : 'UNLIMITED'
          },
          targeting: input.self
            ? { selectionKind: 'SELF' }
            : { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: [
          {
            id: testUuid(input.seed + 4),
            order: 1,
            pathCode: 'ON_USE',
            groupType: 'SINGLE',
            originKind: 'SOURCE',
            selectionKind: 'FIXED',
            resultBlock: {
              id: testUuid(input.seed + 5),
              resultKind: 'SINGLE',
              maintenanceDefinitionId: MAINTENANCE_DEFINITION_ID,
              duration: { id: testUuid(input.seed + 6), durationKind: 'ROUND', amount: 3 },
              lifecycle: { recurringKind: 'START_OF_TURN' },
              outcomes: [
                {
                  id: testUuid(input.seed + 7),
                  effectKind: 'HEAL',
                  valueKind: 'DICE',
                  scalingKind: 'NONE',
                  diceConfig: '1d4'
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
