import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { compileCreature } from '@artificer-toolkit/shared/compilers'

import { srdBaselineContent } from '../source-data/srd/index.js'

const EXPECTED_LOADOUT_ENTRIES = 93
const EXPECTED_LOADED_CREATURES = 64
const EXPECTED_ID_MANIFEST_SHA256 =
  '70a60df26fd2e54fe56503208fce23601880a9fb6264d00eb88a0d3a24fb23fd'
const SUPPLEMENTAL_EQUIPMENT_IDS = new Set([
  '00000000-0000-0000-0060-017c00000000',
  '00000000-0000-0000-0060-017d00000000',
  '00000000-0000-0000-0060-017e00000000',
  '00000000-0000-0000-0060-017f00000000',
  '00000000-0000-0000-0060-018000000000'
])

describe('SRD Creature equipment loadouts', () => {
  it('uses structured Feature options for the Dryad and Duergar held-weapon variants', () => {
    const actionDice = (label: string, featureLabel: string) => {
      const creature = srdBaselineContent.subjects.creatures.find(
        (candidate) => candidate.label === label
      )
      const feature = creature?.features?.find((candidate) => candidate.label === featureLabel)
      if (!feature) throw new Error(`Missing ${label} ${featureLabel} source fixture.`)
      return (feature.options ?? []).flatMap((option) =>
        (option.effects ?? []).flatMap((effect) =>
          effect.paths.flatMap((path) =>
            path.pathCode === 'ON_HIT' && 'resultBlock' in path
              ? path.resultBlock.outcomes.flatMap((outcome) =>
                  outcome.effectKind === 'DAMAGE' && 'diceConfig' in outcome
                    ? [outcome.diceConfig]
                    : []
                )
              : []
          )
        )
      )
    }

    expect(actionDice('Dryad', 'Club')).toEqual(['1d4', '1d8+4'])
    expect(actionDice('Duergar', 'War Pick')).toEqual(['1d8+2', '2d8+2'])
    expect(actionDice('Duergar', 'Javelin')).toEqual(['1d6+2', '1d6+2', '2d6+2', '2d6+2'])

    const attackExpressions = (label: string, featureLabel: string) => {
      const creature = srdBaselineContent.subjects.creatures.find(
        (candidate) => candidate.label === label
      )
      const feature = creature?.features?.find((candidate) => candidate.label === featureLabel)
      if (!feature) throw new Error(`Missing ${label} ${featureLabel} source fixture.`)
      return (feature.options ?? []).flatMap((option) =>
        (option.rollDefinitions ?? [])
          .filter((definition) => definition.kind === 'ATTACK')
          .map((definition) => definition.expression.modifier)
      )
    }

    expect(attackExpressions('Dryad', 'Club')).toEqual([2, 6])
    expect(attackExpressions('Duergar', 'War Pick')).toEqual([4, 4])
    expect(attackExpressions('Duergar', 'Javelin')).toEqual([4, 4, 4, 4])

    const obsolete = new Set([
      'CREATURE_DRYAD_SHILLELAGH_CLUB_DAMAGE',
      'CREATURE_DUERGAR_ENLARGED_WAR_PICK_DAMAGE',
      'CREATURE_DUERGAR_ENLARGED_JAVELIN_DAMAGE'
    ])
    const ruleKinds = srdBaselineContent.subjects.creatures.flatMap((creature) =>
      (creature.features ?? []).flatMap((feature) =>
        [
          ...(feature.effects ?? []),
          ...(feature.options?.flatMap((option) => option.effects ?? []) ?? [])
        ].flatMap((effect) =>
          effect.paths.flatMap((path) =>
            'resultBlock' in path
              ? path.resultBlock.outcomes.flatMap((outcome) =>
                  outcome.effectKind === 'CLOSED_RULE' ? [outcome.ruleKind] : []
                )
              : []
          )
        )
      )
    )
    expect(ruleKinds.some((ruleKind) => obsolete.has(ruleKind))).toBe(false)

    for (const label of ['Dryad', 'Duergar']) {
      const creature = srdBaselineContent.subjects.creatures.find(
        (candidate) => candidate.label === label
      )
      if (!creature) throw new Error(`Missing ${label} source fixture.`)
      expect(compileCreature(creature).equipmentLoadout).toEqual(creature.equipmentLoadout)
    }
  })

  it('binds every authored loadout occurrence to one same-System item and typed action feature', () => {
    const equipmentById = new Map(
      srdBaselineContent.subjects.equipment.map((equipment) => [equipment.id, equipment])
    )
    const occurrenceIds = new Set<string>()
    const boundActionFeatureIds = new Set<string>()
    const exactBindings: string[] = []
    let entries = 0
    let creatures = 0

    for (const creature of srdBaselineContent.subjects.creatures) {
      const loadout = creature.equipmentLoadout ?? []
      if (loadout.length > 0) creatures += 1

      for (const entry of loadout) {
        entries += 1
        expect(occurrenceIds.has(entry.id)).toBe(false)
        occurrenceIds.add(entry.id)
        expect(entry.quantity).toBe(1)
        expect(entry.useState).toBe('HELD')
        expect(entry.attuned).toBe(false)

        const equipment = equipmentById.get(entry.equipmentId)
        expect(equipment).toBeDefined()
        expect(equipment?.systemId).toBe(creature.systemId)

        for (const featureId of entry.actionFeatureIds) {
          expect(boundActionFeatureIds.has(featureId)).toBe(false)
          boundActionFeatureIds.add(featureId)
          const feature = creature.features?.find((candidate) => candidate.id === featureId)
          expect(feature).toBeDefined()
          const actionEffects = [
            ...(feature?.effects ?? []),
            ...(feature?.options?.flatMap((option) => option.effects ?? []) ?? [])
          ]
          expect(actionEffects.some((effect) => effect.invocation.kind === 'ACTION')).toBe(true)
          const actionSources = [feature, ...(feature?.options ?? [])].filter(
            (source) =>
              source?.effects?.some((effect) => effect.invocation.kind === 'ACTION') ?? false
          )
          for (const source of actionSources) {
            expect(
              source?.rollDefinitions?.filter((definition) => definition.kind === 'ATTACK'),
              `${creature.label} / ${source?.label}`
            ).toHaveLength(1)
          }
          exactBindings.push(`${creature.id}|${featureId}|${entry.equipmentId}`)
        }
      }
    }

    expect(entries).toBe(EXPECTED_LOADOUT_ENTRIES)
    expect(creatures).toBe(EXPECTED_LOADED_CREATURES)
    expect(createHash('sha256').update(exactBindings.sort().join('\n')).digest('hex')).toBe(
      EXPECTED_ID_MANIFEST_SHA256
    )
  })

  it('contains the five authorized Creature equipment supplements with their exact action bindings', () => {
    const expected = [
      {
        creatureId: '00000000-0000-0000-0070-009a00000000',
        equipmentId: '00000000-0000-0000-0060-017c00000000',
        featureId: '00000000-0001-0004-0070-009a00000000',
        label: 'Grimlock / Spiked Bone Club'
      },
      {
        creatureId: '00000000-0000-0000-0070-00ba00000000',
        equipmentId: '00000000-0000-0000-0060-017d00000000',
        featureId: '00000000-0001-0004-0070-00ba00000000',
        label: 'Lizardfolk / Heavy Club'
      },
      {
        creatureId: '00000000-0000-0000-0070-00ba00000000',
        equipmentId: '00000000-0000-0000-0060-017e00000000',
        featureId: '00000000-0001-0006-0070-00ba00000000',
        label: 'Lizardfolk / Spiked Shield'
      },
      {
        creatureId: '00000000-0000-0000-0070-00af00000000',
        equipmentId: '00000000-0000-0000-0060-017f00000000',
        featureId: '00000000-0001-0008-0070-00af00000000',
        label: 'Iron Golem Sword'
      },
      {
        creatureId: '00000000-0000-0000-0070-010a00000000',
        equipmentId: '00000000-0000-0000-0060-018000000000',
        featureId: '00000000-0001-0005-0070-010a00000000',
        label: 'Storm Giant Rock'
      }
    ] as const

    for (const { creatureId, equipmentId, featureId, label } of expected) {
      const creature = srdBaselineContent.subjects.creatures.find(
        (candidate) => candidate.id === creatureId
      )
      const equipment = srdBaselineContent.subjects.equipment.find(
        (candidate) => candidate.id === equipmentId
      )
      const feature = creature?.features?.find((candidate) => candidate.id === featureId)

      expect(creature, label).toBeDefined()
      expect(equipment, label).toBeDefined()
      expect(feature, label).toBeDefined()
      expect(creature?.equipmentLoadout).toContainEqual(
        expect.objectContaining({
          equipmentId,
          actionFeatureIds: [featureId]
        })
      )
    }
  })

  it('keeps each supplemental item action equal to its bound Creature action base mechanics', () => {
    const equipmentById = new Map(
      srdBaselineContent.subjects.equipment.map((equipment) => [equipment.id, equipment])
    )

    for (const creature of srdBaselineContent.subjects.creatures) {
      for (const entry of creature.equipmentLoadout ?? []) {
        if (!SUPPLEMENTAL_EQUIPMENT_IDS.has(entry.equipmentId)) continue

        const equipmentAction = equipmentById
          .get(entry.equipmentId)
          ?.effects?.find((effect) => effect.invocation.kind === 'ACTION')
        const featureAction = creature.features
          ?.find((feature) => feature.id === entry.actionFeatureIds[0])
          ?.effects?.find((effect) => effect.invocation.kind === 'ACTION')

        expect(equipmentAction?.invocation.triggerCode).toBe(featureAction?.invocation.triggerCode)
        expect(equipmentAction?.invocation.range?.rangeKind).toBe(
          featureAction?.invocation.range?.rangeKind
        )
        expect(
          equipmentAction?.paths?.flatMap((path) =>
            'resultBlock' in path
              ? path.resultBlock.outcomes.flatMap((outcome) =>
                  outcome.effectKind === 'DAMAGE' &&
                  outcome.valueKind === 'DICE' &&
                  'diceConfig' in outcome
                    ? [
                        {
                          effectKind: outcome.effectKind,
                          damageTypeId: outcome.damageTypeId,
                          valueKind: outcome.valueKind,
                          diceConfig: outcome.diceConfig?.split('+')[0]
                        }
                      ]
                    : []
                )
              : []
          )
        ).toEqual(
          featureAction?.paths?.flatMap((path) =>
            'resultBlock' in path
              ? path.resultBlock.outcomes.flatMap((outcome) =>
                  outcome.effectKind === 'DAMAGE' &&
                  outcome.valueKind === 'DICE' &&
                  'diceConfig' in outcome
                    ? [
                        {
                          effectKind: outcome.effectKind,
                          damageTypeId: outcome.damageTypeId,
                          valueKind: outcome.valueKind,
                          diceConfig: outcome.diceConfig?.split('+')[0]
                        }
                      ]
                    : []
                )
              : []
          )
        )
      }
    }
  })

  it('does not infer excluded Creature identities or ambiguous generic shields as equipment', () => {
    const excludedCreatureIds = [
      '00000000-0000-0000-0070-006900000000',
      '00000000-0000-0000-0070-010200000000'
    ]
    const genericShieldIds = new Set([
      '00000000-0000-0000-0060-016200000000',
      '00000000-0000-0000-0060-016600000000'
    ])

    for (const creatureId of excludedCreatureIds) {
      const creature = srdBaselineContent.subjects.creatures.find(
        (candidate) => candidate.id === creatureId
      )
      expect(creature?.equipmentLoadout).toBeUndefined()
    }

    expect(
      srdBaselineContent.subjects.creatures
        .flatMap((creature) => creature.equipmentLoadout ?? [])
        .some((entry) => genericShieldIds.has(entry.equipmentId))
    ).toBe(false)
  })
})
