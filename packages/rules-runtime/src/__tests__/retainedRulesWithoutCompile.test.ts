import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import * as featureCompilers from '@artificer-toolkit/shared/compilers'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/subjects/authored'
import * as subjectCompilers from '@artificer-toolkit/shared/subjects/compilers'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { fireBolt } from '@artificer-toolkit/source-data/srd/spells/fire-bolt.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { describe, expect, it, vi } from 'vitest'

import { evaluateCharacterRules } from '../character/characterRuleEvaluation.js'
import { prepareCharacterRuleContext } from '../character/contextPreparation.js'
import { createSnapshotReaders } from '../character/snapshotReaders.js'
import { emptyCharacter, scopeObjects, system } from '../testing/characterContextFixtures.js'
import { pinnedRetainedRulesJson } from '../testing/pinnedRetainedRules.js'

vi.mock('@artificer-toolkit/shared/subjects/compilers', async (importOriginal) => {
  const actual = await importOriginal<typeof subjectCompilers>()
  return {
    ...actual,
    compileResolvedEquipment: vi.fn(actual.compileResolvedEquipment),
    compileSpell: vi.fn(actual.compileSpell)
  }
})
vi.mock('@artificer-toolkit/shared/compilers', async (importOriginal) => {
  const actual = await importOriginal<typeof featureCompilers>()
  return { ...actual, compileFeature: vi.fn(actual.compileFeature) }
})

// D163 ruling C: retained rules are the stored compiler output, so the engine hydrates them as is.
describe('Retained acquired rules', () => {
  it('evaluate from the pinned compilations with no compile call', async () => {
    const featureId = crypto.randomUUID()
    const equipment: EquipmentAuthored = {
      ...backpack,
      description: 'A pack whose prose outlives its source.',
      features: [
        {
          id: featureId,
          label: 'Retained cantrip',
          description: 'The acquired item grants Fire Bolt.',
          order: 0,
          grants: {
            spells: [
              {
                id: crypto.randomUUID(),
                grantKind: 'SPELL_GRANT',
                selectionKind: 'GRANTED',
                scalingKind: 'NONE',
                authoringModeKind: 'SELECTED',
                spellIds: [fireBolt.id],
                attributes: ['KNOWN', 'CAST_AT_WILL'],
                castingAbility: 'INTELLIGENCE',
                order: 0
              }
            ]
          }
        }
      ]
    }
    const retainedRulesJson = pinnedRetainedRulesJson({
      systemId: system.id,
      equipment,
      spells: [fireBolt]
    })
    const pinned = acquiredEquipmentRulesSchema.parse(JSON.parse(retainedRulesJson))
    const projections = new Map(
      pinned.sources.map((source) => [
        source.subjectId,
        JSON.parse(source.compilation.projectionJson)
      ])
    )
    const character = emptyCharacter()
    const itemId = crypto.randomUUID()
    character.state.equipment.inventory.push({
      id: itemId,
      equipmentId: equipment.id,
      quantity: 1,
      retainedRulesJson
    })
    vi.clearAllMocks()

    // Neither source is current: only the pinned record can supply the item and its Spell.
    const readers = createSnapshotReaders(scopeObjects({ SPELL: [magicMissile] }))
    const context = await prepareCharacterRuleContext(character, system, undefined, readers)
    const evaluation = evaluateCharacterRules({
      character,
      context,
      spellsById: context.spellsById
    })

    expect(context.registry.acquiredEquipmentByItemId?.get(itemId)?.equipment).toEqual(
      projections.get(equipment.id)
    )
    expect(context.registry.equipment).toContainEqual(projections.get(equipment.id))
    expect(context.registry.features.map((feature) => feature.id)).toContain(featureId)
    expect(context.spellsById.get(fireBolt.id)).toEqual(projections.get(fireBolt.id))
    expect(context.presentation.equipment[equipment.id]?.description).toBe(equipment.description)
    expect(evaluation.output).toBeDefined()
    expect(subjectCompilers.compileResolvedEquipment).not.toHaveBeenCalled()
    expect(subjectCompilers.compileSpell).not.toHaveBeenCalled()
    expect(featureCompilers.compileFeature).not.toHaveBeenCalled()
  })
})
